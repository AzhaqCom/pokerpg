import { Text as RNText, TextInput as RNTextInput, TextInputProps, TextProps } from 'react-native';

/**
 * Police du jeu, embarquée dans l'APK (plugin `expo-font` dans app.json, famille Android « Nunito » en 5 graisses :
 * le `fontWeight` des styles choisit la bonne). Avant, les textes utilisaient la police système : sur les téléphones
 * Xiaomi (MiSans), le premier affichage après un lancement à froid mesurait les textes avec une police et les
 * dessinait avec une autre, plus large, d'où des mots coupés (« Equip », « Nv.10 ») jusqu'au rechargement.
 */
export const FONT = 'Nunito';

/** `Text` de React Native avec la police du jeu : à utiliser partout à la place de celui de 'react-native'. */
export function Text({ style, ...props }: TextProps) {
  return <RNText {...props} style={[{ fontFamily: FONT }, style]} />;
}

/** `TextInput` de React Native avec la police du jeu. */
export function TextInput({ style, ...props }: TextInputProps) {
  return <RNTextInput {...props} style={[{ fontFamily: FONT }, style]} />;
}
