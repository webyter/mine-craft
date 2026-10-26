// World: generation, storage, lighting, meshing
import * as THREE from 'three';
import { Noise, hash3 } from './noise.js';
import { B, BLOCKS } from './blocks.js';
import { tileIndex } from './textures.js';

export const CS = 16, H = 80, SEA = 28;
const M = 8, R = CS + M * 2, RH = H + 2, RR = R * R;

// property tables
export const OPAQUE = new Uint8Array(256), FILTER = new Uint8Array(256), EMIT = new Uint8Array(256),
  SOLID = new Uint8Array(256), LIQUID = new Uint8Array(256), CUTOUT = new Uint8Array(256), CULLSAME = new Uint8Array(256), SHAPE = new Uint8Array(256);
const SHAPES = { cube: 0, cross: 1, torch: 2, cactus: 3, slab: 4 };
export function initTables() {
  for (const b of BLOCKS) {
    if (!b) continue;
    OPAQUE[b.id] = b.opaque ? 1 : 0; FILTER[b.id] = b.opaque ? 15 : b.filter; EMIT[b.id] = b.light;
    SOLID[b.id] = b.solid ? 1 : 0; LIQUID[b.id] = b.liquid ? 1 : 0; CUTOUT[b.id] = b.cutout ? 1 : 0;
    CULLSAME[b.id] = b.cullSame ? 1 : 0; SHAPE[b.id] = SHAPES[b.shape];
  }
}

const ckey = (cx, cz) => (cx + 32768) * 65536 + (cz + 32768);
const lidx = (x, y, z) => (y * CS + z) * CS + x;

// face table
const FACES = [
  { n: [1, 0, 0], c: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], shade: 0.62 },
  { n: [-1, 0, 0], c: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]], shade: 0.62 },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], shade: 1.0 },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], shade: 0.5 },
  { n: [0, 0, 1], c: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]], shade: 0.8 },
  { n: [0, 0, -1], c: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]], shade: 0.8 },
];
const ROFF = (dx, dy, dz) => dx + dz * R + dy * RR;
for (const f of FACES) {
  // ensure CCW winding from outside
  const [a, b, c] = f.c; const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const cr = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  if (cr[0] * f.n[0] + cr[1] * f.n[1] + cr[2] * f.n[2] < 0) f.c.reverse();
  const axis = f.n[0] ? 0 : f.n[1] ? 1 : 2; const ax = [0, 1, 2].filter((k) => k !== axis);
  f.nOff = ROFF(f.n[0], f.n[1], f.n[2]);
  f.ao = f.c.map((cc) => {
    const s1 = [0, 0, 0], s2 = [0, 0, 0]; s1[ax[0]] = cc[ax[0]] ? 1 : -1; s2[ax[1]] = cc[ax[1]] ? 1 : -1;
    return [ROFF(s1[0], s1[1], s1[2]), ROFF(s2[0], s2[1], s2[2]), ROFF(s1[0] + s2[0], s1[1] + s2[1], s1[2] + s2[2])];
  });
  // uv
  const up = [0, 1, 0]; const n = f.n;
  const r = n[1] ? [1, 0, 0] : [up[1] * n[2] - up[2] * n[1], up[2] * n[0] - up[0] * n[2], up[0] * n[1] - up[1] * n[0]];
  f.uv = f.c.map((cc) => {
    let uu = r[0] > 0 ? cc[0] : r[0] < 0 ? 1 - cc[0] : r[2] > 0 ? cc[2] : 1 - cc[2];
    let vv = n[1] ? (n[1] > 0 ? 1 - cc[2] : cc[2]) : cc[1];
    return [uu, vv];
  });
  f.side = n[1] > 0 ? 'top' : n[1] < 0 ? 'bottom' : 'side';
}
// facing meta -> which face index is "front": 0:+z,1:+x,2:-z,3:-x
const FRONT_FACE = [4, 0, 5, 1];
const AOC = [0.42, 0.62, 0.8, 1.0];

class MeshBuf {
  constructor() { this.pos = []; this.uv = []; this.light = []; this.idx = []; this.n = 0; }
  quad(p, uv, l, flip) {
    const n = this.n;
    for (let i = 0; i < 4; i++) { this.pos.push(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]); this.uv.push(uv[i * 2], uv[i * 2 + 1]); this.light.push(l[i * 3], l[i * 3 + 1], l[i * 3 + 2]); }
    if (flip) this.idx.push(n + 1, n + 2, n + 3, n + 1, n + 3, n); else this.idx.push(n, n + 1, n + 2, n, n + 2, n + 3);
    this.n += 4;
  }
  geometry() {
    if (!this.n) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('light', new THREE.Float32BufferAttribute(this.light, 3));
    g.setIndex(this.n > 65000 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    return g;
  }
}
const EPS = 0.002;
function tileUV(t, lu, lv) {
  const col = t % 16, row = Math.floor(t / 16);
  lu = EPS + lu * (1 - 2 * EPS); lv = EPS + lv * (1 - 2 * EPS);
  return [(col + lu) / 16, 1 - (row + 1 - lv) / 16];
}

export class World {
  constructor(seed, type = 'infinite') {
    this.seed = seed; this.type = type;
    this.noise = new Noise(seed); this.noise2 = new Noise(seed + 101);
    this.chunks = new Map();
    this.tiles = new Map(); // tile entity data
    this.rIds = new Uint8Array(RR * RH); this.rSky = new Uint8Array(RR * RH); this.rBlk = new Uint8Array(RR * RH);
    this.queue = new Int32Array(RR * RH * 2);
  }
  // ---------- terrain ----------
  column(x, z) {
    if (this.type === 'flat') return { h: 4, biome: 0 };
    const n = this.noise;
    const cont = n.fbm2(x / 700, z / 700, 3);
    const hills = n.fbm2(x / 140, z / 140, 4);
    const detail = n.n2(x / 28, z / 28);
    const mnt = Math.max(0, n.fbm2(x / 380 + 50, z / 380 + 50, 3) + 0.05);
    const ridge = 1 - Math.abs(n.n2(x / 110 + 9, z / 110 + 9));
    const temp = n.fbm2(x / 620 + 300, z / 620 - 300, 2), moist = this.noise2.fbm2(x / 520 - 700, z / 520 + 200, 2);
    const desertish = temp > 0.22 && moist < 0.05;
    let h = SEA + 4 + cont * 22 + hills * (desertish ? 3 : 7) + detail * 1.2 + mnt * mnt * ridge * 120;
    h = Math.max(4, Math.min(H - 10, Math.floor(h)));
    let biome;
    if (h < SEA - 1) biome = 5;
    else if (h <= SEA + 1 && temp > -0.25) biome = 6;
    else if (h > 50 && mnt * ridge > 0.22) biome = 4;
    else if (desertish) biome = 2;
    else if (temp < -0.22) biome = 3;
    else if (moist > 0.08) biome = 1;
    else biome = 0;
    return { h, biome };
  }
  generate(cx, cz) {
    const chunk = { cx, cz, blocks: new Uint8Array(CS * CS * H), meta: new Uint8Array(CS * CS * H), mesh: null, water: null, dirty: true, built: false };
    this.chunks.set(ckey(cx, cz), chunk);
    const bl = chunk.blocks, seed = this.seed, n = this.noise;
    const bx = cx * CS, bz = cz * CS;
    const heights = new Int16Array(CS * CS), biomes = new Uint8Array(CS * CS);
    for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
      const wx = bx + x, wz = bz + z;
      const { h, biome } = this.column(wx, wz);
      heights[z * CS + x] = h; biomes[z * CS + x] = biome;
      if (this.type === 'flat') {
        bl[lidx(x, 0, z)] = B.BEDROCK; for (let y = 1; y < 4; y++) bl[lidx(x, y, z)] = B.DIRT; bl[lidx(x, 4, z)] = B.GRASS; continue;
      }
      for (let y = 0; y <= Math.max(h, SEA); y++) {
        let id = 0;
        if (y === 0 || (y < 4 && hash3(wx, y, wz, seed) < 0.5 - y * 0.12)) id = B.BEDROCK;
        else if (y <= h) {
          const d = h - y;
          if (biome === 2) id = d < 4 ? B.SAND : d < 7 ? B.SANDSTONE : B.STONE;
          else if (biome === 6) id = d < 3 ? B.SAND : d < 5 ? B.SANDSTONE : B.STONE;
          else if (biome === 5) id = d < 3 ? (hash3(wx >> 2, 0, wz >> 2, seed + 9) < 0.3 ? B.GRAVEL : hash3(wx >> 2, 1, wz >> 2, seed) < 0.15 ? B.CLAY : B.SAND) : B.STONE;
          else if (biome === 4) id = h > 60 ? (d === 0 && h > 63 ? B.SNOW_BLOCK : B.STONE) : d === 0 ? B.GRASS : d < 3 ? B.DIRT : B.STONE;
          else if (biome === 3) id = d === 0 ? B.SNOW_GRASS : d < 4 ? B.DIRT : B.STONE;
          else id = d === 0 ? B.GRASS : d < 4 ? B.DIRT : B.STONE;
          if (id === B.STONE) {
            if (hash3(wx, y, wz, seed + 5) < 0.6) {
              const r = hash3(wx >> 1, y >> 1, wz >> 1, seed + 77);
              if (r < 0.012 && y < 70) id = B.COAL_ORE;
              else if (r < 0.019 && y < 54) id = B.IRON_ORE;
              else if (r < 0.0215 && y < 30) id = B.GOLD_ORE;
              else if (r < 0.027 && y < 16) id = B.REDSTONE_ORE;
              else if (r < 0.0293 && y < 14) id = B.DIAMOND_ORE;
            }
          }
        } else if (y <= SEA) id = (biome === 3 && y === SEA) ? B.ICE : B.WATER;
        bl[lidx(x, y, z)] = id;
      }
      // caves
      const top = h - (h <= SEA + 1 ? 5 : 0);
      for (let y = 1; y <= top; y++) {
        const i = lidx(x, y, z); const id = bl[i];
        if (id === B.BEDROCK || id === B.WATER) continue;
        const a = n.n3(wx / 46, y / 26, wz / 46), b = n.n3(wx / 46 + 311, y / 26, wz / 46 + 97);
        let carve = a * a + b * b < 0.0045;
        if (!carve && y < h - 9) carve = n.n3(wx / 72, y / 36, wz / 72) > 0.6;
        if (carve) bl[i] = y <= 7 ? B.LAVA : 0;
      }
    }
    if (this.type === 'flat') return chunk;
    // features
    const setL = (x, y, z, id, force) => {
      x -= bx; z -= bz; if (x < 0 || z < 0 || x >= CS || z >= CS || y < 0 || y >= H) return;
      const i = lidx(x, y, z); const cur = bl[i];
      if (force ? cur !== B.BEDROCK : (cur === 0 || cur === B.TALL_GRASS)) bl[i] = id;
    };
    for (let z = -3; z < CS + 3; z++) for (let x = -3; x < CS + 3; x++) {
      const wx = bx + x, wz = bz + z;
      const inside = x >= 0 && z >= 0 && x < CS && z < CS;
      const { h, biome } = inside ? { h: heights[z * CS + x], biome: biomes[z * CS + x] } : this.column(wx, wz);
      if (h <= SEA || h > H - 12) continue;
      const r = hash3(wx, 7, wz, seed);
      const dens = [0.006, 0.05, 0, 0.022, 0.006, 0, 0][biome];
      if (r < dens) {
        if (inside) { const g = bl[lidx(x, h, z)]; if (g !== B.GRASS && g !== B.SNOW_GRASS && g !== B.DIRT) continue; }
        const r2 = hash3(wx, 8, wz, seed);
        if (biome === 3) this.spruce(setL, wx, h + 1, wz, r2);
        else if (biome === 1 && r2 < 0.32) this.oak(setL, wx, h + 1, wz, r2, B.BIRCH_LOG, B.BIRCH_LEAVES, 1);
        else this.oak(setL, wx, h + 1, wz, r2, B.OAK_LOG, B.OAK_LEAVES, 0);
        continue;
      }
      if (!inside) continue;
      const g = bl[lidx(x, h, z)], above = bl[lidx(x, h + 1, z)];
      if (above !== 0) continue;
      const r3 = hash3(wx, 9, wz, seed);
      if (g === B.GRASS) {
        if (r3 < (biome === 0 ? 0.12 : 0.06)) bl[lidx(x, h + 1, z)] = B.TALL_GRASS;
        else if (r3 < (biome === 0 ? 0.135 : 0.07)) bl[lidx(x, h + 1, z)] = hash3(wx, 10, wz, seed) < 0.5 ? B.DANDELION : B.POPPY;
        else if (r3 > 0.9988) bl[lidx(x, h + 1, z)] = B.PUMPKIN;
      } else if (g === B.SAND && biome === 2) {
        if (r3 < 0.006) { const ch = 1 + Math.floor(hash3(wx, 11, wz, seed) * 3); for (let k = 1; k <= ch; k++) bl[lidx(x, h + k, z)] = B.CACTUS; }
        else if (r3 < 0.011) bl[lidx(x, h + 1, z)] = B.DEAD_BUSH;
      }
    }
    return chunk;
  }
  oak(set, x, y, z, r, logId, leafId, tall) {
    const th = 4 + Math.floor(r * 3) + tall;
    for (let ly = th - 3; ly <= th; ly++) {
      const rad = ly >= th - 1 ? 1 : 2;
      for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
        if (Math.abs(dx) === rad && Math.abs(dz) === rad && (ly === th || hash3(x + dx, y + ly, z + dz, this.seed) < 0.5)) continue;
        set(x + dx, y + ly, z + dz, leafId);
      }
    }
    set(x, y + th + 1, z, leafId); set(x + 1, y + th + 1, z, leafId); set(x - 1, y + th + 1, z, leafId); set(x, y + th + 1, z + 1, leafId); set(x, y + th + 1, z - 1, leafId);
    for (let i = 0; i <= th; i++) set(x, y + i, z, logId, true);
    set(x, y - 1, z, B.DIRT, true);
  }
  spruce(set, x, y, z, r) {
    const th = 6 + Math.floor(r * 3);
    for (let ly = 2; ly <= th + 1; ly++) {
      const rad = ly > th - 1 ? (ly > th ? 0 : 1) : ((th - ly) % 2 === 0 ? 1 : 2);
      for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
        if (rad === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
        set(x + dx, y + ly, z + dz, B.SPRUCE_LEAVES);
      }
    }
    for (let i = 0; i < th; i++) set(x, y + i, z, B.SPRUCE_LOG, true);
  }
  // ---------- access ----------
  getChunk(cx, cz) { return this.chunks.get(ckey(cx, cz)); }
  ensureChunk(cx, cz) { return this.chunks.get(ckey(cx, cz)) || this.generate(cx, cz); }
  getBlock(x, y, z) {
    if (y < 0) return B.BEDROCK; if (y >= H) return 0;
    const c = this.chunks.get(ckey(x >> 4, z >> 4)); if (!c) return 0;
    return c.blocks[lidx(x & 15, y, z & 15)];
  }
  getMeta(x, y, z) {
    if (y < 0 || y >= H) return 0;
    const c = this.chunks.get(ckey(x >> 4, z >> 4)); if (!c) return 0;
    return c.meta[lidx(x & 15, y, z & 15)];
  }
  isLoaded(x, z) { const c = this.chunks.get(ckey(x >> 4, z >> 4)); return !!(c && c.built); }
  setBlock(x, y, z, id, meta = 0) {
    if (y < 0 || y >= H) return false;
    const cx = x >> 4, cz = z >> 4; const c = this.ensureChunk(cx, cz);
    const lx = x & 15, lz = z & 15; const i = lidx(lx, y, lz);
    c.blocks[i] = id; c.meta[i] = meta; c.dirty = true; c.urgent = true; c.edited = true;
    const near = 8;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      if (!dx && !dz) continue;
      if ((dx === -1 && lx >= near) || (dx === 1 && lx < CS - near) || (dz === -1 && lz >= near) || (dz === 1 && lz < CS - near)) continue;
      const nc = this.getChunk(cx + dx, cz + dz); if (nc) { nc.dirty = true; nc.urgent = true; }
    }
    return true;
  }
  // light level at a world point (0..15 sky, block) — approximate using region-free sampling
  lightAt(x, y, z) {
    // cheap: sky exposure by column scan + nearby emitters ignored
    let sky = 15;
    for (let yy = H - 1; yy > y; yy--) { const id = this.getBlock(x, yy, z); if (OPAQUE[id]) { sky = 4; break; } }
    return sky;
  }
  topSolid(x, z) { for (let y = H - 1; y > 0; y--) { const id = this.getBlock(x, y, z); if (SOLID[id] || LIQUID[id]) return y; } return 0; }
  // ---------- raycast ----------
  raycast(ox, oy, oz, dx, dy, dz, maxDist, hitFn) {
    let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
    const sx = Math.sign(dx), sy = Math.sign(dy), sz = Math.sign(dz);
    const tdx = Math.abs(1 / dx), tdy = Math.abs(1 / dy), tdz = Math.abs(1 / dz);
    let tx = dx ? (sx > 0 ? x + 1 - ox : ox - x) * tdx : Infinity;
    let ty = dy ? (sy > 0 ? y + 1 - oy : oy - y) * tdy : Infinity;
    let tz = dz ? (sz > 0 ? z + 1 - oz : oz - z) * tdz : Infinity;
    let nx = 0, ny = 0, nz = 0, t = 0;
    while (t <= maxDist) {
      const id = this.getBlock(x, y, z);
      if (hitFn(id, x, y, z)) return { x, y, z, nx, ny, nz, id, t };
      if (tx < ty && tx < tz) { x += sx; t = tx; tx += tdx; nx = -sx; ny = 0; nz = 0; }
      else if (ty < tz) { y += sy; t = ty; ty += tdy; nx = 0; ny = -sy; nz = 0; }
      else { z += sz; t = tz; tz += tdz; nx = 0; ny = 0; nz = -sz; }
    }
    return null;
  }
  // ---------- meshing ----------
  buildChunk(chunk) {
    const { cx, cz } = chunk;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) this.ensureChunk(cx + dx, cz + dz);
    const ids = this.rIds, sky = this.rSky, blk = this.rBlk, Q = this.queue;
    ids.fill(0); sky.fill(0); blk.fill(0);
    // copy region (y offset +1)
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const c = this.getChunk(cx + dx, cz + dz); const src = c.blocks;
      for (let z = 0; z < CS; z++) {
        const rz = dz * CS + z + M; if (rz < 0 || rz >= R) continue;
        for (let x = 0; x < CS; x++) {
          const rx = dx * CS + x + M; if (rx < 0 || rx >= R) continue;
          let si = z * CS + x, ri = RR + rz * R + rx;
          for (let y = 0; y < H; y++, si += CS * CS, ri += RR) ids[ri] = src[si];
        }
      }
    }
    for (let i = 0; i < RR; i++) ids[i] = B.BEDROCK; // bottom pad
    // sky light columns
    const hm = new Int16Array(RR);
    for (let c = 0; c < RR; c++) {
      let l = 15, top = -1;
      for (let y = RH - 1; y >= 0; y--) {
        const i = y * RR + c; const id = ids[i];
        if (OPAQUE[id]) l = 0; else if (FILTER[id]) l = Math.max(0, l - FILTER[id]);
        sky[i] = l; if (l < 15 && top < 0) top = y;
      }
      hm[c] = top;
    }
    let qh = 0, qt = 0; const QN = Q.length;
    for (let rz = 0; rz < R; rz++) for (let rx = 0; rx < R; rx++) {
      const c = rz * R + rx;
      let mx = hm[c];
      if (rx > 0) mx = Math.max(mx, hm[c - 1]); if (rx < R - 1) mx = Math.max(mx, hm[c + 1]);
      if (rz > 0) mx = Math.max(mx, hm[c - R]); if (rz < R - 1) mx = Math.max(mx, hm[c + R]);
      for (let y = Math.min(mx + 1, RH - 1); y >= 1; y--) { const i = y * RR + c; if (sky[i] > 1) { Q[qt] = i; qt = (qt + 1) % QN; } }
    }
    const prop = (arr) => {
      while (qh !== qt) {
        const i = Q[qh]; qh = (qh + 1) % QN;
        const l = arr[i]; if (l <= 1) continue;
        const x = i % R, z = ((i / R) | 0) % R, y = (i / RR) | 0;
        for (let k = 0; k < 6; k++) {
          let j;
          if (k === 0) { if (x === R - 1) continue; j = i + 1; }
          else if (k === 1) { if (x === 0) continue; j = i - 1; }
          else if (k === 2) { if (z === R - 1) continue; j = i + R; }
          else if (k === 3) { if (z === 0) continue; j = i - R; }
          else if (k === 4) { if (y === RH - 1) continue; j = i + RR; }
          else { if (y === 0) continue; j = i - RR; }
          const id = ids[j]; if (OPAQUE[id]) continue;
          const nl = l - Math.max(1, FILTER[id]);
          if (nl > arr[j]) { arr[j] = nl; Q[qt] = j; qt = (qt + 1) % QN; }
        }
      }
    };
    prop(sky);
    qh = qt = 0;
    for (let i = RR; i < RR * (RH - 1); i++) { const e = EMIT[ids[i]]; if (e) { blk[i] = e; Q[qt++] = i; } }
    prop(blk);

    // mesh
    const solid = new MeshBuf(), water = new MeshBuf();
    const pos = new Array(12), uvs = new Array(8), lt = new Array(12);
    const meta = chunk.meta;
    for (let y = 0; y < H; y++) for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
      const ri = (y + 1) * RR + (z + M) * R + (x + M);
      const id = ids[ri]; if (!id) continue;
      const b = BLOCKS[id]; const shape = SHAPE[id];
      if (shape === 1 || shape === 2) { // cross / torch
        const s = sky[ri] / 15, bk = blk[ri] / 15; const t = b.tiles.side;
        if (shape === 1) this.cross(solid, x, y, z, t, s, bk);
        else this.torch(solid, x, y, z, t, s, bk);
        continue;
      }
      const liquid = LIQUID[id];
      const buf = liquid ? water : solid;
      const aboveSame = ids[ri + RR] === id;
      const topH = liquid && !aboveSame ? Math.max(0.2, 0.875 - meta[lidx(x, y, z)] * 0.1) : shape === 4 ? 0.5625 : 1;
      const m = b.tiles.front !== b.tiles.side ? meta[lidx(x, y, z)] : -1;
      for (let f = 0; f < 6; f++) {
        const F = FACES[f];
        const nri = ri + F.nOff; const nid = ids[nri];
        if (OPAQUE[nid] && !(shape === 4 && f === 2) && !(shape === 3 && f !== 2 && f !== 3)) continue;
        if (nid === id && CULLSAME[id]) continue;
        if (liquid && (LIQUID[nid] || (f === 2 && false))) continue;
        if (!liquid && LIQUID[id] === 0 && nid === id && shape !== 0) continue;
        let tile = F.side === 'top' ? b.tiles.top : F.side === 'bottom' ? b.tiles.bottom : b.tiles.side;
        if (m >= 0 && F.side === 'side' && FRONT_FACE[m] === f) tile = b.tiles.front;
        let ao0 = 0, ao2 = 0, ao1 = 0, ao3 = 0;
        for (let v = 0; v < 4; v++) {
          const cc = F.c[v]; const ao = F.ao[v];
          let px = cc[0], py = cc[1], pz = cc[2];
          if (py === 1) py = topH;
          if (shape === 3 && F.n[1] === 0) { if (F.n[0]) px = px ? 15 / 16 : 1 / 16; if (F.n[2]) pz = pz ? 15 / 16 : 1 / 16; }
          pos[v * 3] = x + px; pos[v * 3 + 1] = y + py; pos[v * 3 + 2] = z + pz;
          let [lu, lv] = F.uv[v]; if (F.side === 'side' && topH < 1 && cc[1] === 1) lv = topH;
          const uv = tileUV(tile, lu, lv); uvs[v * 2] = uv[0]; uvs[v * 2 + 1] = uv[1];
          // light + ao
          const fi = nri; const s1 = fi + ao[0], s2 = fi + ao[1], cr = fi + ao[2];
          const o1 = OPAQUE[ids[s1]], o2 = OPAQUE[ids[s2]], o3 = OPAQUE[ids[cr]];
          let aov = (o1 && o2) ? 0 : 3 - o1 - o2 - o3;
          if (liquid || shape !== 0) aov = 3;
          let ss = sky[fi], bb = blk[fi], cnt = 1;
          if (OPAQUE[ids[fi]]) { ss = sky[ri]; bb = blk[ri]; }
          if (!o1) { ss += sky[s1]; bb += blk[s1]; cnt++; }
          if (!o2) { ss += sky[s2]; bb += blk[s2]; cnt++; }
          if (!o3 && !(o1 && o2)) { ss += sky[cr]; bb += blk[cr]; cnt++; }
          lt[v * 3] = ss / cnt / 15; lt[v * 3 + 1] = bb / cnt / 15; lt[v * 3 + 2] = F.shade * AOC[aov];
          if (v === 0) ao0 = aov; else if (v === 1) ao1 = aov; else if (v === 2) ao2 = aov; else ao3 = aov;
        }
        buf.quad(pos, uvs, lt, ao0 + ao2 < ao1 + ao3);
      }
    }
    chunk.dirty = false; chunk.urgent = false; chunk.built = true;
    return { solid: solid.geometry(), water: water.geometry() };
  }
  cross(buf, x, y, z, t, s, bk) {
    const quads = [[[0.15, 0, 0.15], [0.85, 0, 0.85], [0.85, 1, 0.85], [0.15, 1, 0.15]], [[0.85, 0, 0.15], [0.15, 0, 0.85], [0.15, 1, 0.85], [0.85, 1, 0.15]]];
    const l = [s, bk, 0.9, s, bk, 0.9, s, bk, 0.9, s, bk, 0.9];
    const uvl = [[0, 0], [1, 0], [1, 1], [0, 1]];
    for (const q of quads) {
      for (const rev of [false, true]) {
        const order = rev ? [3, 2, 1, 0] : [0, 1, 2, 3];
        const p = [], uv = [];
        for (const o of order) { p.push(x + q[o][0], y + q[o][1], z + q[o][2]); const u = tileUV(t, uvl[o][0], uvl[o][1]); uv.push(u[0], u[1]); }
        buf.quad(p, uv, l, false);
      }
    }
  }
  torch(buf, x, y, z, t, s, bk) {
    const a = 7 / 16, b = 9 / 16, top = 12 / 16;
    const l = (sh) => [s, bk, sh, s, bk, sh, s, bk, sh, s, bk, sh];
    const side = (p, sh) => {
      const uv = []; const lus = [[a, 0], [b, 0], [b, top], [a, top]];
      for (const [u, v] of lus) { const q = tileUV(t, u, v); uv.push(q[0], q[1]); }
      buf.quad(p, uv, l(sh), false);
    };
    side([x + a, y, z + b, x + b, y, z + b, x + b, y + top, z + b, x + a, y + top, z + b], 1);
    side([x + b, y, z + a, x + a, y, z + a, x + a, y + top, z + a, x + b, y + top, z + a], 1);
    side([x + b, y, z + b, x + b, y, z + a, x + b, y + top, z + a, x + b, y + top, z + b], 0.85);
    side([x + a, y, z + a, x + a, y, z + b, x + a, y + top, z + b, x + a, y + top, z + a], 0.85);
    const uv = []; for (const [u, v] of [[a, 10 / 16], [b, 10 / 16], [b, 12 / 16], [a, 12 / 16]]) { const q = tileUV(t, u, v); uv.push(q[0], q[1]); }
    buf.quad([x + a, y + top, z + b, x + b, y + top, z + b, x + b, y + top, z + a, x + a, y + top, z + a], uv, l(1), false);
  }
}
export { ckey };
