import { Image, ImageSourcePropType } from 'react-native';
import { BallKind } from '../../game/game';

const SOURCES: Record<BallKind, ImageSourcePropType> = {
  poke: require('../../../assets/items/poke-ball.png'),
  super: require('../../../assets/items/great-ball.png'),
  hyper: require('../../../assets/items/ultra-ball.png'),
};

export function BallIcon({ kind, size = 20 }: { kind: BallKind; size?: number }) {
  return <Image source={SOURCES[kind]} style={{ width: size, height: size }} resizeMode="contain" />;
}
