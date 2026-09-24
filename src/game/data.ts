import movesRaw from '../data/moves.json';
import speciesRaw from '../data/species.json';
import typesRaw from '../data/types.json';

export type PType =
  | 'normal' | 'fighting' | 'flying' | 'poison' | 'ground' | 'rock' | 'bug' | 'ghost'
  | 'fire' | 'water' | 'grass' | 'electric' | 'psychic' | 'ice' | 'dragon' | 'steel' | 'dark';
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

/**
 * Bébés reliés à leur forme adulte (dans les jeux d'origine : évolution par bonheur, absente ici → par niveau).
 * Appliqué au chargement plutôt que dans `species.json`, qui est régénéré par les scripts `tools/gen_data*.py`.
 * Les cibles sont toutes d'une génération antérieure ou égale : jamais une évolution qui « fuirait » vers une
 * région pas encore débloquée. [bébé, adulte, niveau]
 */
export const BABY_EVOLUTIONS: [number, number, number][] = [
  [172, 25, 15], // Pichu → Pikachu
  [173, 35, 15], // Mélo → Mélofée
  [174, 39, 15], // Toudoudou → Rondoudou
  [238, 124, 30], // Lippouti → Lippoutou
  [239, 125, 30], // Élekid → Élektek
  [240, 126, 30], // Magby → Magmar
  [298, 183, 15], // Azurill → Marill
  [360, 202, 15], // Okéoké → Qulbutoké
  [406, 315, 15], // Rozbouton → Rosélia
  [433, 358, 20], // Korillon → Éoko
  [438, 185, 20], // Manzaï → Simularbre
  [439, 122, 20], // Mime Jr. → M. Mime
  [440, 113, 20], // Ptiravi → Leveinard
  [446, 143, 35], // Goinfrex → Ronflex
  [458, 226, 20], // Babimanta → Démanta
];
for (const [baby, adult, level] of BABY_EVOLUTIONS) {
  const sp = SPECIES.find((x) => x.id === baby);
  if (sp && !sp.evolvesTo) { sp.evolvesTo = adult; sp.evolveLevel = level; }
}

/**
 * Évolutions à choix (pas de pierres d'évolution dans le jeu : c'est le joueur qui choisit). Clé = espèce
 * qui évolue, valeur = toutes les formes possibles, la 1re étant `evolvesTo` (évolution par défaut, utilisée
 * par les automatismes : bot, « Compléter le Pokédex »). Les formes alternatives restent des espèces à part
 * entière (sauvages ou non selon les biomes) — voir `evolve(s, uid, target)` dans `game.ts`.
 */
export const EVOLUTION_CHOICES: Record<number, number[]> = {
  44: [45, 182], // Ortide → Rafflesia / Joliflor
  61: [62, 186], // Têtarte → Tartard / Tarpaud
  79: [80, 199], // Ramoloss → Flagadoss / Roigada
  133: [134, 135, 136, 196, 197, 470, 471], // Évoli → Aquali, Voltali, Pyroli, Mentali, Noctali, Phyllali, Givrali
  236: [237, 106, 107], // Debugant → Kapoera / Kicklee / Tygnon
  265: [266, 268], // Chenipotte → Armulys / Blindalys
  281: [282, 475], // Kirlia → Gardevoir / Gallame
  290: [291, 292], // Ningale → Ninjask / Munja
  361: [362, 478], // Stalgamin → Oniglali / Momartik
  366: [367, 368], // Coquiperl → Serpang / Rosabyss
  412: [413, 414], // Cheniti → Cheniselle / Papilord
};

/**
 * Formes vers lesquelles l'espèce peut évoluer (vide si elle n'évolue pas). `dexMax` = dernière espèce de la
 * région en cours : une forme d'une région future n'est jamais proposée (Évoli ne donne pas Phyllali à Kanto).
 */
export function evolutionTargets(id: number, dexMax = Infinity): number[] {
  const all = EVOLUTION_CHOICES[id] ?? (species(id).evolvesTo ? [species(id).evolvesTo] : []);
  const ok = all.filter((t) => t <= dexMax);
  return ok.length ? ok : all.slice(0, 1);
}
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

/** Attaque de base : puissance 40. Type Normal purement indicatif — `battle.ts` la traite comme
 * neutre partout (jamais de STAB, jamais 0/×2 via la table des types) : un vrai filet de sécurité qui
 * ne doit jamais totalement whiffer selon le matchup (testé : lier son type au Pokémon semblait plus
 * thématique mais cassait l'équilibrage dès le tout début de partie, quand l'attaque de base est encore
 * très utilisée faute d'assez de capacités apprises). */
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
