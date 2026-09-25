import { StyleSheet, Text } from 'react-native';
import { PType } from '../../game/data';
import { TYPE_COLOR, textOn, typeLabel } from '../helpers';

/** Texte sombre sur les badges les plus clairs (Électrik, Glace, Acier), blanc ombré sur les autres. */
export function TypeBadge({ type, small }: { type: PType; small?: boolean }) {
  const bg = TYPE_COLOR[type];
  const dark = textOn(bg, 0.7) === '#111';
  return <Text style={[styles.b, small && styles.s, { backgroundColor: bg }, dark && styles.dark]}>{typeLabel(type)}</Text>;
}

const styles = StyleSheet.create({
  b: { color: '#fff', fontWeight: '800', fontSize: 11, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, overflow: 'hidden', textShadowColor: 'rgba(0,0,0,0.4)', textShadowRadius: 2 },
  s: { fontSize: 9, paddingHorizontal: 5, paddingVertical: 1 },
  dark: { color: '#111', textShadowRadius: 0 },
});
