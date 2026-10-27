// Background music: synthesized loops (Web Audio, no audio files).
// Browsers only allow audio after a user gesture, so call startMusic() from a click handler.

const VOLUME = 0.05;

// Calm track: an upbeat, determined groove. Am – F – C – G with a punchy bass, a bright
// square-wave lead, a kick on beats 1 and 3 and a light hi-hat.
const BPM = 108;
const STEP = 60 / BPM / 2; // eighth note, in seconds
const hz = (semitonesFromA4: number) => 440 * Math.pow(2, semitonesFromA4 / 12);
const N: Record<string, number> = {
  A2: hz(-24), F2: hz(-28), C3: hz(-21), G2: hz(-26),
  F4: hz(-4), G4: hz(-2), A4: hz(0), B4: hz(2), C5: hz(3), D5: hz(5), E5: hz(7), G5: hz(10),
};
// One chord per bar (8 eighth-note steps); 4 bars = 32 steps.
const ROOTS = ['A2', 'F2', 'C3', 'G2'];
const MELODY = [
  'A4', 'C5', 'E5', 'C5', 'A4', 'C5', 'E5', '',
  'F4', 'A4', 'C5', 'A4', 'F4', 'A4', 'C5', '',
  'G4', 'C5', 'E5', 'C5', 'G4', 'C5', 'E5', 'G5',
  'D5', 'B4', 'G4', 'B4', 'D5', 'B4', 'G4', '',
];

// Tense track for surveillance incidents: slow and ominous. A low drone, a heartbeat thump,
// a ticking clock and sparse dissonant stings. No beat, nothing to dance to.
const TENSE_STEP = 60 / 66 / 2; // eighth note at 66 BPM
const TENSE_NOTES: Record<string, number> = {
  A1: 55.0, F1: 43.65, E1: 41.2, Bb1: 58.27,
  A4: 440.0, Bb4: 466.16, E4: 329.63, F4: 349.23, Eb4: 311.13, Ab4: 415.3,
};
// One drone per 2 bars (16 steps); 4 steps cycle = 64 steps total
const DRONES = ['A1', 'F1', 'A1', 'E1'];
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

function hat(start: number) {
  if (!ctx || !master) return;
  const len = Math.floor(ctx.sampleRate * 0.04);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  const hp = ctx.createBiquadFilter();
  const g = ctx.createGain();
  hp.type = 'highpass';
  hp.frequency.value = 7000;
  src.buffer = buf;
  g.gain.setValueAtTime(0.12, start);
  g.gain.exponentialRampToValueAtTime(0.0001, start + 0.04);
  src.connect(hp).connect(g).connect(master);
  src.start(start);
}

function thump(start: number, vol = 1) {
  if (!ctx || !master) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.frequency.setValueAtTime(90, start);
  osc.frequency.exponentialRampToValueAtTime(38, start + 0.15);
  g.gain.setValueAtTime(vol * 0.9, start);
  g.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
  osc.connect(g).connect(master);
  osc.start(start);
  osc.stop(start + 0.18);
}

function schedule() {
  if (!ctx) return;
  while (nextTime < ctx.currentTime + 0.4) {
    if (track === 'tense') {
      const pos = step % 16;
      const drone = DRONES[Math.floor(step / 16) % 4];
      if (pos === 0) {
        note(TENSE_NOTES[drone], nextTime, TENSE_STEP * 16, 'sawtooth', 0.5);
        note(TENSE_NOTES[drone] * 2.005, nextTime, TENSE_STEP * 16, 'sine', 0.35); // slightly detuned for unease
      }
      if (pos % 8 === 0) { thump(nextTime); thump(nextTime + TENSE_STEP * 1.5, 0.6); } // heartbeat: lub-dub
      if (pos % 2 === 0) note(2200, nextTime, 0.02, 'square', 0.12); // clock tick
      if (pos === 10) { // dissonant sting: minor second
        note(TENSE_NOTES.A4, nextTime, TENSE_STEP * 4, 'triangle', 0.4);
        note(TENSE_NOTES.Bb4, nextTime, TENSE_STEP * 4, 'triangle', 0.4);
      }
      if (pos === 14 && Math.floor(step / 16) % 2 === 1) note(TENSE_NOTES.Eb4, nextTime, TENSE_STEP * 2, 'triangle', 0.35);
      nextTime += TENSE_STEP;
      step++;
      continue;
    }
    const bar = Math.floor(step / 8) % 4;
    const pos = step % 8;
    if (pos === 0 || pos === 2 || pos === 3 || pos === 4 || pos === 6) note(N[ROOTS[bar]], nextTime, STEP * 1.6, 'triangle', 0.95);
    const m = MELODY[step % MELODY.length];
    if (m) note(N[m], nextTime, STEP * 1.5, 'square', 0.4);
    if (pos === 0 || pos === 4) thump(nextTime, 0.8);
    if (pos % 2 === 1) hat(nextTime);
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
