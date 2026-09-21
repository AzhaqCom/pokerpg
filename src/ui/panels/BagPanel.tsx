import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { BALL_PRICE, BALLS, BallKind, buyBall, fuseItems, fusionCandidates, heldBy, recycle } from '../../game/game';
import { slotOf, template, itemScore } from '../../game/items';
import { Item, ItemSlot, RARITIES, RARITY_COLOR } from '../../game/model';
import { rng, useGame } from '../../store/game';
import { toast } from '../../store/ui';
import { ItemDetail } from '../ItemDetail';
import { BallIcon } from '../components/BallIcon';
import { Button } from '../components/Button';
import { ItemCard } from '../components/ItemCard';
import { feedback } from '../components/feedback';
import { monName } from '../helpers';
import { runner } from '../battle/runner';
import { C } from '../theme';

const FILTERS: { key: ItemSlot | 'all'; label: string }[] = [
  { key: 'all', label: 'Tout' }, { key: 'offense', label: 'Offensif' }, { key: 'defense', label: 'Défensif' }, { key: 'berry', label: 'Baies' },
];

export function BagPanel() {
  const s = useGame((g) => g.s)!;
  useGame((g) => g.rev);
  const act = useGame((g) => g.act);
  const [filter, setFilter] = useState<ItemSlot | 'all'>('all');
  const [sel, setSel] = useState<string | null>(null);
  const held = heldBy(s);
  const items = Object.values(s.items)
    .filter((i) => filter === 'all' || slotOf(i) === filter)
    .sort((a, b) => b.rarity - a.rarity || itemScore(b) - itemScore(a));
  const fusions = fusionCandidates(s);
  const junk = Object.values(s.items).filter((i) => i.rarity <= 1 && !i.locked && !held.has(i.uid));
  const selected = sel ? s.items[sel] : null;

  return (
    <>
      <FlatList
        data={items}
        keyExtractor={(it) => it.uid}
        renderItem={({ item: it }: { item: Item }) => {
          const w = held.get(it.uid);
          return <ItemCard item={it} wornBy={w ? monName(w) : undefined} onPress={() => setSel(it.uid)} />;
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
                  <View key={b} style={styles.ballCount}>
                    <BallIcon kind={b} size={18} />
                    <Text style={styles.resTxt}>{s.balls[b]}</Text>
                  </View>
                ))}
              </View>
            </View>
            <View style={styles.row}>
              <Button small label={`Fusionner (${fusions.length})`} color={fusions.length ? '#8e24aa' : C.panel2} disabled={!fusions.length} onPress={() => {
                let n = 0;
                act((g) => { for (let c = fusionCandidates(g); c.length; c = fusionCandidates(g)) { const out = fuseItems(g, c[0].map((i) => i.uid), rng); if (out) { n++; toast(`Fusion : ${template(out.templateId).name} ${RARITIES[out.rarity]}`, RARITY_COLOR[out.rarity]); } } });
                if (n) { feedback('medal', true); runner.restart(); }
              }} />
              <Button small label={`Recycler communs et peu communs (${junk.length})`} disabled={!junk.length} onPress={() => {
                const gain = act((g) => recycle(g, junk.map((i) => i.uid)));
                toast(`+${gain} éclats`);
              }} />
            </View>
            <View style={styles.row}>
              {(Object.keys(BALLS) as BallKind[]).map((b) => (
                <Button key={b} small icon={<BallIcon kind={b} size={16} />} label={`${BALLS[b].name} (${BALL_PRICE[b]} 💎)`} disabled={s.shards < BALL_PRICE[b]}
                  onPress={() => { if (act((g) => buyBall(g, b))) feedback(); }} />
              ))}
            </View>
            <Text style={styles.hint}>Fusion : 3 objets identiques de même rareté → rareté supérieure. Les objets portés ou verrouillés ne sont jamais recyclés.</Text>
            <View style={styles.row}>
              {FILTERS.map((f) => (
                <Pressable key={f.key} onPress={() => setFilter(f.key)} style={[styles.chip, filter === f.key && styles.chipOn]}>
                  <Text style={styles.chipTxt}>{f.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        }
        ListEmptyComponent={<Text style={styles.hint}>Ton sac est vide : les objets tombent en combat (et les boss en donnent 3).</Text>}
      />
      <ItemDetail item={selected} onClose={() => setSel(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  list: { padding: 12, paddingBottom: 40 },
  res: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: C.panel, borderRadius: 12, padding: 10 },
  resTxt: { color: C.text, fontWeight: '700' },
  ballsRow: { flexDirection: 'row', gap: 10 },
  ballCount: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  hint: { color: C.dim, fontSize: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: C.panel },
  chipOn: { backgroundColor: C.accent },
  chipTxt: { color: C.text, fontWeight: '700', fontSize: 12 },
});
