import * as Brightness from 'expo-brightness';
import { useKeepAwake } from 'expo-keep-awake';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { setMusicEnabled } from '../audio/music';
import { setSfxEnabled } from '../audio/sfx';
import { BIOMES } from '../game/content';
import { useGame } from '../store/game';
import { useSettings } from '../store/settings';
import { useUi } from '../store/ui';
import { runner } from './battle/runner';
import { Text } from './components/Text';

/** Le combat avance 4 fois par seconde en veille (30 à 60 fois en jeu), par tranches de 100 ms (le plus grand pas de
 *  `runner.update`). */
const TICK_MS = 250;
/** La ligne d'information change de place chaque minute : rien ne reste affiché au même endroit (marquage des écrans). */
const MOVE_MS = 60_000;
const KNOB = 52;
/** Luminosité de l'appli en veille : 0 éteint presque l'écran sur beaucoup d'Android (curseur introuvable, retour
 *  d'Arno du 2026-10-08) ; 3 % ne coûte presque rien de plus. Le fond reste noir pur (pixels éteints en OLED). */
const SLEEP_BRIGHTNESS = 0.03;

/** « Tour · étage 364 · record 366 », ou la zone et l'étape en cours. */
function statusLine(): string {
  const s = useGame.getState().s;
  if (!s) return '';
  if (s.towerFloor !== null) return `Tour · étage ${s.towerFloor} · record ${s.towerBest}`;
  return `${BIOMES[s.biome]?.zones[s.zone]?.name ?? ''} · étape ${s.stage}`;
}

/**
 * Mode veille (économie de batterie, 2026-10-07, demande d'Arno) : l'écran devient noir (pixels éteints sur un écran
 * OLED), la luminosité de l'appli tombe au minimum (`expo-brightness`, rétablie au réveil), sons et musique coupés,
 * aucun message. L'écran de jeu (combat dessiné, onglets) est démonté par `App.tsx` : ici, une minuterie fait avancer le
 * combat sans le dessiner. L'écran reste allumé (`useKeepAwake`) : si le téléphone se mettait en veille, Android mettrait
 * l'appli en pause — fermer l'appli reste possible, l'absence prend alors le relais. Réveil : faire glisser le curseur
 * jusqu'au bout (un toucher accidentel ne suffit pas).
 */
export function SleepScreen() {
  useKeepAwake();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [line, setLine] = useState(statusLine);
  const [pos, setPos] = useState({ x: 0.3, y: 0.35 });

  // combat sans rendu
  useEffect(() => {
    let prev = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      for (let left = now - prev; left > 0; left -= 100) runner.update(Math.min(100, left));
      prev = now;
    }, TICK_MS);
    return () => clearInterval(id);
  }, []);

  // ligne d'information : rafraîchie et déplacée chaque minute
  useEffect(() => {
    const id = setInterval(() => {
      setLine(statusLine());
      setPos({ x: 0.05 + Math.random() * 0.2, y: 0.1 + Math.random() * 0.6 });
    }, MOVE_MS);
    return () => clearInterval(id);
  }, []);

  // sons coupés et luminosité au minimum, rétablis au réveil
  useEffect(() => {
    setSfxEnabled(false);
    setMusicEnabled(false);
    Brightness.setBrightnessAsync(SLEEP_BRIGHTNESS).catch(() => {});
    return () => {
      const st = useSettings.getState();
      setSfxEnabled(st.sound);
      setMusicEnabled(st.music);
      Brightness.restoreSystemBrightnessAsync().catch(() => {});
    };
  }, []);

  return (
    <View style={styles.screen}>
      <StatusBar hidden />
      <Text style={[styles.line, { left: pos.x * width, top: pos.y * height }]}>{line}</Text>
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 28 }]}>
        <WakeSlider onWake={() => useUi.getState().setSleep(false)} />
      </View>
    </View>
  );
}

/** Curseur « Glisser pour réveiller » : il faut l'amener au bout ; relâché avant, il revient au départ. */
function WakeSlider({ onWake }: { onWake: () => void }) {
  const [track, setTrack] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  const max = Math.max(0, track - KNOB);
  const maxRef = useRef(0);
  maxRef.current = max;
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderMove: (_, g) => x.setValue(Math.max(0, Math.min(maxRef.current, g.dx))),
    onPanResponderRelease: (_, g) => {
      if (maxRef.current > 0 && g.dx >= maxRef.current * 0.95) onWake();
      else Animated.spring(x, { toValue: 0, useNativeDriver: true }).start();
    },
    onPanResponderTerminate: () => Animated.spring(x, { toValue: 0, useNativeDriver: true }).start(),
  })).current;
  return (
    <View style={styles.track} onLayout={(e) => setTrack(e.nativeEvent.layout.width)}>
      <Text style={styles.trackTxt}>Glisser pour réveiller</Text>
      <Animated.View style={[styles.knob, { transform: [{ translateX: x }] }]} {...pan.panHandlers}>
        <Text style={styles.knobTxt}>›</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  // contrastes pensés pour un écran à luminosité minimale (les gris sombres d'avant y devenaient noirs) ; peu de
  // surface claire : seuls le texte, le contour et le bouton du curseur s'éclairent
  line: { position: 'absolute', color: '#9a9a9a', fontSize: 13, maxWidth: '70%' },
  bottom: { position: 'absolute', left: 24, right: 24, bottom: 0 },
  track: { height: KNOB, borderRadius: KNOB / 2, backgroundColor: '#000', borderWidth: 2, borderColor: '#8a8a8a', justifyContent: 'center' },
  trackTxt: { color: '#c8c8c8', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  knob: {
    position: 'absolute', left: -2, top: -2, width: KNOB, height: KNOB, borderRadius: KNOB / 2, backgroundColor: '#e0e0e0',
    alignItems: 'center', justifyContent: 'center',
  },
  knobTxt: { color: '#000', fontSize: 28, fontWeight: '700', lineHeight: 32 },
});
