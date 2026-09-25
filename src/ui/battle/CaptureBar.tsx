import { Pressable, StyleSheet, Text, View } from 'react-native';
import { species } from '../../game/data';
import { BALLS, BallKind, captureChance, captureLevel, tryCapture } from '../../game/game';
import { rng, useGame } from '../../store/game';
import { toast } from '../../store/ui';
import { BallIcon } from '../components/BallIcon';
import { MonThumb } from '../components/MonThumb';
import { feedback } from '../components/feedback';
import { C } from '../theme';
import { runner } from './runner';

/** Occasion de capture après une vague (valable jusqu'à la fin de la vague suivante). */
export function CaptureBar() {
  const s = useGame((g) => g.s)!;
  const act = useGame((g) => g.act);
  const offer = runner.offer?.capture;
  if (!offer) return null;
  const sp = species(offer.speciesId);
  const known = s.dex.caught.includes(offer.speciesId);
  const lvl = captureLevel(s, offer);
  const throwBall = (b: BallKind) => {
    runner.offer = null;
    const mon = act((g) => tryCapture(g, offer, b, rng));
    if (mon) { feedback('hatch', true); toast(`${sp.name} capturé !${s.team.includes(mon.uid) ? ' Il rejoint l’équipe.' : ' Il est dans ta boîte.'}`, '#69f0ae'); }
    else { feedback('deny'); toast(`${sp.name} s'est échappé…`, '#ff8a80'); }
  };
  // une seule ligne compacte (~44 px) : le combat reste visible derrière
  return (
    <View style={styles.bar} pointerEvents="box-none">
      <MonThumb speciesId={offer.speciesId} shiny={offer.shiny} size={28} />
      <View style={styles.col}>
        <Text style={styles.title} numberOfLines={1}>{sp.name} <Text style={styles.sub}>Nv.{lvl}</Text></Text>
        <View style={styles.tags}>
          {!known && <Text style={[styles.tag, styles.tagNew]}>nouveau</Text>}
          {offer.rare && <Text style={[styles.tag, styles.tagRare]}>rare</Text>}
        </View>
      </View>
      {(Object.keys(BALLS) as BallKind[]).filter((b) => s.balls[b] > 0).map((b) => (
        <Pressable key={b} onPress={() => throwBall(b)} style={styles.ball}>
          <BallIcon kind={b} size={16} />
          <View>
            <Text style={styles.pct}>{captureChance(offer, b, s)}%</Text>
            <Text style={styles.count}>×{s.balls[b]}</Text>
          </View>
        </Pressable>
      ))}
      {!Object.values(s.balls).some((n) => n > 0) && <Text style={styles.sub}>Plus de Balls</Text>}
      <Pressable hitSlop={8} onPress={() => { runner.offer = null; }} style={styles.close}>
        <Text style={styles.closeTxt}>✕</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // en overlay absolu sur la zone de combat (voir BattleView) : ne doit jamais pousser le reste de l'UI
  // (listes de la boîte/du sac) quand une offre apparaît ou disparaît.
  bar: {
    position: 'absolute', left: 6, right: 6, bottom: 6, flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(31,58,43,0.9)', borderColor: '#69f0ae', borderWidth: 1, borderRadius: 12, paddingHorizontal: 6, paddingVertical: 4,
  },
  col: { flex: 1, minWidth: 0 },
  title: { color: C.text, fontWeight: '800', fontSize: 12 },
  sub: { color: C.sub, fontSize: 10, fontWeight: '600' },
  tags: { flexDirection: 'row', gap: 3 },
  tag: { fontSize: 8, fontWeight: '900', paddingHorizontal: 4, borderRadius: 4, overflow: 'hidden', color: '#111' },
  tagNew: { backgroundColor: '#69f0ae' },
  tagRare: { backgroundColor: '#ffb300' },
  ball: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: C.panel2, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 3 },
  pct: { color: C.text, fontSize: 11, fontWeight: '800' },
  count: { color: C.dim, fontSize: 8, fontWeight: '700' },
  close: { paddingHorizontal: 4 },
  closeTxt: { color: C.sub, fontSize: 14, fontWeight: '900' },
});
