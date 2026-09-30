import { memo, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Text, TextInput } from '../components/Text';
import { regionOf } from '../../game/content';
import { PType, species } from '../../game/data';
import {
  GameState, canCompleteDex, canEvolve, completeDex, excessMons, monsBelowStars, monsNotShiny, releaseBelowStars,
  isTargeted, releaseExcess, releaseList, releaseNotShiny, setTeam, unequipBox,
} from '../../game/game';
import { boxExcess, boxProgress, completeBox, needsXp } from '../../game/collection';
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
import { TYPE_COLOR, auraDisplay, cpColor, monName, monStats, textOn, typeLabel, xpProgress } from '../helpers';
import { C } from '../theme';
import { spentPoints, talentPoints } from '../../game/talents';

const BOX_COLS = 4;
const BOX_GAP = 8;
/** Padding horizontal de la liste : 12 de chaque côté. */
const SCREEN_PADDING = 24;
const TYPE_ORDER = Object.keys(TYPE_COLOR) as PType[];

/**
 * Empreinte de la boîte : ne change que si sa composition change (captures, relâchés, évolutions, niveaux, gènes,
 * verrous, équipe, pension, exploration, Pokédex). Les calculs de collection (doublons, « Compléter » simulé à blanc,
 * besoin d'XP…) ne sont refaits que dans ce cas, pas à chaque fin de vague : sur une grosse boîte, ils figeaient le
 * combat quelques dizaines de millisecondes à chaque `rev`.
 */
function boxSignature(s: GameState): string {
  let h = 0;
  for (const m of Object.values(s.mons)) {
    const g = m.genes;
    h = (h * 31 + m.speciesId * 7 + m.level * 13 + (g.hp + g.atk * 3 + g.def * 5 + g.spe * 7) + (m.shiny ? 101 : 0) + (m.locked ? 211 : 0)) | 0;
  }
  return [Object.keys(s.mons).length, h, s.team.join(), s.pension.map((p) => p.uid).join(), s.exploration.map((p) => p.uid).join(),
    s.dex.caught.length, s.dex.shiny.length].join('|');
}

type SortMode = 'level' | 'dex' | 'stars' | 'date';
/** Date de capture, lue dans l'identifiant du Pokémon (`m` + horodatage en base 36, voir `newUid`) : marche aussi
 * pour les Pokémon capturés avant l'ajout de ce tri. */
const capturedAt = (m: Mon) => parseInt(m.uid.slice(1, 9), 36) || 0;
const SORTS: { key: SortMode; label: string }[] = [
  { key: 'dex', label: 'Ordre Pokédex' },
  { key: 'level', label: 'Niveau' }, { key: 'stars', label: 'Rang' }, { key: 'date', label: 'Capture' },
];
const SORTERS: Record<SortMode, (a: Mon, b: Mon) => number> = {
  level: (a, b) => b.level - a.level || monStars(b) - monStars(a),
  dex: (a, b) => a.speciesId - b.speciesId || b.level - a.level,
  stars: (a, b) => monStars(b) - monStars(a) || b.level - a.level,
  date: (a, b) => capturedAt(b) - capturedAt(a),
};

export function TeamPanel() {
  const s = useGame((g) => g.s)!;
  useGame((g) => g.rev);
  const act = useGame((g) => g.act);
  const openMon = useUi((u) => u.openMon);
  const [cleanup, setCleanup] = useState<DialogSpec | null>(null);
  const [sort, setSort] = useState<SortMode>('dex');
  // 2e appui sur le tri actif : ordre inversé (ex. Pokédex décroissant, Niveau croissant)
  const [reversed, setReversed] = useState(false);
  const pickSort = (k: SortMode) => { if (k === sort) setReversed((r) => !r); else { setSort(k); setReversed(false); } };
  const [evolveOnly, setEvolveOnly] = useState(false);
  const [xpOnly, setXpOnly] = useState(false);
  const goal = useSettings((st) => st.collectionGoal);
  const boxGoal = goal === 'box' || goal === 'boxShiny';
  const [shinyFilter, setShinyFilter] = useState<'all' | 'normal' | 'shiny'>('all');
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
  const pensionUids = new Set(s.pension.map((p) => p.uid));
  const explorationUids = new Set(s.exploration.map((p) => p.uid));
  const { width } = useWindowDimensions();
  const cellWidth = (width - SCREEN_PADDING - BOX_GAP * (BOX_COLS - 1)) / BOX_COLS;
  const keepEvolutionMaterial = useSettings((st) => st.keepEvolutionMaterial);
  const hideShinyOnlyButton = useSettings((st) => st.hideShinyOnlyButton);
  // objectif « boîte » : doublons et « Compléter » suivent le calcul de collection (matière d'évolution comprise)
  const sig = boxSignature(s);
  const { xpSet, excess, belowStars, notShiny, dexCompletable, progress } = useMemo(() => ({
    xpSet: needsXp(s, goal),
    excess: boxGoal ? boxExcess(s, goal) : excessMons(s, { keepEvolutionMaterial }),
    belowStars: monsBelowStars(s, 3),
    notShiny: monsNotShiny(s),
    dexCompletable: boxGoal ? completeBox(s, goal, true) > 0 : canCompleteDex(s, { keepEvolutionMaterial }),
    progress: boxProgress(s),
  }), [sig, goal, keepEvolutionMaterial]);
  const box = boxAll
    .filter((m) => (!activeType || species(m.speciesId).types.includes(activeType)) && (!evolveOnly || canEvolve(m, dexMax)) && (!xpOnly || xpSet.has(m.uid)) && (!q || monName(m).toLowerCase().startsWith(q))
      && (shinyFilter === 'all' || m.shiny === (shinyFilter === 'shiny')))
    .sort((a, b) => (reversed ? -1 : 1) * SORTERS[sort](a, b));
  // liste courante de la boîte lue au toucher (pas une dépendance des cases : elles ne se redessinent pas pour autant)
  const boxRef = useRef<Mon[]>([]);
  boxRef.current = box;
  const openCell = useMemo(() => (uid: string) => openMon(uid, boxRef.current.map((x) => x.uid)), [openMon]);
  const boxEquippedCount = Object.values(s.mons)
    .filter((m) => !s.team.includes(m.uid))
    .reduce((a, m) => a + Object.keys(m.items).length, 0);
  const hasActions = dexCompletable || excess.length > 0 || boxEquippedCount > 0 || belowStars.length > 0 || (notShiny.length > 0 && !hideShinyOnlyButton);

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
          <BoxCell mon={m} level={m.level} stars={monStars(m)} locked={!!m.locked} targeted={isTargeted(s, m.speciesId)}
            place={pensionUids.has(m.uid) ? ' · 🏡' : explorationUids.has(m.uid) ? ' · 🧭' : ''} width={cellWidth} onOpen={openCell} />
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
                <Pressable key={uid} onPress={() => openMon(uid, s.team.filter((u) => s.mons[u]))} style={styles.card}>
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
                    <Text style={styles.stats}><Text style={{ color: cpColor(st.cp), fontWeight: '800' }}>PC {st.cp}</Text> · PV {st.hp} · Atq {st.atk} · Déf {st.def} · Vit {st.spe}</Text>
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
                <Button small label={boxGoal ? 'Compléter la boîte' : 'Compléter le Pokédex'} color="#2e7d32" onPress={() => {
                  const n = act((g: GameState) => (boxGoal ? completeBox(g, goal) : completeDex(g, false, { keepEvolutionMaterial })));
                  if (n) { feedback('evolve'); toast(`${n} évolution${n > 1 ? 's' : ''} pour compléter ${boxGoal ? 'la boîte' : 'le Pokédex'}`, '#69f0ae'); }
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
                        const r = act((g: GameState) => (boxGoal ? releaseList(g, boxExcess(g, goal).map((m) => m.uid)) : releaseExcess(g, { keepEvolutionMaterial })));
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
              {notShiny.length > 0 && !hideShinyOnlyButton && (
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
                <Pressable key={so.key} onPress={() => pickSort(so.key)} style={[styles.chip, sort === so.key && styles.chipOn]}>
                  <Text style={styles.chipTxt}>{so.label}{sort === so.key ? (reversed ? ' ▲' : ' ▼') : ''}</Text>
                </Pressable>
              ))}
              <Pressable onPress={() => setEvolveOnly((v) => !v)} style={[styles.chip, evolveOnly && styles.chipOn]}>
                <Text style={styles.chipTxt}>Peut évoluer</Text>
              </Pressable>
              <Pressable onPress={() => setXpOnly((v) => !v)} style={[styles.chip, xpOnly && styles.chipOn]}>
                <Text style={styles.chipTxt}>Besoin d'XP ({xpSet.size})</Text>
              </Pressable>
            </View>
            <View style={styles.row}>
              {([['all', 'Tous'], ['normal', 'Normaux'], ['shiny', '✨ Chromatiques']] as const).map(([key, label]) => (
                <Pressable key={key} onPress={() => setShinyFilter(key)} style={[styles.chip, shinyFilter === key && styles.chipOn]}>
                  <Text style={styles.chipTxt}>{label}</Text>
                </Pressable>
              ))}
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
              <Text style={styles.hint}>Collection {progress.normal}/{progress.total} · ✨ {progress.shiny}/{progress.total}</Text>
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

/**
 * Case de la boîte, mémorisée : elle ne se redessine que si ce qu'elle affiche change (niveau, étoiles, verrou, cible,
 * pension/exploration), pas à chaque fin de vague. `mon` est modifié sur place par le moteur : les champs affichés sont
 * donc aussi passés à part pour que la comparaison les voie changer.
 */
const BoxCell = memo(function BoxCell({ mon: m, level, locked, targeted, place, width, onOpen }: {
  mon: Mon; level: number; stars: number; locked: boolean; targeted: boolean; place: string; width: number; onOpen: (uid: string) => void;
}) {
  return (
    <Pressable onPress={() => onOpen(m.uid)} style={[styles.boxCell, { width }]}>
      <View>
        <MonThumb speciesId={m.speciesId} shiny={m.shiny} size={48} />
        {/* lignée ciblée (🎯) : en haut à gauche, à l'opposé du ✨ des chromatiques */}
        {targeted && <Text style={styles.targetMark}>🎯</Text>}
        {locked && <Text style={styles.lockMark}>🔒</Text>}
      </View>
      <Text style={styles.boxName} numberOfLines={1}>{monName(m)}</Text>
      <Text style={styles.boxLv}>Nv.{level}{place}</Text>
      <Stars mon={m} size={9} />
    </Pressable>
  );
});

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
  lockMark: { position: 'absolute', bottom: -2, left: -4, fontSize: 10, opacity: 0.85 },
  boxName: { color: C.text, fontSize: 10, fontWeight: '700', maxWidth: 70 },
  boxLv: { color: C.sub, fontSize: 10 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: C.panel },
  search: { backgroundColor: C.panel, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, color: C.text, fontSize: 14 },
  chipOn: { backgroundColor: C.accent },
  chipTxt: { color: C.text, fontWeight: '700', fontSize: 12 },
});
