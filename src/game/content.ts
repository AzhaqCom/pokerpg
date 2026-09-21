/** Contenu du jeu : biomes (document de conception, voir BIOMES.md pour le plan complet). */

export interface ZoneDef {
  name: string;
  minLv: number;
  maxLv: number;
  /** [espèce, poids] ; poids < 10 = espèce rare (capture 2× plus dure) */
  pool: [number, number][];
  /** `repeatable` : boss rejouable après la 1re victoire (légendaires en fin de jeu), jamais le cas pour un boss de zone classique. */
  boss: { speciesId: number; level: number; title: string; repeatable?: boolean };
  /** fond de combat */
  biome: 'forest' | 'meadow' | 'cave' | 'water' | 'electric';
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
        pool: [[46, 20], [48, 20], [23, 15], [17, 15], [69, 15], [25, 5], [63, 5], [95, 5]],
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
        name: 'Sous-station', minLv: 30, maxLv: 31, biome: 'electric',
        pool: [[81, 30], [39, 30], [98, 25], [100, 15]],
        boss: { speciesId: 99, level: 33, title: 'Krabboss cuirassé' },
      },
      {
        name: 'Salle des Générateurs', minLv: 31, maxLv: 33, biome: 'electric',
        pool: [[81, 20], [100, 20], [40, 20], [98, 15], [125, 10], [83, 15]],
        boss: { speciesId: 82, level: 36, title: 'Magnéton triple charge' },
      },
      {
        name: 'Centrale Principale', minLv: 33, maxLv: 35, biome: 'electric',
        pool: [[81, 15], [40, 20], [99, 15], [125, 15], [83, 10], [135, 15], [133, 10]],
        boss: { speciesId: 101, level: 38, title: 'Électrode explosif' },
      },
    ],
    arena: {
      name: 'Arène de Carmin-sur-Mer', leader: 'Major Bob', type: 'Électrik',
      team: [[100, 35], [82, 37], [26, 39]],
      badge: 'Badge Foudre',
    },
  },
];

/** Bonus permanent par badge (toute l'équipe). */
export const BADGE_BONUS = { atkPct: 5 };
