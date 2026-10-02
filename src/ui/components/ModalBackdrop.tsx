import { ReactNode } from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

/**
 * Fond d'une fenêtre (`Modal`) : la couche sombre qui ferme au toucher est posée DERRIÈRE le contenu, pas autour
 * (même structure que l'aide et les fenêtres de la Tour). Avant le 2026-10-02, le contenu était un `Pressable` vide
 * dans le `Pressable` du fond : sur Android, un geste commencé sur un endroit non tactile d'une liste (texte, vignette,
 * espace entre deux lignes) était capté par eux et la liste défilait mal. Toucher en dehors ferme toujours, toucher
 * dedans ne ferme jamais. `style` : le style du fond (couleur + placement) ; la couleur va à la couche sombre, le
 * placement au contenu.
 */
export function ModalBackdrop({ style, onClose, children }: {
  style: StyleProp<ViewStyle>; onClose: () => void; children: ReactNode;
}) {
  const { backgroundColor, ...layout } = StyleSheet.flatten(style) ?? {};
  return (
    <>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor }]} onPress={onClose} />
      <View style={[StyleSheet.absoluteFill, layout]} pointerEvents="box-none">{children}</View>
    </>
  );
}
