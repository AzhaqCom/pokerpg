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
/** Starters Johto (Germignon/Héricendre/Kaiminus), proposés au « nouveau départ » (prestige). */
export const STARTERS2 = [152, 155, 158] as const;
/** Index du 1er biome Johto dans `BIOMES` : le prestige y renvoie le joueur. */
export const PRESTIGE_BIOME = 10;

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
  // ---------------------------------------------------------------- Johto (Gen 2, 152-251)
  {
    // Nv.5→19 — biome Vol (badge Zéphyr). Décors réutilisés (pas de nouveaux fonds de combat).
    name: 'Route des Cieux',
    zones: [
      {
        name: 'Sentier des Roseaux', minLv: 5, maxLv: 9, biome: 'meadow',
        pool: [[187, 30], [41, 25], [16, 30], [163, 25]],
        boss: { speciesId: 21, level: 10, title: 'Piafabec matinal' },
      },
      {
        name: 'Falaise aux Vents', minLv: 9, maxLv: 14, biome: 'meadow',
        pool: [[165, 25], [21, 20], [177, 20], [84, 20], [188, 15]],
        boss: { speciesId: 225, level: 15, title: 'Cadoizo posté' },
      },
      {
        name: 'Cimes de Ver-de-Gris', minLv: 14, maxLv: 19, biome: 'meadow',
        pool: [[17, 25], [83, 20], [176, 15], [166, 15], [198, 15], [193, 10]],
        boss: { speciesId: 249, level: 20, title: 'Lugia', joinsPool: true },
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
        pool: [[14, 30], [11, 30], [10, 25], [13, 25]],
        boss: { speciesId: 46, level: 22, title: 'Paras spongieux' },
      },
      {
        name: 'Clairière aux Cocons', minLv: 22, maxLv: 26, biome: 'forest',
        pool: [[167, 25], [204, 25], [48, 20], [213, 20], [168, 10]],
        boss: { speciesId: 47, level: 26, title: 'Parasect toxique' },
      },
      {
        name: 'Cœur de la Forêt', minLv: 26, maxLv: 30, biome: 'forest',
        pool: [[166, 25], [193, 20], [12, 20], [15, 15], [205, 10], [49, 10]],
        boss: { speciesId: 212, level: 30, title: 'Cizayox lame d’acier' },
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
        name: 'Champs de Doré', minLv: 30, maxLv: 31, biome: 'meadow',
        pool: [[161, 25], [173, 20], [175, 20], [174, 20], [16, 15]],
        boss: { speciesId: 39, level: 31, title: 'Rondoudou câlin' },
      },
      {
        name: 'Ferme Laitière', minLv: 31, maxLv: 33, biome: 'meadow',
        pool: [[19, 25], [52, 20], [209, 15], [35, 15], [133, 15], [84, 10]],
        boss: { speciesId: 162, level: 33, title: 'Fouinar véloce' },
      },
      {
        name: 'Verger Paisible', minLv: 33, maxLv: 35, biome: 'meadow',
        pool: [[20, 25], [203, 20], [53, 20], [210, 15], [36, 10], [164, 10]],
        boss: { speciesId: 143, level: 35, title: 'Ronflex assoupi' },
      },
    ],
    arena: {
      name: 'Arène de Doré', leader: 'Blanche', type: 'Normal',
      team: [[209, 32], [241, 33], [233, 35]],
      badge: 'Badge Plaine',
    },
  },
  {
    // Nv.35→42 — biome Spectre (badge Brume). Seules 4 espèces Spectre existent en Gen 1-2 (canon).
    name: 'Tour Hantée',
    zones: [
      {
        name: 'Rez-de-Tour', minLv: 35, maxLv: 37, biome: 'temple',
        pool: [[92, 50], [200, 30]],
        boss: { speciesId: 93, level: 38, title: 'Spectrum chuchotant' },
      },
      {
        name: 'Étages Hantés', minLv: 37, maxLv: 39, biome: 'temple',
        pool: [[93, 50], [200, 30]],
        boss: { speciesId: 93, level: 40, title: 'Spectrum vengeur' },
      },
      {
        name: 'Sommet de la Tour', minLv: 39, maxLv: 42, biome: 'temple',
        pool: [[93, 40], [94, 20]],
        boss: { speciesId: 94, level: 42, title: 'Ectoplasma spectral' },
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
        pool: [[236, 30], [66, 30], [56, 25], [67, 15]],
        boss: { speciesId: 57, level: 47, title: 'Colossinge fougueux' },
      },
      {
        name: 'Salle des Katas', minLv: 47, maxLv: 52, biome: 'temple',
        pool: [[237, 25], [107, 25], [106, 20], [62, 15], [68, 15]],
        boss: { speciesId: 68, level: 52, title: 'Mackogneur endurci' },
      },
      {
        name: 'Antichambre du Maître', minLv: 52, maxLv: 58, biome: 'temple',
        pool: [[214, 25], [57, 20], [68, 20], [107, 15], [62, 10], [237, 10]],
        boss: { speciesId: 62, level: 58, title: 'Tartard vétéran' },
      },
    ],
    arena: {
      name: 'Arène d’Ébène', leader: 'Albert', type: 'Combat',
      team: [[56, 55], [62, 58]],
      badge: 'Badge Tempête',
    },
  },
  {
    // Nv.58→63 — biome Acier (badge Mystik). Seules 4 espèces Acier existent en Gen 2 (canon).
    name: 'Phare d’Olivia',
    zones: [
      {
        name: 'Base du Phare', minLv: 58, maxLv: 59, biome: 'cave',
        pool: [[205, 40], [227, 30], [212, 20], [208, 10]],
        boss: { speciesId: 227, level: 60, title: 'Airmure blindé' },
      },
      {
        name: 'Escalier de Fer', minLv: 59, maxLv: 61, biome: 'cave',
        pool: [[208, 40], [212, 30], [227, 20], [205, 10]],
        boss: { speciesId: 212, level: 61, title: 'Cizayox affûté' },
      },
      {
        name: 'Sommet du Phare', minLv: 61, maxLv: 63, biome: 'cave',
        pool: [[208, 50], [212, 25], [227, 25]],
        boss: { speciesId: 208, level: 63, title: 'Steelix ancré' },
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
        pool: [[220, 30], [238, 30], [225, 20], [87, 20]],
        boss: { speciesId: 91, level: 66, title: 'Crustabri cristallin' },
      },
      {
        name: 'Galerie de Glace', minLv: 65, maxLv: 67, biome: 'cave',
        pool: [[221, 30], [91, 25], [215, 20], [124, 15], [131, 10]],
        boss: { speciesId: 124, level: 68, title: 'Lippoutou glaciale' },
      },
      {
        name: 'Lac Souterrain Gelé', minLv: 67, maxLv: 70, biome: 'cave',
        pool: [[131, 30], [221, 20], [124, 15], [215, 15]],
        boss: { speciesId: 131, level: 70, title: 'Lokhlass ancestral' },
      },
    ],
    arena: {
      name: 'Arène d’Irisia', leader: 'Alizée', type: 'Glace',
      team: [[91, 65], [221, 67], [131, 70]],
      badge: 'Badge Glace',
    },
  },
  {
    // Nv.70→75 — biome Dragon (badge Ascension). Seules 4 espèces Dragon existent en Gen 1-2 (canon).
    name: 'Tanière des Dragons',
    zones: [
      {
        name: 'Rivière aux Dragonneaux', minLv: 70, maxLv: 71, biome: 'water',
        pool: [[147, 50], [230, 30], [148, 20]],
        boss: { speciesId: 148, level: 72, title: 'Draco majestueux' },
      },
      {
        name: 'Bassin Sacré', minLv: 71, maxLv: 73, biome: 'water',
        pool: [[148, 50], [230, 30], [147, 20]],
        boss: { speciesId: 148, level: 73, title: 'Draco aîné' },
      },
      {
        name: 'Antre de Rosalia', minLv: 73, maxLv: 75, biome: 'water',
        pool: [[148, 40], [230, 30], [149, 30]],
        boss: { speciesId: 149, level: 75, title: 'Dracolosse ancestral' },
      },
    ],
    arena: {
      name: 'Arène de Rosalia', leader: 'Guirande', type: 'Dragon',
      team: [[147, 72], [148, 73], [230, 74], [149, 75]],
      badge: 'Badge Ascension',
    },
  },
  {
    // Nv.75→87 — biome Ténèbres, Conseil des 4 Johto (jamais de badge dans les jeux d'origine).
    name: 'Grotte Sombre',
    zones: [
      {
        name: 'Antichambre Obscure', minLv: 75, maxLv: 79, biome: 'cave',
        pool: [[228, 30], [198, 30], [215, 20], [197, 20]],
        boss: { speciesId: 229, level: 80, title: 'Démolosse enragé' },
      },
      {
        name: 'Couloir des Ombres', minLv: 79, maxLv: 83, biome: 'cave',
        pool: [[229, 30], [197, 30], [215, 20], [198, 20]],
        boss: { speciesId: 197, level: 84, title: 'Noctali nocturne' },
      },
      {
        name: 'Trône de Carla', minLv: 83, maxLv: 87, biome: 'cave',
        pool: [[248, 20], [197, 30], [229, 30], [215, 20]],
        boss: { speciesId: 248, level: 87, title: 'Tyranocif titan' },
      },
    ],
    arena: {
      name: 'Conseil des 4 (Johto)', leader: 'Conseil des 4', type: 'mixte',
      team: [[229, 85], [197, 86], [248, 87]],
      badge: 'Titre de Maître Johto',
    },
  },
  {
    // Nv.87→100 — Champion Johto, capstone Ho-Oh.
    name: 'Plateau Doré',
    zones: [
      {
        name: 'Antichambre Dorée', minLv: 87, maxLv: 91, biome: 'temple',
        pool: [[241, 30], [217, 30], [209, 20], [210, 20]],
        boss: { speciesId: 232, level: 92, title: 'Donphan blindé' },
      },
      {
        name: 'Galerie des Champions', minLv: 91, maxLv: 95, biome: 'temple',
        pool: [[224, 30], [211, 30], [171, 20], [186, 20]],
        boss: { speciesId: 226, level: 96, title: 'Démanta majestueuse' },
      },
      {
        name: 'Sanctuaire de Ho-Oh', minLv: 95, maxLv: 99, biome: 'temple',
        pool: [[157, 30], [160, 30], [154, 20], [181, 20]],
        boss: { speciesId: 250, level: 99, title: 'Ho-Oh', joinsPool: true },
      },
    ],
    arena: {
      name: 'Plateau Doré', leader: 'Champion Johto', type: 'mixte',
      team: [[154, 96], [157, 97], [160, 98], [248, 100]],
      badge: 'Titre de Champion Johto',
    },
  },
];

/** Bonus permanent par badge (toute l'équipe). */
export const BADGE_BONUS = { atkPct: 5 };
