import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { ALL_SPECIES } from '../../game/data';
import { useGame } from '../../store/game';
import { MonThumb } from '../components/MonThumb';
import { TypeBadge } from '../components/TypeBadge';
import { C } from '../theme';

const GRID_COLS = 4;
const GRID_GAP = 8;
/** Padding horizontal du conteneur scrollable (`App.tsx` styles.panel) : 12 de chaque côté. */
const SCREEN_PADDING = 24;

export function DexPanel() {
  const s = useGame((g) => g.s)!;
  useGame((g) => g.rev);
  const [shiny, setShiny] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const caught = new Set(shiny ? s.dex.shiny : s.dex.caught);
  const seen = new Set(s.dex.seen);
  const { width } = useWindowDimensions();
  const cellWidth = (width - SCREEN_PADDING - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;
  // n'affiche que les espèces des régions déjà débloquées (151 en Kanto, 251 dès Johto) : le Pokédex ne
  // doit pas trahir la génération suivante avant que le joueur l'ait débloquée.
  const maxId = s.prestige > 0 ? ALL_SPECIES.length : 151;
  const species = ALL_SPECIES.filter((sp) => sp.id <= maxId);
  return (
    <View style={{ gap: 10 }}>
      <View style={styles.row}>
        <Text style={styles.count}>{s.dex.caught.length}<Text style={styles.dim}>/{maxId} capturés</Text></Text>
        <Text style={styles.dim}>{s.dex.seen.length} vus · ✨ {s.dex.shiny.length}</Text>
      </View>
      <View style={styles.row}>
        <Pressable onPress={() => setShiny(false)} style={[styles.chip, !shiny && styles.chipOn]}><Text style={styles.chipTxt}>Normaux</Text></Pressable>
        <Pressable onPress={() => setShiny(true)} style={[styles.chip, shiny && styles.chipGold]}><Text style={styles.chipTxt}>Chromatiques</Text></Pressable>
      </View>
      <View style={styles.grid}>
        {species.map((sp) => {
          const got = caught.has(sp.id);
          const saw = seen.has(sp.id);
          return (
            <Pressable key={sp.id} style={[styles.cell, { width: cellWidth }]} onPress={() => setOpen(open === sp.id ? null : sp.id)}>
              <MonThumb speciesId={sp.id} shiny={shiny} size={46} silhouette={!got} style={!got && !saw ? { opacity: 0.25 } : undefined} />
              <Text style={styles.num}>#{String(sp.id).padStart(3, '0')}</Text>
              <Text style={[styles.name, !got && { color: C.dim }]} numberOfLines={1}>{saw || got ? sp.name : '???'}</Text>
              {open === sp.id && (saw || got) && <View style={styles.types}>{sp.types.map((t) => <TypeBadge key={t} type={t} small />)}</View>}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  count: { color: C.text, fontSize: 22, fontWeight: '900' },
  dim: { color: C.dim, fontSize: 12, fontWeight: '600' },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: C.panel, flex: 1, alignItems: 'center' },
  chipOn: { backgroundColor: C.accent },
  chipGold: { backgroundColor: '#b8860b' },
  chipTxt: { color: C.text, fontWeight: '700', fontSize: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  cell: { alignItems: 'center', paddingVertical: 4 },
  num: { color: C.dim, fontSize: 9 },
  name: { color: C.text, fontSize: 10, fontWeight: '700', maxWidth: 80 },
  types: { flexDirection: 'row', gap: 2, marginTop: 2 },
});
