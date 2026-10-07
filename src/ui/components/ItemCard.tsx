import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { SETS, STAT_LABEL, setBonusText, statText, subRange, subTier, BERRY_HEAL_CAP, berryHeal, berryHpPct, bonusCritValue, flatBonus, mainValue, plusOf, rarityName, template } from '../../game/items';
import { BonusStat, Item, ItemTemplate, Mon, RARITIES } from '../../game/model';
import { species } from '../../game/data';
import { MonThumb } from './MonThumb';
import { C } from '../theme';
import { ChromaPill, ChromaText, RainbowBorder } from './RainbowBorder';
import { chromaTier, itemColor } from '../helpers';

export const SLOT_ICON = { offense: '⚔', defense: '🛡', berry: '🍒' } as const;
export const CURE_LABEL: Record<string, string> = {
  paralysis: 'la paralysie', poison: 'le poison', sleep: 'le sommeil', burn: 'la brûlure', freeze: 'le gel',
};

/** Stat principale d'un modèle d'objet, sans valeur (elle dépend du niveau et de la rareté) : « Attaque »,
 *  « PV + Vitesse » (objet mixte), « Dégâts critiques + Critique », « Soin des PV · soigne le poison ». */
export function templateStatText(t: ItemTemplate): string {
  if (t.berry?.heal || t.berry?.cures) {
    const parts: string[] = [];
    if (t.berry.heal) parts.push('Soin des PV');
    if (t.berry.cures) parts.push(`soigne ${CURE_LABEL[t.berry.cures] ?? t.berry.cures}`);
    return parts.join(' · ');
  }
  const extra = t.flat ?? (t.bonusCrit ? 'critPct' : undefined);
  return extra ? `${STAT_LABEL[t.main]} + ${STAT_LABEL[extra]}` : STAT_LABEL[t.main];
}

/** Libellés courts des stats (cartes compactes du Sac et du sélecteur ; la fiche d'un objet garde les noms entiers). */
export const STAT_SHORT: Record<BonusStat, string> = {
  atkPct: 'Atq', defPct: 'Déf', hpPct: 'PV', spePct: 'Vit', critPct: 'Crit', critDmgPct: 'D.crit', typeDmgPct: 'Type', cdrPct: 'Rech',
};
/** Style d'une sous-stat selon sa valeur (`subTier`) : vert (PV, Dégâts du type, Vitesse, Attaque), jaune (Défense), gris
 *  sinon — pour repérer d'un coup d'œil quoi garder ou recycler. Pour un Pokémon précis, ce sont les flèches ▲▼ du
 *  sélecteur d'objet qui font foi (calculées pour lui). */
const chipTier = (stat: BonusStat) => ({ top: styles.topChip, good: styles.goodChip, low: null })[subTier(stat)];
const txtTier = (stat: BonusStat) => ({ top: styles.topTxt, good: styles.goodTxt, low: null })[subTier(stat)];

/** Stat principale (et bonus des objets mixtes) d'un objet, en libellés longs ou courts. */
export function itemMainText(it: Item, short = false) {
  const t = template(it.templateId);
  if (t.berry?.heal || t.berry?.cures) {
    const parts: string[] = [];
    if (t.berry.heal) parts.push(short ? `Soin ${berryHeal(it)} % des PV` : `Soigne ${berryHeal(it)} % des PV sous 30 %`);
    if (t.berry.cures) parts.push(`${short ? 'soigne' : 'Soigne'} ${CURE_LABEL[t.berry.cures] ?? t.berry.cures}`);
    // soin plafonné à 100 % : les crans au-delà donnent des PV (`berryHpPct`)
    const hp = berryHpPct(it);
    if (hp > 0) parts.push(short ? `PV +${Math.round(hp)} %` : statText('hpPct', hp));
    return parts.join(' · ');
  }
  const txt = (stat: BonusStat, v: number) => (short ? `${STAT_SHORT[stat]} +${Math.round(v)} %` : statText(stat, v));
  const main = txt(t.main, mainValue(it));
  const flat = flatBonus(it);
  if (flat) return `${txt(flat.stat, flat.value)} · ${main}`;
  return t.bonusCrit ? `${txt('critPct', bonusCritValue(it))} · ${main}` : main;
}

/** Sous-stats en pastilles abrégées, colorées selon leur valeur (`subTier`) (cartes compactes, mini-cartes de la fiche). */
export function SubChips({ item }: { item: Item }) {
  if (!item.subs.length) return null;
  return (
    <View style={styles.chips}>
      {item.subs.map((s, i) => (
        <Text key={i} style={[styles.chip, chipTier(s.stat)]}>{STAT_SHORT[s.stat]} +{Math.round(s.value)}</Text>
      ))}
    </View>
  );
}

/**
 * Carte d'objet. Compacte par défaut (Sac en 2 colonnes, sélecteur, fiche Pokémon) : nom sur 2 lignes au besoin, niveau
 * dessous (pas la panoplie : toujours coupée à cette largeur, elle est dans la fiche de l'objet), rareté portée par la couleur, sous-stats en pastilles abrégées (les plus utiles en vert).
 * `full` (fiche d'un objet) : rareté, panoplie et sous-stats en toutes lettres, valeurs exactes.
 * Chromatique +N : bordure, pastille « +N » et nom aux couleurs du palier du cran (`chromaTier`, un look par cran).
 * `animated` : bordure tournante (fiche détaillée : une seule carte à l'écran).
 * `wornBy` : porteur de l'objet. Carte compacte : sa miniature en pastille sur le coin haut-droit, superposée — la carte
 * ne grandit jamais (avant le 2026-10-01, un bandeau « Déjà porté par … » ajoutait une ligne). Fiche : le texte.
 * `setWorn` (fiche d'un objet porté) : pièces de sa panoplie portées par le porteur ; les bonus débloqués passent en vert
 * (2026-10-02), à leur vraie valeur (celle de la pièce la plus basse).
 * `setHint` (sélecteur d'objet de la fiche Pokémon, cartes pleine largeur) : panoplie de l'objet et, en vert, le bonus
 * que l'équiper activerait avec les 2 autres objets du Pokémon.
 */
export function ItemCard({ item, onPress, selected, wornBy, compare, animated, full, setWorn, setHint }: {
  item: Item; onPress?: () => void; selected?: boolean; wornBy?: Mon; compare?: 'up' | 'down' | null; animated?: boolean; full?: boolean;
  setWorn?: { count: number; level: number }; setHint?: SetHint;
}) {
  const t = template(item.templateId);
  const plus = plusOf(item);
  const tier = plus > 0 ? chromaTier(plus) : null;
  const color = itemColor(item);
  const setName = t.set ? SETS[t.set].name : '';
  return (
    <Pressable onPress={onPress} style={[styles.card, { borderColor: tier ? 'transparent' : color }, selected && styles.selected]}>
      {tier && <RainbowBorder plus={plus} radius={12} animated={animated} />}
      {tier && <ChromaPill plus={plus} overlay />}
      {wornBy && !full && (
        <View style={styles.wornThumb} pointerEvents="none">
          <MonThumb speciesId={wornBy.speciesId} shiny={wornBy.shiny} size={22} />
        </View>
      )}
      <View style={[styles.row, !full && styles.rowCompact]}>
        <Text style={styles.icon}>{SLOT_ICON[t.slot]}</Text>
        <Text style={[styles.name, { color }]} numberOfLines={2}>{t.name}</Text>
        {compare === 'up' && <Text style={styles.up}>▲</Text>}
        {compare === 'down' && <Text style={styles.down}>▼</Text>}
      </View>
      {wornBy && full && <View style={styles.wornBadge}><Text style={styles.wornTxt}>Porté par {species(wornBy.speciesId).name}</Text></View>}
      {full ? (
        <Text style={styles.rarity}>
          {tier ? <ChromaText plus={plus} text={rarityName(item)} /> : <Text style={{ color }}>{RARITIES[item.rarity]}</Text>} · Nv.{item.level}{setName ? ` · ${setName}` : ''}{item.locked ? ' · 🔒' : ''}
        </Text>
      ) : (
        // carte compacte : le cran est porté par la bordure et la pastille, comme la rareté par la couleur
        <Text style={styles.rarity} numberOfLines={1}>Nv.{item.level}{item.locked ? ' 🔒' : ''}</Text>
      )}
      <Text style={styles.main}>{itemMainText(item, !full)}</Text>
      {full && t.berry?.heal && berryHeal(item) >= BERRY_HEAL_CAP && (
        <Text style={styles.setTxt}>Soin plafonné à {BERRY_HEAL_CAP} % : chaque cran au-delà de +8 donne des PV.</Text>
      )}
      {full && t.set && (setWorn ? (
        // porté : chaque bonus en vert dès qu'il est débloqué, gris tant qu'il manque des pièces
        <Text style={styles.setTxt}>
          Panoplie {setWorn.count}/3 portée{setWorn.count > 1 ? 's' : ''} :{' '}
          <Text style={setWorn.count >= 2 ? styles.setOn : styles.setOff}>2 p. {setBonusText(t.set, 'two', setWorn.level)}{setWorn.count >= 2 ? ' ✓' : ''}</Text>
          {' · '}
          <Text style={setWorn.count >= 3 ? styles.setOn : styles.setOff}>3 p. {setBonusText(t.set, 'three', setWorn.level)}{setWorn.count >= 3 ? ' ✓' : ''}</Text>
        </Text>
      ) : (
        <Text style={styles.setTxt}>
          Panoplie (Nv.{item.level}) : 2 p. {setBonusText(t.set, 'two', item.level)} · 3 p. {setBonusText(t.set, 'three', item.level)}
        </Text>
      ))}
      {setHint && !full && (
        <Text style={styles.hintTxt} numberOfLines={2}>
          🎒 {setHint.name}
          {setHint.count >= 2 && <Text style={styles.setOn}> → {setHint.count}/3 : {setHint.text}</Text>}
        </Text>
      )}
      {full
        ? item.subs.map((s, i) => {
          // fourchette du jet à ce niveau et à ce cran (2026-10-02) : où se situe la sous-stat entre le minimum et le maximum
          const r = subRange(s.stat, item.level, plus);
          return (
            <Text key={i} style={[styles.sub, txtTier(s.stat)]}>
              {statText(s.stat, s.value)}<Text style={styles.range}>  ({r.min} – {r.max})</Text>
            </Text>
          );
        })
        : <SubChips item={item} />}
    </Pressable>
  );
}

/** Panoplie d'un objet dans le sélecteur : son nom, et le bonus activé avec les autres objets du Pokémon (`count` ≥ 2). */
export interface SetHint { name: string; count: number; text?: string }

/**
 * Repère de panoplie d'un objet du sélecteur pour ce Pokémon : pièces de la même panoplie dans ses AUTRES emplacements
 * (celui de l'objet est remplacé), niveau de la plus basse ; bonus 2 pièces, ou 2 + 3 pièces.
 */
export function setHintFor(item: Item, held: Item[]): SetHint | undefined {
  const t = template(item.templateId);
  if (!t.set) return undefined;
  const mates = held.filter((h) => h.uid !== item.uid && template(h.templateId).slot !== t.slot && template(h.templateId).set === t.set);
  const count = 1 + mates.length;
  const level = Math.min(item.level, ...mates.map((m) => m.level));
  const two = setBonusText(t.set, 'two', level);
  return { name: SETS[t.set].name, count, text: count >= 3 ? `${two} · ${setBonusText(t.set, 'three', level)}` : two };
}

const styles = StyleSheet.create({
  card: { backgroundColor: C.panel, borderRadius: 12, borderWidth: 1.5, padding: 8, gap: 2 },
  selected: { backgroundColor: C.panel2 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 5 },
  // place réservée à la pastille du porteur sur TOUTES les cartes compactes : porter un objet ne fait jamais passer
  // son nom sur une ligne de plus
  rowCompact: { marginRight: 14 },
  wornThumb: {
    position: 'absolute', top: -7, right: -7, zIndex: 2, width: 26, height: 26, borderRadius: 13, alignItems: 'center',
    justifyContent: 'center', backgroundColor: C.panel2, borderWidth: 1.5, borderColor: C.warn,
  },
  icon: { fontSize: 13, marginTop: 1 },
  name: { fontWeight: '800', fontSize: 13, flex: 1 },
  up: { color: '#69f0ae', fontWeight: '900' },
  down: { color: '#ff8a80', fontWeight: '900' },
  wornBadge: { backgroundColor: '#4a3410', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3, alignSelf: 'flex-start' },
  wornTxt: { color: C.warn, fontSize: 12, fontWeight: '800' },
  rarity: { color: C.dim, fontSize: 11 },
  main: { color: C.text, fontSize: 12, fontWeight: '700' },
  sub: { color: C.sub, fontSize: 12 },
  setTxt: { color: '#ffcc80', fontSize: 11, fontWeight: '700' },
  setOn: { color: '#69f0ae', fontWeight: '800' },
  setOff: { color: C.dim, fontWeight: '600' },
  hintTxt: { color: C.sub, fontSize: 11, fontWeight: '600' },
  range: { color: C.dim, fontSize: 11, fontWeight: '500' },
  topTxt: { color: '#69f0ae' },
  goodTxt: { color: '#ffd54f' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 },
  chip: { color: C.sub, fontSize: 11, backgroundColor: C.panel2, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1, overflow: 'hidden' },
  topChip: { color: '#69f0ae', backgroundColor: '#1b3a2a' },
  goodChip: { color: '#ffd54f', backgroundColor: '#3a3216' },
});
