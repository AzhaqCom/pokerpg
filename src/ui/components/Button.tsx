import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { C } from '../theme';

interface Props {
  label: string;
  onPress: () => void;
  color?: string;
  textColor?: string;
  disabled?: boolean;
  style?: ViewStyle;
  small?: boolean;
  icon?: ReactNode;
}

export function Button({ label, onPress, color = C.panel2, textColor = C.text, disabled, style, small, icon }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn, small && styles.small, { backgroundColor: color, opacity: disabled ? 0.4 : pressed ? 0.75 : 1 }, style,
      ]}
    >
      <View style={styles.content}>
        {icon}
        <Text style={[styles.text, small && styles.smallText, { color: textColor }]}>{label}</Text>
      </View>
    </Pressable>
  );
}

/** Gros bouton de la barre d'actions : icône + libellé. */
export function ActionButton({ icon, label, onPress, disabled, active }: { icon: string; label: string; onPress: () => void; disabled?: boolean; active?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.action, active && styles.actionActive, { opacity: disabled ? 0.35 : pressed ? 0.7 : 1 }]}
    >
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.actionLabel} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

export function IconButton({ label, onPress, badge }: { label: string; onPress: () => void; badge?: string }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.7 : 1 }]}>
      <Text style={styles.iconBtnText}>{label}</Text>
      {badge ? <View style={styles.badge}><Text style={styles.badgeText}>{badge}</Text></View> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { paddingHorizontal: 18, paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
  small: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  content: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  text: { fontSize: 16, fontWeight: '700' },
  smallText: { fontSize: 14 },
  action: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 14, backgroundColor: C.panel },
  actionActive: { backgroundColor: C.panel2 },
  icon: { fontSize: 24 },
  actionLabel: { color: C.text, fontSize: 12, fontWeight: '600', marginTop: 2 },
  iconBtn: { backgroundColor: C.panel, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  iconBtnText: { color: C.text, fontWeight: '700', fontSize: 14 },
  badge: { position: 'absolute', top: -6, right: -6, backgroundColor: C.accent, borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
});
