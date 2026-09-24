import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { PType, species } from '../../game/data';
import { PENSION_CAP_MS, PENSION_XP_SHARE, assignPension, harvestPension, pensionSlots, pensionXpReady, removePension } from '../../game/game';
import { teamXpPerHour } from '../../game/idle';
import { monStars } from '../../game/stats';
import { rng, useGame } from '../../store/game';
import { toast } from '../../store/ui';
import { Button } from '../components/Button';
import { MonThumb } from '../components/MonThumb';
import { Stars } from '../components/Stars';
import { feedback } from '../components/feedback';
import { TYPE_COLOR, monName, textOn, typeLabel, xpProgress } from '../helpers';
import { C } from '../theme';
import { useFrameClock } from '../useFrameClock';

function fmt(ms: number) {
  const m = Math.max(0, Math.ceil(ms / 60000));
  return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}` : `${m} min`;
}

export function PensionPanel() {
  const s = useGame((g) => g.s)!;
  useGame((g) => g.rev);
  const act = useGame((g) => g.act);
  const now = useFrameClock(1);
  const [pick, setPick] = useState(false);
  const [minStars, setMinStars] = useState(0);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<PType | null>(null);
  const ready = pensionXpReady(s, now);
  const candidates = Object.values(s.mons)
    .filter((m) => !s.team.includes(m.uid) && !s.pension.some((p) => p.uid === m.uid) && !s.exploration.some((p) => p.uid === m.uid));
  /** Types présents parmi les Pokémon disponibles (un bi-type compte pour ses deux types), dans l'ordre habituel. */
  const candTypes = useMemo(() => {
    const present = new Set<PType>();
    for (const m of candidates) for (const t of species(m.speciesId).types) present.add(t);
    return (Object.keys(TYPE_COLOR) as PType[]).filter((t) => present.has(t));
  }, [candidates.length, s.mons]);
  const activeType = typeFilter && candTypes.includes(typeFilter) ? typeFilter : null;
  const free = candidates
    .filter((m) => monStars(m) >= minStars && (!activeType || species(m.speciesId).types.includes(activeType))
      && (!query.trim() || monName(m).toLowerCase().startsWith(query.trim().toLowerCase())))
    .sort((a, b) => a.speciesId - b.speciesId);
  // les postes en cours suivent le même ordre : meilleur potentiel d'abord
  const starsOf = (uid: string) => (s.mons[uid] ? monStars(s.mons[uid]) : 0);
  const posted = [...s.pension].sort((a, b) => starsOf(b.uid) - starsOf(a.uid));

  /** Taux offert à un nouveau posté : une part de ce que l'équipe actuelle encaisse par heure au combat. */
  const nextRate = () => {
    const rates = teamXpPerHour(s, rng);
    const values = Object.values(rates);
    const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    return Math.round(avg * PENSION_XP_SHARE);
  };

  return (
    <View style={{ gap: 10 }}>
      <Text style={styles.hint}>
        Les Pokémon gagnent de l'XP passive
        (8 h max) — ({Math.round(PENSION_XP_SHARE * 100)} % de ce que l'équipe gagne au combat)
       
      </Text>
      <Button label={ready ? `Récolter (+${ready} XP)` : 'Rien à récolter pour l’instant'} color={ready ? '#2e7d32' : C.panel2} disabled={!ready} onPress={() => {
        const h = act((g) => harvestPension(g, nextRate()));
        if (!h || !h.gains.length) return;
        feedback('level');
        const totalXp = h.gains.reduce((a, g) => a + g.xp, 0);
        const levels = h.gains.reduce((a, g) => a + g.levels, 0);
        toast(`+${totalXp} XP${levels ? ` · ${levels} niveau${levels > 1 ? 'x' : ''} gagné${levels > 1 ? 's' : ''}` : ''}`, '#69f0ae');
      }} />
      <Text style={styles.title}>Pension · {s.pension.length}/{pensionSlots(s)}</Text>
      {s.pension.length < pensionSlots(s) && (
        <Button small label="+ Poster un Pokémon" disabled={!free.length} onPress={() => setPick(true)} />
      )}
      {!free.length && <Text style={styles.hint}>Capture d'autres Pokémon : ceux qui ne sont pas dans l'équipe (ni déjà en Exploration) peuvent gagner de l'XP ici.</Text>}
      {posted.map((p) => {
        const m = s.mons[p.uid];
        if (!m) return null;
        const elapsed = Math.min(now - p.since, PENSION_CAP_MS);
        const full = now - p.since >= PENSION_CAP_MS;
        const xp = Math.floor((elapsed / 3600_000) * p.xpPerHour);
        return (
          <View key={p.uid} style={styles.card}>
            <MonThumb speciesId={m.speciesId} shiny={m.shiny} size={46} />
            <View style={{ flex: 1 }}>
              <View style={styles.row}>
                <Text style={styles.name}>{monName(m)} · Nv.{m.level}</Text>
                <Stars mon={m} />
              </View>
              <View style={styles.xpTrack}><View style={[styles.xpFill, { width: `${xpProgress(m) * 100}%` }]} /></View>
              <Text style={styles.sub}>{full ? 'Plein : récolte !' : `+${xp} XP prête (${Math.round(p.xpPerHour)}/h) · plein dans ${fmt(PENSION_CAP_MS - elapsed)}`}</Text>
            </View>
            <Button small label="Retirer" onPress={() => act((g) => removePension(g, p.uid))} />
          </View>
        );
      })}

      <Modal visible={pick} transparent animationType="slide" onRequestClose={() => setPick(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPick(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.title}>Qui envoyer en pension ?</Text>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Rechercher un Pokémon…"
              placeholderTextColor={C.dim}
              style={styles.search}
            />
            <View style={styles.row}>
              {[0, 2, 3, 4].map((n) => (
                <Pressable key={n} onPress={() => setMinStars(n)} style={[styles.chip, minStars === n && styles.chipOn]}>
                  <Text style={styles.chipTxt}>{n === 0 ? 'Tous' : `${n}★+`}</Text>
                </Pressable>
              ))}
            </View>
            {candTypes.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} style={{ flexGrow: 0 }}>
                <Pressable onPress={() => setTypeFilter(null)} style={[styles.chip, !activeType && styles.chipOn]}>
                  <Text style={styles.chipTxt}>Tous types</Text>
                </Pressable>
                {candTypes.map((t) => (
                  <Pressable key={t} onPress={() => setTypeFilter(activeType === t ? null : t)}
                    style={[styles.chip, { borderWidth: 1, borderColor: TYPE_COLOR[t] }, activeType === t && { backgroundColor: TYPE_COLOR[t] }]}>
                    <Text style={[styles.chipTxt, activeType === t && { color: textOn(TYPE_COLOR[t]) }]}>{typeLabel(t)}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
            {!free.length && <Text style={styles.hint}>Aucun Pokémon ne correspond.</Text>}
            <FlatList
              data={free}
              keyExtractor={(m) => m.uid}
              style={{ maxHeight: 400 }}
              contentContainerStyle={{ gap: 8 }}
              initialNumToRender={12}
              windowSize={5}
              removeClippedSubviews
              renderItem={({ item: m }) => (
                <Pressable style={styles.card} onPress={() => { const rate = nextRate(); act((g) => assignPension(g, m.uid, rate)); setPick(false); feedback(); }}>
                  <MonThumb speciesId={m.speciesId} shiny={m.shiny} size={40} />
                  <Text style={[styles.name, { flex: 1 }]}>{monName(m)} Nv.{m.level}</Text>
                  <Stars mon={m} />
                </Pressable>
              )}
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { color: C.text, fontWeight: '800', fontSize: 14 },
  sub: { color: C.sub, fontSize: 11 },
  xpTrack: { height: 4, backgroundColor: C.panel2, borderRadius: 2, overflow: 'hidden', marginVertical: 3 },
  xpFill: { height: '100%', backgroundColor: '#42a5f5' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, paddingBottom: 30, gap: 10 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: C.panel },
  chipOn: { backgroundColor: C.accent },
  search: { backgroundColor: C.panel, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, color: C.text, fontSize: 14 },
  chipTxt: { color: C.text, fontWeight: '700', fontSize: 12 },
});
