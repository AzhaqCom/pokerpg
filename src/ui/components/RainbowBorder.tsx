import { BlurMask, Canvas, Group, RoundedRect, SweepGradient, vec } from '@shopify/react-native-skia';
import { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { useFrameClock } from '../useFrameClock';
import { RAINBOW, chromaTextColors, chromaTier } from '../helpers';

export { RAINBOW };

/** Texte lettre par lettre aux couleurs d'un dégradé (arc-en-ciel par défaut ; fixe, aucun coût d'animation), à placer
 *  dans un `<Text>`. */
export function RainbowText({ text, colors = RAINBOW }: { text: string; colors?: string[] }) {
  const cols = chromaTextColors(colors);
  return <>{[...text].map((ch, i) => <Text key={i} style={{ color: cols[i % cols.length], fontWeight: '900' }}>{ch}</Text>)}</>;
}

/** « Chromatique +N » (ou tout autre texte) aux couleurs du palier du cran. */
export function ChromaText({ plus, text }: { plus: number; text: string }) {
  return <RainbowText text={text} colors={chromaTier(plus).colors} />;
}

/**
 * Pastille « +N » aux couleurs du palier. `overlay` : posée à cheval sur la bordure en haut à gauche de la carte (comme la
 * miniature du porteur en haut à droite : la carte ne grandit jamais) ; sinon dans le flux (mini-cartes de la fiche Pokémon).
 */
export function ChromaPill({ plus, overlay }: { plus: number; overlay?: boolean }) {
  const t = chromaTier(plus);
  const dark = t.colors === RAINBOW; // arc-en-ciel : fond sombre, chiffres aux couleurs de la bordure
  return (
    <View pointerEvents="none" style={[styles.pill, { backgroundColor: t.pill }, dark && styles.pillDark, overlay && styles.pillOverlay]}>
      <Text style={[styles.pillTxt, { color: t.ink }]}>{dark ? <RainbowText text={`+${plus}`} /> : `+${plus}`}</Text>
    </View>
  );
}

/** Un tour complet de la bordure animée (fiche détaillée seulement). */
const TURN_MS = 6000;
/** Débord du halo autour de la carte (paliers à halo seulement). */
const GLOW = 6;

/**
 * Bordure d'un Chromatique +N, aux couleurs de son palier (`chromaTier`), posée sur une carte (position absolue, sous le
 * contenu, ne capte aucun toucher). Fixe par défaut : une seule forme dessinée, sans horloge, pour les listes de milliers
 * d'objets. `animated` (une seule carte à l'écran, fiche détaillée) : le dégradé tourne lentement, seul ce composant se
 * redessine. Halo (Or et au-delà) : copie floutée de la bordure, dans un canevas qui déborde de `GLOW` autour de la carte.
 */
export function RainbowBorder({ plus, radius, animated = false }: { plus: number; radius: number; animated?: boolean }) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const tier = chromaTier(plus);
  const pad = tier.glow ? GLOW : 0;
  const onLayout = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    if (!size || size.w !== w || size.h !== h) setSize({ w, h });
  };
  return (
    <View style={[StyleSheet.absoluteFill, { top: -pad, left: -pad, right: -pad, bottom: -pad }]} pointerEvents="none" onLayout={onLayout}>
      {size && <Ring w={size.w} h={size.h} pad={pad} radius={radius} plus={plus} animated={animated} />}
    </View>
  );
}

function Ring({ w, h, pad, radius, plus, animated }: { w: number; h: number; pad: number; radius: number; plus: number; animated: boolean }) {
  const now = useFrameClock(30, animated);
  const angle = animated ? ((now % TURN_MS) / TURN_MS) * 2 * Math.PI : 0;
  const t = chromaTier(plus);
  const c = vec(w / 2, h / 2);
  const ring = (inset: number, width: number, colors: string[]) => ({
    x: pad + inset + width / 2, y: pad + inset + width / 2, width: w - 2 * (pad + inset) - width, height: h - 2 * (pad + inset) - width,
    r: Math.max(0, radius - inset), strokeWidth: width, colors,
  });
  const rings = [ring(0, t.width, t.colors)];
  if (t.inner) rings.push(ring(t.width, 1.5, t.inner));
  return (
    <Canvas style={{ width: w, height: h }}>
      {t.glow && (
        <Group opacity={0.55}>
          <RoundedRect x={rings[0].x} y={rings[0].y} width={rings[0].width} height={rings[0].height} r={rings[0].r} style="stroke" strokeWidth={t.width + 3}>
            <SweepGradient c={c} colors={t.colors} origin={c} transform={[{ rotate: angle }]} />
            <BlurMask blur={4} style="normal" />
          </RoundedRect>
        </Group>
      )}
      {rings.map((g, i) => (
        <RoundedRect key={i} x={g.x} y={g.y} width={g.width} height={g.height} r={g.r} style="stroke" strokeWidth={g.strokeWidth}>
          <SweepGradient c={c} colors={g.colors} origin={c} transform={[{ rotate: angle }]} />
        </RoundedRect>
      ))}
    </Canvas>
  );
}

const styles = StyleSheet.create({
  pill: { borderRadius: 7, paddingHorizontal: 5, alignSelf: 'flex-start' },
  pillDark: { borderWidth: 1, borderColor: '#5f6880' },
  pillOverlay: { position: 'absolute', top: -8, left: 10, zIndex: 2 },
  pillTxt: { fontSize: 10, fontWeight: '900', lineHeight: 14 },
});
