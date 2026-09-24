import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { regionOf } from '../../game/content';
import { ALL_SPECIES, species as speciesOf } from '../../game/data';
import { Habitat, whereToFind } from '../../game/game';
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
  // n'affiche que les espèces des régions déjà débloquées (151 en Kanto, 251 dès Johto…) : le Pokédex ne
  // doit pas trahir la génération suivante avant que le joueur l'ait débloquée.
  const maxId = regionOf(s.prestige).dexMax;
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
            <Pressable key={sp.id} style={[styles.cell, { width: cellWidth }]} onPress={() => { if (saw || got) setOpen(sp.id); }}>
              <MonThumb speciesId={sp.id} shiny={shiny} size={46} silhouette={!got} style={!got && !saw ? { opacity: 0.25 } : undefined} />
              <Text style={styles.num}>#{String(sp.id).padStart(3, '0')}</Text>
              <Text style={[styles.name, !got && { color: C.dim }]} numberOfLines={1}>{saw || got ? sp.name : '???'}</Text>
            </Pressable>
          );
        })}
      </View>
      {open !== null && <WhereModal id={open} prestige={s.prestige} onClose={() => setOpen(null)} />}
    </View>
  );
}

function HabitatList({ habitats }: { habitats: Habitat[] }) {
  return (
    <>
      {habitats.map((h) => (
        <Text key={h.biome} style={styles.line}>
          • {h.biomeName} <Text style={styles.dim}>({h.zones.join(', ')}{h.boss ? ' · boss' : ''}{h.rare ? ' · rare' : ''})</Text>
        </Text>
      ))}
    </>
  );
}

function WhereModal({ id, prestige, onClose }: { id: number; prestige: number; onClose: () => void }) {
  const sp = speciesOf(id);
  const w = whereToFind(id, prestige);
  const evolved = w.path.length > 1;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.box} onPress={() => {}}>
          <View style={styles.head}>
            <MonThumb speciesId={id} size={56} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.title}>#{String(id).padStart(3, '0')} {sp.name}</Text>
              <View style={styles.types}>{sp.types.map((t) => <TypeBadge key={t} type={t} small />)}</View>
            </View>
          </View>
          <ScrollView style={{ maxHeight: 260 }}>
            {w.source === null ? (
              <Text style={styles.msg}>Introuvable dans cette région.</Text>
            ) : (
              <>
                {evolved && (
                  <Text style={styles.msg}>
                    S'obtient par évolution : {w.path.map((p) => speciesOf(p).name).join(' → ')}
                    {' '}(Nv.{speciesOf(w.path[w.path.length - 2]).evolveLevel})
                  </Text>
                )}
                <Text style={styles.section}>{evolved ? `${speciesOf(w.source).name} se trouve ici :` : 'Se trouve ici :'}</Text>
                <HabitatList habitats={w.habitats} />
                {w.viaEvolution && (
                  <>
                    <Text style={[styles.msg, { marginTop: 8 }]}>
                      S'obtient aussi par évolution : {w.viaEvolution.path.map((p) => speciesOf(p).name).join(' → ')}
                      {' '}(Nv.{speciesOf(w.viaEvolution.path[w.viaEvolution.path.length - 2]).evolveLevel})
                    </Text>
                    <Text style={styles.section}>{speciesOf(w.viaEvolution.source!).name} se trouve ici :</Text>
                    <HabitatList habitats={w.viaEvolution.habitats} />
                  </>
                )}
              </>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
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
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 28 },
  box: { backgroundColor: C.panel, borderRadius: 20, padding: 20, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { color: C.text, fontSize: 18, fontWeight: '800' },
  msg: { color: C.sub, fontSize: 14, marginBottom: 8 },
  section: { color: C.text, fontSize: 13, fontWeight: '800', marginBottom: 4 },
  line: { color: C.text, fontSize: 13, fontWeight: '600', marginBottom: 4 },
});
