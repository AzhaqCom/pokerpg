import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { move, species } from '../game/data';
import { GameState } from '../game/game';
import { IdleGains } from '../game/idle';
import { template } from '../game/items';
import { RARITY_COLOR } from '../game/model';
import { useGame } from '../store/game';
import { runner } from './battle/runner';
import { Button } from './components/Button';
import { C } from './theme';

function formatDuration(ms: number): string {
  const totalMin = Math.round(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (!h) return `${m} min`;
  return `${h} h ${String(m).padStart(2, '0')}`;
}

/** Regroupe les objets identiques (même modèle, même rareté), les plus rares d'abord. */
function groupLoot(items: IdleGains['bagItems']) {
  const map = new Map<string, { templateId: (typeof items)[number]['templateId']; rarity: (typeof items)[number]['rarity']; count: number }>();
  for (const it of items) {
    const k = `${it.templateId}-${it.rarity}`;
    const g = map.get(k);
    if (g) g.count++;
    else map.set(k, { templateId: it.templateId, rarity: it.rarity, count: 1 });
  }
  return [...map.values()].sort((a, b) => b.rarity - a.rarity || b.count - a.count);
}

/** Regroupe les chromatiques d'une même espèce ; niveau seul s'il est unique, sinon la plage « Nv.a-b ». */
function groupShinies(mons: IdleGains['shinies']) {
  const map = new Map<number, { speciesId: number; min: number; max: number; count: number }>();
  for (const m of mons) {
    const g = map.get(m.speciesId);
    if (g) { g.count++; g.min = Math.min(g.min, m.level); g.max = Math.max(g.max, m.level); }
    else map.set(m.speciesId, { speciesId: m.speciesId, min: m.level, max: m.level, count: 1 });
  }
  return [...map.values()].map((g) => ({ ...g, levels: g.min === g.max ? `Nv.${g.min}` : `Nv.${g.min}-${g.max}` }));
}

/** Résumé purement informatif : les gains sont déjà encaissés au calcul (voir `checkIdle` dans App.tsx). */
export function IdleSummary({ gains, onClose }: { gains: IdleGains | null; onClose: () => void }) {
  const s = useGame((g) => g.s) as GameState | null;
  if (!gains || !s) return null;
  const collect = () => {
    runner.paused = false;
    onClose();
  };
  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.backdrop}>
        <View style={styles.box}>
          <Text style={styles.title}>Pendant ton absence ({formatDuration(gains.durationMs)})</Text>
          <ScrollView style={{ maxHeight: 340 }}>
            {gains.wavesWon === 0 ? (
              <Text style={styles.msg}>Ton équipe n'a pas tenu face aux ennemis de la zone. Renforce-la avant de repartir farmer.</Text>
            ) : (
              <>
                <Text style={styles.line}>⚔️ {gains.wavesWon} vague{gains.wavesWon > 1 ? 's' : ''} gagnée{gains.wavesWon > 1 ? 's' : ''}</Text>
                {gains.perMon.filter((p) => p.xp > 0).map((p) => {
                  const mon = s.mons[p.uid];
                  if (!mon) return null;
                  return (
                    <Text key={p.uid} style={styles.line}>
                      {species(mon.speciesId).name} : +{p.xp} XP
                      {p.levelAfter > p.levelBefore ? ` (Nv.${p.levelBefore} → Nv.${p.levelAfter})` : ''}
                      {p.newMoves.length ? ` · apprend ${p.newMoves.map((id) => move(id).name).join(', ')}` : ''}
                    </Text>
                  );
                })}
                {groupLoot(gains.bagItems).map((g) => (
                  <Text key={`${g.templateId}-${g.rarity}`} style={[styles.line, { color: RARITY_COLOR[g.rarity] }]}>
                    + {template(g.templateId).name}{g.count > 1 ? ` ×${g.count}` : ''}
                  </Text>
                ))}
                {gains.shardsFromRecycle > 0 && <Text style={styles.line}>💎 +{gains.shardsFromRecycle} éclats (recyclage auto)</Text>}
                {groupShinies(gains.shinies).map((g) => (
                  <Text key={g.speciesId} style={[styles.line, { color: '#ff5ec4' }]}>
                    ✨ {species(g.speciesId).name} chromatique {g.levels}{g.count > 1 ? ` ×${g.count}` : ''} capturé{g.count > 1 ? 's' : ''} !
                  </Text>
                ))}
              </>
            )}
          </ScrollView>
          <Button label="OK" color={C.accent} onPress={collect} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 28 },
  box: { backgroundColor: C.panel, borderRadius: 20, padding: 20, gap: 12 },
  title: { color: C.text, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  msg: { color: C.sub, fontSize: 14, textAlign: 'center' },
  line: { color: C.text, fontSize: 13, fontWeight: '600', marginBottom: 6 },
});
