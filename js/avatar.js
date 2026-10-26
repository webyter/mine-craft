// Mine Craft — customizable player avatars (blocky humanoid), nametags, chat bubbles, emotes
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
function cv(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; draw(g, w, h); const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.NoColorSpace; return t; }
function mat(tex) { return new THREE.MeshLambertMaterial({ map: tex, transparent: false }); }
function noise(g, w, h, col, amt = 0.08, seed = 1) { let s = seed; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { s = (s * 16807) % 2147483647; const k = 1 + ((s / 2147483647) - 0.5) * amt; g.fillStyle = shade(col, k); g.fillRect(x, y, 1, 1); } }

// ---------- head faces ----------
function headTextures(S) {
  const skin = S.skin, hc = S.hairColor, hair = S.hair;
  const hairTop = hair !== 'none' && hair !== 'buzz' ? 1 : 0;
  const face = cv(8, 8, (g) => {
    noise(g, 8, 8, skin, 0.05, 3);
    // hair fringe
    if (hair === 'buzz') { g.fillStyle = shade(hc, 0.9); g.fillRect(0, 0, 8, 1); }
    else if (hair === 'mohawk') { g.fillStyle = hc; g.fillRect(3, 0, 2, 1); }
    else if (hair !== 'none') { g.fillStyle = hc; g.fillRect(0, 0, 8, hair === 'afro' ? 2 : 1); g.fillRect(0, 1, 1, hair === 'long' || hair === 'braids' ? 4 : 2); g.fillRect(7, 1, 1, hair === 'long' || hair === 'braids' ? 4 : 2); if (hair === 'short' || hair === 'long') g.fillRect(1, 1, 2, 1); }
    // eyes
    g.fillStyle = '#ffffff'; g.fillRect(1, 4, 2, 1); g.fillRect(5, 4, 2, 1);
    g.fillStyle = S.eyes; g.fillRect(2, 4, 1, 1); g.fillRect(5, 4, 1, 1);
    // brows
    g.fillStyle = shade(hair === 'none' ? skin : hc, hair === 'none' ? 0.7 : 0.9); g.fillRect(1, 3, 2, 1); g.fillRect(5, 3, 2, 1);
    // nose + mouth
    g.fillStyle = shade(skin, 0.85); g.fillRect(3, 5, 2, 1);
    g.fillStyle = shade(skin, 0.55); g.fillRect(3, 6, 2, 1);
    if (S.extra === 'beard') { g.fillStyle = hair === 'none' ? '#3b2416' : hc; g.fillRect(1, 6, 2, 2); g.fillRect(5, 6, 2, 2); g.fillRect(1, 7, 6, 1); g.fillRect(3, 6, 2, 1); g.fillStyle = shade(skin, 0.45); g.fillRect(3, 6, 2, 1); }
    if (S.extra === 'freckles') { g.fillStyle = shade(skin, 0.75); g.fillRect(1, 5, 1, 1); g.fillRect(6, 5, 1, 1); g.fillRect(2, 5, 1, 1); }
    if (S.extra === 'glasses') { g.fillStyle = '#222'; g.fillRect(0, 4, 1, 1); g.fillRect(7, 4, 1, 1); g.fillRect(3, 4, 2, 1); g.strokeStyle = '#222'; g.lineWidth = 1; g.fillRect(1, 3, 2, 1); g.fillRect(5, 3, 2, 1); g.fillRect(1, 5, 2, 0.01); }
    if (S.extra === 'shades') { g.fillStyle = '#111'; g.fillRect(0, 4, 8, 1); g.fillRect(1, 4, 2, 2); g.fillRect(5, 4, 2, 2); g.fillStyle = '#5a6a8a'; g.fillRect(1, 4, 1, 1); g.fillRect(5, 4, 1, 1); }
    if (S.extra === 'mask') { g.fillStyle = '#e8f0f4'; g.fillRect(1, 5, 6, 3); g.fillStyle = '#b8c8d0'; g.fillRect(1, 6, 6, 1); g.fillRect(0, 5, 1, 1); g.fillRect(7, 5, 1, 1); }
    if (S.hat === 'bandana') { g.fillStyle = S.hatColor; g.fillRect(0, 1, 8, 2); g.fillStyle = '#fff'; g.fillRect(2, 2, 1, 1); g.fillRect(5, 1, 1, 1); }
  });
  const side = (flip) => cv(8, 8, (g) => {
    noise(g, 8, 8, skin, 0.05, flip ? 7 : 9);
    if (hair !== 'none') {
      g.fillStyle = hc;
      const h = hair === 'buzz' ? 1 : hair === 'mohawk' ? 0 : hair === 'long' || hair === 'braids' ? 7 : hair === 'afro' ? 5 : 3;
      if (hair === 'buzz') { g.fillStyle = shade(hc, 0.9); g.fillRect(0, 0, 8, 2); }
      else if (h) { g.fillRect(0, 0, 8, Math.min(h, 3)); for (let x = 4; x < 8; x++) g.fillRect(x, 0, 1, h); g.fillRect(0, 0, 2, h > 3 ? 3 : h); }
      if (hair === 'braids') { g.fillStyle = shade(hc, 0.75); for (let y = 1; y < 8; y += 2) g.fillRect(5, y, 1, 1); }
    }
    g.fillStyle = shade(skin, 0.8); g.fillRect(flip ? 3 : 4, 4, 1, 2); // ear
    if (S.extra === 'glasses' || S.extra === 'shades') { g.fillStyle = '#222'; g.fillRect(0, 4, 4, 1); }
    if (S.extra === 'beard') { g.fillStyle = hair === 'none' ? '#3b2416' : hc; g.fillRect(0, 5, 3, 3); }
    if (S.extra === 'mask') { g.fillStyle = '#e8f0f4'; g.fillRect(0, 5, 3, 1); }
    if (S.hat === 'bandana') { g.fillStyle = S.hatColor; g.fillRect(0, 1, 8, 2); }
    if (S.hat === 'headphones') { g.fillStyle = '#222'; g.fillRect(2, 3, 4, 4); g.fillStyle = S.hatColor; g.fillRect(3, 4, 2, 2); }
  });
  const top = cv(8, 8, (g) => { if (hair === 'none' || hair === 'mohawk') noise(g, 8, 8, skin, 0.05, 4); else noise(g, 8, 8, hair === 'buzz' ? shade(hc, 0.9) : hc, 0.18, 5); if (hair === 'mohawk') { g.fillStyle = hc; g.fillRect(3, 0, 2, 8); } if (S.hat === 'bandana') { g.fillStyle = S.hatColor; g.fillRect(0, 0, 8, 8); g.fillStyle = '#fff'; g.fillRect(3, 3, 1, 1); g.fillRect(5, 5, 1, 1); } });
  const back = cv(8, 8, (g) => {
    noise(g, 8, 8, skin, 0.05, 6);
    if (hair !== 'none' && hair !== 'mohawk') { g.fillStyle = hair === 'buzz' ? shade(hc, 0.9) : hc; const h = hair === 'buzz' ? 3 : hair === 'long' || hair === 'braids' ? 8 : hair === 'short' || hair === 'bun' || hair === 'ponytail' ? 6 : 7; g.fillRect(0, 0, 8, h); if (hair === 'braids') { g.fillStyle = shade(hc, 0.72); for (let x = 1; x < 8; x += 2) for (let y = 1; y < 8; y += 2) g.fillRect(x, y, 1, 1); } }
    if (hair === 'mohawk') { g.fillStyle = hc; g.fillRect(3, 0, 2, 6); }
    if (S.hat === 'bandana') { g.fillStyle = S.hatColor; g.fillRect(0, 1, 8, 2); g.fillRect(3, 3, 2, 2); }
  });
  const bottom = cv(8, 8, (g) => noise(g, 8, 8, shade(skin, 0.9), 0.04, 8));
  void hairTop;
  // box face order: +x, -x, +y, -y, +z, -z ; model faces -z
  return [mat(side(true)), mat(side(false)), mat(top), mat(bottom), mat(back), mat(face)];
}

// ---------- torso ----------
function torsoTextures(S) {
  const c = S.shirtColor, st = S.shirt;
  const front = cv(8, 12, (g) => {
    noise(g, 8, 12, c, 0.08, 11);
    if (st === 'tank') { g.fillStyle = S.skin; g.fillRect(0, 0, 2, 2); g.fillRect(6, 0, 2, 2); g.fillRect(3, 0, 2, 1); }
    if (st === 'tee') { g.fillStyle = S.skin; g.fillRect(3, 0, 2, 1); g.fillStyle = shade(c, 0.8); g.fillRect(2, 0, 1, 1); g.fillRect(5, 0, 1, 1); }
    if (st === 'hoodie') { g.fillStyle = shade(c, 0.78); g.fillRect(2, 0, 4, 1); g.fillRect(2, 7, 4, 3); g.fillStyle = '#eee'; g.fillRect(3, 1, 1, 3); g.fillRect(4, 1, 1, 2); }
    if (st === 'jacket') { g.fillStyle = '#eee'; g.fillRect(3, 0, 2, 12); g.fillStyle = shade(c, 0.7); g.fillRect(3, 0, 1, 12); g.fillRect(1, 7, 1, 1); g.fillRect(6, 7, 1, 1); }
    if (st === 'suit') { g.fillStyle = '#f4f4f4'; g.fillRect(2, 0, 4, 6); g.fillStyle = S.hatColor || '#d23c3c'; g.fillRect(3, 1, 2, 1); g.fillRect(3, 2, 2, 5); g.fillStyle = shade(c, 0.7); g.fillRect(2, 0, 1, 5); g.fillRect(5, 0, 1, 5); g.fillStyle = '#ddd'; g.fillRect(3, 8, 1, 1); g.fillRect(3, 10, 1, 1); }
    if (st === 'jersey') { g.fillStyle = '#fff'; g.fillRect(0, 0, 8, 1); g.fillRect(2, 3, 1, 4); g.fillRect(2, 3, 2, 1); g.fillRect(3, 3, 1, 2); g.fillRect(2, 5, 2, 1); g.fillRect(5, 3, 1, 4); g.fillRect(4, 3, 2, 1); g.fillRect(0, 10, 8, 1); }
    if (st === 'dress') { g.fillStyle = shade(c, 0.85); g.fillRect(0, 6, 8, 1); g.fillStyle = '#fff'; g.fillRect(2, 8, 1, 1); g.fillRect(5, 9, 1, 1); g.fillRect(3, 10, 1, 1); g.fillStyle = S.skin; g.fillRect(3, 0, 2, 1); }
    if (st === 'kente') kente(g, 8, 12, c);
    if (st !== 'dress' && st !== 'suit') { g.fillStyle = shade(S.pants, 0.7); g.fillRect(0, 11, 8, 1); }
  });
  const back = cv(8, 12, (g) => { noise(g, 8, 12, c, 0.08, 12); if (st === 'hoodie') { g.fillStyle = shade(c, 0.8); g.fillRect(1, 0, 6, 3); } if (st === 'jersey') { g.fillStyle = '#fff'; g.fillRect(3, 2, 2, 1); g.fillRect(4, 2, 1, 5); } if (st === 'kente') kente(g, 8, 12, c); if (st !== 'dress' && st !== 'suit') { g.fillStyle = shade(S.pants, 0.7); g.fillRect(0, 11, 8, 1); } });
  const side = cv(4, 12, (g) => { noise(g, 4, 12, c, 0.08, 13); if (st === 'kente') kente(g, 4, 12, c); });
  const top = cv(8, 4, (g) => { noise(g, 8, 4, c, 0.06, 14); if (st === 'tank' || st === 'tee' || st === 'dress') { g.fillStyle = S.skin; g.fillRect(2, 1, 4, 2); } });
  const bottom = cv(8, 4, (g) => noise(g, 8, 4, st === 'dress' ? c : S.pants, 0.06, 15));
  return [mat(side), mat(side), mat(top), mat(bottom), mat(back), mat(front)];
}
function kente(g, w, h, c) { const cols = [c, '#f0c419', '#3c9a46', '#d23c3c', '#111']; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const band = Math.floor(y / 3) % 2, k = band ? (Math.floor(x / 2) + y) % 5 : (x + Math.floor(y / 2)) % 5; g.fillStyle = cols[k]; g.fillRect(x, y, 1, 1); } }

function armTextures(S, slim) {
  const c = S.shirtColor, st = S.shirt, w = slim ? 3 : 4;
  const sleeve = st === 'tank' ? 0 : st === 'tee' || st === 'jersey' || st === 'dress' || st === 'kente' ? 4 : 11;
  const face = (seed) => cv(w, 12, (g) => {
    noise(g, w, 12, S.skin, 0.05, seed);
    if (sleeve) { noise(g, w, sleeve, c, 0.08, seed + 20); if (st === 'kente') { g.save(); kente(g, w, sleeve, c); g.restore(); } }
    if (st === 'jersey') { g.fillStyle = '#fff'; g.fillRect(0, sleeve - 1, w, 1); }
    if (st === 'suit') { g.fillStyle = '#f4f4f4'; g.fillRect(0, 10, w, 1); }
    g.fillStyle = shade(S.skin, 0.9); g.fillRect(0, 11, w, 1);
  });
  const top = cv(w, 4, (g) => noise(g, w, 4, sleeve ? c : S.skin, 0.06, 31));
  const bot = cv(w, 4, (g) => noise(g, w, 4, shade(S.skin, 0.9), 0.04, 32));
  const f = face(41), b = face(42), s = face(43);
  return [mat(s), mat(s), mat(top), mat(bot), mat(b), mat(f)];
}
function legTextures(S) {
  const dress = S.shirt === 'dress';
  const face = (seed) => cv(4, 12, (g) => {
    noise(g, 4, 12, S.pants, 0.08, seed);
    if (dress) { noise(g, 4, 5, S.shirtColor, 0.08, seed + 9); noise(g, 4, 6, S.skin, 0.05, seed + 3); g.fillRect(0, 5, 0, 0); for (let y = 5; y < 9; y++) { g.fillStyle = shade(S.skin, 1); g.fillRect(0, y, 4, 1); } }
    g.fillStyle = S.shoes; g.fillRect(0, 9, 4, 3); g.fillStyle = shade(S.shoes, 0.75); g.fillRect(0, 11, 4, 1);
    if (S.shoes === '#ffffff') { g.fillStyle = '#d23c3c'; g.fillRect(1, 10, 2, 1); }
  });
  const top = cv(4, 4, (g) => noise(g, 4, 4, S.pants, 0.06, 51));
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
    if (S.shirt === 'dress') { const skirt = box(9, 4, 5, new THREE.MeshLambertMaterial({ color: S.shirtColor })); skirt.position.y = -1 * PX; upper.add(skirt); }
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
      const cm = new THREE.MeshLambertMaterial({ color: S.cape }); const cp = new THREE.Mesh(new THREE.BoxGeometry(10 * PX, 16 * PX, 0.8 * PX), cm); cp.position.y = -8 * PX; this.cape.add(cp);
    } else this.cape = null;
    // name tag
    if (!this.noTag) this.setName(this.name, this.friend);
    this.bubble = null; this.bubbleT = 0;
  }
  addHair(S) {
    const hm = new THREE.MeshLambertMaterial({ color: S.hairColor }); const h = this.head;
    const add = (w, ht, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w * PX, ht * PX, d * PX), hm); m.position.set(x * PX, y * PX, z * PX); h.add(m); return m; };
    if (S.hair === 'afro') { add(10, 6, 10, 0, 8, 0.5); add(10, 4, 3, 0, 5, 4); }
    if (S.hair === 'mohawk') add(2, 3, 9, 0, 9, 0.3);
    if (S.hair === 'ponytail') { add(2, 2, 2, 0, 6, 5); add(2, 6, 2, 0, 3, 5.6); }
    if (S.hair === 'bun') add(4, 3, 3, 0, 8.6, 3.2);
    if (S.hair === 'long') add(8.4, 7, 1, 0, 2.5, 4.4);
    if (S.hair === 'braids') { for (const x of [-3, -1, 1, 3]) add(1.4, 9, 1.4, x, 1, 4.4); }
  }
  addHat(S) {
    const c = S.hatColor || '#d23c3c'; const m = new THREE.MeshLambertMaterial({ color: c }), dark = new THREE.MeshLambertMaterial({ color: shade(c, 0.7) });
    const gold = new THREE.MeshLambertMaterial({ color: '#f0c419' }), black = new THREE.MeshLambertMaterial({ color: '#222' });
    const h = this.head; const add = (w, ht, d, x, y, z, mm) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w * PX, ht * PX, d * PX), mm); b.position.set(x * PX, y * PX, z * PX); h.add(b); return b; };
    if (S.hat === 'cap') { add(8.6, 2.4, 8.6, 0, 8.4, 0, m); add(8.6, 0.6, 4, 0, 7.6, -6, dark); }
    if (S.hat === 'beanie') { add(8.8, 3, 8.8, 0, 8.2, 0, m); add(8.9, 1, 8.9, 0, 6.8, 0, dark); add(2, 1.4, 2, 0, 10.2, 0, dark); }
    if (S.hat === 'crown') { add(8.6, 1.6, 8.6, 0, 8.4, 0, gold); for (const [x, z] of [[-3.5, -3.5], [0, -3.8], [3.5, -3.5], [-3.5, 3.5], [3.5, 3.5], [3.8, 0], [-3.8, 0], [0, 3.8]]) add(1.2, 1.6, 1.2, x, 10, z, gold); add(1, 1, 0.4, 0, 8.4, -4.4, new THREE.MeshLambertMaterial({ color: '#d23c3c' })); }
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
    this.root.position.set(0, 0, 0); this.root.rotation.set(0, 0, 0); this.upper.rotation.set(0, 0, 0);
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
      else if (e === 'shrug') { const k = Math.sin(Math.min(1, t / this.emoteLen) * Math.PI); this.armL.rotation.set(-0.5 * k, 0, 0.6 * k); this.armR.rotation.set(-0.5 * k, 0, -0.6 * k); this.head.rotation.z = 0.25 * k; this.upper.position && (this.upper.position.y = 12 * PX + 0.03 * k); }
      else if (e === 'thumbs') { this.armR.rotation.set(-1.3, 0, -0.3); }
      else if (e === 'cry') { this.head.rotation.x = 0.5; this.armL.rotation.set(-2.2, 0.4, 0); this.armR.rotation.set(-2.2, -0.4, 0); this.upper.rotation.x = 0.15 + Math.sin(t * 14) * 0.03; }
    }
    if (this.cape) { const flap = flying || gliding ? 1.2 : Math.min(1.1, 0.12 + this.speed * 0.16); this.cape.rotation.x = flap + Math.sin(this.t * 6) * 0.05 * (0.5 + sp); }
    if (this.bubble) { this.bubbleT -= dt; if (this.bubbleT <= 0) this.clearBubble(); }
    this.group.position.copy(this.pos); this.group.rotation.y = this.yaw;
    if (this.tag) { this.tag.visible = !sneak; if (cameraPos) { const d = cameraPos.distanceTo(this.pos); const k = Math.max(1, d / 14); this.tag.scale.set(this.tag.material.map.image.width * 0.0105 * k, this.tag.material.map.image.height * 0.0105 * k, 1); this.tag.material.depthTest = d > 48; } }
  }
}
export { textSprite };
