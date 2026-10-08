import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../components/Text';
import { towerMedalsLeft, towerTreeReady } from '../../game/game';
import { useGame } from '../../store/game';
import { feedback } from '../components/feedback';
import { TowerSection } from '../TowerSection';
import { TowerTree } from '../TowerTree';
import { C } from '../theme';

type Sub = 'climb' | 'tree';

/**
 * Onglet « 🗼 Tour » (fin de jeu, 2026-10-08 ; avant, un onglet après le dernier biome de la Carte) : deux sous-onglets,
 * l'ascension (entrée, étage, panoplies visées, combat continu, hors ligne, coffres) et l'arbre de la Tour (médailles).
 */
export function TowerPanel() {
  const [sub, setSub] = useState<Sub>('climb');
  const rewards = useGame((g) => g.s?.towerRewards.length ?? 0);
  const left = useGame((g) => (g.s ? towerMedalsLeft(g.s) : 0));
  const ready = useGame((g) => !!g.s && towerTreeReady(g.s));
  const tabs: [Sub, string][] = [
    ['climb', `🧗 Ascension${rewards ? ` 🎁${rewards}` : ''}`],
    ['tree', `🌳 Arbre${ready ? ` · 🏅${left}` : ''}`],
  ];
  return (
    <View style={{ gap: 12 }}>
      <View style={styles.tabs}>
        {tabs.map(([k, label]) => (
          <Pressable key={k} style={[styles.tab, sub === k && styles.tabOn]} onPress={() => { feedback(); setSub(k); }}>
            <Text style={[styles.tabTxt, sub === k && styles.tabTxtOn]} numberOfLines={1}>{label}</Text>
          </Pressable>
        ))}
      </View>
      {sub === 'climb' ? <TowerSection /> : <TowerTree />}
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: 8 },
  tab: { flex: 1, backgroundColor: C.panel2, borderRadius: 12, paddingVertical: 9, alignItems: 'center' },
  tabOn: { backgroundColor: C.accent },
  tabTxt: { color: C.sub, fontSize: 13, fontWeight: '800' },
  tabTxtOn: { color: C.text },
});
