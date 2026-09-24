import { PType, StatKey } from './data';

/** Un Pokémon possédé par le joueur (ou un sauvage généré). */
export interface Mon {
  uid: string;
  speciesId: number;
  level: number;
  /** expérience accumulée depuis le niveau 1 */
  xp: number;
  /** gènes 0–15 par stat, tirés à la capture */
  genes: Record<StatKey, number>;
  shiny: boolean;
  /** capacités équipées, dans l'ordre de priorité (4 max) */
  moves: number[];
  /** rangs de talents : id du talent → rang */
  talents: Record<string, number>;
  /** type choisi pour un talent « au choix » (palier 4/5) : id du talent → type, figé au 1er rang */
  talentTypeChoices: Record<string, PType>;
  /** objets tenus : emplacement → uid d'objet */
  items: Partial<Record<ItemSlot, string>>;
}

// ---------------------------------------------------------------- objets
export type ItemSlot = 'offense' | 'defense' | 'berry';
/** Stats que portent les objets (en %) */
export type BonusStat = 'atkPct' | 'defPct' | 'hpPct' | 'spePct' | 'critPct' | 'critDmgPct' | 'typeDmgPct' | 'cdrPct';
/** Tout champ numérique de `BattleBonuses` (les objets, talents et auras y écrivent) — exclut `affinities`, un tableau. */
export type NumericBonusStat = Exclude<keyof BattleBonuses, 'affinities'>;

export const RARITIES = ['Commun', 'Peu commun', 'Rare', 'Épique', 'Légendaire', 'Mythique', 'Chromatique'] as const;
export const RARITY_COLOR = ['#9aa0a6', '#4caf50', '#3d8bfd', '#a259ff', '#ff9800', '#e53935', '#ff5ec4'];
/** multiplicateur de la stat principale par rareté : 0-3 inchangés (jeu tôt/moyen déjà équilibré),
 * seul le sommet (Légendaire/Mythique/Chromatique) est compressé pour freiner l'explosion de fin de
 * partie sans toucher au reste de la courbe. */
export const RARITY_MULT = [1, 1.25, 1.5, 1.8, 2.0, 2.2, 2.4];
/** nombre de bonus secondaires par rareté */
export const RARITY_SUBS = [0, 1, 1, 2, 2, 3, 3];
export const MAX_RARITY = RARITIES.length - 1;

export interface ItemTemplate {
  id: string;
  name: string;
  slot: ItemSlot;
  main: BonusStat;
  /** valeur de la stat principale au niveau 1, rareté Commun */
  base: number;
  /** panoplie éventuelle */
  set?: string;
  /** baies : soin en % des PV sous 30 %, ou statut soigné */
  berry?: { heal?: number; cures?: string };
}

export interface Item {
  uid: string;
  templateId: string;
  rarity: number;
  level: number;
  subs: { stat: BonusStat; value: number }[];
  locked?: boolean;
  /** facteur de puissance de la stat principale (objet réutilisé hors de sa région, voir `biomeTier`), 1 si absent */
  tier?: number;
}

export interface BattleBonuses {
  atkPct: number; defPct: number; hpPct: number; spePct: number;
  critPct: number; critDmgPct: number; typeDmgPct: number; cdrPct: number;
  /** effets de talents */
  dmgVsStatusPct: number;
  ailmentChancePct: number;
  lifestealPct: number;
  basicDmgPct: number;
  aoeDmgPct: number;
  dodgePct: number;
  /** talents « au choix » (palier 4/5) : +pct % de dégâts sur les capacités du type choisi */
  affinities: { type: PType; pct: number }[];
}

export function emptyBonuses(): BattleBonuses {
  return {
    atkPct: 0, defPct: 0, hpPct: 0, spePct: 0, critPct: 0, critDmgPct: 0, typeDmgPct: 0, cdrPct: 0,
    dmgVsStatusPct: 0, ailmentChancePct: 0, lifestealPct: 0, basicDmgPct: 0, aoeDmgPct: 0, dodgePct: 0,
    affinities: [],
  };
}

export type TypeKey = PType;
