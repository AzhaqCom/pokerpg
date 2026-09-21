import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { GameState, grantDailyBalls, migrateSave, newGame } from '../game/game';
import { mathRng } from '../game/rng';

const KEY = 'pokelootborn/save/v1';

interface Store {
  s: GameState | null;
  rev: number;
  load: () => Promise<void>;
  /** modifie l'état puis sauvegarde (écriture groupée) */
  act: <T>(fn: (s: GameState) => T) => T | undefined;
  reset: () => Promise<void>;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleSave(s: GameState) {
  if (saveTimer) clearTimeout(saveTimer);
  // JSON.stringify de tout l'état peut être coûteux (sac/boîte volumineux) : le délai de 400 ms laisse
  // le temps aux clics rapprochés de s'annuler entre eux avant de sérialiser pour de vrai.
  saveTimer = setTimeout(() => {
    AsyncStorage.setItem(KEY, JSON.stringify(s)).catch((e) => console.warn('Sauvegarde impossible', e));
  }, 400);
}

export const useGame = create<Store>((set, get) => ({
  s: null,
  rev: 0,
  load: async () => {
    let s: GameState;
    try {
      const raw = await AsyncStorage.getItem(KEY);
      s = raw ? { ...newGame(), ...migrateSave(JSON.parse(raw)) } as GameState : newGame();
    } catch {
      s = newGame();
    }
    grantDailyBalls(s);
    set({ s, rev: get().rev + 1 });
    scheduleSave(s);
  },
  act: (fn) => {
    const s = get().s;
    if (!s) return undefined;
    const out = fn(s);
    set({ rev: get().rev + 1 });
    scheduleSave(s);
    return out;
  },
  reset: async () => {
    await AsyncStorage.removeItem(KEY);
    set({ s: newGame(), rev: get().rev + 1 });
  },
}));

export const rng = mathRng;
