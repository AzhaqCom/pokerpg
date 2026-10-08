import { Battle, BattleEvent, FRONT_PCT, HP_SCALE } from '../battle';
import { REGIONS, regionLastBiome } from '../content';
import {
  BOOSTS, GameState, TOWER_BLESSED_ODDS, TOWER_BLESSED_PLUS, TOWER_NODES, addMon, buyTowerNode, equip, holder, makeMon, newGame,
  resetTowerTree, setTowerIdlePick, setTowerSlot, toggleTowerSet, towerBlessedPlus, towerClimbStart, towerDropPool, towerIdleCapMs,
  towerMedals, towerMedalsLeft, towerMedalsSpent, towerNodeBlock, towerPowerMult, towerRank, towerStart, towerTreeReady, transmuteCost,
  transmuteItem, transmuteTargets, withTowerMult, allyFighter, wildFighter, towerFighters, towerReserve, setTowerReserve, release,
  TOWER_RAMPART_FRONT, TOWER_RESERVE_HP, setTeam, towerRetryFloor, StageRun, boxEquipped, unequipBox,
} from '../game';
import { Rng } from '../rng';
import { computeIdleGains } from '../idle';
import { STAT_WEIGHT, makeItem, mainValue, template } from '../items';
import { seededRng } from '../rng';

const H = 3600_000;

/** Fin de jeu, équipe surpuissante (3 Mewtwo Nv.100 équipés en Chromatique +5 Nv.300) : gagne les premiers étages. */
function towerGame(): GameState {
  const s = newGame();
  s.prestige = REGIONS.length - 1;
  s.arenaBeaten[regionLastBiome(s.prestige)] = true;
  s.badges = 8;
  for (let i = 0; i < 3; i++) {
    const m = makeMon(150, 100, seededRng(10 + i), false, 15);
    addMon(s, m);
    for (const id of ['gantelet-champion', 'cape-champion', 'baie-champion']) {
      const it = makeItem(id, 6, 300, seededRng(20 + i), 46);
      it.plus = 5;
      s.items[it.uid] = it;
      equip(s, m.uid, it.uid);
    }
  }
  return s;
}

test('arbre de la Tour : médailles du record, prérequis, nœuds à venir, rangs, réinitialisation gratuite', () => {
  const s = towerGame();
  s.towerBest = 370;
  expect(towerMedals(s)).toBe(37); // rétroactif : 1 par palier de 10 déjà franchi
  expect(TOWER_NODES.reduce((a, n) => a + n.costs.reduce((x, c) => x + c, 0), 0)).toBe(62);
  expect(towerTreeReady(s)).toBe(true);
  // prérequis : Transmutation demande Butin béni, qui demande Butin précis
  expect(towerNodeBlock(s, 'transmutation')).toBe('requires');
  expect(buyTowerNode(s, 'butinBeni')).toBe(false);
  expect(buyTowerNode(s, 'butinPrecis')).toBe(true);
  expect(buyTowerNode(s, 'butinBeni')).toBe(true);
  expect(buyTowerNode(s, 'transmutation')).toBe(true);
  expect(towerMedalsSpent(s)).toBe(17);
  // rangs : Longue absence 16 h puis 24 h, puis plus rien
  expect(buyTowerNode(s, 'longueAbsence')).toBe(true);
  expect(buyTowerNode(s, 'longueAbsence')).toBe(true);
  expect(towerNodeBlock(s, 'longueAbsence')).toBe('max');
  expect(towerMedalsLeft(s)).toBe(37 - 17 - 8);
  // médailles manquantes
  for (let i = 0; i < 5; i++) buyTowerNode(s, 'entrainement');
  expect(towerRank(s, 'entrainement')).toBe(5);
  expect(towerMedalsLeft(s)).toBe(2);
  expect(towerNodeBlock(s, 'secondeChance')).toBe('medals');
  expect(towerTreeReady(s)).toBe(false);
  resetTowerTree(s);
  expect(towerMedalsLeft(s)).toBe(37);
  // avant la fin de jeu : rien
  const early = newGame();
  early.towerBest = 50;
  expect(buyTowerNode(early, 'butinPrecis')).toBe(false);
});

test('Butin précis : les Chromatiques de la Tour ne tombent plus que dans l\'emplacement choisi', () => {
  const s = towerGame();
  s.towerBest = 100;
  toggleTowerSet(s, 'ruche');
  setTowerSlot(s, 'defense');
  expect(towerDropPool(s)).toHaveLength(3); // sans le nœud, le choix est sans effet
  buyTowerNode(s, 'butinPrecis');
  expect(towerDropPool(s).map((t) => t.slot)).toEqual(['defense']);
  // sans panoplie visée : la pièce défensive de chacune des 20 panoplies
  toggleTowerSet(s, 'ruche');
  expect(towerDropPool(s)).toHaveLength(20);
  expect(towerDropPool(s).every((t) => t.slot === 'defense')).toBe(true);
  setTowerSlot(s, null);
  expect(towerDropPool(s)).toHaveLength(60);
});

test('Butin béni : 1 Chromatique sur 25 avec 3 crans de plus, en combat comme hors ligne', () => {
  const s = towerGame();
  s.towerBest = 23;
  const rng = seededRng(3);
  expect(Array.from({ length: 1000 }, () => towerBlessedPlus(s, rng)).every((p) => p === 0)).toBe(true); // sans le nœud
  s.towerTree = { butinPrecis: 1, butinBeni: 1 };
  const n = 20000;
  const blessed = Array.from({ length: n }, () => towerBlessedPlus(s, rng)).filter((p) => p === TOWER_BLESSED_PLUS).length;
  expect(blessed / n).toBeGreaterThan(0.8 / TOWER_BLESSED_ODDS);
  expect(blessed / n).toBeLessThan(1.2 / TOWER_BLESSED_ODDS);
  // hors ligne (étages < 150 : butin +0, béni +3), compté dans le résumé
  const g = computeIdleGains(s, 12 * H, seededRng(4))!;
  const plus3 = g.bagItems.filter((it) => it.plus === TOWER_BLESSED_PLUS).length;
  expect(g.bagItems.every((it) => !it.plus || it.plus === TOWER_BLESSED_PLUS)).toBe(true);
  expect(g.tower!.blessed).toBe(plus3);
});

test('Transmutation : autre panoplie au même emplacement, cran, niveau, sous-stats et puissance gardés, objet toujours porté', () => {
  const s = towerGame();
  s.towerBest = 370;
  const cape = Object.values(s.items).find((it) => it.templateId === 'cape-champion')!;
  const wearer = holder(s, cape.uid)!;
  cape.level = 1700;
  const targets = transmuteTargets(cape);
  expect(targets).toHaveLength(19);
  expect(targets.every((t) => t.slot === 'defense')).toBe(true);
  // sans le nœud : refusé
  s.shards = 1e12;
  expect(transmuteItem(s, cape.uid, targets[0].id, seededRng(1))).toBeNull();
  s.towerTree = { butinPrecis: 1, butinBeni: 1, transmutation: 1 };
  // chaque pièce possible : même puissance de stat principale, aucune sous-stat en double avec elle
  for (const t of targets) {
    const copy = towerGame();
    copy.towerBest = 370;
    copy.towerTree = s.towerTree;
    copy.shards = 1e12;
    const it = Object.values(copy.items).find((x) => x.templateId === 'cape-champion')!;
    it.level = 1700;
    const before = { ...it, subs: it.subs.slice() };
    const out = transmuteItem(copy, it.uid, t.id, seededRng(2))!;
    expect(out.templateId).toBe(t.id);
    expect([out.uid, out.plus, out.level, out.rarity]).toEqual([before.uid, before.plus, before.level, before.rarity]);
    const banned = [t.main, ...(t.flat ? [t.flat] : []), ...(t.bonusCrit ? ['critPct'] : [])];
    expect(out.subs.some((x) => banned.includes(x.stat))).toBe(false);
    expect(out.subs).toHaveLength(before.subs.length);
    expect(new Set(out.subs.map((x) => x.stat)).size).toBe(out.subs.length);
    // sous-stats sans conflit : intactes
    for (const sub of before.subs) if (!banned.includes(sub.stat)) expect(out.subs).toContainEqual(sub);
    expect(copy.shards).toBe(1e12 - transmuteCost(copy));
  }
  // puissance : même « valeur pondérée » de stat principale (comme deux pièces d'un même biome)
  const target = targets.find((t) => t.main !== template(cape.templateId).main && !t.flat)!;
  const before = mainValue(cape);
  const out = transmuteItem(s, cape.uid, target.id, seededRng(3))!;
  const from = template('cape-champion');
  expect((mainValue(out) * STAT_WEIGHT[target.main]) / (before * STAT_WEIGHT[from.main])).toBeCloseTo(1, 2);
  // même uid : toujours porté par le même Pokémon, au même emplacement
  expect(holder(s, out.uid)?.uid).toBe(wearer.uid);
  expect(wearer.items.defense).toBe(out.uid);
  // pas assez d'éclats
  s.shards = 0;
  expect(transmuteItem(s, cape.uid, targets[1].id, seededRng(4))).toBeNull();
  // une baie ne devient jamais un objet défensif
  const berry = Object.values(s.items).find((it) => it.templateId === 'baie-champion')!;
  expect(transmuteTargets(berry).every((t) => t.slot === 'berry')).toBe(true);
});

test('Longue absence : 12 h, 16 h puis 24 h dans la Tour ; le farm des zones reste à 12 h', () => {
  const s = towerGame();
  s.towerBest = 23;
  expect(towerIdleCapMs(s)).toBe(12 * H);
  expect(computeIdleGains(s, 30 * H, seededRng(1))!.durationMs).toBe(12 * H);
  s.towerTree = { longueAbsence: 1 };
  expect(computeIdleGains(s, 30 * H, seededRng(1))!.durationMs).toBe(16 * H);
  s.towerTree = { longueAbsence: 2 };
  expect(computeIdleGains(s, 30 * H, seededRng(1))!.durationMs).toBe(24 * H);
  expect(computeIdleGains(s, 5 * H, seededRng(1))!.durationMs).toBe(5 * H);
  s.towerIdle = false;
  expect(computeIdleGains(s, 30 * H, seededRng(1))!.durationMs).toBe(12 * H);
});

test('Départ lancé : la Tour repart 2 étages sous le record, jamais sous le palier', () => {
  const s = towerGame();
  s.towerBest = 366;
  expect([towerStart(s), towerClimbStart(s)]).toEqual([361, 360]);
  s.towerTree = { departLance: 1 };
  expect([towerStart(s), towerClimbStart(s)]).toEqual([364, 364]);
  s.towerBest = 370;
  expect([towerStart(s), towerClimbStart(s)]).toEqual([371, 370]);
  s.towerBest = 371;
  expect([towerStart(s), towerClimbStart(s)]).toEqual([371, 370]);
});

test('Seconde chance : hors ligne, la 1re défaite de chaque palier fait retenter l\'étage', () => {
  // étage fixe au mur de l'équipe de test (~étage 200) : des défaites
  const wall = () => { const s = towerGame(); s.towerBest = 220; s.towerIdleClimb = false; setTowerIdlePick(s, 220); return s; };
  const without = computeIdleGains(wall(), 4 * H, seededRng(5))!;
  expect(without.tower!.spared).toBe(0);
  const s = wall();
  s.towerTree = { secondeChance: 1 };
  const g = computeIdleGains(s, 4 * H, seededRng(5))!;
  // étages joués entre 211 et 220 : 1 ou 2 paliers, une seconde chance chacun au plus
  expect(g.tower!.spared).toBeGreaterThanOrEqual(1);
  expect(g.tower!.spared).toBeLessThanOrEqual(2);
});

test('Entraînement : Attaque et PV +5 % par rang dans la Tour, cumulés avec l\'Élixir', () => {
  const s = towerGame();
  expect(towerPowerMult(s, false)).toBe(1);
  s.towerTree = { entrainement: 3 };
  expect(towerPowerMult(s, false)).toBeCloseTo(1.15, 6);
  expect(towerPowerMult(s, true)).toBeCloseTo(1.15 * BOOSTS.elixir.mult, 6);
  const f = { id: 'a', side: 0, speciesId: 1, level: 1, stats: { hp: 1000, atk: 200, def: 100, spe: 50 }, moves: [] } as never;
  const out = withTowerMult(f, 1.15) as unknown as { stats: { hp: number; atk: number; def: number } };
  expect([out.stats.hp, out.stats.atk, out.stats.def]).toEqual([1150, 230, 100]);
});

// ---------------------------------------------------------------- Stratège (étape 2)

/** Combat déroulé pas à pas : tous ses événements. */
function play(b: Battle): BattleEvent[] {
  const events: BattleEvent[] = [];
  while (!b.result) { b.step(0.05); events.push(...b.drain()); }
  return events;
}

/** Ennemis de la Tour (Mewtwo Nv.100) à la force `mult`. */
function foes(mult: number, rng: Rng, n = 3) {
  return Array.from({ length: n }, (_, j) => wildFighter(`e${j}`, makeMon(150, 100, rng, false, 15), { wild: true, wildMult: mult }));
}

test('combat sans options : strictement identique (mêmes tirages), options neutres comprises', () => {
  const s = towerGame();
  const allies = () => s.team.map((u) => allyFighter(s, u));
  const run = (opts?: object) => {
    const b = new Battle([...allies(), ...foes(40, seededRng(9))], seededRng(3), opts);
    const ev = play(b);
    return { result: b.result, t: b.t, n: ev.length, hp: b.fighters.map((f) => f.hp) };
  };
  const base = run();
  expect(run({})).toEqual(base);
  expect(run({ frontPct: FRONT_PCT })).toEqual(base);
});

test('Relève : la réserve entre une fois, 0,8 s après le 1er K.O., à sa place, à 50 % (100 % aguerrie) de ses PV', () => {
  for (const veteran of [false, true]) {
    const s = towerGame();
    s.towerBest = 370;
    const reserve = makeMon(68, 100, seededRng(77), false, 15);
    addMon(s, reserve); // l'équipe est pleine : il reste en boîte
    s.towerTree = veteran ? { releve: 1, releveAguerrie: 1 } : { releve: 1 };
    expect(setTowerReserve(s, reserve.uid)).toBe(true);
    const { allies, opts } = towerFighters(s, false);
    expect(opts.reserveHpPct).toBe(veteran ? 1 : TOWER_RESERVE_HP);
    // équipiers à 1 PV sans baie qui ne frappent pas, ennemis faibles : le 1er coup reçu par la réserve ne la met pas K.O.
    const fragile = allies.map((f) => ({ ...f, hp: 1, berry: undefined, stats: { ...f.stats, atk: 1 } }));
    const b = new Battle([...fragile, ...foes(1, seededRng(5))], seededRng(6), opts);
    const ev = play(b);
    const enters = ev.filter((e) => e.kind === 'enter');
    expect(enters).toHaveLength(1);
    const enter = enters[0] as Extract<BattleEvent, { kind: 'enter' }>;
    const firstFaint = ev.find((e) => e.kind === 'faint' && e.side === 0) as Extract<BattleEvent, { kind: 'faint' }>;
    expect(enter.target).toBe(reserve.uid);
    expect(enter.replaces).toBe(firstFaint.target);
    expect(enter.t - firstFaint.t).toBeGreaterThanOrEqual(0.8 - 1e-9);
    expect(enter.t - firstFaint.t).toBeLessThan(0.86);
    // à la place du Pokémon K.O.
    const slot = s.team.indexOf(firstFaint.target);
    expect(b.fighters[slot].id).toBe(reserve.uid);
    // PV à l'entrée : ceux du premier coup reçu (PV restants + dégâts), sans soin entre-temps
    const after = ev.slice(ev.indexOf(enter));
    const hit = after.find((e) => (e.kind === 'damage' || e.kind === 'heal' || e.kind === 'tick') && e.target === reserve.uid);
    expect(hit?.kind).toBe('damage');
    const maxHp = opts.reserve!.stats.hp * HP_SCALE;
    const d = hit as Extract<BattleEvent, { kind: 'damage' }>;
    expect(d.hpLeft + d.amount).toBe(Math.round(maxHp * (veteran ? 1 : TOWER_RESERVE_HP)));
  }
});

test('Relève : la réserve sauve un combat dont le dernier équipier tombe', () => {
  const s = towerGame();
  s.towerBest = 370;
  const weak = s.mons[s.team[0]];
  const reserve = makeMon(150, 100, seededRng(78), false, 15);
  addMon(s, reserve);
  const base = allyFighter(s, weak.uid);
  const ally = { ...base, hp: 1, berry: undefined, stats: { ...base.stats, atk: 1 } }; // sans baie, ne fait rien, tombe au 1er coup
  const rival = () => foes(1, seededRng(8), 1);
  const lost = new Battle([ally, ...rival()], seededRng(2));
  lost.runToEnd();
  expect(lost.result).toBe('lose');
  const saved = new Battle([{ ...ally }, ...rival()], seededRng(2), { reserve: allyFighter(s, reserve.uid), reserveHpPct: 1 });
  const ev = play(saved);
  expect(ev.some((e) => e.kind === 'enter')).toBe(true);
  expect(saved.result).toBe('win');
});

test('Relève aguerrie : l\'aura de la réserve compte en entier pour toute l\'équipe (jamais deux fois)', () => {
  const s = towerGame();
  s.towerBest = 370;
  const reserve = makeMon(68, 100, seededRng(77), false, 15); // Mackogneur, Combat : Dégâts critiques +6
  addMon(s, reserve);
  setTowerReserve(s, reserve.uid);
  s.towerTree = { releve: 1 };
  const plain = towerFighters(s, false).allies[0].bonuses!.critDmgPct;
  s.towerTree = { releve: 1, releveAguerrie: 1 };
  expect(towerFighters(s, false).allies[0].bonuses!.critDmgPct - plain).toBeCloseTo(6, 6);
  // en pension aussi : sa demi-aura n'est pas comptée en plus
  s.pension.push({ uid: reserve.uid, since: Date.now() } as never);
  s.towerTree = { releve: 1 };
  const halfPlain = towerFighters(s, false).allies[0].bonuses!.critDmgPct;
  expect(halfPlain - plain).toBeCloseTo(3, 6);
  s.towerTree = { releve: 1, releveAguerrie: 1 };
  expect(towerFighters(s, false).allies[0].bonuses!.critDmgPct - plain).toBeCloseTo(6, 6);
});

test('Relève : réserve protégée, jamais dans l\'équipe, inactive sans le nœud', () => {
  const s = towerGame();
  s.towerBest = 370;
  const reserve = makeMon(68, 100, seededRng(77), false, 15);
  addMon(s, reserve);
  expect(setTowerReserve(s, s.team[0])).toBe(false); // un membre de l'équipe
  expect(setTowerReserve(s, reserve.uid)).toBe(true);
  expect(towerReserve(s)).toBeNull(); // sans le nœud
  expect(towerFighters(s, false).opts.reserve).toBeUndefined();
  s.towerTree = { releve: 1 };
  expect(towerReserve(s)).toBe(reserve.uid);
  expect(release(s, reserve.uid)).toBe(false); // jamais relâchée
  // mise dans l'équipe : n'est plus la réserve
  setTeam(s, [reserve.uid, s.team[1], s.team[2]]);
  expect(towerReserve(s)).toBeNull();
});

test('Rempart : le Pokémon de devant prend ~70 % des coups à cible unique au lieu de ~80 %', () => {
  const s = towerGame();
  const ids = new Set(s.team);
  const share = (frontPct?: number) => {
    let front = 0, all = 0;
    for (let k = 0; k < 12; k++) {
      // alliés increvables (aucun K.O. : la cible de devant reste la même), ennemis faibles qui frappent longtemps
      const allies = s.team.map((u) => { const f = allyFighter(s, u); return { ...f, stats: { ...f.stats, hp: f.stats.hp * 1e6, atk: 1 } }; });
      const b = new Battle([...allies, ...foes(1, seededRng(40 + k))], seededRng(50 + k), frontPct ? { frontPct } : undefined);
      for (const e of play(b)) {
        if (e.kind !== 'use' || e.aoe || !ids.has(e.targets[0])) continue;
        all++;
        if (e.targets[0] === s.team[0]) front++;
      }
    }
    return front / all;
  };
  const plain = share();
  const rampart = share(TOWER_RAMPART_FRONT);
  expect(plain).toBeGreaterThan(0.76);
  expect(plain).toBeLessThan(0.84);
  expect(rampart).toBeGreaterThan(0.66);
  expect(rampart).toBeLessThan(0.74);
});

test('Départ lancé : en combat continu, une défaite fait reprendre 2 étages sous l\'étage perdu, jamais sous la reprise d\'avant', () => {
  expect([towerRetryFloor(386), towerRetryFloor(381), towerRetryFloor(382)]).toEqual([381, 371, 381]);
  expect([towerRetryFloor(386, true), towerRetryFloor(381, true), towerRetryFloor(382, true), towerRetryFloor(2, true)]).toEqual([384, 379, 381, 1]);
  // branché sur la défaite dans la Tour
  const s = towerGame();
  s.towerBest = 390;
  s.towerFloor = 386;
  s.towerTree = { departLance: 1 };
  const run = new StageRun(s, 'tower', seededRng(1));
  // équipe sans PV : défaite immédiate
  for (const f of run.battle.fighters.filter((x) => x.side === 0)) f.hp = 1;
  run.battle.runToEnd();
  run.finishWave();
  expect(run.result).toBe('lose');
  expect(s.towerFloor).toBe(384);
});

test('Relève : « Déséquiper la boîte » ne compte ni ne déséquipe la réserve', () => {
  const s = towerGame();
  s.towerBest = 370;
  s.towerTree = { releve: 1 };
  const reserve = makeMon(68, 100, seededRng(77), false, 15);
  const other = makeMon(1, 50, seededRng(78), false, 15);
  addMon(s, reserve);
  addMon(s, other);
  for (const m of [reserve, other]) {
    const it = makeItem('cape-champion', 6, 300, seededRng(m === reserve ? 1 : 2), 46);
    s.items[it.uid] = it;
    equip(s, m.uid, it.uid);
  }
  setTowerReserve(s, reserve.uid);
  expect(boxEquipped(s).map((m) => m.uid)).toEqual([other.uid]);
  expect(unequipBox(s)).toBe(1);
  expect(Object.keys(s.mons[reserve.uid].items)).toHaveLength(1); // la réserve garde son objet
  expect(Object.keys(s.mons[other.uid].items)).toHaveLength(0);
  // sans le nœud, ce n'est plus une réserve : déséquipée comme le reste de la boîte
  s.towerTree = {};
  expect(unequipBox(s)).toBe(1);
});
