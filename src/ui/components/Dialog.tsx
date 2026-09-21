import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { C } from '../theme';
import { Button } from './Button';

export interface DialogSpec {
  title: string;
  message?: string;
  primary: { label: string; color?: string; textColor?: string; onPress: () => void };
  secondary?: { label: string; onPress: () => void };
}

/** Dialogue de décision à deux choix (évoluer / garder sa forme, etc.). */
export function Dialog({ spec, onClose }: { spec: DialogSpec | null; onClose: () => void }) {
  return (
    <Modal visible={!!spec} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.box} onPress={() => {}}>
          {spec && (
            <>
              <Text style={styles.title}>{spec.title}</Text>
              {spec.message ? <Text style={styles.msg}>{spec.message}</Text> : null}
              <Button label={spec.primary.label} color={spec.primary.color ?? C.accent} textColor={spec.primary.textColor}
                onPress={() => { onClose(); spec.primary.onPress(); }} />
              {spec.secondary && (
                <Button label={spec.secondary.label} onPress={() => { onClose(); spec.secondary!.onPress(); }} />
              )}
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 28 },
  box: { backgroundColor: C.panel, borderRadius: 20, padding: 20, gap: 12 },
  title: { color: C.text, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  msg: { color: C.sub, fontSize: 15, textAlign: 'center', marginBottom: 4 },
});
