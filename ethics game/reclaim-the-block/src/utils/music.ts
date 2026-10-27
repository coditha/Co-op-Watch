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

// Calm track: the original upbeat chiptune loop. C – Am – F – G, a square-wave lead
// over a triangle bass. '' = rest.
const BPM = 96;
const STEP = 60 / BPM / 2; // eighth note, in seconds
const MELODY = [
  'E4', '', 'G4', '', 'C5', '', 'G4', '', 'A4', '', 'C5', '', 'E5', '', 'C5', '',
  'A4', '', 'C5', '', 'F4', '', 'A4', '', 'G4', '', 'D5', '', 'G4', '', 'D4', '',
];
const BASS = [
  'C3', 'C3', 'C3', 'C3', 'A3', 'A3', 'A3', 'A3', 'F3', 'F3', 'F3', 'F3', 'G3', 'G3', 'G3', 'G3',
  'C3', 'C3', 'C3', 'C3', 'A3', 'A3', 'A3', 'A3', 'F3', 'F3', 'F3', 'F3', 'G3', 'G3', 'G3', 'G3',
];

// Tense track for surveillance incidents and the board phase: deep, slow and brooding.
// Low sustained chords, a sub-bass and a sparse low melody, with no bright arpeggio. Em – C – Am – B7 (the relative minor of G, so the
// two tracks flow into each other), with a pulsing bass and a lonely, uneasy melody.
const TENSE_STEP = 60 / 66 / 2; // slower than the calm track, eighth note at 66 BPM
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
      const len = TENSE_STEP * 8;
      if (pos === 0) {
        note(nf(chord.root) / 2, nextTime, len, 'sine', 1.0, 0.5); // sub-bass
        note(nf(chord.root), nextTime, len, 'triangle', 0.5, 1.2); // low sustained root
        note(nf(chord.tones[0]) / 2, nextTime, len, 'triangle', 0.3, 1.8); // dark pad
        note(nf(chord.tones[1]) / 2, nextTime, len, 'triangle', 0.25, 2.2);
      }
      if (pos === 0 || pos === 4) note(nf(chord.root) / 2, nextTime, TENSE_STEP * 3, 'sine', 0.9, 0.02); // slow low pulse
      const m = TENSE_MELODY[step % TENSE_MELODY.length];
      if (m) note(nf(m) / 2, nextTime, TENSE_STEP * 3.2, 'sine', 0.55, 0.12);
      nextTime += TENSE_STEP;
      step++;
      continue;
    }
    const m = MELODY[step % MELODY.length];
    if (m) note(nf(m), nextTime, STEP * 1.8, 'square', 0.5);
    if (step % 2 === 0) note(nf(BASS[step % BASS.length]), nextTime, STEP * 1.9, 'triangle', 0.9);
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
