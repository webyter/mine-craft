// Cars: AI city traffic, parked cars, player-placed cars and driving
import * as THREE from 'three';
import { moveEntity, collides } from './entities.js';
import { I } from './blocks.js';

const PAINT = [0xd8202a, 0xf0f0f0, 0x2a5ad8, 0x202024, 0x9a9aa0, 0x3aa04a, 0xe8c030, 0xe86a20, 0x6a2a8a, 0x1a7a8a];
const geo = new THREE.BoxGeometry(1, 1, 1);
const matCache = new Map();
const lam = (c) => { const k = 'l' + c; if (!matCache.has(k)) matCache.set(k, new THREE.MeshLambertMaterial({ color: c })); return matCache.get(k); };
const bas = (c) => { const k = 'b' + c; if (!matCache.has(k)) matCache.set(k, new THREE.MeshBasicMaterial({ color: c, toneMapped: false })); return matCache.get(k); };
function bx(g, w, h, d, x, y, z, m) { const b = new THREE.Mesh(geo, m); b.scale.set(w, h, d); b.position.set(x, y, z); g.add(b); return b; }

export function buildCar(color, kind = 'car') {
  const g = new THREE.Group(); const body = lam(color), dark = lam(0x1a1c20), glass = lam(0x7aa8d0), trim = lam(0xb8bcc4);
  const L = kind === 'bus' ? 7.5 : 4.1, W = kind === 'bus' ? 2.2 : 1.8;
  if (kind === 'bus') {
    bx(g, W, 2.2, L, 0, 1.55, 0, body); bx(g, W + 0.02, 0.7, L - 1, 0, 2.0, -0.2, glass); bx(g, W - 0.2, 0.9, 0.05, 0, 1.95, L / 2 + 0.01, glass);
  } else {
    bx(g, W, 0.62, L, 0, 0.72, 0, body);
    bx(g, W - 0.12, 0.55, L * 0.5, 0, 1.3, -0.15, body);
    bx(g, W - 0.08, 0.42, L * 0.46, 0, 1.31, -0.15, glass);
    bx(g, W - 0.3, 0.44, 0.06, 0, 1.3, L * 0.1 + 0.02, glass);
    bx(g, W + 0.02, 0.12, L, 0, 0.5, 0, dark);
  }
  bx(g, W + 0.04, 0.16, 0.2, 0, 0.6, L / 2 - 0.06, trim); bx(g, W + 0.04, 0.16, 0.2, 0, 0.6, -L / 2 + 0.06, trim);
  for (const s of [-1, 1]) { bx(g, 0.36, 0.14, 0.05, s * (W / 2 - 0.3), 0.82, L / 2 + 0.01, bas(0xfff4c0)); bx(g, 0.36, 0.14, 0.05, s * (W / 2 - 0.3), 0.82, -L / 2 - 0.01, bas(0xff2020)); }
  const wheels = [];
  const wz = kind === 'bus' ? L / 2 - 1.2 : L / 2 - 0.8;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const wh = new THREE.Group(); wh.position.set(sx * (W / 2 - 0.12), 0.36, sz * wz); bx(wh, 0.28, 0.72, 0.72, 0, 0, 0, dark); bx(wh, 0.3, 0.3, 0.3, 0, 0, 0, trim); g.add(wh); wheels.push(wh); }
  if (kind === 'police') { bx(g, 1.0, 0.14, 0.3, -0.25, 1.65, -0.15, bas(0x2040ff)); bx(g, 1.0, 0.14, 0.3, 0.25, 1.65, -0.15, bas(0xff2020)); bx(g, W + 0.02, 0.18, L * 0.5, 0, 0.75, 0, lam(0xf0f0f0)); }
  if (kind === 'taxi') { bx(g, 0.6, 0.2, 0.3, 0, 1.68, -0.15, bas(0xfff080)); }
  if (kind === 'ambulance') { bx(g, W - 0.1, 0.7, L * 0.55, 0, 1.4, -0.7, lam(0xf4f4f4)); bx(g, 0.5, 0.5, 0.05, 0, 1.4, -L / 2 - 0.02 + 0.3, bas(0xe02020)); bx(g, 1.0, 0.14, 0.3, 0, 1.8, 0.2, bas(0xff3030)); }
  g.userData.wheels = wheels;
  return g;
}

export class Vehicles {
  constructor(game, scene, opts) {
    this.g = game; this.scene = scene; this.o = opts; this.list = []; this.t = 0; this.spawnT = 0; this.hornT = 0;
  }
  clear() { for (const c of this.list) this.scene.remove(c.mesh); this.list = []; }
  phase() { return this.t % 20; } // 0-8 z green, 8-10 z amber, 10-18 x green, 18-20 x amber
  lightFor(axis) { const p = this.phase(); if (axis === 'z') return p < 8 ? 'g' : p < 10 ? 'y' : 'r'; return p >= 10 && p < 18 ? 'g' : p >= 18 ? 'y' : 'r'; }
  add(o) {
    const kind = o.kind || 'car';
    const c = Object.assign({ x: 0, y: 0, z: 0, yaw: 0, speed: 0, vy: 0, w: 0.9, h: 1.5, onGround: false, color: PAINT[0], ai: false, hp: 6, roll: 0, charge: 100, kind }, o);
    c.mesh = buildCar(c.color, kind); c.mesh.position.set(c.x, c.y, c.z); c.mesh.rotation.y = c.yaw; this.scene.add(c.mesh); this.list.push(c);
    return c;
  }
  remove(c) { this.scene.remove(c.mesh); const i = this.list.indexOf(c); if (i >= 0) this.list.splice(i, 1); }
  // place a car where the player taps
  place(x, y, z, yaw, color) { return this.add({ x, y, z, yaw, color: color ?? PAINT[Math.floor(Math.random() * PAINT.length)], owned: true }); }
  raycast(o, d, max) {
    let best = null;
    for (const c of this.list) {
      const cs = Math.cos(-c.yaw), sn = Math.sin(-c.yaw);
      const ox = o.x - c.x, oz = o.z - c.z;
      const lo = { x: ox * cs + oz * sn, y: o.y - c.y, z: -ox * sn + oz * cs }, ld = { x: d.x * cs + d.z * sn, y: d.y, z: -d.x * sn + d.z * cs };
      const L = c.kind === 'bus' ? 3.8 : 2.1, W = c.kind === 'bus' ? 1.15 : 0.95, Hh = c.kind === 'bus' ? 2.7 : 1.7;
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
  // right-hand traffic: +z drives at offset 2.2 of a road band, -z at 4.8; +x at 4.8, -x at 2.2
  laneOff(axis, dir) { return axis === 'z' ? (dir > 0 ? 2.2 : 4.8) : (dir > 0 ? 4.8 : 2.2); }
  yawOf(axis, dir) { return axis === 'z' ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2); }
  aiStep(c, dt, player, ents) {
    const G = c.city.grid; const P = G.P, RW = G.RW;
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
    // hit the player / mobs if they jump in front at speed
    if (c.speed > 4) this.impact(c, player, ents);
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
    for (const m of ents.mobs) {
      if (m.dead || m.carCd > 0) continue;
      if (Math.abs(m.x - hx) < 1.3 && Math.abs(m.z - hz) < 1.3 && Math.abs(m.y - c.y) < 2) {
        m.carCd = 1; ents.hurtMob(m, Math.min(20, Math.abs(c.speed) * 0.7), c.x, c.z, c === player.riding, 2.2);
        if (!c.ai) c.speed *= 0.6;
      }
    }
    for (const m of ents.mobs) if (m.carCd > 0) m.carCd -= 0.016;
    if (c !== player.riding && !player.dead && Math.abs(player.x - hx) < 1.2 && Math.abs(player.z - hz) < 1.2 && Math.abs(player.y - c.y) < 2 && this.o.hurtPlayer) {
      this.o.hurtPlayer(Math.min(10, c.speed * 0.5), fx * 10, fz * 10); c.speed = 0;
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
      if (Math.abs(c.speed) > 8) { this.o.crash && this.o.crash(c, Math.abs(c.speed)); }
      c.speed *= 0.2;
      return { hit: true };
    }
    if (c.onGround) c.speed *= throttleSpeed ? 1 : Math.max(0, 1 - dt * 2.5);
    if (c.y < -20) { c.y = 80; c.vy = 0; }
    return { hit: false };
  }
  drive(c, dt, player, ents) {
    const ctl = this.o.controls();
    const max = c.charge > 0 ? (c.kind === 'bus' ? 14 : 22) : 3;
    const want = ctl.throttle > 0.05 ? ctl.throttle * max : ctl.throttle < -0.05 ? ctl.throttle * 7 : 0;
    if (ctl.throttle > 0.05 && c.speed < -0.5) c.speed += dt * 18;
    else if (ctl.throttle < -0.05 && c.speed > 0.5) c.speed -= dt * 20;
    else if (Math.abs(want) > 0.01) c.speed += Math.sign(want - c.speed) * Math.min(Math.abs(want - c.speed), dt * 7);
    else c.speed *= Math.max(0, 1 - dt * 1.6);
    if (c.onGround) c.yaw -= ctl.steer * dt * 2.2 * Math.max(-1, Math.min(1, c.speed / 6));
    this.physics(c, dt, Math.abs(want) > 0.01);
    c.charge = Math.max(0, c.charge - Math.abs(c.speed) * dt / 60);
    if (Math.abs(c.speed) < 0.5 && this.o.nearCharger(c)) { c.charge = Math.min(100, c.charge + dt * 12); c.charging = true; } else c.charging = false;
    if (Math.abs(c.speed) > 4) this.impact(c, player, ents);
    player.x = c.x; player.y = c.y + 0.2; player.z = c.z; player.vx = player.vy = player.vz = 0; player.fallStart = null; player.onGround = true;
  }
  serialize() { return this.list.filter((c) => c.owned).map((c) => ({ x: c.x, y: c.y, z: c.z, yaw: c.yaw, color: c.color })); }
}
export { PAINT };
