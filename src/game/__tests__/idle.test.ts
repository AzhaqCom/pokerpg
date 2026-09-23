import { BIOMES } from '../content';
import { addMon, chooseStarter, makeMon, newGame, teamMaxLevel } from '../game';
import { IDLE_CAP_MS, applyIdleGains, computeIdleGains, teamXpPerHour } from '../idle';
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

test('gains d’une absence normale : XP pondérée, loot recyclé ou en sac, pas d’avance d’étape', () => {
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
