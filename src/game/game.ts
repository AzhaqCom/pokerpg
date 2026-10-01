/**
 * État de la partie (sérialisable) et règles de progression :
 * équipe, étapes/vagues, butin, capture, évolutions, pension.
 */
import { Battle, FighterInit, MAX_BATTLE_TIME } from './battle';
import { bestMoves, cadence, duelMult, kitContext, kitTypeShare } from './optimize';
import {
  BADGE_BONUS, BIOMES, REGIONS, REGION_START, STAGES_PER_ZONE, WAVES_PER_STAGE, ZoneDef, regionLastBiome, regionOf,
} from './content';
import { ALL_SPECIES, EVOLUTION_CHOICES, PType, learnedMoves, evolutionTargets, move, movesAtLevel, preEvolution, species } from './data';
import { BIOME_SET, convertFlatSub, SUB_WORTH, subScore, MAX_ITEM_LEVEL, PLUS_SUB_STEP, SETS, addItemBonuses, berryScore, combatValue, setOfBiome, TEMPLATES, berryHeal, fuse, canFuse, itemScore, makeItem, newUid, recycleValue, rerollCost, rerollSub, rollLoot, rollRarity, slotOf, template, upgrade, upgradeCost } from './items';
import { BattleBonuses, BonusStat, Item, ItemSlot, ItemTemplate, MAX_RARITY, Mon, emptyBonuses } from './model';
import { Rng, seededRng } from './rng';
import { MAX_LEVEL, auraBonuses, combatPower, finalStats, levelFromXp, monBonuses, monStars, sumBonuses, xpForLevel } from './stats';
import { canRankUp, eligibleAffinityTypes, talentTree } from './talents';
import { primaryType } from './stats';

export const TEAM_SIZE = 3;
export const LOOT_CHANCE = 11; // % par sauvage vaincu (~1 objet / 45 s)
export const CAPTURE_OFFER_CHANCE = 35; // % après une vague gagnée
export const SHINY_ODDS = 256;
/** Charme Chroma : chromatiques 2 fois plus fréquents une fois le Pokédex de la région complet. */
export const SHINY_ODDS_CHARM = 128;

/**
 * Charme Chroma : obtenu en capturant toutes les espèces du Pokédex de la région en cours. Le Pokédex repart à zéro au
 * prestige, donc le charme se perd en changeant de région et se regagne en complétant le suivant (rien à stocker).
 */
/** Fin de l'aventure : Champion de la dernière région battu (plus de région suivante), écran de fin pas encore montré. */
export function endingReady(s: GameState): boolean {
  return s.prestige >= REGIONS.length - 1 && !!s.arenaBeaten[regionLastBiome(s.prestige)] && !s.endingSeen;
}

export function hasShinyCharm(s: GameState): boolean {
  const dexMax = regionOf(s.prestige).dexMax;
  return s.dex.caught.filter((id) => id <= dexMax).length >= dexMax;
}

/** Chance d'un chromatique (1 sur N) pour la partie en cours. */
/**
 * `boostMult` : effet du Mini Charme Chroma de la boutique (×1,5 s'il est actif ; hors ligne, moyenne sur la part de
 * l'absence qu'il couvre). Se cumule avec le Charme Chroma : 1/256 → 1/171, 1/128 → 1/85.
 */
export function shinyOdds(s: GameState, boostMult = boostActive(s, 'charm') ? BOOSTS.charm.mult : 1): number {
  return Math.round((hasShinyCharm(s) ? SHINY_ODDS_CHARM : SHINY_ODDS) / boostMult);
}
export const BALLS = {
  poke: { name: 'Poké Ball', chance: 30 },
  super: { name: 'Super Ball', chance: 55 },
  hyper: { name: 'Hyper Ball', chance: 80 },
} as const;
export type BallKind = keyof typeof BALLS;
/** Poké Balls de départ (nouvelle partie et début de chaque région) : de quoi former une équipe de 3 sans idle. */
export const START_BALLS = 25;
/** Tant que l'équipe n'a pas ses 3 membres, la Poké Ball vaut au moins ce taux (%). */
export const EARLY_POKE_CHANCE = 50;
/** Échecs de capture consécutifs après lesquels la suivante est garantie. */
export const CAPTURE_PITY = 3;
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
  /** Échecs de capture consécutifs (pitié : voir `CAPTURE_PITY`). */
  missStreak: number;
  lastFreeBallsDay: number;
  /** biome courant (0..BIOMES.length-1), zone courante (0..2) et étape courante (1..5) */
  biome: number;
  zone: number;
  stage: number;
  /**
   * Réglage « Avancer dans les étapes » désactivé : étape plafond où l'équipe reste farmer (au premier plan
   * comme hors ligne). Après un K.O. elle recule d'une étape puis regrimpe jusqu'à elle, jamais au-delà ;
   * suit la zone en cours (plafonnée à ses étapes débloquées). `null` = avance automatique (défaut).
   */
  fixedStage: number | null;
  /**
   * Lignées ciblées (base de lignée, voir `lineBase`) : toute offre de capture d'un membre de la lignée est
   * capturée automatiquement, même déjà possédé, en combat comme hors ligne (farm de bonbons).
   */
  targets: number[];
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
  /** Index de la région en cours dans `REGIONS` (0 = Kanto, 1 = Johto…), +1 à chaque `startPrestige`. */
  prestige: number;
  /** Horodatage (ms) du tout début de la partie — sert au récap affiché avant le prestige. */
  startedAt: number;
  /** Récap de fin de région déjà montré et reporté (« Plus tard ») : le prestige se lance ensuite depuis la Carte. */
  prestigeOffered: boolean;
  /** Horodatage (ms) du tout premier départ (jamais remis à zéro au prestige) : temps total de l'aventure. */
  adventureStart: number;
  /** Écran de fin (« Maître Pokémon », Champion de la dernière région) déjà montré. */
  endingSeen: boolean;
  /** Fenêtre « Charme Chroma obtenu » déjà fermée par le joueur dans la région en cours (remis à `false` au prestige). */
  shinyCharmSeen: boolean;
  /** Boutique : fin (horodatage ms) de chaque bonus temporaire acheté, 0 = inactif (voir `BOOSTS`). */
  boosts: Record<BoostKind, number>;
  /** Méga bonbons universels (boutique) : utilisables sur n'importe quelle lignée, conservés au prestige. */
  universalMega: number;
  /** Tour de Combat (fin de jeu) : plus haut étage franchi (record). */
  towerBest: number;
  /** Étage de la Tour en cours de combat, `null` hors de la Tour (on farme alors la zone en cours). */
  towerFloor: number | null;
  /** Chromatiques +N gagnés tous les 10 étages, à choisir (objet au choix) depuis la Carte. */
  towerRewards: TowerReward[];
  /** Hors ligne, s'entraîner dans la Tour plutôt que farmer la zone (fin de jeu, activé par défaut). */
  towerIdle: boolean;
  /** Étage de l'entraînement hors ligne, `null` = dernier palier de 10 franchi (`towerIdleFloor`). */
  towerIdlePick: number | null;
  /** Combat continu dans la Tour (jeu actif) : une défaite fait reprendre plus bas au lieu de sortir (`towerRetryFloor`). */
  towerAuto: boolean;
  /** Version d'équilibrage des objets déjà convertie (2 = poids mesurés du 2026-09-24, voir `migrateSave`). */
  balanceVersion: number;
}

export function newGame(): GameState {
  return {
    version: 1, starterChosen: false, mons: {}, team: [], pension: [], exploration: [], items: {},
    shards: 0, balls: { poke: START_BALLS, super: 0, hyper: 0 }, lastFreeBallsDay: 0, missStreak: 0,
    biome: 0, zone: 0, stage: 1, fixedStage: null, targets: [],
    unlocked: BIOMES.map((b, i) => b.zones.map((_, j) => (i === 0 && j === 0 ? 1 : 0))),
    bossesBeaten: BIOMES.map((b) => b.zones.map(() => false)),
    arenaBeaten: BIOMES.map(() => false),
    badges: 0,
    dex: { seen: [], caught: [], shiny: [] }, candies: {}, megaCandies: {},
    totals: { kills: 0, captures: 0, fusions: 0, stagesCleared: 0 },
    lastActive: Date.now(),
    prestige: 0,
    startedAt: Date.now(), prestigeOffered: false, adventureStart: Date.now(), endingSeen: false,
    shinyCharmSeen: false, boosts: noBoosts(), universalMega: 0,
    towerBest: 0, towerFloor: null, towerRewards: [], towerIdle: true, towerIdlePick: null, towerAuto: false, balanceVersion: 3,
  };
}

/**
 * Peut-on lancer le « nouveau départ » vers la région suivante ? Il faut qu'elle existe, que le Champion
 * de la région en cours soit battu (arène de son dernier biome) et que toutes ses espèces aient été vues.
 */
export function canPrestige(s: GameState): boolean {
  const next = REGIONS[s.prestige + 1];
  if (!next) return false;
  const dexMax = regionOf(s.prestige).dexMax;
  return !!s.arenaBeaten[regionLastBiome(s.prestige)] && s.dex.seen.filter((id) => id <= dexMax).length >= dexMax;
}

/**
 * « Nouveau départ » (prestige) : équipe/boîte/objets/éclats/Balls/badges/Pokédex repartent à zéro,
 * nouveau starter à choisir parmi ceux de la région suivante (via le même écran que le tout premier
 * départ). La progression de zone des régions précédentes (unlocked/bossesBeaten/arenaBeaten), les
 * bonbons/méga bonbons et les totaux sont conservés.
 */
export function startPrestige(s: GameState): boolean {
  if (!canPrestige(s)) return false;
  const start = REGIONS[s.prestige + 1].start;
  s.mons = {}; s.team = []; s.pension = []; s.exploration = [];
  s.items = {}; s.shards = 0; s.balls = { poke: START_BALLS, super: 0, hyper: 0 };
  s.badges = 0;
  s.startedAt = Date.now(); // le récap de prestige compte le temps passé dans la région qui vient de finir
  s.dex = { seen: [], caught: [], shiny: [] };
  s.biome = start; s.zone = 0; s.stage = 1;
  s.unlocked[start][0] = Math.max(1, s.unlocked[start][0]); // sinon la 1re zone de la région reste verrouillée
  s.starterChosen = false;
  s.prestige++;
  s.prestigeOffered = false; // le récap de la région suivante s'affichera à son tour
  s.shinyCharmSeen = false; // le charme se perd avec le Pokédex : il sera réannoncé en complétant le suivant
  s.boosts = noBoosts(); // bonus de la boutique perdus comme les éclats (les méga bonbons universels restent)
  return true;
}

/** Charme Chroma obtenu mais pas encore annoncé : fenêtre à afficher (le joueur doit la fermer lui-même). */
export function shinyCharmToAnnounce(s: GameState): boolean {
  return !s.shinyCharmSeen && hasShinyCharm(s);
}

/** « Plus tard » sur le récap de fin de région : on reste farmer, le prestige reste disponible depuis la Carte. */
export function postponePrestige(s: GameState) {
  s.prestigeOffered = true;
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
  // Avant le verrou 🔒 : les 4★ déjà possédés sont verrouillés une fois (`locked` absent = jamais décidé).
  if (raw.mons && typeof raw.mons === 'object') {
    for (const mon of Object.values(raw.mons as Record<string, Mon>)) {
      if (!mon.talentTypeChoices) mon.talentTypeChoices = {};
      if (mon.locked === undefined && mon.genes && monStars(mon) === 4) mon.locked = true;
    }
  }
  // Filet de sécurité : une équipe qui référence un Pokémon relâché/supprimé (uid fantôme, jamais
  // nettoyé par un bug passé) fait croire l'équipe pleine alors qu'elle affiche moins de 3 membres —
  // « Ajouter à l'équipe » propose alors de remplacer au lieu d'ajouter. Retiré au chargement.
  if (Array.isArray(raw.team) && raw.mons && typeof raw.mons === 'object') {
    const mons = raw.mons as Record<string, unknown>;
    raw.team = (raw.team as string[]).filter((u, i, arr) => mons[u] && arr.indexOf(u) === i);
  }
  // `lineBase` ne cherchait les pré-évolutions que parmi les 151 de Kanto : les lignées Johto avaient un
  // stock de bonbons par stade (ex. Macronium à part de Germignon). Regroupe tout sur la vraie base.
  for (const key of ['candies', 'megaCandies'] as const) {
    const stock = raw[key] as Record<string, number> | undefined;
    if (!stock || typeof stock !== 'object') continue;
    for (const id of Object.keys(stock)) {
      const base = String(lineBase(Number(id)));
      if (base === id) continue;
      stock[base] = (stock[base] ?? 0) + stock[id];
      delete stock[id];
    }
  }
  // bug du 2026-09-30 : une offre de capture restée à l'écran après « Nouvelle partie » a fait capturer Arceus à
  // Kanto. Le Pokédex ne garde que les espèces de la région en cours (le Pokémon lui-même, s'il reste, n'est pas touché).
  if (raw.dex && typeof raw.dex === 'object') {
    const dexMax = regionOf(typeof raw.prestige === 'number' ? raw.prestige : 0).dexMax;
    const dex = raw.dex as Record<string, number[]>;
    for (const k of ['seen', 'caught', 'shiny']) if (Array.isArray(dex[k])) dex[k] = dex[k].filter((id) => id <= dexMax);
  }
  // même regroupement pour les cibles (2026-09-25 : les formes à choix rejoignent leur lignée, Voltali → Évoli)
  if (Array.isArray(raw.targets)) raw.targets = [...new Set((raw.targets as number[]).map((id) => lineBase(id)))];
  // objets d'avant le recalage sur les poids mesurés (2026-09-24) : les sous-stats tirées gardaient l'ancienne échelle
  // (`SUB_BASE`) ; la stat principale, elle, est recalculée depuis le modèle d'objet et n'a rien à convertir.
  if ((raw.balanceVersion as number | undefined ?? 1) < 2 && raw.items && typeof raw.items === 'object') {
    const SCALE: Record<string, number> = {
      atkPct: 1, defPct: 0.762, hpPct: 0.66, spePct: 5.71, critPct: 3.7, critDmgPct: 1.667, typeDmgPct: 1.25, cdrPct: 6.67,
    };
    for (const it of Object.values(raw.items as Record<string, { subs?: { stat: string; value: number }[] }>)) {
      for (const sub of it.subs ?? []) sub.value = Math.round(sub.value * (SCALE[sub.stat] ?? 1) * 10) / 10;
    }
  }
  // Vitesse = cadence, Recharge sans plafond (2026-10-01) : les sous-stats Vitesse / Recharge déjà tirées passent à la
  // nouvelle échelle (sans le niveau) ; les objets mixtes (Nageoire, Semelle, Plume, Voiles) sont recalculés d'office
  // depuis leur modèle (stat principale + bonus fixe), rien à convertir
  if ((raw.balanceVersion as number | undefined ?? 1) < 3 && raw.items && typeof raw.items === 'object') {
    for (const it of Object.values(raw.items as Record<string, { level?: number; plus?: number; subs?: { stat: BonusStat; value: number }[] }>)) {
      for (const sub of it.subs ?? []) sub.value = convertFlatSub(sub.stat, sub.value, it.level ?? 1, it.plus ?? 0);
    }
  }
  // début de l'aventure : les anciennes sauvegardes n'ont que le début de la région en cours
  if (typeof raw.adventureStart !== 'number') raw.adventureStart = typeof raw.startedAt === 'number' ? raw.startedAt : Date.now();
  raw.balanceVersion = 3;
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
  const setKey = setOfBiome(firstBiome);
  const templates = setKey ? TEMPLATES.filter((t) => t.set === setKey).map((t) => t.id) : [];
  return templates.length ? templates : ['griffe-sylve', 'cape-sylve', 'baie-sylve'];
}

export function chooseStarter(s: GameState, speciesId: number, rng: Rng) {
  const mon = makeMon(speciesId, 5, rng, false, 12); // gènes ≥ 12 : le starter est toujours au moins 3★
  addMon(s, mon);
  s.team = [mon.uid];
  s.starterChosen = true;
  for (const templateId of starterItems(s)) {
    const item = makeItem(templateId, 0, 5, rng, REGION_START[s.prestige] ?? 0);
    s.items[item.uid] = item;
    equip(s, mon.uid, item.uid);
  }
}

export function addMon(s: GameState, mon: Mon) {
  if (mon.locked === undefined && monStars(mon) === 4) mon.locked = true; // 4★ : verrouillé d'office
  s.mons[mon.uid] = mon;
  addUnique(s.dex.seen, mon.speciesId);
  addUnique(s.dex.caught, mon.speciesId);
  if (mon.shiny) addUnique(s.dex.shiny, mon.speciesId);
  if (s.team.length < TEAM_SIZE && !s.team.includes(mon.uid)) s.team.push(mon.uid);
}

/**
 * Base de la lignée (bonbons, méga bonbons, cibles, doublons), **toutes branches comprises** : Voltali, Pyroli…
 * ont la même base qu'Aquali (Évoli), Gallame la même que Gardevoir (Tarsal). Avant le 2026-09-25, seule la forme
 * par défaut (`evolvesTo`) était suivie : les formes alternatives formaient des lignées à part.
 */
export function lineBase(speciesId: number): number {
  let base = speciesId;
  for (let g = 0; g < 5; g++) {
    const prev = preEvolution(base);
    if (!prev) break;
    base = prev;
  }
  return base;
}

/** Toutes les formes d'une lignée depuis sa base (toutes branches), limitées au Pokédex de la région (`maxId`). */
export function lineForms(base: number, maxId = Infinity): number[] {
  const out: number[] = [];
  const queue = [base];
  for (let i = 0; i < queue.length && i < 20; i++) {
    const id = queue[i];
    if (id <= maxId) out.push(id);
    const next = EVOLUTION_CHOICES[id] ?? (species(id).evolvesTo ? [species(id).evolvesTo] : []);
    for (const t of next) if (!queue.includes(t)) queue.push(t);
  }
  return out;
}

/** `ancestor` est-il une pré-évolution (directe ou non) de `id` ? */
export function isAncestor(ancestor: number, id: number): boolean {
  for (let p = preEvolution(id), g = 0; p && g < 5; p = preEvolution(p), g++) if (p === ancestor) return true;
  return false;
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

/** `dexMax` : Pokédex de la région en cours — une évolution vers une espèce pas encore disponible est bloquée. */
export function canEvolve(mon: Mon, dexMax = Infinity): boolean {
  const sp = species(mon.speciesId);
  return !!sp.evolvesTo && mon.level >= sp.evolveLevel && evolutionTargets(mon.speciesId, dexMax).length > 0;
}

/** `target` : forme choisie parmi `evolutionTargets` (défaut = `evolvesTo`, l'évolution classique). */
export function evolve(s: GameState, uid: string, target?: number) {
  const mon = s.mons[uid];
  const dexMax = regionOf(s.prestige).dexMax;
  if (!mon || !canEvolve(mon, dexMax)) return;
  const typeBefore = primaryType(mon.speciesId);
  const targets = evolutionTargets(mon.speciesId, dexMax);
  mon.speciesId = target !== undefined && targets.includes(target) ? target : targets[0];
  addUnique(s.dex.seen, mon.speciesId);
  addUnique(s.dex.caught, mon.speciesId);
  if (mon.shiny) addUnique(s.dex.shiny, mon.speciesId);
  // arbre de talents différent si le type principal change : les points sont rendus, Affinités comprises (avant le
  // 2026-10-01, Évoli → Givrali gardait ses Affinités Normal, et même « ★ Auto » ne pouvait plus les changer)
  if (primaryType(mon.speciesId) !== typeBefore) { mon.talents = {}; mon.talentTypeChoices = {}; }
}

export function setMoves(s: GameState, uid: string, moves: number[]) {
  const mon = s.mons[uid];
  const allowed = learnedMoves(species(mon.speciesId), mon.level);
  mon.moves = moves.filter((m, i) => allowed.includes(m) && moves.indexOf(m) === i).slice(0, 4);
}

/**
 * « ★ Auto » des capacités : le kit qui inflige le plus de dégâts par seconde à ce Pokémon, avec ses vraies stats
 * (Vitesse : cadence et recharges, Recharge, bonus de type et Affinités), voir `bestMoves` (optimize.ts).
 * Différent du kit d'une capture (`movesAtLevel`, jugé à la seule puissance) : mesuré en Tour, ~+12 points de victoire
 * en moyenne et jusqu'à +30 (Noctali, Métalosse, Scorvol). Renvoie `false` si le kit est déjà celui-là.
 */
export function autoMoves(s: GameState, uid: string): boolean {
  const mon = s.mons[uid];
  if (!mon) return false;
  const f = allyFighter(s, uid);
  const bonuses = f.bonuses ?? emptyBonuses();
  const best = bestMoves(mon.speciesId, mon.level, cadence(f.stats.spe, bonuses), kitContext(species(mon.speciesId).types, bonuses));
  if (best.length === mon.moves.length && best.every((id, i) => mon.moves[i] === id)) return false;
  setMoves(s, uid, best);
  return true;
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
    if (!type || !eligibleAffinityTypes(mon.speciesId).includes(type)) return false;
    if (!canRankUp(types, mon.talents, mon.level, id)) return false;
    mon.talentTypeChoices[id] = type;
    mon.talents[id] = 1;
    return true;
  }
  if (!canRankUp(types, mon.talents, mon.level, id)) return false;
  mon.talents[id] = (mon.talents[id] ?? 0) + 1;
  return true;
}

/** Ordre de dépense des points quand ils sont rares : puissance et vigueur d'abord, puis garde/réflexes (le même que le bot). */
const AUTO_TALENT_ORDER = ['power', 'vigor', 'power', 'vigor', 'power', 'guard', 'reflex', 'guard', 'reflex', 'guard', 'spec', 'mastery'];

/**
 * Dépense tous les points de talent disponibles d'un Pokémon : d'abord l'ordre ci-dessus, puis chaque talent au
 * maximum (paliers 1-3), les deux talents d'affinité (type choisi = celui de ses capacités connues le plus représenté
 * parmi les types éligibles), puis les paliers 6-9. Ne réinitialise jamais rien. Retourne le nombre de rangs ajoutés.
 */
export function autoTalents(s: GameState, uid: string): number {
  const mon = s.mons[uid];
  if (!mon) return 0;
  let n = 0;
  const up = (id: string, type?: PType) => { if (rankUpTalent(s, uid, id, type)) { n++; return true; } return false; };
  for (const id of AUTO_TALENT_ORDER) up(id);
  for (const id of ['power', 'vigor', 'guard', 'reflex', 'spec', 'mastery']) while (up(id));
  // Affinités : le type qui porte le plus de dégâts réels du kit (recharges et ordre compris, attaque de base = Normal).
  // Le gain est linéaire (bonus additif), donc les deux Affinités vont au même type. Avant le 2026-10-01 : le type le
  // plus fréquent parmi les capacités, statuts compris (Lokhlass : Normal à cause de Berceuse, au lieu de Glace).
  for (const id of ['affinity1', 'affinity2']) {
    const options = eligibleAffinityTypes(mon.speciesId);
    const chosen = mon.talentTypeChoices[id];
    let type = chosen;
    if (!chosen) {
      const f = allyFighter(s, uid);
      const bonuses = f.bonuses ?? emptyBonuses();
      const share = kitTypeShare(mon.moves, cadence(f.stats.spe, bonuses), kitContext(species(mon.speciesId).types, bonuses));
      type = [...options].sort((a, b) => (share.get(b) ?? 0) - (share.get(a) ?? 0))[0];
    }
    while (up(id, type));
  }
  for (const id of ['spec2', 'spec3', 'fury', 'deadly']) while (up(id));
  return n;
}

export function resetTalents(s: GameState, uid: string): boolean {
  const cost = 50;
  if (s.shards < cost) return false;
  s.shards -= cost;
  s.mons[uid].talents = {};
  s.mons[uid].talentTypeChoices = {};
  return true;
}

/** Bonbons de la lignée obtenus en relâchant un Pokémon. */
export const RELEASE_CANDIES = 3;

/** Relâche une liste de Pokémon (doublons de l'objectif « boîte ») : 3 bonbons chacun, jamais le dernier de l'équipe. */
export function releaseList(s: GameState, uids: string[]): { count: number; candies: number } {
  let count = 0;
  for (const u of uids) if (release(s, u)) count++;
  return { count, candies: count * RELEASE_CANDIES };
}

/** Relâcher : 3 bonbons de la lignée. Impossible pour le dernier Pokémon de l'équipe. */
export function release(s: GameState, uid: string): boolean {
  if (s.team.length === 1 && s.team[0] === uid) return false;
  const mon = s.mons[uid];
  if (!mon || mon.locked) return false;
  for (const slot of Object.keys(mon.items) as ItemSlot[]) delete mon.items[slot];
  const base = lineBase(mon.speciesId);
  s.candies[base] = (s.candies[base] ?? 0) + RELEASE_CANDIES;
  s.team = s.team.filter((u) => u !== uid);
  s.pension = s.pension.filter((p) => p.uid !== uid);
  removeExploration(s, uid); // ses éclats prêts sont encaissés (l'XP de pension, elle, part avec lui)
  delete s.mons[uid];
  return true;
}

/**
 * Étages d'une lignée depuis sa base, limités au Pokédex de la région (`maxId`) : un bébé d'une génération
 * suivante (Pichu en Kanto) est sauté, mais la lignée continue derrière lui (Pikachu, Raichu).
 */
export function lineChain(base: number, maxId = Infinity): number[] {
  const chain: number[] = [];
  for (let id = base, g = 0; id && g < 5; id = species(id).evolvesTo || 0, g++) if (id <= maxId) chain.push(id);
  return chain;
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
const geneTotal = (m: Mon) => m.genes.hp + m.genes.atk + m.genes.def + m.genes.spe;

/**
 * Meilleur d'abord : total des gènes (sur 60, définitif hors méga bonbons ; inclut les étoiles, qui en découlent),
 * puis PC (le niveau se regagne, les gènes non). Même règle pour « Nettoyer les doublons » (`excessMons`) et pour
 * l'objectif de collection « boîte » (`collection.ts`).
 */
export function byQuality(a: Mon, b: Mon): number {
  return geneTotal(b) - geneTotal(a) || combatPower(finalStats(b, emptyBonuses())) - combatPower(finalStats(a, emptyBonuses()));
}

export function excessMons(s: GameState, opts: { keepEvolutionMaterial?: boolean } = {}): Mon[] {
  const keepEvolutionMaterial = opts.keepEvolutionMaterial ?? true;
  const out: Mon[] = [];
  const isProtected = (m: Mon) => !!m.locked || s.pension.some((p) => p.uid === m.uid) || s.exploration.some((p) => p.uid === m.uid);
  const bases = new Set<number>();
  for (const m of Object.values(s.mons)) bases.add(lineBase(m.speciesId));
  for (const base of bases) {
    const chain = lineForms(base, regionOf(s.prestige).dexMax);
    for (const shiny of [false, true]) {
      const all = Object.values(s.mons).filter((m) => m.shiny === shiny && chain.includes(m.speciesId));
      if (!all.length) continue;
      const cnt = new Map<number, number>();
      for (const m of all) cnt.set(m.speciesId, (cnt.get(m.speciesId) ?? 0) + 1);
      // 1 exemplaire protégé par étage déjà possédé : un porteur équipe/pension/exploration en priorité
      // (de toute façon irrécupérable ici), sinon le meilleur de la boîte à cet étage (étoiles puis PC) ;
      // et toujours, en plus, le meilleur en étoiles s'il fait mieux que ce porteur (un 4★ Nv.20 en boîte
      // ne part jamais parce qu'un 2★ Nv.60 est en équipe).
      const protectedUids = new Set<string>();
      for (const stage of chain) {
        if (!(cnt.get(stage) ?? 0)) continue;
        const atStage = [...all.filter((m) => m.speciesId === stage)].sort(byQuality);
        const held = atStage.find((m) => s.team.includes(m.uid) || s.pension.some((p) => p.uid === m.uid) || s.exploration.some((p) => p.uid === m.uid));
        if (held) protectedUids.add(held.uid);
        if (!held || geneTotal(atStage[0]) > geneTotal(held)) protectedUids.add(atStage[0].uid);
      }
      const freeSpares = all
        .filter((m) => !protectedUids.has(m.uid) && !s.team.includes(m.uid) && !isProtected(m))
        .sort(byQuality);
      // mode collectionneur : 1 réserve par forme manquante, choisie parmi SES pré-évolutions (un Florizarre ne peut
      // pas devenir Herbizarre ; un Évoli par évolution d'Évoli manquante), la meilleure en gènes
      if (keepEvolutionMaterial) {
        for (const stage of chain) {
          if (cnt.get(stage) ?? 0) continue;
          const i = freeSpares.findIndex((m) => isAncestor(m.speciesId, stage));
          if (i >= 0) freeSpares.splice(i, 1);
        }
      }
      out.push(...freeSpares);
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
  return boxMons(s).filter((m) => !m.locked && monStars(m) < minStars);
}

/** Relâche tous les Pokémon de la boîte sous `minStars` étoiles (ex. « ne garder que les 3★+ »). */
export function releaseBelowStars(s: GameState, minStars: number): { count: number; candies: number } {
  const targets = monsBelowStars(s, minStars);
  for (const m of targets) release(s, m.uid);
  return { count: targets.length, candies: targets.length * 3 };
}

/** Pokémon normaux (non chromatiques) de la boîte (jamais l'équipe/pension/exploration). */
export function monsNotShiny(s: GameState): Mon[] {
  return boxMons(s).filter((m) => !m.locked && !m.shiny);
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
    id = sp.evolvesTo; // une cible hors région n'est jamais une étape manquante (`lineChain`), sans effet ici
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
export function completeDex(s: GameState, dryRun = false, opts: { keepEvolutionMaterial?: boolean } = {}): number {
  const keep = opts.keepEvolutionMaterial ?? true;
  const maxId = regionOf(s.prestige).dexMax;
  const bases = new Set<number>();
  for (let id = 1; id <= maxId; id++) bases.add(lineBase(id));
  let count = 0;
  for (const base of bases) {
    const chain = lineChain(base, maxId);
    if (chain.length < 2) continue;
    for (const shiny of [false, true]) {
      const all = Object.values(s.mons).filter((m) => m.shiny === shiny && chain.includes(m.speciesId));
      const cnt = new Map<number, number>();
      for (const m of all) cnt.set(m.speciesId, (cnt.get(m.speciesId) ?? 0) + 1);
      // 1 exemplaire protégé par étage déjà possédé (équipe/pension/exploration prioritaires)
      const protectedUids = new Set<string>();
      for (const stage of chain) {
        if (!keep || !(cnt.get(stage) ?? 0)) continue;
        const atStage = [...all.filter((m) => m.speciesId === stage)].sort(byQuality);
        const held = atStage.find((m) => s.team.includes(m.uid) || s.pension.some((p) => p.uid === m.uid) || s.exploration.some((p) => p.uid === m.uid));
        if (held) protectedUids.add(held.uid);
        if (!held || geneTotal(atStage[0]) > geneTotal(held)) protectedUids.add(atStage[0].uid);
      }
      // on fait évoluer en priorité les exemplaires les plus faibles (jamais un verrouillé 🔒)
      const freeSpares = all
        .filter((m) => !m.locked && !protectedUids.has(m.uid) && !s.team.includes(m.uid)
          && !s.pension.some((p) => p.uid === m.uid) && !s.exploration.some((p) => p.uid === m.uid))
        .sort((a, b) => chain.indexOf(a.speciesId) - chain.indexOf(b.speciesId) || -byQuality(a, b));
      // mode collectionneur : un étage manque s'il n'est plus possédé ; mode léger : s'il n'est pas dans le Pokédex
      const seen = shiny ? s.dex.shiny : s.dex.caught;
      const missing = chain.filter((stage) => (keep ? !(cnt.get(stage) ?? 0) : !seen.includes(stage)));
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
export function canCompleteDex(s: GameState, opts: { keepEvolutionMaterial?: boolean } = {}): boolean {
  return completeDex(s, true, opts) > 0;
}

export function feedCandy(s: GameState, uid: string, n = 1) {
  const mon = s.mons[uid];
  if (!mon || mon.level >= MAX_LEVEL) return null; // au niveau maximum, le bonbon serait consommé pour rien
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

/**
 * Consomme 1 méga bonbon pour +1 à un gène (plafond 15) : seule façon d'améliorer des gènes. Celui de la lignée
 * d'abord, sinon un méga bonbon universel (boutique).
 */
export function applyMegaCandy(s: GameState, uid: string, gene: GeneKey): boolean {
  const mon = s.mons[uid];
  if (!mon) return false;
  const base = lineBase(mon.speciesId);
  const have = s.megaCandies[base] ?? 0;
  if ((have < 1 && !(s.universalMega > 0)) || mon.genes[gene] >= GENE_MAX) return false;
  if (have > 0) s.megaCandies[base] = have - 1;
  else s.universalMega--;
  mon.genes[gene]++;
  if (monStars(mon) === 4) mon.locked = true; // devenu parfait : verrouillé d'office
  return true;
}

/** Verrouiller 🔒 / déverrouiller un Pokémon (voir `Mon.locked`). */
export function toggleLock(s: GameState, uid: string) {
  const mon = s.mons[uid];
  if (mon) mon.locked = !mon.locked;
}

export function setTeam(s: GameState, uids: string[]) {
  const t = uids.filter((u, i) => s.mons[u] && uids.indexOf(u) === i).slice(0, TEAM_SIZE);
  if (!t.length) return;
  s.team = t;
  // un Pokémon qui quitte la pension / l'exploration pour l'équipe encaisse d'abord ce qu'il a accumulé
  for (const u of t) {
    if (s.pension.some((p) => p.uid === u)) removePension(s, u);
    if (s.exploration.some((p) => p.uid === u)) removeExploration(s, u);
  }
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

/** Bonus d'un Pokémon hors objets (talents, auras de l'équipe, badges) : contexte pour évaluer un équipement. */
export function monBaseBonuses(s: GameState, uid: string): BattleBonuses {
  const mon = s.mons[uid];
  const offTeam = [...s.pension, ...s.exploration].map((p) => s.mons[p.uid]?.speciesId).filter(Boolean) as number[];
  const auras = auraBonuses(s.team.map((u) => s.mons[u].speciesId), offTeam);
  return sumBonuses(monBonuses(mon, [], auras), badgeBonuses(s));
}

/**
 * Gain de valeur si `item` remplace l'objet porté dans son emplacement, pour CE Pokémon (flèche du sélecteur
 * d'objets). Positif = mieux. Sans combats (calculé pour chaque objet du sac) : le calcul que le dernier « Équiper le
 * meilleur » a retenu pour ce Pokémon (`Mon.equipModel`), sinon l'ancien (`quickEquipValue`, un peu plus juste en
 * moyenne que le duel seul, audit du 2026-10-01). Ainsi les flèches ne contredisent pas le bouton.
 */
export function equipGain(s: GameState, uid: string, item: Item): number {
  const mon = s.mons[uid];
  const held = heldItems(s, mon);
  const base = monBaseBonuses(s, uid);
  const slot = slotOf(item);
  const value = mon.equipModel === 'duel' ? equipValue : mon.equipModel === 'measured' ? measuredEquipValue : quickEquipValue;
  return value(s, uid, [...held.filter((it) => slotOf(it) !== slot), item], base) - value(s, uid, held, base);
}

/**
 * Valeur d'un équipement complet pour CE Pokémon (talents, auras, badges, kit de capacités compris) : log du
 * multiplicateur de difficulté qu'il tient en duel (`duelMult`, optimize.ts), baie de soin comprise. Sert à l'un des
 * deux candidats d'« Équiper le meilleur ».
 */
export function equipValue(s: GameState, uid: string, items: Item[], base = monBaseBonuses(s, uid)): number {
  const mon = s.mons[uid];
  const b = sumBonuses(base);
  addItemBonuses(b, items);
  const berry = items.find((it) => slotOf(it) === 'berry');
  const heal = berry && template(berry.templateId).berry?.heal ? berryHeal(berry) : 0;
  const m = duelMult({ level: mon.level, stats: finalStats(mon, b), bonuses: b, moves: mon.moves, types: species(mon.speciesId).types, berryHeal: heal });
  // en % : +1 = tient une difficulté 1 % plus haute
  return Math.log(m) * 100;
}

/**
 * Ancienne valeur d'un équipement (avant le 2026-10-01) : `combatValue` des bonus, poids fixes mesurés en début de
 * partie, + le soin de la baie. Bot des simulations (équilibrage inchangé), flèches du sélecteur d'objets, 2e candidat.
 */
export function quickEquipValue(s: GameState, uid: string, items: Item[], base = monBaseBonuses(s, uid)): number {
  const b = sumBonuses(base);
  addItemBonuses(b, items);
  const berry = items.find((it) => slotOf(it) === 'berry');
  return combatValue(b) + (berry ? berryScore(berry) / 10 : 0);
}

/**
 * Valeur d'un équipement selon les valeurs **mesurées** des stats (`SUB_WORTH`, fin de jeu) : stats principales,
 * bonus fixes, sous-stats et bonus de panoplie convertis en « jets moyens » × leur valeur, + le soin de la baie.
 * Linéaire (sans les interactions Critique × Dégâts critiques) : 3e candidat d'« Équiper le meilleur », départagé
 * par de vrais combats comme les deux autres.
 */
export function measuredEquipValue(s: GameState, uid: string, items: Item[]): number {
  const level = Math.max(1, ...items.map((it) => it.level));
  const b = emptyBonuses();
  addItemBonuses(b, items);
  let v = 0;
  for (const k of Object.keys(SUB_WORTH) as BonusStat[]) v += subScore(k, b[k], level);
  // Vol de vie et Esquive (panoplies) : comptés comme des PV, à la louche (pas de sous-stat pour les mesurer)
  v += subScore('hpPct', 3 * b.lifestealPct + 2 * b.dodgePct, level);
  const berry = items.find((it) => slotOf(it) === 'berry');
  return v + (berry ? berryScore(berry) / 10 : 0);
}

/** Nombre d'objets les mieux classés, par emplacement, combinés entre eux par `bestEquipCombo`. */
const AUTO_EQUIP_TOP = 6;
/** Pièces d'une même panoplie retenues par emplacement pour tenter les bonus de panoplie. */
const AUTO_EQUIP_SET_TOP = 2;
const EQUIP_SLOTS: ItemSlot[] = ['offense', 'defense', 'berry'];
type EquipValueFn = (s: GameState, uid: string, items: Item[], base: BattleBonuses) => number;

/**
 * La combinaison des 3 emplacements qui maximise `value` pour ce Pokémon, parmi les objets du sac et les siens (jamais
 * ceux d'un autre Pokémon). Un objet ne se juge pas seul (Critique × Dégâts critiques, Recharge plafonnée, bonus de
 * panoplie à 2 et 3 pièces) : toutes les combinaisons des `AUTO_EQUIP_TOP` meilleurs objets de chaque emplacement, plus,
 * pour chaque panoplie, 2 ou 3 de ses pièces complétées par les meilleurs objets hors panoplie (quelques milliers
 * d'évaluations, même avec un sac de milliers d'objets).
 */
export function bestEquipCombo(s: GameState, uid: string, value: EquipValueFn = equipValue): (Item | undefined)[] {
  const mon = s.mons[uid];
  const held = heldBy(s);
  const base = monBaseBonuses(s, uid);
  // classement de chaque emplacement par la valeur de l'objet seul, dans le contexte du Pokémon
  const ranked: Record<ItemSlot, Item[]> = { offense: [], defense: [], berry: [] };
  const solo = new Map<string, number>();
  for (const it of Object.values(s.items)) {
    const owner = held.get(it.uid);
    if (owner && owner !== mon) continue;
    ranked[slotOf(it)].push(it);
    // à valeur égale, l'objet déjà porté passe devant (pas d'échange inutile)
    solo.set(it.uid, value(s, uid, [it], base) + (owner === mon ? 1e-6 : 0));
  }
  for (const slot of EQUIP_SLOTS) ranked[slot].sort((a, b) => solo.get(b.uid)! - solo.get(a.uid)!);
  const top = (slot: ItemSlot): (Item | undefined)[] => (ranked[slot].length ? ranked[slot].slice(0, AUTO_EQUIP_TOP) : [undefined]);

  let best: (Item | undefined)[] = EQUIP_SLOTS.map((slot) => ranked[slot][0]);
  let bestScore = value(s, uid, best.filter((it): it is Item => !!it), base);
  const consider = (combo: (Item | undefined)[]) => {
    const sc = value(s, uid, combo.filter((it): it is Item => !!it), base);
    if (sc > bestScore) { bestScore = sc; best = combo; }
  };
  // 1. meilleurs objets de chaque emplacement, toutes combinaisons (les sous-stats interagissent entre elles)
  for (const o of top('offense')) for (const d of top('defense')) for (const b of top('berry')) consider([o, d, b]);
  // 2. panoplies : 2 ou 3 pièces du même set, l'emplacement restant pris parmi les meilleurs objets
  for (const set of Object.keys(SETS)) {
    const pieces = EQUIP_SLOTS.map((slot) => ranked[slot].filter((it) => template(it.templateId).set === set).slice(0, AUTO_EQUIP_SET_TOP));
    if (pieces.filter((p) => p.length).length < 2) continue;
    for (let free = -1; free < EQUIP_SLOTS.length; free++) { // free = emplacement hors panoplie (-1 : les 3 en panoplie)
      if (EQUIP_SLOTS.some((_, i) => i !== free && !pieces[i].length)) continue;
      const choices = EQUIP_SLOTS.map((slot, i) => (i === free ? top(slot) : pieces[i]));
      for (const o of choices[0]) for (const d of choices[1]) for (const b of choices[2]) consider([o, d, b]);
    }
  }
  // 3. finition : échanges d'un seul objet (tous les objets libres) tant que ça améliore — un objet mal classé seul
  // (Vitesse, Recharge à rendement décroissant) ne laisse ainsi jamais de flèche ▲ après « Équiper le meilleur »
  for (let improved = true, pass = 0; improved && pass < 4; pass++) {
    improved = false;
    EQUIP_SLOTS.forEach((slot, i) => {
      for (const it of ranked[slot]) {
        if (it === best[i]) continue;
        const combo = best.slice();
        combo[i] = it;
        const before = bestScore;
        consider(combo);
        if (bestScore > before + 1e-9) improved = true;
      }
    });
  }
  return best;
}

/** Banc d'essai d'« Équiper le meilleur » : vagues de référence, combats pour caler la difficulté, combats par candidat. */
const BENCH_WAVES = 240;
const BENCH_CALIBRATE_STEPS = 7;
const BENCH_CALIBRATE_WAVES = 24;
const BENCH_SEED = 20261001;

/**
 * Départage des équipements candidats par de vrais combats (moteur `Battle`), déterministes (graines fixes) : l'équipe
 * du Pokémon (lui + ses coéquipiers actuels) contre des vagues de 3 formes finales ou légendaires de son niveau, à une
 * difficulté calée pour que le 1er candidat gagne environ une fois sur deux, mêmes vagues et mêmes graines pour tous.
 * Score continu : victoire = 1 + temps restant, défaite = part des PV adverses retirés. Renvoie l'index du meilleur.
 */
function benchEquipCombos(s: GameState, uid: string, combos: (Item | undefined)[][]): number {
  const mon = s.mons[uid];
  const savedItems = { ...mon.items };
  const savedTeam = s.team;
  s.team = s.team.includes(uid) ? [...s.team] : [uid, ...s.team].slice(0, TEAM_SIZE);
  const allies = combos.map((combo) => {
    mon.items = {};
    combo.forEach((it, i) => { if (it) mon.items[EQUIP_SLOTS[i]] = it.uid; });
    return s.team.map((u) => allyFighter(s, u));
  });
  mon.items = savedItems;
  s.team = savedTeam;

  const pool = towerSpecies();
  const rng = seededRng(BENCH_SEED);
  const waves = Array.from({ length: BENCH_WAVES }, () =>
    Array.from({ length: TOWER_TEAM }, () => makeMon(pool[rng.int(pool.length)], mon.level, rng, false, GENE_MAX)));
  const run = (team: FighterInit[], mult: number, n: number) => {
    let win = 0;
    let score = 0;
    for (let i = 0; i < n; i++) {
      const foes = waves[i].map((m, j) => wildFighter(`b${j}`, m, { wild: true, wildMult: mult }));
      const b = new Battle([...team.map((f) => ({ ...f })), ...foes], seededRng(BENCH_SEED + i));
      b.runToEnd();
      if (b.result === 'win') { win++; score += 1 + 0.2 * (MAX_BATTLE_TIME - b.t) / MAX_BATTLE_TIME; }
      else {
        const left = b.fighters.filter((f) => f.side === 1);
        score += (0.2 * left.reduce((a, f) => a + (1 - f.hp / f.maxHp), 0)) / left.length;
      }
    }
    return { win: win / n, score: score / n };
  };
  let lo = Math.log(0.05);
  let hi = Math.log(5000);
  for (let k = 0; k < BENCH_CALIBRATE_STEPS; k++) {
    const mid = (lo + hi) / 2;
    if (run(allies[0], Math.exp(mid), BENCH_CALIBRATE_WAVES).win >= 0.5) lo = mid; else hi = mid;
  }
  const mult = Math.exp((lo + hi) / 2);
  let best = 0;
  let bestScore = -Infinity;
  allies.forEach((team, i) => {
    const sc = run(team, mult, BENCH_WAVES).score;
    if (sc > bestScore) { bestScore = sc; best = i; }
  });
  return best;
}

/**
 * « Équiper le meilleur ». Deux modèles de valeur se trompent chacun de 10 points de victoire ou plus sur certains
 * Pokémon (audit du 2026-10-01 : le duel valorise bien le Vol de vie et la Vitesse saturée, l'ancien `combatValue` les PV
 * en fin de jeu) : on prend la meilleure combinaison selon chacun, puis on les départage par de vrais combats
 * (`benchEquipCombos`, quelques centaines de combats, déterministe). `mode: 'quick'` = ancien calcul seul, sans
 * combats (bot des simulations). Retourne le nombre d'emplacements changés.
 */
export function autoEquipBest(s: GameState, uid: string, mode: 'bench' | 'quick' = 'bench'): number {
  const mon = s.mons[uid];
  if (!mon) return 0;
  let best: (Item | undefined)[];
  if (mode === 'quick') best = bestEquipCombo(s, uid, quickEquipValue);
  else {
    const models = ['duel', 'quick', 'measured'] as const;
    const all = [bestEquipCombo(s, uid, equipValue), bestEquipCombo(s, uid, quickEquipValue), bestEquipCombo(s, uid, measuredEquipValue)];
    // candidats distincts (l'ancien calcul d'abord : à égalité, c'est lui qui est gardé)
    const order = [1, 0, 2].filter((i, k, arr) => !arr.slice(0, k).some((j) => all[j].every((it, x) => it?.uid === all[i][x]?.uid)));
    const pick = order.length === 1 ? order[0] : order[benchEquipCombos(s, uid, order.map((i) => all[i]))];
    best = all[pick];
    // les flèches du sélecteur suivent le calcul retenu (l'ancien par défaut)
    if (models[pick] === 'quick') delete mon.equipModel; else mon.equipModel = models[pick];
  }
  let n = 0;
  EQUIP_SLOTS.forEach((slot, i) => {
    const pick = best[i];
    if (pick && pick.uid !== mon.items[slot]) { equip(s, uid, pick.uid); n++; }
  });
  return n;
}

/** Objets d'une panoplie recyclables d'un coup depuis le Sac : ni verrouillés 🔒 ni portés. */
export function setRecycleCandidates(s: GameState, setId: string): Item[] {
  const held = heldBy(s);
  return Object.values(s.items).filter((it) => template(it.templateId).set === setId && !it.locked && !held.has(it.uid));
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

/** Fin de jeu : Champion de la dernière région battu (fusion Chromatique +N, objets au-delà du Nv.100). */
export function endgameUnlocked(s: GameState): boolean {
  return s.prestige >= REGIONS.length - 1 && !!s.arenaBeaten[regionLastBiome(REGIONS.length - 1)];
}

/** Niveau maximum d'un objet : 100, sans limite en fin de jeu. */
export function itemLevelCap(s: GameState): number {
  return endgameUnlocked(s) ? Infinity : MAX_ITEM_LEVEL;
}

/**
 * PC affichés (fiche, cartes de l'équipe, boîte) : le Pokémon seul — gènes, niveau, objets, talents, badges — sans les
 * auras de l'équipe ni de la pension. Avant le 2026-10-01 elles étaient comptées : les PC d'un Pokémon changeaient
 * quand on changeait d'équipe, sans qu'il ait changé lui-même (un joueur a cru qu'un méga bonbon lui en avait fait
 * perdre). Les stats détaillées de la fiche, elles, restent celles du combat (auras comprises).
 */
export function monPower(s: GameState, uid: string): number {
  const mon = s.mons[uid];
  const bonuses = sumBonuses(monBonuses(mon, heldItems(s, mon), emptyBonuses()), badgeBonuses(s));
  return combatPower(finalStats(mon, bonuses));
}

/** Badges de la région en cours qui débloquent chaque vitesse de combat (la plus haute d'abord). */
export const SPEED_UNLOCKS: [badges: number, speed: 2 | 3][] = [[4, 3], [1, 2]];

/**
 * Vitesse de combat maximale : ×2 dès le 1er badge de la région, ×3 dès le 4e. Les badges repartent à 0 à chaque
 * Nouveau départ, donc chaque région recommence en ×1 (avant le 2026-10-01, le ×2 restait actif après un prestige
 * alors que son bouton disparaissait).
 */
export function maxBattleSpeed(s: GameState): 1 | 2 | 3 {
  return SPEED_UNLOCKS.find(([badges]) => s.badges >= badges)?.[1] ?? 1;
}

/** Cette rareté peut-elle encore fusionner ? Mythique → Chromatique : 8 badges ; Chromatique → +1 : fin de jeu. */
export function fusableRarity(s: GameState, it: Item): boolean {
  if (it.rarity >= MAX_RARITY) return endgameUnlocked(s);
  return it.rarity !== MAX_RARITY - 1 || s.badges >= CHROMATIC_BADGE_REQ;
}

/** Clé de fusion : 3 objets de même clé fusionnent (même objet, même rareté, même cran +N). */
function fuseKey(it: Item): string {
  return `${it.templateId}:${it.rarity}:${it.plus ?? 0}`;
}

export function upgradeItem(s: GameState, uid: string): boolean {
  const it = s.items[uid];
  if (!it || it.level >= itemLevelCap(s)) return false;
  const cost = upgradeCost(it);
  if (s.shards < cost) return false;
  s.shards -= cost;
  const up = upgrade(it);
  up.invested = (it.invested ?? 0) + cost; // amélioration manuelle : 50 % rendus au recyclage (`recycleRefund`)
  s.items[uid] = up;
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
  if (items.some((i) => !i) || !canFuse(items, endgameUnlocked(s)) || !fusableRarity(s, items[0])) return null;
  const wearer = uids.map((u) => holder(s, u)).find(Boolean);
  for (const u of uids) {
    const h = holder(s, u);
    if (h) delete h.items[slotOf(s.items[u])];
    delete s.items[u];
  }
  const out = fuse(items, rng, endgameUnlocked(s));
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
    if (it.locked || !fusableRarity(s, it)) continue;
    const k = fuseKey(it);
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
    if (it.locked || !fusableRarity(s, it)) continue;
    const k = fuseKey(it);
    groups.set(k, [...(groups.get(k) ?? []), it]);
  }
  const out: Item[][] = [];
  for (const items of groups.values()) {
    if (items.length < 3) continue;
    // les plus hauts niveaux d'abord, puis les meilleures sous-stats (valeur mesurée) : la fusion en garde le meilleur
    const quality = (it: Item) => it.subs.reduce((a, x) => a + subScore(x.stat, x.value, it.level), 0);
    const order = (a: Item, b: Item) => b.level - a.level || quality(b) - quality(a);
    const free = items.filter((it) => !heldMap.has(it.uid)).sort(order);
    const worn = items.filter((it) => heldMap.has(it.uid)).sort(order);
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
 * Difficulté des sauvages : une seule règle continue par région (plus de multiplicateur posé à la main
 * par zone). mult = from + (end[région] − from) × p^exp, où p = avancement dans la région (0 à 1, par
 * étape). Le départ (Nv.5 après un prestige) est très doux, la fin de région est la plus serrée.
 */
export const DIFFICULTY = { from: 0.6, end: [2, 2.5, 2.9, 3.3], exp: 1.2 };

/** Avancement (0 à 1) dans la région d'un biome/zone/étape : base de toutes les courbes de difficulté. */
export function regionProgress(biomeIndex: number, zoneIndex: number, stage: number): { region: number; p: number } {
  const region = REGION_START.length - 1 - [...REGION_START].reverse().findIndex((b) => b <= biomeIndex);
  const start = REGION_START[region] ?? 0;
  const total = (regionLastBiome(region) - start + 1) * 3 * STAGES_PER_ZONE;
  const p = Math.min(1, ((biomeIndex - start) * 3 * STAGES_PER_ZONE + zoneIndex * STAGES_PER_ZONE + (stage - 1)) / (total - 1));
  return { region, p };
}

export function zoneWildMult(biomeIndex: number, zoneIndex: number, stage: number): number {
  const { region, p } = regionProgress(biomeIndex, zoneIndex, stage);
  return DIFFICULTY.from + ((DIFFICULTY.end[region] ?? 2) - DIFFICULTY.from) * Math.pow(p, DIFFICULTY.exp);
}

/** Boss et arènes : leurs PV de base (×5 / ×2) suivent aussi la région, de ×0,5 au départ à ×1,2 en fin. */
export const BOSS_RAMP = { from: 0.5, to: 1.2 };
export function bossRamp(biomeIndex: number, zoneIndex: number, stage: number): number {
  const { p } = regionProgress(biomeIndex, zoneIndex, stage);
  return BOSS_RAMP.from + (BOSS_RAMP.to - BOSS_RAMP.from) * p;
}

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
 * espèce très fréquente (poids 20, comme une espèce normale : les légendaires se chassent en chromatique). */
const BOSS_POOL_WEIGHT = 20;

/** Pool réellement tiré au sort : le pool statique de la zone, + son boss si `joinsPool` et déjà vaincu. */
export function effectivePool(zone: ZoneDef, bossBeaten: boolean): [number, number][] {
  if (!zone.boss.joinsPool || !bossBeaten) return zone.pool;
  return [...zone.pool, [zone.boss.speciesId, BOSS_POOL_WEIGHT]];
}

/** Poids sous lequel une espèce est « rare » dans sa zone (capture ×0,5, cible du Parfum rare). */
const RARE_WEIGHT = 10;

/** `rareMult` : Parfum rare de la boutique, multiplie le poids des espèces rares de la zone. */
export function pickSpecies(zone: ZoneDef, rng: Rng, bossBeaten = false, rareMult = 1): number {
  const pool = effectivePool(zone, bossBeaten).map(([id, w]): [number, number] => [id, w < RARE_WEIGHT ? Math.round(w * rareMult) : w]);
  const total = pool.reduce((a, [, w]) => a + w, 0);
  let r = rng.int(total);
  for (const [id, w] of pool) { if (r < w) return id; r -= w; }
  return pool[0][0];
}

export function isRareInZone(zone: ZoneDef, speciesId: number, bossBeaten = false) {
  return (effectivePool(zone, bossBeaten).find(([id]) => id === speciesId)?.[1] ?? 0) < RARE_WEIGHT;
}

/** Multiplicateur du Parfum rare en combat (1 s'il est inactif). */
export function lureMult(s: GameState): number {
  return boostActive(s, 'lure') ? BOOSTS.lure.mult : 1;
}

export type StageKind = 'stage' | 'boss' | 'arena' | 'tower';

export interface WaveEnemy {
  mon: Mon; boss?: boolean; hpMult?: number;
  /** sauvage ordinaire : un peu plus faible que le joueur (`WILD_MALUS`), sauf `wildMult` (zone en avance) */
  wild?: boolean; wildMult?: number;
}

/** Génère les vagues d'une étape. */
export function makeWaves(kind: StageKind, biomeIndex: number, zoneIndex: number, stage: number, rng: Rng, teamSize = 3, bossBeaten = false, odds = SHINY_ODDS, rareMult = 1): WaveEnemy[][] {
  const biome = BIOMES[biomeIndex];
  if (kind === 'arena') {
    return biome.arena.team.map(([id, lv]) => [{ mon: makeMon(id, lv, rng, false, 12), hpMult: 2 * bossRamp(biomeIndex, 2, 5), boss: true }]);
  }
  const zone = biome.zones[zoneIndex];
  if (kind === 'boss') {
    // le combat de boss lui-même n'est jamais chromatique (ne pas trivialiser sa capture garantie) ;
    // une fois vaincu, il rejoint le pool sauvage (`joinsPool`) et peut y être chromatique comme les autres.
    return [[{ mon: makeMon(zone.boss.speciesId, zone.boss.level, rng, false, 10), boss: true, hpMult: 5 * bossRamp(biomeIndex, zoneIndex, 5) }]];
  }
  const lv = zone.minLv + Math.floor(((zone.maxLv - zone.minLv) * (stage - 1)) / (STAGES_PER_ZONE - 1));
  const waves: WaveEnemy[][] = [];
  for (let w = 0; w < WAVES_PER_STAGE; w++) {
    // jamais plus d'ennemis que de membres dans l'équipe (+1 aux étapes 4–5)
    const byStage = stage <= 2 ? 1 + rng.int(2) : stage <= 3 ? 2 + rng.int(2) : 3;
    const n = Math.max(1, Math.min(byStage, teamSize + (stage >= 4 ? 1 : 0)));
    const wave: WaveEnemy[] = [];
    for (let i = 0; i < n; i++) {
      const shiny = rng.int(odds) === 0;
      wave.push({ mon: makeMon(pickSpecies(zone, rng, bossBeaten, rareMult),Math.max(2, lv - 1 + rng.int(2)), rng, shiny), wild: true, wildMult: zoneWildMult(biomeIndex, zoneIndex, stage) });
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
  /** Tour de Combat : éclats de l'étage, et Chromatique +N gagné (tous les 10 étages), à choisir sur la Carte. */
  shards?: number;
  towerReward?: TowerReward;
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
  /** Tour de Combat : étage combattu. */
  floor: number;
  waveIndex = 0;
  battle: Battle;
  result: 'win' | 'lose' | null = null;
  private hp: Record<string, number> = {};

  constructor(private s: GameState, kind: StageKind, rng: Rng, private rng2: Rng = rng) {
    this.kind = kind;
    this.biome = s.biome;
    this.zone = s.zone;
    this.stage = s.stage;
    this.floor = s.towerFloor ?? 1;
    this.waves = kind === 'tower' ? towerWaves(this.floor, rng)
      : makeWaves(kind, s.biome, s.zone, s.stage, rng, s.team.length, s.bossesBeaten[s.biome][s.zone], shinyOdds(s), lureMult(s));
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
    const rewards = this.kind === 'tower' ? towerFloorRewards(this.s, this.floor, this.rng2)
      : waveRewards(this.s, this.kind, this.biome, this.zone, this.enemies, this.rng2);
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
  const totalXp = enemies.reduce((a, e) => a + 2 * e.mon.level * (e.boss ? 5 : 1), 0)
    * (boostActive(s, 'xp') ? BOOSTS.xp.mult : 1); // Multi Exp (boutique)
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
  } else if (kind === 'stage' && (shiny || rng.int(100) < CAPTURE_OFFER_CHANCE * (boostActive(s, 'incense') ? BOOSTS.incense.mult : 1))) {
    const e = shiny ?? enemies[rng.int(enemies.length)];
    out.capture = { speciesId: e.mon.speciesId, level: e.mon.level, shiny: e.mon.shiny, rare: isRareInZone(zone, e.mon.speciesId, s.bossesBeaten[biomeIndex][zoneIndex]), guaranteed: e.mon.shiny };
  }
  return out;
}

function onStageWon(s: GameState, kind: StageKind, biome: number, zone: number, stage: number, rng: Rng, rewards: WaveRewards) {
  s.totals.stagesCleared++;
  if (kind === 'tower') {
    const floor = s.towerFloor ?? 1;
    s.towerBest = Math.max(s.towerBest, floor);
    s.towerFloor = floor + 1;
    return;
  }
  if (kind === 'stage') {
    if (stage >= s.unlocked[biome][zone] && stage < STAGES_PER_ZONE) s.unlocked[biome][zone] = stage + 1;
    // avance automatiquement jusqu'à la dernière étape débloquée (ou l'étape fixée), puis y reste (farm)
    s.stage = Math.min(s.unlocked[biome][zone], stage + 1, s.fixedStage ?? STAGES_PER_ZONE);
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
      // fin de région : ne pas enchaîner automatiquement sur la suivante, le joueur doit d'abord choisir
      // le prestige (voir startPrestige) — la région suivante reste une surprise jusque-là.
      if (biome + 1 < BIOMES.length && !REGION_START.includes(biome + 1)) {
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
  // défaite dans la Tour : retour à la zone, sans pénalité ; en combat continu, on reprend plus bas (`towerRetryFloor`)
  if (kind === 'tower') { s.towerFloor = s.towerAuto ? towerRetryFloor(s.towerFloor ?? 1) : null; return; }
  if (kind !== 'stage') return;
  if (s.stage > 1) s.stage--;
  else if (s.zone > 0 && s.fixedStage === null) { s.zone--; s.stage = s.unlocked[s.biome][s.zone]; }
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
  if (s.fixedStage !== null) return { biome, zone }; // étape fixée : la position choisie est respectée
  if (zoneHasTarget(s, biome, zone)) return { biome, zone }; // on ne quitte jamais la zone d'une cible
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

/** Défis disponibles et pas encore relevés dans le biome en cours (boss de zone + arène) : badge de l'onglet Carte. */
export function challengesReady(s: GameState): number {
  const b = s.biome;
  const bosses = BIOMES[b].zones.filter((_, z) => bossAvailable(s, b, z) && !s.bossesBeaten[b][z]).length;
  return bosses + (arenaAvailable(s, b) && !s.arenaBeaten[b] ? 1 : 0);
}

export function arenaAvailable(s: GameState, biome = s.biome) {
  return s.bossesBeaten[biome].every(Boolean);
}

/** La zone `zone` du biome `biome` est-elle débloquée (biome précédent battu) ? */
export function biomeAvailable(s: GameState, biome: number) {
  return biome === 0 || s.arenaBeaten[biome - 1];
}

/** `pin` : avec une étape fixée, l'étape choisie devient la nouvelle étape fixée (pas pour le raccourci boss). */
export function selectStage(s: GameState, biome: number, zone: number, stage: number, pin = true) {
  if (biome < 0 || biome >= BIOMES.length || !biomeAvailable(s, biome)) return;
  if (zone < 0 || zone >= BIOMES[biome].zones.length || s.unlocked[biome][zone] < 1) return;
  s.biome = biome;
  s.zone = zone;
  s.stage = Math.max(1, Math.min(stage, s.unlocked[biome][zone]));
  if (pin && s.fixedStage !== null) s.fixedStage = s.stage;
  s.towerFloor = null; // choisir une zone sur la Carte fait sortir de la Tour
}

/** Réglage « Avancer dans les étapes » : désactivé, l'étape en cours devient l'étape fixée (voir `fixedStage`). */
export function setAutoAdvance(s: GameState, on: boolean) {
  s.fixedStage = on ? null : s.stage;
}

// ---------------------------------------------------------------- où trouver une espèce (Pokédex)
export interface Habitat { biome: number; biomeName: string; zones: string[]; zoneIdx: number[]; rare: boolean; boss: boolean }
export interface WhereToFind {
  /** espèce réellement rencontrée en sauvage (l'espèce demandée, ou son ancêtre) ; null = introuvable dans la région */
  source: number | null;
  /** lignée à parcourir depuis `source` jusqu'à l'espèce demandée incluse (1 seul élément si sauvage) */
  path: number[];
  habitats: Habitat[];
  /** espèce aussi sauvage : route alternative par évolution (pré-évolution trouvable), s'il y en a une */
  viaEvolution?: WhereToFind;
}

/** Zones (des biomes de la région) où l'espèce apparaît en sauvage ou comme boss. */
function wildHabitats(id: number, region: number): Habitat[] {
  const start = REGIONS[region].start;
  const end = REGIONS[region + 1]?.start ?? BIOMES.length;
  const out: Habitat[] = [];
  for (let b = start; b < end; b++) {
    const zones: string[] = [];
    const zoneIdx: number[] = [];
    let rare = true;
    let boss = false;
    BIOMES[b].zones.forEach((z, zi) => {
      const w = z.pool.find(([sid]) => sid === id)?.[1];
      if (w !== undefined) { zones.push(z.name); zoneIdx.push(zi); if (w >= 10) rare = false; }
      else if (z.boss.speciesId === id) { zones.push(z.name); zoneIdx.push(zi); boss = true; }
    });
    if (zones.length) out.push({ biome: b, biomeName: BIOMES[b].name, zones, zoneIdx, rare, boss });
  }
  return out;
}

/** Route d'obtention par évolution (une pré-évolution trouvable dans la région), ou null. */
function evolutionRoute(id: number, prestige: number, depth: number): WhereToFind | null {
  const dexMax = REGIONS[prestige].dexMax;
  for (const p of ALL_SPECIES) {
    if (p.id > dexMax || !evolutionTargets(p.id, dexMax).includes(id)) continue;
    const up = whereToFind(p.id, prestige, depth + 1);
    if (up.source !== null) return { source: up.source, path: [...up.path, id], habitats: up.habitats };
  }
  return null;
}

/**
 * Où obtenir une espèce dans la région en cours : en sauvage, sinon par évolution (forme de base ou
 * intermédiaire). Une espèce sauvage qui a aussi une pré-évolution trouvable (Voltali via Évoli) renvoie en
 * plus cette route dans `viaEvolution`.
 */
export function whereToFind(id: number, prestige: number, depth = 0): WhereToFind {
  const wild = wildHabitats(id, prestige);
  if (depth > 4) return { source: null, path: [id], habitats: [] };
  if (wild.length) return { source: id, path: [id], habitats: wild, viaEvolution: evolutionRoute(id, prestige, depth) ?? undefined };
  return evolutionRoute(id, prestige, depth) ?? { source: null, path: [id], habitats: [] };
}

// ---------------------------------------------------------------- capture
export function captureChance(offer: CaptureOffer, ball: BallKind, s?: GameState): number {
  if (offer.guaranteed || offer.shiny) return 100;
  if (s && s.missStreak >= CAPTURE_PITY) return 100;
  const base = s && s.team.length < 3 && ball === 'poke' ? Math.max(BALLS.poke.chance, EARLY_POKE_CHANCE) : BALLS[ball].chance;
  return Math.round(base * (offer.rare ? 0.5 : 1));
}

/** Niveau du meilleur Pokémon de l'équipe : plafond des captures, jamais en dessous de 2. */
export function teamMaxLevel(s: GameState): number {
  return Math.max(2, ...s.team.map((u) => s.mons[u].level));
}

/** Niveau effectif d'une capture : jamais au-dessus du meilleur Pokémon de l'équipe. */
export function captureLevel(s: GameState, offer: CaptureOffer): number {
  return Math.min(offer.level, teamMaxLevel(s));
}

/**
 * Meilleure qualité génétique (étoiles) déjà possédée pour une espèce, **de la même sorte** : normal avec normal,
 * chromatique avec chromatique (0 si aucun). Un chromatique 3★ ne doit pas empêcher d'améliorer son Pokémon normal
 * (capture auto « sous 3★ », « ne pas proposer un Pokémon déjà possédé », conversion des cibles).
 */
export function bestStarsOf(s: GameState, speciesId: number, shiny: boolean): number {
  return Object.values(s.mons).filter((m) => m.speciesId === speciesId && m.shiny === shiny).reduce((best, m) => Math.max(best, monStars(m)), 0);
}

/** Ball à utiliser pour une capture automatique : la plus forte en stock, ou la moins chère si `cheapest`. */
export function autoCaptureBall(s: GameState, best: boolean): BallKind | null {
  const order: BallKind[] = best ? ['hyper', 'super', 'poke'] : ['poke', 'super', 'hyper'];
  return order.find((b) => s.balls[b] > 0) ?? null;
}

/**
 * Plancher de gènes garanti par badge (`s.badges` ne redescend pas en repartant farmer un biome antérieur
 * de la région, mais repart à 0 à chaque prestige : le plancher se regagne dans chaque région) : dès 4 badges, capture au moins 2★ (qualité ≥ 50 %, gènes ≥ 8/15 chacun, jusqu'à
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
  // espèce hors de la région en cours (offre périmée d'une partie ou d'une région précédente) : refusée, Ball rendue
  if (offer.speciesId > regionOf(s.prestige).dexMax) return null;
  if (!offer.guaranteed) {
    if (!ball || s.balls[ball] <= 0) return null;
    s.balls[ball]--;
    if (rng.int(100) >= captureChance(offer, ball, s)) { s.missStreak++; return null; }
  }
  s.missStreak = 0;
  const mon = makeMon(offer.speciesId, captureLevel(s, offer), rng, offer.shiny, genesMinForBadges(s.badges));
  addMon(s, mon);
  s.totals.captures++;
  return mon;
}

// ---------------------------------------------------------------- cibles (farm de bonbons)
/** Cibler/ne plus cibler la lignée d'une espèce (cibler Florizarre cible aussi Bulbizarre et Herbizarre). */
export function toggleTarget(s: GameState, speciesId: number) {
  const base = lineBase(speciesId);
  s.targets = s.targets.includes(base) ? s.targets.filter((b) => b !== base) : [...s.targets, base];
}

export function isTargeted(s: GameState, speciesId: number): boolean {
  return s.targets.length > 0 && s.targets.includes(lineBase(speciesId));
}

/** La zone contient-elle une espèce ciblée (légendaire vaincu `joinsPool` compris) ? */
export function zoneHasTarget(s: GameState, biome: number, zone: number): boolean {
  if (!s.targets.length) return false;
  return effectivePool(BIOMES[biome].zones[zone], s.bossesBeaten[biome][zone]).some(([id]) => isTargeted(s, id));
}

/**
 * Une capture ciblée va-t-elle en boîte (plutôt qu'en bonbons) ? Oui si elle est chromatique ou meilleure
 * en étoiles que le meilleur exemplaire déjà possédé de l'espèce (`bestBefore`, 0 = jamais possédée).
 */
export function keepTargetCapture(mon: Mon, bestBefore: number): boolean {
  return mon.shiny || monStars(mon) === 4 || monStars(mon) > bestBefore;
}

export interface TargetCaptureResult { mon: Mon | null; kept: boolean; candies: number }

/**
 * Capture automatique d'une offre ciblée (même règles que `tryCapture`). Avec `convert`, un exemplaire
 * qui n'améliore rien (voir `keepTargetCapture`) est relâché aussitôt en bonbons.
 */
export function captureTarget(s: GameState, offer: CaptureOffer, ball: BallKind, rng: Rng, convert: boolean): TargetCaptureResult {
  const bestBefore = bestStarsOf(s, offer.speciesId, offer.shiny);
  const mon = tryCapture(s, offer, ball, rng);
  if (!mon) return { mon: null, kept: false, candies: 0 };
  if (!convert || keepTargetCapture(mon, bestBefore) || !release(s, mon.uid)) return { mon, kept: true, candies: 0 };
  return { mon, kept: false, candies: RELEASE_CANDIES };
}

export function buyBall(s: GameState, kind: BallKind): boolean {
  return buyBalls(s, kind, 1);
}

/** Achat groupé (boîte « ×10 · ×100 » du Sac) : tout d'un coup, ou rien s'il manque des éclats. */
export function buyBalls(s: GameState, kind: BallKind, n: number): boolean {
  const cost = BALL_PRICE[kind] * n;
  if (n < 1 || s.shards < cost) return false;
  s.shards -= cost;
  s.balls[kind] += n;
  return true;
}

// ---------------------------------------------------------------- Tour de Combat (fin de jeu)
/**
 * Étages infinis après le dernier Champion : 1 combat par étage contre 3 formes finales ou légendaires Nv.100 (gènes
 * parfaits), tirées au hasard. Difficulté (PV et Attaque des adversaires) = `TOWER_BASE` × `TOWER_GROWTH`^(étage − 1) :
 * exponentielle, alors que la puissance du joueur (Chromatique +N, niveau des objets) monte bien plus lentement, donc
 * un mur finit toujours par arriver (le record garde du sens). Défaite = retour à la zone, sans pénalité ; reprise au
 * dernier palier de 10 atteint. Jamais hors ligne.
 */
/**
 * Calage (tools/scratch/tower.ts, 2026-09-30) : l'équipe du bot en fin de Sinnoh gagne à 87 % à ×12 et tient ~50 %
 * vers ×16 (mur ~étage 13) ; la même équipe en Chromatique Nv.100 tient ×24 (~étage 30), +3 Nv.150 ×43 (~55),
 * +5 Nv.200 ×66 (~73), +8 Nv.300 ×124 (~100). +2,4 %/étage suit cette progression (un cran de plus ≈ 20 étages).
 */
export const TOWER_BASE = 12;
export const TOWER_GROWTH = 1.024;
export const TOWER_TEAM = 3;
export const TOWER_LEVEL = 100;

export interface TowerReward { plus: number; level: number; floor: number }

export function towerWildMult(floor: number): number {
  return TOWER_BASE * Math.pow(TOWER_GROWTH, floor - 1);
}

let towerPool: number[] | null = null;
/** Formes finales (plus d'évolution) et légendaires du Pokédex complet. */
export function towerSpecies(): number[] {
  if (!towerPool) {
    const dexMax = REGIONS[REGIONS.length - 1].dexMax;
    towerPool = ALL_SPECIES.filter((sp) => sp.id <= dexMax && evolutionTargets(sp.id, dexMax).length === 0).map((sp) => sp.id);
  }
  return towerPool;
}

export function towerWaves(floor: number, rng: Rng): WaveEnemy[][] {
  const pool = towerSpecies();
  const wave: WaveEnemy[] = [];
  for (let i = 0; i < TOWER_TEAM; i++) {
    wave.push({ mon: makeMon(pool[rng.int(pool.length)], TOWER_LEVEL, rng, false, GENE_MAX), wild: true, wildMult: towerWildMult(floor) });
  }
  return [wave];
}

/** Étage où l'on reprend en entrant : juste après le dernier palier de 10 franchi (record 47 → étage 41). */
export function towerStart(s: GameState): number {
  return Math.floor(s.towerBest / 10) * 10 + 1;
}

export function enterTower(s: GameState): boolean {
  if (!endgameUnlocked(s)) return false;
  s.towerFloor = towerStart(s);
  return true;
}

export function exitTower(s: GameState) {
  s.towerFloor = null;
}

/**
 * Combat continu (`towerAuto`) : étage repris après une défaite. Le début du palier de 10 en cours (comme en entrant
 * dans la Tour), ou le palier d'en dessous si la défaite tombe sur son 1er étage (sinon un joueur au mur rejouerait
 * sans fin un étage qu'il ne passe pas). Les coffres de palier ne se gagnent qu'au premier passage
 * (`towerFloorRewards`) : rejouer des étages ne rapporte que leurs éclats et leur Chromatique.
 */
export function towerRetryFloor(lost: number): number {
  const blockStart = Math.floor((Math.max(1, lost) - 1) / 10) * 10 + 1;
  return lost === blockStart ? Math.max(1, blockStart - 10) : blockStart;
}

export function setTowerAuto(s: GameState, on: boolean) {
  s.towerAuto = on;
}

/**
 * Entraînement hors ligne dans la Tour (fin de jeu) : l'absence rejoue un étage déjà franchi au lieu de farmer la zone
 * (dont le butin ne sert plus à rien après la Tour). Moins de butin qu'en jouant, mais que du Chromatique au niveau de
 * l'étage : 1 tous les `TOWER_IDLE_ITEM_EVERY` étages gagnés, éclats ÷ 2, jamais de Chromatique +N (jeu actif seulement).
 * Désactivable pour chasser les chromatiques et les cibles 🎯, qui n'existent qu'en zone.
 */
export const TOWER_IDLE_ITEM_EVERY = 10;

/** L'absence se passe-t-elle dans la Tour ? (au moins un étage franchi, réglage activé) */
export function towerIdleActive(s: GameState): boolean {
  return endgameUnlocked(s) && s.towerIdle && s.towerBest >= 1;
}

/** Étage rejoué hors ligne : celui choisi (jamais au-delà du record), sinon le dernier palier de 10 franchi. */
export function towerIdleFloor(s: GameState): number {
  const auto = Math.max(1, Math.floor(s.towerBest / 10) * 10);
  return Math.max(1, Math.min(s.towerBest, s.towerIdlePick ?? auto));
}

export function setTowerIdle(s: GameState, on: boolean) {
  s.towerIdle = on;
}

/** Choisit l'étage d'entraînement hors ligne (`null` = automatique, dernier palier). */
export function setTowerIdlePick(s: GameState, floor: number | null) {
  s.towerIdlePick = floor === null ? null : Math.max(1, Math.min(s.towerBest, Math.round(floor)));
}

/** Éclats par étage franchi. */
export function towerShards(floor: number): number {
  return 500 + 50 * floor;
}

let towerLoot: ItemTemplate[] | null = null;
/**
 * Objets qui tombent dans la Tour : ceux des panoplies de la dernière région (Sinnoh, 15 panoplies, 45 objets). Leur
 * puissance ne dépend pas de la panoplie (tous créés au niveau du dernier biome, voir `biomeTier`) ; moins d'objets
 * différents = plus de doublons, donc des fusions en Chromatique +N plus rapides (demande d'Arno, 2026-09-30).
 */
export function towerLootTemplates(): ItemTemplate[] {
  if (!towerLoot) {
    const sets = new Set(Object.entries(BIOME_SET).filter(([b]) => Number(b) >= REGIONS[REGIONS.length - 1].start).map(([, set]) => set));
    towerLoot = TEMPLATES.filter((t) => t.set && sets.has(t.set));
  }
  return towerLoot;
}

/** Cran du Chromatique gagné tous les 10 étages : +0 aux étages 10-20, +1 aux 30-40, +2 aux 50-60… */
export function towerRewardPlus(floor: number): number {
  return Math.max(0, Math.floor((floor - 10) / 20));
}

/**
 * Récompenses d'un étage franchi : éclats, 1 objet **Chromatique** Nv.100 + étage (panoplies de Sinnoh), et un
 * Chromatique +N à choisir tous les 10 étages — **au premier passage seulement** (étage au-delà du record, 2026-10-01 :
 * avant, chaque palier regagné redonnait son coffre, un +5 au choix toutes les 10 victoires vers l'étage 120 en combat
 * continu). Toujours Chromatique : la Tour ne doit jamais être bloquée par un manque de rareté, seulement par la
 * puissance (niveau des objets, crans +N).
 */
function towerFloorRewards(s: GameState, floor: number, rng: Rng): WaveRewards {
  const out: WaveRewards = { xp: {}, levelUps: [], loot: [], capture: null };
  const shards = towerShards(floor);
  s.shards += shards;
  out.shards = shards;
  const pool = towerLootTemplates();
  const it = makeItem(pool[rng.int(pool.length)].id, MAX_RARITY, TOWER_LEVEL + floor, rng, BIOMES.length - 1);
  s.items[it.uid] = it;
  out.loot.push(it);
  // `towerBest` n'est mis à jour qu'après les récompenses (`onStageWon`) : c'est encore le record d'avant ce combat
  if (floor % 10 === 0 && floor > s.towerBest) {
    // 10 % de chance d'un cran de plus
    const reward = { plus: towerRewardPlus(floor) + (rng.int(10) === 0 ? 1 : 0), level: TOWER_LEVEL + floor, floor };
    s.towerRewards.push(reward);
    out.towerReward = reward;
  }
  return out;
}

/** Réclame une récompense d'étage : le Chromatique +N de l'objet choisi (`templateId`), au niveau de l'étage. */
export function claimTowerReward(s: GameState, index: number, templateId: string, rng: Rng): Item | null {
  const reward = s.towerRewards[index];
  if (!reward || !TEMPLATES.some((t) => t.id === templateId)) return null;
  const it = makeItem(templateId, MAX_RARITY, reward.level, rng, BIOMES.length - 1);
  if (reward.plus > 0) {
    it.plus = reward.plus;
    const scale = 1 + PLUS_SUB_STEP * reward.plus;
    it.subs = it.subs.map((sub) => ({ ...sub, value: Math.round(sub.value * scale * 10) / 10 }));
  }
  s.items[it.uid] = it;
  s.towerRewards.splice(index, 1);
  return it;
}

// ---------------------------------------------------------------- boutique
export type BoostKind = 'charm' | 'incense' | 'lure' | 'xp';
/** Durée ajoutée par achat ; plusieurs achats s'additionnent, jusqu'à `BOOST_MAX_MS` restant. */
export const BOOST_MS = 3600_000;
export const BOOST_MAX_MS = 8 * 3600_000;
/** Bonus temporaires de la boutique : actifs en combat comme hors ligne, perdus au prestige. */
export const BOOSTS: Record<BoostKind, { name: string; icon: string; price: number; mult: number; desc: string }> = {
  charm: { name: 'Mini Charme Chroma', icon: '✨', price: 3000, mult: 1.5, desc: 'Chromatiques ×1,5 (se cumule avec le Charme Chroma)' },
  incense: { name: 'Encens', icon: '🕯', price: 800, mult: 2, desc: 'Offres de capture 2 fois plus fréquentes (35 % → 70 % des vagues)' },
  lure: { name: 'Parfum rare', icon: '🌸', price: 1500, mult: 3, desc: 'Espèces rares de la zone 3 fois plus fréquentes' },
  xp: { name: 'Multi Exp', icon: '📘', price: 1000, mult: 1.5, desc: 'XP de l’équipe ×1,5 en combat' },
};
export const BOOST_KINDS = Object.keys(BOOSTS) as BoostKind[];
export const UNIVERSAL_MEGA_PRICE = 2000;

export function noBoosts(): Record<BoostKind, number> {
  return { charm: 0, incense: 0, lure: 0, xp: 0 };
}

/** Temps restant (ms) d'un bonus de la boutique, 0 s'il est inactif. */
export function boostRemaining(s: GameState, kind: BoostKind, now = Date.now()): number {
  return Math.max(0, (s.boosts?.[kind] ?? 0) - now);
}

export function boostActive(s: GameState, kind: BoostKind, now = Date.now()): boolean {
  return boostRemaining(s, kind, now) > 0;
}

/** Hors ligne : part (0 à 1) de la période `[from, from + durationMs]` couverte par le bonus. */
export function boostCoverage(s: GameState, kind: BoostKind, from: number, durationMs: number): number {
  if (durationMs <= 0) return 0;
  return Math.max(0, Math.min(1, ((s.boosts?.[kind] ?? 0) - from) / durationMs));
}

/** Achète 1 h de bonus (ajoutée au temps restant) ; refusé si trop peu d'éclats ou si on dépasserait 8 h. */
export function buyBoost(s: GameState, kind: BoostKind, now = Date.now()): boolean {
  const left = boostRemaining(s, kind, now);
  if (s.shards < BOOSTS[kind].price || left + BOOST_MS > BOOST_MAX_MS) return false;
  s.shards -= BOOSTS[kind].price;
  s.boosts = { ...noBoosts(), ...s.boosts, [kind]: now + left + BOOST_MS };
  return true;
}

export function buyUniversalMega(s: GameState): boolean {
  if (s.shards < UNIVERSAL_MEGA_PRICE) return false;
  s.shards -= UNIVERSAL_MEGA_PRICE;
  s.universalMega = (s.universalMega ?? 0) + 1;
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
export const PENSION_XP_SHARE = 0.5;
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

/**
 * Retire un Pokémon de la pension **après** lui avoir donné l'XP accumulée (à son taux en cours, plafond 8 h). Avant le
 * 2026-10-01, le retrait (bouton « Retirer », mise en équipe) perdait jusqu'à 8 h d'XP sans prévenir. Renvoie l'XP donnée.
 */
export function removePension(s: GameState, uid: string, now = Date.now()): number {
  const p = s.pension.find((x) => x.uid === uid);
  s.pension = s.pension.filter((x) => x.uid !== uid);
  const mon = s.mons[uid];
  if (!p || !mon) return 0;
  const xp = Math.floor((Math.max(0, Math.min(now - p.since, PENSION_CAP_MS)) / 3600_000) * p.xpPerHour);
  if (xp > 0) giveXp(mon, xp);
  return xp;
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

/** Retire un Pokémon de l'exploration **après** avoir encaissé ses éclats prêts (même règle que `harvestExploration`). */
export function removeExploration(s: GameState, uid: string, now = Date.now()): number {
  const p = s.exploration.find((x) => x.uid === uid);
  s.exploration = s.exploration.filter((x) => x.uid !== uid);
  if (!p) return 0;
  const shards = Math.floor(Math.max(0, Math.min(now - p.since, PENSION_CAP_MS)) / EXPLORATION_CYCLE_MS) * SHARDS_PER_MIN;
  s.shards += shards;
  return shards;
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
