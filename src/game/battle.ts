/**
 * Combat automatique en temps réel à temps de recharge.
 * Simulation déterministe à pas fixe (Rng injecté) : l'UI appelle `step(dt)`
 * et lit `events` pour jouer les animations. Aucune dépendance à React.
 */
import { Ailment, Move, PType, basicAttack, move, species, typeMultiplier } from './data';
import { BattleBonuses, critOverflow, emptyBonuses } from './model';
import { Rng } from './rng';

export const ACTION_LOCK = 0.7; // s : durée d'une animation d'action
export const MAX_BATTLE_TIME = 120; // s : au-delà, défaite (évite les combats infinis)
/** Les PV sont multipliés en combat : des vagues d'environ 8–10 s au lieu de 2. */
export const HP_SCALE = 4;
const STATUS_TIME: Record<Ailment, number> = { burn: 5, poison: 6, paralysis: 5, sleep: 3, freeze: 3 };
const BUFF_TIME = 6;

/** Multiplicateur de temps de recharge (Vitesse + `cdrPct`, plafonné à 40 % de réduction) : appliqué à
 * TOUTES les capacités équipées (et à l'attaque de base), pas seulement en combat — exporté pour que
 * l'UI puisse afficher le vrai temps de recharge actuel sur la fiche d'un Pokémon (voir `MonSheet`). */
export function cdFactor(spe: number, cdrPct: number): number {
  return (100 / (100 + spe)) * (1 - Math.min(40, cdrPct) / 100);
}

export interface FighterInit {
  id: string;
  side: 0 | 1; // 0 = joueur, 1 = sauvages
  speciesId: number;
  level: number;
  shiny?: boolean;
  stats: { hp: number; atk: number; def: number; spe: number; crit: number };
  moves: number[];
  bonuses?: BattleBonuses;
  /** PV de départ (combats enchaînés) */
  hp?: number;
  boss?: boolean;
  berry?: { heal?: number; cures?: string };
}

export interface Fighter extends FighterInit {
  types: PType[];
  maxHp: number;
  hp: number;
  bonuses: BattleBonuses;
  moveList: Move[];
  readyAt: number[]; // par capacité
  basicReadyAt: number;
  lockUntil: number;
  status?: { kind: Ailment; until: number; nextTick: number };
  buffs: { stat: 'atk' | 'def' | 'spe'; mult: number; until: number }[];
  berryUsed: boolean;
  alive: boolean;
}

export type BattleEvent =
  | { t: number; kind: 'use'; actor: string; move: string; moveType: PType; targets: string[]; aoe: boolean }
  | { t: number; kind: 'damage'; target: string; amount: number; eff: number; crit: boolean; hpLeft: number }
  | { t: number; kind: 'miss'; target: string }
  | { t: number; kind: 'status'; target: string; ailment: Ailment }
  | { t: number; kind: 'cure'; target: string }
  | { t: number; kind: 'tick'; target: string; amount: number; ailment: Ailment; hpLeft: number }
  | { t: number; kind: 'heal'; target: string; amount: number; hpLeft: number }
  | { t: number; kind: 'buff'; target: string; stat: string; up: boolean }
  | { t: number; kind: 'faint'; target: string; side: 0 | 1 }
  | { t: number; kind: 'end'; result: 'win' | 'lose' };

export class Battle {
  t = 0;
  fighters: Fighter[];
  events: BattleEvent[] = [];
  result: 'win' | 'lose' | null = null;
  private rng: Rng;

  constructor(inits: FighterInit[], rng: Rng) {
    this.rng = rng;
    this.fighters = inits.map((f) => {
      const sp = species(f.speciesId);
      const moveList = f.moves.map(move);
      const maxHp = f.stats.hp * HP_SCALE;
      return {
        ...f,
        types: sp.types,
        maxHp,
        hp: Math.min(maxHp, f.hp ?? maxHp),
        bonuses: f.bonuses ?? emptyBonuses(),
        moveList,
        // petite désynchronisation de départ : les capacités « rapides » d'abord
        readyAt: moveList.map((m) => (m.cd <= 2 ? 0 : 0.5 + rng.int(100) / 100)),
        basicReadyAt: rng.int(60) / 100,
        lockUntil: 0,
        buffs: [],
        berryUsed: false,
        alive: (f.hp ?? maxHp) > 0,
      };
    });
  }

  side(s: 0 | 1) { return this.fighters.filter((f) => f.side === s && f.alive); }
  get(id: string) { return this.fighters.find((f) => f.id === id)!; }

  /** Avance la simulation de dt secondes (par pas de 50 ms max). */
  step(dt: number) {
    while (dt > 0 && !this.result) {
      const h = Math.min(0.05, dt);
      dt -= h;
      this.t += h;
      this.tick();
    }
  }

  /** Joue jusqu'à la fin (tests, simulation hors écran). */
  runToEnd() {
    while (!this.result) this.step(1);
    return this.result;
  }

  drain(): BattleEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  // ------------------------------------------------------------ interne
  private emit(e: BattleEvent) { this.events.push(e); }

  private statMult(f: Fighter, stat: 'atk' | 'def' | 'spe') {
    let m = 1;
    for (const b of f.buffs) if (b.stat === stat && b.until > this.t) m *= b.mult;
    if (stat === 'spe' && f.status?.kind === 'paralysis') m *= 0.5;
    if (stat === 'atk' && f.status?.kind === 'burn') m *= 0.75;
    return m;
  }

  private cdFactor(f: Fighter) {
    const spe = f.stats.spe * this.statMult(f, 'spe');
    return cdFactor(spe, f.bonuses.cdrPct);
  }

  private tick() {
    const t = this.t;
    for (const f of this.fighters) {
      if (!f.alive) continue;
      f.buffs = f.buffs.filter((b) => b.until > t);
      // statuts
      if (f.status) {
        const s = f.status;
        if (t >= s.until) {
          f.status = undefined;
          this.emit({ t, kind: 'cure', target: f.id });
        } else if ((s.kind === 'burn' || s.kind === 'poison') && t >= s.nextTick) {
          s.nextTick = t + 1;
          const amount = Math.max(1, Math.round(f.maxHp * (s.kind === 'burn' ? 0.02 : 0.03)));
          f.hp = Math.max(0, f.hp - amount);
          this.emit({ t, kind: 'tick', target: f.id, amount, ailment: s.kind, hpLeft: f.hp });
          if (f.hp <= 0) this.faint(f);
        }
      }
      if (f.alive) this.useBerry(f);
    }
    for (const f of this.fighters) {
      if (!f.alive || t < f.lockUntil) continue;
      if (f.status && (f.status.kind === 'sleep' || f.status.kind === 'freeze')) continue;
      this.act(f);
      if (this.result) return;
    }
    if (t >= MAX_BATTLE_TIME && !this.result) this.finish('lose');
  }

  private useBerry(f: Fighter) {
    if (!f.berry || f.berryUsed) return;
    if (f.berry.heal && f.hp < f.maxHp * 0.3) {
      f.berryUsed = true;
      this.heal(f, Math.round((f.maxHp * f.berry.heal) / 100));
    } else if (f.berry.cures && f.status?.kind === f.berry.cures) {
      f.berryUsed = true;
      f.status = undefined;
      this.emit({ t: this.t, kind: 'cure', target: f.id });
    }
  }

  private pickTarget(f: Fighter): Fighter | undefined {
    const foes = this.side(f.side === 0 ? 1 : 0);
    if (!foes.length) return undefined;
    // le joueur vise l'ennemi de devant ; les sauvages visent devant 70 % du temps
    if (f.side === 0 || this.rng.int(100) < 70) return foes[0];
    return foes[this.rng.int(foes.length)];
  }

  /** Une capacité est-elle utile maintenant ? (évite les soins/buffs inutiles) */
  private usable(f: Fighter, m: Move, target: Fighter): boolean {
    switch (m.kind) {
      case 'heal': return f.hp < f.maxHp * 0.6;
      case 'buff': return !f.buffs.some((b) => b.stat === m.stat && b.mult > 1);
      case 'debuff': return !target.buffs.some((b) => b.stat === m.stat && b.mult < 1);
      case 'status': return !target.status && !(target.boss && (m.ailment === 'sleep' || m.ailment === 'freeze') && target.hp > target.maxHp * 0.5);
      default: return true;
    }
  }

  private act(f: Fighter) {
    const target = this.pickTarget(f);
    if (!target) return;
    const cdf = this.cdFactor(f);
    let chosen: Move | null = null;
    for (let i = 0; i < f.moveList.length; i++) {
      const m = f.moveList[i];
      if (this.t >= f.readyAt[i] && this.usable(f, m, target)) {
        chosen = m;
        f.readyAt[i] = this.t + m.cd * cdf;
        break;
      }
    }
    if (!chosen) {
      if (this.t < f.basicReadyAt) return;
      chosen = basicAttack();
      f.basicReadyAt = this.t + 1.5 * cdf;
    }
    f.lockUntil = this.t + ACTION_LOCK;
    const foes = this.side(f.side === 0 ? 1 : 0);
    const targets = chosen.aoe && chosen.kind !== 'heal' && chosen.kind !== 'buff' ? foes : [chosen.kind === 'heal' || chosen.kind === 'buff' ? f : target];
    this.emit({ t: this.t, kind: 'use', actor: f.id, move: chosen.name, moveType: chosen.type, targets: targets.map((x) => x.id), aoe: chosen.aoe });
    for (const tg of targets) {
      if (!tg.alive) continue;
      this.resolve(f, chosen, tg);
      if (this.result) return;
    }
  }

  private resolve(f: Fighter, m: Move, tg: Fighter) {
    const t = this.t;
    switch (m.kind) {
      case 'heal':
        this.heal(f, Math.round((f.maxHp * m.heal) / 100));
        return;
      case 'buff':
        f.buffs.push({ stat: m.stat, mult: Math.max(0.5, 1 + 0.25 * m.stages), until: t + BUFF_TIME });
        this.emit({ t, kind: 'buff', target: f.id, stat: m.stat, up: true });
        return;
      case 'debuff':
        tg.buffs.push({ stat: m.stat, mult: 1 / (1 + 0.25 * Math.abs(m.stages)), until: t + BUFF_TIME });
        this.emit({ t, kind: 'buff', target: tg.id, stat: m.stat, up: false });
        return;
      case 'status':
        this.tryAilment(f, tg, m.ailment, m.chance);
        return;
      case 'damage': {
        if (tg.bonuses.dodgePct > 0 && this.rng.int(1000) < tg.bonuses.dodgePct * 10) {
          this.emit({ t, kind: 'miss', target: tg.id });
          return;
        }
        const { amount, eff, crit } = this.damage(f, m, tg);
        tg.hp = Math.max(0, tg.hp - amount);
        this.emit({ t, kind: 'damage', target: tg.id, amount, eff, crit, hpLeft: tg.hp });
        const steal = (f.bonuses.lifestealPct + (m.drain ?? 0)) / 100;
        if (steal > 0 && f.alive) this.heal(f, Math.round(amount * steal), true);
        if (tg.hp <= 0) { this.faint(tg); return; }
        if (m.ailment && m.chance) this.tryAilment(f, tg, m.ailment, m.chance);
        if (m.stat && this.rng.int(100) < m.stat.chance) {
          const who = m.stat.self ? f : tg;
          const mult = m.stat.stages > 0 ? 1 + 0.25 * m.stat.stages : 1 / (1 + 0.25 * -m.stat.stages);
          who.buffs.push({ stat: m.stat.stat, mult, until: t + BUFF_TIME });
          this.emit({ t, kind: 'buff', target: who.id, stat: m.stat.stat, up: m.stat.stages > 0 });
        }
      }
    }
  }

  /** Formule du document de conception. */
  damage(f: Fighter, m: Extract<Move, { kind: 'damage' }>, tg: Fighter) {
    const atk = f.stats.atk * this.statMult(f, 'atk');
    const def = Math.max(1, tg.stats.def * this.statMult(tg, 'def'));
    let dmg = ((0.4 * f.level + 2) * m.power * (atk / def)) / 50 + 2;
    // l'attaque de base (id 0) est un filet de sécurité neutre : jamais de STAB, jamais 0/×2 via la
    // table des types (voir `basicAttack` dans data.ts) — sinon elle peut totalement whiffer selon le
    // matchup, hors du contrôle du joueur, alors qu'elle sert justement quand ses vraies capacités sont
    // indisponibles.
    const stab = m.id !== 0 && f.types.includes(m.type) ? 1.5 : 1;
    const eff = m.id === 0 ? 1 : typeMultiplier(m.type, tg.types);
    const crit = this.rng.int(1000) < Math.min(100, f.stats.crit) * 10;
    let bonus = 1;
    if (m.id !== 0 && f.types.includes(m.type)) bonus += f.bonuses.typeDmgPct / 100;
    for (const a of f.bonuses.affinities) if (a.type === m.type) bonus += a.pct / 100;
    // chance de critique au-delà de 100 % : convertie 1 pour 1 en Dégâts critiques (voir `critOverflow`)
    const critMult = crit ? 1.5 + (f.bonuses.critDmgPct + critOverflow(f.stats.crit)) / 100 : 1;
    const rand = 0.85 + this.rng.int(16) / 100;
    dmg = dmg * stab * eff * critMult * bonus * rand;
    return { amount: eff === 0 ? 0 : Math.max(1, Math.round(dmg)), eff, crit };
  }

  private tryAilment(f: Fighter, tg: Fighter, ailment: Ailment, chance: number) {
    if (!tg.alive || tg.status) return;
    // immunités de type classiques
    if (ailment === 'burn' && tg.types.includes('fire')) return;
    if (ailment === 'freeze' && tg.types.includes('ice')) return;
    if (ailment === 'poison' && tg.types.includes('poison')) return;
    if (ailment === 'paralysis' && tg.types.includes('electric')) return;
    const c = chance;
    if (this.rng.int(100) >= c) return;
    const dur = STATUS_TIME[ailment] * (tg.boss && (ailment === 'sleep' || ailment === 'freeze') ? 0.5 : 1);
    tg.status = { kind: ailment, until: this.t + dur, nextTick: this.t + 1 };
    this.emit({ t: this.t, kind: 'status', target: tg.id, ailment });
  }

  private heal(f: Fighter, amount: number, silent = false) {
    const before = f.hp;
    f.hp = Math.min(f.maxHp, f.hp + amount);
    if (f.hp > before && !silent) this.emit({ t: this.t, kind: 'heal', target: f.id, amount: f.hp - before, hpLeft: f.hp });
  }

  private faint(f: Fighter) {
    f.alive = false;
    f.hp = 0;
    f.status = undefined;
    this.emit({ t: this.t, kind: 'faint', target: f.id, side: f.side });
    if (!this.side(0).length) this.finish('lose');
    else if (!this.side(1).length) this.finish('win');
  }

  private finish(result: 'win' | 'lose') {
    this.result = result;
    this.emit({ t: this.t, kind: 'end', result });
  }
}
