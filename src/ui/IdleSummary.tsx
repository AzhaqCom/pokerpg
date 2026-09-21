import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { move, species } from '../game/data';
import { GameState } from '../game/game';
import { IdleGains, applyIdleGains } from '../game/idle';
import { template } from '../game/items';
import { RARITIES, RARITY_COLOR } from '../game/model';
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

export function IdleSummary({ gains, onClose }: { gains: IdleGains | null; onClose: () => void }) {
  const s = useGame((g) => g.s) as GameState | null;
  const act = useGame((g) => g.act);
  if (!gains || !s) return null;
  const collect = () => {
    act((st) => applyIdleGains(st, gains));
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
                {gains.bagItems.map((it) => (
                  <Text key={it.uid} style={[styles.line, { color: RARITY_COLOR[it.rarity] }]}>+ {template(it.templateId).name} ({RARITIES[it.rarity]})</Text>
                ))}
                {gains.shardsFromRecycle > 0 && <Text style={styles.line}>💎 +{gains.shardsFromRecycle} éclats (recyclage auto)</Text>}
                {gains.shinies.map((mon) => (
                  <Text key={mon.uid} style={[styles.line, { color: '#ff5ec4' }]}>✨ {species(mon.speciesId).name} chromatique Nv.{mon.level} capturé !</Text>
                ))}
              </>
            )}
          </ScrollView>
          <Button label="Récupérer" color={C.accent} onPress={collect} />
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
