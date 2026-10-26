// Entities: mobs, dropped items, primed TNT, falling blocks, particles
import * as THREE from 'three';
import { SOLID, LIQUID, H } from './world.js';
import { B, I, BLOCKS, isBlock } from './blocks.js';
import { iconFor } from './textures.js';
import { sfx } from './audio.js';

const EPS = 1e-4;
export function collides(world, minx, miny, minz, maxx, maxy, maxz) {
  for (let x = Math.floor(minx); x <= Math.floor(maxx - EPS); x++)
    for (let y = Math.floor(miny); y <= Math.floor(maxy - EPS); y++)
      for (let z = Math.floor(minz); z <= Math.floor(maxz - EPS); z++)
        if (SOLID[world.getBlock(x, y, z)]) return true;
  return false;
}
export function inLiquid(world, e, id) {
  const y = Math.floor(e.y + e.h * 0.4);
  const b = world.getBlock(Math.floor(e.x), y, Math.floor(e.z));
  return id ? b === id : LIQUID[b];
}
// moves entity with collision, returns {hitX, hitZ}
export function moveEntity(world, e, dx, dy, dz) {
  const w = e.w, h = e.h; let hitX = false, hitZ = false;
  e.onGround = false;
  // Y
  if (dy) {
    e.y += dy;
    if (collides(world, e.x - w, e.y, e.z - w, e.x + w, e.y + h, e.z + w)) {
      if (dy < 0) { e.y = Math.floor(e.y) + 1 + EPS; e.onGround = true; } else e.y = Math.floor(e.y + h) - h - EPS;
      e.vy = 0;
    }
  }
  if (dx) {
    e.x += dx;
    if (collides(world, e.x - w, e.y, e.z - w, e.x + w, e.y + h, e.z + w)) {
      e.x = dx > 0 ? Math.floor(e.x + w) - w - EPS : Math.floor(e.x - w) + 1 + w + EPS; e.vx = 0; hitX = true;
    }
  }
  if (dz) {
    e.z += dz;
    if (collides(world, e.x - w, e.y, e.z - w, e.x + w, e.y + h, e.z + w)) {
      e.z = dz > 0 ? Math.floor(e.z + w) - w - EPS : Math.floor(e.z - w) + 1 + w + EPS; e.vz = 0; hitZ = true;
    }
  }
  if (!e.onGround && e.vy <= 0 && collides(world, e.x - w, e.y - 0.02, e.z - w, e.x + w, e.y, e.z + w)) e.onGround = true;
  return { hitX, hitZ };
}

// ------------- block geometry (for items/tnt/falling) -------------
const geoCache = {};
export function blockGeometry(id, size = 1) {
  const k = id + ':' + size; if (geoCache[k]) return geoCache[k];
  const g = new THREE.BoxGeometry(size, size, size);
  const t = BLOCKS[id].tiles; const faces = [t.side, t.side, t.top, t.bottom, t.front, t.side];
  const uv = g.attributes.uv;
  for (let f = 0; f < 6; f++) {
    const tile = faces[f]; const col = tile % 32, row = Math.floor(tile / 32);
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v; const u0 = uv.getX(i), v0 = uv.getY(i);
      uv.setXY(i, (col + 0.01 + u0 * 0.98) / 32, 1 - (row + 1 - (0.01 + v0 * 0.98)) / 32);
    }
  }
  return (geoCache[k] = g);
}

// ---------- Mob models ----------
function box(w, h, d, color, mats) {
  const m = new THREE.MeshLambertMaterial({ color });
  mats.push(m);
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
}
function pivot(mesh, px, py, pz, oy) { const g = new THREE.Group(); g.position.set(px, py, pz); mesh.position.y = oy; g.add(mesh); return g; }
const MOBS = {
  pig: { w: 0.45, h: 0.9, hp: 10, speed: 1.2, drops: [[I.RAW_PORK, 1, 3]], sound: 'pig', passive: true },
  cow: { w: 0.45, h: 1.3, hp: 10, speed: 1.1, drops: [[I.RAW_BEEF, 1, 3], [I.LEATHER, 0, 2]], sound: 'cow', passive: true },
  sheep: { w: 0.45, h: 1.25, hp: 8, speed: 1.1, drops: [[B.WOOL, 1, 1], [I.RAW_MUTTON, 1, 2]], sound: 'sheep', passive: true },
  zombie: { w: 0.3, h: 1.9, hp: 20, speed: 2.4, drops: [[I.ROTTEN_FLESH, 0, 2]], sound: 'zombie', hostile: true, dmg: 3 },
  creeper: { w: 0.3, h: 1.7, hp: 20, speed: 2.2, drops: [[I.GUNPOWDER, 0, 2]], sound: 'hiss', hostile: true },
  villager: { w: 0.3, h: 1.95, hp: 20, speed: 1.1, drops: [], sound: 'villager', passive: true, villager: true },
  iron_golem: { w: 0.65, h: 2.7, hp: 100, speed: 1.5, drops: [[I.IRON_INGOT, 3, 5], [B.POPPY, 0, 2]], golem: true, dmg: 7 },
  skeleton: { w: 0.3, h: 1.9, hp: 20, speed: 2.2, drops: [[I.BONE, 0, 2], [I.ARROW, 0, 2]], sound: 'zombie', hostile: true, dmg: 2, burns: true },
  zombified_piglin: { w: 0.3, h: 1.9, hp: 20, speed: 2.3, drops: [[I.ROTTEN_FLESH, 0, 1], [I.GOLD_NUGGET, 0, 2]], sound: 'zombie', neutral: true, dmg: 5, fireImmune: true },
  ghast: { w: 1.5, h: 3.4, hp: 10, speed: 1.6, drops: [[I.GHAST_TEAR, 0, 1], [I.GUNPOWDER, 0, 2]], sound: 'ghast', hostile: true, flying: true, fireImmune: true, big: true },
  blaze: { w: 0.3, h: 1.8, hp: 20, speed: 1.8, drops: [[I.BLAZE_ROD, 0, 1]], sound: 'blaze', hostile: true, hover: true, fireImmune: true },
  magma_cube: { w: 0.5, h: 1.0, hp: 8, speed: 2.4, drops: [[I.MAGMA_CREAM, 0, 1]], sound: 'slime', hostile: true, hopper: true, dmg: 4, fireImmune: true },
};
MOBS.zombie.burns = true;
const MODERN = {
  citizen: [0x3a6ab8, 0x2a2a3a, 0x2a1a10, 'tie'], tech: [0x3a3a44, 0x2a3a5a, 0x1a1a1a, 'hood'], doctor: [0x7ac8c0, 0x7ac8c0, 0x3a2a1a, 'coat'],
  officer: [0x1a2a5a, 0x101828, 0x1a1a1a, 'cap'], worker: [0xd86a20, 0x3a4a6a, 0x3a2a1a, 'vest'], shopper: [0xd84a7a, 0x4a6aa8, 0x6a3a1a, 'glasses'],
};
export { MODERN };
const BREED_FOOD = { cow: I.WHEAT, sheep: I.WHEAT, pig: I.WHEAT, villager: I.BREAD };
export { BREED_FOOD };
function buildModel(type, opts = {}) {
  const mats = [], g = new THREE.Group(), legs = []; let head, arms = [];
  const quad = (bw, bh, bd, by, color, legH, legC, headSize, headC, headPos) => {
    const body = box(bw, bh, bd, color, mats); body.position.y = legH + bh / 2; g.add(body);
    for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const l = pivot(box(0.24, legH, 0.24, legC, mats), lx * (bw / 2 - 0.13), legH, lz * (bd / 2 - 0.14), -legH / 2); g.add(l); legs.push(l);
    }
    head = new THREE.Group(); head.position.set(0, headPos[1], headPos[2]);
    const hm = box(headSize, headSize, headSize * 0.9, headC, mats); head.add(hm); g.add(head);
    return { body, hm };
  };
  if (type === 'pig') {
    quad(0.6, 0.5, 0.95, 0, 0xf0a3a0, 0.3, 0xe08f8c, 0.5, 0xf0a3a0, [0, 0.72, 0.6]);
    const sn = box(0.26, 0.16, 0.08, 0xe68a88, mats); sn.position.set(0, -0.06, 0.25); head.add(sn);
    for (const s of [-1, 1]) { const e = box(0.08, 0.08, 0.02, 0x111111, mats); e.position.set(s * 0.15, 0.08, 0.235); head.add(e); }
  } else if (type === 'cow') {
    const { body } = quad(0.7, 0.62, 1.1, 0, 0x4a3426, 0.6, 0x3a2a1e, 0.5, 0x4a3426, [0, 1.12, 0.68]); void body;
    const p = box(0.5, 0.3, 0.02, 0xeeeeee, mats); p.position.set(0.355, 0.9, 0); p.rotation.y = Math.PI / 2; g.add(p);
    const sn = box(0.3, 0.18, 0.06, 0xd8c0b0, mats); sn.position.set(0, -0.12, 0.24); head.add(sn);
    for (const s of [-1, 1]) { const h = box(0.06, 0.14, 0.06, 0xdddddd, mats); h.position.set(s * 0.26, 0.24, 0); head.add(h); const e = box(0.08, 0.08, 0.02, 0x111111, mats); e.position.set(s * 0.15, 0.08, 0.235); head.add(e); }
  } else if (type === 'sheep') {
    quad(0.72, 0.6, 1.0, 0, 0xf2f2f2, 0.55, 0xd8c8b8, 0.42, 0xd8c8b8, [0, 1.05, 0.6]);
    for (const s of [-1, 1]) { const e = box(0.07, 0.07, 0.02, 0x111111, mats); e.position.set(s * 0.12, 0.06, 0.2); head.add(e); }
  } else if (type === 'villager' && MODERN[opts.prof]) {
    const [shirt, pants, hair, extra] = MODERN[opts.prof];
    const skinV = [0x8a5a3a, 0xc89a70, 0x6a4028, 0xe0b090][(opts.skin ?? Math.floor(Math.random() * 4)) & 3];
    const body = box(0.5, 0.75, 0.28, shirt, mats); body.position.y = 1.12; g.add(body);
    if (extra === 'coat') { const c = box(0.54, 0.95, 0.3, 0xf4f4f4, mats); c.position.y = 1.02; g.add(c); }
    if (extra === 'vest') { const v = box(0.52, 0.4, 0.3, 0xd8e020, mats); v.position.y = 1.25; g.add(v); }
    if (extra === 'tie') { const t = box(0.08, 0.5, 0.02, 0xa02020, mats); t.position.set(0, 1.2, 0.15); g.add(t); }
    for (const s of [-1, 1]) { const l = pivot(box(0.24, 0.75, 0.24, pants, mats), s * 0.125, 0.75, 0, -0.375); g.add(l); legs.push(l); }
    for (const s of [-1, 1]) { const a = pivot(box(0.22, 0.72, 0.22, extra === 'coat' ? 0xf4f4f4 : shirt, mats), s * 0.36, 1.48, 0, -0.34); g.add(a); arms.push(a); }
    head = new THREE.Group(); head.position.set(0, 1.74, 0); head.add(box(0.46, 0.46, 0.46, skinV, mats)); g.add(head);
    const hr = box(0.48, 0.12, 0.48, hair, mats); hr.position.y = 0.2; head.add(hr);
    for (const s of [-1, 1]) { const e = box(0.08, 0.06, 0.02, 0x1a1a1a, mats); e.position.set(s * 0.1, 0.03, 0.235); head.add(e); }
    if (extra === 'cap' || extra === 'vest') { const c = box(0.5, 0.12, 0.5, extra === 'cap' ? 0x1a2a5a : 0xe8a020, mats); c.position.y = 0.28; head.add(c); const v = box(0.4, 0.04, 0.14, extra === 'cap' ? 0x101828 : 0xe8a020, mats); v.position.set(0, 0.24, 0.3); head.add(v); }
    if (extra === 'hood') { const h = box(0.52, 0.5, 0.2, shirt, mats); h.position.set(0, 0.02, -0.2); head.add(h); }
    if (extra === 'glasses') { const gl = box(0.36, 0.06, 0.02, 0x101010, mats); gl.position.set(0, 0.04, 0.245); head.add(gl); }
  } else if (type === 'villager') {
    const robe = { farmer: 0x8a5a2a, librarian: 0xe8e8e0, smith: 0x2a2a2e, cleric: 0x6a2a8a, butcher: 0xeeeeee, shepherd: 0x6a4a2a, mason: 0x5a5a6a, nitwit: 0x3a8a3a }[opts.prof] ?? 0x8a5a2a;
    const skinV = 0xb88660;
    const body = box(0.5, 0.95, 0.32, robe, mats); body.position.y = 1.02; g.add(body);
    const apron = { farmer: 0xc8a050, smith: 0x111111, butcher: 0xd83a3a, librarian: 0xa07040, cleric: 0x9a4aba, shepherd: 0xe8e8e8, mason: 0x9a6a4a }[opts.prof];
    if (apron !== undefined) { const ap = box(0.4, 0.6, 0.02, apron, mats); ap.position.set(0, 0.95, 0.17); g.add(ap); }
    for (const s of [-1, 1]) { const l = pivot(box(0.22, 0.6, 0.22, 0x3a2a1a, mats), s * 0.12, 0.6, 0, -0.3); g.add(l); legs.push(l); }
    const ar = box(0.66, 0.2, 0.2, skinV, mats); ar.position.set(0, 1.2, 0.2); ar.rotation.x = -0.4; g.add(ar);
    head = new THREE.Group(); head.position.set(0, 1.72, 0); head.add(box(0.44, 0.52, 0.44, skinV, mats)); g.add(head);
    const nose = box(0.1, 0.18, 0.1, 0xa87250, mats); nose.position.set(0, -0.04, 0.27); head.add(nose);
    const brow = box(0.36, 0.05, 0.02, 0x3a2a1a, mats); brow.position.set(0, 0.11, 0.225); head.add(brow);
    for (const s of [-1, 1]) { const e = box(0.08, 0.06, 0.02, 0x2a7a2a, mats); e.position.set(s * 0.1, 0.05, 0.225); head.add(e); }
    if (opts.prof === 'farmer') { const hat = box(0.6, 0.06, 0.6, 0xd8c060, mats); hat.position.y = 0.28; head.add(hat); }
    if (opts.prof === 'librarian') { const hat = box(0.46, 0.14, 0.46, 0xa07040, mats); hat.position.y = 0.3; head.add(hat); }
  } else if (type === 'iron_golem') {
    const iron = 0xd8d0c8, dark = 0xa89c90;
    const body = box(0.95, 0.85, 0.55, iron, mats); body.position.y = 1.75; g.add(body);
    const hip = box(0.6, 0.3, 0.4, dark, mats); hip.position.y = 1.2; g.add(hip);
    const vine = box(0.3, 0.5, 0.02, 0x4a8a2a, mats); vine.position.set(0.15, 1.7, 0.28); g.add(vine);
    for (const s of [-1, 1]) { const l = pivot(box(0.32, 1.05, 0.32, dark, mats), s * 0.2, 1.05, 0, -0.525); g.add(l); legs.push(l); }
    for (const s of [-1, 1]) { const a = pivot(box(0.26, 1.35, 0.3, iron, mats), s * 0.62, 2.1, 0, -0.62); g.add(a); arms.push(a); }
    head = new THREE.Group(); head.position.set(0, 2.38, 0.06); head.add(box(0.42, 0.42, 0.42, iron, mats)); g.add(head);
    const nose = box(0.1, 0.2, 0.1, dark, mats); nose.position.set(0, -0.06, 0.25); head.add(nose);
    for (const s of [-1, 1]) { const e = box(0.08, 0.05, 0.02, 0x8a1a1a, mats); e.position.set(s * 0.1, 0.06, 0.215); head.add(e); }
  } else if (type === 'ghast') {
    const bodyM = box(3.2, 3.2, 3.2, 0xf0f0f0, mats); bodyM.position.y = 2.6; g.add(bodyM);
    head = new THREE.Group(); head.position.set(0, 2.6, 0); g.add(head);
    for (const [ex, ey] of [[-0.7, 0.4], [0.7, 0.4]]) { const e = box(0.5, 0.18, 0.04, 0x222222, mats); e.position.set(ex, ey, 1.61); head.add(e); }
    const mo = box(0.9, 0.3, 0.04, 0x333333, mats); mo.position.set(0, -0.5, 1.61); head.add(mo);
    for (let k = 0; k < 9; k++) { const tx = (k % 3 - 1) * 0.95, tz = (Math.floor(k / 3) - 1) * 0.95; const t = pivot(box(0.24, 1.4 + (k * 37 % 5) * 0.15, 0.24, 0xe0e0e0, mats), tx, 1.0, tz, -0.7); g.add(t); arms.push(t); }
  } else if (type === 'blaze') {
    head = new THREE.Group(); head.position.set(0, 1.5, 0); head.add(box(0.5, 0.5, 0.5, 0xf8c830, mats)); g.add(head);
    for (const s of [-1, 1]) { const e = box(0.12, 0.06, 0.02, 0x3a1a00, mats); e.position.set(s * 0.12, 0.04, 0.255); head.add(e); }
    const ring = new THREE.Group(); ring.position.y = 0.9; g.add(ring); arms.push(ring);
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; const r = box(0.12, 0.7, 0.12, k % 2 ? 0xffa020 : 0xf8d040, mats); r.position.set(Math.cos(a) * 0.55, (k % 2) * 0.45, Math.sin(a) * 0.55); ring.add(r); }
    const smoke = box(0.18, 0.6, 0.18, 0x6a4a2a, mats); smoke.position.y = 0.5; g.add(smoke);
  } else if (type === 'magma_cube') {
    for (let k = 0; k < 4; k++) { const sl = box(0.98, 0.22, 0.98, k % 2 ? 0x5a1a10 : 0x3a0e08, mats); sl.position.y = 0.12 + k * 0.24; g.add(sl); arms.push(sl); }
    head = new THREE.Group(); head.position.set(0, 0.6, 0); g.add(head);
    for (const s of [-1, 1]) { const e = box(0.2, 0.12, 0.02, 0xffa020, mats); e.position.set(s * 0.22, 0.05, 0.5); head.add(e); }
  } else {
    const skin = type === 'zombified_piglin' ? 0xe89a8a : type === 'zombie' ? 0x5f9a4a : type === 'creeper' ? 0x58b84a : 0xc8c8c8;
    if (type === 'creeper') {
      const body = box(0.5, 0.75, 0.3, skin, mats); body.position.y = 0.95; g.add(body);
      for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const l = pivot(box(0.24, 0.55, 0.24, 0x4aa03e, mats), lx * 0.13, 0.55, lz * 0.2, -0.275); g.add(l); legs.push(l); }
      head = new THREE.Group(); head.position.set(0, 1.58, 0); head.add(box(0.5, 0.5, 0.5, skin, mats)); g.add(head);
      for (const s of [-1, 1]) { const e = box(0.12, 0.12, 0.02, 0x101010, mats); e.position.set(s * 0.12, 0.06, 0.255); head.add(e); }
      const mo = box(0.12, 0.16, 0.02, 0x101010, mats); mo.position.set(0, -0.1, 0.255); head.add(mo);
    } else {
      const zp = type === 'zombified_piglin';
      const shirt = zp ? 0x7a5a3a : type === 'zombie' ? 0x2a9ca8 : 0xbababa, pants = zp ? 0x4a3a2a : type === 'zombie' ? 0x3a3a9a : 0xaaaaaa;
      const lw = type === 'skeleton' ? 0.12 : 0.24;
      const body = box(0.5, 0.75, 0.26, shirt, mats); body.position.y = 1.12; g.add(body);
      for (const s of [-1, 1]) { const l = pivot(box(lw, 0.75, lw, pants, mats), s * 0.125, 0.75, 0, -0.375); g.add(l); legs.push(l); }
      for (const s of [-1, 1]) { const a = pivot(box(lw, 0.72, lw, skin, mats), s * 0.37, 1.45, 0, -0.32); a.rotation.x = -Math.PI / 2; g.add(a); arms.push(a); }
      head = new THREE.Group(); head.position.set(0, 1.74, 0); head.add(box(zp ? 0.54 : 0.48, 0.48, 0.48, skin, mats)); g.add(head);
      if (zp) {
        const sn = box(0.26, 0.18, 0.08, 0xd88a7a, mats); sn.position.set(0, -0.1, 0.27); head.add(sn);
        const bone = box(0.2, 0.3, 0.04, 0x6aa04a, mats); bone.position.set(-0.12, 0.05, 0.245); head.add(bone);
        const sw = box(0.06, 0.06, 0.8, 0xf8d040, mats); sw.position.set(0, -0.36, 0.3); arms[1].add(sw);
      }
      for (const s of [-1, 1]) { const e = box(0.1, 0.07, 0.02, type === 'zombie' ? 0x1a2a10 : 0x202020, mats); e.position.set(s * 0.11, 0.04, 0.245); head.add(e); }
    }
  }
  return { g, legs, head, arms, mats };
}

export class EntityManager {
  constructor(game) {
    this.game = game; this.scene = game.scene; this.world = game.world;
    this.mobs = []; this.items = []; this.tnts = []; this.falling = []; this.arrows = []; this.fireballs = [];
    // particles
    this.maxP = 400;
    this.pmesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }), this.maxP);
    this.pmesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.pmesh.setColorAt(0, new THREE.Color()); this.pmesh.frustumCulled = false;
    this.scene.add(this.pmesh);
    this.parts = []; this._m = new THREE.Matrix4(); this._c = new THREE.Color();
    this.blockMat = new THREE.MeshLambertMaterial({ map: game.atlasTex, alphaTest: 0.5 });
    this.texCache = {};
  }
  clear() {
    for (const m of this.mobs) this.scene.remove(m.model.g);
    for (const it of this.items) this.scene.remove(it.mesh);
    for (const t of this.tnts) this.scene.remove(t.mesh);
    for (const f of this.falling) this.scene.remove(f.mesh);
    for (const a of this.arrows) this.scene.remove(a.mesh);
    for (const f of this.fireballs) this.scene.remove(f.mesh);
    this.mobs = []; this.items = []; this.tnts = []; this.falling = []; this.arrows = []; this.fireballs = []; this.parts = [];
  }
  // ---------- particles ----------
  burst(x, y, z, color, n = 14, speed = 3, size = 0.12, life = 0.8) {
    for (let i = 0; i < n; i++) {
      if (this.parts.length >= this.maxP) this.parts.shift();
      this.parts.push({ x: x + (Math.random() - 0.5) * 0.8, y: y + (Math.random() - 0.5) * 0.8, z: z + (Math.random() - 0.5) * 0.8,
        vx: (Math.random() - 0.5) * speed, vy: Math.random() * speed, vz: (Math.random() - 0.5) * speed,
        life: life * (0.5 + Math.random() * 0.5), s: size * (0.6 + Math.random() * 0.6), c: color, grav: true });
    }
  }
  smoke(x, y, z, n = 30) {
    for (let i = 0; i < n; i++) {
      if (this.parts.length >= this.maxP) this.parts.shift();
      const g = 0.5 + Math.random() * 0.4;
      this.parts.push({ x: x + (Math.random() - 0.5) * 3, y: y + (Math.random() - 0.5) * 3, z: z + (Math.random() - 0.5) * 3,
        vx: (Math.random() - 0.5) * 4, vy: Math.random() * 3, vz: (Math.random() - 0.5) * 4, life: 1 + Math.random(), s: 0.3 + Math.random() * 0.5, c: [g, g, g], grav: false });
    }
  }
  updateParticles(dt, daylight) {
    const P = this.parts; let j = 0;
    for (let i = 0; i < P.length; i++) {
      const p = P[i]; p.life -= dt; if (p.life <= 0) continue;
      if (p.grav) p.vy -= 18 * dt; else { p.vy += 0.5 * dt; p.s *= 1 + dt * 0.5; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.grav && SOLID[this.world.getBlock(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z))]) { p.y = Math.floor(p.y) + 1.001; p.vy = 0; p.vx *= 0.7; p.vz *= 0.7; }
      P[j++] = p;
    }
    P.length = j;
    const k = Math.max(0.35, daylight);
    for (let i = 0; i < this.maxP; i++) {
      if (i < P.length) {
        const p = P[i]; this._m.makeScale(p.s, p.s, p.s); this._m.setPosition(p.x, p.y, p.z);
        this._c.setRGB(p.c[0] * k, p.c[1] * k, p.c[2] * k);
      } else { this._m.makeScale(0, 0, 0); }
      this.pmesh.setMatrixAt(i, this._m); if (i < P.length) this.pmesh.setColorAt(i, this._c);
    }
    this.pmesh.count = Math.max(1, P.length);
    this.pmesh.instanceMatrix.needsUpdate = true; if (this.pmesh.instanceColor) this.pmesh.instanceColor.needsUpdate = true;
  }
  // ---------- items ----------
  spriteTex(id) {
    if (this.texCache[id]) return this.texCache[id];
    const img = new Image(); img.src = iconFor(id);
    const t = new THREE.Texture(img); img.onload = () => { t.needsUpdate = true; };
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
    return (this.texCache[id] = t);
  }
  hearts(x, y, z, n = 4, angry = false) {
    for (let i = 0; i < n; i++) { if (this.parts.length >= this.maxP) this.parts.shift(); this.parts.push({ x: x + (Math.random() - 0.5) * 0.8, y: y + Math.random() * 0.4, z: z + (Math.random() - 0.5) * 0.8, vx: 0, vy: 0.6, vz: 0, life: 1.2, s: 0.16, c: angry ? [0.3, 0.3, 0.3] : [1, 0.25, 0.35], grav: false }); }
  }
  dropItem(id, count, x, y, z, vx, vy, vz, dur, ench) {
    if (!id || count <= 0) return;
    let mesh;
    if (isBlock(id) && BLOCKS[id].shape !== 'cross' && BLOCKS[id].shape !== 'torch') mesh = new THREE.Mesh(blockGeometry(id, 0.25), this.blockMat);
    else { mesh = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.spriteTex(id), alphaTest: 0.5 })); mesh.scale.set(0.4, 0.4, 0.4); }
    this.scene.add(mesh);
    this.items.push({ id, count, dur, ench, x, y, z, vx: vx ?? (Math.random() - 0.5) * 3, vy: vy ?? 3, vz: vz ?? (Math.random() - 0.5) * 3, w: 0.125, h: 0.25, age: 0, mesh, onGround: false });
    if (this.items.length > 150) { const o = this.items.shift(); this.scene.remove(o.mesh); }
  }
  // ---------- tnt ----------
  primeTNT(x, y, z, fuse = 4) {
    const mesh = new THREE.Mesh(blockGeometry(B.TNT, 0.98), new THREE.MeshLambertMaterial({ map: this.game.atlasTex, emissive: 0x000000 }));
    this.scene.add(mesh);
    this.tnts.push({ x: x + 0.5, y, z: z + 0.5, vx: (Math.random() - 0.5), vy: 2, vz: (Math.random() - 0.5), w: 0.49, h: 0.98, fuse, mesh });
    sfx.fuse();
  }
  spawnFalling(id, x, y, z) {
    const mesh = new THREE.Mesh(blockGeometry(id, 1), this.blockMat);
    this.scene.add(mesh);
    this.falling.push({ id, x: x + 0.5, y, z: z + 0.5, vx: 0, vy: 0, vz: 0, w: 0.49, h: 0.98, mesh });
  }
  // ---------- mobs ----------
  spawnMob(type, x, y, z, opts = {}) {
    const def = MOBS[type];
    if (type === 'villager' && !opts.prof) opts.prof = ['farmer', 'librarian', 'smith', 'cleric', 'butcher', 'shepherd', 'mason', 'nitwit'][Math.floor(Math.random() * 8)];
    const model = buildModel(type, opts);
    if (opts.baby) model.g.scale.setScalar(0.55);
    this.scene.add(model.g);
    const m = { type, def, model, x, y, z, vx: 0, vy: 0, vz: 0, w: def.w, h: def.h, hp: def.hp, yaw: Math.random() * 6.28, targetYaw: 0,
      walk: 0, wanderT: 0, moving: false, hurt: 0, attackCd: 0, fuse: 0, onGround: false, dead: 0, sayT: 4 + Math.random() * 10, burn: 0, shootCd: 2, prof: opts.prof, home: opts.home || null, plan: opts.plan || null, baby: !!opts.baby, growT: opts.baby ? 120 : 0, breedCd: opts.baby || !def.villager ? 0 : 20 + Math.random() * 40, willing: 0, fireT: 0 };
    if (opts.baby) { m.h = def.h * 0.55; m.w = def.w * 0.7; }
    if (type === 'ghast') m.alt = y;
    this.mobs.push(m); return m;
  }
  hurtMob(m, dmg, fromX, fromZ, fromPlayer = true, kb = 1) {
    if (m.dead || m.hurt > 0.35) return false;
    m.hp -= dmg; m.hurt = 0.5;
    const dx = m.x - fromX, dz = m.z - fromZ, d = Math.hypot(dx, dz) || 1;
    const kk = m.def.big ? kb * 0.3 : kb;
    m.vx += dx / d * 6 * kk; m.vz += dz / d * 6 * kk; if (kb) m.vy = m.def.flying ? m.vy : 5;
    sfx.hit(); if (m.def.sound && m.def.passive) sfx[m.def.sound]();
    if (m.def.passive) m.panic = 5;
    if (m.def.golem) { sfx.golem(); if (fromPlayer) m.angry = 20; }
    if (m.def.neutral && fromPlayer) { for (const o of this.mobs) if (o.type === m.type && Math.hypot(o.x - m.x, o.z - m.z) < 24) o.angry = 30; }
    if (m.def.villager && fromPlayer) { for (const o of this.mobs) if (o.def.golem && Math.hypot(o.x - m.x, o.z - m.z) < 24) o.angry = 20; }
    if (m.hp <= 0) {
      m.dead = 0.8;
      for (const [id, a, b] of m.def.drops) {
        if (m.baby) break;
        const n = a + Math.floor(Math.random() * (b + (fromPlayer ? (m.looting || 0) : 0) - a + 1));
        if (n > 0) this.dropItem(id, n, m.x, m.y + 0.5, m.z);
      }
      if (!m.baby) this.game.addXP && this.game.addXP(m.def.hostile || m.def.neutral ? 5 : 2);
    }
    return true;
  }
  update(dt) {
    const g = this.game, w = this.world, pl = g.player;
    // mobs
    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const m = this.mobs[i]; const md = m.def;
      const dxp = pl.x - m.x, dzp = pl.z - m.z, distP = Math.hypot(dxp, dzp, (pl.y - m.y));
      if (distP > (m.home ? 140 : 80) || (md.hostile && g.difficulty === 0)) { this.scene.remove(m.model.g); this.mobs.splice(i, 1); continue; }
      if (m.dead > 0) {
        m.dead -= dt; m.model.g.rotation.z = Math.min(Math.PI / 2, (0.8 - m.dead) * 4);
        if (m.dead <= 0) { this.burst(m.x, m.y + 0.5, m.z, [0.9, 0.9, 0.9], 16, 2, 0.15); this.scene.remove(m.model.g); this.mobs.splice(i, 1); }
        continue;
      }
      if (!w.isLoaded(Math.floor(m.x), Math.floor(m.z))) continue;
      m.hurt = Math.max(0, m.hurt - dt); m.attackCd -= dt; m.sayT -= dt; m.breedCd -= dt;
      if (m.sayT < 0 && distP < (md.big ? 40 : 16)) { m.sayT = 8 + Math.random() * 14; if (md.sound && m.type !== 'creeper') sfx[md.sound](); }
      if (m.baby) { m.growT -= dt; if (m.growT <= 0) this.growUp(m); }
      if (m.willing > 0) { m.willing -= dt; if (Math.random() < dt * 2.5) this.hearts(m.x, m.y + m.h, m.z, 1); }
      if (md.villager && m.home && !m.baby && m.breedCd <= 0 && !(m.willing > 0) && g.daylight > 0.5 && Math.random() < dt / 70) m.willing = 20;
      // fire (fire aspect)
      if (m.fireT > 0) {
        m.fireT -= dt; if (Math.random() < dt * 10) this.burst(m.x, m.y + m.h * 0.6, m.z, [1, 0.55, 0.1], 1, 1, 0.1, 0.4);
        m.fireTick = (m.fireTick || 0) + dt; if (m.fireTick > 1) { m.fireTick = 0; m.hurt = 0; this.hurtMob(m, 1, m.x, m.z, false, 0); }
      }
      if (md.flying || md.hover || md.hopper) {
        this.updateNetherMob(m, dt, distP, dxp, dzp, g.mode === 'survival' && !pl.dead);
        if (m.y < -20) { this.scene.remove(m.model.g); this.mobs.splice(i, 1); continue; }
        m.model.g.position.set(m.x, m.y, m.z); m.model.g.rotation.y = m.yaw;
        const tint2 = m.hurt > 0.3 ? 0x991111 : 0;
        if (m.lastTint !== tint2) { for (const mt of m.model.mats) mt.emissive.setHex(tint2); m.lastTint = tint2; }
        continue;
      }
      let speed = 0; let chase = false; let target = null;
      const playerTargetable = g.mode === 'survival' && !pl.dead;
      if (md.golem) {
        m.angry = Math.max(0, (m.angry || 0) - dt);
        if (m.angry > 0 && playerTargetable && distP < 20) target = pl;
        else { m.tgtT = (m.tgtT || 0) - dt; if (m.tgtT < 0 || (m.tgt && m.tgt.dead)) { m.tgtT = 0.5; m.tgt = this.nearest(m, (o) => o.def.hostile && !o.dead, 16); } target = m.tgt; }
      } else if (md.neutral) {
        m.angry = Math.max(0, (m.angry || 0) - dt);
        if (m.angry > 0 && playerTargetable && distP < 24) target = pl;
      } else if (m.type === 'zombie' && !(playerTargetable && distP < 18)) {
        m.tgtT = (m.tgtT || 0) - dt; if (m.tgtT < 0) { m.tgtT = 1; m.tgt = this.nearest(m, (o) => o.def.villager && !o.dead, 14); } target = m.tgt && !m.tgt.dead ? m.tgt : null;
      }
      if (target && target !== pl) {
        const tx = target.x - m.x, tz = target.z - m.z, td = Math.hypot(tx, tz);
        m.targetYaw = Math.atan2(tx, tz); speed = md.speed * (md.golem ? 1.2 : 1);
        if (td < (md.golem ? 2.2 : 1.4) && m.attackCd <= 0) {
          m.attackCd = md.golem ? 1.2 : 1; this.hurtMob(target, md.golem ? 10 + Math.random() * 6 : md.dmg, m.x, m.z, false);
          if (md.golem) { target.vy = 9; m.swingT = 0.4; }
          if (target.def.villager) target.panic = 6;
        }
        if (td < 1.2) speed = 0;
      } else if ((md.hostile || target === pl) && playerTargetable && distP < 18) {
        chase = true; m.targetYaw = Math.atan2(dxp, dzp);
        speed = md.speed;
        if (m.type === 'skeleton' && distP < 8) speed = 0;
        if (md.golem) { speed = md.speed * 1.2; if (distP < 2.4 && m.attackCd <= 0) { m.attackCd = 1.4; m.swingT = 0.4; g.damagePlayer(md.dmg * [0.5, 0.7, 1, 1.4][g.difficulty], m.x, m.z); pl.vy = 8; } }
      } else {
        m.wanderT -= dt;
        if (m.wanderT < 0) { m.wanderT = 2 + Math.random() * 5; m.moving = Math.random() < 0.55; m.targetYaw = Math.random() * Math.PI * 2; }
        if (m.panic > 0) { m.panic -= dt; m.moving = true; if (Math.random() < dt * 2) m.targetYaw = Math.random() * 6.28; }
        speed = m.moving ? md.speed * (m.panic > 0 ? 2 : 0.6) : 0;
        // stay near home (villagers / golems)
        if (m.home && !(m.panic > 0)) {
          const hx = m.home.x - m.x, hz = m.home.z - m.z, hd = Math.hypot(hx, hz);
          if (hd > (md.golem ? 22 : 14)) { m.targetYaw = Math.atan2(hx, hz); m.moving = true; speed = md.speed * 0.7; }
        }
        if (md.villager && m.lookP > 0) { m.lookP -= dt; speed = 0; m.targetYaw = Math.atan2(dxp, dzp); }
        // breeding: walk to a willing partner
        if (m.willing > 0 && !m.baby && !(m.panic > 0)) {
          const mate = this.nearest(m, (o) => o.type === m.type && o.willing > 0 && !o.baby && !o.dead, 8);
          if (mate) {
            const tx = mate.x - m.x, tz = mate.z - m.z, td = Math.hypot(tx, tz);
            m.targetYaw = Math.atan2(tx, tz); speed = td > 1.2 ? md.speed * 0.8 : 0;
            if (td < 1.7) { m.loveT = (m.loveT || 0) + dt; if (m.loveT > 3 && (mate.loveT || 0) > 3) this.breed(m, mate); }
          }
        }
        if (m.baby) speed *= 1.25;
      }
      let dy = m.targetYaw - m.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
      m.yaw += dy * Math.min(1, dt * 6);
      const inWater = inLiquid(w, m);
      const fx = Math.sin(m.yaw) * speed, fz = Math.cos(m.yaw) * speed;
      m.vx += (fx - m.vx) * Math.min(1, dt * 8); m.vz += (fz - m.vz) * Math.min(1, dt * 8);
      if (inWater) { m.vy += (2 - m.vy) * dt * 3; } else m.vy -= 28 * dt;
      m.vy = Math.max(m.vy, -40);
      const hit = moveEntity(w, m, m.vx * dt, m.vy * dt, m.vz * dt);
      if ((hit.hitX || hit.hitZ) && m.onGround && speed > 0) m.vy = 8.2;
      if (m.y < -20) { this.scene.remove(m.model.g); this.mobs.splice(i, 1); continue; }
      // creeper fuse / zombie attack
      if (chase) {
        if (m.type === 'creeper') {
          if (distP < 3) { if (m.fuse === 0) sfx.hiss(); m.fuse += dt; } else m.fuse = Math.max(0, m.fuse - dt);
          const s = 1 + Math.min(1, m.fuse / 1.5) * 0.25 * (Math.sin(m.fuse * 20) > 0 ? 1 : 0.5);
          m.model.g.scale.set(s, 1, s);
          if (m.fuse > 1.5) { this.scene.remove(m.model.g); this.mobs.splice(i, 1); g.explode(m.x, m.y + 1, m.z, 3); continue; }
        } else if (m.type === 'skeleton') {
          m.shootCd -= dt;
          if (m.shootCd < 0 && distP < 16) { m.shootCd = 2 + Math.random(); this.shootArrow(m, pl); }
        } else if (md.golem) { /* handled above */ } else if (distP < 1.4 && m.attackCd <= 0) { m.attackCd = 1; g.damagePlayer(md.dmg * [0, 0.5, 1, 1.5][g.difficulty], m.x, m.z); }
      } else if (m.type === 'creeper') { m.fuse = 0; m.model.g.scale.set(1, 1, 1); }
      // burn in daylight
      if (md.burns && g.daylight > 0.75 && !inWater && w.topSolid(Math.floor(m.x), Math.floor(m.z)) < m.y + m.h) {
        m.burn += dt; if (Math.random() < dt * 8) this.burst(m.x, m.y + 1.2, m.z, [1, 0.5, 0.1], 2, 1, 0.1, 0.4);
        if (m.burn > 1) { m.burn = 0; this.hurtMob(m, 1, m.x, m.z, false); }
      }
      // cactus / lava
      // animate
      const sp = Math.hypot(m.vx, m.vz); m.walk += sp * dt * 4;
      const sw = Math.sin(m.walk) * Math.min(1, sp) * 0.7;
      m.model.legs.forEach((l, k) => { l.rotation.x = (k % 2 === (k < 2 ? 0 : 1) ? sw : -sw); });
      if (m.model.legs.length === 2) { m.model.legs[0].rotation.x = sw; m.model.legs[1].rotation.x = -sw; }
      if (md.golem) { m.swingT = Math.max(0, (m.swingT || 0) - dt); const up = m.swingT > 0 ? -Math.sin(m.swingT / 0.4 * Math.PI) * 2 : 0; m.model.arms.forEach((a, k) => { a.rotation.x = up + (k ? sw : -sw) * 0.6; }); }
      m.model.g.position.set(m.x, m.y, m.z); m.model.g.rotation.y = m.yaw;
      const tint = m.hurt > 0.3 ? 0x991111 : (m.fuse > 0 && Math.sin(m.fuse * 20) > 0 ? 0x666666 : 0);
      if (m.lastTint !== tint) { for (const mt of m.model.mats) mt.emissive.setHex(tint); m.lastTint = tint; }
    }
    // arrows
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const a = this.arrows[i]; a.life -= dt; a.vy -= 12 * dt;
      a.x += a.vx * dt; a.y += a.vy * dt; a.z += a.vz * dt;
      a.mesh.position.set(a.x, a.y, a.z); a.mesh.lookAt(a.x + a.vx, a.y + a.vy, a.z + a.vz);
      const hitBlock = SOLID[w.getBlock(Math.floor(a.x), Math.floor(a.y), Math.floor(a.z))];
      const pd = Math.hypot(pl.x - a.x, pl.y + 0.9 - a.y, pl.z - a.z);
      if (pd < 0.8 && g.mode === 'survival') { g.damagePlayer(a.dmg, a.x - a.vx, a.z - a.vz); a.life = 0; }
      if (hitBlock || a.life <= 0) { this.scene.remove(a.mesh); this.arrows.splice(i, 1); }
    }
    // fireballs
    for (let i = this.fireballs.length - 1; i >= 0; i--) {
      const f = this.fireballs[i]; f.life -= dt;
      f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt;
      f.mesh.position.set(f.x, f.y, f.z); f.mesh.rotation.x += dt * 5; f.mesh.rotation.y += dt * 4;
      if (Math.random() < dt * 20) this.burst(f.x, f.y, f.z, [1, 0.5 + Math.random() * 0.3, 0.1], 1, 0.6, f.big ? 0.22 : 0.1, 0.35);
      let boom = SOLID[w.getBlock(Math.floor(f.x), Math.floor(f.y), Math.floor(f.z))] || f.life <= 0;
      const pd = Math.hypot(pl.x - f.x, pl.y + 0.9 - f.y, pl.z - f.z);
      if (!f.deflected && pd < (f.big ? 1.4 : 0.9) && g.mode === 'survival' && !pl.dead) { g.damagePlayer((f.big ? 4 : 5) * [0, 0.5, 1, 1.5][g.difficulty], f.x - f.vx, f.z - f.vz); boom = true; }
      if (f.deflected) for (const o of this.mobs) { if (o.dead) continue; if (Math.hypot(o.x - f.x, o.y + o.h / 2 - f.y, o.z - f.z) < o.w + 0.8 + (o.def.big ? 1.2 : 0)) { this.hurtMob(o, f.big && o.type === 'ghast' ? 1000 : 6, f.x, f.z, true); boom = true; break; } }
      if (boom) {
        this.scene.remove(f.mesh); this.fireballs.splice(i, 1);
        if (f.big && f.life > 0) g.explode(f.x - f.vx * 0.03, f.y - f.vy * 0.03, f.z - f.vz * 0.03, 1);
        else { this.burst(f.x, f.y, f.z, [1, 0.5, 0.1], 8, 2, 0.1, 0.4); sfx.fizz(); }
      }
    }
    // items
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i]; it.age += dt;
      const dx = pl.x - it.x, dy = pl.y + 0.6 - it.y, dz = pl.z - it.z; const d = Math.hypot(dx, dy, dz);
      if (it.age > 0.6 && d < 1.8 && !pl.dead) {
        // attract
        it.x += dx * dt * 10; it.y += dy * dt * 10; it.z += dz * dt * 10;
        if (d < 0.7) {
          const left = g.inv.add(it.id, it.count, it.dur, it.ench);
          if (left < it.count) sfx.pop();
          if (left <= 0) { this.scene.remove(it.mesh); this.items.splice(i, 1); continue; } else it.count = left;
        }
      } else {
        it.vy -= 20 * dt; it.vx *= 1 - dt * 3; it.vz *= 1 - dt * 3;
        if (inLiquid(w, it)) it.vy = Math.max(it.vy, 0.5);
        moveEntity(w, it, it.vx * dt, it.vy * dt, it.vz * dt);
      }
      if (it.age > 300 || it.y < -10) { this.scene.remove(it.mesh); this.items.splice(i, 1); continue; }
      it.mesh.position.set(it.x, it.y + 0.15 + Math.sin(it.age * 3) * 0.06, it.z); it.mesh.rotation.y = it.age * 1.5;
    }
    // tnt
    for (let i = this.tnts.length - 1; i >= 0; i--) {
      const t = this.tnts[i]; t.fuse -= dt; t.vy -= 20 * dt; t.vx *= 0.95; t.vz *= 0.95;
      moveEntity(w, t, t.vx * dt, t.vy * dt, t.vz * dt);
      t.mesh.position.set(t.x, t.y + 0.49, t.z);
      t.mesh.material.emissive.setHex(Math.floor(t.fuse * 4) % 2 ? 0x888888 : 0);
      const s = t.fuse < 0.4 ? 1 + (0.4 - t.fuse) * 0.5 : 1; t.mesh.scale.set(s, s, s);
      if (t.fuse <= 0) { this.scene.remove(t.mesh); this.tnts.splice(i, 1); g.explode(t.x, t.y + 0.5, t.z, 4); }
    }
    // falling blocks
    for (let i = this.falling.length - 1; i >= 0; i--) {
      const f = this.falling[i]; f.vy -= 25 * dt;
      moveEntity(w, f, 0, f.vy * dt, 0);
      f.mesh.position.set(f.x, f.y + 0.49, f.z);
      if (f.onGround || f.y < 0) {
        this.scene.remove(f.mesh); this.falling.splice(i, 1);
        const bx = Math.floor(f.x), by = Math.floor(f.y + 0.3), bz = Math.floor(f.z);
        const cur = w.getBlock(bx, by, bz);
        if (cur === 0 || LIQUID[cur] || BLOCKS[cur].shape === 'cross') g.setBlock(bx, by, bz, f.id); else this.dropItem(f.id, 1, f.x, f.y + 0.5, f.z);
      }
    }
  }
  growUp(m) {
    m.baby = false; m.h = m.def.h; m.w = m.def.w;
    if (m.def.villager) {
      m.prof = ['farmer', 'librarian', 'smith', 'cleric', 'butcher', 'shepherd', 'mason', 'farmer', 'librarian'][Math.floor(Math.random() * 9)];
      this.scene.remove(m.model.g); m.model = buildModel(m.type, { prof: m.prof }); this.scene.add(m.model.g); m.lastTint = undefined;
      m.trades = this.game.makeTrades ? this.game.makeTrades(m.prof) : [];
    } else m.model.g.scale.setScalar(1);
  }
  breed(a, b) {
    a.loveT = b.loveT = 0; a.willing = b.willing = 0; a.breedCd = b.breedCd = 60;
    const x = (a.x + b.x) / 2, z = (a.z + b.z) / 2;
    if (a.def.villager) {
      const beds = this.game.countBeds ? this.game.countBeds(Math.floor(x), Math.floor(a.y), Math.floor(z)) : 0;
      const pop = this.mobs.filter((o) => o.def.villager && !o.dead && Math.hypot(o.x - x, o.z - z) < 24).length;
      if (beds <= pop) { this.hearts(x, a.y + 2, z, 6, true); sfx.villagerNo(); return null; }
    }
    const baby = this.spawnMob(a.type, x, a.y + 0.1, z, { baby: true, prof: a.def.villager ? 'baby' : undefined, home: a.home, plan: a.plan });
    this.hearts(x, a.y + 1.4, z, 8); sfx.heart(); if (a.def.villager) sfx.villager();
    if (!a.def.villager && this.game.addXP) this.game.addXP(1 + Math.floor(Math.random() * 7));
    return baby;
  }
  updateNetherMob(m, dt, distP, dxp, dzp, targetable) {
    const w = this.world, pl = this.game.player, md = m.def; const g = this.game;
    const diff = [0, 0.5, 1, 1.5][g.difficulty];
    const los = () => { const ox = m.x, oy = m.y + m.h * 0.6, oz = m.z; const tx = pl.x - ox, ty = pl.y + 1.4 - oy, tz = pl.z - oz; const d = Math.hypot(tx, ty, tz) || 1; const hit = w.raycast(ox, oy, oz, tx / d, ty / d, tz / d, d, (id) => SOLID[id]); return !hit || hit.t > d - 1; };
    let sp = 0;
    if (m.type === 'ghast') {
      m.wanderT -= dt;
      if (m.wanderT < 0) { m.wanderT = 3 + Math.random() * 4; m.targetYaw = Math.random() * Math.PI * 2; m.alt = Math.max(12, Math.min(H - 8, (targetable ? pl.y + 3 : m.y) + (Math.random() - 0.3) * 10)); }
      sp = md.speed;
      if (targetable && distP < 44) {
        m.targetYaw = Math.atan2(dxp, dzp); if (distP < 14) sp = -md.speed * 0.5;
        m.shootCd -= dt;
        if (m.shootCd < 0) { m.shootCd = 3 + Math.random() * 2.5; if (los()) { this.shootFireball(m, true); sfx.ghastShoot(); } }
      }
      m.vy += (Math.max(-2, Math.min(2, (m.alt - m.y) * 0.6)) - m.vy) * Math.min(1, dt * 2);
      const fx = Math.sin(m.yaw) * sp, fz = Math.cos(m.yaw) * sp;
      m.vx += (fx - m.vx) * Math.min(1, dt * 2); m.vz += (fz - m.vz) * Math.min(1, dt * 2);
      const hit = moveEntity(w, m, m.vx * dt, m.vy * dt, m.vz * dt); if (hit.hitX || hit.hitZ) { m.wanderT = 0; m.alt += 3; }
      m.walk += dt * 2; m.model.arms.forEach((t, k) => { t.rotation.x = Math.sin(m.walk + k) * 0.25; t.rotation.z = Math.cos(m.walk * 0.8 + k * 2) * 0.2; });
    } else if (m.type === 'blaze') {
      const chase = targetable && distP < 22;
      let desiredY = m.homeY ?? m.y;
      if (chase) {
        m.targetYaw = Math.atan2(dxp, dzp); sp = distP > 7 ? md.speed : 0; desiredY = pl.y + 2.2;
        m.shootCd -= dt;
        if (m.shootCd < 0 && los()) { m.shootCd = 4.5 + Math.random() * 2; m.volley = 3; m.volleyT = 0; sfx.blaze(); }
        if (m.volley > 0) { m.volleyT -= dt; if (m.volleyT <= 0) { m.volleyT = 0.32; m.volley--; this.shootFireball(m, false); } }
        if (distP < 1.4 && m.attackCd <= 0) { m.attackCd = 1; g.damagePlayer(6 * diff, m.x, m.z); }
      } else {
        m.wanderT -= dt; if (m.wanderT < 0) { m.wanderT = 2 + Math.random() * 4; m.targetYaw = Math.random() * 6.28; m.moving = Math.random() < 0.5; m.homeY = m.y + (Math.random() - 0.5) * 2; }
        sp = m.moving ? md.speed * 0.4 : 0;
      }
      m.vy += ((desiredY - m.y) * 1.5 - 1 - m.vy) * Math.min(1, dt * 2);
      const fx = Math.sin(m.yaw) * sp, fz = Math.cos(m.yaw) * sp;
      m.vx += (fx - m.vx) * Math.min(1, dt * 4); m.vz += (fz - m.vz) * Math.min(1, dt * 4);
      moveEntity(w, m, m.vx * dt, m.vy * dt, m.vz * dt);
      m.walk += dt; m.model.arms[0].rotation.y = m.walk * 2.5; m.model.arms[0].position.y = 0.9 + Math.sin(m.walk * 3) * 0.08;
      if (Math.random() < dt * 6) this.burst(m.x, m.y + 0.6, m.z, [1, 0.6, 0.15], 1, 0.8, 0.08, 0.5);
    } else if (m.type === 'magma_cube') {
      const chase = targetable && distP < 16;
      m.vy -= 28 * dt; m.vy = Math.max(m.vy, -40);
      if (m.onGround) {
        m.vx *= Math.max(0, 1 - dt * 12); m.vz *= Math.max(0, 1 - dt * 12);
        m.hopT = (m.hopT ?? 1) - dt;
        if (m.hopT < 0) {
          m.hopT = chase ? 0.8 + Math.random() * 0.6 : 2 + Math.random() * 3;
          if (chase) m.targetYaw = Math.atan2(dxp, dzp); else m.targetYaw = Math.random() * 6.28;
          m.yaw = m.targetYaw; const s2 = md.speed * (chase ? 1.3 : 0.6);
          m.vy = chase ? 9.5 : 6.5; m.vx = Math.sin(m.yaw) * s2; m.vz = Math.cos(m.yaw) * s2; sfx.slime && distP < 12 && sfx.slime();
        }
      }
      moveEntity(w, m, m.vx * dt, m.vy * dt, m.vz * dt);
      if (targetable && distP < 1.3 && m.attackCd <= 0) { m.attackCd = 1; g.damagePlayer(md.dmg * diff, m.x, m.z); }
      const stretch = m.onGround ? 0 : Math.min(1, Math.abs(m.vy) / 8);
      m.model.arms.forEach((sl, k) => { sl.position.y = 0.12 + k * (0.24 + stretch * 0.14); });
    }
    let dy = m.targetYaw - m.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
    m.yaw += dy * Math.min(1, dt * 4);
  }
  shootFireball(m, big) {
    const pl = this.game.player;
    const sx = m.x + Math.sin(m.yaw) * (big ? 1.9 : 0.5), sy = m.y + (big ? 2.4 : 1.4), sz = m.z + Math.cos(m.yaw) * (big ? 1.9 : 0.5);
    const tx = pl.x + (big ? 0 : (Math.random() - 0.5) * 1.5), ty = pl.y + 1.1, tz = pl.z + (big ? 0 : (Math.random() - 0.5) * 1.5);
    const d = Math.hypot(tx - sx, ty - sy, tz - sz) || 1; const sp = big ? 11 : 15;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(big ? 0.9 : 0.32, big ? 0.9 : 0.32, big ? 0.9 : 0.32), new THREE.MeshBasicMaterial({ color: big ? 0xff7a1a : 0xffb030 }));
    mesh.position.set(sx, sy, sz); this.scene.add(mesh);
    this.fireballs.push({ x: sx, y: sy, z: sz, vx: (tx - sx) / d * sp, vy: (ty - sy) / d * sp, vz: (tz - sz) / d * sp, big, life: 6, mesh, deflected: false });
    if (!big) sfx.fireball();
  }
  raycastFireballs(o, d, maxDist) {
    let best = null, bt = maxDist;
    for (const f of this.fireballs) {
      const vx = f.x - o.x, vy = f.y - o.y, vz = f.z - o.z; const t = vx * d.x + vy * d.y + vz * d.z;
      if (t < 0 || t > bt) continue;
      const px = vx - d.x * t, py = vy - d.y * t, pz = vz - d.z * t;
      if (Math.hypot(px, py, pz) < (f.big ? 0.9 : 0.45)) { bt = t; best = f; }
    }
    return best ? { fireball: best, t: bt } : null;
  }
  deflect(f, d) { const sp = Math.hypot(f.vx, f.vy, f.vz) * 1.2; f.vx = d.x * sp; f.vy = d.y * sp; f.vz = d.z * sp; f.deflected = true; f.life = 6; sfx.hit(); }
  nearest(m, pred, maxD) {
    let best = null, bd = maxD;
    for (const o of this.mobs) { if (o === m || !pred(o)) continue; const d = Math.hypot(o.x - m.x, o.z - m.z, o.y - m.y); if (d < bd) { bd = d; best = o; } }
    return best;
  }
  shootArrow(m, pl) {
    const sx = m.x, sy = m.y + 1.5, sz = m.z;
    const tx = pl.x, ty = pl.y + 1.2, tz = pl.z; const d = Math.hypot(tx - sx, ty - sy, tz - sz);
    const sp = 18;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.5), new THREE.MeshLambertMaterial({ color: 0x8a6232 }));
    this.scene.add(mesh);
    this.arrows.push({ x: sx, y: sy, z: sz, vx: (tx - sx) / d * sp + (Math.random() - 0.5), vy: (ty - sy) / d * sp + d * 0.32, vz: (tz - sz) / d * sp + (Math.random() - 0.5), life: 3, mesh, dmg: [0, 2, 3, 4][this.game.difficulty] });
  }
  raycastMobs(o, d, maxDist) {
    let best = null, bt = maxDist;
    for (const m of this.mobs) {
      if (m.dead) continue;
      const minx = m.x - m.w - 0.1, maxx = m.x + m.w + 0.1, miny = m.y, maxy = m.y + m.h, minz = m.z - m.w - 0.1, maxz = m.z + m.w + 0.1;
      let t0 = 0, t1 = bt;
      for (const [omin, omax, oo, dd] of [[minx, maxx, o.x, d.x], [miny, maxy, o.y, d.y], [minz, maxz, o.z, d.z]]) {
        if (Math.abs(dd) < 1e-9) { if (oo < omin || oo > omax) { t0 = 1e9; break; } continue; }
        let ta = (omin - oo) / dd, tb = (omax - oo) / dd; if (ta > tb) [ta, tb] = [tb, ta];
        t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 > t1) break;
      }
      if (t0 <= t1 && t0 < bt) { bt = t0; best = m; }
    }
    return best ? { mob: best, t: bt } : null;
  }
}
export { MOBS };
void H;
