import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { BALL_PRICE, BALLS, BallKind, buyBall, buyBalls, fuseItems, fusionCandidates, heldBy, recycle } from '../../game/game';
import { slotOf, template, itemScore } from '../../game/items';
import { Item, ItemSlot, RARITIES, RARITY_COLOR } from '../../game/model';
import { rng, useGame } from '../../store/game';
import { useSettings } from '../../store/settings';
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

/** Icône de Ball = bouton d'achat direct : tap = +1, appui long = achat en rafale (fin de partie : des
 * milliers d'éclats à dépenser) ; au relâchement d'une rafale, `onBurstEnd` ouvre la boîte « ×10 · ×100 ». */
function BuyBallIcon({ kind, onBurstEnd }: { kind: BallKind; onBurstEnd: (kind: BallKind) => void }) {
  const act = useGame((g) => g.act);
  const s = useGame((g) => g.s)!;
  useGame((g) => g.rev);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stop = () => { if (timer.current) { clearInterval(timer.current); timer.current = null; } };
  useEffect(() => stop, []);
  const endPress = () => { if (timer.current) onBurstEnd(kind); stop(); };
  const buyOne = () => { if (act((g) => buyBall(g, kind))) feedback(); };
  const start = () => {
    stop();
    timer.current = setInterval(() => { if (!act((g) => buyBall(g, kind))) stop(); }, 120);
  };
  const can = s.shards >= BALL_PRICE[kind];
  return (
    <Pressable onPress={buyOne} onLongPress={start} onPressOut={endPress} delayLongPress={350}
      style={[styles.ballBuy, !can && { opacity: 0.4 }]}>
      <BallIcon kind={kind} size={32} />
      <Text style={styles.resTxt}>{s.balls[kind]}</Text>
      <Text style={styles.ballPrice}>{BALL_PRICE[kind]}💎</Text>
    </Pressable>
  );
}

/** Durée d'affichage de la boîte d'achat groupé, relancée à chaque achat. */
const BULK_BOX_MS = 3000;
const BULK_AMOUNTS = [10, 100];

export function BagPanel() {
  const s = useGame((g) => g.s)!;
  // boîte « ×10 · ×100 » : ouverte au relâchement d'une rafale, une seule Ball à la fois, fermée après 3 s
  const [bulk, setBulk] = useState<BallKind | null>(null);
  const bulkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openBulk = (kind: BallKind) => {
    if (bulkTimer.current) clearTimeout(bulkTimer.current);
    setBulk(kind);
    bulkTimer.current = setTimeout(() => setBulk(null), BULK_BOX_MS);
  };
  useEffect(() => () => { if (bulkTimer.current) clearTimeout(bulkTimer.current); }, []);
  useGame((g) => g.rev);
  const act = useGame((g) => g.act);
  const recycleMaxRarity = useSettings((st) => st.recycleMaxRarity);
  const [filter, setFilter] = useState<ItemSlot | 'all'>('all');
  const [sel, setSel] = useState<string | null>(null);
  const held = heldBy(s);
  const items = Object.values(s.items)
    .filter((i) => filter === 'all' || slotOf(i) === filter)
    .sort((a, b) => b.rarity - a.rarity || itemScore(b) - itemScore(a));
  const fusions = fusionCandidates(s);
  const junk = Object.values(s.items).filter((i) => i.rarity <= recycleMaxRarity && !i.locked && !held.has(i.uid));
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
              <View style={styles.ballsCol}>
                <Text style={styles.ballsHint}>Clique sur les Balls pour acheter</Text>
                <View style={styles.ballsRow}>
                  {(Object.keys(BALLS) as BallKind[]).map((b) => <BuyBallIcon key={b} kind={b} onBurstEnd={openBulk} />)}
                </View>
                {bulk && (
                  <View style={styles.bulkRow}>
                    <BallIcon kind={bulk} size={18} />
                    {BULK_AMOUNTS.map((n) => {
                      const cost = BALL_PRICE[bulk] * n;
                      const can = s.shards >= cost;
                      return (
                        <Pressable key={n} disabled={!can} style={[styles.bulkBtn, !can && { opacity: 0.35 }]} onPress={() => {
                          if (act((g) => buyBalls(g, bulk, n))) { feedback(); toast(`+${n} ${BALLS[bulk].name}s`); openBulk(bulk); }
                        }}>
                          <Text style={styles.bulkTxt}>×{n}</Text>
                          <Text style={styles.ballPrice}>{cost}💎</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>
            </View>
            <View style={styles.row}>
              <Button small label={`Fusionner (${fusions.length})`} color={fusions.length ? '#8e24aa' : C.panel2} disabled={!fusions.length} onPress={() => {
                let n = 0;
                act((g) => { for (let c = fusionCandidates(g); c.length; c = fusionCandidates(g)) { const out = fuseItems(g, c[0].map((i) => i.uid), rng); if (out) { n++; toast(`Fusion : ${template(out.templateId).name}`, RARITY_COLOR[out.rarity], template(out.templateId).name); } } });
                if (n) { feedback('medal', true); runner.restart(); }
              }} />
              <Button small label={`Recycler : ${RARITIES[recycleMaxRarity]} (${junk.length})`} disabled={!junk.length} onPress={() => {
                const gain = act((g) => recycle(g, junk.map((i) => i.uid)));
                toast(`+${gain} éclats`);
              }} />
            </View>
            <Text style={styles.hint}>Fusion : 3 objets identiques de même rareté → rareté supérieure.</Text>
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
  res: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.panel, borderRadius: 12, padding: 10 },
  resTxt: { color: C.text,  fontSize: 13, fontWeight: '700' },
  ballsCol: { flex: 1, gap: 4 },
  ballsHint: { color: C.dim, fontSize: 11, fontWeight: '600' },
  ballsRow: { flexDirection: 'row', gap: 6 },
  ballBuy: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, backgroundColor: C.panel2, borderRadius: 12, paddingVertical: 8 },
  ballPrice: { color: C.dim, fontSize: 10, fontWeight: '600' },
  bulkRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  bulkBtn: { flex: 1, alignItems: 'center', backgroundColor: C.accent, borderRadius: 10, paddingVertical: 4 },
  bulkTxt: { color: C.text, fontSize: 13, fontWeight: '900' },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  hint: { color: C.dim, fontSize: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: C.panel },
  chipOn: { backgroundColor: C.accent },
  chipTxt: { color: C.text, fontWeight: '700', fontSize: 12 },
});
