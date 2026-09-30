import { Canvas, RoundedRect, SweepGradient, vec } from '@shopify/react-native-skia';
import { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { useFrameClock } from '../useFrameClock';

/** Couleurs de la bordure des objets Chromatique +N (boucle fermée : la dernière reprend la première). */
export const RAINBOW = ['#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#00c7be', '#007aff', '#af52de', '#ff3b30'];
/** Texte lettre par lettre aux couleurs de l'arc-en-ciel (fixe, aucun coût d'animation), à placer dans un `<Text>`. */
export function RainbowText({ text }: { text: string }) {
  return <>{[...text].map((ch, i) => <Text key={i} style={{ color: RAINBOW[i % (RAINBOW.length - 1)], fontWeight: '900' }}>{ch}</Text>)}</>;
}

/** Un tour complet de la bordure animée (fiche détaillée seulement). */
const TURN_MS = 6000;

/**
 * Bordure arc-en-ciel posée sur une carte (position absolue, sous le contenu, ne capte aucun toucher).
 * Fixe par défaut : une seule forme dessinée, sans horloge, pour les listes de milliers d'objets. `animated` (une seule
 * carte à l'écran, fiche détaillée) : le dégradé tourne lentement, seul ce composant se redessine.
 */
export function RainbowBorder({ radius, width = 2, animated = false }: { radius: number; width?: number; animated?: boolean }) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const onLayout = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    if (!size || size.w !== w || size.h !== h) setSize({ w, h });
  };
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" onLayout={onLayout}>
      {size && <Ring w={size.w} h={size.h} radius={radius} width={width} animated={animated} />}
    </View>
  );
}

function Ring({ w, h, radius, width, animated }: { w: number; h: number; radius: number; width: number; animated: boolean }) {
  const now = useFrameClock(30, animated);
  const angle = animated ? ((now % TURN_MS) / TURN_MS) * 2 * Math.PI : 0;
  const c = vec(w / 2, h / 2);
  return (
    <Canvas style={{ width: w, height: h }}>
      <RoundedRect x={width / 2} y={width / 2} width={w - width} height={h - width} r={radius} style="stroke" strokeWidth={width}>
        <SweepGradient c={c} colors={RAINBOW} origin={c} transform={[{ rotate: angle }]} />
      </RoundedRect>
    </Canvas>
  );
}
