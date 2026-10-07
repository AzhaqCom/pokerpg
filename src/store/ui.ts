import { create } from 'zustand';

export type Tab = 'team' | 'bag' | 'shop' | 'map' | 'pension' | 'exploration' | 'dex';

interface Toast { id: number; text: string; color?: string; /** partie du texte affichée dans `color` (ex. le nom d'un objet, à la couleur de sa rareté) */ colored?: string }

interface UiStore {
  tab: Tab;
  /** Pokémon ouvert dans la fiche (uid) */
  monSheet: string | null;
  /** liste affichée d'où la fiche a été ouverte (même tri/filtres) : flèches ← → de la fiche */
  monList: string[];
  toasts: Toast[];
  /** mode veille (économie de batterie, `SleepScreen`) : écran noir, combat qui continue sans être dessiné */
  sleep: boolean;
  setTab: (t: Tab) => void;
  setSleep: (on: boolean) => void;
  openMon: (uid: string | null, list?: string[]) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useUi = create<UiStore>((set) => ({
  tab: 'team',
  monSheet: null,
  monList: [],
  toasts: [],
  sleep: false,
  setTab: (tab) => set({ tab }),
  setSleep: (sleep) => set({ sleep, toasts: [] }),
  openMon: (monSheet, list) => set({ monSheet, monList: list ?? [] }),
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Durée d'affichage d'un message, et nombre maximum à l'écran : courts et peu nombreux pour laisser voir le combat. */
const TOAST_MS = 1600;
const TOAST_MAX = 2;

/** Petit message temporaire en haut de l'écran. */
export function toast(text: string, color?: string, colored?: string) {
  if (useUi.getState().sleep) return; // mode veille : rien à afficher, rien à redessiner
  const id = nextId++;
  useUi.setState((s) => ({ toasts: [...s.toasts.slice(-(TOAST_MAX - 1)), { id, text, color, colored }] }));
  setTimeout(() => useUi.getState().dismiss(id), TOAST_MS);
}
