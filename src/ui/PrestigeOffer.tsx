import { Modal, StyleSheet, Text, View } from 'react-native';
import { GameState, startPrestige } from '../game/game';
import { useGame } from '../store/game';
import { runner } from './battle/runner';
import { Button } from './components/Button';
import { feedback } from './components/feedback';
import { C } from './theme';

function formatDuration(ms: number): string {
  const totalMin = Math.round(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (!h) return `${m} min`;
  return `${h} h ${String(m).padStart(2, '0')}`;
}

/**
 * Récap de fin de Kanto, affiché à la place du combat dès le badge du Champion obtenu (le runner se
 * met en pause, voir runner.ts). Bouton « Nouveau départ » -> startPrestige, ou fermeture pour continuer
 * à jouer/farmer Kanto (accessible plus tard via la bannière de la Carte).
 */
export function PrestigeOffer({ onClose }: { onClose: () => void }) {
  const s = useGame((g) => g.s) as GameState | null;
  const act = useGame((g) => g.act);
  if (!s) return null;
  const dex = s.dex.caught.length;
  const shiny = s.dex.shiny.length;
  const elapsed = formatDuration(Date.now() - s.startedAt);
  const close = () => { runner.paused = false; onClose(); };
  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.backdrop}>
        <View style={styles.box}>
          <Text style={styles.title}>🏆 Champion de Kanto !</Text>
          <View style={styles.stats}>
            <Text style={styles.stat}>Pokédex : {dex}/151 {shiny ? `(dont ${shiny} chromatiques)` : ''}</Text>
            <Text style={styles.stat}>Badges : {s.badges}/8</Text>
            <Text style={styles.stat}>Temps de jeu : {elapsed}</Text>
            <Text style={styles.stat}>Combats gagnés : {s.totals.stagesCleared}</Text>
          </View>
          <Text style={styles.sub}>
            Johto t’attend : 100 nouveaux Pokémon, un nouveau starter, une aventure plus corsée. Équipe,
            boîte et objets repartiront à zéro — ta progression Kanto (Pokédex, bonbons, zones) reste
            acquise et toujours accessible.
          </Text>
          <Button label="Nouveau départ à Johto" color="#ffb300" onPress={() => {
            act((g) => startPrestige(g));
            runner.paused = false;
            feedback('evolve');
            onClose();
          }} />
          <Button label="Continuer à jouer sur Kanto" color={C.panel2} onPress={close} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 },
  box: { backgroundColor: C.bg, borderRadius: 20, padding: 20, gap: 12 },
  title: { color: C.gold, fontSize: 22, fontWeight: '900', textAlign: 'center' },
  stats: { backgroundColor: C.panel, borderRadius: 14, padding: 12, gap: 4 },
  stat: { color: C.text, fontSize: 14, fontWeight: '700' },
  sub: { color: C.sub, fontSize: 13, textAlign: 'center' },
});
