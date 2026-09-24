import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { regionOf } from '../../game/content';
import { PType, species } from '../../game/data';
import {
  GameState, canCompleteDex, canEvolve, completeDex, excessMons, monsBelowStars, monsNotShiny, releaseBelowStars,
  isTargeted, releaseExcess, releaseNotShiny, setTeam, unequipBox,
} from '../../game/game';
import { Mon } from '../../game/model';
import { monStars } from '../../game/stats';
import { useGame } from '../../store/game';
import { useSettings } from '../../store/settings';
import { toast, useUi } from '../../store/ui';
import { Button } from '../components/Button';
import { Dialog, DialogSpec } from '../components/Dialog';
import { feedback } from '../components/feedback';
import { MonThumb } from '../components/MonThumb';
import { Stars } from '../components/Stars';
import { TypeBadge } from '../components/TypeBadge';
import { TYPE_COLOR, auraDisplay, monName, monStats, textOn, typeLabel, xpProgress } from '../helpers';
import { C } from '../theme';
import { spentPoints, talentPoints } from '../../game/talents';

const BOX_COLS = 4;
const BOX_GAP = 8;
/** Padding horizontal de la liste : 12 de chaque côté. */
const SCREEN_PADDING = 24;
const TYPE_ORDER = Object.keys(TYPE_COLOR) as PType[];

type SortMode = 'level' | 'dex' | 'stars';
const SORTS: { key: SortMode; label: string }[] = [
  { key: 'dex', label: 'Ordre Pokédex' },
  { key: 'level', label: 'Niveau' }, { key: 'stars', label: 'Rang' },
];
const SORTERS: Record<SortMode, (a: Mon, b: Mon) => number> = {
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
  const [sort, setSort] = useState<SortMode>('dex');
  const [evolveOnly, setEvolveOnly] = useState(false);
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const dexMax = regionOf(s.prestige).dexMax;
  const [typeFilter, setTypeFilter] = useState<PType | null>(null);
  const boxAll = Object.values(s.mons).filter((m) => !s.team.includes(m.uid));
  /** Types présents dans la boîte (un Pokémon bi-type compte pour ses deux types), dans l'ordre habituel. */
  const boxTypes = useMemo(() => {
    const present = new Set<PType>();
    for (const m of boxAll) for (const t of species(m.speciesId).types) present.add(t);
    return TYPE_ORDER.filter((t) => present.has(t));
  }, [boxAll.length, s.mons]);
  const activeType = typeFilter && boxTypes.includes(typeFilter) ? typeFilter : null;
  const box = boxAll
    .filter((m) => (!activeType || species(m.speciesId).types.includes(activeType)) && (!evolveOnly || canEvolve(m, dexMax)) && (!q || monName(m).toLowerCase().startsWith(q)))
    .sort(SORTERS[sort]);
  const pensionUids = new Set(s.pension.map((p) => p.uid));
  const explorationUids = new Set(s.exploration.map((p) => p.uid));
  const { width } = useWindowDimensions();
  const cellWidth = (width - SCREEN_PADDING - BOX_GAP * (BOX_COLS - 1)) / BOX_COLS;
  const keepEvolutionMaterial = useSettings((st) => st.keepEvolutionMaterial);
  const excess = excessMons(s, { keepEvolutionMaterial });
  const belowStars = monsBelowStars(s, 3);
  const notShiny = monsNotShiny(s);
  const dexCompletable = canCompleteDex(s, { keepEvolutionMaterial });
  const boxEquippedCount = Object.values(s.mons)
    .filter((m) => !s.team.includes(m.uid))
    .reduce((a, m) => a + Object.keys(m.items).length, 0);
  const hasActions = dexCompletable || excess.length > 0 || boxEquippedCount > 0 || belowStars.length > 0 || notShiny.length > 0;

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
            <View>
              <MonThumb speciesId={m.speciesId} shiny={m.shiny} size={48} />
              {/* lignée ciblée (🎯) : en haut à gauche, à l'opposé du ✨ des chromatiques */}
              {isTargeted(s, m.speciesId) && <Text style={styles.targetMark}>🎯</Text>}
            </View>
            <Text style={styles.boxName} numberOfLines={1}>{monName(m)}</Text>
            <Text style={styles.boxLv}>Nv.{m.level}{pensionUids.has(m.uid) ? ' · 🏡' : explorationUids.has(m.uid) ? ' · 🧭' : ''}</Text>
            <Stars mon={m} size={9} />
          </Pressable>
        )}
        ListHeaderComponent={
          <View style={{ gap: 10, marginBottom: 10 }}>
            <Text style={styles.title}>Équipe <Text style={styles.hint}>· le 1er est en 1ère ligne : les ennemis le visent en priorité</Text></Text>
            {s.team.map((uid, i) => {
              const m = s.mons[uid];
              const st = monStats(s, uid);
              const pts = talentPoints(m.level) - spentPoints(m.talents);
              const auras = auraDisplay(m.speciesId, 1);
              const move = (delta: number) => {
                const j = i + delta;
                if (j < 0 || j >= s.team.length) return;
                const order = [...s.team];
                [order[i], order[j]] = [order[j], order[i]];
                act((g) => setTeam(g, order));
                feedback();
              };
              return (
                <Pressable key={uid} onPress={() => openMon(uid)} style={styles.card}>
                  <View style={styles.reorder}>
                    <Pressable hitSlop={8} disabled={i === 0} onPress={() => move(-1)}>
                      <Text style={[styles.reorderArrow, i === 0 && styles.reorderArrowOff]}>▲</Text>
                    </Pressable>
                    <Text style={styles.slot}>{i + 1}</Text>
                    <Pressable hitSlop={8} disabled={i === s.team.length - 1} onPress={() => move(1)}>
                      <Text style={[styles.reorderArrow, i === s.team.length - 1 && styles.reorderArrowOff]}>▼</Text>
                    </Pressable>
                  </View>
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
                    <Text style={styles.aura}>Aura à l'équipe : {auras.map((a) => `${a.label} +${a.value} %`).join(' · ')}</Text>
                    <View style={styles.row}>
                      {canEvolve(m, dexMax) && <Text style={styles.flag}>Peut évoluer</Text>}
                      {pts > 0 && <Text style={[styles.flag, { backgroundColor: '#3d5afe' }]}>{pts} talent{pts > 1 ? 's' : ''}</Text>}
                      {Object.keys(m.items).length < 3 && <Text style={[styles.flag, { backgroundColor: '#455a64' }]}>{3 - Object.keys(m.items).length} emplacement{3 - Object.keys(m.items).length > 1 ? 's' : ''} libre</Text>}
                    </View>
                  </View>
                </Pressable>
              );
            })}
            {hasActions && (
              <>
                <View style={styles.row}>
                  <Text style={styles.title}>Actions</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.maintRow}>
                  {dexCompletable && (
                <Button small label="Compléter le Pokédex" color="#2e7d32" onPress={() => {
                  const n = act((g: GameState) => completeDex(g, false, { keepEvolutionMaterial }));
                  if (n) { feedback('evolve'); toast(`${n} évolution${n > 1 ? 's' : ''} pour compléter le Pokédex`, '#69f0ae'); }
                }} />
              )}
              {excess.length > 0 && (
                <Button small label={`Nettoyer les doublons (${excess.length})`} color="#8d6e63" onPress={() => {
                  const candies = excess.length * 3;
                  setCleanup({
                    title: 'Relâcher les doublons ?',
                    message: `${excess.length} Pokémon en excès seront relâchés (le plus fort gardé par étage déjà possédé, chromatiques et normaux comptés à part${keepEvolutionMaterial ? ', avec de la matière en réserve pour les évolutions manquantes' : ''}). Tu gagneras ${candies} bonbons.`,
                    primary: {
                      label: 'Relâcher', color: '#8d6e63', onPress: () => {
                        const r = act((g: GameState) => releaseExcess(g, { keepEvolutionMaterial }));
                        if (r) { feedback('medal'); toast(`${r.count} Pokémon relâchés, +${r.candies} bonbons`, '#69f0ae'); }
                      },
                    },
                    secondary: { label: 'Annuler', onPress: () => { } },
                  });
                }} />
              )}
              {boxEquippedCount > 0 && (
                <Button small label={`Déséquiper la boîte (${boxEquippedCount})`} onPress={() => {
                  const n = act((g: GameState) => unequipBox(g));
                  if (n) { feedback(); toast(`${n} objet${n > 1 ? 's' : ''} retiré${n > 1 ? 's' : ''}, de retour dans le sac`, '#69f0ae'); }
                }} />
              )}
              {belowStars.length > 0 && (
                <Button small label={`Ne garder que 3★+ (−${belowStars.length})`} color="#5d4037" onPress={() => {
                  const candies = belowStars.length * 3;
                  setCleanup({
                    title: 'Relâcher les Pokémon sous 3★ ?',
                    message: `${belowStars.length} Pokémon de la boîte sous 3★ seront relâchés. Tu gagneras ${candies} bonbons.`,
                    primary: {
                      label: 'Relâcher', color: '#5d4037', onPress: () => {
                        const r = act((g: GameState) => releaseBelowStars(g, 3));
                        if (r) { feedback('medal'); toast(`${r.count} Pokémon relâchés, +${r.candies} bonbons`, '#69f0ae'); }
                      },
                    },
                    secondary: { label: 'Annuler', onPress: () => { } },
                  });
                }} />
              )}
              {notShiny.length > 0 && (
                <Button small label={`Ne garder que les Shiney (−${notShiny.length})`} color="#6a1b9a" onPress={() => {
                  const candies = notShiny.length * 3;
                  setCleanup({
                    title: 'Relâcher tous les Pokémon non chromatiques de la boîte ?',
                    message: `${notShiny.length} Pokémon normaux de la boîte seront relâchés. Tu gagneras ${candies} bonbons.`,
                    primary: {
                      label: 'Relâcher', color: '#6a1b9a', onPress: () => {
                        const r = act((g: GameState) => releaseNotShiny(g));
                        if (r) { feedback('medal'); toast(`${r.count} Pokémon relâchés, +${r.candies} bonbons`, '#69f0ae'); }
                      },
                    },
                    secondary: { label: 'Annuler', onPress: () => { } },
                  });
                }} />
              )}
                </ScrollView>
              </>
            )}
            <View style={styles.row}>
              <Text style={styles.title}>Ordonner/Filtrer</Text>
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
            {boxTypes.length > 0 && (
              
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                <Pressable onPress={() => setTypeFilter(null)} style={[styles.chip, !activeType && styles.chipOn]}>
                  <Text style={styles.chipTxt}>Tous types</Text>
                </Pressable>
                {boxTypes.map((t) => (
                  <Pressable key={t} onPress={() => setTypeFilter(activeType === t ? null : t)}
                    style={[styles.chip, { borderWidth: 1, borderColor: TYPE_COLOR[t] }, activeType === t && { backgroundColor: TYPE_COLOR[t] }]}>
                    <Text style={[styles.chipTxt, activeType === t && { color: textOn(TYPE_COLOR[t]) }]}>{typeLabel(t)}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Rechercher dans la boîte…"
              placeholderTextColor={C.dim}
              style={styles.search}
            />
            <View style={styles.row}>
              <Text style={styles.title}>Boîte · {box.length}</Text>
            </View>
            {evolveOnly && !box.length && !q && <Text style={styles.hint}>Aucun Pokémon de la boîte n'est prêt à évoluer pour l'instant.</Text>}
            {!!q && !box.length && <Text style={styles.hint}>Aucun Pokémon de la boîte ne correspond à « {query.trim()} ».</Text>}
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
  slot: { color: C.gold, fontWeight: '900', fontSize: 16, width: 12, textAlign: 'center' },
  reorder: { alignItems: 'center', gap: 2 },
  reorderArrow: { color: C.sub, fontSize: 13, fontWeight: '900', paddingHorizontal: 4, paddingVertical: 2 },
  reorderArrowOff: { color: C.dim, opacity: 0.3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  maintRow: { flexDirection: 'row', gap: 8 },
  name: { color: C.text, fontWeight: '800', fontSize: 15 },
  lv: { color: C.sub, fontWeight: '700', fontSize: 12 },
  xpTrack: { height: 4, backgroundColor: C.panel2, borderRadius: 2, overflow: 'hidden' },
  xpFill: { height: '100%', backgroundColor: '#42a5f5' },
  stats: { color: C.sub, fontSize: 11 },
  aura: { color: '#80cbc4', fontSize: 11 },
  flag: { color: '#fff', fontSize: 10, fontWeight: '800', backgroundColor: '#c0392b', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, overflow: 'hidden' },
  boxCell: { alignItems: 'center', backgroundColor: C.panel, borderRadius: 12, paddingVertical: 6 },
  targetMark: { position: 'absolute', top: -2, left: -4, fontSize: 11, opacity: 0.85 },
  boxName: { color: C.text, fontSize: 10, fontWeight: '700', maxWidth: 70 },
  boxLv: { color: C.sub, fontSize: 10 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: C.panel },
  search: { backgroundColor: C.panel, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, color: C.text, fontSize: 14 },
  chipOn: { backgroundColor: C.accent },
  chipTxt: { color: C.text, fontWeight: '700', fontSize: 12 },
});
