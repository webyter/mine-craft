// Cars: AI city traffic, parked cars, player-placed cars and driving
import * as THREE from 'three';
import { moveEntity, collides } from './entities.js';
import { I } from './blocks.js';

const PAINT = [0xc4202a, 0xe8e9ec, 0x1f3f8f, 0x14161b, 0x9aa3ad, 0x2e7d4f, 0xe0a92a, 0xd2601c, 0x5b2a72, 0x137a86, 0x6b2f2a, 0x2f6f6a];
const CAR_HP = { car: 60, taxi: 60, police: 80, ambulance: 80, bus: 120 };
const unitBox = new THREE.BoxGeometry(1, 1, 1);
const wheelGeo = new THREE.CylinderGeometry(1, 1, 1, 14);
const matCache = new Map();
const lam = (c) => { const k = 'l' + c; if (!matCache.has(k)) matCache.set(k, new THREE.MeshLambertMaterial({ color: c })); return matCache.get(k); };
const bas = (c) => { const k = 'b' + c; if (!matCache.has(k)) matCache.set(k, new THREE.MeshBasicMaterial({ color: c, toneMapped: false })); return matCache.get(k); };
const shade = (c, k) => { const r = Math.min(255, Math.round(((c >> 16) & 255) * k)), g = Math.min(255, Math.round(((c >> 8) & 255) * k)), b = Math.min(255, Math.round((c & 255) * k)); return (r << 16) | (g << 8) | b; };
// procedural car paint: metallic sheen, darker sills and optional racing stripes
const paintCache = new Map();
function paintTexture(color, stripe) {
  const key = color + ':' + (stripe || 0);
  if (paintCache.has(key)) return paintCache.get(key);
  const S = 64, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d');
  const hx = (v) => '#' + (v & 0xffffff).toString(16).padStart(6, '0');
  const grad = g.createLinearGradient(0, 0, 0, S);
  grad.addColorStop(0, hx(shade(color, 1.35))); grad.addColorStop(0.42, hx(shade(color, 1.06)));
  grad.addColorStop(0.72, hx(color)); grad.addColorStop(1, hx(shade(color, 0.55)));
  g.fillStyle = grad; g.fillRect(0, 0, S, S);
  // clear-coat streaks
  g.globalAlpha = 0.16; g.strokeStyle = hx(shade(color, 1.6)); g.lineWidth = 2;
  for (let i = 0; i < 5; i++) { const x = 6 + Math.random() * (S - 12); g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 3, S); g.stroke(); }
  g.globalAlpha = 1;
  // metallic flecks
  for (let i = 0; i < 260; i++) { g.fillStyle = Math.random() < 0.5 ? hx(shade(color, 1.5)) : hx(shade(color, 0.7)); g.globalAlpha = 0.16; g.fillRect(Math.random() * S | 0, Math.random() * S | 0, 1, 1); }
  g.globalAlpha = 1;
  if (stripe) { g.fillStyle = hx(stripe); g.fillRect(S * 0.30, 0, S * 0.10, S); g.fillRect(S * 0.60, 0, S * 0.10, S); }
  const tex = new THREE.CanvasTexture(cv); tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipMapLinearFilter;
  paintCache.set(key, tex);
  return tex;
}
// merge a car's static boxes into one geometry per colour, so a detailed body is still cheap to draw
function mergeBoxes(list) {
  const bp = unitBox.attributes.position.array, bn = unitBox.attributes.normal.array, bu = unitBox.attributes.uv.array, bi = unitBox.index.array;
  const n = bp.length / 3;
  const pos = new Float32Array(list.length * n * 3), nor = new Float32Array(list.length * n * 3), uv = new Float32Array(list.length * n * 2);
  const idx = new Uint16Array(list.length * bi.length);
  list.forEach(([w, h, d, x, y, z], k) => {
    const ww = w || 1, hh = h || 1, dd = d || 1;
    for (let i = 0; i < n; i++) {
      const o = (k * n + i) * 3;
      pos[o] = bp[i * 3] * w + x; pos[o + 1] = bp[i * 3 + 1] * h + y; pos[o + 2] = bp[i * 3 + 2] * d + z;
      let nx = bn[i * 3] / ww, ny = bn[i * 3 + 1] / hh, nz = bn[i * 3 + 2] / dd;
      const l = Math.hypot(nx, ny, nz) || 1;
      nor[o] = nx / l; nor[o + 1] = ny / l; nor[o + 2] = nz / l;
      uv[(k * n + i) * 2] = bu[i * 2]; uv[(k * n + i) * 2 + 1] = bu[i * 2 + 1];
    }
    for (let i = 0; i < bi.length; i++) idx[k * bi.length + i] = bi[i] + k * n;
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  return geo;
}
function wheel(g, r, w, x, y, z, tyre, rim) {
  const grp = new THREE.Group(); grp.position.set(x, y, z);
  const t = new THREE.Mesh(wheelGeo, tyre); t.scale.set(r, w, r); t.rotation.z = Math.PI / 2; grp.add(t);
  const h = new THREE.Mesh(wheelGeo, rim); h.scale.set(r * 0.6, w * 1.06, r * 0.6); h.rotation.z = Math.PI / 2; grp.add(h);
  const cap = new THREE.Mesh(wheelGeo, tyre); cap.scale.set(r * 0.22, w * 1.12, r * 0.22); cap.rotation.z = Math.PI / 2; grp.add(cap);
  g.add(grp); return grp;
}

export function buildCar(color, kind = 'car', opts = {}) {
  const g = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ map: paintTexture(color, opts.stripe || null) }),
    paintDark = new THREE.MeshLambertMaterial({ map: paintTexture(color, opts.stripe || null), color: 0xb8b8b8 }),
    dark = lam(0x14161a), trim = lam(0xb9bec6),
    chrome = lam(0xdfe4ea), glass = lam(0x86b6da), glassRear = lam(0x33485a), tyre = lam(0x121418), plateM = lam(0xf2f2ea),
    headL = bas(0xfff6cf), tailL = new THREE.MeshBasicMaterial({ color: 0x7a1410, toneMapped: false });
  const parts = new Map();
  const add = (m, w, h, d, x, y, z) => { let a = parts.get(m); if (!a) parts.set(m, a = []); a.push([w, h, d, x, y, z]); };
  const bus = kind === 'bus';
  const L = bus ? 7.5 : 4.1, W = bus ? 2.2 : 1.8, hw = W / 2;
  const wheels = [];
  if (bus) {
    add(dark, W - 0.06, 0.3, L - 0.1, 0, 0.5, 0);
    add(paint, W, 1.9, L, 0, 1.55, 0);
    add(paintDark, W + 0.02, 0.34, L - 0.06, 0, 0.85, 0);
    add(glass, W + 0.03, 0.8, L - 0.7, 0, 2.06, -0.05);
    add(glass, W - 0.24, 0.86, 0.05, 0, 2.03, L / 2 + 0.01);
    add(glassRear, W - 0.3, 0.6, 0.05, 0, 2.02, -L / 2 - 0.01);
    add(bas(0xfff0a8), W - 0.55, 0.2, 0.05, 0, 2.62, L / 2 + 0.01);
    add(dark, 0.05, 1.5, 0.9, hw + 0.01, 1.35, L * 0.28);
    add(glass, 0.04, 0.5, 0.82, hw + 0.03, 2.0, L * 0.28);
    for (const z of [-1.4, 1.2]) add(trim, W - 0.7, 0.12, 0.7, 0, 2.56, z);
    add(trim, 0.04, 0.5, 0.04, -hw + 0.3, 2.78, -L / 2 + 0.5);
    add(trim, W + 0.03, 0.2, 0.22, 0, 0.62, L / 2 - 0.05); add(trim, W + 0.03, 0.2, 0.22, 0, 0.62, -L / 2 + 0.05);
    for (const s of [-1, 1]) {
      add(headL, 0.42, 0.24, 0.05, s * (hw - 0.34), 0.95, L / 2 + 0.02);
      add(tailL, 0.36, 0.24, 0.05, s * (hw - 0.32), 0.95, -L / 2 - 0.02);
    }
    add(plateM, 0.5, 0.16, 0.03, 0, 0.7, L / 2 + 0.03); add(plateM, 0.5, 0.16, 0.03, 0, 0.7, -L / 2 - 0.03);
    const wz = L / 2 - 1.3;
    for (const s of [-1, 1]) {
      wheels.push(wheel(g, 0.44, 0.3, s * (hw - 0.14), 0.44, wz, tyre, trim));
      wheels.push(wheel(g, 0.44, 0.3, s * (hw - 0.14), 0.44, -wz, tyre, trim));
      wheels.push(wheel(g, 0.44, 0.3, s * (hw - 0.14), 0.44, -wz + 1.5, tyre, trim));
    }
  } else {
    const cabL = L * 0.42, cabZ = -0.08;
    add(dark, W - 0.08, 0.16, L - 0.12, 0, 0.44, 0);
    add(paint, W, 0.44, L, 0, 0.74, 0);
    add(paintDark, W - 0.04, 0.1, L - 0.24, 0, 0.98, -0.02);
    add(paint, W - 0.16, 0.08, L * 0.28, 0, 1.0, L * 0.31);
    add(paint, W - 0.16, 0.08, L * 0.2, 0, 1.0, -L * 0.36);
    add(paint, W - 0.16, 0.38, cabL, 0, 1.24, cabZ);
    add(paintDark, W - 0.26, 0.06, cabL - 0.08, 0, 1.46, cabZ);
    add(glass, W - 0.36, 0.28, 0.04, 0, 1.25, cabZ + cabL / 2 + 0.01);
    add(glassRear, W - 0.36, 0.26, 0.04, 0, 1.25, cabZ - cabL / 2 - 0.01);
    for (const s of [-1, 1]) add(glass, 0.04, 0.24, cabL - 0.24, s * (W - 0.2) / 2, 1.25, cabZ);
    add(trim, W + 0.03, 0.18, 0.18, 0, 0.62, L / 2 - 0.03);
    add(trim, W + 0.03, 0.18, 0.18, 0, 0.62, -L / 2 + 0.03);
    add(dark, W - 0.66, 0.14, 0.05, 0, 0.84, L / 2 + 0.01);
    add(plateM, 0.44, 0.14, 0.03, 0, 0.66, L / 2 + 0.02);
    add(plateM, 0.44, 0.14, 0.03, 0, 0.66, -L / 2 - 0.02);
    for (const s of [-1, 1]) {
      add(headL, 0.36, 0.14, 0.05, s * (hw - 0.28), 0.88, L / 2 + 0.01);
      add(tailL, 0.34, 0.12, 0.05, s * (hw - 0.28), 0.88, -L / 2 - 0.01);
      add(paintDark, 0.1, 0.08, 0.16, s * (hw + 0.06), 1.22, cabZ + cabL / 2 - 0.05);
      add(chrome, 0.03, 0.05, 0.2, s * (hw + 0.02), 1.0, cabZ + 0.1);
      add(chrome, 0.02, 0.05, 0.2, s * (hw + 0.01), 1.0, cabZ - cabL / 2 + 0.12);
      add(dark, 0.01, 0.36, 0.02, s * (hw + 0.005), 0.78, cabZ + 0.16);
    }
    add(dark, 0.12, 0.1, 0.12, hw - 0.34, 0.42, -L / 2 + 0.04);
    if (opts.stripe != null) {
      const st = lam(opts.stripe);
      add(st, 0.34, 0.02, L * 0.27, 0, 1.05, L * 0.31);
      add(st, 0.62, 0.02, cabL - 0.1, 0, 1.5, cabZ);
    }
    const wz = L / 2 - 0.85;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) wheels.push(wheel(g, 0.36, 0.26, sx * (hw - 0.08), 0.36, sz * wz, tyre, trim));
    // wheel arches, rocker panel, door seams, exhaust and a roof fin finish the body
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      add(paintDark, 0.1, 0.3, 0.74, sx * (hw + 0.01), 0.68, sz * wz);
      add(dark, 0.02, 0.14, 0.72, sx * (hw + 0.006), 0.45, sz * wz);
    }
    add(paintDark, W + 0.02, 0.09, L - 0.5, 0, 0.5, 0);
    add(paint, W - 0.3, 0.1, L * 0.34, 0, 1.02, L * 0.33);
    for (const s of [-1, 1]) add(dark, 0.014, 0.4, 0.02, s * (hw + 0.008), 0.86, cabZ + 0.14);
    add(chrome, 0.12, 0.08, 0.16, hw - 0.32, 0.34, -L / 2 - 0.03);
    add(paintDark, 0.16, 0.09, 0.36, 0, 1.52, -L * 0.34);
  }
  if (kind === 'police') {
    add(bas(0x2f5cff), 1.0, 0.16, 0.34, -0.26, 1.58, -0.1); add(bas(0xff2a2a), 1.0, 0.16, 0.34, 0.26, 1.58, -0.1);
    for (const s of [-1, 1]) add(chrome, 0.03, 0.3, 1.1, s * (hw + 0.02), 0.86, 0.1);
    add(dark, W + 0.05, 0.22, 0.16, 0, 0.72, L / 2 + 0.06);
  }
  if (kind === 'taxi') {
    add(bas(0xfff2a8), 0.66, 0.22, 0.32, 0, 1.62, -0.1);
    for (const s of [-1, 1]) add(dark, 0.02, 0.12, L * 0.5, s * (hw + 0.02), 0.72, -0.05);
  }
  if (kind === 'ambulance') {
    add(lam(0xe03030), W + 0.04, 0.3, L * 0.9, 0, 0.8, 0);
    add(bas(0xff4040), W + 0.02, 0.16, 0.34, 0, 1.58, 0.2);
    for (const s of [-1, 1]) add(lam(0xf4f4f4), 0.16, 0.5, 0.16, s * 0.3, 1.2, -L / 2 - 0.02);
  }
  for (const [m, list] of parts) { const mesh = new THREE.Mesh(mergeBoxes(list), m); mesh.userData.own = true; g.add(mesh); }
  g.userData.wheels = wheels;
  g.userData.tail = tailL;
  return g;
}

export class Vehicles {
  constructor(game, scene, opts) {
    this.g = game; this.scene = scene; this.o = opts; this.list = []; this.t = 0; this.spawnT = 0; this.hornT = 0;
  }
  clear() { for (const c of this.list) { this.disposeMesh(c); this.scene.remove(c.mesh); } this.list = []; }
  disposeMesh(c) { c.mesh.traverse((o) => { if (o.isMesh && o.userData.own && o.geometry) o.geometry.dispose(); }); }
  phase() { return this.t % 20; } // 0-8 z green, 8-10 z amber, 10-18 x green, 18-20 x amber
  lightFor(axis) { const p = this.phase(); if (axis === 'z') return p < 8 ? 'g' : p < 10 ? 'y' : 'r'; return p >= 10 && p < 18 ? 'g' : p >= 18 ? 'y' : 'r'; }
  add(o) {
    const kind = o.kind || 'car';
    const c = Object.assign({ x: 0, y: 0, z: 0, yaw: 0, speed: 0, vy: 0, w: 0.9, h: 1.5, stepH: 0.6, onGround: false, color: PAINT[0], ai: false, roll: 0, charge: 100, kind }, o);
    if (c.color == null) c.color = PAINT[Math.floor(Math.random() * PAINT.length)];
    if (c.stripe === undefined) c.stripe = kind === 'car' && Math.random() < 0.35 ? 0xf4f4f4 : null;
    if (c.hp == null) c.hp = CAR_HP[kind] || 30;
    c.maxHp = c.hp;
    c.mesh = buildCar(c.color, kind, { stripe: c.stripe }); c.mesh.position.set(c.x, c.y, c.z); c.mesh.rotation.y = c.yaw; this.scene.add(c.mesh); this.list.push(c);
    return c;
  }
  // crashes wear a car down slowly: at most one dent every second
  damageCar(c, dmg) {
    if (!c || c.dead) return;
    if (c.dmgT != null && this.t - c.dmgT < 1) return;
    c.dmgT = this.t; this.hurtCar(c, dmg);
  }
  // hitting a car damages it: smoke, then a wreck when the body gives out
  hurtCar(c, dmg) {
    if (!c || c.dead || !(dmg > 0)) return false;
    c.hp -= dmg;
    if (this.o.carHurt) this.o.carHurt(c, dmg);
    if (c.hp > 0) return false;
    c.hp = 0; c.dead = true;
    if (this.o.carBroken) this.o.carBroken(c);
    this.remove(c);
    return true;
  }
  remove(c) { this.disposeMesh(c); this.scene.remove(c.mesh); const i = this.list.indexOf(c); if (i >= 0) this.list.splice(i, 1); }
  // place a car where the player taps
  place(x, y, z, yaw, color) { return this.add({ x, y, z, yaw, color: color ?? PAINT[Math.floor(Math.random() * PAINT.length)], owned: true }); }
  raycast(o, d, max) {
    let best = null;
    for (const c of this.list) {
      const cs = Math.cos(-c.yaw), sn = Math.sin(-c.yaw);
      const ox = o.x - c.x, oz = o.z - c.z;
      const lo = { x: ox * cs + oz * sn, y: o.y - c.y, z: -ox * sn + oz * cs }, ld = { x: d.x * cs + d.z * sn, y: d.y, z: -d.x * sn + d.z * cs };
      const L = c.kind === 'bus' ? 3.8 : 2.1, W = c.kind === 'bus' ? 1.15 : 0.95, Hh = c.kind === 'bus' ? 3.05 : 1.7;
      let t0 = 0, t1 = max;
      for (const [p, v, lo2, hi] of [[lo.x, ld.x, -W, W], [lo.y, ld.y, 0, Hh], [lo.z, ld.z, -L, L]]) {
        if (Math.abs(v) < 1e-6) { if (p < lo2 || p > hi) { t0 = Infinity; break; } continue; }
        let a = (lo2 - p) / v, b = (hi - p) / v; if (a > b) [a, b] = [b, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) break;
      }
      if (t0 <= t1 && t0 < max && (!best || t0 < best.t)) best = { car: c, t: t0 };
    }
    return best;
  }
  // ---------- per-frame ----------
  update(dt, player, ents) {
    this.t += dt; const w = this.g.world; if (!w) return;
    if (this.g.dim !== 'overworld') { if (this.list.length) this.clear(); return; }
    this.spawnT -= dt; if (this.spawnT < 0) { this.spawnT = 1; this.populate(player); }
    for (const c of this.list.slice()) {
      if (c === player.riding) this.drive(c, dt, player, ents);
      else if (c.ai) this.aiStep(c, dt, player, ents);
      else this.physics(c, dt, 0);
      c.mesh.position.set(c.x, c.y, c.z);
      let dy = c.yaw - c.mesh.rotation.y; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
      c.mesh.rotation.y += dy * Math.min(1, dt * (c.ai ? 6 : 20));
      c.roll += c.speed * dt / 0.36; for (const wh of c.mesh.userData.wheels) wh.rotation.x = c.roll;
      // brake lights and smoke from a damaged engine
      if (c.mesh.userData.tail) c.mesh.userData.tail.color.setHex(c.brake || Math.abs(c.speed) < 0.4 ? 0xff3a2a : 0x7a1410);
      if (c.hp < c.maxHp * 0.4 && Math.random() < dt * 6 && this.o.carSmoke) this.o.carSmoke(c);
    }
    for (const m of ents.mobs) if (m.carCd > 0) m.carCd -= dt;
    this.resolveCars(player);
  }
  // cars must not drive through each other: separate overlapping boxes and slow both
  resolveCars(player) {
    const L = this.list;
    const box = (c) => {
      const hw = (c.kind === 'bus' ? 1.15 : 0.95), hl = (c.kind === 'bus' ? 3.8 : 2.1);
      const s = Math.abs(Math.sin(c.yaw)), co = Math.abs(Math.cos(c.yaw));
      return [s * hl + co * hw, co * hl + s * hw];
    };
    for (let i = 0; i < L.length; i++) {
      const a = L[i]; const ea = box(a);
      for (let j = i + 1; j < L.length; j++) {
        const b = L[j];
        if (Math.abs(a.y - b.y) > 2.2) continue;
        const eb = box(b);
        const dx = b.x - a.x, dz = b.z - a.z;
        const ox = ea[0] + eb[0] - Math.abs(dx), oz = ea[1] + eb[1] - Math.abs(dz);
        if (ox <= 0 || oz <= 0) continue;
        if (ox < oz) { const s = Math.sign(dx) || 1, push = ox / 2 + 0.01; a.x -= s * push; b.x += s * push; }
        else { const s = Math.sign(dz) || 1, push = oz / 2 + 0.01; a.z -= s * push; b.z += s * push; }
        a.speed *= 0.75; b.speed *= 0.75;
        const hitSpeed = Math.max(Math.abs(a.speed), Math.abs(b.speed));
        if (hitSpeed > 10) { const dmg = Math.min(6, hitSpeed * 0.2); this.damageCar(a, dmg); this.damageCar(b, dmg); }
        const me = player.riding === a ? a : player.riding === b ? b : null;
        if (me) { me.speed *= 0.6; if (Math.abs(me.speed) > 9 && this.o.crash) this.o.crash(me, Math.abs(me.speed)); }
      }
    }
  }
  populate(player) {
    const w = this.g.world; const S = w.settle; if (!S) return;
    const px = player.x, pz = player.z;
    // despawn far cars
    for (const c of this.list.slice()) {
      if (c === player.riding || c.keep) continue;
      const d = Math.hypot(c.x - px, c.z - pz);
      if ((c.ai && d > 110) || (!c.ai && !c.owned && d > 140)) { if (c.src) c.src.spawned = false; this.remove(c); }
    }
    const plans = S.plansNear(px - 100, pz - 100, px + 100, pz + 100);
    for (const p of plans) {
      if (!p.parked) continue;
      for (const pk of p.parked) {
        if (pk.spawned || Math.hypot(pk.x - px, pk.z - pz) > 90 || !w.isLoaded(Math.floor(pk.x), Math.floor(pk.z))) continue;
        pk.spawned = true; const kind = pk.color === 0xf4f4f4 ? 'ambulance' : pk.color === 0x1a2a6a ? 'police' : 'car';
        const c = this.add({ x: pk.x, y: pk.y + 0.01, z: pk.z, yaw: pk.yaw, color: pk.color, kind }); c.src = pk;
      }
    }
    const city = plans.find((p) => p.type === 'city' && px > p.r[0] - 30 && px < p.r[2] + 30 && pz > p.r[1] - 30 && pz < p.r[3] + 30);
    if (!city) return;
    const ai = this.list.filter((c) => c.ai).length;
    const G = city.grid;
    for (let n = ai; n < 14; n++) {
      // random road segment 25-80 blocks away
      for (let tries = 0; tries < 6; tries++) {
        const axis = Math.random() < 0.5 ? 'z' : 'x', dir = Math.random() < 0.5 ? 1 : -1;
        const road = Math.floor(Math.random() * (G.NB + 1)), seg = Math.floor(Math.random() * G.NB);
        const along = (axis === 'z' ? G.z0 : G.x0) + seg * G.P + G.RW + 2 + Math.random() * (G.P - G.RW - 4);
        const lane = (axis === 'z' ? G.x0 : G.z0) + road * G.P + this.laneOff(axis, dir);
        const x = axis === 'z' ? lane : along, z = axis === 'z' ? along : lane;
        const d = Math.hypot(x - px, z - pz); if (d < 25 || d > 80) continue;
        if (this.list.some((c) => Math.hypot(c.x - x, c.z - z) < 8)) continue;
        if (!w.isLoaded(Math.floor(x), Math.floor(z))) continue;
        const r = Math.random(); const kind = r < 0.08 ? 'taxi' : r < 0.13 ? 'bus' : r < 0.17 ? 'police' : 'car';
        this.add({ x, y: G.base + 1.01, z, yaw: this.yawOf(axis, dir), ai: true, axis, dir, city, speed: 6, color: kind === 'taxi' ? 0xf0c020 : kind === 'bus' ? 0x2a7ad8 : kind === 'police' ? 0x1a2a6a : PAINT[Math.floor(Math.random() * PAINT.length)], kind, cruise: kind === 'bus' ? 7 : 8 + Math.random() * 3 });
        break;
      }
    }
  }
  overlapsPlayer(c, player) {
    const h = c.kind === 'bus' ? 3.05 : 1.7;
    if (player.dead || player.y >= c.y + h || player.y + player.h <= c.y) return false;
    const dx = player.x - c.x, dz = player.z - c.z, co = Math.cos(c.yaw), si = Math.sin(c.yaw);
    const lx = dx * co - dz * si, lz = dx * si + dz * co;
    const hw = c.kind === 'bus' ? 1.15 : 0.95, hl = c.kind === 'bus' ? 3.8 : 2.1;
    return Math.hypot(Math.max(Math.abs(lx) - hw, 0), Math.max(Math.abs(lz) - hl, 0)) < player.w;
  }
  // right-hand traffic: +z drives at offset 2.2 of a road band, -z at 4.8; +x at 4.8, -x at 2.2
  laneOff(axis, dir) { return axis === 'z' ? (dir > 0 ? 2.2 : 4.8) : (dir > 0 ? 4.8 : 2.2); }
  yawOf(axis, dir) { return axis === 'z' ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2); }
  aiStep(c, dt, player, ents) {
    const G = c.city.grid; const P = G.P, RW = G.RW; const oldX = c.x, oldZ = c.z;
    const pos = c.axis === 'z' ? c.z : c.x, o0 = c.axis === 'z' ? G.z0 : G.x0;
    const lane = c.axis === 'z' ? c.x : c.z, lo0 = c.axis === 'z' ? G.x0 : G.z0;
    const road = Math.round((lane - lo0 - 3.5) / P);
    const half = c.kind === 'bus' ? 3.8 : 2.1;
    // next intersection along travel direction
    if (pos < o0 - 3 || pos > o0 + G.SZ + 3) { this.remove(c); return; }
    const rel = (pos - o0) / P; let j = Math.floor(rel); if (c.dir > 0 && (pos - o0) - j * P > RW - 1) j++;
    const iStart = o0 + j * P, iEnd = iStart + RW; // intersection band
    const front = pos + c.dir * half;
    let target = c.cruise;
    if (c.blockedT > 0) { c.blockedT -= dt; target = 0; }
    // signals: stop before the intersection on red/amber
    const light = this.lightFor(c.axis);
    const stopAt = c.dir > 0 ? iStart - 0.6 : iEnd + 0.6;
    const toStop = (stopAt - front) * c.dir;
    if (light !== 'g' && toStop > -0.2 && toStop < 14 && !(light === 'y' && toStop < 2.5)) target = Math.min(target, Math.max(0, toStop * 1.1 - 0.4));
    // keep distance to whatever is ahead
    const ahead = (ox, oz, gap) => { const along = ((c.axis === 'z' ? oz : ox) - pos) * c.dir; const side = Math.abs((c.axis === 'z' ? ox : oz) - lane); if (along > 0 && along < gap && side < 1.4) target = Math.min(target, Math.max(0, (along - half - 2.2) * 1.4)); return along > 0 && along < gap && side < 1.4; };
    for (const o of this.list) if (o !== c) ahead(o.x, o.z, 12);
    let blockedByLife = false;
    if (!player.dead && ahead(player.x, player.z, 9)) blockedByLife = true;
    for (const m of ents.mobs) if (!m.dead && Math.abs(m.x - c.x) < 10 && Math.abs(m.z - c.z) < 10 && ahead(m.x, m.z, 8)) blockedByLife = true;
    if (blockedByLife && c.speed < 1 && Math.random() < dt * 0.25 && Math.hypot(player.x - c.x, player.z - c.z) < 20) this.o.horn(c);
    c.speed += Math.sign(target - c.speed) * Math.min(Math.abs(target - c.speed), dt * (target < c.speed ? 9 : 3.5));
    let move = c.speed * dt;
    // turning decision at the lane crossing point inside the intersection
    if (c.planJ !== j) { c.planJ = j; c.turn = this.chooseTurn(c, j, road, G); }
    if (c.turn) {
      const nAxis = c.axis === 'z' ? 'x' : 'z', nDir = c.turn;
      const crossAt = (c.axis === 'z' ? G.z0 : G.x0) + j * P + this.laneOff(nAxis, nDir);
      const dist = (crossAt - pos) * c.dir;
      if (dist >= 0 && dist <= move) {
        if (c.axis === 'z') c.z = crossAt; else c.x = crossAt;
        c.axis = nAxis; c.dir = nDir; c.turn = 0; c.planJ = null; c.yaw = this.yawOf(nAxis, nDir); move -= dist;
      }
    }
    if (c.axis === 'z') c.z += c.dir * move; else c.x += c.dir * move;
    c.y = G.base + 1.01;
    if (this.overlapsPlayer(c, player)) {
      const speed = c.speed; c.x = oldX; c.z = oldZ; c.speed = 0; c.blockedT = 0.9;
      if (speed > 5 && this.o.hurtPlayer) { const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw); this.o.hurtPlayer(Math.min(8, Math.max(1, (speed - 4) * 0.6)), fx * 10, fz * 10); }
    } else if (c.speed > 4) this.impact(c, player, ents);
  }
  chooseTurn(c, j, road, G) {
    // j: intersection index along travel axis (0..NB); road: index of the road we are on (0..NB)
    const straightOk = c.dir > 0 ? j < G.NB : j > 0;
    const opts = [];
    if (straightOk) opts.push(0, 0, 0);
    // turning onto the crossing road: new direction +1 is valid if road < NB, -1 if road > 0
    if (road < G.NB) opts.push(1); if (road > 0) opts.push(-1);
    if (!opts.length) return c.dir > 0 ? -1 : 1;
    return opts[Math.floor(Math.random() * opts.length)];
  }
  impact(c, player, ents) {
    const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw); const half = c.kind === 'bus' ? 3.8 : 2.1;
    const hx = c.x + fx * half, hz = c.z + fz * half;
    const speed = Math.abs(c.speed);
    for (const m of ents.mobs) {
      if (m.dead || m.carCd > 0) continue;
      if (Math.abs(m.x - hx) < 1.3 && Math.abs(m.z - hz) < 1.3 && Math.abs(m.y - c.y) < 2) {
        m.carCd = 1; ents.hurtMob(m, Math.min(20, speed * 0.7), c.x, c.z, c === player.riding, 2.2);
        if (!c.ai) c.speed *= 0.6;
      }
    }
    // a car only hurts someone it is actually driving into, once per bump
    if (c !== player.riding && !player.dead && speed > 5 && this.o.hurtPlayer) {
      const toward = (player.x - c.x) * fx + (player.z - c.z) * fz;
      if (toward > 0 && Math.abs(player.x - hx) < 1.2 && Math.abs(player.z - hz) < 1.2 && Math.abs(player.y - c.y) < 2) {
        this.o.hurtPlayer(Math.min(8, Math.max(1, (speed - 4) * 0.6)), fx * 10, fz * 10);
        c.speed *= 0.3;
      }
    }
  }
  physics(c, dt, throttleSpeed) {
    const w = this.g.world;
    if (!w.isLoaded(Math.floor(c.x), Math.floor(c.z))) return { hit: false };
    c.vy -= 28 * dt; c.vy = Math.max(c.vy, -40);
    const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
    const dx = fx * c.speed * dt, dz = fz * c.speed * dt;
    const y0 = c.y;
    const r = moveEntity(w, c, dx, c.vy * dt, dz);
    if ((r.hitX || r.hitZ) && c.onGround !== undefined) {
      // try stepping up one block (kerbs, slabs)
      const e = { x: c.x, y: y0 + 1.05, z: c.z, w: c.w, h: c.h };
      if (!collides(w, e.x - c.w, e.y, e.z - c.w, e.x + c.w, e.y + c.h, e.z + c.w)) {
        const tx = c.x + (r.hitX ? dx : 0), tz = c.z + (r.hitZ ? dz : 0);
        if (!collides(w, tx - c.w, e.y, tz - c.w, tx + c.w, e.y + c.h, tz + c.w)) { c.x = tx; c.z = tz; c.y = e.y; return { hit: false }; }
      }
      if (Math.abs(c.speed) > 10) { this.o.crash && this.o.crash(c, Math.abs(c.speed)); this.damageCar(c, Math.min(8, Math.abs(c.speed) * 0.25)); }
      c.speed *= 0.35;
      return { hit: true };
    }
    if (c.onGround) c.speed *= throttleSpeed ? 1 : Math.max(0, 1 - dt * 2.5);
    if (c.y < -20) { c.y = 80; c.vy = 0; }
    return { hit: false };
  }
  drive(c, dt, player, ents) {
    const ctl = this.o.controls();
    c.brake = ctl.throttle < -0.05 || (ctl.throttle > 0.05 && c.speed < -0.5);
    const max = c.charge > 0 ? (c.kind === 'bus' ? 14 : 22) : 3;
    const want = ctl.throttle > 0.05 ? ctl.throttle * max : ctl.throttle < -0.05 ? ctl.throttle * 7 : 0;
    if (ctl.throttle > 0.05 && c.speed < -0.5) c.speed += dt * 18;
    else if (ctl.throttle < -0.05 && c.speed > 0.5) c.speed -= dt * 20;
    else if (Math.abs(want) > 0.01) c.speed += Math.sign(want - c.speed) * Math.min(Math.abs(want - c.speed), dt * 9);
    else c.speed *= Math.max(0, 1 - dt * 1.6);
    if (c.onGround) c.yaw -= ctl.steer * dt * 2.4 * Math.max(-1, Math.min(1, c.speed / 3));
    this.physics(c, dt, Math.abs(want) > 0.01);
    if (c.dead || player.riding !== c) return; // the car was wrecked by the impact
    c.charge = Math.max(0, c.charge - Math.abs(c.speed) * dt / 60);
    if (Math.abs(c.speed) < 0.5 && this.o.nearCharger(c)) { c.charge = Math.min(100, c.charge + dt * 12); c.charging = true; } else c.charging = false;
    if (Math.abs(c.speed) > 4) this.impact(c, player, ents);
    player.x = c.x; player.y = c.y + 0.2; player.z = c.z; player.vx = player.vy = player.vz = 0; player.fallStart = null; player.onGround = true;
  }
  serialize() { return this.list.filter((c) => c.owned).map((c) => ({ x: c.x, y: c.y, z: c.z, yaw: c.yaw, color: c.color })); }
}
export { PAINT };
