import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { PENSION_CAP_MS, SHARDS_PER_MIN, assignExploration, explorationReady, explorationSlots, harvestExploration, removeExploration } from '../../game/game';
import { AURA } from '../../game/talents';
import { monStars, primaryType } from '../../game/stats';
import { useGame } from '../../store/game';
import { toast } from '../../store/ui';
import { Button } from '../components/Button';
import { MonThumb } from '../components/MonThumb';
import { Stars } from '../components/Stars';
import { feedback } from '../components/feedback';
import { monName } from '../helpers';
import { C } from '../theme';
import { useFrameClock } from '../useFrameClock';

function fmt(ms: number) {
  const m = Math.max(0, Math.ceil(ms / 60000));
  return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}` : `${m} min`;
}

export function ExplorationPanel() {
  const s = useGame((g) => g.s)!;
  useGame((g) => g.rev);
  const act = useGame((g) => g.act);
  const now = useFrameClock(1);
  const [pick, setPick] = useState(false);
  const ready = explorationReady(s, now);
  const free = Object.values(s.mons)
    .filter((m) => !s.team.includes(m.uid) && !s.exploration.some((p) => p.uid === m.uid) && !s.pension.some((p) => p.uid === m.uid))
    .sort((a, b) => monStars(b) - monStars(a)); // les Pokémon à fort potentiel (étoiles) en avant
  const starsOf = (uid: string) => (s.mons[uid] ? monStars(s.mons[uid]) : 0);
  const posted = [...s.exploration].sort((a, b) => starsOf(b.uid) - starsOf(a.uid));

  return (
    <View style={{ gap: 10 }}>
      <Text style={styles.hint}>
        Les Pokémon explorent ici ! (8 h max) et
        rapportent {SHARDS_PER_MIN} éclats/min ({SHARDS_PER_MIN * 60}/h).
      </Text>
      <Button label={ready ? `Récolter (+${ready} éclats)` : 'Rien à récolter pour l’instant'} color={ready ? '#2e7d32' : C.panel2} disabled={!ready} onPress={() => {
        const gained = act((g) => harvestExploration(g));
        if (!gained) return;
        feedback('medal');
        toast(`+${gained} éclats`, '#69f0ae');
      }} />
      <Text style={styles.title}>Postes · {s.exploration.length}/{explorationSlots(s)}</Text>
      {posted.map((p) => {
        const m = s.mons[p.uid];
        if (!m) return null;
        const elapsed = Math.min(now - p.since, PENSION_CAP_MS);
        const readyShards = Math.floor(elapsed / 60_000) * SHARDS_PER_MIN;
        const full = now - p.since >= PENSION_CAP_MS;
        const aura = AURA[primaryType(m.speciesId)];
        return (
          <View key={p.uid} style={styles.card}>
            <MonThumb speciesId={m.speciesId} shiny={m.shiny} size={46} />
            <View style={{ flex: 1 }}>
              <View style={styles.row}>
                <Text style={styles.name}>{monName(m)}</Text>
                <Stars mon={m} />
              </View>
              <Text style={styles.sub}>{full ? 'Plein : récolte !' : `+${readyShards} éclats prêts · plein dans ${fmt(PENSION_CAP_MS - elapsed)}`}</Text>
              <Text style={styles.aura}>Aura : {aura.label} +{aura.value / 2} %</Text>
            </View>
            <Button small label="Retirer" onPress={() => act((g) => removeExploration(g, p.uid))} />
          </View>
        );
      })}
      {s.exploration.length < explorationSlots(s) && (
        <Button small label="+ Poster un Pokémon" disabled={!free.length} onPress={() => setPick(true)} />
      )}
      {!free.length && <Text style={styles.hint}>Capture d'autres Pokémon : ceux qui ne sont pas dans l'équipe (ni déjà en pension) peuvent explorer ici.</Text>}

      <Modal visible={pick} transparent animationType="slide" onRequestClose={() => setPick(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPick(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.title}>Qui envoyer explorer ?</Text>
            <FlatList
              data={free}
              keyExtractor={(m) => m.uid}
              style={{ maxHeight: 400 }}
              contentContainerStyle={{ gap: 8 }}
              initialNumToRender={12}
              windowSize={5}
              removeClippedSubviews
              renderItem={({ item: m }) => {
                const aura = AURA[primaryType(m.speciesId)];
                return (
                  <Pressable style={styles.card} onPress={() => { act((g) => assignExploration(g, m.uid)); setPick(false); feedback(); }}>
                    <MonThumb speciesId={m.speciesId} shiny={m.shiny} size={40} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{monName(m)} Nv.{m.level}</Text>
                      <Text style={styles.aura}>Aura à l'équipe : {aura.label} +{aura.value / 2} %</Text>
                    </View>
                    <Stars mon={m} />
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { color: C.text, fontSize: 15, fontWeight: '800' },
  hint: { color: C.dim, fontSize: 12 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.panel, borderRadius: 14, padding: 10 },
  name: { color: C.text, fontWeight: '800', fontSize: 14 },
  sub: { color: C.sub, fontSize: 11 },
  aura: { color: '#80cbc4', fontSize: 11 },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, paddingBottom: 30, gap: 10 },
});
