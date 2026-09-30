import { Modal, StyleSheet, View } from 'react-native';
import { Text } from './components/Text';
import { regionOf } from '../game/content';
import { GameState, SHINY_ODDS, SHINY_ODDS_CHARM } from '../game/game';
import { useGame } from '../store/game';
import { runner } from './battle/runner';
import { Button } from './components/Button';
import { feedback } from './components/feedback';
import { C } from './theme';

/**
 * Annonce du Charme Chroma (Pokédex de la région complet) : combat en pause jusqu'à ce que le joueur touche « OK »,
 * montrée une fois par région (`shinyCharmSeen`, remis à zéro au prestige).
 */
export function ShinyCharmScreen() {
  const s = useGame((g) => g.s) as GameState | null;
  const act = useGame((g) => g.act);
  if (!s) return null;
  const region = regionOf(s.prestige);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.backdrop}>
        <View style={styles.box}>
          <Text style={styles.icon}>✨</Text>
          <Text style={styles.title}>Charme Chroma obtenu !</Text>
          <Text style={styles.sub}>
            Tu as capturé les {region.dexMax} espèces du Pokédex de {region.name}.
          </Text>
          <View style={styles.stats}>
            <Text style={styles.stat}>Chromatiques 2 fois plus fréquents</Text>
            <Text style={styles.big}>1/{SHINY_ODDS} → 1/{SHINY_ODDS_CHARM}</Text>
            <Text style={styles.stat}>En combat comme hors ligne, jusqu'au prochain nouveau départ.</Text>
          </View>
          <Button label="OK" color={C.gold} textColor="#111" onPress={() => {
            act((g) => { g.shinyCharmSeen = true; });
            runner.paused = false;
            feedback('medal');
          }} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
  box: { backgroundColor: C.bg, borderRadius: 20, padding: 20, gap: 12, borderWidth: 2, borderColor: C.gold },
  icon: { fontSize: 48, textAlign: 'center' },
  title: { color: C.gold, fontSize: 24, fontWeight: '900', textAlign: 'center' },
  stats: { backgroundColor: C.panel, borderRadius: 14, padding: 12, gap: 6, alignItems: 'center' },
  stat: { color: C.text, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  big: { color: C.gold, fontSize: 22, fontWeight: '900' },
  sub: { color: C.sub, fontSize: 13, textAlign: 'center' },
});
