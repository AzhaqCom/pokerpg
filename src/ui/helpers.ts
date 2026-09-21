import { species, TYPE_NAME, PType } from '../game/data';
import { GameState, allyFighter } from '../game/game';
import { Mon } from '../game/model';
import { combatPower } from '../game/stats';
import { xpForLevel } from '../game/stats';

export const TYPE_COLOR: Record<PType, string> = {
  normal: '#9e9e7a', fire: '#f0803c', water: '#6890f0', grass: '#78c850', electric: '#f8d030', ice: '#98d8d8',
  fighting: '#c03028', poison: '#a040a0', ground: '#e0c068', flying: '#a890f0', psychic: '#f85888',
  bug: '#a8b820', rock: '#b8a038', ghost: '#705898', dragon: '#7038f8',
};

export const monName = (m: Mon) => species(m.speciesId).name;

export function monStats(s: GameState, uid: string) {
  const f = allyFighter(s, uid);
  return { ...f.stats, cp: combatPower(f.stats) };
}

export function xpProgress(m: Mon) {
  const a = xpForLevel(m.level), b = xpForLevel(m.level + 1);
  return Math.max(0, Math.min(1, (m.xp - a) / (b - a)));
}

export const typeLabel = (t: PType) => TYPE_NAME[t];
