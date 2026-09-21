/**
 * Génère le thème de combat contre un Pokémon sauvage dans Pokémon Or/Argent (Johto).
 * Tonalité : Sol mineur (Gm) | Tempo : 162 BPM
 */
const fs = require('fs');
const path = require('path');

const RATE = 22050;
const BPM = 162;
const BEAT = 60 / BPM;
const sixteenth = BEAT / 4; // double-croche

function freq(note) {
  const m = note.match(/^([A-G])(#?)(-?\d)$/);
  if (!m) return 0;
  const [, letter, sharp, octStr] = m;
  const SEMITONES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const oct = parseInt(octStr, 10);
  const semitone = SEMITONES[letter] + (sharp ? 1 : 0);
  const midi = (oct + 1) * 12 + semitone;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function squareSample(t, f, duty = 0.5) {
  const phase = (t * f) % 1;
  return phase < duty ? 1 : -1;
}

function synthVoice(events, { duty = 0.5, gain = 0.25 } = {}) {
  const totalDur = Math.max(...events.map((e) => e.start + e.dur));
  const n = Math.ceil(totalDur * RATE);
  const out = new Float32Array(n);
  for (const e of events) {
    if (!e.note) continue;
    const f = freq(e.note);
    const i0 = Math.floor(e.start * RATE);
    const i1 = Math.floor((e.start + e.dur) * RATE);
    const len = i1 - i0;
    for (let i = i0; i < i1; i++) {
      const local = i - i0;
      const env = Math.min(1, local / 30) * Math.min(1, (len - local) / 100);
      out[i] += squareSample((i - i0) / RATE, f, duty) * gain * env;
    }
  }
  return out;
}

function mix(voices, totalLen) {
  const out = new Float32Array(totalLen);
  for (const v of voices) {
    for (let i = 0; i < v.length && i < totalLen; i++) out[i] += v[i];
  }
  let peak = 0;
  for (let i = 0; i < out.length; i++) peak = Math.max(peak, Math.abs(out[i]));
  const norm = peak > 0.95 ? 0.95 / peak : 1;
  for (let i = 0; i < out.length; i++) out[i] *= norm;
  return out;
}

function writeWav(filePath, samples) {
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + samples.length * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(RATE, 24);
  buf.writeUInt32LE(RATE * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  fs.writeFileSync(filePath, buf);
}

// --- STRUCTURE DE COMBAT JOHTO (Gm) ---

// 1. Basse en staccato (double-croches sur Sol)
const BASS_PATTERN = [
  'G2', 'G2', 'D3', 'G2', 'F3', 'G2', 'E3', 'D#3',
  'G2', 'G2', 'D3', 'G2', 'A#2', 'C3', 'C#3', 'D3'
];

const bassEvents = [];
let tBass = 0;
for (let measure = 0; measure < 8; measure++) {
  for (const note of BASS_PATTERN) {
    bassEvents.push({ note, start: tBass, dur: sixteenth * 0.75 });
    tBass += sixteenth;
  }
}

// 2. Mélodie principale syncopée de Johto
const MELODY_PATTERN = [
  // Motif d'accroche (Gm)
  'G4', 'A#4', 'D5', 'G5', 'F5', 'D5', 'A#4', 'G4',
  'F4', 'A4', 'C5', 'F5', 'D#5', 'C5', 'A4', 'F4',
  // Rebond chromatique
  'G4', 'G4', 'A#4', 'G4', 'D5', 'G4', 'A#4', 'D5',
  'C5', 'A#4', 'A4', 'A#4', 'A4', 'F4', 'G4', null
];

const melodyEvents = [];
let tMelody = 0;
for (let repeat = 0; repeat < 2; repeat++) {
  for (const note of MELODY_PATTERN) {
    melodyEvents.push({
      note,
      start: tMelody,
      dur: (sixteenth * 2) * 0.85
    });
    tMelody += sixteenth * 2;
  }
}

// Canal 1 (Onde perçante 0.25) & Canal 2 (Basse 0.125)
const melody = synthVoice(melodyEvents, { duty: 0.25, gain: 0.25 });
const bass = synthVoice(bassEvents, { duty: 0.125, gain: 0.20 });

const totalLen = Math.max(melody.length, bass.length);
const mixed = mix([melody, bass], totalLen);

const outDir = path.join(__dirname, '..', '_music_preview');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'johto_combat.wav');
writeWav(outPath, mixed);

console.log('->', outPath, `${(totalLen / RATE).toFixed(2)}s`);