import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../components/Text';
import {
  BALL_PRICE, BALLS, BOOST_KINDS, BOOST_MS, BOOSTS, BallKind, BoostKind, GameState, TOWER_BOOST_FLOORS, UNIVERSAL_MEGA_PRICE,
  boostMaxMs, boostPrice, boostRemaining, shopBoosts, buyBall, buyBalls, buyBoost, buyUniversalMega, buyUniversalMegas,
} from '../../game/game';
import { useGame } from '../../store/game';
import { toast } from '../../store/ui';
import { BallIcon } from '../components/BallIcon';
import { feedback } from '../components/feedback';
import { BuyButton, QuantityModal } from '../components/QuantityModal';
import { useHoldRepeat } from '../components/useHoldRepeat';
import { fmtNum as fmt } from '../helpers';
import { C } from '../theme';
import { useFrameClock } from '../useFrameClock';

/** « 1 h 05 », « 42 min », « 30 s » : temps restant d'un bonus. */
export function formatLeft(ms: number): string {
  const min = Math.floor(ms / 60_000);
  if (min < 1) return `${Math.ceil(ms / 1000)} s`;
  const h = Math.floor(min / 60);
  return h ? `${h} h ${String(min % 60).padStart(2, '0')}` : `${min} min`;
}

/** Effet d'un bonus en quelques mots (tuiles de la grille ; la description complète s'affiche au toucher). */
const BOOST_SHORT: Record<BoostKind, string> = {
  charm: 'Chromatiques ×1,5', incense: 'Offres de capture ×2', lure: 'Espèces rares ×3', xp: 'XP de l’équipe ×1,5',
  elixir: 'Attaque et PV +25 %', magnet: 'Chromatiques +67 %', cran: 'Butin +1 cran',
};

/** Article achetable en quantité (maintenir sa tuile) : une Ball ou le méga bonbon universel. */
type BulkKind = BallKind | 'mega';

/**
 * Ball de la boutique (3 sur une ligne, 2026-10-01) : toucher = +1 ; maintenir = la fenêtre d'achat en quantité
 * (`BulkModal`) s'ouvre aussitôt, sans attendre le relâchement. Sur Android, une fenêtre qui s'ouvre interrompt l'appui
 * en cours : l'achat en continu se fait donc dans la fenêtre (maintenir « +1 »).
 */
function BallTile({ kind, onBulk }: { kind: BallKind; onBulk: (kind: BulkKind) => void }) {
  const s = useGame((g) => g.s)!;
  const act = useGame((g) => g.act);
  const price = BALL_PRICE[kind];
  const can = s.shards >= price;
  return (
    <Pressable disabled={!can} delayLongPress={350}
      onPress={() => { if (act((g) => buyBall(g, kind))) feedback(); }}
      onLongPress={() => { feedback(); onBulk(kind); }}
      style={({ pressed }) => [styles.ballTile, !can && { opacity: 0.4 }, pressed && { opacity: 0.75 }]}>
      <BallIcon kind={kind} size={32} />
      <Text style={styles.stockN}>×{fmt(s.balls[kind])}</Text>
      <Text style={styles.desc}>{BALLS[kind].chance} % · {price} 💎</Text>
    </Pressable>
  );
}

/**
 * Fenêtre d'achat en quantité d'une Ball ou du méga bonbon universel (2026-10-02 : demande d'Arno) — maintenir sa tuile :
 * +1 (maintenir = achat en continu de plus en plus vite, `useHoldRepeat`), ×10, ×100 ; reste ouverte jusqu'à « Fermer ».
 */
function BulkModal({ kind, onClose }: { kind: BulkKind | null; onClose: () => void }) {
  const s = useGame((g) => g.s)!;
  useGame((g) => g.rev);
  const act = useGame((g) => g.act);
  const buyN = (g: GameState, n: number) => (kind === 'mega' ? buyUniversalMegas(g, n) : kind ? buyBalls(g, kind, n) : false);
  const hold = useHoldRepeat((n) => (kind ? act((g) => { let k = 0; while (k < n && buyN(g, 1)) k++; return k; }) ?? 0 : 0));
  if (!kind) return null;
  const mega = kind === 'mega';
  const price = mega ? UNIVERSAL_MEGA_PRICE : BALL_PRICE[kind];
  const buy = (n: number) => {
    if (!act((g) => buyN(g, n))) return;
    if (mega) { feedback('medal'); toast(`+${n} méga bonbon${n > 1 ? 's' : ''} universel${n > 1 ? 's' : ''}`, C.gold); }
    else { feedback(); if (n > 1) toast(`+${n} ${BALLS[kind].name}s`); }
  };
  return (
    <QuantityModal
      icon={mega ? <Text style={styles.megaIcon}>🍬</Text> : <BallIcon kind={kind} size={36} />}
      title={mega ? 'Méga bonbon universel' : BALLS[kind].name}
      sub={mega
        ? `stock ${fmt(s.universalMega ?? 0)} · ${fmt(price)} 💎 l'unité`
        : `stock ${fmt(s.balls[kind])} · capture ${BALLS[kind].chance} % · ${price} 💎 l'unité`}
      shards={s.shards}
      options={[
        { text: '+1', cost: price, onPress: () => buy(1), onLongPress: hold.start, onPressOut: hold.stop },
        ...[10, 100].map((n) => ({ text: `×${n} · ${fmt(price * n)} 💎`, cost: price * n, onPress: () => buy(n), flex: 1.6 })),
      ]}
      hint="Maintenir « +1 » pour acheter en continu."
      onClose={onClose} />
  );
}

/** Tuile d'un bonus temporaire : effet court, jauge de réserve (8 h, 12 h pour la Tour), temps restant, achat d'1 h. */
function BoostTile({ kind }: { kind: BoostKind }) {
  const s = useGame((g) => g.s)!;
  const act = useGame((g) => g.act);
  const b = BOOSTS[kind];
  const left = boostRemaining(s, kind);
  const max = boostMaxMs(kind);
  const price = boostPrice(s, kind);
  const full = left + BOOST_MS > max;
  return (
    <Pressable onPress={() => toast(`${b.icon} ${b.desc}`)} style={[styles.boost, left > 0 && styles.boostOn]}>
      <Text style={styles.name} numberOfLines={1}>{b.icon} {b.name}</Text>
      <Text style={styles.desc} numberOfLines={1}>{BOOST_SHORT[kind]}</Text>
      <View style={styles.gauge}><View style={[styles.gaugeFill, { width: `${Math.min(100, (left / max) * 100)}%` }]} /></View>
      <Text style={[styles.desc, left > 0 && styles.active]}>{left > 0 ? `actif · ${formatLeft(left)}` : 'inactif'}</Text>
      <BuyButton cost={price} shards={s.shards} text={`+1 h · ${fmt(price)} 💎`} label={full ? 'réserve pleine' : undefined}
        onPress={() => { if (act((g) => buyBoost(g, kind))) { feedback('medal'); toast(`${b.icon} ${b.name} : +1 h`, C.gold); } }} />
    </Pressable>
  );
}

/**
 * Boutique (refaite le 2026-10-01) : solde d'éclats fixé en haut (la Boutique a sa propre zone de défilement, comme le
 * Sac), Balls en cartes, bonus en grille avec jauge, méga bonbon universel. Les règles d'achat sont dans `game.ts`.
 */
export function ShopPanel() {
  useFrameClock(1); // minuteurs des bonus
  const s = useGame((g) => g.s)!;
  useGame((g) => g.rev);
  const act = useGame((g) => g.act);
  const [bulk, setBulk] = useState<BulkKind | null>(null);
  return (
    <View style={{ flex: 1 }}>
      <View style={styles.shards}>
        <Text style={styles.shardsTxt}>💎 {fmt(s.shards)}</Text>
        <Text style={styles.desc}>éclats · Exploration, Tour, recyclage</Text>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.section}>Balls</Text>
        <View style={styles.ballsRow}>
          {(Object.keys(BALLS) as BallKind[]).map((b) => <BallTile key={b} kind={b} onBulk={setBulk} />)}
        </View>
        <Text style={styles.hint}>Toucher une Ball : +1. Maintenir : achat en quantité (×10, ×100, en continu).</Text>

        <Text style={styles.section}>Bonus temporaires <Text style={styles.desc}>· 1 h par achat, 8 h au plus, perdus au nouveau départ</Text></Text>
        <View style={styles.grid}>
          {BOOST_KINDS.filter((k) => !BOOSTS[k].tower).map((k) => <BoostTile key={k} kind={k} />)}
        </View>
        <Text style={styles.hint}>Toucher un bonus pour lire son effet en détail.</Text>

        {/* bonus de la Tour (2026-10-07) : seulement une fois la Tour débloquée, prix selon le record */}
        {shopBoosts(s).some((k) => BOOSTS[k].tower) && (
          <>
            <Text style={styles.section}>🗼 Bonus de la Tour <Text style={styles.desc}>· 1 h par achat, 12 h au plus, en jeu comme hors ligne</Text></Text>
            <View style={styles.grid}>
              {shopBoosts(s).filter((k) => BOOSTS[k].tower).map((k) => <BoostTile key={k} kind={k} />)}
            </View>
            <Text style={styles.hint}>Prix d'1 h : les éclats de {TOWER_BOOST_FLOORS} étages à ton record (étage {s.towerBest}).</Text>
          </>
        )}

        <Text style={styles.section}>Objets</Text>
        <View style={styles.megaCard}>
          <Text style={styles.megaIcon}>🍬</Text>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.name}>Méga bonbon universel · {s.universalMega ?? 0}</Text>
            <Text style={styles.desc}>+1 gène, n'importe quel Pokémon (fiche, onglet Bonbons) · gardé au nouveau départ</Text>
          </View>
          <BuyButton cost={UNIVERSAL_MEGA_PRICE} shards={s.shards} text={`+1 · ${fmt(UNIVERSAL_MEGA_PRICE)} 💎`}
            onPress={() => { if (act((g) => buyUniversalMega(g))) { feedback('medal'); toast('+1 méga bonbon universel', C.gold); } }}
            onLongPress={() => { feedback(); setBulk('mega'); }} />
        </View>
        <Text style={styles.hint}>Toucher : +1. Maintenir : achat en quantité (×10, ×100, en continu).</Text>
      </ScrollView>
      <BulkModal kind={bulk} onClose={() => setBulk(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  shards: { flexDirection: 'row', alignItems: 'baseline', gap: 8, backgroundColor: C.panel, borderRadius: 12, padding: 10, marginHorizontal: 12 },
  shardsTxt: { color: C.gold, fontSize: 18, fontWeight: '900' },
  body: { padding: 12, paddingTop: 4, paddingBottom: 40, gap: 8 },
  section: { color: C.text, fontSize: 15, fontWeight: '900', marginTop: 6 },
  hint: { color: C.dim, fontSize: 11, marginTop: -2 },
  name: { color: C.text, fontSize: 13, fontWeight: '800' },
  desc: { color: C.dim, fontSize: 11 },
  stockN: { color: C.text, fontWeight: '900' },
  active: { color: C.gold, fontWeight: '800' },
  ballsRow: { flexDirection: 'row', gap: 8 },
  ballTile: { flex: 1, alignItems: 'center', gap: 2, backgroundColor: C.panel, borderRadius: 12, paddingVertical: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  boost: { width: '48.8%', backgroundColor: C.panel, borderRadius: 12, padding: 8, gap: 2, borderWidth: 1.5, borderColor: 'transparent' },
  boostOn: { borderColor: C.gold },
  gauge: { height: 5, backgroundColor: C.panel2, borderRadius: 3, overflow: 'hidden', marginVertical: 3 },
  gaugeFill: { height: '100%', backgroundColor: C.gold },
  megaCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.panel, borderRadius: 12, padding: 10 },
  megaIcon: { fontSize: 26 },
});
