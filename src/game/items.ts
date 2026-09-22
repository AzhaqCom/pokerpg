import {
  BattleBonuses, BonusStat, Item, ItemSlot, ItemTemplate, MAX_RARITY, NumericBonusStat, RARITY_MULT, RARITY_SUBS,
} from './model';
import { Rng } from './rng';

/**
 * Catalogue : une panoplie par biome (3 pièces : offensif, défensif, baie), aucun objet générique hors
 * panoplie — un objet trouvé appartient toujours à la panoplie du biome où il tombe (`rollLoot`, filtré
 * par `SETS[set].biome`). 3 baies (Ceriz/Pêcha/Maron) soignent un statut au lieu de PV, réparties dans
 * les panoplies dont le thème colle (Circuit Survolté = paralysie, Brume Toxique = poison, Troisième
 * Œil = sommeil) ; les 7 autres soignent toutes 25 % des PV avant multiplicateur de rareté (`berryHeal`).
 */
export const TEMPLATES: ItemTemplate[] = [
  // biome 1 — Forêt de Jade
  { id: 'griffe-sylve', name: 'Griffe Sylvestre', slot: 'offense', main: 'atkPct', base: 6, set: 'sylve' },
  { id: 'cape-sylve', name: 'Cape Sylvestre', slot: 'defense', main: 'hpPct', base: 8, set: 'sylve' },
  { id: 'baie-sylve', name: 'Baie Sylvestre', slot: 'berry', main: 'hpPct', base: 0, set: 'sylve', berry: { heal: 25 } },
  // biome 2 — Biome Aquatique
  { id: 'nageoire-maree', name: 'Nageoire Rapide', slot: 'offense', main: 'spePct', base: 6, set: 'maree' },
  { id: 'ecaille-maree', name: 'Écaille Robuste', slot: 'defense', main: 'defPct', base: 6, set: 'maree' },
  { id: 'baie-maree', name: 'Baie Aquatique', slot: 'berry', main: 'hpPct', base: 0, set: 'maree', berry: { heal: 25 } },
  // biome 3 — Biome Électrique
  { id: 'bobine-circuit', name: 'Bobine Tesla', slot: 'offense', main: 'critDmgPct', base: 8, set: 'circuit' },
  { id: 'semelle-circuit', name: 'Semelle Isolante', slot: 'defense', main: 'spePct', base: 6, set: 'circuit' },
  { id: 'ceriz', name: 'Baie Ceriz', slot: 'berry', main: 'hpPct', base: 0, set: 'circuit', berry: { heal: 25, cures: 'paralysis' } },
  // biome 4 — Biome Verdoyant
  { id: 'feuille-chloro', name: 'Feuille Tranchante', slot: 'offense', main: 'typeDmgPct', base: 7, set: 'chloro' },
  { id: 'ecorce-chloro', name: 'Écorce Vivace', slot: 'defense', main: 'hpPct', base: 7, set: 'chloro' },
  { id: 'baie-chloro', name: 'Baie Feuillue', slot: 'berry', main: 'hpPct', base: 0, set: 'chloro', berry: { heal: 25 } },
  // biome 5 — Marais Toxique
  { id: 'piquant-brume', name: 'Piquant Empoisonné', slot: 'offense', main: 'critPct', base: 3, set: 'brume' },
  { id: 'carapace-brume', name: 'Carapace Visqueuse', slot: 'defense', main: 'defPct', base: 6, set: 'brume' },
  { id: 'pecha', name: 'Baie Pêcha', slot: 'berry', main: 'hpPct', base: 0, set: 'brume', berry: { heal: 25, cures: 'poison' } },
  // biome 6 — Sanctuaire Psy
  { id: 'amulette-oeil', name: 'Amulette Prescience', slot: 'offense', main: 'critPct', base: 3, set: 'oeil' },
  { id: 'voile-oeil', name: 'Voile Mental', slot: 'defense', main: 'cdrPct', base: 3, set: 'oeil' },
  { id: 'maron', name: 'Baie Maron', slot: 'berry', main: 'hpPct', base: 0, set: 'oeil', berry: { heal: 25, cures: 'sleep' } },
  // biome 7 — Terres de Feu
  { id: 'griffe-cendres', name: 'Griffe Incandescente', slot: 'offense', main: 'atkPct', base: 7, set: 'cendres' },
  { id: 'armure-cendres', name: 'Armure Ignifugée', slot: 'defense', main: 'defPct', base: 6, set: 'cendres' },
  { id: 'baie-cendres', name: 'Baie Braisée', slot: 'berry', main: 'hpPct', base: 0, set: 'cendres', berry: { heal: 25 } },
  // biome 8 — Plaines Rocheuses
  { id: 'poing-aride', name: 'Poing Tellurique', slot: 'offense', main: 'atkPct', base: 8, set: 'aride' },
  { id: 'plastron-aride', name: 'Plastron Rocheux', slot: 'defense', main: 'defPct', base: 7, set: 'aride' },
  { id: 'baie-aride', name: 'Baie Minérale', slot: 'berry', main: 'hpPct', base: 0, set: 'aride', berry: { heal: 25 } },
  // biome 9 — Route Victoire
  { id: 'lame-epreuve', name: 'Lame du Sage', slot: 'offense', main: 'critDmgPct', base: 9, set: 'epreuve' },
  { id: 'manteau-epreuve', name: "Manteau d'Ascension", slot: 'defense', main: 'hpPct', base: 8, set: 'epreuve' },
  { id: 'baie-epreuve', name: "Baie de l'Épreuve", slot: 'berry', main: 'hpPct', base: 0, set: 'epreuve', berry: { heal: 25 } },
  // biome 10 — Ligue Pokémon
  { id: 'gantelet-champion', name: 'Gantelet du Champion', slot: 'offense', main: 'atkPct', base: 9, set: 'champion' },
  { id: 'cape-champion', name: 'Cape du Vainqueur', slot: 'defense', main: 'defPct', base: 8, set: 'champion' },
  { id: 'baie-champion', name: 'Baie du Sacre', slot: 'berry', main: 'hpPct', base: 0, set: 'champion', berry: { heal: 25 } },
];

export const SETS: Record<string, {
  name: string; biome: number;
  two: { stat: NumericBonusStat; value: number; label: string }; three: { stat: NumericBonusStat; value: number; label: string };
}> = {
  sylve: {
    name: 'Tenue Sylvestre', biome: 0,
    two: { stat: 'atkPct', value: 8, label: 'Attaque +8 %' },
    three: { stat: 'lifestealPct', value: 8, label: 'Vol de vie 8 %' },
  },
  maree: {
    name: 'Marée Vivante', biome: 1,
    two: { stat: 'defPct', value: 6, label: 'Défense +6 %' },
    three: { stat: 'lifestealPct', value: 6, label: 'Vol de vie 6 %' },
  },
  circuit: {
    name: 'Circuit Survolté', biome: 2,
    two: { stat: 'spePct', value: 6, label: 'Vitesse +6 %' },
    three: { stat: 'critDmgPct', value: 10, label: 'Dégâts critiques +10 %' },
  },
  chloro: {
    name: 'Chlorophylle Ancienne', biome: 3,
    two: { stat: 'hpPct', value: 6, label: 'PV +6 %' },
    three: { stat: 'lifestealPct', value: 6, label: 'Vol de vie 6 %' },
  },
  brume: {
    name: 'Brume Toxique', biome: 4,
    two: { stat: 'ailmentChancePct', value: 8, label: 'Chance de statut +8 %' },
    three: { stat: 'dmgVsStatusPct', value: 10, label: 'Dégâts vs statut +10 %' },
  },
  oeil: {
    name: 'Troisième Œil', biome: 5,
    two: { stat: 'cdrPct', value: 4, label: 'Recharge −4 %' },
    three: { stat: 'critPct', value: 6, label: 'Critique +6 %' },
  },
  cendres: {
    name: 'Cendres Ardentes', biome: 6,
    two: { stat: 'atkPct', value: 8, label: 'Attaque +8 %' },
    three: { stat: 'dmgVsStatusPct', value: 10, label: 'Dégâts vs statut +10 %' },
  },
  aride: {
    name: 'Poussière Aride', biome: 7,
    two: { stat: 'defPct', value: 8, label: 'Défense +8 %' },
    three: { stat: 'aoeDmgPct', value: 10, label: 'Dégâts de zone +10 %' },
  },
  epreuve: {
    name: 'Épreuve du Sage', biome: 8,
    two: { stat: 'hpPct', value: 7, label: 'PV +7 %' },
    three: { stat: 'critDmgPct', value: 12, label: 'Dégâts critiques +12 %' },
  },
  champion: {
    name: 'Titre de Champion', biome: 9,
    two: { stat: 'atkPct', value: 10, label: 'Attaque +10 %' },
    three: { stat: 'typeDmgPct', value: 10, label: 'Dégâts de son type +10 %' },
  },
};

const SUB_BASE: Record<BonusStat, number> = {
  atkPct: 3, defPct: 3, hpPct: 4, spePct: 3, critPct: 1.5, critDmgPct: 6, typeDmgPct: 4, cdrPct: 1.5,
};
const SUB_POOL: BonusStat[] = ['atkPct', 'defPct', 'hpPct', 'spePct', 'critPct', 'critDmgPct', 'typeDmgPct', 'cdrPct'];

export const STAT_LABEL: Record<BonusStat, string> = {
  atkPct: 'Attaque', defPct: 'Défense', hpPct: 'PV', spePct: 'Vitesse', critPct: 'Critique',
  critDmgPct: 'Dégâts critiques', typeDmgPct: 'Dégâts de son type', cdrPct: 'Recharge −',
};

export function template(id: string): ItemTemplate {
  const t = TEMPLATES.find((x) => x.id === id);
  if (!t) throw new Error(`Objet inconnu : ${id}`);
  return t;
}

const lvlMult = (level: number) => 1 + 0.08 * (level - 1);
const round1 = (v: number) => Math.round(v * 10) / 10;

/** Valeur de la stat principale (0 pour les baies, qui agissent en combat). */
export function mainValue(item: Item): number {
  const t = template(item.templateId);
  return round1(t.base * lvlMult(item.level) * RARITY_MULT[item.rarity]);
}

/** Soin d'une baie en % des PV (augmente avec la rareté). */
export function berryHeal(item: Item): number {
  const t = template(item.templateId);
  return t.berry?.heal ? Math.round(t.berry.heal * RARITY_MULT[item.rarity]) : 0;
}

function rollSub(rng: Rng, level: number, exclude: BonusStat[]): { stat: BonusStat; value: number } {
  const pool = SUB_POOL.filter((s) => !exclude.includes(s));
  const stat = pool[rng.int(pool.length)];
  const roll = 0.7 + rng.int(31) / 100; // 70–100 %
  return { stat, value: round1(SUB_BASE[stat] * lvlMult(level) * roll) };
}

let seq = 0;
export function newUid(prefix: string) {
  seq = (seq + 1) % 1e6;
  return `${prefix}${Date.now().toString(36)}${seq.toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
}

export function makeItem(templateId: string, rarity: number, level: number, rng: Rng): Item {
  const t = template(templateId);
  const subs: Item['subs'] = [];
  for (let i = 0; i < RARITY_SUBS[rarity]; i++) subs.push(rollSub(rng, level, [t.main, ...subs.map((s) => s.stat)]));
  return { uid: newUid('i'), templateId, rarity, level, subs };
}

/** Tirage de rareté d'un objet tombé en zone (60/25/10/4/1 %). */
export function rollRarity(rng: Rng, minRarity = 0): number {
  const r = rng.int(100);
  const rar = r < 60 ? 0 : r < 85 ? 1 : r < 95 ? 2 : r < 99 ? 3 : 4;
  return Math.max(rar, minRarity);
}

/** Butin : objet aléatoire de la panoplie du biome où on le trouve (chaque objet appartient à un biome). */
export function rollLoot(rng: Rng, level: number, biome: number, minRarity = 0): Item {
  const pool = TEMPLATES.filter((t) => SETS[t.set!].biome === biome);
  const t = pool[rng.int(pool.length)];
  return makeItem(t.id, rollRarity(rng, minRarity), Math.max(1, level), rng);
}

/** Éclats obtenus en recyclant. */
export function recycleValue(item: Item): number {
  return 2 * (item.rarity + 1) * (item.rarity + 1) + item.level;
}

/** Coût en éclats pour monter l'objet d'un niveau. */
export function upgradeCost(item: Item): number {
  return 5 * item.level * (item.rarity + 1);
}

export function upgrade(item: Item): Item {
  const scale = lvlMult(item.level + 1) / lvlMult(item.level);
  return { ...item, level: item.level + 1, subs: item.subs.map((s) => ({ ...s, value: round1(s.value * scale) })) };
}

export function rerollCost(item: Item): number {
  return 20 * (item.rarity + 1);
}

export function rerollSub(item: Item, index: number, rng: Rng): Item {
  const t = template(item.templateId);
  const others = item.subs.filter((_, i) => i !== index).map((s) => s.stat);
  const subs = item.subs.slice();
  subs[index] = rollSub(rng, item.level, [t.main, ...others]);
  return { ...item, subs };
}

/** Fusion 3 → 1 : trois objets identiques (même objet, même rareté) → rareté suivante. */
export function canFuse(items: Item[]): boolean {
  return items.length === 3
    && new Set(items.map((i) => i.uid)).size === 3
    && items.every((i) => i.templateId === items[0].templateId && i.rarity === items[0].rarity)
    && items[0].rarity < MAX_RARITY;
}

export function fuse(items: Item[], rng: Rng): Item {
  if (!canFuse(items)) throw new Error('Fusion impossible');
  const rarity = items[0].rarity + 1;
  const level = Math.max(...items.map((i) => i.level));
  const t = template(items[0].templateId);
  // garde les meilleurs bonus existants, complète jusqu'au nombre de la rareté
  const best = new Map<BonusStat, number>();
  for (const it of items) for (const s of it.subs) best.set(s.stat, Math.max(best.get(s.stat) ?? 0, s.value));
  const subs = [...best.entries()].sort((a, b) => b[1] - a[1]).slice(0, RARITY_SUBS[rarity])
    .map(([stat, value]) => ({ stat, value }));
  while (subs.length < RARITY_SUBS[rarity]) subs.push(rollSub(rng, level, [t.main, ...subs.map((s) => s.stat)]));
  return { uid: newUid('i'), templateId: t.id, rarity, level, subs };
}

/** Ajoute les bonus d'objets tenus (stat principale, secondaires, panoplie). */
export function addItemBonuses(b: BattleBonuses, held: Item[]) {
  const setCount: Record<string, number> = {};
  for (const it of held) {
    const t = template(it.templateId);
    if (t.base > 0) b[t.main] += mainValue(it);
    for (const s of it.subs) b[s.stat] += s.value;
    if (t.set) setCount[t.set] = (setCount[t.set] ?? 0) + 1;
  }
  for (const [id, n] of Object.entries(setCount)) {
    const set = SETS[id];
    if (!set) continue;
    if (n >= 2) b[set.two.stat] += set.two.value;
    if (n >= 3) b[set.three.stat] += set.three.value;
  }
}

/** Compare un objet à celui équipé : somme pondérée simple (pour la flèche verte/rouge). */
export function itemScore(item: Item): number {
  const weight: Record<BonusStat, number> = {
    atkPct: 1, defPct: 0.8, hpPct: 0.7, spePct: 0.8, critPct: 2, critDmgPct: 0.5, typeDmgPct: 0.8, cdrPct: 2,
  };
  const t = template(item.templateId);
  if (t.berry) return (berryHeal(item) || 20) + item.level + item.rarity * 10;
  return mainValue(item) * weight[t.main] + item.subs.reduce((a, s) => a + s.value * weight[s.stat], 0);
}

export function slotOf(item: Item): ItemSlot {
  return template(item.templateId).slot;
}
