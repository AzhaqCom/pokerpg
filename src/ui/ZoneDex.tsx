import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ZoneDef } from '../game/content';
import { species } from '../game/data';
import { GameState } from '../game/game';
import { MonThumb } from './components/MonThumb';
import { Button } from './components/Button';
import { C } from './theme';

/**
 * Espèces « de » une zone pour le Pokédex/Chromatique-Dex : son pool de sauvages, plus son boss
 * seulement s'il est rejouable (`repeatable`). Un boss de zone classique ne se bat qu'une fois et n'est
 * jamais chromatique : l'indiquer comme « chromatique manquant » serait trompeur puisqu'il n'est pas
 * farmable (sa pré-évolution, elle, l'est généralement via le pool sauvage).
 */
export function zoneSpecies(zone: ZoneDef): number[] {
  const ids = zone.pool.map(([id]) => id);
  if (zone.boss.repeatable) ids.push(zone.boss.speciesId);
  return [...new Set(ids)];
}

export function ZoneDex({ zone, s, onClose }: { zone: ZoneDef | null; s: GameState; onClose: () => void }) {
  if (!zone) return null;
  const ids = zoneSpecies(zone);
  const missing = ids.filter((id) => !s.dex.caught.includes(id));
  const missingShiny = ids.filter((id) => !s.dex.shiny.includes(id));
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.box} onPress={() => {}}>
          <Text style={styles.title}>{zone.name}</Text>
          <ScrollView style={{ maxHeight: 360 }}>
            <Text style={styles.section}>Pokédex — {ids.length - missing.length}/{ids.length}</Text>
            {missing.length === 0 ? <Text style={styles.done}>✔ Tous capturés</Text> : (
              <View style={styles.grid}>
                {missing.map((id) => (
                  <View key={id} style={styles.cell}>
                    <MonThumb speciesId={id} size={40} silhouette={!s.dex.seen.includes(id)} />
                    <Text style={styles.name} numberOfLines={1}>{s.dex.seen.includes(id) ? species(id).name : '???'}</Text>
                  </View>
                ))}
              </View>
            )}
            <Text style={styles.section}>Chromatiques — {ids.length - missingShiny.length}/{ids.length}</Text>
            {missingShiny.length === 0 ? <Text style={styles.done}>✔ Tous chromatiques obtenus</Text> : (
              <View style={styles.grid}>
                {missingShiny.map((id) => (
                  <View key={id} style={styles.cell}>
                    <MonThumb speciesId={id} shiny size={40} silhouette={!s.dex.seen.includes(id)} />
                    <Text style={styles.name} numberOfLines={1}>{s.dex.seen.includes(id) ? species(id).name : '???'}</Text>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
          <Button label="Fermer" color={C.panel2} onPress={onClose} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 28 },
  box: { backgroundColor: C.panel, borderRadius: 20, padding: 16, gap: 10 },
  title: { color: C.text, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  section: { color: C.sub, fontSize: 12, fontWeight: '800', marginTop: 8, marginBottom: 4 },
  done: { color: '#69f0ae', fontSize: 12, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { width: 60, alignItems: 'center' },
  name: { color: C.text, fontSize: 9, fontWeight: '700', maxWidth: 58 },
});
