import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../components/Text';
import { BIOMES, BiomeDef, REGIONS, REGION_START, STAGES_PER_ZONE, ZoneDef } from '../../game/content';
import { species } from '../../game/data';
import { SETS, TEMPLATES, setBonusText, setOfBiome } from '../../game/items';
import { GameState, arenaAvailable, biomeAvailable, bossAvailable, canPrestige, endgameUnlocked, selectStage, startPrestige, zoneHasTarget } from '../../game/game';
import { useGame } from '../../store/game';
import { Button } from '../components/Button';
import { Dialog, DialogSpec } from '../components/Dialog';
import { MonThumb } from '../components/MonThumb';
import { BallIcon } from '../components/BallIcon';
import { collectionNeeds } from '../../game/collection';
import { feedback } from '../components/feedback';
import { runner } from '../battle/runner';
import { C } from '../theme';
import { ZoneDex, zoneSpecies } from '../ZoneDex';
import { TowerSection } from '../TowerSection';
import { SLOT_ICON, templateStatText } from '../components/ItemCard';

/** Valeur de `sel` pour l'onglet de la Tour de Combat (les biomes sont numérotés à partir de 0). */
const TOWER_TAB = -1;

export function MapPanel() {
  const s = useGame((g) => g.s)!;
  useGame((g) => g.rev);
  const act = useGame((g) => g.act);
  const [openZone, setOpenZone] = useState<ZoneDef | null>(null);
  const [dialog, setDialog] = useState<DialogSpec | null>(null);
  const next = REGIONS[s.prestige + 1];
  // onglet affiché : un biome de la région, ou la Tour de Combat (fin de jeu, onglet après le dernier biome)
  const endgame = endgameUnlocked(s);
  const [sel, setSel] = useState(s.towerFloor !== null ? TOWER_TAB : s.biome);
  // la Carte ne montre que les biomes de la région courante : les biomes des régions précédentes
  // (Kanto une fois en Johto) n'ont plus leur place, ceux des régions futures restent une surprise.
  const regionStart = REGION_START[s.prestige] ?? 0;
  const regionEnd = REGION_START[s.prestige + 1] ?? BIOMES.length;
  const bi = sel >= regionStart && sel < regionEnd ? sel : s.biome;
  const showTower = endgame && sel === TOWER_TAB;
  const tab = showTower ? TOWER_TAB : bi;
  // suit le biome en cours : après une victoire d'arène, la Carte affiche directement le nouveau biome. Seulement sur un
  // vrai changement de biome, et jamais pendant un combat dans la Tour : avant le 2026-10-01, cet effet tournait aussi à
  // l'ouverture de la Carte et remplaçait l'onglet de la Tour par le biome (Boutique → Carte en pleine Tour).
  const lastBiome = useRef(s.biome);
  useEffect(() => {
    if (lastBiome.current === s.biome) return;
    lastBiome.current = s.biome;
    if (s.towerFloor === null) setSel(s.biome);
  }, [s.biome, s.towerFloor]);
  // la barre des biomes défile jusqu'à l'onglet affiché (sinon il peut être hors de l'écran, à droite)
  const tabsRef = useRef<ScrollView>(null);
  const tabX = useRef<Record<number, number>>({});
  useEffect(() => {
    const x = tabX.current[tab];
    if (x !== undefined) tabsRef.current?.scrollTo({ x: Math.max(0, x - 24), animated: true });
  }, [tab]);
  return (
    <View style={{ gap: 12 }}>
      {/* prestige reporté (« Plus tard » sur le récap) : se lance d'ici, quand le joueur le souhaite */}
      {next && s.prestigeOffered && canPrestige(s) && (
        <Button label={`🏆 Nouveau départ à ${next.name}`} color="#ffb300" onPress={() => setDialog({
          title: `Partir pour ${next.name} ?`,
          message: 'Équipe, boîte, objets, badges et Pokédex repartent à zéro. Seuls tes bonbons et méga bonbons restent acquis.',
          primary: { label: 'Nouveau départ', onPress: () => { act((g) => startPrestige(g)); runner.newGame(); feedback('evolve'); } },
          secondary: { label: 'Annuler', onPress: () => {} },
        })} />
      )}
      <Dialog spec={dialog} onClose={() => setDialog(null)} />
      <ScrollView ref={tabsRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {BIOMES.slice(regionStart, regionEnd).map((biome, localI) => {
          const i = regionStart + localI;
          const unlocked = biomeAvailable(s, i);
          const done = s.arenaBeaten[i];
          return (
            <Pressable key={biome.name} disabled={!unlocked} onPress={() => setSel(i)}
              onLayout={(e) => {
                tabX.current[i] = e.nativeEvent.layout.x;
                if (i === tab) tabsRef.current?.scrollTo({ x: Math.max(0, e.nativeEvent.layout.x - 24), animated: false });
              }}
              style={[styles.tab, i === tab && styles.tabOn, !unlocked && styles.tabLocked]}>
              <Text style={[styles.tabTxt, i === tab && styles.tabTxtOn]} numberOfLines={1}>
                {unlocked ? (done ? '✔ ' : '') : '🔒 '}{biome.name}
              </Text>
            </Pressable>
          );
        })}
        {endgame && (
          <Pressable onPress={() => setSel(TOWER_TAB)}
            onLayout={(e) => {
              tabX.current[TOWER_TAB] = e.nativeEvent.layout.x;
              if (showTower) tabsRef.current?.scrollTo({ x: Math.max(0, e.nativeEvent.layout.x - 24), animated: false });
            }}
            style={[styles.tab, showTower && styles.tabOn]}>
            <Text style={[styles.tabTxt, showTower && styles.tabTxtOn]} numberOfLines={1}>
              🗼 Tour de Combat{s.towerRewards.length ? ` 🎁${s.towerRewards.length}` : ''}
            </Text>
          </Pressable>
        )}
      </ScrollView>
      {showTower ? <TowerSection /> : <BiomeSection biome={BIOMES[bi]} bi={bi} s={s} act={act} onOpenZone={setOpenZone} />}
      <ZoneDex zone={openZone} s={s} onClose={() => setOpenZone(null)} />
    </View>
  );
}

/**
 * État de collection d'une espèce, pour les pastilles de la Carte. Normal : Poké Ball grisée = vu mais pas possédé,
 * Poké Ball = possédé au moins une fois, Hyper Ball = tout ce qu'il faut (Pokédex et boîte, matière des évolutions
 * comprise, voir `collectionNeeds`). Chromatique : ☆ gris = aucun, ★ doré = au moins un, ✨ = complet.
 */
function collectionState(s: GameState) {
  const owned = new Set<number>();
  const ownedShiny = new Set<number>();
  for (const m of Object.values(s.mons)) (m.shiny ? ownedShiny : owned).add(m.speciesId);
  return { owned, ownedShiny, need: collectionNeeds(s, false), needShiny: collectionNeeds(s, true) };
}

function ZoneMon({ id, s, col }: { id: number; s: GameState; col: ReturnType<typeof collectionState> }) {
  const seen = s.dex.seen.includes(id);
  const has = col.owned.has(id);
  const done = has && s.dex.caught.includes(id) && (col.need.get(id) ?? 0) === 0;
  const hasShiny = col.ownedShiny.has(id);
  const shinyDone = hasShiny && (col.needShiny.get(id) ?? 0) === 0;
  return (
    <View style={styles.zoneMon}>
      <MonThumb speciesId={id} size={30} silhouette={!seen} />
      {seen && <View style={styles.ball}><BallIcon kind={done ? 'hyper' : 'poke'} size={17} grey={!has} /></View>}
      {seen && <Text style={[styles.star, { color: hasShiny ? C.gold : C.dim }]}>{shinyDone ? '✨' : hasShiny ? '★' : '☆'}</Text>}
    </View>
  );
}

/** Panoplie dont tombent les objets du biome (sauvages et boss) et ses bonus : le joueur sait quoi farmer où. */
function BiomeSetCard({ bi }: { bi: number }) {
  // accordéon : une ligne fermée (pas de place perdue au-dessus des zones), le détail au toucher
  const [open, setOpen] = useState(false);
  const key = setOfBiome(bi);
  const set = key ? SETS[key] : undefined;
  if (!key || !set) return null;
  const zones = BIOMES[bi].zones;
  const lvl = zones[zones.length - 1].maxLv;
  const order = { offense: 0, defense: 1, berry: 2 };
  const pieces = TEMPLATES.filter((t) => t.set === key).sort((a, b) => order[a.slot] - order[b.slot]);
  return (
    <Pressable onPress={() => { feedback(); setOpen((v) => !v); }} style={[styles.zone, styles.setCard]}>
      <View style={styles.row}>
        <Text style={[styles.zoneName, { flex: 1 }]}>🎒 Panoplie : {set.name}</Text>
        <Text style={styles.sub}>{open ? '▾' : '▸'}</Text>
      </View>
      {open && (
        <>
          {pieces.map((p) => (
            <Text key={p.id} style={styles.sub}>{SLOT_ICON[p.slot]} {p.name} — <Text style={styles.setStat}>{templateStatText(p)}</Text></Text>
          ))}
          {/* bonus au niveau des objets du biome (ils grimpent avec le niveau de la pièce la plus basse portée) */}
          <Text style={styles.setBonus}>2 pièces : {setBonusText(key, 'two', lvl)}</Text>
          <Text style={styles.setBonus}>3 pièces : {setBonusText(key, 'three', lvl)}</Text>
          <Text style={styles.sub}>Valeurs pour des objets Nv.{lvl} : les bonus grimpent avec le niveau des pièces (la plus basse compte).</Text>
        </>
      )}
    </Pressable>
  );
}

function BiomeSection({ biome, bi, s, act, onOpenZone }: {
  biome: BiomeDef; bi: number; s: GameState; act: <T>(fn: (g: GameState) => T) => T | undefined;
  onOpenZone: (z: ZoneDef) => void;
}) {
  const col = collectionState(s);
  return (
    <View style={{ gap: 10 }}>
      <BiomeSetCard key={bi} bi={bi} />
      {biome.zones.map((z, zi) => {
        const zoneUnlocked = s.unlocked[bi][zi] ?? 0;
        const locked = zoneUnlocked < 1;
        return (
          <View key={z.name} style={[styles.zone, locked && { opacity: 0.45 }]}>
            <Pressable disabled={locked} onPress={() => onOpenZone(z)}>
              <View style={styles.row}>
                <Text style={styles.zoneName}>{zoneHasTarget(s, bi, zi) ? '🎯 ' : ''}{z.name}</Text>
                <Text style={styles.sub}>Niv. {z.minLv}–{z.maxLv}</Text>
                {s.bossesBeaten[bi][zi] && <Text style={styles.done}>✔ boss</Text>}
              </View>
            </Pressable>
            {/* toucher les Pokémon de la zone ouvre le même récapitulatif que le nom de la zone */}
            <Pressable disabled={locked} onPress={() => onOpenZone(z)} style={styles.row}>
              {z.pool.map(([id]) => <ZoneMon key={id} id={id} s={s} col={col} />)}
              {z.boss.joinsPool && s.bossesBeaten[bi][zi] && <ZoneMon key={z.boss.speciesId} id={z.boss.speciesId} s={s} col={col} />}
            </Pressable>
            <View style={styles.row}>
              {Array.from({ length: STAGES_PER_ZONE }, (_, i) => i + 1).map((st) => {
                const cur = s.biome === bi && s.zone === zi && s.stage === st;
                const ok = st <= zoneUnlocked;
                return (
                  <Pressable key={st} disabled={!ok} onPress={() => { feedback(); act((g) => selectStage(g, bi, zi, st)); runner.restart(); }}
                    style={[styles.stage, ok && styles.stageOk, cur && styles.stageCur]}>
                    <Text style={styles.stageTxt}>{st}</Text>
                  </Pressable>
                );
              })}
              {!s.bossesBeaten[bi][zi] && (
                <Button small label={`Boss : ${species(z.boss.speciesId).name} Nv.${z.boss.level}`} color={bossAvailable(s, bi, zi) ? '#c62828' : C.panel2}
                  disabled={!bossAvailable(s, bi, zi)} onPress={() => { feedback('tap', true); act((g) => selectStage(g, bi, zi, STAGES_PER_ZONE, false)); runner.request('boss'); }} />
              )}
            </View>
            {s.fixedStage !== null && s.biome === bi && s.zone === zi && (
              <Text style={styles.sub}>📌 Étape fixée : {Math.min(s.fixedStage, zoneUnlocked)} (réglage « Avancer dans les étapes » désactivé)</Text>
            )}
            {!locked && !bossAvailable(s, bi, zi) && !s.bossesBeaten[bi][zi] && <Text style={styles.sub}>Termine l'étape 5 pour affronter le boss.</Text>}
          </View>
        );
      })}
      <View style={[styles.zone, !arenaAvailable(s, bi) && { opacity: 0.5 }]}>
        <Text style={styles.zoneName}>{biome.arena.name} · {biome.arena.leader} ({biome.arena.type})</Text>
        <View style={styles.row}>
          {biome.arena.team.map(([id, lv], i) => (
            <View key={i} style={{ alignItems: 'center' }}>
              <MonThumb speciesId={id} size={36} silhouette={!s.dex.seen.includes(id)} />
              <Text style={styles.sub}>Nv.{lv}</Text>
            </View>
          ))}
        </View>
        {s.arenaBeaten[bi] ? <Text style={styles.done}>✔ {biome.arena.badge} obtenu</Text> : (
          <Button label={arenaAvailable(s, bi) ? 'Défier l’arène' : 'Bats les 3 boss pour défier l’arène'} color={arenaAvailable(s, bi) ? '#ef6c00' : C.panel2}
            disabled={!arenaAvailable(s, bi)} onPress={() => { feedback('tap', true); act((g) => { g.biome = bi; }); runner.request('arena'); }} />
        )}
        <Text style={styles.sub}>Combat enchaîné : ton équipe ne récupère pas entre les Pokémon du champion.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: 8, paddingRight: 4 },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, backgroundColor: C.panel, maxWidth: 160 },
  tabOn: { backgroundColor: C.accent },
  tabLocked: { opacity: 0.4 },
  tabTxt: { color: C.sub, fontWeight: '700', fontSize: 13 },
  tabTxtOn: { color: C.text },
  zone: { backgroundColor: C.panel, borderRadius: 14, padding: 12, gap: 8 },
  setCard: { gap: 3, borderWidth: 1, borderColor: '#ffb30055' },
  setBonus: { color: '#ffcc80', fontSize: 12, fontWeight: '700' },
  setStat: { color: C.text, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  zoneName: { color: C.text, fontWeight: '800', fontSize: 15 },
  sub: { color: C.sub, fontSize: 12 },
  done: { color: '#69f0ae', fontWeight: '800', fontSize: 12 },
  stage: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.panel2, alignItems: 'center', justifyContent: 'center', opacity: 0.5 },
  stageOk: { opacity: 1 },
  stageCur: { backgroundColor: C.accent },
  stageTxt: { color: C.text, fontWeight: '800' },
  zoneMon: { width: 32, height: 32 },
  ball: { position: 'absolute', right: -3, bottom: -3 },
  star: { position: 'absolute', left: -2, bottom: -3, fontSize: 10, fontWeight: '900' },
  progRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  progLabel: { color: C.sub, fontSize: 10, fontWeight: '700', width: 76 },
  progTrack: { flex: 1, height: 5, backgroundColor: C.panel2, borderRadius: 3, overflow: 'hidden' },
  progFill: { height: '100%', backgroundColor: '#42a5f5' },
  progFillGold: { backgroundColor: '#ffca28' },
});
