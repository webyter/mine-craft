// Mine Craft — player home plots: district location + starter house templates
import { B } from './blocks.js';
import { SEA, H } from './world.js';

export const PLOT = 32, PLOT_COLS = 12;
export const HOME_STYLES = [['cottage', 'Cottage'], ['modern', 'Modern'], ['cabin', 'Log cabin'], ['villa', 'Villa']];

// Deterministic search for an open, dry area away from settlements (same result on every client)
export function findHomeOrigin(world) {
  const st = world.settle; const W = PLOT * PLOT_COLS, D = PLOT * 6;
  let best = null, bestScore = -1e9;
  for (let r = 260; r <= 1400; r += 140) {
    for (let a = 0; a < 16; a++) {
      const ang = a / 16 * Math.PI * 2; const x0 = Math.round(Math.cos(ang) * r / 16) * 16, z0 = Math.round(Math.sin(ang) * r / 16) * 16;
      if (st && st.plansNear(x0 - 40, z0 - 40, x0 + W + 40, z0 + D + 40).length) continue;
      let land = 0, sum = 0, sum2 = 0, n = 0;
      for (let i = 0; i <= 8; i++) for (let j = 0; j <= 4; j++) { const c = world.column(x0 + i * W / 8, z0 + j * D / 4); n++; if (c.h > SEA + 1 && c.biome !== 4) land++; sum += c.h; sum2 += c.h * c.h; }
      const mean = sum / n, sd = Math.sqrt(Math.max(0, sum2 / n - mean * mean));
      if (land / n > 0.85 && sd < 6) return { x: x0, z: z0 };
      const score = land / n * 100 - sd * 3; if (score > bestScore) { bestScore = score; best = { x: x0, z: z0 }; }
    }
  }
  return best || { x: 320, z: 320 };
}
export function plotRect(origin, idx) {
  const gx = idx % PLOT_COLS, gz = Math.floor(idx / PLOT_COLS);
  const x0 = origin.x + gx * PLOT, z0 = origin.z + gz * PLOT; return { x0, z0, x1: x0 + PLOT - 1, z1: z0 + PLOT - 1, cx: x0 + PLOT / 2, cz: z0 + PLOT / 2 };
}
export function plotAt(origin, x, z) {
  if (!origin) return -1; const gx = Math.floor((x - origin.x) / PLOT), gz = Math.floor((z - origin.z) / PLOT);
  if (gx < 0 || gz < 0 || gx >= PLOT_COLS) return -1; return gz * PLOT_COLS + gx;
}
// base height of the district (shared, so plots line up)
export function plotBase(world, origin, idx) {
  const r = plotRect(origin, idx); let s = 0, n = 0;
  for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) { s += world.column(r.x0 + i * 8, r.z0 + j * 8).h; n++; }
  return Math.max(SEA + 2, Math.min(H - 30, Math.round(s / n)));
}

// Build a starter house. Returns edits [x,y,z,id,meta] that differ from the current world.
export function homeEdits(world, origin, idx, style, ownerName) {
  const r = plotRect(origin, idx); const base = plotBase(world, origin, idx);
  const want = new Map(); const set = (x, y, z, id, meta = 0) => { if (y >= 0 && y < H) want.set(x + ',' + y + ',' + z, [x, y, z, id, meta]); };
  // land: flatten the plot (2-block lip of path around it)
  for (let x = r.x0; x <= r.x1; x++) for (let z = r.z0; z <= r.z1; z++) {
    const edge = x === r.x0 || z === r.z0 || x === r.x1 || z === r.z1;
    const g = world.column(x, z).h;
    for (let y = Math.min(g, base) - 2; y < base; y++) set(x, y, z, y < base - 3 ? B.STONE : B.DIRT);
    set(x, base, z, edge ? B.PATH : B.GRASS);
    for (let y = base + 1; y <= Math.max(base + 16, g + 2); y++) set(x, y, z, 0);
  }
  // fence with a gate gap facing -z (the street)
  for (let x = r.x0 + 1; x <= r.x1 - 1; x++) for (const z of [r.z0 + 1, r.z1 - 1]) if (!(z === r.z0 + 1 && Math.abs(x - r.cx) <= 1)) set(x, base + 1, z, B.FENCE);
  for (let z = r.z0 + 1; z <= r.z1 - 1; z++) for (const x of [r.x0 + 1, r.x1 - 1]) set(x, base + 1, z, B.FENCE);
  // garden path to the door
  for (let z = r.z0 + 1; z <= r.z0 + 9; z++) for (let dx = -1; dx <= 1; dx++) set(r.cx + dx, base, z, B.PATH);
  // lamp posts at the gate
  for (const dx of [-2, 2]) { set(r.cx + dx, base + 1, r.z0 + 1, B.FENCE); set(r.cx + dx, base + 2, r.z0 + 1, B.FENCE); set(r.cx + dx, base + 3, r.z0 + 1, B.LAMP); }
  // house footprint
  const hw = 6, hd = 5; const hx0 = r.cx - hw, hx1 = r.cx + hw, hz0 = r.z0 + 10, hz1 = r.z0 + 10 + hd * 2;
  const M = {
    cottage: { wall: B.PLANKS, corner: B.OAK_LOG, floor: B.PLANKS, base: B.COBBLE, roof: B.BRICKS, win: B.GLASS, h: 4 },
    modern: { wall: B.WHITE_CONCRETE, corner: B.GRAY_CONCRETE, floor: B.MARBLE, base: B.SMOOTH_STONE, roof: B.GRAY_CONCRETE, win: B.GLASS_BLUE, h: 5 },
    cabin: { wall: B.SPRUCE_LOG, corner: B.OAK_LOG, floor: B.PLANKS, base: B.STONE_BRICKS, roof: B.SPRUCE_LOG, win: B.GLASS, h: 4 },
    villa: { wall: B.SANDSTONE, corner: B.QUARTZ_BLOCK, floor: B.TERRACOTTA, base: B.QUARTZ_BLOCK, roof: B.TERRACOTTA, win: B.GLASS, h: 5 },
  }[style] || null;
  const m = M || { wall: B.PLANKS, corner: B.OAK_LOG, floor: B.PLANKS, base: B.COBBLE, roof: B.BRICKS, win: B.GLASS, h: 4 };
  for (let x = hx0; x <= hx1; x++) for (let z = hz0; z <= hz1; z++) {
    const wallX = x === hx0 || x === hx1, wallZ = z === hz0 || z === hz1;
    set(x, base, z, wallX || wallZ ? m.base : m.floor);
    for (let y = base + 1; y <= base + m.h; y++) {
      if (!(wallX || wallZ)) { set(x, y, z, 0); continue; }
      const corner = wallX && wallZ;
      let id = corner ? m.corner : m.wall;
      const winRow = y === base + 2 || (m.h >= 5 && y === base + 3);
      if (!corner && winRow && ((wallZ && (x - hx0) % 3 === 2) || (wallX && (z - hz0) % 3 === 2))) id = m.win;
      if (style === 'modern' && wallZ && z === hz0 && y > base && !corner && Math.abs(x - r.cx) > 1) id = m.win; // glass front
      set(x, y, z, id);
    }
  }
  // door (2-high opening) + porch light
  set(r.cx, base + 1, hz0, 0); set(r.cx, base + 2, hz0, 0); set(r.cx + 1, base + 3, hz0 - 1, B.TORCH);
  set(r.cx - 1, base + 3, hz0 - 1, B.TORCH);
  // roof
  if (style === 'modern') {
    for (let x = hx0 - 1; x <= hx1 + 1; x++) for (let z = hz0 - 1; z <= hz1 + 1; z++) set(x, base + m.h + 1, z, m.roof);
    for (let x = hx0 + 1; x <= hx0 + 4; x++) for (let z = hz0 + 1; z <= hz0 + 3; z++) set(x, base + m.h + 2, z, B.SOLAR_PANEL);
    // pool beside the house
    for (let x = r.x0 + 3; x <= r.x0 + 7; x++) for (let z = r.z0 + 18; z <= r.z0 + 26; z++) { const e = x === r.x0 + 3 || x === r.x0 + 7 || z === r.z0 + 18 || z === r.z0 + 26; set(x, base, z, e ? B.MARBLE : B.WATER); if (!e) set(x, base - 1, z, B.BLUE_CONCRETE); }
  } else {
    const lay = (hz1 - hz0 + 2) / 2;
    for (let s = 0; s <= lay; s++) for (let x = hx0 - 1; x <= hx1 + 1; x++) { set(x, base + m.h + 1 + s, hz0 - 1 + s, m.roof); set(x, base + m.h + 1 + s, hz1 + 1 - s, m.roof); }
    for (let s = 0; s < lay; s++) for (let z = hz0 + s; z <= hz1 - s; z++) { for (const x of [hx0, hx1]) set(x, base + m.h + 1 + s, z, m.wall); for (let x = hx0 + 1; x < hx1; x++) set(x, base + m.h + 1 + s, z, 0); }
  }
  // interior: bed, chest, table, furnace, bookshelf, lamp, carpet
  set(hx0 + 1, base + 1, hz1 - 1, B.BED); set(hx0 + 2, base + 1, hz1 - 1, B.RED_WOOL);
  set(hx1 - 1, base + 1, hz1 - 1, B.CHEST); set(hx1 - 2, base + 1, hz1 - 1, B.CHEST);
  set(hx1 - 1, base + 1, hz0 + 2, B.TABLE); set(hx1 - 1, base + 1, hz0 + 3, B.FURNACE);
  set(hx0 + 1, base + 1, hz0 + 2, B.BOOKSHELF); set(hx0 + 1, base + 2, hz0 + 2, B.BOOKSHELF);
  set(r.cx, base + m.h, hz0 + hd, B.LAMP);
  for (let x = r.cx - 1; x <= r.cx + 1; x++) for (let z = hz0 + 3; z <= hz0 + 6; z++) set(x, base, z, B.BLUE_WOOL);
  set(hx0 + 1, base + 1, hz0 + 4, B.TV);
  // garden: trees, flowers, crops, campfire
  for (const [tx, tz] of [[r.x0 + 4, r.z0 + 4], [r.x1 - 4, r.z0 + 4]]) { for (let y = 1; y <= 4; y++) set(tx, base + y, tz, B.OAK_LOG); for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let y = 4; y <= 6; y++) if (Math.abs(dx) + Math.abs(dz) + (y - 4) < 4 && !(dx === 0 && dz === 0 && y < 5)) set(tx + dx, base + y, tz + dz, B.OAK_LEAVES); }
  for (let x = r.cx - 5; x <= r.cx + 5; x += 2) { set(x, base + 1, r.z0 + 7, (x & 2) ? B.POPPY : B.DANDELION); }
  if (style !== 'modern') { for (let x = r.x0 + 3; x <= r.x0 + 7; x++) for (let z = r.z0 + 20; z <= r.z0 + 26; z++) { if (x === r.x0 + 5) { set(x, base, z, B.WATER); } else { set(x, base, z, B.FARMLAND); set(x, base + 1, z, B.WHEAT_3); } } }
  set(r.x1 - 6, base + 1, r.z0 + 24, B.CAMPFIRE);
  for (const [dx, dz] of [[-1, 0], [1, 0], [0, 1], [0, -1]]) set(r.x1 - 6 + dx * 2, base + 1, r.z0 + 24 + dz * 2, B.OAK_LOG);
  // mailbox at the gate
  set(r.cx + 3, base + 1, r.z0 + 2, B.FENCE); set(r.cx + 3, base + 2, r.z0 + 2, B.RED_CONCRETE);
  void ownerName;
  const out = [];
  for (const e of want.values()) { const [x, y, z, id, meta] = e; if (world.getBlock(x, y, z) !== id || (meta && world.getMeta(x, y, z) !== meta)) out.push(e); }
  return { edits: out, spawn: { x: r.cx + 0.5, y: base + 1.01, z: hz0 + 3.5 }, gate: { x: r.cx + 0.5, y: base + 1.01, z: r.z0 + 0.5 }, base };
}
