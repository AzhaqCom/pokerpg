import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BIOMES, BiomeDef, REGIONS, REGION_START, STAGES_PER_ZONE, ZoneDef } from '../../game/content';
import { species } from '../../game/data';
import { GameState, arenaAvailable, biomeAvailable, bossAvailable, canPrestige, selectStage, startPrestige, zoneHasTarget } from '../../game/game';
import { useGame } from '../../store/game';
import { Button } from '../components/Button';
import { Dialog, DialogSpec } from '../components/Dialog';
import { MonThumb } from '../components/MonThumb';
import { feedback } from '../components/feedback';
import { runner } from '../battle/runner';
import { C } from '../theme';
import { ZoneDex, zoneSpecies } from '../ZoneDex';

export function MapPanel() {
  const s = useGame((g) => g.s)!;
  useGame((g) => g.rev);
  const act = useGame((g) => g.act);
  const [openZone, setOpenZone] = useState<ZoneDef | null>(null);
  const [dialog, setDialog] = useState<DialogSpec | null>(null);
  const next = REGIONS[s.prestige + 1];
  const [sel, setSel] = useState(s.biome);
  // la Carte ne montre que les biomes de la région courante : les biomes des régions précédentes
  // (Kanto une fois en Johto) n'ont plus leur place, ceux des régions futures restent une surprise.
  const regionStart = REGION_START[s.prestige] ?? 0;
  const regionEnd = REGION_START[s.prestige + 1] ?? BIOMES.length;
  const bi = sel >= regionStart && sel < regionEnd ? sel : s.biome;
  return (
    <View style={{ gap: 12 }}>
      {/* prestige reporté (« Plus tard » sur le récap) : se lance d'ici, quand le joueur le souhaite */}
      {next && s.prestigeOffered && canPrestige(s) && (
        <Button label={`🏆 Nouveau départ à ${next.name}`} color="#ffb300" onPress={() => setDialog({
          title: `Partir pour ${next.name} ?`,
          message: 'Équipe, boîte, objets, badges et Pokédex repartent à zéro. Seuls tes bonbons et méga bonbons restent acquis.',
          primary: { label: 'Nouveau départ', onPress: () => { act((g) => startPrestige(g)); runner.paused = false; feedback('evolve'); } },
          secondary: { label: 'Annuler', onPress: () => {} },
        })} />
      )}
      <Dialog spec={dialog} onClose={() => setDialog(null)} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {BIOMES.slice(regionStart, regionEnd).map((biome, localI) => {
          const i = regionStart + localI;
          const unlocked = biomeAvailable(s, i);
          const done = s.arenaBeaten[i];
          return (
            <Pressable key={biome.name} disabled={!unlocked} onPress={() => setSel(i)}
              style={[styles.tab, i === bi && styles.tabOn, !unlocked && styles.tabLocked]}>
              <Text style={[styles.tabTxt, i === bi && styles.tabTxtOn]} numberOfLines={1}>
                {unlocked ? (done ? '✔ ' : '') : '🔒 '}{biome.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <BiomeSection biome={BIOMES[bi]} bi={bi} s={s} act={act} onOpenZone={setOpenZone} />
      <ZoneDex zone={openZone} s={s} onClose={() => setOpenZone(null)} />
    </View>
  );
}

function BiomeSection({ biome, bi, s, act, onOpenZone }: {
  biome: BiomeDef; bi: number; s: GameState; act: <T>(fn: (g: GameState) => T) => T | undefined;
  onOpenZone: (z: ZoneDef) => void;
}) {
  return (
    <View style={{ gap: 10 }}>
      {biome.zones.map((z, zi) => {
        const zoneUnlocked = s.unlocked[bi][zi] ?? 0;
        const locked = zoneUnlocked < 1;
        const ids = zoneSpecies(z);
        const dexPct = ids.length ? ids.filter((id) => s.dex.caught.includes(id)).length / ids.length : 0;
        const shinyPct = ids.length ? ids.filter((id) => s.dex.shiny.includes(id)).length / ids.length : 0;
        return (
          <View key={z.name} style={[styles.zone, locked && { opacity: 0.45 }]}>
            <Pressable disabled={locked} onPress={() => onOpenZone(z)}>
              <View style={styles.row}>
                <Text style={styles.zoneName}>{zoneHasTarget(s, bi, zi) ? '🎯 ' : ''}{z.name}</Text>
                <Text style={styles.sub}>Niv. {z.minLv}–{z.maxLv}</Text>
                {s.bossesBeaten[bi][zi] && <Text style={styles.done}>✔ boss</Text>}
              </View>
              {!locked && (
                <View style={{ gap: 3, marginTop: 2 }}>
                  <View style={styles.progRow}>
                    <Text style={styles.progLabel}>Pokédex {Math.round(dexPct * 100)}%</Text>
                    <View style={styles.progTrack}><View style={[styles.progFill, { width: `${dexPct * 100}%` }]} /></View>
                  </View>
                  <View style={styles.progRow}>
                    <Text style={styles.progLabel}>✨ {Math.round(shinyPct * 100)}%</Text>
                    <View style={styles.progTrack}><View style={[styles.progFill, styles.progFillGold, { width: `${shinyPct * 100}%` }]} /></View>
                  </View>
                </View>
              )}
            </Pressable>
            <View style={styles.row}>
              {z.pool.map(([id]) => (
                <MonThumb key={id} speciesId={id} size={30} silhouette={!s.dex.seen.includes(id)} />
              ))}
              {z.boss.joinsPool && s.bossesBeaten[bi][zi] && (
                <MonThumb key={z.boss.speciesId} speciesId={z.boss.speciesId} size={30} silhouette={!s.dex.seen.includes(z.boss.speciesId)} />
              )}
            </View>
            <View style={styles.row}>
              {Array.from({ length: STAGES_PER_ZONE }, (_, i) => i + 1).map((st) => {
                const cur = s.biome === bi && s.zone === zi && s.stage === st;
                const ok = st <= zoneUnlocked;
                return (
                  <Pressable key={st} disabled={!ok} onPress={() => { feedback(); act((g) => selectStage(g, bi, zi, st)); runner.restart(); }}
                    style={[styles.stage, ok && styles.stageOk, cur && styles.stageCur]}>
                    <Text style={styles.stageTxt}>{st}</Text>
                  </Pressable>
                );
              })}
              {!s.bossesBeaten[bi][zi] && (
                <Button small label={`Boss : ${species(z.boss.speciesId).name} Nv.${z.boss.level}`} color={bossAvailable(s, bi, zi) ? '#c62828' : C.panel2}
                  disabled={!bossAvailable(s, bi, zi)} onPress={() => { feedback('tap', true); act((g) => selectStage(g, bi, zi, STAGES_PER_ZONE, false)); runner.request('boss'); }} />
              )}
            </View>
            {s.fixedStage !== null && s.biome === bi && s.zone === zi && (
              <Text style={styles.sub}>📌 Étape fixée : {Math.min(s.fixedStage, zoneUnlocked)} (réglage « Avancer dans les étapes » désactivé)</Text>
            )}
            {!locked && !bossAvailable(s, bi, zi) && !s.bossesBeaten[bi][zi] && <Text style={styles.sub}>Termine l'étape 5 pour affronter le boss.</Text>}
          </View>
        );
      })}
      <View style={[styles.zone, !arenaAvailable(s, bi) && { opacity: 0.5 }]}>
        <Text style={styles.zoneName}>{biome.arena.name} · {biome.arena.leader} ({biome.arena.type})</Text>
        <View style={styles.row}>
          {biome.arena.team.map(([id, lv], i) => (
            <View key={i} style={{ alignItems: 'center' }}>
              <MonThumb speciesId={id} size={36} silhouette={!s.dex.seen.includes(id)} />
              <Text style={styles.sub}>Nv.{lv}</Text>
            </View>
          ))}
        </View>
        {s.arenaBeaten[bi] ? <Text style={styles.done}>✔ {biome.arena.badge} obtenu</Text> : (
          <Button label={arenaAvailable(s, bi) ? 'Défier l’arène' : 'Bats les 3 boss pour défier l’arène'} color={arenaAvailable(s, bi) ? '#ef6c00' : C.panel2}
            disabled={!arenaAvailable(s, bi)} onPress={() => { feedback('tap', true); act((g) => { g.biome = bi; }); runner.request('arena'); }} />
        )}
        <Text style={styles.sub}>Combat enchaîné : ton équipe ne récupère pas entre les Pokémon du champion.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: 8, paddingRight: 4 },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, backgroundColor: C.panel, maxWidth: 160 },
  tabOn: { backgroundColor: C.accent },
  tabLocked: { opacity: 0.4 },
  tabTxt: { color: C.sub, fontWeight: '700', fontSize: 13 },
  tabTxtOn: { color: C.text },
  zone: { backgroundColor: C.panel, borderRadius: 14, padding: 12, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  zoneName: { color: C.text, fontWeight: '800', fontSize: 15 },
  sub: { color: C.sub, fontSize: 12 },
  done: { color: '#69f0ae', fontWeight: '800', fontSize: 12 },
  stage: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.panel2, alignItems: 'center', justifyContent: 'center', opacity: 0.5 },
  stageOk: { opacity: 1 },
  stageCur: { backgroundColor: C.accent },
  stageTxt: { color: C.text, fontWeight: '800' },
  progRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  progLabel: { color: C.sub, fontSize: 10, fontWeight: '700', width: 76 },
  progTrack: { flex: 1, height: 5, backgroundColor: C.panel2, borderRadius: 3, overflow: 'hidden' },
  progFill: { height: '100%', backgroundColor: '#42a5f5' },
  progFillGold: { backgroundColor: '#ffca28' },
});
