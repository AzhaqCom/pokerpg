/**
 * Refait les pools de sauvages de Johto, Hoenn et Sinnoh (Kanto n'est jamais touché) en se calant sur les jeux
 * officiels : chaque espèce est placée au moment de l'aventure où on la croise dans son jeu d'origine (Or HG/Argent SS
 * pour les Pokémon de Kanto/Johto, Émeraude pour Hoenn, Platine pour Sinnoh). Roucool et Chenipan en début de région,
 * Minidraco et Embrylex en fin de région.
 *
 * « Progression » d'une espèce = difficulté (75e centile des niveaux sauvages) du premier lieu où on la rencontre dans
 * son jeu d'origine (repli sur les autres jeux Gen 3-4). Les zones de la région sont ensuite remplies dans l'ordre de
 * cette progression (rang → zone), avec une préférence pour le type du biome (±2 zones), 6 à 8 espèces par zone.
 * Toutes les formes de base de la région sont placées (région autonome) ; les formes évoluées rencontrées dans les jeux
 * complètent les zones, à leur propre moment. Starters : dans un biome de début de région de leur type. Anciens
 * légendaires : gardés dans leurs zones de fin, et l'un d'eux devient le boss de la zone si le boss était un Pokémon
 * ordinaire (il rejoint le pool une fois vaincu). Boss des autres zones : la forme finale la plus avancée de la zone.
 *
 * Usage (racine) : npx tsx tools/regen_pools_official.ts <dossier CSV PokéAPI> [--write]
 * CSV : encounters, encounter_slots (https://github.com/PokeAPI/pokeapi/tree/master/data/v2/csv).
 */
import * as fs from 'fs';
import * as path from 'path';
import { BIOMES, REGIONS } from '../src/game/content';
import { ALL_SPECIES, evolutionTargets, species } from '../src/game/data';

const SRC = process.argv[2];
const WRITE = process.argv.includes('--write');
const LEG = new Set([144, 145, 146, 150, 151, 243, 244, 245, 249, 250, 251, 377, 378, 379, 380, 381, 382, 383, 384, 385, 386,
  480, 481, 482, 483, 484, 485, 486, 487, 488, 489, 490, 491, 492, 493]);
const STARTERS = new Set([1, 4, 7, 152, 155, 158, 252, 255, 258, 387, 390, 393]);
const FOSSILS = new Set([138, 140, 142, 345, 347, 408, 410]);
/** bébés (œufs dans les jeux) : toujours en début de région */
const BABIES = new Set([172, 173, 174, 175, 236, 238, 239, 240, 298, 360, 406, 433, 438, 439, 440, 446, 458]);
const MIN_ZONE = 6;
/** préférence pour le type du biome : écart de zones toléré, et « gain » d'une zone du bon type */
const SPREAD = Number(process.env.SPREAD ?? 3);
const TYPE_PULL = Number(process.env.PULL ?? 2.5);

// ---------------------------------------------------------------- progression officielle
function csv(name: string): Record<string, string>[] {
  const [head, ...lines] = fs.readFileSync(path.join(SRC, `${name}.csv`), 'utf8').trim().split(/\r?\n/);
  const cols = head.split(',');
  return lines.map((l) => { const v = l.split(','); return Object.fromEntries(cols.map((c, i) => [c, v[i]])); });
}
const slotMethod = new Map(csv('encounter_slots').map((r) => [r.id, r.encounter_method_id]));
const encounters = csv('encounters');
/** progression par espèce pour un jeu (ensemble de versions) */
function gameProgress(versions: number[]): Map<number, number> {
  // difficulté d'un lieu : niveaux des rencontres dans les herbes / grottes (la pêche à la Canne Super gonfle les niveaux
  // d'un lieu de début de jeu, ex. Route 102 d'Émeraude) ; lieux sans herbe (eau seule) : toutes les rencontres
  const WALK = new Set(['1', '8', '9', '10', '11', '14', '15', '16', '17', '28']);
  const areaLv = new Map<string, number[]>();
  const areaWalk = new Map<string, number[]>();
  const spAreas = new Map<number, Set<string>>();
  for (const r of encounters) {
    if (!versions.includes(Number(r.version_id))) continue;
    const method = slotMethod.get(r.encounter_slot_id) ?? '';
    if (['18', '19'].includes(method)) continue; // dons, œufs
    const pid = Number(r.pokemon_id);
    if (pid > 493) continue;
    (areaLv.get(r.location_area_id) ?? areaLv.set(r.location_area_id, []).get(r.location_area_id)!).push(Number(r.max_level));
    if (WALK.has(method)) (areaWalk.get(r.location_area_id) ?? areaWalk.set(r.location_area_id, []).get(r.location_area_id)!).push(Number(r.max_level));
    (spAreas.get(pid) ?? spAreas.set(pid, new Set()).get(pid)!).add(r.location_area_id);
  }
  const q75 = (v: number[]) => [...v].sort((x, y) => x - y)[Math.floor(v.length * 0.75)];
  const diff = new Map([...areaLv].map(([a, v]) => [a, q75(areaWalk.get(a) ?? v)]));
  return new Map([...spAreas].map(([p, as]) => [p, Math.min(...[...as].map((a) => diff.get(a)!))]));
}
const HGSS = gameProgress([15, 16]);
const EMERALD = gameProgress([9]);
const PLATINUM = gameProgress([14]);
const FRLG = gameProgress([10, 11]);
const native = (id: number) => (id <= 251 ? [HGSS, FRLG, PLATINUM, EMERALD] : id <= 386 ? [EMERALD, HGSS, PLATINUM, FRLG] : [PLATINUM, HGSS, EMERALD, FRLG]);
const parentOf = new Map<number, number>();
for (const sp of ALL_SPECIES) for (const t of evolutionTargets(sp.id)) parentOf.set(t, sp.id);

const memo = new Map<number, { value: number; wild: boolean }>();
function officialProgress(id: number): { value: number; wild: boolean } {
  const m = memo.get(id);
  if (m) return m;
  memo.set(id, { value: 25, wild: false }); // garde-fou contre les boucles bébé ↔ adulte sans aucune donnée
  const r = computeProgress(id);
  memo.set(id, r);
  return r;
}
function computeProgress(id: number): { value: number; wild: boolean } {
  if (BABIES.has(id)) return { value: 5, wild: false };
  for (const g of native(id)) { const v = g.get(id); if (v !== undefined) return { value: v, wild: true }; }
  if (FOSSILS.has(id)) return { value: 30, wild: false };
  const p = parentOf.get(id);
  if (p !== undefined) return { value: Math.max(officialProgress(p).value, species(p).evolveLevel), wild: false };
  // bébés et cas sans rencontre : au niveau de leur forme adulte, un peu avant
  const adult = species(id).evolvesTo;
  if (adult) return { value: Math.max(2, officialProgress(adult).value - 5), wild: false };
  return { value: 25, wild: false };
}

// ---------------------------------------------------------------- régions
type Zone = { b: number; z: number; minLv: number; maxLv: number; types: string[]; pool: [number, number][]; boss: string };
const text = fs.readFileSync('src/game/content.ts', 'utf8').split('\n');
const poolLines = text.map((l, i) => (l.startsWith('        pool:') ? i : -1)).filter((i) => i >= 0);
const bossLines = text.map((l, i) => (l.startsWith('        boss:') ? i : -1)).filter((i) => i >= 0);

const report: string[] = [];
const DROP = '@@ligne-supprimée@@';
for (let r = 1; r < REGIONS.length; r++) {
  const reg = REGIONS[r];
  const end = REGIONS[r + 1]?.start ?? BIOMES.length;
  const dexMax = reg.dexMax;
  const zones: Zone[] = [];
  for (let b = reg.start; b < end; b++) BIOMES[b].zones.forEach((z, zi) => {
    const types = [...new Set(z.pool.flatMap(([id]) => species(id).types))]; // repli si le thème n'est pas connu
    zones.push({ b, z: zi, minLv: z.minLv, maxLv: z.maxLv, types: themeTypes(b, types), pool: [], boss: '' });
  });
  const inRegion = ALL_SPECIES.filter((sp) => sp.id <= dexMax && !LEG.has(sp.id));
  const isRoot = (id: number) => { const p = parentOf.get(id); return p === undefined || p > dexMax; };
  const required = inRegion.filter((sp) => isRoot(sp.id) && !STARTERS.has(sp.id)).map((sp) => sp.id);
  const optional = inRegion.filter((sp) => !isRoot(sp.id) && !STARTERS.has(sp.id) && officialProgress(sp.id).wild).map((sp) => sp.id);
  const all = [...required, ...optional].sort((a, b) => officialProgress(a).value - officialProgress(b).value || a - b);
  const values = all.map((id) => officialProgress(id).value);
  const Z = zones.length;
  /** zone visée : rang de la progression de l'espèce parmi toutes celles de la région (même sans rencontre officielle) */
  const target = (id: number) => {
    const v = officialProgress(id).value;
    const below = values.filter((x) => x < v).length + values.filter((x) => x === v).length / 2;
    return Math.min(Z - 1, Math.round((below / Math.max(1, values.length)) * (Z - 1)));
  };
  const fits = (id: number, zi: number) => species(id).types.some((t) => zones[zi].types.includes(t));
  const place = (id: number, weight: number, spread: number, cap: number) => {
    const t = target(id);
    let best = -1, bestScore = Infinity;
    for (let zi = Math.max(0, t - spread); zi <= Math.min(Z - 1, t + spread); zi++) {
      if (zones[zi].pool.length >= cap) continue;
      const score = Math.abs(zi - t) - (fits(id, zi) ? TYPE_PULL : 0) + zones[zi].pool.length * 0.05;
      if (score < bestScore) { bestScore = score; best = zi; }
    }
    if (best < 0 && weight === 20) { // forme de base obligatoire : la zone la moins pleine la plus proche
      best = [...zones.keys()].sort((a, b) => zones[a].pool.length - zones[b].pool.length || Math.abs(a - t) - Math.abs(b - t))[0];
    }
    if (best >= 0) zones[best].pool.push([id, weight]);
    return best >= 0;
  };
  for (const id of required.sort((a, b) => officialProgress(a).value - officialProgress(b).value)) place(id, 20, SPREAD, 7);
  for (const id of optional.sort((a, b) => officialProgress(a).value - officialProgress(b).value)) place(id, 10, 1, 7);
  // zones encore minces : formes évoluées du bon moment, même sans rencontre officielle
  const evolvedAny = inRegion.filter((sp) => !isRoot(sp.id) && !STARTERS.has(sp.id)).map((sp) => sp.id);
  for (const [zi, zone] of zones.entries()) {
    const extra = evolvedAny.filter((id) => !zones.some((zz) => zz.pool.some(([p]) => p === id)) && Math.abs(target(id) - zi) <= 2
      && (parentOf.get(id) === undefined || species(parentOf.get(id)!).evolveLevel <= zone.maxLv))
      .sort((a, b) => Math.abs(target(a) - zi) - Math.abs(target(b) - zi) || Number(fits(b, zi)) - Number(fits(a, zi)));
    while (zone.pool.length < MIN_ZONE && extra.length) zone.pool.push([extra.shift()!, 10]);
  }
  // zones encore sous le minimum (préférence de type trop forte) : on y ramène l'espèce la plus proche en progression
  // depuis une zone voisine qui en a plus que le minimum
  for (let pass = 0; pass < 3; pass++) for (const [zi, zone] of zones.entries()) {
    while (zone.pool.length < MIN_ZONE) {
      const donors = [zi + 1, zi - 1, zi + 2, zi - 2].filter((d) => d >= 0 && d < Z && zones[d].pool.length > MIN_ZONE);
      if (!donors.length) {
        // plus de donneur : on double une espèce de la zone voisine (une espèce peut vivre dans deux zones)
        const near = [zi + 1, zi - 1].filter((d) => d >= 0 && d < Z).flatMap((d) => zones[d].pool)
          .find(([id]) => !STARTERS.has(id) && !LEG.has(id) && !zone.pool.some(([p]) => p === id));
        if (!near) break;
        zone.pool.push([near[0], 10]);
        continue;
      }
      const d = donors[0];
      const pick = [...zones[d].pool].sort((a, b) => (zi > d ? -1 : 1) * (officialProgress(a[0]).value - officialProgress(b[0]).value))[0];
      zones[d].pool = zones[d].pool.filter((e) => e !== pick);
      zone.pool.push(pick);
    }
  }
  // starters (toutes générations ≤ dexMax) : répartis dans les biomes de début (zones jusqu'au Nv.35), de leur type si
  // possible, jamais tous au même endroit (la zone qui a le moins de starters d'abord)
  const early = zones.map((_, i) => i).filter((i) => zones[i].maxLv <= 35);
  const startersIn = (i: number) => zones[i].pool.filter(([id]) => STARTERS.has(id)).length;
  for (const st of [...STARTERS].filter((id) => id <= dexMax)) {
    const typed = early.filter((i) => fits(st, i));
    const cand = (typed.length ? typed : early).sort((a, b) => startersIn(a) - startersIn(b) || zones[a].pool.length - zones[b].pool.length || a - b);
    zones[cand[0]].pool.push([st, 10]);
  }
  // anciens légendaires semés et bosses : repris du contenu actuel, puis échange boss faible ↔ légendaire
  zones.forEach((zone) => {
    const cur = BIOMES[zone.b].zones[zone.z];
    const seeded = cur.pool.filter(([id]) => LEG.has(id));
    let bossId = cur.boss.speciesId;
    let joins = !!cur.boss.joinsPool;
    const legs = seeded.map(([id]) => id);
    if (!LEG.has(bossId) && legs.length) {
      const leg = legs.shift()!; // le 1er légendaire semé devient le boss, capturé puis farmable (joinsPool)
      zone.pool.push([bossId, 10]);
      bossId = leg;
      joins = true;
    }
    for (const id of legs) zone.pool.push([id, 20]);
    if (!joins) {
      // boss d'une zone ordinaire : le plus solide de la zone (total de stats), après l'avoir fait évoluer tant que son
      // niveau d'évolution est atteint dans la zone (+3) — pas de Roucarnage au Nv.10, pas de Rattata en fin de biome
      const grown = (id: number) => {
        let f = id;
        for (let g = 0; g < 3; g++) {
          const t = evolutionTargets(f, dexMax);
          if (!t.length || species(f).evolveLevel > zone.maxLv + 3) break;
          f = t[0];
        }
        return f;
      };
      const bst = (id: number) => { const b = species(id).base; return b.hp + b.atk + b.def + b.spe; };
      const cands = zone.pool.filter(([id]) => !LEG.has(id) && !STARTERS.has(id)).map(([id]) => grown(id));
      bossId = cands.sort((a, b) => bst(b) - bst(a))[0] ?? bossId;
    }
    zone.boss = joins ? `{ speciesId: ${bossId}, level: ${cur.boss.level}, joinsPool: true }` : `{ speciesId: ${bossId}, level: ${cur.boss.level} }`;
  });
  // rapport : progression moyenne des 2 premiers et 2 derniers biomes, tailles
  const avg = (zs: Zone[]) => Math.round(zs.flatMap((z) => z.pool.filter(([id]) => !LEG.has(id)).map(([id]) => officialProgress(id).value)).reduce((a, v, _, arr) => a + v / arr.length, 0));
  report.push(`${reg.name} : ${zones.length} zones, ${Math.min(...zones.map((z) => z.pool.length))}-${Math.max(...zones.map((z) => z.pool.length))} espèces/zone,`
    + ` moment officiel moyen : début ${avg(zones.slice(0, 6))} → fin ${avg(zones.slice(-6))}`);
  for (const zone of zones) {
    const zi = BIOMES.slice(0, zone.b).reduce((a, bb) => a + bb.zones.length, 0) + zone.z;
    text[poolLines[zi]] = `        pool: [${zone.pool.map(([id, w]) => `[${id}, ${w}]`).join(', ')}],`;
    text[bossLines[zi]] = `        boss: ${zone.boss},`;
    // commentaire de la zone (liste des espèces) : remplacé ; les anciens commentaires sur plusieurs lignes sont retirés
    const comments: number[] = [];
    for (let i = poolLines[zi] - 2; i >= 0 && text[i].startsWith('        //'); i--) comments.push(i);
    const names = `        // ${zone.pool.map(([id]) => species(id).name).join(', ')}`;
    if (comments.length) { text[comments[comments.length - 1]] = names; for (const i of comments.slice(0, -1)) text[i] = DROP; }
    report.push(`  b${zone.b} ${BIOMES[zone.b].zones[zone.z].name} Nv${zone.minLv}-${zone.maxLv} : ${zone.pool.map(([id]) => species(id).name).join(', ')} | boss ${species(Number(/speciesId: (\d+)/.exec(zone.boss)![1])).name}`);
  }
}
console.log(report.join('\n'));
if (WRITE) fs.writeFileSync('src/game/content.ts', text.filter((l) => l !== DROP).join('\n'));

/** Types du thème d'un biome : ceux de l'arène et des biomes de la région (repli : types présents dans l'ancien pool). */
function themeTypes(b: number, fallback: string[]): string[] {
  const TYPE_BY_FR: Record<string, string> = {
    Roche: 'rock', Combat: 'fighting', Insecte: 'bug', Électrik: 'electric', Feu: 'fire', Normal: 'normal', Sol: 'ground',
    Vol: 'flying', Psy: 'psychic', Eau: 'water', Acier: 'steel', Plante: 'grass', Spectre: 'ghost', Glace: 'ice',
    Dragon: 'dragon', Ténèbres: 'dark', Poison: 'poison',
  };
  const t = TYPE_BY_FR[BIOMES[b].arena.type];
  const counts = new Map<string, number>();
  for (const z of BIOMES[b].zones) for (const [id] of z.pool) for (const ty of species(id).types) counts.set(ty, (counts.get(ty) ?? 0) + 1);
  const top = [...counts].sort((a, c) => c[1] - a[1]).slice(0, 2).map(([ty]) => ty);
  return [...new Set([...(t ? [t] : []), ...top, ...(top.length ? [] : fallback)])];
}
