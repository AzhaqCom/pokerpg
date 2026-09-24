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
  biome: 'forest' | 'meadow' | 'cave' | 'water' | 'electric' | 'swamp' | 'temple' | 'volcano' | 'desert';
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
        pool: [[10, 30], [13, 30], [16, 25], [19, 15]],
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
        pool: [[54, 30], [60, 30], [72, 25], [1, 5], [4, 5], [7, 5]],
        boss: { speciesId: 61, level: 23 },
      },
      {
        name: 'Récif Corallien', minLv: 21, maxLv: 24, biome: 'water',
        pool: [[90, 25], [79, 25], [86, 25], [55, 15], [61, 10]],
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
        pool: [[81, 30], [39, 30], [98, 25], [100, 15]],
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
        pool: [[35, 30], [52, 30], [102, 25], [108, 15]],
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
        pool: [[41, 30], [109, 30], [88, 25], [92, 15]],
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
        pool: [[96, 30], [56, 30], [66, 25], [128, 15]],
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
        pool: [[37, 30], [58, 30], [77, 25], [124, 15]],
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
        pool: [[27, 30], [50, 30], [104, 25], [84, 15]],
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
        pool: [[147, 40], [142, 30], [131, 30]],
        boss: { speciesId: 149, level: 84 },
      },
      {
        name: 'Passage Rocheux', minLv: 82, maxLv: 86, biome: 'cave',
        pool: [[140, 40], [143, 30], [147, 30]],
        boss: { speciesId: 144, level: 87, joinsPool: true },
      },
      {
        name: 'Sommet Balayé par les Vents', minLv: 86, maxLv: 89, biome: 'cave',
        pool: [[138, 40], [122, 30], [143, 30]],
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
        name: 'Antichambre du Plateau', minLv: 90, maxLv: 93, biome: 'temple',
        pool: [[132, 40], [137, 30], [149, 30]],
        boss: { speciesId: 146, level: 94, joinsPool: true },
      },
      {
        name: 'Grotte Bleue', minLv: 93, maxLv: 96, biome: 'cave',
        pool: [[131, 40], [143, 30], [138, 30]],
        boss: { speciesId: 150, level: 97, joinsPool: true },
      },
      {
        name: 'Antre de Mew', minLv: 96, maxLv: 99, biome: 'meadow',
        pool: [[122, 40], [140, 30], [142, 30]],
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
        // Starters Johto (`REGIONS[1].starters`) en rencontre très rare dès la 1re zone, comme les starters Kanto
        // en biome 2 : sans ça, indisponibles pour qui n'a pas choisi cette lignée au prestige.
        name: 'Sentier des Roseaux', minLv: 5, maxLv: 9, biome: 'meadow',
        pool: [[187, 25], [41, 25], [16, 25], [163, 20], [152, 5], [155, 5], [158, 5], [1, 5], [4, 5], [7, 5]],
        boss: { speciesId: 21, level: 10 },
      },
      {
        name: 'Falaise aux Vents', minLv: 9, maxLv: 14, biome: 'meadow',
        pool: [[165, 25], [21, 20], [177, 20], [84, 15], [188, 10], [207, 10], [29, 10], [32, 10]],
        boss: { speciesId: 225, level: 15 },
      },
      {
        name: 'Cimes de Ver-de-Gris', minLv: 14, maxLv: 19, biome: 'meadow',
        pool: [[17, 25], [83, 20], [176, 15], [166, 15], [198, 10], [193, 10], [169, 5]],
        boss: { speciesId: 18, level: 20 },
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
        pool: [[14, 25], [11, 25], [10, 20], [13, 20], [190, 10], [46, 15], [43, 10]],
        boss: { speciesId: 46, level: 22 },
      },
      {
        name: 'Clairière aux Cocons', minLv: 22, maxLv: 26, biome: 'forest',
        pool: [[167, 20], [204, 20], [48, 20], [213, 15], [168, 10], [216, 15], [69, 10], [102, 10]],
        boss: { speciesId: 47, level: 26 },
      },
      {
        name: 'Cœur de la Forêt', minLv: 26, maxLv: 30, biome: 'forest',
        pool: [[166, 20], [193, 15], [12, 15], [15, 15], [205, 10], [49, 10], [234, 15], [114, 10], [123, 5], [127, 5]],
        boss: { speciesId: 212, level: 30 },
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
        // Route 34 (Day Care) canon, juste à côté de Doré/Goldenrod : Pichu y trouve sa place.
        name: 'Champs de Doré', minLv: 30, maxLv: 31, biome: 'meadow',
        pool: [[161, 20], [173, 20], [175, 20], [174, 15], [16, 15], [172, 5], [191, 5], [39, 15], [25, 5]],
        boss: { speciesId: 39, level: 31 },
      },
      {
        name: 'Ferme Laitière', minLv: 31, maxLv: 33, biome: 'meadow',
        pool: [[19, 20], [52, 20], [209, 15], [35, 15], [133, 20], [84, 5], [182, 10], [235, 5], [108, 10], [115, 5]],
        boss: { speciesId: 162, level: 33 },
      },
      {
        name: 'Verger Paisible', minLv: 33, maxLv: 35, biome: 'meadow',
        pool: [[20, 20], [203, 20], [53, 15], [210, 15], [36, 10], [164, 10], [206, 5], [242, 5], [143, 5], [113, 5], [128, 10], [132, 5]],
        boss: { speciesId: 143, level: 35 },
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
        name: 'Rez-de-Tour', minLv: 35, maxLv: 37, biome: 'temple',
        pool: [[92, 25], [200, 20], [185, 20], [201, 15], [93, 10], [63, 10]],
        boss: { speciesId: 93, level: 38 },
      },
      {
        name: 'Étages Hantés', minLv: 37, maxLv: 39, biome: 'temple',
        pool: [[93, 25], [200, 15], [201, 20], [185, 15], [94, 10], [202, 5], [96, 10]],
        boss: { speciesId: 93, level: 40 },
      },
      {
        name: 'Sommet de la Tour', minLv: 39, maxLv: 42, biome: 'temple',
        pool: [[93, 15], [94, 30], [200, 10], [201, 15], [185, 10], [122, 5]],
        boss: { speciesId: 94, level: 42 },
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
        name: 'Cour d’Entraînement', minLv: 42, maxLv: 47, biome: 'temple',
        pool: [[236, 30], [66, 30], [56, 25], [67, 15], [27, 10], [50, 10]],
        boss: { speciesId: 57, level: 47 },
      },
      {
        name: 'Salle des Katas', minLv: 47, maxLv: 52, biome: 'temple',
        pool: [[237, 25], [106, 20], [62, 15], [68, 15], [74, 10], [95, 5]],
        boss: { speciesId: 68, level: 52 },
      },
      {
        name: 'Antichambre du Maître', minLv: 52, maxLv: 58, biome: 'temple',
        pool: [[214, 25], [57, 20], [68, 20], [62, 10], [237, 10], [104, 10], [111, 10]],
        boss: { speciesId: 62, level: 58 },
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
        pool: [[205, 25], [227, 20], [179, 20], [75, 15], [212, 10], [180, 10], [81, 15]],
        boss: { speciesId: 227, level: 60 },
      },
      {
        name: 'Escalier de Fer', minLv: 59, maxLv: 61, biome: 'cave',
        pool: [[212, 25], [208, 15], [180, 20], [227, 15], [75, 15], [179, 10], [100, 10], [125, 5]],
        boss: { speciesId: 212, level: 61 },
      },
      {
        name: 'Sommet du Phare', minLv: 61, maxLv: 63, biome: 'cave',
        pool: [[208, 25], [212, 20], [227, 15], [180, 20], [75, 10], [179, 10], [137, 5], [142, 5]],
        boss: { speciesId: 208, level: 63 },
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
        pool: [[220, 30], [238, 30], [225, 20], [87, 20], [86, 15], [54, 10], [72, 10]],
        boss: { speciesId: 91, level: 66 },
      },
      {
        // Légendaires (Gen 1 et 2) regroupés sur les 4 derniers biomes Johto (Nv.63→100), en boss
        // `joinsPool` : ils rejoignent le pool de leur zone une fois vaincus (farm/chromatique).
        name: 'Galerie de Glace', minLv: 65, maxLv: 67, biome: 'cave',
        pool: [[221, 30], [91, 25], [215, 20], [124, 15], [131, 10], [79, 10], [90, 10]],
        boss: { speciesId: 245, level: 68, joinsPool: true },
      },
      {
        name: 'Lac Souterrain Gelé', minLv: 67, maxLv: 70, biome: 'cave',
        pool: [[131, 30], [221, 20], [124, 15], [215, 15], [98, 10], [120, 10]],
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
        pool: [[147, 25], [230, 20], [134, 15], [141, 15], [148, 10], [139, 5], [170, 5], [183, 5], [60, 10], [118, 10], [129, 10]],
        boss: { speciesId: 145, level: 72, joinsPool: true },
      },
      {
        name: 'Bassin Sacré', minLv: 71, maxLv: 73, biome: 'water',
        pool: [[148, 25], [230, 20], [139, 10], [134, 15], [147, 10], [141, 10], [194, 5], [223, 5], [116, 10], [140, 5]],
        boss: { speciesId: 146, level: 73, joinsPool: true },
      },
      {
        name: 'Antre de Rosalia', minLv: 73, maxLv: 75, biome: 'water',
        pool: [[148, 20], [149, 20], [230, 15], [141, 15], [139, 10], [134, 10], [222, 10], [138, 5]],
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
        pool: [[228, 20], [198, 20], [246, 20], [215, 15], [229, 10], [23, 10]],
        boss: { speciesId: 243, level: 80, joinsPool: true },
      },
      {
        name: 'Couloir des Ombres', minLv: 79, maxLv: 83, biome: 'cave',
        pool: [[229, 20], [247, 20], [215, 15], [198, 15], [228, 10], [88, 10]],
        boss: { speciesId: 244, level: 84, joinsPool: true },
      },
      {
        name: 'Trône de Carla', minLv: 83, maxLv: 87, biome: 'cave',
        pool: [[248, 20], [229, 20], [247, 15], [246, 15], [215, 15], [109, 10]],
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
        name: 'Antichambre Dorée', minLv: 87, maxLv: 91, biome: 'temple',
        pool: [[241, 25], [217, 25], [209, 15], [210, 15], [231, 10], [239, 10], [37, 10], [58, 10]],
        boss: { speciesId: 251, level: 92, joinsPool: true },
      },
      {
        name: 'Galerie des Champions', minLv: 91, maxLv: 95, biome: 'temple',
        pool: [[224, 20], [211, 20], [171, 15], [186, 15], [226, 10], [218, 10], [240, 10], [77, 10], [126, 5]],
        boss: { speciesId: 151, level: 96, joinsPool: true },
      },
      {
        name: 'Sanctuaire de Ho-Oh', minLv: 95, maxLv: 99, biome: 'temple',
        pool: [[157, 25], [160, 25], [154, 20], [181, 20], [233, 10], [136, 5]],
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
        // Embrylex, Racaillou, Tarinor, Lilia, Bulbizarre, Salamèche, Carapuce, Germignon, Héricendre, Kaiminus, Arcko, Poussifeu, Gobou
        name: 'Sentier Caillouteux', minLv: 5, maxLv: 8, biome: 'cave',
        pool: [[246, 20], [74, 20], [299, 8], [345, 8], [1, 4], [4, 4], [7, 4], [152, 4], [155, 4], [158, 4], [252, 4], [255, 4], [258, 4]],
        boss: { speciesId: 346, level: 9 },
      },
      {
        // Kabuto, Amonita, Onix, Anorith
        name: 'Galerie de Granite', minLv: 8, maxLv: 12, biome: 'cave',
        pool: [[140, 20], [138, 20], [95, 8], [347, 8]],
        boss: { speciesId: 348, level: 13 },
      },
      {
        // Simularbre, Séléroc, Solaroc, Ptéra
        name: 'Falaise de Mérouville', minLv: 12, maxLv: 14, biome: 'cave',
        pool: [[185, 20], [337, 20], [338, 8], [142, 8]],
        boss: { speciesId: 142, level: 15 },
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
        // Debugant, Nosferapti, Makuhita, Méditikka
        name: 'Plage de Myokara', minLv: 15, maxLv: 17, biome: 'water',
        pool: [[236, 20], [41, 20], [296, 8], [307, 8]],
        boss: { speciesId: 308, level: 18 },
      },
      {
        // Gloupti, Smogo, Machoc, Férosinge
        name: 'Grotte du Dojo', minLv: 17, maxLv: 20, biome: 'cave',
        pool: [[316, 20], [109, 20], [66, 8], [56, 8]],
        boss: { speciesId: 57, level: 21 },
      },
      {
        // Séviper, Tygnon, Kicklee, Nostenfer
        name: 'Salle des Poings', minLv: 20, maxLv: 21, biome: 'temple',
        pool: [[336, 20], [107, 20], [106, 8], [169, 8]],
        boss: { speciesId: 169, level: 22 },
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
        // Chenipan, Blindalys, Aspicot, Chenipotte, Mimigal, Ningale, Munja
        name: 'Orée des Bois', minLv: 22, maxLv: 24, biome: 'forest',
        pool: [[10, 6], [12, 14], [269, 14], [13, 6], [15, 14], [265, 6], [267, 14], [167, 6], [168, 14], [290, 8], ],
        boss: { speciesId: 292, level: 25 },
      },
      {
        // Coxy, Arakdo, Paras, Pomdepik, Mimitoss, Noeunoeuf, Yanma
        name: 'Sous-bois Humide', minLv: 24, maxLv: 26, biome: 'forest',
        pool: [[165, 6], [166, 14], [283, 6], [284, 14], [46, 6], [47, 14], [204, 20], [48, 20], [102, 8], [193, 8]],
        boss: { speciesId: 193, level: 27 },
      },
      {
        // Muciole, Lumivole, Caratroc, Insécateur, Scarabrute, Cizayox, Scarhino
        name: 'Clairière aux Chenilles', minLv: 26, maxLv: 27, biome: 'forest',
        pool: [[313, 20], [314, 20], [213, 20], [123, 20], [127, 20], [212, 8], [214, 8]],
        boss: { speciesId: 214, level: 28 },
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
        // Pichu, Wattouat, Terhal, Dynavolt, Pikachu
        name: 'Route Cyclable', minLv: 28, maxLv: 30, biome: 'electric',
        pool: [[172, 20], [179, 6], [181, 14], [374, 6], [375, 14], [309, 8], [25, 8]],
        boss: { speciesId: 26, level: 31 },
      },
      {
        // Voltorbe, Magnéti, Élekid, Posipi, Négapi
        name: 'Nouvelle Centrale', minLv: 30, maxLv: 32, biome: 'electric',
        pool: [[100, 6], [101, 14], [81, 6], [82, 14], [239, 20], [311, 8], [312, 8]],
        boss: { speciesId: 312, level: 33 },
      },
      {
        // Élektek, Steelix, Voltali
        name: 'Salle des Turbines', minLv: 32, maxLv: 33, biome: 'electric',
        pool: [[125, 20], [208, 20], [135, 20]],
        boss: { speciesId: 135, level: 34 },
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
        // Limagma, Balbuto, Chamallot, Goupix, Kraknoix
        name: 'Pente de Cendres', minLv: 34, maxLv: 36, biome: 'volcano',
        pool: [[218, 20], [343, 6], [344, 14], [322, 6], [323, 14], [37, 8], [328, 8]],
        boss: { speciesId: 330, level: 37 },
      },
      {
        // Caninos, Phanpy, Magby, Rhinocorne, Ponyta
        name: 'Cratère Fumant', minLv: 36, maxLv: 39, biome: 'volcano',
        pool: [[58, 6], [59, 14], [231, 6], [232, 14], [240, 20], [111, 8], [77, 8]],
        boss: { speciesId: 78, level: 40 },
      },
      {
        // Chartor, Scorplane, Magmar, Pyroli
        name: 'Sources de Vermilava', minLv: 39, maxLv: 40, biome: 'volcano',
        pool: [[324, 20], [207, 20], [126, 8], [136, 8]],
        boss: { speciesId: 136, level: 41 },
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
        // Azurill, Fouinette, Mélo, Zigzaton, Togepi, Roucool, Rondoudou
        name: 'Hautes Herbes', minLv: 41, maxLv: 43, biome: 'meadow',
        pool: [[298, 20], [161, 6], [162, 14], [173, 20], [263, 6], [264, 14], [175, 6], [176, 14], [16, 8], [39, 8]],
        boss: { speciesId: 40, level: 44 },
      },
      {
        // Métamorph, Piafabec, Parecool, Teddiursa, Spinda, Excelangue, Canarticho
        name: 'Ranch Paisible', minLv: 43, maxLv: 46, biome: 'meadow',
        pool: [[132, 20], [21, 6], [22, 14], [287, 6], [289, 14], [216, 6], [217, 14], [327, 20], [108, 8], [83, 8]],
        boss: { speciesId: 83, level: 47 },
      },
      {
        // Porygon, Insolourdo, Kecleon, Cerfrousse, Mangriff, Écrémeuh, Kangourex
        name: 'Dojo de Norman', minLv: 46, maxLv: 47, biome: 'temple',
        pool: [[137, 20], [206, 20], [352, 20], [234, 20], [335, 20], [241, 8], [115, 8]],
        boss: { speciesId: 115, level: 48 },
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
        // Tournegrin, Grainipiot, Granivol, Nidoran♀, Taupiqueur, Nidoran♂
        name: 'Jungle Tropicale', minLv: 48, maxLv: 50, biome: 'forest',
        pool: [[191, 6], [192, 14], [273, 6], [275, 14], [187, 6], [189, 14], [29, 6], [31, 14], [50, 8], [32, 8]],
        boss: { speciesId: 34, level: 51 },
      },
      {
        // Balignon, Chétiflor, Abo, Osselait, Cacnea, Mystherbe
        name: 'Marais Poisseux', minLv: 50, maxLv: 53, biome: 'swamp',
        pool: [[285, 6], [286, 14], [69, 6], [71, 14], [23, 6], [24, 14], [104, 6], [105, 14], [331, 8], [43, 8]],
        boss: { speciesId: 45, level: 54 },
      },
      {
        // Sabelette, Tadmorv, Rosélia, Tropius, Saquedeneu, Joliflor
        name: 'Désert Ensablé', minLv: 53, maxLv: 54, biome: 'desert',
        pool: [[27, 6], [28, 14], [88, 6], [89, 14], [315, 20], [357, 20], [114, 8], [182, 8]],
        boss: { speciesId: 182, level: 55 },
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
        // Toudoudou, Chuchmur, Queulorior, Skitty, Hoothoot, Rattata, Nirondelle
        name: 'Pont Suspendu', minLv: 55, maxLv: 57, biome: 'meadow',
        pool: [[174, 20], [293, 6], [295, 14], [235, 20], [300, 6], [301, 14], [163, 6], [164, 14], [19, 8], [276, 8]],
        boss: { speciesId: 377, level: 58, joinsPool: true },
      },
      {
        // Miaouss, Tylton, Snubbull, Mélofée, Évoli, Doduo, Capumain
        name: 'Canopée Venteuse', minLv: 57, maxLv: 60, biome: 'forest',
        pool: [[52, 6], [53, 14], [333, 6], [334, 14], [209, 6], [210, 14], [35, 6], [36, 14], [133, 20], [134, 14], [84, 8], [190, 8]],
        boss: { speciesId: 378, level: 61, joinsPool: true },
      },
      {
        // Morphéo, Girafarig, Leveinard, Porygon2, Tauros, Ronflex, Leuphorie
        name: 'Nid des Altaria', minLv: 60, maxLv: 61, biome: 'meadow',
        pool: [[351, 20], [203, 20], [113, 20], [233, 20], [128, 20], [143, 8], [242, 8]],
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
        // Tarsal, Okéoké, Skelénox, Polichombr, Soporifik
        name: 'Rivage Spirituel', minLv: 62, maxLv: 65, biome: 'water',
        pool: [[280, 6], [282, 14], [360, 20], [355, 6], [356, 14], [353, 8], [96, 8]],
        boss: { speciesId: 380, level: 66, joinsPool: true },
      },
      {
        // Zarbi, Natu, Fantominus, Spoink, Abra
        name: 'Centre Spatial', minLv: 65, maxLv: 67, biome: 'temple',
        pool: [[201, 20], [177, 6], [178, 14], [92, 6], [94, 14], [325, 8], [63, 8]],
        boss: { speciesId: 381, level: 68, joinsPool: true },
      },
      {
        // Qulbutoké, Éoko, M. Mime, Mentali
        name: 'Jardin Céleste', minLv: 67, maxLv: 69, biome: 'temple',
        pool: [[202, 20], [358, 20], [122, 8], [196, 8]],
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
        // Barpau, Axoloto, Barloche, Goélise, Kokiyas, Ptitard, Artikodin, Raikou, Celebi
        name: 'Courants Chauds', minLv: 70, maxLv: 73, biome: 'water',
        pool: [[349, 6], [350, 14], [194, 6], [195, 14], [339, 6], [340, 14], [278, 6], [279, 14], [90, 8], [60, 8], [144, 3], [243, 3], [251, 3]],
        boss: { speciesId: 62, level: 74 },
      },
      {
        // Hypotrempe, Otaria, Carvanha, Psykokwak, Ramoloss, Stari, Électhor, Entei
        name: 'Grotte Sous-Marine', minLv: 73, maxLv: 75, biome: 'water',
        pool: [[116, 6], [117, 14], [86, 6], [87, 14], [318, 6], [319, 14], [54, 6], [55, 14], [79, 8], [120, 8], [145, 3], [244, 3]],
        boss: { speciesId: 121, level: 76 },
      },
      {
        // Wailmer, Rosabyss, Roigada, Tarpaud, Hyporoi, Lokhlass
        name: 'Abysses Anciens', minLv: 75, maxLv: 77, biome: 'water',
        pool: [[320, 6], [321, 14], [199, 20], [186, 20], [230, 8], [131, 8]],
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
        // Medhyèna, Marcacrin, Stalgamin, Obalie, Cadoizo, Malosse, Sulfura, Suicune
        name: 'Caverne Glacée', minLv: 78, maxLv: 82, biome: 'cave',
        pool: [[261, 6], [262, 14], [220, 6], [221, 14], [361, 6], [362, 14], [363, 6], [365, 14], [225, 8], [228, 8], [146, 3], [245, 3]],
        boss: { speciesId: 229, level: 83 },
      },
      {
        // Lippouti, Ténéfix, Corayon, Cornèbre, Feuforêve, Qwilfish, Mewtwo, Lugia
        name: 'Galerie des Ombres', minLv: 82, maxLv: 85, biome: 'cave',
        pool: [[238, 20], [302, 20], [222, 20], [198, 20], [200, 8], [211, 8], [150, 3], [249, 3]],
        boss: { speciesId: 211, level: 86 },
      },
      {
        // Farfuret, Absol, Lippoutou, Relicanth, Noctali
        name: 'Magma Souterrain', minLv: 85, maxLv: 88, biome: 'volcano',
        pool: [[215, 20], [359, 20], [124, 20], [369, 8], [197, 8]],
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
        // Magicarpe, Nénupiot, Marill, Rémoraid, Minidraco, Écrapince
        name: 'Pilier Céleste', minLv: 89, maxLv: 93, biome: 'temple',
        pool: [[129, 6], [130, 14], [270, 6], [272, 14], [183, 6], [184, 14], [223, 6], [224, 14], [147, 8], [341, 8]],
        boss: { speciesId: 384, level: 94, joinsPool: true },
      },
      {
        // Draby, Coquiperl, Tentacool, Galekid, Lovdisc, Poissirène
        name: 'Météorite Mystérieuse', minLv: 93, maxLv: 96, biome: 'cave',
        pool: [[371, 6], [373, 14], [366, 6], [367, 14], [72, 6], [73, 14], [304, 6], [306, 14], [370, 8], [118, 8]],
        boss: { speciesId: 386, level: 97, joinsPool: true },
      },
      {
        // Loupio, Krabby, Mysdibule, Airmure, Démanta, Mew, Ho-Oh
        name: 'Salle du Champion', minLv: 96, maxLv: 99, biome: 'temple',
        pool: [[170, 6], [171, 14], [98, 6], [99, 14], [303, 20], [227, 8], [226, 8], [151, 3], [250, 3]],
        boss: { speciesId: 226, level: 100 },
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
        // Manzaï, Tarinor, Hippopotas, Lilia, Bulbizarre, Salamèche, Carapuce, Germignon, Héricendre, Kaiminus, Arcko, Poussifeu, Gobou, Tortipouss, Ouisticram, Tiplouf, Coconfort, Chrysacier
        name: 'Entrée de la Mine', minLv: 5, maxLv: 8, biome: 'cave',
        pool: [[438, 20], [299, 20], [449, 8], [345, 8], [1, 4], [4, 4], [7, 4], [152, 4], [155, 4], [158, 4], [252, 4], [255, 4], [258, 4], [387, 4], [390, 4], [393, 4], [14, 8], [11, 8]],
        boss: { speciesId: 346, level: 9 },
      },
      {
        // Kabuto, Onix, Anorith, Simularbre, Coconfort, Chrysacier
        name: 'Galerie de Charbon', minLv: 8, maxLv: 10, biome: 'cave',
        pool: [[140, 20], [95, 20], [347, 8], [185, 8], [14, 8], [11, 8]],
        boss: { speciesId: 185, level: 11 },
      },
      {
        // Séléroc, Tarinorme, Scorvol, Coconfort, Chrysacier, Armulys
        name: 'Fosse aux Fossiles', minLv: 10, maxLv: 12, biome: 'cave',
        pool: [[337, 20], [476, 20], [472, 20], [14, 8], [11, 8], [266, 8]],
        boss: { speciesId: 472, level: 13 },
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
        // Tournegrin, Grainipiot, Apitrini, Granivol, Ningale, Balignon, Ceribou
        name: 'Sentier Moussu', minLv: 13, maxLv: 15, biome: 'forest',
        pool: [[191, 20], [273, 20], [415, 20], [187, 20], [290, 20], [285, 8], [420, 8]],
        boss: { speciesId: 421, level: 16 },
      },
      {
        // Rozbouton, Chétiflor, Cacnea, Blizzi, Mystherbe, Noeunoeuf, Rosélia
        name: 'Bois Ancien', minLv: 15, maxLv: 17, biome: 'forest',
        pool: [[406, 20], [69, 20], [331, 20], [459, 20], [43, 20], [102, 8], [315, 8]],
        boss: { speciesId: 315, level: 18 },
      },
      {
        // Vortente, Tropius, Saquedeneu, Bouldeneu, Roserade, Coconfort
        name: 'Clairière de Bonville', minLv: 17, maxLv: 18, biome: 'forest',
        pool: [[455, 20], [357, 20], [114, 20], [465, 8], [407, 8], [14, 8]],
        boss: { speciesId: 407, level: 19 },
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
        // Azurill, Fouinette, Toudoudou, Ptiravi, Keunotor, Queulorior, Rondoudou
        name: 'Pré du Lac', minLv: 19, maxLv: 21, biome: 'meadow',
        pool: [[298, 20], [161, 20], [174, 20], [440, 20], [399, 20], [235, 8], [39, 8]],
        boss: { speciesId: 40, level: 22 },
      },
      {
        // Rattata, Métamorph, Parecool, Snubbull, Spinda, Laporeille, Excelangue
        name: 'Route des Cyclistes', minLv: 21, maxLv: 22, biome: 'meadow',
        pool: [[19, 20], [132, 20], [287, 20], [209, 20], [327, 20], [427, 8], [108, 8]],
        boss: { speciesId: 108, level: 23 },
      },
      {
        // Capumain, Porygon, Morphéo, Coudlangue, Porygon2, Kangourex, Leuphorie
        name: 'Falaise Venteuse', minLv: 22, maxLv: 23, biome: 'meadow',
        pool: [[190, 20], [137, 20], [351, 20], [463, 20], [233, 20], [115, 8], [242, 8]],
        boss: { speciesId: 242, level: 24 },
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
        // Debugant, Tarsal, Okéoké, Makuhita, Méditikka, Kirlia
        name: 'Rue des Boxeurs', minLv: 24, maxLv: 26, biome: 'temple',
        pool: [[236, 20], [280, 20], [360, 20], [296, 8], [307, 8], [281, 8]],
        boss: { speciesId: 308, level: 27 },
      },
      {
        // Korillon, Riolu, Soporifik, Zarbi, Natu, Kirlia
        name: 'Salle d’Entraînement', minLv: 26, maxLv: 28, biome: 'temple',
        pool: [[433, 20], [447, 20], [96, 20], [201, 8], [177, 8], [281, 8]],
        boss: { speciesId: 178, level: 29 },
      },
      {
        // Machoc, Férosinge, Abra, Girafarig, Kirlia, Galifeu
        name: 'Sommet du Dojo', minLv: 28, maxLv: 29, biome: 'temple',
        pool: [[66, 20], [56, 20], [63, 8], [203, 8], [281, 8], [256, 8]],
        boss: { speciesId: 203, level: 30 },
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
        // Nénupiot, Axoloto, Rémoraid, Goélise, Kokiyas, Ptitard, Hypotrempe
        name: 'Rives de Verchamps', minLv: 30, maxLv: 32, biome: 'water',
        pool: [[270, 20], [194, 20], [223, 20], [278, 20], [90, 20], [60, 8], [116, 8]],
        boss: { speciesId: 117, level: 33 },
      },
      {
        // Écrapince, Carvanha, Psykokwak, Sancoki, Ramoloss, Coquiperl, Tentacool
        name: 'Lac Boueux', minLv: 32, maxLv: 34, biome: 'water',
        pool: [[341, 20], [318, 20], [54, 20], [422, 20], [79, 20], [366, 8], [72, 8]],
        boss: { speciesId: 73, level: 35 },
      },
      {
        // Lovdisc, Stari, Qwilfish, Démanta, Relicanth, Lokhlass
        name: 'Arène Aquatique', minLv: 34, maxLv: 35, biome: 'water',
        pool: [[370, 20], [120, 20], [211, 20], [226, 20], [369, 8], [131, 8]],
        boss: { speciesId: 131, level: 36 },
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
        // Crikzik, Nosferapti, Mimigal, Nidoran♀, Coxy, Nidoran♂
        name: 'Tourbière', minLv: 36, maxLv: 38, biome: 'swamp',
        pool: [[401, 20], [41, 20], [167, 20], [29, 20], [165, 8], [32, 8]],
        boss: { speciesId: 34, level: 39 },
      },
      {
        // Cradopaud, Abo, Gloupti, Smogo, Rapion, Moufouette
        name: 'Chemin de Sable', minLv: 38, maxLv: 39, biome: 'desert',
        pool: [[453, 20], [23, 20], [316, 20], [109, 20], [451, 8], [434, 8]],
        boss: { speciesId: 435, level: 40 },
      },
      {
        // Tadmorv, Séviper, Muciole, Yanmega, Cizayox, Nostenfer
        name: 'Grotte Toxique', minLv: 39, maxLv: 40, biome: 'swamp',
        pool: [[88, 20], [336, 20], [313, 20], [469, 20], [212, 8], [169, 8]],
        boss: { speciesId: 169, level: 41 },
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
        // Skelénox, Polichombr, Mime Jr., Fantominus, Baudrive, Kirlia
        name: 'Jardin Brumeux', minLv: 41, maxLv: 43, biome: 'temple',
        pool: [[355, 20], [353, 20], [439, 20], [92, 8], [425, 8], [281, 8]],
        boss: { speciesId: 426, level: 44 },
      },
      {
        // Spoink, Qulbutoké, Feuforêve, Spiritomb, Éoko, Kirlia
        name: 'Salons Abandonnés', minLv: 43, maxLv: 45, biome: 'temple',
        pool: [[325, 20], [202, 20], [200, 20], [442, 8], [358, 8], [281, 8]],
        boss: { speciesId: 358, level: 46 },
      },
      {
        // M. Mime, Noctunoir, Magirêve, Kirlia, Charmina, Métang
        name: 'Cave du Manoir', minLv: 45, maxLv: 46, biome: 'temple',
        pool: [[122, 20], [477, 20], [429, 20], [281, 8], [308, 8], [375, 8]],
        boss: { speciesId: 429, level: 47 },
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
        // Limagma, Taupiqueur, Balbuto, Chamallot, Vibraninf, Galifeu
        name: 'Pente Brûlante', minLv: 47, maxLv: 49, biome: 'volcano',
        pool: [[218, 20], [50, 20], [343, 8], [322, 8], [329, 8], [256, 8]],
        boss: { speciesId: 323, level: 50 },
      },
      {
        // Goupix, Phanpy, Rhinocorne, Ponyta, Vibraninf, Galifeu
        name: 'Cratère du Mont Foyer', minLv: 49, maxLv: 50, biome: 'volcano',
        pool: [[37, 20], [231, 20], [111, 8], [77, 8], [329, 8], [256, 8]],
        boss: { speciesId: 78, level: 51 },
      },
      {
        // Chartor, Scorplane, Vibraninf, Galifeu, Chimpenfeu, Reptincel
        name: 'Sources de Lave', minLv: 50, maxLv: 51, biome: 'volcano',
        pool: [[324, 20], [207, 20], [329, 8], [256, 8], [391, 8], [5, 8]],
        boss: { speciesId: 207, level: 52 },
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
        // Archéomire, Terhal, Embrylex, Dinoclier, Ymphect, Gravalanch
        name: 'Quai d’Acier', minLv: 52, maxLv: 54, biome: 'cave',
        pool: [[436, 20], [374, 20], [246, 8], [410, 8], [247, 8], [75, 8]],
        boss: { speciesId: 411, level: 55 },
      },
      {
        // Racaillou, Amonita, Mysdibule, Kranidos, Ymphect, Gravalanch
        name: 'Chantier Naval', minLv: 54, maxLv: 56, biome: 'cave',
        pool: [[74, 20], [138, 20], [303, 8], [408, 8], [247, 8], [75, 8]],
        boss: { speciesId: 409, level: 57 },
      },
      {
        // Solaroc, Ptéra, Ymphect, Gravalanch, Métang, Volcaropod
        name: 'Forge du Port', minLv: 56, maxLv: 57, biome: 'cave',
        pool: [[338, 20], [142, 20], [247, 8], [75, 8], [375, 8], [219, 8]],
        boss: { speciesId: 142, level: 58 },
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
        // Mélo, Chuchmur, Zigzaton, Togepi, Skitty, Miaouss, Chaglam
        name: 'Sentier Sombre', minLv: 58, maxLv: 60, biome: 'cave',
        pool: [[173, 20], [293, 20], [263, 20], [175, 20], [300, 20], [52, 8], [431, 8]],
        boss: { speciesId: 432, level: 61 },
      },
      {
        // Mélofée, Évoli, Teddiursa, Insolourdo, Goinfrex, Kecleon, Cerfrousse
        name: 'Tunnel Obscur', minLv: 60, maxLv: 61, biome: 'cave',
        pool: [[35, 20], [133, 20], [216, 20], [206, 20], [446, 20], [352, 8], [234, 8]],
        boss: { speciesId: 234, level: 62 },
      },
      {
        // Mangriff, Leveinard, Capidextre, Écrémeuh, Tauros, Porygon-Z, Ronflex
        name: 'Repaire des Ombres', minLv: 61, maxLv: 62, biome: 'cave',
        pool: [[335, 20], [113, 20], [424, 20], [241, 20], [128, 20], [474, 8], [143, 8]],
        boss: { speciesId: 143, level: 63 },
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
        // Magicarpe, Barpau, Marill, Marcacrin, Stalgamin, Obalie, Otaria
        name: 'Rivage Glacé', minLv: 63, maxLv: 65, biome: 'cave',
        pool: [[129, 20], [349, 20], [183, 20], [220, 20], [361, 20], [363, 8], [86, 8]],
        boss: { speciesId: 490, level: 66, joinsPool: true },
      },
      {
        // Écayon, Cadoizo, Mustébouée, Poissirène, Loupio, Lippouti, Babimanta
        name: 'Champ de Neige', minLv: 65, maxLv: 67, biome: 'cave',
        pool: [[456, 20], [225, 20], [418, 20], [118, 20], [170, 20], [238, 8], [458, 8]],
        boss: { speciesId: 489, level: 68, joinsPool: true },
      },
      {
        // Krabby, Corayon, Wailmer, Lippoutou, Hyporoi, Mammochon
        name: 'Île Lunaire', minLv: 67, maxLv: 68, biome: 'cave',
        pool: [[98, 20], [222, 20], [320, 20], [124, 20], [230, 8], [473, 8]],
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
        // Pichu, Lixy, Wattouat, Dynavolt, Pikachu, Raichu
        name: 'Plage de Rivamar', minLv: 69, maxLv: 71, biome: 'electric',
        pool: [[172, 20], [403, 20], [179, 20], [309, 8], [25, 8], [26, 8]],
        boss: { speciesId: 480, level: 72, joinsPool: true },
      },
      {
        // Voltorbe, Magnéti, Élekid, Pachirisu, Posipi, Élecsprint
        name: 'Lac Savoir', minLv: 71, maxLv: 73, biome: 'electric',
        pool: [[100, 20], [81, 20], [239, 20], [417, 8], [311, 8], [310, 8]],
        boss: { speciesId: 481, level: 74, joinsPool: true },
      },
      {
        // Négapi, Motisma, Élektek, Élekable, Magnézone, Magnéton
        name: 'Lac Courage', minLv: 73, maxLv: 74, biome: 'electric',
        pool: [[312, 20], [479, 20], [125, 20], [466, 8], [462, 8], [82, 8]],
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
        // Medhyèna, Roucool, Étourmi, Hoothoot, Piafabec, Nirondelle, Tylton, Artikodin, Raikou, Celebi, Latios, Deoxys
        name: 'Flanc Rocailleux', minLv: 75, maxLv: 77, biome: 'cave',
        pool: [[261, 20], [16, 20], [396, 20], [163, 20], [21, 20], [276, 8], [333, 8], [144, 3], [243, 3], [251, 3], [381, 3], [386, 3]],
        boss: { speciesId: 485, level: 78, joinsPool: true },
      },
      {
        // Minidraco, Malosse, Doduo, Ténéfix, Canarticho, Cornèbre, Pijako, Électhor, Entei, Regirock, Kyogre
        name: 'Temple Perdu', minLv: 77, maxLv: 80, biome: 'temple',
        pool: [[147, 20], [228, 20], [84, 20], [302, 20], [83, 20], [198, 8], [441, 8], [145, 3], [244, 3], [377, 3], [382, 3]],
        boss: { speciesId: 486, level: 81, joinsPool: true },
      },
      {
        // Farfuret, Absol, Corboss, Dimoret, Togekiss, Étouraptor
        name: 'Vallée Sombre', minLv: 80, maxLv: 81, biome: 'cave',
        pool: [[215, 20], [359, 20], [430, 20], [461, 8], [468, 8], [398, 8]],
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
        // Chenipan, Aspicot, Chenipotte, Cheniti, Arakdo, Paras
        name: 'Jardin Fleuri', minLv: 82, maxLv: 85, biome: 'meadow',
        pool: [[10, 20], [13, 20], [265, 20], [412, 20], [283, 8], [46, 8]],
        boss: { speciesId: 492, level: 86, joinsPool: true },
      },
      {
        // Pomdepik, Mimitoss, Caninos, Magby, Yanma, Lumivole
        name: 'Chemin du Temps', minLv: 85, maxLv: 88, biome: 'temple',
        pool: [[204, 20], [48, 20], [58, 20], [240, 20], [193, 8], [314, 8]],
        boss: { speciesId: 487, level: 89, joinsPool: true },
      },
      {
        // Caratroc, Magmar, Insécateur, Scarabrute, Maganon, Scarhino, Sulfura, Suicune, Regice, Groudon
        name: 'Galerie Finale', minLv: 88, maxLv: 90, biome: 'cave',
        pool: [[213, 20], [126, 20], [123, 20], [127, 20], [467, 8], [214, 8], [146, 3], [245, 3], [378, 3], [383, 3]],
        boss: { speciesId: 214, level: 91 },
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
        // Barloche, Osselait, Kraknoix, Griknot, Mewtwo, Lugia, Registeel, Rayquaza, Dracolosse, Drattak
        name: 'Pilier Lance', minLv: 91, maxLv: 94, biome: 'temple',
        pool: [[339, 20], [104, 20], [328, 8], [443, 8], [150, 3], [249, 3], [379, 3], [384, 3], [149, 8], [373, 8]],
        boss: { speciesId: 483, level: 95, joinsPool: true },
      },
      {
        // Draby, Sabelette, Galekid, Airmure, Mew, Ho-Oh, Latias, Jirachi, Carchacrok, Dracolosse
        name: 'Faille Spatiale', minLv: 94, maxLv: 97, biome: 'temple',
        pool: [[371, 20], [27, 20], [304, 8], [227, 8], [151, 3], [250, 3], [380, 3], [385, 3], [445, 8], [149, 8]],
        boss: { speciesId: 484, level: 98, joinsPool: true },
      },
      {
        // Steelix, Rhinastoc, Carchacrok, Dracolosse, Drattak, Métalosse
        name: 'Salle du Champion', minLv: 97, maxLv: 99, biome: 'temple',
        pool: [[208, 20], [464, 20], [445, 8], [149, 8], [373, 8], [376, 8]],
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
