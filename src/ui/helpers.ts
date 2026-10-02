import { species, TYPE_NAME, PType } from '../game/data';
import { GameState, allyFighter, monPower } from '../game/game';
import { plusOf, template } from '../game/items';
import { Item, Mon, RARITY_COLOR } from '../game/model';
import { xpForLevel } from '../game/stats';
import { AURA } from '../game/talents';

/** « 48 250 » : séparateur de milliers (sans `Intl`, pas toujours complet sous Hermes). */
export const fmtNum = (n: number) => String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

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
  /** Légende (+11 et plus) : liseré intérieur aux couleurs du cran − 10 */
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
}

const GOLD = ['#fff8c4', '#ffc400', '#ff8f00', '#ffc400', '#fff8c4'];
/**
 * Un look par cran, jamais partagé (retour d'Arno, 2026-10-01) : du froid au chaud puis au précieux de +1 à +6,
 * Diamant, Cosmos, Éclipse, puis l'arc-en-ciel (avant : tous les +N) réservé au +10. Au-delà, Légende : bordure dorée
 * épaisse et liseré intérieur du cran − 10 (+11 Aurore, +12 Lagon…), unique jusqu'à +20 (étage 410 de la Tour).
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
];
const LEGEND = { name: 'Légende', colors: GOLD, width: 4, glow: true, text: '#fff3c4', pill: '#ffd740', ink: '#3d2a00' };

/** Palier d'un Chromatique +N (`plus` ≥ 1). */
export function chromaTier(plus: number): ChromaTier {
  if (plus <= CHROMA_TIERS.length) return CHROMA_TIERS[Math.max(1, plus) - 1];
  return { ...LEGEND, inner: CHROMA_TIERS[(plus - 1) % CHROMA_TIERS.length].colors };
}

/** Couleur du nom d'un objet : sa rareté, ou le palier de son cran pour un Chromatique +N (cartes, message de fusion). */
export function itemColor(it: Item): string {
  const plus = plusOf(it);
  return plus > 0 ? chromaTier(plus).text : RARITY_COLOR[it.rarity];
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
