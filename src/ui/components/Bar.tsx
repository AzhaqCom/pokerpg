import { StyleSheet, Text, View } from 'react-native';
import { C } from '../theme';

/** Jauge 0..max ; passe au rouge sous le seuil critique. */
export function Bar({ label, value, color, max = 100, showValue = true, critical = 25 }: {
  label: string; value: number; color: string; max?: number; showValue?: boolean; critical?: number;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const low = max === 100 && value <= critical;
  return (
    <View style={styles.row}>
      <Text style={[styles.label, low && { color: C.bad }]}>{label}</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: low ? C.bad : color }]} />
      </View>
      {showValue && <Text style={styles.value}>{value}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { color: C.sub, fontSize: 13, width: 60, fontWeight: '600' },
  track: { flex: 1, height: 10, backgroundColor: C.panel2, borderRadius: 5, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5 },
  value: { color: C.text, fontSize: 12, width: 28, textAlign: 'right', fontVariant: ['tabular-nums'] },
});
