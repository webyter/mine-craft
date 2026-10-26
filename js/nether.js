// Nether dimension generator: netherrack caverns, lava sea, biomes, fortresses
import { hash3 } from './noise.js';
import { B } from './blocks.js';

const CS = 16, H = 80, LAVA_Y = 22;
const lidx = (x, y, z) => (y * CS + z) * CS + x;
export const NETHER_BIOMES = ['Nether Wastes', 'Crimson Forest', 'Soul Sand Valley'];

export function netherBiome(w, x, z) {
  const v = w.noise2.fbm2(x / 170 + 40, z / 170 - 40, 2);
  return v > 0.18 ? 1 : v < -0.2 ? 2 : 0;
}

// ---------- fortresses ----------
const FCELL = 144;
export function fortressPlan(w, gx, gz) {
  const key = gx + ',' + gz; w.fortCache = w.fortCache || new Map();
  if (w.fortCache.has(key)) return w.fortCache.get(key);
  let p = null;
  const r = (k) => hash3(gx, k, gz, w.seed + 4242);
  if (r(1) < 0.6 || (gx === 0 && gz === 0)) {
    const cx = gx * FCELL + 36 + Math.floor(r(2) * (FCELL - 72)), cz = gz * FCELL + 36 + Math.floor(r(3) * (FCELL - 72));
    const D = 40 + Math.floor(r(4) * 6);
    p = { x: cx, z: cz, y: D, arms: [22 + Math.floor(r(5) * 26), 22 + Math.floor(r(6) * 26), 22 + Math.floor(r(7) * 26), 22 + Math.floor(r(8) * 26)] };
  }
  w.fortCache.set(key, p); return p;
}
export function fortressNear(w, x, z, rings = 4) {
  const gx = Math.floor(x / FCELL), gz = Math.floor(z / FCELL); let best = null, bd = 1e9;
  for (let dx = -rings; dx <= rings; dx++) for (let dz = -rings; dz <= rings; dz++) {
    const p = fortressPlan(w, gx + dx, gz + dz); if (!p) continue;
    const d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; best = p; }
  }
  return best;
}
function fortressesFor(w, bx, bz) {
  const out = [];
  const gx0 = Math.floor((bx - 60) / FCELL), gx1 = Math.floor((bx + CS + 60) / FCELL);
  const gz0 = Math.floor((bz - 60) / FCELL), gz1 = Math.floor((bz + CS + 60) / FCELL);
  for (let gx = gx0; gx <= gx1; gx++) for (let gz = gz0; gz <= gz1; gz++) { const p = fortressPlan(w, gx, gz); if (p) out.push(p); }
  return out;
}

export function genNether(w, chunk) {
  const bl = chunk.blocks, n = w.noise, seed = w.seed;
  const bx = chunk.cx * CS, bz = chunk.cz * CS;
  const biomes = new Uint8Array(CS * CS);
  for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
    const wx = bx + x, wz = bz + z;
    const biome = netherBiome(w, wx, wz); biomes[z * CS + x] = biome;
    for (let y = 0; y < H; y++) {
      let id = 0;
      if (y === 0 || y === H - 1) id = B.BEDROCK;
      else if ((y < 4 && hash3(wx, y, wz, seed) < 0.5 - y * 0.12) || (y > H - 5 && hash3(wx, y, wz, seed + 1) < 0.5 - (H - 1 - y) * 0.12)) id = B.BEDROCK;
      else {
        const t = (y - 42) / 38;
        const v = n.n3(wx / 54, y / 30, wz / 54) * 0.78 + n.n3(wx / 17, y / 13, wz / 17) * 0.28;
        const solid = v > 0.16 - t * t * 1.5;
        if (solid) {
          id = B.NETHERRACK;
          const r = hash3(wx, y, wz, seed + 31);
          if (r < 0.011) id = B.QUARTZ_ORE; else if (r < 0.016) id = B.NETHER_GOLD_ORE;
        } else if (y <= LAVA_Y) id = B.LAVA;
      }
      bl[lidx(x, y, z)] = id;
    }
    // surface + ceiling decoration
    for (let y = H - 3; y > 1; y--) {
      const i = lidx(x, y, z); const id = bl[i];
      if (id !== B.NETHERRACK && id !== B.QUARTZ_ORE && id !== B.NETHER_GOLD_ORE) continue;
      const above = bl[lidx(x, y + 1, z)];
      if (above === 0) {
        if (biome === 1) bl[i] = B.CRIMSON_NYLIUM;
        else if (biome === 2) { bl[i] = hash3(wx, y, wz, seed + 7) < 0.6 ? B.SOUL_SAND : B.SOUL_SOIL; if (bl[lidx(x, y - 1, z)] === B.NETHERRACK) bl[lidx(x, y - 1, z)] = B.SOUL_SOIL; }
        else if (y <= LAVA_Y + 3 && hash3(wx, y, wz, seed + 8) < 0.12) bl[i] = B.MAGMA;
        else if (hash3(wx >> 2, y >> 2, wz >> 2, seed + 9) < 0.06) bl[i] = B.SOUL_SAND;
      }
      const below = bl[lidx(x, y - 1, z)];
      if (below === 0 && y > 46 && hash3(wx, y, wz, seed + 11) < 0.012) {
        // glowstone cluster hanging down
        for (let k = 1; k <= 1 + Math.floor(hash3(wx, y, wz, seed + 12) * 4); k++) if (bl[lidx(x, y - k, z)] === 0) bl[lidx(x, y - k, z)] = B.GLOWSTONE;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, nz = z + dz; if (nx >= 0 && nz >= 0 && nx < CS && nz < CS && hash3(wx + dx, y, wz + dz, seed + 13) < 0.6 && bl[lidx(nx, y - 1, nz)] === 0) bl[lidx(nx, y - 1, nz)] = B.GLOWSTONE; }
      }
    }
  }
  // features
  for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
    const wx = bx + x, wz = bz + z; const biome = biomes[z * CS + x];
    for (let y = LAVA_Y + 1; y < H - 8; y++) {
      const g = bl[lidx(x, y, z)]; if (bl[lidx(x, y + 1, z)] !== 0) continue;
      const r = hash3(wx, y, wz, seed + 20);
      if (g === B.CRIMSON_NYLIUM) {
        if (r < 0.014 && x >= 2 && z >= 2 && x <= 13 && z <= 13) hugeFungus(bl, x, y + 1, z, hash3(wx, y, wz, seed + 21));
        else if (r < 0.09) bl[lidx(x, y + 1, z)] = B.CRIMSON_FUNGUS;
      } else if (biome === 2 && (g === B.SOUL_SAND || g === B.SOUL_SOIL) && r < 0.006) {
        const h = 3 + Math.floor(hash3(wx, y, wz, seed + 22) * 9);
        for (let k = 1; k <= h && y + k < H - 2 && bl[lidx(x, y + k, z)] === 0; k++) bl[lidx(x, y + k, z)] = B.BASALT;
      }
    }
  }
  // fortresses
  for (const f of fortressesFor(w, bx, bz)) buildFortress(w, chunk, f, bx, bz);
  return chunk;
}
function hugeFungus(bl, x, y, z, r) {
  const h = 4 + Math.floor(r * 4);
  for (let k = 0; k < h; k++) if (bl[lidx(x, y + k, z)] === 0) bl[lidx(x, y + k, z)] = B.CRIMSON_STEM;
  const top = y + h;
  for (let ly = -2; ly <= 0; ly++) {
    const rad = ly === 0 ? 1 : 2;
    for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
      if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
      if (ly < 0 && Math.abs(dx) < 2 && Math.abs(dz) < 2 && !(ly === -1 && (dx || dz))) continue;
      const yy = top + ly; if (yy >= H - 1) continue; const i = lidx(x + dx, yy, z + dz);
      if (bl[i] === 0) bl[i] = ((dx * 7 + dz * 3 + ly) & 7) === 0 ? B.SHROOMLIGHT : B.WART_BLOCK;
    }
  }
  if (top + 1 < H - 1) bl[lidx(x, top + 1, z)] = B.WART_BLOCK;
}
function buildFortress(w, chunk, f, bx, bz) {
  const bl = chunk.blocks, meta = chunk.meta; const D = f.y;
  const set = (x, y, z, id, m = 0) => { const lx = x - bx, lz = z - bz; if (lx < 0 || lz < 0 || lx >= CS || lz >= CS || y < 1 || y >= H - 1) return; const i = lidx(lx, y, lz); bl[i] = id; meta[i] = m; };
  const get = (x, y, z) => { const lx = x - bx, lz = z - bz; if (lx < 0 || lz < 0 || lx >= CS || lz >= CS) return -1; return bl[lidx(lx, y, lz)]; };
  if (f.x + 60 < bx || f.x - 60 > bx + CS || f.z + 60 < bz || f.z - 60 > bz + CS) return;
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  // arms (bridges)
  dirs.forEach(([ax, az], k) => {
    const len = f.arms[k];
    for (let t = 6; t <= len; t++) for (let p = -2; p <= 2; p++) {
      const x = f.x + ax * t + (az ? p : 0), z = f.z + az * t + (ax ? p : 0);
      if (x < bx || x >= bx + CS || z < bz || z >= bz + CS) continue;
      set(x, D, z, B.NETHER_BRICKS); set(x, D - 1, z, B.NETHER_BRICKS);
      const edge = Math.abs(p) === 2;
      for (let y = D + 1; y <= D + 4; y++) set(x, y, z, 0);
      if (edge) { set(x, D + 1, z, B.NETHER_BRICKS); if (t % 3 === 0) set(x, D + 2, z, B.NETHER_BRICKS); }
      if (t === len) { set(x, D + 1, z, B.NETHER_BRICKS); set(x, D + 2, z, B.NETHER_BRICKS); }
      if (t % 4 === 0 && edge) set(x, D + 3, z, B.GLOWSTONE);
      // support pillars
      if (t % 9 === 0 && Math.abs(p) <= 1) { for (let y = D - 2; y > 1; y--) { const c = get(x, y, z); if (c !== 0 && c !== B.LAVA) break; set(x, y, z, B.NETHER_BRICKS); } }
    }
    // chest at arm end
    if (hash3(f.x, k, f.z, w.seed + 77) < 0.6) {
      const x = f.x + ax * (len - 1), z = f.z + az * (len - 1);
      if (x >= bx && x < bx + CS && z >= bz && z < bz + CS) { set(x, D + 1, z, B.CHEST, k === 0 ? 3 : k === 1 ? 1 : k === 2 ? 2 : 0); w.loot.set(x + ',' + (D + 1) + ',' + z, 'fortress'); }
    }
  });
  // central blaze room
  for (let dx = -5; dx <= 5; dx++) for (let dz = -5; dz <= 5; dz++) {
    const x = f.x + dx, z = f.z + dz; if (x < bx || x >= bx + CS || z < bz || z >= bz + CS) continue;
    const wall = Math.abs(dx) === 5 || Math.abs(dz) === 5;
    set(x, D, z, B.NETHER_BRICKS); set(x, D - 1, z, B.NETHER_BRICKS); set(x, D + 6, z, B.NETHER_BRICKS);
    for (let y = D + 1; y <= D + 5; y++) {
      let id = wall ? B.NETHER_BRICKS : 0;
      if (wall && y <= D + 3 && ((Math.abs(dx) === 5 && Math.abs(dz) <= 1) || (Math.abs(dz) === 5 && Math.abs(dx) <= 1))) id = 0;
      if (wall && y === D + 3 && (Math.abs(dx) === 3 || Math.abs(dz) === 3)) id = B.GLOWSTONE;
      set(x, y, z, id);
    }
    if (Math.abs(dx) === 4 && Math.abs(dz) === 4) for (let y = D - 2; y > 1; y--) { const c = get(x, y, z); if (c !== 0 && c !== B.LAVA) break; set(x, y, z, B.NETHER_BRICKS); }
  }
  if (f.x >= bx && f.x < bx + CS && f.z >= bz && f.z < bz + CS) {
    set(f.x, D + 1, f.z, B.SPAWNER); w.spawners.set(f.x + ',' + (D + 1) + ',' + f.z, { x: f.x, y: D + 1, z: f.z, type: 'blaze' });
  }
  const cx = f.x + 3, cz = f.z - 3;
  if (cx >= bx && cx < bx + CS && cz >= bz && cz < bz + CS) { set(cx, D + 1, cz, B.CHEST, 2); w.loot.set(cx + ',' + (D + 1) + ',' + cz, 'fortress'); }
}
