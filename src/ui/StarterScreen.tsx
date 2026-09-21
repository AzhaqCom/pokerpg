import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { STARTERS } from '../game/content';
import { species } from '../game/data';
import { chooseStarter } from '../game/game';
import { AnimatedSprite } from '../sprites/AnimatedSprite';
import { rng, useGame } from '../store/game';
import { TypeBadge } from './components/TypeBadge';
import { feedback } from './components/feedback';
import { C } from './theme';

export function StarterScreen() {
  const act = useGame((g) => g.act);
  const { width } = useWindowDimensions();
  const w = Math.min(150, (width - 48) / 3);
  return (
    <View style={styles.root}>
      <Text style={styles.title}>Pokémon Lootborn</Text>
      <Text style={styles.sub}>Ton équipe se bat seule. À toi de la préparer : capacités, objets, talents, captures… et de lancer les boss.</Text>
      <Text style={styles.pick}>Choisis ton premier Pokémon</Text>
      <View style={styles.row}>
        {STARTERS.map((id) => {
          const sp = species(id);
          return (
            <Pressable key={id} style={({ pressed }) => [styles.card, { width: w, opacity: pressed ? 0.8 : 1 }]}
              onPress={() => { feedback('hatch', true); act((g) => chooseStarter(g, id, rng)); }}>
              <AnimatedSprite species={id} action="idle" width={w - 16} height={w - 16} />
              <Text style={styles.name}>{sp.name}</Text>
              <TypeBadge type={sp.types[0]} small />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16, gap: 14 },
  title: { color: C.gold, fontSize: 30, fontWeight: '900' },
  sub: { color: C.sub, textAlign: 'center', fontSize: 14, maxWidth: 360 },
  pick: { color: C.text, fontSize: 18, fontWeight: '800', marginTop: 12 },
  row: { flexDirection: 'row', gap: 8 },
  card: { alignItems: 'center', backgroundColor: C.panel, borderRadius: 18, padding: 8, gap: 4 },
  name: { color: C.text, fontWeight: '800' },
});
