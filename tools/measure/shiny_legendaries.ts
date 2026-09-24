/** Temps estimé pour chasser tous les légendaires chromatiques de chaque région (1/256 par ennemi, 3 ennemis/vague).
 *  npx tsx tools/measure/shiny_legendaries.ts */
import { BIOMES, REGIONS } from '../../src/game/content';
import { effectivePool } from '../../src/game/game';
import { species } from '../../src/game/data';
const LEG = [144,145,146,150,151,243,244,245,249,250,251,377,378,379,380,381,382,383,384,385,386,480,481,482,483,484,485,486,487,488,489,490,491,492,493];
const WAVE_ACTIVE = 6.5, WAVE_IDLE = 5.6, ENEMIES = 3;
for (const r of [0, 1, 2, 3]) {
  const start = REGIONS[r].start, end = REGIONS[r + 1]?.start ?? BIOMES.length;
  let hAct = 0, hIdle = 0, n = 0;
  const rows: string[] = [];
  for (const id of LEG.filter((x) => x <= REGIONS[r].dexMax)) {
    let best = 0, where = '';
    for (let b = start; b < end; b++) BIOMES[b].zones.forEach((z) => {
      const pool = effectivePool(z, true);
      const w = pool.find(([s]) => s === id)?.[1];
      if (!w) return;
      const p = w / pool.reduce((a, [, x]) => a + x, 0);
      if (p > best) { best = p; where = `${z.name}`; }
    });
    if (!best) { rows.push(`  ${species(id).name}: introuvable`); continue; }
    const waves = 256 / best / ENEMIES;
    hAct += waves * WAVE_ACTIVE / 3600; hIdle += waves * WAVE_IDLE / 3600; n++;
    rows.push(`  ${species(id).name.padEnd(11)} ${(best * 100).toFixed(1).padStart(5)} % (${where}) → ${(waves * WAVE_ACTIVE / 3600).toFixed(1)} h actif / ${(waves * WAVE_IDLE / 3600).toFixed(1)} h idle`);
  }
  console.log(`== ${REGIONS[r].name} : ${n} légendaires, total ≈ ${hAct.toFixed(0)} h en actif (${(hAct / 2).toFixed(0)} h réelles à x2), ${hIdle.toFixed(0)} h en idle`);
  console.log(rows.join('\n'));
}
