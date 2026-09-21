import { simulate } from '../bot';
import { seededRng } from '../rng';

test('équilibrage V1 : un joueur efficace gagne le 1er badge en 30 min à 3 h de combat pur', () => {
  const reports = [1, 2, 3, 4, 5, 6].map((seed) => simulate(seededRng(seed), 3 * 3600));
  for (const r of reports) {
    const badge1 = r.milestones['biome1-badge']; // en minutes (voir bot.ts, mark())
    expect(badge1).toBeDefined();
    expect(badge1!).toBeGreaterThan(30);
    expect(badge1!).toBeLessThan(180);
  }
});

/**
 * Bout en bout : un joueur efficace termine les 10 biomes (Nv.100, badge du Champion) dans un temps
 * raisonnable. Sondé le 2026-09-21 sur 10 seeds : 208-410 min (3h30-6h50), jamais de blocage — bornes
 * ci-dessous avec une bonne marge pour ne pas devenir friable à la moindre retouche d'équilibrage.
 */
test('équilibrage bout en bout : un joueur efficace termine les 10 biomes (badge du Champion) en 1h30 à 10h de combat pur', () => {
  const reports = [1, 2, 3].map((seed) => simulate(seededRng(seed), 10 * 3600));
  for (const r of reports) {
    expect(r.finished).toBe(true);
    const minutes = r.seconds / 60;
    expect(minutes).toBeGreaterThan(90);
    expect(minutes).toBeLessThan(600);
  }
});
