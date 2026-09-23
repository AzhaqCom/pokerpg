import { StyleSheet, Text, View } from 'react-native';
import { species } from '../../game/data';
import { BALLS, BallKind, captureChance, captureLevel, tryCapture } from '../../game/game';
import { rng, useGame } from '../../store/game';
import { toast } from '../../store/ui';
import { BallIcon } from '../components/BallIcon';
import { Button } from '../components/Button';
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
  return (
    <View style={styles.bar} pointerEvents="box-none">
      <View style={styles.infoRow}>
        <MonThumb speciesId={offer.speciesId} shiny={offer.shiny} size={40} />
        <View style={styles.col}>
          <Text style={styles.title} numberOfLines={1}>{sp.name}</Text>
          <Text style={styles.sub}>Nv.{lvl}{!known ? ' · nouveau !' : ''}</Text>
        </View>
        <View style={styles.col}>
          <Text style={styles.sub}>{offer.rare ? 'Espèce rare\n(2× plus dur)' : 'Espèce commune'}</Text>
        </View>
        <Button small label="✕" onPress={() => { runner.offer = null; }} />
      </View>
      <View style={styles.ballRow}>
        {(Object.keys(BALLS) as BallKind[]).filter((b) => s.balls[b] > 0).map((b) => (
          <Button key={b} small icon={<BallIcon kind={b} size={16} />} label={`${s.balls[b]} · ${captureChance(offer, b)}%`} color={C.panel2} onPress={() => throwBall(b)} />
        ))}
        {!Object.values(s.balls).some((n) => n > 0) && <Text style={styles.sub}>Plus de Balls</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // en overlay absolu sur la zone de combat (voir BattleView) : ne doit jamais pousser le reste de l'UI
  // (listes de la boîte/du sac) quand une offre apparaît ou disparaît.
  bar: {
    position: 'absolute', left: 8, right: 8, bottom: 8, gap: 8,
    backgroundColor: 'rgba(31,58,43,0.94)', borderColor: '#69f0ae', borderWidth: 1, borderRadius: 14, padding: 8,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  col: { flex: 1 },
  ballRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  title: { color: C.text, fontWeight: '800', fontSize: 13 },
  sub: { color: C.sub, fontSize: 10 },
});
