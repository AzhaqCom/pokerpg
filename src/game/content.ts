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
  boss: { speciesId: number; level: number; title: string; joinsPool?: boolean };
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
}

export interface BiomeDef {
  name: string;
  zones: ZoneDef[];
  arena: ArenaDef;
}

export const STAGES_PER_ZONE = 5;
export const WAVES_PER_STAGE = 3;

export const STARTERS = [1, 4, 7] as const;

export const BIOMES: BiomeDef[] = [
  {
    name: 'Forêt de Jade',
    zones: [
      {
        name: 'Lisière', minLv: 3, maxLv: 6, biome: 'meadow',
        pool: [[10, 30], [13, 30], [16, 25], [19, 15]],
        boss: { speciesId: 14, level: 8, title: 'Coconfort blindé' },
      },
      {
        name: 'Sous-bois', minLv: 6, maxLv: 9, biome: 'forest',
        pool: [[11, 15], [14, 15], [21, 20], [29, 15], [32, 15], [43, 15], [25, 5]],
        boss: { speciesId: 12, level: 11, title: 'Papilusion des cimes' },
      },
      {
        name: 'Clairière', minLv: 10, maxLv: 14, biome: 'forest',
        pool: [[46, 20], [48, 20], [23, 15], [17, 15], [69, 10], [74, 10], [25, 5], [63, 5], [95, 5]],
        boss: { speciesId: 15, level: 16, title: 'Dardargnan reine' },
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
        boss: { speciesId: 61, level: 23, title: 'Têtarte des berges' },
      },
      {
        name: 'Récif Corallien', minLv: 21, maxLv: 24, biome: 'water',
        pool: [[90, 25], [79, 25], [86, 25], [55, 15], [61, 10]],
        boss: { speciesId: 91, level: 27, title: 'Crustabri cuirassé' },
      },
      {
        name: 'Fosse Profonde', minLv: 24, maxLv: 28, biome: 'water',
        pool: [[90, 20], [79, 20], [86, 20], [72, 15], [91, 10], [80, 10], [54, 5]],
        boss: { speciesId: 62, level: 29, title: 'Tartard des abysses' },
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
        boss: { speciesId: 99, level: 32, title: 'Krabboss cuirassé' },
      },
      {
        name: 'Salle des Générateurs', minLv: 31, maxLv: 33, biome: 'electric', wildMult: 1,
        pool: [[81, 20], [100, 20], [40, 20], [98, 15], [125, 10], [83, 15]],
        boss: { speciesId: 82, level: 33, title: 'Magnéton triple charge' },
      },
      {
        name: 'Centrale Principale', minLv: 33, maxLv: 34, biome: 'electric', wildMult: 1,
        pool: [[81, 15], [40, 20], [99, 15], [125, 15], [83, 10], [135, 15], [133, 10]],
        boss: { speciesId: 101, level: 34, title: 'Électrode explosif' },
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
        boss: { speciesId: 53, level: 38, title: 'Persian félin' },
      },
      {
        name: 'Ronce Profonde', minLv: 37, maxLv: 39, biome: 'forest', wildMult: 1,
        pool: [[102, 20], [108, 15], [114, 20], [123, 15], [118, 10], [35, 10], [52, 10]],
        boss: { speciesId: 103, level: 40, title: 'Noadkoko sage' },
      },
      {
        name: 'Canopée Verdoyante', minLv: 39, maxLv: 42, biome: 'forest', wildMult: 1,
        pool: [[114, 15], [123, 15], [127, 15], [118, 15], [108, 10], [102, 15], [35, 15]],
        boss: { speciesId: 119, level: 42, title: 'Poissoroy royal' },
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
        boss: { speciesId: 42, level: 50, title: 'Nosferalto vampire' },
      },
      {
        name: 'Tourbière Toxique', minLv: 48, maxLv: 55, biome: 'swamp',
        pool: [[88, 20], [109, 20], [92, 15], [41, 15], [113, 10], [120, 20]],
        boss: { speciesId: 89, level: 57, title: 'Grotadmorv abyssal' },
      },
      {
        name: 'Cœur du Marécage', minLv: 55, maxLv: 59, biome: 'swamp',
        pool: [[92, 20], [113, 15], [120, 20], [88, 15], [109, 15], [41, 15]],
        boss: { speciesId: 110, level: 60, title: 'Smogogo asphyxiant' },
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
        boss: { speciesId: 57, level: 63, title: 'Colossinge déchaîné' },
      },
      {
        name: 'Dojo de la Prévoyance', minLv: 62, maxLv: 64, biome: 'temple', wildMult: 1.15,
        pool: [[96, 15], [56, 15], [66, 20], [106, 15], [107, 15], [115, 10], [128, 10]],
        boss: { speciesId: 97, level: 65, title: 'Hypnomade mystique' },
      },
      {
        name: 'Sanctuaire Intérieur', minLv: 64, maxLv: 65, biome: 'temple', wildMult: 1.15,
        pool: [[106, 20], [107, 20], [115, 15], [128, 15], [66, 10], [56, 10], [96, 10]],
        boss: { speciesId: 68, level: 65, title: 'Mackogneur titan' },
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
        boss: { speciesId: 38, level: 69, title: 'Feunard ardent' },
      },
      {
        name: 'Champ de Lave', minLv: 68, maxLv: 70, biome: 'volcano', wildMult: 1.7,
        pool: [[37, 15], [58, 15], [77, 15], [116, 20], [126, 15], [124, 10], [136, 10]],
        boss: { speciesId: 59, level: 71, title: 'Arcanin flamboyant' },
      },
      {
        name: 'Caldeira Ardente', minLv: 70, maxLv: 72, biome: 'volcano', wildMult: 1.7,
        pool: [[116, 15], [117, 10], [126, 15], [136, 15], [124, 15], [77, 15], [37, 15]],
        boss: { speciesId: 78, level: 72, title: 'Galopa fulgurant' },
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
        boss: { speciesId: 28, level: 75, title: 'Sablaireau ensablé' },
      },
      {
        name: 'Crevasse Rocheuse', minLv: 74, maxLv: 76, biome: 'desert', wildMult: 2.6,
        pool: [[27, 15], [50, 15], [104, 15], [111, 20], [84, 15], [129, 20]],
        boss: { speciesId: 51, level: 76, title: 'Triopikeur foreur' },
      },
      {
        name: 'Plateau Desséché', minLv: 76, maxLv: 77, biome: 'desert', wildMult: 2.6,
        pool: [[111, 20], [129, 20], [104, 15], [84, 15], [50, 15], [27, 15]],
        boss: { speciesId: 105, level: 77, title: 'Ossatueur osseux' },
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
        boss: { speciesId: 149, level: 84, title: 'Dracolosse gardien' },
      },
      {
        name: 'Passage Rocheux', minLv: 82, maxLv: 86, biome: 'cave', wildMult: 1.4,
        pool: [[140, 40], [143, 30], [147, 30]],
        boss: { speciesId: 144, level: 87, title: 'Artikodin', joinsPool: true },
      },
      {
        name: 'Sommet Balayé par les Vents', minLv: 86, maxLv: 89, biome: 'cave', wildMult: 1.4,
        pool: [[138, 40], [122, 30], [143, 30]],
        boss: { speciesId: 145, level: 90, title: 'Électhor', joinsPool: true },
      },
    ],
    arena: {
      name: 'Conseil des 4', leader: 'Conseil des 4', type: 'mixte',
      team: [[130, 88], [68, 89], [76, 90]],
      badge: 'Titre de Maître',
    },
  },
  {
    // Nv.90→100 — voir BIOMES.md : réserve postgame mixte, écart original +6 (Champion + postgame).
    name: 'Ligue Pokémon',
    zones: [
      {
        name: 'Antichambre du Plateau', minLv: 90, maxLv: 93, biome: 'temple',
        pool: [[132, 40], [137, 30], [149, 30]],
        boss: { speciesId: 146, level: 94, title: 'Sulfura', joinsPool: true },
      },
      {
        name: 'Grotte Bleue', minLv: 93, maxLv: 96, biome: 'cave',
        pool: [[131, 40], [143, 30], [138, 30]],
        boss: { speciesId: 150, level: 97, title: 'Mewtwo', joinsPool: true },
      },
      {
        name: 'Antre de Mew', minLv: 96, maxLv: 99, biome: 'meadow',
        pool: [[122, 40], [140, 30], [142, 30]],
        boss: { speciesId: 151, level: 99, title: 'Mew', joinsPool: true },
      },
    ],
    arena: {
      name: 'Plateau Indigo', leader: 'Champion', type: 'mixte',
      team: [[3, 96], [6, 98], [9, 100]],
      badge: 'Titre de Champion',
    },
  },
];

/** Bonus permanent par badge (toute l'équipe). */
export const BADGE_BONUS = { atkPct: 5 };
