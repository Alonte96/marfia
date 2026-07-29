// Procedural ambient soundtrack — pure Web Audio, no asset files.
// Night: a low breathing drone with crickets. Day: a warm pad with birdsong.
// The two beds crossfade over 1.4s in step with the visual world-shift, and a
// death rings a low knell. Everything hangs off one lazily-created context
// (browsers require a user gesture), with a persisted mute preference.
let ctx = null;
let master = null;
let nightBus = null;
let dayBus = null;
let currentNight = true;

let muted = false;
try {
  muted = localStorage.getItem('ww:muted') === '1';
} catch {
  /* ignore */
}

const BASE_VOL = 0.45;

export function ensureAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  try {
    ctx = new AC();
  } catch {
    return;
  }
  master = ctx.createGain();
  master.gain.value = muted ? 0 : BASE_VOL;
  master.connect(ctx.destination);
  nightBus = ctx.createGain();
  nightBus.gain.value = currentNight ? 1 : 0;
  nightBus.connect(master);
  dayBus = ctx.createGain();
  dayBus.gain.value = currentNight ? 0 : 1;
  dayBus.connect(master);
  buildNight();
  buildDay();
  loopCrickets();
  loopBirds();
}

function osc(type, freq, dest, gainVal) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.value = gainVal;
  o.connect(g);
  g.connect(dest);
  o.start();
}

function buildNight() {
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 220;
  lp.connect(nightBus);
  osc('sine', 55, lp, 0.5); // deep drone, slightly detuned pair
  osc('sine', 55.7, lp, 0.4);
  osc('sine', 110.3, lp, 0.12);
  const lfo = ctx.createOscillator(); // slow breathing on the filter
  lfo.frequency.value = 0.05;
  const lfoG = ctx.createGain();
  lfoG.gain.value = 60;
  lfo.connect(lfoG);
  lfoG.connect(lp.frequency);
  lfo.start();
}

function buildDay() {
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 750;
  lp.connect(dayBus);
  osc('sine', 98.0, lp, 0.1); // low warmth
  osc('triangle', 196.0, lp, 0.1); // G3
  osc('triangle', 246.9, lp, 0.07); // B3
  osc('triangle', 293.7, lp, 0.05); // D4
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.07;
  const lfoG = ctx.createGain();
  lfoG.gain.value = 140;
  lfo.connect(lfoG);
  lfoG.connect(lp.frequency);
  lfo.start();
}

function loopCrickets() {
  setTimeout(() => {
    if (ctx) cricket();
    loopCrickets();
  }, 1800 + Math.random() * 3800);
}

function cricket() {
  const t0 = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.value = 4100 + Math.random() * 500;
  const g = ctx.createGain();
  g.gain.value = 0;
  o.connect(g);
  g.connect(nightBus);
  for (let i = 0; i < 3; i++) {
    const t = t0 + i * 0.09;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.02);
    g.gain.linearRampToValueAtTime(0, t + 0.06);
  }
  o.start(t0);
  o.stop(t0 + 0.4);
}

function loopBirds() {
  setTimeout(() => {
    if (ctx) bird();
    loopBirds();
  }, 2600 + Math.random() * 5200);
}

function bird() {
  const t0 = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = 'sine';
  const g = ctx.createGain();
  g.gain.value = 0;
  o.connect(g);
  g.connect(dayBus);
  const f = 2100 + Math.random() * 900;
  o.frequency.setValueAtTime(f, t0);
  o.frequency.linearRampToValueAtTime(f + 500 + Math.random() * 400, t0 + 0.08);
  o.frequency.linearRampToValueAtTime(f - 150, t0 + 0.16);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(0.035, t0 + 0.03);
  g.gain.linearRampToValueAtTime(0, t0 + 0.22);
  o.start(t0);
  o.stop(t0 + 0.3);
}

// Crossfade the beds to match the visual world (1.4s, same as the CSS fade).
export function setScene(night) {
  currentNight = night;
  if (!ctx) return;
  const t = ctx.currentTime;
  nightBus.gain.cancelScheduledValues(t);
  dayBus.gain.cancelScheduledValues(t);
  nightBus.gain.setValueAtTime(nightBus.gain.value, t);
  dayBus.gain.setValueAtTime(dayBus.gain.value, t);
  nightBus.gain.linearRampToValueAtTime(night ? 1 : 0, t + 1.4);
  dayBus.gain.linearRampToValueAtTime(night ? 0 : 1, t + 1.4);
}

// A low two-tone knell when someone dies.
export function deathKnell() {
  if (!ctx) return;
  const t0 = ctx.currentTime;
  [98, 147.2].forEach((f, i) => {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(i ? 0.07 : 0.15, t0 + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.6);
    o.connect(g);
    g.connect(master);
    o.start(t0);
    o.stop(t0 + 1.7);
  });
}

export function toggleMute() {
  muted = !muted;
  try {
    localStorage.setItem('ww:muted', muted ? '1' : '0');
  } catch {
    /* ignore */
  }
  if (ctx) master.gain.setTargetAtTime(muted ? 0 : BASE_VOL, ctx.currentTime, 0.05);
  return muted;
}

export function isMuted() {
  return muted;
}
