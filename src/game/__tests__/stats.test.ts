import { geneQuality, monStars } from '../stats';

const genes = (hp: number, atk: number, def: number, spe: number) => ({ hp, atk, def, spe });

test('geneQuality : somme des gènes sur 60', () => {
  expect(geneQuality(genes(15, 15, 15, 15))).toBeCloseTo(1);
  expect(geneQuality(genes(0, 0, 0, 0))).toBeCloseTo(0);
  expect(geneQuality(genes(8, 8, 8, 8))).toBeCloseTo(32 / 60);
});

test('monStars : 4★ seulement pour des gènes parfaits, sinon paliers 80/50 %', () => {
  const mon = (g: ReturnType<typeof genes>) => ({ genes: g } as Parameters<typeof monStars>[0]);
  expect(monStars(mon(genes(15, 15, 15, 15)))).toBe(4);
  expect(monStars(mon(genes(14, 15, 15, 15)))).toBe(3); // presque parfait mais pas tout à fait
  expect(monStars(mon(genes(12, 12, 12, 12)))).toBe(3); // 48/60 = 80 %
  expect(monStars(mon(genes(7, 8, 7, 8)))).toBe(2); // 30/60 = 50 %
  expect(monStars(mon(genes(0, 0, 0, 0)))).toBe(1);
});
