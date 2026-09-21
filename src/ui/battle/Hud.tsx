import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { BIOMES, STAGES_PER_ZONE } from '../../game/content';
import { arenaAvailable, bossAvailable } from '../../game/game';
import { RARITIES, RARITY_COLOR } from '../../game/model';
import { useGame } from '../../store/game';
import { useSettings } from '../../store/settings';
import { Button } from '../components/Button';
import { Dialog, DialogSpec } from '../components/Dialog';
import { feedback } from '../components/feedback';
import { C } from '../theme';
import { useFrameClock } from '../useFrameClock';
import { CaptureBar } from './CaptureBar';
import { runner } from './runner';

/** Bandeau au-dessus du combat : où l'on est, boss à lancer, vitesse, réglages. */
export function HudTop() {
  useFrameClock(4);
  const s = useGame((g) => g.s)!;
  const settings = useSettings();
  const [open, setOpen] = useState(false);
  const run = runner.run;
  const biome = BIOMES[s.biome];
  const zone = biome.zones[s.zone];
  const label = run?.kind === 'arena' ? `${biome.arena.name}` : run?.kind === 'boss' ? `${zone.name} · Boss` : `${zone.name} · Étape ${s.stage}/${STAGES_PER_ZONE}`;
  const wave = run ? `Vague ${run.waveIndex + 1}/${run.waves.length}` : '';
  return (
    <View style={styles.top}>
      <View style={{ flex: 1 }}>
        <Text style={styles.zone} numberOfLines={1}>{label}</Text>
        <Text style={styles.wave}>{wave}</Text>
      </View>
      {s.badges > 0 && (
        <Pressable onPress={() => settings.set({ fast: !settings.fast })} style={[styles.speed, settings.fast && styles.speedOn]}>
          <Text style={styles.speedTxt}>×{settings.fast ? 2 : 1}</Text>
        </Pressable>
      )}
      <Pressable onPress={() => setOpen(true)} hitSlop={10}><Text style={styles.gear}>⚙</Text></Pressable>
      <SettingsModal open={open} onClose={() => setOpen(false)} />
    </View>
  );
}

/** Sous le combat : capture et raccourci boss/arène. */
export function HudBottom() {
  useFrameClock(4);
  const s = useGame((g) => g.s)!;
  const run = runner.run;
  const zoneBoss = BIOMES[s.biome].zones[s.zone].boss;
  const canBoss = bossAvailable(s) && (zoneBoss.repeatable || !s.bossesBeaten[s.biome][s.zone]) && run?.kind !== 'boss';
  const canArena = arenaAvailable(s) && !s.arenaBeaten[s.biome] && run?.kind !== 'arena';
  return (
    <View style={{ gap: 6 }}>
      <CaptureBar />
      {(canBoss || canArena) && (
        <View style={styles.row}>
          {canBoss && <Button small label={`⚔ Défier le boss : ${BIOMES[s.biome].zones[s.zone].boss.title}`} color="#c62828" style={{ flex: 1 }}
            onPress={() => { feedback('tap', true); runner.request('boss'); }} />}
          {canArena && <Button small label={`🏟 Défier ${BIOMES[s.biome].arena.leader}`} color="#ef6c00" style={{ flex: 1 }}
            onPress={() => { feedback('tap', true); runner.request('arena'); }} />}
        </View>
      )}
    </View>
  );
}

function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const st = useSettings();
  const reset = useGame((g) => g.reset);
  const [dialog, setDialog] = useState<DialogSpec | null>(null);
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      {/* Fond et boîte en calques superposés (pas un Pressable imbriqué dans un autre) : un tap sur le
          fond ferme le menu, un tap sur la boîte est simplement bloqué par superposition — contrairement
          à un Pressable parent qui capterait le toucher dès le contact et empêcherait la ScrollView de
          détecter un geste de défilement démarré sur du texte brut (non protégé comme les boutons/switches). */}
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.centerWrap} pointerEvents="box-none">
        <View style={styles.box}>
          <Text style={styles.title}>Réglages</Text>
          <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: 12 }}>
            <Row label="Sons" value={st.sound} onChange={(v) => st.set({ sound: v })} />
            <Row label="Musique" value={st.music} onChange={(v) => st.set({ music: v })} />
            <Row label="Vibrations" value={st.haptics} onChange={(v) => st.set({ haptics: v })} />
            <Row label="Capturer automatiquement les Pokémon manquants" value={st.autoCapture} onChange={(v) => st.set({ autoCapture: v })} />
            {st.autoCapture && (
              <>
                <Row label="Toujours utiliser la meilleure Ball" value={st.autoCaptureBestBall} onChange={(v) => st.set({ autoCaptureBestBall: v })} />
                <Row label="Essayer d'améliorer les Pokémon sous 3★" value={st.autoCaptureUpgrade} onChange={(v) => st.set({ autoCaptureUpgrade: v })} />
              </>
            )}
            <Row label="Ne pas proposer un Pokémon déjà possédé (3★+)" value={st.hideOwnedOffers} onChange={(v) => st.set({ hideOwnedOffers: v })} />
            <View style={{ gap: 6 }}>
              <Text style={styles.setLabel}>Recyclage groupé du Sac (Sac → Recycler) : jusqu'à</Text>
              <View style={styles.chipsRow}>
                {RARITIES.map((name, i) => (
                  <Pressable key={name} onPress={() => st.set({ recycleMaxRarity: i })}
                    style={[styles.chip, st.recycleMaxRarity === i && { backgroundColor: RARITY_COLOR[i] }]}>
                    <Text style={styles.chipTxt}>{name}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <Row label="Recycler auto les objets trouvés hors ligne" value={st.idleAutoRecycle} onChange={(v) => st.set({ idleAutoRecycle: v })} />
            {st.idleAutoRecycle && (
              <View style={{ gap: 6 }}>
                <Text style={styles.setLabel}>Recyclage hors ligne : jusqu'à</Text>
                <View style={styles.chipsRow}>
                  {RARITIES.map((name, i) => (
                    <Pressable key={name} onPress={() => st.set({ idleRecycleMaxRarity: i })}
                      style={[styles.chip, st.idleRecycleMaxRarity === i && { backgroundColor: RARITY_COLOR[i] }]}>
                      <Text style={styles.chipTxt}>{name}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
            <Button label="Nouvelle partie" color="#5a2020" onPress={() => setDialog({
              title: 'Tout effacer ?', message: 'Équipe, objets, Pokédex et progression seront perdus.',
              primary: { label: 'Tout effacer', onPress: async () => { await reset(); runner.restart(); onClose(); } },
              secondary: { label: 'Annuler', onPress: () => {} },
            })} />
            <Text style={styles.credits}>
              Projet personnel non commercial. Sprites : PMD Sprite Collaboration (CC BY-NC 4.0). Données : PokéAPI.
              Pokémon © Nintendo / Game Freak / The Pokémon Company.
            </Text>
          </ScrollView>
          <Button label="Fermer" onPress={onClose} />
        </View>
      </View>
      <Dialog spec={dialog} onClose={() => setDialog(null)} />
    </Modal>
  );
}

function Row({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.setRow}>
      <Text style={styles.setLabel}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: C.accent, false: C.line }} thumbColor="#fff" />
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 6 },
  zone: { color: C.text, fontWeight: '900', fontSize: 16 },
  wave: { color: C.sub, fontSize: 12, fontWeight: '600' },
  speed: { backgroundColor: C.panel, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  speedOn: { backgroundColor: '#ef6c00' },
  speedTxt: { color: '#fff', fontWeight: '900' },
  gear: { color: C.sub, fontSize: 22 },
  row: { flexDirection: 'row', gap: 8, paddingHorizontal: 10 },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)' },
  centerWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', padding: 24 },
  box: { backgroundColor: C.panel, borderRadius: 18, padding: 18, gap: 12, maxHeight: '85%' },
  title: { color: C.text, fontSize: 20, fontWeight: '900' },
  setRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  setLabel: { color: C.text, fontSize: 15, flex: 1 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { backgroundColor: C.panel2, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  chipTxt: { color: C.text, fontSize: 12, fontWeight: '700' },
  credits: { color: C.dim, fontSize: 11, lineHeight: 16 },
});
