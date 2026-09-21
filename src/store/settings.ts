import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const KEY = 'pokelootborn/settings/v1';

export interface Settings {
  sound: boolean;
  haptics: boolean;
  /** vitesse de combat ×2 (débloquée au 1er badge) */
  fast: boolean;
  /** capture automatiquement les offres non garanties pour une espèce jamais capturée */
  autoCapture: boolean;
  /** capture auto : Ball la plus forte en stock plutôt que la moins chère */
  autoCaptureBestBall: boolean;
  /** capture auto : se redéclenche aussi pour une espèce déjà possédée tant qu'elle est sous 3★ */
  autoCaptureUpgrade: boolean;
  /** ne propose pas une capture si l'espèce est déjà possédée à 3★ ou mieux */
  hideOwnedOffers: boolean;
}

const DEFAULTS: Settings = {
  sound: true, haptics: true, fast: false,
  autoCapture: false, autoCaptureBestBall: false, autoCaptureUpgrade: false, hideOwnedOffers: false,
};

interface Store extends Settings {
  load: () => Promise<void>;
  set: (patch: Partial<Settings>) => void;
}

export const useSettings = create<Store>((set, get) => ({
  ...DEFAULTS,
  load: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      set({ ...DEFAULTS, ...(raw ? JSON.parse(raw) : {}) });
    } catch { /* défauts */ }
  },
  set: (patch) => {
    set(patch);
    const { sound, haptics, fast, autoCapture, autoCaptureBestBall, autoCaptureUpgrade, hideOwnedOffers } = { ...get(), ...patch };
    AsyncStorage.setItem(KEY, JSON.stringify({ sound, haptics, fast, autoCapture, autoCaptureBestBall, autoCaptureUpgrade, hideOwnedOffers })).catch(() => {});
  },
}));
