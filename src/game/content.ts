/** Contenu du jeu : biomes (document de conception, voir BIOMES.md pour le plan complet). */

export interface ZoneDef {
  name: string;
  minLv: number;
  maxLv: number;
  /** [espèce, poids] ; poids < 10 = espèce rare (capture 2× plus dure) */
  pool: [number, number][];
  /** `joinsPool` : une fois vaincu, le boss rejoint le pool de sauvages de la zone (légendaires en fin de
   * jeu, seule façon de les farmer/chromatiser) ; jamais le cas pour un boss de zone classique, qui ne se
   * bat qu'une fois. */
  boss: { speciesId: number; level: number; joinsPool?: boolean };
  /** fond de combat */
  /** décor du combat (purement visuel, voir `ui/battle/Backdrop.tsx`) */
  biome: 'forest' | 'meadow' | 'cave' | 'water' | 'electric' | 'swamp' | 'temple' | 'volcano' | 'desert' | 'league' | 'dojo' | 'haunted';
}

export interface ArenaDef {
  name: string;
  leader: string;
  type: string;
  team: [number, number][]; // [espèce, niveau]
  badge: string;
  /** Route Victoire/Ligue : un titre, pas un vrai badge — ne compte pas dans le total (8/8 par région). */
  grantsBadge?: boolean;
}

export interface BiomeDef {
  name: string;
  zones: ZoneDef[];
  arena: ArenaDef;
}

export const STAGES_PER_ZONE = 5;
export const WAVES_PER_STAGE = 3;

/**
 * Régions, dans l'ordre des prestiges (`REGIONS[s.prestige]` = région en cours). Chaque prestige
 * renvoie au 1er biome de la région suivante, une fois le Champion de la région en cours battu (dernier
 * biome de la région) et toutes ses espèces vues (`dexMax`). Ajouter une région = ajouter ses biomes à
 * la suite de `BIOMES` + une ligne ici (espèces présentes dans species.json jusqu'à `dexMax`).
 */
export interface RegionDef {
  name: string;
  /** index du 1er biome de la région dans `BIOMES` */
  start: number;
  starters: readonly number[];
  /** Pokédex cumulé jusqu'à cette région (151 Kanto, 251 Johto…) */
  dexMax: number;
}
export const REGIONS: readonly RegionDef[] = [
  { name: 'Kanto', start: 0, starters: [1, 4, 7], dexMax: 151 },
  { name: 'Johto', start: 10, starters: [152, 155, 158], dexMax: 251 },
  { name: 'Hoenn', start: 20, starters: [252, 255, 258], dexMax: 386 },
  { name: 'Sinnoh', start: 32, starters: [387, 390, 393], dexMax: 493 },
];
export const STARTERS = REGIONS[0].starters;
/** Index du 1er biome de chaque région (`REGION_START[s.prestige]`). */
export const REGION_START: readonly number[] = REGIONS.map((r) => r.start);
/** Région en cours (dernière si `prestige` dépasse, par sécurité). */
export const regionOf = (prestige: number): RegionDef => REGIONS[Math.min(prestige, REGIONS.length - 1)];
/** Index du dernier biome (arène du Champion) de la région n° `prestige`. */
export const regionLastBiome = (prestige: number): number => (REGIONS[prestige + 1]?.start ?? BIOMES.length) - 1;

export const BIOMES: BiomeDef[] = [
  {
    name: 'Forêt de Jade',
    zones: [
      {
        name: 'Lisière', minLv: 3, maxLv: 6, biome: 'meadow',
        pool: [[10, 30], [13, 30], [16, 25], [19, 15], [133, 20]],
        boss: { speciesId: 14, level: 8 },
      },
      {
        name: 'Sous-bois', minLv: 6, maxLv: 9, biome: 'forest',
        pool: [[11, 15], [14, 15], [21, 20], [29, 15], [32, 15], [43, 15], [25, 5]],
        boss: { speciesId: 12, level: 11 },
      },
      {
        name: 'Clairière', minLv: 10, maxLv: 14, biome: 'forest',
        pool: [[46, 20], [48, 20], [23, 15], [17, 15], [69, 10], [74, 10], [25, 5], [63, 5], [95, 5]],
        boss: { speciesId: 15, level: 16 },
      },
    ],
    arena: {
      name: 'Arène d’Argenta', leader: 'Pierre', type: 'Roche',
      team: [[74, 15], [74, 16], [95, 18]],
      badge: 'Badge Roche',
    },
  },
  {
    // Nv.18→30 — voir BIOMES.md : type dominant Eau, starters non choisis en rencontre très rare.
    name: 'Biome Aquatique',
    zones: [
      {
        name: 'Berges Claires', minLv: 18, maxLv: 21, biome: 'water',
        pool: [[54, 30], [60, 30], [72, 25], [14, 10], [30, 10], [33, 10], [7, 10]],
        boss: { speciesId: 61, level: 23 },
      },
      {
        name: 'Récif Corallien', minLv: 21, maxLv: 24, biome: 'water',
        pool: [[90, 25], [79, 25], [86, 25], [55, 15], [61, 10], [7, 10],[8, 5]],
        boss: { speciesId: 91, level: 27 },
      },
      {
        name: 'Fosse Profonde', minLv: 24, maxLv: 28, biome: 'water',
        pool: [[90, 20], [79, 20], [86, 20], [72, 15], [91, 10], [80, 10], [54, 5]],
        boss: { speciesId: 62, level: 29 },
      },
    ],
    arena: {
      name: 'Arène de Céruline', leader: 'Ondine', type: 'Eau',
      team: [[120, 27], [120, 28], [121, 30]],
      badge: 'Badge Cascade',
    },
  },
  {
    // Nv.30→35 — voir BIOMES.md : type dominant Électrik, courte progression (écart original +3).
    name: 'Biome Électrique',
    zones: [
      {
        name: 'Sous-station', minLv: 30, maxLv: 31, biome: 'electric',
        pool: [[81, 30], [39, 30], [98, 25], [100, 15], [17, 10], [20, 10]],
        boss: { speciesId: 99, level: 32 },
      },
      {
        name: 'Salle des Générateurs', minLv: 31, maxLv: 33, biome: 'electric',
        pool: [[81, 20], [100, 20], [40, 20], [98, 15], [125, 10], [83, 15]],
        boss: { speciesId: 82, level: 33 },
      },
      {
        name: 'Centrale Principale', minLv: 33, maxLv: 34, biome: 'electric',
        pool: [[81, 15], [40, 20], [99, 15], [125, 15], [83, 10], [135, 15], [133, 20]],
        boss: { speciesId: 101, level: 34 },
      },
    ],
    arena: {
      name: 'Arène de Carmin-sur-Mer', leader: 'Major Bob', type: 'Électrik',
      team: [[100, 32], [82, 33], [26, 35]],
      badge: 'Badge Foudre',
    },
  },
  {
    // Nv.35→43 — voir BIOMES.md : type dominant Plante (+ Insecte), écart original +5.
    name: 'Biome Verdoyant',
    zones: [
      {
        name: 'Clos Fleuri', minLv: 35, maxLv: 37, biome: 'meadow',
        pool: [[35, 30], [52, 30], [102, 25], [108, 15], [16, 10], [69, 10], [1, 10]],
        boss: { speciesId: 53, level: 38 },
      },
      {
        name: 'Ronce Profonde', minLv: 37, maxLv: 39, biome: 'forest',
        pool: [[102, 20], [108, 15], [114, 20], [123, 15], [118, 10], [35, 10], [52, 10]],
        boss: { speciesId: 103, level: 40 },
      },
      {
        name: 'Canopée Verdoyante', minLv: 39, maxLv: 42, biome: 'forest',
        pool: [[114, 15], [123, 15], [127, 15], [118, 15], [108, 10], [102, 15], [35, 15]],
        boss: { speciesId: 119, level: 42 },
      },
    ],
    arena: {
      name: 'Arène de Céladopole', leader: 'Erika', type: 'Plante',
      team: [[45, 40], [71, 41], [47, 43]],
      badge: 'Badge Prisme',
    },
  },
  {
    // Nv.43→61 — voir BIOMES.md : type dominant Poison (+ Fantôme), écart original +11.
    name: 'Marais Toxique',
    zones: [
      {
        name: 'Marais Embrumé', minLv: 43, maxLv: 48, biome: 'swamp',
        pool: [[41, 30], [109, 30], [88, 25], [92, 15], [17, 10], [30, 10]],
        boss: { speciesId: 42, level: 50 },
      },
      {
        name: 'Tourbière Toxique', minLv: 48, maxLv: 55, biome: 'swamp',
        pool: [[88, 20], [109, 20], [92, 15], [41, 15], [113, 10], [120, 20]],
        boss: { speciesId: 89, level: 57 },
      },
      {
        name: 'Cœur du Marécage', minLv: 55, maxLv: 59, biome: 'swamp',
        pool: [[92, 20], [113, 15], [120, 20], [88, 15], [109, 15], [41, 15]],
        boss: { speciesId: 110, level: 60 },
      },
    ],
    arena: {
      name: 'Arène de Parmanie', leader: 'Koga', type: 'Poison',
      team: [[89, 58], [110, 60], [94, 61]],
      badge: 'Badge Âme',
    },
  },
  {
    // Nv.61→66 — voir BIOMES.md : type dominant Psy (+ Combat, dojo voisin), écart original +3.
    name: 'Sanctuaire Psy',
    zones: [
      {
        name: 'Torii Embrumé', minLv: 61, maxLv: 62, biome: 'temple',
        pool: [[96, 30], [56, 30], [66, 25], [128, 15], [67, 10], [97, 10]],
        boss: { speciesId: 57, level: 63 },
      },
      {
        name: 'Dojo de la Prévoyance', minLv: 62, maxLv: 64, biome: 'temple',
        pool: [[96, 15], [56, 15], [66, 20], [106, 15], [107, 15], [115, 10], [128, 10]],
        boss: { speciesId: 97, level: 65 },
      },
      {
        name: 'Sanctuaire Intérieur', minLv: 64, maxLv: 65, biome: 'temple',
        pool: [[106, 20], [107, 20], [115, 15], [128, 15], [66, 10], [56, 10], [96, 10]],
        boss: { speciesId: 68, level: 65 },
      },
    ],
    arena: {
      name: 'Arène de Safrania', leader: 'Morgane', type: 'Psy',
      team: [[64, 63], [65, 65], [97, 66]],
      badge: 'Badge Marais',
    },
  },
  {
    // Nv.66→73 — voir BIOMES.md : type dominant Feu (+ Glace), écart original +4.
    name: 'Terres de Feu',
    zones: [
      {
        name: 'Contrefort Cendré', minLv: 66, maxLv: 68, biome: 'volcano',
        pool: [[37, 30], [58, 30], [77, 25], [124, 15], [87, 10], [38, 10], [4, 10]],
        boss: { speciesId: 38, level: 69 },
      },
      {
        name: 'Champ de Lave', minLv: 68, maxLv: 70, biome: 'volcano',
        pool: [[37, 15], [58, 15], [77, 15], [116, 20], [126, 15], [124, 10], [136, 10]],
        boss: { speciesId: 59, level: 71 },
      },
      {
        name: 'Caldeira Ardente', minLv: 70, maxLv: 72, biome: 'volcano',
        pool: [[116, 15], [117, 10], [126, 15], [136, 15], [124, 15], [77, 15], [37, 15]],
        boss: { speciesId: 78, level: 72 },
      },
    ],
    arena: {
      name: 'Arène de l’Île Cannelle', leader: 'Auguste', type: 'Feu',
      team: [[59, 70], [126, 71], [6, 73]],
      badge: 'Badge Volcan',
    },
  },
  {
    // Nv.73→78 — voir BIOMES.md : type dominant Sol, écart original +3.
    name: 'Plaines Rocheuses',
    zones: [
      {
        name: 'Carrière Aride', minLv: 73, maxLv: 74, biome: 'desert',
        pool: [[27, 30], [50, 30], [104, 25], [84, 15], [85, 10], [31, 10]],
        boss: { speciesId: 28, level: 75 },
      },
      {
        name: 'Crevasse Rocheuse', minLv: 74, maxLv: 76, biome: 'desert',
        pool: [[27, 15], [50, 15], [104, 15], [111, 20], [84, 15], [129, 20]],
        boss: { speciesId: 51, level: 76 },
      },
      {
        name: 'Plateau Desséché', minLv: 76, maxLv: 77, biome: 'desert',
        pool: [[111, 20], [129, 20], [104, 15], [84, 15], [50, 15], [27, 15]],
        boss: { speciesId: 105, level: 77 },
      },
    ],
    arena: {
      name: 'Arène de Jadielle', leader: 'Giovanni', type: 'Sol',
      team: [[112, 75], [85, 76], [34, 78]],
      badge: 'Badge Terre',
    },
  },
  {
    // Nv.78→90 — voir BIOMES.md : réserve postgame mixte, écart original +7 (Conseil des 4).
    name: 'Route Victoire',
    zones: [
      {
        name: 'Entrée de la Route Victoire', minLv: 78, maxLv: 82, biome: 'cave',
        pool: [[147, 40], [142, 30], [131, 30], [112, 10], [76, 10], [139, 10]],
        boss: { speciesId: 149, level: 84 },
      },
      {
        name: 'Passage Rocheux', minLv: 82, maxLv: 86, biome: 'cave',
        pool: [[140, 40], [143, 30], [147, 30], [112, 10], [130, 10], [121, 10]],
        boss: { speciesId: 144, level: 87, joinsPool: true },
      },
      {
        name: 'Sommet Balayé par les Vents', minLv: 86, maxLv: 89, biome: 'cave',
        pool: [[138, 40], [122, 30], [143, 30], [130, 10], [112, 10], [121, 10]],
        boss: { speciesId: 145, level: 90, joinsPool: true },
      },
    ],
    arena: {
      name: 'Conseil des 4', leader: 'Conseil des 4', type: 'mixte',
      team: [[130, 88], [68, 89], [76, 90]],
      badge: 'Titre de Maître',
      grantsBadge: false,
    },
  },
  {
    // Nv.90→100 — voir BIOMES.md : réserve postgame mixte, écart original +6 (Champion + postgame).
    name: 'Ligue Pokémon',
    zones: [
      {
        name: 'Antichambre du Plateau', minLv: 90, maxLv: 93, biome: 'league',
        pool: [[132, 40], [137, 30], [149, 30], [85, 10], [36, 10], [18, 10]],
        boss: { speciesId: 146, level: 94, joinsPool: true },
      },
      {
        name: 'Grotte Bleue', minLv: 93, maxLv: 96, biome: 'cave',
        pool: [[131, 40], [143, 30], [138, 30], [130, 10], [121, 10], [99, 10]],
        boss: { speciesId: 150, level: 97, joinsPool: true },
      },
      {
        name: 'Antre de Mew', minLv: 96, maxLv: 99, biome: 'meadow',
        pool: [[122, 40], [140, 30], [142, 30], [65, 10], [112, 10], [103, 10]],
        boss: { speciesId: 151, level: 99, joinsPool: true },
      },
    ],
    arena: {
      name: 'Plateau Indigo', leader: 'Champion', type: 'mixte',
      team: [[3, 96], [6, 98], [9, 100]],
      badge: 'Titre de Champion',
      grantsBadge: false,
    },
  },
  // ---------------------------------------------------------------- Johto (Gen 2, 152-251)
  {
    // Nv.5→19 — biome Vol (badge Zéphyr). Décors réutilisés (pas de nouveaux fonds de combat).
    name: 'Route des Cieux',
    zones: [
      {
        // Magicarpe, Hoothoot, Capumain, Poissoroy, Roucool, Rattata, Salamèche
        name: 'Sentier des Roseaux', minLv: 5, maxLv: 9, biome: 'meadow',
        pool: [[129, 20], [163, 20], [190, 20], [119, 10], [16, 20], [19, 10], [4, 10]],
        boss: { speciesId: 119, level: 10 },
      },
      {
        name: 'Falaise aux Vents', minLv: 9, maxLv: 14, biome: 'meadow',
        pool: [[19, 20], [21, 20], [41, 20], [74, 20], [102, 20], [118, 20], [7, 10]],
        boss: { speciesId: 118, level: 15 },
      },
      {
        name: 'Cimes de Ver-de-Gris', minLv: 14, maxLv: 19, biome: 'meadow',
        pool: [[161, 20], [165, 20], [206, 20], [61, 10], [162, 10], [167, 20], [152, 10]],
        boss: { speciesId: 162, level: 20 },
      },
    ],
    arena: {
      name: 'Arène de Ver-de-Gris', leader: 'Aldo', type: 'Vol',
      team: [[21, 17], [22, 18], [18, 19]],
      badge: 'Badge Zéphyr',
    },
  },
  {
    // Nv.19→30 — biome Insecte (badge Coléo).
    name: 'Forêt Fourmillante',
    zones: [
      {
        name: 'Lisière Grouillante', minLv: 19, maxLv: 22, biome: 'forest',
        pool: [[204, 20], [214, 20], [10, 20], [13, 20], [60, 20], [11, 10], [1, 10]],
        boss: { speciesId: 214, level: 22 },
      },
      {
        name: 'Clairière aux Cocons', minLv: 22, maxLv: 26, biome: 'forest',
        pool: [[239, 20], [240, 20], [211, 20], [14, 10], [69, 20], [84, 20], [155, 10]],
        boss: { speciesId: 211, level: 26 },
      },
      {
        name: 'Cœur de la Forêt', minLv: 26, maxLv: 30, biome: 'forest',
        pool: [[77, 20], [92, 20], [172, 20], [201, 20], [236, 20], [238, 20], [158, 10]],
        boss: { speciesId: 124, level: 30 },
      },
    ],
    arena: {
      name: 'Arène d’Azuria (Johto)', leader: 'Barbara', type: 'Insecte',
      team: [[123, 28], [127, 29], [214, 30]],
      badge: 'Badge Coléo',
    },
  },
  {
    // Nv.30→35 — biome Normal (badge Plaine).
    name: 'Prairies de Doré',
    zones: [
      {
        // Mélo, Toudoudou, Togepi, Rapasdepic, Akwakwak, Noarfang
        name: 'Champs de Doré', minLv: 30, maxLv: 31, biome: 'meadow',
        pool: [[173, 20], [174, 20], [175, 20], [22, 10], [55, 10], [164, 10]],
        boss: { speciesId: 55, level: 31 },
      },
      {
        name: 'Ferme Laitière', minLv: 31, maxLv: 33, biome: 'meadow',
        pool: [[23, 20], [27, 20], [43, 20], [46, 20], [54, 20], [72, 20], [95, 20]],
        boss: { speciesId: 73, level: 33 },
      },
      {
        name: 'Verger Paisible', minLv: 33, maxLv: 35, biome: 'meadow',
        pool: [[187, 20], [194, 20], [12, 10], [15, 10], [73, 10], [195, 10]],
        boss: { speciesId: 73, level: 35 },
      },
    ],
    arena: {
      name: 'Arène de Doré', leader: 'Blanche', type: 'Normal',
      team: [[209, 32], [241, 33], [233, 35]],
      badge: 'Badge Plaine',
    },
  },
  {
    // Nv.35→42 — biome Spectre (badge Brume). Seules 4 espèces Spectre existent en Gen 1-2 (canon) :
    // complété par des espèces inédites (absentes de tout autre biome) mais cohérentes avec l'ambiance
    // « tour mystique » : Zarbi (hiéroglyphes des ruines, canon Johto), Simularbre (facétieux, se déguise),
    // Roigada (vieux sage psychique).
    name: 'Tour Hantée',
    zones: [
      {
        name: 'Rez-de-Tour', minLv: 35, maxLv: 37, biome: 'haunted',
        pool: [[79, 20], [17, 10], [25, 10], [166, 10], [168, 10], [179, 20]],
        boss: { speciesId: 181, level: 38 },
      },
      {
        name: 'Étages Hantés', minLv: 37, maxLv: 39, biome: 'haunted',
        pool: [[24, 10], [28, 10], [35, 10], [39, 10], [178, 10], [48, 20]],
        boss: { speciesId: 36, level: 40 },
      },
      {
        name: 'Sommet de la Tour', minLv: 39, maxLv: 42, biome: 'haunted',
        pool: [[63, 20], [191, 20], [96, 20], [49, 10], [70, 10], [99, 10]],
        boss: { speciesId: 65, level: 42 },
      },
    ],
    arena: {
      name: 'Arène d’Écorcia', leader: 'Morty', type: 'Spectre',
      team: [[93, 40], [93, 41], [94, 42]],
      badge: 'Badge Brume',
    },
  },
  {
    // Nv.42→58 — biome Combat (badge Tempête).
    name: 'Dojo d’Ébène',
    zones: [
      {
        name: 'Cour d’Entraînement', minLv: 42, maxLv: 47, biome: 'dojo',
        pool: [[66, 20], [98, 20], [104, 20], [120, 20], [132, 20], [222, 20], [67, 10]],
        boss: { speciesId: 121, level: 47 },
      },
      {
        name: 'Salle des Katas', minLv: 47, maxLv: 52, biome: 'dojo',
        pool: [[29, 20], [32, 20], [37, 20], [58, 20], [185, 20], [234, 20]],
        boss: { speciesId: 59, level: 52 },
      },
      {
        name: 'Antichambre du Maître', minLv: 52, maxLv: 58, biome: 'dojo',
        pool: [[52, 20], [193, 20], [56, 20], [44, 10], [57, 10], [83, 20]],
        boss: { speciesId: 57, level: 58 },
      },
    ],
    arena: {
      name: 'Arène d’Ébène', leader: 'Albert', type: 'Combat',
      team: [[56, 55], [62, 58]],
      badge: 'Badge Tempête',
    },
  },
  {
    // Nv.58→63 — biome Acier (badge Mystik). Seules 4 espèces Acier existent en Gen 2 (canon) :
    // complété par des espèces inédites cohérentes avec le phare d'Olivine — Wattouat/Lainergie,
    // pré-évolutions d'Ampharos (le véritable gardien du phare dans les jeux d'origine, déjà utilisé
    // au Sanctuaire de Ho-Oh, donc on garde sa lignée sans le dupliquer), et Gravalanch pour la roche
    // sur laquelle le phare est bâti.
    name: 'Phare d’Olivia',
    zones: [
      {
        name: 'Base du Phare', minLv: 58, maxLv: 59, biome: 'cave',
        pool: [[81, 20], [109, 20], [183, 20], [20, 10], [180, 10], [115, 10]],
        boss: { speciesId: 115, level: 60 },
      },
      {
        name: 'Escalier de Fer', minLv: 59, maxLv: 61, biome: 'cave',
        pool: [[115, 20], [128, 20], [143, 20], [209, 20], [241, 20], [97, 10]],
        boss: { speciesId: 143, level: 61 },
      },
      {
        name: 'Sommet du Phare', minLv: 61, maxLv: 63, biome: 'cave',
        pool: [[203, 20], [100, 20], [105, 10], [126, 10], [94, 10], [125, 10]],
        boss: { speciesId: 94, level: 63 },
      },
    ],
    arena: {
      name: 'Arène d’Olivia', leader: 'Jasmine', type: 'Acier',
      team: [[81, 60], [81, 61], [208, 63]],
      badge: 'Badge Mystik',
    },
  },
  {
    // Nv.63→70 — biome Glace (badge Glace).
    name: 'Grotte Gelée',
    zones: [
      {
        name: 'Entrée Givrée', minLv: 63, maxLv: 65, biome: 'cave',
        pool: [[198, 20], [228, 20], [50, 20], [111, 20], [53, 10], [64, 10], [93, 10]],
        boss: { speciesId: 65, level: 66 },
      },
      {
        // Tadmorv, Porygon, Triopikeur, Grotadmorv, Léviator, Lippoutou
        name: 'Galerie de Glace', minLv: 65, maxLv: 67, biome: 'cave',
        pool: [[88, 20], [137, 20], [51, 10], [89, 10], [130, 10], [124, 10]],
        boss: { speciesId: 245, level: 68, joinsPool: true },
      },
      {
        name: 'Lac Souterrain Gelé', minLv: 67, maxLv: 70, biome: 'cave',
        pool: [[131, 20], [133, 20], [177, 20], [200, 20], [220, 20], [225, 20], [235, 20]],
        boss: { speciesId: 144, level: 70, joinsPool: true },
      },
    ],
    arena: {
      name: 'Arène d’Irisia', leader: 'Frédo', type: 'Glace',
      team: [[91, 65], [221, 67], [131, 70]],
      badge: 'Badge Glace',
    },
  },
  {
    // Nv.70→75 — biome Dragon (badge Ascension). Seules 4 espèces Dragon existent en Gen 1-2 (canon) :
    // complété par des espèces inédites de créatures aquatiques anciennes/majestueuses, cohérentes avec
    // un antre sacré — Aquali (esprit des eaux), Amonistar et Kabutops (fossiles marins ressuscités).
    name: 'Tanière des Dragons',
    zones: [
      {
        name: 'Rivière aux Dragonneaux', minLv: 70, maxLv: 71, biome: 'water',
        pool: [[227, 20], [42, 10], [75, 10], [208, 10], [80, 10], [101, 10]],
        boss: { speciesId: 145, level: 72, joinsPool: true },
      },
      {
        name: 'Bassin Sacré', minLv: 71, maxLv: 73, biome: 'water',
        pool: [[86, 20], [108, 20], [114, 20], [116, 20], [207, 20], [216, 20], [223, 20]],
        boss: { speciesId: 146, level: 73, joinsPool: true },
      },
      {
        name: 'Antre de Rosalia', minLv: 73, maxLv: 75, biome: 'water',
        pool: [[231, 20], [90, 20], [170, 20], [117, 10], [171, 10], [224, 10]],
        boss: { speciesId: 249, level: 75, joinsPool: true },
      },
    ],
    arena: {
      name: 'Arène de Rosalia', leader: 'Guirande', type: 'Dragon',
      team: [[147, 72], [148, 73], [230, 74], [149, 75]],
      badge: 'Badge Ascension',
    },
  },
  {
    // Nv.75→87 — biome Ténèbres, Conseil des 4 Johto (jamais de badge dans les jeux d'origine). Les 6
    // espèces Ténèbres existantes en Gen 1-2 (canon) suffisent tout juste à 6/zone sans espèce inédite :
    // complété par Embrylex/Ymphect, pré-évolutions inédites de Tyranocif (déjà présent ici), cohérentes
    // avec l'ambiance de grotte hostile.
    name: 'Grotte Sombre',
    zones: [
      {
        name: 'Antichambre Obscure', minLv: 75, maxLv: 79, biome: 'cave',
        pool: [[113, 20], [202, 20], [218, 20], [30, 10], [33, 10], [188, 10]],
        boss: { speciesId: 243, level: 80, joinsPool: true },
      },
      {
        name: 'Couloir des Ombres', minLv: 79, maxLv: 83, biome: 'cave',
        pool: [[123, 20], [127, 20], [142, 20], [85, 10], [38, 10], [59, 10]],
        boss: { speciesId: 244, level: 84, joinsPool: true },
      },
      {
        name: 'Trône de Carla', minLv: 83, maxLv: 87, biome: 'cave',
        pool: [[122, 20], [213, 20], [215, 20], [217, 10], [219, 10], [232, 10], [221, 10]],
        boss: { speciesId: 150, level: 87, joinsPool: true },
      },
    ],
    arena: {
      name: 'Conseil des 4 (Johto)', leader: 'Conseil des 4', type: 'mixte',
      team: [[229, 85], [197, 86], [248, 87]],
      badge: 'Titre de Maître Johto',
      grantsBadge: false,
    },
  },
  {
    // Nv.87→100 — Champion Johto, capstone Ho-Oh. Zone « mixte » (pas de dominante stricte) : sert aussi
    // de repli pour les espèces sans zone de leur type à Johto (Feu, Sol, Porygon2…). La Carte masque
    // Kanto après le prestige (voir MapPanel) : tout le Pokédex (Kanto compris) doit être obtenable dans
    // les biomes Johto.
    name: 'Plateau Doré',
    zones: [
      {
        name: 'Antichambre Dorée', minLv: 87, maxLv: 91, biome: 'league',
        pool: [[138, 20], [140, 20], [147, 20], [226, 20], [87, 10], [47, 10], [82, 10]],
        boss: { speciesId: 251, level: 92, joinsPool: true },
      },
      {
        name: 'Galerie des Champions', minLv: 91, maxLv: 95, biome: 'league',
        pool: [[246, 20], [148, 10], [78, 10], [110, 10], [112, 10], [189, 10], [229, 10]],
        boss: { speciesId: 151, level: 96, joinsPool: true },
      },
      {
        name: 'Sanctuaire de Ho-Oh', minLv: 95, maxLv: 99, biome: 'temple',
        pool: [[76, 10], [184, 10], [247, 10], [230, 10], [149, 10], [248, 10]],
        boss: { speciesId: 250, level: 99, joinsPool: true },
      },
    ],
    arena: {
      name: 'Plateau Doré', leader: 'Champion Johto', type: 'mixte',
      team: [[154, 96], [157, 97], [160, 98], [248, 100]],
      badge: 'Titre de Champion Johto',
      grantsBadge: false,
    },
  },
  // ─── Hoenn (Gen 3, 252-386) — région du 2e prestige, 12 biomes (index 20-31). Généré puis relu :
  // chaque forme de base 1-386 est placée par type dominant, les 11 légendaires Kanto/Johto en rencontre
  // très rare dans les derniers biomes, les 10 légendaires Hoenn en boss `joinsPool`.
  {
    // Nv.5→15 — biome Roche (badge Roche). Starters des 3 régions en rencontre très rare.
    name: 'Carrière de Mérouville',
    zones: [
      {
        // Fouinette, Coxy, Capumain, Insolourdo, Medhyèna, Chenipotte, Poissoroy, Salamèche
        name: 'Sentier Caillouteux', minLv: 5, maxLv: 8, biome: 'cave',
        pool: [[161, 20], [165, 20], [190, 20], [206, 20], [261, 20], [265, 20], [119, 10], [4, 10]],
        boss: { speciesId: 119, level: 9 },
      },
      {
        // Roucool, Rattata, Piafabec, Racaillou, Noeunoeuf, Poissirène, Magicarpe, Carapuce
        name: 'Galerie de Granite', minLv: 8, maxLv: 12, biome: 'cave',
        pool: [[16, 20], [19, 20], [21, 20], [74, 20], [102, 20], [118, 20], [129, 20], [7, 10]],
        boss: { speciesId: 118, level: 13 },
      },
      {
        // Hoothoot, Mimigal, Pomdepik, Scarhino, Zigzaton, Chenipan, Chrysacier, Germignon
        name: 'Falaise de Mérouville', minLv: 12, maxLv: 14, biome: 'cave',
        pool: [[163, 20], [167, 20], [204, 20], [214, 20], [263, 20], [10, 20], [11, 10], [152, 10]],
        boss: { speciesId: 214, level: 15 },
      },
    ],
    arena: {
      name: 'Arène de Mérouville', leader: 'Roxanne', type: 'Roche',
      team: [[369, 13], [348, 14], [306, 15]], // Relicanth, Armaldo, Galeking
      badge: 'Badge Roche',
    },
  },
  {
    // Nv.15→22 — biome Combat (badge Poing).
    name: 'Îlot de Myokara',
    zones: [
      {
        // Nosferapti, Aspicot, Ptitard, Nénupiot, Grainipiot, Goélise, Tarsal, Héricendre
        name: 'Plage de Myokara', minLv: 15, maxLv: 17, biome: 'water',
        pool: [[41, 20], [13, 20], [60, 20], [270, 20], [273, 20], [278, 20], [280, 20], [155, 10]],
        boss: { speciesId: 15, level: 18 },
      },
      {
        // Wailmer, Écrapince, Coconfort, Têtarte, Fouinar, Bekipan, Sharpedo, Kaiminus
        name: 'Grotte du Dojo', minLv: 17, maxLv: 20, biome: 'cave',
        pool: [[320, 20], [341, 20], [14, 10], [61, 10], [162, 10], [279, 10], [319, 10], [158, 10]],
        boss: { speciesId: 319, level: 21 },
      },
      {
        // Chétiflor, Fantominus, Debugant, Azurill, Méditikka, Qwilfish, Bulbizarre
        name: 'Salle des Poings', minLv: 20, maxLv: 21, biome: 'dojo',
        pool: [[69, 20], [92, 20], [236, 20], [298, 20], [307, 20], [211, 20], [1, 10]],
        boss: { speciesId: 237, level: 22 },
      },
    ],
    arena: {
      name: 'Arène de Myokara', leader: 'Bastien', type: 'Combat',
      team: [[308, 20], [286, 21], [297, 22]], // Charmina, Chapignon, Hariyama
      badge: 'Badge Poing',
    },
  },
  {
    // Nv.22→28 — route sans badge : forêt (Insecte/Plante).
    name: 'Bois de Clémenti',
    zones: [
      {
        // Ponyta, Doduo, Pichu, Mélo, Toudoudou, Togepi, Zarbi, Arcko
        name: 'Orée des Bois', minLv: 22, maxLv: 24, biome: 'forest',
        pool: [[77, 20], [84, 20], [172, 20], [173, 20], [174, 20], [175, 20], [201, 20], [252, 10]],
        boss: { speciesId: 77, level: 25 },
      },
      {
        // Lippouti, Magby, Nirondelle, Okéoké, Granivol, Rapasdepic, Papilusion, Poussifeu
        name: 'Sous-bois Humide', minLv: 24, maxLv: 26, biome: 'forest',
        pool: [[238, 20], [240, 20], [276, 20], [360, 20], [187, 20], [22, 10], [12, 10], [255, 10]],
        boss: { speciesId: 277, level: 27 },
      },
      {
        // Abo, Sabelette, Mystherbe, Paras, Psykokwak, Tentacool, Onix, Gobou
        name: 'Clairière aux Chenilles', minLv: 26, maxLv: 27, biome: 'forest',
        pool: [[23, 20], [27, 20], [43, 20], [46, 20], [54, 20], [72, 20], [95, 20], [258, 10]],
        boss: { speciesId: 73, level: 28 },
      },
    ],
    arena: {
      name: 'Camp des Scouts', leader: 'Barbara', type: 'Insecte',
      team: [[284, 26], [291, 27], [348, 28]], // Maskadra, Ninjask, Armaldo
      badge: 'Titre de Scout',
      grantsBadge: false,
    },
  },
  {
    // Nv.28→34 — biome Électrik (badge Dynamo).
    name: 'Centrale de Lavandia',
    zones: [
      {
        // Élekid, Wattouat, Axoloto, Balignon, Parecool, Dardargnan, Akwakwak
        name: 'Route Cyclable', minLv: 28, maxLv: 30, biome: 'electric',
        pool: [[239, 20], [179, 20], [194, 20], [285, 20], [287, 20], [15, 10], [55, 10]],
        boss: { speciesId: 181, level: 31 },
      },
      {
        // Ramoloss, Roucoups, Pikachu, Coxyclaque, Migalos, Rondoudou, Xatu
        name: 'Nouvelle Centrale', minLv: 30, maxLv: 32, biome: 'electric',
        pool: [[79, 20], [17, 10], [25, 10], [166, 10], [168, 10], [39, 10], [178, 10]],
        boss: { speciesId: 26, level: 33 },
      },
      {
        // Chuchmur, Makuhita, Skitty, Galekid, Négapi, Arbok, Mélofée
        name: 'Salle des Turbines', minLv: 32, maxLv: 33, biome: 'electric',
        pool: [[293, 20], [296, 20], [300, 20], [304, 20], [312, 20], [24, 10], [35, 10]],
        boss: { speciesId: 297, level: 34 },
      },
    ],
    arena: {
      name: 'Arène de Lavandia', leader: 'Voltère', type: 'Électrik',
      team: [[312, 32], [311, 33], [310, 34]], // Négapi, Posipi, Élecsprint
      badge: 'Badge Dynamo',
    },
  },
  {
    // Nv.34→41 — biome Feu (badge Chaleur).
    name: 'Mont Chimnée',
    zones: [
      {
        // Ningale, Mimitoss, Abra, Tournegrin, Ténéfix, Sablaireau, Aéromite
        name: 'Pente de Cendres', minLv: 34, maxLv: 36, biome: 'volcano',
        pool: [[290, 20], [48, 20], [63, 20], [191, 20], [302, 20], [28, 10], [49, 10]],
        boss: { speciesId: 291, level: 37 },
      },
      {
        // Machoc, Soporifik, Krabby, Osselait, Stari, Corayon, Tarinor
        name: 'Cratère Fumant', minLv: 36, maxLv: 39, biome: 'volcano',
        pool: [[66, 20], [96, 20], [98, 20], [104, 20], [120, 20], [222, 20], [299, 20]],
        boss: { speciesId: 121, level: 40 },
      },
      {
        // Nidoran♀, Nidoran♂, Goupix, Caninos, Simularbre, Dynavolt, Posipi
        name: 'Sources de Vermilava', minLv: 39, maxLv: 40, biome: 'volcano',
        pool: [[29, 20], [32, 20], [37, 20], [58, 20], [185, 20], [309, 20], [311, 20]],
        boss: { speciesId: 59, level: 41 },
      },
    ],
    arena: {
      name: 'Arène de Vermilava', leader: 'Adriane', type: 'Feu',
      team: [[59, 39], [324, 40], [323, 41]], // Arcanin, Chartor, Camérupt
      badge: 'Badge Chaleur',
    },
  },
  {
    // Nv.41→48 — biome Normal (badge Balance).
    name: 'Plaines de Clémenti-Ville',
    zones: [
      {
        // Métamorph, Cerfrousse, Gloupti, Miaouss, Magnéti, Yanma, Muciole
        name: 'Hautes Herbes', minLv: 41, maxLv: 43, biome: 'meadow',
        pool: [[132, 20], [234, 20], [316, 20], [52, 20], [81, 20], [193, 20], [313, 20]],
        boss: { speciesId: 82, level: 44 },
      },
      {
        // Lumivole, Férosinge, Spinda, Girafarig, Tylton, Ortide, Rattatac
        name: 'Ranch Paisible', minLv: 43, maxLv: 46, biome: 'meadow',
        pool: [[314, 20], [56, 20], [327, 20], [203, 20], [333, 20], [44, 10], [20, 10]],
        boss: { speciesId: 57, level: 47 },
      },
      {
        // Canarticho, Kangourex, Tauros, Ronflex, Snubbull, Écrémeuh, Chartor
        name: 'Dojo de Norman', minLv: 46, maxLv: 47, biome: 'dojo',
        pool: [[83, 20], [115, 20], [128, 20], [143, 20], [209, 20], [241, 20], [324, 20]],
        boss: { speciesId: 143, level: 48 },
      },
    ],
    arena: {
      name: 'Arène de Clémenti-Ville', leader: 'Norman', type: 'Normal',
      team: [[295, 46], [335, 47], [289, 48]], // Brouhabam, Mangriff, Monaflèmit
      badge: 'Badge Balance',
    },
  },
  {
    // Nv.48→55 — route sans badge : jungle et désert (Plante/Sol/Poison).
    name: 'Route du Désert',
    zones: [
      {
        // Smogo, Chamallot, Séviper, Barloche, Hypnomade, Ossatueur, Magmar
        name: 'Jungle Tropicale', minLv: 48, maxLv: 50, biome: 'forest',
        pool: [[109, 20], [322, 20], [336, 20], [339, 20], [97, 10], [105, 10], [126, 10]],
        boss: { speciesId: 126, level: 51 },
      },
      {
        // Voltorbe, Malosse, Ectoplasma, Lombre, Pifeuil, Persian, Kadabra
        name: 'Marais Poisseux', minLv: 50, maxLv: 53, biome: 'swamp',
        pool: [[100, 20], [228, 20], [94, 10], [271, 10], [274, 10], [53, 10], [64, 10]],
        boss: { speciesId: 65, level: 54 },
      },
      {
        // Taupiqueur, Rhinocorne, Solaroc, Tadmorv, Kraknoix, Cacnea, Balbuto
        name: 'Désert Ensablé', minLv: 53, maxLv: 54, biome: 'desert',
        pool: [[50, 20], [111, 20], [338, 20], [88, 20], [328, 20], [331, 20], [343, 20]],
        boss: { speciesId: 330, level: 55 },
      },
    ],
    arena: {
      name: 'Ruines du Désert', leader: 'Giovanni', type: 'Sol',
      team: [[340, 53], [344, 54], [330, 55]], // Barbicha, Kaorine, Libégon
      badge: 'Titre de Montagnard',
      grantsBadge: false,
    },
  },
  {
    // Nv.55→62 — biome Vol (badge Plume). Les 3 Regi en boss légendaires (`joinsPool`).
    name: 'Cimes de Cimetronelle',
    zones: [
      {
        // Cornèbre, Porygon, Airmure, Triopikeur, Kirlia, Grotadmorv, Léviator
        name: 'Pont Suspendu', minLv: 55, maxLv: 57, biome: 'meadow',
        pool: [[198, 20], [137, 20], [227, 20], [51, 10], [281, 10], [89, 10], [130, 10]],
        boss: { speciesId: 377, level: 58, joinsPool: true },
      },
      {
        // Lokhlass, Évoli, Natu, Marcacrin, Cadoizo, Queulorior, Morphéo
        name: 'Canopée Venteuse', minLv: 57, maxLv: 60, biome: 'forest',
        pool: [[131, 20], [133, 20], [177, 20], [220, 20], [225, 20], [235, 20], [351, 20]],
        boss: { speciesId: 378, level: 61, joinsPool: true },
      },
      {
        // Otaria, Excelangue, Saquedeneu, Hypotrempe, Scorplane, Teddiursa, Rémoraid
        name: 'Nid des Altaria', minLv: 60, maxLv: 61, biome: 'meadow',
        pool: [[86, 20], [108, 20], [114, 20], [116, 20], [207, 20], [216, 20], [223, 20]],
        boss: { speciesId: 379, level: 62, joinsPool: true },
      },
    ],
    arena: {
      name: 'Arène de Cimetronelle', leader: 'Alizée', type: 'Vol',
      team: [[279, 60], [277, 61], [334, 62]], // Bekipan, Hélédelle, Altaria
      badge: 'Badge Plume',
    },
  },
  {
    // Nv.62→70 — biome Psy (badge Esprit). Latias, Latios et Jirachi en boss légendaires.
    name: 'Île d’Algatia',
    zones: [
      {
        // Feuforêve, Spoink, Phanpy, Flagadoss, Électrode, Hypocéan
        name: 'Rivage Spirituel', minLv: 62, maxLv: 65, biome: 'water',
        pool: [[200, 20], [325, 20], [231, 20], [80, 10], [101, 10], [117, 10]],
        boss: { speciesId: 380, level: 66, joinsPool: true },
      },
      {
        // Leveinard, Nidorina, Nidorino, Lanturn, Qulbutoké, Octillery, Hélédelle
        name: 'Centre Spatial', minLv: 65, maxLv: 67, biome: 'temple',
        pool: [[113, 20], [30, 10], [33, 10], [171, 10], [202, 10], [224, 10], [277, 10]],
        boss: { speciesId: 381, level: 68, joinsPool: true },
      },
      {
        // Kecleon, Tropius, Absol, Polichombr, Skelénox, Éoko, Floravol
        name: 'Jardin Céleste', minLv: 67, maxLv: 69, biome: 'temple',
        pool: [[352, 20], [357, 20], [359, 20], [353, 20], [355, 20], [358, 20], [188, 10]],
        boss: { speciesId: 385, level: 70, joinsPool: true },
      },
    ],
    arena: {
      name: 'Arène d’Algatia', leader: 'Lévy & Tatia', type: 'Psy',
      team: [[337, 68], [338, 69], [282, 70]], // Séléroc, Solaroc, Gardevoir
      badge: 'Badge Esprit',
    },
  },
  {
    // Nv.70→78 — biome Eau (badge Pluie). Kyogre en boss légendaire.
    name: 'Fonds Marins d’Atalanopolis',
    zones: [
      {
        // Kokiyas, Loupio, Carvanha, Barpau, Limagma, Linéon, Élecsprint, Tartard, Raikou, Celebi
        name: 'Courants Chauds', minLv: 70, maxLv: 73, biome: 'water',
        pool: [[90, 20], [170, 20], [318, 20], [349, 20], [218, 20], [264, 10], [310, 10], [62, 10], [243, 20], [251, 20]],
        boss: { speciesId: 144, level: 74, joinsPool: true },
      },
      {
        // Insécateur, Scarabrute, Amonita, Kabuto, Ptéra, Lilia, Anorith, Staross, Entei
        name: 'Grotte Sous-Marine', minLv: 73, maxLv: 75, biome: 'water',
        pool: [[123, 20], [127, 20], [138, 20], [140, 20], [142, 20], [345, 20], [347, 20], [121, 10], [244, 20]],
        boss: { speciesId: 145, level: 76, joinsPool: true },
      },
      {
        // Obalie, M. Mime, Caratroc, Coquiperl, Relicanth, Lovdisc, Dodrio
        name: 'Abysses Anciens', minLv: 75, maxLv: 77, biome: 'water',
        pool: [[363, 20], [122, 20], [213, 20], [366, 20], [369, 20], [370, 20], [85, 10]],
        boss: { speciesId: 382, level: 78, joinsPool: true },
      },
    ],
    arena: {
      name: 'Arène d’Atalanopolis', leader: 'Marc', type: 'Eau',
      team: [[369, 76], [365, 77], [350, 78]], // Relicanth, Kaimorse, Milobellus
      badge: 'Badge Pluie',
    },
  },
  {
    // Nv.78→89 — Route Victoire / Conseil des 4 Hoenn (Spectre, Ténèbres, Glace, Dragon). Groudon en boss légendaire.
    name: 'Route Victoire Hoenn',
    zones: [
      {
        // Stalgamin, Draby, Ursaring, Volcaropod, Donphan, Cochignon, Wailord, Démolosse, Suicune
        name: 'Caverne Glacée', minLv: 78, maxLv: 82, biome: 'cave',
        pool: [[361, 20], [371, 20], [217, 10], [219, 10], [232, 10], [221, 10], [321, 10], [229, 10], [245, 20]],
        boss: { speciesId: 146, level: 83, joinsPool: true },
      },
      {
        // Minidraco, Lamantine, Altaria, Kaorine, Branette, Barbicha, Parasect, Qwilfish, Lugia
        name: 'Galerie des Ombres', minLv: 82, maxLv: 85, biome: 'cave',
        pool: [[147, 20], [87, 10], [334, 10], [344, 10], [354, 10], [340, 10], [47, 10], [211, 10], [249, 20]],
        boss: { speciesId: 150, level: 86, joinsPool: true },
      },
      {
        // Farfuret, Magnéton, Draco, Ramboum, Hariyama, Galegon, Colhomard
        name: 'Magma Souterrain', minLv: 85, maxLv: 88, biome: 'volcano',
        pool: [[215, 20], [82, 10], [148, 10], [294, 10], [297, 10], [305, 10], [342, 10]],
        boss: { speciesId: 383, level: 89, joinsPool: true },
      },
    ],
    arena: {
      name: 'Conseil des 4 (Hoenn)', leader: 'Conseil des 4', type: 'mixte',
      team: [[359, 87], [330, 88], [373, 89]], // Absol, Libégon, Drattak
      badge: 'Titre de Maître Hoenn',
      grantsBadge: false,
    },
  },
  {
    // Nv.89→100 — Champion Hoenn (Acier). Rayquaza et Deoxys en boss légendaires.
    name: 'Ligue d’Éternara',
    zones: [
      {
        // Démanta, Arakdo, Mysdibule, Rosélia, Mangriff, Terhal, Vibraninf
        name: 'Pilier Céleste', minLv: 89, maxLv: 93, biome: 'temple',
        pool: [[226, 20], [283, 20], [303, 20], [315, 20], [335, 20], [374, 20], [329, 10]],
        boss: { speciesId: 384, level: 94, joinsPool: true },
      },
      {
        // Embrylex, Séléroc, Galopa, Smogogo, Rhinoféros, Cotovol, Démolosse
        name: 'Météorite Mystérieuse', minLv: 93, maxLv: 96, biome: 'cave',
        pool: [[246, 20], [337, 20], [78, 10], [110, 10], [112, 10], [189, 10], [229, 10]],
        boss: { speciesId: 386, level: 97, joinsPool: true },
      },
      {
        // Téraclope, Phogleur, Métang, Grolem, Azumarill, Chapignon, Vigoroth, Démanta, Ho-Oh
        name: 'Salle du Champion', minLv: 96, maxLv: 99, biome: 'league',
        pool: [[356, 10], [364, 10], [375, 10], [76, 10], [184, 10], [286, 10], [288, 10], [226, 10], [250, 20]],
        boss: { speciesId: 151, level: 100, joinsPool: true },
      },
    ],
    arena: {
      name: 'Ligue d’Éternara', leader: 'Pierre Rochard', type: 'Acier',
      team: [[303, 98], [306, 99], [376, 100]], // Mysdibule, Galeking, Métalosse
      badge: 'Titre de Champion Hoenn',
      grantsBadge: false,
    },
  },
  {
    // Nv.5→13 — biome Roche (badge Charbon). Starters des 4 régions en rencontre très rare.
    name: 'Mine de Charbourg',
    zones: [
      {
        // Crikzik, Hoothoot, Roucool, Coxy, Mimigal, Pomdepik, Salamèche
        name: 'Entrée de la Mine', minLv: 5, maxLv: 8, biome: 'cave',
        pool: [[401, 20], [163, 20], [16, 20], [165, 10], [167, 10], [204, 10], [4, 10]],
        boss: { speciesId: 402, level: 9 },
      },
      {
        // Coxy, Mimigal, Pomdepik, Scarhino, Zigzaton, Chenipotte, Héricendre
        name: 'Galerie de Charbon', minLv: 8, maxLv: 10, biome: 'cave',
        pool: [[165, 20], [167, 20], [204, 20], [214, 20], [263, 20], [265, 20], [155, 10]],
        boss: { speciesId: 214, level: 11 },
      },
      {
        // Rattata, Piafabec, Racaillou, Poissirène, Magicarpe, Fouinette, Poussifeu
        name: 'Fosse aux Fossiles', minLv: 10, maxLv: 12, biome: 'cave',
        pool: [[19, 20], [21, 20], [74, 20], [118, 20], [129, 20], [161, 20], [255, 10]],
        boss: { speciesId: 162, level: 13 },
      },
    ],
    arena: {
      name: 'Arène de Charbourg', leader: 'Pierrick', type: 'Roche',
      team: [[476, 11], [409, 12], [464, 13]], // Tarinorme, Charkos, Rhinastoc
      badge: 'Badge Charbon',
    },
  },
  {
    // Nv.13→19 — biome Plante/Insecte (badge Forêt).
    name: 'Forêt de Bonville',
    zones: [
      {
        // Nosferapti, Noeunoeuf, Capumain, Insolourdo, Medhyèna, Étourmi, Keunotor, Bulbizarre, Tortipouss
        name: 'Sentier Moussu', minLv: 13, maxLv: 15, biome: 'forest',
        pool: [[41, 20], [102, 20], [190, 20], [206, 20], [261, 20], [396, 20], [399, 20], [1, 10], [387, 10]],
        boss: { speciesId: 262, level: 16 },
      },
      {
        // Lixy, Chenipan, Aspicot, Ptitard, Nénupiot, Grainipiot, Goélise, Germignon
        name: 'Bois Ancien', minLv: 15, maxLv: 17, biome: 'forest',
        pool: [[403, 20], [10, 20], [13, 20], [60, 20], [270, 20], [273, 20], [278, 20], [152, 10]],
        boss: { speciesId: 15, level: 18 },
      },
      {
        // Tarsal, Wailmer, Écrapince, Chétiflor, Fantominus, Rozbouton, Chrysacier, Arcko
        name: 'Clairière de Bonville', minLv: 17, maxLv: 18, biome: 'forest',
        pool: [[280, 20], [320, 20], [341, 20], [69, 20], [92, 20], [406, 20], [11, 10], [252, 10]],
        boss: { speciesId: 320, level: 19 },
      },
    ],
    arena: {
      name: 'Arène de Bonville', leader: 'Flo', type: 'Plante',
      team: [[465, 17], [407, 18], [470, 19]], // Bouldeneu, Roserade, Phyllali
      badge: 'Badge Forêt',
    },
  },
  {
    // Nv.19→24 — route sans badge (Normal/Vol).
    name: 'Route Bosselée',
    zones: [
      {
        // Magby, Azurill, Ptiravi, Babimanta, Rapasdepic, Fouinar, Ouisticram
        name: 'Pré du Lac', minLv: 19, maxLv: 21, biome: 'meadow',
        pool: [[240, 20], [298, 20], [440, 20], [458, 20], [22, 10], [162, 10], [390, 10]],
        boss: { speciesId: 113, level: 22 },
      },
      {
        // Ponyta, Doduo, Pichu, Mélo, Toudoudou, Togepi, Élekid
        name: 'Route des Cyclistes', minLv: 21, maxLv: 22, biome: 'meadow',
        pool: [[77, 20], [84, 20], [172, 20], [173, 20], [174, 20], [175, 20], [239, 20]],
        boss: { speciesId: 77, level: 23 },
      },
      {
        // Nirondelle, Manzaï, Goinfrex, Parecool, Maraiste, Armulys
        name: 'Falaise Venteuse', minLv: 22, maxLv: 23, biome: 'meadow',
        pool: [[276, 20], [438, 20], [446, 20], [287, 20], [195, 10], [266, 10]],
        boss: { speciesId: 277, level: 24 },
      },
    ],
    arena: {
      name: 'Camp des Cyclistes', leader: 'Blanche', type: 'Normal',
      team: [[398, 22], [474, 23], [468, 24]], // Étouraptor, Porygon-Z, Togekiss
      badge: 'Titre de Cycliste',
      grantsBadge: false,
    },
  },
  {
    // Nv.24→30 — biome Combat (badge Cascade).
    name: 'Dojo de Voilaroc',
    zones: [
      {
        // Zarbi, Debugant, Lippouti, Méditikka, Okéoké, Korillon, Mime Jr.
        name: 'Rue des Boxeurs', minLv: 24, maxLv: 26, biome: 'dojo',
        pool: [[201, 20], [236, 20], [238, 20], [307, 20], [360, 20], [433, 20], [439, 20]],
        boss: { speciesId: 122, level: 27 },
      },
      {
        // Abo, Sabelette, Mystherbe, Paras, Onix, Wattouat, Balignon
        name: 'Salle d’Entraînement', minLv: 26, maxLv: 28, biome: 'dojo',
        pool: [[23, 20], [27, 20], [43, 20], [46, 20], [95, 20], [179, 20], [285, 20]],
        boss: { speciesId: 181, level: 29 },
      },
      {
        // Ceribou, Makuhita, Papilusion, Dardargnan, Akwakwak, Tentacruel, Noarfang
        name: 'Sommet du Dojo', minLv: 28, maxLv: 29, biome: 'dojo',
        pool: [[420, 20], [296, 20], [12, 10], [15, 10], [55, 10], [73, 10], [164, 10]],
        boss: { speciesId: 297, level: 30 },
      },
    ],
    arena: {
      name: 'Arène de Voilaroc', leader: 'Mélina', type: 'Combat',
      team: [[454, 28], [448, 29], [475, 30]], // Coatox, Lucario, Gallame
      badge: 'Badge Cascade',
    },
  },
  {
    // Nv.30→36 — biome Eau (badge Marais).
    name: 'Marais de Verchamps',
    zones: [
      {
        // Psykokwak, Tentacool, Granivol, Axoloto, Qwilfish, Ramoloss, Cheniti, Carapuce, Tiplouf
        name: 'Rives de Verchamps', minLv: 30, maxLv: 32, biome: 'water',
        pool: [[54, 20], [72, 20], [187, 20], [194, 20], [211, 20], [79, 20], [412, 20], [7, 10], [393, 10]],
        boss: { speciesId: 73, level: 33 },
      },
      {
        // Apitrini, Chuchmur, Skitty, Galekid, Roucoups, Pikachu, Coxyclaque, Kaiminus
        name: 'Lac Boueux', minLv: 32, maxLv: 34, biome: 'water',
        pool: [[415, 20], [293, 20], [300, 20], [304, 20], [17, 10], [25, 10], [166, 10], [158, 10]],
        boss: { speciesId: 18, level: 35 },
      },
      {
        // Abra, Tournegrin, Mustébouée, Sancoki, Baudrive, Écayon, Krabby, Gobou
        name: 'Arène Aquatique', minLv: 34, maxLv: 35, biome: 'water',
        pool: [[63, 20], [191, 20], [418, 20], [422, 20], [425, 20], [456, 20], [98, 20], [258, 10]],
        boss: { speciesId: 426, level: 36 },
      },
    ],
    arena: {
      name: 'Arène de Verchamps', leader: 'Lovis', type: 'Eau',
      team: [[457, 34], [423, 35], [419, 36]], // Luminéon, Tritosor, Mustéflott
      badge: 'Badge Marais',
    },
  },
  {
    // Nv.36→41 — route sans badge (Poison/Sol).
    name: 'Route des Marais',
    zones: [
      {
        // Ningale, Mimitoss, Ténéfix, Pachirisu, Xatu, Aéromite, Boustiflor
        name: 'Tourbière', minLv: 36, maxLv: 38, biome: 'swamp',
        pool: [[290, 20], [48, 20], [302, 20], [417, 20], [178, 10], [49, 10], [70, 10]],
        boss: { speciesId: 291, level: 39 },
      },
      {
        // Machoc, Osselait, Stari, Métamorph, Corayon, Tarinor, Tritosor
        name: 'Chemin de Sable', minLv: 38, maxLv: 39, biome: 'desert',
        pool: [[66, 20], [104, 20], [120, 20], [132, 20], [222, 20], [299, 20], [423, 10]],
        boss: { speciesId: 121, level: 40 },
      },
      {
        // Nidoran♀, Nidoran♂, Gloupti, Yanma, Muciole, Lumivole, Machopeur
        name: 'Grotte Toxique', minLv: 39, maxLv: 40, biome: 'swamp',
        pool: [[29, 20], [32, 20], [316, 20], [193, 20], [313, 20], [314, 20], [67, 10]],
        boss: { speciesId: 469, level: 41 },
      },
    ],
    arena: {
      name: 'Poste des Randonneurs', leader: 'Koga', type: 'Poison',
      team: [[454, 39], [452, 40], [407, 41]], // Coatox, Drascore, Roserade
      badge: 'Titre de Randonneur',
      grantsBadge: false,
    },
  },
  {
    // Nv.41→47 — biome Spectre/Psy (badge Relique).
    name: 'Manoir d’Unionpolis',
    zones: [
      {
        // Soporifik, Goupix, Caninos, Cerfrousse, Dynavolt, Posipi, Négapi
        name: 'Jardin Brumeux', minLv: 41, maxLv: 43, biome: 'haunted',
        pool: [[96, 20], [37, 20], [58, 20], [234, 20], [309, 20], [311, 20], [312, 20]],
        boss: { speciesId: 59, level: 44 },
      },
      {
        // Laporeille, Miaouss, Magnéti, Simularbre, Ortide, Férosinge
        name: 'Salons Abandonnés', minLv: 43, maxLv: 45, biome: 'haunted',
        pool: [[427, 20], [52, 20], [81, 20], [185, 10], [44, 10], [56, 20]],
        boss: { speciesId: 462, level: 46 },
      },
      {
        // Smogo, Archéomire, Rattatac, Colossinge, Marill, Hypnomade
        name: 'Cave du Manoir', minLv: 45, maxLv: 46, biome: 'haunted',
        pool: [[109, 20], [436, 20], [20, 10], [57, 10], [183, 10], [97, 10]],
        boss: { speciesId: 57, level: 47 },
      },
    ],
    arena: {
      name: 'Arène d’Unionpolis', leader: 'Kiméra', type: 'Spectre',
      team: [[426, 45], [477, 46], [429, 47]], // Grodrive, Noctunoir, Magirêve
      badge: 'Badge Relique',
    },
  },
  {
    // Nv.47→52 — route sans badge (Feu).
    name: 'Mont Foyer',
    zones: [
      {
        // Canarticho, Kangourex, Tauros, Snubbull, Écrémeuh, Chamallot, Chartor
        name: 'Pente Brûlante', minLv: 47, maxLv: 49, biome: 'volcano',
        pool: [[83, 20], [115, 20], [128, 20], [209, 20], [241, 20], [322, 20], [324, 20]],
        boss: { speciesId: 115, level: 50 },
      },
      {
        // Spinda, Ossatueur, Magmar, Ronflex, Lainergie, Girafarig
        name: 'Cratère du Mont Foyer', minLv: 49, maxLv: 50, biome: 'volcano',
        pool: [[327, 20], [105, 10], [126, 10], [143, 10], [180, 10], [203, 20]],
        boss: { speciesId: 143, level: 51 },
      },
      {
        // Tylton, Séviper, Barloche, Motisma, Malosse, Ectoplasma
        name: 'Sources de Lave', minLv: 50, maxLv: 51, biome: 'volcano',
        pool: [[333, 20], [336, 20], [339, 20], [479, 20], [228, 20], [94, 10]],
        boss: { speciesId: 94, level: 52 },
      },
    ],
    arena: {
      name: 'Poste des Volcanologues', leader: 'Auguste', type: 'Feu',
      team: [[136, 50], [59, 51], [467, 52]], // Pyroli, Arcanin, Maganon
      badge: 'Titre de Volcanologue',
      grantsBadge: false,
    },
  },
  {
    // Nv.52→58 — biome Acier (badge Mine).
    name: 'Port Canalave',
    zones: [
      {
        // Voltorbe, Cornèbre, Lombre, Pifeuil, Persian, Kadabra, Spectrum
        name: 'Quai d’Acier', minLv: 52, maxLv: 54, biome: 'cave',
        pool: [[100, 20], [198, 20], [271, 10], [274, 10], [53, 10], [64, 10], [93, 10]],
        boss: { speciesId: 65, level: 55 },
      },
      {
        // Taupiqueur, Rhinocorne, Solaroc, Élektek, Mélokrik, Triopikeur, Kirlia
        name: 'Chantier Naval', minLv: 54, maxLv: 56, biome: 'cave',
        pool: [[50, 20], [111, 20], [338, 20], [125, 10], [402, 10], [51, 10], [281, 10]],
        boss: { speciesId: 464, level: 57 },
      },
      {
        // Tadmorv, Griknot, Kraknoix, Cacnea, Balbuto, Étourvol, Castorno
        name: 'Forge du Port', minLv: 56, maxLv: 57, biome: 'cave',
        pool: [[88, 20], [443, 20], [328, 20], [331, 20], [343, 20], [397, 10], [400, 10]],
        boss: { speciesId: 445, level: 58 },
      },
    ],
    arena: {
      name: 'Arène de Canalave', leader: 'Charles', type: 'Acier',
      team: [[476, 56], [448, 57], [462, 58]], // Tarinorme, Lucario, Magnézone
      badge: 'Badge Mine',
    },
  },
  {
    // Nv.58→63 — route sans badge (Ténèbres/Normal).
    name: 'Passe des Ombres',
    zones: [
      {
        // Spiritomb, Porygon, Chaglam, Moufouette, Grotadmorv, Léviator, Gravalanch
        name: 'Sentier Sombre', minLv: 58, maxLv: 60, biome: 'cave',
        pool: [[442, 20], [137, 20], [431, 20], [434, 20], [89, 10], [130, 10], [75, 10]],
        boss: { speciesId: 130, level: 61 },
      },
      {
        // Évoli, Natu, Feuforêve, Queulorior, Spoink, Morphéo, Nosferalto
        name: 'Tunnel Obscur', minLv: 60, maxLv: 61, biome: 'cave',
        pool: [[133, 20], [177, 20], [200, 20], [235, 20], [325, 20], [351, 20], [42, 10]],
        boss: { speciesId: 169, level: 62 },
      },
      {
        // Hippopotas, Excelangue, Saquedeneu, Scorplane, Teddiursa, Airmure, Phanpy
        name: 'Repaire des Ombres', minLv: 61, maxLv: 62, biome: 'cave',
        pool: [[449, 20], [108, 20], [114, 20], [207, 20], [216, 20], [227, 20], [231, 20]],
        boss: { speciesId: 472, level: 63 },
      },
    ],
    arena: {
      name: 'Poste des Alpinistes', leader: 'Morty', type: 'Ténèbres',
      team: [[430, 61], [452, 62], [461, 63]], // Corboss, Drascore, Dimoret
      badge: 'Titre d’Alpiniste',
      grantsBadge: false,
    },
  },
  {
    // Nv.63→69 — biome Glace (badge Glacier). Manaphy, Phione et Cresselia en boss légendaires (`joinsPool`).
    name: 'Glaciers de Frimapic',
    zones: [
      {
        // Lokhlass, Marcacrin, Cadoizo, Otaria, Hypotrempe, Rémoraid, Flagadoss
        name: 'Rivage Glacé', minLv: 63, maxLv: 65, biome: 'cave',
        pool: [[131, 20], [220, 20], [225, 20], [86, 20], [116, 20], [223, 20], [80, 10]],
        boss: { speciesId: 490, level: 66, joinsPool: true },
      },
      {
        // Kokiyas, Loupio, Pijako, Nidorina, Nidorino, Leveinard, Lanturn
        name: 'Champ de Neige', minLv: 65, maxLv: 67, biome: 'cave',
        pool: [[90, 20], [170, 20], [441, 20], [30, 10], [33, 10], [113, 10], [171, 10]],
        boss: { speciesId: 489, level: 68, joinsPool: true },
      },
      {
        // Carvanha, Kecleon, Cradopaud, Barpau, Qulbutoké, Octillery, Hélédelle
        name: 'Île Lunaire', minLv: 67, maxLv: 68, biome: 'cave',
        pool: [[318, 20], [352, 20], [453, 20], [349, 20], [202, 10], [224, 10], [277, 10]],
        boss: { speciesId: 488, level: 69, joinsPool: true },
      },
    ],
    arena: {
      name: 'Arène de Frimapic', leader: 'Gladys', type: 'Glace',
      team: [[471, 67], [461, 68], [473, 69]], // Givrali, Dimoret, Mammochon
      badge: 'Badge Glacier',
    },
  },
  {
    // Nv.69→75 — biome Électrik (badge Phare). Créhelm, Créfollet et Créfadet en boss légendaires.
    name: 'Centrale de Rivamar',
    zones: [
      {
        // Tropius, Absol, Polichombr, Skelénox, Rapion, Vortente, Floravol
        name: 'Plage de Rivamar', minLv: 69, maxLv: 71, biome: 'electric',
        pool: [[357, 20], [359, 20], [353, 20], [355, 20], [451, 20], [455, 20], [188, 10]],
        boss: { speciesId: 480, level: 72, joinsPool: true },
      },
      {
        // Limagma, Kranidos, Dinoclier, Grahyèna, Drascore, Coatox, Éoko
        name: 'Lac Savoir', minLv: 71, maxLv: 73, biome: 'electric',
        pool: [[218, 20], [408, 20], [410, 20], [262, 10], [452, 10], [454, 10], [358, 10]],
        boss: { speciesId: 481, level: 74, joinsPool: true },
      },
      {
        // Scarabrute, Amonita, Kabuto, Lilia, Anorith, Stalgamin, Obalie
        name: 'Lac Courage', minLv: 73, maxLv: 74, biome: 'electric',
        pool: [[127, 20], [138, 20], [140, 20], [345, 20], [347, 20], [361, 20], [363, 20]],
        boss: { speciesId: 482, level: 75, joinsPool: true },
      },
    ],
    arena: {
      name: 'Arène de Rivamar', leader: 'Tanguy', type: 'Électrik',
      team: [[405, 73], [466, 74], [462, 75]], // Luxray, Élekable, Magnézone
      badge: 'Badge Phare',
    },
  },
  {
    // Nv.75→82 — route sans badge (Dragon/Ténèbres/Roche). Heatran, Regigigas et Darkrai en boss légendaires.
    name: 'Mont Couronné',
    zones: [
      {
        // Insécateur, Ptéra, Dodrio, Charmillon, Papinox, Mustéflott, Ursaring, Artikodin, Raikou, Celebi, Latios, Deoxys
        name: 'Flanc Rocailleux', minLv: 75, maxLv: 77, biome: 'cave',
        pool: [[123, 20], [142, 20], [85, 10], [267, 10], [269, 10], [419, 10], [217, 10], [144, 20], [243, 20], [251, 20], [381, 20], [386, 20]],
        boss: { speciesId: 485, level: 78, joinsPool: true },
      },
      {
        // Coquiperl, Relicanth, Lovdisc, Blizzi, Volcaropod, Donphan, M. Mime, Électhor, Entei, Regirock, Kyogre
        name: 'Temple Perdu', minLv: 77, maxLv: 80, biome: 'temple',
        pool: [[366, 20], [369, 20], [370, 20], [459, 20], [219, 10], [232, 10], [122, 10], [145, 20], [244, 20], [377, 20], [382, 20]],
        boss: { speciesId: 486, level: 81, joinsPool: true },
      },
      {
        // Draby, Minidraco, Cochignon, Wailord, Lamantine, Archéodong, Altaria
        name: 'Vallée Sombre', minLv: 80, maxLv: 81, biome: 'cave',
        pool: [[371, 20], [147, 20], [221, 10], [321, 10], [87, 10], [437, 10], [334, 10]],
        boss: { speciesId: 491, level: 82, joinsPool: true },
      },
    ],
    arena: {
      name: 'Poste du Mont', leader: 'Guirande', type: 'Dragon',
      team: [[373, 80], [149, 81], [445, 82]], // Drattak, Dracolosse, Carchacrok
      badge: 'Titre de Gardien',
      grantsBadge: false,
    },
  },
  {
    // Nv.82→91 — Route Victoire / Conseil des 4 Sinnoh. Shaymin et Giratina en boss légendaires.
    name: 'Route Victoire Sinnoh',
    zones: [
      {
        // Caratroc, Arakdo, Kaorine, Branette, Barbicha, Blizzaroi, Parasect
        name: 'Jardin Fleuri', minLv: 82, maxLv: 85, biome: 'meadow',
        pool: [[213, 20], [283, 20], [344, 10], [354, 10], [340, 10], [460, 10], [47, 10]],
        boss: { speciesId: 492, level: 86, joinsPool: true },
      },
      {
        // Magnéton, Draco, Démanta, Ramboum, Hariyama, Galegon, Colhomard
        name: 'Chemin du Temps', minLv: 85, maxLv: 88, biome: 'temple',
        pool: [[82, 10], [148, 10], [226, 10], [294, 10], [297, 10], [305, 10], [342, 10]],
        boss: { speciesId: 487, level: 89, joinsPool: true },
      },
      {
        // Farfuret, Mysdibule, Mangriff, Terhal, Riolu, Vibraninf, Cacturne, Scarhino, Suicune, Regice, Groudon
        name: 'Galerie Finale', minLv: 88, maxLv: 90, biome: 'cave',
        pool: [[215, 20], [303, 20], [335, 20], [374, 20], [447, 20], [329, 10], [332, 10], [214, 10], [245, 20], [378, 20], [383, 20]],
        boss: { speciesId: 146, level: 91, joinsPool: true },
      },
    ],
    arena: {
      name: 'Conseil des 4 (Sinnoh)', leader: 'Conseil des 4', type: 'mixte',
      team: [[473, 89], [464, 90], [445, 91]], // Mammochon, Rhinastoc, Carchacrok
      badge: 'Titre de Maître Sinnoh',
      grantsBadge: false,
    },
  },
  {
    // Nv.91→100 — Champion Sinnoh (Cynthia). Dialga, Palkia et Arceus en boss légendaires.
    name: 'Ligue de Sinnoh',
    zones: [
      {
        // Galopa, Smogogo, Rhinoféros, Cotovol, Démolosse, Maskadra, Rosélia, Mewtwo, Lugia, Registeel, Rayquaza
        name: 'Pilier Lance', minLv: 91, maxLv: 94, biome: 'temple',
        pool: [[78, 10], [110, 10], [112, 10], [189, 10], [229, 10], [284, 10], [315, 10], [150, 20], [249, 20], [379, 20], [384, 20]],
        boss: { speciesId: 483, level: 95, joinsPool: true },
      },
      {
        // Embrylex, Séléroc, Téraclope, Phogleur, Métang, Grolem, Azumarill, Mew, Ho-Oh, Latias, Jirachi
        name: 'Faille Spatiale', minLv: 94, maxLv: 97, biome: 'temple',
        pool: [[246, 20], [337, 20], [356, 10], [364, 10], [375, 10], [76, 10], [184, 10], [151, 20], [250, 20], [380, 20], [385, 20]],
        boss: { speciesId: 484, level: 98, joinsPool: true },
      },
      {
        // Chapignon, Vigoroth, Charmina, Ymphect, Hippodocus, Camérupt
        name: 'Salle du Champion', minLv: 97, maxLv: 99, biome: 'league',
        pool: [[286, 10], [288, 10], [308, 10], [247, 10], [450, 10], [323, 10]],
        boss: { speciesId: 493, level: 100, joinsPool: true },
      },
    ],
    arena: {
      name: 'Ligue de Sinnoh', leader: 'Cynthia', type: 'Dragon',
      team: [[442, 97], [407, 98], [448, 99], [445, 100]], // Spiritomb, Roserade, Lucario, Carchacrok
      badge: 'Titre de Champion Sinnoh',
      grantsBadge: false,
    },
  },
];

/** Bonus permanent par badge (toute l'équipe). */
export const BADGE_BONUS = { atkPct: 5 };
