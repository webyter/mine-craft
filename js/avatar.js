// VoxCraft — customizable player avatars (blocky humanoid), nametags, chat bubbles, emotes
import * as THREE from 'three';

export const SKIN_TONES = ['#f6d7b8', '#eec39a', '#d9a066', '#c68642', '#a0663d', '#8d5524', '#6b3e26', '#4a2c1a'];
export const HAIR_COLORS = ['#1b1b1b', '#3b2416', '#6a4325', '#a8763e', '#e3c16f', '#b8452c', '#d9d9d9', '#7d3cff', '#2f8ce0', '#e84b9a'];
export const EYE_COLORS = ['#3b2416', '#2f6fd0', '#3c9a46', '#7a7a7a', '#a0602a', '#7d3cff'];
export const CLOTH_COLORS = ['#2f6fd0', '#d23c3c', '#3c9a46', '#f0c419', '#ffffff', '#262626', '#8a4fd1', '#f08a24', '#1fb5b0', '#e84b9a', '#6b4a2b', '#7a8a99'];
export const OPTIONS = {
  body: [['classic', 'Classic'], ['slim', 'Slim']],
  hair: [['short', 'Short'], ['long', 'Long'], ['buzz', 'Buzz cut'], ['mohawk', 'Mohawk'], ['ponytail', 'Ponytail'], ['afro', 'Afro'], ['braids', 'Braids'], ['bun', 'Bun'], ['none', 'Bald']],
  shirt: [['tee', 'T-shirt'], ['hoodie', 'Hoodie'], ['jacket', 'Jacket'], ['suit', 'Suit'], ['tank', 'Tank top'], ['jersey', 'Jersey'], ['dress', 'Dress'], ['kente', 'Kente']],
  hat: [['none', 'None'], ['cap', 'Cap'], ['beanie', 'Beanie'], ['crown', 'Crown'], ['tophat', 'Top hat'], ['headphones', 'Headphones'], ['helmet', 'Helmet'], ['bandana', 'Bandana']],
  extra: [['none', 'None'], ['glasses', 'Glasses'], ['shades', 'Sunglasses'], ['beard', 'Beard'], ['freckles', 'Freckles'], ['mask', 'Face mask']],
  cape: [['none', 'None'], ['#d23c3c', 'Red'], ['#2f6fd0', 'Blue'], ['#3c9a46', 'Green'], ['#262626', 'Black'], ['#f0c419', 'Gold'], ['#8a4fd1', 'Purple']],
};
export const DEFAULT_SKIN = { skin: '#d9a066', body: 'classic', hair: 'short', hairColor: '#3b2416', eyes: '#3b2416', shirt: 'tee', shirtColor: '#1fb5b0', pants: '#2f4f8a', shoes: '#4a4a4a', hat: 'none', hatColor: '#d23c3c', extra: 'none', cape: 'none' };
export function randomSkin(r = Math.random) {
  const pick = (a) => a[Math.floor(r() * a.length)];
  return {
    skin: pick(SKIN_TONES), body: pick(['classic', 'slim']), hair: pick(OPTIONS.hair)[0], hairColor: pick(HAIR_COLORS), eyes: pick(EYE_COLORS),
    shirt: pick(OPTIONS.shirt)[0], shirtColor: pick(CLOTH_COLORS), pants: pick(CLOTH_COLORS), shoes: pick(['#262626', '#ffffff', '#6b4a2b', '#d23c3c', '#4a4a4a']),
    hat: r() < 0.55 ? 'none' : pick(OPTIONS.hat)[0], hatColor: pick(CLOTH_COLORS), extra: r() < 0.6 ? 'none' : pick(OPTIONS.extra)[0], cape: r() < 0.75 ? 'none' : pick(OPTIONS.cape.slice(1))[0],
  };
}
export const EMOTES = [
  { id: 'wave', label: 'Wave', icon: 'hand' }, { id: 'clap', label: 'Clap', icon: 'clap' }, { id: 'dance', label: 'Dance', icon: 'note' }, { id: 'point', label: 'Over there', icon: 'arrow' },
  { id: 'bow', label: 'Bow', icon: 'bow' }, { id: 'laugh', label: 'Laugh', icon: 'ha' }, { id: 'cheer', label: 'Cheer', icon: 'star' }, { id: 'heart', label: 'Love', icon: 'heart' },
  { id: 'sit', label: 'Sit', icon: 'sit' }, { id: 'shrug', label: 'Shrug', icon: 'q' }, { id: 'thumbs', label: 'Thumbs up', icon: 'ok' }, { id: 'cry', label: 'Sad', icon: 'tear' },
];
const EMOTE_LEN = { wave: 2.4, clap: 2.4, dance: 6, point: 2.2, bow: 2.2, laugh: 2.6, cheer: 2.6, heart: 2.6, sit: 9999, shrug: 1.8, thumbs: 2, cry: 3 };

const PX = 1.8 / 32;
function shade(hex, k) { const c = new THREE.Color(hex); c.multiplyScalar(k); return '#' + c.getHexString(); }
const R = 4; // device pixels per skin unit (8 units per head face -> 32px)
function cv(w, h, draw, opts = {}) {
  const c = document.createElement('canvas'); c.width = w * R; c.height = h * R; const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  g.setTransform(R, 0, 0, R, 0, 0); draw(g, w, h);
  if (!opts.noShade) faceShade(g, w, h, opts);
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.NoColorSpace; return t; }
// soft top-lit gradient + gentle edge occlusion so every face reads as a rounded, lit surface
function faceShade(g, w, h, o) {
  g.save();
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, `rgba(255,248,235,${o.hi ?? 0.10})`); gr.addColorStop(0.45, 'rgba(255,255,255,0)'); gr.addColorStop(1, `rgba(20,10,30,${o.lo ?? 0.16})`);
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(20,10,30,0.10)'; const e = 0.25;
  g.fillRect(0, 0, e, h); g.fillRect(w - e, 0, e, h); g.fillRect(0, h - e, w, e);
  g.fillStyle = 'rgba(255,255,255,0.07)'; g.fillRect(e, 0, w - 2 * e, e);
  g.restore();
}
// half-unit pixel helpers (16 "skin pixels" per face edge)
const H = 0.5;
function hairPat(hc, seed = 7) {
  const n = 16, c = document.createElement('canvas'); c.width = n; c.height = n; const g = c.getContext('2d'); let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let x = 0; x < n; x++) { const base = 0.86 + rnd() * 0.26; for (let y = 0; y < n; y++) { const hl = (y + x * 3) % 11 === 0 ? 1.18 : 1; g.fillStyle = shade(hc, base * hl * (1 + (rnd() - 0.5) * 0.05)); g.fillRect(x, y, 1, 1); } }
  const p = g.createPattern(c, 'repeat'); p.setTransform(new DOMMatrix().scale(H)); return p;
}
function clothPat(col, seed = 3, amt = 0.07) {
  const n = 16, c = document.createElement('canvas'); c.width = n; c.height = n; const g = c.getContext('2d'); let s = seed * 7919 + 17;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const weave = ((x + y) & 1) ? 1.025 : 0.975; g.fillStyle = shade(col, weave * (1 + (rnd() - 0.5) * amt)); g.fillRect(x, y, 1, 1); }
  const p = g.createPattern(c, 'repeat'); p.setTransform(new DOMMatrix().scale(H)); return p;
}
function patTex(fill, w = 8, h = 8, opts) { return cv(w, h, (g) => { g.fillStyle = fill; g.fillRect(0, 0, w, h); if (opts?.trim) opts.trim(g, w, h); }, opts); }
function mat(tex) { return new THREE.MeshLambertMaterial({ map: tex, transparent: false, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.22 }); }
function noise(g, w, h, col, amt = 0.08, seed = 1) { let s = seed * 131 + 7; for (let y = 0; y < h; y += H) for (let x = 0; x < w; x += H) { s = (s * 16807) % 2147483647; const k = 1 + ((s / 2147483647) - 0.5) * amt * 0.7; g.fillStyle = shade(col, k); g.fillRect(x, y, H, H); } }

// ---------- head faces ----------
function headTextures(S) {
  const skin = S.skin, hc = S.hairColor, hair = S.hair;
  const hairTop = hair !== 'none' && hair !== 'buzz' ? 1 : 0; const HP = hairPat(hc), HPB = hairPat(shade(hc, 0.9), 3);
  const face = cv(8, 8, (g) => {
    noise(g, 8, 8, skin, 0.05, 3);
    // hair fringe
    if (hair === 'buzz') { g.fillStyle = HPB; g.fillRect(0, 0, 8, 1); }
    else if (hair === 'mohawk') { g.fillStyle = HP; g.fillRect(3, 0, 2, 1); }
    else if (hair !== 'none') { g.fillStyle = HP; g.fillRect(0, 0, 8, hair === 'afro' ? 2 : 1); g.fillRect(0, 1, 1, hair === 'long' || hair === 'braids' ? 4 : 2); g.fillRect(7, 1, 1, hair === 'long' || hair === 'braids' ? 4 : 2); if (hair === 'short' || hair === 'long') g.fillRect(1, 1, 2, 1); }
    // jagged fringe tips + soft shadow cast by hair on forehead
    if (hair !== 'none' && hair !== 'buzz' && hair !== 'mohawk') {
      const fy = hair === 'afro' ? 2 : 1; g.fillStyle = HP;
      for (const x of [0.5, 2, 3.5, 5.5, 6.5]) g.fillRect(x, fy, H, H);
      g.fillStyle = 'rgba(40,20,10,0.18)'; g.fillRect(1, fy, 6, H);
    }
    // cheeks blush
    g.fillStyle = 'rgba(255,110,120,0.22)'; g.fillRect(0.5, 5, 1.5, 1); g.fillRect(6, 5, 1.5, 1);
    // eyes: lash line, white, iris, pupil, catch-light
    const lash = shade(hair === 'none' ? '#3b2416' : hc, 0.55);
    for (const [ex, ix] of [[1, 2], [5, 5]]) {
      g.fillStyle = '#fbfbff'; g.fillRect(ex, 4, 2, 1);
      g.fillStyle = 'rgba(120,120,160,0.35)'; g.fillRect(ex, 4, 2, 0.25);
      g.fillStyle = S.eyes; g.fillRect(ix, 3.75, 1, 1.25);
      g.fillStyle = shade(S.eyes, 1.35); g.fillRect(ix, 4.5, 1, 0.5);
      g.fillStyle = '#120a08'; g.fillRect(ix + 0.25, 4, 0.5, 0.75);
      g.fillStyle = '#ffffff'; g.fillRect(ix + (ix === 2 ? 0.25 : 0.5), 4, 0.25, 0.25);
      g.fillStyle = lash; g.fillRect(ex - 0.25, 3.5, 2.5, 0.5);
    }
    // brows
    g.fillStyle = shade(hair === 'none' ? skin : hc, hair === 'none' ? 0.65 : 0.85);
    g.fillRect(1, 2.75, 2, 0.5); g.fillRect(0.75, 3, 0.5, 0.25); g.fillRect(5, 2.75, 2, 0.5); g.fillRect(6.75, 3, 0.5, 0.25);
    // nose: highlight on bridge, shadow underneath
    g.fillStyle = shade(skin, 1.08); g.fillRect(3.5, 4.5, 1, 0.5);
    g.fillStyle = shade(skin, 0.8); g.fillRect(3.25, 5.25, 1.5, 0.5);
    g.fillStyle = shade(skin, 0.68); g.fillRect(3.25, 5.5, 0.5, 0.25); g.fillRect(4.25, 5.5, 0.5, 0.25);
    // mouth: upper lip line, lower lip with highlight, smile corners
    g.fillStyle = shade(skin, 0.52); g.fillRect(3.25, 6.5, 1.5, 0.25); g.fillRect(3, 6.25, 0.25, 0.25); g.fillRect(4.75, 6.25, 0.25, 0.25);
    g.fillStyle = 'rgba(205,85,95,0.45)'; g.fillRect(3.25, 6.75, 1.5, 0.25);
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(3.5, 7, 1, 0.25);
    // chin shadow
    g.fillStyle = 'rgba(60,30,20,0.10)'; g.fillRect(2, 7.5, 4, 0.5);
    if (S.extra === 'beard') { g.fillStyle = hair === 'none' ? '#3b2416' : hc; g.fillRect(1, 6, 2, 2); g.fillRect(5, 6, 2, 2); g.fillRect(1, 7, 6, 1); g.fillRect(3, 6, 2, 1); g.fillStyle = shade(skin, 0.45); g.fillRect(3, 6, 2, 1); }
    if (S.extra === 'freckles') { g.fillStyle = shade(skin, 0.75); g.fillRect(1, 5, 1, 1); g.fillRect(6, 5, 1, 1); g.fillRect(2, 5, 1, 1); }
    if (S.extra === 'glasses') { g.fillStyle = '#1e1e24'; for (const x of [0.75, 4.75]) { g.fillRect(x, 3.5, 2.5, 0.25); g.fillRect(x, 5, 2.5, 0.25); g.fillRect(x, 3.5, 0.25, 1.75); g.fillRect(x + 2.25, 3.5, 0.25, 1.75); } g.fillRect(3.25, 4, 1.5, 0.25); g.fillRect(0, 3.75, 0.75, 0.25); g.fillRect(7.25, 3.75, 0.75, 0.25); g.fillStyle = 'rgba(190,225,255,0.28)'; g.fillRect(1, 3.75, 2, 1.25); g.fillRect(5, 3.75, 2, 1.25); g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(1.25, 3.75, 0.5, 0.25); g.fillRect(5.25, 3.75, 0.5, 0.25); }
    if (S.extra === 'shades') { g.fillStyle = '#0d0d12'; g.fillRect(0, 3.5, 8, 0.5); g.fillRect(0.75, 3.5, 2.5, 2); g.fillRect(4.75, 3.5, 2.5, 2); const sg = g.createLinearGradient(0, 3.75, 0, 5.25); sg.addColorStop(0, '#3a4a6e'); sg.addColorStop(1, '#141824'); g.fillStyle = sg; g.fillRect(1, 3.75, 2, 1.5); g.fillRect(5, 3.75, 2, 1.5); g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(1.25, 4, 0.75, 0.25); g.fillRect(5.25, 4, 0.75, 0.25); }
    if (S.extra === 'mask') { g.fillStyle = '#eef4f7'; g.fillRect(1, 5, 6, 3); g.fillStyle = '#c6d4dc'; g.fillRect(1, 5.75, 6, 0.25); g.fillRect(1, 6.75, 6, 0.25); g.fillStyle = '#9fb2bd'; g.fillRect(0, 5, 1, 0.25); g.fillRect(7, 5, 1, 0.25); g.fillRect(1, 7.75, 6, 0.25); }
    if (S.hat === 'bandana') { g.fillStyle = S.hatColor; g.fillRect(0, 1, 8, 2); g.fillStyle = '#fff'; g.fillRect(2, 2, 1, 1); g.fillRect(5, 1, 1, 1); }
  });
  const side = (flip) => cv(8, 8, (g) => {
    noise(g, 8, 8, skin, 0.05, flip ? 7 : 9);
    if (hair !== 'none') {
      g.fillStyle = HP;
      const h = hair === 'buzz' ? 1 : hair === 'mohawk' ? 0 : hair === 'long' || hair === 'braids' ? 7 : hair === 'afro' ? 5 : 3;
      if (hair === 'buzz') { g.fillStyle = HPB; g.fillRect(0, 0, 8, 2); }
      else if (h) { g.fillRect(0, 0, 8, Math.min(h, 3)); for (let x = 4; x < 8; x++) g.fillRect(x, 0, 1, h); g.fillRect(0, 0, 2, h > 3 ? 3 : h); }
      if (hair === 'braids') { g.fillStyle = shade(hc, 0.75); for (let y = 1; y < 8; y += 2) g.fillRect(5, y, 1, 1); }
    }
    g.fillStyle = shade(skin, 0.82); g.fillRect(flip ? 3 : 4, 4, 1, 2); g.fillStyle = shade(skin, 0.68); g.fillRect(flip ? 3.5 : 4.25, 4.5, 0.25, 1); g.fillStyle = shade(skin, 1.1); g.fillRect(flip ? 3 : 4.75, 4, 0.25, 2); // ear
    if (S.extra === 'glasses' || S.extra === 'shades') { g.fillStyle = '#222'; g.fillRect(0, 4, 4, 1); }
    if (S.extra === 'beard') { g.fillStyle = hair === 'none' ? '#3b2416' : hc; g.fillRect(0, 5, 3, 3); }
    if (S.extra === 'mask') { g.fillStyle = '#e8f0f4'; g.fillRect(0, 5, 3, 1); }
    if (S.hat === 'bandana') { g.fillStyle = S.hatColor; g.fillRect(0, 1, 8, 2); }
    if (S.hat === 'headphones') { g.fillStyle = '#222'; g.fillRect(2, 3, 4, 4); g.fillStyle = S.hatColor; g.fillRect(3, 4, 2, 2); }
  });
  const top = cv(8, 8, (g) => { if (hair === 'none' || hair === 'mohawk') noise(g, 8, 8, skin, 0.05, 4); else { g.fillStyle = hair === 'buzz' ? HPB : HP; g.fillRect(0, 0, 8, 8); } if (hair === 'mohawk') { g.fillStyle = HP; g.fillRect(3, 0, 2, 8); } if (S.hat === 'bandana') { g.fillStyle = S.hatColor; g.fillRect(0, 0, 8, 8); g.fillStyle = '#fff'; g.fillRect(3, 3, 1, 1); g.fillRect(5, 5, 1, 1); } });
  const back = cv(8, 8, (g) => {
    noise(g, 8, 8, skin, 0.05, 6);
    if (hair !== 'none' && hair !== 'mohawk') { g.fillStyle = hair === 'buzz' ? HPB : HP; const h = hair === 'buzz' ? 3 : hair === 'long' || hair === 'braids' ? 8 : hair === 'short' || hair === 'bun' || hair === 'ponytail' ? 6 : 7; g.fillRect(0, 0, 8, h); if (hair === 'braids') { g.fillStyle = shade(hc, 0.72); for (let x = 1; x < 8; x += 2) for (let y = 1; y < 8; y += 2) g.fillRect(x, y, 1, 1); } }
    if (hair === 'mohawk') { g.fillStyle = HP; g.fillRect(3, 0, 2, 6); }
    if (S.hat === 'bandana') { g.fillStyle = S.hatColor; g.fillRect(0, 1, 8, 2); g.fillRect(3, 3, 2, 2); }
  });
  const bottom = cv(8, 8, (g) => noise(g, 8, 8, shade(skin, 0.86), 0.04, 8), { hi: 0, lo: 0.1 });
  void hairTop;
  // box face order: +x, -x, +y, -y, +z, -z ; model faces -z
  return [mat(side(true)), mat(side(false)), mat(top), mat(bottom), mat(back), mat(face)];
}

// ---------- torso ----------
function cloth(g, x, y, w, h, col, seed) { g.fillStyle = clothPat(col, seed); g.fillRect(x, y, w, h); }
function belt(g, w, S, buckle) { g.fillStyle = shade(S.pants, 0.55); g.fillRect(0, 10.75, w, 1.25); g.fillStyle = shade(S.pants, 0.4); g.fillRect(0, 11.75, w, 0.25); if (buckle) { g.fillStyle = '#e8c45a'; g.fillRect(3.25, 10.75, 1.5, 1.25); g.fillStyle = shade(S.pants, 0.55); g.fillRect(3.75, 11.1, 0.5, 0.5); g.fillStyle = '#fff2b0'; g.fillRect(3.25, 10.75, 1.5, 0.25); } }
function folds(g, c) { g.fillStyle = shade(c, 0.88); g.fillRect(1.5, 8, 0.25, 2); g.fillRect(6.25, 7.5, 0.25, 2.5); g.fillRect(2, 9.5, 1, 0.25); g.fillStyle = shade(c, 1.1); g.fillRect(1.75, 8, 0.25, 1.5); g.fillRect(6.5, 7.5, 0.25, 2); }
function torsoTextures(S) {
  const c = S.shirtColor, st = S.shirt;
  const front = cv(8, 12, (g) => {
    cloth(g, 0, 0, 8, 12, c, 11); if (st !== 'kente') folds(g, c);
    // shoulder seams + chest shading
    g.fillStyle = shade(c, 0.85); g.fillRect(0, 0, 8, 0.25); g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(0, 5.5, 8, 0.25);
    if (st === 'tank') { g.fillStyle = S.skin; g.fillRect(0, 0, 2, 2); g.fillRect(6, 0, 2, 2); g.fillRect(3, 0, 2, 1); }
    if (st === 'tee') { g.fillStyle = S.skin; g.fillRect(2.75, 0, 2.5, 0.75); g.fillRect(3.25, 0.75, 1.5, 0.5); g.fillStyle = shade(c, 0.75); g.fillRect(2.5, 0, 0.5, 1); g.fillRect(5, 0, 0.5, 1); g.fillRect(3, 1, 0.5, 0.5); g.fillRect(4.5, 1, 0.5, 0.5); g.fillRect(3.25, 1.25, 1.5, 0.25); }
    if (st === 'hoodie') { g.fillStyle = shade(c, 0.72); g.fillRect(1.5, 0, 5, 1); g.fillStyle = shade(c, 0.85); g.fillRect(2, 6.75, 4, 3.25); g.fillStyle = shade(c, 0.7); g.fillRect(2, 6.75, 4, 0.25); g.fillRect(2, 6.75, 0.25, 3.25); g.fillRect(5.75, 6.75, 0.25, 3.25); g.fillStyle = '#f2f2f2'; g.fillRect(3, 1, 0.25, 3); g.fillRect(4.75, 1, 0.25, 2.5); g.fillStyle = '#c8c8c8'; g.fillRect(2.875, 3.75, 0.5, 0.5); g.fillRect(4.625, 3.25, 0.5, 0.5); g.fillStyle = shade(c, 0.75); g.fillRect(0, 10.5, 8, 0.5); }
    if (st === 'jacket') { cloth(g, 2.75, 0, 2.5, 12, '#ececec', 5); g.fillStyle = shade(c, 0.7); g.fillRect(2.5, 0, 0.5, 12); g.fillRect(5, 0, 0.5, 12); g.fillStyle = '#b8b8b8'; g.fillRect(3.875, 0, 0.25, 12); g.fillStyle = shade(c, 0.75); g.fillRect(0.75, 7, 1.5, 0.25); g.fillRect(5.75, 7, 1.5, 0.25); g.fillStyle = '#d8d8d8'; g.fillRect(3.75, 2, 0.5, 0.5); g.fillStyle = shade(c, 1.15); g.fillRect(2, 0, 0.5, 4); g.fillRect(5.5, 0, 0.5, 4); }
    if (st === 'suit') { g.fillStyle = '#f6f6f6'; g.beginPath(); g.moveTo(2, 0); g.lineTo(6, 0); g.lineTo(4, 6.5); g.closePath(); g.fill(); const tie = S.hatColor || '#d23c3c'; g.fillStyle = tie; g.fillRect(3.5, 0.5, 1, 0.75); g.beginPath(); g.moveTo(3.6, 1.25); g.lineTo(4.4, 1.25); g.lineTo(4.75, 5); g.lineTo(4, 5.9); g.lineTo(3.25, 5); g.closePath(); g.fill(); g.fillStyle = shade(tie, 0.7); g.fillRect(3.5, 1.25, 1, 0.25); g.fillStyle = shade(c, 0.65); g.beginPath(); g.moveTo(1.5, 0); g.lineTo(2.25, 0); g.lineTo(4, 6.5); g.lineTo(3.6, 6.8); g.closePath(); g.fill(); g.beginPath(); g.moveTo(6.5, 0); g.lineTo(5.75, 0); g.lineTo(4, 6.5); g.lineTo(4.4, 6.8); g.closePath(); g.fill(); g.fillStyle = '#e8e8e8'; g.fillRect(3.75, 8, 0.5, 0.5); g.fillRect(3.75, 10, 0.5, 0.5); g.fillStyle = '#ffffff'; g.fillRect(6, 3, 1, 0.5); }
    if (st === 'jersey') { g.fillStyle = 'rgba(255,255,255,0.12)'; for (let y = 1; y < 10; y += 1) g.fillRect(0, y, 8, 0.25); g.fillStyle = '#fff'; g.fillRect(0, 0, 8, 1); g.fillRect(2, 3, 1, 4); g.fillRect(2, 3, 2, 1); g.fillRect(3, 3, 1, 2); g.fillRect(2, 5, 2, 1); g.fillRect(5, 3, 1, 4); g.fillRect(4, 3, 2, 1); g.fillRect(0, 10, 8, 1); }
    if (st === 'dress') { g.fillStyle = shade(c, 0.7); g.fillRect(0, 6, 8, 0.75); g.fillStyle = '#fff3c4'; g.fillRect(3.5, 6, 1, 0.75); g.fillStyle = '#fff'; for (const [x, y] of [[1.5, 8], [5, 8.5], [3, 10], [6.5, 10.5], [1, 11]]) { g.fillRect(x, y, 0.5, 0.5); g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(x - 0.5, y, 0.5, 0.5); g.fillRect(x + 0.5, y, 0.5, 0.5); g.fillRect(x, y - 0.5, 0.5, 0.5); g.fillRect(x, y + 0.5, 0.5, 0.5); g.fillStyle = '#fff'; } g.fillStyle = S.skin; g.beginPath(); g.moveTo(2.5, 0); g.lineTo(5.5, 0); g.lineTo(4, 1.5); g.closePath(); g.fill(); }
    if (st === 'kente') kente(g, 8, 12, c);
    if (st !== 'dress' && st !== 'suit' && st !== 'hoodie') belt(g, 8, S, true);
  });
  const back = cv(8, 12, (g) => { cloth(g, 0, 0, 8, 12, c, 12); g.fillStyle = shade(c, 0.85); g.fillRect(3.875, 1, 0.25, 9); if (st === 'hoodie') { g.fillStyle = shade(c, 0.8); g.fillRect(1, 0, 6, 3); } if (st === 'jersey') { g.fillStyle = '#fff'; g.fillRect(3, 2, 2, 1); g.fillRect(4, 2, 1, 5); } if (st === 'kente') kente(g, 8, 12, c); if (st !== 'dress' && st !== 'suit' && st !== 'hoodie') belt(g, 8, S, false); });
  const side = cv(4, 12, (g) => { cloth(g, 0, 0, 4, 12, c, 13); g.fillStyle = shade(c, 0.85); g.fillRect(1.875, 0, 0.25, 11); if (st === 'kente') kente(g, 4, 12, c); if (st !== 'dress' && st !== 'suit' && st !== 'hoodie') belt(g, 4, S, false); });
  const top = cv(8, 4, (g) => { cloth(g, 0, 0, 8, 4, c, 14); if (st === 'tank' || st === 'tee' || st === 'dress') { g.fillStyle = S.skin; g.fillRect(2, 1, 4, 2); } });
  const bottom = cv(8, 4, (g) => noise(g, 8, 4, st === 'dress' ? c : S.pants, 0.06, 15));
  return [mat(side), mat(side), mat(top), mat(bottom), mat(back), mat(front)];
}
function kente(g, w, h, c) { const cols = [c, '#f0c419', '#3c9a46', '#d23c3c', '#111']; for (let y = 0; y < h; y += H) for (let x = 0; x < w; x += H) { const X = Math.floor(x), Y = Math.floor(y), band = Math.floor(Y / 3) % 2, k = band ? (Math.floor(X / 2) + Y) % 5 : (X + Math.floor(Y / 2)) % 5; g.fillStyle = shade(cols[k], ((x * 2 + y * 2) & 1) ? 1.06 : 0.94); g.fillRect(x, y, H, H); } g.fillStyle = 'rgba(240,196,25,0.55)'; for (let y = 3; y < h; y += 6) g.fillRect(0, y, w, 0.25); }

function armTextures(S, slim) {
  const c = S.shirtColor, st = S.shirt, w = slim ? 3 : 4;
  const sleeve = st === 'tank' ? 0 : st === 'tee' || st === 'jersey' || st === 'dress' || st === 'kente' ? 4 : 11;
  const face = (seed) => cv(w, 12, (g) => {
    noise(g, w, 12, S.skin, 0.05, seed);
    g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(0, sleeve, w * 0.4, 12 - sleeve);
    if (sleeve) { cloth(g, 0, 0, w, sleeve, c, seed + 20); if (st === 'kente') { g.save(); kente(g, w, sleeve, c); g.restore(); } g.fillStyle = shade(c, 0.72); g.fillRect(0, sleeve - 0.5, w, 0.5); g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, sleeve, w, 0.25); if (sleeve > 6) { g.fillStyle = shade(c, 0.88); g.fillRect(0, 5, w, 0.25); } }
    // knuckles / fingers
    g.fillStyle = shade(S.skin, 0.84); g.fillRect(0, 11, w, 1); g.fillStyle = shade(S.skin, 0.74); for (let x = 1; x < w; x += 1) g.fillRect(x - 0.125, 11.25, 0.25, 0.75);
    if (st === 'jersey') { g.fillStyle = '#fff'; g.fillRect(0, sleeve - 1, w, 1); }
    if (st === 'suit') { g.fillStyle = '#f4f4f4'; g.fillRect(0, 10, w, 1); }
  });
  const top = cv(w, 4, (g) => { if (sleeve) cloth(g, 0, 0, w, 4, c, 31); else noise(g, w, 4, S.skin, 0.06, 31); });
  const bot = cv(w, 4, (g) => noise(g, w, 4, shade(S.skin, 0.9), 0.04, 32));
  const f = face(41), b = face(42), s = face(43);
  return [mat(s), mat(s), mat(top), mat(bot), mat(b), mat(f)];
}
// first-person arm: same skin/sleeve textures as the third-person model
export function armMaterials(S) {
  S = { ...DEFAULT_SKIN, ...(S || {}) }; const ms = armTextures(S, S.body === 'slim'); const k = [0.72, 0.72, 0.9, 0.55, 0.8, 1];
  // unlit + baked per-face shading so the hand stays readable; main.js scales .color by scene light
  return ms.map((m, i) => { const b = new THREE.MeshBasicMaterial({ map: m.map }); b.userData.k = k[i]; b.color.setScalar(k[i]); m.dispose(); return b; });
}
function legTextures(S) {
  const dress = S.shirt === 'dress';
  const face = (seed) => cv(4, 12, (g) => {
    cloth(g, 0, 0, 4, 12, S.pants, seed);
    g.fillStyle = shade(S.pants, 0.8); g.fillRect(seed === 63 ? 1.875 : 0, 0, 0.25, 9); g.fillRect(0.5, 4.75, 3, 0.25); g.fillStyle = shade(S.pants, 1.12); g.fillRect(0.5, 5, 3, 0.25);
    if (seed === 61) { g.fillStyle = shade(S.pants, 0.82); g.fillRect(2.5, 0, 0.25, 2.5); g.fillRect(2.5, 2.5, 1.5, 0.25); }
    g.fillStyle = shade(S.pants, 0.7); g.fillRect(0, 8.5, 4, 0.5);
    if (dress) { noise(g, 4, 5, S.shirtColor, 0.08, seed + 9); noise(g, 4, 6, S.skin, 0.05, seed + 3); g.fillRect(0, 5, 0, 0); for (let y = 5; y < 9; y++) { g.fillStyle = shade(S.skin, 1); g.fillRect(0, y, 4, 1); } }
    cloth(g, 0, 9, 4, 2.25, S.shoes, seed + 5); g.fillStyle = shade(S.shoes, 1.18); g.fillRect(0, 9, 4, 0.25);
    const sole = S.shoes === '#ffffff' ? '#d9d9d9' : '#f1ece2'; g.fillStyle = sole; g.fillRect(0, 11.25, 4, 0.5); g.fillStyle = shade(sole, 0.6); g.fillRect(0, 11.75, 4, 0.25);
    if (seed === 61) { g.fillStyle = S.shoes === '#ffffff' ? '#9a9a9a' : '#f4f4f4'; g.fillRect(1, 9.5, 2, 0.25); g.fillRect(1, 10.25, 2, 0.25); g.fillStyle = shade(S.shoes, 0.6); g.fillRect(1.5, 9.75, 1, 0.25); }
    if (S.shoes === '#ffffff') { g.fillStyle = '#d23c3c'; g.fillRect(0.5, 10.5, 3, 0.5); g.fillRect(2.5, 10, 1, 0.5); }
  });
  const top = cv(4, 4, (g) => cloth(g, 0, 0, 4, 4, S.pants, 51));
  const bot = cv(4, 4, (g) => noise(g, 4, 4, shade(S.shoes, 0.7), 0.06, 52));
  const f = face(61), b = face(62), s = face(63);
  return [mat(s), mat(s), mat(top), mat(bot), mat(b), mat(f)];
}

// ---------- sprites ----------
function textSprite(lines, opts = {}) {
  const fs = opts.size || 28, pad = 10; const font = `${fs}px MCFont, monospace`;
  const c = document.createElement('canvas'); const g = c.getContext('2d'); g.font = font;
  const w = Math.max(...lines.map((l) => g.measureText(l).width)) + pad * 2; const h = lines.length * (fs + 4) + pad * 1.4;
  c.width = Math.ceil(w); c.height = Math.ceil(h); g.font = font;
  g.fillStyle = opts.bg || 'rgba(0,0,0,0.45)'; if (opts.round) { roundRect(g, 0, 0, c.width, c.height, 12); g.fill(); } else g.fillRect(0, 0, c.width, c.height);
  g.textBaseline = 'top'; g.textAlign = 'center';
  lines.forEach((l, i) => { g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillText(l, c.width / 2 + 2, pad * 0.7 + i * (fs + 4) + 2); g.fillStyle = opts.color || '#fff'; g.fillText(l, c.width / 2, pad * 0.7 + i * (fs + 4)); });
  if (opts.tail) { g.fillStyle = opts.bg; }
  const t = new THREE.CanvasTexture(c); t.minFilter = THREE.LinearFilter; t.colorSpace = THREE.NoColorSpace;
  const m = new THREE.SpriteMaterial({ map: t, depthTest: opts.depthTest ?? false, transparent: true });
  const s = new THREE.Sprite(m); const k = (opts.scale || 0.0105); s.scale.set(c.width * k, c.height * k, 1); s.renderOrder = 999;
  return s;
}
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function wrap(text, n = 26) { const words = String(text).split(/\s+/); const out = []; let cur = ''; for (const w of words) { if ((cur + ' ' + w).trim().length > n) { if (cur) out.push(cur); cur = w.slice(0, n); } else cur = (cur + ' ' + w).trim(); } if (cur) out.push(cur); return out.slice(0, 4); }
const ICON_TEXT = { hand: '\u270B', clap: '\u2726', note: '\u266A \u266B', arrow: '\u2192', bow: '\u2193', ha: 'HA HA', star: '\u2605', heart: '\u2665', sit: '\u25BC', q: '?', ok: '\u2714', tear: '...' };

// ---------- avatar ----------
export class Avatar {
  constructor(skin, name, opts = {}) {
    this.group = new THREE.Group(); this.name = name || ''; this.friend = !!opts.friend; this.t = 0; this.walk = 0; this.emote = null; this.emoteT = 0; this.swingT = 0;
    this.pos = new THREE.Vector3(); this.yaw = 0; this.pitch = 0; this.flags = 0; this.speed = 0;
    this.noTag = !!opts.noTag; this.build(skin || DEFAULT_SKIN);
  }
  dispose() {
    this.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; for (const m of ms) { if (m.map) m.map.dispose(); m.dispose(); } });
  }
  build(S) {
    S = { ...DEFAULT_SKIN, ...(S || {}) }; this.skin = S;
    for (const c of [...this.group.children]) { this.group.remove(c); }
    const slim = S.body === 'slim'; const aw = slim ? 3 : 4;
    const root = this.root = new THREE.Group(); this.group.add(root);
    const box = (w, h, d, mats) => new THREE.Mesh(new THREE.BoxGeometry(w * PX, h * PX, d * PX), mats);
    // legs (pivot at hip, y = 12px)
    const legM = legTextures(S);
    this.legL = new THREE.Group(); this.legL.position.set(-2 * PX, 12 * PX, 0); const ll = box(4, 12, 4, legM); ll.position.y = -6 * PX; this.legL.add(ll);
    this.legR = new THREE.Group(); this.legR.position.set(2 * PX, 12 * PX, 0); const lr = box(4, 12, 4, legM); lr.position.y = -6 * PX; this.legR.add(lr);
    root.add(this.legL, this.legR);
    // upper body pivot at hip so bowing tilts torso, arms and head
    const upper = this.upper = new THREE.Group(); upper.position.y = 12 * PX; root.add(upper);
    const torso = box(8, 12, 4, torsoTextures(S)); torso.position.y = 6 * PX; upper.add(torso);
    if (S.shirt === 'dress') { const skirt = box(9, 4, 5, mat(patTex(clothPat(S.shirtColor, 33), 9, 4, { trim: (g, w, h) => { g.fillStyle = shade(S.shirtColor, 0.7); g.fillRect(0, h - 0.5, w, 0.5); g.fillStyle = 'rgba(0,0,0,0.12)'; for (let x = 1; x < w; x += 1.5) g.fillRect(x, 0, 0.25, h); } }))); skirt.position.y = -1 * PX; upper.add(skirt); }
    const armM = armTextures(S, slim);
    this.armL = new THREE.Group(); this.armL.position.set(-(4 + aw / 2) * PX, 10 * PX, 0); const al = box(aw, 12, 4, armM); al.position.y = -4 * PX; this.armL.add(al);
    this.armR = new THREE.Group(); this.armR.position.set((4 + aw / 2) * PX, 10 * PX, 0); const ar = box(aw, 12, 4, armM); ar.position.y = -4 * PX; this.armR.add(ar);
    upper.add(this.armL, this.armR);
    // head pivot at neck
    this.head = new THREE.Group(); this.head.position.y = 12 * PX; upper.add(this.head);
    const head = box(8, 8, 8, headTextures(S)); head.position.y = 4 * PX; this.head.add(head);
    this.addHair(S); this.addHat(S);
    // cape
    if (S.cape && S.cape !== 'none') {
      this.cape = new THREE.Group(); this.cape.position.set(0, 12 * PX, 2.2 * PX); upper.add(this.cape);
      const cc = S.cape; const cm = mat(cv(10, 16, (g, w, h) => { g.fillStyle = clothPat(cc, 41, 0.05); g.fillRect(0, 0, w, h); g.fillStyle = shade(cc, 0.82); for (const x of [2.5, 5, 7.5]) g.fillRect(x, 1, 0.25, h - 2); g.fillStyle = '#e8c45a'; g.fillRect(0, h - 1, w, 0.5); g.fillRect(0, 0, w, 0.5); g.fillStyle = shade(cc, 0.6); g.fillRect(0, h - 0.5, w, 0.5); g.fillStyle = '#e8c45a'; g.beginPath(); g.moveTo(5, 5); g.lineTo(6.5, 7); g.lineTo(5, 9); g.lineTo(3.5, 7); g.closePath(); g.fill(); g.fillStyle = shade(cc, 1.25); g.fillRect(4.75, 6.5, 0.5, 1); })); const cp = new THREE.Mesh(new THREE.BoxGeometry(10 * PX, 16 * PX, 0.8 * PX), cm); cp.position.y = -8 * PX; this.cape.add(cp);
    } else this.cape = null;
    // name tag
    if (!this.noTag) this.setName(this.name, this.friend);
    this.bubble = null; this.bubbleT = 0;
  }
  addHair(S) {
    const hm = mat(patTex(hairPat(S.hairColor, 11))); const h = this.head;
    const add = (w, ht, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w * PX, ht * PX, d * PX), hm); m.position.set(x * PX, y * PX, z * PX); h.add(m); return m; };
    if (S.hair === 'afro') { add(10, 6, 10, 0, 8, 0.5); add(10, 4, 3, 0, 5, 4); }
    if (S.hair === 'mohawk') add(2, 3, 9, 0, 9, 0.3);
    if (S.hair === 'ponytail') { add(2, 2, 2, 0, 6, 5); add(2, 6, 2, 0, 3, 5.6); }
    if (S.hair === 'bun') add(4, 3, 3, 0, 8.6, 3.2);
    if (S.hair === 'long') add(8.4, 7, 1, 0, 2.5, 4.4);
    if (S.hair === 'braids') { for (const x of [-3, -1, 1, 3]) add(1.4, 9, 1.4, x, 1, 4.4); }
  }
  addHat(S) {
    const c = S.hatColor || '#d23c3c'; const m = mat(patTex(clothPat(c, 21))), dark = mat(patTex(clothPat(shade(c, 0.7), 22)));
    const gold = new THREE.MeshPhongMaterial({ color: '#f0c419', specular: '#fff4c0', shininess: 60, emissive: '#3a2a00' }), black = mat(patTex(clothPat('#26262c', 23, 0.05)));
    const h = this.head; const add = (w, ht, d, x, y, z, mm) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w * PX, ht * PX, d * PX), mm); b.position.set(x * PX, y * PX, z * PX); h.add(b); return b; };
    if (S.hat === 'cap') { add(8.6, 2.4, 8.6, 0, 8.4, 0, m); add(8.6, 0.6, 4, 0, 7.6, -6, dark); }
    if (S.hat === 'beanie') { add(8.8, 3, 8.8, 0, 8.2, 0, m); add(8.9, 1, 8.9, 0, 6.8, 0, dark); add(2, 1.4, 2, 0, 10.2, 0, dark); }
    if (S.hat === 'crown') { add(8.6, 1.6, 8.6, 0, 8.4, 0, gold); for (const [x, z] of [[-3.5, -3.5], [0, -3.8], [3.5, -3.5], [-3.5, 3.5], [3.5, 3.5], [3.8, 0], [-3.8, 0], [0, 3.8]]) add(1.2, 1.6, 1.2, x, 10, z, gold); add(1, 1, 0.4, 0, 8.4, -4.4, new THREE.MeshPhongMaterial({ color: '#e0284a', specular: '#ffffff', shininess: 90, emissive: '#400010' })); add(0.8, 0.8, 0.4, -2.6, 8.4, -4.4, new THREE.MeshPhongMaterial({ color: '#2f8ce0', specular: '#ffffff', shininess: 90 })); add(0.8, 0.8, 0.4, 2.6, 8.4, -4.4, new THREE.MeshPhongMaterial({ color: '#3cc46a', specular: '#ffffff', shininess: 90 })); }
    if (S.hat === 'tophat') { add(11, 0.8, 11, 0, 8.2, 0, black); add(7, 6, 7, 0, 11.4, 0, black); add(7.2, 1, 7.2, 0, 9.2, 0, m); }
    if (S.hat === 'headphones') { add(9.4, 1, 2, 0, 8.6, 0, black); add(1.4, 3, 3, -4.6, 4, 0, black); add(1.4, 3, 3, 4.6, 4, 0, black); add(0.4, 2, 2, -5.4, 4, 0, m); add(0.4, 2, 2, 5.4, 4, 0, m); }
    if (S.hat === 'helmet') { add(9.2, 4, 9.2, 0, 7, 0, m); add(9.4, 0.8, 9.4, 0, 5, 0, dark); add(2, 5, 0.6, 0, 6, -4.8, new THREE.MeshLambertMaterial({ color: '#9fd8ff', transparent: true, opacity: 0.6 })); }
  }
  setName(name, friend) {
    this.name = name; this.friend = friend;
    if (this.tag) { this.group.remove(this.tag); this.tag.material.map.dispose(); this.tag.material.dispose(); }
    this.tag = textSprite([name], { color: friend ? '#7cff8a' : '#ffffff' }); this.tag.position.y = 2.25; this.group.add(this.tag);
  }
  say(text, color) {
    this.clearBubble();
    this.bubble = textSprite(wrap(text), { bg: 'rgba(255,255,255,0.92)', color: color || '#1a1a1a', round: true, size: 26, scale: 0.0095 });
    this.bubble.position.y = 2.6 + this.bubble.scale.y / 2; this.group.add(this.bubble); this.bubbleT = Math.min(9, 3 + text.length * 0.08);
  }
  clearBubble() { if (this.bubble) { this.group.remove(this.bubble); this.bubble.material.map.dispose(); this.bubble.material.dispose(); this.bubble = null; } }
  playEmote(id) {
    const e = EMOTES.find((x) => x.id === id); if (!e) return;
    this.emote = id; this.emoteT = 0; this.emoteLen = EMOTE_LEN[id] || 2.4;
    this.clearBubble(); this.bubble = textSprite([ICON_TEXT[e.icon] || '', e.label].filter(Boolean), { bg: 'rgba(20,20,40,0.72)', color: id === 'heart' ? '#ff6b9a' : '#ffe680', round: true, size: 26, scale: 0.009 });
    this.bubble.position.y = 2.6 + this.bubble.scale.y / 2; this.group.add(this.bubble); this.bubbleT = Math.min(this.emoteLen, 3);
  }
  stopEmote() { this.emote = null; }
  // pose: called every frame. speed = horizontal speed (blocks/s)
  update(dt, cameraPos) {
    this.t += dt;
    const sneak = this.flags & 1, flying = this.flags & 4, sitting = this.flags & 8, gliding = this.flags & 32;
    if (this.flags & 2) { this.swingT = 0.3; this.flags &= ~2; }
    if (this.speed > 0.4 && this.emote) this.stopEmote();
    const sp = Math.min(1, this.speed / 4.3);
    this.walk += dt * (4 + this.speed * 2.2) * (sp > 0.05 ? 1 : 0);
    const amp = flying || gliding ? 0.1 : sp * 0.9;
    const sw = Math.sin(this.walk) * amp;
    // reset
    this.root.position.set(0, 0, 0); this.root.rotation.set(0, 0, 0); this.upper.rotation.set(0, 0, 0); this.upper.position.y = 12 * PX;
    this.legL.rotation.set(sw, 0, 0); this.legR.rotation.set(-sw, 0, 0);
    this.armL.rotation.set(-sw * 0.85, 0, 0.06); this.armR.rotation.set(sw * 0.85, 0, -0.06);
    this.head.rotation.set(-this.pitch * 0.9, 0, 0);
    if (sneak) { this.upper.rotation.x = 0.45; this.root.position.y = -0.12; this.head.rotation.x -= 0.4; this.legL.rotation.x += 0.15; this.legR.rotation.x += 0.15; }
    if (gliding) { this.root.rotation.x = 1.25; this.armL.rotation.z = 0.5; this.armR.rotation.z = -0.5; }
    if (sitting) { this.legL.rotation.x = this.legR.rotation.x = -1.45; this.root.position.y = -0.62; this.armL.rotation.x = this.armR.rotation.x = -0.6; }
    // swing (attack/use)
    if (this.swingT > 0) { this.swingT -= dt; const k = Math.sin((1 - this.swingT / 0.3) * Math.PI); this.armR.rotation.x = -1.6 * k - 0.3; this.armR.rotation.z = -0.1; }
    // emotes
    if (this.emote) {
      this.emoteT += dt; const t = this.emoteT; const e = this.emote;
      if (t > this.emoteLen) this.emote = null;
      else if (e === 'wave') { this.armR.rotation.set(0, 0, -2.6 + Math.sin(t * 10) * 0.35); }
      else if (e === 'clap') { const c = Math.abs(Math.sin(t * 9)); this.armL.rotation.set(-1.3, -0.25 - c * 0.4, 0); this.armR.rotation.set(-1.3, 0.25 + c * 0.4, 0); }
      else if (e === 'dance') { const b = Math.sin(t * 7); this.root.position.y = Math.abs(b) * 0.08; this.root.rotation.y = Math.sin(t * 3.5) * 0.4; this.armL.rotation.set(0, 0, 1.2 + b * 0.9); this.armR.rotation.set(0, 0, -1.2 + b * 0.9); this.legL.rotation.x = b * 0.35; this.legR.rotation.x = -b * 0.35; this.head.rotation.z = b * 0.2; }
      else if (e === 'point') { this.armR.rotation.set(-1.75, 0, -0.1); this.head.rotation.x = -0.1; }
      else if (e === 'bow') { const k = Math.min(1, t * 2.5) * (t > this.emoteLen - 0.5 ? (this.emoteLen - t) * 2 : 1); this.upper.rotation.x = 1.0 * k; this.armL.rotation.x = 0.2; this.armR.rotation.set(-0.7 * k, 0, 0.4); }
      else if (e === 'laugh') { const b = Math.sin(t * 16) * 0.12; this.head.rotation.x = -0.45 + b; this.upper.rotation.x = -0.12 + b * 0.5; this.armL.rotation.set(-0.6, 0, 0.5); this.armR.rotation.set(-0.6, 0, -0.5); }
      else if (e === 'cheer') { const b = Math.sin(t * 12) * 0.25; this.armL.rotation.set(0, 0, 2.7 + b); this.armR.rotation.set(0, 0, -2.7 - b); this.root.position.y = Math.max(0, Math.sin(t * 6)) * 0.15; }
      else if (e === 'heart') { this.armL.rotation.set(-1.4, 0.6, 0); this.armR.rotation.set(-1.4, -0.6, 0); this.head.rotation.z = Math.sin(t * 3) * 0.15; }
      else if (e === 'sit') { this.legL.rotation.x = this.legR.rotation.x = -1.45; this.root.position.y = -0.62; this.armL.rotation.x = this.armR.rotation.x = -0.4; }
      else if (e === 'shrug') { const k = Math.sin(Math.min(1, t / this.emoteLen) * Math.PI); this.armL.rotation.set(-0.5 * k, 0, 0.6 * k); this.armR.rotation.set(-0.5 * k, 0, -0.6 * k); this.head.rotation.z = 0.25 * k; this.upper.position.y = 12 * PX + 0.03 * k; }
      else if (e === 'thumbs') { this.armR.rotation.set(-1.3, 0, -0.3); }
      else if (e === 'cry') { this.head.rotation.x = 0.5; this.armL.rotation.set(-2.2, 0.4, 0); this.armR.rotation.set(-2.2, -0.4, 0); this.upper.rotation.x = 0.15 + Math.sin(t * 14) * 0.03; }
    }
    if (this.cape) { const flap = flying || gliding ? 1.2 : Math.min(1.1, 0.12 + this.speed * 0.16); this.cape.rotation.x = -(flap + Math.sin(this.t * 6) * 0.05 * (0.5 + sp)); }
    if (this.bubble) { this.bubbleT -= dt; if (this.bubbleT <= 0) this.clearBubble(); }
    this.group.position.copy(this.pos); this.group.rotation.y = this.yaw;
    if (this.tag) { this.tag.visible = !sneak; if (cameraPos) { const d = cameraPos.distanceTo(this.pos); const k = Math.max(1, d / 14); this.tag.scale.set(this.tag.material.map.image.width * 0.0105 * k, this.tag.material.map.image.height * 0.0105 * k, 1); this.tag.material.depthTest = d > 48; } }
  }
}
export { textSprite };
