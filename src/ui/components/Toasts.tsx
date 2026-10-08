import { StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUi } from '../../store/ui';
import { C } from '../theme';

/** Messages : juste sous la barre du haut (en haut de la zone de combat), jamais par-dessus ses boutons (🔋, ⚙). */
export function Toasts() {
  const toasts = useUi((s) => s.toasts);
  const hud = useUi((s) => s.hudHeight);
  const insets = useSafeAreaInsets();
  if (!toasts.length) return null;
  return (
    <View pointerEvents="none" style={[styles.wrap, { top: insets.top + hud + 6 }]}>
      {toasts.map((t) => (
        <View key={t.id} style={styles.toast}>
          <Text style={styles.text}>
            {t.colored && t.color && t.text.includes(t.colored)
              ? <>{t.text.split(t.colored)[0]}<Text style={{ color: t.color }}>{t.colored}</Text>{t.text.split(t.colored).slice(1).join(t.colored)}</>
              : t.text}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, gap: 4, alignItems: 'center' },
  toast: { backgroundColor: 'rgba(20,24,34,0.92)', borderColor: C.gold, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  text: { color: C.text, fontWeight: '700', fontSize: 12 },
});
