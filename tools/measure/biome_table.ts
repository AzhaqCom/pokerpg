/** Tableau des espèces par zone et par biome, pour chaque région (repérer les biomes pauvres).
 *  npx tsx tools/measure/biome_table.ts */
import { BIOMES, REGIONS } from '../../src/game/content';
const ST = new Set([1,4,7,152,155,158,252,255,258,387,390,393]);
const LEG = new Set([144,145,146,150,151,243,244,245,249,250,251,377,378,379,380,381,382,383,384,385,386,480,481,482,483,484,485,486,487,488,489,490,491,492,493]);
for (const [r, reg] of REGIONS.entries()) {
  const end = REGIONS[r + 1]?.start ?? BIOMES.length;
  console.log(`\n### ${reg.name} (Pokédex ${reg.dexMax}, ${end - reg.start} biomes)\n`);
  console.log('| # | Biome | Nv | Zone 1 | Zone 2 | Zone 3 | Espèces du biome | Starters | Légend. |');
  console.log('|---|---|---|---|---|---|---|---|---|');
  let tot = 0;
  for (let b = reg.start; b < end; b++) {
    const zs = BIOMES[b].zones;
    const core = zs.map((z) => z.pool.filter(([id]) => !ST.has(id) && !LEG.has(id)).map(([id]) => id));
    const uniq = new Set(core.flat()).size;
    tot += uniq;
    const st = new Set(zs.flatMap((z) => z.pool.filter(([id]) => ST.has(id)).map(([id]) => id))).size;
    const lg = new Set(zs.flatMap((z) => z.pool.filter(([id]) => LEG.has(id)).map(([id]) => id).concat(z.boss.joinsPool ? [z.boss.speciesId] : []))).size;
    console.log(`| ${b - reg.start + 1} | ${BIOMES[b].name} | ${zs[0].minLv}-${zs[2].maxLv} | ${core[0].length} | ${core[1].length} | ${core[2].length} | **${uniq}** | ${st || '-'} | ${lg || '-'} |`);
  }
  console.log(`\nTotal espèces distinctes (somme des biomes) : ${tot}`);
}
