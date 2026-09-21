import { Text } from 'react-native';
import { Mon } from '../../game/model';
import { monStars } from '../../game/stats';
import { C } from '../theme';

/** Jaune pour 1-3★, rouge (jackpot) pour 4★ — jamais la même couleur que les étoiles vides. */
const FILLED_COLOR = { 1: '#ffd54f', 2: '#ffd54f', 3: '#ffd54f', 4: '#e53935' } as const;
const EMPTY_COLOR = C.sub;

/** Étoiles de qualité génétique (voir `monStars`) : jaune (1-3★), rouge et gras si parfait (4★). */
export function Stars({ mon, size = 11 }: { mon: Mon; size?: number }) {
  const n = monStars(mon);
  return (
    <Text style={{ fontSize: size, fontWeight: n === 4 ? '900' : '700' }}>
      <Text style={{ color: FILLED_COLOR[n] }}>{'★'.repeat(n)}</Text>
      <Text style={{ color: EMPTY_COLOR }}>{'☆'.repeat(4 - n)}</Text>
    </Text>
  );
}
