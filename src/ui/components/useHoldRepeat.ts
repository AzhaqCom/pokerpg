import { useEffect, useRef } from 'react';

/** Délai entre deux tics au début d'un appui long (ms), puis ×`SPEEDUP` à chaque tic jusqu'à `MIN_DELAY`. */
const START_DELAY = 260;
const MIN_DELAY = 80;
const SPEEDUP = 0.8;
/** Une fois au délai minimal, le nombre d'actions par tic double à chaque tic, jusqu'à ce plafond. */
const MAX_BATCH = 256;

/**
 * Répétition **accélérée** tant qu'un bouton est maintenu (« +1 » de la fenêtre d'achat en quantité de la Boutique ;
 * « Améliorer » d'un objet ouvre une fenêtre +1 / +10 depuis le 2026-10-02) : les tics se rapprochent
 * (260 ms → 80 ms : une sauvegarde par tic au plus), puis chaque tic fait 2, 4, 8… actions d'un coup — vitesse exponentielle, sans un état de jeu
 * sauvegardé par action. `step(n)` tente `n` actions et renvoie combien ont réussi (moins que `n` = arrêt : plus
 * d'éclats, niveau maximum). `onEnd` est appelé une fois au relâchement s'il y a eu au moins une action.
 * À brancher sur `onLongPress` / `onPressOut` d'un `Button`.
 */
export function useHoldRepeat(step: (n: number) => number, onEnd?: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const done = useRef(0);
  const stepRef = useRef(step);
  stepRef.current = step;
  const endRef = useRef(onEnd);
  endRef.current = onEnd;

  const stop = () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (done.current > 0) { done.current = 0; endRef.current?.(); }
  };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const start = () => {
    stop();
    let delay = START_DELAY;
    let batch = 1;
    const tick = () => {
      const k = stepRef.current(batch);
      done.current += k;
      if (k < batch) { stop(); return; }
      if (delay > MIN_DELAY) delay = Math.max(MIN_DELAY, delay * SPEEDUP);
      else batch = Math.min(MAX_BATCH, batch * 2);
      timer.current = setTimeout(tick, delay);
    };
    tick();
  };
  return { start, stop };
}
