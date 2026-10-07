import { fmtShort } from '../helpers';

test('fmtShort : tel quel jusqu\'à 9 999, puis K, M, B… à 3 chiffres significatifs (2026-10-07)', () => {
  expect(fmtShort(0)).toBe('0');
  expect(fmtShort(875)).toBe('875');
  expect(fmtShort(9999)).toBe('9 999');
  expect(fmtShort(10_000)).toBe('10K');
  expect(fmtShort(12_345)).toBe('12,3K');
  expect(fmtShort(123_456)).toBe('123K');
  expect(fmtShort(999_950)).toBe('1M'); // l'arrondi passe à l'unité suivante, jamais « 1000K »
  expect(fmtShort(1_234_567)).toBe('1,23M');
  expect(fmtShort(45_600_000)).toBe('45,6M');
  expect(fmtShort(2_000_000_000)).toBe('2B');
  expect(fmtShort(7.5e12)).toBe('7,5T');
  expect(fmtShort(3e15)).toBe('3Qa');
  expect(fmtShort(4.2e18)).toBe('4,2Qi');
});
