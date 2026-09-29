import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { REGIONS } from '../game/content';
import { GameState, hasShinyCharm } from '../game/game';
import { boxProgress } from '../game/collection';
import { useGame } from '../store/game';
import { runner } from './battle/runner';
import { Button } from './components/Button';
import { feedback } from './components/feedback';
import { C } from './theme';

function formatDuration(ms: number): string {
  const totalMin = Math.round(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`;
}

/**
 * Écran de fin de l'aventure (Champion de la dernière région) : « Maître Pokémon », récapitulatif de toute la partie,
 * puis on continue dans la région (collection, chromatiques). Montré une fois (`endingSeen`).
 */
export function EndingScreen() {
  const s = useGame((g) => g.s) as GameState | null;
  const act = useGame((g) => g.act);
  if (!s) return null;
  const box = boxProgress(s);
  const legend = [144, 145, 146, 150, 151, 243, 244, 245, 249, 250, 251, 377, 378, 379, 380, 381, 382, 383, 384, 385, 386,
    480, 481, 482, 483, 484, 485, 486, 487, 488, 489, 490, 491, 492, 493].filter((id) => s.dex.caught.includes(id)).length;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.backdrop}>
        <View style={styles.box}>
          <ScrollView contentContainerStyle={{ gap: 12 }}>
            <Text style={styles.crown}>👑</Text>
            <Text style={styles.title}>Maître Pokémon !</Text>
            <Text style={styles.sub}>
              {REGIONS.map((r) => r.name).join(', ')} : tu as battu les {REGIONS.length} Champions. L'aventure est terminée… mais pas la
              collection.
            </Text>
            <View style={styles.stats}>
              <Text style={styles.stat}>⏱ Temps d'aventure : {formatDuration(Date.now() - s.adventureStart)}</Text>
              <Text style={styles.stat}>📖 Pokédex : {s.dex.caught.length}/{REGIONS[REGIONS.length - 1].dexMax}</Text>
              <Text style={styles.stat}>📦 Boîte : {box.normal}/{box.total} · ✨ {box.shiny}/{box.total}</Text>
              <Text style={styles.stat}>⭐ Légendaires capturés : {legend}</Text>
              <Text style={styles.stat}>⚪ Captures : {s.totals.captures} · Combats gagnés : {s.totals.stagesCleared}</Text>
              <Text style={styles.stat}>🍬 Pokémon vaincus : {s.totals.kills}</Text>
            </View>
            <Text style={styles.sub}>
              La suite : compléter ta boîte avec 1 exemplaire de chaque espèce, puis 1 chromatique de chaque. Le Charme Chroma
              {hasShinyCharm(s) ? ' est déjà actif' : ' s\u2019obtient en complétant le Pokédex'} : chromatiques 2 fois plus fréquents.
            </Text>
            <Button label="Continuer l'aventure" color={C.gold} textColor="#111" onPress={() => {
              act((g) => { g.endingSeen = true; });
              runner.paused = false;
              feedback('evolve');
            }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
  box: { backgroundColor: C.bg, borderRadius: 20, padding: 20, maxHeight: '90%' },
  crown: { fontSize: 48, textAlign: 'center' },
  title: { color: C.gold, fontSize: 26, fontWeight: '900', textAlign: 'center' },
  stats: { backgroundColor: C.panel, borderRadius: 14, padding: 12, gap: 6 },
  stat: { color: C.text, fontSize: 14, fontWeight: '700' },
  sub: { color: C.sub, fontSize: 13, textAlign: 'center' },
});
