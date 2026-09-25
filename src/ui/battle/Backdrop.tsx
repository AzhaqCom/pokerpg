/**
 * Décors abstraits du combat, par type de zone (`ZoneDef.biome`) et pour les arènes : formes simples, fixes (aucune
 * animation) et peu contrastées, pour habiller le fond sans gêner la lecture des sprites. `BackdropBack` se dessine
 * derrière le sol (horizon), `BackdropFront` sur le sol, toujours sous les combattants.
 */
import { Circle, Group, Oval, Path, Rect, RoundedRect } from '@shopify/react-native-skia';
import { memo } from 'react';

export type BackdropKind = 'meadow' | 'forest' | 'cave' | 'water' | 'electric' | 'swamp' | 'temple' | 'volcano' | 'desert'
  | 'league' | 'dojo' | 'haunted' | 'arena';

/** Ligne d'horizon (fraction de la hauteur) : le sol commence à 0,45 (voir BattleView). */
const HORIZON = 0.46;

function Cloud({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <Group color="#ffffff" opacity={0.75}>
      <Oval x={x} y={y + s * 0.25} width={s * 1.6} height={s * 0.55} />
      <Circle cx={x + s * 0.5} cy={y + s * 0.3} r={s * 0.32} />
      <Circle cx={x + s * 0.95} cy={y + s * 0.25} r={s * 0.4} />
    </Group>
  );
}

/** Triangle (sapin, stalactite, cône) : pointe en (x, tip), base centrée de largeur w à la hauteur base. */
const tri = (x: number, tip: number, base: number, w: number) => `M${x} ${tip} L${x + w / 2} ${base} L${x - w / 2} ${base} Z`;

export const BackdropBack = memo(function BackdropBack({ kind, W, H }: { kind: BackdropKind; W: number; H: number }) {
  const hz = H * HORIZON;
  switch (kind) {
    case 'meadow':
      return (
        <Group>
          <Cloud x={W * 0.08} y={H * 0.06} s={W * 0.1} />
          <Cloud x={W * 0.55} y={H * 0.02} s={W * 0.08} />
          <Cloud x={W * 0.8} y={H * 0.14} s={W * 0.07} />
          <Oval x={-W * 0.15} y={hz - H * 0.12} width={W * 0.7} height={H * 0.3} color="#6aad5b" />
          <Oval x={W * 0.45} y={hz - H * 0.09} width={W * 0.75} height={H * 0.26} color="#74b864" />
          {/* quelques arbres lointains sur la droite */}
          {[0.74, 0.8, 0.87, 0.93].map((fx, i) => (
            <Group key={i} opacity={0.9}>
              <Rect x={W * fx - 1.5} y={hz - H * (0.1 + (i % 2) * 0.02)} width={3} height={H * 0.06} color="#4a5a33" />
              <Circle cx={W * fx} cy={hz - H * (0.12 + (i % 2) * 0.02)} r={W * (0.028 + (i % 2) * 0.006)} color="#4f8f47" />
            </Group>
          ))}
        </Group>
      );
    case 'forest':
      return (
        <Group>
          {[0.04, 0.14, 0.27, 0.38, 0.62, 0.73, 0.86, 0.96].map((fx, i) => (
            <Path key={i} path={tri(W * fx, hz - H * (0.2 + (i % 3) * 0.05), hz + 2, W * 0.1)} color="#3f7a45" opacity={0.85} />
          ))}
          {[0.2, 0.5, 0.8].map((fx, i) => (
            <Group key={`r${i}`}>
              <Rect x={W * fx - 2} y={hz - H * 0.1} width={4} height={H * 0.1} color="#4a3a28" opacity={0.7} />
              <Circle cx={W * fx} cy={hz - H * 0.14} r={W * 0.045} color="#4c8c50" opacity={0.85} />
            </Group>
          ))}
        </Group>
      );
    case 'cave':
      return (
        <Group>
          {[0.05, 0.16, 0.3, 0.44, 0.58, 0.7, 0.83, 0.95].map((fx, i) => (
            <Path key={i} path={`M${W * fx - W * 0.035} 0 L${W * fx + W * 0.035} 0 L${W * fx} ${H * (0.08 + (i % 3) * 0.04)} Z`} color="#1c1f27" opacity={0.8} />
          ))}
          <Oval x={-W * 0.05} y={hz - H * 0.08} width={W * 0.35} height={H * 0.18} color="#403a38" />
          <Oval x={W * 0.7} y={hz - H * 0.06} width={W * 0.4} height={H * 0.15} color="#453f3c" />
        </Group>
      );
    case 'water':
      return (
        <Group>
          <Cloud x={W * 0.65} y={H * 0.05} s={W * 0.09} />
          <Rect x={0} y={hz - H * 0.07} width={W} height={H * 0.08} color="#29a3e0" opacity={0.7} />
          {[0.1, 0.35, 0.6, 0.85].map((fx, i) => (
            <RoundedRect key={i} x={W * fx} y={hz - H * 0.045 + (i % 2) * 4} width={W * 0.08} height={2} r={1} color="#ffffff" opacity={0.5} />
          ))}
        </Group>
      );
    case 'electric':
      return (
        <Group>
          {[0.18, 0.8].map((fx, i) => (
            <Group key={i} color="#2a2538" opacity={0.85}>
              <Rect x={W * fx - 2} y={hz - H * 0.3} width={4} height={H * 0.3} />
              <Rect x={W * fx - W * 0.05} y={hz - H * 0.27} width={W * 0.1} height={3} />
              <Rect x={W * fx - W * 0.035} y={hz - H * 0.2} width={W * 0.07} height={3} />
            </Group>
          ))}
          <Path path={`M${W * 0.18 + W * 0.05} ${hz - H * 0.26} Q${W * 0.5} ${hz - H * 0.18} ${W * 0.8 - W * 0.05} ${hz - H * 0.26}`}
            style="stroke" strokeWidth={1.5} color="#2a2538" opacity={0.7} />
          <Path path={`M${W * 0.52} ${H * 0.03} L${W * 0.47} ${H * 0.13} L${W * 0.51} ${H * 0.13} L${W * 0.45} ${H * 0.25} L${W * 0.56} ${H * 0.1} L${W * 0.52} ${H * 0.1} L${W * 0.57} ${H * 0.03} Z`}
            color="#ffe066" opacity={0.55} />
        </Group>
      );
    case 'swamp':
      return (
        <Group>
          {[0.1, 0.9].map((fx, i) => (
            <Group key={i} color="#26301a" opacity={0.8}>
              <Rect x={W * fx - 3} y={hz - H * 0.22} width={6} height={H * 0.22} />
              <Path path={`M${W * fx} ${hz - H * 0.16} L${W * fx + W * (i ? -0.06 : 0.06)} ${hz - H * 0.24}`} style="stroke" strokeWidth={3} />
              <Path path={`M${W * fx} ${hz - H * 0.1} L${W * fx + W * (i ? 0.05 : -0.05)} ${hz - H * 0.17}`} style="stroke" strokeWidth={2} />
            </Group>
          ))}
          <Oval x={W * 0.25} y={hz - H * 0.05} width={W * 0.5} height={H * 0.1} color="#5c7040" opacity={0.6} />
        </Group>
      );
    case 'temple':
      return (
        <Group color="#e8dcff" opacity={0.35}>
          {[0.08, 0.24, 0.76, 0.92].map((fx, i) => (
            <Group key={i}>
              <Rect x={W * fx - W * 0.025} y={hz - H * 0.3} width={W * 0.05} height={H * 0.3} />
              <Rect x={W * fx - W * 0.04} y={hz - H * 0.32} width={W * 0.08} height={H * 0.03} />
            </Group>
          ))}
          <Rect x={W * 0.04} y={hz - H * 0.35} width={W * 0.24} height={H * 0.03} />
          <Rect x={W * 0.72} y={hz - H * 0.35} width={W * 0.24} height={H * 0.03} />
        </Group>
      );
    case 'volcano':
      return (
        <Group>
          <Path path={`M${W * 0.3} ${hz + 2} L${W * 0.5} ${hz - H * 0.3} L${W * 0.6} ${hz - H * 0.3} L${W * 0.82} ${hz + 2} Z`} color="#3b160a" opacity={0.9} />
          <Oval x={W * 0.49} y={hz - H * 0.32} width={W * 0.12} height={H * 0.05} color="#ff7a1a" opacity={0.85} />
          <Circle cx={W * 0.56} cy={hz - H * 0.4} r={W * 0.035} color="#5a4a45" opacity={0.5} />
          <Circle cx={W * 0.6} cy={hz - H * 0.5} r={W * 0.045} color="#5a4a45" opacity={0.4} />
          <Circle cx={W * 0.55} cy={hz - H * 0.6} r={W * 0.055} color="#5a4a45" opacity={0.3} />
        </Group>
      );
    case 'desert':
      return (
        <Group>
          <Circle cx={W * 0.84} cy={H * 0.13} r={W * 0.07} color="#fff3b0" opacity={0.85} />
          <Oval x={-W * 0.1} y={hz - H * 0.07} width={W * 0.6} height={H * 0.18} color="#c79450" />
          <Oval x={W * 0.4} y={hz - H * 0.1} width={W * 0.7} height={H * 0.22} color="#b98a4a" />
        </Group>
      );
    case 'league':
      // grand hall : bannières rouges, emblème Poké Ball doré, torches
      return (
        <Group>
          <Rect x={0} y={0} width={W} height={H * 0.05} color="#241018" opacity={0.8} />
          {[0.1, 0.3, 0.7, 0.9].map((fx, i) => (
            <Path key={i} path={`M${W * fx - W * 0.04} ${H * 0.04} L${W * fx + W * 0.04} ${H * 0.04} L${W * fx + W * 0.04} ${H * 0.3} L${W * fx} ${H * 0.25} L${W * fx - W * 0.04} ${H * 0.3} Z`}
              color="#b3262e" opacity={0.85} />
          ))}
          <Circle cx={W * 0.5} cy={H * 0.2} r={W * 0.07} color="#e8c252" opacity={0.75} style="stroke" strokeWidth={3} />
          <Rect x={W * 0.43} y={H * 0.2 - 1.5} width={W * 0.14} height={3} color="#e8c252" opacity={0.75} />
          <Circle cx={W * 0.5} cy={H * 0.2} r={W * 0.018} color="#e8c252" opacity={0.75} />
          {[0.2, 0.8].map((fx, i) => (
            <Group key={`t${i}`}>
              <Rect x={W * fx - 2} y={hz - H * 0.16} width={4} height={H * 0.12} color="#3b2a1c" />
              <Circle cx={W * fx} cy={hz - H * 0.18} r={W * 0.02} color="#ff9a2e" opacity={0.9} />
              <Circle cx={W * fx} cy={hz - H * 0.18} r={W * 0.045} color="#ffb347" opacity={0.2} />
            </Group>
          ))}
        </Group>
      );
    case 'dojo':
      // poutres de bois, sacs de frappe suspendus
      return (
        <Group>
          <Rect x={0} y={H * 0.04} width={W} height={H * 0.035} color="#3e2a18" opacity={0.85} />
          <Rect x={0} y={H * 0.2} width={W} height={H * 0.02} color="#4a3320" opacity={0.6} />
          {[0.06, 0.5, 0.94].map((fx, i) => (
            <Rect key={i} x={W * fx - W * 0.015} y={H * 0.04} width={W * 0.03} height={hz - H * 0.04} color="#4a3320" opacity={0.7} />
          ))}
          {[0.25, 0.75].map((fx, i) => (
            <Group key={`s${i}`}>
              <Rect x={W * fx - 0.75} y={H * 0.075} width={1.5} height={H * 0.08} color="#2a1c10" />
              <RoundedRect x={W * fx - W * 0.03} y={H * 0.155} width={W * 0.06} height={H * 0.16} r={W * 0.02} color="#8a2f24" opacity={0.85} />
            </Group>
          ))}
        </Group>
      );
    case 'haunted':
      // lune pâle, fenêtres gothiques, feux follets
      return (
        <Group>
          <Circle cx={W * 0.82} cy={H * 0.14} r={W * 0.065} color="#e9e4ff" opacity={0.8} />
          <Circle cx={W * 0.8} cy={H * 0.13} r={W * 0.065} color="#2a1f45" opacity={0.35} />
          {[0.12, 0.34].map((fx, i) => (
            <Group key={i}>
              <Path path={`M${W * fx - W * 0.05} ${hz - H * 0.04} L${W * fx - W * 0.05} ${hz - H * 0.24} Q${W * fx} ${hz - H * 0.36} ${W * fx + W * 0.05} ${hz - H * 0.24} L${W * fx + W * 0.05} ${hz - H * 0.04} Z`}
                color="#120c20" opacity={0.85} />
              <Rect x={W * fx - 1} y={hz - H * 0.3} width={2} height={H * 0.26} color="#6a5a8f" opacity={0.4} />
            </Group>
          ))}
          {[[0.55, 0.22], [0.65, 0.32], [0.47, 0.34]].map(([fx, fy], i) => (
            <Group key={`w${i}`}>
              <Circle cx={W * fx} cy={H * fy} r={W * 0.03} color="#7ef0ff" opacity={0.15} />
              <Circle cx={W * fx} cy={H * fy} r={W * 0.012} color="#b8f7ff" opacity={0.7} />
            </Group>
          ))}
        </Group>
      );
    case 'arena':
      return (
        <Group>
          {[0, 1, 2].map((i) => (
            <Rect key={i} x={0} y={hz - H * (0.09 + i * 0.09)} width={W} height={H * 0.08} color="#2c3046" opacity={0.55 + i * 0.1} />
          ))}
          {Array.from({ length: 14 }, (_, i) => (
            <Circle key={`p${i}`} cx={W * (0.04 + i * 0.07)} cy={hz - H * (0.12 + (i % 3) * 0.09)} r={3} color="#c9cbe0" opacity={0.35} />
          ))}
        </Group>
      );
  }
});

export const BackdropFront = memo(function BackdropFront({ kind, W, H }: { kind: BackdropKind; W: number; H: number }) {
  const hz = H * HORIZON;
  switch (kind) {
    case 'water': {
      // l'eau en bande derrière les combattants, le sable sous leurs pieds (le sol de la palette), une ligne d'écume
      const shore = H * 0.52;
      const foam = Array.from({ length: 9 }, (_, i) => `Q${W * (i + 0.5) / 8} ${shore + (i % 2 ? 5 : -3)} ${W * (i + 1) / 8} ${shore}`).join(' ');
      return (
        <Group>
          <Rect x={0} y={H * 0.4} width={W} height={shore - H * 0.4} color="#0f8fd1" />
          <Path path={`M0 ${shore} ${foam}`} style="stroke" strokeWidth={3} color="#ffffff" opacity={0.6} />
          {[[0.1, 0.44], [0.4, 0.47], [0.68, 0.43], [0.86, 0.48]].map(([fx, fy], i) => (
            <RoundedRect key={i} x={W * fx} y={H * fy} width={W * 0.08} height={2} r={1} color="#ffffff" opacity={0.35} />
          ))}
          {[[0.3, 0.8], [0.62, 0.9], [0.9, 0.7]].map(([fx, fy], i) => (
            <Oval key={`c${i}`} x={W * fx} y={H * fy} width={W * 0.025} height={H * 0.012} color="#b89a60" opacity={0.6} />
          ))}
        </Group>
      );
    }
    case 'swamp':
      return (
        <Group>
          <Oval x={W * 0.38} y={H * 0.62} width={W * 0.24} height={H * 0.05} color="#1b2412" opacity={0.45} />
          <Oval x={W * 0.05} y={H * 0.97} width={W * 0.2} height={H * 0.04} color="#1b2412" opacity={0.4} />
          {[0.47, 0.5, 0.53].map((fx, i) => (
            <Rect key={i} x={W * fx} y={hz + H * 0.03} width={2} height={H * 0.06} color="#56703a" opacity={0.7} />
          ))}
        </Group>
      );
    case 'cave':
    case 'volcano':
      return (
        <Group color={kind === 'cave' ? '#3e3836' : '#1a0a05'} opacity={0.6}>
          <Oval x={W * 0.44} y={H * 0.6} width={W * 0.12} height={H * 0.04} />
          <Oval x={W * 0.03} y={H * 0.49} width={W * 0.08} height={H * 0.03} />
        </Group>
      );
    case 'league':
      return (
        <Group color="#e8c252" opacity={0.18}>
          <Rect x={0} y={hz + H * 0.12} width={W} height={1.5} />
          <Rect x={0} y={hz + H * 0.3} width={W} height={1.5} />
          {[0.2, 0.4, 0.6, 0.8].map((fx, i) => <Rect key={i} x={W * fx} y={hz} width={1.5} height={H - hz} />)}
        </Group>
      );
    case 'dojo':
      return (
        <Group color="#5a4128" opacity={0.35}>
          {[0, 1, 2].map((r) => [0, 1, 2, 3].map((c) => (
            <Rect key={`${r}-${c}`} x={W * c * 0.25 + 3} y={hz + H * (0.02 + r * 0.18)} width={W * 0.25 - 6} height={H * 0.16}
              style="stroke" strokeWidth={1.5} />
          )))}
        </Group>
      );
    case 'arena':
      return (
        <Group color="#ffffff" opacity={0.08}>
          <Rect x={0} y={hz + H * 0.14} width={W} height={1.5} />
          <Rect x={0} y={hz + H * 0.34} width={W} height={1.5} />
          <Rect x={W * 0.5 - 0.75} y={hz} width={1.5} height={H - hz} />
        </Group>
      );
    default:
      return null;
  }
});
