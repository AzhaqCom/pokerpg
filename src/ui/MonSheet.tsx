import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from './components/Text';
import { actionLock, cdFactor } from '../game/battle';
import { Move, learnedMoves, move, evolutionTargets, species } from '../game/data';
import { regionOf } from '../game/content';
import {
  CANDY_XP, GENE_MAX, GeneKey, MEGA_CANDY_COST, TEAM_SIZE, applyMegaCandy, autoEquipBest, canEvolve, craftMegaCandy, equip, isTargeted, toggleLock, toggleTarget,
  evolve, feedCandy, heldItems, holder, lineBase, rankUpTalent, autoTalents, autoMoves, equipGain, release, resetTalents, setMoves, setTeam, towerReserve, unequip,
} from '../game/game';
import { SETS, itemScore, plusOf, setBonusText, slotOf, template, wornSets } from '../game/items';
import { BattleBonuses, ItemSlot, critOverflow } from '../game/model';
import { TIER_REQ, eligibleAffinityTypes, spentPoints, talentPoints, talentTree } from '../game/talents';
import { MAX_LEVEL } from '../game/stats';
import { AnimatedSprite } from '../sprites/AnimatedSprite';
import { useGame } from '../store/game';
import { toast, useUi } from '../store/ui';
import { Button } from './components/Button';
import { Dialog, DialogSpec } from './components/Dialog';
import { ModalBackdrop } from './components/ModalBackdrop';
import { ItemCard, SLOT_ICON, SubChips, itemMainText, setHintFor } from './components/ItemCard';
import { ChromaPill, RainbowBorder } from './components/RainbowBorder';
import { ItemDetail } from './ItemDetail';
import { BallIcon } from './components/BallIcon';
import { MonThumb } from './components/MonThumb';
import { Stars } from './components/Stars';
import { feedback } from './components/feedback';
import { TypeBadge } from './components/TypeBadge';
import { TYPE_COLOR, cpColor, itemColor, monName, monStats, textOn, typeLabel, xpProgress } from './helpers';
import { runner } from './battle/runner';
import { C } from './theme';

const SLOTS: { slot: ItemSlot; label: string }[] = [
  { slot: 'offense', label: 'Offensif' }, { slot: 'defense', label: 'Défensif' }, { slot: 'berry', label: 'Baie' },
];
const GENES: { key: GeneKey; label: string }[] = [
  { key: 'hp', label: 'PV' }, { key: 'atk', label: 'Atq' }, { key: 'def', label: 'Déf' }, { key: 'spe', label: 'Vit' },
];
/** Capacité en une ligne (fiche compacte, sélecteur de capacité) : « 150 · 2,9 s · zone ». `cdf` : multiplicateur de
 * recharge actuel du Pokémon (`cdFactor`, Vitesse et Recharge) — sans lui, `m.cd` n'est que le temps de base. */
function moveShort(m: Move, cdf: number) {
  const cd = (Math.round(m.cd * cdf * 10) / 10).toString().replace('.', ',');
  switch (m.kind) {
    case 'damage': return `${m.power} · ${cd} s${m.aoe ? ' · zone' : ''}${m.drain ? ' · draine' : ''}`;
    case 'status': return `${AIL[m.ailment]} · ${cd} s`;
    case 'heal': return `soin ${m.heal} % · ${cd} s`;
    case 'buff': return `${STAT[m.stat]} +${25 * m.stages} %`;
    case 'debuff': return `${STAT[m.stat]} −${Math.abs(25 * m.stages)} %`;
  }
}
type SheetTab = 'combat' | 'talents' | 'candies';
const TABS: { key: SheetTab; label: string }[] = [
  { key: 'combat', label: 'Combat' }, { key: 'talents', label: 'Talents' }, { key: 'candies', label: 'Bonbons' },
];
const AIL: Record<string, string> = { burn: 'brûlure', poison: 'poison', paralysis: 'paralysie', sleep: 'sommeil', freeze: 'gel' };
const STAT: Record<string, string> = { atk: 'Attaque', def: 'Défense', spe: 'Vitesse' };

/** Sous-stats affichées dans le tiroir « Sous-stats » (hors PV/Atq/Déf/Vit déjà en barres, et hors
 * critique déjà affiché en permanence) : label + valeur formatée. */
const SUB_STAT_LABEL: [key: keyof BattleBonuses, label: string, fmt: (v: number) => string][] = [
  ['typeDmgPct', 'Dégâts de son type', (v) => `+${v} %`],
  ['lifestealPct', 'Vol de vie', (v) => `${v} %`],
  ['dodgePct', 'Esquive', (v) => `${v} %`],
  ['spePct', 'Vitesse (bonus)', (v) => `+${v} % · une action toutes les ${actionLock(v).toFixed(2)} s`],
  ['cdrPct', 'Recharge', (v) => `+${v} %`],
];

export function MonSheet() {
  const uid = useUi((u) => u.monSheet);
  const open = useUi((u) => u.openMon);
  const list = useUi((u) => u.monList);
  const s = useGame((g) => g.s);
  useGame((g) => g.rev);
  const act = useGame((g) => g.act);
  const [picker, setPicker] = useState<ItemSlot | null>(null);
  const [swapPicker, setSwapPicker] = useState(false);
  const [evolvePick, setEvolvePick] = useState(false);
  const [affinityPick, setAffinityPick] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogSpec | null>(null);
  const [showSubs, setShowSubs] = useState(false);
  /** onglet affiché (retenu d'un Pokémon à l'autre : MonSheet est une instance unique) */
  const [tab, setTab] = useState<SheetTab>('combat');
  /** emplacement de capacité ouvert dans le sélecteur (= nombre de capacités : ajout) */
  const [movePick, setMovePick] = useState<number | null>(null);
  /** objet porté ouvert dans la popup de gestion (améliorer, changer une sous-stat, fusionner…) */
  const [managed, setManaged] = useState<string | null>(null);
  const mon = uid && s ? s.mons[uid] : null;

  // MonSheet est une instance unique et persistante (pas remontée à chaque Pokémon ouvert) : sans ça,
  // les popups internes (objet, échange d'équipe, talent au choix, dialogue) restent ouvertes en
  // mémoire d'un Pokémon à l'autre — ex. le sélecteur « Qui remplacer ? » resté armé après un premier
  // échange se redéclenchait silencieusement sur le Pokémon suivant, sans jamais s'afficher.
  const close = () => { setPicker(null); setSwapPicker(false); setAffinityPick(null); setDialog(null); setManaged(null); setMovePick(null); open(null); };
  if (!s || !mon) return <Modal visible={false} transparent />;

  const sp = species(mon.speciesId);
  const st = monStats(s, mon.uid);
  const cdf = cdFactor(st.spe, st.bonuses?.cdrPct ?? 0);
  const inTeam = s.team.includes(mon.uid);
  // uid fantôme (Pokémon relâché/supprimé) jamais nettoyé de l'équipe : compter les membres valides
  // plutôt que s.team.length brut, sinon l'équipe semble pleine alors qu'elle affiche moins de 3.
  const validTeamCount = s.team.filter((u) => s.mons[u]).length;
  const tree = talentTree(sp.types);
  const pts = talentPoints(mon.level) - spentPoints(mon.talents);
  const spent = spentPoints(mon.talents);
  const learned = learnedMoves(sp, mon.level).filter((id) => !mon.moves.includes(id));
  const candies = s.candies[lineBase(mon.speciesId)] ?? 0;
  const megaCandies = s.megaCandies[lineBase(mon.speciesId)] ?? 0;
  const changed = () => runner.restart(); // l'équipe change : la vague repart avec les nouvelles stats

  // flèches ← → : Pokémon précédent/suivant de la liste d'où la fiche a été ouverte (Pokémon relâchés ignorés)
  const nav = list.filter((u) => s.mons[u]);
  const idx = nav.indexOf(mon.uid);
  const go = (d: number) => {
    if (idx < 0 || nav.length < 2) return;
    setPicker(null); setSwapPicker(false); setAffinityPick(null); setDialog(null); setEvolvePick(false); setMovePick(null);
    open(nav[(idx + d + nav.length) % nav.length], list);
  };

  const moveUp = (i: number) => {
    if (i === 0) return;
    const m = mon.moves.slice(); [m[i - 1], m[i]] = [m[i], m[i - 1]];
    act((g) => setMoves(g, mon.uid, m));
  };

  const evoTargets = canEvolve(mon, regionOf(s.prestige).dexMax) ? evolutionTargets(mon.speciesId, regionOf(s.prestige).dexMax) : [];
  const doEvolve = (target: number) => {
    feedback('evolve', true);
    act((g) => evolve(g, mon.uid, target));
    toast(`${sp.name} évolue en ${species(target).name} !`, '#ffb300');
    setEvolvePick(false);
    changed();
  };
  const evolveButton = evoTargets.length > 0 && (
    <Button small label="Faire évoluer" color="#c0392b" onPress={() => (evoTargets.length > 1 ? setEvolvePick(true) : doEvolve(evoTargets[0]))} />
  );
  // arbre complet : tous les talents au rang maximum → une seule ligne de résumé (détail au toucher)
  const treeDone = tree.every((t) => (mon.talents[t.id] ?? 0) >= t.maxRank);
  const statMax = Math.max(st.hp, st.atk, st.def, st.spe, 1);
  const lock = actionLock(st.bonuses?.spePct ?? 0);

  return (
    <Modal visible animationType="slide" onRequestClose={close}>
      <View style={styles.root}>
        {/* en-tête sur une ligne : retour, navigation, cible, PC */}
        <View style={styles.top}>
          <Pressable onPress={close} hitSlop={12}><Text style={styles.close}>‹ Retour</Text></Pressable>
          {idx >= 0 && nav.length > 1 && (
            <View style={styles.navRow}>
              <Pressable hitSlop={10} onPress={() => go(-1)} style={styles.navBtn}><Text style={styles.navTxt}>←</Text></Pressable>
              <Text style={styles.navCount}>{idx + 1}/{nav.length}</Text>
              <Pressable hitSlop={10} onPress={() => go(1)} style={styles.navBtn}><Text style={styles.navTxt}>→</Text></Pressable>
            </View>
          )}
          <View style={{ flex: 1 }} />
          <Pressable hitSlop={8} style={[styles.targetBtn, isTargeted(s, mon.speciesId) && styles.targetBtnOn]} onPress={() => {
            feedback();
            const on = act((g) => { toggleTarget(g, mon.speciesId); return isTargeted(g, mon.speciesId); });
            toast(on ? '🎯 Lignée ciblée : capture auto, même déjà possédée' : 'Cible retirée', on ? '#69f0ae' : undefined);
          }}>
            <Text style={styles.targetTxt}>🎯</Text>
          </Pressable>
          <Text style={[styles.cp, { color: cpColor(st.cp) }]}>PC {st.cp}</Text>
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.head}>
            <View style={styles.stage}><AnimatedSprite species={mon.speciesId} shiny={mon.shiny} action="idle" width={84} height={72} /></View>
            <View style={{ flex: 1, gap: 4 }}>
              <View style={styles.row}>
                <Text style={styles.name} numberOfLines={1}>{monName(mon)}{mon.shiny ? ' ✨' : ''}</Text>
                <Pressable hitSlop={10} onPress={() => {
                  const willLock = !mon.locked;
                  feedback();
                  act((g) => toggleLock(g, mon.uid));
                  toast(willLock ? '🔒 Verrouillé : jamais relâché ni nettoyé' : 'Déverrouillé');
                }}>
                  <Text style={[styles.lock, !mon.locked && { opacity: 0.35 }]}>{mon.locked ? '🔒' : '🔓'}</Text>
                </Pressable>
              </View>
              <View style={[styles.row, { flexWrap: 'wrap' }]}>
                {sp.types.map((t) => <TypeBadge key={t} type={t} small />)}
                <Text style={styles.sub}>Nv.{mon.level}</Text>
                <Stars mon={mon} size={12} />
              </View>
              <View style={styles.xpTrack}><View style={[styles.xpFill, { width: `${xpProgress(mon) * 100}%` }]} /></View>
              {evolveButton}
            </View>
          </View>

          {/* onglets : la fiche n'affiche qu'une partie à la fois (retenu d'un Pokémon à l'autre) */}
          <View style={styles.tabs}>
            {TABS.map(({ key, label }) => (
              <Pressable key={key} style={[styles.tab, tab === key && styles.tabOn]} onPress={() => { feedback(); setTab(key); }}>
                <Text style={[styles.tabTxt, tab === key && styles.tabTxtOn]}>
                  {label}{key === 'talents' && pts > 0 ? ` · ${pts}` : ''}
                </Text>
              </Pressable>
            ))}
          </View>

          {tab === 'combat' && (
            <>
              <View style={styles.panel}>
                <View style={styles.statGrid}>
                  {([['PV', st.hp, '#4caf50'], ['Atq', st.atk, '#e53935'], ['Déf', st.def, '#1e88e5'], ['Vit', st.spe, '#fdd835']] as const).map(([label, v, color]) => (
                    <View key={label} style={styles.statCell}>
                      <Text style={styles.sub}>{label} <Text style={styles.statVal}>{v}</Text></Text>
                      <View style={styles.statTrack}><View style={[styles.statFill, { width: `${(v / statMax) * 100}%`, backgroundColor: color }]} /></View>
                    </View>
                  ))}
                </View>
                <Pressable onPress={() => setShowSubs((v) => !v)} style={styles.row}>
                  <Text style={[styles.sub, { flex: 1 }]}>
                    Crit {Math.round(Math.min(100, st.crit))} % · D.crit ×{(1.5 + ((st.bonuses?.critDmgPct ?? 0) + critOverflow(st.crit)) / 100).toFixed(1)} · 1 action / {lock.toFixed(2)} s
                  </Text>
                  <Text style={styles.subsToggle}>{showSubs ? '▾' : '▸'} détails</Text>
                </Pressable>
                {showSubs && (() => {
                  const b = st.bonuses;
                  const rows = SUB_STAT_LABEL.filter(([key]) => b && b[key] !== 0);
                  const affinities = b?.affinities.filter((a) => a.pct !== 0) ?? [];
                  return (
                    <View style={{ gap: 2 }}>
                      {st.crit > 100 && <Text style={styles.sub}>Surplus de {(st.crit - 100).toFixed(1)} % de Critique converti en Dégâts critiques</Text>}
                      {rows.map(([key, label, fmt]) => (
                        <Text key={key} style={styles.sub}>{label} : {fmt(Math.round((b![key] as number) * 10) / 10)}</Text>
                      ))}
                      {affinities.map((a, i) => (
                        <Text key={i} style={styles.sub}>Dégâts {typeLabel(a.type)} (Affinité) : +{Math.round(a.pct * 100) / 100} %</Text>
                      ))}
                      {!rows.length && !affinities.length && <Text style={styles.sub}>Aucune sous-stat active.</Text>}
                    </View>
                  );
                })()}
              </View>

              <View style={styles.panel}>
                <View style={styles.sectionRow}>
                  <Text style={styles.section}>Capacités</Text>
                  <Button small label="★ Auto" color="#3d5afe" onPress={() => {
                    if (act((g) => autoMoves(g, mon.uid))) { feedback(); toast('Meilleures capacités équipées', '#69f0ae'); }
                    else toast('Déjà les meilleures capacités');
                  }} />
                </View>
                {mon.moves.map((id, i) => {
                  const m = move(id);
                  return (
                    <Pressable key={id} style={[styles.moveRow, styles.moveTap]} onPress={() => setMovePick(i)}>
                      <Text style={styles.moveIdx}>{i + 1}</Text>
                      <Text style={styles.moveName} numberOfLines={1}>{m.name}</Text>
                      <TypeBadge type={m.type} small />
                      <Text style={styles.moveInfo}>{moveShort(m, cdf)}</Text>
                      <Text style={styles.chevron}>›</Text>
                    </Pressable>
                  );
                })}
                {mon.moves.length < 4 && learned.length > 0 && (
                  <Pressable style={[styles.moveRow, styles.moveTap, styles.moveAdd]} onPress={() => setMovePick(mon.moves.length)}>
                    <Text style={styles.moveIdx}>+</Text>
                    <Text style={[styles.moveName, { color: C.accent }]}>Ajouter une capacité</Text>
                    <Text style={styles.chevron}>›</Text>
                  </Pressable>
                )}
                {/* la liste des capacités apprises n'est plus affichée en entier : le dire clairement */}
                {learned.length > 0 && (
                  <Text style={styles.moveHint}>
                    ⇄ {learned.length} autre{learned.length > 1 ? 's' : ''} capacité{learned.length > 1 ? 's' : ''} apprise{learned.length > 1 ? 's' : ''} : touche une capacité pour l'échanger
                  </Text>
                )}
                {!mon.moves.length && !learned.length && <Text style={styles.sub}>Aucune capacité : attaque de base seulement.</Text>}
              </View>

              <View style={styles.panel}>
                <View style={styles.sectionRow}>
                  <Text style={styles.section}>Objets</Text>
                  <Button small label="★ Auto" color="#b8860b" onPress={() => {
                    const n = act((g) => autoEquipBest(g, mon.uid));
                    if (n) { feedback(); changed(); toast(`${n} objet${n > 1 ? 's' : ''} équipé${n > 1 ? 's' : ''}`, '#69f0ae'); }
                    else toast('Déjà équipé au mieux');
                  }} />
                </View>
                <View style={styles.itemRow}>
                  {SLOTS.map(({ slot, label }) => {
                    const it = mon.items[slot] ? s.items[mon.items[slot]!] : undefined;
                    const t = it && template(it.templateId);
                    return (
                      <View key={slot} style={styles.miniCol}>
                        <Pressable onPress={() => setPicker(slot)}
                          style={[styles.miniItem, { borderColor: !it ? C.panel2 : plusOf(it) > 0 ? 'transparent' : itemColor(it) }]}>
                          {it && t ? (
                            <>
                              {/* Chromatique +N : bordure fixe aux couleurs du palier du cran, comme dans le Sac */}
                              {plusOf(it) > 0 && <RainbowBorder plus={plusOf(it)} radius={10} />}
                              <Text style={[styles.miniName, { color: itemColor(it) }]} numberOfLines={2}>{SLOT_ICON[slot]} {t.name}</Text>
                              <View style={styles.miniLvRow}>
                                {plusOf(it) > 0 && <ChromaPill plus={plusOf(it)} />}
                                <Text style={styles.miniLv}>Nv.{it.level}</Text>
                              </View>
                              <Text style={styles.miniStat}>{itemMainText(it, true)}</Text>
                              <SubChips item={it} />
                            </>
                          ) : (
                            <Text style={styles.empty}>{SLOT_ICON[slot]} {label}{'\n'}+ équiper</Text>
                          )}
                        </Pressable>
                        {/* gestion de l'objet (améliorer, sous-stats, fusion) : vrai bouton sous la carte, facile à toucher */}
                        {it && <Button small label="⚙ Gérer" onPress={() => setManaged(it.uid)} />}
                      </View>
                    );
                  })}
                </View>
                {/* panoplie portée (2 pièces ou plus) : bonus débloqués en vert, à leur valeur (pièce la plus basse) */}
                {[...wornSets(heldItems(s, mon))].filter(([id, w]) => w.count >= 2 && SETS[id]).map(([id, w]) => (
                  <Text key={id} style={styles.setLine}>
                    🎒 {SETS[id].name} {w.count}/3 :{' '}
                    <Text style={styles.setOn}>{setBonusText(id, 'two', w.level)} ✓</Text>
                    {' · '}
                    <Text style={w.count >= 3 ? styles.setOn : styles.setOff}>{setBonusText(id, 'three', w.level)}{w.count >= 3 ? ' ✓' : ' (3 p.)'}</Text>
                  </Text>
                ))}
              </View>
            </>
          )}

          {tab === 'talents' && (
            <View style={styles.panel}>
              <View style={styles.sectionRow}>
                <Text style={styles.section}>{pts > 0 ? `${pts} point${pts > 1 ? 's' : ''} à dépenser` : `${spent} / ${talentPoints(mon.level)} points`}</Text>
                {pts > 0 && (
                  <Button small label="★ Auto" color={C.accent} onPress={() => { const n = act((g) => autoTalents(g, mon.uid)); if (n) feedback(); }} />
                )}
              </View>
              {treeDone && <Text style={styles.talentOn}>✔ Arbre complet</Text>}
              {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((tier) => {
                const tierLocked = spent < TIER_REQ[tier];
                return (
                  <View key={tier} style={[{ gap: 2 }, tierLocked && { opacity: 0.45 }]}>
                    {tierLocked && <Text style={styles.tierReq}>Palier {tier + 1} : {TIER_REQ[tier]} points dépensés nécessaires</Text>}
                    {tree.filter((t) => t.tier === tier).map((t) => {
                      const r = mon.talents[t.id] ?? 0;
                      const chosenType = mon.talentTypeChoices[t.id];
                      const needsChoice = !!t.chooseType && !chosenType;
                      const can = pts > 0 && r < t.maxRank && !tierLocked;
                      const label = chosenType ? `${t.name} (${typeLabel(chosenType)})` : t.name;
                      // effet toujours affiché (retour d'Arno : replié, on ne savait plus ce que faisaient les talents)
                      const effect = needsChoice ? 'Choisis un type à booster (le sien, ou un type de son movepool)'
                        : r > 0 ? `${t.describe(r * t.perRank)}${r < t.maxRank ? ` · max ${t.describe(t.maxRank * t.perRank).replace(/^.*?([+−-]?[\d.,]+ %.*)$/, '$1')}` : ''}`
                          : `Rang 1 : ${t.describe(t.perRank)}`;
                      return (
                        <View key={t.id}>
                          <View style={styles.talent}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.moveName} numberOfLines={1}>{label} <Text style={styles.sub}>{r}/{t.maxRank}</Text></Text>
                              <Text style={[styles.moveInfo, r > 0 && styles.talentOn]}>{effect}</Text>
                            </View>
                            {r < t.maxRank && (
                              <TalentPlus can={can}
                                onOne={() => {
                                  if (needsChoice) { setAffinityPick(affinityPick === t.id ? null : t.id); return; }
                                  feedback(); act((g) => rankUpTalent(g, mon.uid, t.id));
                                }}
                                onRepeat={() => !needsChoice && act((g) => rankUpTalent(g, mon.uid, t.id))} />
                            )}
                          </View>
                          {affinityPick === t.id && (() => {
                            const options = eligibleAffinityTypes(mon.speciesId);
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
                );
              })}
              {!treeDone && <Text style={styles.tierReq}>Maintenir « + » pour dépenser plusieurs points d’un coup.</Text>}
              {spent > 0 && <Button small label="Réinitialiser (50 éclats)" onPress={() => { if (!act((g) => resetTalents(g, mon.uid))) toast('Pas assez d’éclats'); }} />}
            </View>
          )}

          {tab === 'candies' && (
            <>
              {evoTargets.length > 0 && <View style={styles.panel}>{evolveButton}</View>}
              <View style={styles.panel}>
                <Text style={styles.section}>Gènes <Text style={styles.sub}>(méga bonbons : {megaCandies}{s.universalMega > 0 ? ` · universels ${s.universalMega}` : ''})</Text></Text>
                <View style={styles.row}>
                  {GENES.map(({ key, label }) => {
                    const v = mon.genes[key];
                    const maxed = v >= GENE_MAX;
                    return (
                      <Pressable key={key} disabled={maxed || megaCandies + (s.universalMega ?? 0) < 1}
                        onPress={() => { if (act((g) => applyMegaCandy(g, mon.uid, key))) feedback(); }}
                        style={({ pressed }) => [styles.geneBtn, maxed && styles.geneMax,
                          { opacity: !maxed && megaCandies + (s.universalMega ?? 0) < 1 ? 0.4 : pressed ? 0.75 : 1 }]}>
                        <Text style={styles.geneLabel}>{label}</Text>
                        <Text style={[styles.geneVal, maxed && { color: '#69f0ae' }]}>{maxed ? '15 ✓' : `${v} → ${v + 1}`}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Button small label={`Fabriquer 1 méga bonbon (${MEGA_CANDY_COST} bonbons)`} disabled={candies < MEGA_CANDY_COST}
                  onPress={() => { if (act((g) => craftMegaCandy(g, mon.speciesId))) feedback(); }} />
              </View>
              <View style={styles.panel}>
                <Text style={styles.section}>Bonbons {sp.name} · {candies}</Text>
                <Button small label={mon.level >= MAX_LEVEL ? 'Niveau maximum : plus besoin de bonbons' : `Donner un bonbon (+${CANDY_XP} XP)`}
                  disabled={!candies || mon.level >= MAX_LEVEL}
                  onPress={() => { const r = act((g) => feedCandy(g, mon.uid)); if (r?.levels) toast(`${sp.name} passe au niveau ${mon.level} !`); }} />
              </View>
            </>
          )}

          <View style={[styles.row, { marginTop: 6 }]}>
            {inTeam ? (
              <Button label="Retirer de l'équipe" disabled={validTeamCount <= 1} onPress={() => { act((g) => setTeam(g, g.team.filter((u) => u !== mon.uid))); changed(); }} style={{ flex: 1 }} />
            ) : (
              <Button label={validTeamCount < TEAM_SIZE ? "Ajouter à l'équipe" : "Remplacer un membre de l'équipe"} color={C.accent}
                onPress={() => {
                  if (validTeamCount < TEAM_SIZE) { act((g) => setTeam(g, [...g.team, mon.uid])); changed(); }
                  else setSwapPicker(true);
                }} style={{ flex: 1 }} />
            )}
            {/* réserve de la Tour (Relève) : jamais relâchée, comme un verrouillé */}
            <Button label={mon.locked ? '🔒' : towerReserve(s) === mon.uid ? '🔄 Réserve' : 'Relâcher'} color="#5a2020"
              disabled={!!mon.locked || towerReserve(s) === mon.uid || (inTeam && s.team.length <= 1)} onPress={() => setDialog({
              title: `Relâcher ${sp.name} ?`, message: 'Tu recevras 3 bonbons de sa lignée. Ses objets retournent dans le sac.',
              primary: { label: 'Relâcher', onPress: () => { act((g) => release(g, mon.uid)); close(); changed(); } },
              secondary: { label: 'Annuler', onPress: () => {} },
            })} />
          </View>
        </ScrollView>

        {evolvePick && (
          <EvolvePicker speciesId={mon.speciesId} dexMax={regionOf(s.prestige).dexMax} shiny={mon.shiny}
            // chromatique : Pokédex chromatique ; normal : exemplaires normaux possédés en ce moment (le Pokédex
            // « capturés » compte aussi les chromatiques, il ne dit pas si on a la forme en normal)
            owned={mon.shiny ? s.dex.shiny : Object.values(s.mons).filter((m) => !m.shiny).map((m) => m.speciesId)}
            onClose={() => setEvolvePick(false)}
            onPick={doEvolve} />
        )}
        <ItemDetail item={managed ? s.items[managed] ?? null : null} onClose={() => setManaged(null)} onSelect={setManaged} />
        {picker && (
          <ItemPicker slot={picker} monUid={mon.uid} onClose={() => setPicker(null)} onChanged={changed} />
        )}
        {movePick !== null && (
          <MovePicker monUid={mon.uid} index={movePick} cdf={cdf} onClose={() => setMovePick(null)} onUp={() => { moveUp(movePick); setMovePick(null); }} />
        )}
        {swapPicker && (
          <TeamSwapPicker newUid={mon.uid} onClose={() => setSwapPicker(false)} onChanged={() => { changed(); close(); }} />
        )}
        <Dialog spec={dialog} onClose={() => setDialog(null)} />
      </View>
    </Modal>
  );
}

/**
 * Sélecteur de capacité (2026-10-01 : remplace la longue liste « Disponibles » de la fiche) : pour l'emplacement
 * `index`, monter en priorité, retirer, ou remplacer par une capacité apprise (une ligne chacune, recharge réelle).
 * `index` = nombre de capacités équipées : ajout d'une nouvelle.
 */
function MovePicker({ monUid, index, cdf, onClose, onUp }: { monUid: string; index: number; cdf: number; onClose: () => void; onUp: () => void }) {
  const s = useGame((g) => g.s)!;
  const act = useGame((g) => g.act);
  const mon = s.mons[monUid];
  if (!mon) return null;
  const current = mon.moves[index];
  const learned = learnedMoves(species(mon.speciesId), mon.level).filter((id) => !mon.moves.includes(id));
  const pick = (id: number) => {
    const m = mon.moves.slice();
    if (current === undefined) m.push(id); else m[index] = id;
    act((g) => setMoves(g, monUid, m));
    feedback();
    onClose();
  };
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <ModalBackdrop style={styles.backdrop} onClose={onClose}>
        <View style={styles.sheet}>
          <Text style={styles.section}>{current !== undefined ? `Capacité ${index + 1} : ${move(current).name}` : 'Ajouter une capacité'}</Text>
          {current !== undefined && (
            <View style={styles.row}>
              {index > 0 && <Button small label="▲ Plus prioritaire" onPress={onUp} style={{ flex: 1 }} />}
              <Button small label="Retirer" color="#5a2020" style={{ flex: 1 }} onPress={() => {
                act((g) => setMoves(g, monUid, mon.moves.filter((x) => x !== current)));
                onClose();
              }} />
            </View>
          )}
          <Text style={styles.sub}>{learned.length ? (current !== undefined ? 'Remplacer par :' : 'Choisir :') : 'Aucune autre capacité apprise pour l’instant.'}</Text>
          <ScrollView style={{ maxHeight: 400 }} contentContainerStyle={{ gap: 4 }}>
            {learned.map((id) => {
              const m = move(id);
              return (
                <Pressable key={id} style={[styles.moveRow, styles.pickRow]} onPress={() => pick(id)}>
                  <Text style={styles.moveName} numberOfLines={1}>{m.name}</Text>
                  <TypeBadge type={m.type} small />
                  <Text style={styles.moveInfo}>{moveShort(m, cdf)}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </ModalBackdrop>
    </Modal>
  );
}

function ItemPicker({ slot, monUid, onClose, onChanged }: { slot: ItemSlot; monUid: string; onClose: () => void; onChanged: () => void }) {
  const s = useGame((g) => g.s)!;
  const act = useGame((g) => g.act);
  const [dialog, setDialog] = useState<DialogSpec | null>(null);
  const mon = s.mons[monUid];
  const current = mon.items[slot] ? s.items[mon.items[slot]!] : undefined;
  // tri et flèches selon la valeur POUR CE Pokémon (ses talents : Critique et Dégâts critiques se renforcent)
  const gains = new Map(Object.values(s.items).filter((i) => slotOf(i) === slot).map((i) => [i.uid, equipGain(s, monUid, i)]));
  const list = Object.values(s.items).filter((i) => slotOf(i) === slot).sort((a, b) => gains.get(b.uid)! - gains.get(a.uid)!);
  // panoplie de chaque objet, et le bonus qu'il activerait avec les 2 autres objets du Pokémon (2026-10-02)
  const monHeld = heldItems(s, mon);
  const doEquip = (uid: string) => { feedback(); act((g) => equip(g, monUid, uid)); onChanged(); onClose(); };
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <ModalBackdrop style={styles.backdrop} onClose={onClose}>
        <View style={styles.sheet}>
          <Text style={styles.section}>Choisir un objet</Text>
          <ScrollView style={{ maxHeight: 440 }} contentContainerStyle={{ gap: 8 }}>
            {current && <Button small label="Retirer l'objet" onPress={() => { act((g) => unequip(g, monUid, slot)); onChanged(); onClose(); }} />}
            {list.map((it) => {
              const w = holder(s, it.uid);
              const wornByOther = w && w.uid !== monUid ? w : undefined;
              const g = gains.get(it.uid)!;
              const cmp = current ? (g > 0.05 ? 'up' : g < -0.05 ? 'down' : null) : 'up';
              return (
                <ItemCard key={it.uid} item={it} selected={it.uid === current?.uid} wornBy={wornByOther}
                  compare={it.uid === current?.uid ? null : cmp} setHint={setHintFor(it, monHeld)}
                  onPress={() => {
                    if (wornByOther) {
                      setDialog({
                        title: 'Objet déjà équipé', message: `${monName(wornByOther)} porte cet objet. Le lui retirer pour l'équiper ici ?`,
                        primary: { label: 'Transférer', onPress: () => doEquip(it.uid) },
                        secondary: { label: 'Annuler', onPress: () => {} },
                      });
                    } else doEquip(it.uid);
                  }} />
              );
            })}
            {!list.length && <Text style={styles.empty}>Aucun objet de ce type pour l'instant : il en tombe en combat.</Text>}
          </ScrollView>
        </View>
      </ModalBackdrop>
      <Dialog spec={dialog} onClose={() => setDialog(null)} />
    </Modal>
  );
}

/** Choix de la forme d'évolution : un bouton par forme, à la couleur de son type principal. */
/** Choix d'évolution ; une Poké Ball marque les formes déjà possédées dans la même version (normale/chromatique). */
function EvolvePicker({ speciesId, dexMax, shiny, owned, onClose, onPick }: {
  speciesId: number; dexMax: number; shiny: boolean; owned: number[]; onClose: () => void; onPick: (target: number) => void;
}) {
  const targets = evolutionTargets(speciesId, dexMax);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <ModalBackdrop style={styles.evoBackdrop} onClose={onClose}>
        <View style={styles.evoBox}>
          <Text style={styles.evoTitle}>{species(speciesId).name} peut évoluer en…</Text>
          <ScrollView contentContainerStyle={{ gap: 8 }}>
          {targets.map((t) => {
            const sp = species(t);
            const bg = TYPE_COLOR[sp.types[0]];
            const fg = textOn(bg);
            return (
              <Pressable key={t} onPress={() => onPick(t)} style={[styles.evoBtn, { backgroundColor: bg }]}>
                <MonThumb speciesId={t} shiny={shiny} size={40} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.evoName, { color: fg }]}>{sp.name}</Text>
                  <Text style={[styles.evoTypes, { color: fg }]}>{sp.types.map(typeLabel).join(' / ')}</Text>
                </View>
                {owned.includes(t) && <BallIcon kind="poke" size={20} />}
              </Pressable>
            );
          })}
          </ScrollView>
          <Button label="Annuler" onPress={onClose} />
        </View>
      </ModalBackdrop>
    </Modal>
  );
}

function TeamSwapPicker({ newUid, onClose, onChanged }: { newUid: string; onClose: () => void; onChanged: () => void }) {
  const s = useGame((g) => g.s)!;
  const act = useGame((g) => g.act);
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <ModalBackdrop style={styles.backdrop} onClose={onClose}>
        <View style={styles.sheet}>
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
                    <Text style={[styles.swapSub, { color: cpColor(stt.cp), fontWeight: '700' }]}>PC {stt.cp}</Text>
                  </View>
                  <Stars mon={m} />
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </ModalBackdrop>
    </Modal>
  );
}

const styles = StyleSheet.create({
  evoBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
  evoBox: { backgroundColor: C.panel, borderRadius: 20, padding: 16, gap: 8, maxHeight: '85%' },
  evoTitle: { color: C.text, fontSize: 17, fontWeight: '800', textAlign: 'center', marginBottom: 4 },
  evoBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6 },
  evoName: { fontSize: 15, fontWeight: '800' },
  evoTypes: { fontSize: 11, fontWeight: '700', opacity: 0.85 },
  root: { flex: 1, backgroundColor: C.bg, paddingTop: 40 },
  manageTxt: { color: C.text, fontSize: 13 },
  navRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  navBtn: { backgroundColor: C.panel2, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 2 },
  navTxt: { color: C.text, fontSize: 16, fontWeight: '800' },
  navCount: { color: C.sub, fontSize: 12, fontWeight: '700' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 8 },
  lock: { fontSize: 18 },
  targetBtn: { backgroundColor: C.panel2, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  targetBtnOn: { backgroundColor: '#2e7d32' },
  targetTxt: { color: C.text, fontSize: 14 },
  close: { color: C.sub, fontSize: 16, fontWeight: '700' },
  cp: { color: C.gold, fontSize: 16, fontWeight: '900' },
  body: { padding: 14, gap: 10, paddingBottom: 60 },
  head: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  stage: { backgroundColor: C.panel, borderRadius: 16 },
  name: { color: C.text, fontSize: 20, fontWeight: '900', flexShrink: 1 },
  row: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  sub: { color: C.sub, fontSize: 12 },
  subsToggle: { color: C.accent, fontSize: 12, fontWeight: '700', marginTop: 4 },
  xpTrack: { height: 6, backgroundColor: C.panel2, borderRadius: 3, overflow: 'hidden' },
  xpFill: { height: '100%', backgroundColor: '#42a5f5' },
  panel: { backgroundColor: C.panel, borderRadius: 14, padding: 12, gap: 8 },
  section: { color: C.text, fontSize: 15, fontWeight: '800' },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tabs: { flexDirection: 'row', backgroundColor: C.panel, borderRadius: 12, padding: 3, gap: 3 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 9 },
  tabOn: { backgroundColor: C.panel2 },
  tabTxt: { color: C.sub, fontSize: 13, fontWeight: '700' },
  tabTxtOn: { color: C.text, fontWeight: '900' },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 6, columnGap: 14 },
  statCell: { width: '46%', gap: 2 },
  statVal: { color: C.text, fontWeight: '800' },
  statTrack: { height: 4, backgroundColor: C.panel2, borderRadius: 2, overflow: 'hidden' },
  statFill: { height: '100%' },
  itemRow: { flexDirection: 'row', gap: 6 },
  miniCol: { flex: 1, gap: 4 },
  miniItem: { flex: 1, minHeight: 64, borderWidth: 1.5, borderRadius: 10, padding: 6, backgroundColor: C.bg, gap: 2 },
  miniName: { fontSize: 11, fontWeight: '800' },
  miniLv: { color: C.dim, fontSize: 10, fontWeight: '700' },
  miniLvRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  miniStat: { color: C.sub, fontSize: 10, fontWeight: '700' },
  setLine: { color: '#ffcc80', fontSize: 11, fontWeight: '700' },
  setOn: { color: '#69f0ae', fontWeight: '800' },
  setOff: { color: C.dim, fontWeight: '600' },
  geneBtn: { flex: 1, alignItems: 'center', backgroundColor: C.panel2, borderRadius: 10, paddingVertical: 6 },
  geneMax: { backgroundColor: '#1b3a2a' },
  geneLabel: { color: C.sub, fontSize: 11, fontWeight: '700' },
  geneVal: { color: C.text, fontSize: 13, fontWeight: '800' },
  talentOn: { color: '#69f0ae', fontSize: 11, fontWeight: '700' },
  tierReq: { color: C.dim, fontSize: 11, fontStyle: 'italic' },
  pickRow: { backgroundColor: C.panel, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  moveRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 3 },
  moveTap: { backgroundColor: C.bg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6 },
  moveAdd: { borderWidth: 1, borderColor: C.accent, borderStyle: 'dashed' },
  chevron: { color: C.sub, fontSize: 18, fontWeight: '800', marginLeft: 2 },
  moveHint: { color: C.accent, fontSize: 12, fontWeight: '700' },
  moveIdx: { color: C.gold, fontWeight: '900', width: 14 },
  moveName: { color: C.text, fontWeight: '700', fontSize: 13, flexShrink: 1, flexGrow: 1 },
  moveInfo: { color: C.sub, fontSize: 11 },
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


/** Bouton « + » d'un talent : tap = +1 rang, appui long = dépense en rafale tant que possible (comme l'achat de Balls). */
function TalentPlus({ can, onOne, onRepeat }: { can: boolean; onOne: () => void; onRepeat: () => boolean | void }) {
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const repeat = useRef(onRepeat);
  repeat.current = onRepeat;
  const stop = () => { if (timer.current) { clearInterval(timer.current); timer.current = null; } };
  useEffect(() => stop, []);
  return (
    <Button small label="+" disabled={!can} color={can ? C.accent : C.panel2} onPress={onOne} delayLongPress={350}
      onLongPress={() => { stop(); timer.current = setInterval(() => { if (!repeat.current()) stop(); }, 100); }}
      onPressOut={stop} />
  );
}
