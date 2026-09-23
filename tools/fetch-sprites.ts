/**
 * Pipeline sprites PMD SpriteCollab → atlas PNG + manifeste JSON pour l'app.
 *
 *   npm run sprites            # les 151, normal + shiny (repart de zéro : écrase le manifeste !)
 *   npm run sprites -- 25 133  # seulement certains numéros, fusionnés dans le manifeste existant
 *   npm run sprites -- 252-493 # une plage de numéros (Gen 3 et 4)
 *
 * Pour chaque Pokémon on télécharge AnimData.xml + les feuilles *-Anim.png
 * utiles, on garde UNE direction par animation (face caméra, ou gauche/droite
 * pour la marche) et on empile tout dans un seul atlas :
 *   assets/sprites/p025.png  (normal)   assets/sprites/ps025.png  (shiny)
 * Chaque ligne de l'atlas = une animation, frames côte à côte.
 * Les métadonnées vont dans src/data/sprites.json, et src/data/spriteAssets.ts
 * contient les require() statiques exigés par Metro.
 *
 * Sprites : PMD SpriteCollab, CC BY-NC 4.0 — usage perso non commercial.
 */
import { XMLParser } from 'fast-xml-parser';
import { PNG } from 'pngjs';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');
const OUT_IMG = path.join(ROOT, 'assets', 'sprites');
const OUT_JSON = path.join(ROOT, 'src', 'data', 'sprites.json');
const OUT_TS = path.join(ROOT, 'src', 'data', 'spriteAssets.ts');
const OUT_CREDITS = path.join(OUT_IMG, 'CREDITS.txt');
const CACHE = path.join(ROOT, 'tools', '.pmd_cache');
const BASE = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/sprite';

const SLOW = 1.4; // comme le firmware : le rythme PMD d'origine paraît rapide
const MIN_MS = 70;
const MAX_FRAMES = 24;
const ALPHA_T = 128;

/** Direction des feuilles PMD : ligne 0 = bas (face), 2 = droite, 6 = gauche */
const ACTIONS = [
  { key: 'idle', anim: 'Idle', row: 0 },
  { key: 'walkL', anim: 'Walk', row: 6 },
  { key: 'walkR', anim: 'Walk', row: 2 },
  { key: 'sleep', anim: 'Sleep', row: 0 },
  { key: 'hurt', anim: 'Hurt', row: 0 },
  { key: 'attack', anim: 'Attack', row: 0 },
  { key: 'pose', anim: 'Pose', row: 0 },
  // combat en vue de profil : le joueur regarde à droite, les sauvages à gauche
  { key: 'idleR', anim: 'Idle', row: 2 },
  { key: 'idleL', anim: 'Idle', row: 6 },
  { key: 'attackR', anim: 'Attack', row: 2 },
  { key: 'attackL', anim: 'Attack', row: 6 },
  { key: 'hurtR', anim: 'Hurt', row: 2 },
  { key: 'hurtL', anim: 'Hurt', row: 6 },
] as const;

export type ActionKey = (typeof ACTIONS)[number]['key'];

interface AnimDef { fw: number; fh: number; durations: number[]; src: string }

/**
 * Chaque animation est rognée à la boîte englobante de ses frames.
 * Ancrage : (ax, ay) = position des « pieds » (centre horizontal de la frame
 * PMD d'origine, ligne opaque la plus basse) DANS la frame rognée. Le rendu
 * place ce point au même endroit quelle que soit l'animation.
 */
interface ActionMeta {
  y: number; // ligne dans l'atlas (px)
  fw: number; fh: number; // taille d'une frame rognée
  ax: number; ay: number;
  ms: number[]; // durée de chaque frame
}
export interface SpriteMeta { w: number; h: number; actions: Partial<Record<ActionKey, ActionMeta>> }

async function fetchCached(url: string, dest: string): Promise<Buffer | null> {
  if (fs.existsSync(dest)) return fs.readFileSync(dest);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, buf);
      return buf;
    } catch (e) {
      if (attempt === 2) throw e;
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  return null;
}

function parseAnimData(xml: string): Record<string, AnimDef> {
  const doc = new XMLParser().parse(xml);
  const list = [].concat(doc.AnimData.Anims.Anim);
  const raw: Record<string, any> = {};
  for (const a of list as any[]) raw[a.Name] = a;
  const resolve = (name: string, depth = 0): AnimDef | null => {
    const a = raw[name];
    if (!a || depth > 4) return null;
    if (a.CopyOf) return resolve(a.CopyOf, depth + 1);
    const d = [].concat(a.Durations.Duration).map(Number);
    return { fw: Number(a.FrameWidth), fh: Number(a.FrameHeight), durations: d, src: a.Name };
  };
  const out: Record<string, AnimDef> = {};
  for (const name of Object.keys(raw)) {
    const r = resolve(name);
    if (r) out[name] = r;
  }
  return out;
}

async function pack(num: number, shiny: boolean): Promise<[string, SpriteMeta, string | null] | null> {
  const id = String(num).padStart(4, '0');
  const sub = shiny ? '/0000/0001' : '';
  const base = `${BASE}/${id}${sub}`;
  const cache = path.join(CACHE, `${id}${shiny ? 's' : ''}`);
  const xml = await fetchCached(`${base}/AnimData.xml`, path.join(cache, 'AnimData.xml'));
  if (!xml) return null;
  const anims = parseAnimData(xml.toString('utf8'));

  const strips: { key: ActionKey; fw: number; fh: number; frames: PNG[]; ms: number[] }[] = [];
  for (const act of ACTIONS) {
    const def = anims[act.anim];
    if (!def) continue;
    const buf = await fetchCached(`${base}/${def.src}-Anim.png`, path.join(cache, `${def.src}-Anim.png`));
    if (!buf) continue;
    const sheet = PNG.sync.read(buf);
    const rows = Math.floor(sheet.height / def.fh);
    const row = rows > act.row ? act.row : 0;
    const nf = Math.min(def.durations.length, Math.floor(sheet.width / def.fw), MAX_FRAMES);
    const frames: PNG[] = [];
    for (let i = 0; i < nf; i++) {
      const fr = new PNG({ width: def.fw, height: def.fh });
      PNG.bitblt(sheet, fr, i * def.fw, row * def.fh, def.fw, def.fh, 0, 0);
      // alpha binaire : pixel-art net, pas de demi-transparence baveuse
      for (let p = 3; p < fr.data.length; p += 4) fr.data[p] = fr.data[p] < ALPHA_T ? 0 : 255;
      frames.push(fr);
    }
    const ms = def.durations.slice(0, nf).map((d) => Math.max(MIN_MS, Math.round((d * 1000 / 60) * SLOW)));
    strips.push({ key: act.key, fw: def.fw, fh: def.fh, frames, ms });
  }
  if (!strips.some((s) => s.key === 'idle')) throw new Error('pas d’Idle');

  // boîte englobante commune à toutes les frames de chaque animation
  const boxes = strips.map((s) => {
    let x0 = s.fw, y0 = s.fh, x1 = -1, y1 = -1;
    for (const fr of s.frames)
      for (let py = 0; py < s.fh; py++)
        for (let px = 0; px < s.fw; px++)
          if (fr.data[(py * s.fw + px) * 4 + 3]) {
            if (px < x0) x0 = px; if (px > x1) x1 = px;
            if (py < y0) y0 = py; if (py > y1) y1 = py;
          }
    if (x1 < 0) { x0 = 0; y0 = 0; x1 = 0; y1 = 0; }
    return { x0, y0, cw: x1 - x0 + 1, ch: y1 - y0 + 1, bottom: y1 };
  });
  const w = Math.max(...strips.map((s, i) => boxes[i].cw * s.frames.length));
  const h = boxes.reduce((acc, b) => acc + b.ch, 0);
  const atlas = new PNG({ width: w, height: h });
  atlas.data.fill(0);
  const meta: SpriteMeta = { w, h, actions: {} };
  let y = 0;
  strips.forEach((s, si) => {
    const b = boxes[si];
    s.frames.forEach((fr, i) => PNG.bitblt(fr, atlas, b.x0, b.y0, b.cw, b.ch, i * b.cw, y));
    meta.actions[s.key] = {
      y, fw: b.cw, fh: b.ch,
      ax: Math.floor(s.fw / 2) - b.x0, ay: b.bottom + 1 - b.y0,
      ms: s.ms,
    };
    y += b.ch;
  });
  const name = `p${shiny ? 's' : ''}${String(num).padStart(3, '0')}`;
  fs.writeFileSync(path.join(OUT_IMG, `${name}.png`), PNG.sync.write(atlas, { colorType: 6 }));

  const credits = await fetchCached(`${base}/credits.txt`, path.join(cache, 'credits.txt')).catch(() => null);
  return [name, meta, credits ? credits.toString('utf8').trim() : null];
}

async function main() {
  // numéros isolés ou plages (`252-493`), fusionnés dans le manifeste existant
  const args = process.argv.slice(2).flatMap((a) => {
    const m = a.match(/^(\d+)-(\d+)$/);
    return m ? Array.from({ length: +m[2] - +m[1] + 1 }, (_, i) => +m[1] + i) : [Number(a)];
  }).filter((n) => n >= 1 && n <= 493);
  const nums = args.length ? args : Array.from({ length: 151 }, (_, i) => i + 1);
  fs.mkdirSync(OUT_IMG, { recursive: true });
  const manifest: Record<string, SpriteMeta> = fs.existsSync(OUT_JSON) && args.length
    ? JSON.parse(fs.readFileSync(OUT_JSON, 'utf8')) : {};
  const credits: string[] = [];
  const failures: string[] = [];

  const jobs = nums.flatMap((n) => [[n, false], [n, true]] as [number, boolean][]);
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const [n, shiny] = jobs[next++];
      try {
        const r = await pack(n, shiny);
        if (!r) { failures.push(`#${n}${shiny ? ' shiny' : ''} (absent)`); continue; }
        manifest[r[0]] = r[1];
        if (r[2] && !shiny) credits.push(`#${String(n).padStart(3, '0')}\n${r[2]}\n`);
        process.stdout.write(`\r${Object.keys(manifest).length} sprites…`);
      } catch (e) {
        failures.push(`#${n}${shiny ? ' shiny' : ''} (${(e as Error).message})`);
      }
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));

  const keys = Object.keys(manifest).sort();
  const sorted = Object.fromEntries(keys.map((k) => [k, manifest[k]]));
  fs.writeFileSync(OUT_JSON, JSON.stringify(sorted));
  fs.writeFileSync(OUT_TS,
    '// GÉNÉRÉ par tools/fetch-sprites.ts — ne pas modifier à la main.\n' +
    '/* eslint-disable */\n' +
    'export const SPRITE_ASSETS: Record<string, number> = {\n' +
    keys.map((k) => `  ${k}: require('../../assets/sprites/${k}.png'),`).join('\n') + '\n};\n');
  // fusionne avec les crédits déjà enregistrés (identifiés par leur en-tête "#NNN") pour ne jamais en
  // perdre lors d'un run partiel (numéros explicites) ; un run complet régénère tout depuis zéro.
  const prevBlocks = !args.length || !fs.existsSync(OUT_CREDITS) ? [] : fs.readFileSync(OUT_CREDITS, 'utf8')
    .split(/\n(?=#\d+\n)/).slice(1).map((b) => b.trimEnd());
  const newNums = new Set(credits.map((c) => c.match(/^#(\d+)/)?.[1]));
  const merged = [...prevBlocks.filter((b) => !newNums.has(b.match(/^#(\d+)/)?.[1])), ...credits].sort();
  fs.writeFileSync(OUT_CREDITS,
    'Sprites : PMD Sprite Collaboration — https://github.com/PMDCollab/SpriteCollab\n' +
    'Licence CC BY-NC 4.0. Pokémon © Nintendo / Game Freak / The Pokémon Company.\n\n' + merged.join('\n'));
  console.log(`\n${keys.length} sprites écrits.`);
  if (failures.length) console.log('Manquants :', failures.join(', '));
}

main().catch((e) => { console.error(e); process.exit(1); });
