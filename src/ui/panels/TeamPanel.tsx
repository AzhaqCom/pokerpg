import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { species } from '../../game/data';
import { GameState, canEvolve, excessMons, releaseExcess } from '../../game/game';
import { Mon } from '../../game/model';
import { monStars, primaryType } from '../../game/stats';
import { useGame } from '../../store/game';
import { toast, useUi } from '../../store/ui';
import { Button } from '../components/Button';
import { Dialog, DialogSpec } from '../components/Dialog';
import { feedback } from '../components/feedback';
import { MonThumb } from '../components/MonThumb';
import { Stars } from '../components/Stars';
import { TypeBadge } from '../components/TypeBadge';
import { TYPE_COLOR, monName, monStats, xpProgress } from '../helpers';
import { C } from '../theme';
import { spentPoints, talentPoints } from '../../game/talents';

const BOX_COLS = 4;
const BOX_GAP = 8;
/** Padding horizontal de la liste : 12 de chaque côté. */
const SCREEN_PADDING = 24;
const TYPE_ORDER = Object.keys(TYPE_COLOR);

type SortMode = 'type' | 'level' | 'dex' | 'stars';
const SORTS: { key: SortMode; label: string }[] = [
  { key: 'type', label: 'Type' }, { key: 'level', label: 'Niveau' },
  { key: 'dex', label: 'Ordre Pokédex' }, { key: 'stars', label: 'Rang' },
];
const SORTERS: Record<SortMode, (a: Mon, b: Mon) => number> = {
  type: (a, b) => TYPE_ORDER.indexOf(primaryType(a.speciesId)) - TYPE_ORDER.indexOf(primaryType(b.speciesId))
    || monStars(b) - monStars(a) || b.level - a.level,
  level: (a, b) => b.level - a.level || monStars(b) - monStars(a),
  dex: (a, b) => a.speciesId - b.speciesId || b.level - a.level,
  stars: (a, b) => monStars(b) - monStars(a) || b.level - a.level,
};

export function TeamPanel() {
  const s = useGame((g) => g.s)!;
  useGame((g) => g.rev);
  const act = useGame((g) => g.act);
  const openMon = useUi((u) => u.openMon);
  const [cleanup, setCleanup] = useState<DialogSpec | null>(null);
  const [sort, setSort] = useState<SortMode>('type');
  const [evolveOnly, setEvolveOnly] = useState(false);
  const box = Object.values(s.mons)
    .filter((m) => !s.team.includes(m.uid) && (!evolveOnly || canEvolve(m)))
    .sort(SORTERS[sort]);
  const pensionUids = new Set(s.pension.map((p) => p.uid));
  const explorationUids = new Set(s.exploration.map((p) => p.uid));
  const { width } = useWindowDimensions();
  const cellWidth = (width - SCREEN_PADDING - BOX_GAP * (BOX_COLS - 1)) / BOX_COLS;
  const excess = excessMons(s);

  return (
    <>
      <FlatList
        data={box}
        keyExtractor={(m) => m.uid}
        numColumns={BOX_COLS}
        style={{ flex: 1 }}
        contentContainerStyle={styles.list}
        columnWrapperStyle={{ gap: BOX_GAP }}
        // la boîte peut compter des centaines de Pokémon : ne monter que les cartes visibles évite de figer l'appli
        initialNumToRender={20}
        windowSize={5}
        removeClippedSubviews
        renderItem={({ item: m }: { item: Mon }) => (
          <Pressable onPress={() => openMon(m.uid)} style={[styles.boxCell, { width: cellWidth }]}>
            <MonThumb speciesId={m.speciesId} shiny={m.shiny} size={48} />
            <Text style={styles.boxName} numberOfLines={1}>{monName(m)}</Text>
            <Text style={styles.boxLv}>Nv.{m.level}{pensionUids.has(m.uid) ? ' · 🏡' : explorationUids.has(m.uid) ? ' · 🧭' : ''}</Text>
            <Stars mon={m} size={9} />
          </Pressable>
        )}
        ListHeaderComponent={
          <View style={{ gap: 10, marginBottom: 10 }}>
            <Text style={styles.title}>Équipe <Text style={styles.hint}>· le 1er est devant et encaisse le plus</Text></Text>
            {s.team.map((uid, i) => {
              const m = s.mons[uid];
              const st = monStats(s, uid);
              const pts = talentPoints(m.level) - spentPoints(m.talents);
              return (
                <Pressable key={uid} onPress={() => openMon(uid)} style={styles.card}>
                  <Text style={styles.slot}>{i + 1}</Text>
                  <MonThumb speciesId={m.speciesId} shiny={m.shiny} size={52} />
                  <View style={{ flex: 1, gap: 3 }}>
                    <View style={styles.row}>
                      <Text style={styles.name}>{monName(m)}</Text>
                      <Text style={styles.lv}>Nv.{m.level}</Text>
                      <Stars mon={m} />
                      {species(m.speciesId).types.map((t) => <TypeBadge key={t} type={t} small />)}
                    </View>
                    <View style={styles.xpTrack}><View style={[styles.xpFill, { width: `${xpProgress(m) * 100}%` }]} /></View>
                    <Text style={styles.stats}>PC {st.cp} · PV {st.hp} · Atq {st.atk} · Déf {st.def} · Vit {st.spe}</Text>
                    <View style={styles.row}>
                      {canEvolve(m) && <Text style={styles.flag}>Peut évoluer</Text>}
                      {pts > 0 && <Text style={[styles.flag, { backgroundColor: '#3d5afe' }]}>{pts} talent{pts > 1 ? 's' : ''}</Text>}
                      {Object.keys(m.items).length < 3 && <Text style={[styles.flag, { backgroundColor: '#455a64' }]}>{3 - Object.keys(m.items).length} emplacement{3 - Object.keys(m.items).length > 1 ? 's' : ''} libre</Text>}
                    </View>
                  </View>
                </Pressable>
              );
            })}
            <View style={styles.row}>
              <Text style={styles.title}>Boîte · {box.length}</Text>
              {excess.length > 0 && (
                <Button small label={`Nettoyer les doublons (${excess.length})`} color="#8d6e63" onPress={() => {
                  const candies = excess.length * 3;
                  setCleanup({
                    title: 'Relâcher les doublons ?',
                    message: `${excess.length} Pokémon en excès seront relâchés (les plus faibles de chaque espèce d'abord, chromatiques et normaux comptés à part). Tu gagneras ${candies} bonbons.`,
                    primary: {
                      label: 'Relâcher', color: '#8d6e63', onPress: () => {
                        const r = act((g: GameState) => releaseExcess(g));
                        if (r) { feedback('medal'); toast(`${r.count} Pokémon relâchés, +${r.candies} bonbons`, '#69f0ae'); }
                      },
                    },
                    secondary: { label: 'Annuler', onPress: () => {} },
                  });
                }} />
              )}
            </View>
            <View style={styles.row}>
              {SORTS.map((so) => (
                <Pressable key={so.key} onPress={() => setSort(so.key)} style={[styles.chip, sort === so.key && styles.chipOn]}>
                  <Text style={styles.chipTxt}>{so.label}</Text>
                </Pressable>
              ))}
              <Pressable onPress={() => setEvolveOnly((v) => !v)} style={[styles.chip, evolveOnly && styles.chipOn]}>
                <Text style={styles.chipTxt}>Peut évoluer</Text>
              </Pressable>
            </View>
            {evolveOnly && !box.length && <Text style={styles.hint}>Aucun Pokémon de la boîte n'est prêt à évoluer pour l'instant.</Text>}
          </View>
        }
        ListEmptyComponent={<Text style={styles.hint}>Capture des Pokémon sauvages après les vagues pour remplir ta boîte.</Text>}
      />
      <Dialog spec={cleanup} onClose={() => setCleanup(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  list: { padding: 12, paddingBottom: 40, gap: BOX_GAP },
  title: { color: C.text, fontSize: 15, fontWeight: '800' },
  hint: { color: C.dim, fontSize: 12, fontWeight: '500' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.panel, borderRadius: 14, padding: 10 },
  slot: { color: C.gold, fontWeight: '900', fontSize: 16, width: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  name: { color: C.text, fontWeight: '800', fontSize: 15 },
  lv: { color: C.sub, fontWeight: '700', fontSize: 12 },
  xpTrack: { height: 4, backgroundColor: C.panel2, borderRadius: 2, overflow: 'hidden' },
  xpFill: { height: '100%', backgroundColor: '#42a5f5' },
  stats: { color: C.sub, fontSize: 11 },
  flag: { color: '#fff', fontSize: 10, fontWeight: '800', backgroundColor: '#c0392b', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, overflow: 'hidden' },
  boxCell: { alignItems: 'center', backgroundColor: C.panel, borderRadius: 12, paddingVertical: 6 },
  boxName: { color: C.text, fontSize: 10, fontWeight: '700', maxWidth: 70 },
  boxLv: { color: C.sub, fontSize: 10 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: C.panel },
  chipOn: { backgroundColor: C.accent },
  chipTxt: { color: C.text, fontWeight: '700', fontSize: 12 },
});
