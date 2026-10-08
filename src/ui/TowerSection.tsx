import { memo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { Text } from './components/Text';
import {
  GameState, TOWER_FOCUS_SETS, TOWER_LAUNCH_GAP, TOWER_IDLE_ITEM_EVERY, TOWER_LEVEL, claimTowerReward, enterTower, exitTower, setTowerIdle,
  setTowerIdleClimb, setTowerIdlePick, setTowerSlot, toggleTowerSet, towerIdleCapMs, towerRank, towerClimbStart, towerDropPlus, towerFocusChoices, towerIdleFloor, towerPreviewItem, towerRewardPlus, towerShards, towerStart, towerWildMult,
} from '../game/game';
import { SETS, TEMPLATES, setBonusLabel, setBonusText } from '../game/items';
import { RARITY_COLOR } from '../game/model';
import { rng, useGame } from '../store/game';
import { toast } from '../store/ui';
import { runner } from './battle/runner';
import { Button } from './components/Button';
import { itemMainText } from './components/ItemCard';
import { ChromaText } from './components/RainbowBorder';
import { feedback } from './components/feedback';
import { fmtNum, itemColor, itemDisplayName } from './helpers';
import { C } from './theme';
import { TowerReserveCard } from './TowerReserve';

const SLOT_ICON = { offense: '⚔', defense: '🛡', berry: '🍒' } as const;

/** « Chromatique », « Chromatique +2 » (en arc-en-ciel à partir de +1). */
function ChromaLabel({ plus }: { plus: number }) {
  return plus ? <ChromaText plus={plus} text={`Chromatique +${plus}`} /> :<Text style={{ color: RARITY_COLOR[6], fontWeight: '900' }}>Chromatique</Text>;
}

/**
 * Sous-onglet « Ascension » de l'onglet Tour (fin de jeu ; avant le 2026-10-08, un onglet après le dernier biome de la
 * Carte) : mêmes cartes que les zones d'un biome.
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
  // panoplies visées (1 à 3) : les Chromatiques ne tombent plus que dans celles-là (`towerDropPool`)
  const focus = (s.towerSets ?? []).filter((id) => SETS[id]);
  const slotOnly = towerRank(s, 'butinPrecis') > 0 && s.towerSlot ? ` · ${SLOT_ICON[s.towerSlot]} seulement` : ''; // Butin précis
  const dropsFrom = (focus.length > 0 ? focus.map((id) => SETS[id].name).join(', ') : 'une des 20 panoplies') + slotOnly;
  const climb = s.towerIdleClimb ?? true;
  const idleFloor = climb ? towerClimbStart(s) : towerIdleFloor(s);
  return (
    <View style={{ gap: 10 }}>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.name}>🗼 Tour de Combat</Text>
          <Text style={styles.record}>Record : étage {s.towerBest}</Text>
        </View>
        <Text style={styles.sub}>
          Étages infinis contre 3 Pokémon Nv.100 aux gènes parfaits, de plus en plus forts. Chaque étage donne un Chromatique
          de l'une des 20 panoplies du jeu, ou de tes panoplies visées, à un cran +N qui monte avec l'étage (dès l'étage
          150) : fusionne les identiques pour monter en +N. Une défaite ne te fait pas sortir : tu reprends{' '}
          {towerRank(s, 'departLance') > 0
            ? `${TOWER_LAUNCH_GAP} étages plus bas (Départ lancé, jamais sous le début du palier)`
            : 'au début du palier de 10 (ou du précédent si tu tombes sur son 1er étage)'}, et ton équipe continue à grimper.
          « Quitter la Tour » te ramène à ta zone.
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
        <Text style={styles.line}>💎 {towerShards(floor)} éclats et 1 <ChromaLabel plus={towerDropPlus(floor)} /> Nv.{100 + floor} ({dropsFrom})</Text>
        <Text style={styles.line}>
          🎁 Étage {nextChest} (1er passage) : <ChromaLabel plus={towerRewardPlus(nextChest)} /> de l'objet de ton choix
        </Text>
      </View>

      <TowerFocusCard />

      <TowerReserveCard />

      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={[styles.name, { flex: 1 }]}>🌙 Hors ligne : s'entraîner dans la Tour</Text>
          <Switch value={s.towerIdle} onValueChange={(v) => { act((g) => setTowerIdle(g, v)); feedback(); }} />
        </View>
        {s.towerIdle && s.towerBest >= 1 ? (
          <>
            {/* deux modes : ascension (record et coffres) ou étage fixe */}
            <View style={styles.wrap}>
              {([[true, '🧗 Grimper'], [false, '📌 Étage fixe']] as const).map(([on, label]) => (
                <Pressable key={label} style={[styles.pick, climb === on && styles.pickOn]}
                  onPress={() => { act((g) => setTowerIdleClimb(g, on)); feedback(); }}>
                  <Text style={[styles.pickTxt, climb === on && styles.pickTxtOn]}>{label}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.sub}>
              {climb
                ? <>Pendant ton absence, ton équipe repart de l'étage {idleFloor} et grimpe au-delà de ton record : chaque palier de
                  10 franchi pour la première fois te donne son coffre, à choisir ici au retour.</>
                : <>Pendant ton absence, ton équipe rejoue un étage déjà franchi, sans jamais le dépasser.</>}
              {' '}Par étage gagné, ses éclats ({fmtNum(towerShards(idleFloor))} à l'étage {idleFloor}), et 1{' '}
              <ChromaLabel plus={towerDropPlus(idleFloor)} /> Nv.{100 + idleFloor} tous les {TOWER_IDLE_ITEM_EVERY} étages
              gagnés. Absence comptée jusqu'à {Math.round(towerIdleCapMs(s) / 3_600_000)} h. Désactive pour chasser les
              chromatiques et les cibles 🎯 dans ta zone.
            </Text>
            {!climb && (
              <View style={styles.row}>
                <Pressable style={styles.step} onPress={() => act((g) => setTowerIdlePick(g, towerIdleFloor(g) - 1))}><Text style={styles.stepTxt}>−</Text></Pressable>
                <Text style={styles.line}>Étage {idleFloor}{s.towerIdlePick === null ? ' (dernier palier)' : ''}</Text>
                <Pressable style={styles.step} onPress={() => act((g) => setTowerIdlePick(g, towerIdleFloor(g) + 1))}><Text style={styles.stepTxt}>+</Text></Pressable>
                {s.towerIdlePick !== null && (
                  <Pressable style={styles.auto} onPress={() => act((g) => setTowerIdlePick(g, null))}><Text style={styles.stepTxt}>Auto</Text></Pressable>
                )}
              </View>
            )}
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

/**
 * Panoplies visées (2026-10-02 ; de 1 à 3 depuis le 2026-10-07) : les 20 panoplies en puces ; toucher une puce ouvre sa
 * fiche (`SetInfoModal`), d'où on la vise ou la retire. Les Chromatiques de la Tour ne tombent plus que dans leurs objets.
 * Composant à part, mémorisé, qui ne lit que la sélection : il ne se redessine pas à chaque étage (le reste de l'onglet,
 * si). Sous les puces, les bonus des panoplies choisies sont rappelés sans valeur ; les valeurs sont dans la fiche.
 */
const TowerFocusCard = memo(function TowerFocusCard() {
  const key = useGame((g) => (g.s?.towerSets ?? []).join(','));
  // Butin précis (arbre de la Tour) : emplacement choisi, `null` sans le nœud
  const slot = useGame((g) => (g.s && towerRank(g.s, 'butinPrecis') > 0 ? g.s.towerSlot ?? 'all' : null));
  const act = useGame((g) => g.act);
  const [info, setInfo] = useState<{ id: string; level: number } | null>(null);
  const focus = key ? key.split(',').filter((id) => SETS[id]) : [];
  const oneSlot = slot !== null && slot !== 'all';
  const count = (focus.length ? focus.length * 3 : 60) / (oneSlot ? 3 : 1);
  return (
    <View style={styles.card}>
      <Text style={styles.name}>🎯 Panoplies visées · {Math.min(focus.length, TOWER_FOCUS_SETS)}/{TOWER_FOCUS_SETS}</Text>
      <Text style={styles.sub}>
        {focus.length === 0
          ? 'Touche une panoplie pour voir ses objets et ses bonus, et la viser (3 au plus). Les Chromatiques de la Tour ne tomberont plus que dans leurs objets : avec 1 panoplie, 3 objets au lieu de 60 (ceux d’un seul Pokémon) ; avec 3, 9 objets pour toute l’équipe.'
          : `Chaque Chromatique de la Tour, en combat comme hors ligne, tombe dans ${focus.length === 1 ? 'cette panoplie' : `l’une de ces ${focus.length} panoplies`} : ${count} objet${count > 1 ? 's' : ''} au lieu de 60, des doublons ${Math.round(60 / count)} fois plus fréquents à fusionner.`}
      </Text>
      <View style={styles.wrap}>
        {towerFocusChoices().map((id) => {
          const on = focus.includes(id);
          return (
            <Pressable key={id} style={[styles.pick, on && styles.pickOn]} onPress={() => {
              feedback();
              // valeurs de la fiche : un Chromatique au niveau du record, figé à l'ouverture
              setInfo({ id, level: TOWER_LEVEL + (useGame.getState().s?.towerBest ?? 0) });
            }}>
              <Text style={[styles.pickTxt, on && styles.pickTxtOn]} numberOfLines={1}>{on ? '🎯 ' : ''}{SETS[id].name}</Text>
            </Pressable>
          );
        })}
      </View>
      {/* rappel des bonus des panoplies choisies, sans valeur : rien ne bouge d'un étage à l'autre */}
      {focus.map((id) => (
        <Text key={id} style={styles.setBonus}>
          {SETS[id].name} : 2 p. {setBonusLabel(id, 'two')} · 3 p. {setBonusLabel(id, 'three')}
        </Text>
      ))}
      {slot !== null && (
        <>
          <Text style={styles.name}>🎯 Butin précis</Text>
          <Text style={styles.sub}>Emplacement où tombent les Chromatiques de la Tour (les coffres restent au choix).</Text>
          <View style={styles.wrap}>
            {([['all', 'Tous'], ['offense', '⚔ Offensif'], ['defense', '🛡 Défensif'], ['berry', '🍒 Baie']] as const).map(([k, label]) => (
              <Pressable key={k} style={[styles.pick, slot === k && styles.pickOn]}
                onPress={() => { feedback(); act((g) => setTowerSlot(g, k === 'all' ? null : k)); }}>
                <Text style={[styles.pickTxt, slot === k && styles.pickTxtOn]}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
      {info && <SetInfoModal setId={info.id} level={info.level} focus={focus} onClose={() => setInfo(null)} />}
    </View>
  );
});

/** Ordre des pièces d'une panoplie : offensif, défensif, baie. */
const SLOT_ORDER = { offense: 0, defense: 1, berry: 2 } as const;

/**
 * Fiche d'une panoplie (toucher sa puce dans « Panoplies visées ») : ses 3 objets avec leur stat principale et ses bonus
 * 2 et 3 pièces, chiffrés pour un Chromatique au niveau du record (`towerPreviewItem`, comme ceux qui tombent) ; puis
 * la viser, ou la retirer.
 */
function SetInfoModal({ setId, level, focus, onClose }: { setId: string; level: number; focus: string[]; onClose: () => void }) {
  const act = useGame((g) => g.act);
  const pieces = TEMPLATES.filter((t) => t.set === setId).sort((a, b) => SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot]);
  const on = focus.includes(setId);
  const full = !on && focus.length >= TOWER_FOCUS_SETS;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.centerWrap} pointerEvents="box-none">
        <View style={styles.box}>
          <Text style={styles.title}>🎒 {SETS[setId].name}</Text>
          {pieces.map((t) => (
            <View key={t.id}>
              <Text style={styles.pieceName}>{SLOT_ICON[t.slot]} {t.name}</Text>
              <Text style={styles.pieceStat}>{itemMainText(towerPreviewItem(t.id, level))}</Text>
            </View>
          ))}
          <Text style={styles.setBonus}>2 pièces : {setBonusText(setId, 'two', level)}</Text>
          <Text style={styles.setBonus}>3 pièces : {setBonusText(setId, 'three', level)}</Text>
          <Text style={styles.sub}>
            Valeurs pour un Chromatique Nv.{level} (Nv.100 + ton record) : elles grimpent avec le niveau des objets, et les
            bonus de panoplie avec celui de la pièce la plus basse portée.
          </Text>
          {full ? (
            <Button label="3 panoplies déjà visées : retires-en une d’abord" disabled onPress={() => {}} />
          ) : (
            <Button label={on ? 'Ne plus la viser' : '🎯 Viser cette panoplie'} color={on ? C.panel2 : C.accent}
              onPress={() => { if (act((g) => toggleTowerSet(g, setId))) { feedback(); onClose(); } }} />
          )}
          <Button label="Fermer" color={C.panel2} onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

/** Choix de l'objet d'une récompense d'étage (la plus ancienne d'abord), groupé par panoplie. */
function RewardPicker({ onClose }: { onClose: () => void }) {
  const s = useGame((g) => g.s) as GameState;
  useGame((g) => g.rev);
  const act = useGame((g) => g.act);
  const reward = s.towerRewards[0];
  if (!reward) return null;
  const sets = towerFocusChoices(); // les 20 panoplies, comme les panoplies visées
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
                      // « 🎁 Cape du Vainqueur +2 Nv.150 », à la couleur du cran (comme le message de fusion)
                      toast(`🎁 ${itemDisplayName(it)} Nv.${it.level}`, itemColor(it), itemDisplayName(it));
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
  pickOn: { backgroundColor: C.accent },
  pickTxtOn: { fontWeight: '900' },
  setBonus: { color: '#ffcc80', fontSize: 11, fontWeight: '700' },
  pieceName: { color: C.text, fontSize: 13, fontWeight: '800' },
  pieceStat: { color: C.sub, fontSize: 12, fontWeight: '600' },
  step: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.panel2, alignItems: 'center', justifyContent: 'center' },
  auto: { paddingHorizontal: 12, height: 34, borderRadius: 17, backgroundColor: C.panel2, alignItems: 'center', justifyContent: 'center' },
  stepTxt: { color: C.text, fontSize: 15, fontWeight: '800' },
});
