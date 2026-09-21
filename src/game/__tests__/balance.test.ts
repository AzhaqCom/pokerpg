import { simulate } from '../bot';
import { seededRng } from '../rng';

test('équilibrage V1 : un joueur efficace gagne le badge en 30 min à 3 h de combat pur', () => {
  const reports = [1, 2, 3, 4, 5, 6].map((seed) => simulate(seededRng(seed)));
  for (const r of reports) {
    expect(r.finished).toBe(true);
    expect(r.seconds).toBeGreaterThan(30 * 60);
    expect(r.seconds).toBeLessThan(3 * 3600);
  }
});
