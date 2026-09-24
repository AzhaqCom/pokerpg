/** Trace d'une graine : jalons, équipe finale et équipement (args : graine, heures, biome).
 *  npx tsx tools/measure/trace_seed.ts 1 3 2 */
import { simulate } from '../../src/game/bot';
import { seededRng } from '../../src/game/rng';
const trace: string[] = [];
const r = simulate(seededRng(Number(process.argv[2] ?? 2)), Number(process.argv[3] ?? 6) * 3600, trace, 0);
const b9 = trace.filter((l) => new RegExp(' b' + (process.argv[4] ?? 9) + ' ').test(l));
console.log('lignes b9:', b9.length, '| finished', r.finished);
console.log(b9.slice(0, 12).join('\n'));
console.log('...');
console.log(b9.slice(-8).join('\n'));
console.log('jalons', JSON.stringify(r.milestones));
console.log('premier arena b9:', b9.find((l) => /arena/.test(l)));
for (const l of r.teamDetail) console.log('  ' + l);
console.log('sac: ' + r.bagBest.join(' ; '));
