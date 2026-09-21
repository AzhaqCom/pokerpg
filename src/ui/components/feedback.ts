import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { Sfx, sfx } from '../../audio/sfx';
import { useSettings } from '../../store/settings';

/** Son + petite vibration sur une action. */
export function feedback(sound: Sfx = 'tap', strong = false) {
  sfx(sound);
  if (Platform.OS === 'web' || !useSettings.getState().haptics) return;
  Haptics.impactAsync(strong ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}
