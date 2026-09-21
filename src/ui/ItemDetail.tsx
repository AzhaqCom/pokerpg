import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { GameState, holder, recycle, upgradeItem } from '../game/game';
import { recycleValue, upgradeCost } from '../game/items';
import { Item } from '../game/model';
import { useGame } from '../store/game';
import { runner } from './battle/runner';
import { Button } from './components/Button';
import { ItemCard } from './components/ItemCard';
import { feedback } from './components/feedback';
import { monName } from './helpers';
import { C } from './theme';

/** Popup d'actions sur un objet du sac (amélioration, verrouillage, recyclage). */
export function ItemDetail({ item, onClose }: { item: Item | null; onClose: () => void }) {
  const s = useGame((g) => g.s) as GameState | null;
  const act = useGame((g) => g.act);
  if (!item || !s) return null;
  const w = holder(s, item.uid);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.box} onPress={() => {}}>
          <ItemCard item={item} wornBy={w ? monName(w) : undefined} />
          <Button label={`Améliorer (${upgradeCost(item)} 💎)`} disabled={s.shards < upgradeCost(item)}
            onPress={() => { if (act((g) => upgradeItem(g, item.uid))) { feedback('level'); runner.restart(); } }} />
          <Button label={item.locked ? 'Déverrouiller' : 'Verrouiller'}
            onPress={() => act((g) => { g.items[item.uid].locked = !item.locked; })} />
          <Button label={`Recycler (+${recycleValue(item)} 💎)`} disabled={!!w || item.locked} color="#c0392b"
            onPress={() => { act((g) => recycle(g, [item.uid])); onClose(); }} />
          <Button label="Fermer" color={C.panel2} onPress={onClose} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 28 },
  box: { backgroundColor: C.panel, borderRadius: 20, padding: 16, gap: 10 },
});
