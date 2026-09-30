import { memo, useCallback, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { regionOf } from '../../game/content';
import { ALL_SPECIES, species as speciesOf } from '../../game/data';
import { Habitat, biomeAvailable, hasShinyCharm, isTargeted, selectStage, toggleTarget, whereToFind } from '../../game/game';
import { useGame } from '../../store/game';
import { toast } from '../../store/ui';
import { runner } from '../battle/runner';
import { feedback } from '../components/feedback';
import { Button } from '../components/Button';
import { MonThumb } from '../components/MonThumb';
import { TypeBadge } from '../components/TypeBadge';
import { C } from '../theme';

const GRID_COLS = 4;
const GRID_GAP = 8;
/** Padding horizontal du conteneur scrollable (`App.tsx` styles.panel) : 12 de chaque côté. */
const SCREEN_PADDING = 24;

/** Case du Pokédex, mémoïsée : ne se redessine que si SON état (vu/capturé/chromatique) change, pas à chaque
 * mise à jour du store. */
const DexCell = memo(function DexCell({ id, name, got, saw, shiny, width, onOpen }: {
  id: number; name: string; got: boolean; saw: boolean; shiny: boolean; width: number; onOpen: (id: number) => void;
}) {
  return (
    <Pressable style={[styles.cell, { width }]} onPress={() => { if (saw || got) onOpen(id); }}>
      <MonThumb speciesId={id} shiny={shiny} size={46} silhouette={!got} style={!got && !saw ? { opacity: 0.25 } : undefined} />
      <Text style={styles.num}>#{String(id).padStart(3, '0')}</Text>
      <Text style={[styles.name, !got && { color: C.dim }]} numberOfLines={1}>{saw || got ? name : '???'}</Text>
    </Pressable>
  );
});

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
  const openCell = useCallback((id: number) => setOpen(id), []);
  const header = (
    <View style={{ gap: 10, marginBottom: 10 }}>
      <View style={styles.row}>
        <Text style={styles.count}>{s.dex.caught.filter((id) => id <= maxId).length}<Text style={styles.dim}>/{maxId} capturés</Text></Text>
        <Text style={styles.dim}>{s.dex.seen.filter((id) => id <= maxId).length} vus · ✨ {s.dex.shiny.filter((id) => id <= maxId).length}</Text>
      </View>
      <Text style={[styles.dim, hasShinyCharm(s) && { color: C.gold }]}>
        {hasShinyCharm(s) ? '✨ Charme Chroma actif : chromatiques 2 fois plus fréquents dans cette région'
          : `✨ Charme Chroma : capture les ${maxId} espèces de la région pour doubler les chances de chromatique`}
      </Text>
      <View style={styles.row}>
        <Pressable onPress={() => setShiny(false)} style={[styles.chip, !shiny && styles.chipOn]}><Text style={styles.chipTxt}>Normaux</Text></Pressable>
        <Pressable onPress={() => setShiny(true)} style={[styles.chip, shiny && styles.chipGold]}><Text style={styles.chipTxt}>Chromatiques</Text></Pressable>
      </View>
    </View>
  );
  return (
    <>
      {/* liste virtualisée : jusqu'à 493 cases, seules celles à l'écran sont montées (rendue hors du ScrollView, voir App.tsx) */}
      <FlatList
        data={species}
        keyExtractor={(sp) => String(sp.id)}
        numColumns={GRID_COLS}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: SCREEN_PADDING / 2, paddingBottom: 40 }}
        columnWrapperStyle={{ gap: GRID_GAP }}
        ListHeaderComponent={header}
        initialNumToRender={24}
        windowSize={7}
        removeClippedSubviews
        extraData={`${shiny}-${s.dex.caught.length}-${s.dex.seen.length}-${s.dex.shiny.length}`}
        maxToRenderPerBatch={12}
        renderItem={({ item: sp }) => (
          <DexCell id={sp.id} name={sp.name} got={caught.has(sp.id)} saw={seen.has(sp.id)} shiny={shiny} width={cellWidth} onOpen={openCell} />
        )}
      />
      {open !== null && <WhereModal id={open} prestige={s.prestige} onClose={() => setOpen(null)} />}
    </>
  );
}

/** Lieux d'obtention : un bouton « Y aller » par zone (grisé si la zone n'est pas encore débloquée). */
function HabitatList({ habitats, onGo }: { habitats: Habitat[]; onGo: (biome: number, zone: number, name: string) => void }) {
  const s = useGame((g) => g.s)!;
  return (
    <>
      {habitats.map((h) => (
        <View key={h.biome} style={{ gap: 4, marginBottom: 6 }}>
          <Text style={styles.line}>
            • {h.biomeName} <Text style={styles.dim}>{h.boss ? '(boss' : '('}{h.rare ? `${h.boss ? ' · ' : ''}rare` : ''}{h.boss || h.rare ? ')' : ''}</Text>
          </Text>
          {h.zoneIdx.map((zi, k) => {
            const open = biomeAvailable(s, h.biome) && (s.unlocked[h.biome]?.[zi] ?? 0) >= 1;
            return (
              <View key={zi} style={styles.goRow}>
                <Text style={[styles.dim, { flex: 1 }]}>{h.zones[k]}</Text>
                <Pressable disabled={!open} onPress={() => onGo(h.biome, zi, h.zones[k])} style={[styles.goBtn, !open && { opacity: 0.4 }]}>
                  <Text style={styles.goTxt}>{open ? 'Y aller' : '🔒'}</Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      ))}
    </>
  );
}

function WhereModal({ id, prestige, onClose }: { id: number; prestige: number; onClose: () => void }) {
  const sp = speciesOf(id);
  const w = whereToFind(id, prestige);
  const evolved = w.path.length > 1;
  const s = useGame((g) => g.s)!;
  const act = useGame((g) => g.act);
  // « Y aller » : le combat part dans cette zone, à sa plus haute étape débloquée
  const goTo = (biome: number, zone: number, name: string) => {
    act((g) => selectStage(g, biome, zone, g.unlocked[biome][zone]));
    runner.restart();
    feedback();
    toast(`Direction ${name}`, '#69f0ae');
    onClose();
  };
  useGame((g) => g.rev);
  const targeted = isTargeted(s, id);
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
                <HabitatList habitats={w.habitats} onGo={goTo} />
                {w.viaEvolution && (
                  <>
                    <Text style={[styles.msg, { marginTop: 8 }]}>
                     Évolution : {w.viaEvolution.path.map((p) => speciesOf(p).name).join(' → ')}
                      {' '}(Nv.{speciesOf(w.viaEvolution.path[w.viaEvolution.path.length - 2]).evolveLevel})
                    </Text>
                    <Text style={styles.section}>{speciesOf(w.viaEvolution.source!).name} se trouve ici :</Text>
                    <HabitatList habitats={w.viaEvolution.habitats} onGo={goTo} />
                  </>
                )}
              </>
            )}
          </ScrollView>
          {w.source !== null && (
            <Button small color={targeted ? '#2e7d32' : undefined}
              label={targeted ? '🎯 Lignée ciblée : capture auto (toucher pour arrêter)' : '🎯 Cibler la lignée (capture auto, farm de bonbons)'}
              onPress={() => act((g) => toggleTarget(g, id))} />
          )}
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
  goRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 12 },
  goBtn: { backgroundColor: C.accent, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  goTxt: { color: C.text, fontSize: 12, fontWeight: '800' },
  line: { color: C.text, fontSize: 13, fontWeight: '600', marginBottom: 4 },
});
