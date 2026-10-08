import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Text } from './components/Text';
import { species } from '../game/data';
import { GameState, TOWER_RESERVE_HP, monPower, setTowerReserve, towerRank, towerReserve } from '../game/game';
import { useGame } from '../store/game';
import { useUi } from '../store/ui';
import { runner } from './battle/runner';
import { Button } from './components/Button';
import { ModalBackdrop } from './components/ModalBackdrop';
import { MonThumb } from './components/MonThumb';
import { feedback } from './components/feedback';
import { cpColor } from './helpers';
import { C } from './theme';

/**
 * Carte « 🔄 Relève » du sous-onglet Ascension (arbre de la Tour, 2026-10-08) : la réserve choisie (toucher sa vignette
 * ouvre sa fiche, pour l'équiper), « Choisir » ouvre la liste de la boîte hors équipe, triée par PC.
 */
export function TowerReserveCard() {
  const s = useGame((g) => g.s) as GameState;
  useGame((g) => g.rev);
  const act = useGame((g) => g.act);
  const [picking, setPicking] = useState(false);
  if (towerRank(s, 'releve') < 1) return null;
  const uid = towerReserve(s);
  const mon = uid ? s.mons[uid] : null;
  const veteran = towerRank(s, 'releveAguerrie') > 0;
  const cp = uid ? monPower(s, uid) : 0;
  const restart = () => { if (s.towerFloor !== null) runner.restart(); };
  return (
    <View style={styles.card}>
      <Text style={styles.name}>🔄 Relève</Text>
      <Text style={styles.sub}>
        Au premier K.O. d'un équipier, ta réserve entre à sa place (devant si c'est le Pokémon de devant qui tombe) avec{' '}
        {veteran ? 'tous ses PV, et son aura compte pour l’équipe dès le début' : `${Math.round(TOWER_RESERVE_HP * 100)} % de ses PV`}.
        Une fois par étage, en combat comme hors ligne. Elle garde ses objets et ne peut pas être relâchée.
      </Text>
      {mon ? (
        <Pressable style={styles.row} onPress={() => { feedback(); useUi.getState().openMon(uid!); }}>
          <MonThumb speciesId={mon.speciesId} shiny={mon.shiny} size={44} />
          <View style={{ flex: 1 }}>
            <Text style={styles.monName}>{species(mon.speciesId).name}{mon.shiny ? ' ✨' : ''} · Nv.{mon.level}</Text>
            <Text style={[styles.cp, { color: cpColor(cp) }]}>PC {cp} · toucher pour sa fiche</Text>
          </View>
        </Pressable>
      ) : (
        <Text style={styles.line}>Aucune réserve choisie.</Text>
      )}
      <View style={styles.buttons}>
        <Button small label={mon ? 'Changer' : 'Choisir'} color={C.accent} onPress={() => { feedback(); setPicking(true); }} />
        {mon && <Button small label="Retirer" onPress={() => { act((g) => setTowerReserve(g, null)); feedback(); restart(); }} />}
      </View>
      {picking && (
        <ReservePicker current={uid} onClose={() => setPicking(false)}
          onPick={(u) => { act((g) => setTowerReserve(g, u)); feedback(); setPicking(false); restart(); }} />
      )}
    </View>
  );
}

function ReservePicker({ current, onPick, onClose }: { current: string | null; onPick: (uid: string) => void; onClose: () => void }) {
  const s = useGame((g) => g.s) as GameState;
  // calculé une fois à l'ouverture : toute la boîte hors équipe, du plus fort au plus faible
  const list = useMemo(() => Object.values(s.mons)
    .filter((m) => !s.team.includes(m.uid))
    .map((m) => ({ m, cp: monPower(s, m.uid) }))
    .sort((a, b) => b.cp - a.cp), [s]);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <ModalBackdrop style={styles.backdrop} onClose={onClose}>
        <View style={styles.box}>
          <Text style={styles.title}>🔄 Choisir la réserve</Text>
          <FlatList data={list} keyExtractor={(x) => x.m.uid} initialNumToRender={12} style={{ flexGrow: 0 }}
            ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
            renderItem={({ item: { m, cp } }) => (
              <Pressable style={[styles.pick, m.uid === current && styles.pickOn]} onPress={() => onPick(m.uid)}>
                <MonThumb speciesId={m.speciesId} shiny={m.shiny} size={36} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.monName}>{species(m.speciesId).name}{m.shiny ? ' ✨' : ''} · Nv.{m.level}</Text>
                  <Text style={[styles.cp, { color: cpColor(cp) }]}>PC {cp}</Text>
                </View>
              </Pressable>
            )} />
          <Button label="Fermer" color={C.panel2} onPress={onClose} />
        </View>
      </ModalBackdrop>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: C.panel, borderRadius: 14, padding: 12, gap: 8 },
  name: { color: C.text, fontWeight: '800', fontSize: 15 },
  title: { color: C.text, fontSize: 16, fontWeight: '900' },
  sub: { color: C.sub, fontSize: 12 },
  line: { color: C.text, fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.panel2, borderRadius: 12, padding: 8 },
  monName: { color: C.text, fontSize: 13, fontWeight: '800' },
  cp: { fontSize: 12, fontWeight: '700' },
  buttons: { flexDirection: 'row', gap: 8 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 },
  box: { backgroundColor: C.bg, borderRadius: 18, padding: 16, gap: 10, maxHeight: '88%' },
  pick: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.panel2, borderRadius: 10, padding: 6 },
  pickOn: { borderWidth: 1, borderColor: C.accent },
});
