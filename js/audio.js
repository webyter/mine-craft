// Synthesized sound effects + generative ambient music (Web Audio)
let ctx = null, master = null, sfxGain = null, musicGain = null, noiseBuf = null;
export const audioSettings = { sfx: 0.8, music: 0.5 };

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = 1; master.connect(ctx.destination);
  sfxGain = ctx.createGain(); sfxGain.gain.value = audioSettings.sfx; sfxGain.connect(master);
  musicGain = ctx.createGain(); musicGain.gain.value = audioSettings.music * 0.35; musicGain.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  startMusic();
}
export function setVolumes() {
  if (!ctx) return; sfxGain.gain.value = audioSettings.sfx; musicGain.gain.value = audioSettings.music * 0.35;
}
function noise(dur, freq, q, vol, type = 'bandpass', attack = 0.003) {
  if (!ctx) return;
  const t = ctx.currentTime; const src = ctx.createBufferSource(); src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f); f.connect(g); g.connect(sfxGain); src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
}
function tone(freq, dur, vol, type = 'sine', slide = 0, out = sfxGain, when = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + when; const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05);
}
const MAT = (id) => {
  if ([1, 2, 18, 42, 32, 33, 34, 55].includes(id)) return 'grass';
  if ([6, 7, 47].includes(id)) return 'sand';
  if ([8, 10, 21, 23, 25, 27, 41, 46, 56, 37, 64, 72].includes(id)) return 'wood';
  if ([58, 59, 60, 61, 62, 63].includes(id)) return 'grass';
  if ([9, 22, 24].includes(id)) return 'leaf';
  if ([12, 19, 38].includes(id)) return 'glass';
  if ([35, 49, 50, 51, 52, 53].includes(id)) return 'cloth';
  return 'stone';
};
const MATSND = { grass: [700, 1.2], sand: [1800, 0.7], wood: [380, 3], leaf: [1400, 0.8], glass: [2600, 4], cloth: [500, 0.6], stone: [900, 2.5] };
export const sfx = {
  dig(id) { const [f, q] = MATSND[MAT(id)]; noise(0.12, f * (0.85 + Math.random() * 0.3), q, 0.5); },
  brk(id) { const m = MAT(id); const [f, q] = MATSND[m]; noise(0.25, f, q, 0.8); if (m === 'glass') { tone(2400, 0.2, 0.15, 'triangle', 0.5); tone(3100, 0.25, 0.1, 'triangle', 0.6); } },
  place(id) { const [f, q] = MATSND[MAT(id)]; noise(0.14, f * 0.8, q, 0.7); },
  step(id) { const [f, q] = MATSND[MAT(id)]; noise(0.08, f * (0.8 + Math.random() * 0.4), q, 0.22); },
  hurt() { tone(220, 0.18, 0.35, 'square', 0.6); noise(0.12, 600, 1, 0.3); },
  hit() { noise(0.1, 500, 1.5, 0.6); tone(140, 0.1, 0.25, 'square', 0.5); },
  pop() { tone(500 + Math.random() * 300, 0.08, 0.2, 'sine', 2.2); },
  eat() { for (let i = 0; i < 3; i++) setTimeout(() => noise(0.08, 1200, 1.5, 0.4), i * 140); },
  burp() { tone(140, 0.3, 0.3, 'sawtooth', 0.7); },
  explode() { noise(1.4, 200, 0.5, 1.2, 'lowpass', 0.005); noise(0.6, 800, 0.8, 0.6); tone(60, 0.9, 0.6, 'sine', 0.4); },
  fuse() { noise(1.2, 3000, 0.6, 0.15, 'highpass'); },
  splash() { noise(0.4, 1200, 0.6, 0.5, 'lowpass'); },
  click() { tone(900, 0.04, 0.15, 'square', 1); },
  pig() { tone(330, 0.15, 0.2, 'sawtooth', 0.7); tone(300, 0.12, 0.15, 'sawtooth', 0.7, sfxGain, 0.16); },
  cow() { tone(140, 0.6, 0.25, 'sawtooth', 0.8); },
  sheep() { for (let i = 0; i < 4; i++) tone(420, 0.08, 0.12, 'sawtooth', 0.95, sfxGain, i * 0.07); },
  zombie() { tone(110, 0.7, 0.25, 'sawtooth', 0.7); noise(0.6, 300, 1, 0.15); },
  hiss() { noise(1.4, 4500, 0.4, 0.4, 'highpass', 0.2); },
  levelup() { tone(523, 0.15, 0.2, 'triangle'); tone(659, 0.15, 0.2, 'triangle', 0, sfxGain, 0.1); tone(784, 0.3, 0.2, 'triangle', 0, sfxGain, 0.2); },
  villager() { const b = 260 + Math.random() * 60; tone(b, 0.12, 0.2, 'sawtooth', 1.3); tone(b * 1.2, 0.16, 0.18, 'sawtooth', 0.7, sfxGain, 0.12); },
  villagerNo() { tone(240, 0.12, 0.2, 'sawtooth', 0.8); tone(200, 0.2, 0.18, 'sawtooth', 0.7, sfxGain, 0.13); },
  golem() { tone(70, 0.5, 0.35, 'square', 0.6); noise(0.3, 200, 1, 0.3); },
  bell() { for (const [f, v] of [[880, 0.25], [1320, 0.12], [2210, 0.06]]) tone(f, 2.2, v, 'sine', 0.995); },
  trade() { tone(784, 0.1, 0.15, 'triangle'); tone(1047, 0.18, 0.15, 'triangle', 0, sfxGain, 0.08); },
  till() { noise(0.15, 500, 1, 0.6); },
  portal() { tone(180, 2.5, 0.12, 'sawtooth', 1.6); tone(240, 2.5, 0.08, 'triangle', 1.4); noise(2.2, 900, 0.5, 0.18, 'bandpass', 0.6); },
  portalTravel() { tone(120, 1.2, 0.2, 'sawtooth', 3); noise(1.0, 1500, 0.4, 0.35, 'bandpass', 0.05); },
  ghast() { tone(520 + Math.random() * 200, 0.9, 0.18, 'sawtooth', 0.55); tone(700, 0.6, 0.1, 'triangle', 0.6, sfxGain, 0.1); },
  ghastShoot() { tone(300, 0.4, 0.2, 'sawtooth', 0.4); noise(0.4, 600, 0.6, 0.4); },
  blaze() { noise(0.8, 300, 0.4, 0.35, 'lowpass', 0.1); tone(90, 0.6, 0.12, 'sawtooth', 1.2); },
  fireball() { noise(0.35, 1200, 0.6, 0.35, 'bandpass', 0.01); },
  fizz() { noise(0.6, 5000, 0.5, 0.35, 'highpass', 0.01); },
  enchant() { for (let i = 0; i < 5; i++) tone(900 + i * 220, 0.25, 0.08, 'triangle', 1.2, sfxGain, i * 0.06); },
  slime() { noise(0.15, 300, 1.2, 0.5, 'lowpass'); tone(120, 0.12, 0.2, 'sine', 0.6); },
  heart() { tone(660, 0.12, 0.12, 'sine', 1.3); tone(880, 0.16, 0.1, 'sine', 1.1, sfxGain, 0.1); },
  craft() { noise(0.1, 500, 2, 0.4); tone(660, 0.1, 0.1, 'triangle', 1, sfxGain, 0.05); },
  horn() { tone(392, 0.32, 0.22, 'sawtooth'); tone(494, 0.32, 0.18, 'sawtooth'); },
  ding() { tone(1318, 0.5, 0.18, 'sine'); tone(1046, 0.7, 0.14, 'sine', 1, sfxGain, 0.18); },
  shutter() { noise(0.05, 3000, 1, 0.5); noise(0.06, 1800, 1, 0.4, 'bandpass', 0.05); },
  pop() { tone(660, 0.08, 0.2, 'triangle', 1.6); },
  engine(v) { if (Math.random() < 0.5) tone(55 + v * 6, 0.12, 0.05 + Math.min(0.06, v * 0.004), 'sawtooth', 1.05); },
  plane(v) { noise(0.3, 300, 0.6, 0.08 * v, 'lowpass'); },
};

// Generative calm piano-ish music
const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
function startMusic() {
  let next = ctx.currentTime + 6;
  const roots = [48, 53, 55, 50, 57];
  const loop = () => {
    if (!ctx) return;
    if (ctx.currentTime > next - 1) {
      const root = roots[Math.floor(Math.random() * roots.length)];
      let t = 0; const phrase = 6 + Math.floor(Math.random() * 8);
      // chord
      for (const iv of [0, 7, 16]) pianoNote(root - 12 + iv, next, 4.5, 0.12);
      for (let i = 0; i < phrase; i++) {
        const n = root + SCALE[Math.floor(Math.random() * SCALE.length)];
        pianoNote(n, next + t, 2.6, 0.14 + Math.random() * 0.06);
        t += [0.5, 0.75, 1, 1, 1.5][Math.floor(Math.random() * 5)];
      }
      next += t + 6 + Math.random() * 14; // pauses like the real game
    }
    setTimeout(loop, 500);
  };
  loop();
}
function pianoNote(midi, when, dur, vol) {
  const f = 440 * Math.pow(2, (midi - 69) / 12);
  const g = ctx.createGain(); g.connect(musicGain);
  g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(vol, when + 0.01); g.gain.exponentialRampToValueAtTime(vol * 0.3, when + 0.4); g.gain.exponentialRampToValueAtTime(0.0005, when + dur);
  for (const [mult, v, type] of [[1, 1, 'triangle'], [2, 0.3, 'sine'], [3, 0.12, 'sine']]) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = f * mult;
    const og = ctx.createGain(); og.gain.value = v; o.connect(og); og.connect(g); o.start(when); o.stop(when + dur + 0.1);
  }
}
