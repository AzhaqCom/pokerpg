import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { initMusic, setMusicEnabled } from './src/audio/music';
import { initSfx, setSfxEnabled } from './src/audio/sfx';
import { canEvolve, canPrestige, explorationReady, fusionBadgeCount, pensionXpReady, touchLastActive } from './src/game/game';
import { IdleGains, computeIdleGains } from './src/game/idle';
import { rng, useGame } from './src/store/game';
import { useSettings } from './src/store/settings';
import { Tab, useUi } from './src/store/ui';
import { CrashView, ErrorBoundary, useCrash, reportError } from './src/ui/CrashScreen';
import { IdleSummary } from './src/ui/IdleSummary';
import { PrestigeOffer } from './src/ui/PrestigeOffer';
import { BattleView } from './src/ui/battle/BattleView';
import { HudBottom, HudTop } from './src/ui/battle/Hud';
import { runner } from './src/ui/battle/runner';
import { MonSheet } from './src/ui/MonSheet';
import { StarterScreen } from './src/ui/StarterScreen';
import { Toasts } from './src/ui/components/Toasts';
import { BagPanel } from './src/ui/panels/BagPanel';
import { DexPanel } from './src/ui/panels/DexPanel';
import { ExplorationPanel } from './src/ui/panels/ExplorationPanel';
import { MapPanel } from './src/ui/panels/MapPanel';
import { PensionPanel } from './src/ui/panels/PensionPanel';
import { TeamPanel } from './src/ui/panels/TeamPanel';
import { C } from './src/ui/theme';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'team', label: 'Équipe', icon: '👥' },
  { key: 'bag', label: 'Sac', icon: '🎒' },
  { key: 'map', label: 'Carte', icon: '🗺' },
  { key: 'pension', label: 'Pension', icon: '🏡' },
  { key: 'exploration', label: 'Exploration', icon: '🧭' },
  { key: 'dex', label: 'Pokédex', icon: '📕' },
];

/** Calcule les gains hors ligne depuis `lastActive`, marque l'instant présent comme nouvelle activité. */
function checkIdle(onGains: (g: IdleGains) => void) {
  const s = useGame.getState().s;
  if (!s || !s.starterChosen) return;
  const now = Date.now();
  const { idleAutoRecycle, idleRecycleMaxRarity } = useSettings.getState();
  const gains = computeIdleGains(s, now - s.lastActive, rng, { autoRecycle: idleAutoRecycle, recycleMaxRarity: idleRecycleMaxRarity });
  useGame.getState().act((g) => touchLastActive(g, now));
  if (gains) { runner.paused = true; onGains(gains); }
}

function useBoot(onIdleGains: (g: IdleGains) => void) {
  useEffect(() => {
    (async () => {
      try {
        await useSettings.getState().load();
        await initSfx();
        setSfxEnabled(useSettings.getState().sound);
        await initMusic();
        setMusicEnabled(useSettings.getState().music);
        await useGame.getState().load();
        checkIdle(onIdleGains);
      } catch (e) { reportError(e, 'démarrage'); }
    })();
    const unsub = useSettings.subscribe((st) => setSfxEnabled(st.sound));
    const unsubMusic = useSettings.subscribe((st) => setMusicEnabled(st.music));
    let wasActive = true;
    const sub = AppState.addEventListener('change', (st) => {
      runner.paused = st !== 'active';
      if (st === 'active') {
        if (!wasActive) checkIdle(onIdleGains);
      } else if (wasActive) {
        useGame.getState().act((g) => touchLastActive(g));
      }
      wasActive = st === 'active';
    });
    return () => { unsub(); unsubMusic(); sub.remove(); };
  }, []);
}

function Main() {
  const { width } = useWindowDimensions();
  const tab = useUi((u) => u.tab);
  const setTab = useUi((u) => u.setTab);
  const s = useGame((g) => g.s)!;
  useGame((g) => g.rev);
  const badge: Partial<Record<Tab, number>> = {
    team: s.team.filter((u) => canEvolve(s.mons[u])).length,
    bag: fusionBadgeCount(s),
    pension: pensionXpReady(s) > 0 ? 1 : 0,
    exploration: explorationReady(s) > 0 ? 1 : 0,
  };
  return (
    <View style={{ flex: 1 }}>
      <HudTop />
      <BattleView width={width} />
      <View style={{ height: 6 }} />
      <HudBottom />
      {tab === 'bag' || tab === 'team' ? (
        // listes virtualisées (FlatList) : ne doivent jamais être imbriquées dans le ScrollView ci-dessous
        <View style={{ flex: 1 }}>{tab === 'bag' ? <BagPanel /> : <TeamPanel />}</View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.panel}>
          {tab === 'map' && <MapPanel />}
          {tab === 'pension' && <PensionPanel />}
          {tab === 'exploration' && <ExplorationPanel />}
          {tab === 'dex' && <DexPanel />}
        </ScrollView>
      )}
      <View style={styles.tabs}>
        {TABS.map((t) => (
          <Pressable key={t.key} onPress={() => setTab(t.key)} style={[styles.tab, tab === t.key && styles.tabOn]}>
            <Text style={styles.tabIcon}>{t.icon}</Text>
            <Text style={[styles.tabTxt, tab === t.key && { color: C.text }]}>{t.label}</Text>
            {!!badge[t.key] && <View style={styles.dot}><Text style={styles.dotTxt}>{badge[t.key]}</Text></View>}
          </Pressable>
        ))}
      </View>
      <MonSheet />
    </View>
  );
}

function Root() {
  const [idleGains, setIdleGains] = useState<IdleGains | null>(null);
  useBoot(setIdleGains);
  const insets = useSafeAreaInsets();
  const s = useGame((g) => g.s);
  useGame((g) => g.rev);
  // condition remplie -> jeu réellement coupé, quel que soit le chemin qui y a mené (combat normal ou
  // debug) ; pas seulement au moment précis de la victoire (le runner est un singleton, sa pause doit
  // suivre l'état du jeu, pas un événement ponctuel qu'un Fast Refresh pourrait manquer). Aucun moyen de
  // fermer l'écran sans accepter le nouveau départ : un vrai palier de fin, pas une simple bannière.
  const offerPrestige = !!s && s.starterChosen && canPrestige(s);
  useEffect(() => { if (offerPrestige) runner.paused = true; }, [offerPrestige]);
  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style="light" />
      {!s ? <Text style={styles.loading}>Chargement…</Text> : !s.starterChosen ? <StarterScreen /> : <Main />}
      <Toasts />
      <IdleSummary gains={idleGains} onClose={() => setIdleGains(null)} />
      {offerPrestige && <PrestigeOffer onClose={() => {}} />}
    </View>
  );
}

export default function App() {
  const crashed = useCrash((c) => c.error !== null);
  return (
    <SafeAreaProvider>
      <ErrorBoundary>{crashed ? <CrashView /> : <Root />}</ErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  loading: { color: C.sub, textAlign: 'center', marginTop: 80 },
  tabs: { flexDirection: 'row', marginTop: 8, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.line },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 6 },
  tabOn: { backgroundColor: C.panel },
  tabIcon: { fontSize: 16 },
  tabTxt: { color: C.sub, fontSize: 11, fontWeight: '700' },
  dot: { position: 'absolute', top: 2, right: 12, backgroundColor: C.accent, borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  dotTxt: { color: '#fff', fontSize: 10, fontWeight: '900' },
  panel: { padding: 12, paddingBottom: 40 },
});
