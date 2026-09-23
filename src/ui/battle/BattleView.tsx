import { Canvas, Group, LinearGradient, Oval, Rect, RoundedRect, SkImage, useImage, vec } from '@shopify/react-native-skia';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Fighter } from '../../game/battle';
import { BIOMES } from '../../game/content';
import { ActionKey, attackFrameLimit, getSprite, resolveAction } from '../../sprites/manifest';
import { PmdSprite, totalMs } from '../../sprites/PmdSprite';
import { CaptureBar } from './CaptureBar';
import { STATUS_COLOR, STATUS_LABEL, runner } from './runner';

/** Positions (fractions du canvas) : front, puis arrière haut, arrière bas. */
const ALLY_POS = [{ x: 0.34, y: 0.74 }, { x: 0.17, y: 0.58 }, { x: 0.17, y: 0.92 }];
const ENEMY_POS = [{ x: 0.66, y: 0.74 }, { x: 0.83, y: 0.58 }, { x: 0.83, y: 0.92 }];

const SKIES: Record<string, [string, string, string]> = {
  meadow: ['#8fd3ff', '#d7f3ff', '#7cc16a'],
  forest: ['#5fae8b', '#b9e6c9', '#4e8f4a'],
  cave: ['#2b2f3a', '#4a5064', '#5b5350'],
  water: ['#4fc3f7', '#b3e5fc', '#0288d1'],
  electric: ['#4a3f7a', '#d8c9ff', '#3a3547'],
  swamp: ['#3d4a2f', '#8fae5c', '#2e3b1f'],
  temple: ['#5b4b8a', '#cdb8f0', '#3d3160'],
  volcano: ['#7a2e12', '#ffb066', '#2b1208'],
  desert: ['#d9a24a', '#f5dfb0', '#8a5a2b'],
};

/** Position minimale (px) de la barre de vie / du label niveau, par emplacement (avant / arrière-haut /
 * arrière-bas — index = `slot`, voir `ALLY_POS`/`ENEMY_POS`), pour qu'un très grand sprite (Onix,
 * Steelix, Lugia…) garde sa taille réelle sans pousser ces éléments hors du cadre par le haut — sa tête
 * peut dépasser/être coupée par le cadre, mais la barre de vie et le niveau restent toujours visibles.
 * Un plancher distinct par emplacement évite que deux géants côte à côte (arrière-haut/arrière-bas
 * partagent le même X) se retrouvent avec des barres superposées au même plancher. */
const HUD_MIN_TOP_BY_SLOT = [48, 22, 74];

/** Boucle d'affichage : fait avancer le combat et redessine ~30 fois par seconde. */
function useRunnerFrame() {
  const [, setTick] = useState(0);
  const last = useRef(0);
  useEffect(() => {
    let raf = 0;
    const loop = (t: number) => {
      const dt = last.current ? t - last.current : 16;
      if (dt >= 33) {
        last.current = t;
        runner.update(dt);
        setTick((n) => (n + 1) % 1e6);
      } else if (!last.current) last.current = t;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
}

function FighterSprite({ f, W, H, px }: { f: Fighter; W: number; H: number; px: number }) {
  const sprite = getSprite(f.speciesId, !!f.shiny)!;
  const image = useImage(sprite.asset);
  return <FighterDraw f={f} image={image} meta={sprite.meta} W={W} H={H} px={px} />;
}

function FighterDraw({ f, image, meta, W, H, px }: {
  f: Fighter; image: SkImage | null; meta: NonNullable<ReturnType<typeof getSprite>>['meta']; W: number; H: number; px: number;
}) {
  const anim = runner.anims[f.id];
  const run = runner.run;
  // `useImage` (Skia) charge le sprite de façon asynchrone : le combat peut déjà être terminé
  // (`runner.run` redevenu null) au moment où ce composant se re-rend avec l'image enfin prête.
  if (!anim || !run) return null;
  const clock = runner.clock;
  const side = f.side;
  const slot = run.battle.fighters.filter((x) => x.side === side).indexOf(f);
  const pos = (side === 0 ? ALLY_POS : ENEMY_POS)[slot] ?? ALLY_POS[0];
  const dir = side === 0 ? 'R' : 'L';
  let action: ActionKey = `idle${dir}`;
  let t = clock - anim.since;
  let loop = true;
  // le sommeil n'a été capturé que de face (pas de profil G/D) : on garde idleR/idleL en combat plutôt
  // que d'afficher un Pokémon qui semble tourner le dos. Repasser à `action = 'sleep'` pour revenir en arrière.
  if (anim.action !== 'idle') {
    const a = `${anim.action}${dir}` as ActionKey;
    if (t < totalMs(resolveAction(meta, a))) { action = a; loop = false; }
    else { anim.action = 'idle'; anim.since = clock; t = 0; }
  }
  const lunge = clock < anim.lungeUntil ? (side === 0 ? 1 : -1) * 14 * Math.sin(((anim.lungeUntil - clock) / 220) * Math.PI) : 0;
  const fade = anim.faintAt !== null ? Math.max(0, 1 - (clock - anim.faintAt) / 500) : 1;
  if (fade <= 0) return null;
  const s = f.boss ? px + 1 : px;
  const x = pos.x * W + lunge;
  const y = pos.y * H + (anim.faintAt !== null ? (1 - fade) * 10 : 0);
  const idle = meta.actions.idle!;
  const top = Math.max(HUD_MIN_TOP_BY_SLOT[slot] ?? 22, y - idle.fh * s - 8);
  const barW = Math.min(W * 0.17, 70);
  const hpPct = Math.max(0, f.hp / f.maxHp);
  return (
    <Group opacity={fade}>
      <Oval x={x - 18 * (s / 3)} y={y - 5} width={36 * (s / 3)} height={10} color="#000" opacity={0.2} />
      <PmdSprite image={image} meta={meta} action={action} t={t} loop={loop} x={x} y={y} scale={s}
        silhouette={clock < anim.flashUntil ? '#ffffff' : undefined} frameLimit={attackFrameLimit(f.speciesId, action)} />
      <RoundedRect x={x - barW / 2} y={top} width={barW} height={6} r={3} color="#1b1f2a" opacity={0.85} />
      <RoundedRect x={x - barW / 2 + 1} y={top + 1} width={(barW - 2) * hpPct} height={4} r={2}
        color={hpPct > 0.5 ? '#4caf50' : hpPct > 0.2 ? '#ffb300' : '#e53935'} />
    </Group>
  );
}

export function BattleView({ width }: { width: number }) {
  useRunnerFrame();
  const W = width;
  const H = Math.round(width * 0.62);
  const run = runner.run;
  const biomeZones = BIOMES[run?.biome ?? 0].zones;
  const zone = run ? biomeZones[Math.min(run.zone, biomeZones.length - 1)] : biomeZones[0];
  const [top, bottom, ground] = SKIES[run?.kind === 'arena' ? 'cave' : zone.biome];
  const fighters = run?.battle.fighters ?? [];
  const px = Math.max(3, Math.min(5, Math.round(H / 60)));

  return (
    <View style={{ width: W, height: H }}>
      <Canvas style={{ width: W, height: H }}>
        <Rect x={0} y={0} width={W} height={H}>
          <LinearGradient start={vec(0, 0)} end={vec(0, H * 0.5)} colors={[top, bottom]} />
        </Rect>
        <Rect x={0} y={H * 0.45} width={W} height={H * 0.55} color={ground} />
        <Oval x={-W * 0.1} y={H * 0.4} width={W * 1.2} height={H * 0.14} color={ground} />
        {fighters.map((f) => (
          <FighterSprite key={f.id} f={f} W={W} H={H} px={f.boss ? px : px} />
        ))}
      </Canvas>

      {/* nombres flottants, statuts, bandeau */}
      {fighters.map((f) => {
        if (!f.alive) return null;
        const side = f.side;
        const slot = fighters.filter((x) => x.side === side).indexOf(f);
        const pos = (side === 0 ? ALLY_POS : ENEMY_POS)[slot];
        const sprite = getSprite(f.speciesId, !!f.shiny)!;
        const s = f.boss ? px + 1 : px;
        const topY = Math.max((HUD_MIN_TOP_BY_SLOT[slot] ?? 22) - 18, pos.y * H - sprite.meta.actions.idle!.fh * s - 26);
        return (
          <View key={`lbl-${f.id}`} pointerEvents="none" style={[styles.label, { left: pos.x * W - 40, top: topY }]}>
            <Text style={styles.lv}>Nv.{f.level}{f.shiny ? ' ✨' : ''}</Text>
            {f.status && <Text style={[styles.status, { backgroundColor: STATUS_COLOR[f.status.kind] }]}>{STATUS_LABEL[f.status.kind]}</Text>}
          </View>
        );
      })}
      {runner.floaters.map((fl) => {
        const f = fighters.find((x) => x.id === fl.fighter);
        if (!f) return null;
        const slot = fighters.filter((x) => x.side === f.side).indexOf(f);
        const pos = (f.side === 0 ? ALLY_POS : ENEMY_POS)[slot];
        const k = (runner.clock - fl.t0) / 1000;
        return (
          <Text key={fl.id} pointerEvents="none" style={[styles.floater, fl.big && styles.floaterBig, {
            color: fl.color, left: pos.x * W - 40, top: pos.y * H - 70 - k * 40, opacity: 1 - k,
          }]}>{fl.text}</Text>
        );
      })}
      {runner.banner && runner.clock < runner.banner.until && (
        <View pointerEvents="none" style={styles.bannerWrap}>
          <Text style={[styles.banner, { borderColor: runner.banner.color }]}>{runner.banner.text}</Text>
        </View>
      )}
      {!run && <View style={styles.bannerWrap}><Text style={styles.banner}>Prochaine étape…</Text></View>}
      <CaptureBar />
    </View>
  );
}

const styles = StyleSheet.create({
  label: { position: 'absolute', width: 80, height: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 3 },
  lv: { color: '#fff', fontSize: 10, fontWeight: '800', textShadowColor: '#000', textShadowRadius: 3 },
  status: { color: '#111', fontSize: 8, fontWeight: '900', paddingHorizontal: 3, borderRadius: 3, overflow: 'hidden' },
  floater: { position: 'absolute', width: 80, textAlign: 'center', fontSize: 14, fontWeight: '900', textShadowColor: '#000', textShadowRadius: 3 },
  floaterBig: { fontSize: 19 },
  bannerWrap: { position: 'absolute', top: 10, left: 0, right: 0, alignItems: 'center' },
  banner: { color: '#fff', fontWeight: '900', fontSize: 15, backgroundColor: 'rgba(15,18,28,0.85)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: '#555', overflow: 'hidden' },
});
