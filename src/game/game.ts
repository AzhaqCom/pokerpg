/**
 * État de la partie (sérialisable) et règles de progression :
 * équipe, étapes/vagues, butin, capture, évolutions, pension.
 */
import { Battle, FighterInit } from './battle';
import { BADGE_BONUS, BIOMES, STAGES_PER_ZONE, WAVES_PER_STAGE, ZoneDef } from './content';
import { PType, learnedMoves, movesAtLevel, species } from './data';
import { berryHeal, fuse, canFuse, makeItem, newUid, recycleValue, rerollCost, rerollSub, rollLoot, slotOf, template, upgrade, upgradeCost } from './items';
import { BattleBonuses, Item, ItemSlot, Mon, emptyBonuses } from './model';
import { Rng } from './rng';
import { auraBonuses, combatPower, finalStats, levelFromXp, monBonuses, monStars, sumBonuses, xpForLevel } from './stats';
import { canRankUp, eligibleAffinityTypes, talentTree } from './talents';
import { primaryType } from './stats';

export const TEAM_SIZE = 3;
export const LOOT_CHANCE = 11; // % par sauvage vaincu (~1 objet / 45 s)
export const CAPTURE_OFFER_CHANCE = 35; // % après une vague gagnée
export const SHINY_ODDS = 256;
export const BALLS = {
  poke: { name: 'Poké Ball', chance: 30 },
  super: { name: 'Super Ball', chance: 55 },
  hyper: { name: 'Hyper Ball', chance: 80 },
} as const;
export type BallKind = keyof typeof BALLS;
export const FREE_BALLS_PER_DAY = 5;
/** Boutique : prix des Balls en éclats */
export const BALL_PRICE: Record<'poke' | 'super' | 'hyper', number> = { poke: 20, super: 60, hyper: 150 };
export const PENSION_CAP_MS = 8 * 3600_000;
/** Pause entre deux vagues affichée à l'écran (runner) ; utilisée aussi par le calcul idle pour estimer la durée d'une vague. */
export const BETWEEN_WAVES_MS = 1100;
export const JOBS = {
  orchard: { name: 'Verger', cycleMs: 3600_000, desc: 'Baies (Plante et Eau : ×2)' },
  training: { name: 'Entraînement', cycleMs: 2 * 3600_000, desc: 'Bonbons de son espèce' },
  dig: { name: 'Fouille', cycleMs: 4 * 3600_000, desc: 'Éclats, parfois une Poké Ball' },
} as const;
export type Job = keyof typeof JOBS;
export const CANDY_XP = 100;

export interface GameState {
  version: 1;
  starterChosen: boolean;
  mons: Record<string, Mon>;
  team: string[];
  /** Pension : gagne de l'XP passive (voir `harvestPension`). `xpPerHour` figé au moment de l'affectation. */
  pension: { uid: string; since: number; xpPerHour: number }[];
  /** Exploration : les 3 métiers à ressources (ex-pension). */
  exploration: { uid: string; job: Job; since: number }[];
  items: Record<string, Item>;
  shards: number;
  balls: Record<BallKind, number>;
  lastFreeBallsDay: number;
  /** biome courant (0..BIOMES.length-1), zone courante (0..2) et étape courante (1..5) */
  biome: number;
  zone: number;
  stage: number;
  /** plus haute étape débloquée, par biome puis par zone : unlocked[biome][zone] */
  unlocked: number[][];
  bossesBeaten: boolean[][];
  /** arène (badge) battue, par biome */
  arenaBeaten: boolean[];
  badges: number;
  dex: { seen: number[]; caught: number[]; shiny: number[] };
  candies: Record<string, number>;
  totals: { kills: number; captures: number; fusions: number; stagesCleared: number };
  /** Horodatage (ms) de la dernière activité : combat affiché ou passage en arrière-plan. Sert au calcul idle. */
  lastActive: number;
}

export function newGame(): GameState {
  return {
    version: 1, starterChosen: false, mons: {}, team: [], pension: [], exploration: [], items: {},
    shards: 0, balls: { poke: 10, super: 0, hyper: 0 }, lastFreeBallsDay: 0,
    biome: 0, zone: 0, stage: 1,
    unlocked: BIOMES.map((b, i) => b.zones.map((_, j) => (i === 0 && j === 0 ? 1 : 0))),
    bossesBeaten: BIOMES.map((b) => b.zones.map(() => false)),
    arenaBeaten: BIOMES.map(() => false),
    badges: 0,
    dex: { seen: [], caught: [], shiny: [] }, candies: {},
    totals: { kills: 0, captures: 0, fusions: 0, stagesCleared: 0 },
    lastActive: Date.now(),
  };
}

/**
 * Convertit une sauvegarde d'avant le multi-biome (biome 2) : `unlocked`/`bossesBeaten` étaient des
 * tableaux plats par zone (un seul biome implicite), `arenaBeaten` un seul booléen. Doit tourner avant
 * la fusion avec `newGame()`, sur le JSON brut tout juste chargé.
 */
export function migrateSave(raw: Record<string, unknown>): Record<string, unknown> {
  const zoneCounts = BIOMES.map((b) => b.zones.length);
  if (Array.isArray(raw.unlocked) && typeof raw.unlocked[0] === 'number') {
    raw.unlocked = zoneCounts.map((n, i) => (i === 0 ? raw.unlocked as number[] : Array(n).fill(0)));
  }
  if (Array.isArray(raw.bossesBeaten) && typeof raw.bossesBeaten[0] === 'boolean') {
    raw.bossesBeaten = zoneCounts.map((n, i) => (i === 0 ? raw.bossesBeaten as boolean[] : Array(n).fill(false)));
  }
  if (typeof raw.arenaBeaten === 'boolean') {
    raw.arenaBeaten = BIOMES.map((_, i) => (i === 0 ? raw.arenaBeaten as boolean : false));
  }
  if (typeof raw.biome !== 'number') raw.biome = 0;
  // une arène déjà battue (avant l'existence du multi-biome) doit débloquer le biome suivant a posteriori
  const arenaBeaten = raw.arenaBeaten as boolean[] | undefined;
  const unlocked = raw.unlocked as number[][] | undefined;
  if (arenaBeaten && unlocked) {
    for (let i = 0; i < arenaBeaten.length - 1; i++) {
      if (arenaBeaten[i]) unlocked[i + 1][0] = Math.max(1, unlocked[i + 1][0]);
    }
  }
  // ancienne pension (Verger/Entraînement/Fouille, à job) → devient l'exploration ; la nouvelle
  // pension (XP passive) démarre vide, personne n'y gagnait d'XP avant ce changement.
  if (Array.isArray(raw.pension) && raw.pension.some((p: { job?: unknown }) => p.job)) {
    raw.exploration = raw.pension;
    raw.pension = [];
  }
  // pension XP passive déjà en place mais sans taux calculé (avant le passage à un taux dynamique) :
  // repli sur l'ancien taux fixe, à rafraîchir au prochain retrait/réaffectation.
  if (Array.isArray(raw.pension)) {
    for (const p of raw.pension as { xpPerHour?: number }[]) {
      if (typeof p.xpPerHour !== 'number') p.xpPerHour = PENSION_XP_FALLBACK_PER_HOUR;
    }
  }
  // Pokémon sauvegardés avant les talents « au choix » (palier 4/5) : pas encore de champ dédié.
  if (raw.mons && typeof raw.mons === 'object') {
    for (const mon of Object.values(raw.mons as Record<string, { talentTypeChoices?: unknown }>)) {
      if (!mon.talentTypeChoices) mon.talentTypeChoices = {};
    }
  }
  return raw;
}

/** Marque le moment présent comme dernière activité (fin de vague, passage en arrière-plan). */
export function touchLastActive(s: GameState, now = Date.now()) {
  s.lastActive = now;
}

const addUnique = (arr: number[], v: number) => { if (!arr.includes(v)) arr.push(v); };

// ---------------------------------------------------------------- Pokémon
export function makeMon(speciesId: number, level: number, rng: Rng, shiny = false, genesMin = 0): Mon {
  const g = () => genesMin + rng.int(16 - genesMin);
  return {
    uid: newUid('m'), speciesId, level, xp: xpForLevel(level),
    genes: { hp: g(), atk: g(), def: g(), spe: g() },
    shiny, moves: movesAtLevel(species(speciesId), level), talents: {}, talentTypeChoices: {}, items: {},
  };
}

/** Objets offerts au starter (1 par emplacement, rareté commune) : un peu de marge pour le début. */
const STARTER_ITEMS = ['lunettes', 'echarpe', 'oran'] as const;

export function chooseStarter(s: GameState, speciesId: number, rng: Rng) {
  const mon = makeMon(speciesId, 5, rng, false, 8);
  addMon(s, mon);
  s.team = [mon.uid];
  s.starterChosen = true;
  for (const templateId of STARTER_ITEMS) {
    const item = makeItem(templateId, 0, 5, rng);
    s.items[item.uid] = item;
    equip(s, mon.uid, item.uid);
  }
}

export function addMon(s: GameState, mon: Mon) {
  s.mons[mon.uid] = mon;
  addUnique(s.dex.seen, mon.speciesId);
  addUnique(s.dex.caught, mon.speciesId);
  if (mon.shiny) addUnique(s.dex.shiny, mon.speciesId);
  if (s.team.length < TEAM_SIZE && !s.team.includes(mon.uid)) s.team.push(mon.uid);
}

/** Base de la lignée (pour les bonbons). */
export function lineBase(speciesId: number): number {
  let base = speciesId;
  for (let g = 0; g < 3; g++) {
    const prev = [...Array(151).keys()].map((i) => i + 1).find((id) => species(id).evolvesTo === base);
    if (!prev) break;
    base = prev;
  }
  return base;
}

/** Ajoute de l'expérience ; retourne les nouvelles capacités apprises. */
export function giveXp(mon: Mon, xp: number): { levels: number; newMoves: number[] } {
  const before = mon.level;
  mon.xp += xp;
  mon.level = levelFromXp(mon.xp);
  const sp = species(mon.speciesId);
  const newMoves = sp.learnset.filter(([lv]) => lv > before && lv <= mon.level).map(([, id]) => id);
  for (const id of newMoves) if (mon.moves.length < 4 && !mon.moves.includes(id)) mon.moves.push(id);
  return { levels: mon.level - before, newMoves };
}

export function canEvolve(mon: Mon): boolean {
  const sp = species(mon.speciesId);
  return !!sp.evolvesTo && mon.level >= sp.evolveLevel;
}

export function evolve(s: GameState, uid: string) {
  const mon = s.mons[uid];
  if (!mon || !canEvolve(mon)) return;
  const typeBefore = primaryType(mon.speciesId);
  mon.speciesId = species(mon.speciesId).evolvesTo;
  addUnique(s.dex.seen, mon.speciesId);
  addUnique(s.dex.caught, mon.speciesId);
  if (mon.shiny) addUnique(s.dex.shiny, mon.speciesId);
  // arbre de talents différent si le type principal change : les points sont rendus
  if (primaryType(mon.speciesId) !== typeBefore) mon.talents = {};
}

export function setMoves(s: GameState, uid: string, moves: number[]) {
  const mon = s.mons[uid];
  const allowed = learnedMoves(species(mon.speciesId), mon.level);
  mon.moves = moves.filter((m, i) => allowed.includes(m) && moves.indexOf(m) === i).slice(0, 4);
}

/**
 * Ajoute un rang au talent `id`. Pour un talent « au choix » (`chooseType`) pas encore entamé, `type`
 * doit être fourni et faire partie de `eligibleAffinityTypes` — il est alors figé pour cet emplacement ;
 * les rangs suivants n'ont plus besoin de `type` (ignoré s'il est fourni, déjà choisi).
 */
export function rankUpTalent(s: GameState, uid: string, id: string, type?: PType): boolean {
  const mon = s.mons[uid];
  const types = species(mon.speciesId).types;
  const def = talentTree(types).find((t) => t.id === id);
  if (!def) return false;
  if (def.chooseType && !mon.talentTypeChoices[id]) {
    const otherChoices = Object.entries(mon.talentTypeChoices).filter(([k]) => k !== id).map(([, v]) => v);
    if (!type || !eligibleAffinityTypes(mon.speciesId, otherChoices).includes(type)) return false;
    if (!canRankUp(types, mon.talents, mon.level, id)) return false;
    mon.talentTypeChoices[id] = type;
    mon.talents[id] = 1;
    return true;
  }
  if (!canRankUp(types, mon.talents, mon.level, id)) return false;
  mon.talents[id] = (mon.talents[id] ?? 0) + 1;
  return true;
}

export function resetTalents(s: GameState, uid: string): boolean {
  const cost = 50;
  if (s.shards < cost) return false;
  s.shards -= cost;
  s.mons[uid].talents = {};
  s.mons[uid].talentTypeChoices = {};
  return true;
}

/** Relâcher : 3 bonbons de la lignée. Impossible pour le dernier Pokémon de l'équipe. */
export function release(s: GameState, uid: string): boolean {
  if (s.team.length === 1 && s.team[0] === uid) return false;
  const mon = s.mons[uid];
  if (!mon) return false;
  for (const slot of Object.keys(mon.items) as ItemSlot[]) delete mon.items[slot];
  const base = lineBase(mon.speciesId);
  s.candies[base] = (s.candies[base] ?? 0) + 3;
  s.team = s.team.filter((u) => u !== uid);
  s.pension = s.pension.filter((p) => p.uid !== uid);
  s.exploration = s.exploration.filter((p) => p.uid !== uid);
  delete s.mons[uid];
  return true;
}

/** Nombre d'évolutions restantes depuis cette espèce (0 pour une forme finale). */
export function remainingEvolutions(speciesId: number): number {
  let n = 0;
  let id = speciesId;
  while (species(id).evolvesTo) { n++; id = species(id).evolvesTo; }
  return n;
}

/**
 * Doublons en excès dans la boîte (jamais l'équipe) : pour chaque (espèce, chromatique ou non), on
 * garde `remainingEvolutions + 1` exemplaires (de quoi faire évoluer la lignée jusqu'au bout tout en
 * gardant un exemplaire de chaque palier), les plus forts (PC) d'abord. Le reste est en excès.
 */
export function excessMons(s: GameState): Mon[] {
  const groups = new Map<string, Mon[]>();
  for (const m of Object.values(s.mons)) {
    if (s.team.includes(m.uid)) continue;
    const key = `${m.speciesId}:${m.shiny ? 1 : 0}`;
    groups.set(key, [...(groups.get(key) ?? []), m]);
  }
  const out: Mon[] = [];
  for (const mons of groups.values()) {
    const keep = remainingEvolutions(mons[0].speciesId) + 1;
    if (mons.length <= keep) continue;
    const sorted = [...mons].sort((a, b) => combatPower(finalStats(b, emptyBonuses())) - combatPower(finalStats(a, emptyBonuses())));
    out.push(...sorted.slice(keep));
  }
  return out;
}

/** Relâche tous les doublons en excès (voir `excessMons`). */
export function releaseExcess(s: GameState): { count: number; candies: number } {
  const excess = excessMons(s);
  for (const m of excess) release(s, m.uid);
  return { count: excess.length, candies: excess.length * 3 };
}

export function feedCandy(s: GameState, uid: string, n = 1) {
  const mon = s.mons[uid];
  const base = lineBase(mon.speciesId);
  const have = s.candies[base] ?? 0;
  const k = Math.min(n, have);
  if (!k) return null;
  s.candies[base] = have - k;
  return giveXp(mon, k * CANDY_XP);
}

export function setTeam(s: GameState, uids: string[]) {
  const t = uids.filter((u, i) => s.mons[u] && uids.indexOf(u) === i).slice(0, TEAM_SIZE);
  if (!t.length) return;
  s.team = t;
  s.pension = s.pension.filter((p) => !t.includes(p.uid));
  s.exploration = s.exploration.filter((p) => !t.includes(p.uid));
}

// ---------------------------------------------------------------- objets
export function heldItems(s: GameState, mon: Mon): Item[] {
  return Object.values(mon.items).map((u) => s.items[u!]).filter(Boolean);
}

export function holder(s: GameState, itemUid: string): Mon | undefined {
  return Object.values(s.mons).find((m) => Object.values(m.items).includes(itemUid));
}

/**
 * Map objet porté → porteur, calculée en un seul passage sur les Pokémon.
 * À préférer à `holder()` dès qu'on doit vérifier plusieurs objets (sac entier) : `holder()` reparcourt
 * tous les Pokémon à chaque appel, ce qui devient coûteux objet par objet sur un gros sac.
 */
export function heldBy(s: GameState): Map<string, Mon> {
  const map = new Map<string, Mon>();
  for (const m of Object.values(s.mons)) {
    for (const uid of Object.values(m.items)) if (uid) map.set(uid, m);
  }
  return map;
}

export function equip(s: GameState, monUid: string, itemUid: string) {
  const item = s.items[itemUid];
  const mon = s.mons[monUid];
  if (!item || !mon) return;
  const prev = holder(s, itemUid);
  const slot = slotOf(item);
  if (prev) delete prev.items[slot];
  mon.items[slot] = itemUid;
}

export function unequip(s: GameState, monUid: string, slot: ItemSlot) {
  delete s.mons[monUid].items[slot];
}

export function recycle(s: GameState, itemUids: string[]): number {
  let gain = 0;
  const held = heldBy(s);
  for (const u of itemUids) {
    const it = s.items[u];
    if (!it || it.locked || held.has(u)) continue;
    gain += recycleValue(it);
    delete s.items[u];
  }
  s.shards += gain;
  return gain;
}

export function upgradeItem(s: GameState, uid: string): boolean {
  const it = s.items[uid];
  const cost = upgradeCost(it);
  if (s.shards < cost) return false;
  s.shards -= cost;
  s.items[uid] = upgrade(it);
  return true;
}

export function rerollItemSub(s: GameState, uid: string, index: number, rng: Rng): boolean {
  const it = s.items[uid];
  const cost = rerollCost(it);
  if (s.shards < cost || !it.subs[index]) return false;
  s.shards -= cost;
  s.items[uid] = rerollSub(it, index, rng);
  return true;
}

/** Fusionne 3 objets ; l'objet obtenu reprend l'emplacement d'un des trois s'il était porté. */
export function fuseItems(s: GameState, uids: string[], rng: Rng): Item | null {
  const items = uids.map((u) => s.items[u]);
  if (items.some((i) => !i) || !canFuse(items)) return null;
  const wearer = uids.map((u) => holder(s, u)).find(Boolean);
  for (const u of uids) {
    const h = holder(s, u);
    if (h) delete h.items[slotOf(s.items[u])];
    delete s.items[u];
  }
  const out = fuse(items, rng);
  s.items[out.uid] = out;
  if (wearer) wearer.items[slotOf(out)] = out.uid;
  s.totals.fusions++;
  return out;
}

/**
 * Groupes de 3 objets fusionnables (même objet, même rareté, non verrouillés).
 * Un objet équipé peut entrer dans un lot (il reste sur son porteur après fusion), mais jamais
 * deux objets équipés par deux Pokémon différents dans le même lot : l'un des deux perdrait
 * son objet, puisqu'un seul objet fusionné ne peut réintégrer qu'un seul emplacement.
 */
/**
 * Approximation légère (pour le badge de l'onglet Sac) : nombre de groupes d'au moins 3 exemplaires
 * identiques (même gabarit + rareté), sans construire la table des porteurs ni trier — juste un
 * comptage. Le détail exact (portés, verrouillés) reste dans `fusionCandidates`, plus coûteux, à
 * n'appeler que dans l'écran Sac lui-même plutôt qu'à chaque action dans toute l'appli.
 */
export function fusionBadgeCount(s: GameState): number {
  const counts = new Map<string, number>();
  for (const it of Object.values(s.items)) {
    if (it.locked || it.rarity >= 6) continue;
    const k = `${it.templateId}:${it.rarity}`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  let n = 0;
  for (const c of counts.values()) if (c >= 3) n++;
  return n;
}

export function fusionCandidates(s: GameState): Item[][] {
  const heldMap = heldBy(s);
  const groups = new Map<string, Item[]>();
  for (const it of Object.values(s.items)) {
    if (it.locked || it.rarity >= 6) continue;
    const k = `${it.templateId}:${it.rarity}`;
    groups.set(k, [...(groups.get(k) ?? []), it]);
  }
  const out: Item[][] = [];
  for (const items of groups.values()) {
    if (items.length < 3) continue;
    const free = items.filter((it) => !heldMap.has(it.uid)).sort((a, b) => b.level - a.level);
    const worn = items.filter((it) => heldMap.has(it.uid)).sort((a, b) => b.level - a.level);
    const pick = free.length >= 3 ? free.slice(0, 3) : [...free, ...worn.slice(0, 3 - free.length)];
    const wearers = new Set(pick.map((it) => heldMap.get(it.uid)?.uid).filter(Boolean));
    if (pick.length >= 3 && wearers.size <= 1) out.push(pick.slice(0, 3));
  }
  return out;
}

// ---------------------------------------------------------------- combat
export function badgeBonuses(s: GameState): BattleBonuses {
  const b = emptyBonuses();
  b.atkPct += BADGE_BONUS.atkPct * s.badges;
  return b;
}

export function allyFighter(s: GameState, uid: string, hp?: number): FighterInit {
  const mon = s.mons[uid];
  const offTeam = [...s.pension, ...s.exploration].map((p) => s.mons[p.uid]?.speciesId).filter(Boolean) as number[];
  const auras = auraBonuses(s.team.map((u) => s.mons[u].speciesId), offTeam);
  const held = heldItems(s, mon);
  const bonuses = sumBonuses(monBonuses(mon, held, auras), badgeBonuses(s));
  const berryItem = held.find((i) => slotOf(i) === 'berry');
  const berryT = berryItem && template(berryItem.templateId).berry;
  return {
    id: uid, side: 0, speciesId: mon.speciesId, level: mon.level, shiny: mon.shiny,
    stats: finalStats(mon, bonuses), moves: mon.moves, bonuses, hp,
    berry: berryT ? { heal: berryT.heal ? berryHeal(berryItem!) : undefined, cures: berryT.cures } : undefined,
  };
}

/** Malus des sauvages ordinaires (le joueur a l'avantage, comme dans les RPG). */
export const WILD_MALUS = { hp: 0.85, atk: 0.85 };

/**
 * Malus additionnel tant que l'équipe n'a pas ses 3 membres : un K.O. sans remplaçant fait perdre
 * l'étape, donc on amortit la période fragile avant la 3e capture.
 */
export const SOLO_MALUS: Record<number, number> = { 1: 0.8, 2: 0.9, 3: 1 };

export function wildFighter(
  id: string, mon: Mon,
  opts: { boss?: boolean; hpMult?: number; wild?: boolean; teamSize?: number } = {},
): FighterInit {
  const stats = finalStats(mon, emptyBonuses());
  const w = opts.wild ? WILD_MALUS : { hp: 1, atk: 1 };
  const solo = opts.wild ? SOLO_MALUS[Math.min(3, Math.max(1, opts.teamSize ?? 3))] : 1;
  return {
    id, side: 1, speciesId: mon.speciesId, level: mon.level, shiny: mon.shiny,
    stats: {
      ...stats,
      hp: Math.round(stats.hp * w.hp * solo * (opts.hpMult ?? 1)),
      atk: Math.round(stats.atk * w.atk * solo),
    },
    moves: mon.moves, boss: opts.boss,
  };
}

export function pickSpecies(zone: ZoneDef, rng: Rng): number {
  const total = zone.pool.reduce((a, [, w]) => a + w, 0);
  let r = rng.int(total);
  for (const [id, w] of zone.pool) { if (r < w) return id; r -= w; }
  return zone.pool[0][0];
}

export function isRareInZone(zone: ZoneDef, speciesId: number) {
  return (zone.pool.find(([id]) => id === speciesId)?.[1] ?? 0) < 10;
}

export type StageKind = 'stage' | 'boss' | 'arena';

export interface WaveEnemy { mon: Mon; boss?: boolean; hpMult?: number; /** sauvage ordinaire : un peu plus faible que le joueur */ wild?: boolean }

/** Génère les vagues d'une étape. */
export function makeWaves(kind: StageKind, biomeIndex: number, zoneIndex: number, stage: number, rng: Rng, teamSize = 3): WaveEnemy[][] {
  const biome = BIOMES[biomeIndex];
  if (kind === 'arena') {
    return biome.arena.team.map(([id, lv]) => [{ mon: makeMon(id, lv, rng, false, 12), hpMult: 2, boss: true }]);
  }
  const zone = biome.zones[zoneIndex];
  if (kind === 'boss') {
    const b = zone.boss;
    // boss de zone classique : jamais chromatique (ne pas trivialiser le farm d'un boss unique) ;
    // boss rejouable (légendaire) : tiré comme un sauvage à chaque tentative, sinon infarmable en chromatique.
    const shiny = b.repeatable ? rng.int(SHINY_ODDS) === 0 : false;
    return [[{ mon: makeMon(b.speciesId, b.level, rng, shiny, 10), boss: true, hpMult: 5 }]];
  }
  const lv = zone.minLv + Math.floor(((zone.maxLv - zone.minLv) * (stage - 1)) / (STAGES_PER_ZONE - 1));
  const waves: WaveEnemy[][] = [];
  for (let w = 0; w < WAVES_PER_STAGE; w++) {
    // jamais plus d'ennemis que de membres dans l'équipe (+1 aux étapes 4–5)
    const byStage = stage <= 2 ? 1 + rng.int(2) : stage <= 3 ? 2 + rng.int(2) : 3;
    const n = Math.max(1, Math.min(byStage, teamSize + (stage >= 4 ? 1 : 0)));
    const wave: WaveEnemy[] = [];
    for (let i = 0; i < n; i++) {
      const shiny = rng.int(SHINY_ODDS) === 0;
      wave.push({ mon: makeMon(pickSpecies(zone, rng), Math.max(2, lv - 1 + rng.int(2)), rng, shiny), wild: true });
    }
    waves.push(wave);
  }
  return waves;
}

export interface CaptureOffer { speciesId: number; level: number; shiny: boolean; rare: boolean; guaranteed?: boolean }

export interface WaveRewards {
  xp: Record<string, number>;
  levelUps: { uid: string; level: number; newMoves: number[] }[];
  loot: Item[];
  capture: CaptureOffer | null;
}

/**
 * Déroulé d'une étape : enchaîne les vagues, garde les PV entre les vagues
 * (+35 % de soin), distribue les récompenses à chaque vague gagnée.
 */
export class StageRun {
  kind: StageKind;
  biome: number;
  zone: number;
  stage: number;
  waves: WaveEnemy[][];
  waveIndex = 0;
  battle: Battle;
  result: 'win' | 'lose' | null = null;
  private hp: Record<string, number> = {};

  constructor(private s: GameState, kind: StageKind, rng: Rng, private rng2: Rng = rng) {
    this.kind = kind;
    this.biome = s.biome;
    this.zone = s.zone;
    this.stage = s.stage;
    this.waves = makeWaves(kind, s.biome, s.zone, s.stage, rng, s.team.length);
    this.battle = this.makeBattle();
  }

  private makeBattle(): Battle {
    const allies = this.s.team.map((u) => allyFighter(this.s, u, this.hp[u]));
    const enemies = this.waves[this.waveIndex].map((e, i) => {
      addUnique(this.s.dex.seen, e.mon.speciesId);
      return wildFighter(`w${this.waveIndex}-${i}`, e.mon, { boss: e.boss, hpMult: e.hpMult, wild: e.wild, teamSize: this.s.team.length });
    });
    return new Battle([...allies, ...enemies], this.rng2);
  }

  get enemies(): WaveEnemy[] { return this.waves[this.waveIndex]; }

  /** À appeler quand `battle.result` vient de tomber. */
  finishWave(): WaveRewards | null {
    const b = this.battle;
    if (!b.result) return null;
    if (b.result === 'lose') {
      this.result = 'lose';
      onStageLost(this.s, this.kind);
      return null;
    }
    const rewards = waveRewards(this.s, this.kind, this.biome, this.zone, this.enemies, this.rng2);
    // PV conservés + 35 % (l'arène : pas de soin entre ses Pokémon)
    for (const f of b.fighters.filter((x) => x.side === 0)) {
      const heal = this.kind === "arena" ? 0 : Math.round(f.maxHp * 0.35);
      this.hp[f.id] = f.alive ? Math.min(f.maxHp, f.hp + heal) : 0;
    }
    if (this.waveIndex + 1 < this.waves.length) {
      this.waveIndex++;
      // les K.O. restent K.O. jusqu'à la fin de l'étape
      if (this.s.team.every((u) => (this.hp[u] ?? 1) <= 0)) { this.result = 'lose'; onStageLost(this.s, this.kind); return rewards; }
      this.battle = this.makeBattle();
    } else {
      this.result = 'win';
      onStageWon(this.s, this.kind, this.biome, this.zone, this.stage, this.rng2, rewards);
    }
    return rewards;
  }
}

/**
 * Multiplicateur d'XP selon l'écart entre le niveau moyen des ennemis et celui du Pokémon :
 * favorise les Pokémon en retard, pénalise ceux déjà au-dessus du niveau de la zone.
 */
export function xpGapMult(monLevel: number, enemyAvgLevel: number): number {
  return Math.max(0.5, Math.min(2, 1 + 0.2 * (enemyAvgLevel - monLevel)));
}

function waveRewards(s: GameState, kind: StageKind, biomeIndex: number, zoneIndex: number, enemies: WaveEnemy[], rng: Rng): WaveRewards {
  const zones = BIOMES[biomeIndex].zones;
  const zone = zones[Math.min(zoneIndex, zones.length - 1)];
  const totalXp = enemies.reduce((a, e) => a + 2 * e.mon.level * (e.boss ? 5 : 1), 0);
  const share = Math.max(1, Math.round(totalXp / s.team.length));
  const enemyAvgLevel = enemies.reduce((a, e) => a + e.mon.level, 0) / enemies.length;
  const out: WaveRewards = { xp: {}, levelUps: [], loot: [], capture: null };
  for (const u of s.team) {
    const mon = s.mons[u];
    const xp = Math.max(1, Math.round(share * xpGapMult(mon.level, enemyAvgLevel)));
    const r = giveXp(mon, xp);
    out.xp[u] = xp;
    if (r.levels) out.levelUps.push({ uid: u, level: mon.level, newMoves: r.newMoves });
  }
  s.totals.kills += enemies.length;
  const lootLevel = Math.max(1, Math.round(enemies.reduce((a, e) => a + e.mon.level, 0) / enemies.length));
  for (let i = 0; i < enemies.length; i++) {
    if (rng.int(100) < LOOT_CHANCE) out.loot.push(rollLoot(rng, lootLevel));
  }
  if (kind === 'boss' || kind === 'arena') {
    // boss : 3 objets dont 1 Rare minimum (arène : Épique minimum)
    out.loot.push(rollLoot(rng, lootLevel, kind === 'arena' ? 3 : 2), rollLoot(rng, lootLevel), rollLoot(rng, lootLevel));
  }
  for (const it of out.loot) s.items[it.uid] = it;
  // occasion de capture
  const shiny = enemies.find((e) => e.mon.shiny && !e.boss);
  if (kind === 'boss') {
    const b = enemies[0].mon;
    out.capture = { speciesId: b.speciesId, level: b.level, shiny: b.shiny, rare: false, guaranteed: true };
  } else if (kind === 'stage' && (shiny || rng.int(100) < CAPTURE_OFFER_CHANCE)) {
    const e = shiny ?? enemies[rng.int(enemies.length)];
    out.capture = { speciesId: e.mon.speciesId, level: e.mon.level, shiny: e.mon.shiny, rare: isRareInZone(zone, e.mon.speciesId), guaranteed: e.mon.shiny };
  }
  return out;
}

function onStageWon(s: GameState, kind: StageKind, biome: number, zone: number, stage: number, rng: Rng, rewards: WaveRewards) {
  s.totals.stagesCleared++;
  if (kind === 'stage') {
    if (stage >= s.unlocked[biome][zone] && stage < STAGES_PER_ZONE) s.unlocked[biome][zone] = stage + 1;
    // avance automatiquement jusqu'à la dernière étape débloquée, puis y reste (farm)
    s.stage = Math.min(s.unlocked[biome][zone], stage + 1);
  } else if (kind === 'boss') {
    s.bossesBeaten[biome][zone] = true;
    if (zone + 1 < BIOMES[biome].zones.length) {
      s.unlocked[biome][zone + 1] = Math.max(1, s.unlocked[biome][zone + 1]);
      s.zone = zone + 1;
      s.stage = 1;
    }
  } else if (kind === 'arena') {
    if (!s.arenaBeaten[biome]) {
      s.arenaBeaten[biome] = true;
      s.badges++;
      if (biome + 1 < BIOMES.length) {
        s.unlocked[biome + 1][0] = Math.max(1, s.unlocked[biome + 1][0]);
        s.biome = biome + 1;
        s.zone = 0;
        s.stage = 1;
      }
    }
    s.balls.hyper += 3;
  }
  void rng; void rewards;
}

/** Défaite : on recule d'une étape, jusqu'à la dernière étape de la zone précédente. */
function onStageLost(s: GameState, kind: StageKind) {
  if (kind !== 'stage') return;
  if (s.stage > 1) s.stage--;
  else if (s.zone > 0) { s.zone--; s.stage = s.unlocked[s.biome][s.zone]; }
}

export function bossAvailable(s: GameState, biome = s.biome, zone = s.zone) {
  return s.unlocked[biome][zone] >= STAGES_PER_ZONE;
}

export function arenaAvailable(s: GameState, biome = s.biome) {
  return s.bossesBeaten[biome].every(Boolean);
}

/** La zone `zone` du biome `biome` est-elle débloquée (biome précédent battu) ? */
export function biomeAvailable(s: GameState, biome: number) {
  return biome === 0 || s.arenaBeaten[biome - 1];
}

export function selectStage(s: GameState, biome: number, zone: number, stage: number) {
  if (biome < 0 || biome >= BIOMES.length || !biomeAvailable(s, biome)) return;
  if (zone < 0 || zone >= BIOMES[biome].zones.length || s.unlocked[biome][zone] < 1) return;
  s.biome = biome;
  s.zone = zone;
  s.stage = Math.max(1, Math.min(stage, s.unlocked[biome][zone]));
}

// ---------------------------------------------------------------- capture
export function captureChance(offer: CaptureOffer, ball: BallKind): number {
  if (offer.guaranteed || offer.shiny) return 100;
  return Math.round(BALLS[ball].chance * (offer.rare ? 0.5 : 1));
}

/** Niveau du meilleur Pokémon de l'équipe : plafond des captures, jamais en dessous de 2. */
export function teamMaxLevel(s: GameState): number {
  return Math.max(2, ...s.team.map((u) => s.mons[u].level));
}

/** Niveau effectif d'une capture : jamais au-dessus du meilleur Pokémon de l'équipe. */
export function captureLevel(s: GameState, offer: CaptureOffer): number {
  return Math.min(offer.level, teamMaxLevel(s));
}

/** Meilleure qualité génétique (étoiles) déjà possédée pour une espèce (0 si jamais capturée). */
export function bestStarsOf(s: GameState, speciesId: number): number {
  return Object.values(s.mons).filter((m) => m.speciesId === speciesId).reduce((best, m) => Math.max(best, monStars(m)), 0);
}

/** Ball à utiliser pour une capture automatique : la plus forte en stock, ou la moins chère si `cheapest`. */
export function autoCaptureBall(s: GameState, best: boolean): BallKind | null {
  const order: BallKind[] = best ? ['hyper', 'super', 'poke'] : ['poke', 'super', 'hyper'];
  return order.find((b) => s.balls[b] > 0) ?? null;
}

export function tryCapture(s: GameState, offer: CaptureOffer, ball: BallKind | null, rng: Rng): Mon | null {
  if (!offer.guaranteed) {
    if (!ball || s.balls[ball] <= 0) return null;
    s.balls[ball]--;
    if (rng.int(100) >= captureChance(offer, ball)) return null;
  }
  const mon = makeMon(offer.speciesId, captureLevel(s, offer), rng, offer.shiny);
  addMon(s, mon);
  s.totals.captures++;
  return mon;
}

export function buyBall(s: GameState, kind: BallKind): boolean {
  if (s.shards < BALL_PRICE[kind]) return false;
  s.shards -= BALL_PRICE[kind];
  s.balls[kind]++;
  return true;
}

export function grantDailyBalls(s: GameState, now = Date.now()) {
  const day = Math.floor((now - new Date(now).getTimezoneOffset() * 60_000) / 86_400_000);
  if (day === s.lastFreeBallsDay) return 0;
  s.lastFreeBallsDay = day;
  s.balls.poke += FREE_BALLS_PER_DAY;
  return FREE_BALLS_PER_DAY;
}

// ---------------------------------------------------------------- pension (XP passive)
/**
 * Part de l'XP/heure de combat réelle (voir `teamXpPerHour` dans `idle.ts`) donnée par la pension :
 * plus lente que jouer activement (sinon personne ne combattrait), mais scale avec la progression du
 * joueur au lieu d'un chiffre fixe qui devient dérisoire à mesure que les niveaux montent.
 */
export const PENSION_XP_SHARE = 0.4;
/** Repli pour les sauvegardes migrées dont le taux n'a pas encore été calculé (voir `migrateSave`). */
export const PENSION_XP_FALLBACK_PER_HOUR = 50;

export function pensionSlots(s: GameState) {
  return 3 + s.badges;
}

/** `xpPerHour` : à calculer par l'appelant via `teamXpPerHour(s, rng) * PENSION_XP_SHARE` (voir idle.ts). */
export function assignPension(s: GameState, uid: string, xpPerHour: number, now = Date.now()): boolean {
  if (s.team.includes(uid) || !s.mons[uid] || s.exploration.some((p) => p.uid === uid)) return false;
  if (s.pension.some((p) => p.uid === uid)) return true;
  if (s.pension.length >= pensionSlots(s)) return false;
  s.pension.push({ uid, since: now, xpPerHour: Math.max(0, xpPerHour) });
  return true;
}

export function removePension(s: GameState, uid: string) {
  s.pension = s.pension.filter((p) => p.uid !== uid);
}

/** XP prête à récolter, tous emplacements confondus (juste pour l'affichage). */
export function pensionXpReady(s: GameState, now = Date.now()): number {
  return s.pension.reduce((a, p) => a + Math.floor((Math.min(now - p.since, PENSION_CAP_MS) / 3600_000) * p.xpPerHour), 0);
}

export interface PensionHarvest { gains: { uid: string; xp: number; levels: number; newMoves: number[] }[] }

/** Récolte l'XP accumulée (plafond 8 h) de chaque Pokémon en pension. */
export function harvestPension(s: GameState, now = Date.now()): PensionHarvest {
  const gains: PensionHarvest['gains'] = [];
  for (const p of s.pension) {
    const mon = s.mons[p.uid];
    const elapsed = Math.min(now - p.since, PENSION_CAP_MS);
    p.since = now;
    if (!mon || elapsed <= 0) continue;
    const xp = Math.floor((elapsed / 3600_000) * p.xpPerHour);
    if (xp <= 0) continue;
    const r = giveXp(mon, xp);
    gains.push({ uid: p.uid, xp, levels: r.levels, newMoves: r.newMoves });
  }
  return { gains };
}

// ---------------------------------------------------------------- exploration (Verger/Entraînement/Fouille)
export function explorationSlots(s: GameState) {
  return 3 + s.badges;
}

export function assignExploration(s: GameState, uid: string, job: Job, now = Date.now()): boolean {
  if (s.team.includes(uid) || !s.mons[uid] || s.pension.some((p) => p.uid === uid)) return false;
  const existing = s.exploration.find((p) => p.uid === uid);
  if (existing) { existing.job = job; existing.since = now; return true; }
  if (s.exploration.length >= explorationSlots(s)) return false;
  s.exploration.push({ uid, job, since: now });
  return true;
}

export function removeExploration(s: GameState, uid: string) {
  s.exploration = s.exploration.filter((p) => p.uid !== uid);
}

export interface ExplorationHarvest { berries: Item[]; candies: Record<string, number>; shards: number; balls: number }

export function explorationReady(s: GameState, now = Date.now()): number {
  return s.exploration.reduce((a, p) => a + Math.floor(Math.min(now - p.since, PENSION_CAP_MS) / JOBS[p.job].cycleMs), 0);
}

/** Récolte tous les cycles terminés (plafond 8 h d'accumulation). */
export function harvestExploration(s: GameState, rng: Rng, now = Date.now()): ExplorationHarvest {
  const out: ExplorationHarvest = { berries: [], candies: {}, shards: 0, balls: 0 };
  for (const p of s.exploration) {
    const mon = s.mons[p.uid];
    if (!mon) continue;
    const cycleMs = JOBS[p.job].cycleMs;
    const elapsed = Math.min(now - p.since, PENSION_CAP_MS);
    const cycles = Math.floor(elapsed / cycleMs);
    if (!cycles) continue;
    p.since = now - (elapsed >= PENSION_CAP_MS ? 0 : elapsed - cycles * cycleMs);
    for (let c = 0; c < cycles; c++) {
      if (p.job === 'orchard') {
        const types = species(mon.speciesId).types;
        const n = types.includes('grass') || types.includes('water') ? 2 : 1;
        for (let i = 0; i < n; i++) {
          const ids = ['oran', 'ceriz', 'pecha', 'maron'];
          const it = { ...rollLoot(rng, mon.level), templateId: ids[rng.int(ids.length)], subs: [] as Item['subs'] };
          it.rarity = Math.min(it.rarity, 2);
          s.items[it.uid] = it;
          out.berries.push(it);
        }
      } else if (p.job === 'training') {
        const base = lineBase(mon.speciesId);
        s.candies[base] = (s.candies[base] ?? 0) + 1;
        out.candies[base] = (out.candies[base] ?? 0) + 1;
      } else {
        out.shards += 10 + Math.floor(mon.level / 2);
        if (rng.int(100) < 20) { out.balls++; s.balls.poke++; }
      }
    }
  }
  s.shards += out.shards;
  return out;
}

export { newUid };
