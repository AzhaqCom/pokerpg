import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from './components/Text';
import {
  GameState, endgameUnlocked, fusableRarity, fuseItems, heldBy, heldItems, holder, itemLevelCap, recycle, rerollItemSub, towerRank, transmuteCost,
  transmuteItem, transmuteTargets, upgradeItem, upgradeItemTimes,
} from '../game/game';
import { MAX_RARITY } from '../game/model';
import {
  REROLL_ROLL_MIN, SETS, plusOf, rarityName, statText, recycleRefund, recycleValue, rerollCost, template, transmute, upgradeCost, upgradeCostFor, wornSets,
} from '../game/items';
import { seededRng } from '../game/rng';
import { Item } from '../game/model';
import { rng, useGame } from '../store/game';
import { toast } from '../store/ui';
import { runner } from './battle/runner';
import { Button } from './components/Button';
import { ItemCard, SLOT_ICON, itemMainText } from './components/ItemCard';
import { ModalBackdrop } from './components/ModalBackdrop';
import { QuantityModal } from './components/QuantityModal';
import { feedback } from './components/feedback';
import { fmtNum, itemColor, itemDisplayName } from './helpers';
import { C } from './theme';

/** Niveaux d'un coup du grand bouton de la fenêtre « Améliorer ». */
const UPGRADE_BULK = 10;

/**
 * Popup d'actions sur un objet (sac ou fiche Pokémon) : amélioration, changement d'une sous-stat, fusion avec deux
 * exemplaires identiques, verrouillage, recyclage.
 */
export function ItemDetail({ item, onClose, onSelect }: { item: Item | null; onClose: () => void; onSelect?: (uid: string) => void }) {
  const s = useGame((g) => g.s) as GameState | null;
  const act = useGame((g) => g.act);
  // appui long sur « Améliorer » : fenêtre +1 / +10 (2026-10-02 ; avant, une rafale de plus en plus rapide), retenue par
  // objet pour ne jamais se rouvrir sur un autre
  const [bulkUid, setBulkUid] = useState<string | null>(null);
  // Transmutation (arbre de la Tour) : fenêtre du choix de la panoplie, retenue par objet
  const [transUid, setTransUid] = useState<string | null>(null);
  if (!item || !s) return null;
  const canTransmute = item.rarity === MAX_RARITY && towerRank(s, 'transmutation') > 0;
  const w = holder(s, item.uid);
  const t = template(item.templateId);
  // pièces de sa panoplie portées par son porteur : bonus débloqués en vert dans la carte
  const setWorn = w && t.set ? wornSets(heldItems(s, w)).get(t.set) : undefined;
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
      <ModalBackdrop style={styles.backdrop} onClose={onClose}>
        <View style={styles.box}>
          <ScrollView contentContainerStyle={{ gap: 10 }}>
          <ItemCard item={item} wornBy={w} animated full setWorn={setWorn} />
          <Text style={styles.shards}>💎 {fmtNum(s.shards)} éclats</Text>
          <Button label={item.level >= levelCap ? `Niveau maximum (${levelCap}${endgameUnlocked(s) ? '' : ' : sans limite après le dernier Champion'})` : `Améliorer (${fmtNum(upgradeCost(item))} 💎)`}
            disabled={item.level >= levelCap || s.shards < upgradeCost(item)}
            onPress={() => { if (act((g) => upgradeItem(g, item.uid))) { feedback('level'); runner.restart(); } }}
            delayLongPress={350} onLongPress={() => { feedback(); setBulkUid(item.uid); }} />
          <Text style={styles.hint}>Maintenir : améliorer de {UPGRADE_BULK} niveaux d'un coup</Text>
          {item.subs.length > 0 && (
            <View style={{ gap: 6 }}>
              <Text style={styles.label}>Changer une sous-stat ({rerollCost(item)} 💎)</Text>
              <Text style={styles.hint}>Tirage au hasard, entre {REROLL_ROLL_MIN} et 100 % du maximum de la nouvelle sous-stat</Text>
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
            <Button label={`Fusionner avec 2 identiques → ${t.name}${fuseTarget}`} color="#8e24aa" onPress={() => {
              const out = act((g) => fuseItems(g, [item.uid, ...fuseMates.map((m) => m.uid)], rng));
              if (out) {
                feedback('medal', true); runner.restart();
                // le nom (et son cran +N), à la couleur de sa rareté ou du palier du cran : la rareté n'est pas écrite
                const name = itemDisplayName(out);
                toast(`Fusion : ${name}`, itemColor(out), name);
                onSelect?.(out.uid);
              }
            }} />
          )}
          {canTransmute && (
            <Button label={`⚗ Transmuter (${fmtNum(transmuteCost(s))} 💎)`} color="#5e35b1" onPress={() => { feedback(); setTransUid(item.uid); }} />
          )}
          <Button label={item.locked ? 'Déverrouiller' : 'Verrouiller'}
            onPress={() => act((g) => { g.items[item.uid].locked = !item.locked; })} />
          <Button label={recycleRefund(item) > 0 ? `Recycler (+${recycleValue(item)} 💎, dont ${recycleRefund(item)} remboursés)` : `Recycler (+${recycleValue(item)} 💎)`}
            disabled={!!w || item.locked} color="#c0392b"
            onPress={() => { act((g) => recycle(g, [item.uid])); onClose(); }} />
          <Button label="Fermer" color={C.panel2} onPress={onClose} />
          </ScrollView>
        </View>
      </ModalBackdrop>
      {bulkUid === item.uid && <UpgradeModal item={item} onClose={() => setBulkUid(null)} />}
      {transUid === item.uid && <TransmuteModal item={item} onClose={() => setTransUid(null)} />}
    </Modal>
  );
}

/**
 * Fenêtre « Améliorer » (maintenir le bouton, 2026-10-02) : +1 ou +10 niveaux d'un coup, coût total affiché, ce qui
 * manque quand les éclats ne suffisent pas ; à moins de 10 niveaux du maximum (Nv.100 avant la fin de jeu), le grand
 * bouton monte jusqu'au maximum.
 */
function UpgradeModal({ item, onClose }: { item: Item; onClose: () => void }) {
  const s = useGame((g) => g.s)!;
  const act = useGame((g) => g.act);
  const cap = itemLevelCap(s);
  const room = cap - item.level;
  const bulk = Math.min(UPGRADE_BULK, room);
  const up = (n: number) => { if (act((g) => upgradeItemTimes(g, item.uid, n))) { feedback('level'); runner.restart(); } };
  const t = template(item.templateId);
  const options = room <= 0
    ? [{ text: '', label: 'Niveau maximum', cost: 0, onPress: () => {} }]
    : [
      { text: `+1 · ${fmtNum(upgradeCost(item))} 💎`, cost: upgradeCost(item), onPress: () => up(1) },
      ...(bulk > 1 ? [{
        text: `+${bulk}${bulk < UPGRADE_BULK ? ' (max)' : ''} · ${fmtNum(upgradeCostFor(item, bulk))} 💎`,
        cost: upgradeCostFor(item, bulk), onPress: () => up(bulk), flex: 1.4,
      }] : []),
    ];
  return (
    <QuantityModal
      icon={<Text style={styles.bulkIcon}>{SLOT_ICON[t.slot]}</Text>}
      title={<Text style={{ color: itemColor(item) }}>{t.name}</Text>}
      sub={`Nv.${item.level}${cap < Infinity ? ` / ${cap}` : ''} · ${rarityName(item)}`}
      shards={s.shards} options={options} onClose={onClose} />
  );
}

/**
 * Transmutation (arbre de la Tour, 2026-10-08) : la même pièce (même emplacement) dans une autre panoplie, avec sa stat
 * principale une fois transmuté ; cran, niveau et sous-stats gardés. Toucher une panoplie la choisit, le bouton confirme.
 */
function TransmuteModal({ item, onClose }: { item: Item; onClose: () => void }) {
  const s = useGame((g) => g.s)!;
  const act = useGame((g) => g.act);
  const [pick, setPick] = useState<string | null>(null);
  const cost = transmuteCost(s);
  const focus = s.towerSets ?? [];
  const targets = transmuteTargets(item)
    .sort((a, b) => Number(focus.includes(b.set!)) - Number(focus.includes(a.set!)) || SETS[a.set!].name.localeCompare(SETS[b.set!].name));
  const chosen = targets.find((t) => t.id === pick);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <ModalBackdrop style={styles.backdrop} onClose={onClose}>
        <View style={styles.box}>
          <Text style={styles.label}>⚗ Transmuter {template(item.templateId).name}</Text>
          <Text style={styles.hint2}>
            Même emplacement dans une autre panoplie : cran, niveau et sous-stats gardés (une sous-stat devenue stat principale
            est retirée au hasard). {fmtNum(cost)} 💎 · tu as {fmtNum(s.shards)} 💎.
          </Text>
          <ScrollView contentContainerStyle={{ gap: 6 }}>
            {targets.map((t) => {
              // stat principale une fois transmuté (le tirage des sous-stats n'y change rien)
              const preview = transmute(item, t.id, seededRng(0));
              const on = pick === t.id;
              return (
                <Pressable key={t.id} onPress={() => { feedback(); setPick(t.id); }} style={[styles.target, on && styles.targetOn]}>
                  <Text style={styles.targetName}>{focus.includes(t.set!) ? '🎯 ' : ''}{SETS[t.set!].name} · {t.name}</Text>
                  <Text style={styles.subTxt}>{itemMainText(preview)}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <Button label={chosen ? `Transmuter en ${chosen.name}` : 'Choisis une panoplie'} color="#5e35b1"
            disabled={!chosen || s.shards < cost} onPress={() => {
              const out = chosen && act((g) => transmuteItem(g, item.uid, chosen.id, rng));
              if (!out) return;
              feedback('evolve'); runner.restart();
              const name = itemDisplayName(out);
              toast(`⚗ Transmutation : ${name}`, itemColor(out), name);
              onClose();
            }} />
          <Button label="Fermer" color={C.panel2} onPress={onClose} />
        </View>
      </ModalBackdrop>
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
  bulkIcon: { fontSize: 26 },
  hint2: { color: C.dim, fontSize: 11 },
  target: { backgroundColor: C.panel2, borderRadius: 10, padding: 8, gap: 2, borderWidth: 1, borderColor: 'transparent' },
  targetOn: { borderColor: '#b39ddb', backgroundColor: '#3a2f5c' },
  targetName: { color: C.text, fontSize: 13, fontWeight: '800' },
});
