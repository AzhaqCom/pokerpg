/**
 * État de la partie (sérialisable) et règles de progression :
 * équipe, étapes/vagues, butin, capture, évolutions, pension.
 */
import { Battle, FighterInit } from './battle';
import { BADGE_BONUS, BIOMES, PRESTIGE_BIOME, REGION_START, STAGES_PER_ZONE, WAVES_PER_STAGE, ZoneDef } from './content';
import { PType, learnedMoves, movesAtLevel, species } from './data';
import { SETS, STAT_WEIGHT, TEMPLATES, berryHeal, fuse, canFuse, itemScore, makeItem, newUid, recycleValue, rerollCost, rerollSub, rollLoot, rollRarity, slotOf, template, upgrade, upgradeCost } from './items';
import { BattleBonuses, Item, ItemSlot, MAX_RARITY, Mon, emptyBonuses } from './model';
import { Rng } from './rng';
import { MAX_LEVEL, auraBonuses, combatPower, finalStats, levelFromXp, monBonuses, monStars, sumBonuses, xpForLevel } from './stats';
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
/** Exploration : farm passif d'éclats, 3/min par Pokémon posté (voir `harvestExploration`). */
export const SHARDS_PER_MIN = 3;
const EXPLORATION_CYCLE_MS = 60_000;
export const CANDY_XP = 100;

export interface GameState {
  version: 1;
  starterChosen: boolean;
  mons: Record<string, Mon>;
  team: string[];
  /** Pension : gagne de l'XP passive (voir `harvestPension`). `xpPerHour` rafraîchi à chaque récolte. */
  pension: { uid: string; since: number; xpPerHour: number }[];
  /** Exploration : farm passif d'éclats (ex-pension). */
  exploration: { uid: string; since: number }[];
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
  /** Méga bonbons par lignée (même clé que `candies`) : +1 à un gène d'un Pokémon de la lignée. */
  megaCandies: Record<string, number>;
  totals: { kills: number; captures: number; fusions: number; stagesCleared: number };
  /** Horodatage (ms) de la dernière activité : combat affiché ou passage en arrière-plan. Sert au calcul idle. */
  lastActive: number;
  /** 0 = partie Kanto ; 1 = a lancé le « nouveau départ » Johto (voir `startPrestige`). */
  prestige: number;
  /** Horodatage (ms) du tout début de la partie — sert au récap affiché avant le prestige. */
  startedAt: number;
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
    dex: { seen: [], caught: [], shiny: [] }, candies: {}, megaCandies: {},
    totals: { kills: 0, captures: 0, fusions: 0, stagesCleared: 0 },
    lastActive: Date.now(),
    prestige: 0,
    startedAt: Date.now(),
  };
}

/** Peut-on lancer le « nouveau départ » Johto ? Une fois, dès le badge du Champion Kanto obtenu. */
export function canPrestige(s: GameState): boolean {
  return s.prestige === 0 && s.arenaBeaten[9] && s.dex.seen.length >= 151;
}

/**
 * « Nouveau départ » (prestige) : équipe/boîte/objets/éclats/Balls/badges/Pokédex repartent à zéro
 * (1/251 après le starter Johto), nouveau starter à choisir (`STARTERS2`, via le même écran que le
 * tout premier départ). Seule la progression de zone Kanto (unlocked/bossesBeaten/arenaBeaten, bonbons,
 * totaux) est conservée — Kanto reste farmable avec la nouvelle équipe (butin recalé sur son niveau,
 * voir `waveRewards`), juste sans le Pokédex déjà rempli.
 */
export function startPrestige(s: GameState): boolean {
  if (!canPrestige(s)) return false;
  s.mons = {}; s.team = []; s.pension = []; s.exploration = [];
  s.items = {}; s.shards = 0; s.balls = { poke: 10, super: 0, hyper: 0 };
  s.badges = 0;
  s.dex = { seen: [], caught: [], shiny: [] };
  s.biome = PRESTIGE_BIOME; s.zone = 0; s.stage = 1;
  s.unlocked[PRESTIGE_BIOME][0] = Math.max(1, s.unlocked[PRESTIGE_BIOME][0]); // sinon la 1re zone Johto reste verrouillée
  s.starterChosen = false;
  s.prestige = 1;
  return true;
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
  // sauvegarde d'avant l'ajout d'un biome (ex. Johto) : complète les tableaux trop courts avec les
  // valeurs par défaut des nouveaux biomes, sinon onStageWon plante en tentant d'y accéder.
  if (Array.isArray(raw.unlocked) && raw.unlocked.length < BIOMES.length) {
    for (let i = raw.unlocked.length; i < BIOMES.length; i++) raw.unlocked.push(zoneCounts[i] ? Array(zoneCounts[i]).fill(0) : []);
  }
  if (Array.isArray(raw.bossesBeaten) && raw.bossesBeaten.length < BIOMES.length) {
    for (let i = raw.bossesBeaten.length; i < BIOMES.length; i++) raw.bossesBeaten.push(zoneCounts[i] ? Array(zoneCounts[i]).fill(false) : []);
  }
  if (Array.isArray(raw.arenaBeaten) && raw.arenaBeaten.length < BIOMES.length) {
    for (let i = raw.arenaBeaten.length; i < BIOMES.length; i++) raw.arenaBeaten.push(false);
  }
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
  // Filet de sécurité : une équipe qui référence un Pokémon relâché/supprimé (uid fantôme, jamais
  // nettoyé par un bug passé) fait croire l'équipe pleine alors qu'elle affiche moins de 3 membres —
  // « Ajouter à l'équipe » propose alors de remplacer au lieu d'ajouter. Retiré au chargement.
  if (Array.isArray(raw.team) && raw.mons && typeof raw.mons === 'object') {
    const mons = raw.mons as Record<string, unknown>;
    raw.team = (raw.team as string[]).filter((u, i, arr) => mons[u] && arr.indexOf(u) === i);
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

/** Objets offerts au starter (1 par emplacement, rareté commune) : la panoplie du tout premier biome
 * de la région courante (Forêt de Jade en Kanto, Route des Cieux en Johto…) — jamais une panoplie
 * d'une région précédente. */
function starterItems(s: GameState): string[] {
  const firstBiome = REGION_START[s.prestige] ?? 0;
  const setKey = Object.keys(SETS).find((k) => SETS[k].biome === firstBiome);
  const templates = setKey ? TEMPLATES.filter((t) => t.set === setKey).map((t) => t.id) : [];
  return templates.length ? templates : ['griffe-sylve', 'cape-sylve', 'baie-sylve'];
}

export function chooseStarter(s: GameState, speciesId: number, rng: Rng) {
  const mon = makeMon(speciesId, 5, rng, false, 8);
  addMon(s, mon);
  s.team = [mon.uid];
  s.starterChosen = true;
  for (const templateId of starterItems(s)) {
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
  if (mon.level >= MAX_LEVEL) return { levels: 0, newMoves: [] }; // XP gagnée en vain à plafonner sans fin
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
 * Doublons en excès dans la boîte (jamais l'équipe, ni la pension/exploration) : pour chaque lignée
 * (chromatique ou non à part), on garde 1 exemplaire par étage déjà possédé (équipe/pension/exploration/
 * boîte, peu importe où) — le strict nécessaire pour rester complet.
 *
 * Mode « complet » (`keepEvolutionMaterial: true`, réglage par défaut, pour un collectionneur qui vise
 * les 251×2 formes) : garde EN PLUS, pour chaque étage de la lignée pas encore possédé du tout, 1
 * exemplaire de réserve (le plus fort) — de la matière pour compléter la lignée plus tard via
 * « Compléter le Pokédex » (`completeDex`). Exemple : 14 Bulbizarre chromatiques, aucun Herbizarre/
 * Florizarre chromatique → garde 1 Bulbizarre (déjà possédé) + 2 de réserve (étages manquants) = 3.
 *
 * Mode « léger » (`keepEvolutionMaterial: false`) : ne garde que ce qui est déjà possédé, sans réserve —
 * dans le même exemple, garde 1 seul Bulbizarre et relâche les 13 autres.
 */
export function excessMons(s: GameState, opts: { keepEvolutionMaterial?: boolean } = {}): Mon[] {
  const keepEvolutionMaterial = opts.keepEvolutionMaterial ?? true;
  const out: Mon[] = [];
  const isProtected = (m: Mon) => s.pension.some((p) => p.uid === m.uid) || s.exploration.some((p) => p.uid === m.uid);
  const bases = new Set<number>();
  for (const m of Object.values(s.mons)) bases.add(lineBase(m.speciesId));
  for (const base of bases) {
    const chain: number[] = [];
    for (let id = base; id; id = species(id).evolvesTo || 0) chain.push(id);
    for (const shiny of [false, true]) {
      const all = Object.values(s.mons).filter((m) => m.shiny === shiny && chain.includes(m.speciesId));
      if (!all.length) continue;
      const cnt = new Map<number, number>();
      for (const m of all) cnt.set(m.speciesId, (cnt.get(m.speciesId) ?? 0) + 1);
      // 1 exemplaire protégé par étage déjà possédé : un porteur équipe/pension/exploration en priorité
      // (de toute façon irrécupérable ici), sinon le plus fort de la boîte à cet étage.
      const protectedUids = new Set<string>();
      for (const stage of chain) {
        if (!(cnt.get(stage) ?? 0)) continue;
        const atStage = all.filter((m) => m.speciesId === stage);
        const held = atStage.find((m) => s.team.includes(m.uid) || s.pension.some((p) => p.uid === m.uid) || s.exploration.some((p) => p.uid === m.uid))
          ?? [...atStage].sort((a, b) => combatPower(finalStats(b, emptyBonuses())) - combatPower(finalStats(a, emptyBonuses())))[0];
        if (held) protectedUids.add(held.uid);
      }
      const missing = keepEvolutionMaterial ? chain.filter((stage) => !(cnt.get(stage) ?? 0)).length : 0;
      const freeSpares = all
        .filter((m) => !protectedUids.has(m.uid) && !s.team.includes(m.uid) && !isProtected(m))
        .sort((a, b) => combatPower(finalStats(b, emptyBonuses())) - combatPower(finalStats(a, emptyBonuses())));
      if (freeSpares.length > missing) out.push(...freeSpares.slice(missing));
    }
  }
  return out;
}

/** Relâche tous les doublons en excès (voir `excessMons`). */
export function releaseExcess(s: GameState, opts: { keepEvolutionMaterial?: boolean } = {}): { count: number; candies: number } {
  const excess = excessMons(s, opts);
  for (const m of excess) release(s, m.uid);
  return { count: excess.length, candies: excess.length * 3 };
}

function boxMons(s: GameState): Mon[] {
  return Object.values(s.mons).filter((m) => !s.team.includes(m.uid) && !s.pension.some((p) => p.uid === m.uid) && !s.exploration.some((p) => p.uid === m.uid));
}

/** Pokémon de la boîte sous `minStars` étoiles (jamais l'équipe/pension/exploration). */
export function monsBelowStars(s: GameState, minStars: number): Mon[] {
  return boxMons(s).filter((m) => monStars(m) < minStars);
}

/** Relâche tous les Pokémon de la boîte sous `minStars` étoiles (ex. « ne garder que les 3★+ »). */
export function releaseBelowStars(s: GameState, minStars: number): { count: number; candies: number } {
  const targets = monsBelowStars(s, minStars);
  for (const m of targets) release(s, m.uid);
  return { count: targets.length, candies: targets.length * 3 };
}

/** Pokémon normaux (non chromatiques) de la boîte (jamais l'équipe/pension/exploration). */
export function monsNotShiny(s: GameState): Mon[] {
  return boxMons(s).filter((m) => !m.shiny);
}

/** Relâche tous les Pokémon non chromatiques de la boîte (« ne garder que les chromatiques »). */
export function releaseNotShiny(s: GameState): { count: number; candies: number } {
  const targets = monsNotShiny(s);
  for (const m of targets) release(s, m.uid);
  return { count: targets.length, candies: targets.length * 3 };
}

/** Retire tous les objets portés par les Pokémon de la boîte (jamais l'équipe) : pratique pour
 * reconsolider l'équipement dans le sac quand des Pokémon de passage en équipe l'ont dispersé. */
export function unequipBox(s: GameState): number {
  let n = 0;
  for (const m of Object.values(s.mons)) {
    if (s.team.includes(m.uid)) continue;
    n += Object.keys(m.items).length;
    m.items = {};
  }
  return n;
}

/** Étage le plus avancé qu'un Pokémon peut atteindre par évolutions successives à son niveau actuel. */
function maxReachableStage(mon: Mon): number {
  let id = mon.speciesId;
  for (;;) {
    const sp = species(id);
    if (!sp.evolvesTo || mon.level < sp.evolveLevel) return id;
    id = sp.evolvesTo;
  }
}

/**
 * Fait évoluer automatiquement le strict minimum de Pokémon de la boîte pour compléter le Pokédex :
 * pour chaque lignée (normale et chromatique séparément), un exemplaire déjà possédé (équipe, pension,
 * exploration ou boîte) est toujours conservé à son étage — seuls des exemplaires de la boîte en trop
 * (au-delà du premier gardé à chaque étage déjà possédé) servent de matière pour grimper la lignée
 * jusqu'aux étages manquants. Retourne le nombre d'évolutions effectuées.
 * `dryRun: true` ne modifie jamais `s` et s'arrête dès la 1re évolution possible trouvée (utile pour
 * savoir si le bouton a quelque chose à faire, voir `canCompleteDex`).
 */
export function completeDex(s: GameState, dryRun = false): number {
  const maxId = s.prestige > 0 ? 251 : 151;
  const bases = new Set<number>();
  for (let id = 1; id <= maxId; id++) bases.add(lineBase(id));
  let count = 0;
  for (const base of bases) {
    const chain: number[] = [];
    for (let id = base; id && id <= maxId; id = species(id).evolvesTo || 0) chain.push(id);
    if (chain.length < 2) continue;
    for (const shiny of [false, true]) {
      const all = Object.values(s.mons).filter((m) => m.shiny === shiny && chain.includes(m.speciesId));
      const cnt = new Map<number, number>();
      for (const m of all) cnt.set(m.speciesId, (cnt.get(m.speciesId) ?? 0) + 1);
      // 1 exemplaire protégé par étage déjà possédé (équipe/pension/exploration prioritaires)
      const protectedUids = new Set<string>();
      for (const stage of chain) {
        if (!(cnt.get(stage) ?? 0)) continue;
        const held = all.find((m) => m.speciesId === stage
          && (s.team.includes(m.uid) || s.pension.some((p) => p.uid === m.uid) || s.exploration.some((p) => p.uid === m.uid)))
          ?? all.find((m) => m.speciesId === stage);
        if (held) protectedUids.add(held.uid);
      }
      const freeSpares = all
        .filter((m) => !protectedUids.has(m.uid) && !s.team.includes(m.uid)
          && !s.pension.some((p) => p.uid === m.uid) && !s.exploration.some((p) => p.uid === m.uid))
        .sort((a, b) => chain.indexOf(a.speciesId) - chain.indexOf(b.speciesId));
      const missing = chain.filter((stage) => !(cnt.get(stage) ?? 0));
      for (const target of missing) {
        const ti = chain.indexOf(target);
        const idx = freeSpares.findIndex((m) => chain.indexOf(m.speciesId) < ti && chain.indexOf(maxReachableStage(m)) >= ti);
        if (idx < 0) continue;
        if (dryRun) return 1;
        const [mon] = freeSpares.splice(idx, 1);
        while (mon.speciesId !== target) { evolve(s, mon.uid); count++; }
      }
    }
  }
  return count;
}

/** Le bouton « Compléter le Pokédex » a-t-il quelque chose à faire ? Ne modifie jamais `s`. */
export function canCompleteDex(s: GameState): boolean {
  return completeDex(s, true) > 0;
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

/** Bonbons d'une lignée pour fabriquer 1 méga bonbon de cette lignée (= 10 Pokémon relâchés). */
export const MEGA_CANDY_COST = 30;
export const GENE_MAX = 15;
export type GeneKey = keyof Mon['genes'];

export function craftMegaCandy(s: GameState, speciesId: number): boolean {
  const base = lineBase(speciesId);
  const have = s.candies[base] ?? 0;
  if (have < MEGA_CANDY_COST) return false;
  s.candies[base] = have - MEGA_CANDY_COST;
  s.megaCandies[base] = (s.megaCandies[base] ?? 0) + 1;
  return true;
}

/** Consomme 1 méga bonbon de la lignée pour +1 à un gène (plafond 15) : seule façon d'améliorer des gènes. */
export function applyMegaCandy(s: GameState, uid: string, gene: GeneKey): boolean {
  const mon = s.mons[uid];
  if (!mon) return false;
  const base = lineBase(mon.speciesId);
  const have = s.megaCandies[base] ?? 0;
  if (have < 1 || mon.genes[gene] >= GENE_MAX) return false;
  s.megaCandies[base] = have - 1;
  mon.genes[gene]++;
  return true;
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

/**
 * Équipe automatiquement les 3 emplacements avec la meilleure combinaison disponible dans le sac (jamais
 * un objet porté par un autre Pokémon) : compare le total « 3 meilleurs objets indépendants » à celui de
 * chaque panoplie complétable (2 ou 3 pièces du même set parmi les objets disponibles), bonus de
 * panoplie inclus dans le total (converti sur la même échelle que `itemScore` via `STAT_WEIGHT`) — la
 * panoplie ne l'emporte que si elle rapporte vraiment plus, aucune règle spéciale liée au type du
 * Pokémon (les panoplies ne sont pas réservées à un type). Retourne le nombre d'emplacements changés.
 */
export function autoEquipBest(s: GameState, uid: string): number {
  const mon = s.mons[uid];
  if (!mon) return 0;
  const held = heldBy(s);
  const available = (it: Item) => !held.has(it.uid) || held.get(it.uid) === mon;
  const SLOTS: ItemSlot[] = ['offense', 'defense', 'berry'];
  const bySlot: Record<ItemSlot, Item[]> = { offense: [], defense: [], berry: [] };
  for (const it of Object.values(s.items)) if (available(it)) bySlot[slotOf(it)].push(it);
  const bestOf = (items: Item[]) => items.reduce<Item | undefined>((best, it) => (!best || itemScore(it) > itemScore(best) ? it : best), undefined);

  type Combo = Partial<Record<ItemSlot, Item>>;
  const independent: Combo = { offense: bestOf(bySlot.offense), defense: bestOf(bySlot.defense), berry: bestOf(bySlot.berry) };

  const scoreCombo = (combo: Combo): number => {
    let total = 0;
    const setCount: Record<string, number> = {};
    for (const slot of SLOTS) {
      const it = combo[slot];
      if (!it) continue;
      total += itemScore(it);
      const set = template(it.templateId).set;
      if (set) setCount[set] = (setCount[set] ?? 0) + 1;
    }
    for (const [key, n] of Object.entries(setCount)) {
      const set = SETS[key];
      if (!set) continue;
      if (n >= 2) total += STAT_WEIGHT[set.two.stat] * set.two.value;
      if (n >= 3) total += STAT_WEIGHT[set.three.stat] * set.three.value;
    }
    return total;
  };

  let bestCombo = independent;
  let bestScore = scoreCombo(independent);
  for (const key of Object.keys(SETS)) {
    const combo: Combo = { ...independent };
    for (const slot of SLOTS) {
      const setItem = bestOf(bySlot[slot].filter((it) => template(it.templateId).set === key));
      if (setItem) combo[slot] = setItem;
    }
    const sc = scoreCombo(combo);
    if (sc > bestScore) { bestScore = sc; bestCombo = combo; }
  }

  let n = 0;
  for (const slot of SLOTS) {
    const pick = bestCombo[slot];
    if (pick && pick.uid !== mon.items[slot]) { equip(s, uid, pick.uid); n++; }
  }
  return n;
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
/** Fusionner vers Chromatique (le tout dernier palier) exige d'avoir déjà ce nombre de badges — un
 * joueur au rythme normal ne l'atteint jamais avant, ça ne mord que sur un farm très agressif d'un seul
 * biome (voir `genesMinForBadges`, même principe en plafond plutôt qu'en plancher). */
export const CHROMATIC_BADGE_REQ = 6;

export function fuseItems(s: GameState, uids: string[], rng: Rng): Item | null {
  const items = uids.map((u) => s.items[u]);
  if (items.some((i) => !i) || !canFuse(items)) return null;
  if (items[0].rarity === MAX_RARITY - 1 && s.badges < CHROMATIC_BADGE_REQ) return null;
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
    if (it.locked || it.rarity >= MAX_RARITY || (it.rarity === MAX_RARITY - 1 && s.badges < CHROMATIC_BADGE_REQ)) continue;
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
    if (it.locked || it.rarity >= MAX_RARITY || (it.rarity === MAX_RARITY - 1 && s.badges < CHROMATIC_BADGE_REQ)) continue;
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
  opts: { boss?: boolean; hpMult?: number; wild?: boolean; wildMult?: number; teamSize?: number } = {},
): FighterInit {
  const stats = finalStats(mon, emptyBonuses());
  const m = opts.wildMult ?? WILD_MALUS.hp;
  const w = opts.wild ? { hp: m, atk: m } : { hp: 1, atk: 1 };
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

/** Poids du boss une fois qu'il a rejoint le pool sauvage de sa zone (`joinsPool`) : aussi rare qu'une
 * espèce rare classique (poids < 10 dans `isRareInZone`). */
const BOSS_POOL_WEIGHT = 6;

/** Pool réellement tiré au sort : le pool statique de la zone, + son boss si `joinsPool` et déjà vaincu. */
export function effectivePool(zone: ZoneDef, bossBeaten: boolean): [number, number][] {
  if (!zone.boss.joinsPool || !bossBeaten) return zone.pool;
  return [...zone.pool, [zone.boss.speciesId, BOSS_POOL_WEIGHT]];
}

export function pickSpecies(zone: ZoneDef, rng: Rng, bossBeaten = false): number {
  const pool = effectivePool(zone, bossBeaten);
  const total = pool.reduce((a, [, w]) => a + w, 0);
  let r = rng.int(total);
  for (const [id, w] of pool) { if (r < w) return id; r -= w; }
  return pool[0][0];
}

export function isRareInZone(zone: ZoneDef, speciesId: number, bossBeaten = false) {
  return (effectivePool(zone, bossBeaten).find(([id]) => id === speciesId)?.[1] ?? 0) < 10;
}

export type StageKind = 'stage' | 'boss' | 'arena';

export interface WaveEnemy {
  mon: Mon; boss?: boolean; hpMult?: number;
  /** sauvage ordinaire : un peu plus faible que le joueur (`WILD_MALUS`), sauf `wildMult` (zone en avance) */
  wild?: boolean; wildMult?: number;
}

/** Génère les vagues d'une étape. */
export function makeWaves(kind: StageKind, biomeIndex: number, zoneIndex: number, stage: number, rng: Rng, teamSize = 3, bossBeaten = false): WaveEnemy[][] {
  const biome = BIOMES[biomeIndex];
  if (kind === 'arena') {
    return biome.arena.team.map(([id, lv]) => [{ mon: makeMon(id, lv, rng, false, 12), hpMult: 2, boss: true }]);
  }
  const zone = biome.zones[zoneIndex];
  if (kind === 'boss') {
    // le combat de boss lui-même n'est jamais chromatique (ne pas trivialiser sa capture garantie) ;
    // une fois vaincu, il rejoint le pool sauvage (`joinsPool`) et peut y être chromatique comme les autres.
    return [[{ mon: makeMon(zone.boss.speciesId, zone.boss.level, rng, false, 10), boss: true, hpMult: 5 }]];
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
      wave.push({ mon: makeMon(pickSpecies(zone, rng, bossBeaten), Math.max(2, lv - 1 + rng.int(2)), rng, shiny), wild: true, wildMult: zone.wildMult });
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
    this.waves = makeWaves(kind, s.biome, s.zone, s.stage, rng, s.team.length, s.bossesBeaten[s.biome][s.zone]);
    this.battle = this.makeBattle();
  }

  private makeBattle(): Battle {
    const allies = this.s.team.map((u) => allyFighter(this.s, u, this.hp[u]));
    const enemies = this.waves[this.waveIndex].map((e, i) => {
      addUnique(this.s.dex.seen, e.mon.speciesId);
      return wildFighter(`w${this.waveIndex}-${i}`, e.mon, { boss: e.boss, hpMult: e.hpMult, wild: e.wild, wildMult: e.wildMult, teamSize: this.s.team.length });
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
  // niveau du butin : jamais en dessous du meilleur Pokémon de l'équipe (farmer un ancien biome reste
  // pertinent), jamais en dessous de l'ennemi affronté non plus (une zone plus dure que l'équipe garde
  // un butin à sa hauteur) — max() couvre les deux cas à la fois.
  const lootLevel = Math.max(1, Math.round(enemyAvgLevel), teamMaxLevel(s));
  for (let i = 0; i < enemies.length; i++) {
    if (rng.int(100) < LOOT_CHANCE) out.loot.push(rollLoot(rng, lootLevel, biomeIndex));
  }
  if (kind === 'boss' || kind === 'arena') {
    // boss : 3 objets dont 1 Rare minimum (arène : Épique minimum)
    out.loot.push(
      rollLoot(rng, lootLevel, biomeIndex, kind === 'arena' ? 3 : 2),
      rollLoot(rng, lootLevel, biomeIndex),
      rollLoot(rng, lootLevel, biomeIndex),
    );
  }
  for (const it of out.loot) s.items[it.uid] = it;
  // occasion de capture
  const shiny = enemies.find((e) => e.mon.shiny && !e.boss);
  if (kind === 'boss') {
    const b = enemies[0].mon;
    out.capture = { speciesId: b.speciesId, level: b.level, shiny: b.shiny, rare: false, guaranteed: true };
  } else if (kind === 'stage' && (shiny || rng.int(100) < CAPTURE_OFFER_CHANCE)) {
    const e = shiny ?? enemies[rng.int(enemies.length)];
    out.capture = { speciesId: e.mon.speciesId, level: e.mon.level, shiny: e.mon.shiny, rare: isRareInZone(zone, e.mon.speciesId, s.bossesBeaten[biomeIndex][zoneIndex]), guaranteed: e.mon.shiny };
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
      if (BIOMES[biome].arena.grantsBadge !== false) s.badges++;
      // Kanto -> Johto : ne pas enchaîner automatiquement, le joueur doit d'abord choisir le prestige
      // (voir startPrestige) — Johto reste une surprise tant qu'il ne l'a pas lancé.
      if (biome + 1 < BIOMES.length && biome + 1 !== PRESTIGE_BIOME) {
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

/** Une zone est « intégralement farmée » quand son boss est vaincu et que tous ses sauvages ont été
 * capturés en normal ET en chromatique (farmer une zone déjà finie n'apporte plus rien de nouveau). */
function zoneFullyFarmed(s: GameState, biome: number, zone: number): boolean {
  const ids = BIOMES[biome].zones[zone].pool.map(([id]) => id);
  return s.bossesBeaten[biome][zone] && ids.every((id) => s.dex.caught.includes(id) && s.dex.shiny.includes(id));
}

/**
 * Zone à utiliser pour le farm hors ligne (`idle.ts`) : avance automatiquement d'une zone déjà
 * intégralement farmée vers la suivante, tant qu'elle est déjà débloquée (ex. le joueur farme une
 * ancienne zone pour ses chromatiques/gènes, puis passe à la suivante une fois celle-ci vidée de tout
 * intérêt) — ne touche jamais à une zone non débloquée.
 */
export function idleFarmTarget(s: GameState): { biome: number; zone: number } {
  let biome = s.biome;
  let zone = s.zone;
  for (let i = 0; i < BIOMES.length * STAGES_PER_ZONE; i++) {
    if (!zoneFullyFarmed(s, biome, zone)) break;
    let nb = biome;
    let nz = zone + 1;
    if (nz >= BIOMES[biome].zones.length) { nb = biome + 1; nz = 0; }
    if (nb >= BIOMES.length || !s.unlocked[nb]?.[nz]) break;
    biome = nb; zone = nz;
  }
  return { biome, zone };
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

/**
 * Plancher de gènes garanti par badge (`s.badges` ne redescend jamais, même en repartant farmer un
 * biome antérieur) : dès 4 badges, capture au moins 2★ (qualité ≥ 50 %, gènes ≥ 8/15 chacun, jusqu'à
 * 4★ toujours possible par chance) ; dès 8 badges, au moins 3★ (gènes ≥ 12/15 chacun). Récompense la
 * progression sans jamais retirer la rareté du 4★ parfait (15/15/15/15 reste un coup de chance, pas
 * un plancher).
 */
export function genesMinForBadges(badges: number): number {
  if (badges >= 8) return 12;
  if (badges >= 4) return 8;
  return 0;
}

export function tryCapture(s: GameState, offer: CaptureOffer, ball: BallKind | null, rng: Rng): Mon | null {
  if (!offer.guaranteed) {
    if (!ball || s.balls[ball] <= 0) return null;
    s.balls[ball]--;
    if (rng.int(100) >= captureChance(offer, ball)) return null;
  }
  const mon = makeMon(offer.speciesId, captureLevel(s, offer), rng, offer.shiny, genesMinForBadges(s.badges));
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

/**
 * Récolte l'XP accumulée (plafond 8 h) de chaque Pokémon en pension, à l'ancien taux (celui qui courait
 * réellement pendant la période écoulée) — puis rafraîchit `xpPerHour` de tous les postes à `freshRate`
 * (calculé par l'appelant via `teamXpPerHour(s, rng) * PENSION_XP_SHARE`, voir `PensionPanel`) pour la
 * période suivante : le taux suit ainsi la progression de l'équipe sans qu'il faille retirer/reposter le
 * Pokémon à la main pour le rafraîchir.
 */
export function harvestPension(s: GameState, freshRate: number, now = Date.now()): PensionHarvest {
  const gains: PensionHarvest['gains'] = [];
  for (const p of s.pension) {
    const mon = s.mons[p.uid];
    const elapsed = Math.min(now - p.since, PENSION_CAP_MS);
    const xp = Math.floor((elapsed / 3600_000) * p.xpPerHour);
    p.since = now;
    p.xpPerHour = Math.max(0, freshRate);
    if (!mon || elapsed <= 0 || xp <= 0) continue;
    const r = giveXp(mon, xp);
    gains.push({ uid: p.uid, xp, levels: r.levels, newMoves: r.newMoves });
  }
  return { gains };
}

// ---------------------------------------------------------------- exploration (farm d'éclats)
export function explorationSlots(s: GameState) {
  return 3 + s.badges;
}

export function assignExploration(s: GameState, uid: string, now = Date.now()): boolean {
  if (s.team.includes(uid) || !s.mons[uid] || s.pension.some((p) => p.uid === uid)) return false;
  if (s.exploration.some((p) => p.uid === uid)) return true;
  if (s.exploration.length >= explorationSlots(s)) return false;
  s.exploration.push({ uid, since: now });
  return true;
}

export function removeExploration(s: GameState, uid: string) {
  s.exploration = s.exploration.filter((p) => p.uid !== uid);
}

/** Éclats prêts à récolter (`SHARDS_PER_MIN`/min et par Pokémon posté, plafond 8 h d'accumulation). */
export function explorationReady(s: GameState, now = Date.now()): number {
  return s.exploration.reduce((a, p) => a + Math.floor(Math.min(now - p.since, PENSION_CAP_MS) / EXPLORATION_CYCLE_MS) * SHARDS_PER_MIN, 0);
}

/** Récolte les éclats prêts de tous les postes (plafond 8 h d'accumulation par poste). */
export function harvestExploration(s: GameState, now = Date.now()): number {
  let shards = 0;
  for (const p of s.exploration) {
    const elapsed = Math.min(now - p.since, PENSION_CAP_MS);
    const cycles = Math.floor(elapsed / EXPLORATION_CYCLE_MS);
    if (!cycles) continue;
    p.since = now - (elapsed >= PENSION_CAP_MS ? 0 : elapsed - cycles * EXPLORATION_CYCLE_MS);
    shards += cycles * SHARDS_PER_MIN;
  }
  s.shards += shards;
  return shards;
}

export { newUid };
