import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from './components/Text';
import { collectionNeeds, missingForms, ownedCounts } from '../game/collection';
import { ZoneDef } from '../game/content';
import { species } from '../game/data';
import { GameState } from '../game/game';
import { useSettings } from '../store/settings';
import { MonThumb } from './components/MonThumb';
import { Button } from './components/Button';
import { C } from './theme';

/**
 * Espèces « de » une zone pour le Pokédex/Chromatique-Dex : son pool de sauvages, plus son boss
 * seulement s'il rejoint le pool une fois vaincu (`joinsPool`). Un boss de zone classique ne se bat
 * qu'une fois et n'est jamais chromatique : l'indiquer comme « chromatique manquant » serait trompeur
 * puisqu'il n'est pas farmable (sa pré-évolution, elle, l'est généralement via le pool sauvage).
 */
export function zoneSpecies(zone: ZoneDef): number[] {
  const ids = zone.pool.map(([id]) => id);
  if (zone.boss.joinsPool) ids.push(zone.boss.speciesId);
  return [...new Set(ids)];
}

/**
 * Espèces de la zone qu'il faut encore capturer pour la boîte (normaux ou chromatiques) : combien on en possède, combien
 * de captures restent utiles (`collectionNeeds` : Évoli en Sinnoh = 1 + 7 évolutions) et les formes de la lignée qui
 * manquent en boîte.
 */
function boxRows(s: GameState, ids: number[], shiny: boolean) {
  const owned = ownedCounts(s, shiny);
  const need = collectionNeeds(s, shiny, owned);
  return ids.filter((id) => (need.get(id) ?? 0) > 0)
    .map((id) => ({ id, owned: owned.get(id) ?? 0, need: need.get(id) ?? 0, missing: missingForms(s, id, shiny, owned) }));
}

export function ZoneDex({ zone, s, onClose }: { zone: ZoneDef | null; s: GameState; onClose: () => void }) {
  const goal = useSettings((st) => st.collectionGoal);
  if (!zone) return null;
  const ids = zoneSpecies(zone);
  const missing = ids.filter((id) => !s.dex.caught.includes(id));
  const missingShiny = ids.filter((id) => !s.dex.shiny.includes(id));
  const seen = (id: number) => s.dex.seen.includes(id);
  // boîte (2026-10-02) : combien d'exemplaires on a, combien il en faut encore (Évoli : un par évolution manquante)
  const boxSection = (shiny: boolean) => {
    const rows = boxRows(s, ids, shiny);
    const total = rows.reduce((a, r) => a + r.need, 0);
    return (
      <>
        <Text style={styles.section}>
          {shiny ? 'Boîte ✨' : 'Boîte'} — {total ? `encore ${total} capture${total > 1 ? 's' : ''} utile${total > 1 ? 's' : ''}` : 'rien à capturer ici'}
        </Text>
        {!rows.length ? <Text style={styles.done}>✔ {shiny ? 'Chromatiques de cette zone tous en boîte' : 'Espèces de cette zone toutes en boîte'}, évolutions comprises</Text> : (
          <View style={{ gap: 6 }}>
            {rows.map((r) => (
              <View key={r.id} style={styles.boxRow}>
                <MonThumb speciesId={r.id} shiny={shiny} size={36} silhouette={!seen(r.id)} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.rowName}>
                    {seen(r.id) ? species(r.id).name : '???'}
                    <Text style={styles.rowSub}> · {r.owned} en boîte · encore {r.need} à capturer</Text>
                  </Text>
                  {r.missing.length > 0 && (
                    <View style={styles.missRow}>
                      <Text style={styles.rowSub}>manque :</Text>
                      {r.missing.map((m) => <MonThumb key={m} speciesId={m} shiny={shiny} size={22} silhouette={!seen(m)} />)}
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
      </>
    );
  };
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.box} onPress={() => {}}>
          <Text style={styles.title}>{zone.name}</Text>
          <ScrollView style={{ maxHeight: 440 }}>
            <Text style={styles.section}>Pokédex — {ids.length - missing.length}/{ids.length}</Text>
            {missing.length === 0 ? <Text style={styles.done}>✔ Tous capturés</Text> : (
              <View style={styles.grid}>
                {missing.map((id) => (
                  <View key={id} style={styles.cell}>
                    <MonThumb speciesId={id} size={40} silhouette={!seen(id)} />
                    <Text style={styles.name} numberOfLines={1}>{seen(id) ? species(id).name : '???'}</Text>
                  </View>
                ))}
              </View>
            )}
            <Text style={styles.section}>Chromatiques — {ids.length - missingShiny.length}/{ids.length}</Text>
            {missingShiny.length === 0 ? <Text style={styles.done}>✔ Tous chromatiques obtenus</Text> : (
              <View style={styles.grid}>
                {missingShiny.map((id) => (
                  <View key={id} style={styles.cell}>
                    <MonThumb speciesId={id} shiny size={40} silhouette={!seen(id)} />
                    <Text style={styles.name} numberOfLines={1}>{seen(id) ? species(id).name : '???'}</Text>
                  </View>
                ))}
              </View>
            )}
            {boxSection(false)}
            {goal === 'boxShiny' && boxSection(true)}
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
  boxRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowName: { color: C.text, fontSize: 12, fontWeight: '800' },
  rowSub: { color: C.sub, fontSize: 11, fontWeight: '600' },
  missRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 3 },
});
