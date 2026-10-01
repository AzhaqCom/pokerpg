import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from './components/Text';
import { GameState, endgameUnlocked, fusableRarity, fuseItems, heldBy, holder, itemLevelCap, recycle, rerollItemSub, upgradeItem } from '../game/game';
import { MAX_RARITY, RARITY_COLOR } from '../game/model';
import { plusOf, rarityName, statText, recycleRefund, recycleValue, rerollCost, template, upgradeCost } from '../game/items';
import { Item } from '../game/model';
import { rng, useGame } from '../store/game';
import { toast } from '../store/ui';
import { runner } from './battle/runner';
import { Button } from './components/Button';
import { ItemCard } from './components/ItemCard';
import { feedback } from './components/feedback';
import { useHoldRepeat } from './components/useHoldRepeat';
import { C } from './theme';

/**
 * Popup d'actions sur un objet (sac ou fiche Pokémon) : amélioration, changement d'une sous-stat, fusion avec deux
 * exemplaires identiques, verrouillage, recyclage.
 */
export function ItemDetail({ item, onClose, onSelect }: { item: Item | null; onClose: () => void; onSelect?: (uid: string) => void }) {
  const s = useGame((g) => g.s) as GameState | null;
  const act = useGame((g) => g.act);
  // appui long sur « Améliorer » : améliorations en rafale, de plus en plus vite (un seul `act` par tic)
  const hold = useHoldRepeat(
    (n) => (item ? act((g) => { let k = 0; while (k < n && upgradeItem(g, item.uid)) k++; return k; }) ?? 0 : 0),
    () => { feedback('level'); runner.restart(); },
  );
  if (!item || !s) return null;
  const w = holder(s, item.uid);
  // 2 autres exemplaires identiques (même objet, même rareté, même cran +N), libres et non verrouillés : fusion directe
  const held = heldBy(s);
  const fuseMates = fusableRarity(s, item)
    ? Object.values(s.items).filter((o) => o.uid !== item.uid && o.templateId === item.templateId && o.rarity === item.rarity
      && plusOf(o) === plusOf(item) && !o.locked && !held.has(o.uid)).slice(0, 2)
    : [];
  const levelCap = itemLevelCap(s);
  // résultat de la fusion : rareté suivante, ou Chromatique +N+1 en fin de jeu
  const fuseTarget = item.rarity < MAX_RARITY ? '' : ` (Chromatique +${plusOf(item) + 1})`;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.box} onPress={() => {}}>
          <ScrollView contentContainerStyle={{ gap: 10 }}>
          <ItemCard item={item} wornBy={w} animated full />
          <Text style={styles.shards}>💎 {s.shards} éclats</Text>
          <Button label={item.level >= levelCap ? `Niveau maximum (${levelCap}${endgameUnlocked(s) ? '' : ' : sans limite après le dernier Champion'})` : `Améliorer (${upgradeCost(item)} 💎)`}
            disabled={item.level >= levelCap || s.shards < upgradeCost(item)}
            onPress={() => { if (act((g) => upgradeItem(g, item.uid))) { feedback('level'); runner.restart(); } }}
            delayLongPress={350} onLongPress={hold.start} onPressOut={hold.stop} />
          <Text style={styles.hint}>Maintenir pour améliorer en continu (de plus en plus vite)</Text>
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
            <Button label={`Fusionner avec 2 identiques → ${template(item.templateId).name}${fuseTarget}`} color="#8e24aa" onPress={() => {
              const out = act((g) => fuseItems(g, [item.uid, ...fuseMates.map((m) => m.uid)], rng));
              if (out) {
                feedback('medal', true); runner.restart();
                toast(`Fusion : ${template(out.templateId).name} ${rarityName(out)}`, RARITY_COLOR[out.rarity], template(out.templateId).name);
                onSelect?.(out.uid);
              }
            }} />
          )}
          <Button label={item.locked ? 'Déverrouiller' : 'Verrouiller'}
            onPress={() => act((g) => { g.items[item.uid].locked = !item.locked; })} />
          <Button label={recycleRefund(item) > 0 ? `Recycler (+${recycleValue(item)} 💎, dont ${recycleRefund(item)} remboursés)` : `Recycler (+${recycleValue(item)} 💎)`}
            disabled={!!w || item.locked} color="#c0392b"
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
  hint: { color: C.dim, fontSize: 11, marginTop: -6 },
});
