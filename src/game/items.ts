import {
  BattleBonuses, BonusStat, Item, critOverflow, emptyBonuses, ItemSlot, ItemTemplate, MAX_RARITY, NumericBonusStat, RARITIES, RARITY_MULT, RARITY_SUBS,
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
/**
 * Objets Critique « mixtes » (2026-09-25) : une chance de critique fixe par rareté + des Dégâts critiques qui grimpent
 * avec le niveau. Avant, leur stat principale était la seule Critique, calibrée linéairement : +117 % dès un Rare Nv.50,
 * donc plafonnée à 100 % par l'objet seul, et une valeur figée (~6 fois moins qu'un objet Attaque en fin de partie).
 * Bases des Dégâts critiques calées (`tools/scratch/crit_value.ts`) pour valoir à peu près l'objet Attaque équivalent
 * pour un Pokémon à ~30 % de Critique. Les objets déjà possédés suivent (valeur recalculée depuis le modèle).
 */
export const CRIT_BY_RARITY = [8, 10, 12, 15, 18, 21, 25];

/**
 * Vitesse et Recharge (2026-10-01) : depuis que la Vitesse raccourcit le temps entre deux actions et que la Recharge
 * n'a plus de plafond (rendement décroissant, voir `battle.ts`), leur valeur juste grimpe bien moins vite que les
 * autres stats avec le niveau, à peu près comme sa racine carrée (`tools/scratch/calib_speed.ts`). Elles suivent donc
 * `slowLvlMult` au lieu de `lvlMult`, dans les sous-stats comme dans le bonus des objets mixtes.
 * Objets mixtes : un objet entièrement Vitesse saturait le rendement décroissant et vidait un emplacement défensif de
 * toute défense → stat principale réduite (`HYBRID_MAIN_SHARE`) + bonus de Vitesse / Recharge (`FLAT_HYBRID_BASE`
 * × `slowLvlMult` × rareté), calé pour valoir la part de stat principale retirée.
 */
export const FLAT_HYBRID_BASE: Record<'spePct' | 'cdrPct', number> = { spePct: 4.5, cdrPct: 11 };
/** Part de la stat principale d'un objet mixte Vitesse / Recharge (le reste de sa valeur est dans le bonus fixe). */
export const HYBRID_MAIN_SHARE = 0.6;
const CRIT_HYBRID_BASE = { brume: 15.1, oeil: 15.7, ciel: 13.6, brume2: 17.7, givre: 20.2 };

export const TEMPLATES: ItemTemplate[] = [
  // biome 1 — Forêt de Jade
  { id: 'griffe-sylve', name: 'Griffe Sylvestre', slot: 'offense', main: 'atkPct', base: 6, set: 'sylve' },
  { id: 'cape-sylve', name: 'Cape Sylvestre', slot: 'defense', main: 'hpPct', base: 5.3, set: 'sylve' },
  { id: 'baie-sylve', name: 'Baie Sylvestre', slot: 'berry', main: 'hpPct', base: 0, set: 'sylve', berry: { heal: 25 } },
  // biome 2 — Biome Aquatique
  { id: 'nageoire-maree', name: 'Nageoire Rapide', slot: 'offense', main: 'atkPct', base: 6.3 * HYBRID_MAIN_SHARE, flat: 'spePct', set: 'maree' },
  { id: 'ecaille-maree', name: 'Écaille Robuste', slot: 'defense', main: 'defPct', base: 4.6, set: 'maree' },
  { id: 'baie-maree', name: 'Baie Aquatique', slot: 'berry', main: 'hpPct', base: 0, set: 'maree', berry: { heal: 25 } },
  // biome 3 — Biome Électrique
  { id: 'bobine-circuit', name: 'Bobine Tesla', slot: 'offense', main: 'critDmgPct', base: 17.5, set: 'circuit' },
  { id: 'semelle-circuit', name: 'Semelle Isolante', slot: 'defense', main: 'defPct', base: 4.6 * HYBRID_MAIN_SHARE, flat: 'spePct', set: 'circuit' },
  { id: 'ceriz', name: 'Baie Ceriz', slot: 'berry', main: 'hpPct', base: 0, set: 'circuit', berry: { heal: 25, cures: 'paralysis' } },
  // biome 4 — Biome Verdoyant
  { id: 'feuille-chloro', name: 'Feuille Tranchante', slot: 'offense', main: 'typeDmgPct', base: 10.1, set: 'chloro' },
  { id: 'ecorce-chloro', name: 'Écorce Vivace', slot: 'defense', main: 'hpPct', base: 4.6, set: 'chloro' },
  { id: 'baie-chloro', name: 'Baie Feuillue', slot: 'berry', main: 'hpPct', base: 0, set: 'chloro', berry: { heal: 25, cures: 'sleep' } },
  // biome 5 — Marais Toxique
  { id: 'piquant-brume', name: 'Piquant Empoisonné', slot: 'offense', main: 'critDmgPct', base: CRIT_HYBRID_BASE.brume, bonusCrit: true, set: 'brume' },
  { id: 'carapace-brume', name: 'Carapace Visqueuse', slot: 'defense', main: 'defPct', base: 4.6, set: 'brume' },
  { id: 'pecha', name: 'Baie Pêcha', slot: 'berry', main: 'hpPct', base: 0, set: 'brume', berry: { heal: 25, cures: 'poison' } },
  // biome 6 — Sanctuaire Psy
  { id: 'amulette-oeil', name: 'Amulette Prescience', slot: 'offense', main: 'critDmgPct', base: CRIT_HYBRID_BASE.oeil, bonusCrit: true, set: 'oeil' },
  { id: 'voile-oeil', name: 'Voile Mental', slot: 'defense', main: 'hpPct', base: 4.6 * HYBRID_MAIN_SHARE, flat: 'cdrPct', set: 'oeil' },
  { id: 'maron', name: 'Baie Maron', slot: 'berry', main: 'hpPct', base: 0, set: 'oeil', berry: { heal: 25 } },
  // biome 7 — Terres de Feu
  { id: 'griffe-cendres', name: 'Griffe Incandescente', slot: 'offense', main: 'atkPct', base: 7, set: 'cendres' },
  { id: 'armure-cendres', name: 'Armure Ignifugée', slot: 'defense', main: 'defPct', base: 4.6, set: 'cendres' },
  { id: 'baie-cendres', name: 'Baie Braisée', slot: 'berry', main: 'hpPct', base: 0, set: 'cendres', berry: { heal: 25, cures: 'burn' } },
  // biome 8 — Plaines Rocheuses
  { id: 'poing-aride', name: 'Poing Tellurique', slot: 'offense', main: 'atkPct', base: 8, set: 'aride' },
  { id: 'plastron-aride', name: 'Plastron Rocheux', slot: 'defense', main: 'defPct', base: 5.3, set: 'aride' },
  { id: 'baie-aride', name: 'Baie Minérale', slot: 'berry', main: 'hpPct', base: 0, set: 'aride', berry: { heal: 25 } },
  // biome 9 — Route Victoire
  { id: 'lame-epreuve', name: 'Lame du Sage', slot: 'offense', main: 'critDmgPct', base: 21.7, set: 'epreuve' },
  { id: 'manteau-epreuve', name: "Manteau d'Ascension", slot: 'defense', main: 'hpPct', base: 5.3, set: 'epreuve' },
  { id: 'baie-epreuve', name: "Baie de l'Épreuve", slot: 'berry', main: 'hpPct', base: 0, set: 'epreuve', berry: { heal: 25, cures: 'freeze' } },
  // biome 10 — Ligue Pokémon
  { id: 'gantelet-champion', name: 'Gantelet du Champion', slot: 'offense', main: 'atkPct', base: 9, set: 'champion' },
  { id: 'cape-champion', name: 'Cape du Vainqueur', slot: 'defense', main: 'defPct', base: 6.1, set: 'champion' },
  { id: 'baie-champion', name: 'Baie du Sacre', slot: 'berry', main: 'hpPct', base: 0, set: 'champion', berry: { heal: 25 } },
  // biome 11 — Route des Cieux (Johto)
  { id: 'bec-ciel', name: 'Bec Acéré', slot: 'offense', main: 'critDmgPct', base: CRIT_HYBRID_BASE.ciel, bonusCrit: true, set: 'ciel' },
  { id: 'plume-ciel', name: 'Plume Véloce', slot: 'defense', main: 'hpPct', base: 4.6 * HYBRID_MAIN_SHARE, flat: 'spePct', set: 'ciel' },
  { id: 'baie-ciel', name: 'Baie des Cieux', slot: 'berry', main: 'hpPct', base: 0, set: 'ciel', berry: { heal: 25 } },
  // biome 12 — Forêt Fourmillante (Johto)
  { id: 'mandibule-ruche', name: 'Mandibule Acérée', slot: 'offense', main: 'atkPct', base: 7, set: 'ruche' },
  { id: 'carapace-ruche', name: 'Carapace Chitineuse', slot: 'defense', main: 'defPct', base: 4.6, set: 'ruche' },
  { id: 'baie-ruche', name: 'Baie Butinée', slot: 'berry', main: 'hpPct', base: 0, set: 'ruche', berry: { heal: 25 } },
  // biome 13 — Prairies de Doré (Johto)
  { id: 'corne-prairie', name: 'Corne Robuste', slot: 'offense', main: 'critDmgPct', base: 18.3, set: 'prairie' },
  { id: 'toison-prairie', name: 'Toison Épaisse', slot: 'defense', main: 'hpPct', base: 4.6, set: 'prairie' },
  { id: 'baie-prairie', name: 'Baie des Prairies', slot: 'berry', main: 'hpPct', base: 0, set: 'prairie', berry: { heal: 25 } },
  // biome 14 — Tour Hantée (Johto)
  { id: 'griffe-brume', name: 'Griffe Spectrale', slot: 'offense', main: 'critDmgPct', base: CRIT_HYBRID_BASE.brume2, bonusCrit: true, set: 'brume2' },
  { id: 'voile-brume', name: 'Voile Brumeux', slot: 'defense', main: 'defPct', base: 4.6 * HYBRID_MAIN_SHARE, flat: 'cdrPct', set: 'brume2' },
  { id: 'baie-brume', name: 'Baie Fantomatique', slot: 'berry', main: 'hpPct', base: 0, set: 'brume2', berry: { heal: 25 } },
  // biome 15 — Dojo d'Ébène (Johto)
  { id: 'poing-dojo', name: 'Poing de Fer', slot: 'offense', main: 'critDmgPct', base: 20, set: 'dojo' },
  { id: 'ceinture-dojo', name: 'Ceinture Renforcée', slot: 'defense', main: 'defPct', base: 4.6, set: 'dojo' },
  { id: 'baie-dojo', name: 'Baie du Dojo', slot: 'berry', main: 'hpPct', base: 0, set: 'dojo', berry: { heal: 25 } },
  // biome 16 — Phare d'Olivia (Johto)
  { id: 'lame-phare', name: "Lame d'Acier", slot: 'offense', main: 'atkPct', base: 8, set: 'phare' },
  { id: 'armure-phare', name: 'Armure Polie', slot: 'defense', main: 'defPct', base: 5.3, set: 'phare' },
  { id: 'baie-phare', name: 'Baie du Phare', slot: 'berry', main: 'hpPct', base: 0, set: 'phare', berry: { heal: 25 } },
  // biome 17 — Grotte Gelée (Johto)
  { id: 'croc-givre', name: 'Croc de Glace', slot: 'offense', main: 'critDmgPct', base: CRIT_HYBRID_BASE.givre, bonusCrit: true, set: 'givre' },
  { id: 'manteau-givre', name: 'Manteau Givré', slot: 'defense', main: 'defPct', base: 4.6, set: 'givre' },
  { id: 'baie-givre', name: 'Baie Givrée', slot: 'berry', main: 'hpPct', base: 0, set: 'givre', berry: { heal: 25, cures: 'freeze' } },
  // biome 18 — Tanière des Dragons (Johto)
  { id: 'griffe-tanieres', name: 'Griffe Draconique', slot: 'offense', main: 'atkPct', base: 9, set: 'dragon2' },
  { id: 'ecaille-tanieres', name: 'Écaille Draconique', slot: 'defense', main: 'hpPct', base: 5.3, set: 'dragon2' },
  { id: 'baie-tanieres', name: 'Baie du Dragon', slot: 'berry', main: 'hpPct', base: 0, set: 'dragon2', berry: { heal: 25 } },
  // biome 19 — Grotte Sombre (Johto, Conseil des 4)
  { id: 'griffe-ombre', name: 'Griffe Sournoise', slot: 'offense', main: 'critDmgPct', base: 24.2, set: 'ombre' },
  { id: 'cape-ombre', name: "Cape d'Ombre", slot: 'defense', main: 'defPct', base: 6.1, set: 'ombre' },
  { id: 'baie-ombre', name: 'Baie Sombre', slot: 'berry', main: 'hpPct', base: 0, set: 'ombre', berry: { heal: 25 } },
  // biome 20 — Plateau Doré (Johto, Champion)
  { id: 'gantelet-plateau', name: 'Gantelet Doré', slot: 'offense', main: 'atkPct', base: 10, set: 'plateau' },
  { id: 'cape-plateau', name: 'Cape Dorée', slot: 'defense', main: 'defPct', base: 6.9, set: 'plateau' },
  { id: 'baie-plateau', name: 'Baie Dorée', slot: 'berry', main: 'hpPct', base: 0, set: 'plateau', berry: { heal: 25 } },
];

export const SETS: Record<string, {
  name: string; biome: number;
  two: { stat: NumericBonusStat; value: number; label: string }; three: { stat: NumericBonusStat; value: number; label: string };
}> = {
  sylve: {
    name: 'Tenue Sylvestre', biome: 0,
    two: { stat: 'atkPct', value: 8, label: 'Attaque +8 %' },
    three: { stat: 'lifestealPct', value: 13, label: 'Vol de vie 13 %' },
  },
  maree: {
    name: 'Marée Vivante', biome: 1,
    two: { stat: 'defPct', value: 5, label: 'Défense +5 %' },
    three: { stat: 'lifestealPct', value: 10, label: 'Vol de vie 10 %' },
  },
  circuit: {
    name: 'Circuit Survolté', biome: 2,
    two: { stat: 'spePct', value: 10, label: 'Vitesse +10 %' },
    three: { stat: 'critDmgPct', value: 17, label: 'Dégâts critiques +17 %' },
  },
  chloro: {
    name: 'Chlorophylle Ancienne', biome: 3,
    two: { stat: 'hpPct', value: 4, label: 'PV +4 %' },
    three: { stat: 'lifestealPct', value: 10, label: 'Vol de vie 10 %' },
  },
  brume: {
    name: 'Brume Toxique', biome: 4,
    two: { stat: 'lifestealPct', value: 8, label: 'Vol de vie 8 %' },
    three: { stat: 'atkPct', value: 8, label: 'Attaque +8 %' },
  },
  oeil: {
    name: 'Troisième Œil', biome: 5,
    two: { stat: 'cdrPct', value: 24, label: 'Recharge +24 %' },
    three: { stat: 'critPct', value: 22, label: 'Critique +22 %' },
  },
  cendres: {
    name: 'Cendres Ardentes', biome: 6,
    two: { stat: 'atkPct', value: 8, label: 'Attaque +8 %' },
    three: { stat: 'critPct', value: 22, label: 'Critique +22 %' },
  },
  aride: {
    name: 'Poussière Aride', biome: 7,
    two: { stat: 'defPct', value: 6, label: 'Défense +6 %' },
    three: { stat: 'hpPct', value: 5, label: 'PV +5 %' },
  },
  epreuve: {
    name: 'Épreuve du Sage', biome: 8,
    two: { stat: 'hpPct', value: 5, label: 'PV +5 %' },
    three: { stat: 'critDmgPct', value: 20, label: 'Dégâts critiques +20 %' },
  },
  champion: {
    name: 'Titre de Champion', biome: 9,
    two: { stat: 'atkPct', value: 10, label: 'Attaque +10 %' },
    three: { stat: 'typeDmgPct', value: 12, label: 'Dégâts de son type +12 %' },
  },
  ciel: {
    name: 'Ailes du Zéphyr', biome: 10,
    two: { stat: 'spePct', value: 10, label: 'Vitesse +10 %' },
    three: { stat: 'dodgePct', value: 9, label: 'Esquive +9 %' },
  },
  ruche: {
    name: 'Essaim Fourmillant', biome: 11,
    two: { stat: 'atkPct', value: 8, label: 'Attaque +8 %' },
    three: { stat: 'critPct', value: 22, label: 'Critique +22 %' },
  },
  prairie: {
    name: 'Robe des Prairies', biome: 12,
    two: { stat: 'hpPct', value: 5, label: 'PV +5 %' },
    three: { stat: 'atkPct', value: 8, label: 'Attaque +8 %' },
  },
  brume2: {
    name: 'Voile de la Tour', biome: 13,
    two: { stat: 'cdrPct', value: 24, label: 'Recharge +24 %' },
    three: { stat: 'dodgePct', value: 9, label: 'Esquive +9 %' },
  },
  dojo: {
    name: 'Tenue du Dojo', biome: 14,
    two: { stat: 'atkPct', value: 8, label: 'Attaque +8 %' },
    three: { stat: 'critDmgPct', value: 20, label: 'Dégâts critiques +20 %' },
  },
  phare: {
    name: 'Alliage du Phare', biome: 15,
    two: { stat: 'defPct', value: 6, label: 'Défense +6 %' },
    three: { stat: 'critDmgPct', value: 17, label: 'Dégâts critiques +17 %' },
  },
  givre: {
    name: 'Manteau Givré', biome: 16,
    two: { stat: 'defPct', value: 5, label: 'Défense +5 %' },
    three: { stat: 'critDmgPct', value: 17, label: 'Dégâts critiques +17 %' },
  },
  dragon2: {
    name: 'Écailles de la Tanière', biome: 17,
    two: { stat: 'atkPct', value: 9, label: 'Attaque +9 %' },
    three: { stat: 'typeDmgPct', value: 12, label: 'Dégâts de son type +12 %' },
  },
  ombre: {
    name: 'Voile des Ombres', biome: 18,
    two: { stat: 'critPct', value: 26, label: 'Critique +26 %' },
    three: { stat: 'critDmgPct', value: 20, label: 'Dégâts critiques +20 %' },
  },
  plateau: {
    name: 'Titre de Champion Johto', biome: 19,
    two: { stat: 'atkPct', value: 10, label: 'Attaque +10 %' },
    three: { stat: 'typeDmgPct', value: 12, label: 'Dégâts de son type +12 %' },
  },
};

const SUB_BASE: Record<BonusStat, number> = {
  atkPct: 3, defPct: 2.3, hpPct: 2.6, spePct: 7, critPct: 5.6, critDmgPct: 10, typeDmgPct: 5, cdrPct: 17,
};
/**
 * Sous-stats à croissance lente (`slowLvlMult`, 2026-10-01) : Vitesse et Recharge. Avant : 17,1 et 10 × `lvlMult`,
 * soit +130 % de Vitesse ou −76 % de Recharge par jet sur un Chromatique Nv.120 (aujourd'hui ~+19 % et ~+47).
 */
export const FLAT_SUBS: BonusStat[] = ['spePct', 'cdrPct'];
const subLvlMult = (stat: BonusStat, level: number) => (FLAT_SUBS.includes(stat) ? slowLvlMult(level) : lvlMult(level));

/**
 * Valeur d'un jet moyen de chaque sous-stat : décide des sous-stats que garde la fusion (`fuse`, au meilleur `subScore`),
 * sert à l'équipement Auto (3e candidat, `measuredEquipValue`) et aux couleurs des sous-stats.
 * Recalée le 2026-10-02 par l'équipe qu'on obtient vraiment (`tools/scratch/tower_meta.ts policy`) : mêmes drops de Tour
 * fusionnés avec chaque jeu de valeurs, équipe équipée par « ★ Auto », étage tenu à 50 % (6 meilleures équipes, paliers
 * +2 à +6). Un jet vaut d'autant moins qu'on a déjà beaucoup de cette stat (rendement décroissant) : un classement strict
 * fait garder les 3 mêmes sous-stats partout, qui saturent (mesuré : PV/Vitesse/Attaque d'avant, ou Type/PV/Défense,
 * 1 à 4 étages de moins). La même valeur pour les 4 meilleures (PV, Dégâts du type, Vitesse, Attaque) fait garder les
 * meilleurs jets parmi elles, donc un mélange : +2 étages environ. Puis Défense ; Dégâts critiques, Critique et Recharge
 * valent peu (le Critique se sature vite avec les panoplies Critique de fin de jeu). Valeurs voisines (±2) : même
 * résultat à 1 étage près.
 * Avant : PV 11,5, Vitesse 11,1, Attaque 10,2, Type 8,8, D.crit 7,4, Défense 6,5, Critique 4,1, Recharge 1,2 (2026-10-01,
 * gain d'un jet mesuré sur un seul équipement) ; plus tôt encore, la fusion gardait les plus gros chiffres (−8 étages).
 */
export const SUB_WORTH: Record<BonusStat, number> = {
  hpPct: 10, typeDmgPct: 10, spePct: 10, atkPct: 10, defPct: 7, critDmgPct: 5, critPct: 3, cdrPct: 3,
};
/** Seuils des couleurs des sous-stats (`subTier`) : vert (PV, Dégâts du type, Vitesse, Attaque), jaune (Défense), gris
 *  en dessous (Dégâts critiques, Critique, Recharge). */
export const SUB_TIER = { top: 9.5, good: 6.5 };

/** Jet moyen (85 %) d'une sous-stat à ce niveau : l'unité de `SUB_WORTH`. */
export function subRollRef(stat: BonusStat, level: number): number {
  return SUB_BASE[stat] * subLvlMult(stat, level) * 0.85;
}

/** Valeur d'une sous-stat (ou d'un bonus de cette stat) d'un objet de ce niveau, en points de victoire mesurés. */
export function subScore(stat: BonusStat, value: number, level: number): number {
  return (value / subRollRef(stat, level)) * SUB_WORTH[stat];
}

/** Couleur d'une sous-stat : 'top' (PV, Dégâts du type, Vitesse, Attaque), 'good' (Défense), sinon 'low' (`SUB_TIER`). */
export function subTier(stat: BonusStat): 'top' | 'good' | 'low' {
  const w = SUB_WORTH[stat];
  return w >= SUB_TIER.top ? 'top' : w >= SUB_TIER.good ? 'good' : 'low';
}

/**
 * Bonus de panoplie qui grimpent avec le niveau (2026-10-01) : 2 pièces = 1 jet moyen de sous-stat de la stat
 * (`subRollRef`) au niveau de la pièce la plus basse portée, 3 pièces = 2 jets. Vol de vie et Esquive (pas de
 * sous-stat) : la valeur de `SETS` × croissance lente (`slowLvlMult`) depuis le Nv.20, plafonnés en combat. Jamais
 * moins que la valeur fixe de `SETS` (plancher, début de partie inchangé). Avant :
 * des valeurs fixes (Attaque +8 %), qui ne valaient plus rien en fin de jeu face à un seul jet de sous-stat (+54 % au
 * Nv.200) — les équipes de Tour ne portaient plus de panoplie. Prototype `tools/scratch/proto_sets.ts` : début et milieu
 * de partie inchangés (±1 %), Tour +6 à +9 %, panoplies de nouveau portées.
 */
export const SET_ROLLS = { two: 1, three: 2 } as const;
const SUB_STAT_SET = new Set<string>(['atkPct', 'defPct', 'hpPct', 'spePct', 'critPct', 'critDmgPct', 'typeDmgPct', 'cdrPct']);
export function setBonusValue(setKey: string, part: 'two' | 'three', level: number): number {
  const p = SETS[setKey][part];
  // la valeur d'avant (`SETS`) reste un plancher : aux tout premiers niveaux, un jet de sous-stat vaut moins
  // (Attaque +2,6 % au Nv.1 contre +8 %) — le début de partie ne doit pas s'affaiblir
  const scaled = SUB_STAT_SET.has(p.stat) ? subRollRef(p.stat as BonusStat, level) * SET_ROLLS[part] : p.value * (slowLvlMult(level) / slowLvlMult(20));
  return round1(Math.max(p.value, scaled));
}
const BONUS_LABEL: Partial<Record<NumericBonusStat, string>> = { lifestealPct: 'Vol de vie', dodgePct: 'Esquive' };
/** « Attaque », « Vol de vie » : la stat d'un bonus de panoplie, sans valeur (panoplies visées de la Tour). */
export function setBonusLabel(setKey: string, part: 'two' | 'three'): string {
  const stat = SETS[setKey][part].stat;
  return SUB_STAT_SET.has(stat) ? STAT_LABEL[stat as BonusStat] : BONUS_LABEL[stat] ?? stat;
}
/** « Attaque +15 % » : bonus d'une panoplie à ce niveau (Carte, fiche d'un objet). */
export function setBonusText(setKey: string, part: 'two' | 'three', level: number): string {
  return `${setBonusLabel(setKey, part)} +${setBonusValue(setKey, part, level)} %`;
}
/** Base d'une sous-stat Vitesse / Recharge d'avant le 2026-10-01 (conversion des anciennes sauvegardes). */
export const OLD_FLAT_SUB_BASE: Partial<Record<BonusStat, number>> = { spePct: 17.1, cdrPct: 10 };

/**
 * Conversion d'une sous-stat Vitesse / Recharge d'avant le 2026-10-01 : même qualité de jet (70-100 %, crans +N
 * compris), nouvelle échelle (`slowLvlMult`). Les autres sous-stats ne changent pas.
 */
export function convertFlatSub(stat: BonusStat, value: number, level: number, plus = 0): number {
  const old = OLD_FLAT_SUB_BASE[stat];
  if (!old) return value;
  const plusMult = 1 + PLUS_SUB_STEP * plus;
  const roll = Math.min(1, Math.max(0.7, value / (old * lvlMult(level) * plusMult)));
  return round1(SUB_BASE[stat] * slowLvlMult(level) * roll * plusMult);
}
const SUB_POOL: BonusStat[] = ['atkPct', 'defPct', 'hpPct', 'spePct', 'critPct', 'critDmgPct', 'typeDmgPct', 'cdrPct'];

export const STAT_LABEL: Record<BonusStat, string> = {
  atkPct: 'Attaque', defPct: 'Défense', hpPct: 'PV', spePct: 'Vitesse', critPct: 'Critique',
  critDmgPct: 'Dégâts critiques', typeDmgPct: 'Dégâts de son type', cdrPct: 'Recharge',
};

/** « Attaque +12 % », « Recharge +30 % » (depuis le 2026-10-01, la Recharge n'est plus une réduction plafonnée). */
/** « Attaque +106.2 % » : au dixième (les sous-stats sont gardées à 3 décimales, voir `roundSub`). */
export function statText(stat: BonusStat, value: number): string {
  return `${STAT_LABEL[stat]} +${round1(value)} %`;
}

export function template(id: string): ItemTemplate {
  const t = TEMPLATES.find((x) => x.id === id);
  if (!t) throw new Error(`Objet inconnu : ${id}`);
  return t;
}

const lvlMult = (level: number) => 1 + 0.08 * (level - 1);
/** Croissance lente avec le niveau (Vitesse, Recharge) : racine de `lvlMult` (×1 au Nv.1, ×2,4 au Nv.62, ×3,2 au Nv.120). */
const slowLvlMult = (level: number) => Math.sqrt(lvlMult(level));
const round1 = (v: number) => Math.round(v * 10) / 10;
/**
 * Arrondi des sous-stats en mémoire : 3 décimales (2026-10-02) ; l'affichage reste au dixième (`statText`). Avant,
 * chaque amélioration arrondissait au dixième et les arrondis s'accumulaient : jusqu'à 33 points de jet décalés de
 * Nv.1 à 300, ~100 à Nv.1 000 (la Vitesse, qui grimpe lentement, montait trop vite puis restait bloquée) ; ici 0,25
 * au pire jusqu'à Nv.1 500 (`tools/scratch/sub_drift4.ts`).
 */
const roundSub = (v: number) => Math.round(v * 1000) / 1000;

/** Chance de critique fixe d'un objet Critique mixte (0 pour les autres). */
export function bonusCritValue(item: Item): number {
  return template(item.templateId).bonusCrit ? CRIT_BY_RARITY[item.rarity] : 0;
}

/** Bonus fixe d'un objet mixte Vitesse / Recharge (`null` pour les autres). */
export function flatBonus(item: Item): { stat: 'spePct' | 'cdrPct'; value: number } | null {
  const t = template(item.templateId);
  return t.flat ? { stat: t.flat, value: round1(FLAT_HYBRID_BASE[t.flat] * slowLvlMult(item.level) * rarityMult(item)) } : null;
}

/** Stats exclues des secondaires d'un objet : sa stat principale (et le bonus fixe d'un objet mixte). */
function mainStats(t: ItemTemplate): BonusStat[] {
  return t.bonusCrit ? [t.main, 'critPct'] : t.flat ? [t.main, t.flat] : [t.main];
}

/**
 * Chromatique +N (fin de jeu) : chaque cran ajoute 0,2 au multiplicateur de rareté de la stat principale (×2,4 → ×2,6,
 * ≈ +8 %) et 10 % aux secondaires. Pas de plafond : un +N coûte 3^N Chromatiques, la fusion est le puits sans fond.
 */
export const PLUS_MAIN_STEP = 0.2;
export const PLUS_SUB_STEP = 0.1;

export function plusOf(item: Item): number {
  return item.plus ?? 0;
}

/** Multiplicateur de rareté de la stat principale, crans Chromatique +N compris. */
export function rarityMult(item: Item): number {
  return RARITY_MULT[item.rarity] + PLUS_MAIN_STEP * plusOf(item);
}

/** « Légendaire », « Chromatique », « Chromatique +2 ». */
export function rarityName(item: Item): string {
  return plusOf(item) ? `${RARITIES[item.rarity]} +${plusOf(item)}` : RARITIES[item.rarity];
}

/** Valeur de la stat principale. Baies : leurs PV au-delà du soin plafonné (`berryHpPct`), 0 sinon (elles agissent
 *  en combat). */
export function mainValue(item: Item): number {
  const t = template(item.templateId);
  if (t.berry) return berryHpPct(item);
  return round1(t.base * (item.tier ?? 1) * lvlMult(item.level) * rarityMult(item));
}

/**
 * Soin des baies plafonné à 100 % des PV (2026-10-07, demande d'Arno : soigner au-delà ne sert à rien), atteint en
 * Chromatique +8 (25 % × 4,0). Chaque cran au-delà donne des PV % (`berryHpPct`, la stat principale déclarée des baies),
 * autant qu'un cran sur un objet défensif PV de la Tour : base `BERRY_HP_BASE` (= `START_SCORE.defense` au dernier
 * biome, ÷ poids des PV ≈ 8,45) × niveau × 0,2 par cran au-delà du plafond. Baie Nv.1 300 +17 : ~+1 600 % de PV.
 */
export const BERRY_HEAL_CAP = 100;

/** Soin d'une baie en % des PV (augmente avec la rareté, plafonné à `BERRY_HEAL_CAP`). */
export function berryHeal(item: Item): number {
  const t = template(item.templateId);
  return t.berry?.heal ? Math.min(BERRY_HEAL_CAP, Math.round(t.berry.heal * rarityMult(item))) : 0;
}

/** PV % d'une baie dont le soin dépasserait le plafond : la part du multiplicateur de rareté au-delà du plafond. */
export function berryHpPct(item: Item): number {
  const t = template(item.templateId);
  if (!t.berry?.heal) return 0;
  const over = rarityMult(item) - BERRY_HEAL_CAP / t.berry.heal;
  return over > 1e-9 ? round1(BERRY_HP_BASE * lvlMult(item.level) * over) : 0;
}

/** Qualité d'un jet de sous-stat, en % du maximum : 70 à 100 % au butin et à la fusion. */
export const SUB_ROLL_MIN = 70;
/**
 * « Changer une sous-stat » (2026-10-02, demande d'Arno) : le nouveau jet tombe entre 85 et 100 % du maximum, pour ne
 * plus jeter autant d'objets après un mauvais tirage. Le butin et la fusion restent à 70-100 %.
 */
export const REROLL_ROLL_MIN = 85;

/** Jet maximum (100 %) d'une sous-stat à ce niveau et à ce cran Chromatique +N (+10 % par cran). */
export function subMax(stat: BonusStat, level: number, plus = 0): number {
  return SUB_BASE[stat] * subLvlMult(stat, level) * (1 + PLUS_SUB_STEP * plus);
}

/** Une sous-stat ramenée dans sa fourchette (jet de 70 à 100 % à ce niveau et à ce cran), à 3 décimales (`roundSub`) :
 *  après une amélioration, une fusion ou un cran +N, elle n'en sort jamais (2026-10-02). */
export function clampSub(stat: BonusStat, level: number, plus: number, value: number): number {
  const max = subMax(stat, level, plus);
  return roundSub(Math.min(max, Math.max((max * SUB_ROLL_MIN) / 100, value)));
}

/**
 * Fourchette d'une sous-stat à ce niveau et à ce cran : jet minimum (70 %) et maximum (100 %), affichée dans la fiche
 * d'un objet. Les améliorations multiplient tout pareil : la place d'une sous-stat dans sa fourchette ne bouge jamais.
 */
export function subRange(stat: BonusStat, level: number, plus = 0): { min: number; max: number } {
  const max = subMax(stat, level, plus);
  return { min: round1((max * SUB_ROLL_MIN) / 100), max: round1(max) };
}

/** `plus` : cran Chromatique +N (+10 % par cran ; avant le 2026-10-02, un changement de sous-stat sur un +N l'oubliait). */
function rollSub(rng: Rng, level: number, exclude: BonusStat[], plus = 0, minRoll = SUB_ROLL_MIN): { stat: BonusStat; value: number } {
  const pool = SUB_POOL.filter((s) => !exclude.includes(s));
  const stat = pool[rng.int(pool.length)];
  const roll = minRoll / 100 + rng.int(101 - minRoll) / 100; // 70–100 % (85–100 % pour un changement de sous-stat)
  return { stat, value: roundSub(subMax(stat, level, plus) * roll) };
}

let seq = 0;
export function newUid(prefix: string) {
  seq = (seq + 1) % 1e6;
  return `${prefix}${Date.now().toString(36)}${seq.toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
}

export function makeItem(templateId: string, rarity: number, level: number, rng: Rng, biome?: number): Item {
  const t = template(templateId);
  const subs: Item['subs'] = [];
  for (let i = 0; i < RARITY_SUBS[rarity]; i++) subs.push(rollSub(rng, level, [...mainStats(t), ...subs.map((s) => s.stat)]));
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
  // objet mixte Vitesse / Recharge : sa stat principale ne porte qu'une part de sa valeur (le reste : bonus fixe)
  const target = (START_SCORE[t.slot] ?? t.base * STAT_WEIGHT[t.main]) * (1 + REGION_SLOPE * pos) * (t.flat ? HYBRID_MAIN_SHARE : 1);
  return Math.round((target / (t.base * STAT_WEIGHT[t.main])) * 1000) / 1000;
}

/** Part du coût d'un niveau d'amélioration que vaut au moins un objet recyclé (`recycleBase`). */
export const RECYCLE_UPGRADE_SHARE = 0.1;
/** Part des éclats dépensés en améliorations manuelles (`Item.invested`) rendue au recyclage. */
export const RECYCLE_REFUND_SHARE = 0.5;

/**
 * Valeur de recyclage de l'objet lui-même : la plus grande entre l'ancienne formule (rareté et niveau) et 10 % du coût
 * d'un niveau d'amélioration (2026-10-01 : un Chromatique Nv.200 rendait 298 éclats, à peine 4 % d'une amélioration ;
 * aujourd'hui 700). Début de partie inchangé : l'ancienne formule y reste la plus grande.
 */
export function recycleBase(item: Item): number {
  const r = item.rarity + 1 + plusOf(item);
  return Math.max(2 * r * r + item.level, Math.round(upgradeCost(item) * RECYCLE_UPGRADE_SHARE));
}

/** Éclats rendus au recyclage pour les améliorations faites à la main : 50 % de `Item.invested`. */
export function recycleRefund(item: Item): number {
  return Math.floor((item.invested ?? 0) * RECYCLE_REFUND_SHARE);
}

/** Éclats obtenus en recyclant : valeur de l'objet + remboursement des améliorations manuelles. */
export function recycleValue(item: Item): number {
  return recycleBase(item) + recycleRefund(item);
}

/** Coût en éclats pour monter l'objet d'un niveau. */
export function upgradeCost(item: Item): number {
  return 5 * item.level * (item.rarity + 1 + plusOf(item));
}

/** Coût de `n` niveaux d'amélioration d'affilée (fenêtre « Améliorer » : +10). */
export function upgradeCostFor(item: Item, n: number): number {
  let cost = 0;
  for (let i = 0; i < n; i++) cost += upgradeCost({ ...item, level: item.level + i });
  return cost;
}

/** Niveau maximum d'un objet (comme les Pokémon) : au-delà, l'amélioration est bloquée — sauf en fin de jeu
 * (`itemLevelCap` dans `game.ts`). */
export const MAX_ITEM_LEVEL = 100;

export function upgrade(item: Item): Item {
  const level = item.level + 1;
  const scale = (stat: BonusStat) => subLvlMult(stat, level) / subLvlMult(stat, item.level);
  // 3 décimales et bornée à sa fourchette : plus de dérive par arrondis successifs (`roundSub`, `clampSub`)
  return { ...item, level, subs: item.subs.map((s) => ({ ...s, value: clampSub(s.stat, level, plusOf(item), s.value * scale(s.stat)) })) };
}

export function rerollCost(item: Item): number {
  return 20 * (item.rarity + 1);
}

export function rerollSub(item: Item, index: number, rng: Rng): Item {
  const t = template(item.templateId);
  const others = item.subs.filter((_, i) => i !== index).map((s) => s.stat);
  const subs = item.subs.slice();
  subs[index] = rollSub(rng, item.level, [...mainStats(t), ...others], plusOf(item), REROLL_ROLL_MIN);
  return { ...item, subs };
}

/**
 * Fusion 3 → 1 : trois objets identiques (même objet, même rareté, même cran +N) → rareté suivante. Chromatique :
 * seulement en fin de jeu (`endgame`), vers Chromatique +N+1.
 */
export function canFuse(items: Item[], endgame = false): boolean {
  return items.length === 3
    && new Set(items.map((i) => i.uid)).size === 3
    && items.every((i) => i.templateId === items[0].templateId && i.rarity === items[0].rarity && plusOf(i) === plusOf(items[0]))
    && (items[0].rarity < MAX_RARITY || endgame);
}

export function fuse(items: Item[], rng: Rng, endgame = false): Item {
  if (!canFuse(items, endgame)) throw new Error('Fusion impossible');
  const ascend = items[0].rarity === MAX_RARITY; // Chromatique +N → +N+1 (la rareté ne bouge plus)
  const rarity = ascend ? MAX_RARITY : items[0].rarity + 1;
  const plus = ascend ? plusOf(items[0]) + 1 : 0;
  // secondaires d'un cran de plus : +10 % (par rapport au cran d'origine)
  const subScale = ascend ? (1 + PLUS_SUB_STEP * plus) / (1 + PLUS_SUB_STEP * (plus - 1)) : 1;
  const level = Math.max(...items.map((i) => i.level));
  const t = template(items[0].templateId);
  // garde les meilleurs bonus existants (par valeur mesurée, `subScore`, pas par la taille du chiffre), complète
  // jusqu'au nombre de la rareté. Chaque sous-stat est d'abord remise au niveau de l'objet obtenu, comme par une
  // amélioration (`upgrade`) : avant le 2026-10-02, une sous-stat venue d'une pièce plus basse gardait sa petite valeur
  // (sous le jet minimum de l'objet fusionné)
  const best = new Map<BonusStat, number>();
  for (const it of items) {
    for (const s of it.subs) {
      const atLevel = s.value * (subLvlMult(s.stat, level) / subLvlMult(s.stat, it.level));
      best.set(s.stat, Math.max(best.get(s.stat) ?? 0, atLevel));
    }
  }
  const subs = [...best.entries()].sort((a, b) => subScore(b[0], b[1], level) - subScore(a[0], a[1], level)).slice(0, RARITY_SUBS[rarity])
    .map(([stat, value]) => ({ stat, value: clampSub(stat, level, plus, value * subScale) }));
  while (subs.length < RARITY_SUBS[rarity]) subs.push(rollSub(rng, level, [...mainStats(t), ...subs.map((s) => s.stat)], plus));
  const tier = Math.max(...items.map((i) => i.tier ?? 1));
  const out: Item = { uid: newUid('i'), templateId: t.id, rarity, level, subs };
  if (tier !== 1) out.tier = tier;
  if (plus) out.plus = plus;
  // les éclats investis dans les 3 objets suivent l'objet obtenu (remboursés à moitié s'il est recyclé un jour)
  const invested = items.reduce((a, i) => a + (i.invested ?? 0), 0);
  if (invested > 0) out.invested = invested;
  // un objet verrouillé 🔒 fusionné (depuis sa fiche) transmet son cadenas : avant le 2026-10-01, le résultat le perdait
  if (items.some((i) => i.locked)) out.locked = true;
  return out;
}

/**
 * Panoplies portées par un Pokémon : nombre de pièces et niveau de la pièce la plus basse, qui fixe la valeur des bonus
 * (combat, fiche Pokémon, fiche d'un objet, sélecteur d'objet).
 */
export function wornSets(held: Item[]): Map<string, { count: number; level: number }> {
  const out = new Map<string, { count: number; level: number }>();
  for (const it of held) {
    const set = template(it.templateId).set;
    if (!set) continue;
    const cur = out.get(set);
    out.set(set, { count: (cur?.count ?? 0) + 1, level: Math.min(cur?.level ?? Infinity, it.level) });
  }
  return out;
}

/** Ajoute les bonus d'objets tenus (stat principale, secondaires, panoplie). */
export function addItemBonuses(b: BattleBonuses, held: Item[]) {
  for (const it of held) {
    const t = template(it.templateId);
    if (t.base > 0 || t.berry) b[t.main] += mainValue(it);
    b.critPct += bonusCritValue(it);
    const flat = flatBonus(it);
    if (flat) b[flat.stat] += flat.value;
    for (const s of it.subs) b[s.stat] += s.value;
  }
  for (const [id, { count, level }] of wornSets(held)) {
    const set = SETS[id];
    if (!set) continue;
    if (count >= 2) b[set.two.stat] += setBonusValue(id, 'two', level);
    if (count >= 3) b[set.three.stat] += setBonusValue(id, 'three', level);
  }
}

/**
 * Poids relatif de chaque stat (Attaque = 1), **mesuré** en combats 3 contre 3 le 2026-09-24 (+20 points sur toute une
 * équipe, voir `AUDIT_EQUILIBRAGE.md`). Sert à calibrer la puissance des objets (`base`, `SUB_BASE`, `biomeTier`) ;
 * les Dégâts critiques y valent leur valeur dans un build à ~35 % de Critique. Pour comparer des équipements, préférer
 * `combatValue` (modèle multiplicatif où Critique et Dégâts critiques se renforcent).
 */
export const STAT_WEIGHT: Record<NumericBonusStat, number> = {
  // Vitesse et Recharge : mesurées à nouveau le 2026-10-01 (cadence, Recharge sans plafond), à faible dose
  atkPct: 1, defPct: 1.05, hpPct: 1.06, spePct: 0.9, critPct: 0.54, critDmgPct: 0.3, typeDmgPct: 0.64, cdrPct: 0.37,
  lifestealPct: 0.73, dodgePct: 1.34,
};

/** Base des PV % d'une baie au-delà du soin plafonné : celle d'un objet défensif PV du dernier biome (`biomeTier`),
 *  comme les objets de la Tour (≈ 8,45). */
const BERRY_HP_BASE = (START_SCORE.defense! * (1 + REGION_SLOPE)) / STAT_WEIGHT.hpPct;

/**
 * Valeur de combat d'un ensemble de bonus, en « % d'Attaque équivalent » (modèle multiplicatif calé sur les mesures
 * 3 contre 3). Critique et Dégâts critiques y sont liés : le gain d'un critique = chance × (0,5 + dégâts critiques),
 * donc des Dégâts critiques ne valent presque rien sans Critique, et beaucoup avec. Recharge et Vitesse (cadence) :
 * sans plafond, à rendement décroissant, comme en combat.
 */
export function combatValue(b: BattleBonuses): number {
  const crit = Math.min(1, (6 + b.critPct) / 100);
  const critDmg = b.critDmgPct + critOverflow(6 + b.critPct); // surplus au-delà de 100 % converti, comme en combat
  const dodge = Math.min(0.5, b.dodgePct / 100); // plafonds du combat (`DODGE_CAP`, `LIFESTEAL_CAP`)
  const f = (1 + b.atkPct / 100) * (1 + b.hpPct / 100) * (1 + b.defPct / 100)
    * ((1 + crit * (0.5 + critDmg / 100)) / 1.03)
    * (1 + (0.64 * b.typeDmgPct) / 100)
    * Math.pow(1 / (1 - dodge), 1.1)
    * (1 + (0.73 * Math.min(50, b.lifestealPct)) / 100)
    // Recharge et Vitesse (cadence) sans plafond, à rendement décroissant, calées le 2026-10-01
    // (`tools/scratch/calib_speed.ts` : +15 % de Vitesse ≈ +13 % d'Attaque, +30 de Recharge ≈ +11 %, en moyenne)
    * (1 + (40 * Math.log(1 + Math.max(0, b.cdrPct) / 100)) / 100)
    * (1 + (250 * Math.log(1 + Math.max(0, b.spePct) / 350)) / 100);
  return (f - 1) * 100;
}

/** Score d'une baie (soin, rareté, PV au-delà du soin plafonné) : les baies se comparent entre elles, pas aux autres
 *  objets. */
export function berryScore(item: Item): number {
  return (berryHeal(item) || 20) + item.level + item.rarity * 10 + berryHpPct(item);
}

/** Valeur d'un objet seul (tri du sac, comparaison hors contexte d'un Pokémon). */
export function itemScore(item: Item): number {
  const t = template(item.templateId);
  if (t.berry) return berryScore(item);
  const b = emptyBonuses();
  addItemBonuses(b, [item]);
  return combatValue(b);
}

export function slotOf(item: Item): ItemSlot {
  return template(item.templateId).slot;
}
