import { Modal, StyleSheet, Text, View } from 'react-native';
import { REGIONS, regionOf } from '../game/content';
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
 * Récap de fin de région, affiché à la place du combat dès le badge du Champion obtenu (le runner se
 * met en pause, voir runner.ts). Pas de bouton « continuer » : un vrai palier de fin, la seule sortie est
 * d'accepter le nouveau départ vers la région suivante.
 */
export function PrestigeOffer({ onClose }: { onClose: () => void }) {
  const s = useGame((g) => g.s) as GameState | null;
  const act = useGame((g) => g.act);
  if (!s) return null;
  const region = regionOf(s.prestige);
  const next = REGIONS[s.prestige + 1];
  if (!next) return null;
  const dex = s.dex.caught.length;
  const shiny = s.dex.shiny.length;
  const elapsed = formatDuration(Date.now() - s.startedAt);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.backdrop}>
        <View style={styles.box}>
          <Text style={styles.title}>🏆 Champion de {region.name} !</Text>
          <View style={styles.stats}>
            <Text style={styles.stat}>Pokédex : {dex}/{region.dexMax} {shiny ? `(dont ${shiny} chromatiques)` : ''}</Text>
            <Text style={styles.stat}>Badges : {s.badges}/8</Text>
            <Text style={styles.stat}>Temps à {region.name} : {elapsed}</Text>
            <Text style={styles.stat}>Combats gagnés : {s.totals.stagesCleared}</Text>
          </View>
          <Text style={styles.sub}>
            {next.name} t’attend : {next.dexMax - region.dexMax} nouveaux Pokémon, un nouveau starter, une
            aventure plus corsée. Équipe, boîte, objets et Pokédex repartiront à zéro (1/{next.dexMax} avec
            ton starter) — seuls tes bonbons et méga bonbons restent acquis.
          </Text>
          <Button label={`Nouveau départ à ${next.name}`} color="#ffb300" onPress={() => {
            act((g) => startPrestige(g));
            runner.paused = false;
            feedback('evolve');
            onClose();
          }} />
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
