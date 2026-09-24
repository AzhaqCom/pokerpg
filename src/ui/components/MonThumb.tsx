import { Image, ImageStyle, StyleProp, Text, View } from 'react-native';
import { THUMB_ASSETS } from '../../data/thumbAssets';
import { spriteKey } from '../../sprites/manifest';

/**
 * Vignette d'un Pokémon (silhouette noire si non découvert). Si chromatique, un ✨ est superposé en
 * haut à droite de la vignette (plutôt que d'occuper une ligne/portion de texte à côté du nom — utile
 * pour les noms longs).
 */
export function MonThumb({ speciesId, shiny = false, size, silhouette = false, style }: {
  speciesId: number; shiny?: boolean; size: number; silhouette?: boolean; style?: StyleProp<ImageStyle>;
}) {
  const img = (
    <Image
      source={THUMB_ASSETS[spriteKey(speciesId, shiny)]}
      style={[{ width: size, height: size }, silhouette && { opacity: 0.6 }, style]}
      tintColor={silhouette ? '#0e1118' : undefined}
      resizeMode="contain"
      resizeMethod="resize"
    />
  );
  if (!shiny) return img;
  return (
    <View style={{ width: size, height: size }}>
      {img}
      <Text style={{ position: 'absolute', top: -2, right: -4, fontSize: Math.max(10, Math.round(size * 0.28)) }}>✨</Text>
    </View>
  );
}
