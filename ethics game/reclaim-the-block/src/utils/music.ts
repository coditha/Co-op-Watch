// Background music: synthesized loops (Web Audio, no audio files).
// Browsers only allow audio after a user gesture, so call startMusic() from a click handler.

const VOLUME = 0.05;

// Note name -> frequency, e.g. 'C5', 'Bb2'.
const SEMI: Record<string, number> = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
function nf(name: string): number {
  const letter = name[0];
  const flat = name[1] === 'b' ? -1 : 0;
  const oct = Number(name[name.length - 1]);
  return 440 * Math.pow(2, (SEMI[letter] + flat + (oct - 4) * 12) / 12);
}

// Calm track: hopeful and playful. C – G – Am – F, a bouncy "oom-pah" bass and a plucky
// square-wave tune. No drums, so it skips along without feeling like a dance beat.
const BPM = 104;
const STEP = 60 / BPM / 2; // eighth note, in seconds
const ROOTS = ['C3', 'G2', 'A2', 'F2'];
const FIFTHS = ['G3', 'D3', 'E3', 'C3'];
// 4 bars x 8 eighth-note steps, '' = rest
const MELODY = [
  'E5', '', 'G5', 'E5', 'C5', '', 'E5', 'D5',
  'D5', '', 'G5', 'D5', 'B4', '', 'D5', 'C5',
  'C5', '', 'E5', 'C5', 'A4', '', 'C5', 'B4',
  'A4', '', 'C5', 'A4', 'F5', 'E5', 'D5', 'C5',
];

// Tense track for surveillance incidents: dark and heavy. Slow, brooding minor chords that
// swell in like brass (Dm – Bb – Gm – A), a deep drum boom on each bar, and nothing to dance to.
const TENSE_STEP = 60 / 54 / 2; // eighth note at 54 BPM
const TENSE_CHORDS = [
  ['D2', 'A2', 'F3'], // Dm
  ['Bb1', 'F2', 'D3'], // Bb
  ['G1', 'D2', 'Bb2'], // Gm
  ['A1', 'E2', 'C3'], // A with a minor third: dark
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
      const bar = Math.floor(step / 8) % 4;
      const pos = step % 8;
      if (pos === 0) {
        const [root, fifth, third] = TENSE_CHORDS[bar];
        const len = TENSE_STEP * 8;
        note(nf(root), nextTime, len, 'sawtooth', 0.55, 1.4);
        note(nf(fifth), nextTime, len, 'sawtooth', 0.3, 1.8);
        note(nf(third), nextTime, len, 'sawtooth', 0.25, 2.2);
        note(nf(root) / 2, nextTime, len, 'sine', 0.7, 0.3); // sub rumble
        thump(nextTime, 1);
      }
      if (pos === 6 && bar === 3) thump(nextTime, 0.7); // extra hit before the loop restarts
      nextTime += TENSE_STEP;
      step++;
      continue;
    }
    const bar = Math.floor(step / 8) % 4;
    const pos = step % 8;
    if (pos === 0 || pos === 4) note(nf(ROOTS[bar]), nextTime, STEP * 1.2, 'triangle', 0.95);
    if (pos === 2 || pos === 6) note(nf(FIFTHS[bar]), nextTime, STEP * 0.9, 'triangle', 0.6);
    const m = MELODY[step % MELODY.length];
    if (m) note(nf(m), nextTime, STEP * 1.1, 'square', 0.38);
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
