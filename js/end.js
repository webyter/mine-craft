// The End dimension (main island, obsidian pillars, exit fountain, outer islands, end cities)
// + Overworld strongholds with End portal rooms
import { hash3 } from './noise.js';
import { B } from './blocks.js';

const CS = 16, H = 128;
const lidx = (x, y, z) => (y * CS + z) * CS + x;
export const MAIN_R = 100, END_TOP = 60, OUTER_R = 520;
export const GATE_ISLAND = { x: 0, z: -660, r: 62 };
export const ARRIVAL = { x: 82, z: 0 };

// ---------- terrain ----------
export function endSurface(w, x, z) {
  const n = w.noise; const r = Math.hypot(x, z);
  const edge = MAIN_R + n.n2(x / 36, z / 36) * 10;
  if (r < edge) {
    const top = END_TOP + Math.round(n.n2(x / 40 + 3, z / 40 - 7) * 2.5 * Math.min(1, Math.max(0, r - 12) / 20));
    const k = 1 - Math.pow(r / edge, 2);
    const depth = 3 + Math.floor(k * 38 + n.n2(x / 9, z / 9) * 3);
    return { top, bottom: top - depth, main: true };
  }
  // forced island near the gateway exit
  const gd = Math.hypot(x - GATE_ISLAND.x, z - GATE_ISLAND.z);
  let v = -1;
  if (r > OUTER_R) v = w.noise2.fbm2(x / 120, z / 120, 3) + n.n2(x / 28, z / 28) * 0.08;
  if (gd < GATE_ISLAND.r + 12) v = Math.max(v, 0.3 + (1 - gd / GATE_ISLAND.r) * 0.5);
  if (v > 0.3) {
    const top = 56 + Math.round(n.n2(x / 70 + 11, z / 70) * 7);
    const depth = 2 + Math.floor(Math.min(1, (v - 0.3) * 4) * 22);
    return { top, bottom: top - depth, main: false };
  }
  return null;
}
export function endPillars(w) {
  if (w._pillars) return w._pillars;
  const out = []; const off = hash3(1, 2, 3, w.seed) * Math.PI * 2;
  for (let i = 0; i < 10; i++) {
    const a = off + i / 10 * Math.PI * 2; const r = 2 + Math.floor(hash3(i, 5, 9, w.seed) * 3);
    const height = END_TOP + 14 + Math.floor(hash3(i, 7, 1, w.seed) * 10) * 3;
    out.push({ x: Math.round(Math.cos(a) * 43), z: Math.round(Math.sin(a) * 43), r, top: height, caged: i === 2 || i === 7 });
  }
  return (w._pillars = out);
}
// gateway that leads to the outer islands (opens after the dragon dies)
export const GATEWAY = { x: 0, y: END_TOP + 14, z: -88 };

// ---------- end cities ----------
const ECELL = 190;
export function endCityPlan(w, gx, gz) {
  const key = gx + ',' + gz; w.ecCache = w.ecCache || new Map();
  if (w.ecCache.has(key)) return w.ecCache.get(key);
  let p = null;
  const gix = Math.floor(GATE_ISLAND.x / ECELL), giz = Math.floor(GATE_ISLAND.z / ECELL);
  let cx, cz;
  if (gx === gix && gz === giz) { cx = GATE_ISLAND.x + 14; cz = GATE_ISLAND.z - 12; }
  else if (hash3(gx, 41, gz, w.seed) < 0.55) { cx = gx * ECELL + 40 + Math.floor(hash3(gx, 42, gz, w.seed) * (ECELL - 80)); cz = gz * ECELL + 40 + Math.floor(hash3(gx, 43, gz, w.seed) * (ECELL - 80)); }
  if (cx !== undefined && Math.hypot(cx, cz) > OUTER_R + 20) {
    const s = endSurface(w, cx, cz);
    if (s && !s.main) {
      const floors = 3 + Math.floor(hash3(gx, 44, gz, w.seed) * 3);
      p = { x: cx, z: cz, y: s.top + 1, floors, ship: hash3(gx, 45, gz, w.seed) < 0.5 };
    }
  }
  w.ecCache.set(key, p); return p;
}
export function endCityNear(w, x, z, rings = 6) {
  const gx = Math.floor(x / ECELL), gz = Math.floor(z / ECELL); let best = null, bd = 1e9;
  for (let dx = -rings; dx <= rings; dx++) for (let dz = -rings; dz <= rings; dz++) {
    const p = endCityPlan(w, gx + dx, gz + dz); if (!p) continue; const d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; best = p; }
  }
  return best;
}

export function genEnd(w, chunk) {
  const bl = chunk.blocks, meta = chunk.meta, seed = w.seed; const bx = chunk.cx * CS, bz = chunk.cz * CS;
  const tops = new Int16Array(CS * CS).fill(-1); const mainArr = new Uint8Array(CS * CS);
  for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
    const s = endSurface(w, bx + x, bz + z); if (!s) continue;
    for (let y = Math.max(1, s.bottom); y <= s.top; y++) bl[lidx(x, y, z)] = B.END_STONE;
    tops[z * CS + x] = s.top; mainArr[z * CS + x] = s.main ? 1 : 0;
  }
  const set = (x, y, z, id, m = 0) => { const lx = x - bx, lz = z - bz; if (lx < 0 || lz < 0 || lx >= CS || lz >= CS || y < 1 || y >= H) return; const i = lidx(lx, y, lz); bl[i] = id; meta[i] = m; };
  const inC = (x, z) => x >= bx && x < bx + CS && z >= bz && z < bz + CS;
  // chorus plants on outer islands
  for (let z = 1; z < CS - 1; z++) for (let x = 1; x < CS - 1; x++) {
    const t = tops[z * CS + x]; if (t < 0 || mainArr[z * CS + x]) continue;
    const wx = bx + x, wz = bz + z; const r = hash3(wx, 51, wz, seed);
    if (r < 0.006) {
      const hgt = 2 + Math.floor(hash3(wx, 52, wz, seed) * 4);
      for (let k = 1; k <= hgt; k++) bl[lidx(x, t + k, z)] = B.CHORUS_PLANT;
      bl[lidx(x, t + hgt + 1, z)] = B.CHORUS_FLOWER;
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]]; const d = dirs[Math.floor(hash3(wx, 53, wz, seed) * 4)];
      const by = t + 1 + Math.floor(hgt / 2); bl[lidx(x + d[0], by, z + d[1])] = B.CHORUS_PLANT; bl[lidx(x + d[0], by + 1, z + d[1])] = B.CHORUS_FLOWER;
    }
  }
  // main island features
  if (Math.abs(bx) < 160 && Math.abs(bz) < 160) {
    for (const p of endPillars(w)) {
      if (p.x + p.r < bx || p.x - p.r >= bx + CS || p.z + p.r < bz || p.z - p.r >= bz + CS) continue;
      for (let dx = -p.r; dx <= p.r; dx++) for (let dz = -p.r; dz <= p.r; dz++) {
        if (dx * dx + dz * dz > p.r * p.r + p.r) continue; const x = p.x + dx, z = p.z + dz; if (!inC(x, z)) continue;
        for (let y = END_TOP - 8; y <= p.top; y++) set(x, y, z, B.OBSIDIAN);
      }
      set(p.x, p.top + 1, p.z, B.BEDROCK);
      if (p.caged) for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = 1; dy <= 4; dy++) {
        const edge = Math.abs(dx) === 2 || Math.abs(dz) === 2 || dy === 4; if (edge) set(p.x + dx, p.top + dy, p.z + dz, B.IRON_BARS);
      }
    }
    // exit fountain
    for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++) {
      const d = Math.hypot(dx, dz); if (d > 3.7 || !inC(dx, dz)) continue;
      set(dx, END_TOP - 1, dz, B.BEDROCK); set(dx, END_TOP, dz, d > 2.6 ? B.BEDROCK : (w.endPortalOpen ? B.END_PORTAL : 0));
      for (let y = END_TOP + 1; y < END_TOP + 5; y++) set(dx, y, dz, 0);
    }
    if (inC(0, 0)) { for (let y = END_TOP; y <= END_TOP + 3; y++) set(0, y, 0, B.BEDROCK); for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) set(dx, END_TOP + 2, dz, B.TORCH); if (w.endEgg) set(0, END_TOP + 4, 0, B.DRAGON_EGG); }
    // arrival pad
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) { const x = ARRIVAL.x + dx, z = ARRIVAL.z + dz; if (!inC(x, z)) continue; const s = endSurface(w, x, z); const t = s ? s.top : END_TOP; set(x, t, z, B.OBSIDIAN); for (let y = t + 1; y < t + 4; y++) set(x, y, z, 0); }
    // gateway frame
    if (w.gatewayOpen) {
      const G = GATEWAY;
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
        const x = G.x + dx, z = G.z + dz; if (!inC(x, z)) continue;
        const center = !dx && !dy && !dz; set(x, G.y + dy, z, center ? B.END_PORTAL : (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) === 1 && dy ? B.BEDROCK : 0));
      }
      if (inC(G.x, G.z)) { set(G.x, G.y - 2, G.z, B.BEDROCK); set(G.x, G.y + 2, G.z, B.BEDROCK); }
    }
  }
  // end cities
  const g0x = Math.floor((bx - 30) / ECELL), g1x = Math.floor((bx + CS + 30) / ECELL), g0z = Math.floor((bz - 30) / ECELL), g1z = Math.floor((bz + CS + 30) / ECELL);
  for (let gx = g0x; gx <= g1x; gx++) for (let gz = g0z; gz <= g1z; gz++) { const p = endCityPlan(w, gx, gz); if (p) buildEndCity(w, p, set, bx, bz, inC); }
  return chunk;
}

function buildEndCity(w, p, set, bx, bz, inC) {
  if (p.x + 24 < bx || p.x - 24 > bx + CS || p.z + 24 < bz || p.z - 24 > bz + CS) return;
  const R = 4, FH = 6; const top = p.y + p.floors * FH;
  // spiral ring around the inside of the walls (7x7 boundary)
  const ring = []; for (let i = -3; i < 3; i++) ring.push([i, -3]); for (let i = -3; i < 3; i++) ring.push([3, i]); for (let i = 3; i > -3; i--) ring.push([i, 3]); for (let i = 3; i > -3; i--) ring.push([-3, i]);
  for (let dx = -R - 1; dx <= R + 1; dx++) for (let dz = -R - 1; dz <= R + 1; dz++) {
    const x = p.x + dx, z = p.z + dz; if (!inC(x, z)) continue;
    // foundation down to the island
    if (Math.abs(dx) <= R && Math.abs(dz) <= R) for (let y = p.y - 1; y > p.y - 6; y--) set(x, y, z, B.END_BRICKS);
    for (let y = p.y; y <= top + 1; y++) {
      const ax = Math.abs(dx), az = Math.abs(dz); const lvl = (y - p.y) % FH;
      let id = 0;
      if (ax > R || az > R) { id = (lvl === 0 && y > p.y && (ax === R + 1) !== (az === R + 1)) ? B.PURPUR : 0; }
      else if (ax === R || az === R) {
        id = (ax === R && az === R) ? B.PURPUR_PILLAR : B.PURPUR;
        if ((lvl === 2 || lvl === 3) && (ax !== R || az !== R) && (Math.abs(dx) === 1 || Math.abs(dz) === 1 || dx === 0 || dz === 0) && y < top) id = B.GLASS_DARK;
        if (y === p.y + 1 || y === p.y + 2) { if (dz === -R && Math.abs(dx) <= 1) id = 0; }
      } else if (lvl === 0) id = (ax <= 2 && az <= 2) || y === p.y || y === top ? B.END_BRICKS : 0;
      if (y === top + 1) id = (ax === R && az === R) ? B.END_ROD : 0;
      if (y === top && ax <= R && az <= R) id = B.PURPUR;
      set(x, y, z, id);
    }
  }
  // stairs spiral (inside the ring)
  for (let y = p.y + 1; y < top; y++) {
    const i = (y - p.y - 1) % ring.length; const [dx, dz] = ring[i]; set(p.x + dx, y, p.z + dz, B.PURPUR);
    for (let k = 1; k <= 2; k++) { const [ex, ez] = ring[(i + k) % ring.length]; void ex; void ez; }
    for (let up = 1; up <= 3; up++) { const yy = y + up; const lvl = (yy - p.y) % FH; if (lvl === 0 && yy !== top) set(p.x + dx, yy, p.z + dz, 0); }
  }
  // top floor: chests + end rods
  const ty = top - FH + 1;
  if (inC(p.x + 1, p.z + 1)) { set(p.x + 1, ty, p.z + 1, B.CHEST, 0); w.loot.set((p.x + 1) + ',' + ty + ',' + (p.z + 1), 'end_city'); }
  if (inC(p.x - 1, p.z + 1)) { set(p.x - 1, ty, p.z + 1, B.CHEST, 0); w.loot.set((p.x - 1) + ',' + ty + ',' + (p.z + 1), 'end_city_elytra'); }
  for (const [dx, dz] of [[2, -2], [-2, -2]]) if (inC(p.x + dx, p.z + dz)) set(p.x + dx, ty, p.z + dz, B.END_ROD);
  for (let f = 1; f < p.floors; f++) if (inC(p.x, p.z)) set(p.x, p.y + f * FH + 1, p.z, B.END_ROD);
  // roof hole above the spiral end so you can climb out
  // small purpur bridge / balcony
  for (let t = 5; t <= 9; t++) for (let k = -1; k <= 1; k++) { const x = p.x + t, z = p.z + k; if (inC(x, z)) { set(x, p.y + FH, z, B.PURPUR); if (Math.abs(k) === 1) set(x, p.y + FH + 1, z, B.END_ROD); } }
}

// ---------- strongholds (overworld) ----------
const SCELL = 420;
export function strongholdPlan(w, gx, gz) {
  const key = gx + ',' + gz; w.shCache = w.shCache || new Map();
  if (w.shCache.has(key)) return w.shCache.get(key);
  let p = null; const r = (k) => hash3(gx, k, gz, w.seed + 777);
  if ((gx === 0 && gz === 0) || r(1) < 0.7) {
    let cx = gx * SCELL + 90 + Math.floor(r(2) * (SCELL - 180)), cz = gz * SCELL + 90 + Math.floor(r(3) * (SCELL - 180));
    if (gx === 0 && gz === 0) { const a = r(9) * Math.PI * 2; cx = Math.round(Math.cos(a) * 230); cz = Math.round(Math.sin(a) * 230); }
    const y = 9 + Math.floor(r(4) * 6);
    const L = [16 + Math.floor(r(5) * 14), 14 + Math.floor(r(6) * 14), 14 + Math.floor(r(7) * 14)];
    p = { x: cx, y, z: cz, L, rooms: [Math.floor(r(10) * 3), Math.floor(r(11) * 3), Math.floor(r(12) * 3)], eyes: Array.from({ length: 12 }, (_, i) => hash3(gx, 60 + i, gz, w.seed) < 0.1) };
    p.portal = { x: cx, y: y + 1, z: cz + 2 };
  }
  w.shCache.set(key, p); return p;
}
export function strongholdNear(w, x, z, rings = 3) {
  const gx = Math.floor(x / SCELL), gz = Math.floor(z / SCELL); let best = null, bd = 1e9;
  for (let dx = -rings; dx <= rings; dx++) for (let dz = -rings; dz <= rings; dz++) { const p = strongholdPlan(w, gx + dx, gz + dz); if (!p) continue; const d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; best = p; } }
  return best;
}
// End portal frame ring offsets around a portal centre
export const FRAME_RING = [];
for (let k = -1; k <= 1; k++) FRAME_RING.push([k, -2], [k, 2], [-2, k], [2, k]);

export function buildStrongholds(w, chunk) {
  const bx = chunk.cx * CS, bz = chunk.cz * CS;
  const gx0 = Math.floor((bx - 80) / SCELL), gx1 = Math.floor((bx + CS + 80) / SCELL), gz0 = Math.floor((bz - 80) / SCELL), gz1 = Math.floor((bz + CS + 80) / SCELL);
  for (let gx = gx0 - 1; gx <= gx1 + 1; gx++) for (let gz = gz0 - 1; gz <= gz1 + 1; gz++) {
    const p = strongholdPlan(w, gx, gz); if (!p) continue;
    if (p.x + 70 < bx || p.x - 70 > bx + CS || p.z + 70 < bz || p.z - 70 > bz + CS) continue;
    buildStronghold(w, chunk, p, bx, bz);
  }
}
function buildStronghold(w, chunk, p, bx, bz) {
  const bl = chunk.blocks, meta = chunk.meta, seed = w.seed;
  const inC = (x, z) => x >= bx && x < bx + CS && z >= bz && z < bz + CS;
  const set = (x, y, z, id, m = 0) => { if (!inC(x, z) || y < 1 || y >= H) return; const i = lidx(x - bx, y, z - bz); if (bl[i] === B.BEDROCK) return; bl[i] = id; meta[i] = m; };
  const brick = (x, y, z) => { const r = hash3(x, y, z, seed + 99); return r < 0.18 ? B.MOSSY_BRICKS : r < 0.32 ? B.CRACKED_BRICKS : B.STONE_BRICKS; };
  // hollow box; openAxis: 'x' | 'z' | null (leave ends open)
  const room = (x0, y0, z0, x1, y1, z1, open) => {
    for (let x = Math.max(x0, bx); x <= Math.min(x1, bx + CS - 1); x++) for (let z = Math.max(z0, bz); z <= Math.min(z1, bz + CS - 1); z++) for (let y = y0; y <= y1; y++) {
      const ex = x === x0 || x === x1, ez = z === z0 || z === z1, ey = y === y0 || y === y1;
      const shell = ey || (open === 'x' ? ez : open === 'z' ? ex : (ex || ez));
      set(x, y, z, shell ? brick(x, y, z) : 0);
    }
  };
  const Y = p.y, sx = p.x, sz = p.z;
  // corridors first, rooms carve over them
  const arms = [[0, -1], [1, 0], [-1, 0]];
  const ends = [];
  arms.forEach(([ax, az], k) => {
    const L = p.L[k];
    if (az) { const z0 = az < 0 ? sz - 7 - L : sz + 7, z1 = az < 0 ? sz - 7 : sz + 7 + L; room(sx - 2, Y, z0, sx + 2, Y + 4, z1, 'z'); ends.push({ x: sx, z: az < 0 ? z0 - 4 : z1 + 4, k }); }
    else { const x0 = ax < 0 ? sx - 6 - L : sx + 6, x1 = ax < 0 ? sx - 6 : sx + 6 + L; room(x0, Y, sz - 2, x1, Y + 4, sz + 2, 'x'); ends.push({ x: ax < 0 ? x0 - 4 : x1 + 4, z: sz, k }); }
    // torches along the corridor
    for (let t = 8; t < L; t += 7) { const x = sx + ax * (6 + t) + (az ? -1 : 0), z = sz + az * (7 + t) + (ax ? -1 : 0); set(x, Y + 1, z, B.TORCH); }
  });
  // end rooms: library / storeroom / fountain
  for (const e of ends) {
    const kind = p.rooms[e.k];
    room(e.x - 4, Y, e.z - 4, e.x + 4, Y + 6, e.z + 4, null);
    // doorways toward the corridor
    for (let y = Y + 1; y <= Y + 3; y++) for (let k = -1; k <= 1; k++) { if (e.k === 0) set(e.x + k, y, e.z + 4, 0); else if (e.k === 1) set(e.x - 4, y, e.z + k, 0); else set(e.x + 4, y, e.z + k, 0); }
    if (kind === 0) { // library
      for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) for (let y = Y + 1; y <= Y + 4; y++) {
        const wall = Math.abs(dx) === 3 || Math.abs(dz) === 3; if (!wall) continue;
        const door = (e.k === 0 && dz === 3 && Math.abs(dx) <= 1) || (e.k === 1 && dx === -3 && Math.abs(dz) <= 1) || (e.k === 2 && dx === 3 && Math.abs(dz) <= 1);
        if (!door) set(e.x + dx, y, e.z + dz, B.BOOKSHELF);
      }
      set(e.x, Y + 1, e.z, B.CHEST, 0); if (inC(e.x, e.z)) w.loot.set(e.x + ',' + (Y + 1) + ',' + e.z, 'stronghold_library');
      set(e.x + 1, Y + 1, e.z, B.TABLE); set(e.x - 1, Y + 1, e.z - 1, B.TORCH);
    } else if (kind === 1) { // storeroom
      set(e.x + 2, Y + 1, e.z - 2, B.CHEST, 0); if (inC(e.x + 2, e.z - 2)) w.loot.set((e.x + 2) + ',' + (Y + 1) + ',' + (e.z - 2), 'stronghold');
      set(e.x - 2, Y + 1, e.z - 2, B.CHEST, 0); if (inC(e.x - 2, e.z - 2)) w.loot.set((e.x - 2) + ',' + (Y + 1) + ',' + (e.z - 2), 'stronghold');
      set(e.x, Y + 2, e.z, B.TORCH); set(e.x, Y + 1, e.z, B.STONE_BRICKS);
    } else { // fountain room
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) set(e.x + dx, Y + 1, e.z + dz, Math.abs(dx) + Math.abs(dz) === 0 ? B.STONE_BRICKS : B.STONE_BRICKS);
      set(e.x, Y + 2, e.z, B.STONE_BRICKS); set(e.x, Y + 3, e.z, B.WATER); set(e.x + 3, Y + 1, e.z + 3, B.TORCH); set(e.x - 3, Y + 1, e.z + 3, B.TORCH);
    }
  }
  // portal room
  room(sx - 6, Y, sz - 7, sx + 6, Y + 8, sz + 7, null);
  for (let y = Y + 1; y <= Y + 3; y++) for (let k = -1; k <= 1; k++) { set(sx + k, y, sz - 7, 0); set(sx + 6, y, sz + k, 0); set(sx - 6, y, sz + k, 0); }
  const P = p.portal;
  // raised platform + lava pool + frames
  for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) set(P.x + dx, Y, P.z + dz, B.STONE_BRICKS);
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) { set(P.x + dx, Y, P.z + dz, B.LAVA); set(P.x + dx, Y - 1, P.z + dz, B.STONE_BRICKS); }
  FRAME_RING.forEach(([dx, dz], i) => {
    const m = dz === -2 ? 0 : dz === 2 ? 2 : dx === -2 ? 1 : 3;
    set(P.x + dx, P.y, P.z + dz, p.eyes[i] ? B.END_FRAME_EYE : B.END_FRAME, m);
  });
  // steps up to the frames
  for (let k = -1; k <= 1; k++) set(P.x + k, Y + 1, P.z - 4, B.STONE_BRICKS);
  // spawner (guarded room) + torches
  if (inC(sx, sz - 5)) { set(sx, Y + 1, sz - 5, B.SPAWNER); w.spawners.set(sx + ',' + (Y + 1) + ',' + (sz - 5), { x: sx, y: Y + 1, z: sz - 5, type: 'zombie' }); }
  for (const [dx, dz] of [[-5, -6], [5, -6], [-5, 6], [5, 6]]) set(sx + dx, Y + 2, sz + dz, B.TORCH);
}
