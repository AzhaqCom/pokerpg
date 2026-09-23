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
  /** zone traversée sans perte mesurée en simulation (joueur largement en avance à ce stade) :
   * multiplicateur de stats des sauvages, remplace `WILD_MALUS` (-15 %) au lieu de s'y ajouter — 1 =
   * pleines stats, > 1 = plus fort que la normale (calé empiriquement par simulation, voir bot.ts). */
  wildMult?: number;
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

export const STARTERS = [1, 4, 7] as const;
/** Starters Johto (Germignon/Héricendre/Kaiminus), proposés au « nouveau départ » (prestige). */
export const STARTERS2 = [152, 155, 158] as const;
/** Index du 1er biome Johto dans `BIOMES` : le prestige y renvoie le joueur. */
export const PRESTIGE_BIOME = 10;
/**
 * Index du 1er biome de chaque région, dans l'ordre des prestiges (`REGION_START[s.prestige]`) : la
 * Carte n'affiche que les biomes de la région courante (`REGION_START[p]` à `REGION_START[p+1]`, ou la
 * fin de `BIOMES`). Étendre ce tableau (ex. `[0, 10, 20]`) suffit à préparer une Gen 3, sans toucher
 * au code de la Carte.
 */
export const REGION_START = [0, PRESTIGE_BIOME] as const;

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
        name: 'Sous-station', minLv: 30, maxLv: 31, biome: 'electric', wildMult: 1,
        pool: [[81, 30], [39, 30], [98, 25], [100, 15]],
        boss: { speciesId: 99, level: 32 },
      },
      {
        name: 'Salle des Générateurs', minLv: 31, maxLv: 33, biome: 'electric', wildMult: 1,
        pool: [[81, 20], [100, 20], [40, 20], [98, 15], [125, 10], [83, 15]],
        boss: { speciesId: 82, level: 33 },
      },
      {
        name: 'Centrale Principale', minLv: 33, maxLv: 34, biome: 'electric', wildMult: 1,
        pool: [[81, 15], [40, 20], [99, 15], [125, 15], [83, 10], [135, 15], [133, 10]],
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
        name: 'Clos Fleuri', minLv: 35, maxLv: 37, biome: 'meadow', wildMult: 1,
        pool: [[35, 30], [52, 30], [102, 25], [108, 15]],
        boss: { speciesId: 53, level: 38 },
      },
      {
        name: 'Ronce Profonde', minLv: 37, maxLv: 39, biome: 'forest', wildMult: 1,
        pool: [[102, 20], [108, 15], [114, 20], [123, 15], [118, 10], [35, 10], [52, 10]],
        boss: { speciesId: 103, level: 40 },
      },
      {
        name: 'Canopée Verdoyante', minLv: 39, maxLv: 42, biome: 'forest', wildMult: 1,
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
        name: 'Torii Embrumé', minLv: 61, maxLv: 62, biome: 'temple', wildMult: 1.15,
        pool: [[96, 30], [56, 30], [66, 25], [128, 15]],
        boss: { speciesId: 57, level: 63 },
      },
      {
        name: 'Dojo de la Prévoyance', minLv: 62, maxLv: 64, biome: 'temple', wildMult: 1.15,
        pool: [[96, 15], [56, 15], [66, 20], [106, 15], [107, 15], [115, 10], [128, 10]],
        boss: { speciesId: 97, level: 65 },
      },
      {
        name: 'Sanctuaire Intérieur', minLv: 64, maxLv: 65, biome: 'temple', wildMult: 1.15,
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
        name: 'Contrefort Cendré', minLv: 66, maxLv: 68, biome: 'volcano', wildMult: 1.7,
        pool: [[37, 30], [58, 30], [77, 25], [124, 15]],
        boss: { speciesId: 38, level: 69 },
      },
      {
        name: 'Champ de Lave', minLv: 68, maxLv: 70, biome: 'volcano', wildMult: 1.7,
        pool: [[37, 15], [58, 15], [77, 15], [116, 20], [126, 15], [124, 10], [136, 10]],
        boss: { speciesId: 59, level: 71 },
      },
      {
        name: 'Caldeira Ardente', minLv: 70, maxLv: 72, biome: 'volcano', wildMult: 1.7,
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
        name: 'Carrière Aride', minLv: 73, maxLv: 74, biome: 'desert', wildMult: 2.6,
        pool: [[27, 30], [50, 30], [104, 25], [84, 15]],
        boss: { speciesId: 28, level: 75 },
      },
      {
        name: 'Crevasse Rocheuse', minLv: 74, maxLv: 76, biome: 'desert', wildMult: 2.6,
        pool: [[27, 15], [50, 15], [104, 15], [111, 20], [84, 15], [129, 20]],
        boss: { speciesId: 51, level: 76 },
      },
      {
        name: 'Plateau Desséché', minLv: 76, maxLv: 77, biome: 'desert', wildMult: 2.6,
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
        name: 'Entrée de la Route Victoire', minLv: 78, maxLv: 82, biome: 'cave', wildMult: 1.4,
        pool: [[147, 40], [142, 30], [131, 30]],
        boss: { speciesId: 149, level: 84 },
      },
      {
        name: 'Passage Rocheux', minLv: 82, maxLv: 86, biome: 'cave', wildMult: 1.4,
        pool: [[140, 40], [143, 30], [147, 30]],
        boss: { speciesId: 144, level: 87, joinsPool: true },
      },
      {
        name: 'Sommet Balayé par les Vents', minLv: 86, maxLv: 89, biome: 'cave', wildMult: 1.4,
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
        // Starters Johto (STARTERS2) en rencontre très rare dès la 1re zone, comme les starters Kanto
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
        pool: [[19, 20], [52, 20], [209, 15], [35, 15], [133, 10], [84, 5], [182, 10], [235, 5], [108, 10], [115, 5]],
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
        pool: [[92, 25], [200, 20], [185, 20], [201, 15], [93, 10], [199, 5], [196, 5], [63, 10]],
        boss: { speciesId: 93, level: 38 },
      },
      {
        name: 'Étages Hantés', minLv: 37, maxLv: 39, biome: 'temple',
        pool: [[93, 25], [200, 15], [201, 20], [185, 15], [199, 10], [94, 10], [202, 5], [96, 10]],
        boss: { speciesId: 93, level: 40 },
      },
      {
        name: 'Sommet de la Tour', minLv: 39, maxLv: 42, biome: 'temple',
        pool: [[93, 15], [94, 30], [200, 10], [199, 20], [201, 15], [185, 10], [122, 5]],
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
        pool: [[237, 25], [107, 25], [106, 20], [62, 15], [68, 15], [74, 10], [95, 5]],
        boss: { speciesId: 68, level: 52 },
      },
      {
        name: 'Antichambre du Maître', minLv: 52, maxLv: 58, biome: 'temple',
        pool: [[214, 25], [57, 20], [68, 20], [107, 15], [62, 10], [237, 10], [104, 10], [111, 10]],
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
        pool: [[208, 25], [212, 20], [227, 15], [180, 20], [75, 10], [179, 10], [135, 5], [137, 5], [142, 5]],
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
      name: 'Arène d’Irisia', leader: 'Alizée', type: 'Glace',
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
        pool: [[228, 20], [198, 20], [246, 20], [215, 15], [197, 15], [229, 10], [23, 10]],
        boss: { speciesId: 243, level: 80, joinsPool: true },
      },
      {
        name: 'Couloir des Ombres', minLv: 79, maxLv: 83, biome: 'cave',
        pool: [[229, 20], [197, 20], [247, 20], [215, 15], [198, 15], [228, 10], [88, 10]],
        boss: { speciesId: 244, level: 84, joinsPool: true },
      },
      {
        name: 'Trône de Carla', minLv: 83, maxLv: 87, biome: 'cave',
        pool: [[248, 20], [229, 20], [197, 15], [247, 15], [246, 15], [215, 15], [109, 10]],
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
];

/** Bonus permanent par badge (toute l'équipe). */
export const BADGE_BONUS = { atkPct: 5 };
