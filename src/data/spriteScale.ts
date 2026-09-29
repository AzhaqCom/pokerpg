// GÉNÉRÉ par tools/sprite_scale.py — ne pas modifier à la main.
/** Réduction des sprites géants en combat (compression douce au-delà de 36 px de haut), par espèce. */
export const SPRITE_SCALE: Record<number, number> = {
  95: 0.86,
  130: 0.793,
  145: 0.914,
  208: 0.88,
  226: 0.968,
  249: 0.8,
  250: 0.766,
  321: 0.76,
  350: 0.902,
  383: 0.94,
  384: 0.743,
  483: 0.779,
  484: 0.815,
  486: 0.927,
  487: 0.891,
  491: 0.927,
  493: 0.891,
};

export const spriteScale = (speciesId: number) => SPRITE_SCALE[speciesId] ?? 1;
