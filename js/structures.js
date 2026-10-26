// Procedural settlements: villages (biome styled) and modern cities
import { hash3, mulberry32 } from './noise.js';
import { B } from './blocks.js';

const H = 80, SEA = 28;
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
    let type = home ? 'village' : r < 0.13 ? 'city' : r < 0.6 ? 'village' : null;
    if (!type) return null;
    const cx = gx * CELL + MARGIN + Math.floor(hash3(gx, 992, gz, seed) * (CELL - MARGIN * 2));
    const cz = gz * CELL + MARGIN + Math.floor(hash3(gx, 993, gz, seed) * (CELL - MARGIN * 2));
    const c = this.w.column(cx, cz);
    if (c.biome > 3 || (!this.flat && c.h < SEA + 1)) return null;
    const rnd = mulberry32((hash3(gx, 994, gz, seed) * 4294967296) >>> 0);
    if (type === 'city') { const p = this.makeCity(cx, cz, rnd); if (p) return p; type = 'village'; }
    return this.makeVillage(cx, cz, c.biome, rnd);
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
    const NB = 4, P = 26, RW = 7, SZ = NB * P + RW; const half = Math.floor(SZ / 2);
    const x0 = cx - half, z0 = cz - half;
    const hs = []; let wet = 0, high = 0;
    for (let i = 0; i <= 6; i++) for (let j = 0; j <= 6; j++) {
      const x = x0 + Math.round(i * SZ / 6), z = z0 + Math.round(j * SZ / 6); const c = this.w.column(x, z);
      if (!this.flat && c.h < SEA) wet++; if (c.h > 56 || c.biome === 4) high++; hs.push(c.h);
    }
    if (wet > 10 || high > 3) return null;
    hs.sort((a, b) => a - b);
    const base = this.flat ? 4 : Math.max(SEA + 2, Math.min(SEA + 10, hs[Math.floor(hs.length / 2)]));
    const pieces = [], mobs = [];
    const plan = { type: 'city', x: cx, z: cz, y: base, pieces, mobs, r: [x0 - 5, z0 - 5, x0 + SZ + 4, z0 + SZ + 4], name: cityName(rnd) };
    const self = this;
    const roadInfo = (lu, lv) => {
      const inX = lu >= 0 && lu < SZ && (lu % P) < RW, inZ = lv >= 0 && lv < SZ && (lv % P) < RW; const k = lu % P, k2 = lv % P;
      return { inX, inZ, k, k2 };
    };
    // terrain + roads + street lights
    pieces.push({ r: plan.r, build: (S) => {
      const ax0 = Math.max(S.x0, plan.r[0]), ax1 = Math.min(S.x1, plan.r[2]), az0 = Math.max(S.z0, plan.r[1]), az1 = Math.min(S.z1, plan.r[3]);
      for (let x = ax0; x <= ax1; x++) for (let z = az0; z <= az1; z++) {
        const lu = x - x0, lv = z - z0; const h = self.ground(x, z);
        const inside = lu >= 0 && lu < SZ && lv >= 0 && lv < SZ;
        if (!inside) {
          // blend ring
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
          if (asph && inX && !inZ && k === 3 && lv % 4 < 2) top = B.YELLOW_CONCRETE;
          if (asph && inZ && !inX && k2 === 3 && lu % 4 < 2) top = B.YELLOW_CONCRETE;
          // crosswalks next to intersections
          if (asph && inX && !inZ && (k2 === RW + 1 || k2 === P - 2) && (k % 2 === 1)) top = B.WHITE_CONCRETE;
          if (asph && inZ && !inX && (k === RW + 1 || k === P - 2) && (k2 % 2 === 1)) top = B.WHITE_CONCRETE;
          // street lights on sidewalks
          const light = (inX && !inZ && (k === 0 || k === RW - 1) && (lv % 13) === 5) || (inZ && !inX && (k2 === 0 || k2 === RW - 1) && (lu % 13) === 5);
          if (light) { for (let y = 1; y <= 4; y++) S.set(x, base + y, z, B.FENCE); S.set(x, base + 5, z, B.LAMP); }
        }
        S.set(x, base, z, top);
      }
    } });
    // lots
    const kinds = [];
    for (let i = 0; i < NB; i++) for (let j = 0; j < NB; j++) {
      const centre = (i === 1 || i === 2) && (j === 1 || j === 2);
      const r = rnd();
      let kind;
      if (i === 1 && j === 1) kind = 'park';
      else if (centre) kind = r < 0.55 ? 'tower' : r < 0.85 ? 'office' : 'apartment';
      else kind = r < 0.18 ? 'tower' : r < 0.36 ? 'office' : r < 0.6 ? 'apartment' : r < 0.84 ? 'shops' : 'park';
      kinds.push(kind);
      const lx0 = x0 + RW + i * P, lz0 = z0 + RW + j * P, n = P - RW; // 19x19
      const lot = { x0: lx0, z0: lz0, n, base, centre, seed: (rnd() * 1e9) | 0 };
      pieces.push({ r: [lx0, lz0, lx0 + n - 1, lz0 + n - 1], build: (S) => self['c_' + kind](S, lot) });
      // people
      const mx = lx0 + n / 2, mz = lz0 + n / 2;
      if (kind === 'shops') { mobs.push({ type: 'villager', prof: 'mason', x: mx - 4, y: base + 1, z: lz0 + 6 }); mobs.push({ type: 'villager', prof: 'butcher', x: mx + 4, y: base + 1, z: lz0 + 6 }); }
      if (kind === 'park') { mobs.push({ type: 'villager', prof: 'nitwit', x: mx + 2, y: base + 1, z: mz + 1 }); mobs.push({ type: 'villager', prof: 'farmer', x: mx - 3, y: base + 1, z: mz - 2 }); }
      if (kind === 'tower' || kind === 'office') mobs.push({ type: 'villager', prof: kind === 'tower' ? 'librarian' : 'cleric', x: mx, y: base + 1, z: mz });
      if (kind === 'apartment') mobs.push({ type: 'villager', prof: 'smith', x: mx, y: base + 1, z: mz });
    }
    mobs.push({ type: 'iron_golem', x: x0 + RW + P - 3.5, y: base + 1, z: z0 + 3.5 });
    mobs.push({ type: 'iron_golem', x: x0 + 3.5, y: base + 1, z: z0 + RW + 2 * P - 3.5 });
    mobs.push({ type: 'iron_golem', x: x0 + SZ - 3.5, y: base + 1, z: z0 + SZ - 3.5 });
    plan.kinds = kinds;
    return plan;
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
  c_tower(S, lot) {
    const r = mulberry32(lot.seed); const maxF = Math.floor((H - 4 - lot.base) / 4);
    const floors = Math.max(4, Math.min(maxF, (lot.centre ? 8 : 5) + Math.floor(r() * 4)));
    const frame = [B.WHITE_CONCRETE, B.GRAY_CONCRETE, B.SMOOTH_STONE, B.IRON_BLOCK][Math.floor(r() * 4)];
    const win = r() < 0.6 ? B.WINDOW : B.GLASS;
    const top = this.tallBuilding(S, lot, 3, floors, frame, win, 'curtain', B.GRAY_CONCRETE);
    const c = Math.floor(lot.n / 2), y = lot.base + top + 1;
    for (let k = 0; k < 4 && y + k < H - 1; k++) S.set(lot.x0 + c, y + k, lot.z0 + c, B.FENCE);
    if (y + 4 < H) S.set(lot.x0 + c, y + 4, lot.z0 + c, B.LAMP);
    this.lobby(S, lot, 3);
  }
  c_office(S, lot) {
    const r = mulberry32(lot.seed); const maxF = Math.floor((H - 4 - lot.base) / 4);
    const floors = Math.max(3, Math.min(maxF, 4 + Math.floor(r() * 4)));
    const frame = [B.GRAY_CONCRETE, B.STONE_BRICKS, B.WHITE_CONCRETE, B.SANDSTONE][Math.floor(r() * 4)];
    this.tallBuilding(S, lot, 2, floors, frame, B.WINDOW, 'bands', B.WHITE_CONCRETE);
    this.lobby(S, lot, 2);
  }
  c_apartment(S, lot) {
    const r = mulberry32(lot.seed);
    const floors = 3 + Math.floor(r() * 3);
    const frame = [B.BRICKS, B.BRICKS, B.TERRACOTTA, B.SANDSTONE][Math.floor(r() * 4)];
    this.tallBuilding(S, lot, 3, floors, frame, B.GLASS, 'grid', B.PLANKS);
    // beds on each floor
    for (let f = 0; f < floors; f++) { const y = lot.base + f * 4 + 1; S.set(lot.x0 + 12, y, lot.z0 + 13, B.BED); S.set(lot.x0 + 13, y, lot.z0 + 13, B.BED); S.set(lot.x0 + 7, y, lot.z0 + 13, B.BOOKSHELF); }
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
