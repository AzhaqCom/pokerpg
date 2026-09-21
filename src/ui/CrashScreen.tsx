import { Component, ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { create } from 'zustand';

/** Erreur attrapée (rendu ou globale) : affichée à l'écran au lieu de fermer l'app. */
export const useCrash = create<{ error: string | null }>(() => ({ error: null }));

export function reportError(e: unknown, where = '') {
  const err = e instanceof Error ? `${e.name}: ${e.message}\n\n${e.stack ?? ''}` : String(e);
  console.error(where, err);
  if (!useCrash.getState().error) useCrash.setState({ error: `${where ? `[${where}] ` : ''}${err}` });
}

/** Remplace le gestionnaire global de RN : une erreur JS n'arrête plus l'app. */
export function installGlobalErrorHandler() {
  const g = globalThis as unknown as { ErrorUtils?: { setGlobalHandler: (h: (e: unknown, fatal?: boolean) => void) => void } };
  g.ErrorUtils?.setGlobalHandler((e, fatal) => reportError(e, fatal ? 'fatale' : 'globale'));
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e: unknown) { reportError(e, 'rendu'); }
  render() { return this.state.failed ? <CrashView /> : this.props.children; }
}

export function CrashView() {
  const error = useCrash((s) => s.error);
  return (
    <View style={styles.root}>
      <Text style={styles.title}>Oups, TamaPoké a rencontré une erreur</Text>
      <Text style={styles.sub}>Fais une capture de cet écran pour la corriger.</Text>
      <ScrollView style={styles.box}><Text selectable style={styles.err}>{error ?? 'Erreur inconnue'}</Text></ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1b1f2a', padding: 20, paddingTop: 60, gap: 10 },
  title: { color: '#fff', fontSize: 20, fontWeight: '800' },
  sub: { color: '#9aa3b8', fontSize: 14 },
  box: { flex: 1, backgroundColor: '#2a0f14', borderRadius: 12, padding: 12 },
  err: { color: '#ffb3b3', fontSize: 12, fontFamily: 'monospace' },
});
