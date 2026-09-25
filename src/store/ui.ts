import { create } from 'zustand';

export type Tab = 'team' | 'bag' | 'map' | 'pension' | 'exploration' | 'dex';

interface Toast { id: number; text: string; color?: string; /** partie du texte affichée dans `color` (ex. le nom d'un objet, à la couleur de sa rareté) */ colored?: string }

interface UiStore {
  tab: Tab;
  /** Pokémon ouvert dans la fiche (uid) */
  monSheet: string | null;
  toasts: Toast[];
  setTab: (t: Tab) => void;
  openMon: (uid: string | null) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useUi = create<UiStore>((set) => ({
  tab: 'team',
  monSheet: null,
  toasts: [],
  setTab: (tab) => set({ tab }),
  openMon: (monSheet) => set({ monSheet }),
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Durée d'affichage d'un message, et nombre maximum à l'écran : courts et peu nombreux pour laisser voir le combat. */
const TOAST_MS = 1600;
const TOAST_MAX = 2;

/** Petit message temporaire en haut de l'écran. */
export function toast(text: string, color?: string, colored?: string) {
  const id = nextId++;
  useUi.setState((s) => ({ toasts: [...s.toasts.slice(-(TOAST_MAX - 1)), { id, text, color, colored }] }));
  setTimeout(() => useUi.getState().dismiss(id), TOAST_MS);
}
