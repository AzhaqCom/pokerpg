import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PENSION_CAP_MS, SHARDS_PER_MIN, assignExploration, explorationReady, explorationSlots, harvestExploration, removeExploration } from '../../game/game';
import { monStars } from '../../game/stats';
import { useGame } from '../../store/game';
import { toast } from '../../store/ui';
import { Button } from '../components/Button';
import { MonThumb } from '../components/MonThumb';
import { Stars } from '../components/Stars';
import { feedback } from '../components/feedback';
import { auraDisplay, monName } from '../helpers';
import { species } from '../../game/data';
import { AURA } from '../../game/talents';
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
  const [auraFilter, setAuraFilter] = useState<string | null>(null);
  const ready = explorationReady(s, now);
  const free = Object.values(s.mons)
    .filter((m) => !s.team.includes(m.uid) && !s.exploration.some((p) => p.uid === m.uid) && !s.pension.some((p) => p.uid === m.uid))
    .sort((a, b) => monStars(b) - monStars(a)); // les Pokémon à fort potentiel (étoiles) en avant
  /** Auras (Vitesse, PV, Critique…) que donnent les Pokémon disponibles : sert de filtre dans le sélecteur. */
  const auraLabels = useMemo(() => {
    const present = new Set<string>();
    for (const m of free) for (const t of species(m.speciesId).types) present.add(AURA[t].label);
    return [...present].sort();
  }, [free.length]);
  const activeAura = auraFilter && auraLabels.includes(auraFilter) ? auraFilter : null;
  const shown = activeAura ? free.filter((m) => species(m.speciesId).types.some((t) => AURA[t].label === activeAura)) : free;
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
      {s.exploration.length < explorationSlots(s) && (
        <Button small label="+ Poster un Pokémon" disabled={!free.length} onPress={() => setPick(true)} />
      )}
      {!free.length && <Text style={styles.hint}>Capture d'autres Pokémon : ceux qui ne sont pas dans l'équipe (ni déjà en pension) peuvent explorer ici.</Text>}
      {posted.map((p) => {
        const m = s.mons[p.uid];
        if (!m) return null;
        const elapsed = Math.min(now - p.since, PENSION_CAP_MS);
        const readyShards = Math.floor(elapsed / 60_000) * SHARDS_PER_MIN;
        const full = now - p.since >= PENSION_CAP_MS;
        const auras = auraDisplay(m.speciesId, 0.5);
        return (
          <View key={p.uid} style={styles.card}>
            <MonThumb speciesId={m.speciesId} shiny={m.shiny} size={46} />
            <View style={{ flex: 1 }}>
              <View style={styles.row}>
                <Text style={styles.name}>{monName(m)}</Text>
                <Stars mon={m} />
              </View>
              <Text style={styles.sub}>{full ? 'Plein : récolte !' : `+${readyShards} éclats prêts · plein dans ${fmt(PENSION_CAP_MS - elapsed)}`}</Text>
              <Text style={styles.aura}>Aura : {auras.map((a) => `${a.label} +${a.value} %`).join(' · ')}</Text>
            </View>
            <Button small label="Retirer" onPress={() => act((g) => removeExploration(g, p.uid))} />
          </View>
        );
      })}

      <Modal visible={pick} transparent animationType="slide" onRequestClose={() => setPick(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPick(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.title}>Qui envoyer explorer ? <Text style={styles.sub}>({explorationSlots(s) - s.exploration.length} place{explorationSlots(s) - s.exploration.length > 1 ? 's' : ''} libre{explorationSlots(s) - s.exploration.length > 1 ? 's' : ''})</Text></Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} style={{ flexGrow: 0 }}>
              <Pressable onPress={() => setAuraFilter(null)} style={[styles.chip, !activeAura && styles.chipOn]}>
                <Text style={styles.chipTxt}>Toutes les auras</Text>
              </Pressable>
              {auraLabels.map((l) => (
                <Pressable key={l} onPress={() => setAuraFilter(activeAura === l ? null : l)} style={[styles.chip, activeAura === l && styles.chipOn]}>
                  <Text style={styles.chipTxt}>{l}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <FlatList
              data={shown}
              keyExtractor={(m) => m.uid}
              style={{ maxHeight: 400 }}
              contentContainerStyle={{ gap: 8 }}
              initialNumToRender={12}
              windowSize={5}
              removeClippedSubviews
              renderItem={({ item: m }) => {
                const auras = auraDisplay(m.speciesId, 0.5);
                return (
                  <Pressable style={styles.card} onPress={() => {
                    // la fenêtre reste ouverte tant qu'il reste une place libre
                    const full = act((g) => { assignExploration(g, m.uid); return g.exploration.length >= explorationSlots(g); });
                    if (full) setPick(false);
                    feedback();
                  }}>
                    <MonThumb speciesId={m.speciesId} shiny={m.shiny} size={40} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{monName(m)} Nv.{m.level}</Text>
                      <Text style={styles.aura}>Aura à l'équipe : {auras.map((a) => `${a.label} +${a.value} %`).join(' · ')}</Text>
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
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: C.panel },
  chipOn: { backgroundColor: C.accent },
  chipTxt: { color: C.text, fontWeight: '700', fontSize: 12 },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, paddingBottom: 30, gap: 10 },
});
