import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { BIOMES, REGIONS } from '../game/content';
import { species } from '../game/data';
import { MonThumb } from './components/MonThumb';
import { C } from './theme';

/**
 * Outil de développement (bouton `__DEV__` des Réglages) : répartition des sauvages de chaque région, biome par biome et
 * zone par zone (espèces avec leur poids, boss), pour relire les pools générés sans ouvrir `content.ts`.
 * Poids < 10 = rare (capture ÷ 2) ; ★ = légendaire ; 👑 = boss (⟳ : rejoint le pool une fois vaincu).
 */
const LEG = new Set([144, 145, 146, 150, 151, 243, 244, 245, 249, 250, 251, 377, 378, 379, 380, 381, 382, 383, 384, 385, 386,
  480, 481, 482, 483, 484, 485, 486, 487, 488, 489, 490, 491, 492, 493]);

export function DevPools({ open, onClose, initialRegion = 0 }: { open: boolean; onClose: () => void; initialRegion?: number }) {
  const [region, setRegion] = useState(initialRegion);
  const start = REGIONS[region].start;
  const end = REGIONS[region + 1]?.start ?? BIOMES.length;
  const biomes = BIOMES.slice(start, end).map((b, i) => ({ b, index: start + i }));
  return (
    <Modal visible={open} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.top}>
          <Pressable onPress={onClose} hitSlop={12}><Text style={styles.close}>‹ Retour</Text></Pressable>
          <Text style={styles.title}>🔧 Pools des sauvages</Text>
        </View>
        <View style={styles.tabs}>
          {REGIONS.map((r, i) => (
            <Pressable key={r.name} onPress={() => setRegion(i)} style={[styles.tab, region === i && styles.tabOn]}>
              <Text style={styles.tabTxt}>{r.name}</Text>
            </Pressable>
          ))}
        </View>
        <FlatList
          data={biomes}
          keyExtractor={({ index }) => String(index)}
          contentContainerStyle={{ padding: 12, gap: 12, paddingBottom: 40 }}
          initialNumToRender={3}
          windowSize={5}
          renderItem={({ item: { b, index } }) => (
            <View style={styles.biome}>
              <Text style={styles.biomeName}>b{index} · {b.name} <Text style={styles.dim}>({b.arena.leader}, {b.arena.type})</Text></Text>
              {b.zones.map((z) => {
                const total = z.pool.reduce((a, [, w]) => a + w, 0);
                return (
                  <View key={z.name} style={styles.zone}>
                    <Text style={styles.zoneName}>
                      {z.name} <Text style={styles.dim}>Nv.{z.minLv}-{z.maxLv} · {z.pool.length} espèces · 👑 {species(z.boss.speciesId).name} Nv.{z.boss.level}{z.boss.joinsPool ? ' ⟳' : ''}</Text>
                    </Text>
                    <View style={styles.grid}>
                      {z.pool.map(([id, w]) => (
                        <View key={id} style={styles.cell}>
                          <MonThumb speciesId={id} size={34} />
                          <Text style={[styles.name, LEG.has(id) && { color: C.gold }]} numberOfLines={1}>{LEG.has(id) ? '★ ' : ''}{species(id).name}</Text>
                          <Text style={[styles.w, w < 10 && { color: '#ff8a80' }]}>{w} · {Math.round((w / total) * 100)} %</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, paddingTop: 40 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 16, paddingBottom: 8 },
  close: { color: C.sub, fontSize: 16, fontWeight: '700' },
  title: { color: C.text, fontSize: 17, fontWeight: '800' },
  tabs: { flexDirection: 'row', gap: 6, paddingHorizontal: 12 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 12, backgroundColor: C.panel },
  tabOn: { backgroundColor: C.accent },
  tabTxt: { color: C.text, fontWeight: '700', fontSize: 12 },
  biome: { backgroundColor: C.panel, borderRadius: 14, padding: 10, gap: 8 },
  biomeName: { color: C.text, fontWeight: '800', fontSize: 14 },
  zone: { gap: 4 },
  zoneName: { color: C.text, fontWeight: '700', fontSize: 12 },
  dim: { color: C.dim, fontWeight: '600', fontSize: 11 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  cell: { width: 64, alignItems: 'center' },
  name: { color: C.text, fontSize: 9, fontWeight: '700', maxWidth: 64 },
  w: { color: C.dim, fontSize: 9 },
});
