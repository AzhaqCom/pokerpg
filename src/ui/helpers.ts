import { species, TYPE_NAME, PType } from '../game/data';
import { GameState, allyFighter } from '../game/game';
import { Mon } from '../game/model';
import { combatPower } from '../game/stats';
import { xpForLevel } from '../game/stats';
import { AURA } from '../game/talents';

export const TYPE_COLOR: Record<PType, string> = {
  normal: '#9e9e7a', fire: '#f0803c', water: '#6890f0', grass: '#78c850', electric: '#f8d030', ice: '#98d8d8',
  fighting: '#c03028', poison: '#a040a0', ground: '#e0c068', flying: '#a890f0', psychic: '#f85888',
  bug: '#a8b820', rock: '#b8a038', ghost: '#705898', dragon: '#7038f8',
  steel: '#b8b8d0', dark: '#705848',
};

/** Texte lisible sur un fond de couleur : noir si le fond est clair (jaune, gris clair…), blanc sinon. */
export function textOn(bg: string): string {
  const n = parseInt(bg.slice(1), 16);
  const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.6 ? '#111' : '#fff';
}

export const monName = (m: Mon) => species(m.speciesId).name;

export function monStats(s: GameState, uid: string) {
  const f = allyFighter(s, uid);
  return { ...f.stats, cp: combatPower(f.stats), bonuses: f.bonuses };
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
