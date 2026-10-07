import { species, TYPE_NAME, PType } from '../game/data';
import { GameState, allyFighter, monPower } from '../game/game';
import { plusOf, template } from '../game/items';
import { Item, Mon, RARITY_COLOR } from '../game/model';
import { xpForLevel } from '../game/stats';
import { AURA } from '../game/talents';

/** « 48 250 » : séparateur de milliers (sans `Intl`, pas toujours complet sous Hermes). */
export const fmtNum = (n: number) => String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

const SHORT_UNITS = ['K', 'M', 'B', 'T', 'Qa', 'Qi'];
/**
 * Grands nombres abrégés (chiffres flottants du combat, 2026-10-07) : tel quel jusqu'à 9 999 (« 8 750 »), puis 3 chiffres
 * significatifs à la virgule française et K, M, B (milliards), T, Qa, Qi (« 12,3K », « 123K », « 1,23M »). Un arrondi
 * qui atteint 1 000 passe à l'unité suivante (999 950 → « 1M », jamais « 1000K »).
 */
export function fmtShort(n: number): string {
  const v = Math.round(n);
  if (v < 10_000) return fmtNum(v);
  let x = v;
  let unit = -1;
  while (x >= 1000 && unit < SHORT_UNITS.length - 1) { x /= 1000; unit++; }
  let r = Number(x.toFixed(x >= 100 ? 0 : x >= 10 ? 1 : 2));
  if (r >= 1000 && unit < SHORT_UNITS.length - 1) { r = 1; unit++; }
  return `${String(r).replace('.', ',')}${SHORT_UNITS[unit]}`;
}

/** Couleur par type. Sol plus brun (#c9a05a au lieu de #e0c068) pour ne plus se confondre avec Électrik. */
export const TYPE_COLOR: Record<PType, string> = {
  normal: '#9e9e7a', fire: '#f0803c', water: '#6890f0', grass: '#78c850', electric: '#f8d030', ice: '#98d8d8',
  fighting: '#c03028', poison: '#a040a0', ground: '#c9a05a', flying: '#a890f0', psychic: '#f85888',
  bug: '#a8b820', rock: '#b8a038', ghost: '#705898', dragon: '#7038f8',
  steel: '#b8b8d0', dark: '#705848',
};

/** Texte lisible sur un fond de couleur : noir si le fond est clair (jaune, gris clair…), blanc sinon. */
export function textOn(bg: string, threshold = 0.6): string {
  const n = parseInt(bg.slice(1), 16);
  const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > threshold ? '#111' : '#fff';
}

export const monName = (m: Mon) => species(m.speciesId).name;

/**
 * Couleur des PC par palier (seuil minimal → couleur), sur les couleurs de rareté des objets ; le doré
 * (ancienne couleur de tous les PC) est réservé à l'élite. Mesuré le 2026-09-24 : Nv.5 ≈ 80, Nv.30 ≈ 480,
 * Nv.50 ≈ 1 100, Nv.70 ≈ 2 000, Nv.100 classique 2 500-3 000, légendaire 4★ en Chromatique ≈ 5 000.
 */
export const CP_TIERS: [number, string][] = [
  [4000, '#f1c40f'], [3000, '#e53935'], [2000, '#ff9800'], [1200, '#a259ff'], [600, '#3d8bfd'], [250, '#4caf50'], [0, '#9aa0a6'],
];
export const cpColor = (cp: number) => (CP_TIERS.find(([min]) => cp >= min) ?? CP_TIERS[CP_TIERS.length - 1])[1];

/** Couleurs de l'arc-en-ciel (boucle fermée : la dernière reprend la première). */
export const RAINBOW = ['#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#00c7be', '#007aff', '#af52de', '#ff3b30'];

/** Palier visuel d'un objet Chromatique +N (voir `chromaTier`). */
export interface ChromaTier {
  name: string;
  /** dégradé circulaire de la bordure, en boucle fermée */
  colors: string[];
  /** +11 et plus : liseré intérieur d'un 2e ton (or, argent, ou une teinte de la matière) */
  inner?: string[];
  /** épaisseur de la bordure */
  width: number;
  /** halo : copie floutée de la bordure (Or et au-delà) */
  glow: boolean;
  /** nom de l'objet */
  text: string;
  /** pastille « +N » : fond et chiffres (fond sombre et chiffres aux couleurs de la bordure pour l'arc-en-ciel) */
  pill: string;
  ink: string;
  /** contour de la pastille (fond sombre : Onyx, Abysse, Néant, au-delà du Divin) */
  pillBorder?: string;
  /** flou du halo (4 par défaut ; plus fort au-delà du Divin) */
  glowBlur?: number;
}

const GOLD = ['#fff8c4', '#ffc400', '#ff8f00', '#ffc400', '#fff8c4'];
const GOLD_LINE = ['#ffd740', '#fff8c4', '#ffd740'];
const SILVER_LINE = ['#ffffff', '#b0bec5', '#ffffff'];
/**
 * Un look par cran, jamais partagé (retour d'Arno, 2026-10-01) : du froid au chaud puis au précieux de +1 à +6,
 * Diamant, Cosmos, Éclipse, puis l'arc-en-ciel (avant : tous les +N) réservé au +10. De +11 à +20 (2026-10-07, retour
 * d'Arno : la Légende dorée commune rendait +11 à +20 indiscernables), une matière par cran, chacune sa famille de
 * couleurs, jamais celle d'un cran plus bas : bordure épaisse (3,5 px, 4 dès +16, 5 au +20) et liseré d'un 2e ton.
 * Le rang se lit à l'épaisseur ; les matières sombres (Onyx, Magma, Abysse, Néant) tranchent sur le fond du jeu.
 */
const CHROMA_TIERS: ChromaTier[] = [
  { name: 'Aurore', colors: ['#ff5ec4', '#c792ff', '#ff5ec4'], width: 2, glow: false, text: '#ff8fd8', pill: '#e077e0', ink: '#3d0a2c' },
  { name: 'Lagon', colors: ['#18ffff', '#1de9b6', '#00b0ff', '#18ffff'], width: 2, glow: false, text: '#5ff5ff', pill: '#1de9e0', ink: '#00363a' },
  { name: 'Émeraude', colors: ['#00e676', '#c6ff00', '#00e676'], width: 2, glow: false, text: '#8cff6a', pill: '#5cf05c', ink: '#0b3d10' },
  { name: 'Améthyste', colors: ['#7c4dff', '#e040fb', '#7c4dff'], width: 2, glow: false, text: '#d48cff', pill: '#a64dff', ink: '#ffffff' },
  { name: 'Brasier', colors: ['#ff9100', '#ff1744', '#ff9100'], width: 2, glow: false, text: '#ff8a50', pill: '#ff6d00', ink: '#3d0700' },
  { name: 'Or', colors: GOLD, width: 2.5, glow: true, text: '#ffd740', pill: '#ffc400', ink: '#3d2a00' },
  { name: 'Diamant', colors: ['#ffffff', '#b3e5fc', '#e1bee7', '#ffffff'], width: 2.5, glow: true, text: '#e3f2fd', pill: '#e3f2fd', ink: '#0d2b45' },
  { name: 'Cosmos', colors: ['#536dfe', '#d500f9', '#00e5ff', '#536dfe'], width: 2.5, glow: true, text: '#b388ff', pill: '#7c4dff', ink: '#ffffff' },
  { name: 'Éclipse', colors: ['#ffe57f', '#ff6d00', '#2b1200', '#ff6d00', '#ffe57f'], width: 2.5, glow: true, text: '#ffb74d', pill: '#ff9100', ink: '#3d1f00' },
  { name: 'Arc-en-ciel', colors: RAINBOW, width: 3, glow: true, text: '#ffffff', pill: '#1b1f2a', ink: '#ffffff' },
  // +11 à +20 : une matière par cran
  { name: 'Rubis', colors: ['#ff1744', '#8b0021', '#ff5c7a', '#8b0021', '#ff1744'], inner: GOLD_LINE, width: 3.5, glow: true, text: '#ff6b81', pill: '#d50032', ink: '#ffffff' },
  { name: 'Saphir', colors: ['#2979ff', '#0d1b6e', '#82b1ff', '#0d1b6e', '#2979ff'], inner: SILVER_LINE, width: 3.5, glow: true, text: '#82b1ff', pill: '#2962ff', ink: '#ffffff' },
  { name: 'Jade', colors: ['#00c853', '#003d1f', '#69f0ae', '#003d1f', '#00c853'], inner: GOLD_LINE, width: 3.5, glow: true, text: '#69f0ae', pill: '#00873a', ink: '#ffffff' },
  { name: 'Onyx', colors: ['#0a0a0a', '#5a5a5a', '#0a0a0a', '#5a5a5a', '#0a0a0a'], inner: SILVER_LINE, width: 3.5, glow: false, text: '#e0e0e0', pill: '#000000', ink: '#ffffff', pillBorder: '#9e9e9e' },
  { name: 'Platine', colors: ['#f5f5f5', '#9e9e9e', '#ffffff', '#78909c', '#f5f5f5'], inner: ['#18ffff', '#b3e5fc', '#18ffff'], width: 3.5, glow: true, text: '#eceff1', pill: '#cfd8dc', ink: '#263238' },
  { name: 'Magma', colors: ['#1a0000', '#ff3d00', '#ffea00', '#ff3d00', '#1a0000'], inner: ['#ffea00', '#ff3d00', '#ffea00'], width: 4, glow: true, text: '#ff6e40', pill: '#dd2c00', ink: '#ffffff' },
  { name: 'Sakura', colors: ['#ffd1e8', '#ffffff', '#ff80bf', '#ffffff', '#ffd1e8'], inner: ['#c51162', '#ff4081', '#c51162'], width: 4, glow: true, text: '#ffc1e3', pill: '#ff80bf', ink: '#4a0026' },
  { name: 'Abysse', colors: ['#000a2e', '#00e5ff', '#000a2e', '#1de9b6', '#000a2e'], inner: ['#00e5ff', '#1de9b6', '#00e5ff'], width: 4, glow: true, text: '#40e0ff', pill: '#001f5c', ink: '#40e0ff', pillBorder: '#00e5ff' },
  { name: 'Néant', colors: ['#12001f', '#aa00ff', '#12001f', '#ff00e5', '#12001f'], inner: ['#ff00e5', '#aa00ff', '#ff00e5'], width: 4, glow: true, text: '#d580ff', pill: '#2a0045', ink: '#e1a6ff', pillBorder: '#aa00ff' },
  { name: 'Divin', colors: GOLD, inner: RAINBOW, width: 5, glow: true, text: '#fff3c4', pill: '#ffd740', ink: '#3d2a00' },
];
/** Au-delà de +20 : le Divin, halo plus fort et pastille sombre cerclée d'or (« au-delà du Divin »), plutôt que de
 *  recycler les couleurs des crans plus bas. */
const BEYOND: ChromaTier = { ...CHROMA_TIERS[CHROMA_TIERS.length - 1], glowBlur: 7, pill: '#3d2a00', ink: '#ffd740', pillBorder: '#ffd740' };

/** Palier d'un Chromatique +N (`plus` ≥ 1). */
export function chromaTier(plus: number): ChromaTier {
  return plus <= CHROMA_TIERS.length ? CHROMA_TIERS[Math.max(1, plus) - 1] : BEYOND;
}

/**
 * Couleur du nom d'un objet : sa rareté, ou le palier de son cran pour un Chromatique +N. **Seule source** de la couleur
 * d'un objet en texte uni (cartes, fiche, fiche Pokémon, messages de butin, de fusion et du coffre, résumé du retour) ;
 * le mot « Chromatique +N » lui-même s'écrit en dégradé (`ChromaText`) là où la place le permet.
 */
export function itemColor(it: Item): string {
  return plusOf(it) > 0 ? plusColor(plusOf(it)) : RARITY_COLOR[it.rarity];
}

/** Couleur d'un Chromatique de cran `plus` (0 = Chromatique simple) : un coffre de la Tour, avant de choisir l'objet. */
export function plusColor(plus: number): string {
  return plus > 0 ? chromaTier(plus).text : RARITY_COLOR[RARITY_COLOR.length - 1];
}

/** « Cape du Vainqueur +3 » : nom d'un objet et son cran Chromatique +N, sans la rareté (messages de fusion et du coffre
 *  de la Tour, à la couleur `itemColor`). */
export function itemDisplayName(it: Item): string {
  const plus = plusOf(it);
  return plus > 0 ? `${template(it.templateId).name} +${plus}` : template(it.templateId).name;
}

/** Couleurs d'un palier lisibles en texte lettre par lettre (sans la reprise de la boucle, ni le brun de l'Éclipse). */
export function chromaTextColors(colors: string[]): string[] {
  return colors.slice(0, -1).filter((c) => textOn(c, 0.25) === '#111');
}

export function monStats(s: GameState, uid: string) {
  const f = allyFighter(s, uid);
  return { ...f.stats, cp: monPower(s, uid), bonuses: f.bonuses };
}

export function xpProgress(m: Mon) {
  const a = xpForLevel(m.level), b = xpForLevel(m.level + 1);
  return Math.max(0, Math.min(1, (m.xp - a) / (b - a)));
}

export const typeLabel = (t: PType) => TYPE_NAME[t];

/**
 * Aura(s) données à l'équipe par un Pokémon, pour l'affichage (même règle que `auraBonuses` dans
 * `stats.ts`) : `factor` = 1 en équipe, 0.5 en pension/exploration ; un bi-type donne les 2 auras
 * (une par type), chacune divisée par 2.
 */
export function auraDisplay(speciesId: number, factor: number): { label: string; value: number }[] {
  const types = species(speciesId).types;
  const share = types.length > 1 ? factor / 2 : factor;
  return types.map((t) => ({ label: AURA[t].label, value: Math.round(AURA[t].value * share * 10) / 10 }));
}
