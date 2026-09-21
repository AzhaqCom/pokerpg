/** Générateur aléatoire injectable (tests déterministes). int(n) → [0, n) */
export interface Rng { int(n: number): number }

export const mathRng: Rng = { int: (n) => Math.floor(Math.random() * n) };

/** mulberry32 : RNG déterministe pour les tests */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return {
    int(n) {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      return Math.floor(r * n);
    },
  };
}
