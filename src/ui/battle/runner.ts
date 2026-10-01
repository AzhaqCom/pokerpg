/**
 * Pilote du combat affiché : enchaîne étapes et vagues, avance la simulation
 * au rythme de l'écran, garde l'état d'animation de chaque combattant.
 * Singleton hors React ; l'UI le lit à chaque frame.
 */
import { sfx } from '../../audio/sfx';
import { BattleEvent } from '../../game/battle';
import { BIOMES, REGION_START } from '../../game/content';
import { move, species } from '../../game/data';
import {
  BETWEEN_WAVES_MS, CaptureOffer, GameState, StageKind, StageRun, WaveRewards, arenaAvailable, autoCaptureBall, bestStarsOf, bossAvailable,
  canPrestige, captureTarget, exitTower, isTargeted, maxBattleSpeed, SPEED_UNLOCKS, touchLastActive, tryCapture,
} from '../../game/game';
import { MAX_RARITY, RARITIES, RARITY_COLOR } from '../../game/model';
import { template } from '../../game/items';
import { chromaTier } from '../helpers';
import { rng, useGame } from '../../store/game';
import { CollectionGoal, wantedForBox } from '../../game/collection';
import { useSettings } from '../../store/settings';
import { getSprite } from '../../sprites/manifest';
import { preloadImage } from '../../sprites/imageCache';
import { toast } from '../../store/ui';

export interface FighterAnim {
  action: 'idle' | 'attack' | 'hurt';
  since: number; // ms (horloge du combat)
  lungeUntil: number;
  flashUntil: number;
  faintAt: number | null;
}

export interface Floater { id: number; fighter: string; text: string; color: string; t0: number; big?: boolean }

const AFTER_STAGE_MS = 1600;

/** Une offre de capture fait-elle avancer l'objectif de collection (Pokédex ou boîte) ? */
function wantedByGoal(s: GameState, speciesId: number, goal: CollectionGoal): boolean {
  if (goal === 'dex') return !s.dex.caught.includes(speciesId);
  if (goal === 'box' || goal === 'boxShiny') return wantedForBox(s, speciesId, false);
  return false;
}

class Runner {
  run: StageRun | null = null;
  /** horloge d'affichage du combat (ms), avance plus vite en ×2 / ×3 */
  clock = 0;
  /** horloge en temps réel (ms), indépendante de la vitesse : bandeaux d'annonce */
  realClock = 0;
  anims: Record<string, FighterAnim> = {};
  floaters: Floater[] = [];
  phase: 'fight' | 'between' | 'stageEnd' = 'fight';
  phaseUntil = 0;
  offer: { capture: CaptureOffer; expiresAfterWave: number } | null = null;
  banner: { text: string; until: number; color: string } | null = null;
  private next: StageKind | null = null;
  private floaterId = 1;
  paused = false;
  rev = 0;

  /** Demande un boss / l'arène / une étape précise (abandonne le combat en cours). */
  request(kind: StageKind) {
    this.next = kind;
    this.run = null;
  }

  restart() {
    this.next = null;
    this.run = null;
  }

  /**
   * Nouvelle partie ou prestige : tout ce qui vient de l'ancienne partie disparaît, surtout l'offre de capture en
   * cours (sinon un Arceus de Sinnoh reste capturable dans une partie neuve à Kanto).
   */
  newGame() {
    this.restart();
    this.offer = null;
    this.banner = null;
    this.floaters = [];
    this.paused = false;
  }

  private start() {
    const s = useGame.getState().s;
    if (!s || !s.starterChosen || !s.team.length) return;
    // dans la Tour de Combat (`towerFloor`), on enchaîne ses étages ; demander autre chose (boss, arène) en sort
    let kind: StageKind = this.next ?? (s.towerFloor !== null ? 'tower' : 'stage');
    this.next = null;
    if (kind !== 'tower' && s.towerFloor !== null) useGame.getState().act(exitTower);
    if (kind === 'tower' && s.towerFloor === null) kind = 'stage';
    if (kind === 'boss' && (!bossAvailable(s) || s.bossesBeaten[s.biome][s.zone])) kind = 'stage';
    if (kind === 'arena' && !arenaAvailable(s)) kind = 'stage';
    this.run = new StageRun(s, kind, rng);
    // les 3 vagues sont tirées d'avance : on décode tout de suite les sprites de tous leurs ennemis (et de l'équipe),
    // pour qu'un ennemi de la vague 2 ou 3 s'affiche dès son arrivée au lieu d'être décodé en plein combat
    for (const mon of [...this.run.waves.flat().map((e) => e.mon), ...s.team.map((u) => s.mons[u])]) {
      const sprite = getSprite(mon.speciesId, mon.shiny);
      if (sprite) preloadImage(sprite.asset);
    }
    this.phase = 'fight';
    this.resetAnims();
    const biome = BIOMES[s.biome];
    const zone = biome.zones[s.zone];
    if (kind === 'boss') this.showBanner(`Boss : ${species(zone.boss.speciesId).name} !`, '#ff5252');
    else if (kind === 'arena') this.showBanner(`${biome.arena.name} : ${biome.arena.leader} vous défie !`, '#ffb300');
    else if (kind === 'tower') this.showBanner(`Tour de Combat : étage ${this.run.floor}`, '#b388ff');
  }

  private resetAnims() {
    this.anims = {};
    for (const f of this.run!.battle.fighters) {
      this.anims[f.id] = { action: 'idle', since: this.clock, lungeUntil: 0, flashUntil: 0, faintAt: f.alive ? null : this.clock - 1000 };
    }
  }

  private showBanner(text: string, color: string) {
    this.banner = { text, color, until: this.realClock + 2200 }; // temps réel : lisible même en ×3
  }

  private float(fighter: string, text: string, color: string, big = false) {
    this.floaters.push({ id: this.floaterId++, fighter, text, color, t0: this.clock, big });
  }

  /** Avance de dtMs (temps réel). */
  update(dtMs: number) {
    if (this.paused) return;
    const s = useGame.getState().s;
    const speed = s ? Math.min(useSettings.getState().speed, maxBattleSpeed(s)) : 1;
    this.realClock += Math.min(100, dtMs);
    const dt = Math.min(100, dtMs) * speed;
    this.clock += dt;
    this.floaters = this.floaters.filter((f) => this.clock - f.t0 < 1000);
    if (!this.run) { this.start(); this.rev++; return; }
    const b = this.run.battle;
    if (this.phase === 'fight') {
      b.step(dt / 1000);
      for (const e of b.drain()) this.onEvent(e);
      if (b.result) {
        this.phase = b.result === 'win' && this.run.waveIndex + 1 >= this.run.waves.length ? 'stageEnd' : 'between';
        this.phaseUntil = this.clock + (this.phase === 'stageEnd' ? AFTER_STAGE_MS : BETWEEN_WAVES_MS);
        if (b.result === 'lose') this.phaseUntil = this.clock + AFTER_STAGE_MS;
      }
    } else if (this.clock >= this.phaseUntil) {
      this.endWave();
    }
    this.rev++;
  }

  private endWave() {
    const run = this.run!;
    const lost = run.battle.result === 'lose';
    const rewards = useGame.getState().act((st) => { touchLastActive(st); return run.finishWave(); });
    if (this.offer && this.offer.expiresAfterWave <= 0) this.offer = null;
    else if (this.offer) this.offer.expiresAfterWave--;
    if (rewards) this.onRewards(rewards);
    if (run.result) {
      const s = useGame.getState().s!;
      if (run.result === 'win') {
        if (run.kind === 'boss') { sfx('medal'); toast(`${species(BIOMES[run.biome].zones[run.zone].boss.speciesId).name} vaincu !`, '#ffb300'); }
        else if (run.kind === 'arena') {
          sfx('evolve');
          // Champion d'une région, Pokédex complet : pause le temps du récap (voir App.tsx/PrestigeOffer), le
          // joueur choisit « Nouveau départ » ou « Plus tard ». Pokédex incomplet : pas de récap, on continue.
          if (REGION_START.includes(run.biome + 1)) { if (canPrestige(s) && !s.prestigeOffered) this.paused = true; }
          // seulement si l'arène donne vraiment un badge : une arène sans badge (Route des Marais…) laisse le total
          // inchangé et relançait le déblocage, forçant ×3 même si le joueur avait baissé la vitesse
          else if (BIOMES[run.biome].arena.grantsBadge !== false && SPEED_UNLOCKS.some(([badges]) => badges === s.badges)) {
            // 1er badge de la région : ×2, 4e : ×3 (voir `maxBattleSpeed`) — activée d'office plutôt que de laisser
            // le joueur découvrir un bouton caché dans le HUD.
            const speed = maxBattleSpeed(s);
            useSettings.getState().set({ speed });
            toast(`${BIOMES[run.biome].arena.badge} obtenu ! Vitesse ×${speed} débloquée et activée`, '#ffb300');
          } else {
            toast(`${BIOMES[run.biome].arena.badge} obtenu !`, '#ffb300');
          }
        }
      } else if (lost) {
        sfx('deny');
        toast(run.kind === 'stage' ? `Défaite… retour à ${BIOMES[s.biome].zones[s.zone].name} ${s.stage}`
          : run.kind === 'tower' ? (s.towerFloor !== null
            ? `🗼 Défaite à l'étage ${run.floor} : reprise à l'étage ${s.towerFloor}` // combat continu
            : `🗼 Tour : arrêt à l'étage ${run.floor} (record : étage ${s.towerBest})`)
          : 'Défaite… entraîne-toi et réessaie', '#ff5252');
      }
      this.run = null;
    } else {
      this.phase = 'fight';
      this.resetAnims();
    }
  }

  private onRewards(r: WaveRewards) {
    const s = useGame.getState().s!;
    for (const lu of r.levelUps) {
      const m = s.mons[lu.uid];
      sfx('level');
      this.float(lu.uid, `Niv. ${lu.level} !`, '#7CFC00', true);
      // un seul message par Pokémon, toutes ses nouvelles capacités ensemble
      if (lu.newMoves.length) toast(`${species(m.speciesId).name} apprend ${lu.newMoves.map((id) => move(id).name).join(', ')}`);
    }
    // butin : un seul message par vague, coloré à la rareté du meilleur objet
    if (r.loot.length) {
      const best = r.loot.reduce((a, b) => (b.rarity > a.rarity ? b : a));
      const bestName = template(best.templateId).name;
      const others = r.loot.filter((it) => it !== best).map((it) => template(it.templateId).name);
      // Tour de Combat : les éclats de l'étage dans le même message que son objet
      toast(`+ ${[bestName, ...others].join(', ')}${r.shards ? ` · +${r.shards} 💎` : ''}`, RARITY_COLOR[best.rarity], bestName);
    }
    if (r.towerReward) {
      sfx('medal');
      toast(`🎁 Étage ${r.towerReward.floor} : Chromatique${r.towerReward.plus ? ` +${r.towerReward.plus}` : ''} à choisir sur la Carte`,
        r.towerReward.plus ? chromaTier(r.towerReward.plus).text : RARITY_COLOR[MAX_RARITY]);
    }
    if (r.capture) {
      const capture = r.capture;
      if (capture.guaranteed) {
        // capture garantie (boss, ou chromatique en vague normale) : directe, sauf réglage explicite
        // pour ne pas s'encombrer d'un chromatique dont l'espèce est déjà chromatique dans le Pokédex.
        const st0 = useSettings.getState();
        const shinyOwned = st0.collectionGoal === 'boxShiny' ? !wantedForBox(s, capture.speciesId, true) : s.dex.shiny.includes(capture.speciesId);
        if (capture.shiny && st0.skipOwnedShiny && shinyOwned) {
          toast(`✨ ${species(capture.speciesId).name} chromatique déjà obtenu, ignoré`, '#9575cd');
        } else {
          const mon = useGame.getState().act((st) => tryCapture(st, capture, null, rng));
          // un seul message : « ✨ Doduo chromatique capturé ! » plutôt que « chromatique ! » + « rejoint ta boîte »
          if (mon) {
            sfx('hatch');
            if (capture.shiny) toast(`✨ ${species(mon.speciesId).name} chromatique capturé !`, '#ff5ec4');
            else toast(`${species(mon.speciesId).name} rejoint ta boîte !`, '#7CFC00');
          }
        }
      } else {
        const known = s.dex.caught.includes(capture.speciesId);
        const settings = useSettings.getState();
        const belowThreeStars = bestStarsOf(s, capture.speciesId, capture.shiny) < 3; // normal comparé aux normaux
        const targetBall = isTargeted(s, capture.speciesId) ? autoCaptureBall(s, settings.autoCaptureBestBall) : null;
        if (targetBall) {
          // lignée ciblée (🎯) : capture auto même déjà possédée, conversion en bonbons selon le réglage
          const name = species(capture.speciesId).name;
          const r = useGame.getState().act((st) => captureTarget(st, capture, targetBall, rng, settings.convertTargets));
          if (!r?.mon) toast(`🎯 ${name} s'est échappé…`, '#ff8a80');
          else if (r.kept) { sfx('hatch'); toast(`🎯 ${name} rejoint ta boîte !`, '#7CFC00'); }
          else toast(`🎯 ${name} capturé → +${r.candies} bonbons`, '#7CFC00');
        } else if (settings.hideOwnedOffers && known && !belowThreeStars) {
          // espèce déjà possédée en bonne qualité : offre ignorée, pas d'affichage
        } else if (settings.collectionGoal !== 'off' && (wantedByGoal(s, capture.speciesId, settings.collectionGoal) || (settings.autoCaptureUpgrade && belowThreeStars))) {
          const ball = autoCaptureBall(s, settings.autoCaptureBestBall);
          if (ball) {
            const mon = useGame.getState().act((st) => tryCapture(st, capture, ball, rng));
            if (mon) { sfx('hatch'); toast(`${species(mon.speciesId).name} capturé automatiquement !`, '#7CFC00'); }
            else toast(`${species(capture.speciesId).name} s'est échappé…`, '#ff8a80');
          } else {
            this.offer = { capture, expiresAfterWave: 1 }; // plus de Ball : on laisse la main
          }
        } else {
          this.offer = { capture, expiresAfterWave: 1 };
        }
      }
    }
  }

  private onEvent(e: BattleEvent) {
    const a = (id: string) => this.anims[id];
    switch (e.kind) {
      case 'use': {
        const an = a(e.actor);
        if (an) { an.action = 'attack'; an.since = this.clock; an.lungeUntil = this.clock + 220; }
        break;
      }
      case 'damage': {
        const an = a(e.target);
        if (an) { an.action = 'hurt'; an.since = this.clock; an.flashUntil = this.clock + 130; }
        const color = e.eff > 1 ? '#ffd54f' : e.eff < 1 ? '#b0bec5' : '#ffffff';
        this.float(e.target, `${e.amount}${e.crit ? '!' : ''}`, e.crit ? '#ff7043' : color, e.crit || e.eff > 1);
        if (e.eff > 1) sfx('play');
        break;
      }
      case 'miss': this.float(e.target, 'Esquive', '#90caf9'); break;
      case 'tick': this.float(e.target, `${e.amount}`, e.ailment === 'burn' ? '#ff8a65' : '#ce93d8'); break;
      case 'heal': this.float(e.target, `+${e.amount}`, '#69f0ae'); break;
      case 'status': this.float(e.target, STATUS_LABEL[e.ailment], STATUS_COLOR[e.ailment]); break;
      case 'buff': this.float(e.target, e.up ? '▲' : '▼', e.up ? '#69f0ae' : '#ff8a80'); break;
      case 'faint': { const an = a(e.target); if (an) an.faintAt = this.clock; break; }
      default: break;
    }
  }
}

export const STATUS_LABEL = { burn: 'BRÛ', poison: 'PSN', paralysis: 'PAR', sleep: 'SOM', freeze: 'GEL' } as const;
export const STATUS_COLOR = { burn: '#ff7043', poison: '#ab47bc', paralysis: '#fdd835', sleep: '#90a4ae', freeze: '#4fc3f7' } as const;

export const runner = new Runner();
