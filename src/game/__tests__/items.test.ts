import { addItemBonuses, canFuse, fuse, makeItem, mainValue, recycleValue, upgrade } from '../items';
import { emptyBonuses } from '../model';
import { seededRng } from '../rng';

const rng = seededRng(7);

test('rareté : nombre de bonus secondaires', () => {
  expect(makeItem('griffe-sylve', 0, 5, rng).subs).toHaveLength(0);
  expect(makeItem('griffe-sylve', 3, 5, rng).subs).toHaveLength(2);
  expect(makeItem('griffe-sylve', 6, 5, rng).subs).toHaveLength(3);
});

test('fusion 3 → 1 : même objet et même rareté uniquement', () => {
  const a = makeItem('griffe-sylve', 1, 4, rng), b = makeItem('griffe-sylve', 1, 7, rng), c = makeItem('griffe-sylve', 1, 5, rng);
  expect(canFuse([a, b, c])).toBe(true);
  expect(canFuse([a, b, makeItem('griffe-sylve', 2, 5, rng)])).toBe(false);
  expect(canFuse([a, b, makeItem('cape-sylve', 1, 5, rng)])).toBe(false);
  expect(canFuse([a, a, b])).toBe(false);
  const f = fuse([a, b, c], rng);
  expect(f.rarity).toBe(2);
  expect(f.level).toBe(7);
  expect(mainValue(f)).toBeGreaterThan(mainValue(b));
});

test('Chromatique = rareté maximale, plus de fusion', () => {
  const x = [0, 1, 2].map(() => makeItem('griffe-sylve', 6, 1, rng));
  expect(canFuse(x)).toBe(false);
});

test('niveau et recyclage', () => {
  const it = makeItem('cape-sylve', 2, 3, rng);
  expect(mainValue(upgrade(it))).toBeGreaterThan(mainValue(it));
  expect(recycleValue(makeItem('cape-sylve', 4, 1, rng))).toBeGreaterThan(recycleValue(it));
});

test('panoplie Sylvestre : bonus à 2 et 3 pièces', () => {
  const b2 = emptyBonuses();
  addItemBonuses(b2, [makeItem('griffe-sylve', 0, 1, rng), makeItem('cape-sylve', 0, 1, rng)]);
  expect(b2.atkPct).toBeCloseTo(6 + 8);
  const b3 = emptyBonuses();
  addItemBonuses(b3, [makeItem('griffe-sylve', 0, 1, rng), makeItem('cape-sylve', 0, 1, rng), makeItem('baie-sylve', 0, 1, rng)]);
  expect(b3.lifestealPct).toBe(8);
});
