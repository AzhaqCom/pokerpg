/**
 * Modèles des boutons « Auto » (capacités, talents, équipement), calés sur de vrais combats de Tour (2026-10-01,
 * `tools/scratch/auto_audit.ts`). Moteur pur, déterministe, sans React.
 *
 * - **Ordonnancement d'un kit** (`kitUsage`) : en combat, un Pokémon lance la première capacité prête de sa liste, puis
 *   reste bloqué `actionLock` (0,7 s, moins avec des bonus de Vitesse). Quand ses recharges sont courtes, il est saturé : l'ordre
 *   et la puissance par utilisation comptent ; quand elles sont longues, l'attaque de base comble les trous. Juger un
 *   kit à la seule puissance (ancien `movesAtLevel`) laissait de côté ~12 points de victoire en moyenne dans la Tour.
 * - **Duel** (`duelMult`) : multiplicateur de difficulté (PV et Attaque adverses) que le Pokémon tient à égalité contre
 *   un adversaire moyen de son niveau. Remplace `combatValue` pour comparer des équipements : le Vol de vie y vaut ce
 *   qu'il soigne vraiment (énorme en fin de jeu, où les dégâts critiques dépassent de loin les PV), la Vitesse et la
 *   Recharge ce qu'elles ajoutent au kit réel (rien une fois saturé).
 */
import { DODGE_CAP, HP_SCALE, LIFESTEAL_CAP, actionLock, cdFactor } from './battle';
import { ALL_SPECIES, Move, PType, basicAttack, evolutionTargets, learnedMoves, move, movesAtLevel, species, typeMultiplier } from './data';
import { BattleBonuses, critOverflow } from './model';
import { rawStats } from './stats';

/** Durée simulée pour compter les utilisations (s). */
const KIT_HORIZON = 30;
/** Durée d'un sommeil (`STATUS_TIME.sleep` de `battle.ts`) : la capacité de sommeil n'est relancée qu'au réveil. */
const SLEEP_TIME = 3;

/** Adversaires de référence : formes finales et légendaires (le vivier de la Tour). */
let refPool: number[] | null = null;
function refSpecies(): number[] {
  if (!refPool) refPool = ALL_SPECIES.filter((sp) => evolutionTargets(sp.id).length === 0).map((sp) => sp.id);
  return refPool;
}

const EFF = new Map<PType, number>();
/** Efficacité moyenne d'un type contre le vivier de référence (les ×0 comptent : le combat ne vise pas la faiblesse). */
export function averageEffectiveness(t: PType): number {
  let e = EFF.get(t);
  if (e === undefined) {
    const pool = refSpecies();
    e = pool.reduce((a, id) => a + typeMultiplier(t, species(id).types), 0) / pool.length;
    EFF.set(t, e);
  }
  return e;
}

export interface KitContext {
  types: PType[];
  /** Dégâts de son type (STAB) en %, talents et objets compris. */
  typeDmgPct: number;
  /** Affinités cumulées par type, en %. */
  affinities: Partial<Record<PType, number>>;
}

export function kitContext(types: PType[], bonuses: BattleBonuses): KitContext {
  const affinities: Partial<Record<PType, number>> = {};
  for (const a of bonuses.affinities) affinities[a.type] = (affinities[a.type] ?? 0) + a.pct;
  return { types, typeDmgPct: bonuses.typeDmgPct, affinities };
}

/**
 * Puissance moyenne d'une utilisation (avant Attaque/Défense et critiques) : STAB, bonus de type et d'affinité,
 * efficacité moyenne, zone (≈ 2 cibles) et soin des capacités qui drainent (compté comme des dégâts en plus).
 */
export function movePerUse(m: Move, ctx: KitContext): number {
  if (m.kind !== 'damage') return 0;
  const stab = m.id !== 0 && ctx.types.includes(m.type);
  const bonus = 1 + (stab ? ctx.typeDmgPct / 100 : 0) + (ctx.affinities[m.type] ?? 0) / 100;
  const eff = m.id === 0 ? 1 : averageEffectiveness(m.type);
  return m.power * (stab ? 1.5 : 1) * eff * bonus * (m.aoe ? 2 : 1) * (1 + (m.drain ?? 0) / 100);
}

/**
 * Utilisations de chaque capacité du kit (dernier élément : l'attaque de base) sur `KIT_HORIZON` secondes, en
 * reproduisant le choix du combat : première capacité prête, verrou d'action, pas de 50 ms. Soins et bonus ne sont
 * pas comptés (ils ne servent que blessé) ; le sommeil attend le réveil de la cible.
 */
/** Cadence d'un Pokémon : multiplicateur de recharge (`cdFactor`) et temps entre deux actions (`actionLock`). */
export interface Cadence { cdf: number; lock: number }

export function cadence(spe: number, bonuses: BattleBonuses): Cadence {
  return { cdf: cdFactor(spe, bonuses.cdrPct), lock: actionLock(bonuses.spePct) };
}

export function kitUsage(moves: Move[], cad: Cadence): number[] {
  const { cdf } = cad;
  const ready = moves.map(() => 0);
  const n = new Array<number>(moves.length + 1).fill(0);
  let basicAt = 0;
  let statusUntil = 0;
  const step = 0.05;
  let t = 0;
  while (t < KIT_HORIZON) {
    let k = -1;
    for (let i = 0; i < moves.length; i++) {
      const m = moves[i];
      if (t + 1e-9 < ready[i] || m.kind === 'heal' || m.kind === 'buff' || m.kind === 'debuff') continue;
      if (m.kind === 'status' && t + 1e-9 < statusUntil) continue;
      k = i;
      break;
    }
    if (k >= 0) {
      ready[k] = t + moves[k].cd * cdf;
      if (moves[k].kind === 'status') statusUntil = t + SLEEP_TIME;
    } else if (t + 1e-9 >= basicAt) {
      k = moves.length;
      basicAt = t + 1.5 * cdf;
    }
    if (k >= 0) {
      n[k]++;
      t += Math.max(1, Math.ceil(cad.lock / step - 1e-9)) * step;
      continue;
    }
    // prochain instant où quelque chose est prêt, aligné sur la grille de 50 ms
    let next = basicAt;
    for (let i = 0; i < moves.length; i++) {
      const m = moves[i];
      if (m.kind === 'damage') next = Math.min(next, ready[i]);
      else if (m.kind === 'status') next = Math.min(next, Math.max(ready[i], statusUntil));
    }
    t = Math.max(t + step, Math.ceil(next / step - 1e-9) * step);
  }
  return n;
}

/** Puissance par seconde d'un kit (attaque de base comprise). */
export function kitRate(moveIds: number[], cad: Cadence, ctx: KitContext): number {
  const ms = moveIds.map(move);
  const n = kitUsage(ms, cad);
  let sum = n[ms.length] * movePerUse(basicAttack(), ctx);
  ms.forEach((m, i) => { sum += n[i] * movePerUse(m, ctx); });
  return sum / KIT_HORIZON;
}

/** Part de la puissance du kit apportée par chaque type (attaque de base = Normal) : sert au choix des Affinités. */
export function kitTypeShare(moveIds: number[], cad: Cadence, ctx: KitContext): Map<PType, number> {
  const ms = moveIds.map(move);
  const n = kitUsage(ms, cad);
  const out = new Map<PType, number>();
  const add = (m: Move, k: number) => { if (m.kind === 'damage' && k) out.set(m.type, (out.get(m.type) ?? 0) + k * movePerUse(m, ctx)); };
  add(basicAttack(), n[ms.length]);
  ms.forEach((m, i) => add(m, n[i]));
  return out;
}

/** Nombre de capacités d'attaque candidates gardées pour la recherche exhaustive (C(14,4) = 1 001 kits au plus). */
const KIT_CANDIDATES = 14;

/**
 * Meilleur kit d'attaques pour ce Pokémon (bouton « ★ Auto » des capacités) : la capacité de sommeil en tête et un soin
 * en dernier s'il en connaît (mesuré : ils restent dans les meilleurs kits), le reste par recherche exhaustive sur la
 * puissance par seconde réelle (`kitRate`), attaques classées de la plus forte à la plus faible par utilisation.
 */
export function bestMoves(speciesId: number, level: number, cad: Cadence, ctx: KitContext): number[] {
  const sp = species(speciesId);
  const known = [...new Set(learnedMoves(sp, level))].map(move);
  const sleep = known.find((m) => m.kind === 'status' && m.ailment === 'sleep');
  const heal = known.find((m) => m.kind === 'heal');
  // à type, zone, recharge et drain égaux, seule la plus puissante peut servir
  const bucket = new Map<string, Move & { kind: 'damage' }>();
  for (const m of known) {
    if (m.kind !== 'damage') continue;
    const key = `${m.type}|${m.aoe}|${m.cd}|${m.drain ?? 0}`;
    const b = bucket.get(key);
    if (!b || b.power < m.power) bucket.set(key, m);
  }
  const solo = new Map<number, number>();
  for (const m of bucket.values()) solo.set(m.id, kitRate([m.id], cad, ctx));
  const cands = [...bucket.values()].sort((a, b) => solo.get(b.id)! - solo.get(a.id)!).slice(0, KIT_CANDIDATES);
  if (!cands.length) return movesAtLevel(sp, level);
  const slots = Math.min(cands.length, 4 - (sleep ? 1 : 0) - (heal ? 1 : 0));
  let best: number[] = [];
  let bestRate = -1;
  const pick = (start: number, cur: Move[]) => {
    if (cur.length === slots) {
      const ordered = [...cur].sort((a, b) => movePerUse(b, ctx) - movePerUse(a, ctx));
      const ids = [...(sleep ? [sleep.id] : []), ...ordered.map((m) => m.id), ...(heal ? [heal.id] : [])];
      const r = kitRate(ids, cad, ctx);
      if (r > bestRate) { bestRate = r; best = ids; }
      return;
    }
    for (let i = start; i < cands.length; i++) { cur.push(cands[i]); pick(i + 1, cur); cur.pop(); }
  };
  pick(0, []);
  return best;
}

// ---------------------------------------------------------------- duel (équipement)

interface RefFoe { hp: number; atk: number; def: number; rate: number }
const REF_FOE = new Map<number, RefFoe>();
/** Adversaire moyen d'un niveau : stats (gènes 15) et puissance par seconde de son kit de sauvage. */
function refFoe(level: number): RefFoe {
  let r = REF_FOE.get(level);
  if (!r) {
    const pool = refSpecies();
    const acc = { hp: 0, atk: 0, def: 0, rate: 0 };
    for (const id of pool) {
      const st = rawStats(id, level, { hp: 15, atk: 15, def: 15, spe: 15 });
      const ctx: KitContext = { types: species(id).types, typeDmgPct: 0, affinities: {} };
      acc.hp += st.hp; acc.atk += st.atk; acc.def += st.def;
      acc.rate += kitRate(movesAtLevel(species(id), level), { cdf: cdFactor(st.spe, 0), lock: actionLock(0) }, ctx);
    }
    r = { hp: acc.hp / pool.length, atk: acc.atk / pool.length, def: acc.def / pool.length, rate: acc.rate / pool.length };
    REF_FOE.set(level, r);
  }
  return r;
}

/**
 * Part utile du Vol de vie : les sauvages visent le Pokémon de devant (70 % de leurs coups), les deux autres sont
 * le plus souvent à pleins PV et leur vol de vie ne soigne rien. Calé sur l'audit (2026-10-01) : à 1, le modèle
 * préférait des builds Défense + Vol de vie qui perdaient 15 points de victoire face à un build PV.
 */
export const LIFESTEAL_USEFUL = 1 / 3;

export interface DuelInput {
  level: number;
  stats: { hp: number; atk: number; def: number; spe: number; crit: number };
  bonuses: BattleBonuses;
  moves: number[];
  types: PType[];
  /** Soin de la baie en % des PV (0 sans baie de soin). */
  berryHeal: number;
}

/**
 * Multiplicateur (PV et Attaque adverses) tenu à égalité contre l'adversaire moyen de son niveau : le Pokémon met
 * autant de temps à le mettre K.O. qu'à tomber. Dégâts par seconde = kit × Attaque/Défense × critiques ; survie =
 * PV (+ baie) / (dégâts reçus × (1 − Esquive) − Vol de vie). Résolu exactement (équation du second degré).
 */
export function duelMult(d: DuelInput): number {
  const foe = refFoe(d.level);
  const crit = Math.min(1, d.stats.crit / 100);
  const critMult = 1 + crit * (0.5 + (d.bonuses.critDmgPct + critOverflow(d.stats.crit)) / 100);
  const ctx = kitContext(d.types, d.bonuses);
  const lv = (0.4 * d.level + 2) / 50;
  const out = lv * kitRate(d.moves, cadence(d.stats.spe, d.bonuses), ctx) * (d.stats.atk / foe.def) * critMult;
  const foeCrit = 1 + 0.06 * 0.5;
  const dodge = Math.min(DODGE_CAP, d.bonuses.dodgePct) / 100;
  const inPerMult = lv * foe.rate * (foe.atk / Math.max(1, d.stats.def)) * foeCrit * (1 - dodge); // × mult
  const heal = LIFESTEAL_USEFUL * (Math.min(LIFESTEAL_CAP, d.bonuses.lifestealPct) / 100) * out;
  const myHp = d.stats.hp * HP_SCALE * (1 + d.berryHeal / 100);
  const foeHp = foe.hp * HP_SCALE; // × mult
  // foeHp·m / out = myHp / (inPerMult·m − heal)  ⇔  foeHp·inPerMult·m² − foeHp·heal·m − myHp·out = 0
  const a = foeHp * inPerMult;
  const b = foeHp * heal;
  const c = myHp * out;
  if (a <= 0) return Infinity;
  return (b + Math.sqrt(b * b + 4 * a * c)) / (2 * a);
}
