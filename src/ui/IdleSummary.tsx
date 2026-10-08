import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from './components/Text';
import { move, species } from '../game/data';
import { GameState, TOWER_BLESSED_PLUS } from '../game/game';
import { IdleGains } from '../game/idle';
import { plusOf, template } from '../game/items';
import { Item } from '../game/model';
import { fmtNum, itemColor, plusColor } from './helpers';
import { ChromaPill, ChromaText } from './components/RainbowBorder';
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

/** Regroupe les objets identiques (même modèle, même rareté, même cran +N), les plus rares d'abord : une absence dans
 *  la Tour qui franchit un palier de cran (`towerDropPlus`) ne mélange pas des +10 et des +11 sur une ligne. */
function groupLoot(items: IdleGains['bagItems']) {
  const map = new Map<string, { key: string; item: Item; count: number }>();
  for (const it of items) {
    const key = `${it.templateId}-${it.rarity}-${plusOf(it)}`;
    const g = map.get(key);
    if (g) g.count++;
    else map.set(key, { key, item: it, count: 1 });
  }
  return [...map.values()].sort((a, b) => b.item.rarity - a.item.rarity || plusOf(b.item) - plusOf(a.item) || b.count - a.count);
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

function ballsLine(used: IdleGains['ballsUsed']): string {
  const names = { poke: 'Poké', super: 'Super', hyper: 'Hyper' } as const;
  return (['poke', 'super', 'hyper'] as const).filter((b) => used[b] > 0).map((b) => `${used[b]} ${names[b]}`).join(', ');
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
              <Text style={styles.msg}>
                {gains.tower ? `Ton équipe n'a franchi aucun étage de la Tour (étage ${gains.tower.floor}). Choisis un étage plus bas dans l'onglet Tour.`
                  : 'Ton équipe n\'a pas tenu face aux ennemis de la zone. Renforce-la avant de repartir farmer.'}
              </Text>
            ) : (
              <>
                {gains.tower ? (
                  <>
                    <Text style={styles.line}>
                      🗼 {gains.tower.climb ? 'Ascension de la Tour' : 'Entraînement dans la Tour'} (depuis l'étage {gains.tower.floor}) :{' '}
                      {gains.wavesWon} étage{gains.wavesWon > 1 ? 's' : ''} gagné{gains.wavesWon > 1 ? 's' : ''}
                    </Text>
                    {!!gains.tower.best && gains.tower.best > (gains.tower.prevBest ?? gains.tower.best) && (
                      <Text style={[styles.line, { color: '#ffd740' }]}>🏆 Nouveau record : étage {gains.tower.best}</Text>
                    )}
                    {!!gains.tower.rewards?.length && (
                      <>
                        <Text style={styles.line}>
                          🎁 {gains.tower.rewards.length} coffre{gains.tower.rewards.length > 1 ? 's' : ''} à choisir dans l'onglet Tour :
                        </Text>
                        {gains.tower.rewards.map((r, i) => (
                          <View key={i} style={styles.lootRow}>
                            {r.plus > 0 && <ChromaPill plus={r.plus} />}
                            {/* « Chromatique +N » en dégradé, comme dans l'onglet de la Tour et la fiche d'un objet */}
                            {/* lettres côte à côte dans une rangée, sans texte imbriqué (une couleur imbriquée ne s'affichait pas ici) */}
                            <View style={styles.chromaRow}>
                              {r.plus ? <ChromaText plus={r.plus} text={`Chromatique +${r.plus}`} /> : <Text style={[styles.lootTxt, { color: plusColor(0) }]}>Chromatique</Text>}
                            </View>
                            <Text style={[styles.lootTxt, { color: C.sub }]}>· étage {r.floor}</Text>
                          </View>
                        ))}
                      </>
                    )}
                    {/* arbre de la Tour : Butin béni (+3 crans), Seconde chance */}
                    {!!gains.tower.blessed && (
                      <Text style={[styles.line, { color: '#ffd740' }]}>
                        ✨ {gains.tower.blessed} butin{gains.tower.blessed > 1 ? 's' : ''} béni{gains.tower.blessed > 1 ? 's' : ''} (+{TOWER_BLESSED_PLUS} crans)
                      </Text>
                    )}
                    {!!gains.tower.spared && (
                      <Text style={styles.line}>🍀 {gains.tower.spared} seconde{gains.tower.spared > 1 ? 's' : ''} chance{gains.tower.spared > 1 ? 's' : ''}</Text>
                    )}
                    <Text style={styles.line}>💎 +{fmtNum(gains.tower.shards)} éclats</Text>
                  </>
                ) : (
                  <Text style={styles.line}>⚔️ {gains.wavesWon} vague{gains.wavesWon > 1 ? 's' : ''} gagnée{gains.wavesWon > 1 ? 's' : ''}</Text>
                )}
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
                {/* comme dans le Sac : pastille « +N » aux couleurs du cran, nom à la couleur de la rareté ou du palier. Ligne
                    entière colorée, sans texte imbriqué (un nom coloré dans une ligne blanche ne prenait pas sa couleur) */}
                {groupLoot(gains.bagItems).map((g) => (
                  <View key={g.key} style={styles.lootRow}>
                    {plusOf(g.item) > 0 && <ChromaPill plus={plusOf(g.item)} />}
                    <Text style={[styles.lootTxt, { color: itemColor(g.item) }]}>
                      {template(g.item.templateId).name}{g.count > 1 ? ` ×${g.count}` : ''}
                    </Text>
                  </View>
                ))}
                {gains.shardsFromRecycle > 0 && <Text style={styles.line}>💎 +{gains.shardsFromRecycle} éclats (recyclage auto)</Text>}
                {Object.entries(gains.targetCaught).map(([id, n]) => (
                  <Text key={`t${id}`} style={[styles.line, { color: '#7CFC00' }]}>
                    ⚪ {species(Number(id)).name} ×{n} capturé{n > 1 ? 's' : ''}
                  </Text>
                ))}
                {Object.entries(gains.targetCandies).map(([base, n]) => (
                  <Text key={`c${base}`} style={styles.line}>🍬 +{n} bonbons {species(Number(base)).name}</Text>
                ))}
                {gains.targetMons.length > 0 && (
                  <Text style={styles.line}>📦 {gains.targetMons.length} gardé{gains.targetMons.length > 1 ? 's' : ''} en boîte</Text>
                )}
                {ballsLine(gains.ballsUsed) && <Text style={styles.line}>⚪ Balls utilisées : {ballsLine(gains.ballsUsed)}</Text>}
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
  lootRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  lootTxt: { flexShrink: 1, fontSize: 13, fontWeight: '800' },
  chromaRow: { flexDirection: 'row' },
});
