import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Move, learnedMoves, move, species } from '../game/data';
import {
  CANDY_XP, TEAM_SIZE, canEvolve, equip, evolve, feedCandy, heldItems, holder, lineBase, rankUpTalent, release,
  resetTalents, setMoves, setTeam, unequip,
} from '../game/game';
import { itemScore, slotOf, template } from '../game/items';
import { ItemSlot } from '../game/model';
import { TIER_REQ, eligibleAffinityTypes, spentPoints, talentPoints, talentTree } from '../game/talents';
import { AnimatedSprite } from '../sprites/AnimatedSprite';
import { useGame } from '../store/game';
import { toast, useUi } from '../store/ui';
import { Bar } from './components/Bar';
import { Button } from './components/Button';
import { Dialog, DialogSpec } from './components/Dialog';
import { ItemCard } from './components/ItemCard';
import { MonThumb } from './components/MonThumb';
import { Stars } from './components/Stars';
import { feedback } from './components/feedback';
import { TypeBadge } from './components/TypeBadge';
import { monName, monStats, typeLabel, xpProgress } from './helpers';
import { runner } from './battle/runner';
import { C } from './theme';

const SLOTS: { slot: ItemSlot; label: string }[] = [
  { slot: 'offense', label: 'Offensif' }, { slot: 'defense', label: 'Défensif' }, { slot: 'berry', label: 'Baie' },
];
const TIER_NAME = ['Palier 1', 'Palier 2 (5 points)', 'Palier 3 (10 points)', 'Palier 4 (20 points)', 'Palier 5 (40 points)'];

function moveInfo(m: Move) {
  switch (m.kind) {
    case 'damage': return `Puissance ${m.power} · ${m.cd} s${m.aoe ? ' · tous les ennemis' : ''}${m.ailment ? ` · ${m.chance} % ${AIL[m.ailment]}` : ''}`;
    case 'status': return `${AIL[m.ailment]} · ${m.cd} s`;
    case 'heal': return `Soigne ${m.heal} % · ${m.cd} s`;
    case 'buff': return `${STAT[m.stat]} +${25 * m.stages} % pendant 6 s`;
    case 'debuff': return `${STAT[m.stat]} de la cible −${Math.abs(25 * m.stages)} %`;
  }
}
const AIL: Record<string, string> = { burn: 'brûlure', poison: 'poison', paralysis: 'paralysie', sleep: 'sommeil', freeze: 'gel' };
const STAT: Record<string, string> = { atk: 'Attaque', def: 'Défense', spe: 'Vitesse' };

export function MonSheet() {
  const uid = useUi((u) => u.monSheet);
  const open = useUi((u) => u.openMon);
  const s = useGame((g) => g.s);
  useGame((g) => g.rev);
  const act = useGame((g) => g.act);
  const [picker, setPicker] = useState<ItemSlot | null>(null);
  const [swapPicker, setSwapPicker] = useState(false);
  const [affinityPick, setAffinityPick] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogSpec | null>(null);
  const mon = uid && s ? s.mons[uid] : null;

  // MonSheet est une instance unique et persistante (pas remontée à chaque Pokémon ouvert) : sans ça,
  // les popups internes (objet, échange d'équipe, talent au choix, dialogue) restent ouvertes en
  // mémoire d'un Pokémon à l'autre — ex. le sélecteur « Qui remplacer ? » resté armé après un premier
  // échange se redéclenchait silencieusement sur le Pokémon suivant, sans jamais s'afficher.
  const close = () => { setPicker(null); setSwapPicker(false); setAffinityPick(null); setDialog(null); open(null); };
  if (!s || !mon) return <Modal visible={false} transparent />;

  const sp = species(mon.speciesId);
  const st = monStats(s, mon.uid);
  const inTeam = s.team.includes(mon.uid);
  // uid fantôme (Pokémon relâché/supprimé) jamais nettoyé de l'équipe : compter les membres valides
  // plutôt que s.team.length brut, sinon l'équipe semble pleine alors qu'elle affiche moins de 3.
  const validTeamCount = s.team.filter((u) => s.mons[u]).length;
  const tree = talentTree(sp.types);
  const pts = talentPoints(mon.level) - spentPoints(mon.talents);
  const spent = spentPoints(mon.talents);
  const learned = learnedMoves(sp, mon.level).filter((id) => !mon.moves.includes(id));
  const candies = s.candies[lineBase(mon.speciesId)] ?? 0;
  const changed = () => runner.restart(); // l'équipe change : la vague repart avec les nouvelles stats

  const moveUp = (i: number) => {
    if (i === 0) return;
    const m = mon.moves.slice(); [m[i - 1], m[i]] = [m[i], m[i - 1]];
    act((g) => setMoves(g, mon.uid, m));
  };

  return (
    <Modal visible animationType="slide" onRequestClose={close}>
      <View style={styles.root}>
        <View style={styles.top}>
          <Pressable onPress={close} hitSlop={12}><Text style={styles.close}>‹ Retour</Text></Pressable>
          <Text style={styles.cp}>PC {st.cp}</Text>
        </View>
        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.head}>
            <View style={styles.stage}><AnimatedSprite species={mon.speciesId} shiny={mon.shiny} action="idle" width={130} height={110} /></View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.name}>{monName(mon)}{mon.shiny ? ' ✨' : ''}</Text>
              <View style={styles.row}>{sp.types.map((t) => <TypeBadge key={t} type={t} />)}</View>
              <View style={styles.row}>
                <Text style={styles.sub}>Niveau {mon.level}</Text>
                <Stars mon={mon} size={13} />
              </View>
              <View style={styles.xpTrack}><View style={[styles.xpFill, { width: `${xpProgress(mon) * 100}%` }]} /></View>
              <Text style={styles.genes}>Gènes PV {mon.genes.hp} · Atq {mon.genes.atk} · Déf {mon.genes.def} · Vit {mon.genes.spe} (sur 15)</Text>
            </View>
          </View>

          {canEvolve(mon) && (
            <Button label={`Faire évoluer en ${species(sp.evolvesTo).name}`} color="#c0392b" onPress={() => {
              feedback('evolve', true);
              act((g) => evolve(g, mon.uid));
              toast(`${sp.name} évolue en ${species(sp.evolvesTo).name} !`, '#ffb300');
              changed();
            }} />
          )}

          <View style={styles.panel}>
            <Bar label="PV" value={st.hp} max={Math.max(120, st.hp)} color="#4caf50" />
            <Bar label="Attaque" value={st.atk} max={Math.max(120, st.atk)} color="#e53935" />
            <Bar label="Défense" value={st.def} max={Math.max(120, st.def)} color="#1e88e5" />
            <Bar label="Vitesse" value={st.spe} max={Math.max(120, st.spe)} color="#fdd835" />
            <Text style={styles.sub}>Critique {st.crit.toFixed(1)} % · stats avec objets, talents, auras et badges</Text>
          </View>

          <Text style={styles.section}>Capacités (ordre de priorité)</Text>
          <View style={styles.panel}>
            {mon.moves.map((id, i) => {
              const m = move(id);
              return (
                <View key={id} style={styles.moveRow}>
                  <Text style={styles.moveIdx}>{i + 1}</Text>
                  <View style={{ flex: 1 }}>
                    <View style={styles.row}><Text style={styles.moveName}>{m.name}</Text><TypeBadge type={m.type} small /></View>
                    <Text style={styles.moveInfo}>{moveInfo(m)}</Text>
                  </View>
                  <Pressable onPress={() => moveUp(i)} hitSlop={6}><Text style={styles.icon}>▲</Text></Pressable>
                  <Pressable onPress={() => act((g) => setMoves(g, mon.uid, mon.moves.filter((x) => x !== id)))} hitSlop={6}><Text style={styles.icon}>✕</Text></Pressable>
                </View>
              );
            })}
            {!mon.moves.length && <Text style={styles.sub}>Aucune capacité : attaque de base seulement.</Text>}
            {learned.length > 0 && <Text style={[styles.sub, { marginTop: 6 }]}>Disponibles</Text>}
            {learned.map((id) => {
              const m = move(id);
              return (
                <View key={id} style={styles.moveRow}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.row}><Text style={styles.moveName}>{m.name}</Text><TypeBadge type={m.type} small /></View>
                    <Text style={styles.moveInfo}>{moveInfo(m)}</Text>
                  </View>
                  <Button small label={mon.moves.length >= 4 ? 'Plein' : 'Équiper'} disabled={mon.moves.length >= 4}
                    onPress={() => act((g) => setMoves(g, mon.uid, [...mon.moves, id]))} />
                </View>
              );
            })}
          </View>

          <Text style={styles.section}>Objets tenus</Text>
          <View style={styles.panel}>
            {SLOTS.map(({ slot, label }) => {
              const it = mon.items[slot] ? s.items[mon.items[slot]!] : undefined;
              return (
                <Pressable key={slot} onPress={() => setPicker(slot)} style={styles.slotRow}>
                  <Text style={styles.slotLabel}>{label}</Text>
                  <View style={{ flex: 1 }}>{it ? <ItemCard item={it} onPress={() => setPicker(slot)} /> : <Text style={styles.empty}>Vide — toucher pour équiper</Text>}</View>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.section}>Talents {sp.types[0] && `· ${pts} point${pts > 1 ? 's' : ''} disponible${pts > 1 ? 's' : ''}`}</Text>
          <View style={styles.panel}>
            {[0, 1, 2, 3, 4].map((tier) => (
              <View key={tier} style={{ gap: 6 }}>
                <Text style={[styles.sub, spent < TIER_REQ[tier] && { color: C.dim }]}>{TIER_NAME[tier]}</Text>
                {tree.filter((t) => t.tier === tier).map((t) => {
                  const r = mon.talents[t.id] ?? 0;
                  const chosenType = mon.talentTypeChoices[t.id];
                  const needsChoice = !!t.chooseType && !chosenType;
                  const can = pts > 0 && r < t.maxRank && spent >= TIER_REQ[tier];
                  const label = chosenType ? `${t.name} (${typeLabel(chosenType)})` : t.name;
                  return (
                    <View key={t.id}>
                      <View style={styles.talent}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.moveName}>{label} <Text style={styles.sub}>{r}/{t.maxRank}</Text></Text>
                          <Text style={styles.moveInfo}>
                            {needsChoice ? 'Choisis un type à booster (hors des siens, présent dans son movepool)' : `${t.describe(Math.max(1, r) * t.perRank)}${r === 0 ? ' (rang 1)' : ''}`}
                          </Text>
                        </View>
                        <Button small label="+" disabled={!can} color={can ? C.accent : C.panel2}
                          onPress={() => {
                            if (needsChoice) { setAffinityPick(affinityPick === t.id ? null : t.id); return; }
                            feedback(); act((g) => rankUpTalent(g, mon.uid, t.id));
                          }} />
                      </View>
                      {affinityPick === t.id && (() => {
                        const otherChoices = Object.entries(mon.talentTypeChoices).filter(([k]) => k !== t.id).map(([, v]) => v);
                        const options = eligibleAffinityTypes(mon.speciesId, otherChoices);
                        return (
                          <View style={[styles.row, { flexWrap: 'wrap', marginTop: 4 }]}>
                            {options.map((ty) => (
                              <Pressable key={ty} style={styles.chip} onPress={() => {
                                feedback(); act((g) => rankUpTalent(g, mon.uid, t.id, ty)); setAffinityPick(null);
                              }}>
                                <Text style={styles.chipTxt}>{typeLabel(ty)}</Text>
                              </Pressable>
                            ))}
                            {!options.length && <Text style={styles.empty}>Aucun type disponible : son movepool ne sort pas de ses propres types.</Text>}
                          </View>
                        );
                      })()}
                    </View>
                  );
                })}
              </View>
            ))}
            {spent > 0 && <Button small label="Réinitialiser (50 éclats)" onPress={() => { if (!act((g) => resetTalents(g, mon.uid))) toast('Pas assez d’éclats'); }} />}
          </View>

          <Text style={styles.section}>Bonbons {sp.name} · {candies}</Text>
          <Button small label={`Donner un bonbon (+${CANDY_XP} XP)`} disabled={!candies}
            onPress={() => { const r = act((g) => feedCandy(g, mon.uid)); if (r?.levels) toast(`${sp.name} passe au niveau ${mon.level} !`); }} />

          <View style={[styles.row, { marginTop: 12 }]}>
            {inTeam ? (
              <Button label="Retirer de l'équipe" disabled={validTeamCount <= 1} onPress={() => { act((g) => setTeam(g, g.team.filter((u) => u !== mon.uid))); changed(); }} style={{ flex: 1 }} />
            ) : (
              <Button label={validTeamCount < TEAM_SIZE ? "Ajouter à l'équipe" : "Remplacer un membre de l'équipe"} color={C.accent}
                onPress={() => {
                  if (validTeamCount < TEAM_SIZE) { act((g) => setTeam(g, [...g.team, mon.uid])); changed(); }
                  else setSwapPicker(true);
                }} style={{ flex: 1 }} />
            )}
            <Button label="Relâcher" color="#5a2020" disabled={inTeam && s.team.length <= 1} onPress={() => setDialog({
              title: `Relâcher ${sp.name} ?`, message: 'Tu recevras 3 bonbons de sa lignée. Ses objets retournent dans le sac.',
              primary: { label: 'Relâcher', onPress: () => { act((g) => release(g, mon.uid)); close(); changed(); } },
              secondary: { label: 'Annuler', onPress: () => {} },
            })} />
          </View>
        </ScrollView>

        {picker && (
          <ItemPicker slot={picker} monUid={mon.uid} onClose={() => setPicker(null)} onChanged={changed} />
        )}
        {swapPicker && (
          <TeamSwapPicker newUid={mon.uid} onClose={() => setSwapPicker(false)} onChanged={() => { changed(); close(); }} />
        )}
        <Dialog spec={dialog} onClose={() => setDialog(null)} />
      </View>
    </Modal>
  );
}

function ItemPicker({ slot, monUid, onClose, onChanged }: { slot: ItemSlot; monUid: string; onClose: () => void; onChanged: () => void }) {
  const s = useGame((g) => g.s)!;
  const act = useGame((g) => g.act);
  const [dialog, setDialog] = useState<DialogSpec | null>(null);
  const mon = s.mons[monUid];
  const current = mon.items[slot] ? s.items[mon.items[slot]!] : undefined;
  const list = Object.values(s.items).filter((i) => slotOf(i) === slot).sort((a, b) => itemScore(b) - itemScore(a));
  const doEquip = (uid: string) => { feedback(); act((g) => equip(g, monUid, uid)); onChanged(); onClose(); };
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.section}>Choisir un objet</Text>
          <ScrollView style={{ maxHeight: 440 }} contentContainerStyle={{ gap: 8 }}>
            {current && <Button small label="Retirer l'objet" onPress={() => { act((g) => unequip(g, monUid, slot)); onChanged(); onClose(); }} />}
            {list.map((it) => {
              const w = holder(s, it.uid);
              const wornByOther = w && w.uid !== monUid ? monName(w) : undefined;
              const cmp = current ? (itemScore(it) > itemScore(current) ? 'up' : itemScore(it) < itemScore(current) ? 'down' : null) : 'up';
              return (
                <ItemCard key={it.uid} item={it} selected={it.uid === current?.uid} wornBy={wornByOther}
                  compare={it.uid === current?.uid ? null : cmp}
                  onPress={() => {
                    if (wornByOther) {
                      setDialog({
                        title: 'Objet déjà équipé', message: `${wornByOther} porte cet objet. Le lui retirer pour l'équiper ici ?`,
                        primary: { label: 'Transférer', onPress: () => doEquip(it.uid) },
                        secondary: { label: 'Annuler', onPress: () => {} },
                      });
                    } else doEquip(it.uid);
                  }} />
              );
            })}
            {!list.length && <Text style={styles.empty}>Aucun objet de ce type pour l'instant : il en tombe en combat.</Text>}
          </ScrollView>
        </Pressable>
      </Pressable>
      <Dialog spec={dialog} onClose={() => setDialog(null)} />
    </Modal>
  );
}

function TeamSwapPicker({ newUid, onClose, onChanged }: { newUid: string; onClose: () => void; onChanged: () => void }) {
  const s = useGame((g) => g.s)!;
  const act = useGame((g) => g.act);
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.section}>Qui remplacer ?</Text>
          <ScrollView style={{ maxHeight: 440 }} contentContainerStyle={{ gap: 8 }}>
            {s.team.map((uid, i) => {
              const m = s.mons[uid];
              if (!m) return null;
              const stt = monStats(s, uid);
              return (
                <Pressable key={uid} style={styles.swapRow} onPress={() => {
                  act((g) => setTeam(g, g.team.map((u, j) => (j === i ? newUid : u))));
                  onChanged();
                  onClose();
                }}>
                  <Text style={styles.swapSlot}>{i + 1}</Text>
                  <MonThumb speciesId={m.speciesId} shiny={m.shiny} size={40} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.swapName}>{monName(m)} Nv.{m.level}</Text>
                    <Text style={styles.swapSub}>PC {stt.cp}</Text>
                  </View>
                  <Stars mon={m} />
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, paddingTop: 40 },
  top: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8 },
  close: { color: C.sub, fontSize: 16, fontWeight: '700' },
  cp: { color: C.gold, fontSize: 16, fontWeight: '900' },
  body: { padding: 16, gap: 10, paddingBottom: 60 },
  head: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  stage: { backgroundColor: C.panel, borderRadius: 16 },
  name: { color: C.text, fontSize: 24, fontWeight: '900' },
  row: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  sub: { color: C.sub, fontSize: 12 },
  genes: { color: C.dim, fontSize: 11 },
  xpTrack: { height: 6, backgroundColor: C.panel2, borderRadius: 3, overflow: 'hidden' },
  xpFill: { height: '100%', backgroundColor: '#42a5f5' },
  panel: { backgroundColor: C.panel, borderRadius: 14, padding: 12, gap: 8 },
  section: { color: C.text, fontSize: 16, fontWeight: '800', marginTop: 6 },
  moveRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  moveIdx: { color: C.gold, fontWeight: '900', width: 14 },
  moveName: { color: C.text, fontWeight: '700', fontSize: 14 },
  moveInfo: { color: C.sub, fontSize: 11 },
  icon: { color: C.sub, fontSize: 16, paddingHorizontal: 4 },
  slotRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  slotLabel: { color: C.sub, width: 62, fontSize: 12, fontWeight: '700' },
  empty: { color: C.dim, fontSize: 13, paddingVertical: 8 },
  talent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chip: { backgroundColor: C.panel2, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  chipTxt: { color: C.text, fontWeight: '700', fontSize: 12 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, paddingBottom: 30, gap: 8 },
  swapRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.panel, borderRadius: 14, padding: 10 },
  swapSlot: { color: C.gold, fontWeight: '900', fontSize: 16, width: 14 },
  swapName: { color: C.text, fontWeight: '800', fontSize: 14 },
  swapSub: { color: C.sub, fontSize: 11 },
});
