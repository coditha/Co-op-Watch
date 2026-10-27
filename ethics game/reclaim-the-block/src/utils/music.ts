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
