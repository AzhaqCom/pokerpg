import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import type { CollectionGoal } from '../game/collection';

const KEY = 'pokelootborn/settings/v1';

export interface Settings {
  sound: boolean;
  /** musique de fond en boucle (indépendant des bruitages) */
  music: boolean;
  haptics: boolean;
  /** vitesse de combat choisie (×2 dès le 1er badge, ×3 dès le 4e badge de la région : plafonnée par
   *  `maxBattleSpeed`, donc ×1 après un Nouveau départ tant qu'aucun badge n'est regagné) */
  speed: 1 | 2 | 3;
  /** ancien réglage (capture auto des espèces jamais capturées) : remplacé par `collectionGoal`, lu une fois pour migrer */
  autoCapture: boolean;
  /** objectif de collection, qui pilote la capture automatique, le nettoyage des doublons et « Compléter » :
   *  'off' rien d'automatique, 'dex' chaque espèce une fois au Pokédex, 'box' 1 exemplaire de chaque espèce en boîte,
   *  'boxShiny' 1 normal + 1 chromatique de chaque espèce en boîte (voir `collection.ts`) */
  collectionGoal: CollectionGoal;
  /** capture auto : Ball la plus forte en stock plutôt que la moins chère */
  autoCaptureBestBall: boolean;
  /** capture auto : se redéclenche aussi pour une espèce déjà possédée tant qu'elle est sous 3★ */
  autoCaptureUpgrade: boolean;
  /** ne propose pas une capture si l'espèce est déjà possédée à 3★ ou mieux */
  hideOwnedOffers: boolean;
  /** rareté d'objet maximale incluse dans le recyclage groupé du Sac (0 Commun … 6 Chromatique) */
  recycleMaxRarity: number;
  /** « ♻ Recycler les petits crans » du Sac : Chromatiques de +0 jusqu'à ce cran (dernier choix retenu) */
  recyclePlusMax: number;
  /** recycle automatiquement (en éclats) les objets trouvés hors ligne jusqu'à `idleRecycleMaxRarity`,
   *  plutôt que de les ajouter au Sac */
  idleAutoRecycle: boolean;
  /** rareté d'objet maximale recyclée automatiquement hors ligne (indépendante de `recycleMaxRarity`) */
  idleRecycleMaxRarity: number;
  /** ignore la capture (garantie) d'un chromatique dont l'espèce est déjà chromatique dans le Pokédex,
   *  en combat comme hors ligne */
  skipOwnedShiny: boolean;
  /** « Nettoyer les doublons » garde en plus 1 exemplaire de réserve par étage d'évolution pas encore
   *  possédé (mode collectionneur complet) ; désactivé = mode léger, ne garde que ce qui est déjà possédé */
  keepEvolutionMaterial: boolean;
  /** lignées ciblées (🎯) : une capture qui n'améliore rien (ni chromatique, ni plus d'étoiles que le meilleur
   *  exemplaire) est relâchée aussitôt en bonbons, en combat comme hors ligne */
  convertTargets: boolean;
  /** empêche l'écran de se mettre en veille tant que le jeu est affiché (expo-keep-awake) */
  keepAwake: boolean;
  /** masque le bouton « Ne garder que les chromatiques » de la boîte (évite un relâcher massif par erreur) */
  hideShinyOnlyButton: boolean;
  /** masque le bouton « Ne garder que 3★+ » de la boîte (même raison) */
  hideStarsOnlyButton: boolean;
}

const DEFAULTS: Settings = {
  sound: true, music: true, haptics: true, speed: 1,
  autoCapture: false, autoCaptureBestBall: false, autoCaptureUpgrade: false, hideOwnedOffers: false,
  recycleMaxRarity: 1, recyclePlusMax: 6, idleAutoRecycle: true, idleRecycleMaxRarity: 1, skipOwnedShiny: false,
  keepEvolutionMaterial: true, convertTargets: true, keepAwake: false, hideShinyOnlyButton: false, hideStarsOnlyButton: false, collectionGoal: 'off',
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
      const saved = raw ? JSON.parse(raw) : {};
      // migration : l'ancienne capture auto des espèces manquantes devient l'objectif « Pokédex »
      if (!saved.collectionGoal) saved.collectionGoal = saved.autoCapture ? 'dex' : 'off';
      // migration : l'ancien interrupteur ×2 (`fast`) devient la vitesse choisie
      if (saved.speed === undefined) saved.speed = saved.fast ? 2 : 1;
      delete saved.fast;
      set({ ...DEFAULTS, ...saved });
    } catch { /* défauts */ }
  },
  set: (patch) => {
    set(patch);
    const {
      sound, music, haptics, speed, autoCapture, autoCaptureBestBall, autoCaptureUpgrade, hideOwnedOffers,
      recycleMaxRarity, recyclePlusMax, idleAutoRecycle, idleRecycleMaxRarity, skipOwnedShiny, keepEvolutionMaterial, convertTargets, keepAwake,
      hideShinyOnlyButton, hideStarsOnlyButton, collectionGoal,
    } = { ...get(), ...patch };
    AsyncStorage.setItem(KEY, JSON.stringify({
      sound, music, haptics, speed, autoCapture, autoCaptureBestBall, autoCaptureUpgrade, hideOwnedOffers,
      recycleMaxRarity, recyclePlusMax, idleAutoRecycle, idleRecycleMaxRarity, skipOwnedShiny, keepEvolutionMaterial, convertTargets, keepAwake,
      hideShinyOnlyButton, hideStarsOnlyButton, collectionGoal,
    })).catch(() => {});
  },
}));
