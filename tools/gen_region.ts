/**
 * Génère le bloc `BIOMES` d'une nouvelle région (texte TS à coller dans content.ts) à partir d'un plan
 * de biomes : chaque forme de base du Pokédex cumulé va dans le biome dont le type dominant correspond
 * (le moins chargé parmi les candidats), puis réparti en 3 zones par force (BST). Boss de zone = forme
 * finale de la lignée la plus forte de la zone ; arène = 3 formes finales du type dominant.
 * Usage (depuis la racine) : npx tsx tools/gen_region.ts tools/regions/hoenn.json > bloc.ts.txt
 * Plan JSON : voir tools/regions/hoenn.json (`arena.team` optionnel pour imposer une équipe d'arène).
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = process.cwd(); // lancer depuis la racine du dépôt
type Sp = { id: number; name: string; types: string[]; base: Record<string, number>; evolvesTo: number };
const SPECIES: Sp[] = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/species.json'), 'utf8'));
const byId = new Map(SPECIES.map((s) => [s.id, s]));
const bst = (s: Sp) => s.base.hp + s.base.atk * 1.5 + s.base.def * 1.5 + s.base.spe;
const finalOf = (id: number): number => { let c = id; for (let i = 0; i < 3 && byId.get(c)!.evolvesTo; i++) c = byId.get(c)!.evolvesTo; return c; };

interface ZonePlan { name: string; biome: string; boss?: number }
interface BiomePlan {
  comment: string; name: string; from: number; to: number; types: string[]; zones: ZonePlan[];
  arena: { name: string; leader: string; type: string; badge: string; grantsBadge?: boolean; teamTypes?: string[] };
}
interface RegionPlan {
  dexMax: number; prevDexMax: number; starters: number[]; legendaries: number[]; oldLegendaryWeight: number;
  biomes: BiomePlan[]; oldLegendaryZones: [number, number][]; // [biomeIdx, zoneIdx] où semer les anciens légendaires
}
const plan: RegionPlan = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));

const LEG = new Set([144, 145, 146, 150, 151, 243, 244, 245, 249, 250, 251, 377, 378, 379, 380, 381, 382, 383, 384, 385, 386,
  480, 481, 482, 483, 484, 485, 486, 487, 488, 489, 490, 491, 492, 493]);
const dex = SPECIES.filter((s) => s.id <= plan.dexMax);
const targets = new Set(dex.filter((s) => s.evolvesTo).map((s) => s.evolvesTo));
const must = dex.filter((s) => !targets.has(s.id));
const allStarters = [1, 4, 7, 152, 155, 158, 252, 255, 258, 387, 390, 393].filter((id) => id <= plan.dexMax);
const regular = must.filter((s) => !LEG.has(s.id) && !allStarters.includes(s.id));
const bossLegends = new Set(plan.biomes.flatMap((b) => b.zones.map((z) => z.boss).filter(Boolean)) as number[]);
const oldLegends = must.filter((s) => LEG.has(s.id) && !bossLegends.has(s.id)).map((s) => s.id);

// --- répartition par biome : types les plus rares d'abord, biome candidat le moins chargé
const fill: number[][] = plan.biomes.map(() => []);
const cands = (s: Sp) => plan.biomes.map((b, i) => (s.types.some((t) => b.types.includes(t)) ? i : -1)).filter((i) => i >= 0);
const order = [...regular].sort((a, b) => cands(a).length - cands(b).length || a.id - b.id);
const cap = regular.length / plan.biomes.length;
for (const s of order) {
  let c = cands(s);
  if (!c.length) c = plan.biomes.map((_, i) => i);
  // le premier type de l'espèce passe avant le second, tant que le biome n'est pas saturé
  const primary = c.filter((i) => plan.biomes[i].types.includes(s.types[0]) && fill[i].length < cap * 1.25);
  const pool = primary.length ? primary : c;
  const best = pool.reduce((a, b) => (fill[b].length < fill[a].length ? b : a));
  fill[best].push(s.id);
}

// --- zones : 3 tranches de force croissante
const out: string[] = [];
plan.biomes.forEach((b, bi) => {
  const ids = [...fill[bi]].sort((a, c) => bst(byId.get(a)!) - bst(byId.get(c)!));
  const per = Math.ceil(ids.length / 3);
  const zones = [ids.slice(0, per), ids.slice(per, 2 * per), ids.slice(2 * per)];
  const span = (b.to - b.from) / 3;
  const zoneTxt = b.zones.map((z, zi) => {
    const minLv = Math.round(b.from + span * zi);
    const maxLv = zi === 2 ? b.to - 1 : Math.round(b.from + span * (zi + 1));
    const entries: [number, number][] = zones[zi].map((id, k, arr) => [id, k >= arr.length - 2 && arr.length > 3 ? 8 : 20]);
    if (bi === 0 && zi === 0) for (const id of allStarters) entries.push([id, 4]);
    for (const [obi, ozi] of plan.oldLegendaryZones) if (obi === bi && ozi === zi) {
      const k = plan.oldLegendaryZones.findIndex(([x, y]) => x === bi && y === zi);
      const share = oldLegends.filter((_, i) => i % plan.oldLegendaryZones.length === k);
      for (const id of share) entries.push([id, plan.oldLegendaryWeight]);
    }
    const strongest = zones[zi][zones[zi].length - 1];
    const bossId = z.boss ?? finalOf(strongest);
    const boss = z.boss ? `{ speciesId: ${bossId}, level: ${maxLv + 1}, joinsPool: true }` : `{ speciesId: ${bossId}, level: ${maxLv + 1} }`;
    const pool = entries.map(([id, w]) => `[${id}, ${w}]`).join(', ');
    const names = entries.map(([id]) => byId.get(id)!.name).join(', ');
    return `      {\n        // ${names}\n        name: '${z.name}', minLv: ${minLv}, maxLv: ${maxLv}, biome: '${z.biome}',\n        pool: [${pool}],\n        boss: ${boss},\n      },`;
  }).join('\n');
  // arène : 3 formes finales fortes du type dominant (hors légendaires), niveaux jusqu'à `to`
  const teamTypes = b.arena.teamTypes ?? b.types.slice(0, 1);
  // natifs de la nouvelle région d'abord (plus fidèle aux jeux), complétés par les anciens au besoin
  const starterFinals = new Set(allStarters.map(finalOf));
  const typed = dex.filter((s) => !s.evolvesTo && !LEG.has(s.id) && !starterFinals.has(s.id) && s.types.some((t) => teamTypes.includes(t)))
    .sort((a, c) => bst(c) - bst(a)).map((s) => s.id);
  const natives = typed.filter((id) => id > plan.prevDexMax);
  const finals = (b.arena as { team?: number[] }).team ?? [...natives, ...typed.filter((id) => id <= plan.prevDexMax)].slice(0, 3).reverse();
  const team = finals.map((id, k) => `[${id}, ${b.to - (finals.length - 1 - k)}]`).join(', ');
  const gb = b.arena.grantsBadge === false ? '\n      grantsBadge: false,' : '';
  out.push(`  {\n    // ${b.comment}\n    name: '${b.name}',\n    zones: [\n${zoneTxt}\n    ],\n    arena: {\n      name: '${b.arena.name}', leader: '${b.arena.leader}', type: '${b.arena.type}',\n      team: [${team}], // ${finals.map((id) => byId.get(id)!.name).join(', ')}\n      badge: '${b.arena.badge}',${gb}\n    },\n  },`);
});
console.log(out.join('\n'));
console.error('répartition par biome :', fill.map((f) => f.length).join(' / '), '| anciens légendaires semés :', oldLegends.length);
