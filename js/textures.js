// Procedural pixel-art texture atlas + item icons
import { mulberry32 } from './noise.js';
import { BLOCKS, I, isTool, toolInfo, isBlock } from './blocks.js';

export const TILE = 16, ATLAS_TILES = 16;
const tiles = {}; // name -> index
let tileCount = 0;
const atlas = document.createElement('canvas');
atlas.width = atlas.height = TILE * ATLAS_TILES;
const actx = atlas.getContext('2d');
const tileData = {}; // name -> ImageData

function newTile(name, painter, seed = 1) {
  const img = actx.createImageData(TILE, TILE);
  const d = img.data;
  const rnd = mulberry32(seed * 9973 + name.length * 31 + name.charCodeAt(0) * 7);
  const P = {
    rnd,
    set(x, y, c, a = 255) {
      if (x < 0 || y < 0 || x >= 16 || y >= 16) return;
      const i = (y * 16 + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = a;
    },
    get(x, y) { const i = (y * 16 + x) * 4; return [d[i], d[i + 1], d[i + 2], d[i + 3]]; },
    noise(base, v, a = 255) {
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) P.set(x, y, vary(base, v, rnd), a);
    },
    clear() { d.fill(0); },
  };
  painter(P);
  const idx = tileCount++;
  tiles[name] = idx;
  tileData[name] = img;
  actx.putImageData(img, (idx % ATLAS_TILES) * TILE, Math.floor(idx / ATLAS_TILES) * TILE);
  return idx;
}
const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
function vary(c, v, rnd) { const f = 1 + (rnd() - 0.5) * v; return [clamp(c[0] * f), clamp(c[1] * f), clamp(c[2] * f)]; }
const mul = (c, f) => [clamp(c[0] * f), clamp(c[1] * f), clamp(c[2] * f)];
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

function voronoi(P, n, colorFn, gap = 0.9, gapColor = [60, 60, 60]) {
  const pts = []; for (let i = 0; i < n; i++) pts.push([P.rnd() * 16, P.rnd() * 16, colorFn(i)]);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    let d1 = 1e9, d2 = 1e9, best = null;
    for (const p of pts) for (let ox = -16; ox <= 16; ox += 16) for (let oy = -16; oy <= 16; oy += 16) {
      const dx = x + 0.5 - (p[0] + ox), dy = y + 0.5 - (p[1] + oy); const dd = Math.sqrt(dx * dx + dy * dy);
      if (dd < d1) { d2 = d1; d1 = dd; best = p; } else if (dd < d2) d2 = dd;
    }
    if (d2 - d1 < gap) P.set(x, y, vary(gapColor, 0.2, P.rnd)); else P.set(x, y, vary(best[2], 0.18, P.rnd));
  }
}
function ore(P, color, color2, n = 4) {
  stone(P);
  for (let k = 0; k < n; k++) {
    const cx = 2 + Math.floor(P.rnd() * 12), cy = 2 + Math.floor(P.rnd() * 12);
    const cells = [[0, 0], [1, 0], [0, 1], [1, 1], [-1, 0], [0, -1]];
    for (const [dx, dy] of cells) if (P.rnd() < 0.75) P.set(cx + dx, cy + dy, P.rnd() < 0.5 ? color : color2);
  }
}
function stone(P) {
  P.noise([128, 128, 128], 0.14);
  for (let k = 0; k < 7; k++) { const x = Math.floor(P.rnd() * 16), y = Math.floor(P.rnd() * 16); const l = 1 + Math.floor(P.rnd() * 3); for (let i = 0; i < l; i++) P.set(x + i, y, vary([105, 105, 105], 0.1, P.rnd)); }
}
function dirt(P) {
  P.noise([134, 96, 67], 0.28);
  for (let k = 0; k < 14; k++) P.set(Math.floor(P.rnd() * 16), Math.floor(P.rnd() * 16), vary([100, 70, 48], 0.15, P.rnd));
  for (let k = 0; k < 6; k++) P.set(Math.floor(P.rnd() * 16), Math.floor(P.rnd() * 16), vary([160, 120, 88], 0.1, P.rnd));
}
function planks(P, base = [162, 130, 78]) {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const row = Math.floor(y / 4); let c = vary(base, 0.12, P.rnd);
    if (y % 4 === 3) c = mul(base, 0.62);
    const off = (row % 2) * 8 + 3; if ((x + off) % 16 === 0 && y % 4 !== 3) c = mul(base, 0.7);
    if (P.rnd() < 0.08) c = mul(base, 0.85);
    P.set(x, y, c);
  }
}
function log(P, base, dark, fn) {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    let c = vary(base, 0.15, P.rnd);
    if ((x * 7 + Math.floor(y / 3) * 3) % 5 === 0) c = mul(dark, 1);
    P.set(x, y, c);
  }
  if (fn) fn(P);
}
function logTop(P, bark, inner, ring) {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const dx = x - 7.5, dy = y - 7.5; const r = Math.max(Math.abs(dx), Math.abs(dy));
    let c;
    if (r > 6.5) c = vary(bark, 0.15, P.rnd); else c = (Math.floor(r) % 2 === 0) ? vary(ring, 0.06, P.rnd) : vary(inner, 0.06, P.rnd);
    P.set(x, y, c);
  }
}
function leaves(P, base, holes = 0.22) {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (P.rnd() < holes) { P.set(x, y, [0, 0, 0], 0); continue; }
    const r = P.rnd(); const c = r < 0.25 ? mul(base, 0.7) : r > 0.85 ? mul(base, 1.25) : vary(base, 0.15, P.rnd);
    P.set(x, y, c);
  }
}
function wool(P, base) {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    let c = vary(base, 0.08, P.rnd); if ((x + y * 3) % 7 === 0) c = mul(base, 0.9); P.set(x, y, c);
  }
}
function metal(P, base) {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    let c = vary(base, 0.05, P.rnd);
    if (x === 0 || y === 0) c = mul(base, 1.15); if (x === 15 || y === 15) c = mul(base, 0.75);
    if ((x === 1 || y === 1) && x < 15 && y < 15) c = mul(base, 1.07);
    P.set(x, y, c);
  }
}
function plant(P, fn) { P.clear(); fn(P); }

export function buildAtlas() {
  newTile('dirt', dirt);
  newTile('grass_top', (P) => {
    P.noise([110, 176, 66], 0.22);
    for (let k = 0; k < 30; k++) P.set(Math.floor(P.rnd() * 16), Math.floor(P.rnd() * 16), vary([84, 145, 48], 0.1, P.rnd));
  });
  newTile('grass_side', (P) => {
    dirt(P);
    for (let x = 0; x < 16; x++) { const h = 3 + Math.floor(P.rnd() * 2.6); for (let y = 0; y < h; y++) P.set(x, y, vary([106, 170, 64], 0.2, P.rnd)); }
  });
  newTile('stone', stone);
  newTile('cobblestone', (P) => voronoi(P, 9, () => vary([128, 128, 128], 0.25, P.rnd), 0.9, [72, 72, 72]));
  newTile('mossy', (P) => {
    voronoi(P, 9, () => vary([128, 128, 128], 0.25, P.rnd), 0.9, [72, 72, 72]);
    for (let k = 0; k < 4; k++) { const cx = P.rnd() * 16, cy = P.rnd() * 16; for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if ((x - cx) ** 2 + (y - cy) ** 2 < 6 && P.rnd() < 0.8) P.set(x, y, vary([88, 128, 60], 0.2, P.rnd)); }
  });
  newTile('bedrock', (P) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const r = P.rnd(); P.set(x, y, r < 0.3 ? [30, 30, 30] : r < 0.6 ? [80, 80, 80] : vary([120, 120, 120], 0.3, P.rnd)); } });
  newTile('sand', (P) => { P.noise([219, 207, 160], 0.08); for (let k = 0; k < 12; k++) P.set(Math.floor(P.rnd() * 16), Math.floor(P.rnd() * 16), [196, 182, 135]); });
  newTile('gravel', (P) => voronoi(P, 22, (i) => vary(i % 3 === 0 ? [150, 130, 120] : [126, 122, 120], 0.3, P.rnd), 0.5, [90, 86, 84]));
  newTile('oak_log', (P) => log(P, [107, 84, 51], [76, 60, 36]));
  newTile('oak_log_top', (P) => logTop(P, [107, 84, 51], [180, 146, 90], [150, 118, 70]));
  newTile('birch_log', (P) => { P.noise([216, 215, 210], 0.06); for (let k = 0; k < 9; k++) { const x = Math.floor(P.rnd() * 14), y = Math.floor(P.rnd() * 16); const l = 1 + Math.floor(P.rnd() * 3); for (let i = 0; i < l; i++) P.set(x + i, y, [40, 40, 36]); } });
  newTile('birch_log_top', (P) => logTop(P, [216, 215, 210], [200, 180, 125], [176, 156, 104]));
  newTile('spruce_log', (P) => log(P, [72, 52, 30], [50, 36, 20]));
  newTile('spruce_log_top', (P) => logTop(P, [72, 52, 30], [140, 106, 62], [112, 84, 48]));
  newTile('oak_leaves', (P) => leaves(P, [58, 132, 38]));
  newTile('birch_leaves', (P) => leaves(P, [104, 150, 64]));
  newTile('spruce_leaves', (P) => leaves(P, [48, 92, 52], 0.15));
  newTile('planks', (P) => planks(P));
  newTile('water', (P) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const w = Math.sin((x + y * 0.6) * 0.8) > 0.7; P.set(x, y, vary(w ? [70, 120, 235] : [44, 84, 210], 0.06, P.rnd), 170); } });
  newTile('glass', (P) => { P.clear(); for (let i = 0; i < 16; i++) { P.set(i, 0, [220, 240, 245]); P.set(i, 15, [190, 215, 225]); P.set(0, i, [220, 240, 245]); P.set(15, i, [190, 215, 225]); } for (let i = 0; i < 4; i++) { P.set(3 + i, 4 - i + 2, [240, 250, 255]); P.set(9 + i, 12 - i, [240, 250, 255]); } });
  newTile('coal_ore', (P) => ore(P, [36, 36, 36], [60, 60, 60]));
  newTile('iron_ore', (P) => ore(P, [216, 175, 147], [180, 136, 108]));
  newTile('gold_ore', (P) => ore(P, [252, 238, 75], [220, 180, 30]));
  newTile('diamond_ore', (P) => ore(P, [93, 236, 245], [40, 190, 200]));
  newTile('redstone_ore', (P) => ore(P, [255, 30, 30], [170, 0, 0]));
  newTile('snow', (P) => P.noise([242, 250, 252], 0.04));
  newTile('snow_side', (P) => { dirt(P); for (let x = 0; x < 16; x++) { const h = 3 + Math.floor(P.rnd() * 2.6); for (let y = 0; y < h; y++) P.set(x, y, vary([242, 250, 252], 0.04, P.rnd)); } });
  newTile('ice', (P) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) P.set(x, y, vary(((x + y) % 9 === 0) ? [200, 225, 255] : [145, 185, 250], 0.06, P.rnd), 200); });
  newTile('cactus_side', (P) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { let c = vary([88, 140, 44], 0.12, P.rnd); if (x % 4 === 1) c = [58, 100, 30]; if (x === 0 || x === 15) c = [40, 72, 20]; P.set(x, y, c); } for (let k = 0; k < 8; k++) P.set(Math.floor(P.rnd() * 4) * 4 + 2, Math.floor(P.rnd() * 16), [230, 230, 200]); });
  newTile('cactus_top', (P) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const r = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)); P.set(x, y, r > 6.5 ? [40, 72, 20] : vary(Math.floor(r) % 3 === 0 ? [70, 120, 40] : [100, 150, 54], 0.08, P.rnd)); } });
  newTile('table_top', (P) => { planks(P, [172, 130, 80]); for (let i = 0; i < 16; i++) { P.set(i, 0, [80, 56, 30]); P.set(i, 15, [80, 56, 30]); P.set(0, i, [80, 56, 30]); P.set(15, i, [80, 56, 30]); P.set(i, 7, [120, 86, 50]); P.set(7, i, [120, 86, 50]); } });
  newTile('table_side', (P) => { planks(P); for (let x = 0; x < 16; x++) for (let y = 0; y < 3; y++) P.set(x, y, [120, 86, 50]); for (let y = 5; y < 13; y++) { P.set(3, y, [90, 90, 90]); P.set(4, y, [150, 150, 150]); } for (let x = 9; x < 14; x++) { P.set(x, 6, [150, 150, 150]); P.set(x, 7, [100, 100, 100]); } P.set(11, 8, [90, 60, 30]); P.set(11, 9, [90, 60, 30]); P.set(11, 10, [90, 60, 30]); });
  newTile('table_front', (P) => { planks(P); for (let x = 0; x < 16; x++) for (let y = 0; y < 3; y++) P.set(x, y, [120, 86, 50]); for (let x = 3; x < 13; x++) P.set(x, 7, [70, 70, 70]); for (let y = 7; y < 13; y++) P.set(4, y, [90, 60, 30]); for (let y = 7; y < 13; y++) P.set(11, y, [90, 60, 30]); });
  newTile('furnace_side', (P) => { stone(P); for (let i = 0; i < 16; i++) { P.set(i, 0, [90, 90, 90]); P.set(i, 15, [90, 90, 90]); } });
  newTile('furnace_top', (P) => { P.noise([118, 118, 118], 0.1); for (let i = 0; i < 16; i++) { P.set(i, 0, [80, 80, 80]); P.set(0, i, [80, 80, 80]); P.set(15, i, [80, 80, 80]); P.set(i, 15, [80, 80, 80]); } });
  const furnaceFront = (on) => (P) => { stone(P); for (let i = 0; i < 16; i++) { P.set(i, 0, [90, 90, 90]); P.set(i, 15, [90, 90, 90]); } for (let y = 3; y < 6; y++) for (let x = 3; x < 13; x++) P.set(x, y, [60, 60, 60]); for (let y = 9; y < 14; y++) for (let x = 4; x < 12; x++) P.set(x, y, on ? (P.rnd() < 0.5 ? [255, 170, 30] : [240, 90, 20]) : [26, 26, 26]); };
  newTile('furnace_front', furnaceFront(false));
  newTile('furnace_front_on', furnaceFront(true));
  const chest = (front) => (P) => { planks(P, [168, 116, 50]); for (let i = 0; i < 16; i++) { P.set(i, 0, [70, 46, 20]); P.set(i, 15, [70, 46, 20]); P.set(0, i, [70, 46, 20]); P.set(15, i, [70, 46, 20]); } if (front !== 'top') for (let x = 1; x < 15; x++) P.set(x, 5, [70, 46, 20]); if (front === 'front') { for (let y = 4; y < 8; y++) for (let x = 7; x < 9; x++) P.set(x, y, [200, 200, 200]); } };
  newTile('chest_side', chest('side')); newTile('chest_top', chest('top')); newTile('chest_front', chest('front'));
  newTile('torch', (P) => plant(P, () => { for (let y = 6; y < 16; y++) { P.set(7, y, [120, 90, 50]); P.set(8, y, [96, 70, 40]); } P.set(7, 5, [255, 220, 90]); P.set(8, 5, [255, 240, 140]); P.set(7, 4, [255, 160, 40]); P.set(8, 4, [255, 200, 60]); P.set(7, 6, [255, 120, 20]); P.set(8, 6, [255, 140, 30]); }));
  newTile('bricks', (P) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const row = Math.floor(y / 4); const off = row % 2 ? 4 : 0; let c = vary([150, 74, 58], 0.15, P.rnd); if (y % 4 === 3 || (x + off) % 8 === 7) c = vary([180, 170, 160], 0.08, P.rnd); P.set(x, y, c); } });
  newTile('stone_bricks', (P) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const row = Math.floor(y / 8); const off = row % 2 ? 4 : 0; let c = vary([122, 122, 122], 0.1, P.rnd); if (y % 8 === 7 || (x + off) % 8 === 7) c = [80, 80, 80]; else if (y % 8 === 0 || (x + off) % 8 === 0) c = [140, 140, 140]; P.set(x, y, c); } });
  newTile('sandstone', (P) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { let c = vary([216, 202, 155], 0.06, P.rnd); if (y < 3) c = vary([226, 214, 170], 0.04, P.rnd); if (y === 3 || y === 12) c = [190, 174, 124]; P.set(x, y, c); } });
  newTile('sandstone_top', (P) => P.noise([222, 208, 162], 0.06));
  newTile('tall_grass', (P) => plant(P, () => { for (let b = 0; b < 7; b++) { const x = 1 + Math.floor(P.rnd() * 14); const h = 5 + Math.floor(P.rnd() * 9); for (let y = 0; y < h; y++) P.set(x + (y > h * 0.6 ? (b % 2 ? 1 : -1) : 0), 15 - y, vary([92, 160, 56], 0.2, P.rnd)); } }));
  newTile('dandelion', (P) => plant(P, () => { for (let y = 9; y < 16; y++) P.set(7, y, [70, 130, 40]); P.set(6, 12, [70, 130, 40]); P.set(8, 11, [70, 130, 40]); for (const [x, y] of [[6, 6], [7, 6], [8, 6], [6, 7], [7, 7], [8, 7], [7, 5], [6, 8], [7, 8], [8, 8], [5, 7], [9, 7]]) P.set(x, y, [250, 220, 40]); P.set(7, 7, [220, 160, 20]); }));
  newTile('poppy', (P) => plant(P, () => { for (let y = 9; y < 16; y++) P.set(7, y, [70, 130, 40]); P.set(8, 12, [70, 130, 40]); P.set(9, 11, [70, 130, 40]); for (const [x, y] of [[6, 5], [7, 5], [8, 5], [5, 6], [6, 6], [7, 6], [8, 6], [9, 6], [5, 7], [6, 7], [8, 7], [9, 7], [6, 8], [7, 8], [8, 8]]) P.set(x, y, [220, 30, 30]); P.set(7, 7, [30, 30, 20]); }));
  newTile('dead_bush', (P) => plant(P, () => { const br = [[7, 15], [7, 14], [7, 13], [6, 12], [5, 11], [4, 10], [8, 12], [9, 11], [10, 10], [11, 9], [7, 11], [7, 10], [7, 9], [6, 8], [8, 8], [3, 9], [12, 8]]; for (const [x, y] of br) P.set(x, y, [130, 96, 50]); }));
  newTile('wool_white', (P) => wool(P, [234, 236, 236]));
  newTile('wool_red', (P) => wool(P, [160, 39, 34]));
  newTile('wool_blue', (P) => wool(P, [53, 57, 157]));
  newTile('wool_green', (P) => wool(P, [84, 109, 27]));
  newTile('wool_yellow', (P) => wool(P, [248, 197, 39]));
  newTile('wool_black', (P) => wool(P, [26, 26, 30]));
  newTile('tnt_side', (P) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) P.set(x, y, vary(x % 4 === 0 ? [180, 40, 20] : [220, 60, 36], 0.08, P.rnd)); for (let y = 5; y < 11; y++) for (let x = 0; x < 16; x++) P.set(x, y, [235, 235, 235]); const T = [[2, 6], [3, 6], [4, 6], [3, 7], [3, 8], [3, 9], [6, 6], [6, 7], [6, 8], [6, 9], [7, 7], [8, 8], [9, 6], [9, 7], [9, 8], [9, 9], [11, 6], [12, 6], [13, 6], [12, 7], [12, 8], [12, 9]]; for (const [x, y] of T) P.set(x, y, [30, 30, 30]); });
  newTile('tnt_top', (P) => { P.noise([200, 60, 40], 0.1); for (let y = 6; y < 10; y++) for (let x = 6; x < 10; x++) P.set(x, y, [60, 60, 60]); P.set(7, 7, [220, 220, 200]); });
  newTile('tnt_bottom', (P) => P.noise([190, 50, 30], 0.1));
  newTile('bed_top', (P) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) P.set(x, y, vary(y < 5 ? [236, 236, 236] : [170, 30, 30], 0.06, P.rnd)); for (let x = 0; x < 16; x++) P.set(x, 5, [120, 20, 20]); });
  newTile('bed_side', (P) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) P.set(x, y, [0, 0, 0], 0); for (let y = 7; y < 12; y++) for (let x = 0; x < 16; x++) P.set(x, y, vary([170, 30, 30], 0.06, P.rnd)); for (let y = 12; y < 16; y++) for (let x = 0; x < 16; x++) P.set(x, y, vary([150, 110, 60], 0.08, P.rnd)); });
  newTile('glowstone', (P) => voronoi(P, 10, (i) => i % 2 ? [255, 220, 120] : [230, 170, 70], 0.7, [150, 100, 50]));
  newTile('lava', (P) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const r = P.rnd(); P.set(x, y, r < 0.2 ? [255, 200, 60] : r < 0.7 ? vary([230, 100, 20], 0.15, P.rnd) : [190, 50, 10]); } });
  newTile('obsidian', (P) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const r = P.rnd(); P.set(x, y, r < 0.1 ? [80, 50, 120] : vary([20, 16, 32], 0.4, P.rnd)); } });
  newTile('bookshelf', (P) => { planks(P); const cols = [[160, 40, 40], [40, 90, 160], [60, 130, 60], [180, 140, 60], [110, 60, 140]]; for (const y0 of [1, 9]) { let x = 1; while (x < 15) { const w = 1 + Math.floor(P.rnd() * 2); const c = cols[Math.floor(P.rnd() * cols.length)]; for (let xx = x; xx < Math.min(15, x + w); xx++) for (let y = y0; y < y0 + 6; y++) P.set(xx, y, vary(c, 0.1, P.rnd)); x += w + (P.rnd() < 0.2 ? 1 : 0); } } });
  newTile('clay', (P) => P.noise([160, 166, 179], 0.07));
  newTile('iron_block', (P) => metal(P, [220, 220, 220]));
  newTile('gold_block', (P) => metal(P, [250, 210, 60]));
  newTile('diamond_block', (P) => metal(P, [100, 230, 225]));
  newTile('coal_block', (P) => metal(P, [26, 26, 26]));
  const pumpkin = (P) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) P.set(x, y, vary(x % 4 === 0 ? [190, 100, 10] : [228, 136, 24], 0.08, P.rnd)); };
  newTile('pumpkin_side', pumpkin);
  newTile('pumpkin_top', (P) => { pumpkin(P); for (let y = 6; y < 10; y++) for (let x = 6; x < 10; x++) P.set(x, y, [90, 70, 30]); });
  const face = (lit) => (P) => { pumpkin(P); const c = lit ? [255, 230, 90] : [50, 30, 10]; for (const [x, y] of [[3, 4], [4, 4], [4, 5], [3, 5], [11, 4], [12, 4], [11, 5], [12, 5], [7, 7], [8, 7]]) P.set(x, y, c); for (let x = 3; x < 13; x++) { P.set(x, 10, c); if (x % 3) P.set(x, 11, c); } };
  newTile('pumpkin_face', face(false)); newTile('jack_face', face(true));
  for (let s = 0; s < 10; s++) newTile('destroy_' + s, (P) => {
    P.clear(); const n = 2 + s * 2;
    for (let k = 0; k < n; k++) { let x = 7 + Math.floor((P.rnd() - 0.5) * (4 + s)), y = 7 + Math.floor((P.rnd() - 0.5) * (4 + s)); const len = 3 + s; for (let i = 0; i < len; i++) { P.set(x, y, [20, 20, 20], 200); x += P.rnd() < 0.5 ? 1 : -1; if (P.rnd() < 0.6) y += P.rnd() < 0.5 ? 1 : -1; } }
  }, s + 3);
  // resolve block tex
  for (const b of BLOCKS) {
    if (!b || !b.tex) continue;
    const t = typeof b.tex === 'string' ? { top: b.tex, bottom: b.tex, side: b.tex } : b.tex;
    b.tiles = { top: tiles[t.top], bottom: tiles[t.bottom], side: tiles[t.side], front: tiles[t.front ?? t.side] };
    b.avgColor = avgColor(tileData[t.side]);
  }
  return atlas;
}
function avgColor(img) {
  let r = 0, g = 0, b = 0, n = 0; const d = img.data;
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 100) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
  return n ? [r / n / 255, g / n / 255, b / n / 255] : [1, 1, 1];
}
export const tileIndex = (name) => tiles[name];

// ---------- Icons ----------
const iconCache = {};
function tileCanvas(name, f = 1) {
  const c = document.createElement('canvas'); c.width = c.height = 16;
  const img = new ImageData(new Uint8ClampedArray(tileData[name].data), 16, 16);
  if (f !== 1) for (let i = 0; i < img.data.length; i += 4) { img.data[i] *= f; img.data[i + 1] *= f; img.data[i + 2] *= f; }
  c.getContext('2d').putImageData(img, 0, 0);
  return c;
}
const nameOfTile = (idx) => Object.keys(tiles).find((k) => tiles[k] === idx);

function blockIcon(id) {
  const b = BLOCKS[id]; const S = 48;
  const c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  const t = b.tiles;
  if (b.shape === 'cross' || b.shape === 'torch') { g.drawImage(tileCanvas(nameOfTile(t.side)), 0, 0, S, S); return c.toDataURL(); }
  const top = tileCanvas(nameOfTile(t.top)), left = tileCanvas(nameOfTile(t.front), 0.78), right = tileCanvas(nameOfTile(t.side), 0.6);
  const k = S / 16, pad = 2, s = (S - pad * 2);
  g.setTransform(s / 2 / 16, -s / 4 / 16, s / 2 / 16, s / 4 / 16, pad, pad + s / 4); g.drawImage(top, 0, 0);
  g.setTransform(s / 2 / 16, s / 4 / 16, 0, s / 2 / 16, pad, pad + s / 4); g.drawImage(left, 0, 0);
  g.setTransform(s / 2 / 16, -s / 4 / 16, 0, s / 2 / 16, pad + s / 2, pad + s / 2); g.drawImage(right, 0, 0);
  void k;
  return c.toDataURL();
}

const TOOL_SHAPES = {
  pickaxe: ['................', '....hhhhhhh.....', '...hhhhhhhhh....', '..hh....s..hh...', '..h....s....hh..', '......s......h..', '.....s..........', '....s...........', '...s............', '..s.............', '.s..............'],
  axe: ['................', '........hhh.....', '.......hhhhh....', '......hhhhhs....', '......hhhhs.....', '.......hhs......', '........s.......', '.......s........', '......s.........', '.....s..........', '....s...........', '...s............', '..s.............'],
  shovel: ['................', '...........hhh..', '..........hhhhh.', '..........hhhhh.', '...........hhh..', '..........s.....', '.........s......', '........s.......', '.......s........', '......s.........', '.....s..........', '....s...........', '...s............', '..s.............'],
  sword: ['................', '............hhh.', '...........hhhh.', '..........hhhh..', '.........hhhh...', '........hhhh....', '.......hhhh.....', '..g...hhhh......', '...g.hhhh.......', '....ghhh........', '....sg..........', '...s..g.........', '..s.............', '.ss.............'],
};
function drawMap(g, rows, colors) {
  const filled = new Set();
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== '.') { g.fillStyle = colors[ch]; g.fillRect(x + 1, y + 1, 1, 1); filled.add((x + 1) + ',' + (y + 1)); } }));
  // outline
  g.fillStyle = 'rgba(20,16,12,0.9)';
  for (let y = 0; y < 18; y++) for (let x = 0; x < 18; x++) {
    if (filled.has(x + ',' + y)) continue;
    if (filled.has((x + 1) + ',' + y) || filled.has((x - 1) + ',' + y) || filled.has(x + ',' + (y + 1)) || filled.has(x + ',' + (y - 1))) g.fillRect(x, y, 1, 1);
  }
}
function blob(g, colA, colB, seed, shape = 'round') {
  const r = mulberry32(seed); const rows = [];
  for (let y = 0; y < 14; y++) {
    let s = '';
    for (let x = 0; x < 14; x++) {
      const dx = x - 6.5, dy = y - 6.5;
      let inside;
      if (shape === 'round') inside = dx * dx + dy * dy < 30 + r() * 6;
      else if (shape === 'ingot') inside = y > 4 && y < 10 && x > (9 - y) && x < 13 - (9 - y) + 1 + (y - 5);
      else if (shape === 'gem') inside = Math.abs(dx) + Math.abs(dy) * 1.3 < 6.5 && dy > -4.5;
      else if (shape === 'meat') inside = (dx * dx) / 36 + (dy * dy) / 16 < 1 && !(x < 3 && y > 7);
      else if (shape === 'pile') inside = y > 6 && Math.abs(dx) < (y - 5) * 1.1 && y < 13;
      else if (shape === 'shard') inside = Math.abs(dx - dy * 0.4) < 3 && Math.abs(dy) < 6;
      else if (shape === 'stick') inside = Math.abs(x - (13 - y)) < 1 && y > 1 && y < 13;
      else if (shape === 'bone') inside = Math.abs(x - (13 - y)) < 1.2 && y > 1 && y < 13 || ((x - 2) ** 2 + (y - 11) ** 2 < 3) || ((x - 11) ** 2 + (y - 2) ** 2 < 3);
      else if (shape === 'bucket') inside = y > 3 && y < 12 && Math.abs(dx) < 5.2 - (y - 3) * 0.25;
      else if (shape === 'loaf') inside = (dx * dx) / 42 + (dy * dy) / 10 < 1;
      s += inside ? (r() < 0.3 ? 'b' : 'a') : '.';
    }
    rows.push(s);
  }
  drawMap(g, rows, { a: colA, b: colB });
}
function itemIcon(id) {
  const c = document.createElement('canvas'); c.width = c.height = 18; const g = c.getContext('2d');
  if (isTool(id)) {
    const t = toolInfo(id);
    drawMap(g, TOOL_SHAPES[t.type], { h: t.color, s: '#6b4a24', g: t.dark });
  } else {
    const M = {
      [I.STICK]: ['#8a6232', '#6b4a24', 'stick'], [I.COAL]: ['#2a2a2a', '#444', 'round'], [I.IRON_INGOT]: ['#e0e0e0', '#b0b0b0', 'ingot'],
      [I.GOLD_INGOT]: ['#f8d848', '#d0a020', 'ingot'], [I.DIAMOND]: ['#6ff2e8', '#2bb8b0', 'gem'], [I.REDSTONE]: ['#e02020', '#900', 'pile'],
      [I.APPLE]: ['#d8202a', '#ff6060', 'round'], [I.RAW_PORK]: ['#f29a9a', '#e07070', 'meat'], [I.COOKED_PORK]: ['#b9763e', '#8a5426', 'meat'],
      [I.RAW_BEEF]: ['#c83232', '#f0d0d0', 'meat'], [I.STEAK]: ['#7a4a26', '#5a3418', 'meat'], [I.GUNPOWDER]: ['#666', '#888', 'pile'],
      [I.ROTTEN_FLESH]: ['#8a6a3a', '#5a7a2a', 'meat'], [I.FLINT]: ['#3a3a3a', '#666', 'shard'], [I.FLINT_STEEL]: ['#c0c0c0', '#3a3a3a', 'shard'],
      [I.RAW_MUTTON]: ['#d04848', '#f0c0c0', 'meat'], [I.COOKED_MUTTON]: ['#9a5a30', '#6a3a18', 'meat'], [I.BREAD]: ['#c8923a', '#a0702a', 'loaf'],
      [I.BONE]: ['#eeeede', '#cfcfbf', 'bone'], [I.BUCKET]: ['#c8c8c8', '#9a9a9a', 'bucket'], [I.WATER_BUCKET]: ['#c8c8c8', '#9a9a9a', 'bucket'], [I.LAVA_BUCKET]: ['#c8c8c8', '#9a9a9a', 'bucket'], [I.ARROW]: ['#8a6232', '#ddd', 'stick'],
    }[id] || ['#f0f', '#000', 'round'];
    blob(g, M[0], M[1], id * 13, M[2]);
    if (id === I.WATER_BUCKET || id === I.LAVA_BUCKET || id === I.BUCKET) { g.fillStyle = id === I.WATER_BUCKET ? '#3a6ae8' : id === I.LAVA_BUCKET ? '#ff7a10' : '#555'; g.fillRect(3, 5, 12, 2); }
    if (id === I.APPLE) { g.fillStyle = '#5a3a1a'; g.fillRect(8, 1, 1, 3); g.fillStyle = '#3a9a2a'; g.fillRect(9, 2, 2, 1); }
  }
  return c.toDataURL();
}
export function iconFor(id) {
  if (iconCache[id]) return iconCache[id];
  return (iconCache[id] = isBlock(id) ? blockIcon(id) : itemIcon(id));
}
export function itemCanvas(id) {
  // returns canvas for 3D held / dropped item sprite
  const img = new Image(); img.src = iconFor(id); return img;
}
