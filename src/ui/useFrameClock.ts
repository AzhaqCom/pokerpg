import { useEffect, useState } from 'react';

/** Horloge d'animation : renvoie Date.now(), rafraîchie ~fps fois par seconde. */
export function useFrameClock(fps = 30, active = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let last = 0;
    const step = 1000 / fps;
    const loop = (t: number) => {
      if (t - last >= step) {
        last = t;
        setNow(Date.now());
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [fps, active]);
  return now;
}
