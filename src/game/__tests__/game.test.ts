import { BIOMES, REGION_START, REGIONS, STAGES_PER_ZONE, regionLastBiome } from '../content';
import { ALL_SPECIES, EVOLUTION_CHOICES, evolutionTargets, species } from '../data';
import * as dataModule from '../data';
import {
  GameState, PENSION_XP_FALLBACK_PER_HOUR, StageRun, applyMegaCandy, craftMegaCandy, lineBase, arenaAvailable, assignExploration, assignPension, autoCaptureBall, autoEquipBest, towerRetryFloor, bestEquipCombo, maxBattleSpeed, monPower, equipGain, quickEquipValue, allyFighter, setMoves, bestStarsOf, biomeAvailable, bossAvailable,
  lineChain, equipValue, towerLootTemplates, towerSpecies, towerStart, enterTower, towerRewardPlus, claimTowerReward, TOWER_LEVEL, setRecycleCandidates, endgameUnlocked, fusableRarity, itemLevelCap, upgradeItem, hasShinyCharm, shinyCharmToAnnounce, shinyOdds, BOOSTS, BOOST_MS, UNIVERSAL_MEGA_PRICE, boostActive, boostCoverage, buyBoost, buyUniversalMega, endingReady, autoTalents, canCompleteDex, whereToFind, canEvolve, canPrestige, captureChance, captureLevel, chooseStarter, completeDex, effectivePool, equip, evolve, excessMons, fuseItems, fusionBadgeCount, fusionCandidates, genesMinForBadges, giveXp,
  harvestExploration, harvestPension, holder, isRareInZone, makeMon, addMon, makeWaves, migrateSave, monsBelowStars, monsNotShiny, newGame, pickSpecies, rankUpTalent, recycle, release, releaseBelowStars, SHARDS_PER_MIN,
  releaseExcess, releaseNotShiny, remainingEvolutions, removePension, selectStage, setAutoAdvance, START_BALLS, startPrestige,
  CAPTURE_PITY, RELEASE_CANDIES, applyMegaCandy as applyMega, lineForms, BALL_PRICE, buyBalls, autoMoves, captureTarget, setTeam, toggleLock, challengesReady, postponePrestige, idleFarmTarget, isTargeted, toggleTarget, zoneHasTarget, teamMaxLevel, tryCapture, unequipBox, xpGapMult,
  removeExploration, feedCandy, buyUniversalMegas, upgradeItemTimes, toggleTowerSet, towerDropPool, towerFocusChoices, towerPreviewItem,
  autoTeamOrder, grantDailyBalls, FREE_BALLS_PER_DAY, towerShards, towerDropPlus, TOWER_DROP_GAP, plusRecycleCandidates,
} from '../game';
import { SETS, TEMPLATES, makeItem, statText, mainValue, rarityName, recycleValue, subMax, subRange, upgradeCostFor } from '../items';
import { Item, emptyBonuses } from '../model';
import { cadence, kitContext, kitRate } from '../optimize';
import { Rng, seededRng } from '../rng';
import { eligibleAffinityTypes, spentPoints, talentPoints, talentTree } from '../talents';
import { combatPower, finalStats, monStars, xpForLevel } from '../stats';

const H = 3600_000;

function play(run: StageRun) {
  while (!run.result) {
    run.battle.runToEnd();
    run.finishWave();
  }
  return run.result;
}

function strongGame(): GameState {
  const s = newGame();
  const rng = seededRng(1);
  chooseStarter(s, 4, rng);
  giveXp(s.mons[s.team[0]], 30 * 40 * 40);
  return s;
}

test('starter niveau 5, dans l’équipe et le Pokédex', () => {
  const s = newGame();
  chooseStarter(s, 7, seededRng(1));
  const m = s.mons[s.team[0]];
  expect(m.level).toBe(5);
  expect(m.moves.length).toBeGreaterThan(0);
  expect(s.dex.caught).toContain(7);
});

test('Onix est capturable en rencontre sauvage (pas seulement Pokémon d’arène, jamais offert en capture)', () => {
  const inSomePool = BIOMES.some((b) => b.zones.some((z) => z.pool.some(([id]) => id === 95)));
  expect(inSomePool).toBe(true);
});

test('un starter niveau 5 gagne la 1re étape', () => {
  let wins = 0;
  for (let i = 0; i < 20; i++) {
    const s = newGame();
    chooseStarter(s, [1, 4, 7][i % 3], seededRng(i));
    if (play(new StageRun(s, 'stage', seededRng(100 + i))) === 'win') wins++;
  }
  expect(wins).toBeGreaterThanOrEqual(17);
});

test('étapes : victoire débloque la suivante, 5 étapes → boss, boss → zone suivante', () => {
  const s = strongGame();
  for (let i = 0; i < STAGES_PER_ZONE; i++) expect(play(new StageRun(s, 'stage', seededRng(i)))).toBe('win');
  expect(bossAvailable(s)).toBe(true);
  const boss = new StageRun(s, 'boss', seededRng(9));
  expect(play(boss)).toBe('win');
  expect(s.bossesBeaten[0][0]).toBe(true);
  expect(s.zone).toBe(1);
  expect(Object.keys(s.items).length).toBeGreaterThanOrEqual(3); // butin garanti du boss
});

describe('réglage « Avancer dans les étapes » (étape fixée)', () => {
  test('activé par défaut : une étape gagnée fait passer à la suivante', () => {
    const s = strongGame();
    expect(s.fixedStage).toBeNull();
    s.unlocked[0][0] = 5;
    s.stage = 2;
    expect(play(new StageRun(s, 'stage', seededRng(1)))).toBe('win');
    expect(s.stage).toBe(3);
  });

  test('désactivé : l’étape en cours devient l’étape fixée, une étape gagnée est rejouée, la suivante reste débloquée', () => {
    const s = strongGame();
    s.stage = 1;
    setAutoAdvance(s, false);
    expect(s.fixedStage).toBe(1);
    expect(play(new StageRun(s, 'stage', seededRng(2)))).toBe('win');
    expect(s.stage).toBe(1);
    expect(s.unlocked[0][0]).toBe(2); // la progression n'est pas bloquée, seule l'avance automatique l'est
    setAutoAdvance(s, true);
    expect(s.fixedStage).toBeNull();
  });

  test('désactivé : choisir une étape sur la Carte déplace l’étape fixée, pas le raccourci boss', () => {
    const s = strongGame();
    s.unlocked[0][0] = 5;
    s.stage = 2;
    setAutoAdvance(s, false);
    selectStage(s, 0, 0, 4);
    expect(s.fixedStage).toBe(4);
    selectStage(s, 0, 0, 5, false);
    expect(s.fixedStage).toBe(4);
  });

  test('désactivé : après un K.O. on recule d’une étape puis on regrimpe jusqu’à l’étape fixée, jamais au-delà', () => {
    const s = strongGame();
    s.unlocked[0][0] = 5;
    s.stage = 3;
    setAutoAdvance(s, false);
    // K.O. simulé : même règle qu'une défaite réelle (onStageLost)
    const weak = newGame();
    const lose = makeMon(1, 2, seededRng(1));
    addMon(weak, lose);
    weak.unlocked[0][2] = 5; weak.zone = 2; weak.stage = 1; weak.fixedStage = 3;
    expect(play(new StageRun(weak, 'stage', seededRng(3)))).toBe('lose');
    expect(weak.zone).toBe(2); // étape fixée : jamais de recul de zone
    expect(weak.stage).toBe(1);
    // l'équipe forte, elle, regrimpe de 2 à 3 et y reste
    s.stage = 2;
    expect(play(new StageRun(s, 'stage', seededRng(4)))).toBe('win');
    expect(s.stage).toBe(3);
    expect(play(new StageRun(s, 'stage', seededRng(5)))).toBe('win');
    expect(s.stage).toBe(3);
  });

  test('activé : un K.O. à l’étape 1 fait reculer d’une zone (comportement inchangé)', () => {
    const weak = newGame();
    addMon(weak, makeMon(1, 2, seededRng(1)));
    weak.unlocked[0][1] = 5; weak.unlocked[0][2] = 5; weak.zone = 2; weak.stage = 1;
    expect(play(new StageRun(weak, 'stage', seededRng(3)))).toBe('lose');
    expect(weak.zone).toBe(1);
  });
});

test('capacités « ★ Auto » : kit au moins aussi fort que celui d’une capture (modèle des recharges), puis plus rien à changer', () => {
  const s = newGame();
  chooseStarter(s, 4, seededRng(1));
  const uid = s.team[0];
  giveXp(s.mons[uid], 30 * 40 * 40); // Nv.40 : beaucoup de capacités apprises depuis la capture
  s.mons[uid].moves = [s.mons[uid].moves[0]];
  expect(autoMoves(s, uid)).toBe(true);
  const mon = s.mons[uid];
  expect(mon.moves.length).toBe(4);
  const f = allyFighter(s, uid);
  const ctx = kitContext(species(mon.speciesId).types, f.bonuses!);
  const cdf = cadence(f.stats.spe, f.bonuses!);
  const capture = makeMon(4, mon.level, seededRng(2)).moves;
  expect(kitRate(mon.moves, cdf, ctx)).toBeGreaterThanOrEqual(kitRate(capture, cdf, ctx));
  expect(autoMoves(s, uid)).toBe(false); // déjà au mieux
});

test('talents « Auto » : les Affinités vont au type qui porte les dégâts, jamais à celui d’une capacité de statut', () => {
  const s = newGame();
  const m = makeMon(131, 100, seededRng(3), false, 15); // Lokhlass : Berceuse (Normal, statut) + Glaciation, Hydrocanon, Plaquage
  addMon(s, m);
  setMoves(s, m.uid, [47, 329, 56, 34]);
  autoTalents(s, m.uid);
  expect(m.talentTypeChoices.affinity1).not.toBe('normal');
  expect(m.talentTypeChoices.affinity1).toBe(m.talentTypeChoices.affinity2);
  expect(['ice', 'water']).toContain(m.talentTypeChoices.affinity1);
});

test('talents : les descriptions arrondissent les pourcentages (4,7 × 3 = 14,1, pas 14.100000000000001)', () => {
  const tree = talentTree(['water']);
  const spec2 = tree.find((t) => t.id === 'spec2')!;
  expect(spec2.describe(spec2.perRank * 3)).toBe('Dégâts de son type +14.1 %');
});

test('autoEquipBest : déterministe, 2e appui sans effet, et aucune flèche ▲ ne le contredit ensuite', () => {
  const s = newGame();
  chooseStarter(s, 4, seededRng(1));
  const uid = s.team[0];
  giveXp(s.mons[uid], 30 * 50 * 50);
  const rng = seededRng(9);
  for (const t of towerLootTemplates().slice(0, 18)) { const it = makeItem(t.id, 4, 50, rng); s.items[it.uid] = it; }
  const before: GameState = JSON.parse(JSON.stringify(s));
  autoEquipBest(s, uid);
  const worn = (['offense', 'defense', 'berry'] as const).map((sl) => s.mons[uid].items[sl]);
  autoEquipBest(before, uid);
  expect((['offense', 'defense', 'berry'] as const).map((sl) => before.mons[uid].items[sl])).toEqual(worn); // déterministe
  expect(s.mons[uid].equipAuto?.items).toEqual(worn.map((u) => u ?? ''));
  const again = JSON.parse(JSON.stringify(s));
  expect(autoEquipBest(again, uid)).toBe(0); // même résultat au 2e appui
  // les flèches du sélecteur ne marquent ▲ aucun objet du sac (seul un objet porté par un coéquipier le pourrait)
  for (const it of Object.values(s.items)) expect(equipGain(s, uid, it)).toBeLessThanOrEqual(0.05);
});

test('autoTeamOrder (« ★ Ordre ») : même meilleur ordre quel que soit l’ordre de départ, 2e appui sans effet', () => {
  const s = newGame();
  chooseStarter(s, 4, seededRng(1));
  giveXp(s.mons[s.team[0]], 30 * 50 * 50);
  addMon(s, makeMon(143, 50, seededRng(2))); // Ronflex
  addMon(s, makeMon(65, 50, seededRng(3))); // Alakazam
  const team = [...s.team];
  expect(team).toHaveLength(3);
  const a: GameState = JSON.parse(JSON.stringify(s));
  const b: GameState = JSON.parse(JSON.stringify(s));
  b.team = [team[2], team[0], team[1]];
  const ra = autoTeamOrder(a);
  const rb = autoTeamOrder(b);
  expect(a.team).toEqual(b.team); // le résultat ne dépend pas de l'ordre de départ
  expect([...a.team].sort()).toEqual([...team].sort()); // les mêmes Pokémon
  expect(ra !== null || rb !== null).toBe(true); // deux départs différents : au moins l'un a changé
  expect(autoTeamOrder(a)).toBeNull(); // déjà le meilleur ordre
  const solo = newGame();
  chooseStarter(solo, 4, seededRng(1));
  expect(autoTeamOrder(solo)).toBeNull(); // seul : rien à ordonner
});

test('prestige reporté (« Plus tard ») : reste disponible, et le récap de la région suivante s’affichera à nouveau', () => {
  const s = newGame();
  chooseStarter(s, 4, seededRng(1));
  s.arenaBeaten[regionLastBiome(0)] = true;
  for (let id = 1; id <= 151; id++) s.dex.seen.push(id);
  expect(s.prestigeOffered).toBe(false);
  postponePrestige(s);
  expect(s.prestigeOffered).toBe(true);
  expect(canPrestige(s)).toBe(true); // toujours lançable, depuis la Carte
  expect(startPrestige(s)).toBe(true);
  expect(s.prestige).toBe(1);
  expect(s.prestigeOffered).toBe(false);
});

test('achat groupé de Balls : tout d’un coup, ou rien s’il manque des éclats', () => {
  const s = newGame();
  s.shards = BALL_PRICE.hyper * 10;
  expect(buyBalls(s, 'hyper', 100)).toBe(false); // pas assez pour 100 : rien n'est acheté
  expect(s.balls.hyper).toBe(0);
  expect(s.shards).toBe(BALL_PRICE.hyper * 10);
  expect(buyBalls(s, 'hyper', 10)).toBe(true);
  expect(s.balls.hyper).toBe(10);
  expect(s.shards).toBe(0);
});

test('badge de la Carte : boss de zone disponibles non battus + arène disponible non battue', () => {
  const s = newGame();
  expect(challengesReady(s)).toBe(0);
  s.unlocked[0][0] = STAGES_PER_ZONE; // étape 5 atteinte : boss de la zone 1 disponible
  expect(challengesReady(s)).toBe(1);
  s.bossesBeaten[0] = [true, true, true]; // 3 boss battus : l'arène devient disponible
  expect(challengesReady(s)).toBe(1);
  s.arenaBeaten[0] = true;
  expect(challengesReady(s)).toBe(0);
});

describe('verrou 🔒 et nettoyage des doublons par étoiles', () => {
  const genes = (v: number) => ({ hp: v, atk: v, def: v, spe: v });
  function teamOf3() {
    const s = newGame();
    chooseStarter(s, 4, seededRng(1));
    addMon(s, makeMon(1, 5, seededRng(50)));
    addMon(s, makeMon(7, 5, seededRng(51)));
    return s;
  }

  test('nettoyer les doublons ne relâche jamais un 4★ Nv.20 parce qu’un 2★ Nv.60 de la même espèce est en équipe', () => {
    const s = teamOf3();
    const teamMon = { ...makeMon(46, 60, seededRng(2)), genes: genes(8) }; // 2★, gros niveau
    addMon(s, teamMon);
    setTeam(s, [s.team[0], s.team[1], teamMon.uid]);
    const perfect = { ...makeMon(46, 20, seededRng(3)), genes: genes(15), locked: false }; // 4★ déverrouillé à la main
    const mid = { ...makeMon(46, 40, seededRng(4)), genes: genes(10) }; // 2★, plus de PC que le 4★
    addMon(s, perfect); addMon(s, mid);
    releaseExcess(s, { keepEvolutionMaterial: false });
    expect(s.mons[perfect.uid]).toBeDefined(); // gardé pour ses étoiles, même sans verrou
    expect(s.mons[mid.uid]).toBeUndefined();
  });

  test('à étoiles égales, le nettoyage garde les meilleurs gènes, pas le plus haut niveau', () => {
    const s = teamOf3();
    const lowLvGood = { ...makeMon(46, 10, seededRng(20)), genes: { hp: 15, atk: 15, def: 14, spe: 14 } }; // 58/60, 3★
    const highLvWorse = { ...makeMon(46, 40, seededRng(21)), genes: { hp: 13, atk: 12, def: 12, spe: 12 } }; // 49/60, 3★
    addMon(s, lowLvGood); addMon(s, highLvWorse);
    releaseExcess(s, { keepEvolutionMaterial: false });
    expect(s.mons[lowLvGood.uid]).toBeDefined();
    expect(s.mons[highLvWorse.uid]).toBeUndefined();
  });

  test('réserve d’évolution choisie parmi les pré-évolutions : jamais un Florizarre pour un Herbizarre manquant', () => {
    const s = teamOf3();
    for (let i = 0; i < 5; i++) addMon(s, { ...makeMon(1, 10, seededRng(30 + i)), genes: genes(3 + i) }); // Bulbizarre, gènes faibles
    for (let i = 0; i < 3; i++) addMon(s, { ...makeMon(3, 40, seededRng(40 + i)), genes: genes(12 + i) }); // Florizarre, bons gènes
    releaseExcess(s); // mode collectionneur : Herbizarre manquant
    const box = Object.values(s.mons).filter((m) => !s.team.includes(m.uid));
    expect(box.filter((m) => m.speciesId === 1).length).toBe(2); // 1 gardé (étage possédé) + 1 réserve pour Herbizarre
    expect(box.filter((m) => m.speciesId === 3).length).toBe(1); // aucun Florizarre gardé « en réserve »
  });

  test('évolutions à choix : un Évoli de réserve par forme manquante de la région', () => {
    const s = teamOf3();
    for (let i = 0; i < 6; i++) addMon(s, { ...makeMon(133, 10, seededRng(50 + i)), genes: genes(5) });
    addMon(s, { ...makeMon(134, 30, seededRng(60)), genes: genes(5) }); // Aquali possédé
    // Kanto : Voltali et Pyroli manquent (Mentali, Noctali… ne sont pas dans la région)
    expect(lineForms(133, 151).sort((x, y) => x - y)).toEqual([133, 134, 135, 136]);
    releaseExcess(s);
    expect(Object.values(s.mons).filter((m) => m.speciesId === 133).length).toBe(3); // 1 gardé + 2 réserves
  });

  test('un 4★ est verrouillé d’office à la capture ; un 3★ non', () => {
    const s = teamOf3();
    const perfect = { ...makeMon(46, 10, seededRng(5)), genes: genes(15) };
    const good = { ...makeMon(46, 10, seededRng(6)), genes: genes(13) };
    addMon(s, perfect); addMon(s, good);
    expect(s.mons[perfect.uid].locked).toBe(true);
    expect(s.mons[good.uid].locked).toBeUndefined();
  });

  test('un Pokémon verrouillé n’est jamais relâché ni touché par les nettoyages ou « Compléter le Pokédex »', () => {
    const s = teamOf3();
    const a = { ...makeMon(46, 10, seededRng(7)), genes: genes(3) };
    const b = { ...makeMon(46, 10, seededRng(8)), genes: genes(3) };
    const c = { ...makeMon(46, 10, seededRng(9)), genes: genes(3) };
    addMon(s, a); addMon(s, b); addMon(s, c);
    for (const m of [a, b, c]) toggleLock(s, m.uid);
    expect(release(s, a.uid)).toBe(false);
    expect(excessMons(s, { keepEvolutionMaterial: false })).toEqual([]);
    expect(monsBelowStars(s, 4).some((m) => [a.uid, b.uid, c.uid].includes(m.uid))).toBe(false);
    expect(monsNotShiny(s).some((m) => [a.uid, b.uid, c.uid].includes(m.uid))).toBe(false);
    completeDex(s); // Parasect manquant : aucun Paras verrouillé ne doit évoluer
    for (const m of [a, b, c]) expect(s.mons[m.uid].speciesId).toBe(46);
    toggleLock(s, a.uid);
    expect(s.mons[a.uid].locked).toBe(false);
    expect(release(s, a.uid)).toBe(true);
  });

  test('un méga bonbon qui rend un Pokémon parfait (4★) le verrouille', () => {
    const s = teamOf3();
    const m = { ...makeMon(46, 10, seededRng(10)), genes: { hp: 15, atk: 15, def: 15, spe: 14 } };
    addMon(s, m);
    expect(s.mons[m.uid].locked).toBeUndefined();
    s.megaCandies[46] = 1;
    expect(applyMega(s, m.uid, 'spe')).toBe(true);
    expect(s.mons[m.uid].locked).toBe(true);
  });

  test('anciennes sauvegardes : les 4★ déjà possédés sont verrouillés au chargement, un choix déjà fait est respecté', () => {
    const perfect = { ...makeMon(46, 10, seededRng(11)), genes: genes(15) };
    const unlocked = { ...makeMon(46, 10, seededRng(12)), genes: genes(15), locked: false };
    const raw = { ...newGame(), mons: { [perfect.uid]: perfect, [unlocked.uid]: unlocked } } as unknown as Record<string, unknown>;
    const out = migrateSave(raw) as unknown as GameState;
    expect(out.mons[perfect.uid].locked).toBe(true);
    expect(out.mons[unlocked.uid].locked).toBe(false);
  });
});

describe('cibles (🎯 farm de bonbons)', () => {
  test('cibler une espèce cible toute sa lignée ; un second appui retire la cible', () => {
    const s = newGame();
    toggleTarget(s, 12); // Papilusion
    expect(s.targets).toEqual([10]); // base de lignée : Chenipan
    expect(isTargeted(s, 10)).toBe(true);
    expect(isTargeted(s, 11)).toBe(true);
    expect(isTargeted(s, 13)).toBe(false);
    toggleTarget(s, 10);
    expect(s.targets).toEqual([]);
  });

  test('une zone qui contient une cible est signalée, et le hors ligne ne la quitte pas même entièrement farmée', () => {
    const s = strongGame();
    s.bossesBeaten[0][0] = true;
    for (const [id] of BIOMES[0].zones[0].pool) { s.dex.caught.push(id); s.dex.shiny.push(id); }
    s.unlocked[0][1] = 1;
    expect(idleFarmTarget(s).zone).toBe(1);
    toggleTarget(s, 10);
    expect(zoneHasTarget(s, 0, 0)).toBe(true);
    expect(zoneHasTarget(s, 0, 1)).toBe(BIOMES[0].zones[1].pool.some(([id]) => isTargeted(s, id)));
    expect(idleFarmTarget(s).zone).toBe(0);
  });

  test('capture ciblée : le 1er exemplaire va en boîte, un doublon qui n’améliore rien part en bonbons', () => {
    const s = strongGame();
    toggleTarget(s, 10);
    const offer = { speciesId: 10, level: 5, shiny: false, rare: false };
    s.missStreak = CAPTURE_PITY; // capture garantie par la pitié : test déterministe
    const first = captureTarget(s, offer, 'poke', seededRng(1), true);
    expect(first.kept).toBe(true);
    first.mon!.genes = { hp: 15, atk: 15, def: 15, spe: 15 }; // 4★ : aucun doublon ne peut faire mieux
    s.missStreak = CAPTURE_PITY;
    const ballsBefore = s.balls.poke;
    const second = captureTarget(s, offer, 'poke', seededRng(2), true);
    expect(second.kept).toBe(false);
    expect(second.candies).toBe(RELEASE_CANDIES);
    expect(s.candies[10]).toBe(RELEASE_CANDIES);
    expect(s.mons[second.mon!.uid]).toBeUndefined();
    expect(s.balls.poke).toBe(ballsBefore - 1);
    // sans conversion : tout va en boîte
    s.missStreak = CAPTURE_PITY;
    const third = captureTarget(s, offer, 'poke', seededRng(3), false);
    expect(third.kept).toBe(true);
    expect(s.mons[third.mon!.uid]).toBeDefined();
  });

  test('capture ciblée : un chromatique est toujours gardé', () => {
    const s = strongGame();
    const r = captureTarget(s, { speciesId: 10, level: 5, shiny: true, rare: false, guaranteed: true }, 'poke', seededRng(4), true);
    expect(r.kept).toBe(true);
    expect(s.mons[r.mon!.uid].shiny).toBe(true);
  });
});

test('arène battue : biome suivant débloqué, badges +1', () => {
  const s = strongGame();
  // équipe complète et costaude : un combat d'arène enchaîne 3 adversaires sans soin
  for (const sp of [1, 7]) {
    const m = makeMon(sp, 5, seededRng(sp));
    giveXp(m, 30 * 40 * 40);
    addMon(s, m);
  }
  for (let zi = 0; zi < 3; zi++) {
    for (let i = 0; i < STAGES_PER_ZONE; i++) expect(play(new StageRun(s, 'stage', seededRng(zi * 10 + i)))).toBe('win');
    expect(play(new StageRun(s, 'boss', seededRng(zi * 10 + 9)))).toBe('win');
  }
  expect(s.bossesBeaten[0].every(Boolean)).toBe(true);
  expect(biomeAvailable(s, 1)).toBe(false);
  expect(arenaAvailable(s)).toBe(true);
  const before = s.badges;
  expect(play(new StageRun(s, 'arena', seededRng(99)))).toBe('win');
  expect(s.arenaBeaten[0]).toBe(true);
  expect(s.badges).toBe(before + 1);
  expect(s.biome).toBe(1);
  expect(s.zone).toBe(0);
  expect(s.stage).toBe(1);
  expect(biomeAvailable(s, 1)).toBe(true);
  expect(s.unlocked[1][0]).toBeGreaterThanOrEqual(1);
});

test('selectStage : refuse un biome pas encore débloqué', () => {
  const s = newGame();
  chooseStarter(s, 4, seededRng(1));
  selectStage(s, 1, 0, 1);
  expect(s.biome).toBe(0); // biome 1 verrouillé : aucun changement
});

test('migrateSave : une arène déjà battue (ancienne save à plat) débloque le biome suivant', () => {
  const old = {
    unlocked: [5, 5, 5], // ancien format : plat, un seul biome implicite
    bossesBeaten: [true, true, true],
    arenaBeaten: true, // ancien format : booléen unique
  } as unknown as Record<string, unknown>;
  const migrated = migrateSave(old) as unknown as GameState;
  expect(migrated.arenaBeaten[0]).toBe(true);
  expect(migrated.unlocked[1][0]).toBeGreaterThanOrEqual(1); // biome 2, zone 1 : débloqué a posteriori
});

test('migrateSave : une save d’avant Johto (10 biomes) complète unlocked/bossesBeaten/arenaBeaten à 20, sans planter en battant le Champion Kanto', () => {
  const old = {
    unlocked: BIOMES.slice(0, 10).map((b, i) => b.zones.map(() => (i === 0 ? 1 : 0))),
    bossesBeaten: BIOMES.slice(0, 10).map((b) => b.zones.map(() => false)),
    arenaBeaten: Array(9).fill(true).concat([false]), // les 9 premiers badges Kanto en poche
    biome: 9, zone: 2, stage: 5,
  } as unknown as Record<string, unknown>;
  const migrated = { ...newGame(), ...migrateSave(old) } as unknown as GameState;
  expect(migrated.unlocked.length).toBe(BIOMES.length);
  expect(migrated.bossesBeaten.length).toBe(BIOMES.length);
  expect(migrated.arenaBeaten.length).toBe(BIOMES.length);
  // ne doit pas planter : le Champion Kanto vient d'être battu, onStageWon débloque le biome Johto suivant
  expect(() => {
    migrated.unlocked[10][0] = Math.max(1, migrated.unlocked[10][0]);
  }).not.toThrow();
});

test('migrateSave : l’ancienne pension (à job) devient l’exploration, la nouvelle pension démarre vide', () => {
  const old = {
    pension: [{ uid: 'm1', job: 'orchard', since: 123 }],
  } as unknown as Record<string, unknown>;
  const migrated = migrateSave(old) as unknown as GameState;
  expect(migrated.pension).toEqual([]);
  expect(migrated.exploration).toEqual([{ uid: 'm1', job: 'orchard', since: 123 }]);
});

test('migrateSave : une pension XP déjà en place mais sans taux calculé reçoit le taux de repli', () => {
  const old = { pension: [{ uid: 'm1', since: 123 }] } as unknown as Record<string, unknown>;
  const migrated = migrateSave(old) as unknown as GameState;
  expect(migrated.pension).toEqual([{ uid: 'm1', since: 123, xpPerHour: PENSION_XP_FALLBACK_PER_HOUR }]);
});

test('giveXp : un Pokémon déjà Nv.100 (max) n’accumule plus d’XP — la barre ne doit jamais se remplir dans le vide', () => {
  const m = makeMon(6, 100, seededRng(1), false, 15);
  const xpBefore = m.xp;
  const r = giveXp(m, 100000);
  expect(r.levels).toBe(0);
  expect(m.level).toBe(100);
  expect(m.xp).toBe(xpBefore); // inchangée, pas juste plafonnée après coup
});

test('prestige : indisponible tant que le Champion Kanto n’est pas battu, puis reset équipe/boîte/objets/badges', () => {
  const s = newGame();
  chooseStarter(s, 4, seededRng(1));
  addMon(s, makeMon(1, 50, seededRng(2), false, 15));
  s.shards = 500; s.badges = 8;
  expect(canPrestige(s)).toBe(false); // arène Kanto pas battue
  expect(startPrestige(s)).toBe(false);
  expect(s.team.length).toBe(2); // rien n'a bougé

  s.startedAt = 1; // très ancien : doit repartir de maintenant au prestige (temps passé dans la région)
  s.arenaBeaten[9] = true; // Champion Kanto battu, mais Pokédex pas complet
  expect(canPrestige(s)).toBe(false);
  for (let id = 1; id <= 151; id++) s.dex.seen.push(id);
  expect(canPrestige(s)).toBe(true);
  expect(startPrestige(s)).toBe(true);
  expect(s.mons).toEqual({});
  expect(s.team).toEqual([]);
  expect(s.items).toEqual({});
  expect(s.shards).toBe(0);
  expect(s.balls.poke).toBe(START_BALLS);
  expect(s.startedAt).toBeGreaterThan(1_000_000_000_000);
  expect(s.badges).toBe(0);
  expect(s.biome).toBe(10); // 1er biome Johto
  expect(s.unlocked[10][0]).toBeGreaterThanOrEqual(1); // sa 1re zone doit être jouable, pas verrouillée
  expect(s.starterChosen).toBe(false); // repasse par l'écran de starter (Johto)
  expect(s.prestige).toBe(1);
  expect(s.dex).toEqual({ seen: [], caught: [], shiny: [] }); // Pokédex remis à zéro (1/251 après le starter)
  expect(canPrestige(s)).toBe(false); // ne se relance pas une 2e fois

  // Johto : même règle, Champion de Johto (dernier biome de la région) + Pokédex cumulé (251) vu →
  // prestige vers la région suivante déclarée dans REGIONS (Hoenn), s'il y en a une.
  s.arenaBeaten[regionLastBiome(s.prestige)] = true;
  for (let id = 1; id <= 251; id++) s.dex.seen.push(id);
  expect(canPrestige(s)).toBe(REGIONS.length > 2);
});

test('méga bonbons : 30 bonbons de la lignée → 1 méga bonbon, +1 à un gène d’un Pokémon de la lignée, plafond 15', () => {
  const s = newGame();
  const mon = makeMon(2, 20, seededRng(1)); // Herbizarre : lignée Bulbizarre
  mon.genes = { hp: 14, atk: 15, def: 3, spe: 3 };
  addMon(s, mon);
  s.candies[1] = 29;
  expect(craftMegaCandy(s, 2)).toBe(false); // pas assez
  s.candies[1] = 65;
  expect(craftMegaCandy(s, 2)).toBe(true);
  expect(craftMegaCandy(s, 1)).toBe(true); // même lignée, depuis n'importe quel étage
  expect(s.candies[1]).toBe(5);
  expect(s.megaCandies[1]).toBe(2);
  expect(applyMegaCandy(s, mon.uid, 'atk')).toBe(false); // déjà 15
  expect(applyMegaCandy(s, mon.uid, 'hp')).toBe(true);
  expect(mon.genes.hp).toBe(15);
  expect(s.megaCandies[1]).toBe(1);
  expect(applyMegaCandy(s, mon.uid, 'hp')).toBe(false); // plafond atteint, méga bonbon non consommé
  expect(s.megaCandies[1]).toBe(1);
  const other = makeMon(4, 20, seededRng(2)); // autre lignée : aucun méga bonbon Salamèche
  addMon(s, other);
  expect(applyMegaCandy(s, other.uid, 'def')).toBe(false);
});

test('lineBase : les lignées Johto remontent à leur vraie base (pas seulement les 151 de Kanto)', () => {
  expect(lineBase(154)).toBe(152); // Méganium → Germignon
  expect(lineBase(153)).toBe(152);
  expect(lineBase(3)).toBe(1); // Kanto inchangé
});

test('migrateSave : regroupe les bonbons/méga bonbons Johto rangés sous un stade intermédiaire', () => {
  const old = { candies: { 152: 3, 153: 6, 154: 9, 1: 4 }, megaCandies: { 153: 1 } } as unknown as Record<string, unknown>;
  const migrated = migrateSave(old) as unknown as GameState;
  expect(migrated.candies).toEqual({ 152: 18, 1: 4 });
  expect(migrated.megaCandies).toEqual({ 152: 1 });
});

test('migrateSave : nettoie les uid fantômes de l’équipe (Pokémon relâché/supprimé jamais retiré de team)', () => {
  const old = {
    team: ['m1', 'ghost1', 'm1', 'ghost2'], // doublon + fantômes, comme un vieux bug aurait pu en laisser
    mons: { m1: { uid: 'm1' } },
  } as unknown as Record<string, unknown>;
  const migrated = migrateSave(old) as unknown as GameState;
  expect(migrated.team).toEqual(['m1']); // fantômes et doublon retirés : l’équipe redevient ajoutable
});

/**
 * Courbe de niveau documentée dans BIOMES.md (calcul § « Courbe de niveau ») : niveau de fin de
 * chaque biome codé jusqu'ici. L'arène doit y arriver pile (max du `team`), et le biome suivant doit
 * démarrer pile là où le précédent finit — sinon toute la suite de la courbe dérive.
 */
const DOCUMENTED_END_LEVELS = [18, 30, 35, 43, 61, 66, 73, 78, 90, 100];
/** Indices de biome qui redémarrent une courbe de niveau à zéro (premier biome de chaque région de prestige,
 * après avoir fini la région précédente) : la continuité avec le biome précédent ne s'applique pas à ceux-là. */
const RESET_BOUNDARIES = new Set(REGION_START.slice(1));

test('courbe de niveau : chaque biome codé monte jusqu’au niveau documenté dans BIOMES.md, sans rupture avec le suivant', () => {
  BIOMES.forEach((b, i) => {
    expect(b.zones[0].minLv).toBeLessThanOrEqual(b.zones[1].minLv);
    expect(b.zones[1].minLv).toBeLessThanOrEqual(b.zones[2].minLv);
    const arenaMaxLv = Math.max(...b.arena.team.map(([, lv]) => lv));
    expect(arenaMaxLv).toBeGreaterThanOrEqual(b.zones[2].maxLv);
    if (i < DOCUMENTED_END_LEVELS.length) expect(arenaMaxLv).toBe(DOCUMENTED_END_LEVELS[i]);
    if (i > 0 && !RESET_BOUNDARIES.has(i)) {
      expect(b.zones[0].minLv).toBe(Math.max(...BIOMES[i - 1].arena.team.map(([, lv]) => lv)));
    }
  });
});

test('biome 3 : Magnéti/Voltorbe/Élektek/Voltali/Rondoudou/Canarticho/Krabby/Évoli capturables en rencontre sauvage', () => {
  const required = [81, 100, 125, 135, 39, 83, 98, 133];
  const inSomePool = (id: number) => BIOMES[2].zones.some((z) => z.pool.some(([sid]) => sid === id));
  for (const id of required) expect(inSomePool(id)).toBe(true);
});

test('biome 4 : Noeunoeuf/Saquedeneu/Insécateur/Scarabrute/Mélofée/Miaouss/Excelangue/Poissirène capturables en rencontre sauvage', () => {
  const required = [102, 114, 123, 127, 35, 52, 108, 118];
  const inSomePool = (id: number) => BIOMES[3].zones.some((z) => z.pool.some(([sid]) => sid === id));
  for (const id of required) expect(inSomePool(id)).toBe(true);
});

test('biome 5 : Nosferapti/Tadmorv/Smogo/Fantominus/Leveinard/Stari capturables en rencontre sauvage', () => {
  const required = [41, 88, 109, 92, 113, 120];
  const inSomePool = (id: number) => BIOMES[4].zones.some((z) => z.pool.some(([sid]) => sid === id));
  for (const id of required) expect(inSomePool(id)).toBe(true);
});

test('biome 6 : Soporifik/Férosinge/Machoc/Kicklee/Tygnon/Kangourex/Tauros capturables en rencontre sauvage', () => {
  const required = [96, 56, 66, 106, 107, 115, 128];
  const inSomePool = (id: number) => BIOMES[5].zones.some((z) => z.pool.some(([sid]) => sid === id));
  for (const id of required) expect(inSomePool(id)).toBe(true);
});

test('biome 7 : Goupix/Caninos/Ponyta/Magmar/Pyroli/Lippoutou/Hypotrempe capturables en rencontre sauvage', () => {
  const required = [37, 58, 77, 126, 136, 124, 116];
  const inSomePool = (id: number) => BIOMES[6].zones.some((z) => z.pool.some(([sid]) => sid === id));
  for (const id of required) expect(inSomePool(id)).toBe(true);
});

test('biome 8 : Sabelette/Taupiqueur/Osselait/Rhinocorne/Doduo/Magicarpe capturables en rencontre sauvage', () => {
  const required = [27, 50, 104, 111, 84, 129];
  const inSomePool = (id: number) => BIOMES[7].zones.some((z) => z.pool.some(([sid]) => sid === id));
  for (const id of required) expect(inSomePool(id)).toBe(true);
});

test('biomes 9-10 : fossiles/Ronflex/Lokhlass/Minidraco/M. Mime/Métamorph/Porygon capturables en rencontre sauvage', () => {
  const required = [138, 140, 142, 143, 147, 131, 122, 132, 137];
  const inSomePool = (id: number) => [...BIOMES[8].zones, ...BIOMES[9].zones].some((z) => z.pool.some(([sid]) => sid === id));
  for (const id of required) expect(inSomePool(id)).toBe(true);
});

test('biomes 9-10 : Artikodin/Électhor/Sulfura/Mewtwo/Mew rejoignent le pool de leur zone une fois vaincus', () => {
  const legendaries = [144, 145, 146, 150, 151];
  const bosses = [...BIOMES[8].zones, ...BIOMES[9].zones].map((z) => z.boss);
  for (const id of legendaries) {
    const boss = bosses.find((b) => b.speciesId === id);
    expect(boss?.joinsPool).toBe(true);
  }
});

test('un combat de boss n’est jamais chromatique, qu’il rejoigne le pool ensuite ou non', () => {
  const alwaysShiny: Rng = { int: () => 0 };
  const joinsPoolWaves = makeWaves('boss', 8, 1, 1, alwaysShiny); // biome 9, zone Artikodin (joinsPool)
  expect(joinsPoolWaves[0][0].mon.shiny).toBe(false);
  const classicWaves = makeWaves('boss', 0, 0, 1, alwaysShiny); // biome 1, zone Lisière (boss classique)
  expect(classicWaves[0][0].mon.shiny).toBe(false);
});

test.each(REGIONS.map((r, i) => [r.name, i] as const))(
  'couverture %s : tout le Pokédex cumulé est obtenable (et chromatisable) dans les seuls biomes de la région',
  (_name, p) => {
    // la Carte masque les régions précédentes après un prestige : chaque région doit se suffire à
    // elle-même. On ne place que les formes de base / sans évolution, les évolutions par niveau suivent.
    const region = REGIONS[p];
    const biomes = BIOMES.slice(region.start, REGIONS[p + 1]?.start ?? BIOMES.length);
    const dex = ALL_SPECIES.filter((s) => s.id <= region.dexMax);
    const targets = new Set(dex.flatMap((s) => evolutionTargets(s.id, region.dexMax).filter((t) => t !== s.id && (s.evolvesTo || EVOLUTION_CHOICES[s.id]))));
    const mustPlace = dex.filter((s) => !targets.has(s.id)).map((s) => s.id);
    const wildPool = new Set(biomes.flatMap((b) => b.zones.flatMap((z) => z.pool.map(([id]) => id))));
    const poolBosses = new Set(biomes.flatMap((b) => b.zones.filter((z) => z.boss.joinsPool).map((z) => z.boss.speciesId)));
    expect(mustPlace.filter((id) => !wildPool.has(id) && !poolBosses.has(id))).toEqual([]);
    // et rien d'une génération suivante (pas de fuite vers une région pas encore débloquée)
    const used = biomes.flatMap((b) => [...b.zones.flatMap((z) => [...z.pool.map(([id]) => id), z.boss.speciesId]), ...b.arena.team.map(([id]) => id)]);
    expect(used.filter((id) => id > region.dexMax)).toEqual([]);
  },
);

test('effectivePool : le boss rejoint le pool sauvage une fois vaincu, pas avant', () => {
  const zone = BIOMES[8].zones[1]; // Artikodin (joinsPool)
  expect(effectivePool(zone, false)).toEqual(zone.pool);
  expect(effectivePool(zone, true)).toEqual([...zone.pool, [144, 20]]); // légendaires de Kanto : poids 20 (chasse aux chromatiques)
  expect(isRareInZone(zone, 144, true)).toBe(false); // poids 20 : plus « rare » (capture normale)
});

test('pickSpecies peut tirer le boss vaincu comme un sauvage ordinaire de sa zone, pas avant', () => {
  const zone = BIOMES[8].zones[1]; // Artikodin
  const total = zone.pool.reduce((a, [, w]) => a + w, 0);
  const landOnBoss: Rng = { int: () => total }; // total + poids du boss (6) : total..total+5 → Artikodin
  expect(pickSpecies(zone, landOnBoss, false)).toBe(zone.pool[0][0]); // sans le boss : retombe sur le pool
  expect(pickSpecies(zone, landOnBoss, true)).toBe(144); // avec le boss dans le pool : peut le tirer
});

test('remainingEvolutions : 0 pour une forme finale, 1/2 pour Paras/Aspicot', () => {
  expect(remainingEvolutions(47)).toBe(0); // Parasect, forme finale
  expect(remainingEvolutions(46)).toBe(1); // Paras → Parasect
  expect(remainingEvolutions(13)).toBe(2); // Aspicot → Coconfort → Dardargnan
});

test('excessMons / releaseExcess : garde 1 exemplaire par étage possédé + 1 de réserve par étage manquant, chromatique à part', () => {
  const s = newGame();
  chooseStarter(s, 4, seededRng(1));
  addMon(s, makeMon(1, 5, seededRng(50))); // complète l'équipe à 3 pour que les Paras aillent en boîte
  addMon(s, makeMon(7, 5, seededRng(51)));
  // Parasect (évolution de Paras) jamais possédé : garde 1 Paras (déjà possédé) + 1 de réserve (étage
  // manquant) = 2, par quota séparé normal/chromatique — même calcul que l'ancienne formule quand rien
  // n'est encore évolué.
  for (let i = 0; i < 5; i++) addMon(s, makeMon(46, 10 + i, seededRng(i), false));
  for (let i = 0; i < 3; i++) addMon(s, makeMon(46, 10 + i, seededRng(100 + i), true));
  const before = Object.keys(s.mons).length;
  const excess = excessMons(s);
  expect(excess.length).toBe(5 - 2 + (3 - 2)); // 3 normaux + 1 chromatique en trop
  expect(excess.every((m) => !s.team.includes(m.uid))).toBe(true);
  const cp = (m: (typeof excess)[number]) => combatPower(finalStats(m, emptyBonuses()));
  const normalKept = Object.values(s.mons).filter((m) => m.speciesId === 46 && !m.shiny && !excess.includes(m));
  expect(normalKept.length).toBe(2);
  // les meilleurs sont gardés : total des gènes d'abord, puis PC
  const q = (m: (typeof excess)[number]) => (m.genes.hp + m.genes.atk + m.genes.def + m.genes.spe) * 1e6 + cp(m);
  expect(Math.min(...normalKept.map(q))).toBeGreaterThanOrEqual(Math.max(...excess.filter((m) => !m.shiny).map(q)));
  const r = releaseExcess(s);
  expect(r.count).toBe(excess.length);
  expect(r.candies).toBe(excess.length * 3);
  expect(Object.keys(s.mons).length).toBe(before - excess.length);
});

test('excessMons : les étages déjà possédés séparément (évolutions déjà réalisées) ne comptent plus comme manquants', () => {
  // Retour d'Arno : Roucool + Roucoups + Roucarnage déjà possédés chacun séparément → ne garder qu'1
  // seul Roucool en trop, pas plusieurs « juste au cas où » puisque la lignée est déjà complète.
  const s = newGame();
  chooseStarter(s, 4, seededRng(1));
  addMon(s, makeMon(1, 5, seededRng(50)));
  addMon(s, makeMon(7, 5, seededRng(51)));
  addMon(s, makeMon(17, 15, seededRng(1))); // Roucoups déjà possédé
  addMon(s, makeMon(18, 20, seededRng(2))); // Roucarnage déjà possédé
  for (let i = 0; i < 4; i++) addMon(s, makeMon(16, 10 + i, seededRng(10 + i))); // 4 Roucool
  const excess = excessMons(s);
  const roucoolExcess = excess.filter((m) => m.speciesId === 16);
  expect(roucoolExcess.length).toBe(3); // garde 1 seul Roucool (lignée déjà complète par ailleurs)
  expect(excess.some((m) => m.speciesId === 17 || m.speciesId === 18)).toBe(false); // Roucoups/Roucarnage jamais en trop (1 seul exemplaire chacun)
});

test('excessMons : chromatique — garde de la matière pour chaque étage manquant de la lignée (bug rapporté par Arno)', () => {
  // 14 Bulbizarre chromatiques, aucun Herbizarre/Florizarre chromatique → 2 étages manquants + 1 déjà
  // possédé (Bulbizarre lui-même) = garde 3, relâche les 11 autres. Les Bulbizarre/Herbizarre/Florizarre
  // NORMAUX déjà possédés par ailleurs ne doivent jamais influencer le quota chromatique (à part).
  const s = newGame();
  chooseStarter(s, 4, seededRng(1)); // starter Bulbizarre normal (déjà possédé, quota séparé)
  addMon(s, makeMon(1, 5, seededRng(50)));
  addMon(s, makeMon(7, 5, seededRng(51))); // équipe complète à 3
  addMon(s, makeMon(2, 16, seededRng(52))); // Herbizarre normal déjà possédé
  addMon(s, makeMon(3, 32, seededRng(53))); // Florizarre normal déjà possédé
  for (let i = 0; i < 14; i++) addMon(s, makeMon(1, 10 + i, seededRng(100 + i), true));
  const excess = excessMons(s);
  const bulbaChroExcess = excess.filter((m) => m.speciesId === 1 && m.shiny);
  expect(bulbaChroExcess.length).toBe(11);
  const bulbaChroKept = Object.values(s.mons).filter((m) => m.speciesId === 1 && m.shiny && !excess.includes(m));
  expect(bulbaChroKept.length).toBe(3);
  expect(excess.some((m) => !m.shiny)).toBe(false); // les normaux (déjà complets) ne sont jamais concernés ici
});

test('excessMons : mode léger (keepEvolutionMaterial: false) ne garde aucune matière de réserve', () => {
  const s = newGame();
  chooseStarter(s, 4, seededRng(1));
  addMon(s, makeMon(1, 5, seededRng(50)));
  addMon(s, makeMon(7, 5, seededRng(51)));
  for (let i = 0; i < 14; i++) addMon(s, makeMon(1, 10 + i, seededRng(100 + i), true));
  const excessLight = excessMons(s, { keepEvolutionMaterial: false });
  const keptLight = Object.values(s.mons).filter((m) => m.speciesId === 1 && m.shiny && !excessLight.includes(m));
  expect(keptLight.length).toBe(1); // aucune réserve pour Herbizarre/Florizarre chromatiques manquants
  expect(excessLight.length).toBe(13);
});

test('excessMons : protège les Pokémon postés en pension ou en exploration', () => {
  const s = newGame();
  chooseStarter(s, 4, seededRng(1));
  addMon(s, makeMon(1, 5, seededRng(50)));
  addMon(s, makeMon(7, 5, seededRng(51)));
  const g = (v: number) => ({ hp: v, atk: v, def: v, spe: v });
  const a = { ...makeMon(46, 10, seededRng(1), false), genes: g(14) }; addMon(s, a); // posté en pension, meilleurs gènes
  const b = { ...makeMon(46, 11, seededRng(2), false), genes: g(5) }; addMon(s, b);
  const c = { ...makeMon(46, 12, seededRng(3), false), genes: g(5) }; addMon(s, c);
  const d = { ...makeMon(46, 13, seededRng(4), false), genes: g(12) }; addMon(s, d); // meilleurs gènes de la boîte, gardé en réserve
  s.pension.push({ uid: a.uid, since: 0, xpPerHour: 10 });
  const excess = excessMons(s);
  expect(excess.some((m) => m.uid === a.uid)).toBe(false); // protégé (posté en pension)
  expect(excess.some((m) => m.uid === d.uid)).toBe(false); // gardé en réserve (Parasect toujours manquant)
  expect(excess.some((m) => m.uid === b.uid)).toBe(true);
  expect(excess.some((m) => m.uid === c.uid)).toBe(true);
});

test('chooseStarter : équipe le starter avec la panoplie du 1er biome de la région courante (jamais une panoplie Kanto en Johto)', () => {
  const kanto = newGame();
  chooseStarter(kanto, 4, seededRng(1));
  const kantoMon = kanto.mons[kanto.team[0]];
  const kantoSet = SETS[TEMPLATES.find((t) => t.id === kanto.items[kantoMon.items.offense!].templateId)!.set!];
  expect(kantoSet.biome).toBe(0);

  const johto = newGame();
  johto.prestige = 1;
  chooseStarter(johto, 152, seededRng(1));
  const johtoMon = johto.mons[johto.team[0]];
  const johtoSet = SETS[TEMPLATES.find((t) => t.id === johto.items[johtoMon.items.offense!].templateId)!.set!];
  expect(johtoSet.biome).toBe(10);
});

test('unequipBox : retire les objets des Pokémon de la boîte, jamais de l’équipe', () => {
  const s = newGame();
  chooseStarter(s, 4, seededRng(1));
  addMon(s, makeMon(1, 5, seededRng(50)));
  addMon(s, makeMon(7, 5, seededRng(51))); // complète l'équipe à 3
  const other = makeMon(10, 5, seededRng(2));
  addMon(s, other); // équipe pleine : va en boîte
  const item = makeItem('griffe-sylve', 0, 5, seededRng(3));
  s.items[item.uid] = item;
  equip(s, other.uid, item.uid);
  const teamItems = Object.keys(s.mons[s.team[0]].items).length;
  const n = unequipBox(s);
  expect(n).toBe(1);
  expect(s.mons[other.uid].items).toEqual({});
  expect(Object.keys(s.mons[s.team[0]].items).length).toBe(teamItems); // équipe intacte
  expect(s.items[item.uid]).toBeDefined(); // reste dans le sac
});

test('autoEquipBest : équipe le meilleur objet libre par emplacement, ne vole jamais un objet porté par un autre Pokémon', () => {
  const s = newGame();
  chooseStarter(s, 4, seededRng(1)); // starter déjà équipé de la panoplie sylve (rareté 0)
  const teammate = makeMon(1, 5, seededRng(50)); addMon(s, teammate);
  addMon(s, makeMon(7, 5, seededRng(51))); // équipe complète à 3
  const starterUid = s.team[0];

  // objet offensif bien plus fort (rareté 5), mais porté par un coéquipier : jamais volé
  const stolenCandidate = makeItem('gantelet-champion', 5, 50, seededRng(2));
  s.items[stolenCandidate.uid] = stolenCandidate;
  equip(s, teammate.uid, stolenCandidate.uid);

  // objet offensif libre, meilleur que celui du starter mais moins bon que le volé
  const freeUpgrade = makeItem('griffe-cendres', 3, 30, seededRng(3));
  s.items[freeUpgrade.uid] = freeUpgrade;

  const n = autoEquipBest(s, starterUid);
  expect(n).toBeGreaterThan(0);
  expect(s.mons[starterUid].items.offense).toBe(freeUpgrade.uid);
  expect(s.mons[teammate.uid].items.offense).toBe(stolenCandidate.uid); // jamais volé
});

test('autoEquipBest : rien à faire → 0 emplacement modifié', () => {
  const s = newGame();
  chooseStarter(s, 4, seededRng(1));
  expect(autoEquipBest(s, s.team[0])).toBe(0); // rien d'autre dans le sac que ce qu'il porte déjà
});

test('autoEquipBest : privilégie une panoplie complète si son total (objets + bonus de set) dépasse le meilleur combo dépareillé', () => {
  const s = newGame();
  chooseStarter(s, 4, seededRng(1));
  addMon(s, makeMon(1, 5, seededRng(50)));
  addMon(s, makeMon(7, 5, seededRng(51))); // équipe complète à 3
  const lone = makeMon(10, 5, seededRng(4)); addMon(s, lone); // en boîte, sans objet

  // panoplie Sylvestre (3 pièces) : Attaque plus faible à l'offensif que Marée Vivante, mais bien
  // meilleure en défense — le total (dont le bonus 3 pièces) doit l'emporter sur le mélange dépareillé.
  for (const id of ['griffe-sylve', 'cape-sylve', 'baie-sylve']) {
    const it = makeItem(id, 0, 1, seededRng(10));
    s.items[it.uid] = it;
  }
  for (const id of ['nageoire-maree', 'ecaille-maree', 'baie-maree']) {
    const it = makeItem(id, 0, 1, seededRng(20));
    s.items[it.uid] = it;
  }

  const wornSets = bestEquipCombo(s, lone.uid, quickEquipValue).map((it) => TEMPLATES.find((t) => t.id === it!.templateId)?.set);
  expect(wornSets).toEqual(['sylve', 'sylve', 'sylve']);
});

test('releaseBelowStars / releaseNotShiny : ne gardent que le critère demandé dans la boîte', () => {
  const s = newGame();
  chooseStarter(s, 4, seededRng(1));
  addMon(s, makeMon(1, 5, seededRng(50)));
  addMon(s, makeMon(7, 5, seededRng(51)));
  const weak = { ...makeMon(46, 10, seededRng(1), false), genes: { hp: 0, atk: 0, def: 0, spe: 0 } }; // 1★
  const strong = { ...makeMon(46, 10, seededRng(2), false), genes: { hp: 13, atk: 13, def: 13, spe: 13 } }; // 3★ (un 4★ serait verrouillé d'office)
  const shiny = { ...makeMon(48, 10, seededRng(3), true), genes: { hp: 15, atk: 15, def: 15, spe: 15 } }; // 4★, pour isoler le critère chromatique du critère étoiles
  addMon(s, weak); addMon(s, strong); addMon(s, shiny);

  expect(monsBelowStars(s, 3).map((m) => m.uid).sort()).toEqual([weak.uid].sort());
  const rBelow = releaseBelowStars(s, 3);
  expect(rBelow.count).toBe(1);
  expect(s.mons[weak.uid]).toBeUndefined();
  expect(s.mons[strong.uid]).toBeDefined();

  expect(monsNotShiny(s).some((m) => m.uid === shiny.uid)).toBe(false);
  const rShiny = releaseNotShiny(s);
  expect(rShiny.count).toBeGreaterThan(0);
  expect(s.mons[shiny.uid]).toBeDefined();
  expect(s.mons[strong.uid]).toBeUndefined();
});

test('completeDex : évolue le minimum de doublons pour compléter une lignée, en gardant 1 exemplaire de chaque étage déjà possédé', () => {
  const s = newGame();
  chooseStarter(s, 4, seededRng(1));
  addMon(s, makeMon(1, 5, seededRng(50)));
  addMon(s, makeMon(7, 5, seededRng(51)));
  // 14 Roucool (id 16) Nv.70, largement au-dessus des niveaux d'évolution de la lignée
  for (let i = 0; i < 14; i++) addMon(s, makeMon(16, 70, seededRng(i)));
  const n = completeDex(s);
  expect(n).toBeGreaterThan(0);
  const own = (id: number) => Object.values(s.mons).some((m) => m.speciesId === id && !m.shiny);
  expect(own(16)).toBe(true); // Roucool
  expect(own(17)).toBe(true); // Roucoups
  expect(own(18)).toBe(true); // Roucarnage
  // relancer ne fait plus rien : la lignée est déjà complète
  expect(completeDex(s)).toBe(0);
});

test('canCompleteDex : ne modifie jamais s, reflète si completeDex aurait quelque chose à faire', () => {
  const s = newGame();
  chooseStarter(s, 4, seededRng(1));
  addMon(s, makeMon(1, 5, seededRng(50)));
  addMon(s, makeMon(7, 5, seededRng(51)));
  expect(canCompleteDex(s)).toBe(false); // rien à évoluer
  for (let i = 0; i < 3; i++) addMon(s, makeMon(16, 70, seededRng(100 + i))); // 3 Roucool
  const before = JSON.stringify(s.mons);
  expect(canCompleteDex(s)).toBe(true);
  expect(JSON.stringify(s.mons)).toBe(before); // dryRun : aucune mutation
  completeDex(s);
  expect(canCompleteDex(s)).toBe(false); // lignée désormais complète
});

test('lignée à branches : Voltali partage la base d’Évoli (bonbons, cibles), anciennes sauvegardes regroupées', () => {
  expect(lineBase(135)).toBe(133);
  expect(lineBase(475)).toBe(280); // Gallame → Tarsal
  const s = newGame();
  toggleTarget(s, 135);
  expect(isTargeted(s, 133)).toBe(true); // cibler Voltali fait capturer les Évoli
  const raw = { ...newGame(), candies: { 135: 30, 133: 6 }, targets: [135, 136] } as unknown as Record<string, unknown>;
  const out = migrateSave(raw) as unknown as GameState;
  expect(out.candies).toEqual({ 133: 36 });
  expect(out.targets).toEqual([133]);
});

test('bestStarsOf : 0 si jamais capturé, sinon le meilleur exemplaire possédé', () => {
  const s = newGame();
  expect(bestStarsOf(s, 46, false)).toBe(0);
  addMon(s, { ...makeMon(46, 10, seededRng(1)), genes: { hp: 0, atk: 0, def: 0, spe: 0 } }); // 1★
  expect(bestStarsOf(s, 46, false)).toBe(1);
  addMon(s, { ...makeMon(46, 10, seededRng(2)), genes: { hp: 15, atk: 15, def: 15, spe: 15 } }); // 4★
  expect(bestStarsOf(s, 46, false)).toBe(4);
});

test('bestStarsOf : normal et chromatique comptés à part (un chromatique 3★ n’empêche pas d’améliorer le normal 1★)', () => {
  const s = newGame();
  addMon(s, { ...makeMon(25, 10, seededRng(1), true), genes: { hp: 13, atk: 13, def: 13, spe: 13 } }); // Pikachu chromatique 3★
  addMon(s, { ...makeMon(25, 10, seededRng(2), false), genes: { hp: 0, atk: 0, def: 0, spe: 0 } }); // Pikachu normal 1★
  expect(bestStarsOf(s, 25, true)).toBe(3);
  expect(bestStarsOf(s, 25, false)).toBe(1); // l'offre normale reste « sous 3★ » : capture auto d'amélioration active
  // cible : un nouveau Pikachu normal 3★ (8 badges : gènes ≥ 12) bat le normal 1★ → gardé en boîte, pas converti,
  // même si le chromatique est déjà 3★
  s.badges = 8;
  s.missStreak = CAPTURE_PITY;
  const r = captureTarget(s, { speciesId: 25, level: 10, shiny: false, rare: false }, 'poke', seededRng(3), true);
  expect(monStars(r.mon!)).toBeGreaterThanOrEqual(3);
  expect(r.kept).toBe(true);
});

test('autoCaptureBall : la plus forte ou la moins chère selon le réglage, null si aucune Ball', () => {
  const s = newGame();
  s.balls = { poke: 0, super: 1, hyper: 1 };
  expect(autoCaptureBall(s, true)).toBe('hyper');
  expect(autoCaptureBall(s, false)).toBe('super'); // poke à 0, donc la super (moins chère dispo)
  s.balls = { poke: 0, super: 0, hyper: 0 };
  expect(autoCaptureBall(s, true)).toBeNull();
});

test('défaite : on recule d’une étape', () => {
  const s = newGame();
  chooseStarter(s, 4, seededRng(1));
  s.unlocked[0][0] = 5; s.stage = 5;
  s.mons[s.team[0]].level = 2; s.mons[s.team[0]].xp = 120;
  const r = play(new StageRun(s, 'stage', seededRng(3)));
  expect(r).toBe('lose');
  expect(s.stage).toBe(4);
});

test('xpGapMult : borné [0.5, 2], +0,2 par niveau d’écart', () => {
  expect(xpGapMult(5, 5)).toBeCloseTo(1);
  expect(xpGapMult(6, 9)).toBeCloseTo(1.6); // Aspicot Nv.6 contre des Nv.9
  expect(xpGapMult(5, 10)).toBeCloseTo(2); // écart de 5 : clampé à 2
  expect(xpGapMult(10, 5)).toBeCloseTo(0.5); // 3 niveaux au-dessus ou plus : clampé à 0.5
});

test('XP de vague pondérée par l’écart de niveau : le retardataire gagne plus que l’avance', () => {
  const s = newGame();
  chooseStarter(s, 4, seededRng(1));
  const low = makeMon(1, 2, seededRng(2)); // très en retard sur la zone (Nv 3-6)
  const high = makeMon(7, 8, seededRng(3)); // déjà au-dessus de la zone
  addMon(s, low);
  addMon(s, high);
  const run = new StageRun(s, 'stage', seededRng(5));
  run.battle.runToEnd();
  const rewards = run.finishWave()!;
  expect(rewards.xp[low.uid]).toBeGreaterThan(rewards.xp[high.uid]);
});

test('capture : Balls consommées, espèce rare 2× plus dure, boss garanti', () => {
  const s = newGame();
  chooseStarter(s, 4, seededRng(1));
  expect(captureChance({ speciesId: 25, level: 5, shiny: false, rare: true }, 'poke')).toBe(15);
  expect(captureChance({ speciesId: 14, level: 8, shiny: false, rare: false, guaranteed: true }, 'poke')).toBe(100);
  const before = s.balls.poke;
  let caught = 0;
  for (let i = 0; i < 10; i++) if (tryCapture(s, { speciesId: 10, level: 4, shiny: false, rare: false }, 'hyper', seededRng(i))) caught++;
  expect(caught).toBe(0); // pas d'Hyper Ball en stock
  for (let i = 0; i < 10; i++) if (tryCapture(s, { speciesId: 10, level: 4, shiny: false, rare: false }, 'poke', seededRng(i))) caught++;
  expect(s.balls.poke).toBe(before - 10);
  expect(caught).toBeGreaterThan(0);
  expect(s.team.length).toBe(3); // les captures remplissent l'équipe
});

test('genesMinForBadges : plancher de qualité qui monte avec les badges (jamais redescend en repartant farmer un biome antérieur)', () => {
  expect(genesMinForBadges(0)).toBe(0);
  expect(genesMinForBadges(3)).toBe(0);
  expect(genesMinForBadges(4)).toBe(8);
  expect(genesMinForBadges(7)).toBe(8);
  expect(genesMinForBadges(8)).toBe(12);
  expect(genesMinForBadges(10)).toBe(12);
});

test('capture : le plancher de gènes par badge garantit au moins 2★ dès 4 badges, 3★ dès 8', () => {
  const s = newGame();
  chooseStarter(s, 4, seededRng(1));
  s.badges = 8;
  s.balls.poke = 50;
  let mon: ReturnType<typeof tryCapture> = null;
  for (let i = 0; i < 50 && !mon; i++) mon = tryCapture(s, { speciesId: 10, level: 4, shiny: false, rare: false }, 'poke', seededRng(i));
  expect(mon).not.toBeNull();
  expect(Math.min(mon!.genes.hp, mon!.genes.atk, mon!.genes.def, mon!.genes.spe)).toBeGreaterThanOrEqual(12);
  expect(monStars(mon!)).toBeGreaterThanOrEqual(3);

  s.badges = 4;
  s.balls.poke = 50;
  mon = null;
  for (let i = 0; i < 50 && !mon; i++) mon = tryCapture(s, { speciesId: 10, level: 4, shiny: false, rare: false }, 'poke', seededRng(100 + i));
  expect(mon).not.toBeNull();
  expect(Math.min(mon!.genes.hp, mon!.genes.atk, mon!.genes.def, mon!.genes.spe)).toBeGreaterThanOrEqual(8);
  expect(monStars(mon!)).toBeGreaterThanOrEqual(2);
});

test('capture plafonnée au niveau du meilleur Pokémon de l’équipe', () => {
  const s = newGame();
  chooseStarter(s, 4, seededRng(1)); // starter Nv.5
  expect(teamMaxLevel(s)).toBe(5);
  const offer = { speciesId: 10, level: 9, shiny: false, rare: false };
  expect(captureLevel(s, offer)).toBe(5); // plafonné, jamais le niveau de l'offre
  s.balls.poke = 1;
  let mon: ReturnType<typeof tryCapture> = null;
  for (let i = 0; i < 20 && !mon; i++) mon = tryCapture(s, offer, 'poke', seededRng(i));
  expect(mon).not.toBeNull();
  expect(mon!.level).toBe(5);

  // offre sous le plafond : le niveau de l'offre est conservé tel quel
  const lowOffer = { speciesId: 10, level: 3, shiny: false, rare: false };
  expect(captureLevel(s, lowOffer)).toBe(3);

  // capture garantie (boss) : même plafond
  const bossOffer = { speciesId: 12, level: 11, shiny: false, rare: false, guaranteed: true };
  const boss = tryCapture(s, bossOffer, null, seededRng(1));
  expect(boss!.level).toBe(5);
});

test('évolution au niveau, talents par paliers', () => {
  const s = newGame();
  chooseStarter(s, 4, seededRng(1));
  const m = s.mons[s.team[0]];
  expect(canEvolve(m)).toBe(false);
  giveXp(m, 30 * 16 * 16);
  expect(canEvolve(m)).toBe(true);
  evolve(s, m.uid);
  expect(m.speciesId).toBe(5);
  // palier 3 bloqué tant que 10 points ne sont pas dépensés
  expect(rankUpTalent(s, m.uid, 'spec')).toBe(false);
  for (let i = 0; i < 5; i++) expect(rankUpTalent(s, m.uid, 'power')).toBe(true);
  expect(rankUpTalent(s, m.uid, 'power')).toBe(false); // rang max
  for (let i = 0; i < 5; i++) rankUpTalent(s, m.uid, 'vigor');
  expect(rankUpTalent(s, m.uid, 'spec')).toBe(true);
});

test('rankUpTalent : palier 4 (talent « au choix ») exige un type éligible au 1er rang, figé ensuite', () => {
  const s = newGame();
  const dracaufeu = makeMon(6, 60, seededRng(9)); // Nv.60 → 59 points de talent, largement assez
  addMon(s, dracaufeu);
  const uid = dracaufeu.uid;
  const m = s.mons[uid];
  // 20 points dans les paliers 1-3 pour débloquer le palier 4
  for (let i = 0; i < 5; i++) rankUpTalent(s, uid, 'power');
  for (let i = 0; i < 5; i++) rankUpTalent(s, uid, 'vigor');
  for (let i = 0; i < 5; i++) rankUpTalent(s, uid, 'guard');
  for (let i = 0; i < 5; i++) rankUpTalent(s, uid, 'reflex');
  expect(spentPoints(m.talents)).toBe(20);

  expect(rankUpTalent(s, uid, 'affinity1')).toBe(false); // aucun type fourni
  expect(rankUpTalent(s, uid, 'affinity1', 'electric')).toBe(false); // ni son type ni dans son movepool
  expect(rankUpTalent(s, uid, 'affinity1', 'normal')).toBe(true); // type de son movepool (son propre type l'est aussi)
  expect(m.talentTypeChoices.affinity1).toBe('normal');
  expect(m.talents.affinity1).toBe(1);

  // rangs suivants : le type est déjà figé, un autre type fourni par erreur est sans effet
  expect(rankUpTalent(s, uid, 'affinity1', 'water')).toBe(true);
  expect(m.talentTypeChoices.affinity1).toBe('normal');
  expect(m.talents.affinity1).toBe(2);

  // rang max spécifique à 15 (pas 5 comme les autres talents)
  for (let i = 2; i < 15; i++) rankUpTalent(s, uid, 'affinity1', 'normal');
  expect(m.talents.affinity1).toBe(15);
  expect(rankUpTalent(s, uid, 'affinity1', 'normal')).toBe(false);
});

test('rankUpTalent : le palier 5 peut reprendre le type déjà choisi au palier 4 (cumul)', () => {
  const s = newGame();
  const sabelette = makeMon(27, 60, seededRng(9)); // Nv.60, 2 types éligibles (normal, poison)
  addMon(s, sabelette);
  const uid = sabelette.uid;
  const m = s.mons[uid];
  for (let i = 0; i < 5; i++) rankUpTalent(s, uid, 'power');
  for (let i = 0; i < 5; i++) rankUpTalent(s, uid, 'vigor');
  for (let i = 0; i < 5; i++) rankUpTalent(s, uid, 'guard');
  for (let i = 0; i < 5; i++) rankUpTalent(s, uid, 'reflex'); // 20 dépensés, palier 4 débloqué
  for (let i = 0; i < 15; i++) rankUpTalent(s, uid, 'affinity1', 'normal'); // rang max 15 → 35 dépensés
  for (let i = 0; i < 5; i++) rankUpTalent(s, uid, 'spec'); // 40 dépensés, palier 5 débloqué
  expect(spentPoints(m.talents)).toBe(40);
  expect(m.talentTypeChoices.affinity1).toBe('normal');

  expect(rankUpTalent(s, uid, 'affinity2', 'normal')).toBe(true); // même type que le palier 4 : autorisé
  expect(m.talentTypeChoices.affinity2).toBe('normal');
});

test('rankUpTalent : un Pokémon Nv.100 peut maxer les 12 talents (paliers 1 à 9), pile 100 points dépensés', () => {
  const s = newGame();
  const dracaufeu = makeMon(6, 100, seededRng(9)); // bi-type Feu/Vol → palier 7 (spec3) = Esquive aérienne (Vol)
  addMon(s, dracaufeu);
  const uid = dracaufeu.uid;
  const m = s.mons[uid];
  expect(talentPoints(m.level)).toBe(100);

  for (const id of ['power', 'vigor', 'guard', 'reflex', 'spec', 'mastery']) {
    for (let i = 0; i < 5; i++) expect(rankUpTalent(s, uid, id)).toBe(true);
  }
  expect(spentPoints(m.talents)).toBe(30);
  for (let i = 0; i < 15; i++) expect(rankUpTalent(s, uid, 'affinity1', 'normal')).toBe(true);
  for (let i = 0; i < 15; i++) expect(rankUpTalent(s, uid, 'affinity2', 'normal')).toBe(true);
  expect(spentPoints(m.talents)).toBe(60);
  for (const id of ['spec2', 'spec3', 'fury', 'deadly']) {
    for (let i = 0; i < 10; i++) expect(rankUpTalent(s, uid, id)).toBe(true);
  }
  expect(spentPoints(m.talents)).toBe(100);
  expect(rankUpTalent(s, uid, 'fury')).toBe(false); // rang max et plus aucun point à dépenser
});

test('lootLevel : farmer un ancien biome donne du butin au niveau de l’équipe, pas au niveau (bas) de la zone', () => {
  const s = newGame();
  const overpowered = makeMon(4, 100, seededRng(1), false, 15); // Salamèche Nv.100
  addMon(s, overpowered);
  s.biome = 0; s.zone = 0; s.stage = STAGES_PER_ZONE; // Lisière (Nv.3-6), boss Nv.8 — très en dessous
  const run = new StageRun(s, 'boss', seededRng(2));
  run.battle.runToEnd();
  const rewards = run.finishWave();
  expect(run.result).toBe('win');
  expect(rewards!.loot.length).toBeGreaterThan(0); // butin garanti sur un boss
  for (const it of rewards!.loot) expect(it.level).toBeGreaterThanOrEqual(90); // niveau de l'équipe (100), pas celui du boss (8)
});

test('fusionBadgeCount : compte les groupes fusionnables, sans se soucier des porteurs (approximation pour le badge)', () => {
  const s = strongGame();
  const rng = seededRng(2);
  expect(fusionBadgeCount(s)).toBe(0);
  const lunettes = [0, 1, 2].map(() => makeItem('griffe-sylve', 0, 3, rng));
  for (const it of lunettes) s.items[it.uid] = it;
  expect(fusionBadgeCount(s)).toBe(1);
  // objets portés ou d'un gabarit différent : comptés/exclus comme fusionCandidates, juste sans le détail des porteurs
  equip(s, s.team[0], lunettes[0].uid);
  expect(fusionBadgeCount(s)).toBe(1); // toujours 3 exemplaires du même gabarit, peu importe qui les porte
  const griffe = [0, 1].map(() => makeItem('cape-sylve', 1, 3, rng));
  for (const it of griffe) s.items[it.uid] = it; // seulement 2 : pas encore fusionnable
  expect(fusionBadgeCount(s)).toBe(1);
});

test('fusion depuis l’inventaire : l’objet porté reste porté', () => {
  const s = strongGame();
  const rng = seededRng(2);
  const before = Object.keys(s.items); // objets du starter (Tenue Sylvestre), déjà équipés
  const items = [0, 1, 2].map(() => makeItem('griffe-sylve', 0, 3, rng));
  for (const it of items) s.items[it.uid] = it;
  equip(s, s.team[0], items[0].uid); // remplace la griffe du starter en offense
  expect(fusionCandidates(s)).toHaveLength(1);
  const out = fuseItems(s, items.map((i) => i.uid), rng)!;
  expect(out.rarity).toBe(1);
  expect(s.mons[s.team[0]].items.offense).toBe(out.uid);
  expect(Object.keys(s.items).sort()).toEqual([...before, out.uid].sort());
});

test('fusion : jamais les objets équipés de deux Pokémon différents dans le même lot', () => {
  const s = newGame();
  chooseStarter(s, 4, seededRng(1));
  s.mons[s.team[0]].items = {}; s.items = {}; // ignore le kit de départ, hors sujet ici
  const second = makeMon(1, 5, seededRng(2));
  addMon(s, second); // rejoint l'équipe (2 membres)
  const rng = seededRng(3);
  const items = [0, 1, 2].map(() => makeItem('griffe-sylve', 0, 3, rng));
  for (const it of items) s.items[it.uid] = it;
  equip(s, s.team[0], items[0].uid);
  equip(s, s.team[1], items[1].uid); // porté par un AUTRE Pokémon que items[0]
  // 3 exemplaires mais 2 porteurs différents : aucune fusion tant qu'un 4e n'est pas libre
  expect(fusionCandidates(s)).toHaveLength(0);

  const extra = makeItem('griffe-sylve', 0, 1, rng);
  s.items[extra.uid] = extra;
  const groups = fusionCandidates(s);
  expect(groups).toHaveLength(1);
  const wearers = new Set(groups[0].map((it) => holder(s, it.uid)?.uid).filter(Boolean));
  expect(wearers.size).toBeLessThanOrEqual(1);

  fuseItems(s, groups[0].map((i) => i.uid), rng);
  // les deux Pokémon gardent chacun un objet équipé
  expect(s.mons[s.team[0]].items.offense).toBeDefined();
  expect(s.mons[s.team[1]].items.offense).toBeDefined();
});

test('recyclage : jamais un objet porté', () => {
  const s = strongGame();
  const rng = seededRng(2);
  const a = makeItem('griffe-sylve', 2, 3, rng), b = makeItem('griffe-sylve', 2, 3, rng);
  s.items[a.uid] = a; s.items[b.uid] = b;
  equip(s, s.team[0], a.uid);
  const gain = recycle(s, [a.uid, b.uid]);
  expect(gain).toBeGreaterThan(0);
  expect(s.items[a.uid]).toBeDefined();
  expect(s.items[b.uid]).toBeUndefined();
});

test('exploration : éclats (3/min/poste), plafond 12 h, jamais un membre de l’équipe', () => {
  const s = strongGame();
  const rng = seededRng(4);
  const extra = makeMon(43, 10, rng);
  addMon(s, extra); // rejoint l'équipe (2e place)
  expect(assignExploration(s, extra.uid, 0)).toBe(false);
  s.team = [s.team[0]];
  expect(assignExploration(s, extra.uid, 0)).toBe(true);
  const before = s.shards;
  const gained = harvestExploration(s, 24 * H); // 24 h plus tard → plafond 12 h (8 h avant le 2026-10-07)
  expect(gained).toBe(12 * 60 * SHARDS_PER_MIN);
  expect(s.shards).toBe(before + gained);
  expect(harvestExploration(s, 24 * H)).toBe(0); // rien de nouveau, le poste vient d'être récolté
});

test('pension : XP passive plafonnée à 12 h, jamais un membre de l’équipe', () => {
  const s = strongGame();
  const extra = makeMon(43, 5, seededRng(4));
  addMon(s, extra); // rejoint l'équipe (2e place)
  const rate = 100; // XP/h de test (calculée par l'appelant via teamXpPerHour × PENSION_XP_SHARE)
  expect(assignPension(s, extra.uid, rate, 0)).toBe(false); // encore dans l'équipe
  s.team = [s.team[0]];
  expect(assignPension(s, extra.uid, rate, 0)).toBe(true);
  const before = s.mons[extra.uid].xp;
  const h = harvestPension(s, rate, 24 * H); // 24 h plus tard → plafond 12 h (donc 12 × rate)
  expect(h.gains).toHaveLength(1);
  expect(h.gains[0].xp).toBe(12 * rate);
  expect(s.mons[extra.uid].xp).toBe(before + 12 * rate);
  expect(harvestPension(s, rate, 24 * H).gains).toHaveLength(0); // rien de plus juste après
  expect(assignPension(s, extra.uid, rate, 0)).toBe(true); // déjà en pension : no-op, pas d'erreur
  expect(removePension(s, extra.uid, 24 * H)).toBe(0); // XP déjà récoltée : rien de plus à encaisser
  expect(s.pension.length).toBe(0);
});

test('harvestPension : rafraîchit xpPerHour de tous les postes pour la période suivante', () => {
  const s = strongGame();
  const extra = makeMon(43, 5, seededRng(4));
  addMon(s, extra);
  s.team = [s.team[0]];
  assignPension(s, extra.uid, 50, 0);
  harvestPension(s, 200, 3600_000); // 1 h plus tard, nouveau taux 200/h
  expect(s.pension[0].xpPerHour).toBe(200);
});

test('relâcher donne des bonbons de la lignée', () => {
  const s = strongGame();
  const m = makeMon(5, 20, seededRng(1));
  addMon(s, m);
  expect(release(s, m.uid)).toBe(true);
  expect(s.candies[4]).toBe(3);
});

test('boutique : Balls contre éclats', () => {
  const { buyBall } = require('../game') as typeof import('../game');
  const s = newGame();
  s.shards = 70;
  expect(buyBall(s, 'super')).toBe(true);
  expect(s.balls.super).toBe(1);
  expect(buyBall(s, 'super')).toBe(false);
  expect(s.shards).toBe(10);
});

test('completeDex : un chromatique en un seul exemplaire n\'évolue qu\'en mode léger (keepEvolutionMaterial off)', () => {
  const s = newGame();
  chooseStarter(s, 4, seededRng(1));
  addMon(s, makeMon(1, 5, seededRng(50)));
  addMon(s, makeMon(7, 5, seededRng(51))); // équipe pleine : l'Abo va en boîte
  addMon(s, makeMon(23, 23, seededRng(7), true)); // Abo chromatique Nv.23, seul de son étage (Arbok jamais vu)
  expect(canCompleteDex(s)).toBe(false); // mode collectionneur : l'unique Abo chromatique est protégé
  expect(canCompleteDex(s, { keepEvolutionMaterial: false })).toBe(true);
  expect(completeDex(s, false, { keepEvolutionMaterial: false })).toBeGreaterThan(0);
  expect(s.dex.shiny).toContain(24); // Arbok chromatique au Pokédex
});

test('évolution à choix : Évoli évolue dans la forme choisie, la forme par défaut sans choix', () => {
  const s = newGame();
  chooseStarter(s, 4, seededRng(1));
  addMon(s, makeMon(133, 30, seededRng(3)));
  addMon(s, makeMon(133, 30, seededRng(4)));
  const [a, b] = Object.values(s.mons).filter((m) => m.speciesId === 133);
  expect(evolutionTargets(133)).toHaveLength(7);
  expect(evolutionTargets(133, 151)).toEqual([134, 135, 136]); // Kanto : pas de forme Johto/Sinnoh
  expect(evolutionTargets(133, 251)).toEqual([134, 135, 136, 196, 197]);
  evolve(s, a.uid, 135); // Voltali
  evolve(s, b.uid); // sans choix : Aquali
  expect(a.speciesId).toBe(135);
  expect(b.speciesId).toBe(134);
  expect(s.dex.caught).toContain(135);
  const c = makeMon(133, 30, seededRng(5)); addMon(s, c);
  evolve(s, c.uid, 25); // cible invalide : repli sur la forme par défaut
  expect(c.speciesId).toBe(134);
});

test('évolutions à choix : la 1re cible est toujours evolvesTo, toutes existent et le niveau est atteignable', () => {
  for (const [from, targets] of Object.entries(EVOLUTION_CHOICES)) {
    expect(targets[0]).toBe(species(Number(from)).evolvesTo);
    for (const t of targets) expect(species(t).id).toBe(t);
  }
});

test.each(REGIONS.map((r, i) => [r.name, i] as const))('whereToFind %s : toute espèce de la région a un lieu d\'obtention, sauvage ou via une évolution', (_n, p) => {
  const missing = ALL_SPECIES.filter((sp) => sp.id <= REGIONS[p].dexMax && whereToFind(sp.id, p).source === null).map((sp) => sp.name);
  expect(missing).toEqual([]);
});

test('whereToFind : une forme évoluée renvoie sa lignée, une espèce sauvage ses biomes', () => {
  const wild = whereToFind(135, 0); // Voltali, sauvage à Kanto
  expect(wild.path).toEqual([135]);
  expect(wild.habitats.length).toBeGreaterThan(0);
  const evolved = whereToFind(3, 0); // Florizarre
  expect(evolved.path[evolved.path.length - 1]).toBe(3);
  expect(evolved.path.length).toBeGreaterThan(1);
  expect(evolved.habitats.length).toBeGreaterThan(0);
});

test('whereToFind : une espèce sauvage évolution d\'une autre (Voltali) propose aussi la route par évolution', () => {
  const w = whereToFind(135, 0); // Voltali : sauvage à Kanto ET évolution d'Évoli
  expect(w.path).toEqual([135]);
  expect(w.viaEvolution?.path).toEqual([133, 135]);
  expect(w.viaEvolution?.habitats.length).toBeGreaterThan(0);
  expect(whereToFind(133, 0).viaEvolution).toBeUndefined(); // Évoli n'a pas de pré-évolution
});

test('autoTalents : dépense tous les points disponibles, sans dépasser le maximum ni réinitialiser', () => {
  const s = newGame();
  chooseStarter(s, 4, seededRng(1));
  const mon = Object.values(s.mons)[0];
  giveXp(mon, xpForLevel(40) - mon.xp); // Nv.40 → 39 points
  const pts = talentPoints(mon.level);
  const before = spentPoints(mon.talents);
  expect(autoTalents(s, mon.uid)).toBeGreaterThan(0);
  const spent = spentPoints(mon.talents);
  expect(spent).toBeGreaterThan(before);
  expect(spent).toBeLessThanOrEqual(pts);
  expect(spent).toBeGreaterThanOrEqual(pts - 1); // tout est dépensé (à un rang près si un palier verrouille)
  const again = autoTalents(s, mon.uid);
  expect(again).toBe(0); // rien à dépenser ensuite
});

test('bébés reliés à leur forme adulte : Pichu → Pikachu, lignée et bonbons regroupés, sans fuite vers Kanto', () => {
  expect(species(172).evolvesTo).toBe(25);
  expect(lineBase(26)).toBe(172); // Raichu → base Pichu
  expect(lineChain(172, 151)).toEqual([25, 26]); // en Kanto, Pichu n'existe pas : la lignée commence à Pikachu
  expect(lineChain(172, 251)).toEqual([172, 25, 26]);
  expect(whereToFind(25, 0).path).toEqual([25]); // Kanto : Pikachu reste un sauvage, jamais « via Pichu »
  // ancienne sauvegarde : les bonbons Pikachu (clé 25) rejoignent la nouvelle base (172)
  const raw = migrateSave({ ...newGame(), candies: { 25: 5 }, megaCandies: {} } as never) as { candies: Record<string, number> };
  expect(raw.candies['172']).toBe(5);
  expect(raw.candies['25']).toBeUndefined();
});

test('évolutions inter-générations : Magnéton évolue en Magnézone à Sinnoh seulement, jamais vers une région future', () => {
  const mon = makeMon(82, 60, seededRng(3)); // Magnéton Nv.60
  expect(species(82).evolvesTo).toBe(462);
  expect(canEvolve(mon, 151)).toBe(false); // Kanto : Magnézone n'existe pas encore
  expect(canEvolve(mon, 386)).toBe(false); // Hoenn non plus
  expect(canEvolve(mon, 493)).toBe(true); // Sinnoh
  const s = newGame(); chooseStarter(s, 4, seededRng(1));
  addMon(s, mon);
  evolve(s, mon.uid); // prestige 0 = Kanto : rien ne se passe
  expect(mon.speciesId).toBe(82);
  s.prestige = 3;
  evolve(s, mon.uid);
  expect(mon.speciesId).toBe(462);
  expect(lineChain(lineBase(462), 151)).toEqual([81, 82]); // Kanto : la lignée s'arrête à Magnéton
  expect(whereToFind(208, 1).path.length).toBeGreaterThanOrEqual(1); // Steelix toujours obtenable à Johto
});

test('starter : toujours au moins 3★, dans toutes les régions', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const s = newGame();
    s.prestige = seed % 4;
    chooseStarter(s, 152, seededRng(seed));
    expect(monStars(Object.values(s.mons)[0])).toBeGreaterThanOrEqual(3);
  }
});

test('Charme Chroma : Pokédex de la région complet → chromatiques 1/128, perdu au prestige', () => {
  const s = newGame();
  expect(hasShinyCharm(s)).toBe(false);
  expect(shinyOdds(s)).toBe(256);
  for (let id = 1; id <= 151; id++) s.dex.caught.push(id);
  expect(hasShinyCharm(s)).toBe(true);
  expect(shinyOdds(s)).toBe(128);
  s.prestige = 1; // Johto : il faut maintenant les 251
  expect(hasShinyCharm(s)).toBe(false);
});

test('fin de l\'aventure : écran de fin après le Champion de la dernière région, une seule fois', () => {
  const s = newGame();
  s.prestige = REGIONS.length - 1;
  expect(endingReady(s)).toBe(false);
  s.arenaBeaten[regionLastBiome(s.prestige)] = true;
  expect(endingReady(s)).toBe(true);
  s.endingSeen = true;
  expect(endingReady(s)).toBe(false);
});

test('Charme Chroma : annoncé une fois par région, réannoncé après un nouveau départ', () => {
  const s = newGame();
  expect(shinyCharmToAnnounce(s)).toBe(false);
  for (let id = 1; id <= 151; id++) s.dex.caught.push(id), s.dex.seen.push(id);
  expect(shinyCharmToAnnounce(s)).toBe(true);
  s.shinyCharmSeen = true;
  expect(shinyCharmToAnnounce(s)).toBe(false);
  s.arenaBeaten[regionLastBiome(0)] = true;
  expect(startPrestige(s)).toBe(true);
  expect(s.shinyCharmSeen).toBe(false);
  for (let id = 1; id <= 251; id++) s.dex.caught.push(id);
  expect(shinyCharmToAnnounce(s)).toBe(true);
});

test('capture : une espèce hors de la région en cours est refusée (offre périmée d\'une ancienne partie)', () => {
  const s = newGame();
  const rng = seededRng(1);
  expect(tryCapture(s, { speciesId: 493, level: 50, shiny: false, rare: false, guaranteed: true }, null, rng)).toBeNull();
  expect(s.dex.caught).not.toContain(493);
  expect(tryCapture(s, { speciesId: 150, level: 50, shiny: false, rare: false, guaranteed: true }, null, rng)).not.toBeNull();
});

test('chargement : le Pokédex ne garde que les espèces de la région en cours (Arceus capturé à Kanto par le bug)', () => {
  const raw = migrateSave({ prestige: 0, dex: { seen: [1, 150, 493], caught: [1, 493], shiny: [493] } });
  expect(raw.dex).toEqual({ seen: [1, 150], caught: [1], shiny: [] });
  const johto = migrateSave({ prestige: 1, dex: { seen: [200, 493], caught: [200], shiny: [] } });
  expect((johto.dex as GameState['dex']).seen).toEqual([200]);
});

test('libellé des objets : la Recharge s\'affiche en bonus (plus de réduction plafonnée depuis le 2026-10-01)', () => {
  expect(statText('cdrPct', 30)).toBe('Recharge +30 %');
  expect(statText('atkPct', 12)).toBe('Attaque +12 %');
});

test('boutique : un bonus dure 1 h par achat, s\'additionne jusqu\'à 8 h et se perd au prestige', () => {
  const s = newGame();
  const now = 1_000_000;
  s.shards = 100_000;
  expect(buyBoost(s, 'xp', now)).toBe(true);
  expect(s.shards).toBe(100_000 - BOOSTS.xp.price);
  expect(boostActive(s, 'xp', now + BOOST_MS - 1)).toBe(true);
  expect(boostActive(s, 'xp', now + BOOST_MS)).toBe(false);
  for (let i = 1; i < 8; i++) expect(buyBoost(s, 'xp', now)).toBe(true);
  expect(buyBoost(s, 'xp', now)).toBe(false); // 8 h déjà en réserve
  expect(s.boosts.xp).toBe(now + 8 * BOOST_MS);
  s.shards = 0;
  expect(buyBoost(s, 'charm', now)).toBe(false);
  s.arenaBeaten[regionLastBiome(0)] = true;
  for (let id = 1; id <= 151; id++) s.dex.seen.push(id);
  s.universalMega = 2;
  expect(startPrestige(s)).toBe(true);
  expect(boostActive(s, 'xp', now)).toBe(false);
  expect(s.universalMega).toBe(2);
});

test('boutique : Mini Charme Chroma ×1,5, cumulable avec le Charme Chroma', () => {
  const s = newGame();
  s.boosts.charm = Date.now() + BOOST_MS;
  expect(shinyOdds(s)).toBe(171);
  for (let id = 1; id <= 151; id++) s.dex.caught.push(id);
  expect(shinyOdds(s)).toBe(85);
  s.boosts.charm = 0;
  expect(shinyOdds(s)).toBe(128);
});

test('boutique : couverture hors ligne au prorata de l\'absence', () => {
  const s = newGame();
  s.boosts.lure = 1000 + 2 * 3600_000;
  expect(boostCoverage(s, 'lure', 1000, 8 * 3600_000)).toBeCloseTo(0.25);
  expect(boostCoverage(s, 'lure', 1000, 3600_000)).toBe(1);
  expect(boostCoverage(s, 'incense', 1000, 3600_000)).toBe(0);
});

test('boutique : Parfum rare, les espèces rares sortent 3 fois plus souvent', () => {
  const zone = { ...BIOMES[0].zones[0], pool: [[10, 5], [13, 45]] as [number, number][] };
  const count = (mult: number) => {
    const rng = seededRng(7);
    let n = 0;
    for (let i = 0; i < 20000; i++) if (pickSpecies(zone, rng, false, mult) === 10) n++;
    return n / 20000;
  };
  expect(count(1)).toBeCloseTo(0.1, 1.5);
  expect(count(3)).toBeCloseTo(15 / 60, 1.5);
});

test('boutique : méga bonbon universel, utilisé après ceux de la lignée', () => {
  const s = newGame();
  const mon = makeMon(1, 5, seededRng(3), false);
  mon.genes = { hp: 5, atk: 5, def: 5, spe: 5 };
  addMon(s, mon);
  expect(applyMega(s, mon.uid, 'atk')).toBe(false);
  s.shards = UNIVERSAL_MEGA_PRICE;
  expect(buyUniversalMega(s)).toBe(true);
  expect(buyUniversalMega(s)).toBe(false);
  s.megaCandies[1] = 1;
  expect(applyMega(s, mon.uid, 'atk')).toBe(true);
  expect(s.megaCandies[1]).toBe(0);
  expect(s.universalMega).toBe(1);
  expect(applyMega(s, mon.uid, 'atk')).toBe(true);
  expect(s.universalMega).toBe(0);
  expect(mon.genes.atk).toBe(7);
});

test('sac : recycler une panoplie garde les objets verrouillés, portés et des autres panoplies', () => {
  const s = newGame();
  chooseStarter(s, 1, seededRng(1));
  s.items = {}; // sans l'objet de départ du starter
  s.mons[s.team[0]].items = {};
  const rng = seededRng(4);
  const a = makeItem('griffe-sylve', 0, 5, rng);
  const b = makeItem('cape-sylve', 4, 5, rng);
  const locked = makeItem('baie-sylve', 1, 5, rng);
  locked.locked = true;
  const worn = makeItem('griffe-sylve', 2, 5, rng);
  const other = makeItem('griffe-cendres', 0, 5, rng);
  for (const it of [a, b, locked, worn, other]) s.items[it.uid] = it;
  equip(s, s.team[0], worn.uid);
  const uids = setRecycleCandidates(s, 'sylve').map((i) => i.uid).sort();
  expect(uids).toEqual([a.uid, b.uid].sort());
  recycle(s, uids);
  expect(Object.keys(s.items).sort()).toEqual([locked.uid, worn.uid, other.uid].sort());
});

/** Partie en fin de jeu : Sinnoh, dernier Champion battu, 8 badges. */
function endgameState(): GameState {
  const s = newGame();
  s.prestige = REGIONS.length - 1;
  s.arenaBeaten[regionLastBiome(s.prestige)] = true;
  s.badges = 8;
  return s;
}

test('fin de jeu : débloquée seulement par le dernier Champion', () => {
  const s = newGame();
  s.arenaBeaten[regionLastBiome(0)] = true; // Champion de Kanto : pas la fin
  expect(endgameUnlocked(s)).toBe(false);
  expect(itemLevelCap(s)).toBe(100);
  expect(endgameUnlocked(endgameState())).toBe(true);
  expect(itemLevelCap(endgameState())).toBe(Infinity);
});

test('Chromatique +N : 3 Chromatiques identiques → +1, puis +2, uniquement en fin de jeu', () => {
  const rng = seededRng(9);
  const chroma = () => makeItem('griffe-sylve', 6, 100, rng);
  const before = newGame();
  before.badges = 8;
  const a = [chroma(), chroma(), chroma()];
  for (const it of a) before.items[it.uid] = it;
  expect(fusableRarity(before, a[0])).toBe(false);
  expect(fuseItems(before, a.map((i) => i.uid), rng)).toBeNull();
  expect(fusionCandidates(before)).toHaveLength(0);

  const s = endgameState();
  for (const it of a) s.items[it.uid] = it;
  expect(fusionCandidates(s)).toHaveLength(1);
  const p1 = fuseItems(s, a.map((i) => i.uid), rng)!;
  expect(p1.rarity).toBe(6);
  expect(p1.plus).toBe(1);
  expect(rarityName(p1)).toBe('Chromatique +1');
  expect(mainValue(p1) / mainValue(a[0])).toBeCloseTo(2.6 / 2.4, 2);
  const best = Math.max(...a.flatMap((i) => i.subs.map((x) => x.value)));
  expect(Math.max(...p1.subs.map((x) => x.value))).toBeCloseTo(best * 1.1, 0);
  // un +1 ne fusionne pas avec des Chromatiques simples
  const mix = [p1, chroma(), chroma()];
  for (const it of mix) s.items[it.uid] = it;
  expect(fuseItems(s, mix.map((i) => i.uid), rng)).toBeNull();
  const p1b = { ...p1, uid: 'p1b' }; const p1c = { ...p1, uid: 'p1c' };
  s.items.p1b = p1b; s.items.p1c = p1c;
  const p2 = fuseItems(s, [p1.uid, 'p1b', 'p1c'], rng)!;
  expect(p2.plus).toBe(2);
  expect(recycleValue(p2)).toBeGreaterThan(recycleValue(p1));
});

test('fin de jeu : les objets s\'améliorent au-delà du Nv.100', () => {
  const s = endgameState();
  s.shards = 1e9;
  const it = makeItem('griffe-sylve', 6, 100, seededRng(2));
  s.items[it.uid] = it;
  expect(upgradeItem(s, it.uid)).toBe(true);
  expect(s.items[it.uid].level).toBe(101);
  const before = newGame();
  before.shards = 1e9;
  before.items[it.uid] = { ...it, level: 100 };
  expect(upgradeItem(before, it.uid)).toBe(false);
});

test('Tour : adversaires = formes finales et légendaires, reprise au dernier palier de 10', () => {
  const pool = towerSpecies();
  expect(pool).toContain(493); // Arceus
  expect(pool).toContain(6); // Dracaufeu
  expect(pool).not.toContain(4); // Salamèche
  const s = endgameState();
  expect(towerStart(s)).toBe(1);
  s.towerBest = 47;
  expect(towerStart(s)).toBe(41);
  expect(enterTower(newGame())).toBe(false); // pas avant le dernier Champion
  expect(enterTower(s)).toBe(true);
  expect(s.towerFloor).toBe(41);
  selectStage(s, s.biome, 0, 1); // choisir une zone sur la Carte fait sortir de la Tour
  expect(s.towerFloor).toBeNull();
  expect([10, 20, 30, 40, 50, 70].map(towerRewardPlus)).toEqual([0, 0, 1, 1, 2, 3]);
});

test('Tour : étage gagné (éclats, objet Nv.100 + étage, Chromatique à choisir tous les 10), défaite sans pénalité', () => {
  const s = endgameState();
  chooseStarter(s, 387, seededRng(1));
  s.towerBest = 9;
  enterTower(s);
  expect(s.towerFloor).toBe(1);
  s.towerFloor = 10;
  const shards = s.shards;
  const run = new StageRun(s, 'tower', seededRng(2));
  expect(run.floor).toBe(10);
  expect(run.enemies).toHaveLength(3);
  expect(run.enemies.every((e) => e.mon.level === TOWER_LEVEL)).toBe(true);
  run.battle.result = 'win';
  const r = run.finishWave()!;
  expect(run.result).toBe('win');
  expect(s.towerBest).toBe(10);
  expect(s.towerFloor).toBe(11);
  expect(s.shards - shards).toBe(r.shards);
  expect(r.loot[0].level).toBe(110);
  expect(r.loot[0].rarity).toBe(6); // toujours Chromatique
  expect(towerLootTemplates().some((t) => t.id === r.loot[0].templateId)).toBe(true);
  expect(s.towerRewards).toHaveLength(1);
  // Chromatique au choix
  const it = claimTowerReward(s, 0, 'gantelet-champion', seededRng(3))!;
  expect(it.templateId).toBe('gantelet-champion');
  expect(it.rarity).toBe(6);
  expect(it.level).toBe(110);
  expect(s.towerRewards).toHaveLength(0);
  // défaite : sortie de la Tour, zone et étape inchangées
  const { biome, zone, stage } = s;
  const lost = new StageRun(s, 'tower', seededRng(4));
  lost.battle.result = 'lose';
  lost.finishWave();
  expect(s.towerFloor).toBeNull();
  expect([s.biome, s.zone, s.stage]).toEqual([biome, zone, stage]);
  expect(s.towerBest).toBe(10);
});

test('Équiper le meilleur : trouve la meilleure combinaison (comparée à une recherche exhaustive)', () => {
  const sets = ['sylve', 'cendres', 'champion'];
  const bySlot = { offense: [] as string[], defense: [] as string[], berry: [] as string[] };
  for (const t of TEMPLATES) if (t.set && sets.includes(t.set)) bySlot[t.slot].push(t.id);
  for (let seed = 1; seed <= 12; seed++) {
    const rng = seededRng(seed);
    const s = newGame();
    chooseStarter(s, 1, seededRng(seed));
    s.items = {};
    s.mons[s.team[0]].items = {};
    const uid = s.team[0];
    // 5 objets par emplacement (≤ AUTO_EQUIP_TOP : la recherche doit être exacte), raretés et niveaux variés
    for (const slot of ['offense', 'defense', 'berry'] as const) {
      for (let i = 0; i < 5; i++) {
        const it = makeItem(bySlot[slot][rng.int(bySlot[slot].length)], rng.int(7), 1 + rng.int(100), rng);
        s.items[it.uid] = it;
      }
    }
    const items = Object.values(s.items);
    const of = (slot: string) => items.filter((it) => TEMPLATES.find((t) => t.id === it.templateId)!.slot === slot);
    let brute = -Infinity;
    for (const o of of('offense')) for (const d of of('defense')) for (const b of of('berry')) brute = Math.max(brute, equipValue(s, uid, [o, d, b]));
    const worn = bestEquipCombo(s, uid, equipValue).filter((it): it is NonNullable<typeof it> => !!it);
    expect(worn).toHaveLength(3);
    expect(equipValue(s, uid, worn)).toBeCloseTo(brute, 6);
  }
});

test('Tour : sans panoplies visées, les 20 panoplies du jeu (60 objets), comme le coffre (2026-10-02)', () => {
  const pool = towerLootTemplates();
  const sets = new Set(pool.map((t) => t.set));
  expect(sets.size).toBe(20);
  expect(pool).toHaveLength(60);
  expect([...sets].sort()).toEqual([...towerFocusChoices()].sort());
  expect(sets.has('prairie')).toBe(true); // absente de Sinnoh : ne tombait jamais dans la Tour avant
  // même puissance quelle que soit la panoplie (aperçu de la fenêtre d'une panoplie = objet réellement tombé)
  const preview = towerPreviewItem('mandibule-ruche', 150);
  const dropped = makeItem('mandibule-ruche', 6, 150, seededRng(1), BIOMES.length - 1);
  expect(mainValue(preview)).toBe(mainValue(dropped));
  // deux objets Attaque de panoplies différentes : même puissance, à l'arrondi du facteur `biomeTier` près
  expect(Math.abs(mainValue(towerPreviewItem('gantelet-champion', 150)) - mainValue(preview))).toBeLessThan(0.5);
});

test('Tour : 1 à 3 panoplies visées parmi les 20 → les Chromatiques ne tombent plus que dans leurs objets (2026-10-07)', () => {
  const s = endgameState();
  chooseStarter(s, 387, seededRng(1));
  expect(towerFocusChoices()).toHaveLength(20); // comme le coffre de palier
  expect(towerDropPool(s)).toHaveLength(60);
  expect(toggleTowerSet(s, 'ruche')).toBe(true); // absente de Sinnoh : ne tombait jamais dans la Tour
  expect(towerDropPool(s)).toHaveLength(3); // une seule panoplie : ses 3 objets
  expect(towerDropPool(s).every((t) => t.set === 'ruche')).toBe(true);
  expect(toggleTowerSet(s, 'circuit')).toBe(true);
  expect(towerDropPool(s)).toHaveLength(6);
  expect(toggleTowerSet(s, 'dragon2')).toBe(true);
  expect(toggleTowerSet(s, 'sylve')).toBe(false); // déjà 3
  expect(toggleTowerSet(s, 'inconnue')).toBe(false);
  const focus = new Set(['ruche', 'circuit', 'dragon2']);
  expect(towerDropPool(s)).toHaveLength(9);
  expect(towerDropPool(s).every((t) => focus.has(t.set!))).toBe(true);
  // en combat : chaque étage gagné donne un objet des panoplies visées
  s.towerBest = 30;
  for (let i = 0; i < 20; i++) {
    s.towerFloor = 21;
    const run = new StageRun(s, 'tower', seededRng(100 + i));
    run.battle.result = 'win';
    const r = run.finishWave()!;
    expect(focus.has(TEMPLATES.find((t) => t.id === r.loot[0].templateId)!.set!)).toBe(true);
  }
  // retirer des panoplies : tirage sur celles qui restent, puis sur les 20 quand il n'en reste aucune
  expect(toggleTowerSet(s, 'circuit')).toBe(true);
  expect(s.towerSets).toEqual(['ruche', 'dragon2']);
  expect(towerDropPool(s)).toHaveLength(6);
  toggleTowerSet(s, 'ruche');
  toggleTowerSet(s, 'dragon2');
  expect(towerDropPool(s)).toHaveLength(60);
});

test('recycler les petits crans : Chromatiques +0 à +N, jamais verrouillés ni portés, panoplie optionnelle (2026-10-07)', () => {
  const s = endgameState();
  chooseStarter(s, 387, seededRng(1));
  s.items = {};
  const rng = seededRng(2);
  const add = (id: string, rarity: number, plus: number) => {
    const it = makeItem(id, rarity, 150, rng);
    if (plus) it.plus = plus;
    s.items[it.uid] = it;
    return it;
  };
  const p0 = add('gantelet-champion', 6, 0);
  const p3 = add('cape-champion', 6, 3);
  const p6 = add('griffe-sylve', 6, 6);
  const p7 = add('gantelet-champion', 6, 7); // au-dessus du cran choisi
  add('gantelet-champion', 5, 0); // pas Chromatique
  const locked = add('cape-champion', 6, 1);
  locked.locked = true;
  const worn = add('baie-champion', 6, 2);
  equip(s, s.team[0], worn.uid);
  const uids = (list: Item[]) => list.map((i) => i.uid).sort();
  expect(uids(plusRecycleCandidates(s, 6))).toEqual(uids([p0, p3, p6]));
  expect(uids(plusRecycleCandidates(s, 2))).toEqual(uids([p0]));
  expect(uids(plusRecycleCandidates(s, 6, 'champion'))).toEqual(uids([p0, p3]));
  // le recyclage rend les éclats et ne touche qu'à ceux-là
  const shards = s.shards;
  const gain = recycle(s, plusRecycleCandidates(s, 6).map((i) => i.uid));
  expect(gain).toBeGreaterThan(0);
  expect(s.shards).toBe(shards + gain);
  expect(s.items[p7.uid] && s.items[locked.uid] && s.items[worn.uid]).toBeTruthy();
  expect(plusRecycleCandidates(s, 6)).toHaveLength(0);
});

test('Tour : éclats doublés, cran du butin = coffre − 6 par paliers fixes (2026-10-07)', () => {
  expect([1, 100, 366].map(towerShards)).toEqual([1100, 11000, 37600]);
  // coffre : +0 aux étages 10-29 … +17 aux 350-369 ; butin : 6 crans dessous, jamais négatif
  expect([1, 149, 150, 189, 190, 290, 350, 366].map(towerDropPlus)).toEqual([0, 0, 1, 2, 3, 8, 11, 11]);
  for (let f = 1; f <= 500; f++) expect(towerDropPlus(f)).toBe(Math.max(0, towerRewardPlus(f) - TOWER_DROP_GAP));
  // en combat : l'objet de l'étage tombe à ce cran, sous-stats +10 % par cran comme un coffre
  const s = endgameState();
  chooseStarter(s, 387, seededRng(1));
  s.towerBest = 400;
  s.towerFloor = 360;
  const run = new StageRun(s, 'tower', seededRng(2));
  run.battle.result = 'win';
  const r = run.finishWave()!;
  expect(r.shards).toBe(towerShards(360));
  expect(r.loot[0].plus).toBe(11);
  expect(r.loot[0].level).toBe(460);
  expect(r.loot[0].rarity).toBe(6);
  for (const sub of r.loot[0].subs) {
    const range = subRange(sub.stat, 460, 11);
    expect(sub.value).toBeGreaterThanOrEqual(range.min - 0.05);
    expect(sub.value).toBeLessThanOrEqual(range.max + 0.05);
  }
  // sous l'étage 150 : +0 comme avant (pas de champ `plus`)
  s.towerFloor = 120;
  const low = new StageRun(s, 'tower', seededRng(3));
  low.battle.result = 'win';
  expect(low.finishWave()!.loot[0].plus).toBeUndefined();
});

test('vitesse de combat : ×2 dès le 1er badge, ×3 dès le 4e, retour à ×1 après un Nouveau départ', () => {
  const s = newGame();
  expect(maxBattleSpeed(s)).toBe(1);
  s.badges = 1;
  expect(maxBattleSpeed(s)).toBe(2);
  s.badges = 3;
  expect(maxBattleSpeed(s)).toBe(2);
  s.badges = 4;
  expect(maxBattleSpeed(s)).toBe(3);
  s.badges = 8;
  expect(maxBattleSpeed(s)).toBe(3);
  s.badges = 0; // ce que fait startPrestige
  expect(maxBattleSpeed(s)).toBe(1);
});

test('PC affichés (monPower) : ne bougent pas quand on change d’équipe ou de pension, montent avec un méga bonbon', () => {
  const s = newGame();
  chooseStarter(s, 4, seededRng(1));
  const a = makeMon(6, 50, seededRng(2)); addMon(s, a);
  const b = makeMon(149, 50, seededRng(3)); addMon(s, b); // Dracolosse : aura Dragon (Attaque) pour l'équipe
  const c = makeMon(130, 50, seededRng(4)); addMon(s, c);
  const before = monPower(s, a.uid);
  setTeam(s, [a.uid]);
  expect(monPower(s, a.uid)).toBe(before);
  expect(assignPension(s, b.uid, 100, 0)).toBe(true);
  expect(monPower(s, a.uid)).toBe(before);
  setTeam(s, [a.uid, c.uid]);
  expect(monPower(s, a.uid)).toBe(before);
  s.universalMega = 1;
  a.genes.atk = Math.min(a.genes.atk, 14);
  const low = monPower(s, a.uid);
  applyMegaCandy(s, a.uid, 'atk');
  expect(monPower(s, a.uid)).toBeGreaterThanOrEqual(low);
});

test('flèches du sélecteur d’objets : après « Équiper le meilleur », plus aucun objet libre n’est marqué meilleur', () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const s = newGame();
    chooseStarter(s, [4, 7, 1, 25, 133, 147][seed - 1], seededRng(seed));
    const uid = s.team[0];
    giveXp(s.mons[uid], 30 * 60 * 60);
    const rng = seededRng(seed * 11);
    for (const t of towerLootTemplates()) { const it = makeItem(t.id, rng.int(7), 40 + rng.int(40), rng); s.items[it.uid] = it; }
    autoEquipBest(s, uid);
    for (const it of Object.values(s.items)) expect(equipGain(s, uid, it)).toBeLessThanOrEqual(0.05);
  }
});

test('sauvegarde d’avant le 2026-10-01 : sous-stats Vitesse / Recharge converties une seule fois, les autres intactes', () => {
  const s = newGame();
  const it = makeItem('griffe-sylve', 6, 100, seededRng(1));
  it.subs = [{ stat: 'spePct', value: 17.1 * (1 + 0.08 * 99) }, { stat: 'cdrPct', value: 10 * (1 + 0.08 * 99) * 0.7 }, { stat: 'atkPct', value: 20 }];
  s.items[it.uid] = it;
  const raw = JSON.parse(JSON.stringify({ ...s, balanceVersion: 2 }));
  const out = migrateSave(raw) as unknown as GameState;
  const subs = out.items[it.uid].subs;
  expect(subs[0].value).toBeLessThan(30); // ~+130 % → ~+21 %
  expect(subs[0].value).toBeGreaterThan(subs[1].value / 17 * 7); // jet max contre jet à 70 %
  expect(subs[2].value).toBe(20);
  expect(out.balanceVersion).toBe(5);
  const again = migrateSave(JSON.parse(JSON.stringify(out))) as unknown as GameState;
  expect(again.items[it.uid].subs[0].value).toBe(subs[0].value); // pas de double conversion
});

test('sauvegarde d’avant le 2026-10-02 : une sous-stat sous le jet minimum de son objet remonte à ce minimum', () => {
  const s = newGame();
  const it: Item = { ...makeItem('griffe-sylve', 6, 50, seededRng(2)), plus: 2 };
  const defMax = subRange('defPct', 50, 2).max;
  it.subs = [{ stat: 'hpPct', value: 1 }, { stat: 'defPct', value: defMax }];
  s.items[it.uid] = it;
  const out = migrateSave(JSON.parse(JSON.stringify({ ...s, balanceVersion: 3 }))) as unknown as GameState;
  expect(out.items[it.uid].subs[0].value).toBeCloseTo(subRange('hpPct', 50, 2).min, 1); // venue d'une pièce plus basse
  expect(out.items[it.uid].subs[1].value).toBeCloseTo(defMax, 1); // dans sa fourchette : intacte
  expect(out.balanceVersion).toBe(5);
});

test('boutique : méga bonbons universels par 10 ou 100, tout ou rien', () => {
  const s = newGame();
  s.shards = UNIVERSAL_MEGA_PRICE * 10;
  expect(buyUniversalMegas(s, 100)).toBe(false);
  expect(s.shards).toBe(UNIVERSAL_MEGA_PRICE * 10);
  expect(buyUniversalMegas(s, 10)).toBe(true);
  expect(s.universalMega).toBe(10);
  expect(s.shards).toBe(0);
});

test('améliorer +10 : coût total des 10 niveaux, tout ou rien, jamais au-delà du niveau maximum', () => {
  const s = newGame();
  const it = makeItem('griffe-sylve', 0, 10, seededRng(5));
  s.items[it.uid] = it;
  expect(upgradeCostFor(it, 10)).toBe(5 * (10 + 11 + 12 + 13 + 14 + 15 + 16 + 17 + 18 + 19));
  s.shards = upgradeCostFor(it, 10) - 1;
  expect(upgradeItemTimes(s, it.uid, 10)).toBe(0);
  expect(s.items[it.uid].level).toBe(10);
  s.shards += 1;
  expect(upgradeItemTimes(s, it.uid, 10)).toBe(10);
  expect(s.items[it.uid].level).toBe(20);
  expect(s.shards).toBe(0);
  const top = makeItem('griffe-sylve', 0, 95, seededRng(6));
  s.items[top.uid] = top;
  s.shards = 1e9;
  expect(upgradeItemTimes(s, top.uid, 10)).toBe(0); // Nv.100 au plus avant la fin de jeu
  expect(upgradeItemTimes(s, top.uid, 5)).toBe(5);
});

test('pension et exploration : retirer un Pokémon encaisse d’abord ce qu’il a accumulé (2026-10-01)', () => {
  const s = newGame();
  chooseStarter(s, 4, seededRng(1));
  const a = makeMon(1, 10, seededRng(2)); addMon(s, a);
  const b = makeMon(7, 10, seededRng(3)); addMon(s, b);
  const c = makeMon(16, 10, seededRng(4)); addMon(s, c);
  setTeam(s, [s.team[0]]);
  const t0 = 1_000_000;
  expect(assignPension(s, a.uid, 600, t0)).toBe(true);
  expect(assignExploration(s, b.uid, t0)).toBe(true);
  const xpBefore = a.xp;
  expect(removePension(s, a.uid, t0 + 3600_000)).toBe(600); // 1 h à 600 XP/h
  expect(a.xp).toBe(xpBefore + 600);
  const shardsBefore = s.shards;
  expect(removeExploration(s, b.uid, t0 + 10 * 60_000)).toBe(10 * SHARDS_PER_MIN);
  expect(s.shards).toBe(shardsBefore + 10 * SHARDS_PER_MIN);
  // mise en équipe depuis la pension : XP encaissée aussi
  expect(assignPension(s, c.uid, 300, t0)).toBe(true);
  const cXp = c.xp;
  setTeam(s, [...s.team, c.uid]);
  expect(c.xp).toBeGreaterThan(cXp);
  expect(s.pension.some((p) => p.uid === c.uid)).toBe(false);
});

test('évolution qui change le type principal : talents ET Affinités remis à zéro (Évoli → Givrali)', () => {
  const s = newGame();
  s.prestige = 3;
  const ev = makeMon(133, 60, seededRng(1)); addMon(s, ev);
  autoTalents(s, ev.uid);
  expect(ev.talentTypeChoices.affinity1).toBeDefined();
  evolve(s, ev.uid, 471);
  expect(ev.talents).toEqual({});
  expect(ev.talentTypeChoices).toEqual({});
  autoTalents(s, ev.uid);
  // de nouveau choisi (pour le kit de Givrali), parmi ses types éligibles, et les points dépensés
  expect(eligibleAffinityTypes(471)).toContain(ev.talentTypeChoices.affinity1);
  expect(ev.talents.affinity1 ?? 0).toBeGreaterThan(0);
});

test('bonbon : refusé au niveau maximum (il était consommé pour rien)', () => {
  const s = newGame();
  const m = makeMon(25, 100, seededRng(2)); addMon(s, m);
  s.candies[lineBase(25)] = 5;
  expect(feedCandy(s, m.uid)).toBeNull();
  expect(s.candies[lineBase(25)]).toBe(5);
});

test('Tour, combat continu : une défaite fait reprendre au début du palier (ou du précédent sur son 1er étage), sinon sortie', () => {
  expect(towerRetryFloor(48)).toBe(41);
  expect(towerRetryFloor(50)).toBe(41);
  expect(towerRetryFloor(51)).toBe(41); // 1er étage du palier : un palier plus bas
  expect(towerRetryFloor(5)).toBe(1);
  expect(towerRetryFloor(1)).toBe(1);
  for (const auto of [true, false]) {
    const s = newGame();
    chooseStarter(s, 4, seededRng(1));
    s.towerAuto = auto;
    s.towerFloor = 48;
    const run = new StageRun(s, 'tower', seededRng(2));
    run.battle.result = 'lose';
    run.finishWave();
    expect(s.towerFloor).toBe(auto ? 41 : null);
  }
});

test('Tour : coffre de palier au premier passage seulement ; rejouer le palier rapporte éclats et Chromatique, pas de coffre', () => {
  const s = endgameState();
  chooseStarter(s, 387, seededRng(1));
  s.towerBest = 120; // palier 120 déjà franchi
  s.towerFloor = 120;
  const shards = s.shards;
  const run = new StageRun(s, 'tower', seededRng(2));
  run.battle.result = 'win';
  const r = run.finishWave()!;
  expect(r.towerReward).toBeUndefined();
  expect(s.towerRewards).toHaveLength(0);
  expect(r.loot).toHaveLength(1);
  expect(s.shards).toBeGreaterThan(shards);
  // nouveau record sur un palier : le coffre tombe
  s.towerFloor = 130;
  const next = new StageRun(s, 'tower', seededRng(3));
  next.battle.result = 'win';
  expect(next.finishWave()!.towerReward?.floor).toBe(130);
  expect(s.towerRewards).toHaveLength(1);
});

test('Balls quotidiennes : une fois par jour, et reculer l’horloge ne les redonne pas', () => {
  const s = newGame();
  const balls = s.balls.poke;
  const noon = new Date(2026, 9, 2, 12).getTime(); // 2 octobre 2026, midi (fuseau des tests : Europe/Paris)
  const D = 86_400_000;
  expect(grantDailyBalls(s, noon)).toBe(FREE_BALLS_PER_DAY);
  expect(grantDailyBalls(s, noon + 3600_000)).toBe(0); // même jour
  expect(grantDailyBalls(s, noon - D)).toBe(0); // horloge reculée d'un jour (avant : redonnées)
  expect(grantDailyBalls(s, noon)).toBe(0); // revenue au jour même (avant : redonnées une 2e fois)
  expect(grantDailyBalls(s, noon + D)).toBe(FREE_BALLS_PER_DAY); // le lendemain
  expect(s.balls.poke).toBe(balls + 2 * FREE_BALLS_PER_DAY);
});

test('completeDex : une évolution qui échoue (donnée incohérente) arrête la boucle au lieu de figer le jeu', () => {
  const s = newGame();
  chooseStarter(s, 4, seededRng(1));
  addMon(s, makeMon(10, 5, seededRng(2)));
  addMon(s, makeMon(16, 5, seededRng(3))); // équipe complète : les Bulbizarre vont en boîte
  for (let i = 0; i < 3; i++) { const m = makeMon(1, 40, seededRng(10 + i)); addMon(s, m); m.locked = false; }
  // Herbizarre ne peut plus évoluer, alors que la lignée (et le niveau) disent qu'il le peut
  const real = dataModule.evolutionTargets;
  const spy = jest.spyOn(dataModule, 'evolutionTargets').mockImplementation((id, dexMax) => (id === 2 ? [] : real(id, dexMax)));
  try {
    const n = completeDex(s); // avant : boucle infinie sur l'évolution Herbizarre → Florizarre
    expect(n).toBe(2); // 2 Bulbizarre → Herbizarre, puis arrêt
    expect(Object.values(s.mons).filter((m) => m.speciesId === 2)).toHaveLength(2);
    expect(Object.values(s.mons).some((m) => m.speciesId === 3)).toBe(false);
  } finally {
    spy.mockRestore();
  }
});

test('sauvegarde d’avant le correctif des arrondis : une sous-stat sortie de sa fourchette y revient, les autres intactes', () => {
  const s = newGame();
  const it: Item = { ...makeItem('griffe-sylve', 6, 200, seededRng(2)), plus: 2 };
  const typeMax = subMax('typeDmgPct', 200, 2);
  const inside = Math.round(subMax('hpPct', 200, 2) * 0.9 * 10) / 10;
  it.subs = [{ stat: 'typeDmgPct', value: Math.round(typeMax * 1.012 * 10) / 10 }, { stat: 'hpPct', value: inside }];
  s.items[it.uid] = it;
  const out = migrateSave(JSON.parse(JSON.stringify({ ...s, balanceVersion: 4 }))) as unknown as GameState;
  expect(out.items[it.uid].subs[0].value).toBeCloseTo(typeMax, 2); // au-dessus du maximum (arrondis accumulés) → le maximum
  expect(out.items[it.uid].subs[1].value).toBe(inside); // dans sa fourchette : intacte
  expect(out.balanceVersion).toBe(5);
});
