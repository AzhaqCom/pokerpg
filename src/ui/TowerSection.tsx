import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { Text } from './components/Text';
import {
  GameState, TOWER_IDLE_ITEM_EVERY, claimTowerReward, enterTower, exitTower, setTowerAuto, setTowerIdle, setTowerIdlePick, towerIdleFloor,
  towerRewardPlus, towerShards, towerStart, towerWildMult,
} from '../game/game';
import { SETS, TEMPLATES, rarityName, template } from '../game/items';
import { RARITY_COLOR } from '../game/model';
import { rng, useGame } from '../store/game';
import { toast } from '../store/ui';
import { runner } from './battle/runner';
import { Button } from './components/Button';
import { ChromaText } from './components/RainbowBorder';
import { feedback } from './components/feedback';
import { C } from './theme';

const SLOT_ICON = { offense: '⚔', defense: '🛡', berry: '🍒' } as const;

/** « Chromatique », « Chromatique +2 » (en arc-en-ciel à partir de +1). */
function ChromaLabel({ plus }: { plus: number }) {
  return plus ? <ChromaText plus={plus} text={`Chromatique +${plus}`} /> :<Text style={{ color: RARITY_COLOR[6], fontWeight: '900' }}>Chromatique</Text>;
}

/**
 * Onglet « Tour de Combat » de la Carte (fin de jeu, après le dernier biome) : mêmes cartes que les zones d'un biome.
 * Record et entrée (reprise au dernier palier de 10) ou sortie, prochaines récompenses, Chromatiques +N à choisir.
 */
export function TowerSection() {
  const s = useGame((g) => g.s) as GameState;
  useGame((g) => g.rev);
  const act = useGame((g) => g.act);
  const [picking, setPicking] = useState(false);
  const inTower = s.towerFloor !== null;
  const start = towerStart(s);
  const floor = s.towerFloor ?? start; // étage en cours, ou celui de la prochaine entrée
  // coffre de palier : seulement au premier passage, donc le 1er palier au-delà du record
  const nextChest = (Math.floor(s.towerBest / 10) + 1) * 10;
  return (
    <View style={{ gap: 10 }}>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.name}>🗼 Tour de Combat</Text>
          <Text style={styles.record}>Record : étage {s.towerBest}</Text>
        </View>
        <Text style={styles.sub}>
          Étages infinis contre 3 Pokémon Nv.100 aux gènes parfaits, de plus en plus forts. Chaque étage donne un Chromatique
          d'une panoplie de Sinnoh : fusionne les identiques pour monter en +N. Une défaite te ramène à ta zone, sans
          pénalité (sauf en combat continu) ; tu reprends ensuite au dernier palier de 10.
        </Text>
        {inTower ? (
          <Button label={`Quitter la Tour (étage ${s.towerFloor} en cours)`} onPress={() => { act(exitTower); runner.restart(); feedback(); }} />
        ) : (
          <Button label={`Entrer · étage ${start}`} color={C.accent} onPress={() => { act(enterTower); runner.restart(); feedback('evolve'); }} />
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.name}>{inTower ? `Étage ${floor}` : `Prochain étage : ${floor}`}</Text>
        <Text style={styles.line}>⚔ Adversaires : PV et Attaque ×{Math.round(towerWildMult(floor))}</Text>
        <Text style={styles.line}>💎 {towerShards(floor)} éclats et 1 <ChromaLabel plus={0} /> Nv.{100 + floor} (panoplies de Sinnoh)</Text>
        <Text style={styles.line}>
          🎁 Étage {nextChest} (1er passage) : <ChromaLabel plus={towerRewardPlus(nextChest)} /> de l'objet de ton choix
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={[styles.name, { flex: 1 }]}>🔁 Combat continu</Text>
          <Switch value={s.towerAuto} onValueChange={(v) => { act((g) => setTowerAuto(g, v)); feedback(); }} />
        </View>
        <Text style={styles.sub}>
          {s.towerAuto
            ? 'Une défaite ne te fait plus sortir de la Tour : tu reprends au début du palier de 10 en cours (ou du précédent si tu tombes sur son 1er étage), et ton équipe continue à grimper.'
            : 'Désactivé : une défaite te ramène à ta zone.'}
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={[styles.name, { flex: 1 }]}>🌙 Hors ligne : s'entraîner dans la Tour</Text>
          <Switch value={s.towerIdle} onValueChange={(v) => { act((g) => setTowerIdle(g, v)); feedback(); }} />
        </View>
        {s.towerIdle && s.towerBest >= 1 ? (
          <>
            <Text style={styles.sub}>
              Pendant ton absence, ton équipe rejoue un étage déjà franchi : la moitié de ses éclats et 1{' '}
              <ChromaLabel plus={0} /> Nv.{100 + towerIdleFloor(s)} tous les {TOWER_IDLE_ITEM_EVERY} étages gagnés. Désactive
              pour chasser les chromatiques et les cibles 🎯 dans ta zone.
            </Text>
            <View style={styles.row}>
              <Pressable style={styles.step} onPress={() => act((g) => setTowerIdlePick(g, towerIdleFloor(g) - 1))}><Text style={styles.stepTxt}>−</Text></Pressable>
              <Text style={styles.line}>Étage {towerIdleFloor(s)}{s.towerIdlePick === null ? ' (dernier palier)' : ''}</Text>
              <Pressable style={styles.step} onPress={() => act((g) => setTowerIdlePick(g, towerIdleFloor(g) + 1))}><Text style={styles.stepTxt}>+</Text></Pressable>
              {s.towerIdlePick !== null && (
                <Pressable style={styles.auto} onPress={() => act((g) => setTowerIdlePick(g, null))}><Text style={styles.stepTxt}>Auto</Text></Pressable>
              )}
            </View>
          </>
        ) : (
          <Text style={styles.sub}>
            {s.towerIdle ? 'Franchis au moins un étage pour que ton absence se passe dans la Tour.' : 'Ton absence farme ta zone (chromatiques, cibles 🎯).'}
          </Text>
        )}
      </View>

      {s.towerRewards.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.name}>🎁 Récompenses à choisir · {s.towerRewards.length}</Text>
          <Text style={styles.sub}>Un Chromatique par palier de 10 étages, de l'objet de ton choix.</Text>
          <Button label="Choisir" color={C.accent} onPress={() => setPicking(true)} />
        </View>
      )}
      {picking && s.towerRewards.length > 0 && <RewardPicker onClose={() => setPicking(false)} />}
    </View>
  );
}

/** Choix de l'objet d'une récompense d'étage (la plus ancienne d'abord), groupé par panoplie. */
function RewardPicker({ onClose }: { onClose: () => void }) {
  const s = useGame((g) => g.s) as GameState;
  useGame((g) => g.rev);
  const act = useGame((g) => g.act);
  const reward = s.towerRewards[0];
  if (!reward) return null;
  const sets = Object.keys(SETS).filter((id) => TEMPLATES.some((t) => t.set === id));
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.centerWrap} pointerEvents="box-none">
        <View style={styles.box}>
          <Text style={styles.title}>🎁 Étage {reward.floor} : <ChromaLabel plus={reward.plus} /> Nv.{reward.level}</Text>
          <Text style={styles.sub}>
            Choisis l'objet.{s.towerRewards.length > 1 ? ` Encore ${s.towerRewards.length - 1} après celui-ci.` : ''} Astuce : vise
            toujours le même objet pour le fusionner ensuite (3 identiques → un cran de plus).
          </Text>
          <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: 8 }}>
            {sets.map((id) => (
              <View key={id} style={{ gap: 4 }}>
                <Text style={styles.setName}>{SETS[id].name}</Text>
                <View style={styles.wrap}>
                  {TEMPLATES.filter((t) => t.set === id).map((t) => (
                    <Pressable key={t.id} style={styles.pick} onPress={() => {
                      const it = act((g) => claimTowerReward(g, 0, t.id, rng));
                      if (!it) return;
                      feedback('medal');
                      toast(`🎁 ${template(it.templateId).name} ${rarityName(it)} Nv.${it.level}`, RARITY_COLOR[it.rarity], template(it.templateId).name);
                      if (!useGame.getState().s?.towerRewards.length) onClose(); // c'était la dernière
                    }}>
                      <Text style={styles.pickTxt} numberOfLines={1}>{SLOT_ICON[t.slot]} {t.name}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
          <Button label="Plus tard" color={C.panel2} onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // mêmes cartes que les zones d'un biome (MapPanel)
  card: { backgroundColor: C.panel, borderRadius: 14, padding: 12, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  name: { color: C.text, fontWeight: '800', fontSize: 15 },
  title: { color: C.text, fontSize: 16, fontWeight: '900' },
  record: { color: C.gold, fontSize: 13, fontWeight: '800' },
  sub: { color: C.sub, fontSize: 12 },
  line: { color: C.text, fontSize: 13 },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)' },
  centerWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', padding: 20 },
  box: { backgroundColor: C.bg, borderRadius: 18, padding: 16, gap: 10, maxHeight: '88%' },
  setName: { color: C.gold, fontSize: 13, fontWeight: '800' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pick: { backgroundColor: C.panel2, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, maxWidth: '100%' },
  pickTxt: { color: C.text, fontSize: 12, fontWeight: '700' },
  step: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.panel2, alignItems: 'center', justifyContent: 'center' },
  auto: { paddingHorizontal: 12, height: 34, borderRadius: 17, backgroundColor: C.panel2, alignItems: 'center', justifyContent: 'center' },
  stepTxt: { color: C.text, fontSize: 15, fontWeight: '800' },
});
