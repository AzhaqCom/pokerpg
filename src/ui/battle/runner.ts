/**
 * Pilote du combat affiché : enchaîne étapes et vagues, avance la simulation
 * au rythme de l'écran, garde l'état d'animation de chaque combattant.
 * Singleton hors React ; l'UI le lit à chaque frame.
 */
import { sfx } from '../../audio/sfx';
import { BattleEvent } from '../../game/battle';
import { BIOMES, REGION_START } from '../../game/content';
import { species } from '../../game/data';
import {
  BETWEEN_WAVES_MS, CaptureOffer, StageKind, StageRun, WaveRewards, arenaAvailable, autoCaptureBall, bestStarsOf, bossAvailable,
  touchLastActive, tryCapture,
} from '../../game/game';
import { RARITIES, RARITY_COLOR } from '../../game/model';
import { template } from '../../game/items';
import { rng, useGame } from '../../store/game';
import { useSettings } from '../../store/settings';
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

class Runner {
  run: StageRun | null = null;
  /** horloge d'affichage du combat (ms), avance plus vite en ×2 */
  clock = 0;
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

  private start() {
    const s = useGame.getState().s;
    if (!s || !s.starterChosen || !s.team.length) return;
    let kind: StageKind = this.next ?? 'stage';
    this.next = null;
    if (kind === 'boss' && (!bossAvailable(s) || s.bossesBeaten[s.biome][s.zone])) kind = 'stage';
    if (kind === 'arena' && !arenaAvailable(s)) kind = 'stage';
    this.run = new StageRun(s, kind, rng);
    this.phase = 'fight';
    this.resetAnims();
    const biome = BIOMES[s.biome];
    const zone = biome.zones[s.zone];
    if (kind === 'boss') this.showBanner(`Boss : ${species(zone.boss.speciesId).name} !`, '#ff5252');
    else if (kind === 'arena') this.showBanner(`${biome.arena.name} : ${biome.arena.leader} vous défie !`, '#ffb300');
  }

  private resetAnims() {
    this.anims = {};
    for (const f of this.run!.battle.fighters) {
      this.anims[f.id] = { action: 'idle', since: this.clock, lungeUntil: 0, flashUntil: 0, faintAt: f.alive ? null : this.clock - 1000 };
    }
  }

  private showBanner(text: string, color: string) {
    this.banner = { text, color, until: this.clock + 2200 };
  }

  private float(fighter: string, text: string, color: string, big = false) {
    this.floaters.push({ id: this.floaterId++, fighter, text, color, t0: this.clock, big });
  }

  /** Avance de dtMs (temps réel). */
  update(dtMs: number) {
    if (this.paused) return;
    const speed = useSettings.getState().fast ? 2 : 1;
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
          // Champion d'une région : on coupe l'enchaînement automatique vers la suivante — le joueur doit
          // d'abord voir le récap et choisir explicitement le nouveau départ (voir App.tsx/PrestigeOffer).
          if (REGION_START.includes(run.biome + 1)) this.paused = true;
          else if (s.badges === 1) {
            // 1er vrai badge de la partie : la vitesse ×2 n'a de sens qu'ici, on l'active d'office plutôt
            // que de laisser le joueur découvrir un bouton caché dans le HUD.
            useSettings.getState().set({ fast: true });
            toast(`${BIOMES[run.biome].arena.badge} obtenu ! Vitesse ×2 débloquée et activée`, '#ffb300');
          } else {
            toast(`${BIOMES[run.biome].arena.badge} obtenu !`, '#ffb300');
          }
        }
      } else if (lost) {
        sfx('deny');
        toast(run.kind === 'stage' ? `Défaite… retour à ${BIOMES[s.biome].zones[s.zone].name} ${s.stage}` : 'Défaite… entraîne-toi et réessaie', '#ff5252');
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
      for (const id of lu.newMoves) toast(`${species(m.speciesId).name} apprend une nouvelle capacité`);
    }
    for (const it of r.loot) {
      const t = template(it.templateId);
      toast(`+ ${t.name}`, RARITY_COLOR[it.rarity], t.name);
    }
    if (r.capture) {
      const capture = r.capture;
      if (capture.guaranteed) {
        // capture garantie (boss, ou chromatique en vague normale) : directe, sauf réglage explicite
        // pour ne pas s'encombrer d'un chromatique dont l'espèce est déjà chromatique dans le Pokédex.
        if (capture.shiny && useSettings.getState().skipOwnedShiny && s.dex.shiny.includes(capture.speciesId)) {
          toast(`✨ ${species(capture.speciesId).name} chromatique déjà obtenu, ignoré`, '#9575cd');
        } else {
          if (capture.shiny) toast('✨ Un Pokémon chromatique !', '#ff5ec4');
          const mon = useGame.getState().act((st) => tryCapture(st, capture, null, rng));
          if (mon) { sfx('hatch'); toast(`${species(mon.speciesId).name} rejoint ta boîte !`, '#7CFC00'); }
        }
      } else {
        const known = s.dex.caught.includes(capture.speciesId);
        const settings = useSettings.getState();
        const belowThreeStars = bestStarsOf(s, capture.speciesId) < 3;
        if (settings.hideOwnedOffers && known && !belowThreeStars) {
          // espèce déjà possédée en bonne qualité : offre ignorée, pas d'affichage
        } else if (settings.autoCapture && (!known || (settings.autoCaptureUpgrade && belowThreeStars))) {
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
