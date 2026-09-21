import { BlendColor, FilterMode, Group, Image, MipmapMode, SkImage, rect } from '@shopify/react-native-skia';
import { ActionKey, ActionMeta, SpriteMeta, resolveAction } from './manifest';

const NEAREST = { filter: FilterMode.Nearest, mipmap: MipmapMode.None } as const;

export function totalMs(a: ActionMeta) {
  return a.ms.reduce((s, v) => s + v, 0);
}

/** Frame à afficher après `t` ms d'animation. */
export function frameAt(a: ActionMeta, t: number, loop: boolean) {
  const total = totalMs(a);
  let tt = loop ? ((t % total) + total) % total : Math.min(t, total - 1);
  for (let i = 0; i < a.ms.length; i++) {
    if (tt < a.ms[i]) return i;
    tt -= a.ms[i];
  }
  return a.ms.length - 1;
}

/** Échelle entière qui donne ~targetH px de haut sans dépasser maxW de large. */
export function autoScale(meta: SpriteMeta, targetH: number, maxW: number, min = 1, max = 5) {
  const idle = meta.actions.idle!;
  let s = Math.round(targetH / idle.fh);
  while (s > min && idle.fw * s > maxW) s--;
  return Math.max(min, Math.min(max, s));
}

interface Props {
  image: SkImage | null;
  meta: SpriteMeta;
  action: ActionKey;
  /** ms écoulées depuis le début de l'animation */
  t: number;
  loop?: boolean;
  /** position des pieds */
  x: number;
  y: number;
  scale: number;
  /** remplit la silhouette de cette couleur (évolution, fuite) */
  silhouette?: string;
  opacity?: number;
  /** nombre de frames à jouer avant de figer sur la dernière (voir `resolveCombatAction`) */
  frameLimit?: number;
}

/** Élément Skia (à placer dans un <Canvas>) qui dessine une frame PMD. */
export function PmdSprite({ image, meta, action, t, loop = true, x, y, scale: s, silhouette, opacity = 1, frameLimit }: Props) {
  if (!image) return null;
  let a = resolveAction(meta, action);
  if (frameLimit && frameLimit < a.ms.length) a = { ...a, ms: a.ms.slice(0, frameLimit) };
  const f = frameAt(a, t, loop);
  const dx = Math.round(x - a.ax * s);
  const dy = Math.round(y - a.ay * s);
  return (
    <Group clip={rect(dx, dy, a.fw * s, a.fh * s)} opacity={opacity}>
      <Image
        image={image}
        x={dx - f * a.fw * s}
        y={dy - a.y * s}
        width={meta.w * s}
        height={meta.h * s}
        fit="fill"
        sampling={NEAREST}
      >
        {silhouette ? <BlendColor color={silhouette} mode="srcIn" /> : null}
      </Image>
    </Group>
  );
}
