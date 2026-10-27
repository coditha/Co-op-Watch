// Background music: a short synthesized chiptune loop (Web Audio, no audio files).
// Browsers only allow audio after a user gesture, so call startMusic() from a click handler.

const BPM = 96;
const STEP = 60 / BPM / 2; // eighth note, in seconds
const VOLUME = 0.05;

// Frequencies (Hz)
const N: Record<string, number> = {
  C3: 130.81, F3: 174.61, G3: 196.0, A3: 220.0,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0,
  C5: 523.25, D5: 587.33, E5: 659.25,
};

// 32 eighth-note steps (4 bars): C – Am – F – G, '' = rest
const MELODY = [
  'E4', '', 'G4', '', 'C5', '', 'G4', '', 'A4', '', 'C5', '', 'E5', '', 'C5', '',
  'A4', '', 'C5', '', 'F4', '', 'A4', '', 'G4', '', 'D5', '', 'G4', '', 'D4', '',
];
const BASS = [
  'C3', 'C3', 'C3', 'C3', 'A3', 'A3', 'A3', 'A3', 'F3', 'F3', 'F3', 'F3', 'G3', 'G3', 'G3', 'G3',
  'C3', 'C3', 'C3', 'C3', 'A3', 'A3', 'A3', 'A3', 'F3', 'F3', 'F3', 'F3', 'G3', 'G3', 'G3', 'G3',
];

// Tense track for surveillance incidents: A minor, faster, driving bass, dissonant stabs.
const TENSE_STEP = 60 / 138 / 2;
const TENSE_NOTES: Record<string, number> = {
  A2: 110.0, F2: 87.31, E2: 82.41, D2: 73.42,
  A4: 440.0, B4: 493.88, C5: 523.25, E5: 659.25, F5: 698.46, Ab4: 415.3, Eb5: 622.25,
};
const TENSE_BASS = [
  'A2', 'A2', 'A2', 'A2', 'A2', 'A2', 'A2', 'A2', 'F2', 'F2', 'F2', 'F2', 'E2', 'E2', 'E2', 'E2',
  'A2', 'A2', 'A2', 'A2', 'A2', 'A2', 'A2', 'A2', 'D2', 'D2', 'D2', 'D2', 'E2', 'E2', 'E2', 'E2',
];
const TENSE_LEAD = [
  'A4', '', 'C5', '', 'E5', '', 'C5', '', 'F5', '', 'E5', '', 'C5', '', 'A4', '',
  'A4', '', 'C5', 'E5', 'Eb5', '', 'E5', '', 'Ab4', '', 'B4', '', 'E5', 'E5', 'E5', '',
];
export type Track = 'calm' | 'tense';
let track: Track = 'calm';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let timer: number | null = null;
let nextTime = 0;
let step = 0;
let enabled = true;

function note(freq: number, start: number, dur: number, type: OscillatorType, gain: number) {
  if (!ctx || !master) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(gain, start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(g).connect(master);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

function schedule() {
  if (!ctx) return;
  while (nextTime < ctx.currentTime + 0.4) {
    if (track === 'tense') {
      const b = TENSE_BASS[step % TENSE_BASS.length];
      const l = TENSE_LEAD[step % TENSE_LEAD.length];
      note(TENSE_NOTES[b], nextTime, TENSE_STEP * 0.9, 'sawtooth', 0.8); // pulsing eighth-note bass
      if (l) note(TENSE_NOTES[l], nextTime, TENSE_STEP * 0.8, 'square', 0.45);
      if (step % 4 === 2) note(TENSE_NOTES.A4 / 2, nextTime, TENSE_STEP * 0.3, 'square', 0.3); // tick
      nextTime += TENSE_STEP;
      step++;
      continue;
    }
    const m = MELODY[step % MELODY.length];
    const b = BASS[step % BASS.length];
    if (m) note(N[m], nextTime, STEP * 1.8, 'square', 0.5);
    if (step % 2 === 0) note(N[b], nextTime, STEP * 1.9, 'triangle', 0.9);
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
      master.connect(ctx.destination);
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
