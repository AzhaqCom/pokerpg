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
/**
 * Évolutions ajoutées par une génération suivante à une espèce plus ancienne (Onix → Steelix, Magnéton →
 * Magnézone…). Même mécanisme que les bébés. Une région dont le Pokédex n'inclut pas encore la cible n'y a pas
 * accès : `evolutionTargets(id, dexMax)` ne la propose pas, donc `canEvolve`/`evolve` restent bloqués
 * (Magnéton est une forme finale à Kanto, pas à Sinnoh). [espèce, évolution, niveau]
 */
export const CROSS_GEN_EVOLUTIONS: [number, number, number][] = [
  [42, 169, 40], // Nosferalto → Nostenfer
  [95, 208, 40], // Onix → Steelix
  [123, 212, 40], // Insécateur → Cizayox
  [117, 230, 45], // Hypocéan → Hyporoi
  [137, 233, 30], // Porygon → Porygon2
  [233, 474, 50], // Porygon2 → Porygon-Z
  [113, 242, 40], // Leveinard → Leuphorie
  [315, 407, 35], // Rosélia → Roserade
  [190, 424, 32], // Capumain → Capidextre
  [200, 429, 35], // Feuforêve → Magirêve
  [198, 430, 35], // Cornèbre → Corboss
  [215, 461, 40], // Farfuret → Dimoret
  [82, 462, 45], // Magnéton → Magnézone
  [108, 463, 33], // Excelangue → Coudlangue
  [112, 464, 55], // Rhinoféros → Rhinastoc
  [114, 465, 33], // Saquedeneu → Bouldeneu
  [125, 466, 45], // Élektek → Élekable
  [126, 467, 45], // Magmar → Maganon
  [176, 468, 40], // Togetic → Togekiss
  [193, 469, 33], // Yanma → Yanmega
  [207, 472, 40], // Scorplane → Scorvol
  [221, 473, 45], // Cochignon → Mammochon
  [299, 476, 40], // Tarinor → Tarinorme
  [356, 477, 50], // Téraclope → Noctunoir
];
for (const [baby, adult, level] of [...BABY_EVOLUTIONS, ...CROSS_GEN_EVOLUTIONS]) {
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
 * région en cours : une forme d'une région future n'est jamais proposée (Évoli ne donne pas Phyllali à Kanto,
 * Magnéton n'évolue pas du tout à Kanto : liste vide).
 */
export function evolutionTargets(id: number, dexMax = Infinity): number[] {
  const all = EVOLUTION_CHOICES[id] ?? (species(id).evolvesTo ? [species(id).evolvesTo] : []);
  return all.filter((t) => t <= dexMax);
}
const MOVES = movesRaw as unknown as Record<string, Move>;

/**
 * Corrections de capacités mal converties depuis PokéAPI (appliquées au chargement : `moves.json` est généré).
 * Baston : puissance variable dans les jeux (convertie à 300). Explosion/Destruction : le lanceur n'est pas mis K.O.
 * dans ce moteur, donc sans contrepartie → ramenées au niveau d'une grosse attaque ordinaire.
 */
const MOVE_FIXES: Record<string, { power: number; cd: number }> = {
  'beat-up': { power: 60, cd: 4 },
  explosion: { power: 130, cd: 12 },
  'self-destruct': { power: 110, cd: 11 },
};
for (const m of Object.values(MOVES)) {
  const fix = MOVE_FIXES[m.slug];
  if (fix && m.kind === 'damage') { m.power = fix.power; m.cd = fix.cd; }
}
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
/**
 * Pokémon dont les capacités d'origine ne sont pas gérées par ce moteur (Morphing, Gribouille, Téléport, Cadeau,
 * Riposte/Voile Miroir…) : ils reçoivent en plus un kit classique de leur type, appris par niveau, pour être des
 * Pokémon « normaux ». [espèce, [niveau, capacité][]]
 */
const LEARNSET_ADDITIONS: [number, [number, number][]][] = [
  [63, [[1, 93]]], // Abra : Choc Mental
  [132, [[1, 33], [10, 98], [20, 29], [30, 129], [40, 34], [50, 36], [60, 38]]], // Métamorph : Charge → Damoclès
  [175, [[1, 1]]], // Togepi : Écras'Face
  [201, [[1, 93], [15, 60], [25, 246], [35, 326], [45, 94]]], // Zarbi : Choc Mental → Psyko
  [202, [[1, 93], [15, 60], [30, 326], [40, 94]]], // Qulbutoké : attaques Psy
  [360, [[1, 93]]], // Okéoké : Choc Mental
  [225, [[1, 181], [10, 64], [20, 196], [30, 17], [40, 65], [50, 58], [60, 59]]], // Cadoizo : Glace et Vol
  [235, [[1, 10], [5, 98], [15, 154], [25, 163], [35, 332], [45, 34], [55, 247]]], // Queulorior : kit varié (esprit Gribouille)
];
for (const [id, extra] of LEARNSET_ADDITIONS) {
  const sp = SPECIES.find((x) => x.id === id);
  if (sp) sp.learnset = [...sp.learnset, ...extra].sort((a, b) => a[0] - b[0]);
}
/** Munja : 1 PV dans les jeux (compensé par Garde Mystik, non codée ici) → un Pokémon fragile mais jouable. */
const shedinja = SPECIES.find((x) => x.id === 292);
if (shedinja && shedinja.base.hp === 1) shedinja.base.hp = 40;

/** Pré-évolution directe (évolution classique, à choix, bébé ou inter-générations). */
const PREV = new Map<number, number>();
for (const sp of SPECIES) if (sp.evolvesTo) PREV.set(sp.evolvesTo, sp.id);
for (const [from, targets] of Object.entries(EVOLUTION_CHOICES)) for (const t of targets) PREV.set(t, Number(from));

/** Pré-évolution directe d'une espèce, toutes branches comprises (Voltali → Évoli), ou `undefined`. */
export function preEvolution(id: number): number | undefined {
  return PREV.get(id);
}

/**
 * Capacités apprises par niveau, pré-évolutions comprises (une forme évoluée peut réapprendre ce que savait sa
 * pré-évolution : Raichu garde l'accès aux attaques de Pikachu), triées par niveau, sans doublon.
 */
const LINE_LEARNSET = new Map<number, [number, number][]>();
export function lineLearnset(sp: Species): [number, number][] {
  const cached = LINE_LEARNSET.get(sp.id);
  if (cached) return cached;
  const all = [...sp.learnset];
  for (let p = PREV.get(sp.id), g = 0; p && g < 4; p = PREV.get(p), g++) all.push(...species(p).learnset);
  const seen = new Set<number>();
  const out = all.sort((a, b) => a[0] - b[0]).filter(([, m]) => (seen.has(m) ? false : (seen.add(m), true)));
  LINE_LEARNSET.set(sp.id, out);
  return out;
}

/**
 * Kit de départ d'un Pokémon (capture, sauvage, starter) : les 4 meilleures capacités connues à ce niveau, et non plus
 * les 4 dernières apprises (Dracaufeu partait avec Frénésie). Attaques les plus fortes d'abord (STAB ×1,5), un type
 * différent par attaque tant que possible ; + une capacité de sommeil et un soin s'il en connaît (très efficaces dans
 * ce moteur). Ordre = ordre d'utilisation en combat : le sommeil d'abord, le soin en dernier.
 */
export function movesAtLevel(sp: Species, level: number): number[] {
  const known = [...new Set(learnedMoves(sp, level))].map(move);
  const score = (m: Move) => (m.kind === 'damage' ? m.power * (sp.types.includes(m.type) ? 1.5 : 1) : 0);
  const dmg = known.filter((m) => m.kind === 'damage').sort((a, b) => score(b) - score(a));
  const sleep = known.find((m) => m.kind === 'status' && m.ailment === 'sleep');
  const heal = known.find((m) => m.kind === 'heal');
  const slots = 4 - (sleep ? 1 : 0) - (heal ? 1 : 0);
  const attacks: Move[] = [];
  const types = new Set<string>();
  for (const m of dmg) if (attacks.length < slots && !types.has(m.type)) { attacks.push(m); types.add(m.type); }
  for (const m of dmg) if (attacks.length < slots && !attacks.includes(m)) attacks.push(m);
  const kit = [...(sleep ? [sleep] : []), ...attacks, ...(heal ? [heal] : [])].map((m) => m.id);
  // aucune attaque connue (tout début de lignée) : on complète avec ce qu'il sait, comme avant
  for (const m of known) if (kit.length < 4 && !kit.includes(m.id)) kit.push(m.id);
  return kit.slice(0, 4);
}

/** Toutes les capacités apprises jusqu'à ce niveau (choix du joueur). */
export function learnedMoves(sp: Species, level: number): number[] {
  return lineLearnset(sp).filter(([lv]) => lv <= level).map(([, id]) => id);
}
