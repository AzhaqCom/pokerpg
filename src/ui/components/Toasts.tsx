import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUi } from '../../store/ui';
import { C } from '../theme';

export function Toasts() {
  const toasts = useUi((s) => s.toasts);
  const insets = useSafeAreaInsets();
  if (!toasts.length) return null;
  return (
    <View pointerEvents="none" style={[styles.wrap, { top: insets.top + 8 }]}>
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
  wrap: { position: 'absolute', left: 16, right: 16, gap: 6, alignItems: 'center' },
  toast: { backgroundColor: 'rgba(20,24,34,0.95)', borderColor: C.gold, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14 },
  text: { color: C.text, fontWeight: '700', fontSize: 14 },
});
