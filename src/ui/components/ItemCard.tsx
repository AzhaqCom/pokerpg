import { Pressable, StyleSheet, Text, View } from 'react-native';
import { STAT_LABEL, berryHeal, mainValue, template } from '../../game/items';
import { Item, RARITIES, RARITY_COLOR } from '../../game/model';
import { C } from '../theme';

const SLOT_ICON = { offense: '⚔', defense: '🛡', berry: '🍒' } as const;

export function itemMainText(it: Item) {
  const t = template(it.templateId);
  if (t.berry?.heal) return `Soigne ${berryHeal(it)} % des PV sous 30 %`;
  if (t.berry?.cures) return `Soigne ${({ paralysis: 'la paralysie', poison: 'le poison', sleep: 'le sommeil' } as Record<string, string>)[t.berry.cures] ?? t.berry.cures}`;
  return `${STAT_LABEL[t.main]} +${mainValue(it)} %`;
}

export function ItemCard({ item, onPress, selected, wornBy, compare }: {
  item: Item; onPress?: () => void; selected?: boolean; wornBy?: string; compare?: 'up' | 'down' | null;
}) {
  const t = template(item.templateId);
  const color = RARITY_COLOR[item.rarity];
  return (
    <Pressable onPress={onPress} style={[styles.card, { borderColor: color }, selected && styles.selected]}>
      <View style={styles.row}>
        <Text style={styles.icon}>{SLOT_ICON[t.slot]}</Text>
        <Text style={[styles.name, { color }]} numberOfLines={1}>{t.name}</Text>
        {compare === 'up' && <Text style={styles.up}>▲</Text>}
        {compare === 'down' && <Text style={styles.down}>▼</Text>}
        {item.locked && <Text style={styles.lock}>🔒</Text>}
        <Text style={styles.lv}>Nv.{item.level}</Text>
      </View>
      <Text style={styles.rarity}>{RARITIES[item.rarity]}{t.set ? ' · Panoplie Sylvestre' : ''}{wornBy ? ` · porté par ${wornBy}` : ''}</Text>
      <Text style={styles.main}>{itemMainText(item)}</Text>
      {item.subs.map((s, i) => <Text key={i} style={styles.sub}>{STAT_LABEL[s.stat]} +{s.value} %</Text>)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: C.panel, borderRadius: 12, borderWidth: 1.5, padding: 10, gap: 2 },
  selected: { backgroundColor: C.panel2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  icon: { fontSize: 14 },
  name: { fontWeight: '800', fontSize: 14, flex: 1 },
  lv: { color: C.sub, fontSize: 12, fontWeight: '700' },
  up: { color: '#69f0ae', fontWeight: '900' },
  down: { color: '#ff8a80', fontWeight: '900' },
  lock: { fontSize: 11 },
  rarity: { color: C.dim, fontSize: 11 },
  main: { color: C.text, fontSize: 13, fontWeight: '600' },
  sub: { color: C.sub, fontSize: 12 },
});
