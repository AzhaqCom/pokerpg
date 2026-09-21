import movesRaw from '../data/moves.json';
import speciesRaw from '../data/species.json';
import typesRaw from '../data/types.json';

export type PType =
  | 'normal' | 'fighting' | 'flying' | 'poison' | 'ground' | 'rock' | 'bug' | 'ghost'
  | 'fire' | 'water' | 'grass' | 'electric' | 'psychic' | 'ice' | 'dragon';
export type Ailment = 'burn' | 'poison' | 'paralysis' | 'sleep' | 'freeze';
export type StatKey = 'hp' | 'atk' | 'def' | 'spe';

export interface Species {
  id: number;
  name: string;
  types: PType[];
  base: Record<StatKey, number>;
  evolvesTo: number;
  evolveLevel: number;
  /** [niveau, id de capacité] */
  learnset: [number, number][];
}

interface MoveBase { id: number; slug: string; name: string; type: PType; cd: number; aoe: boolean }
export type Move =
  | (MoveBase & { kind: 'damage'; power: number; ailment?: Ailment; chance?: number; drain?: number;
      stat?: { stat: 'atk' | 'def' | 'spe'; stages: number; self: boolean; chance: number } })
  | (MoveBase & { kind: 'status'; ailment: Ailment; chance: number })
  | (MoveBase & { kind: 'heal'; heal: number })
  | (MoveBase & { kind: 'buff' | 'debuff'; stat: 'atk' | 'def' | 'spe'; stages: number });

const SPECIES = speciesRaw as Species[];
const MOVES = movesRaw as unknown as Record<string, Move>;
const CHART = typesRaw.chart as Record<string, Record<string, number>>;
export const TYPE_NAME = typesRaw.names as Record<PType, string>;

export function species(id: number): Species {
  const s = SPECIES[id - 1];
  if (!s) throw new Error(`Espèce inconnue : ${id}`);
  return s;
}
export const ALL_SPECIES: readonly Species[] = SPECIES;

export function move(id: number): Move {
  const m = MOVES[String(id)];
  if (!m) throw new Error(`Capacité inconnue : ${id}`);
  return m;
}

/** Attaque de base : puissance 40, type Normal (neutre partout sauf Roche/Spectre). */
export function basicAttack(): Move {
  return { id: 0, slug: 'basic', name: 'Attaque', type: 'normal', cd: 1.5, aoe: false, kind: 'damage', power: 40 };
}

/** Multiplicateur de type (×4 … ×0) contre les 1 ou 2 types de la cible. */
export function typeMultiplier(atk: PType, def: PType[]): number {
  return def.reduce((m, d) => m * (CHART[atk]?.[d] ?? 1), 1);
}

/** Capacités connues à un niveau (les 4 dernières apprises, comme les jeux). */
export function movesAtLevel(sp: Species, level: number): number[] {
  const known = sp.learnset.filter(([lv]) => lv <= level).map(([, id]) => id);
  return known.slice(-4);
}

/** Toutes les capacités apprises jusqu'à ce niveau (choix du joueur). */
export function learnedMoves(sp: Species, level: number): number[] {
  return sp.learnset.filter(([lv]) => lv <= level).map(([, id]) => id);
}
