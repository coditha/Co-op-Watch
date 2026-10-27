// Background music: synthesized loops (Web Audio, no audio files).
// Browsers only allow audio after a user gesture, so call startMusic() from a click handler.

const VOLUME = 0.05;

// Note name -> frequency, e.g. 'C5', 'Bb2'.
const SEMI: Record<string, number> = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
function nf(name: string): number {
  const letter = name[0];
  const flat = name[1] === 'b' ? -1 : name[1] === '#' ? 1 : 0;
  const oct = Number(name[name.length - 1]);
  return 440 * Math.pow(2, (SEMI[letter] + flat + (oct - 4) * 12) / 12);
}

// Calm track: a gentle, folky "farm town" feel. G – Em – C – D with fingerpicked
// guitar-style arpeggios under a soft, breathy flute melody. No drums.
const BPM = 92;
const STEP = 60 / BPM / 2; // eighth note, in seconds
const CHORDS = [
  { root: 'G2', tones: ['B3', 'D4', 'G4'] },
  { root: 'E2', tones: ['G3', 'B3', 'E4'] },
  { root: 'C3', tones: ['E4', 'G4', 'C5'] },
  { root: 'D3', tones: ['A3', 'D4', 'A4'] },
];
// 4 bars x 8 eighth-note steps, '' = rest. Pentatonic so it never clashes.
const MELODY = [
  'D5', '', 'B4', '', 'G4', '', 'A4', 'B4',
  'D5', '', '', '', 'B4', '', 'A4', '',
  'E5', '', 'D5', '', 'C5', '', 'D5', 'E5',
  'D5', '', '', '', 'A4', '', 'B4', '',
];

// Tense track for surveillance incidents and the board phase: the same folky instruments and
// tempo as the calm track, turned dark. Em – C – Am – B7 (the relative minor of G, so the
// two tracks flow into each other), with a pulsing bass and a lonely, uneasy melody.
const TENSE_CHORDS = [
  { root: 'E2', tones: ['G3', 'B3', 'E4'] },
  { root: 'C3', tones: ['G3', 'C4', 'E4'] },
  { root: 'A2', tones: ['C4', 'E4', 'A4'] },
  { root: 'B2', tones: ['D#4', 'F#4', 'A4'] },
];
const TENSE_MELODY = [
  'E5', '', 'B4', '', 'G4', 'B4', 'E5', '',
  'E5', '', 'G4', '', 'C5', '', 'B4', '',
  'C5', '', 'A4', '', 'E4', 'A4', 'C5', '',
  'D#5', '', 'B4', '', 'A4', '', 'F#4', '',
];
export type Track = 'calm' | 'tense';
let track: Track = 'calm';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let timer: number | null = null;
let nextTime = 0;
let step = 0;
let enabled = true;

function note(freq: number, start: number, dur: number, type: OscillatorType, gain: number, attack = 0.01) {
  if (!ctx || !master) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(gain, start + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(g).connect(master);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

function schedule() {
  if (!ctx) return;
  while (nextTime < ctx.currentTime + 0.4) {
    if (track === 'tense') {
      const bar = Math.floor(step / 8) % 4;
      const pos = step % 8;
      const chord = TENSE_CHORDS[bar];
      if (pos % 2 === 0) note(nf(chord.root), nextTime, STEP * 1.6, 'sine', 0.85); // pulsing bass
      if (pos !== 0) {
        const idx = [0, 1, 0, 2, 0, 1, 2, 1][pos];
        note(nf(chord.tones[idx]), nextTime, STEP * 1.6, 'triangle', 0.45);
      }
      const m = TENSE_MELODY[step % TENSE_MELODY.length];
      if (m) note(nf(m), nextTime, STEP * 2.6, 'sine', 0.55, 0.07);
      nextTime += STEP;
      step++;
      continue;
    }
    const bar = Math.floor(step / 8) % 4;
    const pos = step % 8;
    const chord = CHORDS[bar];
    // fingerpicked arpeggio: bass note, then a rolling pattern over the chord tones
    if (pos === 0) note(nf(chord.root), nextTime, STEP * 3, 'sine', 0.9);
    else {
      const idx = [0, 0, 1, 2, 1, 2, 1, 0][pos];
      note(nf(chord.tones[idx]), nextTime, STEP * 2.2, 'triangle', 0.45);
    }
    const m = MELODY[step % MELODY.length];
    if (m) note(nf(m), nextTime, STEP * 2.6, 'sine', 0.55, 0.07); // flute
    nextTime += STEP;
    step++;
  }
}

export function startMusic() {
  if (!enabled || timer !== null) return;
  try {
    if (!ctx) {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = VOLUME;
      // Gentle low-pass takes the harsh edge off the square/saw waves.
      const soften = ctx.createBiquadFilter();
      soften.type = 'lowpass';
      soften.frequency.value = 2200;
      master.connect(soften).connect(ctx.destination);
    }
    void ctx.resume();
    nextTime = ctx.currentTime + 0.05;
    timer = window.setInterval(schedule, 100);
  } catch {
    /* audio unavailable — game works without it */
  }
}

export function stopMusic() {
  if (timer !== null) { window.clearInterval(timer); timer = null; }
}

export function isMusicOn() {
  return enabled;
}

export function toggleMusic(): boolean {
  enabled = !enabled;
  if (enabled) startMusic(); else stopMusic();
  return enabled;
}

export function setTrack(t: Track) {
  if (t === track) return;
  track = t;
  step = 0;
  if (ctx) nextTime = ctx.currentTime + 0.05;
}
