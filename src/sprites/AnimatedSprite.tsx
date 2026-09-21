import { Canvas, useImage } from '@shopify/react-native-skia';
import { useMemo, useRef } from 'react';
import { useFrameClock } from '../ui/useFrameClock';
import { ActionKey, getSprite } from './manifest';
import { PmdSprite } from './PmdSprite';

interface Props {
  species: number;
  shiny?: boolean;
  action?: ActionKey;
  /** échelle entière ; 'auto' = s'adapte à la hauteur du canvas */
  scale?: number | 'auto';
  width: number;
  height: number;
  /** marge sous les pieds */
  ground?: number;
  silhouette?: string;
}

/** Sprite PMD animé autonome (son propre Canvas et sa propre horloge). */
export function AnimatedSprite({ species, shiny = false, action = 'idle', scale = 'auto', width, height, ground = 8, silhouette }: Props) {
  const sprite = getSprite(species, shiny);
  const image = useImage(sprite?.asset ?? null);
  const now = useFrameClock(20);
  const start = useRef({ key: '', t: 0 });
  const k = `${sprite?.key}:${action}`;
  if (start.current.key !== k) start.current = { key: k, t: now };
  const s = useMemo(() => {
    if (!sprite) return 1;
    if (scale !== 'auto') return scale;
    const idle = sprite.meta.actions.idle!;
    return Math.max(1, Math.min(6, Math.floor(Math.min((height - ground) * 0.9 / idle.fh, width * 0.9 / idle.fw))));
  }, [sprite?.key, scale, width, height]);
  if (!sprite) return null;
  return (
    <Canvas style={{ width, height }}>
      <PmdSprite image={image} meta={sprite.meta} action={action} t={now - start.current.t}
        x={width / 2} y={height - ground} scale={s} silhouette={silhouette} />
    </Canvas>
  );
}
