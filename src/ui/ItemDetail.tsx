import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GameState, fuseItems, heldBy, holder, recycle, rerollItemSub, upgradeItem } from '../game/game';
import { MAX_RARITY, RARITY_COLOR } from '../game/model';
import { MAX_ITEM_LEVEL, statText, recycleValue, rerollCost, template, upgradeCost } from '../game/items';
import { Item } from '../game/model';
import { rng, useGame } from '../store/game';
import { toast } from '../store/ui';
import { runner } from './battle/runner';
import { Button } from './components/Button';
import { ItemCard } from './components/ItemCard';
import { feedback } from './components/feedback';
import { monName } from './helpers';
import { C } from './theme';

/**
 * Popup d'actions sur un objet (sac ou fiche Pokémon) : amélioration, changement d'une sous-stat, fusion avec deux
 * exemplaires identiques, verrouillage, recyclage.
 */
export function ItemDetail({ item, onClose, onSelect }: { item: Item | null; onClose: () => void; onSelect?: (uid: string) => void }) {
  const s = useGame((g) => g.s) as GameState | null;
  const act = useGame((g) => g.act);
  if (!item || !s) return null;
  const w = holder(s, item.uid);
  // 2 autres exemplaires identiques (même objet, même rareté), libres et non verrouillés : fusion directe
  const held = heldBy(s);
  const fuseMates = item.rarity < MAX_RARITY
    ? Object.values(s.items).filter((o) => o.uid !== item.uid && o.templateId === item.templateId && o.rarity === item.rarity && !o.locked && !held.has(o.uid)).slice(0, 2)
    : [];
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.box} onPress={() => {}}>
          <ScrollView contentContainerStyle={{ gap: 10 }}>
          <ItemCard item={item} wornBy={w ? monName(w) : undefined} />
          <Text style={styles.shards}>💎 {s.shards} éclats</Text>
          <Button label={item.level >= MAX_ITEM_LEVEL ? 'Niveau maximum (100)' : `Améliorer (${upgradeCost(item)} 💎)`}
            disabled={item.level >= MAX_ITEM_LEVEL || s.shards < upgradeCost(item)}
            onPress={() => { if (act((g) => upgradeItem(g, item.uid))) { feedback('level'); runner.restart(); } }} />
          {item.subs.length > 0 && (
            <View style={{ gap: 6 }}>
              <Text style={styles.label}>Changer une sous-stat ({rerollCost(item)} 💎, tirage au hasard)</Text>
              {item.subs.map((sub, i) => (
                <View key={i} style={styles.subRow}>
                  <Text style={styles.subTxt}>{statText(sub.stat, sub.value)}</Text>
                  <Button small label="↻ Changer" disabled={s.shards < rerollCost(item)} onPress={() => {
                    if (act((g) => rerollItemSub(g, item.uid, i, rng))) { feedback(); runner.restart(); }
                  }} />
                </View>
              ))}
            </View>
          )}
          {fuseMates.length === 2 && (
            <Button label={`Fusionner avec 2 identiques → ${template(item.templateId).name}`} color="#8e24aa" onPress={() => {
              const out = act((g) => fuseItems(g, [item.uid, ...fuseMates.map((m) => m.uid)], rng));
              if (out) {
                feedback('medal', true); runner.restart();
                toast(`Fusion : ${template(out.templateId).name}`, RARITY_COLOR[out.rarity], template(out.templateId).name);
                onSelect?.(out.uid);
              }
            }} />
          )}
          <Button label={item.locked ? 'Déverrouiller' : 'Verrouiller'}
            onPress={() => act((g) => { g.items[item.uid].locked = !item.locked; })} />
          <Button label={`Recycler (+${recycleValue(item)} 💎)`} disabled={!!w || item.locked} color="#c0392b"
            onPress={() => { act((g) => recycle(g, [item.uid])); onClose(); }} />
          <Button label="Fermer" color={C.panel2} onPress={onClose} />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 28 },
  box: { backgroundColor: C.panel, borderRadius: 20, padding: 16, gap: 10, maxHeight: '90%' },
  shards: { color: C.sub, fontSize: 12, fontWeight: '700' },
  label: { color: C.text, fontSize: 13, fontWeight: '700' },
  subRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  subTxt: { color: C.sub, fontSize: 13 },
});
