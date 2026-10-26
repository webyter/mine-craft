// Procedural pixel-art texture atlas + item icons
import { mulberry32 } from './noise.js';
import { BLOCKS, I, isTool, toolInfo, isBlock, isArmor, armorInfo } from './blocks.js';

export const TILE = 16, ATLAS_TILES = 32;
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
  // ---- village / city tiles ----
  newTile('path_top', (P) => { P.noise([148, 122, 66], 0.16); for (let k = 0; k < 20; k++) P.set(Math.floor(P.rnd() * 16), Math.floor(P.rnd() * 16), vary([120, 96, 52], 0.1, P.rnd)); });
  newTile('path_side', (P) => { dirt(P); for (let x = 0; x < 16; x++) { P.set(x, 0, [0, 0, 0], 0); const h = 2 + Math.floor(P.rnd() * 2); for (let y = 1; y < h; y++) P.set(x, y, vary([148, 122, 66], 0.12, P.rnd)); } });
  newTile('farmland', (P) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) P.set(x, y, vary(y % 4 === 0 ? [70, 44, 26] : [100, 66, 40], 0.18, P.rnd)); });
  for (let s = 0; s < 4; s++) newTile('wheat_' + s, (P) => plant(P, () => {
    const h = 4 + s * 3; const col = s === 3 ? [200, 170, 60] : s === 2 ? [140, 160, 50] : [70, 150, 40];
    for (let x = 1; x < 16; x += 3) { for (let y = 0; y < h; y++) P.set(x + (y > h - 3 ? 1 : 0), 15 - y, vary(col, 0.15, P.rnd)); if (s === 3) { P.set(x, 15 - h, [150, 110, 30]); P.set(x + 1, 16 - h, [150, 110, 30]); } }
  }, s + 40));
  newTile('hay_side', (P) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { let c = vary([196, 162, 40], 0.16, P.rnd); if (y === 3 || y === 12) c = [130, 60, 20]; P.set(x, y, c); } });
  newTile('hay_top', (P) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) P.set(x, y, vary((x + y) % 3 ? [190, 156, 40] : [160, 126, 30], 0.12, P.rnd)); });
  newTile('bell', (P) => { metal(P, [240, 200, 60]); for (let x = 0; x < 16; x++) { P.set(x, 12, [180, 130, 30]); P.set(x, 13, [255, 230, 120]); } });
  newTile('bell_top', (P) => metal(P, [220, 180, 50]));
  const concrete = (c) => (P) => P.noise(c, 0.04);
  newTile('concrete_white', concrete([207, 213, 214])); newTile('concrete_gray', concrete([96, 100, 104])); newTile('concrete_yellow', concrete([240, 175, 22]));
  newTile('asphalt', (P) => { P.noise([46, 46, 50], 0.22); for (let k = 0; k < 18; k++) P.set(Math.floor(P.rnd() * 16), Math.floor(P.rnd() * 16), [72, 72, 76]); });
  newTile('smooth_stone', (P) => { P.noise([160, 160, 160], 0.05); for (let i = 0; i < 16; i++) { P.set(i, 0, [120, 120, 120]); P.set(i, 15, [120, 120, 120]); P.set(0, i, [130, 130, 130]); P.set(15, i, [130, 130, 130]); } });
  newTile('lamp', (P) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const e = x === 0 || y === 0 || x === 15 || y === 15; P.set(x, y, e ? [90, 60, 30] : vary((x % 5 === 2 || y % 5 === 2) ? [255, 236, 170] : [240, 190, 90], 0.08, P.rnd)); } });
  newTile('emerald_ore', (P) => ore(P, [60, 220, 110], [20, 150, 60], 3));
  newTile('emerald_block', (P) => metal(P, [60, 200, 100]));
  newTile('terracotta', (P) => P.noise([162, 84, 38], 0.06));
  newTile('window', (P) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const e = x === 0 || y === 0 || x === 15 || y === 15; const r = (x - y + 16) % 16; P.set(x, y, e ? [70, 74, 80] : (r === 3 || r === 4 || r === 10) ? [170, 210, 235] : vary([60, 110, 160], 0.05, P.rnd)); } });
  // ---- enchanting / nether tiles ----
  const netherrack = (P) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const r = P.rnd(); P.set(x, y, r < 0.18 ? [80, 22, 22] : r < 0.3 ? [140, 60, 56] : vary([110, 40, 38], 0.18, P.rnd)); } };
  newTile('netherrack', netherrack);
  const nOre = (c1, c2) => (P) => { netherrack(P); for (let k = 0; k < 5; k++) { const cx = 2 + Math.floor(P.rnd() * 12), cy = 2 + Math.floor(P.rnd() * 12); for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [-1, 0]]) if (P.rnd() < 0.8) P.set(cx + dx, cy + dy, P.rnd() < 0.5 ? c1 : c2); } };
  newTile('quartz_ore', nOre([236, 230, 220], [200, 190, 180]));
  newTile('nether_gold_ore', nOre([252, 220, 70], [210, 160, 30]));
  newTile('soul_sand', (P) => { P.noise([84, 64, 50], 0.18); for (const [fx, fy] of [[3, 4], [10, 3], [6, 10], [12, 11]]) { P.set(fx, fy, [40, 28, 22]); P.set(fx + 2, fy, [40, 28, 22]); P.set(fx + 1, fy + 2, [44, 30, 24]); P.set(fx, fy + 2, [44, 30, 24]); P.set(fx + 2, fy + 2, [44, 30, 24]); } });
  newTile('soul_soil', (P) => { P.noise([76, 58, 46], 0.22); for (let k = 0; k < 18; k++) P.set(Math.floor(P.rnd() * 16), Math.floor(P.rnd() * 16), [56, 42, 34]); });
  newTile('nether_bricks', (P) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const row = Math.floor(y / 4); const off = row % 2 ? 4 : 0; let c = vary([60, 28, 34], 0.15, P.rnd); if (y % 4 === 3 || (x + off) % 8 === 7) c = [28, 12, 16]; P.set(x, y, c); } });
  newTile('portal', (P) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const w = Math.sin(x * 0.9 + Math.sin(y * 0.7) * 2.2) * 0.5 + 0.5; P.set(x, y, [Math.round(110 + w * 80), Math.round(20 + w * 40), Math.round(200 + w * 55)], 200); } });
  newTile('magma', (P) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const crack = (Math.sin(x * 1.3 + y * 0.4) + Math.sin(y * 1.1 - x * 0.5)) > 1.1; P.set(x, y, crack ? vary([255, 150, 40], 0.12, P.rnd) : vary([110, 40, 24], 0.2, P.rnd)); } });
  newTile('nylium_top', (P) => { P.noise([150, 28, 30], 0.2); for (let k = 0; k < 24; k++) P.set(Math.floor(P.rnd() * 16), Math.floor(P.rnd() * 16), [190, 50, 40]); });
  newTile('nylium_side', (P) => { netherrack(P); for (let x = 0; x < 16; x++) { const h = 2 + Math.floor(P.rnd() * 3); for (let y = 0; y < h; y++) P.set(x, y, vary([150, 28, 30], 0.2, P.rnd)); } });
  newTile('crimson_stem', (P) => log(P, [110, 36, 56], [70, 20, 36], (Q) => { for (let k = 0; k < 10; k++) Q.set(Math.floor(Q.rnd() * 16), Math.floor(Q.rnd() * 16), [30, 160, 150]); }));
  newTile('crimson_stem_top', (P) => logTop(P, [110, 36, 56], [140, 60, 80], [120, 46, 66]));
  newTile('wart_block', (P) => { P.noise([130, 16, 18], 0.25); for (let k = 0; k < 20; k++) P.set(Math.floor(P.rnd() * 16), Math.floor(P.rnd() * 16), [90, 8, 10]); });
  newTile('shroomlight', (P) => voronoi(P, 8, (i) => i % 2 ? [255, 190, 90] : [240, 150, 60], 0.7, [200, 100, 40]));
  newTile('basalt_side', (P) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) P.set(x, y, vary(x % 5 === 0 ? [50, 50, 56] : [80, 80, 86], 0.12, P.rnd)); });
  newTile('basalt_top', (P) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const r = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)); P.set(x, y, vary(Math.floor(r) % 3 === 0 ? [60, 60, 66] : [90, 90, 96], 0.1, P.rnd)); } });
  newTile('spawner', (P) => { P.clear(); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (x % 5 === 0 || y % 5 === 0 || x === 15 || y === 15) P.set(x, y, vary([40, 50, 60], 0.2, P.rnd)); });
  newTile('quartz_side', (P) => { P.noise([236, 230, 222], 0.04); for (let i = 0; i < 16; i++) { P.set(i, 0, [210, 204, 196]); P.set(i, 15, [210, 204, 196]); } });
  newTile('quartz_top', (P) => P.noise([238, 232, 226], 0.04));
  newTile('sugar_cane', (P) => plant(P, () => { for (const x0 of [3, 8, 12]) for (let y = 0; y < 16; y++) { const c = y % 5 === 0 ? [120, 170, 80] : vary([150, 200, 100], 0.1, P.rnd); P.set(x0, y, c); P.set(x0 + 1, y, mul(c, 0.85)); } P.set(5, 6, [110, 160, 70]); P.set(6, 5, [110, 160, 70]); P.set(10, 10, [110, 160, 70]); }));
  newTile('lapis_ore', (P) => ore(P, [40, 80, 200], [20, 50, 160], 5));
  newTile('lapis_block', (P) => metal(P, [36, 70, 180]));
  newTile('crimson_fungus', (P) => plant(P, () => { for (let y = 9; y < 16; y++) P.set(7, y, [230, 200, 160]); for (let x = 4; x < 12; x++) for (let y = 5; y < 9; y++) if (!(y === 5 && (x === 4 || x === 11))) P.set(x, y, vary([200, 30, 30], 0.12, P.rnd)); P.set(6, 6, [255, 200, 90]); P.set(9, 7, [255, 200, 90]); }));
  newTile('ench_top', (P) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const e = x < 2 || y < 2 || x > 13 || y > 13; P.set(x, y, e ? vary([30, 20, 40], 0.3, P.rnd) : vary([170, 30, 40], 0.1, P.rnd)); } for (let k = 0; k < 8; k++) P.set(3 + Math.floor(P.rnd() * 10), 3 + Math.floor(P.rnd() * 10), [60, 220, 220]); });
  newTile('ench_side', (P) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const r = P.rnd(); P.set(x, y, y < 4 ? vary([170, 30, 40], 0.1, P.rnd) : r < 0.1 ? [80, 50, 120] : vary([20, 16, 32], 0.4, P.rnd)); } for (let x = 0; x < 16; x++) P.set(x, 4, [230, 200, 120]); });
  // ---- modern 2025 tiles ----
  const frame = (P, c) => { for (let i = 0; i < 16; i++) { P.set(i, 0, c); P.set(i, 15, c); P.set(0, i, c); P.set(15, i, c); } };
  const curtain = (base, hi) => (P) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const r = (x + y * 2) % 23; P.set(x, y, r < 2 ? hi : vary(mul(base, 1 + (15 - y) * 0.012), 0.03, P.rnd)); } for (let i = 0; i < 16; i++) { P.set(i, 15, [150, 160, 170]); P.set(15, i, [150, 160, 170]); P.set(7, i, mul(base, 0.8)); } };
  newTile('glass_blue', curtain([70, 140, 200], [190, 225, 245]));
  newTile('glass_dark', curtain([38, 46, 58], [110, 130, 150]));
  newTile('lit_window', (P) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) P.set(x, y, vary(y > 12 ? [200, 170, 110] : [255, 226, 150], 0.05, P.rnd)); for (let i = 0; i < 16; i++) { P.set(i, 15, [150, 160, 170]); P.set(15, i, [150, 160, 170]); P.set(7, i, [210, 190, 140]); } for (let x = 2; x < 6; x++) for (let y = 9; y < 13; y++) P.set(x, y, [120, 100, 80]); });
  newTile('steel', (P) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) P.set(x, y, vary(x % 8 === 0 ? [120, 126, 134] : [168, 174, 182], 0.04, P.rnd)); frame(P, [110, 116, 124]); for (const [a, b] of [[2, 2], [13, 2], [2, 13], [13, 13]]) P.set(a, b, [90, 94, 100]); });
  newTile('black_concrete', concrete([22, 24, 28])); newTile('blue_concrete', concrete([44, 64, 150])); newTile('red_concrete', concrete([150, 36, 34]));
  newTile('green_concrete', concrete([84, 110, 40])); newTile('orange_concrete', concrete([226, 98, 18]));
  newTile('marble', (P) => { P.noise([236, 234, 230], 0.03); let x = 0, y = Math.floor(P.rnd() * 16); for (let i = 0; i < 26; i++) { P.set(x, y, [180, 182, 186]); x++; y += P.rnd() < 0.5 ? 1 : -1; if (x > 15) { x = 0; y = Math.floor(P.rnd() * 16); } } });
  newTile('solar_top', (P) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) P.set(x, y, (x % 4 === 0 || y % 5 === 0) ? [180, 190, 205] : vary([26, 46, 110], 0.08, P.rnd)); frame(P, [200, 205, 210]); P.set(3, 2, [120, 160, 230]); P.set(11, 8, [120, 160, 230]); });
  newTile('solar_side', (P) => { P.noise([170, 176, 184], 0.04); for (let x = 0; x < 16; x++) for (let y = 0; y < 8; y++) P.set(x, y, [0, 0, 0], 0); for (let x = 0; x < 16; x++) P.set(x, 8, [30, 50, 110]); });
  const led = (pal) => (P) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const c = pal[(Math.floor(x / 2) + Math.floor(y / 2) * 3 + Math.floor(P.rnd() * 1.4)) % pal.length]; P.set(x, y, (x % 2 && y % 2) ? mul(c, 0.6) : c); } };
  newTile('led_screen', led([[40, 200, 255], [255, 60, 160], [255, 220, 60], [60, 255, 120], [250, 250, 255]]));
  newTile('led_ad', led([[30, 90, 255], [60, 160, 255], [255, 255, 255], [20, 40, 160]]));
  newTile('led_ad2', led([[255, 60, 30], [255, 160, 30], [255, 240, 120], [200, 20, 40]]));
  newTile('rack_side', (P) => { P.noise([40, 42, 48], 0.05); for (let y = 1; y < 16; y += 3) for (let x = 1; x < 15; x++) P.set(x, y, [70, 74, 82]); frame(P, [90, 94, 100]); });
  newTile('rack_front', (P) => { P.noise([24, 26, 30], 0.05); for (let y = 1; y < 15; y += 2) { for (let x = 2; x < 14; x++) P.set(x, y, [56, 60, 68]); P.set(3, y, P.rnd() < 0.5 ? [40, 255, 90] : [40, 140, 255]); P.set(5, y, P.rnd() < 0.3 ? [255, 160, 40] : [40, 255, 90]); } frame(P, [110, 116, 124]); });
  newTile('pc_front', (P) => { P.clear(); for (let x = 2; x < 14; x++) for (let y = 1; y < 9; y++) P.set(x, y, (x === 2 || x === 13 || y === 1 || y === 8) ? [20, 20, 24] : vary(y < 4 ? [70, 150, 230] : [40, 110, 200], 0.08, P.rnd)); for (let x = 4; x < 9; x++) P.set(x, 3, [240, 240, 255]); for (let x = 4; x < 11; x++) P.set(x, 5, [200, 220, 255]); for (let y = 9; y < 10; y++) for (let x = 7; x < 9; x++) P.set(x, y, [30, 30, 34]); for (let x = 0; x < 16; x++) { P.set(x, 10, [150, 112, 70]); P.set(x, 11, [120, 88, 52]); } for (let y = 12; y < 16; y++) { P.set(1, y, [90, 66, 40]); P.set(14, y, [90, 66, 40]); } });
  newTile('pc_side', (P) => { P.clear(); for (let y = 1; y < 9; y++) for (let x = 7; x < 9; x++) P.set(x, y, [24, 24, 28]); for (let x = 0; x < 16; x++) { P.set(x, 10, [150, 112, 70]); P.set(x, 11, [120, 88, 52]); } for (let y = 12; y < 16; y++) { P.set(1, y, [90, 66, 40]); P.set(14, y, [90, 66, 40]); } });
  newTile('pc_top', (P) => { planks(P, [160, 120, 76]); for (let x = 3; x < 13; x++) for (let y = 9; y < 13; y++) P.set(x, y, (x + y) % 2 ? [40, 40, 44] : [70, 70, 76]); for (let x = 2; x < 14; x++) for (let y = 2; y < 4; y++) P.set(x, y, [24, 24, 28]); P.set(14, 11, [200, 200, 205]); });
  newTile('tv_front', (P) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const t = Math.sin(x * 0.5) + Math.cos(y * 0.4); P.set(x, y, t > 1 ? [255, 120, 60] : t > 0 ? [60, 160, 255] : [30, 60, 140]); } frame(P, [14, 14, 16]); for (let x = 6; x < 10; x++) P.set(x, 14, [240, 240, 240]); });
  newTile('traffic_side', (P) => { P.noise([28, 30, 32], 0.05); for (const [y, c] of [[3, [255, 40, 30]], [8, [255, 200, 30]], [13, [40, 230, 90]]]) for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) if (dx * dx + dy * dy < 6) P.set(8 + dx, y + dy, mul(c, dx * dx + dy * dy < 2 ? 1 : 0.7)); });
  newTile('ac_side', (P) => { P.noise([210, 212, 214], 0.03); for (let y = 2; y < 14; y += 2) for (let x = 2; x < 14; x++) P.set(x, y, [150, 152, 156]); frame(P, [160, 162, 166]); });
  newTile('ac_front', (P) => { P.noise([210, 212, 214], 0.03); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const r = Math.hypot(x - 7.5, y - 7.5); if (r < 6.5) P.set(x, y, (Math.floor(Math.atan2(y - 7.5, x - 7.5) * 1.3 + 9) % 2) ? [60, 62, 66] : [110, 112, 118]); } frame(P, [160, 162, 166]); });
  newTile('ac_top', (P) => { P.noise([200, 202, 206], 0.03); for (let x = 2; x < 14; x += 2) for (let y = 2; y < 14; y++) P.set(x, y, [90, 92, 96]); });
  newTile('vend_side', (P) => { P.noise([200, 30, 40], 0.04); for (let y = 2; y < 6; y++) for (let x = 2; x < 14; x++) P.set(x, y, [255, 255, 255]); for (let x = 3; x < 13; x++) P.set(x, 4, [200, 30, 40]); });
  newTile('vend_front', (P) => { P.noise([200, 30, 40], 0.04); for (let y = 1; y < 12; y++) for (let x = 1; x < 11; x++) P.set(x, y, [170, 220, 240]); const cols = [[255, 60, 60], [60, 120, 255], [60, 220, 90], [255, 200, 40]]; for (let r = 0; r < 4; r++) for (let x = 2; x < 10; x += 2) { P.set(x, 2 + r * 3, cols[(x + r) % 4]); P.set(x, 3 + r * 3, cols[(x + r) % 4]); } for (let y = 3; y < 9; y++) P.set(13, y, [30, 30, 34]); P.set(13, 4, [40, 255, 90]); for (let x = 2; x < 10; x++) P.set(x, 13, [20, 20, 22]); });
  newTile('atm_side', (P) => { P.noise([120, 126, 134], 0.04); frame(P, [80, 84, 90]); });
  newTile('atm_front', (P) => { P.noise([120, 126, 134], 0.04); for (let y = 2; y < 7; y++) for (let x = 3; x < 13; x++) P.set(x, y, [40, 140, 90]); for (let x = 4; x < 9; x++) P.set(x, 3, [200, 255, 220]); for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) P.set(5 + c * 2, 9 + r * 2, [220, 220, 224]); for (let x = 4; x < 12; x++) P.set(x, 8, [20, 20, 20]); for (let i = 0; i < 16; i++) P.set(i, 0, [30, 90, 200]); });
  newTile('ev_side', (P) => { P.noise([236, 238, 240], 0.03); for (let y = 2; y < 7; y++) for (let x = 4; x < 12; x++) P.set(x, y, [30, 34, 40]); for (let x = 5; x < 11; x++) P.set(x, 4, [60, 230, 120]); for (let y = 9; y < 14; y++) P.set(7, y, [20, 20, 22]); P.set(8, 12, [60, 160, 255]); for (let x = 0; x < 16; x++) P.set(x, 15, [60, 160, 255]); });
  newTile('ev_top', (P) => { P.noise([236, 238, 240], 0.03); P.set(7, 7, [60, 160, 255]); P.set(8, 8, [60, 160, 255]); });
  newTile('helipad', (P) => { P.noise([70, 74, 80], 0.05); for (let i = 0; i < 16; i++) for (const o of [0, 15]) { P.set(i, o, [250, 210, 40]); P.set(o, i, [250, 210, 40]); } for (let y = 4; y < 12; y++) { P.set(5, y, [255, 255, 255]); P.set(10, y, [255, 255, 255]); } for (let x = 5; x < 11; x++) P.set(x, 8, [255, 255, 255]); });
  newTile('elevator', (P) => { P.noise([176, 182, 190], 0.03); for (let y = 1; y < 16; y++) { P.set(7, y, [80, 84, 90]); P.set(8, y, [210, 214, 220]); } frame(P, [100, 104, 110]); P.set(12, 6, [255, 200, 60]); P.set(12, 8, [255, 200, 60]); P.set(13, 5, [255, 200, 60]); P.set(11, 9, [255, 200, 60]); });
  newTile('hospital_sign', (P) => { P.noise([245, 245, 245], 0.02); for (let a = 3; a < 13; a++) for (let b = 6; b < 10; b++) { P.set(a, b, [220, 30, 40]); P.set(b, a, [220, 30, 40]); } });
  newTile('road_line', (P) => { P.noise([46, 46, 50], 0.22); for (let y = 0; y < 16; y++) for (let x = 6; x < 10; x++) P.set(x, y, vary([236, 236, 230], 0.04, P.rnd)); });
  newTile('planter_side', (P) => { P.noise([120, 124, 128], 0.04); for (let x = 0; x < 16; x++) for (let y = 0; y < 3; y++) P.set(x, y, vary([70, 140, 50], 0.1, P.rnd)); });
  // ---- End + stronghold ----
  newTile('end_stone', (P) => { P.noise([222, 224, 160], 0.08); for (let k = 0; k < 14; k++) { const x = Math.floor(P.rnd() * 16), y = Math.floor(P.rnd() * 16); P.set(x, y, [196, 196, 132]); P.set(x + 1, y, [206, 208, 144]); } });
  newTile('end_bricks', (P) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const off = Math.floor(y / 4) % 2 ? 4 : 0; let c = vary([226, 228, 168], 0.06, P.rnd); if (y % 4 === 3 || (x + off) % 8 === 7) c = [180, 180, 120]; P.set(x, y, c); } });
  newTile('frame_side', (P) => { P.noise([222, 224, 160], 0.08); for (let x = 0; x < 16; x++) for (let y = 0; y < 4; y++) P.set(x, y, vary([44, 92, 80], 0.15, P.rnd)); for (let x = 0; x < 16; x += 3) P.set(x, 4, [30, 70, 60]); });
  const frameTop = (eye) => (P) => { P.noise([44, 92, 80], 0.15); for (let i = 0; i < 16; i++) { P.set(i, 0, [222, 224, 160]); P.set(i, 15, [222, 224, 160]); P.set(0, i, [222, 224, 160]); P.set(15, i, [222, 224, 160]); } for (let y = 4; y < 12; y++) for (let x = 4; x < 12; x++) { const d = Math.hypot(x - 7.5, y - 7.5); if (d < 4) P.set(x, y, eye ? (d < 1.6 ? [10, 20, 16] : [60, 170, 120]) : [24, 52, 46]); } };
  newTile('frame_top', frameTop(false)); newTile('frame_top_eye', frameTop(true));
  newTile('end_portal', (P) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) P.set(x, y, vary([8, 14, 22], 0.4, P.rnd)); for (let k = 0; k < 18; k++) { const x = Math.floor(P.rnd() * 16), y = Math.floor(P.rnd() * 16); const c = [[60, 200, 180], [140, 80, 220], [230, 250, 255], [40, 120, 220]][k % 4]; P.set(x, y, c); } });
  newTile('purpur', (P) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { let c = vary([168, 122, 168], 0.08, P.rnd); if (x % 8 === 7 || y % 8 === 7) c = [130, 90, 130]; else if (x % 8 === 0 || y % 8 === 0) c = [190, 146, 190]; P.set(x, y, c); } });
  newTile('purpur_pillar', (P) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { let c = vary([172, 126, 172], 0.07, P.rnd); if (x === 0 || x === 15) c = [128, 88, 128]; else if (x % 5 === 0) c = [150, 108, 150]; P.set(x, y, c); } });
  newTile('purpur_pillar_top', (P) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)); P.set(x, y, vary(Math.floor(d) % 3 === 0 ? [140, 100, 140] : [176, 130, 176], 0.06, P.rnd)); } });
  newTile('end_rod', (P) => { P.clear(); for (let y = 1; y < 16; y++) { P.set(7, y, [250, 246, 236]); P.set(8, y, [236, 226, 210]); } for (let x = 6; x < 10; x++) { P.set(x, 14, [180, 160, 200]); P.set(x, 15, [150, 120, 170]); } });
  newTile('chorus_plant', (P) => { P.noise([96, 60, 96], 0.2); for (let k = 0; k < 10; k++) P.set(Math.floor(P.rnd() * 16), Math.floor(P.rnd() * 16), [170, 130, 170]); });
  newTile('chorus_flower', (P) => { P.noise([150, 110, 160], 0.12); for (let i = 0; i < 16; i++) { P.set(i, 0, [200, 170, 210]); P.set(0, i, [200, 170, 210]); } for (let k = 0; k < 6; k++) P.set(4 + Math.floor(P.rnd() * 8), 4 + Math.floor(P.rnd() * 8), [230, 210, 240]); });
  newTile('dragon_egg', (P) => { P.noise([16, 10, 22], 0.4); for (let k = 0; k < 16; k++) P.set(Math.floor(P.rnd() * 16), Math.floor(P.rnd() * 16), [120, 40, 160]); });
  newTile('cracked_bricks', (P) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const off = Math.floor(y / 8) % 2 ? 4 : 0; let c = vary([118, 118, 118], 0.12, P.rnd); if (y % 8 === 7 || (x + off) % 8 === 7) c = [78, 78, 78]; P.set(x, y, c); } let x = 3, y = 1; for (let i = 0; i < 18; i++) { P.set(x, y, [50, 50, 50]); y++; x += P.rnd() < 0.5 ? 1 : 0; if (y > 15) break; } });
  newTile('mossy_bricks', (P) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const off = Math.floor(y / 8) % 2 ? 4 : 0; let c = vary([122, 122, 122], 0.1, P.rnd); if (y % 8 === 7 || (x + off) % 8 === 7) c = [80, 80, 80]; if (P.rnd() < 0.3 + (y > 10 ? 0.3 : 0)) c = vary([80, 110, 50], 0.2, P.rnd); P.set(x, y, c); } });
  newTile('iron_bars', (P) => { P.clear(); for (let y = 0; y < 16; y++) for (const x of [1, 6, 11]) { P.set(x, y, [150, 154, 160]); P.set(x + 1, y, [100, 104, 110]); } for (const y of [1, 8, 14]) for (let x = 0; x < 16; x++) P.set(x, y, [130, 134, 140]); });
  newTile('slime', (P) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const edge = x === 0 || y === 0 || x === 15 || y === 15; const inner = x >= 3 && x <= 12 && y >= 3 && y <= 12 && (x === 3 || x === 12 || y === 3 || y === 12); P.set(x, y, vary(edge || inner ? [92, 168, 70] : [124, 200, 104], 0.08, P.rnd), 210); } });
  newTile('ladder', (P) => { P.clear(); for (let y = 0; y < 16; y++) for (const x of [2, 3, 12, 13]) P.set(x, y, vary([140, 104, 60], 0.12, P.rnd)); for (const y of [2, 6, 10, 14]) for (let x = 4; x < 12; x++) { P.set(x, y, vary([164, 124, 74], 0.1, P.rnd)); P.set(x, y + 1, [100, 72, 40]); } });
  newTile('cobweb', (P) => { P.clear(); const c = [230, 230, 236]; for (let i = 0; i < 16; i++) { P.set(i, i, c, 200); P.set(15 - i, i, c, 200); P.set(7, i, c, 170); P.set(i, 7, c, 170); } for (const r of [3, 6]) for (let a = 0; a < 40; a++) { const t = a / 40 * Math.PI * 2; P.set(Math.round(7.5 + Math.cos(t) * r), Math.round(7.5 + Math.sin(t) * r), c, 160); } });
  newTile('packed_ice', (P) => { P.noise([142, 178, 232], 0.08); for (let k = 0; k < 10; k++) P.set(Math.floor(P.rnd() * 16), Math.floor(P.rnd() * 16), [190, 214, 250]); });
  newTile('campfire_top', (P) => { P.noise([60, 44, 28], 0.2); for (let k = 0; k < 40; k++) { const x = 4 + Math.floor(P.rnd() * 8), y = 4 + Math.floor(P.rnd() * 8); P.set(x, y, P.rnd() < 0.5 ? [255, 180, 40] : [255, 110, 20]); } });
  newTile('campfire_side', (P) => { P.clear(); for (let y = 9; y < 16; y++) for (let x = 0; x < 16; x++) P.set(x, y, vary(y > 12 ? [96, 70, 40] : [76, 56, 32], 0.15, P.rnd)); for (let k = 0; k < 30; k++) { const x = 3 + Math.floor(P.rnd() * 10), y = 2 + Math.floor(P.rnd() * 8); P.set(x, y, P.rnd() < 0.5 ? [255, 200, 60] : [255, 120, 20]); } });
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
  if (b.shape === 'post') { const tc = tileCanvas(nameOfTile(t.side)); for (const x0 of [8, 30]) g.drawImage(tc, 6, 0, 4, 16, x0, 4, 10, 42); for (const y0 of [12, 26]) g.drawImage(tc, 0, 6, 16, 3, 4, y0, 40, 6); return c.toDataURL(); }
  if (b.shape === 'cross' || b.shape === 'torch' || b.shape === 'ladder') { g.drawImage(tileCanvas(nameOfTile(t.side)), 0, 0, S, S); return c.toDataURL(); }
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
      else if (shape === 'book') inside = x > 2 && x < 12 && y > 1 && y < 13;
      else if (shape === 'paper') inside = x > 2 && x < 12 && y > 1 && y < 12 && !(x > 9 && y < 4);
      else if (shape === 'nugget') inside = (dx * dx + dy * dy) < 9 + r() * 3;
      else if (shape === 'loaf') inside = (dx * dx) / 42 + (dy * dy) / 10 < 1;
      s += inside ? (r() < 0.3 ? 'b' : 'a') : '.';
    }
    rows.push(s);
  }
  drawMap(g, rows, { a: colA, b: colB });
}
function itemIcon(id) {
  const c = document.createElement('canvas'); c.width = c.height = 18; const g = c.getContext('2d');
  if (id === I.HOE) { drawMap(g, ['................', '.....hhhhh......', '.....hh..s......', '.........s......', '........s.......', '.......s........', '......s.........', '.....s..........', '....s...........', '...s............'], { h: '#8a8a8a', s: '#6b4a24' }); return c.toDataURL(); }
  const R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  if (id === I.SMARTPHONE) { R(5, 1, 8, 16, '#111'); R(6, 3, 6, 11, '#3a8ae8'); R(6, 3, 6, 3, '#7ac8ff'); R(7, 8, 2, 2, '#ff5a7a'); R(10, 8, 1, 2, '#5aff8a'); R(8, 15, 2, 1, '#666'); return c.toDataURL(); }
  if (id === I.CAR) { R(2, 8, 14, 5, '#d8202a'); R(5, 4, 8, 5, '#d8202a'); R(6, 5, 3, 3, '#9ad0ff'); R(10, 5, 2, 3, '#9ad0ff'); R(3, 12, 4, 4, '#111'); R(11, 12, 4, 4, '#111'); R(4, 13, 2, 2, '#888'); R(12, 13, 2, 2, '#888'); R(15, 9, 1, 2, '#ffe080'); return c.toDataURL(); }
  if (id === I.CIRCUIT) { R(2, 3, 14, 12, '#1a7a3a'); R(4, 5, 4, 4, '#222'); R(10, 9, 4, 4, '#222'); for (let k = 0; k < 6; k++) R(3 + k * 2, 14, 1, 2, '#e8c040'); R(8, 7, 6, 1, '#e8c040'); R(5, 10, 1, 4, '#e8c040'); return c.toDataURL(); }
  if (id === I.BATTERY) { R(5, 3, 8, 13, '#2a2a2a'); R(7, 1, 4, 2, '#aaa'); R(5, 3, 8, 4, '#e8c040'); R(8, 9, 2, 5, '#fff'); R(7, 11, 4, 1, '#fff'); return c.toDataURL(); }
  if (id === I.DRONE) { R(6, 7, 6, 4, '#ddd'); R(8, 11, 2, 2, '#222'); R(1, 6, 6, 1, '#555'); R(11, 6, 6, 1, '#555'); R(3, 7, 2, 2, '#888'); R(13, 7, 2, 2, '#888'); R(8, 8, 2, 1, '#3a8ae8'); return c.toDataURL(); }
  if (id === I.EYE_OF_ENDER) { g.fillStyle = '#1d6a50'; g.beginPath(); g.arc(9, 9, 6.5, 0, 7); g.fill(); g.fillStyle = '#7ae0a8'; g.beginPath(); g.arc(9, 9, 4.5, 0, 7); g.fill(); g.fillStyle = '#0a1a14'; R(8, 5, 2, 8); return c.toDataURL(); }
  if (id === I.ENDER_PEARL) { g.fillStyle = '#0e3a34'; g.beginPath(); g.arc(9, 9, 6.5, 0, 7); g.fill(); g.fillStyle = '#2a8a78'; g.beginPath(); g.arc(9, 9, 4.5, 0, 7); g.fill(); R(6, 6, 2, 2, '#9af0e0'); return c.toDataURL(); }
  if (id === I.ELYTRA) { g.fillStyle = '#8a8aa8'; g.beginPath(); g.moveTo(8, 2); g.lineTo(2, 6); g.lineTo(3, 16); g.lineTo(8, 10); g.fill(); g.beginPath(); g.moveTo(10, 2); g.lineTo(16, 6); g.lineTo(15, 16); g.lineTo(10, 10); g.fill(); R(4, 7, 3, 1, '#c8c8e0'); R(11, 7, 3, 1, '#c8c8e0'); R(4, 11, 2, 1, '#5a5a78'); R(12, 11, 2, 1, '#5a5a78'); return c.toDataURL(); }
  if (id === I.FIREWORK) { R(7, 6, 4, 10, '#d02a2a'); R(7, 8, 4, 2, '#f0e0c0'); R(8, 2, 2, 4, '#e8e0d0'); R(8, 16, 2, 2, '#6b4a24'); R(5, 1, 1, 1, '#ffe040'); R(12, 2, 1, 1, '#40c8ff'); return c.toDataURL(); }
  if (id === I.BOW) { drawMap(g, ['..........sss...', '.........s..f...', '........s...f...', '.......s....f...', '......s.....f...', '.....s......f...', '....s.......f...', '...s........f...', '..s........f....', '.s........f.....', '.s.......f......', '.s......f.......', '.s.....f........', '..sssff.........'], { s: '#7a5228', f: '#dddddd' }); return c.toDataURL(); }
  if (id === I.EGG) { g.fillStyle = '#e8dcc0'; g.beginPath(); g.ellipse(9, 10, 5, 6.5, 0, 0, 7); g.fill(); R(6, 7, 2, 2, '#fff8e8'); return c.toDataURL(); }
  if (id === I.FEATHER) { drawMap(g, ['...........ww...', '..........www...', '.........wwww...', '........wwwws...', '.......wwwws....', '......wwwws.....', '.....wwwws......', '....wwwws.......', '....wwws........', '.....ws.........', '....s...........', '...s............'], { w: '#f4f4f4', s: '#bbb' }); return c.toDataURL(); }
  if (id === I.COMPASS) { g.fillStyle = '#7a7a7a'; g.beginPath(); g.arc(9, 9, 7, 0, 7); g.fill(); g.fillStyle = '#d8d8d0'; g.beginPath(); g.arc(9, 9, 5.5, 0, 7); g.fill(); R(8, 4, 2, 5, '#d02020'); R(8, 9, 2, 5, '#606060'); return c.toDataURL(); }
  if (id === I.CLOCK) { g.fillStyle = '#c09020'; g.beginPath(); g.arc(9, 9, 7, 0, 7); g.fill(); g.fillStyle = '#5aa0e0'; g.beginPath(); g.arc(9, 9, 5.5, 0, Math.PI, true); g.fill(); g.fillStyle = '#1a2a50'; g.beginPath(); g.arc(9, 9, 5.5, 0, Math.PI); g.fill(); R(8, 4, 2, 5, '#f8f0c0'); return c.toDataURL(); }
  if (id === I.BOAT) { R(1, 8, 16, 3, '#9c7a48'); R(2, 11, 14, 3, '#7a5a30'); R(4, 14, 10, 1, '#5e4524'); R(1, 7, 2, 1, '#6b4a24'); R(15, 7, 2, 1, '#6b4a24'); R(6, 4, 1, 6, '#6b4a24'); R(11, 4, 1, 6, '#6b4a24'); return c.toDataURL(); }
  if (id === I.SHEARS) { R(4, 3, 2, 8, '#d8d8d8'); R(12, 3, 2, 8, '#d8d8d8'); R(6, 9, 6, 2, '#aaa'); g.fillStyle = '#c03030'; g.beginPath(); g.arc(5, 14, 2.5, 0, 7); g.arc(13, 14, 2.5, 0, 7); g.fill(); return c.toDataURL(); }
  if (id === I.FISHING_ROD) { for (let k = 0; k < 13; k++) R(3 + k, 15 - k, 2, 1, '#8a6232'); R(15, 2, 1, 12, '#e8e8e8'); R(14, 13, 3, 2, '#c03030'); return c.toDataURL(); }
  if (id === I.RAW_COD || id === I.COOKED_COD) { const a = id === I.RAW_COD ? '#b0a080' : '#a06a3a', b2 = id === I.RAW_COD ? '#d8c8a8' : '#c8904a'; g.fillStyle = a; g.beginPath(); g.ellipse(8, 9, 6, 3.5, 0, 0, 7); g.fill(); R(13, 6, 4, 6, a); R(4, 8, 6, 2, b2); R(4, 7, 1, 1, '#111'); return c.toDataURL(); }
  if (id === I.SLIME_BALL) { g.fillStyle = '#5aa848'; g.beginPath(); g.arc(9, 9, 6, 0, 7); g.fill(); g.fillStyle = '#8ad870'; g.beginPath(); g.arc(7, 7, 2.5, 0, 7); g.fill(); return c.toDataURL(); }
  if (id === I.MILK_BUCKET) { R(4, 5, 10, 10, '#c8c8c8'); R(5, 6, 8, 3, '#fafafa'); R(3, 4, 12, 2, '#9a9a9a'); return c.toDataURL(); }
  if (id === I.SHIELD) { R(4, 2, 10, 10, '#9c7a48'); R(5, 12, 8, 2, '#9c7a48'); R(7, 14, 4, 2, '#9c7a48'); R(8, 2, 2, 14, '#aaa'); R(4, 6, 10, 2, '#aaa'); return c.toDataURL(); }
  if (id === I.TRIDENT) { for (let k = 0; k < 12; k++) R(3 + k, 15 - k, 1, 1, '#3a8a8a'); R(12, 1, 1, 5, '#6ad0c8'); R(15, 3, 1, 5, '#6ad0c8'); R(14, 1, 2, 2, '#6ad0c8'); R(11, 5, 4, 2, '#3a8a8a'); return c.toDataURL(); }
  if (isArmor(id)) {
    const a = armorInfo(id); const M2 = [
      ['................', '...hhhhhhhhhh...', '..hhhhhhhhhhhh..', '..hh........hh..', '..hh........hh..', '..hh........hh..'],
      ['..hhh....hhh....', '.hhhhhhhhhhhh...', '.hhhhhhhhhhhh...', '..hhhhhhhhhh....', '...hhhhhhhh.....', '...hhhhhhhh.....', '...hhhhhhhh.....', '...hhhhhhhh.....', '...hhhhhhhh.....', '...hhhhhhhh.....'],
      ['...hhhhhhhhh....', '...hhhhhhhhh....', '...hhhh.hhhh....', '...hhh...hhh....', '...hhh...hhh....', '...hhh...hhh....', '...hhh...hhh....', '...hhh...hhh....', '...hhh...hhh....'],
      ['................', '................', '................', '..hhh.....hhh...', '..hhh.....hhh...', '..hhh.....hhh...', '.hhhh....hhhh...', '.hhhh....hhhh...'],
    ][a.piece];
    drawMap(g, M2.map((r, y) => (y % 4 === 2 ? r.replace(/h/g, 'd') : r.replace(/^(\.*)h/, '$1d'))), { h: a.color, d: a.dark }); return c.toDataURL();
  }
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
      [I.LAPIS]: ['#2a50c8', '#4a78ff', 'gem'], [I.BOOK]: ['#8a3a2a', '#e8e0c8', 'book'], [I.PAPER]: ['#f0ece0', '#d8d2c0', 'paper'],
      [I.LEATHER]: ['#a0602a', '#7a4418', 'paper'], [I.QUARTZ]: ['#f0ece6', '#c8c0b8', 'shard'], [I.GOLD_NUGGET]: ['#f8d848', '#c09020', 'nugget'],
      [I.BLAZE_ROD]: ['#f8c830', '#ff8a10', 'stick'], [I.BLAZE_POWDER]: ['#ffb020', '#ff7010', 'pile'], [I.GHAST_TEAR]: ['#e8f4f8', '#a8d0e0', 'gem'],
      [I.MAGMA_CREAM]: ['#e8701a', '#f8d040', 'round'], [I.NETHER_BRICK]: ['#5a2a30', '#3a1418', 'ingot'],
      [I.RAW_CHICKEN]: ['#f0c8b0', '#e0a890', 'meat'], [I.COOKED_CHICKEN]: ['#c8843a', '#9a5a20', 'meat'], [I.CHORUS_FRUIT]: ['#8a5a9a', '#c8a0d8', 'round'],
      [I.STRING]: ['#f0f0f0', '#cfcfcf', 'stick'],
      [I.SEEDS]: ['#5aa02a', '#3a7a1a', 'pile'], [I.WHEAT]: ['#d8b848', '#a88a28', 'stick'], [I.EMERALD]: ['#3ade6a', '#18a040', 'gem'],
    }[id] || ['#f0f', '#000', 'round'];
    blob(g, M[0], M[1], id * 13, M[2]);
    if (id === I.WATER_BUCKET || id === I.LAVA_BUCKET || id === I.BUCKET) { g.fillStyle = id === I.WATER_BUCKET ? '#3a6ae8' : id === I.LAVA_BUCKET ? '#ff7a10' : '#555'; g.fillRect(3, 5, 12, 2); }
    if (id === I.BOOK) { g.fillStyle = '#f0e8d0'; g.fillRect(11, 3, 2, 10); g.fillStyle = '#d8b040'; g.fillRect(6, 5, 3, 1); }
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
