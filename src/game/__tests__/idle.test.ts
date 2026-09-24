import { BIOMES } from '../content';
import { addMon, chooseStarter, makeMon, newGame, teamMaxLevel } from '../game';
import { IDLE_CAP_MS, applyIdleGains, computeIdleGains, idleRun, teamXpPerHour } from '../idle';
import { seededRng } from '../rng';

const H = 3600_000;

/** Équipe correcte pour la zone 0 (Nv 3-6), pour un calcul idle qui gagne des vagues. */
function readyGame() {
  const s = newGame();
  chooseStarter(s, 4, seededRng(1)); // starter Nv.5
  const m2 = makeMon(10, 5, seededRng(2));
  const m3 = makeMon(16, 5, seededRng(3));
  addMon(s, m2);
  addMon(s, m3);
  return s;
}

test('absence de moins d’une minute : aucun gain', () => {
  const s = readyGame();
  expect(computeIdleGains(s, 30_000, seededRng(1))).toBeNull();
});

test('équipe trop faible pour la zone en cours : 0 gain', () => {
  const s = newGame();
  const weak = makeMon(1, 2, seededRng(1));
  addMon(s, weak);
  s.zone = 2; // Clairière, Nv 10-14 : hors de portée d’un Nv.2
  const gains = computeIdleGains(s, 2 * H, seededRng(1));
  expect(gains).not.toBeNull();
  expect(gains!.wavesWon).toBe(0);
  expect(gains!.kills).toBe(0);
  expect(gains!.perMon.every((p) => p.xp === 0)).toBe(true);
  expect(gains!.bagItems.length).toBe(0);
  expect(gains!.shardsFromRecycle).toBe(0);
  expect(gains!.shinies.length).toBe(0);
});

test('recyclage auto hors ligne : désactivable, seuil de rareté configurable', () => {
  const s = readyGame();
  const withAuto = computeIdleGains(s, IDLE_CAP_MS, seededRng(7), { autoRecycle: true, recycleMaxRarity: 1 })!;
  const withoutAuto = computeIdleGains(s, IDLE_CAP_MS, seededRng(7), { autoRecycle: false })!;
  // même tirage (seed identique) : les objets qui partaient en éclats reviennent dans le sac
  expect(withoutAuto.shardsFromRecycle).toBe(0);
  expect(withoutAuto.bagItems.length).toBeGreaterThan(withAuto.bagItems.length);
  // sans options : comportement historique (équivalent à autoRecycle:true, recycleMaxRarity:1)
  const defaults = computeIdleGains(s, IDLE_CAP_MS, seededRng(7))!;
  expect(defaults.shardsFromRecycle).toBe(withAuto.shardsFromRecycle);
  expect(defaults.bagItems.length).toBe(withAuto.bagItems.length);
});

test('plafond 8h : une absence plus longue ne rapporte pas plus', () => {
  const s = readyGame();
  const at8h = computeIdleGains(s, IDLE_CAP_MS, seededRng(7))!;
  const at30h = computeIdleGains(s, 30 * H, seededRng(7))!;
  expect(at8h.durationMs).toBe(IDLE_CAP_MS);
  expect(at30h.durationMs).toBe(IDLE_CAP_MS);
  expect(at30h.wavesWon).toBe(at8h.wavesWon);
});

test('déterminisme : même état, même Rng → mêmes gains', () => {
  // les uid (mons/objets) intègrent Date.now() et ne sont pas déterministes ailleurs
  // dans le moteur ; on compare tout le reste, qui doit l'être avec un Rng fixé.
  const strip = (g: NonNullable<ReturnType<typeof computeIdleGains>>) => ({
    wavesWon: g.wavesWon, kills: g.kills, shardsFromRecycle: g.shardsFromRecycle,
    perMon: g.perMon.map(({ uid: _uid, ...rest }) => rest),
    bagItems: g.bagItems.map(({ uid: _uid, ...rest }) => rest),
    shinies: g.shinies.map(({ uid: _uid, ...rest }) => rest),
  });
  const s1 = readyGame();
  const s2 = readyGame();
  const g1 = computeIdleGains(s1, 3 * H, seededRng(42))!;
  const g2 = computeIdleGains(s2, 3 * H, seededRng(42))!;
  expect(strip(g1)).toEqual(strip(g2));
});

test('gains d’une absence normale : XP pondérée, loot recyclé ou en sac, jamais au-delà de l’étape débloquée', () => {
  const s = readyGame();
  const zone = s.zone, stage = s.stage;
  const gains = computeIdleGains(s, 4 * H, seededRng(3))!;
  expect(gains.wavesWon).toBeGreaterThan(0);
  expect(gains.perMon.some((p) => p.xp > 0)).toBe(true);
  for (const it of gains.bagItems) expect(it.rarity).toBeGreaterThanOrEqual(2);
  applyIdleGains(s, gains);
  expect(s.zone).toBe(zone);
  expect(s.stage).toBe(stage);
  for (const p of gains.perMon) if (p.xp > 0) expect(s.mons[p.uid].level).toBe(p.levelAfter);
  for (const it of gains.bagItems) expect(s.items[it.uid]).toBeDefined();
});

test('chromatique croisé en idle : capturé d’office, niveau plafonné au meilleur de l’équipe', () => {
  let found: ReturnType<typeof computeIdleGains> = null;
  for (let seed = 0; seed < 50 && !found?.shinies.length; seed++) {
    const s = readyGame();
    const gains = computeIdleGains(s, IDLE_CAP_MS, seededRng(seed));
    if (gains?.shinies.length) {
      found = gains;
      const cap = teamMaxLevel(s);
      for (const mon of gains.shinies) {
        expect(mon.shiny).toBe(true);
        expect(mon.level).toBeLessThanOrEqual(cap);
      }
      const before = s.dex.shiny.length;
      applyIdleGains(s, gains);
      expect(s.dex.shiny.length).toBeGreaterThan(before - 1); // au moins une nouvelle espèce chromatique vue
      for (const mon of gains.shinies) expect(s.mons[mon.uid]).toBeDefined();
    }
  }
  expect(found).not.toBeNull();
});

test('chromatique croisé en idle : ignoré si skipOwnedShiny et espèce déjà chromatique au Pokédex', () => {
  let sawSkip = false;
  for (let seed = 0; seed < 50 && !sawSkip; seed++) {
    const s = readyGame();
    // toutes les espèces de la zone 0 déjà chromatiques : n'importe quel croisement doit être ignoré
    for (const [id] of BIOMES[0].zones[0].pool) s.dex.shiny.push(id);
    const gains = computeIdleGains(s, IDLE_CAP_MS, seededRng(seed), { skipOwnedShiny: true });
    if (gains) {
      expect(gains.shinies.length).toBe(0);
      // même graine, sans le réglage : au moins un croisement aurait dû produire un chromatique
      const s2 = readyGame();
      const gains2 = computeIdleGains(s2, IDLE_CAP_MS, seededRng(seed));
      if (gains2 && gains2.shinies.length) sawSkip = true;
    }
  }
  expect(sawSkip).toBe(true);
});

test('teamXpPerHour : un taux par membre de l’équipe, positif si l’équipe est capable de gagner', () => {
  const s = readyGame();
  const rates = teamXpPerHour(s, seededRng(7));
  expect(Object.keys(rates)).toEqual(s.team);
  for (const uid of s.team) expect(rates[uid]).toBeGreaterThan(0);
});

test('idle : une zone déjà intégralement farmée (boss + tous les sauvages en normal/chromatique) passe à la suivante déjà débloquée', () => {
  const s = readyGame();
  // zone 0 « vidée » : boss vaincu, tous ses sauvages vus en normal et en chromatique
  s.bossesBeaten[0][0] = true;
  for (const [id] of BIOMES[0].zones[0].pool) { s.dex.caught.push(id); s.dex.shiny.push(id); }
  s.unlocked[0][1] = Math.max(1, s.unlocked[0][1]); // zone 1 déjà débloquée
  s.zone = 0; s.stage = 1;
  const gains = computeIdleGains(s, 4 * H, seededRng(3))!;
  expect(gains.farmZone).toBe(1);
  applyIdleGains(s, gains);
  expect(s.zone).toBe(1);
});

test('idle : une zone vidée mais dont la suivante n’est pas débloquée ne bouge pas', () => {
  const s = readyGame();
  s.bossesBeaten[0][0] = true;
  for (const [id] of BIOMES[0].zones[0].pool) { s.dex.caught.push(id); s.dex.shiny.push(id); }
  s.zone = 0; s.stage = 1;
  const gains = computeIdleGains(s, 4 * H, seededRng(3))!;
  expect(gains.farmZone).toBe(0);
});

test('teamXpPerHour : 0 pour une équipe hors de portée de la zone (jamais de victoire)', () => {
  const s = newGame();
  const weak = makeMon(1, 2, seededRng(1));
  addMon(s, weak);
  s.zone = 2; // Clairière, Nv 10-14 : hors de portée d'un Nv.2
  const rates = teamXpPerHour(s, seededRng(1));
  expect(rates[weak.uid]).toBe(0);
});

describe('idleRun : farm de l\'étape en cours, montée après 3 vagues gagnées, recul d\'une étape après un K.O.', () => {
  const smp = (kills: number, winRate = 1) => ({ winRate, avgWaveMs: 5000, avgKillsPerWonWave: kills, avgXpShare: {}, lootLevel: 1 });
  const H8 = 8 * 3600_000;
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
  const free = [smp(0), smp(1.5), smp(2), smp(2.5), smp(3), smp(3)];

  test('grimper jusqu\'à l\'étape 5 (3 ennemis/vague) rapporte plus que rester à l\'étape 1 (1,5 ennemi/vague)', () => {
    const climbing = idleRun(free as never, 1, 5, H8, seededRng(1));
    const stage1Only = idleRun(free as never, 1, 1, H8, seededRng(1));
    expect(sum(climbing.kills)).toBeGreaterThan(sum(stage1Only.kills) * 1.7);
    expect(climbing.endStage).toBe(5);
  });

  test('jamais au-delà de la plus haute étape débloquée', () => {
    const run = idleRun(free as never, 1, 3, H8, seededRng(4));
    expect(run.wavesWon.length).toBe(4); // index 0 à 3
    expect(run.endStage).toBeLessThanOrEqual(3);
    expect(run.wavesWon[3]).toBeGreaterThan(0);
  });

  test('un K.O. fait reculer d\'une seule étape : bloqué à l\'étape 3, on oscille entre 2 et 3 sans revoir l\'étape 1', () => {
    const blocked = [smp(0), smp(1.5), smp(2), smp(2.5, 0), smp(3), smp(3)];
    const run = idleRun(blocked as never, 3, 5, H8, seededRng(2));
    expect(run.wavesWon[1]).toBe(0);
    expect(run.wavesWon[2]).toBeGreaterThan(0);
    expect(run.wavesWon[4] + run.wavesWon[5]).toBe(0);
    expect(run.endStage).toBeLessThanOrEqual(3);
  });

  test('partir de l\'étape 5 rapporte tout de suite le plein débit', () => {
    const short = 10 * 60_000;
    expect(sum(idleRun(free as never, 5, 5, short, seededRng(3)).kills)).toBeGreaterThan(sum(idleRun(free as never, 1, 5, short, seededRng(3)).kills));
  });
});

describe('computeIdleGains : XP, butin et chromatiques suivent l\'étape en cours', () => {
  /** Équipe Nv.12, largement au-dessus de la zone 0 (Nv 3-6) : gagne à toutes les étapes. */
  function strongGame(stage: number) {
    const s = newGame();
    chooseStarter(s, 4, seededRng(1));
    const m2 = makeMon(10, 12, seededRng(2));
    const m3 = makeMon(16, 12, seededRng(3));
    addMon(s, m2);
    addMon(s, m3);
    for (const uid of s.team) s.mons[uid].level = 12;
    s.unlocked[0][0] = 5;
    s.stage = stage;
    return s;
  }

  test('une équipe arrêtée à l\'étape 5 gagne plus d\'XP qu\'à l\'étape 1 (sauvages de plus haut niveau)', () => {
    const at5 = computeIdleGains(strongGame(5), 2 * H, seededRng(5))!;
    const s1 = strongGame(1);
    s1.unlocked[0][0] = 1;
    const at1 = computeIdleGains(s1, 2 * H, seededRng(5))!;
    const xp = (g: typeof at5) => g.perMon.reduce((a, p) => a + p.xp, 0);
    expect(xp(at5)).toBeGreaterThan(xp(at1));
  });

  test('étape fixée à 3 (étapes 1 à 5 débloquées) : l\'idle farme l\'étape 3 et on la retrouve au retour', () => {
    const s = strongGame(3);
    s.fixedStage = 3;
    const gains = computeIdleGains(s, 2 * H, seededRng(7))!;
    expect(gains.endStage).toBe(3);
    applyIdleGains(s, gains);
    expect(s.stage).toBe(3);
  });

  test('étape fixée : une zone entièrement farmée ne fait pas passer l\'idle à la zone suivante', () => {
    const s = strongGame(2);
    s.bossesBeaten[0][0] = true;
    for (const [id] of BIOMES[0].zones[0].pool) { s.dex.caught.push(id); s.dex.shiny.push(id); }
    s.unlocked[0][1] = 1;
    s.fixedStage = 2;
    const gains = computeIdleGains(s, 2 * H, seededRng(8))!;
    expect(gains.farmZone).toBe(0);
    applyIdleGains(s, gains);
    expect(s.zone).toBe(0);
    expect(s.stage).toBe(2);
  });

  test('au retour, la position affichée reprend l\'étape atteinte à la fin de l\'absence', () => {
    const s = strongGame(2);
    const gains = computeIdleGains(s, 2 * H, seededRng(6))!;
    expect(gains.endStage).toBe(5); // équipe très au-dessus : elle a regrimpé jusqu'en haut
    applyIdleGains(s, gains);
    expect(s.stage).toBe(5);
    expect(s.zone).toBe(0);
  });
});

describe('hors ligne : capture des lignées ciblées', () => {
  const total = (r: Record<number, number>) => Object.values(r).reduce((a, n) => a + n, 0);

  test('sans cible : aucune capture, aucune Ball utilisée', () => {
    const g = computeIdleGains(readyGame(), 2 * H, seededRng(11))!;
    expect(total(g.targetCaught)).toBe(0);
    expect(g.ballsUsed).toEqual({ poke: 0, super: 0, hyper: 0 });
  });

  test('avec une cible : captures avec le stock de Balls, doublons convertis en bonbons, encaissés au retour', () => {
    const s = readyGame();
    s.targets = [10]; // Chenipan, fréquent en zone 0
    const g = computeIdleGains(s, 2 * H, seededRng(12))!;
    const caught = total(g.targetCaught);
    expect(caught).toBeGreaterThan(0);
    expect(Object.keys(g.targetCaught)).toEqual(['10']);
    expect(g.targetMons.length + total(g.targetCandies) / 3).toBe(caught);
    const used = g.ballsUsed.poke + g.ballsUsed.super + g.ballsUsed.hyper;
    expect(used).toBeGreaterThanOrEqual(caught);
    const ballsBefore = s.balls.poke, monsBefore = Object.keys(s.mons).length;
    applyIdleGains(s, g);
    expect(s.balls.poke).toBe(ballsBefore - g.ballsUsed.poke);
    expect(s.candies[10] ?? 0).toBe(g.targetCandies[10] ?? 0);
    expect(Object.keys(s.mons).length).toBe(monsBefore + g.targetMons.length + g.shinies.length);
    expect(s.missStreak).toBe(g.missStreak);
  });

  test('plus de Balls : les captures s’arrêtent, jamais d’achat', () => {
    const s = readyGame();
    s.targets = [10];
    s.balls = { poke: 3, super: 0, hyper: 0 };
    const shardsBefore = s.shards;
    const g = computeIdleGains(s, IDLE_CAP_MS, seededRng(13))!;
    expect(g.ballsUsed).toEqual({ poke: 3, super: 0, hyper: 0 });
    expect(total(g.targetCaught)).toBeLessThanOrEqual(3);
    applyIdleGains(s, g);
    expect(s.balls.poke).toBe(0);
    expect(s.shards).toBe(shardsBefore + g.shardsFromRecycle);
  });

  test('conversion désactivée : toutes les captures ciblées vont en boîte', () => {
    const s = readyGame();
    s.targets = [10];
    const g = computeIdleGains(s, 2 * H, seededRng(14), { convertTargets: false })!;
    expect(g.targetMons.length).toBe(total(g.targetCaught));
    expect(total(g.targetCandies)).toBe(0);
  });

  test('meilleure Ball : les Hyper Balls partent en premier', () => {
    const s = readyGame();
    s.targets = [10];
    s.balls = { poke: 50, super: 0, hyper: 2 };
    const g = computeIdleGains(s, 2 * H, seededRng(15), { bestBall: true })!;
    expect(g.ballsUsed.hyper).toBe(2);
    expect(g.ballsUsed.poke).toBeGreaterThan(0);
  });
});
