import { useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../components/Text';
import { BALLS, BallKind, plusRecycleCandidates, setRecycleCandidates, fuseItems, fusionCandidates, heldBy, recycle } from '../../game/game';
import { SETS, recycleValue, slotOf, template, itemScore } from '../../game/items';
import { Item, ItemSlot, MAX_RARITY, RARITIES } from '../../game/model';
import { ModalBackdrop } from '../components/ModalBackdrop';
import { rng, useGame } from '../../store/game';
import { useSettings } from '../../store/settings';
import { toast, useUi } from '../../store/ui';
import { ItemDetail } from '../ItemDetail';
import { BallIcon } from '../components/BallIcon';
import { Button } from '../components/Button';
import { Dialog, DialogSpec } from '../components/Dialog';
import { ItemCard } from '../components/ItemCard';
import { feedback } from '../components/feedback';
import { runner } from '../battle/runner';
import { chromaTier, fmtNum, itemColor, itemDisplayName } from '../helpers';
import { C } from '../theme';

const FILTERS: { key: ItemSlot | 'all'; label: string }[] = [
  { key: 'all', label: 'Tout' }, { key: 'offense', label: 'Offensif' }, { key: 'defense', label: 'Défensif' }, { key: 'berry', label: 'Baies' },
];

export function BagPanel() {
  const s = useGame((g) => g.s)!;
  useGame((g) => g.rev);
  const act = useGame((g) => g.act);
  const setTab = useUi((u) => u.setTab);
  const recycleMaxRarity = useSettings((st) => st.recycleMaxRarity);
  const [filter, setFilter] = useState<ItemSlot | 'all'>('all');
  // filtre par panoplie (null = toutes) : permet aussi de recycler d'un coup une panoplie dont on ne veut pas
  const [panoply, setPanoply] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogSpec | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const held = heldBy(s);
  const items = Object.values(s.items)
    .filter((i) => (filter === 'all' || slotOf(i) === filter) && (!panoply || template(i.templateId).set === panoply))
    .sort((a, b) => b.rarity - a.rarity || itemScore(b) - itemScore(a));
  const fusions = fusionCandidates(s);
  const junk = Object.values(s.items).filter((i) => i.rarity <= recycleMaxRarity && !i.locked && !held.has(i.uid));
  const selected = sel ? s.items[sel] : null;
  // panoplies présentes dans le sac, dans l'ordre des biomes, avec leur nombre d'objets
  const setCounts = new Map<string, number>();
  for (const it of Object.values(s.items)) {
    const id = template(it.templateId).set;
    if (id) setCounts.set(id, (setCounts.get(id) ?? 0) + 1);
  }
  const bagSets = Object.keys(SETS).filter((id) => setCounts.has(id));
  const [plusOpen, setPlusOpen] = useState(false);
  const hasChroma = Object.values(s.items).some((i) => i.rarity === MAX_RARITY);
  const setJunk = panoply ? setRecycleCandidates(s, panoply) : [];
  const setGain = setJunk.reduce((a, it) => a + recycleValue(it), 0);

  return (
    <>
      <FlatList
        data={items}
        keyExtractor={(it) => it.uid}
        numColumns={2}
        columnWrapperStyle={{ gap: 8 }}
        renderItem={({ item: it }: { item: Item }) => {
          const w = held.get(it.uid);
          return <View style={{ flex: 1 / 2 }}><ItemCard item={it} wornBy={w} onPress={() => setSel(it.uid)} /></View>;
        }}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        style={{ flex: 1 }}
        contentContainerStyle={styles.list}
        // le sac peut compter des milliers d'objets : ne monter que les cartes visibles évite de figer l'appli
        initialNumToRender={12}
        windowSize={5}
        removeClippedSubviews
        ListHeaderComponent={
          <View style={{ gap: 10, marginBottom: 10 }}>
            <View style={styles.res}>
              <Text style={styles.resTxt}>💎 {s.shards} éclats</Text>
              <View style={styles.ballsRow}>
                {(Object.keys(BALLS) as BallKind[]).map((b) => (
                  <View key={b} style={styles.ballStock}><BallIcon kind={b} size={18} /><Text style={styles.resTxt}>{s.balls[b]}</Text></View>
                ))}
              </View>
              <Pressable onPress={() => setTab('shop')} hitSlop={8}><Text style={styles.shopLink}>🛒 Boutique</Text></Pressable>
            </View>
            <View style={styles.row}>
              <Button small label={`Fusionner (${fusions.length})`} color={fusions.length ? '#8e24aa' : C.panel2} disabled={!fusions.length} onPress={() => {
                let n = 0;
                act((g) => { for (let c = fusionCandidates(g); c.length; c = fusionCandidates(g)) { const out = fuseItems(g, c[0].map((i) => i.uid), rng); if (out) { n++; toast(`Fusion : ${itemDisplayName(out)}`, itemColor(out), itemDisplayName(out)); } } });
                if (n) { feedback('medal', true); runner.restart(); }
              }} />
              <Button small label={`Recycler : ${RARITIES[recycleMaxRarity]} (${junk.length})`} disabled={!junk.length} onPress={() => {
                const gain = act((g) => recycle(g, junk.map((i) => i.uid)));
                toast(`+${gain} éclats`);
              }} />
              {hasChroma && <Button small label="♻ Petits crans" color="#6d4c41" onPress={() => setPlusOpen(true)} />}
            </View>
            <Text style={styles.hint}>Fusion : 3 objets identiques de même rareté → rareté supérieure.</Text>
            <View style={styles.row}>
              {FILTERS.map((f) => (
                <Pressable key={f.key} onPress={() => setFilter(f.key)} style={[styles.chip, filter === f.key && styles.chipOn]}>
                  <Text style={styles.chipTxt}>{f.label}</Text>
                </Pressable>
              ))}
            </View>
            {(bagSets.length > 1 || panoply) && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} style={{ flexGrow: 0 }}>
                <Pressable onPress={() => setPanoply(null)} style={[styles.chip, !panoply && styles.chipOn]}>
                  <Text style={styles.chipTxt}>Toutes panoplies</Text>
                </Pressable>
                {bagSets.map((id) => (
                  <Pressable key={id} onPress={() => setPanoply(panoply === id ? null : id)} style={[styles.chip, panoply === id && styles.chipOn]}>
                    <Text style={styles.chipTxt}>{SETS[id].name} ({setCounts.get(id)})</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
            {panoply && SETS[panoply] && (
              <Button small label={`♻ Recycler ${SETS[panoply].name} (${setJunk.length}) · +${setGain}💎`} color={setJunk.length ? '#6d4c41' : C.panel2}
                disabled={!setJunk.length} onPress={() => setDialog({
                  title: `Recycler ${SETS[panoply].name} ?`,
                  message: `${setJunk.length} objet${setJunk.length > 1 ? 's' : ''} de cette panoplie, toutes raretés confondues → +${setGain} éclats. `
                    + 'Les objets verrouillés 🔒 et ceux portés par un Pokémon sont gardés. Irréversible.',
                  primary: { label: 'Recycler', color: '#c62828', onPress: () => {
                    const gain = act((g) => recycle(g, setRecycleCandidates(g, panoply).map((i) => i.uid)));
                    feedback(); toast(`+${gain} éclats`);
                  } },
                  secondary: { label: 'Annuler', onPress: () => {} },
                })} />
            )}
          </View>
        }
        ListEmptyComponent={<Text style={styles.hint}>Ton sac est vide : les objets tombent en combat (et les boss en donnent 3).</Text>}
      />
      <ItemDetail item={selected} onClose={() => setSel(null)} onSelect={setSel} />
      {plusOpen && <PlusRecycleModal panoply={panoply} onClose={() => setPlusOpen(false)} />}
      <Dialog spec={dialog} onClose={() => setDialog(null)} />
    </>
  );
}

/**
 * « ♻ Recycler les petits crans » (2026-10-07) : les Chromatiques de +0 jusqu'au cran choisi (dernier choix retenu,
 * `recyclePlusMax`), ni verrouillés 🔒 ni portés, limités à la panoplie filtrée dans le Sac s'il y en a une. Décompte
 * en direct ; un premier toucher arme le bouton, un second recycle (irréversible).
 */
function PlusRecycleModal({ panoply, onClose }: { panoply: string | null; onClose: () => void }) {
  const s = useGame((g) => g.s)!;
  useGame((g) => g.rev);
  const act = useGame((g) => g.act);
  const maxPlus = useSettings((st) => st.recyclePlusMax);
  const setSettings = useSettings((st) => st.set);
  const [armed, setArmed] = useState(false);
  const list = plusRecycleCandidates(s, maxPlus, panoply);
  const gain = list.reduce((a, it) => a + recycleValue(it), 0);
  const step = (d: number) => { setArmed(false); setSettings({ recyclePlusMax: Math.max(0, Math.min(40, maxPlus + d)) }); };
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <ModalBackdrop style={styles.backdrop} onClose={onClose}>
        <View style={styles.box}>
          <Text style={styles.title}>♻ Recycler les petits crans</Text>
          <Text style={styles.hint}>
            Les Chromatiques de +0 jusqu'au cran choisi{panoply && SETS[panoply] ? `, panoplie ${SETS[panoply].name} seulement` : ''}.
            Jamais les objets verrouillés 🔒 ni ceux portés par un Pokémon.
          </Text>
          <View style={styles.stepRow}>
            <Pressable style={styles.step} onPress={() => step(-1)}><Text style={styles.stepTxt}>−</Text></Pressable>
            <Text style={styles.stepVal}>jusqu'à <Text style={{ color: maxPlus ? chromaTier(maxPlus).text : C.text }}>+{maxPlus}</Text></Text>
            <Pressable style={styles.step} onPress={() => step(1)}><Text style={styles.stepTxt}>+</Text></Pressable>
          </View>
          <Text style={styles.count}>{list.length} objet{list.length > 1 ? 's' : ''} → +{fmtNum(gain)} 💎</Text>
          <Button label={armed ? `Confirmer : recycler ${list.length} objet${list.length > 1 ? 's' : ''} (irréversible)` : 'Recycler'}
            color={armed ? '#c62828' : '#6d4c41'} disabled={!list.length} onPress={() => {
              if (!armed) { setArmed(true); return; }
              const got = act((g) => recycle(g, plusRecycleCandidates(g, maxPlus, panoply).map((i) => i.uid)));
              feedback(); toast(`+${fmtNum(got ?? 0)} éclats`);
              setArmed(false);
            }} />
          <Button label="Fermer" color={C.panel2} onPress={onClose} />
        </View>
      </ModalBackdrop>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
  box: { backgroundColor: C.panel, borderRadius: 16, padding: 16, gap: 12 },
  title: { color: C.text, fontSize: 16, fontWeight: '900' },
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
  step: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.panel2, alignItems: 'center', justifyContent: 'center' },
  stepTxt: { color: C.text, fontSize: 18, fontWeight: '900' },
  stepVal: { color: C.text, fontSize: 16, fontWeight: '900', minWidth: 110, textAlign: 'center' },
  count: { color: C.text, fontSize: 14, fontWeight: '800', textAlign: 'center' },
  list: { padding: 12, paddingBottom: 40 },
  res: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.panel, borderRadius: 12, padding: 10 },
  resTxt: { color: C.text,  fontSize: 13, fontWeight: '700' },
  ballsRow: { flex: 1, flexDirection: 'row', gap: 10 },
  ballStock: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  shopLink: { color: C.accent, fontSize: 13, fontWeight: '800' },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  hint: { color: C.dim, fontSize: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: C.panel },
  chipOn: { backgroundColor: C.accent },
  chipTxt: { color: C.text, fontWeight: '700', fontSize: 12 },
});
