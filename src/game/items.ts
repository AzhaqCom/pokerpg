import {
  BattleBonuses, BonusStat, Item, ItemSlot, ItemTemplate, MAX_RARITY, NumericBonusStat, RARITY_MULT, RARITY_SUBS,
} from './model';
import { Rng } from './rng';

/** Catalogue V1 (biome 1). */
export const TEMPLATES: ItemTemplate[] = [
  { id: 'griffe', name: 'Griffe Rasoir', slot: 'offense', main: 'critPct', base: 3 },
  { id: 'lunettes', name: 'Lunettes Choix', slot: 'offense', main: 'atkPct', base: 6 },
  { id: 'mouchoir', name: 'Mouchoir Soie', slot: 'offense', main: 'typeDmgPct', base: 8 },
  { id: 'echarpe', name: 'Écharpe Vitalité', slot: 'defense', main: 'hpPct', base: 8 },
  { id: 'carapace', name: 'Carapace Dure', slot: 'defense', main: 'defPct', base: 6 },
  { id: 'poudre', name: 'Poudre Vite', slot: 'defense', main: 'spePct', base: 6 },
  { id: 'oran', name: 'Baie Oran', slot: 'berry', main: 'hpPct', base: 0, berry: { heal: 25 } },
  { id: 'ceriz', name: 'Baie Ceriz', slot: 'berry', main: 'hpPct', base: 0, berry: { cures: 'paralysis' } },
  { id: 'pecha', name: 'Baie Pêcha', slot: 'berry', main: 'hpPct', base: 0, berry: { cures: 'poison' } },
  { id: 'maron', name: 'Baie Maron', slot: 'berry', main: 'hpPct', base: 0, berry: { cures: 'sleep' } },
  // panoplie du biome 1
  { id: 'griffe-sylve', name: 'Griffe Sylvestre', slot: 'offense', main: 'atkPct', base: 6, set: 'sylve' },
  { id: 'cape-sylve', name: 'Cape Sylvestre', slot: 'defense', main: 'hpPct', base: 8, set: 'sylve' },
  { id: 'baie-sylve', name: 'Baie Sylvestre', slot: 'berry', main: 'hpPct', base: 0, set: 'sylve', berry: { heal: 30 } },
];

export const SETS: Record<string, { name: string; two: { stat: NumericBonusStat; value: number; label: string }; three: { stat: NumericBonusStat; value: number; label: string } }> = {
  sylve: {
    name: 'Tenue Sylvestre',
    two: { stat: 'atkPct', value: 8, label: 'Attaque +8 %' },
    three: { stat: 'lifestealPct', value: 8, label: 'Vol de vie 8 %' },
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

/** Butin : objet aléatoire du catalogue (panoplie : 1 chance sur 6). */
export function rollLoot(rng: Rng, level: number, minRarity = 0): Item {
  const pool = TEMPLATES.filter((t) => (rng.int(6) === 0 ? !!t.set : !t.set));
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
