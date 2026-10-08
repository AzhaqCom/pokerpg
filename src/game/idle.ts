/**
 * Gains hors ligne : pendant l'absence, l'équipe farme **l'étape en cours** de la zone en cours, comme au
 * premier plan : elle monte d'une étape après 3 vagues gagnées (jamais au-delà de la plus haute étape déjà
 * débloquée, ni de l'étape fixée : `fixedStage`) et recule d'une étape après un K.O. XP, butin et chromatiques suivent tous cette même
 * progression ; offres de capture seulement pour les chromatiques (capturés d'office) et les lignées ciblées
 * (`s.targets` : capturées avec le stock de Balls, jamais d'achat). Chaque étape est mesurée par un
 * échantillon réel de combats, puis la progression est déroulée vague par vague avec ces moyennes.
 *
 * `computeIdleGains` ne modifie jamais `s` (tout le hasard est consommé et figé
 * dans l'objet renvoyé) ; `applyIdleGains` encaisse ensuite ce résultat de façon
 * déterministe, sans RNG.
 */
import { Battle } from './battle';
import { BIOMES, STAGES_PER_ZONE, WAVES_PER_STAGE } from './content';
import {
  BETWEEN_WAVES_MS, BOOSTS, BallKind, CAPTURE_OFFER_CHANCE, GameState, TOWER_IDLE_ITEM_EVERY, TOWER_LEVEL, boostCoverage,
  BoostKind, TowerReward, makeTowerItem, towerFighters, towerBlessedPlus, towerIdleCapMs, towerRank, towerChest, towerClimbStart, towerDropPlus, towerDropPool, towerIdleActive, towerIdleFloor, towerShards, towerWaves, LOOT_CHANCE, PENSION_CAP_MS, RELEASE_CANDIES, shinyOdds,
  addMon, allyFighter, bestStarsOf, captureChance, genesMinForBadges, giveXp, idleFarmTarget, isRareInZone, isTargeted,
  keepTargetCapture, lineBase, makeMon, makeWaves, pickSpecies, teamMaxLevel, wildFighter, xpGapMult,
} from './game';
import { recycleValue, rollLoot } from './items';
import { CollectionGoal, needTracker } from './collection';
import { Item, Mon } from './model';
import { monStars } from './stats';
import { Rng } from './rng';

/** Même plafond que la pension : au-delà, le temps d'absence n'est pas récupéré. */
export const IDLE_CAP_MS = PENSION_CAP_MS;
export const IDLE_MIN_MS = 60_000;
const SAMPLE_WAVES = 5;
/**
 * Part de l'XP et du butin d'un vrai combat accordée hors ligne (1 = autant qu'en jouant, à vitesse ×1).
 * Le jeu actif garde déjà l'avantage (vitesse ×2 dès le 1er badge, ×3 dès le 4e, offres de capture, boss) : pas de
 * réduction pour l'instant (décision d'Arno, 2026-09-24). Passer à 0.8 pour réduire de 20 %.
 */
export const IDLE_REWARD_MULT = 1;

export interface IdlePerMon {
  uid: string;
  xp: number;
  levelBefore: number;
  levelAfter: number;
  newMoves: number[];
}

export interface IdleGains {
  absenceMs: number;
  /** Durée effectivement prise en compte (plafonnée à `IDLE_CAP_MS`). */
  durationMs: number;
  wavesWon: number;
  kills: number;
  perMon: IdlePerMon[];
  /** Objets Rare et plus, prêts à ajouter au sac. */
  bagItems: Item[];
  /** Éclats du recyclage auto des objets Commun/Peu commun. */
  shardsFromRecycle: number;
  /** Chromatiques croisés pendant l'absence, déjà créés (niveau plafonné), capturés d'office. */
  shinies: Mon[];
  /** Zone effectivement farmée (peut différer de la zone affichée : voir `idleFarmTarget`). */
  farmBiome: number;
  farmZone: number;
  /** Étape atteinte à la fin de l'absence : la position affichée la reprend au retour. */
  endStage: number;
  /** Lignées ciblées : captures réussies par espèce (gardées en boîte ou converties en bonbons). */
  targetCaught: Record<number, number>;
  /** Captures ciblées gardées en boîte (chromatique ou meilleures en étoiles que le meilleur exemplaire). */
  targetMons: Mon[];
  /** Bonbons obtenus en convertissant les captures ciblées, par base de lignée. */
  targetCandies: Record<number, number>;
  ballsUsed: Record<BallKind, number>;
  /** Compteur de pitié (`missStreak`) après les lancers de l'absence. */
  missStreak: number;
  /** Entraînement dans la Tour (fin de jeu) : étage de départ, éclats gagnés ; ascension (`climb`) : record d'avant
   *  (`prevBest`, le résumé s'affiche après l'encaissement) et à la fin de l'absence (`best`), coffres des paliers
   *  franchis ; absent = farm de zone. */
  tower?: { floor: number; shards: number; climb?: boolean; prevBest?: number; best?: number; rewards?: TowerReward[]; blessed?: number; spared?: number };
}

interface WaveSample {
  winRate: number;
  avgWaveMs: number;
  avgKillsPerWonWave: number;
  avgXpShare: Record<string, number>;
  lootLevel: number;
}

/** Simule ~`target` vagues réelles de l'étape `stage` (1 par défaut, utilisé par `teamXpPerHour`) de la zone `biome`/`zone` (la zone en cours par défaut), sans toucher à `s`. */
function sampleWaves(s: GameState, rng: Rng, target: number, biome = s.biome, zone = s.zone, stage = 1): WaveSample {
  let sampled = 0;
  let wins = 0;
  let totalMs = 0;
  let killsWon = 0;
  let lootLevelSum = 0;
  const xpShareSum: Record<string, number> = {};
  for (const uid of s.team) xpShareSum[uid] = 0;

  while (sampled < target) {
    const waves = makeWaves('stage', biome, zone, stage, rng, s.team.length, s.bossesBeaten[biome][zone], shinyOdds(s));
    const hp: Record<string, number | undefined> = {};
    for (const wave of waves) {
      if (sampled >= target) break;
      const allies = s.team.map((u) => allyFighter(s, u, hp[u]));
      // `teamSize` : sauvages adoucis pour une équipe de 1-2 Pokémon, comme au premier plan (`SOLO_MALUS`, oublié avant le
      // 2026-10-02 : l'absence était plus dure que le jeu tant que l'équipe n'avait pas 3 membres)
      const enemies = wave.map((e, j) => wildFighter(`idle${sampled}-${j}`, e.mon, { boss: e.boss, hpMult: e.hpMult, wild: e.wild, wildMult: e.wildMult, teamSize: s.team.length }));
      const battle = new Battle([...allies, ...enemies], rng);
      battle.runToEnd();
      totalMs += battle.t * 1000 + BETWEEN_WAVES_MS;
      sampled++;
      const enemyAvgLevel = wave.reduce((a, e) => a + e.mon.level, 0) / wave.length;
      lootLevelSum += Math.max(1, Math.round(enemyAvgLevel), teamMaxLevel(s));
      if (battle.result === 'win') {
        wins++;
        killsWon += wave.length;
        const totalXp = wave.reduce((a, e) => a + 2 * e.mon.level, 0);
        const share = Math.max(1, Math.round(totalXp / s.team.length));
        for (const uid of s.team) xpShareSum[uid] += share * xpGapMult(s.mons[uid].level, enemyAvgLevel);
        for (const f of battle.fighters.filter((x) => x.side === 0)) {
          const heal = Math.round(f.maxHp * 0.35);
          hp[f.id] = f.alive ? Math.min(f.maxHp, f.hp + heal) : 0;
        }
      } else {
        break; // équipe K.O. : nouvelle tentative depuis une équipe fraîche
      }
    }
  }

  const avgXpShare: Record<string, number> = {};
  for (const uid of s.team) avgXpShare[uid] = wins ? xpShareSum[uid] / wins : 0;

  return {
    winRate: wins / sampled,
    avgWaveMs: totalMs / sampled,
    avgKillsPerWonWave: wins ? killsWon / wins : 0,
    avgXpShare,
    lootLevel: Math.max(1, Math.round(lootLevelSum / sampled)),
  };
}

/**
 * XP/heure estimée par membre de l'équipe s'il combattait dans la zone/étape actuelle, par échantillon
 * réel de combats (même méthode que l'idle). Sert de référence pour le taux de la pension (voir
 * `PENSION_XP_SHARE` dans `game.ts`) : scale automatiquement avec la progression du joueur, aucun
 * chiffre à retoucher à la main quand un nouveau biome arrive.
 */
export function teamXpPerHour(s: GameState, rng: Rng): Record<string, number> {
  const out: Record<string, number> = {};
  if (!s.team.length) return out;
  const sample = sampleWaves(s, rng, SAMPLE_WAVES);
  for (const uid of s.team) {
    out[uid] = sample.winRate > 0 ? (sample.avgXpShare[uid] ?? 0) * sample.winRate * (3600_000 / sample.avgWaveMs) : 0;
  }
  return out;
}

export interface IdleRun {
  /** Vagues gagnées et ennemis vaincus par étape (index 1 à `cap`). */
  wavesWon: number[];
  kills: number[];
  /** Étape où se trouve l'équipe à la fin de l'absence. */
  endStage: number;
}

/**
 * Déroule l'absence vague par vague avec les moyennes mesurées par étape (`samples[k]`, index 1 à `cap`),
 * mêmes règles qu'au premier plan : 3 vagues gagnées → étape suivante (plafonnée à `cap`, la plus haute
 * étape déjà débloquée) ; vague perdue → recul d'une étape (jamais sous 1, jamais de changement de zone).
 * Tout le hasard vient de `rng`.
 */
export function idleRun(samples: WaveSample[], startStage: number, cap: number, durationMs: number, rng: Rng): IdleRun {
  const wavesWon = new Array<number>(cap + 1).fill(0);
  const kills = new Array<number>(cap + 1).fill(0);
  let stage = Math.max(1, Math.min(startStage, cap));
  let wave = 0;
  let t = 0;
  while (t < durationMs) {
    const smp = samples[stage] ?? samples[1];
    t += Math.max(500, smp.avgWaveMs);
    if (rng.int(10000) < smp.winRate * 10000) {
      wavesWon[stage]++;
      kills[stage] += smp.avgKillsPerWonWave;
      if (++wave === WAVES_PER_STAGE) { wave = 0; stage = Math.min(cap, stage + 1); }
    } else {
      wave = 0;
      stage = Math.max(1, stage - 1);
    }
  }
  return { wavesWon, kills, endStage: stage };
}

function emptyGains(s: GameState, absenceMs: number, durationMs: number): IdleGains {
  return {
    absenceMs, durationMs, wavesWon: 0, kills: 0,
    perMon: s.team.map((uid) => ({ uid, xp: 0, levelBefore: s.mons[uid].level, levelAfter: s.mons[uid].level, newMoves: [] })),
    bagItems: [], shardsFromRecycle: 0, shinies: [], farmBiome: s.biome, farmZone: s.zone, endStage: s.stage,
    targetCaught: {}, targetMons: [], targetCandies: {}, ballsUsed: { poke: 0, super: 0, hyper: 0 }, missStreak: s.missStreak,
  };
}

/**
 * Calcule les gains d'une absence de `absenceMs` : ne modifie jamais `s`.
 * `null` si l'absence est trop courte pour valoir le calcul (< `IDLE_MIN_MS`).
 */
export function computeIdleGains(
  s: GameState, absenceMs: number, rng: Rng,
  opts: { autoRecycle?: boolean; recycleMaxRarity?: number; skipOwnedShiny?: boolean; bestBall?: boolean; convertTargets?: boolean; goal?: CollectionGoal } = {},
): IdleGains | null {
  const goal = opts.goal ?? 'off';
  const autoRecycle = opts.autoRecycle ?? true;
  const recycleMaxRarity = opts.recycleMaxRarity ?? 1;
  const skipOwnedShiny = opts.skipOwnedShiny ?? false;
  if (absenceMs < IDLE_MIN_MS || !s.team.length) return null;
  // absence dans la Tour : 12 h, 16 h ou 24 h selon Longue absence (arbre de la Tour) ; le farm des zones reste à 12 h
  if (towerIdleActive(s)) return towerIdleGains(s, absenceMs, Math.min(absenceMs, towerIdleCapMs(s)), rng);
  const durationMs = Math.min(absenceMs, IDLE_CAP_MS);
  const { biome: farmBiome, zone: farmZone } = idleFarmTarget(s);
  // bonus de la boutique : chacun compte au prorata de la part de l'absence qu'il couvre (1 h de Multi Exp sur
  // 8 h d'absence = XP ×1,0625 en moyenne)
  const cover = (kind: keyof typeof BOOSTS) => 1 + (BOOSTS[kind].mult - 1) * boostCoverage(s, kind, s.lastActive, durationMs);
  const boost = { xp: cover('xp'), charm: cover('charm'), incense: cover('incense'), lure: cover('lure') };
  // l'équipe reprend là où elle était (ou à la plus haute étape débloquée de la zone suivante, si l'idle y passe),
  // sans dépasser l'étape fixée si le réglage « Avancer dans les étapes » est désactivé
  const cap = Math.max(1, Math.min(STAGES_PER_ZONE, s.fixedStage ?? STAGES_PER_ZONE, s.unlocked[farmBiome]?.[farmZone] ?? 1));
  const sameZone = farmBiome === s.biome && farmZone === s.zone;
  const samples: WaveSample[] = [];
  for (let k = 1; k <= cap; k++) samples[k] = sampleWaves(s, rng, SAMPLE_WAVES, farmBiome, farmZone, k);
  const run = idleRun(samples, sameZone ? s.stage : cap, cap, durationMs, rng);

  const wavesWon = run.wavesWon.reduce((a, b) => a + b, 0);
  if (wavesWon <= 0) return emptyGains(s, absenceMs, durationMs);
  const kills = Math.round(run.kills.reduce((a, b) => a + b, 0));

  const perMon: IdlePerMon[] = s.team.map((uid) => {
    const mon = s.mons[uid];
    let rawXp = 0;
    for (let k = 1; k <= cap; k++) rawXp += (samples[k].avgXpShare[uid] ?? 0) * run.wavesWon[k];
    const xp = Math.max(0, Math.round(rawXp * IDLE_REWARD_MULT * boost.xp));
    const clone: Mon = { ...mon, moves: [...mon.moves] };
    const r = xp > 0 ? giveXp(clone, xp) : { levels: 0, newMoves: [] };
    return { uid, xp, levelBefore: mon.level, levelAfter: clone.level, newMoves: r.newMoves };
  });

  // butin : même chance par ennemi vaincu qu'en jouant, au niveau de l'étape où il a été vaincu
  const bagItems: Item[] = [];
  let shardsFromRecycle = 0;
  for (let k = 1; k <= cap; k++) {
    const n = Math.round(run.kills[k]);
    for (let i = 0; i < n; i++) {
      if (rng.int(100) < LOOT_CHANCE * IDLE_REWARD_MULT) {
        const it = rollLoot(rng, samples[k].lootLevel, farmBiome);
        if (autoRecycle && it.rarity <= recycleMaxRarity) shardsFromRecycle += recycleValue(it);
        else bagItems.push(it);
      }
    }
  }

  // chromatiques : 1/256 par ennemi vaincu (voir `shinyOdds`), dans le pool de la zone (jamais réduits)
  const shinyNeed = needTracker(s, true);
  const shinies: Mon[] = [];
  const zone = BIOMES[farmBiome].zones[farmZone];
  const levelCap = teamMaxLevel(s);
  for (let i = 0; i < kills; i++) {
    if (rng.int(shinyOdds(s, boost.charm)) === 0) {
      // même tirage qu'en combat (`makeWaves`) : un légendaire `joinsPool` vaincu fait partie du pool
      const speciesId = pickSpecies(zone, rng, s.bossesBeaten[farmBiome][farmZone], boost.lure);
      // objectif « boîte + chromatiques » : un chromatique qui ne manque pas à la boîte est ignoré ; sinon déjà au Pokédex
      if (skipOwnedShiny && (goal === 'boxShiny' ? !shinyNeed.wants(speciesId) : s.dex.shiny.includes(speciesId))) continue;
      shinyNeed.add(speciesId);
      const level = Math.min(Math.max(2, zone.minLv - 1 + rng.int(2)), levelCap);
      shinies.push(makeMon(speciesId, level, rng, true, genesMinForBadges(s.badges)));
    }
  }

  const t = idleTargetCaptures(s, run.wavesWon, farmBiome, farmZone, rng, opts.bestBall ?? false, opts.convertTargets ?? true, goal, boost.incense, boost.lure);
  return { absenceMs, durationMs, wavesWon, kills, perMon, bagItems, shardsFromRecycle, shinies, farmBiome, farmZone, endStage: run.endStage, ...t };
}

/**
 * Offres de capture de l'absence pour les lignées ciblées : même règles qu'en combat (35 % des vagues
 * gagnées, sauvage tiré dans le pool de la zone, taux de la Ball, rareté, pitié), avec le stock de Balls
 * (arrêt quand il est vide, jamais d'achat). Ne modifie pas `s`.
 */
function idleTargetCaptures(
  s: GameState, wavesWon: number[], farmBiome: number, farmZone: number, rng: Rng, bestBall: boolean, convert: boolean,
  goal: CollectionGoal = 'off', incense = 1, lure = 1,
): Pick<IdleGains, 'targetCaught' | 'targetMons' | 'targetCandies' | 'ballsUsed' | 'missStreak'> {
  const out = { targetCaught: {} as Record<number, number>, targetMons: [] as Mon[], targetCandies: {} as Record<number, number>, ballsUsed: { poke: 0, super: 0, hyper: 0 }, missStreak: s.missStreak };
  if (!s.targets.length && goal === 'off') return out;
  // objectif de collection : capture ce qui manque (Pokédex, ou boîte selon l'objectif), gardé en boîte
  const caught = new Set(s.dex.caught);
  const boxNeed = needTracker(s, false);
  const wanted = (id: number) => (goal === 'dex' ? !caught.has(id) : goal === 'box' || goal === 'boxShiny' ? boxNeed.wants(id) : false);
  const zone = BIOMES[farmBiome].zones[farmZone];
  const bossBeaten = s.bossesBeaten[farmBiome][farmZone];
  const balls = { ...s.balls };
  const best: Record<number, number> = {};
  const genesMin = genesMinForBadges(s.badges);
  const levelCap = teamMaxLevel(s);
  const order: BallKind[] = bestBall ? ['hyper', 'super', 'poke'] : ['poke', 'super', 'hyper'];
  for (let k = 1; k < wavesWon.length; k++) {
    const lv = zone.minLv + Math.floor(((zone.maxLv - zone.minLv) * (k - 1)) / (STAGES_PER_ZONE - 1));
    for (let w = 0; w < wavesWon[k]; w++) {
      if (rng.int(100) >= CAPTURE_OFFER_CHANCE * incense) continue;
      const speciesId = pickSpecies(zone, rng, bossBeaten, lure);
      const forGoal = wanted(speciesId);
      if (!forGoal && !isTargeted(s, speciesId)) continue;
      const ball = order.find((b) => balls[b] > 0);
      if (!ball) return out; // plus de Balls : fin des captures ciblées
      balls[ball]--;
      out.ballsUsed[ball]++;
      const offer = { speciesId, level: Math.max(2, lv - 1 + rng.int(2)), shiny: false, rare: isRareInZone(zone, speciesId, bossBeaten) };
      if (rng.int(100) >= captureChance(offer, ball, { ...s, missStreak: out.missStreak })) { out.missStreak++; continue; }
      out.missStreak = 0;
      const mon = makeMon(speciesId, Math.min(offer.level, levelCap), rng, false, genesMin);
      out.targetCaught[speciesId] = (out.targetCaught[speciesId] ?? 0) + 1;
      const bestBefore = best[speciesId] ?? bestStarsOf(s, speciesId, false); // captures ciblées : jamais chromatiques
      caught.add(speciesId);
      if (forGoal) boxNeed.add(speciesId);
      if (forGoal || !convert || keepTargetCapture(mon, bestBefore)) {
        out.targetMons.push(mon);
        best[speciesId] = Math.max(bestBefore, monStars(mon));
      } else {
        const base = lineBase(speciesId);
        out.targetCandies[base] = (out.targetCandies[base] ?? 0) + RELEASE_CANDIES;
      }
    }
  }
  return out;
}

/** Taux de victoire et durée moyenne d'un étage de la Tour (équipe fraîche à chaque étage, comme en jouant). */
function sampleTowerFloor(s: GameState, rng: Rng, floor: number, n = SAMPLE_WAVES, elixir = false): { winRate: number; avgMs: number } {
  let wins = 0;
  let totalMs = 0;
  for (let i = 0; i < n; i++) {
    const wave = towerWaves(floor, rng)[0];
    // Élixir de la Tour × Entraînement, Relève et Rempart (arbre de la Tour)
    const { allies, opts } = towerFighters(s, elixir);
    const enemies = wave.map((e, j) => wildFighter(`tower${i}-${j}`, e.mon, { wild: e.wild, wildMult: e.wildMult, teamSize: s.team.length }));
    const battle = new Battle([...allies, ...enemies], rng, opts);
    battle.runToEnd();
    totalMs += battle.t * 1000 + BETWEEN_WAVES_MS;
    if (battle.result === 'win') wins++;
  }
  return { winRate: wins / n, avgMs: totalMs / n };
}

/** Étages rejoués sous l'étage choisi après des défaites (on redescend d'un étage à chaque défaite, puis on regrimpe). */
const TOWER_IDLE_DEPTH = 10;
/** Aimant à butin (Boutique) : hors ligne, 1 Chromatique tous les 3 étages gagnés au lieu de `TOWER_IDLE_ITEM_EVERY`. */
export const TOWER_MAGNET_ITEM_EVERY = 3;

/**
 * Absence en fin de jeu, dans la Tour. Deux modes :
 * - **ascension** (`towerIdleClimb`, par défaut) : départ au dernier palier de 10 sous le record (`towerClimbStart`),
 *   sans plafond ; chaque étage gagné au-delà du record le fait monter, et chaque palier de 10 ainsi franchi donne son
 *   coffre (`towerChest`, comme en jeu actif) ;
 * - **étage fixe** : l'étage `towerIdleFloor`, jamais dépassé.
 * Une défaite fait redescendre d'un étage (`TOWER_IDLE_DEPTH` au plus sous le plus haut étage atteint), une victoire
 * remonter. Chaque étage gagné : ses éclats, comme en combat ; tous les `TOWER_IDLE_ITEM_EVERY` étages gagnés, un
 * Chromatique (panoplies visées, sinon les 20 du jeu : `towerDropPool`) au niveau 100 + étage et au cran de l'étage
 * (`towerDropPlus`). Ni XP, ni chromatiques, ni captures (propres aux zones). Ne modifie pas `s`.
 */
function towerIdleGains(s: GameState, absenceMs: number, durationMs: number, rng: Rng): IdleGains {
  const climb = s.towerIdleClimb ?? true;
  const start = climb ? towerClimbStart(s) : towerIdleFloor(s);
  // bonus de la Boutique : actifs pendant la part de l'absence qu'ils couvrent (ms depuis le départ)
  const until = (k: BoostKind) => (s.boosts?.[k] ?? 0) - s.lastActive;
  const elixirEnd = until('elixir'), magnetEnd = until('magnet'), cranEnd = until('cran');
  const samples: Record<string, { winRate: number; avgMs: number }> = {};
  const sample = (f: number, elixir: boolean) => (samples[`${f}${elixir ? 'e' : ''}`] ??= sampleTowerFloor(s, rng, f, undefined, elixir));
  const gains = emptyGains(s, absenceMs, durationMs);
  const pool = towerDropPool(s);
  const rewards: TowerReward[] = [];
  let floor = start;
  let reached = start; // plus haut étage tenté : la descente après une défaite s'arrête 10 étages dessous
  let best = s.towerBest;
  let won = 0;
  let sinceItem = 0; // étages gagnés depuis le dernier Chromatique
  let shards = 0;
  let blessed = 0; // Butin béni (arbre de la Tour)
  // Seconde chance (arbre de la Tour) : paliers de 10 où la défaite gratuite a déjà servi
  const secondChance = towerRank(s, 'secondeChance') > 0;
  const spared = new Set<number>();
  for (let t = 0; t < durationMs;) {
    const smp = sample(floor, t < elixirEnd);
    const now = t;
    t += Math.max(500, smp.avgMs);
    if (rng.int(10000) < smp.winRate * 10000) {
      won++;
      sinceItem++;
      shards += towerShards(floor);
      // Aimant à butin : 1 Chromatique tous les 3 étages gagnés au lieu de 5 ; Pierre de cran : +1 cran
      if (sinceItem >= (now < magnetEnd ? TOWER_MAGNET_ITEM_EVERY : TOWER_IDLE_ITEM_EVERY)) {
        sinceItem = 0;
        const plus = towerDropPlus(floor) + (now < cranEnd ? 1 : 0);
        const templateId = pool[rng.int(pool.length)].id;
        const extra = towerBlessedPlus(s, rng);
        if (extra) blessed++;
        gains.bagItems.push(makeTowerItem(templateId, TOWER_LEVEL + floor, plus + extra, rng));
      }
      if (floor > best) {
        // premier passage : nouveau record, et le coffre de son palier
        if (floor % 10 === 0) rewards.push(towerChest(floor, rng));
        best = floor;
      }
      floor = climb ? floor + 1 : Math.min(start, floor + 1);
      reached = Math.max(reached, floor);
    } else {
      const block = Math.floor((floor - 1) / 10);
      if (secondChance && !spared.has(block)) spared.add(block); // même étage retenté (Seconde chance)
      else floor = Math.max(1, reached - TOWER_IDLE_DEPTH + 1, floor - 1);
    }
  }
  gains.wavesWon = won;
  gains.kills = won * 3;
  gains.tower = { floor: start, shards, climb, prevBest: s.towerBest, best, rewards, blessed, spared: spared.size };
  return gains;
}

/** Encaisse un résultat de `computeIdleGains` : déterministe, ne tire plus de hasard. */
export function applyIdleGains(s: GameState, gains: IdleGains) {
  for (const pm of gains.perMon) if (pm.xp > 0) giveXp(s.mons[pm.uid], pm.xp);
  for (const it of gains.bagItems) s.items[it.uid] = it;
  s.shards += gains.shardsFromRecycle + (gains.tower?.shards ?? 0);
  // ascension hors ligne : record et coffres des paliers franchis, à choisir dans l'onglet de la Tour
  if (gains.tower?.best) s.towerBest = Math.max(s.towerBest, gains.tower.best);
  if (gains.tower?.rewards?.length) s.towerRewards.push(...gains.tower.rewards);
  for (const mon of gains.shinies) addMon(s, mon);
  for (const mon of gains.targetMons) addMon(s, mon);
  for (const [base, n] of Object.entries(gains.targetCandies)) s.candies[base] = (s.candies[base] ?? 0) + n;
  for (const b of ['poke', 'super', 'hyper'] as BallKind[]) s.balls[b] = Math.max(0, s.balls[b] - gains.ballsUsed[b]);
  s.missStreak = gains.missStreak;
  s.totals.captures += Object.values(gains.targetCaught).reduce((a, n) => a + n, 0);
  s.totals.kills += gains.kills;
  // la position affichée reprend celle de la fin de l'absence : l'étape atteinte, et la zone suivante si
  // l'idle y est passé (ancienne zone vidée de tout intérêt, toujours une zone déjà débloquée : `idleFarmTarget`).
  s.biome = gains.farmBiome;
  s.zone = gains.farmZone;
  s.stage = gains.endStage;
}
