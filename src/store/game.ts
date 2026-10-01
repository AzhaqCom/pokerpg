import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { GameState, grantDailyBalls, migrateSave, newGame } from '../game/game';
import { mathRng } from '../game/rng';

const KEY = 'pokelootborn/save/v1';
/**
 * Copies mises de côté des sauvegardes illisibles (`…/illisible/<horodatage>`) : jamais écrasées par une partie neuve.
 * Avant le 2026-10-01, un chargement raté démarrait une partie neuve et l'enregistrait par-dessus — toute la progression
 * était perdue (bug de conversion, sauvegarde abîmée…).
 */
export const BACKUP_KEY = 'pokelootborn/save/illisible';
/** Au-delà (en caractères), la sauvegarde approche des limites du stockage Android : avertissement, une fois par session. */
const SAVE_WARN_SIZE = 1_500_000;

interface Store {
  s: GameState | null;
  rev: number;
  /** Problème de sauvegarde à signaler au joueur (fenêtre dans `App.tsx`), `null` sinon. */
  saveIssue: string | null;
  clearSaveIssue: () => void;
  load: () => Promise<void>;
  /** modifie l'état puis sauvegarde (écriture groupée) */
  act: <T>(fn: (s: GameState) => T) => T | undefined;
  reset: () => Promise<void>;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
/** Lecture de la sauvegarde impossible : on n'écrit plus rien de la session (la sauvegarde existe peut-être encore). */
let savingBlocked = false;
let sizeWarned = false;
let writeFailed = false;

function writeSave(s: GameState) {
  if (savingBlocked) return;
  let json: string;
  try {
    json = JSON.stringify(s);
  } catch (e) {
    if (!writeFailed) { writeFailed = true; useGame.setState({ saveIssue: `La partie n'a pas pu être préparée pour la sauvegarde (${String((e as Error)?.message ?? e)}).` }); }
    return;
  }
  if (json.length > SAVE_WARN_SIZE && !sizeWarned) {
    sizeWarned = true;
    useGame.setState({
      saveIssue: `Ta sauvegarde devient très volumineuse (${(json.length / 1e6).toFixed(1)} Mo). Recycle ou fusionne des objets du Sac : au-delà d'une certaine taille, le téléphone pourrait refuser de l'enregistrer.`,
    });
  }
  AsyncStorage.setItem(KEY, json)
    .then(() => { writeFailed = false; })
    .catch((e) => {
      console.warn('Sauvegarde impossible', e);
      // une fois par série d'échecs : le joueur doit savoir que sa progression n'est plus enregistrée
      if (!writeFailed) {
        writeFailed = true;
        useGame.setState({ saveIssue: `La partie n'a pas pu être sauvegardée (${String(e?.message ?? e)}). Recycle des objets pour alléger la sauvegarde, puis relance le jeu.` });
      }
    });
}

function scheduleSave(s: GameState) {
  if (saveTimer) clearTimeout(saveTimer);
  // JSON.stringify de tout l'état peut être coûteux (sac/boîte volumineux) : le délai de 400 ms laisse
  // le temps aux clics rapprochés de s'annuler entre eux avant de sérialiser pour de vrai.
  saveTimer = setTimeout(() => { saveTimer = null; writeSave(s); }, 400);
}

export const useGame = create<Store>((set, get) => ({
  s: null,
  rev: 0,
  saveIssue: null,
  clearSaveIssue: () => set({ saveIssue: null }),
  load: async () => {
    let raw: string | null;
    try {
      raw = await AsyncStorage.getItem(KEY);
    } catch (e) {
      // lecture impossible (stockage indisponible, sauvegarde trop grosse…) : surtout ne rien écrire par-dessus
      savingBlocked = true;
      set({
        s: newGame(), rev: get().rev + 1,
        saveIssue: `Ta sauvegarde n'a pas pu être lue (${String((e as Error)?.message ?? e)}). Pour ne pas l'écraser, cette session ne sera pas sauvegardée : ferme complètement le jeu et relance-le.`,
      });
      return;
    }
    let s: GameState;
    let saveIssue: string | null = null;
    if (!raw) s = newGame();
    else {
      try {
        s = { ...newGame(), ...migrateSave(JSON.parse(raw)) } as GameState;
      } catch (e) {
        // sauvegarde lue mais inutilisable : on la met de côté avant de commencer une partie neuve
        try {
          await AsyncStorage.setItem(`${BACKUP_KEY}/${Date.now()}`, raw);
          saveIssue = `Ta sauvegarde n'a pas pu être chargée (${String((e as Error)?.message ?? e)}). Une copie a été mise de côté pour pouvoir la récupérer ; une nouvelle partie commence.`;
        } catch {
          savingBlocked = true;
          saveIssue = `Ta sauvegarde n'a pas pu être chargée ni mise de côté. Pour ne pas l'écraser, cette session ne sera pas sauvegardée.`;
        }
        s = newGame();
      }
    }
    grantDailyBalls(s);
    set({ s, rev: get().rev + 1, saveIssue });
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
    // une sauvegarde encore en attente réécrirait l'ancienne partie juste après l'effacement
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    savingBlocked = false; // effacement voulu par le joueur : on peut de nouveau écrire
    await AsyncStorage.removeItem(KEY);
    set({ s: newGame(), rev: get().rev + 1 });
  },
}));

export const rng = mathRng;
