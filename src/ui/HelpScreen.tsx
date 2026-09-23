import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PType } from '../game/data';
import { AURA, SPECIALTY, SPECIALTY2 } from '../game/talents';
import { TYPE_COLOR, typeLabel } from './helpers';
import { TypeBadge } from './components/TypeBadge';
import { C } from './theme';

const TYPES = Object.keys(TYPE_COLOR) as PType[];

/** Modale d'aide (ouverte depuis les Réglages) : tableaux récapitulatifs des auras et des talents
 * spécifiques à chaque type, pour ne pas avoir à rouvrir 16 fiches Pokémon pour comparer. */
export function HelpScreen({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.centerWrap} pointerEvents="box-none">
        <View style={styles.box}>
          <Text style={styles.title}>Aide</Text>
          <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: 18 }}>
            <View style={{ gap: 8 }}>
              <Text style={styles.section}>Auras par type</Text>
              <Text style={styles.hint}>
                Chaque Pokémon donne son bonus à toute l'équipe qui combat, selon son type principal :
                pleine valeur s'il est dans l'équipe, moitié s'il est posté en pension ou en exploration.
                Les bonus du même type s'additionnent entre plusieurs Pokémon.
              </Text>
              {TYPES.map((t) => (
                <View key={t} style={styles.row}>
                  <TypeBadge type={t} />
                  <Text style={styles.cell}>{AURA[t].label} +{AURA[t].value} %</Text>
                </View>
              ))}
            </View>

            <View style={{ gap: 8 }}>
              <Text style={styles.section}>Talents communs à tous les types</Text>
              <Text style={styles.hint}>
                Paliers 1-2 (0/5 points) : Puissance {'('}dégâts du type{')'}, Vigueur (PV), Garde
                (Défense), Réflexes (Vitesse). Paliers 4-5 (20/40 points) : Affinité I et II, un type au
                choix (hors des siens, présent dans son movepool) à booster. Paliers 8-9 (80/90 points) :
                Fureur (Attaque), Précision mortelle (Critique).
              </Text>
            </View>

            <View style={{ gap: 8 }}>
              <Text style={styles.section}>Spécialité par type (palier 3, 10 points)</Text>
              {TYPES.map((t) => (
                <View key={t} style={styles.row}>
                  <TypeBadge type={t} />
                  <Text style={styles.cell}>{SPECIALTY[t].name} · {SPECIALTY[t].describe(SPECIALTY[t].perRank)}</Text>
                </View>
              ))}
            </View>

            <View style={{ gap: 8 }}>
              <Text style={styles.section}>Spécialité II par type (palier 6, 60 points)</Text>
              {TYPES.map((t) => (
                <View key={t} style={styles.row}>
                  <TypeBadge type={t} />
                  <Text style={styles.cell}>{SPECIALTY2[t].name} · {SPECIALTY2[t].describe(SPECIALTY2[t].perRank)}</Text>
                </View>
              ))}
              <Text style={styles.hint}>
                Palier 7 (70 points) : un Pokémon bi-type reprend la Spécialité (palier 3) de son 2e
                type ; un mono-type double le rang de sa Spécialité II à la place.
              </Text>
            </View>
          </ScrollView>
          <Pressable onPress={onClose} style={styles.close}>
            <Text style={styles.closeTxt}>Fermer</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)' },
  centerWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', padding: 24 },
  box: { backgroundColor: C.panel, borderRadius: 18, padding: 18, gap: 14, maxHeight: '85%' },
  title: { color: C.text, fontSize: 20, fontWeight: '900' },
  section: { color: C.gold, fontSize: 15, fontWeight: '800' },
  hint: { color: C.dim, fontSize: 12, lineHeight: 17 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cell: { color: C.text, fontSize: 12, flex: 1 },
  close: { backgroundColor: C.panel2, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  closeTxt: { color: C.text, fontWeight: '700', fontSize: 15 },
});
