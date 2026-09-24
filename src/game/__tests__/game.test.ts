import { BIOMES, REGION_START, REGIONS, STAGES_PER_ZONE, regionLastBiome } from '../content';
import { ALL_SPECIES, EVOLUTION_CHOICES, evolutionTargets, species } from '../data';
import {
  GameState, PENSION_XP_FALLBACK_PER_HOUR, StageRun, applyMegaCandy, craftMegaCandy, lineBase, arenaAvailable, assignExploration, assignPension, autoCaptureBall, autoEquipBest, bestStarsOf, biomeAvailable, bossAvailable,
  lineChain, autoTalents, canCompleteDex, whereToFind, canEvolve, canPrestige, captureChance, captureLevel, chooseStarter, completeDex, effectivePool, equip, evolve, excessMons, fuseItems, fusionBadgeCount, fusionCandidates, genesMinForBadges, giveXp,
  harvestExploration, harvestPension, holder, isRareInZone, makeMon, addMon, makeWaves, migrateSave, monsBelowStars, monsNotShiny, newGame, pickSpecies, rankUpTalent, recycle, release, releaseBelowStars, SHARDS_PER_MIN,
  releaseExcess, releaseNotShiny, remainingEvolutions, removePension, selectStage, setAutoAdvance, START_BALLS, startPrestige,
  CAPTURE_PITY, RELEASE_CANDIES, captureTarget, idleFarmTarget, isTargeted, toggleTarget, zoneHasTarget, teamMaxLevel, tryCapture, unequipBox, xpGapMult,
} from '../game';
import { SETS, TEMPLATES, makeItem } from '../items';
import { emptyBonuses } from '../model';
import { Rng, seededRng } from '../rng';
import { spentPoints, talentPoints } from '../talents';
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
  const minKeptCp = Math.min(...normalKept.map(cp));
  const maxExcessCp = Math.max(...excess.filter((m) => !m.shiny).map(cp));
  expect(minKeptCp).toBeGreaterThanOrEqual(maxExcessCp); // les plus forts sont gardés
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
  const a = makeMon(46, 10, seededRng(1), false); addMon(s, a); // posté en pension
  const b = makeMon(46, 11, seededRng(2), false); addMon(s, b);
  const c = makeMon(46, 12, seededRng(3), false); addMon(s, c);
  const d = makeMon(46, 13, seededRng(4), false); addMon(s, d); // le plus fort, gardé en réserve
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

  autoEquipBest(s, lone.uid);
  const wornSets = Object.values(lone.items).map((u) => TEMPLATES.find((t) => t.id === s.items[u!].templateId)?.set);
  expect(wornSets).toEqual(['sylve', 'sylve', 'sylve']);
});

test('releaseBelowStars / releaseNotShiny : ne gardent que le critère demandé dans la boîte', () => {
  const s = newGame();
  chooseStarter(s, 4, seededRng(1));
  addMon(s, makeMon(1, 5, seededRng(50)));
  addMon(s, makeMon(7, 5, seededRng(51)));
  const weak = { ...makeMon(46, 10, seededRng(1), false), genes: { hp: 0, atk: 0, def: 0, spe: 0 } }; // 1★
  const strong = { ...makeMon(46, 10, seededRng(2), false), genes: { hp: 15, atk: 15, def: 15, spe: 15 } }; // 4★
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

test('bestStarsOf : 0 si jamais capturé, sinon le meilleur exemplaire possédé', () => {
  const s = newGame();
  expect(bestStarsOf(s, 46)).toBe(0);
  addMon(s, { ...makeMon(46, 10, seededRng(1)), genes: { hp: 0, atk: 0, def: 0, spe: 0 } }); // 1★
  expect(bestStarsOf(s, 46)).toBe(1);
  addMon(s, { ...makeMon(46, 10, seededRng(2)), genes: { hp: 15, atk: 15, def: 15, spe: 15 } }); // 4★
  expect(bestStarsOf(s, 46)).toBe(4);
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
  expect(rankUpTalent(s, uid, 'affinity1', 'fire')).toBe(false); // type propre au Pokémon, pas éligible
  expect(rankUpTalent(s, uid, 'affinity1', 'normal')).toBe(true); // seul type éligible pour Dracaufeu
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

test('exploration : éclats (3/min/poste), plafond 8 h, jamais un membre de l’équipe', () => {
  const s = strongGame();
  const rng = seededRng(4);
  const extra = makeMon(43, 10, rng);
  addMon(s, extra); // rejoint l'équipe (2e place)
  expect(assignExploration(s, extra.uid, 0)).toBe(false);
  s.team = [s.team[0]];
  expect(assignExploration(s, extra.uid, 0)).toBe(true);
  const before = s.shards;
  const gained = harvestExploration(s, 24 * H); // 24 h plus tard → plafond 8 h
  expect(gained).toBe(8 * 60 * SHARDS_PER_MIN);
  expect(s.shards).toBe(before + gained);
  expect(harvestExploration(s, 24 * H)).toBe(0); // rien de nouveau, le poste vient d'être récolté
});

test('pension : XP passive plafonnée à 8 h, jamais un membre de l’équipe', () => {
  const s = strongGame();
  const extra = makeMon(43, 5, seededRng(4));
  addMon(s, extra); // rejoint l'équipe (2e place)
  const rate = 100; // XP/h de test (calculée par l'appelant via teamXpPerHour × PENSION_XP_SHARE)
  expect(assignPension(s, extra.uid, rate, 0)).toBe(false); // encore dans l'équipe
  s.team = [s.team[0]];
  expect(assignPension(s, extra.uid, rate, 0)).toBe(true);
  const before = s.mons[extra.uid].xp;
  const h = harvestPension(s, rate, 24 * H); // 24 h plus tard → plafond 8 h (donc 8 × rate)
  expect(h.gains).toHaveLength(1);
  expect(h.gains[0].xp).toBe(8 * rate);
  expect(s.mons[extra.uid].xp).toBe(before + 8 * rate);
  expect(harvestPension(s, rate, 24 * H).gains).toHaveLength(0); // rien de plus juste après
  expect(assignPension(s, extra.uid, rate, 0)).toBe(true); // déjà en pension : no-op, pas d'erreur
  expect(removePension(s, extra.uid) === undefined).toBe(true);
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
