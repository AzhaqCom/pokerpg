import { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { fmtNum } from '../helpers';
import { C } from '../theme';

/**
 * Bouton d'achat : le prix quand on peut payer, sinon ce qui manque (« −6 750 ») au lieu d'un simple bouton grisé.
 * `label` remplace le texte et désactive le bouton (ex. « réserve pleine », « Niveau maximum »).
 */
export function BuyButton({ cost, shards, text, label, onPress, onLongPress, onPressOut, style, big }: {
  cost: number; shards: number; text: string; label?: string; onPress: () => void;
  onLongPress?: () => void; onPressOut?: () => void; style?: object;
  /** grand bouton (fenêtre d'achat en quantité) : 40 px de haut, texte plus gros — facile à toucher */
  big?: boolean;
}) {
  const can = !label && shards >= cost;
  return (
    <Pressable disabled={!can} onPress={onPress} onLongPress={onLongPress} onPressOut={onPressOut} delayLongPress={350}
      style={({ pressed }) => [styles.buy, big && styles.buyBig, !can && styles.buyOff, pressed && { opacity: 0.75 }, style]}>
      <Text style={[styles.buyTxt, big && styles.buyTxtBig, !can && styles.buyTxtOff]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {label ?? (can ? text : `−${fmtNum(cost - shards)}`)}
      </Text>
    </Pressable>
  );
}

/** Un bouton de la fenêtre : texte (« ×10 · 2 000 💎 »), coût, action ; `onLongPress`/`onPressOut` : achat en continu. */
export interface QuantityOption {
  text: string;
  cost: number;
  onPress: () => void;
  onLongPress?: () => void;
  onPressOut?: () => void;
  /** remplace le texte et désactive le bouton (« Niveau maximum ») */
  label?: string;
  /** largeur relative (1 par défaut) */
  flex?: number;
}

/**
 * Fenêtre d'achat en quantité, ouverte en maintenant un article (Boutique : Balls, méga bonbon universel) ou
 * « Améliorer » (fiche d'un objet) : un gros bouton par quantité, ce qui manque affiché quand on ne peut pas payer ;
 * reste ouverte jusqu'à « Fermer ».
 */
export function QuantityModal({ icon, title, sub, shards, options, hint, onClose }: {
  icon: ReactNode; title: ReactNode; sub?: string; shards: number; options: QuantityOption[]; hint?: string; onClose: () => void;
}) {
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.modal} onPress={() => {}}>
          <View style={styles.head}>
            {icon}
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{title}</Text>
              {sub ? <Text style={styles.desc}>{sub}</Text> : null}
            </View>
          </View>
          <Text style={styles.desc}>💎 {fmtNum(shards)} éclats</Text>
          <View style={styles.btns}>
            {options.map((o, i) => (
              <BuyButton key={i} big cost={o.cost} shards={shards} text={o.text} label={o.label} onPress={o.onPress}
                onLongPress={o.onLongPress} onPressOut={o.onPressOut} style={{ flex: o.flex ?? 1 }} />
            ))}
          </View>
          {hint ? <Text style={styles.hint}>{hint}</Text> : null}
          <Pressable onPress={onClose} style={styles.closeBtn}><Text style={styles.closeTxt}>Fermer</Text></Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
  modal: { backgroundColor: C.panel, borderRadius: 18, padding: 16, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { color: C.text, fontSize: 17, fontWeight: '900' },
  desc: { color: C.dim, fontSize: 11 },
  hint: { color: C.dim, fontSize: 11, marginTop: -2 },
  btns: { flexDirection: 'row', gap: 10 },
  closeBtn: { alignItems: 'center', paddingVertical: 10, borderRadius: 10, backgroundColor: C.panel2 },
  closeTxt: { color: C.text, fontWeight: '800' },
  buy: { backgroundColor: C.accent, borderRadius: 8, paddingVertical: 5, paddingHorizontal: 6, alignItems: 'center', marginTop: 2 },
  buyOff: { backgroundColor: C.panel2 },
  buyTxt: { color: C.text, fontSize: 11, fontWeight: '900' },
  buyBig: { height: 40, justifyContent: 'center', borderRadius: 10, marginTop: 0 },
  buyTxtBig: { fontSize: 14 },
  buyTxtOff: { color: C.dim },
});
