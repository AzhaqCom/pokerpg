/**
 * Joueur automatique : sert aux tests d'équilibrage (simulation de la V1
 * complète, du starter au badge). Joue « raisonnablement bien ».
 */
import { BIOMES, REGIONS, regionLastBiome, regionOf } from './content';
import {
  GameState, PENSION_XP_SHARE, StageRun, assignExploration, assignPension, buyBall, harvestExploration, harvestPension, pensionSlots, explorationSlots, arenaAvailable, bossAvailable, canEvolve, canPrestige, chooseStarter, equip, evolve, fuseItems,
  fusionCandidates, heldItems, newGame, rankUpTalent, recycle, setTeam, startPrestige, tryCapture, holder,
} from './game';
import { itemScore, slotOf, template } from './items';
import { teamXpPerHour } from './idle';
import { Rng } from './rng';
import { combatPower, finalStats, monStars } from './stats';
import { RARITIES, emptyBonuses } from './model';
import { PType, species, typeMultiplier } from './data';
import { eligibleAffinityTypes } from './talents';

const TALENT_ORDER = ['power', 'vigor', 'power', 'vigor', 'power', 'guard', 'reflex', 'guard', 'reflex', 'guard', 'spec', 'mastery'];

export interface SimReport {
  seconds: number;
  milestones: Record<string, number>;
  teamLevels: number[];
  captures: number;
  items: number;
  finished: boolean;
  /** état final de l'équipe (espèce, niveau, étoiles, objets portés avec rareté/niveau) : lecture humaine */
  teamDetail: string[];
  /** meilleurs objets non portés du sac par emplacement : rareté/niveau */
  bagBest: string[];
}

const SIM_EPOCH = 1_700_000_000_000; // horloge simulée (ms) : la pension/l'exploration ont besoin d'un `now`

/**
 * Passage « joueur humain » toutes les ~20 min de jeu : range les Pokémon de la boîte en pension (XP) et en
 * exploration (éclats), récolte les deux, puis dépense les éclats en Poké Balls.
 */
function chores(s: GameState, rng: Rng, tSec: number) {
  const now = SIM_EPOCH + tSec * 1000;
  const rates = Object.values(teamXpPerHour(s, rng));
  const rate = rates.length ? (rates.reduce((a, b) => a + b, 0) / rates.length) * PENSION_XP_SHARE : 0;
  harvestPension(s, rate, now);
  harvestExploration(s, now);
  const box = Object.values(s.mons)
    .filter((m) => !s.team.includes(m.uid) && !s.pension.some((p) => p.uid === m.uid) && !s.exploration.some((p) => p.uid === m.uid))
    .sort((a, b) => combatPower(finalStats(b, emptyBonuses())) - combatPower(finalStats(a, emptyBonuses())));
  for (const m of box) {
    if (s.pension.length < pensionSlots(s)) assignPension(s, m.uid, rate, now);
    else if (s.exploration.length < explorationSlots(s)) assignExploration(s, m.uid, now);
  }
  while (s.shards >= 50 && buyBall(s, 'poke') && s.balls.poke < 60);
}

function manage(s: GameState, rng: Rng, threat: PType[] = []) {
  // évolutions + talents
  for (const m of Object.values(s.mons)) {
    if (canEvolve(m, regionOf(s.prestige).dexMax)) evolve(s, m.uid);
    for (const id of TALENT_ORDER) rankUpTalent(s, m.uid, id);
    for (const id of ['power', 'vigor', 'guard', 'reflex', 'spec', 'mastery']) while (rankUpTalent(s, m.uid, id));
    // affinités (paliers 4-5) : type choisi au 1er rang, ignoré ensuite ; on prend le 1er type éligible
    for (const id of ['affinity1', 'affinity2']) {
      const type = eligibleAffinityTypes(m.speciesId)[0];
      while (rankUpTalent(s, m.uid, id, type));
    }
    // paliers 6-9 : rang fixe, pas de choix
    for (const id of ['spec2', 'spec3', 'fury', 'deadly']) while (rankUpTalent(s, m.uid, id));
  }
  // équipe : les 3 plus forts ; après des défaites répétées face au même boss, ceux qui en subissent les types
  // ×2 ou plus passent après les autres (un joueur changerait d'équipe au lieu de s'enliser)
  const power = (m: (typeof s.mons)[string]) => {
    const weak = threat.some((t) => typeMultiplier(t, species(m.speciesId).types) > 1);
    return combatPower(finalStats(m, emptyBonuses())) * (weak ? 0.5 : 1);
  };
  const ranked = Object.values(s.mons).sort((a, b) => power(b) - power(a));
  setTeam(s, ranked.slice(0, 3).map((m) => m.uid));
  // fusions
  for (let g = fusionCandidates(s); g.length; g = fusionCandidates(s)) fuseItems(s, g[0].map((i) => i.uid), rng);
  // meilleur objet par emplacement pour chaque membre
  for (const uid of s.team) {
    for (const slot of ['offense', 'defense', 'berry'] as const) {
      const free = Object.values(s.items).filter((i) => slotOf(i) === slot && (!holder(s, i.uid) || holder(s, i.uid)!.uid === uid));
      const best = free.sort((a, b) => itemScore(b) - itemScore(a))[0];
      if (best) equip(s, uid, best.uid);
    }
  }
  // recyclage : garde les objets portés et 2 exemplaires de chaque (fusion future)
  const keep = new Set<string>();
  for (const m of Object.values(s.mons)) for (const it of heldItems(s, m)) keep.add(it.uid);
  const byKey = new Map<string, number>();
  const junk: string[] = [];
  for (const it of Object.values(s.items)) {
    if (keep.has(it.uid)) continue;
    const k = `${it.templateId}:${it.rarity}`;
    const n = byKey.get(k) ?? 0;
    if (n < 2) byKey.set(k, n + 1); else junk.push(it.uid);
  }
  recycle(s, junk);
}

/**
 * `region` > 0 : démarre directement au 1er biome de cette région, comme juste après un prestige (équipe,
 * boîte et objets à zéro — c'est exactement l'état d'un nouveau départ), et s'arrête au Champion de la
 * région. Sans ça, atteindre Hoenn demanderait de simuler tout Kanto puis Johto avant.
 */
export function simulate(rng: Rng, maxSeconds = 6 * 3600, trace?: string[], region = 0): SimReport {
  const s = newGame();
  if (region > 0) {
    s.prestige = region;
    s.biome = REGIONS[region].start;
    s.unlocked[s.biome][0] = 1;
  }
  const lastBiome = region > 0 ? regionLastBiome(region) : BIOMES.length - 1;
  const starters = regionOf(s.prestige).starters;
  chooseStarter(s, starters[rng.int(starters.length)], rng);
  let t = 0;
  const milestones: Record<string, number> = {};
  const mark = (k: string) => { if (milestones[k] === undefined) milestones[k] = Math.round(t / 60); };
  let bossFails = 0; // défaites consécutives face au boss/à l'arène en cours
  let lastChores = -1e9;
  let farmSince = t;
  let cooldown = 0; // après un boss raté, le bot farme 3 étapes de plus à chaque échec (15 max) avant de réessayer
  while (t < maxSeconds && !s.arenaBeaten[lastBiome]) {
    let kind: 'stage' | 'boss' | 'arena' = 'stage';
    if (cooldown > 0) cooldown--;
    else {
      // un joueur ne se lance sur le boss/l'arène que s'il est à peu près au niveau ; il abandonne la préparation
      // au bout de 45 min de farm pour réessayer quand même
      const lvls = s.team.map((u) => s.mons[u].level);
      const minLv = Math.min(...lvls);
      const ready = (need: number) => minLv >= need - 4 || t - farmSince > 45 * 60;
      if (arenaAvailable(s) && s.zone === 2 && s.stage >= 5 && ready(Math.min(...BIOMES[s.biome].arena.team.map(([, l]) => l)))) kind = 'arena';
      else if (bossAvailable(s) && !s.bossesBeaten[s.biome][s.zone] && s.stage >= 5 && ready(BIOMES[s.biome].zones[s.zone].boss.level)) kind = 'boss';
    }
    if (t - lastChores > 20 * 60) { chores(s, rng, t); lastChores = t; }
    const run = new StageRun(s, kind, rng);
    while (!run.result) {
      run.battle.runToEnd();
      t += run.battle.t + 1.5;
      const r = run.finishWave();
      if (r?.capture) {
        const known = s.dex.caught.includes(r.capture.speciesId);
        if (r.capture.guaranteed) tryCapture(s, r.capture, null, rng);
        else if (!known || s.team.length < 3) tryCapture(s, r.capture, s.balls.super > 0 ? 'super' : 'poke', rng);
      }
    }
    trace?.push(`${Math.round(t / 60)}min b${run.biome} ${kind} z${run.zone}s${run.stage} ${run.result} lv=${s.team.map((u) => s.mons[u].level)} sp=${s.team.map((u) => s.mons[u].speciesId)}`);
    if (run.result === 'lose' && kind !== 'stage') { bossFails++; cooldown = Math.min(15, 3 * bossFails); }
    if (run.result === 'win' && kind !== 'stage') { bossFails = 0; farmSince = t; }
    if (run.result === 'win') {
      if (kind === 'boss') mark(`biome${run.biome + 1}-boss${run.zone + 1}`);
      if (kind === 'arena') mark(`biome${run.biome + 1}-badge`);
    }
    if (Object.keys(s.mons).length >= 2) mark('2e Pokémon');
    const foe = kind === 'arena' ? BIOMES[run.biome].arena.team.map(([id]) => id) : [BIOMES[run.biome].zones[run.zone].boss.speciesId];
    manage(s, rng, bossFails >= 2 ? foe.flatMap((id) => species(id).types) : []);
    // 5 Poké Balls gratuites par « jour » de jeu simulé : 1 fois par heure de jeu ici
    if (Math.floor(t / 3600) > Math.floor((t - 60) / 3600)) s.balls.poke += 5;
    // un joueur efficace lance le prestige dès qu'il le peut (Champion de la région + Pokédex complet)
    if (canPrestige(s)) {
      startPrestige(s);
      mark(s.prestige === 1 ? 'prestige' : `prestige${s.prestige}`);
      const next = regionOf(s.prestige).starters;
      chooseStarter(s, next[rng.int(next.length)], rng);
    }
  }
  const describe = (it: { templateId: string; rarity: number; level: number; tier?: number }) =>
    `${template(it.templateId).name} ${RARITIES[it.rarity]} Nv${it.level}${it.tier ? ` ×${it.tier}` : ''}`;
  const teamDetail = s.team.map((u) => {
    const m = s.mons[u];
    return `${species(m.speciesId).name} Nv${m.level} ${monStars(m)}★ [${heldItems(s, m).map(describe).join(' | ')}]`;
  });
  const held = new Set(s.team.flatMap((u) => heldItems(s, s.mons[u]).map((i) => i.uid)));
  const bagBest = (['offense', 'defense', 'berry'] as const).map((slot) => {
    const best = Object.values(s.items).filter((i) => slotOf(i) === slot && !held.has(i.uid)).sort((a, b) => itemScore(b) - itemScore(a))[0];
    return `${slot}: ${best ? describe(best) : '-'}`;
  });
  return {
    teamDetail, bagBest,
    seconds: Math.round(t), milestones, teamLevels: s.team.map((u) => s.mons[u].level),
    captures: s.totals.captures, items: Object.keys(s.items).length, finished: s.arenaBeaten[lastBiome],
  };
}
