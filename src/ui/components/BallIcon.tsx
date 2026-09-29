import { Image, ImageSourcePropType } from 'react-native';
import { BallKind } from '../../game/game';

const SOURCES: Record<BallKind, ImageSourcePropType> = {
  poke: require('../../../assets/items/poke-ball.png'),
  super: require('../../../assets/items/great-ball.png'),
  hyper: require('../../../assets/items/ultra-ball.png'),
};

/** `grey` : Ball grisée (Pokémon vu mais pas possédé, sur la Carte). */
export function BallIcon({ kind, size = 20, grey = false }: { kind: BallKind; size?: number; grey?: boolean }) {
  return (
    <Image source={SOURCES[kind]} style={[{ width: size, height: size }, grey && { opacity: 0.45 }]} resizeMode="contain"
      tintColor={grey ? '#8a8f99' : undefined} />
  );
}
