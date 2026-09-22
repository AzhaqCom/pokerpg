/**
 * Joueur automatique : sert aux tests d'équilibrage (simulation de la V1
 * complète, du starter au badge). Joue « raisonnablement bien ».
 */
import { BIOMES, STARTERS, STARTERS2 } from './content';
import {
  GameState, StageRun, arenaAvailable, bossAvailable, canEvolve, canPrestige, chooseStarter, equip, evolve, fuseItems,
  fusionCandidates, heldItems, newGame, rankUpTalent, recycle, setTeam, startPrestige, tryCapture, holder,
} from './game';
import { itemScore, slotOf } from './items';
import { Rng } from './rng';
import { combatPower, finalStats } from './stats';
import { emptyBonuses } from './model';
import { eligibleAffinityTypes } from './talents';

const TALENT_ORDER = ['power', 'vigor', 'power', 'vigor', 'power', 'guard', 'reflex', 'guard', 'reflex', 'guard', 'spec', 'mastery'];

export interface SimReport {
  seconds: number;
  milestones: Record<string, number>;
  teamLevels: number[];
  captures: number;
  items: number;
  finished: boolean;
}

function manage(s: GameState, rng: Rng) {
  // évolutions + talents
  for (const m of Object.values(s.mons)) {
    if (canEvolve(m)) evolve(s, m.uid);
    for (const id of TALENT_ORDER) rankUpTalent(s, m.uid, id);
    for (const id of ['power', 'vigor', 'guard', 'reflex', 'spec', 'mastery']) while (rankUpTalent(s, m.uid, id));
    // affinités (paliers 4-5) : type choisi au 1er rang, ignoré ensuite ; on prend le 1er type éligible
    for (const id of ['affinity1', 'affinity2']) {
      const exclude = Object.entries(m.talentTypeChoices).filter(([k]) => k !== id).map(([, v]) => v);
      const type = eligibleAffinityTypes(m.speciesId, exclude)[0];
      while (rankUpTalent(s, m.uid, id, type));
    }
    // paliers 6-9 : rang fixe, pas de choix
    for (const id of ['spec2', 'spec3', 'fury', 'deadly']) while (rankUpTalent(s, m.uid, id));
  }
  // équipe : les 3 plus forts
  const ranked = Object.values(s.mons).sort((a, b) => combatPower(finalStats(b, emptyBonuses())) - combatPower(finalStats(a, emptyBonuses())));
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

export function simulate(rng: Rng, maxSeconds = 6 * 3600, trace?: string[]): SimReport {
  const s = newGame();
  chooseStarter(s, STARTERS[rng.int(3)], rng);
  let t = 0;
  const milestones: Record<string, number> = {};
  const mark = (k: string) => { if (milestones[k] === undefined) milestones[k] = Math.round(t / 60); };
  let cooldown = 0; // après un boss raté, le bot farme 3 étapes avant de réessayer
  while (t < maxSeconds && !s.arenaBeaten[BIOMES.length - 1]) {
    let kind: 'stage' | 'boss' | 'arena' = 'stage';
    if (cooldown > 0) cooldown--;
    else if (arenaAvailable(s) && s.zone === 2 && s.stage >= 5) kind = 'arena';
    else if (bossAvailable(s) && !s.bossesBeaten[s.biome][s.zone] && s.stage >= 5) kind = 'boss';
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
    trace?.push(`${Math.round(t / 60)}min ${kind} z${run.zone}s${run.stage} ${run.result} lv=${s.team.map((u) => s.mons[u].level)} sp=${s.team.map((u) => s.mons[u].speciesId)}`);
    if (run.result === 'lose' && kind !== 'stage') cooldown = 3;
    if (run.result === 'win') {
      if (kind === 'boss') mark(`biome${run.biome + 1}-boss${run.zone + 1}`);
      if (kind === 'arena') mark(`biome${run.biome + 1}-badge`);
    }
    if (Object.keys(s.mons).length >= 2) mark('2e Pokémon');
    manage(s, rng);
    // 5 Poké Balls gratuites par « jour » de jeu simulé : 1 fois par heure de jeu ici
    if (Math.floor(t / 3600) > Math.floor((t - 60) / 3600)) s.balls.poke += 5;
    // un joueur efficace lance le prestige dès qu'il le peut (Champion Kanto + Pokédex complet)
    if (canPrestige(s)) {
      startPrestige(s);
      mark('prestige');
      chooseStarter(s, STARTERS2[rng.int(3)], rng);
    }
  }
  return {
    seconds: Math.round(t), milestones, teamLevels: s.team.map((u) => s.mons[u].level),
    captures: s.totals.captures, items: Object.keys(s.items).length, finished: s.arenaBeaten[BIOMES.length - 1],
  };
}
