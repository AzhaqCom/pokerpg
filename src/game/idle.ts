/**
 * Gains hors ligne : pendant l'absence, on farme l'étape 1 de la zone en cours,
 * même règles qu'en jouant (XP pondérée, butin), mais sans offre de capture
 * (sauf chromatique, capturé d'office). Calcul par échantillon réel de combats,
 * puis agrégation — jamais de simulation vague par vague sur toute l'absence.
 *
 * `computeIdleGains` ne modifie jamais `s` (tout le hasard est consommé et figé
 * dans l'objet renvoyé) ; `applyIdleGains` encaisse ensuite ce résultat de façon
 * déterministe, sans RNG.
 */
import { Battle } from './battle';
import { BIOMES } from './content';
import {
  BETWEEN_WAVES_MS, GameState, LOOT_CHANCE, PENSION_CAP_MS, SHINY_ODDS, addMon, allyFighter,
  genesMinForBadges, giveXp, makeMon, makeWaves, pickSpecies, teamMaxLevel, wildFighter, xpGapMult,
} from './game';
import { recycleValue, rollLoot } from './items';
import { Item, Mon } from './model';
import { Rng } from './rng';

/** Même plafond que la pension : au-delà, le temps d'absence n'est pas récupéré. */
export const IDLE_CAP_MS = PENSION_CAP_MS;
export const IDLE_MIN_MS = 60_000;
const SAMPLE_WAVES = 5;

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
}

interface WaveSample {
  winRate: number;
  avgWaveMs: number;
  avgKillsPerWonWave: number;
  avgXpShare: Record<string, number>;
  lootLevel: number;
}

/** Simule ~`target` vagues réelles de l'étape 1 de la zone en cours, sans toucher à `s`. */
function sampleWaves(s: GameState, rng: Rng, target: number): WaveSample {
  let sampled = 0;
  let wins = 0;
  let totalMs = 0;
  let killsWon = 0;
  let lootLevelSum = 0;
  const xpShareSum: Record<string, number> = {};
  for (const uid of s.team) xpShareSum[uid] = 0;

  while (sampled < target) {
    const waves = makeWaves('stage', s.biome, s.zone, 1, rng, s.team.length);
    const hp: Record<string, number | undefined> = {};
    for (const wave of waves) {
      if (sampled >= target) break;
      const allies = s.team.map((u) => allyFighter(s, u, hp[u]));
      const enemies = wave.map((e, j) => wildFighter(`idle${sampled}-${j}`, e.mon, { boss: e.boss, hpMult: e.hpMult, wild: e.wild }));
      const battle = new Battle([...allies, ...enemies], rng);
      battle.runToEnd();
      totalMs += battle.t * 1000 + BETWEEN_WAVES_MS;
      sampled++;
      const enemyAvgLevel = wave.reduce((a, e) => a + e.mon.level, 0) / wave.length;
      lootLevelSum += Math.max(1, Math.round(enemyAvgLevel));
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

function emptyGains(s: GameState, absenceMs: number, durationMs: number): IdleGains {
  return {
    absenceMs, durationMs, wavesWon: 0, kills: 0,
    perMon: s.team.map((uid) => ({ uid, xp: 0, levelBefore: s.mons[uid].level, levelAfter: s.mons[uid].level, newMoves: [] })),
    bagItems: [], shardsFromRecycle: 0, shinies: [],
  };
}

/**
 * Calcule les gains d'une absence de `absenceMs` : ne modifie jamais `s`.
 * `null` si l'absence est trop courte pour valoir le calcul (< `IDLE_MIN_MS`).
 */
export function computeIdleGains(
  s: GameState, absenceMs: number, rng: Rng,
  opts: { autoRecycle?: boolean; recycleMaxRarity?: number } = {},
): IdleGains | null {
  const autoRecycle = opts.autoRecycle ?? true;
  const recycleMaxRarity = opts.recycleMaxRarity ?? 1;
  if (absenceMs < IDLE_MIN_MS || !s.team.length) return null;
  const durationMs = Math.min(absenceMs, IDLE_CAP_MS);
  const sample = sampleWaves(s, rng, SAMPLE_WAVES);
  if (sample.winRate <= 0) return emptyGains(s, absenceMs, durationMs);

  const wavesWon = Math.floor((durationMs / sample.avgWaveMs) * sample.winRate);
  if (wavesWon <= 0) return emptyGains(s, absenceMs, durationMs);

  const kills = Math.round(wavesWon * sample.avgKillsPerWonWave);

  const perMon: IdlePerMon[] = s.team.map((uid) => {
    const mon = s.mons[uid];
    const xp = Math.max(0, Math.round((sample.avgXpShare[uid] ?? 0) * wavesWon));
    const clone: Mon = { ...mon, moves: [...mon.moves] };
    const r = xp > 0 ? giveXp(clone, xp) : { levels: 0, newMoves: [] };
    return { uid, xp, levelBefore: mon.level, levelAfter: clone.level, newMoves: r.newMoves };
  });

  const bagItems: Item[] = [];
  let shardsFromRecycle = 0;
  for (let i = 0; i < kills; i++) {
    if (rng.int(100) < LOOT_CHANCE) {
      const it = rollLoot(rng, sample.lootLevel);
      if (autoRecycle && it.rarity <= recycleMaxRarity) shardsFromRecycle += recycleValue(it);
      else bagItems.push(it);
    }
  }

  const shinies: Mon[] = [];
  const zone = BIOMES[s.biome].zones[s.zone];
  const cap = teamMaxLevel(s);
  for (let i = 0; i < kills; i++) {
    if (rng.int(SHINY_ODDS) === 0) {
      const speciesId = pickSpecies(zone, rng);
      const level = Math.min(Math.max(2, zone.minLv - 1 + rng.int(2)), cap);
      shinies.push(makeMon(speciesId, level, rng, true, genesMinForBadges(s.badges)));
    }
  }

  return { absenceMs, durationMs, wavesWon, kills, perMon, bagItems, shardsFromRecycle, shinies };
}

/** Encaisse un résultat de `computeIdleGains` : déterministe, ne tire plus de hasard. */
export function applyIdleGains(s: GameState, gains: IdleGains) {
  for (const pm of gains.perMon) if (pm.xp > 0) giveXp(s.mons[pm.uid], pm.xp);
  for (const it of gains.bagItems) s.items[it.uid] = it;
  s.shards += gains.shardsFromRecycle;
  for (const mon of gains.shinies) addMon(s, mon);
  s.totals.kills += gains.kills;
}
