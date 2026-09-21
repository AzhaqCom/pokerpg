import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const KEY = 'pokelootborn/settings/v1';

export interface Settings {
  sound: boolean;
  /** musique de fond en boucle (indépendant des bruitages) */
  music: boolean;
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
  /** rareté d'objet maximale incluse dans le recyclage groupé du Sac (0 Commun … 6 Chromatique) */
  recycleMaxRarity: number;
  /** recycle automatiquement (en éclats) les objets trouvés hors ligne jusqu'à `idleRecycleMaxRarity`,
   *  plutôt que de les ajouter au Sac */
  idleAutoRecycle: boolean;
  /** rareté d'objet maximale recyclée automatiquement hors ligne (indépendante de `recycleMaxRarity`) */
  idleRecycleMaxRarity: number;
}

const DEFAULTS: Settings = {
  sound: true, music: true, haptics: true, fast: false,
  autoCapture: false, autoCaptureBestBall: false, autoCaptureUpgrade: false, hideOwnedOffers: false,
  recycleMaxRarity: 1, idleAutoRecycle: true, idleRecycleMaxRarity: 1,
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
    const {
      sound, music, haptics, fast, autoCapture, autoCaptureBestBall, autoCaptureUpgrade, hideOwnedOffers,
      recycleMaxRarity, idleAutoRecycle, idleRecycleMaxRarity,
    } = { ...get(), ...patch };
    AsyncStorage.setItem(KEY, JSON.stringify({
      sound, music, haptics, fast, autoCapture, autoCaptureBestBall, autoCaptureUpgrade, hideOwnedOffers,
      recycleMaxRarity, idleAutoRecycle, idleRecycleMaxRarity,
    })).catch(() => {});
  },
}));
