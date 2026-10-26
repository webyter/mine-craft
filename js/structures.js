// Procedural settlements: villages (biome styled) and modern cities
import { hash3, mulberry32 } from './noise.js';
import { B } from './blocks.js';

const H = 128, SEA = 28;
const CELL = 176, MARGIN = 66;
// facing meta from a world direction: 0:+z 1:+x 2:-z 3:-x
const dirMeta = (vx, vz) => (vz > 0 ? 0 : vx > 0 ? 1 : vz < 0 ? 2 : 3);
const STYLES = {
  0: { name: 'plains', wall: B.PLANKS, log: B.OAK_LOG, roof: B.OAK_LOG, floor: B.PLANKS, base: B.COBBLE },
  1: { name: 'forest', wall: B.PLANKS, log: B.BIRCH_LOG, roof: B.SPRUCE_LOG, floor: B.PLANKS, base: B.MOSSY },
  2: { name: 'desert', wall: B.SANDSTONE, log: B.SANDSTONE, roof: B.TERRACOTTA, floor: B.SANDSTONE, base: B.SANDSTONE },
  3: { name: 'snowy', wall: B.PLANKS, log: B.SPRUCE_LOG, roof: B.STONE_BRICKS, floor: B.SPRUCE_LOG, base: B.STONE_BRICKS },
};
export const PROFESSIONS = ['farmer', 'librarian', 'smith', 'cleric', 'butcher', 'shepherd', 'mason', 'nitwit'];

export class Settlements {
  constructor(world) { this.w = world; this.plans = new Map(); }
  get flat() { return this.w.type === 'flat'; }
  ground(x, z) { return this.w.column(x, z).h; }
  isWater(x, z) { return !this.flat && this.ground(x, z) < SEA; }
  plan(gx, gz) {
    const k = gx + ',' + gz; if (this.plans.has(k)) return this.plans.get(k);
    let p = null;
    try { p = this.makePlan(gx, gz); } catch (e) { console.warn('settlement failed', e); p = null; }
    this.plans.set(k, p); return p;
  }
  plansNear(x0, z0, x1, z1) {
    const out = [];
    for (let gx = Math.floor((x0 - CELL) / CELL); gx <= Math.floor((x1 + CELL) / CELL); gx++)
      for (let gz = Math.floor((z0 - CELL) / CELL); gz <= Math.floor((z1 + CELL) / CELL); gz++) {
        const p = this.plan(gx, gz);
        if (p && p.r[0] <= x1 && p.r[2] >= x0 && p.r[1] <= z1 && p.r[3] >= z0) out.push(p);
      }
    return out;
  }
  // nearest settlement of a type; scans cells in rings
  nearest(type, x, z, rings = 12) {
    const cgx = Math.floor(x / CELL), cgz = Math.floor(z / CELL); let best = null, bd = Infinity;
    for (let r = 0; r <= rings; r++) {
      for (let gx = cgx - r; gx <= cgx + r; gx++) for (let gz = cgz - r; gz <= cgz + r; gz++) {
        if (Math.max(Math.abs(gx - cgx), Math.abs(gz - cgz)) !== r) continue;
        const p = this.plan(gx, gz); if (!p || (type && p.type !== type)) continue;
        const d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; best = p; }
      }
      if (best && r >= 2) break;
    }
    return best;
  }
  at(x, z) { for (const p of this.plansNear(x, z, x, z)) if (x >= p.r[0] && x <= p.r[2] && z >= p.r[1] && z <= p.r[3]) return p; return null; }
  applyChunk(bx, bz, setM, getL) {
    const x0 = bx, z0 = bz, x1 = bx + 15, z1 = bz + 15; const rects = [];
    const plans = this.plansNear(x0 - 8, z0 - 8, x1 + 8, z1 + 8);
    if (!plans.length) return rects;
    const w = this.w;
    const S = {
      x0, z0, x1, z1, set: setM, get: getL,
      inClip: (x, z) => x >= x0 && x <= x1 && z >= z0 && z <= z1,
      loot(x, y, z, table) { if (S.inClip(x, z)) w.loot.set(x + ',' + y + ',' + z, table); },
      crop(x, y, z) { if (S.inClip(x, z)) w.crops.set(x + ',' + y + ',' + z, [x, y, z]); },
    };
    for (const p of plans) {
      for (const pc of p.pieces) {
        const r = pc.r;
        if (r[0] - 6 <= x1 && r[2] + 6 >= x0 && r[1] - 6 <= z1 && r[3] + 6 >= z0) rects.push(r);
        if (r[0] <= x1 && r[2] >= x0 && r[1] <= z1 && r[3] >= z0) pc.build(S);
      }
    }
    return rects;
  }
  // ---------- plan selection ----------
  makePlan(gx, gz) {
    const seed = this.w.seed;
    const r = hash3(gx, 991, gz, seed);
    const home = gx === 0 && gz === 0;
    let type = home ? 'city' : r < 0.16 ? 'city' : r < 0.22 ? 'energy' : r < 0.62 ? 'village' : null;
    if (!type) return null;
    if (type === 'village' || type === 'energy') {
      // keep villages / farms clear of neighbouring cities
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
        if (!dx && !dz) continue; const ox = gx + dx, oz = gz + dz;
        if ((ox === 0 && oz === 0) || hash3(ox, 991, oz, seed) < 0.16) {
          const ncx = ox * CELL + MARGIN + Math.floor(hash3(ox, 992, oz, seed) * (CELL - MARGIN * 2)), ncz = oz * CELL + MARGIN + Math.floor(hash3(ox, 993, oz, seed) * (CELL - MARGIN * 2));
          const mx = gx * CELL + CELL / 2, mz = gz * CELL + CELL / 2;
          if (Math.max(Math.abs(ncx - mx), Math.abs(ncz - mz)) < 125) return null;
        }
      }
    }
    const cx = gx * CELL + MARGIN + Math.floor(hash3(gx, 992, gz, seed) * (CELL - MARGIN * 2));
    const cz = gz * CELL + MARGIN + Math.floor(hash3(gx, 993, gz, seed) * (CELL - MARGIN * 2));
    const rnd = mulberry32((hash3(gx, 994, gz, seed) * 4294967296) >>> 0);
    if (home) { // try several spots in the spawn cell for the capital
      for (const [ox, oz] of [[0, 0], [-30, -30], [30, -30], [-30, 30], [30, 30], [0, -40], [0, 40], [-40, 0], [40, 0]]) {
        const hx = cx + ox, hz = cz + oz; const hc = this.w.column(hx, hz);
        if (hc.biome > 3 || (!this.flat && hc.h < SEA + 1)) continue;
        const p = this.makeCity(hx, hz, rnd); if (p) return p;
      }
      return null;
    }
    const c = this.w.column(cx, cz);
    if (c.biome > 3 || (!this.flat && c.h < SEA + 1)) return null;
    if (type === 'city') { const p = this.makeCity(cx, cz, rnd); if (p) return p; type = 'village'; }
    if (type === 'energy') return this.makeEnergy(cx, cz, rnd);
    return this.makeVillage(cx, cz, c.biome, rnd);
  }

  // ---------- wind + solar farm ----------
  makeEnergy(cx, cz, rnd) {
    const pts = []; let wet = 0;
    for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) { const h = this.ground(cx + i * 14, cz + j * 14); if (!this.flat && h < SEA + 1) wet++; pts.push(h); }
    if (wet > 3) return null;
    const pieces = [], mobs = [];
    const plan = { type: 'energy', x: cx, z: cz, y: this.ground(cx, cz), pieces, mobs, r: [cx - 50, cz - 50, cx + 50, cz + 50], name: cityName(rnd).replace(' City', '') + ' Wind Farm', signals: [], screens: [], parked: [], turbines: [] };
    const self = this;
    for (const [ox, oz] of [[-36, -36], [0, -40], [36, -34], [-40, 2], [38, 4], [-34, 38], [2, 40], [36, 36]]) {
      const x = cx + ox + Math.floor(rnd() * 6 - 3), z = cz + oz + Math.floor(rnd() * 6 - 3); const h = this.ground(x, z);
      if (!this.flat && h < SEA + 1) continue;
      const top = Math.min(H - 6, h + 36);
      plan.turbines.push({ x: x + 0.5, y: top + 0.5, z: z - 0.6, yaw: 0 });
      pieces.push({ r: [x - 1, z - 1, x + 1, z + 1], build: (S) => {
        for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) { S.set(x + dx, h, z + dz, B.GRAY_CONCRETE); for (let y = h + 1; y <= h + 3; y++) S.set(x + dx, y, z + dz, 0); }
        for (let y = h + 1; y <= top; y++) S.set(x, y, z, B.WHITE_CONCRETE);
        S.set(x, top + 1, z, B.WHITE_CONCRETE); S.set(x, top, z - 1, B.WHITE_CONCRETE); S.set(x, top, z + 1, B.WHITE_CONCRETE);
      } });
    }
    // solar field around the centre
    pieces.push({ r: [cx - 20, cz - 14, cx + 20, cz + 14], build: (S) => {
      for (let x = Math.max(S.x0, cx - 20); x <= Math.min(S.x1, cx + 20); x++) for (let z = Math.max(S.z0, cz - 14); z <= Math.min(S.z1, cz + 14); z++) {
        const h = self.ground(x, z); if (!self.flat && h < SEA) continue;
        const edge = x === cx - 20 || x === cx + 20 || z === cz - 14 || z === cz + 14;
        S.set(x, h, z, B.GRAVEL); for (let y = h + 1; y <= h + 4; y++) S.set(x, y, z, 0);
        if (edge) { if (!(z === cz - 14 && Math.abs(x - cx) <= 1)) S.set(x, h + 1, z, B.FENCE); continue; }
        if (Math.abs(x - cx) <= 3 && Math.abs(z - cz) <= 2) { const e = Math.abs(x - cx) === 3 || Math.abs(z - cz) === 2; for (let y = 1; y <= 4; y++) S.set(x, h + y, z, y === 4 ? B.STEEL : e ? (y <= 2 && z === cz - 2 && x === cx ? 0 : B.STEEL) : 0); if (x === cx + 1 && z === cz) { S.set(x, h + 1, z, B.SERVER_RACK, 2); S.set(x - 2, h + 1, z, B.COMPUTER, 2); } continue; }
        if ((z - cz) % 3 !== 0 && Math.abs(x - cx) > 4) S.set(x, h + 1, z, B.SOLAR_PANEL);
      }
    } });
    mobs.push({ type: 'villager', prof: 'worker', x: cx + 0.5, y: plan.y + 1, z: cz - 4.5 });
    mobs.push({ type: 'villager', prof: 'tech', x: cx - 6.5, y: plan.y + 1, z: cz - 16.5 });
    return plan;
  }

  // ---------- villages ----------
  makeVillage(cx, cz, biome, rnd) {
    const st = STYLES[biome] || STYLES[0]; const self = this;
    const y0 = this.ground(cx, cz);
    const pieces = [], occ = [], mobs = [];
    const plan = { type: 'village', x: cx, z: cz, y: y0, biome, style: st.name, pieces, mobs, r: null, name: villageName(rnd) };
    const overlaps = (r, m = 1) => occ.some((o) => r[0] - m <= o[2] && r[2] + m >= o[0] && r[1] - m <= o[3] && r[3] + m >= o[1]);
    // plaza + well + bell
    const plazaR = [cx - 5, cz - 5, cx + 5, cz + 5];
    occ.push(plazaR);
    pieces.push({ r: plazaR, build: (S) => {
      for (let x = plazaR[0]; x <= plazaR[2]; x++) for (let z = plazaR[1]; z <= plazaR[3]; z++) {
        if (!S.inClip(x, z)) continue;
        if (Math.abs(x - cx) === 5 && Math.abs(z - cz) === 5) continue;
        self.foundation(S, x, z, y0, biome === 2 ? B.SANDSTONE : B.PATH, st.base, 5);
      }
      // well 4x4 at cx-2..cx+1
      for (let x = cx - 2; x <= cx + 1; x++) for (let z = cz - 2; z <= cz + 1; z++) {
        const ring = x === cx - 2 || x === cx + 1 || z === cz - 2 || z === cz + 1;
        if (ring) { S.set(x, y0, z, B.COBBLE); S.set(x, y0 + 1, z, B.COBBLE); }
        else { S.set(x, y0, z, B.WATER); S.set(x, y0 - 1, z, B.WATER); S.set(x, y0 - 2, z, B.COBBLE); }
        const corner = (x === cx - 2 || x === cx + 1) && (z === cz - 2 || z === cz + 1);
        if (corner) { S.set(x, y0 + 2, z, B.FENCE); S.set(x, y0 + 3, z, B.FENCE); }
        S.set(x, y0 + 4, z, B.COBBLE);
      }
      S.set(cx, y0 + 5, cz, B.TORCH);
      // bell on a little stand
      S.set(cx + 3, y0, cz + 3, B.STONE_BRICKS); S.set(cx + 3, y0 + 1, cz + 3, B.BELL);
      for (const [lx, lz] of [[-4, -4], [4, -4], [-4, 4]]) { S.set(cx + lx, y0 + 1, cz + lz, B.FENCE); S.set(cx + lx, y0 + 2, cz + lz, B.FENCE); S.set(cx + lx, y0 + 3, cz + lz, B.TORCH); }
    } });
    // roads
    const roads = [];
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dx, dz] of dirs) {
      const L = 22 + Math.floor(rnd() * 16);
      roads.push({ ox: cx, oz: cz, dx, dz, s: 6, L });
      if (rnd() < 0.8) {
        const t = 12 + Math.floor(rnd() * (L - 16)); const side = rnd() < 0.5 ? 1 : -1;
        const pdx = -dz * side, pdz = dx * side;
        roads.push({ ox: cx + dx * t, oz: cz + dz * t, dx: pdx, dz: pdz, s: 2, L: 12 + Math.floor(rnd() * 10) });
      }
    }
    for (const rd of roads) {
      const r = rectOf([[rd.ox + rd.dx * rd.s - rd.dz, rd.oz + rd.dz * rd.s - rd.dx], [rd.ox + rd.dx * rd.L + rd.dz, rd.oz + rd.dz * rd.L + rd.dx]]);
      rd.r = r;
      pieces.push({ r, build: (S) => {
        for (let t = rd.s; t <= rd.L; t++) for (let k = -1; k <= 1; k++) {
          const x = rd.ox + rd.dx * t - rd.dz * k, z = rd.oz + rd.dz * t + rd.dx * k;
          if (!S.inClip(x, z)) continue;
          if (x >= plazaR[0] && x <= plazaR[2] && z >= plazaR[1] && z <= plazaR[3]) continue;
          const h = self.ground(x, z);
          if (self.isWater(x, z)) { S.set(x, SEA, z, B.PLANKS); for (let y = SEA + 1; y < SEA + 4; y++) S.set(x, y, z, 0); }
          else { S.set(x, h, z, biome === 2 ? B.SANDSTONE : (hash3(x, h, z, 5) < 0.12 ? B.GRAVEL : B.PATH)); for (let y = h + 1; y < h + 4; y++) S.set(x, y, z, 0); }
        }
      } });
    }
    for (const rd of roads) occ.push(rd.r);
    // building lots along roads
    const required = ['library', 'smith', 'church', 'farm', 'farm', 'pen', 'big', 'butcher'];
    shuffle(required, rnd);
    const SIZES = { small: [5, 5], big: [7, 7], farm: [9, 7], smith: [7, 7], library: [7, 7], church: [5, 9], pen: [7, 7], butcher: [5, 5] };
    let houses = 0;
    for (const rd of roads) {
      const px = -rd.dz, pz = rd.dx;
      for (let t = rd.s + 4; t < rd.L - 1; t += 8) {
        for (const side of [1, -1]) {
          const kind = required.length && rnd() < 0.8 ? required[0] : ['small', 'small', 'big', 'farm', 'small', 'pen'][Math.floor(rnd() * 6)];
          const [w, d] = SIZES[kind];
          const nx = px * side, nz = pz * side;
          const ax = rd.dx, az = rd.dz;
          const mx = rd.ox + rd.dx * t, mz = rd.oz + rd.dz * t;
          const lx0 = -Math.floor(w / 2);
          const ox = mx + ax * lx0 + nx * 3, oz = mz + az * lx0 + nz * 3;
          const P = (lx, lz) => [ox + ax * lx + nx * lz, oz + az * lx + nz * lz];
          const corners = [P(0, 0), P(w - 1, 0), P(0, d - 1), P(w - 1, d - 1), P(Math.floor(w / 2), Math.floor(d / 2))];
          const r = rectOf(corners);
          if (overlaps(r)) continue;
          if (corners.some(([x, z]) => self.isWater(x, z))) continue;
          const hs = corners.map(([x, z]) => self.ground(x, z));
          if (Math.max(...hs) - Math.min(...hs) > 5) continue;
          const [dxw, dzw] = P(Math.floor(w / 2), 0);
          const base = self.ground(dxw, dzw);
          if (base + 14 >= H) continue;
          occ.push(r);
          if (kind === required[0]) required.shift();
          const L = { ox, oz, ax, az, nx, nz, w, d, base, P, faceRoad: dirMeta(-nx, -nz), faceIn: dirMeta(nx, nz) };
          const fn = self['v_' + (kind === 'butcher' ? 'small' : kind)].bind(self);
          // doorstep path from road to door
          const step = [mx + nx * 2, mz + nz * 2];
          pieces.push({ r: rectOf([...corners, step]), build: (S) => {
            const [sx, sz] = step; if (S.inClip(sx, sz) && !self.isWater(sx, sz)) { const h = self.ground(sx, sz); S.set(sx, h, sz, biome === 2 ? B.SANDSTONE : B.PATH); for (let y = h + 1; y <= h + 3; y++) S.set(sx, y, sz, 0); }
            fn(S, L, st, kind);
          } });
          houses++;
          const at = (lx, ly, lz) => { const [x, z] = P(lx, lz); return { x: x + 0.5, y: base + ly, z: z + 0.5 }; };
          const prof = { farm: 'farmer', library: 'librarian', smith: 'smith', church: 'cleric', pen: 'shepherd', butcher: 'butcher', big: rnd() < 0.5 ? 'farmer' : 'mason', small: ['farmer', 'shepherd', 'nitwit', 'butcher'][Math.floor(rnd() * 4)] }[kind];
          mobs.push({ type: 'villager', prof, ...(kind === 'farm' ? at(2, 1, 2) : kind === 'pen' ? at(Math.floor(w / 2), 1, -2) : at(Math.floor(w / 2), 1, Math.floor(d / 2))) });
          if (kind === 'big') mobs.push({ type: 'villager', prof: 'farmer', ...at(2, 1, 2) });
          if (kind === 'pen') { const an = rnd() < 0.5 ? 'sheep' : 'cow'; for (let i = 0; i < 3; i++) mobs.push({ type: an, ...at(2 + i, 1, 3) }); }
        }
      }
      // lamp posts
      for (let t = rd.s + 2; t < rd.L; t += 9) {
        const side = (t >> 3) % 2 ? 1 : -1; const x = rd.ox + rd.dx * t + px * 2 * side, z = rd.oz + rd.dz * t + pz * 2 * side;
        const r = [x, z, x, z]; if (overlaps(r, 0) || self.isWater(x, z)) continue; occ.push(r);
        pieces.push({ r, build: (S) => { const h = self.ground(x, z); S.set(x, h, z, st.base); S.set(x, h + 1, z, B.FENCE); S.set(x, h + 2, z, B.FENCE); S.set(x, h + 3, z, B.TORCH); } });
      }
    }
    mobs.push({ type: 'villager', prof: 'nitwit', x: cx + 3.5, y: y0 + 1, z: cz - 3.5 });
    if (houses >= 4) mobs.push({ type: 'iron_golem', x: cx - 3.5, y: y0 + 1, z: cz + 3.5 });
    plan.r = occ.reduce((a, o) => [Math.min(a[0], o[0]), Math.min(a[1], o[1]), Math.max(a[2], o[2]), Math.max(a[3], o[3])], [cx, cz, cx, cz]);
    plan.houses = houses;
    return plan;
  }
  // fill below / set floor / clear above for one column
  foundation(S, x, z, base, top, fill, clear) {
    const h = this.ground(x, z);
    for (let y = Math.min(h + 1, base - 1); y < base; y++) S.set(x, y, z, fill);
    S.set(x, base, z, top);
    const ct = Math.max(h + 2, base + clear);
    for (let y = base + 1; y <= Math.min(H - 1, ct); y++) S.set(x, y, z, 0);
  }
  lotPrep(S, L, top, fill, clear) {
    for (let lx = 0; lx < L.w; lx++) for (let lz = 0; lz < L.d; lz++) { const [x, z] = L.P(lx, lz); if (S.inClip(x, z)) this.foundation(S, x, z, L.base, top, fill, clear); }
  }
  // generic house body with a gabled roof
  house(S, L, st, wallH, wall, cornerMat, floorMat, roofMat) {
    const { w, d, base, P } = L;
    this.lotPrep(S, L, floorMat, st.base, wallH + Math.ceil(w / 2) + 3);
    const set = (lx, ly, lz, id, m = 0) => { const [x, z] = P(lx, lz); S.set(x, base + ly, z, id, m); };
    const mid = Math.floor(w / 2);
    for (let ly = 1; ly <= wallH; ly++) for (let lx = 0; lx < w; lx++) for (let lz = 0; lz < d; lz++) {
      const edgeX = lx === 0 || lx === w - 1, edgeZ = lz === 0 || lz === d - 1;
      if (!edgeX && !edgeZ) continue;
      let id = (edgeX && edgeZ) ? cornerMat : wall;
      if (ly === 2 && !(edgeX && edgeZ) && ((edgeZ && lx % 2 === 1 && lx !== mid) || (edgeX && lz % 2 === 0 && lz > 0 && lz < d - 1))) id = B.GLASS;
      if (lz === 0 && lx === mid && ly <= 2) id = 0;
      set(lx, ly, lz, id);
    }
    // roof
    for (let k = 0; ; k++) {
      const xl = k - 1, xr = w - k, y = wallH + 1 + k;
      if (xl > xr) break;
      for (let lz = -1; lz <= d; lz++) {
        set(xl, y, lz, roofMat); set(xr, y, lz, roofMat);
        if (xl + 1 < xr) { set(xl + 1, y, lz, roofMat); set(xr - 1, y, lz, roofMat); }
      }
      for (let lx = xl + 2; lx <= xr - 2; lx++) { set(lx, y, 0, wall); set(lx, y, d - 1, wall); }
    }
    set(mid, wallH + 1, 0, wall);
    return set;
  }
  v_small(S, L, st, kind) {
    const set = this.house(S, L, st, 3, st.wall, st.log, st.floor, st.roof);
    set(1, 1, L.d - 2, B.BED); set(L.w - 2, 1, L.d - 2, kind === 'butcher' ? B.FURNACE : B.TABLE, L.faceRoad);
    set(1, 1, 1, B.TORCH);
    if (kind === 'butcher') { set(L.w - 2, 1, 1, B.CHEST, L.faceRoad); const [x, z] = L.P(L.w - 2, 1); S.loot(x, L.base + 1, z, 'butcher'); }
  }
  v_big(S, L, st) {
    const set = this.house(S, L, st, 4, st.wall, st.log, st.floor, st.roof);
    set(1, 1, L.d - 2, B.BED); set(2, 1, L.d - 2, B.BED); set(L.w - 2, 1, L.d - 2, B.TABLE, L.faceRoad);
    set(L.w - 2, 1, L.d - 3, B.CHEST, L.faceRoad); const [x, z] = L.P(L.w - 2, L.d - 3); S.loot(x, L.base + 1, z, 'house');
    set(1, 1, 1, B.TORCH); set(L.w - 2, 1, 1, B.TORCH); set(1, 1, 3, B.BOOKSHELF); set(L.w - 2, 1, 3, B.HAY);
  }
  v_library(S, L, st) {
    const set = this.house(S, L, st, 4, st.wall === B.SANDSTONE ? B.SANDSTONE : B.PLANKS, st.log, st.floor, st.roof);
    for (let lz = 1; lz < L.d - 1; lz++) for (const lx of [1, L.w - 2]) if (lz !== 2 && lz !== 4) { set(lx, 1, lz, B.BOOKSHELF); set(lx, 2, lz, B.BOOKSHELF); }
    for (let lx = 1; lx < L.w - 1; lx++) { set(lx, 1, L.d - 2, B.BOOKSHELF); set(lx, 2, L.d - 2, B.BOOKSHELF); }
    set(3, 1, 3, B.TABLE, L.faceRoad); set(2, 1, 1, B.TORCH); set(L.w - 3, 1, 1, B.TORCH);
    set(4, 1, 3, B.CHEST, L.faceRoad); const [x, z] = L.P(4, 3); S.loot(x, L.base + 1, z, 'library');
  }
  v_smith(S, L, st) {
    const { w, d, base, P } = L;
    this.lotPrep(S, L, B.COBBLE, st.base, 7);
    const set = (lx, ly, lz, id, m = 0) => { const [x, z] = P(lx, lz); S.set(x, base + ly, z, id, m); };
    for (let ly = 1; ly <= 4; ly++) for (let lx = 0; lx < w; lx++) for (let lz = 0; lz < d; lz++) {
      const edgeX = lx === 0 || lx === w - 1, edgeZ = lz === 0 || lz === d - 1; if (!edgeX && !edgeZ) continue;
      if (lz < 3) { if (edgeX && (lz === 0)) set(lx, ly, lz, st.log); continue; }
      set(lx, ly, lz, (edgeX && edgeZ) ? st.log : B.COBBLE);
      if (ly === 2 && lz === d - 1 && lx === 3) set(lx, ly, lz, B.GLASS);
    }
    for (let lx = -1; lx <= w; lx++) for (let lz = -1; lz <= d; lz++) set(lx, 5, lz, lz < 3 ? st.roof : B.COBBLE);
    set(1, 1, d - 2, B.FURNACE, L.faceRoad); set(2, 1, d - 2, B.FURNACE, L.faceRoad);
    set(w - 2, 1, d - 2, B.CHEST, L.faceRoad); const [x, z] = P(w - 2, d - 2); S.loot(x, base + 1, z, 'smith');
    set(w - 2, 1, 3, B.TABLE, L.faceRoad);
    // lava basin
    set(1, 0, 3, B.LAVA); set(1, 0, 4, B.LAVA); set(2, 1, 3, B.COBBLE); set(2, 1, 4, B.COBBLE);
    set(1, 1, 2, B.COBBLE); set(1, 1, 5, B.COBBLE); set(1, -1, 3, B.COBBLE); set(1, -1, 4, B.COBBLE);
    set(3, 4, 4, B.GLOWSTONE);
  }
  v_church(S, L, st) {
    const wall = st.wall === B.SANDSTONE ? B.SANDSTONE : B.COBBLE;
    const set = this.house(S, L, st, 5, wall, B.STONE_BRICKS, B.STONE_BRICKS, wall === B.SANDSTONE ? B.TERRACOTTA : B.STONE_BRICKS);
    // tower at the back
    const { w, d } = L;
    for (let ly = 1; ly <= 12; ly++) for (let lx = 1; lx <= 3; lx++) for (let lz = d - 3; lz <= d - 1; lz++) {
      const inner = lx === 2 && lz === d - 2;
      set(lx, ly, lz, inner ? (ly === 1 ? B.BOOKSHELF : 0) : (ly >= 9 && ly <= 10 && (lx === 2 || lz === d - 2)) ? 0 : wall);
    }
    for (let lx = 1; lx <= 3; lx++) for (let lz = d - 3; lz <= d - 1; lz++) set(lx, 13, lz, wall);
    set(2, 9, d - 2, B.BELL); set(2, 14, d - 2, B.FENCE); set(2, 15, d - 2, B.TORCH);
    set(2, 1, d - 4, B.BOOKSHELF); set(1, 1, 1, B.TORCH); set(w - 2, 1, 1, B.TORCH); set(w - 2, 1, d - 4, B.GLOWSTONE);
    set(2, 3, 0, B.GLASS); set(2, 4, 0, B.GLASS);
  }
  v_farm(S, L, st) {
    const { w, d, base, P } = L;
    for (let lx = 0; lx < w; lx++) for (let lz = 0; lz < d; lz++) {
      const [x, z] = P(lx, lz); if (!S.inClip(x, z)) continue;
      const edge = lx === 0 || lz === 0 || lx === w - 1 || lz === d - 1;
      const water = lx === Math.floor(w / 2) && !edge;
      this.foundation(S, x, z, base, edge ? st.log : water ? B.WATER : B.FARMLAND, B.DIRT, 3);
      if (!edge && !water) {
        const r = hash3(x, base, z, 77); const stage = r < 0.55 ? 3 : r < 0.75 ? 2 : r < 0.9 ? 1 : 0;
        S.set(x, base + 1, z, B.WHEAT_0 + stage); S.crop(x, base + 1, z);
      }
      if (water) S.set(x, base - 1, z, B.DIRT);
    }
    const [hx, hz] = P(0, -1); if (S.inClip(hx, hz) && !this.isWater(hx, hz)) { const h = this.ground(hx, hz); S.set(hx, h + 1, hz, B.HAY); S.set(hx, h + 2, hz, 0); }
  }
  v_pen(S, L, st) {
    const { w, d, base, P } = L;
    for (let lx = 0; lx < w; lx++) for (let lz = 0; lz < d; lz++) {
      const [x, z] = P(lx, lz); if (!S.inClip(x, z)) continue;
      const edge = lx === 0 || lz === 0 || lx === w - 1 || lz === d - 1;
      this.foundation(S, x, z, base, st.name === 'desert' ? B.SAND : B.GRASS, B.DIRT, 3);
      if (edge) S.set(x, base + 1, z, B.FENCE);
    }
    const set = (lx, ly, lz, id) => { const [x, z] = P(lx, lz); S.set(x, base + ly, z, id); };
    set(w - 2, 1, d - 2, B.HAY); set(w - 2, 2, d - 2, B.HAY); set(w - 3, 1, d - 2, B.HAY); set(0, 2, 0, B.TORCH); set(w - 1, 2, 0, B.TORCH);
  }

  // ---------- cities ----------
  makeCity(cx, cz, rnd) {
    const NB = 5, P = 26, RW = 7, SZ = NB * P + RW; const half = Math.floor(SZ / 2);
    const x0 = cx - half, z0 = cz - half;
    const hs = []; let wet = 0, high = 0;
    for (let i = 0; i <= 7; i++) for (let j = 0; j <= 7; j++) {
      const x = x0 + Math.round(i * SZ / 7), z = z0 + Math.round(j * SZ / 7); const c = this.w.column(x, z);
      if (!this.flat && c.h < SEA) wet++; if (c.h > 60 || c.biome === 4) high++; hs.push(c.h);
    }
    if (wet > 14 || high > 6) return null;
    hs.sort((a, b) => a - b);
    const base = this.flat ? 4 : Math.max(SEA + 2, Math.min(SEA + 10, hs[Math.floor(hs.length / 2)]));
    const pieces = [], mobs = [];
    const plan = { type: 'city', x: cx, z: cz, y: base, pieces, mobs, r: [x0 - 5, z0 - 5, x0 + SZ + 4, z0 + SZ + 4], name: cityName(rnd),
      grid: { x0, z0, P, RW, SZ, NB, base }, signals: [], screens: [], parked: [], turbines: [], kinds: [] };
    const self = this;
    const roadInfo = (lu, lv) => {
      const inX = lu >= 0 && lu < SZ && (lu % P) < RW, inZ = lv >= 0 && lv < SZ && (lv % P) < RW; const k = lu % P, k2 = lv % P;
      return { inX, inZ, k, k2 };
    };
    // traffic signals: two diagonal corners of every intersection
    for (let i = 0; i <= NB; i++) for (let j = 0; j <= NB; j++) {
      const ix = x0 + i * P, iz = z0 + j * P;
      plan.signals.push({ x: ix, y: base + 4, z: iz }, { x: ix + RW - 1, y: base + 4, z: iz + RW - 1 });
    }
    // terrain + roads + street lights + signals
    pieces.push({ r: plan.r, build: (S) => {
      const ax0 = Math.max(S.x0, plan.r[0]), ax1 = Math.min(S.x1, plan.r[2]), az0 = Math.max(S.z0, plan.r[1]), az1 = Math.min(S.z1, plan.r[3]);
      for (let x = ax0; x <= ax1; x++) for (let z = az0; z <= az1; z++) {
        const lu = x - x0, lv = z - z0; const h = self.ground(x, z);
        const inside = lu >= 0 && lu < SZ && lv >= 0 && lv < SZ;
        if (!inside) {
          const dd = Math.max(lu < 0 ? -lu : lu >= SZ ? lu - SZ + 1 : 0, lv < 0 ? -lv : lv >= SZ ? lv - SZ + 1 : 0);
          const th = Math.round(base + (h - base) * dd / 6);
          if (!this.flat && h < SEA && th <= SEA) continue;
          for (let y = Math.min(h, th); y < th; y++) S.set(x, y, z, B.DIRT);
          S.set(x, th, z, B.GRASS);
          for (let y = th + 1; y <= Math.max(h, th) + 2; y++) S.set(x, y, z, 0);
          continue;
        }
        for (let y = Math.min(h, base - 1); y < base; y++) S.set(x, y, z, B.STONE);
        for (let y = base + 1; y <= Math.max(h, base) + 2; y++) S.set(x, y, z, 0);
        const { inX, inZ, k, k2 } = roadInfo(lu, lv);
        let top = B.GRASS;
        if (inX || inZ) {
          const asph = (inX && k >= 1 && k <= 5) || (inZ && k2 >= 1 && k2 <= 5);
          top = asph ? B.ASPHALT : B.SMOOTH_STONE;
          if (asph && inX && !inZ && k === 3 && (k2 > RW + 2 && k2 < P - 3)) top = B.YELLOW_CONCRETE;
          if (asph && inZ && !inX && k2 === 3 && (k > RW + 2 && k < P - 3)) top = B.YELLOW_CONCRETE;
          if (asph && inX && !inZ && (k === 2 || k === 4) && (k2 === RW + 1 || k2 === P - 2)) top = B.ROAD_LINE; // stop lines
          if (asph && inX && !inZ && (k2 === RW || k2 === P - 1) && (k % 2 === 1)) top = B.WHITE_CONCRETE; // crosswalks
          if (asph && inZ && !inX && (k === RW || k === P - 1) && (k2 % 2 === 1)) top = B.WHITE_CONCRETE;
          const light = (inX && !inZ && (k === 0 || k === RW - 1) && (lv % 13) === 5) || (inZ && !inX && (k2 === 0 || k2 === RW - 1) && (lu % 13) === 5);
          if (light) { for (let y = 1; y <= 5; y++) S.set(x, base + y, z, B.STEEL_POLE); S.set(x, base + 6, z, B.LAMP); }
          if (inX && inZ && ((k === 0 && k2 === 0) || (k === RW - 1 && k2 === RW - 1))) { for (let y = 1; y <= 3; y++) S.set(x, base + y, z, B.STEEL_POLE); S.set(x, base + 4, z, B.TRAFFIC_LIGHT); }
          // planters / benches along sidewalks
          if (!asph && !(inX && inZ) && ((inX && (lv % 13) === 9) || (inZ && (lu % 13) === 9))) S.set(x, base, z, B.PLANTER);
        }
        S.set(x, base, z, top);
      }
    } });
    // ---- lots ----
    const inner = [], outer = [];
    for (let i = 0; i < NB; i++) for (let j = 0; j < NB; j++) {
      if (i === 2 && j === 2) continue;
      ((i >= 1 && i <= 3 && j >= 1 && j <= 3) ? inner : outer).push([i, j]);
    }
    shuffle(inner, rnd); shuffle(outer, rnd);
    const assign = [[2, 2, 'plaza']];
    inner.forEach(([i, j], n) => assign.push([i, j, n === 0 ? 'techhq' : rnd() < 0.72 ? 'skyscraper' : 'office']));
    const must = ['hospital', 'mall', 'evstation', 'datacenter', 'police', rnd() < 0.7 ? 'stadium' : 'park', 'construction', 'parking'];
    outer.forEach(([i, j], n) => { const r = rnd(); assign.push([i, j, must[n] || (r < 0.38 ? 'apartment' : r < 0.6 ? 'shops' : r < 0.72 ? 'park' : r < 0.86 ? 'office' : 'skyscraper')]); });
    for (const [i, j, kind] of assign) {
      const lx0 = x0 + RW + i * P, lz0 = z0 + RW + j * P, n = P - RW; // 19x19
      const lot = { x0: lx0, z0: lz0, n, base, centre: kind !== 'office' && inner.some((q) => q[0] === i && q[1] === j), seed: (rnd() * 1e9) | 0, plan };
      plan.kinds.push(kind);
      const spec = this['spec_' + kind] ? this['spec_' + kind](lot) : null; lot.spec = spec;
      pieces.push({ r: [lx0, lz0, lx0 + n - 1, lz0 + n - 1], build: (S) => self['c_' + kind](S, lot) });
      const mx = lx0 + n / 2, mz = lz0 + n / 2, y = base + 1;
      const add = (prof, dx, dz) => mobs.push({ type: 'villager', prof, x: mx + dx, y, z: mz + dz });
      const M = {
        plaza: () => { add('citizen', -3, -4); add('shopper', 3, -3); add('tech', 0, -6); add('citizen', 4, 4); },
        techhq: () => { add('tech', -1, -1); add('tech', 1, -2); }, skyscraper: () => add('citizen', -1, -2), office: () => add('citizen', 0, -2),
        hospital: () => { add('doctor', -1, -2); add('doctor', 2, 0); }, mall: () => { add('shopper', -2, -3); add('shopper', 3, -1); add('citizen', 0, 2); },
        evstation: () => add('worker', 0, -3), datacenter: () => add('tech', 2, -2), police: () => { add('officer', -1, -2); add('officer', 1, -1); },
        stadium: () => { add('citizen', 0, -7); add('shopper', 2, -8); }, construction: () => { add('worker', -4, -6); add('worker', 3, -6); }, parking: () => add('citizen', 0, 0),
        apartment: () => add('citizen', 0, 0), shops: () => { add('shopper', -4, -3); add('mason', 4, -3); }, park: () => { add('citizen', 2, 1); add('farmer', -3, -2); },
      };
      (M[kind] || (() => {}))();
    }
    mobs.push({ type: 'iron_golem', x: x0 + RW + P - 3.5, y: base + 1, z: z0 + 3.5 });
    mobs.push({ type: 'iron_golem', x: x0 + SZ - 3.5, y: base + 1, z: z0 + SZ - 3.5 });
    return plan;
  }
  // ---------- modern towers ----------
  // spec: { tiers:[{m|R, floors}], glass, frame, lit, office, round, helipad, antenna, led }
  modernTower(S, lot, sp) {
    const { x0, z0, n, base } = lot; const mid = Math.floor(n / 2); const hs = []; let acc = 0;
    for (const t of sp.tiers) { acc += t.floors * 4; hs.push(acc); }
    const total = acc;
    const inT = (t, lx, lz) => { const T = sp.tiers[t]; if (sp.round) return (lx - mid) ** 2 + (lz - mid) ** 2 <= T.R * T.R; return lx >= T.m && lx <= n - 1 - T.m && lz >= T.m && lz <= n - 1 - T.m; };
    const edgeT = (t, lx, lz) => !inT(t, lx - 1, lz) || !inT(t, lx + 1, lz) || !inT(t, lx, lz - 1) || !inT(t, lx, lz + 1);
    const coreX = sp.helipad ? mid - 2 : mid, isCore = (lx, lz) => Math.abs(lx - coreX) <= 1 && Math.abs(lz - mid) <= 1;
    const T0 = sp.tiers[0], a0 = sp.round ? mid - T0.R : T0.m;
    for (let lx = 0; lx < n; lx++) for (let lz = 0; lz < n; lz++) {
      const x = x0 + lx, z = z0 + lz; if (!S.inClip(x, z)) continue;
      if (!inT(0, lx, lz)) continue;
      let own = 0; for (let t = 0; t < hs.length; t++) if (inT(t, lx, lz)) own = t;
      const ownTop = hs[own];
      const core = isCore(lx, lz);
      const maxY = core ? total + 3 : ownTop + 1;
      for (let ly = 0; ly <= maxY; ly++) {
        const y = base + ly; if (y >= H - 1) break;
        let t = 0; while (t < hs.length - 1 && ly >= hs[t]) t++;
        const f = Math.floor(ly / 4), fl = ly % 4; let id = 0;
        if (core) {
          id = sp.frame === B.STEEL ? B.GRAY_CONCRETE : B.STEEL;
          if (lx === coreX && lz === mid - 1 && fl === 1 && ly <= total + 1) { S.set(x, y, z, B.ELEVATOR, 2); continue; }
          if (lx === coreX && lz === mid - 1 && fl === 2 && ly <= total + 2) id = 0;
          if (ly === 0) id = B.MARBLE;
          if (ly === total + 3) id = sp.frame;
        } else if (ly > ownTop) {
          id = edgeT(own, lx, lz) && !sp.helipad ? sp.frame : 0;
        } else if (ly === ownTop) id = edgeT(own, lx, lz) ? sp.frame : B.GRAY_CONCRETE;
        else if (edgeT(t, lx, lz) && inT(t, lx, lz)) {
          const along = (lx + lz) % 5 === 0;
          if (fl === 0) id = sp.frame;
          else if (!sp.round && along) id = sp.frame;
          else id = hash3(x * 3 + (lz & 1), f, z * 7, 77) < sp.lit ? B.LIT_WINDOW : sp.glass;
          if (ly >= 1 && ly <= 2 && lz <= a0 + 1 && Math.abs(lx - mid) <= 1) id = 0; // entrance
        } else if (inT(t, lx, lz)) {
          if (fl === 0) { id = ly === 0 ? B.MARBLE : B.WHITE_CONCRETE; if (ly > 0 && lx % 4 === 1 && lz % 4 === 1) id = B.GLOWSTONE; }
          else if (fl === 1 && sp.office && f > 0 && lx % 4 === 3 && lz % 5 === 2 && !isCore(lx, lz + 1) && !isCore(lx, lz - 1)) { S.set(x, y, z, B.COMPUTER, (lx + lz) & 3); continue; }
        }
        S.set(x, y, z, id);
      }
      // rooftop features
      const ry = base + ownTop + 1;
      if (own === hs.length - 1 && !core) {
        if (sp.helipad && Math.abs(lx - (mid + 2)) <= 2 && Math.abs(lz - mid) <= 2) S.set(x, base + ownTop, z, B.HELIPAD);
        else if (!sp.helipad && (lx * 7 + lz * 3) % 11 === 0 && !edgeT(own, lx, lz)) S.set(x, ry, z, B.AC_UNIT, 0);
        else if (sp.solar && lz % 2 === 0 && !edgeT(own, lx, lz)) S.set(x, ry, z, B.SOLAR_PANEL);
      }
      if (core && lx === coreX && lz === mid && sp.antenna) { for (let k = 0; k < 10; k++) if (base + total + 4 + k < H - 1) S.set(x, base + total + 4 + k, z, B.STEEL_POLE); if (base + total + 14 < H) S.set(x, base + total + 14, z, B.LAMP); }
    }
    // lobby: reception + loot
    S.set(x0 + mid + 3, base + 1, z0 + mid - 3, B.CHEST, 2); S.loot(x0 + mid + 3, base + 1, z0 + mid - 3, 'city');
    S.set(x0 + mid - 4, base + 1, z0 + mid - 3, B.COMPUTER, 2);
    if (sp.led) for (const s of sp.led) for (let i = 0; i < s.w; i++) for (let j = 0; j < s.h; j++) S.set(s.x + (s.axis === 'x' ? i : 0), s.y + j, s.z + (s.axis === 'z' ? i : 0), s.block || B.LED_AD);
    return total;
  }
  towerScreen(lot, sp, block) {
    const mid = Math.floor(lot.n / 2); let acc = 0; for (const t of sp.tiers) acc += t.floors * 4;
    const T = sp.tiers[sp.tiers.length - 1]; const half = sp.round ? Math.floor(T.R * 0.6) : Math.min(4, mid - T.m - 1);
    const a = sp.round ? mid - T.R : T.m;
    const s = { x: lot.x0 + mid - half, y: lot.base + acc - 3, z: lot.z0 + a, w: half * 2 + 1, h: 3, axis: 'x', dir: -1, block };
    if (s.y + s.h >= H - 2) return;
    sp.led = sp.led || []; sp.led.push(s); lot.plan.screens.push(s);
  }
  spec_skyscraper(lot) {
    const r = mulberry32(lot.seed); const maxF = Math.floor((H - 22 - lot.base) / 4);
    const floors = Math.max(6, Math.min(maxF, (lot.centre ? 13 : 8) + Math.floor(r() * 8)));
    const f1 = Math.ceil(floors * (0.4 + r() * 0.2)), f2 = Math.ceil((floors - f1) * 0.6), f3 = floors - f1 - f2;
    const tiers = [{ m: 2, floors: f1 }, { m: 3, floors: f2 }]; if (f3 > 0) tiers.push({ m: r() < 0.5 ? 4 : 5, floors: f3 });
    const glass = [B.GLASS_BLUE, B.GLASS_DARK, B.GLASS_BLUE, B.WINDOW][Math.floor(r() * 4)];
    const frame = [B.STEEL, B.WHITE_CONCRETE, B.BLACK_CONCRETE, B.STEEL][Math.floor(r() * 4)];
    const sp = { tiers, glass, frame, lit: 0.12 + r() * 0.2, office: true, helipad: tiers[tiers.length - 1].m <= 4 && r() < 0.5, antenna: r() < 0.6, solar: r() < 0.3 };
    if (r() < 0.5) this.towerScreen(lot, sp, B.LED_AD);
    return sp;
  }
  spec_techhq(lot) {
    const r = mulberry32(lot.seed); const maxF = Math.floor((H - 22 - lot.base) / 4);
    const floors = Math.min(maxF, 15 + Math.floor(r() * 4));
    const sp = { round: true, tiers: [{ R: 8, floors: Math.ceil(floors * 0.55) }, { R: 7, floors: Math.floor(floors * 0.3) }, { R: 5, floors: floors - Math.ceil(floors * 0.55) - Math.floor(floors * 0.3) }], glass: B.GLASS_BLUE, frame: B.WHITE_CONCRETE, lit: 0.3, office: true, antenna: true, solar: true };
    this.towerScreen(lot, sp, B.LED_SCREEN);
    return sp;
  }
  spec_office(lot) {
    const r = mulberry32(lot.seed); const floors = 5 + Math.floor(r() * 5);
    return { tiers: [{ m: 2, floors }], glass: r() < 0.5 ? B.GLASS_DARK : B.WINDOW, frame: [B.GRAY_CONCRETE, B.WHITE_CONCRETE, B.STEEL][Math.floor(r() * 3)], lit: 0.25, office: true, solar: r() < 0.6 };
  }
  c_skyscraper(S, lot) { this.modernTower(S, lot, lot.spec); this.plazaRing(S, lot, 2); }
  c_techhq(S, lot) { this.modernTower(S, lot, lot.spec); this.plazaRing(S, lot, 0); for (const [qx, qz] of [[1, 1], [17, 1], [1, 17], [17, 17]]) { S.set(lot.x0 + qx, lot.base + 1, lot.z0 + qz, B.SERVER_RACK, 2); } }
  c_office(S, lot) { this.modernTower(S, lot, lot.spec); this.plazaRing(S, lot, 2); }
  plazaRing(S, lot, m) {
    for (let lx = 0; lx < lot.n; lx++) for (let lz = 0; lz < lot.n; lz++) {
      const x = lot.x0 + lx, z = lot.z0 + lz; if (!S.inClip(x, z)) continue;
      if (S.get && S.get(x, lot.base + 1, z)) continue;
      const r = hash3(x, 3, z, 13); S.set(x, lot.base, z, (lx + lz) % 2 ? B.SMOOTH_STONE : B.MARBLE);
      if ((lx === 0 || lz === 0 || lx === lot.n - 1 || lz === lot.n - 1) && (lx + lz) % 6 === 3 && r < 0.9) S.set(x, lot.base, z, B.PLANTER);
    }
  }
  c_plaza(S, lot) {
    const { x0, z0, n, base } = lot; const c = Math.floor(n / 2);
    for (let lx = 0; lx < n; lx++) for (let lz = 0; lz < n; lz++) {
      const x = x0 + lx, z = z0 + lz; if (!S.inClip(x, z)) continue;
      S.set(x, base, z, (Math.floor(lx / 2) + Math.floor(lz / 2)) % 2 ? B.MARBLE : B.SMOOTH_STONE);
      for (let y = 1; y < 14; y++) S.set(x, base + y, z, 0);
    }
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
      const x = x0 + c + dx, z = z0 + c + dz - 1; const ring = Math.abs(dx) === 2 || Math.abs(dz) === 2;
      if (ring) S.set(x, base + 1, z, B.MARBLE); else { S.set(x, base, z, B.WATER); S.set(x, base - 1, z, B.MARBLE); }
    }
    S.set(x0 + c, base, z0 + c - 1, B.MARBLE); S.set(x0 + c, base + 1, z0 + c - 1, B.MARBLE); S.set(x0 + c, base + 2, z0 + c - 1, B.SHROOMLIGHT);
    for (const [qx, qz] of [[3, 3], [n - 4, 3], [3, n - 6], [n - 4, n - 6]]) {
      const x = x0 + qx, z = z0 + qz; const r = hash3(x, 5, z, 31); S.set(x, base, z, B.DIRT);
      this.w.oak((xx, yy, zz, id) => S.set(xx, yy, zz, id), x, base + 1, z, r, B.BIRCH_LOG, B.BIRCH_LEAVES, 0);
    }
    for (const s of lot.spec.led) {
      for (let i = 0; i < s.w; i++) for (let j = 0; j < s.h; j++) S.set(s.x + (s.axis === 'x' ? i : 0), s.y + j, s.z + (s.axis === 'z' ? i : 0), s.block);
      // supports
      if (s.axis === 'x') for (let y = 1; y < s.y - base + s.h + 1; y++) { S.set(s.x - 1, base + y, s.z, B.STEEL); S.set(s.x + s.w, base + y, s.z, B.STEEL); }
      else for (let y = 1; y < s.y - base + s.h + 1; y++) { S.set(s.x, base + y, s.z - 1, B.STEEL); S.set(s.x, base + y, s.z + s.w, B.STEEL); }
      if (s.axis === 'x') for (let i = -1; i <= s.w; i++) S.set(s.x + i, s.y + s.h, s.z, B.STEEL);
    }
    S.set(x0 + 2, base + 1, z0 + 1, B.VENDING, 2); S.set(x0 + 3, base + 1, z0 + 1, B.ATM, 2); S.set(x0 + n - 3, base + 1, z0 + 1, B.VENDING, 2);
  }
  spec_plaza(lot) {
    const { x0, z0, n, base } = lot;
    const big = { x: x0 + 3, y: base + 4, z: z0 + n - 1, w: n - 6, h: 7, axis: 'x', dir: -1, block: B.LED_SCREEN, big: true };
    const l = { x: x0, y: base + 3, z: z0 + 5, w: 6, h: 4, axis: 'z', dir: 1, block: B.LED_AD2 };
    const rr = { x: x0 + n - 1, y: base + 3, z: z0 + 5, w: 6, h: 4, axis: 'z', dir: -1, block: B.LED_AD };
    const led = [big, l, rr]; for (const s of led) lot.plan.screens.push(s);
    return { led };
  }
  pave(S, lot, id, lz0 = 0, lz1 = lot.n - 1, lx0 = 0, lx1 = lot.n - 1) {
    for (let lx = lx0; lx <= lx1; lx++) for (let lz = lz0; lz <= lz1; lz++) { const x = lot.x0 + lx, z = lot.z0 + lz; if (S.inClip(x, z)) S.set(x, lot.base, z, id); }
  }
  park(lot, lx, lz, axis, color) { lot.plan.parked.push({ x: lot.x0 + lx + 0.5, y: lot.base + 1, z: lot.z0 + lz + 0.5, yaw: axis === 'x' ? Math.PI / 2 : 0, color }); }
  spec_hospital(lot) { this.park(lot, 6, 1, 'x', 0xf4f4f4); this.park(lot, 12, 1, 'x', 0xf4f4f4); return {}; }
  c_hospital(S, lot) {
    const { x0, z0, n, base } = lot; const c = Math.floor(n / 2);
    this.pave(S, lot, B.SMOOTH_STONE);
    const top = this.tallBuilding(S, lot, 3, 5, B.WHITE_CONCRETE, B.GLASS_BLUE, 'bands', B.WHITE_CONCRETE);
    for (const [dx, dy] of [[0, -1], [0, 0], [0, 1], [-1, 0], [1, 0]]) S.set(x0 + c + dx, base + top - 2 + dy, z0 + 3, B.HOSPITAL_SIGN);
    for (let f = 1; f < 5; f++) for (let k = 0; k < 3; k++) { S.set(x0 + 6 + k * 3, base + f * 4 + 1, z0 + n - 5, B.BED); S.set(x0 + 6 + k * 3, base + f * 4 + 1, z0 + n - 6, B.WHITE_CONCRETE); }
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) S.set(x0 + c + dx + 1, base + top, z0 + c + dz, B.HELIPAD);
    S.set(x0 + c + 3, base + 1, z0 + c, B.COMPUTER, 2); S.set(x0 + 5, base + 1, z0 + 5, B.VENDING, 0);
  }
  spec_mall(lot) { const s = { x: lot.x0 + 4, y: lot.base + 9, z: lot.z0 + 1, w: 11, h: 3, axis: 'x', dir: -1, block: B.LED_AD2 }; lot.plan.screens.push(s); return { led: [s] }; }
  c_mall(S, lot) {
    const { x0, z0, n, base } = lot;
    this.pave(S, lot, B.MARBLE);
    this.tallBuilding(S, lot, 1, 3, B.WHITE_CONCRETE, B.GLASS_BLUE, 'curtain', B.MARBLE);
    for (const s of lot.spec.led) for (let i = 0; i < s.w; i++) for (let j = 0; j < s.h; j++) S.set(s.x + i, s.y + j, s.z, s.block);
    for (let f = 0; f < 3; f++) {
      const y = base + f * 4 + 1;
      for (let lz = 4; lz < n - 3; lz += 2) S.set(x0 + n - 3, y, z0 + lz, f === 0 ? B.VENDING : B.TV, 3);
      for (let lx = 5; lx < n - 4; lx += 3) { S.set(x0 + lx, y, z0 + n - 3, f % 2 ? B.RED_WOOL : B.BLUE_WOOL); S.set(x0 + lx + 1, y, z0 + n - 3, B.CHEST, 2); S.loot(x0 + lx + 1, y, z0 + n - 3, 'mall'); }
    }
    S.set(x0 + 6, base + 1, z0 + 3, B.ATM, 0); S.set(x0 + 12, base + 1, z0 + 3, B.ATM, 0);
  }
  spec_evstation(lot) { for (const lx of [5, 9, 13]) { this.park(lot, lx, 7, 'z', [0xd8202a, 0xf0f0f0, 0x2a5ad8, 0x202020][lx % 4]); } this.park(lot, 9, 11, 'z', 0x3aa04a); return {}; }
  c_evstation(S, lot) {
    const { x0, z0, n, base } = lot;
    for (let lx = 0; lx < n; lx++) for (let lz = 0; lz < n; lz++) { const x = x0 + lx, z = z0 + lz; if (!S.inClip(x, z)) continue; S.set(x, base, z, lz >= 15 ? B.SMOOTH_STONE : (lx % 4 === 3 && lz > 4 && lz < 14) ? B.ROAD_LINE : B.ASPHALT); }
    for (let lx = 2; lx <= 16; lx++) for (let lz = 4; lz <= 13; lz++) { const x = x0 + lx, z = z0 + lz; S.set(x, base + 6, z, (lx % 4 === 1 && lz % 3 === 0) ? B.LAMP : B.WHITE_CONCRETE); if (lz === 4) S.set(x, base + 6, z, B.LED_SCREEN); }
    for (const [qx, qz] of [[3, 5], [15, 5], [3, 12], [15, 12]]) for (let y = 1; y <= 5; y++) S.set(x0 + qx, base + y, z0 + qz, B.STEEL);
    for (const lx of [5, 9, 13]) { S.set(x0 + lx, base + 1, z0 + 9, B.EV_CHARGER); S.set(x0 + lx + 1, base + 1, z0 + 9, B.EV_CHARGER); }
    for (let lx = 3; lx <= 15; lx++) for (let lz = 15; lz <= 18; lz++) for (let ly = 1; ly <= 5; ly++) {
      const edge = lx === 3 || lx === 15 || lz === 15 || lz === 18; let id = 0;
      if (ly === 5) id = B.WHITE_CONCRETE; else if (edge) id = lz === 15 && ly <= 3 && lx > 3 && lx < 15 ? (Math.abs(lx - 9) <= 0 && ly <= 2 ? 0 : B.GLASS_BLUE) : B.WHITE_CONCRETE;
      S.set(x0 + lx, base + ly, z0 + lz, id);
    }
    S.set(x0 + 5, base + 1, z0 + 17, B.VENDING, 2); S.set(x0 + 7, base + 1, z0 + 17, B.ATM, 2); S.set(x0 + 12, base + 1, z0 + 17, B.CHEST, 2); S.loot(x0 + 12, base + 1, z0 + 17, 'mall');
    S.set(x0 + 9, base + 4, z0 + 17, B.GLOWSTONE);
  }
  c_datacenter(S, lot) {
    const { x0, z0, n, base } = lot;
    this.pave(S, lot, B.SMOOTH_STONE);
    const top = this.tallBuilding(S, lot, 2, 2, B.STEEL, B.GLASS_DARK, 'bands', B.GRAY_CONCRETE);
    for (let f = 0; f < 2; f++) for (const lz of [6, 9, 12, 15]) for (let lx = 5; lx <= 14; lx++) { S.set(x0 + lx, base + f * 4 + 1, z0 + lz, B.SERVER_RACK, 2); S.set(x0 + lx, base + f * 4 + 2, z0 + lz, B.SERVER_RACK, 2); }
    for (let lx = 3; lx <= n - 4; lx++) for (let lz = 3; lz <= n - 4; lz++) if (lz % 2 === 1) S.set(x0 + lx, base + top + 1, z0 + lz, lx > n - 7 && lz > n - 8 ? B.AC_UNIT : B.SOLAR_PANEL);
    for (let lx = 0; lx < n; lx++) for (const lz of [0, n - 1]) S.set(x0 + lx, base + 1, z0 + lz, (lz === 0 && Math.abs(lx - 9) <= 1) ? 0 : B.FENCE);
    S.set(x0 + 9, base + 1, z0 + 4, B.COMPUTER, 2);
  }
  spec_police(lot) { this.park(lot, 5, 1, 'x', 0x1a2a6a); this.park(lot, 13, 1, 'x', 0x1a2a6a); return {}; }
  c_police(S, lot) {
    const { x0, z0, base } = lot;
    this.pave(S, lot, B.ASPHALT);
    const top = this.tallBuilding(S, lot, 3, 3, B.BLUE_CONCRETE, B.GLASS_DARK, 'bands', B.WHITE_CONCRETE);
    for (let lx = 6; lx <= 12; lx++) S.set(x0 + lx, base + top - 1, z0 + 3, B.LED_AD);
    S.set(x0 + 7, base + 1, z0 + 7, B.COMPUTER, 2); S.set(x0 + 11, base + 1, z0 + 7, B.COMPUTER, 2);
  }
  spec_stadium(lot) { const s = { x: lot.x0 + 6, y: lot.base + 7, z: lot.z0 + 18, w: 7, h: 4, axis: 'x', dir: -1, block: B.LED_SCREEN }; lot.plan.screens.push(s); return { led: [s] }; }
  c_stadium(S, lot) {
    const { x0, z0, n, base } = lot; const fx0 = 4, fx1 = 14, fz0 = 5, fz1 = 13;
    for (let lx = 0; lx < n; lx++) for (let lz = 0; lz < n; lz++) {
      const x = x0 + lx, z = z0 + lz; if (!S.inClip(x, z)) continue;
      const d = Math.max(fx0 - lx, lx - fx1, fz0 - lz, lz - fz1, 0);
      for (let y = 1; y < 12; y++) S.set(x, base + y, z, 0);
      if (d === 0) { const line = lx === fx0 || lx === fx1 || lz === fz0 || lz === fz1 || lz === 9 || (Math.abs(lx - 9) === 2 && Math.abs(lz - 9) === 2); S.set(x, base, z, line ? B.WHITE_CONCRETE : B.GRASS); continue; }
      const gate = lz < fz0 && Math.abs(lx - 9) <= 1;
      if (gate) { S.set(x, base, z, B.SMOOTH_STONE); continue; }
      const hgt = Math.min(5, d + 1);
      for (let y = 1; y <= hgt; y++) S.set(x, base + y, z, y === hgt ? ((lx + lz) % 2 ? B.RED_CONCRETE : B.BLUE_CONCRETE) : B.GRAY_CONCRETE);
    }
    for (const [qx, qz] of [[0, 1], [18, 1], [0, 17], [18, 17]]) { for (let y = 6; y <= 14; y++) S.set(x0 + qx, base + y, z0 + qz, B.STEEL_POLE); S.set(x0 + qx, base + 15, z0 + qz, B.LAMP); }
    for (const s of lot.spec.led) { for (let i = 0; i < s.w; i++) for (let j = 0; j < s.h; j++) S.set(s.x + i, s.y + j, s.z, s.block); for (let y = 6; y < s.y - base; y++) { S.set(s.x, base + y, s.z, B.STEEL); S.set(s.x + s.w - 1, base + y, s.z, B.STEEL); } }
  }
  c_construction(S, lot) {
    const { x0, z0, n, base } = lot;
    for (let lx = 0; lx < n; lx++) for (let lz = 0; lz < n; lz++) {
      const x = x0 + lx, z = z0 + lz; if (!S.inClip(x, z)) continue;
      S.set(x, base, z, hash3(x, 9, z, 3) < 0.5 ? B.DIRT : B.GRAVEL);
      if ((lx === 0 || lz === 0 || lx === n - 1 || lz === n - 1) && !(lz === 0 && Math.abs(lx - 9) <= 1)) S.set(x, base + 1, z, (lx + lz) % 2 ? B.ORANGE_CONCRETE : B.WHITE_CONCRETE);
      const col = (lx === 3 || lx === 8 || lx === 13) && (lz === 3 || lz === 8 || lz === 13);
      for (let ly = 1; ly <= 16; ly++) {
        const beam = ly % 4 === 0 && lx >= 3 && lx <= 13 && lz >= 3 && lz <= 13;
        if (col || (beam && (lx === 3 || lx === 8 || lx === 13 || lz === 3 || lz === 8 || lz === 13))) S.set(x, base + ly, z, B.STEEL);
        else if (beam && ly <= 8) S.set(x, base + ly, z, B.GRAY_CONCRETE);
      }
      if (lx === 16 && lz === 16) for (let ly = 1; ly <= 30; ly++) S.set(x, base + ly, z, B.YELLOW_CONCRETE);
      if (lz === 16 && lx >= 1) S.set(x, base + 31, z, lx > 16 ? B.GRAY_CONCRETE : B.YELLOW_CONCRETE);
      if (lz === 16 && lx === 16) { S.set(x, base + 32, z, B.YELLOW_CONCRETE); S.set(x, base + 33, z, B.LAMP); }
      if (lz === 15 && lx === 16) { S.set(x, base + 29, z, B.GLASS); S.set(x, base + 30, z, B.YELLOW_CONCRETE); }
      if (lz === 16 && lx === 5) { for (let ly = 22; ly <= 30; ly++) S.set(x, base + ly, z, B.FENCE); S.set(x, base + 21, z, B.STEEL); }
    }
    S.set(x0 + 2, base + 1, z0 + 2, B.CHEST, 0); S.loot(x0 + 2, base + 1, z0 + 2, 'city');
  }
  spec_parking(lot) { const r = mulberry32(lot.seed); const cols = [0xd8202a, 0xf0f0f0, 0x2a5ad8, 0x202020, 0x9a9aa0, 0x3aa04a, 0xe8c030]; for (let k = 0; k < 6; k++) { const row = k % 2, slot = Math.floor(k / 2) * 2 + (r() < 0.5 ? 0 : 1); if (r() < 0.8) this.park(lot, 3 + slot * 3, row ? 14 : 4, 'z', cols[Math.floor(r() * cols.length)]); } return {}; }
  c_parking(S, lot) {
    const { x0, z0, n, base } = lot;
    for (let lx = 0; lx < n; lx++) for (let lz = 0; lz < n; lz++) { const x = x0 + lx, z = z0 + lz; if (!S.inClip(x, z)) continue; S.set(x, base, z, ((lx - 1) % 3 === 0 && (lz < 7 || lz > 11) && lx > 0 && lx < n - 1) ? B.ROAD_LINE : B.ASPHALT); }
    for (const [qx, qz] of [[9, 9], [1, 9], [17, 9]]) { for (let y = 1; y <= 6; y++) S.set(x0 + qx, base + y, z0 + qz, B.STEEL_POLE); S.set(x0 + qx, base + 7, z0 + qz, B.LAMP); }
    S.set(x0 + 9, base + 1, z0 + 1, B.ATM, 0); S.set(x0 + 4, base + 1, z0 + 9, B.EV_CHARGER); S.set(x0 + 14, base + 1, z0 + 9, B.EV_CHARGER);
  }
  // tall building with floors every 4 blocks and rooftop stair access
  tallBuilding(S, lot, m, floors, frame, win, pattern, inner) {
    const { x0, z0, n, base } = lot; const a = m, b = n - 1 - m; const top = floors * 4;
    const mid = Math.floor(n / 2);
    for (let lx = a; lx <= b; lx++) for (let lz = a; lz <= b; lz++) {
      const x = x0 + lx, z = z0 + lz;
      if (!S.inClip(x, z)) continue;
      const edgeX = lx === a || lx === b, edgeZ = lz === a || lz === b, edge = edgeX || edgeZ, corner = edgeX && edgeZ;
      for (let ly = 0; ly <= top + 1; ly++) {
        const y = base + ly; if (y >= H) break;
        let id = 0;
        const f = Math.floor(ly / 4), fl = ly % 4;
        if (ly === top + 1) id = edge ? frame : 0;
        else if (edge) {
          if (corner || fl === 0) id = frame;
          else if (pattern === 'curtain') id = win;
          else if (pattern === 'grid') id = ((edgeZ ? lx : lz) % 2 === 1 && fl >= 1 && fl <= 2) ? win : frame;
          else id = fl >= 1 && fl <= 2 ? win : frame;
          if (ly >= 1 && ly <= 3 && edgeZ && lz === a && Math.abs(lx - mid) <= 1) id = ly === 3 ? frame : 0; // entrance
          if (ly >= 1 && ly <= 3 && edgeZ && lz === b && lx === mid) id = ly === 3 ? frame : 0;
        } else if (fl === 0) {
          id = ly === 0 ? B.SMOOTH_STONE : inner;
          if (ly > 0 && (lx - a) % 4 === 2 && (lz - a) % 4 === 2) id = B.GLOWSTONE;
          // stair holes: even floors climb at column a+1, odd floors at b-1
          const prev = f - 1; const scol = prev % 2 === 0 ? a + 1 : b - 1;
          if (ly > 0 && lx === scol && lz >= a + 2 && lz <= a + 4) id = 0;
        } else {
          // steps
          const scol = f % 2 === 0 ? a + 1 : b - 1;
          if (lx === scol && lz === a + 1 + fl && ly < top) id = inner;
          if (ly > top) id = 0;
        }
        S.set(x, y, z, id);
      }
    }
    return top;
  }
  c_apartment(S, lot) {
    const r = mulberry32(lot.seed);
    const floors = 3 + Math.floor(r() * 3);
    const frame = [B.BRICKS, B.BRICKS, B.TERRACOTTA, B.SANDSTONE][Math.floor(r() * 4)];
    const top = this.tallBuilding(S, lot, 3, floors, frame, B.GLASS, 'grid', B.PLANKS);
    // beds, TVs and computers on each floor; AC units outside; solar roof
    for (let f = 0; f < floors; f++) {
      const y = lot.base + f * 4 + 1; S.set(lot.x0 + 12, y, lot.z0 + 13, B.BED); S.set(lot.x0 + 13, y, lot.z0 + 13, B.BED); S.set(lot.x0 + 7, y, lot.z0 + 13, B.BOOKSHELF);
      S.set(lot.x0 + 9, y + 1, lot.z0 + 14, B.TV, 2); S.set(lot.x0 + 6, y, lot.z0 + 9, B.COMPUTER, 3);
      if (f % 2 === 0) S.set(lot.x0 + 5 + (f % 3) * 4, y + 1, lot.z0 + 2, B.AC_UNIT, 2);
    }
    for (let lx = 5; lx <= 13; lx++) for (let lz = 5; lz <= 13; lz += 2) S.set(lot.x0 + lx, lot.base + top + 1, lot.z0 + lz, B.SOLAR_PANEL);
    // garden ring
    this.garden(S, lot, 3);
  }
  lobby(S, lot, m) {
    const c = Math.floor(lot.n / 2);
    S.set(lot.x0 + c - 2, lot.base + 1, lot.z0 + c + 3, B.TABLE, 2);
    S.set(lot.x0 + c + 2, lot.base + 1, lot.z0 + c + 3, B.CHEST, 2); S.loot(lot.x0 + c + 2, lot.base + 1, lot.z0 + c + 3, 'city');
    this.garden(S, lot, m);
  }
  garden(S, lot, m) {
    // trimmed hedge + flowers between the sidewalk and the building
    for (let lx = 0; lx < lot.n; lx++) for (let lz = 0; lz < lot.n; lz++) {
      if (lx >= m && lx < lot.n - m && lz >= m && lz < lot.n - m) continue;
      const x = lot.x0 + lx, z = lot.z0 + lz; const r = hash3(x, 3, z, 11);
      const front = lz < m && Math.abs(lx - Math.floor(lot.n / 2)) <= 1;
      if (front || (lz < m && lz === m - 1)) { S.set(x, lot.base, z, B.SMOOTH_STONE); continue; }
      if (lx === 0 || lz === 0 || lx === lot.n - 1 || lz === lot.n - 1) { if (r < 0.7) S.set(x, lot.base + 1, z, B.OAK_LEAVES); }
      else if (r < 0.12) S.set(x, lot.base + 1, z, r < 0.06 ? B.POPPY : B.DANDELION);
    }
  }
  c_shops(S, lot) {
    const r = mulberry32(lot.seed); const { x0, z0, n, base } = lot;
    const wallMats = [B.WHITE_CONCRETE, B.TERRACOTTA, B.BRICKS, B.SANDSTONE];
    const awn = [B.RED_WOOL, B.BLUE_WOOL, B.GREEN_WOOL, B.YELLOW_WOOL];
    // two shops side by side, 2 floors each
    for (let s = 0; s < 2; s++) {
      const a = 1 + s * 9, b = a + 7, za = 3, zb = n - 3; const wall = wallMats[Math.floor(r() * 4)], aw = awn[Math.floor(r() * 4)];
      for (let lx = a; lx <= b; lx++) for (let lz = za; lz <= zb; lz++) {
        const x = x0 + lx, z = z0 + lz; if (!S.inClip(x, z)) continue;
        const edgeX = lx === a || lx === b, edgeZ = lz === za || lz === zb; const edge = edgeX || edgeZ;
        S.set(x, base, z, B.SMOOTH_STONE);
        for (let ly = 1; ly <= 9; ly++) {
          let id = 0;
          if (ly === 9) id = edge ? wall : 0;
          else if (ly === 4 || ly === 8) id = edge ? wall : (ly === 4 && lx === a + 1 && lz >= za + 2 && lz <= za + 4) ? 0 : B.PLANKS;
          else if (edge) {
            id = wall;
            if (lz === za && !edgeX && ly <= 3) id = (Math.abs(lx - (a + 4)) <= 0 && ly <= 2) ? 0 : B.GLASS;
            if (ly >= 5 && ly <= 6 && !(edgeX && edgeZ) && ((edgeZ && lx % 2 === 0) || (edgeX && lz % 3 === 0))) id = B.GLASS;
          } else if (lx === a + 1 && lz === za + 1 + ly && ly <= 3) id = B.PLANKS; // inner steps
          S.set(x, base + ly, z, id);
        }
        if (lz === za) S.set(x, base + 4, z0 + za - 1, aw);
      }
      S.set(x0 + a + 3, base + 1, z0 + zb - 1, B.CHEST, 2); S.loot(x0 + a + 3, base + 1, z0 + zb - 1, 'shop');
      S.set(x0 + a + 5, base + 1, z0 + zb - 1, B.TABLE, 2); S.set(x0 + a + 6, base + 1, z0 + zb - 1, B.FURNACE, 2);
      S.set(x0 + a + 4, base + 3, z0 + za + 4, B.GLOWSTONE); S.set(x0 + a + 4, base + 7, z0 + za + 4, B.GLOWSTONE);
      S.set(x0 + a + 2, base + 5, z0 + zb - 1, B.BED); S.set(x0 + a + 3, base + 5, z0 + zb - 1, B.BED);
      S.set(x0 + a + 1, base + 1, z0 + za - 1, s ? B.ATM : B.VENDING, 2); S.set(x0 + a + 6, base + 3, z0 + za + 1, B.TV, 0); for (let lx = a + 2; lx <= a + 5; lx++) S.set(x0 + lx, base + 7, z0 + za - 1, s ? B.LED_AD : B.LED_AD2);
    }
  }
  c_park(S, lot) {
    const { x0, z0, n, base } = lot; const c = Math.floor(n / 2);
    for (let lx = 0; lx < n; lx++) for (let lz = 0; lz < n; lz++) {
      const x = x0 + lx, z = z0 + lz; if (!S.inClip(x, z)) continue;
      const path = Math.abs(lx - c) <= 1 || Math.abs(lz - c) <= 1;
      const dd = Math.max(Math.abs(lx - c), Math.abs(lz - c));
      S.set(x, base, z, path || dd <= 3 ? B.PATH : B.GRASS);
      const r = hash3(x, 4, z, 21);
      if (!path && dd > 3 && r < 0.1) S.set(x, base + 1, z, r < 0.03 ? B.POPPY : r < 0.06 ? B.DANDELION : B.TALL_GRASS);
    }
    // fountain
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
      const x = x0 + c + dx, z = z0 + c + dz; const ring = Math.abs(dx) === 2 || Math.abs(dz) === 2;
      if (ring) S.set(x, base + 1, z, B.STONE_BRICKS); else { S.set(x, base, z, B.WATER); S.set(x, base - 1, z, B.STONE_BRICKS); }
    }
    S.set(x0 + c, base, z0 + c, B.STONE_BRICKS); S.set(x0 + c, base + 1, z0 + c, B.STONE_BRICKS); S.set(x0 + c, base + 2, z0 + c, B.GLOWSTONE);
    // trees + lamps in the four quadrants
    for (const [qx, qz] of [[4, 4], [n - 5, 4], [4, n - 5], [n - 5, n - 5]]) {
      const x = x0 + qx, z = z0 + qz; const r = hash3(x, 5, z, 31);
      this.w.oak((xx, yy, zz, id) => S.set(xx, yy, zz, id), x, base + 1, z, r, r < 0.3 ? B.BIRCH_LOG : B.OAK_LOG, r < 0.3 ? B.BIRCH_LEAVES : B.OAK_LEAVES, 0);
      S.set(x, base, z, B.DIRT);
    }
    for (const [qx, qz] of [[c - 2, 2], [c + 2, n - 3], [2, c + 2], [n - 3, c - 2]]) { const x = x0 + qx, z = z0 + qz; for (let y = 1; y <= 3; y++) S.set(x, base + y, z, B.FENCE); S.set(x, base + 4, z, B.LAMP); }
  }
}

function rectOf(pts) {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (const [x, z] of pts) { a = Math.min(a, x); b = Math.min(b, z); c = Math.max(c, x); d = Math.max(d, z); }
  return [a, b, c, d];
}
function shuffle(a, rnd) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } }
const SYL = ['ash', 'bel', 'cor', 'dun', 'el', 'fen', 'gal', 'har', 'iv', 'kel', 'lin', 'mor', 'nor', 'os', 'pen', 'ril', 'sto', 'tor', 'ul', 'ven', 'wil'];
function villageName(rnd) { const s = SYL[Math.floor(rnd() * SYL.length)] + SYL[Math.floor(rnd() * SYL.length)] + ['ton', 'by', 'ford', 'wick', 'dale', 'stead'][Math.floor(rnd() * 6)]; return s[0].toUpperCase() + s.slice(1); }
function cityName(rnd) { const s = SYL[Math.floor(rnd() * SYL.length)] + SYL[Math.floor(rnd() * SYL.length)]; return s[0].toUpperCase() + s.slice(1) + ' City'; }
