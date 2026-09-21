import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';

const SOURCES = {
  tap: require('../../assets/sfx/tap.wav'),
  eat: require('../../assets/sfx/eat.wav'),
  play: require('../../assets/sfx/play.wav'),
  heart: require('../../assets/sfx/heart.wav'),
  hatch: require('../../assets/sfx/hatch.wav'),
  evolve: require('../../assets/sfx/evolve.wav'),
  medal: require('../../assets/sfx/medal.wav'),
  deny: require('../../assets/sfx/deny.wav'),
  bye: require('../../assets/sfx/bye.wav'),
  level: require('../../assets/sfx/level.wav'),
} as const;

export type Sfx = keyof typeof SOURCES;

let players: Partial<Record<Sfx, AudioPlayer>> = {};
let enabled = true;
let ready = false;

export async function initSfx() {
  if (ready) return;
  ready = true;
  try {
    // les jeux jouent habituellement même en mode silencieux/« Ne pas déranger » (contrairement aux
    // sonneries) — l'app a déjà ses propres réglages Sons/Musique pour couper le son si besoin.
    await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' });
  } catch { /* web / non supporté */ }
  for (const k of Object.keys(SOURCES) as Sfx[]) {
    try {
      players[k] = createAudioPlayer(SOURCES[k]);
      players[k]!.volume = 0.6;
    } catch { /* ignore */ }
  }
}

export function setSfxEnabled(on: boolean) { enabled = on; }

export function sfx(name: Sfx) {
  if (!enabled) return;
  const p = players[name];
  if (!p) return;
  try {
    p.seekTo(0);
    p.play();
  } catch { /* ignore */ }
}
