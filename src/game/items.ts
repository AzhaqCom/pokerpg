import {
  BattleBonuses, BonusStat, Item, ItemSlot, ItemTemplate, MAX_RARITY, NumericBonusStat, RARITY_MULT, RARITY_SUBS,
} from './model';
import { BIOMES, REGIONS } from './content';
import { Rng } from './rng';

/**
 * Catalogue : une panoplie par biome — 20 aujourd'hui (10 Kanto + 10 Johto) — (3 pièces : offensif,
 * défensif, baie), aucun objet générique hors
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
  { id: 'nageoire-maree', name: 'Nageoire Rapide', slot: 'offense', main: 'spePct', base: 7.7, set: 'maree' },
  { id: 'ecaille-maree', name: 'Écaille Robuste', slot: 'defense', main: 'defPct', base: 6, set: 'maree' },
  { id: 'baie-maree', name: 'Baie Aquatique', slot: 'berry', main: 'hpPct', base: 0, set: 'maree', berry: { heal: 25 } },
  // biome 3 — Biome Électrique
  { id: 'bobine-circuit', name: 'Bobine Tesla', slot: 'offense', main: 'critDmgPct', base: 10.5, set: 'circuit' },
  { id: 'semelle-circuit', name: 'Semelle Isolante', slot: 'defense', main: 'spePct', base: 6.1, set: 'circuit' },
  { id: 'ceriz', name: 'Baie Ceriz', slot: 'berry', main: 'hpPct', base: 0, set: 'circuit', berry: { heal: 25, cures: 'paralysis' } },
  // biome 4 — Biome Verdoyant
  { id: 'feuille-chloro', name: 'Feuille Tranchante', slot: 'offense', main: 'typeDmgPct', base: 8.1, set: 'chloro' },
  { id: 'ecorce-chloro', name: 'Écorce Vivace', slot: 'defense', main: 'hpPct', base: 7, set: 'chloro' },
  { id: 'baie-chloro', name: 'Baie Feuillue', slot: 'berry', main: 'hpPct', base: 0, set: 'chloro', berry: { heal: 25, cures: 'sleep' } },
  // biome 5 — Marais Toxique
  { id: 'piquant-brume', name: 'Piquant Empoisonné', slot: 'offense', main: 'critPct', base: 3.3, set: 'brume' },
  { id: 'carapace-brume', name: 'Carapace Visqueuse', slot: 'defense', main: 'defPct', base: 6, set: 'brume' },
  { id: 'pecha', name: 'Baie Pêcha', slot: 'berry', main: 'hpPct', base: 0, set: 'brume', berry: { heal: 25, cures: 'poison' } },
  // biome 6 — Sanctuaire Psy
  { id: 'amulette-oeil', name: 'Amulette Prescience', slot: 'offense', main: 'critPct', base: 3.4, set: 'oeil' },
  { id: 'voile-oeil', name: 'Voile Mental', slot: 'defense', main: 'cdrPct', base: 2.4, set: 'oeil' },
  { id: 'maron', name: 'Baie Maron', slot: 'berry', main: 'hpPct', base: 0, set: 'oeil', berry: { heal: 25 } },
  // biome 7 — Terres de Feu
  { id: 'griffe-cendres', name: 'Griffe Incandescente', slot: 'offense', main: 'atkPct', base: 7, set: 'cendres' },
  { id: 'armure-cendres', name: 'Armure Ignifugée', slot: 'defense', main: 'defPct', base: 6, set: 'cendres' },
  { id: 'baie-cendres', name: 'Baie Braisée', slot: 'berry', main: 'hpPct', base: 0, set: 'cendres', berry: { heal: 25, cures: 'burn' } },
  // biome 8 — Plaines Rocheuses
  { id: 'poing-aride', name: 'Poing Tellurique', slot: 'offense', main: 'atkPct', base: 8, set: 'aride' },
  { id: 'plastron-aride', name: 'Plastron Rocheux', slot: 'defense', main: 'defPct', base: 7, set: 'aride' },
  { id: 'baie-aride', name: 'Baie Minérale', slot: 'berry', main: 'hpPct', base: 0, set: 'aride', berry: { heal: 25 } },
  // biome 9 — Route Victoire
  { id: 'lame-epreuve', name: 'Lame du Sage', slot: 'offense', main: 'critDmgPct', base: 13, set: 'epreuve' },
  { id: 'manteau-epreuve', name: "Manteau d'Ascension", slot: 'defense', main: 'hpPct', base: 8, set: 'epreuve' },
  { id: 'baie-epreuve', name: "Baie de l'Épreuve", slot: 'berry', main: 'hpPct', base: 0, set: 'epreuve', berry: { heal: 25, cures: 'freeze' } },
  // biome 10 — Ligue Pokémon
  { id: 'gantelet-champion', name: 'Gantelet du Champion', slot: 'offense', main: 'atkPct', base: 9, set: 'champion' },
  { id: 'cape-champion', name: 'Cape du Vainqueur', slot: 'defense', main: 'defPct', base: 8, set: 'champion' },
  { id: 'baie-champion', name: 'Baie du Sacre', slot: 'berry', main: 'hpPct', base: 0, set: 'champion', berry: { heal: 25 } },
  // biome 11 — Route des Cieux (Johto)
  { id: 'bec-ciel', name: 'Bec Acéré', slot: 'offense', main: 'critPct', base: 3, set: 'ciel' },
  { id: 'plume-ciel', name: 'Plume Véloce', slot: 'defense', main: 'spePct', base: 7, set: 'ciel' },
  { id: 'baie-ciel', name: 'Baie des Cieux', slot: 'berry', main: 'hpPct', base: 0, set: 'ciel', berry: { heal: 25 } },
  // biome 12 — Forêt Fourmillante (Johto)
  { id: 'mandibule-ruche', name: 'Mandibule Acérée', slot: 'offense', main: 'atkPct', base: 7, set: 'ruche' },
  { id: 'carapace-ruche', name: 'Carapace Chitineuse', slot: 'defense', main: 'defPct', base: 6, set: 'ruche' },
  { id: 'baie-ruche', name: 'Baie Butinée', slot: 'berry', main: 'hpPct', base: 0, set: 'ruche', berry: { heal: 25 } },
  // biome 13 — Prairies de Doré (Johto)
  { id: 'corne-prairie', name: 'Corne Robuste', slot: 'offense', main: 'critDmgPct', base: 11, set: 'prairie' },
  { id: 'toison-prairie', name: 'Toison Épaisse', slot: 'defense', main: 'hpPct', base: 7, set: 'prairie' },
  { id: 'baie-prairie', name: 'Baie des Prairies', slot: 'berry', main: 'hpPct', base: 0, set: 'prairie', berry: { heal: 25 } },
  // biome 14 — Tour Hantée (Johto)
  { id: 'griffe-brume', name: 'Griffe Spectrale', slot: 'offense', main: 'critPct', base: 3.8, set: 'brume2' },
  { id: 'voile-brume', name: 'Voile Brumeux', slot: 'defense', main: 'cdrPct', base: 2.4, set: 'brume2' },
  { id: 'baie-brume', name: 'Baie Fantomatique', slot: 'berry', main: 'hpPct', base: 0, set: 'brume2', berry: { heal: 25 } },
  // biome 15 — Dojo d'Ébène (Johto)
  { id: 'poing-dojo', name: 'Poing de Fer', slot: 'offense', main: 'critDmgPct', base: 12, set: 'dojo' },
  { id: 'ceinture-dojo', name: 'Ceinture Renforcée', slot: 'defense', main: 'defPct', base: 6, set: 'dojo' },
  { id: 'baie-dojo', name: 'Baie du Dojo', slot: 'berry', main: 'hpPct', base: 0, set: 'dojo', berry: { heal: 25 } },
  // biome 16 — Phare d'Olivia (Johto)
  { id: 'lame-phare', name: "Lame d'Acier", slot: 'offense', main: 'atkPct', base: 8, set: 'phare' },
  { id: 'armure-phare', name: 'Armure Polie', slot: 'defense', main: 'defPct', base: 7, set: 'phare' },
  { id: 'baie-phare', name: 'Baie du Phare', slot: 'berry', main: 'hpPct', base: 0, set: 'phare', berry: { heal: 25 } },
  // biome 17 — Grotte Gelée (Johto)
  { id: 'croc-givre', name: 'Croc de Glace', slot: 'offense', main: 'critPct', base: 4.3, set: 'givre' },
  { id: 'manteau-givre', name: 'Manteau Givré', slot: 'defense', main: 'defPct', base: 6, set: 'givre' },
  { id: 'baie-givre', name: 'Baie Givrée', slot: 'berry', main: 'hpPct', base: 0, set: 'givre', berry: { heal: 25, cures: 'freeze' } },
  // biome 18 — Tanière des Dragons (Johto)
  { id: 'griffe-tanieres', name: 'Griffe Draconique', slot: 'offense', main: 'atkPct', base: 9, set: 'dragon2' },
  { id: 'ecaille-tanieres', name: 'Écaille Draconique', slot: 'defense', main: 'hpPct', base: 8, set: 'dragon2' },
  { id: 'baie-tanieres', name: 'Baie du Dragon', slot: 'berry', main: 'hpPct', base: 0, set: 'dragon2', berry: { heal: 25 } },
  // biome 19 — Grotte Sombre (Johto, Conseil des 4)
  { id: 'griffe-ombre', name: 'Griffe Sournoise', slot: 'offense', main: 'critDmgPct', base: 14.5, set: 'ombre' },
  { id: 'cape-ombre', name: "Cape d'Ombre", slot: 'defense', main: 'defPct', base: 8, set: 'ombre' },
  { id: 'baie-ombre', name: 'Baie Sombre', slot: 'berry', main: 'hpPct', base: 0, set: 'ombre', berry: { heal: 25 } },
  // biome 20 — Plateau Doré (Johto, Champion)
  { id: 'gantelet-plateau', name: 'Gantelet Doré', slot: 'offense', main: 'atkPct', base: 10, set: 'plateau' },
  { id: 'cape-plateau', name: 'Cape Dorée', slot: 'defense', main: 'defPct', base: 9, set: 'plateau' },
  { id: 'baie-plateau', name: 'Baie Dorée', slot: 'berry', main: 'hpPct', base: 0, set: 'plateau', berry: { heal: 25 } },
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
  ciel: {
    name: 'Ailes du Zéphyr', biome: 10,
    two: { stat: 'spePct', value: 6, label: 'Vitesse +6 %' },
    three: { stat: 'dodgePct', value: 8, label: 'Esquive +8 %' },
  },
  ruche: {
    name: 'Essaim Fourmillant', biome: 11,
    two: { stat: 'atkPct', value: 8, label: 'Attaque +8 %' },
    three: { stat: 'critPct', value: 6, label: 'Critique +6 %' },
  },
  prairie: {
    name: 'Robe des Prairies', biome: 12,
    two: { stat: 'hpPct', value: 7, label: 'PV +7 %' },
    three: { stat: 'atkPct', value: 8, label: 'Attaque +8 %' },
  },
  brume2: {
    name: 'Voile de la Tour', biome: 13,
    two: { stat: 'cdrPct', value: 4, label: 'Recharge −4 %' },
    three: { stat: 'dodgePct', value: 8, label: 'Esquive +8 %' },
  },
  dojo: {
    name: 'Tenue du Dojo', biome: 14,
    two: { stat: 'atkPct', value: 8, label: 'Attaque +8 %' },
    three: { stat: 'critDmgPct', value: 12, label: 'Dégâts critiques +12 %' },
  },
  phare: {
    name: 'Alliage du Phare', biome: 15,
    two: { stat: 'defPct', value: 8, label: 'Défense +8 %' },
    three: { stat: 'critDmgPct', value: 10, label: 'Dégâts critiques +10 %' },
  },
  givre: {
    name: 'Manteau Givré', biome: 16,
    two: { stat: 'defPct', value: 6, label: 'Défense +6 %' },
    three: { stat: 'critDmgPct', value: 10, label: 'Dégâts critiques +10 %' },
  },
  dragon2: {
    name: 'Écailles de la Tanière', biome: 17,
    two: { stat: 'atkPct', value: 9, label: 'Attaque +9 %' },
    three: { stat: 'typeDmgPct', value: 10, label: 'Dégâts de son type +10 %' },
  },
  ombre: {
    name: 'Voile des Ombres', biome: 18,
    two: { stat: 'critPct', value: 7, label: 'Critique +7 %' },
    three: { stat: 'critDmgPct', value: 12, label: 'Dégâts critiques +12 %' },
  },
  plateau: {
    name: 'Titre de Champion Johto', biome: 19,
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
  return round1(t.base * (item.tier ?? 1) * lvlMult(item.level) * RARITY_MULT[item.rarity]);
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

export function makeItem(templateId: string, rarity: number, level: number, rng: Rng, biome?: number): Item {
  const t = template(templateId);
  const subs: Item['subs'] = [];
  for (let i = 0; i < RARITY_SUBS[rarity]; i++) subs.push(rollSub(rng, level, [t.main, ...subs.map((s) => s.stat)]));
  const item: Item = { uid: newUid('i'), templateId, rarity, level, subs };
  const tier = biome === undefined ? 1 : biomeTier(biome, t);
  if (tier !== 1) item.tier = tier;
  return item;
}

/** Tirage de rareté d'un objet tombé en zone (60/25/10/4/1 %). */
export function rollRarity(rng: Rng, minRarity = 0): number {
  const r = rng.int(100);
  const rar = r < 60 ? 0 : r < 85 ? 1 : r < 95 ? 2 : r < 99 ? 3 : 4;
  return Math.max(rar, minRarity);
}

/**
 * Butin : objet aléatoire de la panoplie du biome où on le trouve (chaque objet appartient à un biome).
 * Repli sur tout le catalogue si un futur biome n'a pas encore de panoplie dédiée (garde-fou, tous les
 * biomes Kanto et Johto en ont une aujourd'hui).
 */
export function rollLoot(rng: Rng, level: number, biome: number, minRarity = 0): Item {
  const key = setOfBiome(biome);
  const local = TEMPLATES.filter((t) => t.set === key);
  const pool = local.length ? local : TEMPLATES;
  const t = pool[rng.int(pool.length)];
  return makeItem(t.id, rollRarity(rng, minRarity), Math.max(1, level), rng, biome);
}

/**
 * Panoplies réutilisées par thème dans les régions sans panoplies propres (Hoenn, Sinnoh…) : aucun type
 * de biome n'y manque, donc pas de nouveaux objets à créer. Kanto et Johto gardent leurs panoplies
 * natives (`SETS[x].biome`).
 */
export const BIOME_SET: Record<number, string> = {
  20: 'aride',   // Carrière de Mérouville (Roche)
  21: 'dojo',    // Îlot de Myokara (Combat)
  22: 'ruche',   // Bois de Clémenti (Insecte/Plante)
  23: 'circuit', // Centrale de Lavandia (Électrik)
  24: 'cendres', // Mont Chimnée (Feu)
  25: 'prairie', // Plaines de Clémenti-Ville (Normal)
  26: 'chloro',  // Route du Désert (Plante/Sol/Poison)
  27: 'ciel',    // Cimes de Cimetronelle (Vol)
  28: 'oeil',    // Île d'Algatia (Psy)
  29: 'maree',   // Fonds d'Atalanopolis (Eau)
  30: 'epreuve', // Route Victoire Hoenn
  31: 'phare',   // Ligue d'Éternara (Acier)
  // Sinnoh (32-46)
  32: 'aride',   // Mine de Charbourg (Roche)
  33: 'sylve',   // Forêt de Bonville (Plante/Insecte)
  34: 'ciel',    // Route Bosselée (Normal/Vol)
  35: 'dojo',    // Dojo de Voilaroc (Combat)
  36: 'maree',   // Marais de Verchamps (Eau)
  37: 'brume',   // Route des Marais (Poison/Sol)
  38: 'oeil',    // Manoir d'Unionpolis (Spectre/Psy)
  39: 'cendres', // Mont Foyer (Feu)
  40: 'phare',   // Port Canalave (Acier)
  41: 'ombre',   // Passe des Ombres (Ténèbres)
  42: 'givre',   // Glaciers de Frimapic (Glace)
  43: 'circuit', // Centrale de Rivamar (Électrik)
  44: 'plateau', // Mont Couronné (Dragon)
  45: 'epreuve', // Route Victoire Sinnoh
  46: 'champion', // Ligue de Sinnoh
};

/** Panoplie dont tombent les objets d'un biome. */
export function setOfBiome(biome: number): string | undefined {
  return BIOME_SET[biome] ?? Object.keys(SETS).find((k) => SETS[k].biome === biome);
}

/** Score natif (base × poids) du 1er biome de Kanto par emplacement : la référence de début de région. */
const START_SCORE: Partial<Record<ItemSlot, number>> = { offense: 6, defense: 5.6 };
/** Gain de puissance entre le 1er et le dernier biome d'une région (~+60 %, comme Kanto et Johto). */
const REGION_SLOPE = 0.6;

/**
 * Facteur de puissance d'un objet réutilisé dans un biome d'une région sans panoplies propres : son
 * `base` suit la progression de sa région d'origine, pas de celle où il tombe. Le 1er biome de la région
 * est calé sur le 1er biome de Kanto (nouveau départ après prestige), le dernier ~+60 %. 1 pour tout
 * biome à panoplie native ou pour une baie.
 */
export function biomeTier(biome: number, t: ItemTemplate): number {
  if (!(biome in BIOME_SET) || t.base <= 0) return 1;
  const ri = REGIONS.reduce((acc, r, i) => (r.start <= biome ? i : acc), 0);
  const start = REGIONS[ri].start;
  const size = (REGIONS[ri + 1]?.start ?? BIOMES.length) - start;
  const pos = size > 1 ? (biome - start) / (size - 1) : 0;
  const target = (START_SCORE[t.slot] ?? t.base * STAT_WEIGHT[t.main]) * (1 + REGION_SLOPE * pos);
  return Math.round((target / (t.base * STAT_WEIGHT[t.main])) * 1000) / 1000;
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
  const tier = Math.max(...items.map((i) => i.tier ?? 1));
  const out: Item = { uid: newUid('i'), templateId: t.id, rarity, level, subs };
  if (tier !== 1) out.tier = tier;
  return out;
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

/**
 * Poids relatif de chaque stat pour comparer des bonus disparates sur une même échelle (objet contre
 * objet, mais aussi bonus de panoplie contre objets indépendants dans `autoEquipBest`). Arbitraire mais
 * cohérent : critique/recharge/esquive/vol de vie pèsent plus lourd que les stats brutes (PV/Atq/Déf/Vit).
 */
export const STAT_WEIGHT: Record<NumericBonusStat, number> = {
  atkPct: 1, defPct: 0.8, hpPct: 0.7, spePct: 0.8, critPct: 2, critDmgPct: 0.5, typeDmgPct: 0.8, cdrPct: 2,
  dmgVsStatusPct: 0.6, ailmentChancePct: 0.8, lifestealPct: 1.2, basicDmgPct: 0.5, aoeDmgPct: 0.8, dodgePct: 1.5,
};

/** Compare un objet à celui équipé : somme pondérée simple (pour la flèche verte/rouge). */
export function itemScore(item: Item): number {
  const t = template(item.templateId);
  if (t.berry) return (berryHeal(item) || 20) + item.level + item.rarity * 10;
  return mainValue(item) * STAT_WEIGHT[t.main] + item.subs.reduce((a, s) => a + s.value * STAT_WEIGHT[s.stat], 0);
}

export function slotOf(item: Item): ItemSlot {
  return template(item.templateId).slot;
}
