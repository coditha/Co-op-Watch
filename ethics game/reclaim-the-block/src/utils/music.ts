// Background music: synthesized loops (Web Audio, no audio files).
// Browsers only allow audio after a user gesture, so call startMusic() from a click handler.

const VOLUME = 0.05;

// Calm track: a slow, warm lo-fi groove. Fmaj7 – Em7 – Dm7 – Cmaj7 with soft pads,
// a round bass, a sparse plucked melody and a gentle hi-hat.
const BPM = 78;
const STEP = 60 / BPM / 2; // eighth note, in seconds
const hz = (semitonesFromA4: number) => 440 * Math.pow(2, semitonesFromA4 / 12);
const N: Record<string, number> = {
  C2: hz(-33), D2: hz(-31), E2: hz(-29), F2: hz(-28),
  C3: hz(-21), E3: hz(-17), G3: hz(-14), B3: hz(-10), D3: hz(-19), F3: hz(-16), A3: hz(-12), Bb3: hz(-11),
  E4: hz(-5), G4: hz(-2), A4: hz(0), C5: hz(3), D5: hz(5), E5: hz(7), B4: hz(2), F4: hz(-4), D4: hz(-7),
};
// One chord per bar (8 eighth-note steps); 4 bars = 32 steps.
const CHORDS = [
  { root: 'F2', pad: ['A3', 'C5', 'E4'] },
  { root: 'E2', pad: ['G3', 'B3', 'D4'] },
  { root: 'D2', pad: ['F3', 'A3', 'C5'] },
  { root: 'C2', pad: ['E3', 'G3', 'B3'] },
];
const MELODY = [
  'C5', '', '', 'A4', '', 'G4', '', '', 'B4', '', '', 'G4', '', 'E4', '', '',
  'A4', '', '', 'F4', '', 'A4', '', '', 'G4', '', 'E4', '', 'D4', '', '', '',
];

// Tense track for surveillance incidents: 160 BPM, D minor, racing sixteenth-note arpeggio over a
// pounding kick and snare, with a two-tone alarm every other bar.
const TENSE_STEP = 60 / 160 / 4; // sixteenth note
const TENSE_NOTES: Record<string, number> = {
  D3: 146.83, Bb2: 116.54, G2: 98.0, A2: 110.0,
  D4: 293.66, F4: 349.23, A4: 440.0, D5: 587.33, Bb4: 466.16, G4: 392.0, E4: 329.63, Cs5: 554.37, E5: 659.25,
};
// 4 bars x 16 sixteenths: Dm – Bb – Gm – A
const ARP = [
  ['D4', 'F4', 'A4', 'D5'], ['Bb4', 'D5', 'F4', 'D4'], ['G4', 'Bb4', 'D5', 'Bb4'], ['A4', 'Cs5', 'E5', 'Cs5'],
];
const ARP_ROOT = ['D3', 'Bb2', 'G2', 'A2'];
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

function kick(start: number) {
  if (!ctx || !master) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.frequency.setValueAtTime(150, start);
  osc.frequency.exponentialRampToValueAtTime(40, start + 0.12);
  g.gain.setValueAtTime(1.1, start);
  g.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
  osc.connect(g).connect(master);
  osc.start(start);
  osc.stop(start + 0.18);
}

function snare(start: number) {
  if (!ctx || !master) return;
  const len = Math.floor(ctx.sampleRate * 0.12);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  const g = ctx.createGain();
  src.buffer = buf;
  g.gain.setValueAtTime(0.6, start);
  g.gain.exponentialRampToValueAtTime(0.0001, start + 0.12);
  src.connect(g).connect(master);
  src.start(start);
}

function schedule() {
  if (!ctx) return;
  while (nextTime < ctx.currentTime + 0.4) {
    if (track === 'tense') {
      const bar = Math.floor(step / 16) % 4;
      const pos = step % 16;
      note(TENSE_NOTES[ARP[bar][pos % 4]], nextTime, TENSE_STEP * 0.9, 'square', 0.35);
      if (pos % 2 === 0) note(TENSE_NOTES[ARP_ROOT[bar]], nextTime, TENSE_STEP * 1.8, 'sawtooth', 0.7);
      if (pos % 4 === 0) kick(nextTime);
      if (pos === 4 || pos === 12) snare(nextTime);
      if (bar % 2 === 1 && (pos === 8 || pos === 10)) note(pos === 8 ? 880 : 740, nextTime, TENSE_STEP * 1.8, 'square', 0.3); // alarm
      nextTime += TENSE_STEP;
      step++;
      continue;
    }
    const bar = Math.floor(step / 8) % 4;
    const pos = step % 8;
    const chord = CHORDS[bar];
    if (pos === 0) chord.pad.forEach((k) => note(N[k], nextTime, STEP * 8, 'triangle', 0.22));
    if (pos === 0 || pos === 5) note(N[chord.root], nextTime, STEP * 2.5, 'sine', 1.0);
    const m = MELODY[step % MELODY.length];
    if (m) note(N[m], nextTime, STEP * 2.5, 'triangle', 0.55);
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
