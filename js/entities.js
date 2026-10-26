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
    const tile = faces[f]; const col = tile % 16, row = Math.floor(tile / 16);
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v; const u0 = uv.getX(i), v0 = uv.getY(i);
      uv.setXY(i, (col + 0.01 + u0 * 0.98) / 16, 1 - (row + 1 - (0.01 + v0 * 0.98)) / 16);
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
  cow: { w: 0.45, h: 1.3, hp: 10, speed: 1.1, drops: [[I.RAW_BEEF, 1, 3]], sound: 'cow', passive: true },
  sheep: { w: 0.45, h: 1.25, hp: 8, speed: 1.1, drops: [[B.WOOL, 1, 1], [I.RAW_MUTTON, 1, 2]], sound: 'sheep', passive: true },
  zombie: { w: 0.3, h: 1.9, hp: 20, speed: 2.4, drops: [[I.ROTTEN_FLESH, 0, 2]], sound: 'zombie', hostile: true, dmg: 3 },
  creeper: { w: 0.3, h: 1.7, hp: 20, speed: 2.2, drops: [[I.GUNPOWDER, 0, 2]], sound: 'hiss', hostile: true },
  skeleton: { w: 0.3, h: 1.9, hp: 20, speed: 2.2, drops: [[I.BONE, 0, 2], [I.ARROW, 0, 2]], sound: 'zombie', hostile: true, dmg: 2 },
};
function buildModel(type) {
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
  } else {
    const skin = type === 'zombie' ? 0x5f9a4a : type === 'creeper' ? 0x58b84a : 0xc8c8c8;
    if (type === 'creeper') {
      const body = box(0.5, 0.75, 0.3, skin, mats); body.position.y = 0.95; g.add(body);
      for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const l = pivot(box(0.24, 0.55, 0.24, 0x4aa03e, mats), lx * 0.13, 0.55, lz * 0.2, -0.275); g.add(l); legs.push(l); }
      head = new THREE.Group(); head.position.set(0, 1.58, 0); head.add(box(0.5, 0.5, 0.5, skin, mats)); g.add(head);
      for (const s of [-1, 1]) { const e = box(0.12, 0.12, 0.02, 0x101010, mats); e.position.set(s * 0.12, 0.06, 0.255); head.add(e); }
      const mo = box(0.12, 0.16, 0.02, 0x101010, mats); mo.position.set(0, -0.1, 0.255); head.add(mo);
    } else {
      const shirt = type === 'zombie' ? 0x2a9ca8 : 0xbababa, pants = type === 'zombie' ? 0x3a3a9a : 0xaaaaaa;
      const lw = type === 'skeleton' ? 0.12 : 0.24;
      const body = box(0.5, 0.75, 0.26, shirt, mats); body.position.y = 1.12; g.add(body);
      for (const s of [-1, 1]) { const l = pivot(box(lw, 0.75, lw, pants, mats), s * 0.125, 0.75, 0, -0.375); g.add(l); legs.push(l); }
      for (const s of [-1, 1]) { const a = pivot(box(lw, 0.72, lw, skin, mats), s * 0.37, 1.45, 0, -0.32); a.rotation.x = -Math.PI / 2; g.add(a); arms.push(a); }
      head = new THREE.Group(); head.position.set(0, 1.74, 0); head.add(box(0.48, 0.48, 0.48, skin, mats)); g.add(head);
      for (const s of [-1, 1]) { const e = box(0.1, 0.07, 0.02, type === 'zombie' ? 0x1a2a10 : 0x202020, mats); e.position.set(s * 0.11, 0.04, 0.245); head.add(e); }
    }
  }
  return { g, legs, head, arms, mats };
}

export class EntityManager {
  constructor(game) {
    this.game = game; this.scene = game.scene; this.world = game.world;
    this.mobs = []; this.items = []; this.tnts = []; this.falling = []; this.arrows = [];
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
    this.mobs = []; this.items = []; this.tnts = []; this.falling = []; this.arrows = []; this.parts = [];
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
  dropItem(id, count, x, y, z, vx, vy, vz, dur) {
    if (!id || count <= 0) return;
    let mesh;
    if (isBlock(id) && BLOCKS[id].shape !== 'cross' && BLOCKS[id].shape !== 'torch') mesh = new THREE.Mesh(blockGeometry(id, 0.25), this.blockMat);
    else { mesh = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.spriteTex(id), alphaTest: 0.5 })); mesh.scale.set(0.4, 0.4, 0.4); }
    this.scene.add(mesh);
    this.items.push({ id, count, dur, x, y, z, vx: vx ?? (Math.random() - 0.5) * 3, vy: vy ?? 3, vz: vz ?? (Math.random() - 0.5) * 3, w: 0.125, h: 0.25, age: 0, mesh, onGround: false });
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
  spawnMob(type, x, y, z) {
    const def = MOBS[type]; const model = buildModel(type);
    this.scene.add(model.g);
    const m = { type, def, model, x, y, z, vx: 0, vy: 0, vz: 0, w: def.w, h: def.h, hp: def.hp, yaw: Math.random() * 6.28, targetYaw: 0,
      walk: 0, wanderT: 0, moving: false, hurt: 0, attackCd: 0, fuse: 0, onGround: false, dead: 0, sayT: 4 + Math.random() * 10, burn: 0, shootCd: 2 };
    this.mobs.push(m); return m;
  }
  hurtMob(m, dmg, fromX, fromZ) {
    if (m.dead || m.hurt > 0.35) return false;
    m.hp -= dmg; m.hurt = 0.5;
    const dx = m.x - fromX, dz = m.z - fromZ, d = Math.hypot(dx, dz) || 1;
    m.vx += dx / d * 6; m.vz += dz / d * 6; m.vy = 5;
    sfx.hit(); if (m.def.sound && m.def.passive) sfx[m.def.sound]();
    if (m.def.passive) m.panic = 5;
    if (m.hp <= 0) {
      m.dead = 0.8;
      for (const [id, a, b] of m.def.drops) {
        const n = a + Math.floor(Math.random() * (b - a + 1));
        if (n > 0) this.dropItem(id, n, m.x, m.y + 0.5, m.z);
      }
      this.game.addXP && this.game.addXP(m.def.hostile ? 5 : 2);
    }
    return true;
  }
  update(dt) {
    const g = this.game, w = this.world, pl = g.player;
    // mobs
    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const m = this.mobs[i]; const md = m.def;
      const dxp = pl.x - m.x, dzp = pl.z - m.z, distP = Math.hypot(dxp, dzp, (pl.y - m.y));
      if (distP > 80 || (md.hostile && g.difficulty === 0)) { this.scene.remove(m.model.g); this.mobs.splice(i, 1); continue; }
      if (m.dead > 0) {
        m.dead -= dt; m.model.g.rotation.z = Math.min(Math.PI / 2, (0.8 - m.dead) * 4);
        if (m.dead <= 0) { this.burst(m.x, m.y + 0.5, m.z, [0.9, 0.9, 0.9], 16, 2, 0.15); this.scene.remove(m.model.g); this.mobs.splice(i, 1); }
        continue;
      }
      if (!w.isLoaded(Math.floor(m.x), Math.floor(m.z))) continue;
      m.hurt = Math.max(0, m.hurt - dt); m.attackCd -= dt; m.sayT -= dt;
      if (m.sayT < 0 && distP < 16) { m.sayT = 8 + Math.random() * 14; if (md.sound && m.type !== 'creeper') sfx[md.sound](); }
      let speed = 0; let chase = false;
      const playerTargetable = g.mode === 'survival' && !pl.dead;
      if (md.hostile && playerTargetable && distP < 18) {
        chase = true; m.targetYaw = Math.atan2(dxp, dzp);
        speed = md.speed;
        if (m.type === 'skeleton' && distP < 8) speed = 0;
      } else {
        m.wanderT -= dt;
        if (m.wanderT < 0) { m.wanderT = 2 + Math.random() * 5; m.moving = Math.random() < 0.55; m.targetYaw = Math.random() * Math.PI * 2; }
        if (m.panic > 0) { m.panic -= dt; m.moving = true; if (Math.random() < dt * 2) m.targetYaw = Math.random() * 6.28; }
        speed = m.moving ? md.speed * (m.panic > 0 ? 2 : 0.6) : 0;
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
        } else if (distP < 1.4 && m.attackCd <= 0) { m.attackCd = 1; g.damagePlayer(md.dmg * [0, 0.5, 1, 1.5][g.difficulty], m.x, m.z); }
      } else if (m.type === 'creeper') { m.fuse = 0; m.model.g.scale.set(1, 1, 1); }
      // burn in daylight
      if (md.hostile && m.type !== 'creeper' && g.daylight > 0.75 && !inWater && w.topSolid(Math.floor(m.x), Math.floor(m.z)) < m.y + m.h) {
        m.burn += dt; if (Math.random() < dt * 8) this.burst(m.x, m.y + 1.2, m.z, [1, 0.5, 0.1], 2, 1, 0.1, 0.4);
        if (m.burn > 1) { m.burn = 0; this.hurtMob(m, 1, m.x, m.z); }
      }
      // cactus / lava
      // animate
      const sp = Math.hypot(m.vx, m.vz); m.walk += sp * dt * 4;
      const sw = Math.sin(m.walk) * Math.min(1, sp) * 0.7;
      m.model.legs.forEach((l, k) => { l.rotation.x = (k % 2 === (k < 2 ? 0 : 1) ? sw : -sw); });
      if (m.model.legs.length === 2) { m.model.legs[0].rotation.x = sw; m.model.legs[1].rotation.x = -sw; }
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
    // items
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i]; it.age += dt;
      const dx = pl.x - it.x, dy = pl.y + 0.6 - it.y, dz = pl.z - it.z; const d = Math.hypot(dx, dy, dz);
      if (it.age > 0.6 && d < 1.8 && !pl.dead) {
        // attract
        it.x += dx * dt * 10; it.y += dy * dt * 10; it.z += dz * dt * 10;
        if (d < 0.7) {
          const left = g.inv.add(it.id, it.count, it.dur);
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
