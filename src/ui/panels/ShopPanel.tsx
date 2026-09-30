import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  BALL_PRICE, BALLS, BOOST_KINDS, BOOST_MAX_MS, BOOST_MS, BOOSTS, BallKind, BoostKind, UNIVERSAL_MEGA_PRICE,
  boostRemaining, buyBall, buyBalls, buyBoost, buyUniversalMega,
} from '../../game/game';
import { useGame } from '../../store/game';
import { toast } from '../../store/ui';
import { BallIcon } from '../components/BallIcon';
import { Button } from '../components/Button';
import { feedback } from '../components/feedback';
import { C } from '../theme';
import { useFrameClock } from '../useFrameClock';

/** « 1 h 05 », « 42 min », « 30 s » : temps restant d'un bonus. */
export function formatLeft(ms: number): string {
  const min = Math.floor(ms / 60_000);
  if (min < 1) return `${Math.ceil(ms / 1000)} s`;
  const h = Math.floor(min / 60);
  return h ? `${h} h ${String(min % 60).padStart(2, '0')}` : `${min} min`;
}

/** Icône de Ball = bouton d'achat direct : tap = +1, appui long = achat en rafale (fin de partie : des
 * milliers d'éclats à dépenser) ; au relâchement d'une rafale, `onBurstEnd` ouvre la boîte « ×10 · ×100 ». */
function BuyBallIcon({ kind, onBurstEnd }: { kind: BallKind; onBurstEnd: (kind: BallKind) => void }) {
  const act = useGame((g) => g.act);
  const s = useGame((g) => g.s)!;
  useGame((g) => g.rev);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stop = () => { if (timer.current) { clearInterval(timer.current); timer.current = null; } };
  useEffect(() => stop, []);
  const endPress = () => { if (timer.current) onBurstEnd(kind); stop(); };
  const buyOne = () => { if (act((g) => buyBall(g, kind))) feedback(); };
  const start = () => {
    stop();
    timer.current = setInterval(() => { if (!act((g) => buyBall(g, kind))) stop(); }, 120);
  };
  const can = s.shards >= BALL_PRICE[kind];
  return (
    <Pressable onPress={buyOne} onLongPress={start} onPressOut={endPress} delayLongPress={350}
      style={[styles.ballBuy, !can && { opacity: 0.4 }]}>
      <BallIcon kind={kind} size={32} />
      <Text style={styles.resTxt}>{s.balls[kind]}</Text>
      <Text style={styles.price}>{BALL_PRICE[kind]}💎</Text>
    </Pressable>
  );
}

/** Durée d'affichage de la boîte d'achat groupé, relancée à chaque achat. */
const BULK_BOX_MS = 3000;
const BULK_AMOUNTS = [10, 100];

function BoostCard({ kind }: { kind: BoostKind }) {
  const s = useGame((g) => g.s)!;
  const act = useGame((g) => g.act);
  const b = BOOSTS[kind];
  const left = boostRemaining(s, kind);
  const full = left + BOOST_MS > BOOST_MAX_MS;
  const can = s.shards >= b.price && !full;
  return (
    <View style={[styles.card, left > 0 && styles.cardOn]}>
      <Text style={styles.icon}>{b.icon}</Text>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.name}>{b.name}</Text>
        <Text style={styles.desc}>{b.desc}</Text>
        <Text style={[styles.desc, left > 0 && { color: C.gold, fontWeight: '800' }]}>
          {left > 0 ? `Actif : encore ${formatLeft(left)}` : '1 h, en combat comme hors ligne'}
        </Text>
      </View>
      <Button small label={full ? 'Max 8 h' : `${b.price}💎`} disabled={!can}
        color={can ? C.accent : C.panel2}
        onPress={() => { if (act((g) => buyBoost(g, kind))) { feedback('medal'); toast(`${b.icon} ${b.name} : +1 h`, C.gold); } }} />
    </View>
  );
}

export function ShopPanel() {
  useFrameClock(1); // minuteurs des bonus
  const s = useGame((g) => g.s)!;
  useGame((g) => g.rev);
  const act = useGame((g) => g.act);
  // boîte « ×10 · ×100 » : ouverte au relâchement d'une rafale, une seule Ball à la fois, fermée après 3 s
  const [bulk, setBulk] = useState<BallKind | null>(null);
  const bulkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openBulk = (kind: BallKind) => {
    if (bulkTimer.current) clearTimeout(bulkTimer.current);
    setBulk(kind);
    bulkTimer.current = setTimeout(() => setBulk(null), BULK_BOX_MS);
  };
  useEffect(() => () => { if (bulkTimer.current) clearTimeout(bulkTimer.current); }, []);
  const canMega = s.shards >= UNIVERSAL_MEGA_PRICE;
  return (
    <View style={{ gap: 10 }}>
      <View style={styles.shards}>
        <Text style={styles.shardsTxt}>💎 {s.shards} éclats</Text>
        <Text style={styles.desc}>Exploration, recyclage des objets</Text>
      </View>

      <Text style={styles.section}>Balls</Text>
      <View style={styles.panel}>
        <Text style={styles.desc}>Touche une Ball pour en acheter une, appui long pour en acheter en rafale.</Text>
        <View style={styles.ballsRow}>
          {(Object.keys(BALLS) as BallKind[]).map((b) => <BuyBallIcon key={b} kind={b} onBurstEnd={openBulk} />)}
        </View>
        {bulk && (
          <View style={styles.bulkRow}>
            <BallIcon kind={bulk} size={18} />
            {BULK_AMOUNTS.map((n) => {
              const cost = BALL_PRICE[bulk] * n;
              const can = s.shards >= cost;
              return (
                <Pressable key={n} disabled={!can} style={[styles.bulkBtn, !can && { opacity: 0.35 }]} onPress={() => {
                  if (act((g) => buyBalls(g, bulk, n))) { feedback(); toast(`+${n} ${BALLS[bulk].name}s`); openBulk(bulk); }
                }}>
                  <Text style={styles.bulkTxt}>×{n}</Text>
                  <Text style={styles.price}>{cost}💎</Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      <Text style={styles.section}>Bonus temporaires</Text>
      <Text style={styles.desc}>Chaque achat ajoute 1 h (8 h au plus). Perdus au nouveau départ, comme les éclats.</Text>
      {BOOST_KINDS.map((k) => <BoostCard key={k} kind={k} />)}

      <Text style={styles.section}>Objets</Text>
      <View style={styles.card}>
        <Text style={styles.icon}>🍬</Text>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.name}>Méga bonbon universel · {s.universalMega ?? 0}</Text>
          <Text style={styles.desc}>+1 à un gène de n'importe quel Pokémon (fiche Pokémon). Conservé au nouveau départ.</Text>
        </View>
        <Button small label={`${UNIVERSAL_MEGA_PRICE}💎`} disabled={!canMega} color={canMega ? C.accent : C.panel2}
          onPress={() => { if (act((g) => buyUniversalMega(g))) { feedback('medal'); toast('+1 méga bonbon universel', C.gold); } }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shards: { backgroundColor: C.panel, borderRadius: 12, padding: 12, gap: 2 },
  shardsTxt: { color: C.gold, fontSize: 18, fontWeight: '900' },
  section: { color: C.text, fontSize: 15, fontWeight: '900', marginTop: 6 },
  panel: { backgroundColor: C.panel, borderRadius: 12, padding: 10, gap: 6 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.panel, borderRadius: 12, padding: 10 },
  cardOn: { borderWidth: 1, borderColor: C.gold },
  icon: { fontSize: 26 },
  name: { color: C.text, fontSize: 14, fontWeight: '800' },
  desc: { color: C.dim, fontSize: 12 },
  resTxt: { color: C.text, fontSize: 13, fontWeight: '700' },
  ballsRow: { flexDirection: 'row', gap: 6 },
  ballBuy: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, backgroundColor: C.panel2, borderRadius: 12, paddingVertical: 8 },
  price: { color: C.dim, fontSize: 10, fontWeight: '600' },
  bulkRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bulkBtn: { flex: 1, alignItems: 'center', backgroundColor: C.accent, borderRadius: 10, paddingVertical: 4 },
  bulkTxt: { color: C.text, fontSize: 13, fontWeight: '900' },
});
