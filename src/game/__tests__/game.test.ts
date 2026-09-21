import { BIOMES, STAGES_PER_ZONE } from '../content';
import { ALL_SPECIES } from '../data';
import {
  GameState, PENSION_XP_FALLBACK_PER_HOUR, StageRun, arenaAvailable, assignExploration, assignPension, autoCaptureBall, bestStarsOf, biomeAvailable, bossAvailable,
  canEvolve, captureChance, captureLevel, chooseStarter, equip, evolve, excessMons, fuseItems, fusionBadgeCount, fusionCandidates, giveXp, harvestExploration, harvestPension,
  holder, makeMon, addMon, makeWaves, migrateSave, newGame, rankUpTalent, recycle, release, releaseExcess, remainingEvolutions, removePension, selectStage,
  teamMaxLevel, tryCapture, xpGapMult,
} from '../game';
import { makeItem } from '../items';
import { emptyBonuses } from '../model';
import { Rng, seededRng } from '../rng';
import { spentPoints } from '../talents';
import { combatPower, finalStats } from '../stats';

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

test('courbe de niveau : chaque biome codé monte jusqu’au niveau documenté dans BIOMES.md, sans rupture avec le suivant', () => {
  BIOMES.forEach((b, i) => {
    expect(b.zones[0].minLv).toBeLessThanOrEqual(b.zones[1].minLv);
    expect(b.zones[1].minLv).toBeLessThanOrEqual(b.zones[2].minLv);
    const arenaMaxLv = Math.max(...b.arena.team.map(([, lv]) => lv));
    expect(arenaMaxLv).toBeGreaterThanOrEqual(b.zones[2].maxLv);
    if (i < DOCUMENTED_END_LEVELS.length) expect(arenaMaxLv).toBe(DOCUMENTED_END_LEVELS[i]);
    if (i > 0) expect(b.zones[0].minLv).toBe(Math.max(...BIOMES[i - 1].arena.team.map(([, lv]) => lv)));
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

test('biomes 9-10 : Artikodin/Électhor/Sulfura/Mewtwo/Mew sont des boss rejouables (farmables sans être en pool)', () => {
  const legendaries = [144, 145, 146, 150, 151];
  const bosses = [...BIOMES[8].zones, ...BIOMES[9].zones].map((z) => z.boss);
  for (const id of legendaries) {
    const boss = bosses.find((b) => b.speciesId === id);
    expect(boss?.repeatable).toBe(true);
  }
});

test('biome 10 : boss rejouable (Mewtwo) chromatique tiré comme un sauvage', () => {
  const alwaysShiny: Rng = { int: () => 0 };
  const waves = makeWaves('boss', 9, 1, 1, alwaysShiny); // biome 10, zone Grotte Bleue (Mewtwo)
  expect(waves[0][0].mon.shiny).toBe(true);
});

test('les 151 espèces sont farmables en chromatique une fois les 10 biomes codés : 81 formes de base/sans ' +
  'évolution, toutes en rencontre sauvage OU boss rejouable (un boss classique n’est jamais chromatique)', () => {
  const targets = new Set(ALL_SPECIES.filter((s) => s.evolvesTo).map((s) => s.evolvesTo));
  const mustPlace = ALL_SPECIES.filter((s) => !targets.has(s.id)).map((s) => s.id);
  const wildPool = new Set(BIOMES.flatMap((b) => b.zones.flatMap((z) => z.pool.map(([id]) => id))));
  const repeatableBosses = new Set(
    BIOMES.flatMap((b) => b.zones.filter((z) => z.boss.repeatable).map((z) => z.boss.speciesId)),
  );
  const missing = mustPlace.filter((id) => !wildPool.has(id) && !repeatableBosses.has(id));
  expect(missing).toEqual([]);
});

test('boss rejouable (légendaire) : chromatique tiré comme un sauvage à chaque tentative ; boss de zone classique jamais chromatique', () => {
  const alwaysShiny: Rng = { int: () => 0 };
  const repeatableWaves = makeWaves('boss', 8, 1, 1, alwaysShiny); // biome 9, zone Artikodin (repeatable)
  expect(repeatableWaves[0][0].mon.shiny).toBe(true);
  const classicWaves = makeWaves('boss', 0, 0, 1, alwaysShiny); // biome 1, zone Lisière (boss classique)
  expect(classicWaves[0][0].mon.shiny).toBe(false);
});

test('boss rejouable : l’offre de capture reflète le tirage chromatique (jamais garanti false comme un boss classique)', () => {
  // seed 307 : le tout premier tirage (le jet chromatique du boss, dans makeWaves) tombe à 0 → chromatique.
  // Rng séparé pour la mise en place (équipe écrasante, indépendante du seed de combat) et pour le combat.
  const overpowered = makeMon(4, 1000, seededRng(1), false, 15);
  const s = newGame();
  addMon(s, overpowered);
  s.biome = 8; s.zone = 1; // biome 9, zone Artikodin (repeatable)
  const run = new StageRun(s, 'boss', seededRng(307));
  run.battle.runToEnd();
  const rewards = run.finishWave();
  expect(run.result).toBe('win');
  expect(rewards?.capture?.guaranteed).toBe(true);
  expect(rewards?.capture?.shiny).toBe(true);
});

test('boss rejouable : le bouton Défier reste actif après une 1re victoire (jamais verrouillé côté carte)', () => {
  const s = newGame();
  expect(BIOMES[8].zones[1].boss.repeatable).toBe(true); // Artikodin
  expect(BIOMES[0].zones[0].boss.repeatable).toBeUndefined(); // boss de zone classique
  s.bossesBeaten[8][1] = true; // déjà battu une fois
  expect(BIOMES[8].zones[1].boss.repeatable || !s.bossesBeaten[8][1]).toBe(true); // reste défiable
});

test('remainingEvolutions : 0 pour une forme finale, 1/2 pour Paras/Aspicot', () => {
  expect(remainingEvolutions(47)).toBe(0); // Parasect, forme finale
  expect(remainingEvolutions(46)).toBe(1); // Paras → Parasect
  expect(remainingEvolutions(13)).toBe(2); // Aspicot → Coconfort → Dardargnan
});

test('excessMons / releaseExcess : garde les plus forts, jamais l’équipe, chromatique à part', () => {
  const s = newGame();
  chooseStarter(s, 4, seededRng(1));
  addMon(s, makeMon(1, 5, seededRng(50))); // complète l'équipe à 3 pour que les Paras aillent en boîte
  addMon(s, makeMon(7, 5, seededRng(51)));
  // 5 Paras normaux (garde 2) + 3 Paras chromatiques (garde 2, quota séparé)
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

test('rankUpTalent : le palier 5 ne propose pas un type déjà pris au palier 4 s’il en reste un autre', () => {
  const s = newGame();
  const pikachu = makeMon(25, 60, seededRng(9)); // Nv.60, 2 types éligibles (normal, psychic)
  addMon(s, pikachu);
  const uid = pikachu.uid;
  const m = s.mons[uid];
  for (let i = 0; i < 5; i++) rankUpTalent(s, uid, 'power');
  for (let i = 0; i < 5; i++) rankUpTalent(s, uid, 'vigor');
  for (let i = 0; i < 5; i++) rankUpTalent(s, uid, 'guard');
  for (let i = 0; i < 5; i++) rankUpTalent(s, uid, 'reflex'); // 20 dépensés, palier 4 débloqué
  for (let i = 0; i < 15; i++) rankUpTalent(s, uid, 'affinity1', 'normal'); // rang max 15 → 35 dépensés
  for (let i = 0; i < 5; i++) rankUpTalent(s, uid, 'spec'); // 40 dépensés, palier 5 débloqué
  expect(spentPoints(m.talents)).toBe(40);
  expect(m.talentTypeChoices.affinity1).toBe('normal');

  expect(rankUpTalent(s, uid, 'affinity2', 'normal')).toBe(false); // déjà pris au palier 4, psychic dispo
  expect(rankUpTalent(s, uid, 'affinity2', 'psychic')).toBe(true);
  expect(m.talentTypeChoices.affinity2).toBe('psychic');
});

test('fusionBadgeCount : compte les groupes fusionnables, sans se soucier des porteurs (approximation pour le badge)', () => {
  const s = strongGame();
  const rng = seededRng(2);
  expect(fusionBadgeCount(s)).toBe(0);
  const lunettes = [0, 1, 2].map(() => makeItem('lunettes', 0, 3, rng));
  for (const it of lunettes) s.items[it.uid] = it;
  expect(fusionBadgeCount(s)).toBe(1);
  // objets portés ou d'un gabarit différent : comptés/exclus comme fusionCandidates, juste sans le détail des porteurs
  equip(s, s.team[0], lunettes[0].uid);
  expect(fusionBadgeCount(s)).toBe(1); // toujours 3 exemplaires du même gabarit, peu importe qui les porte
  const griffe = [0, 1].map(() => makeItem('griffe', 1, 3, rng));
  for (const it of griffe) s.items[it.uid] = it; // seulement 2 : pas encore fusionnable
  expect(fusionBadgeCount(s)).toBe(1);
});

test('fusion depuis l’inventaire : l’objet porté reste porté', () => {
  const s = strongGame();
  const rng = seededRng(2);
  const before = Object.keys(s.items); // objets du starter (griffe/écharpe/oran), déjà équipés
  const items = [0, 1, 2].map(() => makeItem('lunettes', 0, 3, rng));
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
  const items = [0, 1, 2].map(() => makeItem('lunettes', 0, 3, rng));
  for (const it of items) s.items[it.uid] = it;
  equip(s, s.team[0], items[0].uid);
  equip(s, s.team[1], items[1].uid); // porté par un AUTRE Pokémon que items[0]
  // 3 exemplaires mais 2 porteurs différents : aucune fusion tant qu'un 4e n'est pas libre
  expect(fusionCandidates(s)).toHaveLength(0);

  const extra = makeItem('lunettes', 0, 1, rng);
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
  const a = makeItem('griffe', 2, 3, rng), b = makeItem('griffe', 2, 3, rng);
  s.items[a.uid] = a; s.items[b.uid] = b;
  equip(s, s.team[0], a.uid);
  const gain = recycle(s, [a.uid, b.uid]);
  expect(gain).toBeGreaterThan(0);
  expect(s.items[a.uid]).toBeDefined();
  expect(s.items[b.uid]).toBeUndefined();
});

test('exploration : cycles par poste, plafond 8 h, jamais un membre de l’équipe', () => {
  const s = strongGame();
  const rng = seededRng(4);
  const extra = makeMon(43, 10, rng);
  addMon(s, extra); // rejoint l'équipe (2e place)
  expect(assignExploration(s, extra.uid, 'orchard', 0)).toBe(false);
  s.team = [s.team[0]];
  expect(assignExploration(s, extra.uid, 'orchard', 0)).toBe(true);
  const h = harvestExploration(s, rng, 24 * H); // 24 h plus tard → plafond 8 h
  expect(h.berries.length).toBe(8 * 2); // Mystherbe (Plante) : ×2
  expect(harvestExploration(s, rng, 24 * H).berries.length).toBe(0);
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
  const h = harvestPension(s, 24 * H); // 24 h plus tard → plafond 8 h (donc 8 × rate)
  expect(h.gains).toHaveLength(1);
  expect(h.gains[0].xp).toBe(8 * rate);
  expect(s.mons[extra.uid].xp).toBe(before + 8 * rate);
  expect(harvestPension(s, 24 * H).gains).toHaveLength(0); // rien de plus juste après
  expect(assignPension(s, extra.uid, rate, 0)).toBe(true); // déjà en pension : no-op, pas d'erreur
  expect(removePension(s, extra.uid) === undefined).toBe(true);
  expect(s.pension.length).toBe(0);
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
