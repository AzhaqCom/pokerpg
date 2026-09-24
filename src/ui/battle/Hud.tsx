import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { BIOMES, STAGES_PER_ZONE, regionLastBiome, regionOf } from '../../game/content';
import { species } from '../../game/data';
import { addMon, arenaAvailable, bossAvailable, equip, makeMon, setAutoAdvance, setTeam, toggleTarget } from '../../game/game';
import { makeItem } from '../../game/items';
import { RARITIES, RARITY_COLOR } from '../../game/model';
import { rng, useGame } from '../../store/game';
import { useSettings } from '../../store/settings';
import { Button } from '../components/Button';
import { Dialog, DialogSpec } from '../components/Dialog';
import { feedback } from '../components/feedback';
import { HelpScreen } from '../HelpScreen';
import { C } from '../theme';
import { useFrameClock } from '../useFrameClock';
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

/** Sous le combat : raccourci boss/arène (la capture est en overlay sur le combat, voir BattleView). */
export function HudBottom() {
  useFrameClock(4);
  const s = useGame((g) => g.s)!;
  const run = runner.run;
  const canBoss = bossAvailable(s) && !s.bossesBeaten[s.biome][s.zone] && run?.kind !== 'boss';
  const canArena = arenaAvailable(s) && !s.arenaBeaten[s.biome] && run?.kind !== 'arena';
  return (
    <View style={{ gap: 6 }}>
      {(canBoss || canArena) && (
        <View style={styles.row}>
          {canBoss && <Button small label={`⚔ Défier le boss : ${species(BIOMES[s.biome].zones[s.zone].boss.speciesId).name}`} color="#c62828" style={{ flex: 1 }}
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
  const s = useGame((g) => g.s)!;
  useGame((g) => g.rev);
  const reset = useGame((g) => g.reset);
  const act = useGame((g) => g.act);
  const [dialog, setDialog] = useState<DialogSpec | null>(null);
  const [help, setHelp] = useState(false);
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
          <Button small label="❔ Aide : auras & talents par type" onPress={() => setHelp(true)} />
          <HelpScreen open={help} onClose={() => setHelp(false)} />
          <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: 12 }}>
            <Section title="🔊 Son et écran" />
            <Row label="Sons" value={st.sound} onChange={(v) => st.set({ sound: v })} />
            <Row label="Musique" value={st.music} onChange={(v) => st.set({ music: v })} />
            <Row label="Vibrations" value={st.haptics} onChange={(v) => st.set({ haptics: v })} />
            <Row label="Garder l'écran allumé" value={st.keepAwake} onChange={(v) => st.set({ keepAwake: v })} />

            <Section title="⚔️ Combat" />
            <Row label="Avancer dans les étapes" value={s.fixedStage === null} onChange={(v) => act((g) => setAutoAdvance(g, v))} />

            <Section title="⚪ Capture" />
            <Row label="Capturer automatiquement les Pokémon manquants" value={st.autoCapture} onChange={(v) => st.set({ autoCapture: v })} />
            {st.autoCapture && (
              <Row sub label="Essayer d'améliorer les Pokémon sous 3★" value={st.autoCaptureUpgrade} onChange={(v) => st.set({ autoCaptureUpgrade: v })} />
            )}
            {(st.autoCapture || s.targets.length > 0) && (
              <Row label="Toujours utiliser la meilleure Ball" value={st.autoCaptureBestBall} onChange={(v) => st.set({ autoCaptureBestBall: v })} />
            )}
            <Row label="Ne pas proposer un Pokémon déjà possédé (3★+)" value={st.hideOwnedOffers} onChange={(v) => st.set({ hideOwnedOffers: v })} />
            <Row label="Ne pas capturer un chromatique déjà obtenu" value={st.skipOwnedShiny} onChange={(v) => st.set({ skipOwnedShiny: v })} />

            <Section title="🎯 Cibles" />
            <Row label="Convertir les cibles en bonbons" value={st.convertTargets} onChange={(v) => st.set({ convertTargets: v })} />
            {s.targets.length ? (
              <View style={styles.chipsRow}>
                {s.targets.map((base) => (
                  <Pressable key={base} onPress={() => { feedback(); act((g) => toggleTarget(g, base)); }} style={styles.chip}>
                    <Text style={styles.chipTxt}>{species(base).name} ✕</Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text style={styles.hint}>Aucune cible : utilise 🎯 dans la fiche d'un Pokémon.</Text>
            )}

            <Section title="📦 Boîte et objets" />
            <Row label="Collectionneur hardcore" value={st.keepEvolutionMaterial} onChange={(v) => st.set({ keepEvolutionMaterial: v })} />
            <View style={{ gap: 6 }}>
              <Text style={styles.setLabel}>Recycler : jusqu'à</Text>
              <View style={styles.chipsRow}>
                {RARITIES.map((name, i) => (
                  <Pressable key={name} onPress={() => st.set({ recycleMaxRarity: i })}
                    style={[styles.chip, st.recycleMaxRarity === i && { backgroundColor: RARITY_COLOR[i] }]}>
                    <Text style={styles.chipTxt}>{name}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <Row label="Recycler auto hors ligne" value={st.idleAutoRecycle} onChange={(v) => st.set({ idleAutoRecycle: v })} />
            {st.idleAutoRecycle && (
              <View style={{ gap: 6, paddingLeft: 14 }}>
                <Text style={styles.setLabel}>↳ Recyclage hors ligne : jusqu'à</Text>
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
            {__DEV__ && (
              <Button label="🐛 Debug : Pokédex complet, plus que le Champion à battre (test écran de fin)" color="#37474f" onPress={() => {
                act((g) => {
                  const max = regionOf(g.prestige).dexMax;
                  for (let id = 1; id <= max; id++) if (!g.dex.seen.includes(id)) g.dex.seen.push(id);
                  const team = [6, 9, 65].map((id) => makeMon(id, 100, rng, false, 15));
                  for (const m of team) {
                    addMon(g, m);
                    for (const templateId of ['gantelet-champion', 'cape-champion', 'baie-champion']) {
                      const item = makeItem(templateId, 6, 100, rng);
                      g.items[item.uid] = item;
                      equip(g, m.uid, item.uid);
                    }
                  }
                  setTeam(g, team.map((m) => m.uid));
                  g.badges = 8; // Conseil des 4 ne compte pas comme un badge
                  const base = regionOf(g.prestige).start;
                  const last = regionLastBiome(g.prestige);
                  for (let i = base; i < last; i++) {
                    g.arenaBeaten[i] = true;
                    g.bossesBeaten[i] = g.bossesBeaten[i].map(() => true);
                    g.unlocked[i] = g.unlocked[i].map(() => 5);
                  }
                  // dernier biome de la région entièrement dégagé : ne reste que le Champion à défier
                  g.bossesBeaten[last] = g.bossesBeaten[last].map(() => true);
                  g.unlocked[last] = g.unlocked[last].map(() => 5);
                  g.biome = last; g.zone = 2; g.stage = 5;
                });
                runner.restart();
                feedback();
              }} />
            )}
            <Button label="Nouvelle partie" color="#5a2020" onPress={() => setDialog({
              title: 'Tout effacer ?', message: 'Équipe, objets, Pokédex et progression seront perdus.',
              primary: { label: 'Tout effacer', onPress: async () => { await reset(); runner.restart(); onClose(); } },
              secondary: { label: 'Annuler', onPress: () => { } },
            })} />
            <Text style={styles.credits}>
              Développer par Azhaq et Claude.{'\n'}
              Sprites : PMD Sprite Collaboration (CC BY-NC 4.0). Données : PokéAPI.
              {'\n'}
              Je t'aime Lia 💖
            </Text>
          </ScrollView>
          <Button label="Fermer" onPress={onClose} />
        </View>
      </View>
      <Dialog spec={dialog} onClose={() => setDialog(null)} />
    </Modal>
  );
}

function Section({ title }: { title: string }) {
  return <Text style={styles.section}>{title}</Text>;
}

/** `sub` : option qui dépend de celle du dessus (décalée, préfixée par ↳). */
function Row({ label, value, onChange, sub }: { label: string; value: boolean; onChange: (v: boolean) => void; sub?: boolean }) {
  return (
    <View style={[styles.setRow, sub && { paddingLeft: 14 }]}>
      <Text style={styles.setLabel}>{sub ? `↳ ${label}` : label}</Text>
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
  section: { color: C.sub, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 6,
    borderBottomWidth: 1, borderBottomColor: C.line, paddingBottom: 4 },
  hint: { color: C.dim, fontSize: 12 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { backgroundColor: C.panel2, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  chipTxt: { color: C.text, fontSize: 12, fontWeight: '700' },
  credits: { color: C.dim, fontSize: 11, lineHeight: 16 },
});
