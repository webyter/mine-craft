// VoxCraft — high-detail item art (32×32).
// Items are drawn as shapes on a pixel grid, then every shape is shaded automatically:
// a bevel from its distance to the edge, light from the top-left, hue-shifted colour ramps
// (cool shadows, warm highlights), coloured outlines, contact shadows and gem sparkles.
import { I, isTool, toolInfo, isArmor, armorInfo } from './blocks.js';

const N = 32;

// ---------- colour helpers ----------
function hexToRgb(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2;
  if (mx !== mn) {
    const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60;
  }
  return [h, s, l];
}
function hslToRgb([h, s, l]) {
  h = ((h % 360) + 360) % 360 / 360;
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)].map((v) => Math.round(v * 255));
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function towards(h, target, amt) { let d = ((target - h + 540) % 360) - 180; return h + clamp(d, -amt, amt); }
// five-step ramp: outline, shadow, base, light, highlight
function ramp(hex) {
  const [h, s, l] = rgbToHsl(hexToRgb(hex)); const grey = s < 0.08;
  const sh = (dl, ds, hue, amt) => {
    const nh = grey ? hue : towards(h, hue, amt);
    const ns = grey ? (dl < 0 ? 0.1 : 0.06) : clamp(s * ds, 0, 1);
    return hslToRgb([nh, ns, clamp(l + dl, 0.04, 0.98)]);
  };
  return [sh(-Math.min(0.42, l * 0.72), 0.95, 255, 22), sh(-Math.min(0.2, l * 0.4), 1.08, 250, 12), hexToRgb(hex), sh(0.12, 0.95, 50, 6), sh(Math.min(0.3, (1 - l) * 0.75), 0.75, 55, 10)];
}

// deterministic noise
function hash(x, y, s = 0) { let n = (x * 374761393 + y * 668265263 + s * 982451653) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967295; }

// ---------- painter ----------
class Painter {
  constructor() {
    this.part = new Int16Array(N * N).fill(-1); this.parts = []; this.cur = null; this.sparkles = []; this.dots = [];
  }
  // start a new shaded part; opts: bevel (px), tone (ramp offset), shine, tex(x,y)->-1..1, flat, glow, noOutline
  use(color, opts = {}) {
    const p = { ramp: opts.ramp || ramp(color), bevel: 3, tone: 0, shine: 0, ...opts };
    this.parts.push(p); this.cur = this.parts.length - 1; return this;
  }
  fill(test, erase = false) {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (test(x + 0.5, y + 0.5)) this.part[y * N + x] = erase ? -1 : this.cur;
    }
    return this;
  }
  rect(x0, y0, x1, y1, erase) { return this.fill((x, y) => x >= x0 && x <= x1 + 1 && y >= y0 && y <= y1 + 1, erase); }
  ell(cx, cy, rx, ry, erase, rot = 0) {
    const c = Math.cos(rot), s = Math.sin(rot);
    return this.fill((x, y) => { const dx = x - cx, dy = y - cy; const u = dx * c + dy * s, v = -dx * s + dy * c; return (u * u) / (rx * rx) + (v * v) / (ry * ry) <= 1; }, erase);
  }
  circ(cx, cy, r, erase) { return this.ell(cx, cy, r, r, erase); }
  poly(pts, erase) {
    return this.fill((x, y) => {
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
      }
      return inside;
    }, erase);
  }
  // thick segment with round caps
  line(x0, y0, x1, y1, w, erase) {
    const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1, r = w / 2;
    return this.fill((x, y) => { const t = clamp(((x - x0) * dx + (y - y0) * dy) / L2, 0, 1); const px = x0 + dx * t - x, py = y0 + dy * t - y; return px * px + py * py <= r * r; }, erase);
  }
  // polyline through points
  path(pts, w, erase) { for (let i = 0; i < pts.length - 1; i++) this.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], w, erase); return this; }
  // arc band with tapering width (angles in radians)
  arc(cx, cy, r, a0, a1, w0, w1 = w0, wm = null) {
    const steps = 40;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, a = a0 + (a1 - a0) * t;
      const w = wm === null ? w0 + (w1 - w0) * t : (t < 0.5 ? w0 + (wm - w0) * t * 2 : wm + (w1 - wm) * (t - 0.5) * 2);
      this.circ(cx + Math.cos(a) * r, cy + Math.sin(a) * r, w / 2);
    }
    return this;
  }
  px(x, y) { if (x >= 0 && y >= 0 && x < N && y < N) this.part[y * N + x] = this.cur; return this; }
  sparkle(x, y, big = false) { this.sparkles.push([x, y, big]); return this; }
  // single exact colour pixels painted after shading (eyes, glints)
  dot(x, y, color, a = 1) { this.dots.push([x, y, hexToRgb(color), a]); return this; }

  render() {
    const P = this.part, out = new Uint8ClampedArray(N * N * 4);
    const at = (x, y) => (x < 0 || y < 0 || x >= N || y >= N ? -1 : P[y * N + x]);
    // distance to the edge of each part
    const dist = new Float32Array(N * N).fill(0); const q = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const p = at(x, y); if (p < 0) continue;
      if (at(x - 1, y) !== p || at(x + 1, y) !== p || at(x, y - 1) !== p || at(x, y + 1) !== p) { dist[y * N + x] = 1; q.push(y * N + x); }
    }
    for (let qi = 0; qi < q.length; qi++) {
      const i = q[qi], x = i % N, y = (i / N) | 0, p = P[i];
      for (const [dx, dy, c] of [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.41], [-1, 1, 1.41], [1, -1, 1.41], [-1, -1, 1.41]]) {
        const nx = x + dx, ny = y + dy; if (at(nx, ny) !== p) continue; const j = ny * N + nx;
        if (dist[j] === 0 || dist[j] > dist[i] + c) { dist[j] = dist[i] + c; q.push(j); }
      }
    }
    const height = (x, y, p) => { if (at(x, y) !== p) return 0; const part = this.parts[p]; const d = dist[y * N + x]; const k = clamp(d / part.bevel, 0, 1); return 1 - (1 - k) * (1 - k); };
    const set = (i, c, a = 255) => { out[i * 4] = c[0]; out[i * 4 + 1] = c[1]; out[i * 4 + 2] = c[2]; out[i * 4 + 3] = a; };
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const p = at(x, y); if (p < 0) continue; const part = this.parts[p];
      let idx;
      if (part.flat) idx = 2;
      else {
        const gx = height(x + 1, y, p) - height(x - 1, y, p), gy = height(x, y + 1, p) - height(x, y - 1, p);
        const nz = 0.9, len = Math.hypot(gx, gy, nz);
        let v = (0.62 * gx + 0.62 * gy + 0.5 * nz) / len; // light from the top-left
        if (part.tex) v += part.tex(x, y) * 0.14;
        v += (hash(x, y, p) - 0.5) * 0.05;
        idx = v < 0.36 ? 1 : v < 0.6 ? 2 : v < 0.8 ? 3 : 4;
        if (idx === 4 && !part.shine) idx = 3;
        if (part.shine && v > 0.66 && hash(x, y, 7) < part.shine * 0.35) idx = 4;
      }
      idx += part.tone;
      // ambient occlusion where a later (front) part overlaps this one
      if (!part.glow) for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) { const o = at(x + dx, y + dy); if (o > p && !this.parts[o].noOcclude) { idx -= 1; break; } }
      set(y * N + x, part.ramp[clamp(Math.round(idx), part.glow ? 1 : 0, 4)]);
    }
    // coloured outline
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (at(x, y) >= 0) continue;
      let best = -1;
      for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) { const o = at(x + dx, y + dy); if (o >= 0 && !this.parts[o].noOutline && o > best) best = o; }
      if (best >= 0) set(y * N + x, this.parts[best].ramp[0]);
    }
    // soft contact shadow down-right
    const a0 = out.slice();
    for (let y = 1; y < N; y++) for (let x = 1; x < N; x++) {
      const i = y * N + x; if (a0[i * 4 + 3]) continue;
      if (a0[((y - 1) * N + (x - 1)) * 4 + 3] === 255) set(i, [0, 0, 0], 60);
    }
    for (const [x, y, c, a] of this.dots) if (x >= 0 && y >= 0 && x < N && y < N) set(y * N + x, c, Math.round(a * 255));
    for (const [x, y, big] of this.sparkles) {
      set(y * N + x, [255, 255, 255]);
      const arm = big ? 2 : 1;
      for (let k = 1; k <= arm; k++) for (const [dx, dy] of [[k, 0], [-k, 0], [0, k], [0, -k]]) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue; const j = ny * N + nx;
        if (!out[j * 4 + 3]) continue; const f = k === 1 ? 0.75 : 0.4;
        for (let c = 0; c < 3; c++) out[j * 4 + c] = Math.round(out[j * 4 + c] + (255 - out[j * 4 + c]) * f);
      }
    }
    const cv = document.createElement('canvas'); cv.width = cv.height = N;
    cv.getContext('2d').putImageData(new ImageData(out, N, N), 0, 0);
    return cv;
  }
}

// ---------- textures ----------
const grain = (s = 1) => (x, y) => (Math.sin((x + y) * 1.9 + hash(x, y, 3) * 1.5) > 0.55 ? -0.9 : 0.15) * s;
const speckle = (s = 1, seed = 0) => (x, y) => (hash(x, y, seed) < 0.18 ? -1 : hash(x, y, seed + 1) < 0.12 ? 1 : 0) * s;
const brushed = (s = 0.5) => (x, y) => (hash(x - y, 0, 11) - 0.5) * 2 * s;
const fleck = (seed = 0) => (x, y) => (hash(x, y, seed) < 0.1 ? 1.6 : 0);

// ---------- palettes ----------
const WOOD = '#9a6434', WOOD_PALE = '#b98a52', LEATHER = '#8c5530', LEATHER_DARK = '#5e3820';
const HEAD = [
  { c: WOOD_PALE, tex: grain(1), shine: 0 },
  { c: '#8d8f97', tex: speckle(1, 4), shine: 0 },
  { c: '#d5dbe3', tex: brushed(0.4), shine: 0.6 },
  { c: '#f4c53e', tex: brushed(0.3), shine: 0.9 },
  { c: '#4fe0d8', tex: null, shine: 1, sparkle: true },
];
const ARMOR = [
  { c: '#9b5c32', tex: speckle(0.5, 9), shine: 0, trim: '#6b3a1c', stitch: '#d9b48a' },
  { c: '#d3d9e1', tex: brushed(0.35), shine: 0.6, trim: '#8e98a6', rivet: '#f4f7fb' },
  { c: '#f2c440', tex: brushed(0.25), shine: 0.9, trim: '#c48a1c', rivet: '#fff1b0' },
  { c: '#4fe0d8', tex: null, shine: 1, trim: '#1f9e98', sparkle: true },
  { c: '#4b4250', tex: speckle(0.6, 21), shine: 0.4, trim: '#2c2530', rivet: '#8a7a96' },
];

// local axis helper: origin (ox, oy), unit direction u; t is perpendicular (towards top-left for u = up-right)
function axis(ox, oy, ux, uy) { const L = Math.hypot(ux, uy); ux /= L; uy /= L; return (s, t) => [ox + s * ux + t * uy, oy + s * uy - t * ux]; }

// ---------- tools ----------
const HANDLE_A = [4.6, 27.4], HANDLE_B = [19.6, 12.4];
function handle(p, mat, len = 1) {
  const [ax, ay] = HANDLE_A, bx = ax + (HANDLE_B[0] - ax) * len, by = ay + (HANDLE_B[1] - ay) * len;
  p.use(WOOD, { tex: grain(0.8), bevel: 1.4 }).line(ax, ay, bx, by, 2.6);
  if (mat >= 2) { // leather grip wrap on metal tools
    p.use(LEATHER_DARK, { bevel: 1, tone: 0 });
    for (let k = 0; k < 3; k++) { const t = 0.12 + k * 0.1; const cx = ax + (bx - ax) * t, cy = ay + (by - ay) * t; p.line(cx - 1.4, cy - 1.4, cx + 1.4, cy + 1.4, 1.1); }
  }
  p.use(mat >= 2 ? HEAD[mat].c : '#6b4426', { bevel: 1.2, shine: HEAD[mat].shine }).circ(ax - 0.4, ay + 0.4, 1.7);
}
function headUse(p, m, extra = {}) { const h = HEAD[m]; return p.use(h.c, { tex: h.tex, shine: h.shine, bevel: 2.4, ...extra }); }
function tool(id) {
  const t = toolInfo(id), m = t.mat, p = new Painter();
  const L = axis(HANDLE_B[0], HANDLE_B[1], 1, -1);
  if (t.type === 'pickaxe') {
    handle(p, m);
    p.use(m >= 2 ? LEATHER_DARK : '#5b3a20', { bevel: 1 }).poly([L(-2.2, -2), L(-2.2, 2), L(0.6, 2), L(0.6, -2)]);
    headUse(p, m).arc(11, 22, 14.2, -1.83, 0.26, 1.8, 1.8, 4.4);
    if (HEAD[m].sparkle) p.sparkle(17, 6, true).sparkle(26, 14);
  } else if (t.type === 'axe') {
    handle(p, m, 1.08);
    const blade = (r0, r1) => (x, y) => { const dx = x - 19.4, dy = y - 12.6, r = Math.hypot(dx, dy); if (r < r0 || r > r1) return false; let da = Math.abs(Math.atan2(dy, dx) + 2.356); if (da > Math.PI) da = 2 * Math.PI - da; return da <= 0.3 + 0.52 * (r / 10.6); };
    headUse(p, m, { bevel: 2.6 }).fill(blade(0, 10.6));
    headUse(p, m, { bevel: 1, tone: 1, noOcclude: true }).fill(blade(9, 10.6));
    headUse(p, m, { bevel: 1.2, tone: -1 }).poly([L(-0.6, -0.4), L(2.2, -0.4), L(1.8, -3.6), L(-0.2, -3.6)]);
    if (HEAD[m].sparkle) p.sparkle(10, 7, true);
  } else if (t.type === 'shovel') {
    handle(p, m, 1);
    p.use(m >= 2 ? '#5d6470' : '#5b3a20', { bevel: 1 }).poly([L(-1.8, -2.2), L(-1.8, 2.2), L(1, 2.2), L(1, -2.2)]);
    headUse(p, m, { bevel: 3 }).poly([L(0.4, -4), L(0.4, 4), L(5.6, 4.4), L(9.4, 2.6), L(11, 0), L(9.4, -2.6), L(5.6, -4.4)]);
    headUse(p, m, { bevel: 1, tone: -1, noOcclude: true }).line(...L(2, 0), ...L(8.4, 0), 1);
    if (HEAD[m].sparkle) p.sparkle(26, 7, true);
  } else { // sword
    const S = axis(10.2, 21.8, 1, -1);
    const guardC = m === 4 ? '#3a4560' : m === 3 ? '#e2a92a' : m === 2 ? '#8e98a6' : m === 1 ? '#6d6f78' : '#6b4426';
    headUse(p, m, { bevel: 2.4 }).poly([S(0.6, -2.4), S(14.4, -2.4), S(19, 0), S(14.4, 2.4), S(0.6, 2.4)]);
    headUse(p, m, { bevel: 1, tone: -1, noOcclude: true, flat: true }).line(...S(1.8, 0), ...S(12.4, 0), 0.9);
    p.use(m >= 2 ? LEATHER : WOOD, { bevel: 1.2, tex: (x, y) => ((x - y) % 3 === 0 ? -1 : 0.3) }).line(...S(-1, 0), ...S(-6.6, 0), 2.6);
    p.use(guardC, { bevel: 1.4, shine: m >= 2 ? 0.6 : 0 }).line(...S(-0.6, -5.4), ...S(-0.6, 5.4), 2.8);
    p.use(guardC, { bevel: 1.2, shine: m >= 2 ? 0.6 : 0 }).circ(...S(-8, 0), 1.9);
    if (m === 4) p.use('#e8435a', { bevel: 1, shine: 1 }).circ(...S(-0.6, 0), 1.1);
    if (HEAD[m].sparkle) p.sparkle(24, 8, true).sparkle(17, 15);
  }
  return p.render();
}

// ---------- armor ----------
function armor(id) {
  const a = armorInfo(id), A = ARMOR[a.mat], p = new Painter();
  const main = (o = {}) => p.use(A.c, { tex: A.tex, shine: A.shine, bevel: 3, ...o });
  const trim = (o = {}) => p.use(A.trim, { tex: A.tex, shine: A.shine * 0.6, bevel: 1.2, ...o });
  const rivets = (pts) => { if (A.rivet) for (const [x, y] of pts) p.dot(x, y, A.rivet); };
  const stitches = (pts) => { if (A.stitch) for (const [x, y] of pts) p.dot(x, y, A.stitch, 0.9); };
  if (a.piece === 0) { // helmet
    main().fill((x, y) => ((x - 16) / 12.4) ** 2 + ((y - 17) / 12) ** 2 <= 1 && y < 19.5);
    main().poly([[3.6, 17], [10.4, 17], [10.4, 23.5], [8.4, 26.5], [4.6, 26.5], [3.6, 23.5]]);
    main().poly([[21.6, 17], [28.4, 17], [28.4, 23.5], [27.4, 26.5], [23.6, 26.5], [21.6, 23.5]]);
    trim().fill((x, y) => ((x - 16) / 12.4) ** 2 + ((y - 17) / 12) ** 2 <= 1 && y >= 15 && y < 18.2);
    if (a.mat >= 2) p.use(A.c, { shine: A.shine, bevel: 1.4, tone: 1 }).line(16, 5.6, 16, 14, 2.2);
    rivets([[6, 16], [11, 16], [16, 16], [21, 16], [26, 16]]);
    stitches([[7, 21], [7, 23], [24, 21], [24, 23], [9, 12], [12, 10], [16, 9], [20, 10], [23, 12]]);
    if (A.sparkle) p.sparkle(10, 9, true).sparkle(25, 22);
  } else if (a.piece === 1) { // chestplate
    main().poly([[8, 6], [12.5, 6], [16, 9.4], [19.5, 6], [24, 6], [27.8, 8.6], [27.8, 13.5], [24.6, 15], [24.6, 27.4], [7.4, 27.4], [7.4, 15], [4.2, 13.5], [4.2, 8.6]]);
    p.use(A.trim, { tex: A.tex, shine: A.shine * 0.6, bevel: 1.6 }).ell(6.6, 10.2, 3.6, 4.4);
    p.use(A.trim, { tex: A.tex, shine: A.shine * 0.6, bevel: 1.6 }).ell(25.4, 10.2, 3.6, 4.4);
    main({ bevel: 2.2, tone: 0 }).poly([[9.4, 11], [15.2, 13], [15.2, 21], [9.4, 20]]);
    main({ bevel: 2.2, tone: 0 }).poly([[22.6, 11], [16.8, 13], [16.8, 21], [22.6, 20]]);
    trim().rect(8, 22, 23, 23);
    p.use(A.rivet || A.trim, { bevel: 1, shine: 1 }).rect(15, 22, 16, 23);
    rivets([[10, 25], [21, 25]]);
    stitches([[10, 9], [12, 10], [20, 10], [22, 9], [9, 25], [12, 25], [19, 25], [22, 25]]);
    if (A.sparkle) p.sparkle(11, 13, true).sparkle(21, 18);
  } else if (a.piece === 2) { // leggings
    main().poly([[6.4, 9.6], [25.6, 9.6], [25.6, 28.4], [18.2, 28.4], [16.8, 14.6], [15.2, 14.6], [13.8, 28.4], [6.4, 28.4]]);
    trim({ bevel: 1.6 }).rect(6, 5, 25, 9);
    p.use(A.rivet || A.trim, { bevel: 1, shine: 1 }).rect(15, 6, 16, 8);
    main({ bevel: 1.6, tone: 1 }).rect(8, 17, 12, 19);
    main({ bevel: 1.6, tone: 1 }).rect(19, 17, 23, 19);
    trim({ bevel: 1 }).rect(6, 26, 13, 28); trim({ bevel: 1 }).rect(18, 26, 25, 28);
    stitches([[8, 12], [8, 15], [8, 22], [23, 12], [23, 15], [23, 22]]);
    rivets([[9, 27], [12, 27], [19, 27], [22, 27]]);
    if (A.sparkle) p.sparkle(10, 13, true).sparkle(21, 22);
  } else { // boots
    for (const ox of [0, 15]) {
      main().poly([[4.4 + ox, 8.6], [12.6 + ox, 8.6], [12.6 + ox, 25.4], [1.6 + ox, 25.4], [1.6 + ox, 21.8], [4.4 + ox, 19.8]]);
      trim({ bevel: 1.2 }).rect(4 + ox, 8, 12 + ox, 10);
      p.use(A.mat === 0 ? '#3b2416' : A.trim, { bevel: 1, tone: -1 }).rect(1 + ox, 24, 12 + ox, 26);
      stitches([[6 + ox, 13], [8 + ox, 13], [10 + ox, 13], [6 + ox, 16], [8 + ox, 16], [10 + ox, 16]]);
      rivets([[6 + ox, 9], [10 + ox, 9]]);
    }
    if (A.sparkle) p.sparkle(7, 13, true).sparkle(22, 19);
  }
  return p.render();
}

// ---------- everything else ----------
const DRAW = {
  [I.STICK]: (p) => { p.use(WOOD, { tex: grain(1), bevel: 1.4 }).line(7, 26, 25, 6, 2.8); p.use('#6b4426', { bevel: 1 }).circ(15, 17, 1.2); p.dot(23, 8, '#c8945a'); },
  [I.COAL]: (p) => {
    p.use('#34343c', { tex: speckle(0.8, 2), bevel: 4, shine: 0.6 }).poly([[8, 9], [15, 5], [23, 7], [27, 14], [25, 23], [17, 27], [9, 25], [5, 17]]);
    p.use('#4a4a54', { bevel: 2, tone: 0 }).poly([[10, 10], [15, 7], [19, 9], [16, 14], [11, 14]]);
    p.sparkle(12, 10).dot(22, 20, '#8a8aa0').dot(17, 23, '#8a8aa0');
  },
  [I.IRON_INGOT]: (p) => ingot(p, '#d7dde5', 0.6),
  [I.GOLD_INGOT]: (p) => ingot(p, '#f4c53e', 0.9),
  [I.NETHER_BRICK]: (p) => ingot(p, '#6a2e34', 0, speckle(0.8, 6)),
  [I.DIAMOND]: (p) => {
    p.use('#3fd6d0', { bevel: 2.4, shine: 1 }).poly([[9, 8], [23, 8], [28, 14], [16, 28], [4, 14]]);
    p.use('#9ff7f0', { bevel: 1.4, shine: 1 }).poly([[11, 9.4], [21, 9.4], [24, 13.6], [8, 13.6]]);
    p.use('#22a8a6', { bevel: 1.4 }).poly([[16, 15], [26, 15], [16, 27]]);
    p.use('#5fe8e0', { bevel: 1.4, shine: 1 }).poly([[16, 15], [6, 15], [16, 27]]);
    p.sparkle(12, 11, true).sparkle(22, 18);
  },
  [I.EMERALD]: (p) => {
    p.use('#2fc760', { bevel: 3, shine: 1 }).poly([[16, 4], [25, 10], [25, 22], [16, 28], [7, 22], [7, 10]]);
    p.use('#7af09e', { bevel: 2, shine: 1 }).poly([[16, 9], [20.5, 12], [20.5, 20], [16, 23], [11.5, 20], [11.5, 12]]);
    p.sparkle(12, 10, true).sparkle(21, 21);
  },
  [I.LAPIS]: (p) => {
    p.use('#2c55c9', { bevel: 3.4, tex: speckle(0.7, 8) }).poly([[7, 12], [13, 6], [22, 6], [27, 12], [25, 22], [18, 27], [9, 25], [5, 18]]);
    p.use('#4a7cf0', { bevel: 1.6 }).poly([[10, 11], [14, 8], [19, 9], [15, 14]]);
    for (const [x, y] of [[20, 13], [12, 19], [21, 21], [16, 16]]) p.dot(x, y, '#f4d35a');
    p.sparkle(13, 9);
  },
  [I.QUARTZ]: (p) => {
    p.use('#efe9e1', { bevel: 1.6, shine: 0.8 }).poly([[9, 26], [8, 12], [11, 7], [14, 12], [14, 26]]);
    p.use('#ddd3c8', { bevel: 1.6, shine: 0.6 }).poly([[15, 27], [15, 9], [19, 3.6], [23, 9], [23, 27]]);
    p.use('#f8f4ee', { bevel: 1.4, shine: 0.8 }).poly([[22, 27], [23, 16], [26, 12], [28, 16], [27, 27]]);
    p.sparkle(18, 8, true);
  },
  [I.REDSTONE]: (p) => dust(p, '#d92a20', [[16, 17, 9, 6]], true),
  [I.GUNPOWDER]: (p) => dust(p, '#6c6c74', [[16, 18, 10, 6]], false),
  [I.BLAZE_POWDER]: (p) => dust(p, '#ff9c1a', [[16, 18, 9, 6]], true),
  [I.SEEDS]: (p) => {
    for (const [x, y, r] of [[10, 12, 0.5], [18, 9, -0.4], [22, 17, 0.8], [13, 20, -0.7], [19, 24, 0.2], [8, 22, 1.1]]) p.use('#76b43a', { bevel: 1.6 }).ell(x, y, 3.2, 2, false, r);
  },
  [I.WHEAT]: (p) => {
    p.use('#c7a347', { bevel: 1, tex: grain(0.5) }).path([[8, 28], [14, 17], [18, 6]], 1.4).path([[10, 28], [17, 18], [25, 9]], 1.4).path([[12, 28], [13, 18], [9, 7]], 1.4);
    for (const [x, y] of [[18, 7], [24, 10], [9, 8], [16, 11], [21, 13], [11, 13]]) p.use('#e6c45a', { bevel: 1.6 }).ell(x, y, 2.4, 1.6, false, 0.8);
    p.use('#a07a2a', { bevel: 1 }).rect(8, 23, 14, 24);
  },
  [I.APPLE]: (p) => {
    p.use('#d8262c', { bevel: 6, shine: 0.6 }).fill((x, y) => ((x - 12) / 8.6) ** 2 + ((y - 18.5) / 9) ** 2 <= 1 || ((x - 20) / 8.6) ** 2 + ((y - 18.5) / 9) ** 2 <= 1);
    p.use('#6b4426', { bevel: 1 }).path([[16, 11], [16.6, 6], [18, 3.4]], 1.6);
    p.use('#4fa83a', { bevel: 2 }).ell(21.4, 6.6, 4, 2.2, false, -0.4);
    p.dot(11, 14, '#ffffff', 0.9).dot(10, 15, '#ffd6d6', 0.9).dot(11, 15, '#ffb4b4', 0.8);
  },
  [I.CHORUS_FRUIT]: (p) => {
    p.use('#8c5ea2', { bevel: 5, tex: speckle(0.8, 13) }).circ(16, 17, 10.5);
    for (const [x, y] of [[10, 12], [20, 10], [23, 19], [14, 23], [16, 16]]) p.use('#b98bd0', { bevel: 1.6 }).circ(x, y, 2);
  },
  [I.RAW_PORK]: (p) => meat(p, '#f09a9c', '#fbe0d6', false),
  [I.COOKED_PORK]: (p) => meat(p, '#b9723a', '#e6b277', true),
  [I.RAW_BEEF]: (p) => meat(p, '#cf3434', '#f2d4cc', false, true),
  [I.STEAK]: (p) => meat(p, '#7b4626', '#b97a4a', true, true),
  [I.RAW_MUTTON]: (p) => meat(p, '#d04a4a', '#f4dccf', false),
  [I.COOKED_MUTTON]: (p) => meat(p, '#94552e', '#d39a62', true),
  [I.ROTTEN_FLESH]: (p) => {
    p.use('#8a6a3a', { bevel: 4, tex: speckle(1, 14) }).poly([[5, 14], [10, 7], [20, 6], [27, 11], [26, 21], [18, 26], [8, 24]]);
    for (const [x, y, r] of [[12, 12, 2.6], [20, 18, 3], [11, 20, 1.8]]) p.use('#6c8a32', { bevel: 1.6 }).circ(x, y, r);
  },
  [I.RAW_CHICKEN]: (p) => drumstick(p, '#f2c6ae'),
  [I.COOKED_CHICKEN]: (p) => drumstick(p, '#c8802e'),
  [I.RAW_COD]: (p) => fish(p, '#b9a785', '#e2d4b6'),
  [I.COOKED_COD]: (p) => fish(p, '#a3672f', '#d39a52'),
  [I.BREAD]: (p) => {
    p.use('#c88a36', { bevel: 5, tex: speckle(0.4, 15) }).fill((x, y) => ((x - 16) / 12.6) ** 2 + ((y - 17) / 7.4) ** 2 <= 1);
    p.use('#e7b866', { bevel: 1.4 }).ell(16, 13.4, 9.6, 3, false);
    p.use('#9c6224', { bevel: 1, flat: true }).line(9, 15.4, 12, 11.6, 1.1).line(14.6, 15.4, 17.6, 11.6, 1.1).line(20.2, 15.4, 23.2, 11.6, 1.1);
  },
  [I.EGG]: (p) => {
    p.use('#efe2c4', { bevel: 6, shine: 0.4 }).fill((x, y) => ((x - 16) / 8.6) ** 2 + ((y - 17.6) / (y < 17.6 ? 11.6 : 9.4)) ** 2 <= 1);
    for (const [x, y] of [[13, 13], [19, 18], [15, 22], [20, 11], [11, 19]]) p.dot(x, y, '#c9b28a');
    p.sparkle(12, 10);
  },
  [I.MAGMA_CREAM]: (p) => {
    p.use('#e2701a', { bevel: 6, tex: speckle(0.6, 16) }).circ(16, 17, 10.5);
    p.use('#ffd24a', { bevel: 1, glow: true, flat: true, noOcclude: true }).path([[9, 14], [14, 17], [13, 22]], 1.2).path([[19, 10], [21, 15], [25, 17]], 1.2);
    p.sparkle(11, 11);
  },
  [I.SLIME_BALL]: (p) => {
    p.use('#62c04e', { bevel: 6, shine: 0.6 }).circ(16, 17, 10.5);
    p.use('#3f9030', { bevel: 3 }).circ(18, 19, 5);
    p.dot(10, 11, '#ffffff').dot(11, 11, '#e6ffe0').dot(10, 12, '#e6ffe0');
  },
  [I.ENDER_PEARL]: (p) => {
    p.use('#13534c', { bevel: 6, shine: 0.6 }).circ(16, 16.5, 10.5);
    p.use('#2b8c7e', { bevel: 2, noOcclude: true }).arc(16, 16.5, 6, 3.4, 5.6, 1.4, 2.4);
    p.use('#7be9d7', { bevel: 1.4, glow: true }).circ(16, 16.5, 2.4);
    p.sparkle(11, 11, true);
  },
  [I.EYE_OF_ENDER]: (p) => {
    p.use('#1f7a58', { bevel: 6, shine: 0.5 }).circ(16, 16.5, 10.5);
    p.use('#8af0b6', { bevel: 2.4, shine: 0.6 }).ell(16, 16.5, 7.4, 4.6);
    p.use('#0b1d16', { bevel: 1, flat: true }).ell(16, 16.5, 1.6, 4.2);
    p.sparkle(11, 11, true);
  },
  [I.GHAST_TEAR]: (p) => {
    p.use('#d9eef6', { bevel: 4, shine: 1 }).fill((x, y) => { const dy = y - 19; const r = dy > 0 ? 7.4 * Math.sqrt(Math.max(0, 1 - (dy / 7.4) ** 2)) : 7.4 * (1 + dy / 15); return Math.abs(x - 16) <= r && y > 4 && y < 26.6; });
    p.sparkle(13, 15, true);
  },
  [I.GOLD_NUGGET]: (p) => {
    for (const [x, y, r] of [[13, 18, 4.6], [19.6, 15, 3.6], [18, 22, 3.2], [11, 12, 2.4]]) p.use('#f4c53e', { bevel: 2.4, shine: 0.9 }).circ(x, y, r);
    p.sparkle(12, 16).sparkle(19, 13);
  },
  [I.FLINT]: (p) => {
    p.use('#3c3c44', { bevel: 3, shine: 0.6 }).poly([[12, 4], [22, 9], [26, 20], [19, 28], [9, 25], [6, 15]]);
    p.use('#5a5a66', { bevel: 1.6 }).poly([[12, 7], [19, 10], [16, 16], [9, 15]]);
    p.use('#2a2a32', { bevel: 1.6 }).poly([[17, 18], [24, 20], [19, 26]]);
    p.sparkle(13, 9);
  },
  [I.FLINT_STEEL]: (p) => {
    p.use('#c8ced8', { bevel: 1.6, shine: 0.8 }).arc(19, 13, 6.6, -2.6, 2.4, 2.8);
    p.use('#3c3c44', { bevel: 2.4, shine: 0.6 }).poly([[5, 20], [11, 16], [16, 20], [13, 28], [6, 27]]);
    p.sparkle(26, 9).dot(24, 12, '#ffd24a').dot(27, 13, '#ffb020');
  },
  [I.BONE]: (p) => {
    p.use('#efeedd', { bevel: 1.8 }).line(9, 23, 23, 9, 3.4);
    for (const [x, y] of [[6.4, 22.8], [9.2, 25.6], [22.8, 6.4], [25.6, 9.2]]) p.use('#efeedd', { bevel: 2 }).circ(x, y, 2.6);
  },
  [I.ARROW]: (p) => {
    p.use(WOOD, { bevel: 1, tex: grain(0.6) }).line(7, 25, 23, 9, 1.8);
    p.use('#e9eef3', { bevel: 1.4 }).poly([[4, 24], [8, 22], [10, 24], [8, 28]]);
    p.use('#d7d0c4', { bevel: 1.4 }).poly([[6, 22], [9, 20], [10, 23]]);
    p.use('#e9eef3', { bevel: 1.4 }).poly([[8, 26], [11, 24], [11, 27]]);
    p.use('#9aa3ae', { bevel: 2, shine: 0.8 }).poly([[22, 6], [28, 4], [26, 10], [22.6, 10.6], [21.4, 9.4]]);
  },
  [I.STRING]: (p) => {
    const pts = []; for (let i = 0; i <= 60; i++) { const t = i / 60, w = Math.sin(t * Math.PI * 5) * 3; pts.push([5 + t * 22 + w * 0.7, 26 - t * 20 + w * 0.7]); }
    p.use('#f2f2f4', { bevel: 1 }).path(pts, 1.5);
  },
  [I.FEATHER]: (p) => {
    p.use('#f6f6f8', { bevel: 3 }).fill((x, y) => { const s = ((x - 6) + (26 - y)) / 2, t = ((x - 6) - (26 - y)) / 1.42; return s > 1 && s < 19 && Math.abs(t) < 5 * Math.sin(Math.PI * clamp((s - 1) / 18, 0, 1)) ** 0.7; });
    p.use('#b7bcc6', { bevel: 1, flat: true, noOcclude: true }).line(5, 27, 24, 8, 1);
  },
  [I.PAPER]: (p) => {
    p.use('#f2ede0', { bevel: 2, tex: speckle(0.3, 17) }).poly([[7, 5], [21, 5], [26, 10], [26, 27], [7, 27]]);
    p.use('#d8d0bc', { bevel: 1 }).poly([[21, 5], [26, 10], [21, 10]]);
    p.use('#c9c0aa', { bevel: 1, flat: true }).rect(10, 14, 22, 14).rect(10, 18, 22, 18).rect(10, 22, 18, 22);
  },
  [I.BOOK]: (p) => {
    p.use('#efe6cc', { bevel: 1 }).poly([[9, 6], [26, 6], [26, 27], [9, 27]]);
    p.use('#8a2f2a', { bevel: 2.4, tex: speckle(0.4, 18) }).poly([[6, 5], [23, 5], [23, 26], [6, 26]]);
    p.use('#5e1d1a', { bevel: 1 }).rect(6, 5, 8, 26);
    p.use('#e6b23a', { bevel: 1, shine: 1 }).rect(12, 10, 19, 11).rect(13, 14, 18, 14).rect(10, 22, 21, 22);
  },
  [I.LEATHER]: (p) => {
    p.use('#9c5a2c', { bevel: 3, tex: speckle(0.6, 19) }).poly([[6, 7], [12, 9], [16, 5], [20, 9], [26, 7], [25, 16], [27, 24], [20, 23], [16, 27], [12, 23], [5, 24], [7, 16]]);
    for (const [x, y] of [[10, 12], [13, 12], [19, 12], [22, 12], [10, 20], [13, 20], [19, 20], [22, 20]]) p.dot(x, y, '#d9a46c', 0.8);
  },
  [I.BLAZE_ROD]: (p) => {
    p.use('#ffb32a', { bevel: 1.6, glow: true, tex: (x, y) => ((x + y) % 4 === 0 ? 1 : 0) }).line(8, 25, 24, 7, 3.2);
    p.dot(10, 21, '#fff2a0').dot(16, 15, '#fff2a0').dot(21, 9, '#fff2a0');
  },
  [I.BUCKET]: (p) => bucket(p, null),
  [I.WATER_BUCKET]: (p) => bucket(p, '#3d74e6'),
  [I.LAVA_BUCKET]: (p) => bucket(p, '#ff8a1a', true),
  [I.MILK_BUCKET]: (p) => bucket(p, '#fbfbf6'),
  [I.HOE]: (p) => {
    handle(p, 2);
    const L = axis(HANDLE_B[0], HANDLE_B[1], 1, -1);
    p.use('#5d6470', { bevel: 1 }).poly([L(-1.6, -2), L(-1.6, 2), L(1, 2), L(1, -2)]);
    headUse(p, 2, { bevel: 2 }).poly([L(-0.6, 0.6), L(2.6, 0.6), L(3.2, 7.6), L(1.6, 10), L(-0.4, 9.4)]);
  },
  [I.COMPASS]: (p) => {
    p.use('#8e96a2', { bevel: 2.4, shine: 0.7 }).circ(16, 16.5, 11.6);
    p.use('#f0ead8', { bevel: 1.6 }).circ(16, 16.5, 8.4);
    p.use('#d8302c', { bevel: 1, shine: 0.5 }).poly([[16, 16.5], [20.6, 9.4], [17.6, 17.6]]).poly([[16, 16.5], [20.6, 9.4], [14.6, 15.4]]);
    p.use('#4a4f5a', { bevel: 1 }).poly([[16, 16.5], [11.4, 23.6], [14.4, 15.4]]).poly([[16, 16.5], [11.4, 23.6], [17.4, 17.6]]);
    p.use('#e4b53a', { bevel: 1, shine: 1 }).circ(16, 16.5, 1.2);
    p.sparkle(10, 10);
  },
  [I.CLOCK]: (p) => {
    p.use('#e2b130', { bevel: 2.4, shine: 0.9 }).circ(16, 16.5, 11.6);
    p.use('#6ab6f0', { bevel: 1.6 }).fill((x, y) => (x - 16) ** 2 + (y - 16.5) ** 2 <= 8.4 ** 2 && y < 16.5);
    p.use('#22305e', { bevel: 1.6 }).fill((x, y) => (x - 16) ** 2 + (y - 16.5) ** 2 <= 8.4 ** 2 && y >= 16.5);
    p.use('#ffe066', { bevel: 1.6, glow: true }).circ(12, 12.6, 2.4);
    p.dot(19, 20, '#ffffff').dot(14, 22, '#dfe8ff').dot(21, 23, '#ffffff');
    p.use('#3a2a10', { bevel: 1, flat: true, noOcclude: true }).line(16, 16.5, 16, 10.4, 1).line(16, 16.5, 20, 16.5, 1);
  },
  [I.BOAT]: (p) => {
    p.use('#6b4426', { bevel: 1.2 }).line(7, 5, 25, 19, 1.6);
    p.use('#9a6434', { bevel: 1.6 }).ell(24.6, 19, 2.6, 1.6, false, 0.66);
    const hull = (x, y) => { const u = (x - 16) / 14.4; if (Math.abs(u) > 1) return false; const top = 13 - 3.4 * u ** 4; const bot = 13 + 11 * Math.sqrt(1 - u * u) * (1 - 0.25 * u * u); return y >= top && y <= bot; };
    p.use('#a06a38', { bevel: 3, tex: (x, y) => (y % 4 === 0 ? -1.2 : 0.15) }).fill(hull);
    p.use('#6b4426', { bevel: 1.2 }).fill((x, y) => hull(x, y) && hull(x, y - 2) === false);
    p.use('#c8955a', { bevel: 1, flat: true }).rect(10, 11, 11, 12).rect(21, 11, 22, 12);
  },
  [I.SHEARS]: (p) => {
    p.use('#d7dde5', { bevel: 1.8, shine: 0.8 }).poly([[19, 3.6], [22, 4.6], [18, 17], [15.6, 16]]);
    p.use('#c3cad4', { bevel: 1.8, shine: 0.8 }).poly([[26, 9], [27.4, 12], [16.6, 19], [15.6, 16.6]]);
    p.use('#d8343a', { bevel: 1.6 }).arc(10.4, 21.4, 4, 0, Math.PI * 2, 2.6).arc(19.6, 24.4, 3.6, 0, Math.PI * 2, 2.6);
    p.use('#3a3f48', { bevel: 1, shine: 1 }).circ(16.4, 17.6, 1.4);
  },
  [I.FISHING_ROD]: (p) => {
    p.use(WOOD, { bevel: 1, tex: grain(0.6) }).path([[5, 28], [13, 18], [21, 9], [27, 4]], 2.2);
    p.use(LEATHER_DARK, { bevel: 1 }).line(5, 28, 8.4, 24.2, 2.8);
    p.use('#e8e8ec', { bevel: 1, flat: true, noOutline: true }).line(27.5, 4.6, 27.5, 21, 1);
    p.use('#9aa3ae', { bevel: 1, shine: 1 }).arc(25.9, 22, 1.8, -0.2, 3.2, 1.2);
    p.use('#e83a3a', { bevel: 1 }).circ(27, 15, 1.4);
  },
  [I.SHIELD]: (p) => {
    const shape = (inset) => (x, y) => { const cx = 16, top = 4 + inset, w = 11.4 - inset; if (y < top || y > 29 - inset) return false; const t = (y - top) / (25 - inset * 2); const half = t < 0.55 ? w : w * Math.sqrt(Math.max(0, 1 - ((t - 0.55) / 0.45) ** 2)); return Math.abs(x - cx) <= half; };
    p.use('#8e98a6', { bevel: 1.6, shine: 0.7 }).fill(shape(0));
    p.use('#a0703c', { bevel: 3, tex: (x) => (x % 4 === 0 ? -1 : 0.2) }).fill(shape(2));
    p.use('#8e98a6', { bevel: 1.2, shine: 0.7 }).rect(15, 6, 16, 26).rect(6, 12, 25, 13);
    p.use('#c3cad4', { bevel: 2, shine: 1 }).circ(16, 13, 3);
  },
  [I.TRIDENT]: (p) => {
    p.use('#2f7f86', { bevel: 1.2, tex: grain(0.4) }).line(5, 28, 19, 14, 2.4);
    p.use('#46b5b0', { bevel: 1.6, shine: 0.8 }).path([[14, 13], [18, 10], [22, 14], [19, 18]], 2.2);
    p.use('#46b5b0', { bevel: 1.6, shine: 0.8 }).line(18, 10, 23.6, 4.4, 2.2).line(14.4, 13.2, 13, 5, 2).line(19.6, 17.6, 27.4, 19.2, 2);
    p.use('#9ff0e6', { bevel: 1.4, shine: 1 }).poly([[22, 3], [26.4, 2.6], [26, 7]]).poly([[11, 6], [13, 2.4], [15, 6]]).poly([[26, 17], [29.6, 19], [26, 21]]);
    p.sparkle(24, 5);
  },
  [I.ELYTRA]: (p) => {
    for (const sd of [-1, 1]) {
      const X = (x) => 16 + sd * x;
      p.use('#8a86b0', { bevel: 3.4, tex: (x, y) => ((y * 2 + Math.abs(x - 16)) % 5 === 0 ? -1 : 0.15) }).poly([[X(1.6), 5], [X(7), 3.6], [X(13.4), 7.4], [X(14.4), 16], [X(12.6), 27], [X(9.6), 23.4], [X(7.4), 27.4], [X(5), 23], [X(2.4), 24.6], [X(1.6), 14]]);
      p.use('#c9c6e8', { bevel: 1.8, shine: 0.4 }).poly([[X(2.4), 6], [X(7), 4.8], [X(12.4), 8.4], [X(7.6), 11.4], [X(2.6), 11]]);
      p.use('#5e5a86', { bevel: 1, flat: true, noOcclude: true }).line(X(4), 13, X(4.6), 22, 0.9).line(X(8), 13, X(9.4), 22, 0.9);
    }
  },
  [I.BOW]: (p) => {
    p.use('#e9e9ee', { bevel: 1, flat: true, noOutline: true }).line(9.6, 4, 28, 22.4, 0.9);
    p.use(WOOD, { bevel: 1.6, tex: grain(0.5) }).arc(28, 4, 19.2, Math.PI * 0.53, Math.PI * 0.97, 2.2, 2.2, 3.8);
    p.use(LEATHER, { bevel: 1.2 }).arc(28, 4, 19.2, Math.PI * 0.71, Math.PI * 0.79, 3.6);
    p.use('#d7dde5', { bevel: 1, shine: 1 }).circ(9.6, 4.6, 1.3).circ(27.4, 22.4, 1.3);
  },
  [I.FIREWORK]: (p) => {
    p.use('#a77a44', { bevel: 1 }).line(16, 24, 16, 30, 1.6);
    p.use('#d8343a', { bevel: 3, tex: (x, y) => ((y >> 1) % 3 === 0 ? 1.4 : 0) }).rect(11, 9, 20, 24);
    p.use('#f2ead8', { bevel: 1.4 }).rect(11, 15, 20, 17);
    p.use('#3d74e6', { bevel: 2 }).poly([[10, 9.6], [16, 3], [22, 9.6]]);
    p.use('#ffd24a', { bevel: 1, glow: true }).path([[16, 3], [18, 1.4]], 1.2);
  },
  [I.SMARTPHONE]: (p) => {
    p.use('#22232a', { bevel: 2, shine: 0.6 }).poly([[10, 3], [22, 3], [24, 5], [24, 27], [22, 29], [10, 29], [8, 27], [8, 5]]);
    p.use('#3f8ff0', { bevel: 1, flat: true, tex: null }).rect(10, 6, 21, 25);
    p.use('#7cc0ff', { bevel: 1, flat: true }).poly([[10, 6], [17, 6], [10, 15]]);
    for (const [x, y, c] of [[12, 9, '#ffd24a'], [15, 9, '#5be08a'], [18, 9, '#ff6a6a'], [12, 13, '#ffffff'], [15, 13, '#ffb020'], [18, 13, '#c58cff']]) p.use(c, { bevel: 1, flat: true }).rect(x, y, x + 1, y + 1);
    p.use('#4a4c56', { bevel: 1 }).rect(14, 27, 17, 27);
  },
  [I.CAR]: (p) => {
    p.use('#d8262c', { bevel: 3, shine: 0.8 }).poly([[3, 20], [5, 15], [10, 14], [13, 8.6], [21, 8.6], [25, 14], [29, 15.4], [29, 22], [3, 22]]);
    p.use('#9ad6ff', { bevel: 1.4, shine: 1 }).poly([[11.6, 14], [14.2, 10.2], [17, 10.2], [17, 14]]).poly([[18.4, 14], [18.4, 10.2], [20.6, 10.2], [23.4, 14]]);
    p.use('#ffe066', { bevel: 1, glow: true }).rect(27, 17, 28, 18);
    for (const x of [9, 23]) { p.use('#24252c', { bevel: 2 }).circ(x, 22.4, 3.8); p.use('#b9c0ca', { bevel: 1, shine: 1 }).circ(x, 22.4, 1.6); }
    p.sparkle(8, 16);
  },
  [I.CIRCUIT]: (p) => {
    p.use('#1f7a3e', { bevel: 2 }).rect(4, 5, 27, 26);
    p.use('#4ed37a', { bevel: 1, flat: true, noOcclude: true }).path([[6, 9], [11, 9], [11, 13]], 1).path([[6, 21], [12, 21], [14, 18]], 1).path([[26, 8], [21, 8], [21, 12]], 1).path([[26, 22], [20, 22], [18, 19]], 1);
    p.use('#26272e', { bevel: 1.6, shine: 0.6 }).rect(11, 12, 20, 19);
    p.use('#e4b53a', { bevel: 1, shine: 1 }).rect(7, 8, 7, 8).rect(25, 23, 25, 23).rect(6, 24, 7, 24).rect(24, 6, 25, 6);
    for (let k = 0; k < 4; k++) p.dot(12 + k * 2, 11, '#c9ced6').dot(12 + k * 2, 20, '#c9ced6');
  },
  [I.BATTERY]: (p) => {
    p.use('#3a3c44', { bevel: 3, shine: 0.6 }).rect(9, 6, 22, 28);
    p.use('#c9ced6', { bevel: 1, shine: 1 }).rect(13, 3, 18, 5);
    p.use('#46d870', { bevel: 1.4, glow: true }).rect(11, 15, 20, 26);
    p.use('#e4b53a', { bevel: 1, shine: 1 }).rect(9, 8, 22, 9);
    p.dot(15, 19, '#ffffff').dot(16, 19, '#ffffff').dot(15, 20, '#ffffff').dot(14, 21, '#ffffff').dot(15, 21, '#ffffff').dot(16, 21, '#ffffff').dot(16, 22, '#ffffff').dot(15, 23, '#ffffff');
  },
  [I.DRONE]: (p) => {
    p.use('#5d6470', { bevel: 1 }).line(6, 9, 26, 9, 1.6);
    for (const x of [6, 26]) { p.use('#26272e', { bevel: 1 }).rect(x - 1, 8, x, 12); p.use('#b9c0ca', { bevel: 1, shine: 0.8 }).ell(x - 0.4, 7.4, 4.6, 1.2); }
    p.use('#e9edf2', { bevel: 3, shine: 0.8 }).poly([[9, 11], [23, 11], [21, 19], [11, 19]]);
    p.use('#26272e', { bevel: 1.6, shine: 0.7 }).circ(16, 21.6, 3.4);
    p.use('#3f8ff0', { bevel: 1, shine: 1 }).circ(16, 21.6, 1.6);
    p.use('#ff4a4a', { bevel: 1, glow: true }).rect(12, 13, 12, 13);
  },
};
function ingot(p, c, shine, tex) {
  p.use(c, { bevel: 2.4, shine, tex }).poly([[3, 20], [9, 13], [29, 13], [23, 20]]);
  p.use(c, { bevel: 1.4, shine, tone: 1, tex }).poly([[9, 13], [12, 10], [28, 10], [29, 13]]);
  p.use(c, { bevel: 1.4, shine, tone: -1, tex }).poly([[3, 20], [23, 20], [23, 23], [3, 23]]);
  p.use(c, { bevel: 1.4, shine, tone: -1, tex }).poly([[23, 20], [29, 13], [29, 16], [23, 23]]);
  if (shine) p.sparkle(13, 11, true).sparkle(24, 15);
}
function dust(p, c, piles, glow) {
  const mound = (cx, cy, rx, ry) => (x, y) => y <= cy + 1 && ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
  for (const [cx, cy, rx, ry] of piles) {
    p.use(c, { bevel: 4, tex: speckle(1.2, 23), glow }).fill(mound(cx, cy + 6, rx + 2, ry + 5));
    p.use(c, { bevel: 2.4, tex: speckle(1.2, 29), glow, tone: 0 }).fill(mound(cx - 3, cy + 1, rx * 0.55, ry * 0.9));
    p.use(c, { bevel: 2.4, tex: speckle(1.2, 31), glow }).fill(mound(cx + 4, cy + 2, rx * 0.5, ry * 0.75));
  }
  if (glow) for (const [x, y] of [[12, 15], [20, 18], [15, 21], [9, 21]]) p.dot(x, y, '#fff2c0', 0.9);
}
function meat(p, c, fat, cooked, marbled) {
  const ramp0 = ramp(c);
  p.use(fat, { bevel: 2.4 }).fill((x, y) => ((x - 16) / 13) ** 2 + ((y - 16.5) / 9.6) ** 2 <= 1 && !((x - 4) ** 2 + (y - 26) ** 2 < 40));
  p.use(c, { bevel: 4, tex: marbled ? (x, y) => (hash(x >> 1, y, 3) < 0.2 ? 1.6 : 0) : speckle(0.4, 24), ramp: ramp0 }).fill((x, y) => ((x - 16.6) / 11) ** 2 + ((y - 16) / 7.6) ** 2 <= 1 && !((x - 4) ** 2 + (y - 26) ** 2 < 48));
  if (cooked) p.use(c, { bevel: 1, flat: true, tone: -1, noOcclude: true }).line(10, 19, 15, 11, 1.2).line(15, 21, 21, 12, 1.2).line(20.6, 21, 25, 14.6, 1.2);
  else p.use(fat, { bevel: 1, flat: true, noOcclude: true }).path([[11, 17], [15, 15], [19, 18], [23, 15]], 1.1);
}
function drumstick(p, c) {
  p.use('#f0ead8', { bevel: 1.6 }).line(6, 26, 13, 19, 2.6);
  p.use('#f0ead8', { bevel: 1.6 }).circ(5, 25, 2).circ(7, 27.4, 2);
  p.use(c, { bevel: 5, tex: speckle(0.5, 25) }).ell(19, 13, 9.6, 7.4, false, -0.8);
}
function fish(p, c, belly) {
  p.use(c, { bevel: 2 }).poly([[3, 10], [8, 16], [3, 23], [7, 23], [11, 17.6], [11, 15], [7, 10]]);
  p.use(c, { bevel: 4, tex: (x, y) => ((x + (y % 2)) % 3 === 0 ? -0.8 : 0.2) }).ell(18, 16.6, 11, 6.4);
  p.use(belly, { bevel: 2 }).fill((x, y) => ((x - 18.6) / 9.6) ** 2 + ((y - 18) / 4) ** 2 <= 1 && y > 18);
  p.use(c, { bevel: 1.4, tone: -1 }).poly([[14, 10.6], [19, 7], [22, 10.6]]);
  p.dot(25, 15, '#141414').dot(24, 14, '#ffffff', 0.8);
}
function bucket(p, contents, glow) {
  p.use('#9aa3ae', { bevel: 1.2, shine: 0.8, noOcclude: true }).arc(16, 13, 11, Math.PI * 1.05, Math.PI * 1.95, 1.6);
  p.use('#c9d0d9', { bevel: 3, shine: 0.7, tex: brushed(0.3) }).poly([[5, 11], [27, 11], [24, 28], [8, 28]]);
  p.use('#e9edf2', { bevel: 1.4, shine: 0.7 }).ell(16, 11, 11.4, 3.4);
  p.use('#5a606c', { bevel: 1 }).ell(16, 11.3, 9.8, 2.7);
  if (contents) p.use(contents, { bevel: 1.6, glow, shine: glow ? 0 : 0.8, noOcclude: true }).ell(16, 11.8, 8.8, 2.1);
  p.use('#aab2bd', { bevel: 1, tone: -1 }).rect(7, 18, 25, 19);
  if (contents && !glow) p.dot(12, 11, '#ffffff', 0.9).dot(13, 11, '#ffffff', 0.7);
  if (glow) p.dot(13, 11, '#fff2a0').dot(19, 12, '#fff2a0');
}

// returns a 32×32 canvas, or null when no high-detail art exists
export function drawItem(id) {
  if (isTool(id)) return tool(id);
  if (isArmor(id)) return armor(id);
  const f = DRAW[id]; if (!f) return null;
  const p = new Painter(); f(p); return p.render();
}
