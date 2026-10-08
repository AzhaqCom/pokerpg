import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './components/Text';
import {
  GameState, TOWER_BRANCHES, TOWER_NODES, TowerNode, buyTowerNode, resetTowerTree, towerMedals, towerMedalsLeft, towerMedalsSpent,
  towerNode, towerNodeBlock, towerNodeCost, towerRank,
} from '../game/game';
import { useGame } from '../store/game';
import { runner } from './battle/runner';
import { Button } from './components/Button';
import { Dialog, DialogSpec } from './components/Dialog';
import { feedback } from './components/feedback';
import { C } from './theme';

/**
 * Sous-onglet « 🌳 Arbre » de l'onglet Tour (2026-10-08) : médailles (1 par palier de 10 franchi pour la première fois),
 * une carte par branche, un nœud par ligne (nom, rang, effet, bouton d'achat ou ✓), réinitialisation gratuite.
 */
export function TowerTree() {
  const s = useGame((g) => g.s) as GameState;
  useGame((g) => g.rev);
  const act = useGame((g) => g.act);
  const [dialog, setDialog] = useState<DialogSpec | null>(null);
  const left = towerMedalsLeft(s);
  const spent = towerMedalsSpent(s);
  const nextAt = (towerMedals(s) + 1) * 10;
  const buy = (n: TowerNode) => {
    if (!act((g) => buyTowerNode(g, n.id))) return;
    feedback('medal', true);
    // Entraînement : l'étage en cours repart avec la nouvelle force (seulement dans la Tour)
    if (useGame.getState().s?.towerFloor !== null) runner.restart();
  };
  return (
    <View style={{ gap: 10 }}>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.medals}>🏅 {left} disponible{left > 1 ? 's' : ''}</Text>
          <Text style={styles.sub}>{spent} dépensée{spent > 1 ? 's' : ''}</Text>
        </View>
        <Text style={styles.sub}>
          1 médaille par palier de 10 étages franchi pour la première fois : prochaine à l'étage {nextAt}. Effets valables
          dans la Tour seulement, en combat comme hors ligne. Réinitialisation gratuite à tout moment.
        </Text>
      </View>
      {TOWER_BRANCHES.map((b) => {
        const nodes = TOWER_NODES.filter((n) => n.branch === b.id);
        const soon = nodes.every((n) => n.soon);
        return (
          <View key={b.id} style={[styles.card, soon && styles.cardSoon]}>
            <View style={styles.row}>
              <Text style={styles.branch}>{b.icon} {b.name}</Text>
              <Text style={styles.sub}>{soon ? 'Bientôt' : b.desc}</Text>
            </View>
            {nodes.map((n) => <NodeRow key={n.id} s={s} node={n} onBuy={() => buy(n)} />)}
          </View>
        );
      })}
      {spent > 0 && (
        <Button label="Réinitialiser l'arbre (gratuit)" color={C.panel2} onPress={() => setDialog({
          title: 'Réinitialiser l’arbre ?',
          message: `Tes ${spent} médailles te sont rendues, à redistribuer comme tu veux. Les objets déjà transmutés le restent.`,
          primary: { label: 'Réinitialiser', onPress: () => { act(resetTowerTree); feedback(); if (s.towerFloor !== null) runner.restart(); } },
          secondary: { label: 'Annuler', onPress: () => {} },
        })} />
      )}
      <Dialog spec={dialog} onClose={() => setDialog(null)} />
    </View>
  );
}

function NodeRow({ s, node, onBuy }: { s: GameState; node: TowerNode; onBuy: () => void }) {
  const rank = towerRank(s, node.id);
  const max = node.costs.length;
  const block = towerNodeBlock(s, node.id);
  const cost = towerNodeCost(s, node.id);
  // effet du rang suivant (celui qu'on achète), ou du rang atteint au maximum
  const desc = node.desc[Math.min(rank, max - 1)] ?? node.desc[node.desc.length - 1];
  const owned = rank > 0;
  const status = block === 'soon' ? 'Bientôt'
    : block === 'max' ? '✓'
      : block === 'requires' ? `Après ${towerNode(node.requires!).name}`
        : `${cost} 🏅`;
  return (
    <View style={styles.node}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.nodeName, owned && styles.nodeOwned, block === 'soon' && styles.dim]}>
          {node.icon} {node.name}{max > 1 ? ` · ${rank}/${max}` : ''}
        </Text>
        <Text style={[styles.nodeDesc, block === 'soon' && styles.dim]}>{desc}</Text>
      </View>
      {block === null || block === 'medals' ? (
        <Pressable disabled={block !== null} onPress={onBuy}
          style={({ pressed }) => [styles.buy, { opacity: block ? 0.4 : pressed ? 0.75 : 1 }]}>
          <Text style={styles.buyTxt}>{status}</Text>
        </Pressable>
      ) : (
        <Text style={[styles.status, block === 'max' && styles.statusMax]}>{status}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: C.panel, borderRadius: 14, padding: 12, gap: 10 },
  cardSoon: { opacity: 0.55 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  medals: { color: C.gold, fontSize: 17, fontWeight: '900' },
  branch: { color: C.text, fontSize: 15, fontWeight: '900' },
  sub: { color: C.sub, fontSize: 12 },
  node: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 8 },
  nodeName: { color: C.text, fontSize: 13, fontWeight: '800' },
  nodeOwned: { color: C.ok },
  nodeDesc: { color: C.sub, fontSize: 12 },
  dim: { color: C.dim },
  buy: { backgroundColor: C.accent, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, minWidth: 64, alignItems: 'center' },
  buyTxt: { color: C.text, fontSize: 13, fontWeight: '900' },
  status: { color: C.sub, fontSize: 12, fontWeight: '700', maxWidth: 96, textAlign: 'right' },
  statusMax: { color: C.ok, fontSize: 16, fontWeight: '900' },
});
