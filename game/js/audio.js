// audio.js — every sound is synthesised with WebAudio in code: soft footsteps,
// a thrown coin's tick, pickup chimes and the alarm sting. No audio files.
// The context is created lazily on the first key or click, as browsers require.

let actx = null;
let master = null;

export function ensureAudio() {
  if (actx) {
    if (actx.state === 'suspended') actx.resume();
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  actx = new AC();
  master = actx.createGain();
  master.gain.value = 0.5;
  master.connect(actx.destination);
}

// One short oscillator note with an exponential decay envelope.
function note(freq, dur, { type = 'sine', gain = 0.2, slideTo = null, delay = 0 } = {}) {
  if (!actx) return;
  const t0 = actx.currentTime + delay;
  const osc = actx.createOscillator();
  const g = actx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

// A breath of filtered noise, for footsteps and cloth rustle.
function hush(dur, { gain = 0.1, freq = 800, delay = 0 } = {}) {
  if (!actx) return;
  const t0 = actx.currentTime + delay;
  const len = Math.max(1, Math.floor(actx.sampleRate * dur));
  const buf = actx.createBuffer(1, len, actx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = actx.createBufferSource();
  src.buffer = buf;
  const filter = actx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = freq;
  const g = actx.createGain();
  g.gain.value = gain;
  src.connect(filter);
  filter.connect(g);
  g.connect(master);
  src.start(t0);
}

export const sfx = {
  // Footstep volume follows stance: a sprint is heard across the room, a
  // sneak barely at all. vol scales with the listener's distance for guards.
  step(stance, vol = 1) {
    if (stance === 'sneak') hush(0.05, { gain: 0.03 * vol, freq: 500 });
    else if (stance === 'sprint') hush(0.09, { gain: 0.16 * vol, freq: 1100 });
    else hush(0.07, { gain: 0.08 * vol, freq: 800 });
  },
  guardStep(vol) {
    hush(0.08, { gain: 0.1 * vol, freq: 350 });
    note(70, 0.07, { type: 'triangle', gain: 0.05 * vol });
  },
  coin() {
    note(2093, 0.09, { type: 'sine', gain: 0.12 });
    note(2637, 0.14, { type: 'sine', gain: 0.1, delay: 0.05 });
  },
  pickup() {
    note(880, 0.08, { type: 'triangle', gain: 0.12 });
    note(1318, 0.12, { type: 'triangle', gain: 0.1, delay: 0.06 });
  },
  takeAtlas() {
    note(523, 0.16, { type: 'triangle', gain: 0.14 });
    note(784, 0.2, { type: 'triangle', gain: 0.12, delay: 0.09 });
    note(1046, 0.3, { type: 'triangle', gain: 0.1, delay: 0.18 });
  },
  alert() {
    note(392, 0.14, { type: 'square', gain: 0.07 });
    note(587, 0.22, { type: 'square', gain: 0.07, delay: 0.1 });
  },
  glimpse() {
    note(740, 0.1, { type: 'sine', gain: 0.09, slideTo: 988 });
  },
  caught() {
    note(220, 0.35, { type: 'sawtooth', gain: 0.12, slideTo: 110 });
    hush(0.3, { gain: 0.12, freq: 500 });
  },
  levelDone() {
    note(659, 0.12, { type: 'triangle', gain: 0.12 });
    note(880, 0.2, { type: 'triangle', gain: 0.12, delay: 0.1 });
  },
  win() {
    note(523, 0.14, { type: 'triangle', gain: 0.12 });
    note(659, 0.14, { type: 'triangle', gain: 0.12, delay: 0.12 });
    note(784, 0.14, { type: 'triangle', gain: 0.12, delay: 0.24 });
    note(1046, 0.34, { type: 'triangle', gain: 0.12, delay: 0.36 });
  },
};
