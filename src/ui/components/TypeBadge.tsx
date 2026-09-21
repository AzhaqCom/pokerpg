import { StyleSheet, Text } from 'react-native';
import { PType } from '../../game/data';
import { TYPE_COLOR, typeLabel } from '../helpers';

export function TypeBadge({ type, small }: { type: PType; small?: boolean }) {
  return <Text style={[styles.b, small && styles.s, { backgroundColor: TYPE_COLOR[type] }]}>{typeLabel(type)}</Text>;
}

const styles = StyleSheet.create({
  b: { color: '#fff', fontWeight: '800', fontSize: 11, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, overflow: 'hidden', textShadowColor: 'rgba(0,0,0,0.4)', textShadowRadius: 2 },
  s: { fontSize: 9, paddingHorizontal: 5, paddingVertical: 1 },
});
