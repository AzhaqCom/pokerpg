/** Simulation par région : durée et défaites par biome sur plusieurs graines.
 *  npx tsx tools/measure/sim_region.ts <région 0-3> <graines ex. 1,2,3>   (env HOURS=10, DETAIL=1 pour l'équipe finale,
 *  END=2,2.5,2.9,3.3 pour essayer une autre courbe de difficulté) */
import { simulate } from '../../src/game/bot';
import { DIFFICULTY } from '../../src/game/game';
// essai de courbe : END=2,2.5,2.9,3.3 (valeur de fin par région)
if (process.env.END) DIFFICULTY.end = process.env.END.split(',').map(Number);
import { seededRng } from '../../src/game/rng';
import { BIOMES } from '../../src/game/content';


const region = Number(process.argv[2] ?? 2);
const seeds = (process.argv[3] ?? '1,2,3').split(',').map(Number);
for (const kv of (process.argv[4] ?? '').split(',').filter(Boolean)) { const [b, m] = kv.split(':').map(Number); for (const z of BIOMES[b].zones) z.wildMult = m; }
const table: Record<number, { dur: number[]; lose: number[] }> = {};
for (const seed of seeds) {
  const trace: string[] = [];
  const r = simulate(seededRng(seed), Number(process.env.HOURS ?? 14) * 3600, trace, region);
  const per = new Map<number, { first: number; last: number; lose: number }>();
  for (const line of trace) {
    const m = line.match(/^(\d+)min b(\d+) (\w+) z(\d)s\d (\w+)/);
    if (!m) continue;
    const b = Number(m[2]);
    const e = per.get(b) ?? { first: Number(m[1]), last: Number(m[1]), lose: 0 };
    e.last = Number(m[1]);
    if (m[5] === 'lose') e.lose++;
    per.set(b, e);
  }
  const bs = [...per.keys()].sort((a, b) => a - b);
  bs.forEach((b, i) => {
    const e = per.get(b)!;
    const end = i + 1 < bs.length ? per.get(bs[i + 1])!.first : e.last;
    (table[b] ??= { dur: [], lose: [] }).dur.push(end - e.first);
    table[b].lose.push(e.lose);
  });
  console.log(`seed ${seed}: finished=${r.finished} ${Math.round(r.seconds / 60)} min`);
  if (process.env.DETAIL) { for (const l of r.teamDetail) console.log('   ' + l); console.log('   sac: ' + r.bagBest.join(' ; ')); }
}
console.log('biome  durée (min) par graine   défaites par graine');
for (const b of Object.keys(table).map(Number).sort((a, b) => a - b)) console.log(`b${b}    ${table[b].dur.join(' / ').padEnd(20)} ${table[b].lose.join(' / ')}`);
