// Modern world layer: animated props (signals, LED screens, turbines, planes) and device UIs (phone, computer, elevator, ATM)
import * as THREE from 'three';
import { B, I, BLOCKS, itemName, maxStack, maxDur } from './blocks.js';
import { iconFor } from './textures.js';

const ADS = [
  ['MINE CRAFT', '2025 EDITION'], ['PHONE 17 PRO', 'NOW WITH 6G'], ['DRIVE ELECTRIC', 'ZERO EMISSIONS'], ['CLOUD AI', 'THINK BIGGER'],
  ['SOLAR CITY', 'POWER UP'], ['BREAKING NEWS', 'LIVE 24/7'], ['MINE BURGER', '2 FOR 1 EMERALD'], ['VR HEADSET', 'STEP INSIDE'],
  ['STREAM NOW', 'NEW SEASON'], ['SMART HOME', 'VOICE CONTROL'],
];
const HEADLINES = [
  'Electric car sales hit a new record across the region', 'Tech HQ unveils a foldable smartphone', 'Wind farms now power half of the city grid',
  'New metro line planned to connect the suburbs', 'Local hospital opens a robotic surgery wing', 'Stadium sold out for tonight\'s final',
  'Data centers switch to 100% solar power', 'Creeper sightings reported near the construction site', 'Villagers queue overnight for the new phone',
  'City council approves more bike lanes', 'Emerald prices climb on strong trading', 'Scientists confirm the Nether is very hot',
];
const SHOP = [
  [I.SMARTPHONE, 1, 6], [I.CIRCUIT, 2, 2], [I.BATTERY, 2, 1], [I.DRONE, 1, 8], [I.CAR, 1, 20], [B.COMPUTER, 1, 6], [B.TV, 1, 3],
  [B.SOLAR_PANEL, 6, 4], [B.LED_SCREEN, 4, 4], [B.GLASS_BLUE, 16, 2], [B.STEEL, 8, 2], [B.EV_CHARGER, 1, 4], [B.VENDING, 1, 3],
  [B.TRAFFIC_LIGHT, 2, 2], [B.ELEVATOR, 2, 3], [B.HELIPAD, 8, 2], [B.MARBLE, 16, 2], [I.STEAK, 6, 1],
];
const lampMats = { r: new THREE.MeshBasicMaterial({ color: 0xff2a20, toneMapped: false }), y: new THREE.MeshBasicMaterial({ color: 0xffc020, toneMapped: false }), g: new THREE.MeshBasicMaterial({ color: 0x30ff70, toneMapped: false }) };
const lampGeo = new THREE.PlaneGeometry(0.34, 0.34);
const bladeMat = new THREE.MeshLambertMaterial({ color: 0xf4f6f8 });
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const FRONT_N = [[0, 1], [1, 0], [0, -1], [-1, 0]]; // meta -> front normal (x,z)

export class Tech {
  constructor(game, scene, o) {
    this.g = game; this.scene = scene; this.o = o; this.props = new Map(); this.screens = []; this.signalMeshes = []; this.rotors = [];
    this.t = 0; this.drawT = 0; this.planeT = 20; this.plane = null; this.photos = []; this.waypoint = null; this.atmDay = new Map();
    this.el = document.getElementById('device'); this.body = document.getElementById('dev-body'); this.title = document.getElementById('dev-title');
    document.getElementById('dev-close').addEventListener('click', () => this.close());
    this.el.addEventListener('pointerdown', (e) => e.stopPropagation());
  }
  reset() { for (const [, p] of this.props) this.scene.remove(p.group); this.props.clear(); this.screens = []; this.signalMeshes = []; this.rotors = []; if (this.plane) { this.scene.remove(this.plane.g); this.plane = null; } this.waypoint = null; }
  // ---------- props ----------
  update(dt, player, vehicles) {
    this.t += dt; const w = this.g.world; if (!w || !w.settle) return;
    if (this.g.dim !== 'overworld') { if (this.props.size) this.reset(); return; }
    const px = player.x, pz = player.z;
    this.scanT = (this.scanT || 0) - dt;
    if (this.scanT < 0) {
      this.scanT = 1.2;
      for (const p of w.settle.plansNear(px - 150, pz - 150, px + 150, pz + 150)) {
        if (!p.signals) continue; const k = p.x + ',' + p.z;
        if (!this.props.has(k) && Math.hypot(p.x - px, p.z - pz) < 190) this.build(k, p);
      }
      for (const [k, pr] of this.props) if (Math.hypot(pr.p.x - px, pr.p.z - pz) > 260) this.drop(k);
    }
    // traffic signal lamps
    const lz = vehicles.lightFor('z'), lx = vehicles.lightFor('x');
    for (const m of this.signalMeshes) {
      const st = m.userData.axis === 'z' ? lz : lx;
      if (m.userData.st !== st) { m.userData.st = st; m.material = lampMats[st]; m.position.y = m.userData.y0 + (st === 'r' ? 0.78 : st === 'y' ? 0.47 : 0.16); }
    }
    // rotors
    for (const r of this.rotors) r.rotation.z += dt * 0.9;
    // LED screens
    this.drawT -= dt;
    if (this.drawT < 0) {
      this.drawT = 0.12;
      for (const s of this.screens) { if (Math.hypot(s.cx - px, s.cz - pz) < 110) this.drawScreen(s); }
    }
    this.updatePlane(dt, player);
    this.updateWaypoint(player);
  }
  build(k, p) {
    const group = new THREE.Group(); const rec = { p, group, screens: [], sig: [], rot: [] };
    for (const s of p.signals) {
      for (const [ax, nx, nz] of [['z', 0, -1], ['z', 0, 1], ['x', -1, 0], ['x', 1, 0]]) {
        const m = new THREE.Mesh(lampGeo, lampMats.r); m.userData = { axis: ax, y0: s.y, st: null };
        m.position.set(s.x + 0.5 + nx * 0.45, s.y + 0.78, s.z + 0.5 + nz * 0.45); m.rotation.y = Math.atan2(nx, nz);
        group.add(m); rec.sig.push(m);
      }
    }
    for (const s of p.screens) {
      const W = s.w, Hh = s.h; const ppb = Math.max(12, Math.min(28, Math.floor(512 / W)));
      const cv = document.createElement('canvas'); cv.width = W * ppb; cv.height = Hh * ppb;
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(W, Hh), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
      if (s.axis === 'x') { mesh.position.set(s.x + W / 2, s.y + Hh / 2, s.dir < 0 ? s.z - 0.03 : s.z + 1.03); mesh.rotation.y = s.dir < 0 ? Math.PI : 0; }
      else { mesh.position.set(s.dir > 0 ? s.x + 1.03 : s.x - 0.03, s.y + Hh / 2, s.z + W / 2); mesh.rotation.y = s.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
      group.add(mesh);
      const sc = { s, cv, ctx: cv.getContext('2d'), tex, mesh, ad: Math.floor(Math.abs(s.x * 7 + s.z * 3)) % ADS.length, cx: mesh.position.x, cz: mesh.position.z, big: !!s.big };
      rec.screens.push(sc); this.drawScreen(sc);
    }
    for (const t of p.turbines || []) {
      const hub = new THREE.Group(); hub.position.set(t.x, t.y + 0.5, t.z);
      const nose = new THREE.Mesh(boxGeo, bladeMat); nose.scale.set(0.8, 0.8, 0.6); hub.add(nose);
      for (let b = 0; b < 3; b++) { const arm = new THREE.Group(); arm.rotation.z = b * Math.PI * 2 / 3; const bl = new THREE.Mesh(boxGeo, bladeMat); bl.scale.set(0.7, 13, 0.14); bl.position.y = 6.8; arm.add(bl); hub.add(arm); }
      group.add(hub); rec.rot.push(hub);
    }
    this.scene.add(group); this.props.set(k, rec); this.refresh();
  }
  drop(k) { const r = this.props.get(k); if (!r) return; this.scene.remove(r.group); for (const s of r.screens) { s.tex.dispose(); s.mesh.material.dispose(); s.mesh.geometry.dispose(); } this.props.delete(k); this.refresh(); }
  refresh() { this.screens = []; this.signalMeshes = []; this.rotors = []; for (const [, r] of this.props) { this.screens.push(...r.screens); this.signalMeshes.push(...r.sig); this.rotors.push(...r.rot); } }
  drawScreen(sc) {
    const { ctx, cv } = sc; const W = cv.width, Hh = cv.height; const t = this.t;
    const cyc = Math.floor((t + sc.ad * 3) / 6); const ad = ADS[(sc.ad + cyc) % ADS.length]; const ph = ((t + sc.ad * 3) % 6) / 6;
    const hue = ((sc.ad + cyc) * 47) % 360;
    const gr = ctx.createLinearGradient(0, 0, W, Hh); gr.addColorStop(0, `hsl(${hue},80%,${22 + 8 * Math.sin(t * 2)}%)`); gr.addColorStop(1, `hsl(${(hue + 60) % 360},85%,38%)`);
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, Hh);
    // moving light streaks
    ctx.globalAlpha = 0.18; ctx.fillStyle = '#fff';
    for (let i = 0; i < 4; i++) { const x = ((t * 60 + i * W / 4) % (W + 80)) - 40; ctx.fillRect(x, 0, 18, Hh); }
    ctx.globalAlpha = 1;
    const tickerH = sc.big ? Math.floor(Hh * 0.18) : 0;
    const area = Hh - tickerH;
    const fs = Math.max(10, Math.min(area * 0.42, W / Math.max(ad[0].length, 6) * 1.5));
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `900 ${Math.floor(fs)}px system-ui, sans-serif`; ctx.fillStyle = '#fff';
    const slide = ph < 0.12 ? (1 - ph / 0.12) * W : 0;
    ctx.fillText(ad[0], W / 2 + slide, area * 0.4);
    ctx.font = `700 ${Math.floor(fs * 0.5)}px system-ui, sans-serif`; ctx.fillStyle = `hsl(${(hue + 180) % 360},100%,80%)`;
    ctx.fillText(ad[1], W / 2 - slide, area * 0.75);
    if (sc.big) {
      ctx.fillStyle = '#c01818'; ctx.fillRect(0, area, W, tickerH); ctx.fillStyle = '#fff'; ctx.font = `700 ${Math.floor(tickerH * 0.62)}px system-ui, sans-serif`; ctx.textAlign = 'left';
      const msg = HEADLINES.join('   •   ') + '   •   ';
      const mw = ctx.measureText(msg).width; const off = (t * 70) % mw;
      ctx.fillText(msg, -off, area + tickerH / 2); ctx.fillText(msg, mw - off, area + tickerH / 2);
      ctx.textAlign = 'right'; ctx.fillStyle = '#ffe680'; ctx.font = `800 ${Math.floor(tickerH * 0.9)}px system-ui, sans-serif`; ctx.fillText(this.clock(), W - 8, tickerH * 0.6);
    }
    // pixel grid for an LED look
    ctx.fillStyle = 'rgba(0,0,0,0.22)'; for (let x = 0; x < W; x += 4) ctx.fillRect(x, 0, 1, Hh); for (let y = 0; y < Hh; y += 4) ctx.fillRect(0, y, W, 1);
    sc.tex.needsUpdate = true;
  }
  clock() { const tk = Math.floor(this.g.ticks % 24000); const h = Math.floor((tk / 1000 + 6) % 24), m = Math.floor((tk % 1000) * 0.06); return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0'); }
  // ---------- airplanes ----------
  updatePlane(dt, player) {
    if (!this.plane) {
      this.planeT -= dt; if (this.planeT > 0) return; this.planeT = 35 + Math.random() * 50;
      const g = new THREE.Group(); const white = new THREE.MeshLambertMaterial({ color: 0xf2f4f8 }), blue = new THREE.MeshLambertMaterial({ color: 0x2a5ad8 }), grey = new THREE.MeshLambertMaterial({ color: 0x9aa0a8 });
      const add = (m, sx, sy, sz, x, y, z) => { const b = new THREE.Mesh(boxGeo, m); b.scale.set(sx, sy, sz); b.position.set(x, y, z); g.add(b); return b; };
      add(white, 2.2, 2.2, 22, 0, 0, 0); add(blue, 2.25, 0.5, 20, 0, -0.4, 0); add(white, 26, 0.35, 4, 0, -0.3, 1); add(white, 9, 0.3, 2.2, 0, 0.2, -9.5); add(blue, 0.3, 4, 3, 0, 2.2, -9.8);
      add(grey, 1.4, 1.4, 3.2, -5, -1.1, 2); add(grey, 1.4, 1.4, 3.2, 5, -1.1, 2); add(new THREE.MeshLambertMaterial({ color: 0x223040 }), 1.6, 0.6, 0.4, 0, 0.5, 10.9);
      const blink = add(new THREE.MeshBasicMaterial({ color: 0xff2020, toneMapped: false }), 0.5, 0.5, 0.5, 13, -0.3, 1);
      const a = Math.random() * Math.PI * 2, d = 340; const sx = player.x + Math.cos(a) * d, sz = player.z + Math.sin(a) * d;
      const off = (Math.random() - 0.5) * 140; const tx = player.x - Math.cos(a) * d - Math.sin(a) * off, tz = player.z - Math.sin(a) * d + Math.cos(a) * off;
      const len = Math.hypot(tx - sx, tz - sz); g.position.set(sx, 122, sz); g.rotation.y = Math.atan2(tx - sx, tz - sz);
      this.scene.add(g); this.plane = { g, vx: (tx - sx) / len * 42, vz: (tz - sz) / len * 42, life: len / 42, blink };
      return;
    }
    const pl = this.plane; pl.g.position.x += pl.vx * dt; pl.g.position.z += pl.vz * dt; pl.life -= dt; pl.blink.visible = (this.t % 1) < 0.15;
    const d = Math.hypot(pl.g.position.x - player.x, pl.g.position.z - player.z);
    if (d < 200 && this.o.planeSound) this.o.planeSound(1 - d / 200);
    if (pl.life < 0) { this.scene.remove(pl.g); this.plane = null; }
  }
  updateWaypoint(player) {
    const el = document.getElementById('waypoint'); if (!el) return;
    if (!this.waypoint || this.g.dim !== 'overworld') { if (!el.classList.contains('hidden')) el.classList.add('hidden'); return; }
    const wp = this.waypoint; const dx = wp.x - player.x, dz = wp.z - player.z; const d = Math.hypot(dx, dz);
    if (d < 12) { this.waypoint = null; this.o.toast('You have arrived at ' + wp.name); return; }
    const ang = Math.atan2(dx, dz) - Math.atan2(-Math.sin(player.yaw), -Math.cos(player.yaw));
    el.classList.remove('hidden'); el.innerHTML = `<span class="wp-arrow" style="transform:rotate(${(-ang * 180 / Math.PI).toFixed(0)}deg)">&#9650;</span> ${wp.name} · ${Math.round(d)} m`;
  }
  // ---------- devices ----------
  open(title, html) {
    const ui = this.o.ui; if (ui.screen && ui.screen !== 'device') ui.close();
    ui.screen = 'device'; this.g.onScreenOpen(); this.el.classList.remove('hidden'); this.title.textContent = title; this.body.innerHTML = html; this.wire();
  }
  close() { if (this.o.ui.screen === 'device') this.o.ui.screen = null; this.el.classList.add('hidden'); this.g.onScreenClose(); }
  wire() { for (const b of this.body.querySelectorAll('[data-act]')) b.addEventListener('click', (e) => { e.stopPropagation(); this.act(b.dataset.act, b.dataset.arg); }); }
  act(a, arg) {
    const f = { app: () => this.app(arg), home: () => this.phone(), buy: () => this.buy(+arg), floor: () => this.goFloor(+arg), taxi: () => this.taxi(), photo: () => this.photo(), nav: () => this.nav(arg), weather: () => { this.g.raining = !this.g.raining; this.app('weather'); }, withdraw: () => this.withdraw(), vend: () => this.vend(), shop: () => this.computer('shop'), news: () => this.computer('news'), close: () => this.close() }[a];
    if (f) { this.o.sfx.click(); f(); }
  }
  phone() {
    const apps = [['maps', 'Maps', '#2a9a5a'], ['gps', 'GPS', '#2a6ad8'], ['weather', 'Weather', '#e8a020'], ['taxi', 'Taxi', '#f0c020'], ['camera', 'Camera', '#555'], ['photos', 'Photos', '#d84a7a'], ['news', 'News', '#c01818'], ['shop', 'MineShop', '#6a2ad8']];
    this.open('Smartphone', `<div class="dev-status">${this.clock()} · 5G · ${this.g.raining ? 'Rain' : 'Clear'}</div><div class="apps">${apps.map(([k, n, c]) => `<button class="app" data-act="app" data-arg="${k}"><span class="app-ic" style="background:${c}">${n[0]}</span>${n}</button>`).join('')}</div>`);
  }
  back() { return '<button class="dev-back" data-act="home">‹ Home</button>'; }
  app(k) {
    if (k === 'maps') { this.open('Maps', this.back() + '<canvas id="dev-map" width="256" height="256"></canvas><div class="dev-note">North is up · 256 m across</div>'); this.drawMap(document.getElementById('dev-map')); return; }
    if (k === 'gps') {
      const S = this.g.world.settle; const P = this.o.player; const rows = [];
      for (const type of ['city', 'village', 'energy']) { const p = S.nearest(type, P.x, P.z, 10); if (p) rows.push(p); }
      this.open('GPS', this.back() + (rows.length ? rows.map((p) => { const d = Math.hypot(p.x - P.x, p.z - P.z); return `<div class="row"><div><b>${p.name || 'Village'}</b><br><small>${p.type === 'energy' ? 'Wind farm' : p.type[0].toUpperCase() + p.type.slice(1)} · ${Math.round(d)} m ${this.compass(p.x - P.x, p.z - P.z)}</small></div><button data-act="nav" data-arg="${p.x},${p.z},${encodeURIComponent(p.name || 'Village')}">Go</button></div>`; }).join('') : '<p>No places found nearby.</p>'));
      return;
    }
    if (k === 'weather') {
      const P = this.o.player; const c = this.g.world.column(Math.floor(P.x), Math.floor(P.z)); const temp = [24, 21, 14, 26, -4, 34, 30][c.biome] ?? 20;
      const t = temp - (this.g.raining ? 4 : 0) + Math.round(Math.sin(this.g.ticks / 4000) * 3);
      const nxt = Math.max(1, Math.round(this.g.rainT / 60));
      this.open('Weather', this.back() + `<div class="wx"><div class="wx-t">${t}°C</div><div>${this.g.raining ? 'Rain showers' : this.g.daylight > 0.5 ? 'Sunny' : 'Clear night'}</div><div class="dev-note">${this.g.raining ? 'Rain stops' : 'Rain expected'} in about ${nxt} min · Local time ${this.clock()}</div></div>` + (this.g.mode === 'creative' ? '<button class="wide" data-act="weather">Toggle weather</button>' : ''));
      return;
    }
    if (k === 'taxi') { this.open('Taxi', this.back() + `<p>A self-driving electric taxi will arrive next to you.</p><p class="dev-note">${this.g.mode === 'creative' ? 'Free in Creative' : 'Fare: 1 emerald'}</p><button class="wide" data-act="taxi">Call a taxi</button>`); return; }
    if (k === 'camera') { this.open('Camera', this.back() + '<p>Point your view and take a photo of the world.</p><button class="wide" data-act="photo">Take photo</button>'); return; }
    if (k === 'photos') { this.open('Photos', this.back() + (this.photos.length ? '<div class="photos">' + this.photos.map((u) => `<img src="${u}" alt="Photo">`).join('') + '</div>' : '<p>No photos yet. Use the Camera app.</p>')); return; }
    if (k === 'news') { this.open('News', this.back() + this.newsHtml()); return; }
    if (k === 'shop') { this.computer('shop', true); return; }
  }
  newsHtml() {
    const S = this.g.world.settle; const P = this.o.player; const c = S.nearest('city', P.x, P.z, 8);
    const day = Math.floor(this.g.ticks / 24000) + 1; const n = (day * 7) % HEADLINES.length;
    const list = [c ? `${c.name} skyline grows with ${c.kinds ? c.kinds.filter((k) => k === 'skyscraper').length : 3} skyscrapers` : 'New city planned on the horizon', ...HEADLINES.slice(n), ...HEADLINES.slice(0, n)].slice(0, 7);
    return `<div class="dev-note">Day ${day} · ${this.clock()}</div>` + list.map((h, i) => `<div class="news"><b>${h}</b><small>${['World', 'Tech', 'City', 'Sport', 'Business', 'Science', 'Local'][i % 7]} · ${i + 1}h ago</small></div>`).join('');
  }
  compass(dx, dz) { const a = (Math.atan2(dx, -dz) * 180 / Math.PI + 360) % 360; return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(a / 45) % 8]; }
  nav(arg) { const [x, z, n] = arg.split(','); this.waypoint = { x: +x, z: +z, name: decodeURIComponent(n) }; this.close(); this.o.toast('Navigating to ' + this.waypoint.name); }
  drawMap(cv) {
    const ctx = cv.getContext('2d'); const w = this.g.world; const P = this.o.player; const R = 128, S = 2;
    ctx.fillStyle = '#20242a'; ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 128; i++) for (let j = 0; j < 128; j++) {
      const x = Math.floor(P.x - R + i * S), z = Math.floor(P.z - R + j * S);
      if (!w.isLoaded(x, z)) continue;
      const y = w.topSolid(x, z); let id = w.getBlock(x, y, z); if (!id) continue;
      const above = w.getBlock(x, y + 1, z); if (above === B.WATER) id = B.WATER;
      const c = BLOCKS[id] && BLOCKS[id].avgColor || [0.5, 0.5, 0.5]; const sh = 0.75 + Math.min(0.45, Math.max(-0.2, (y - 34) / 60));
      ctx.fillStyle = `rgb(${c[0] * 255 * sh | 0},${c[1] * 255 * sh | 0},${c[2] * 255 * sh | 0})`; ctx.fillRect(i * 2, j * 2, 2, 2);
    }
    ctx.font = '700 11px system-ui, sans-serif'; ctx.textAlign = 'center';
    for (const p of w.settle.plansNear(P.x - R, P.z - R, P.x + R, P.z + R)) {
      const mx = (p.x - P.x + R), mz = (p.z - P.z + R); ctx.fillStyle = 'rgba(0,0,0,0.6)'; const label = p.name || 'Village'; const tw = ctx.measureText(label).width + 8;
      ctx.fillRect(mx - tw / 2, mz - 8, tw, 15); ctx.fillStyle = p.type === 'city' ? '#7ad0ff' : '#ffe080'; ctx.fillText(label, mx, mz + 3);
    }
    ctx.save(); ctx.translate(128, 128); ctx.rotate(-P.yaw); ctx.fillStyle = '#ff3a3a'; ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(6, 6); ctx.lineTo(0, 3); ctx.lineTo(-6, 6); ctx.fill(); ctx.restore();
  }
  pay(n) {
    if (this.g.mode === 'creative') return true;
    const inv = this.g.inv; let have = 0; for (const s of inv.slots) if (s && s.id === I.EMERALD) have += s.count;
    if (have < n) { this.o.toast(`You need ${n} emerald${n > 1 ? 's' : ''}`); this.o.sfx.villagerNo(); return false; }
    let left = n; for (let i = 0; i < inv.slots.length && left; i++) { const s = inv.slots[i]; if (s && s.id === I.EMERALD) { const k = Math.min(left, s.count); s.count -= k; left -= k; if (!s.count) inv.slots[i] = null; } }
    inv.onChange && inv.onChange(); return true;
  }
  give(id, n) { const left = this.g.inv.add(id, n); if (left) this.g.dropFromPlayer(id, left); this.g.inv.onChange && this.g.inv.onChange(); }
  taxi() {
    if (!this.pay(1)) return; const P = this.o.player;
    const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw); const c = this.o.vehicles.add({ x: P.x + fx * 4, y: P.y + 0.5, z: P.z + fz * 4, yaw: Math.atan2(fz, -fx), color: 0xf0c020, kind: 'taxi', owned: true });
    void c; this.close(); this.o.toast('Your taxi has arrived. Tap it to get in'); this.o.sfx.horn && this.o.sfx.horn();
  }
  photo() {
    this.el.classList.add('hidden'); const url = this.o.snapshot(); this.el.classList.remove('hidden');
    if (url) { this.photos.unshift(url); if (this.photos.length > 12) this.photos.pop(); }
    this.o.sfx.shutter && this.o.sfx.shutter(); this.app('photos');
  }
  computer(tab = 'shop', fromPhone = false) {
    const head = fromPhone ? this.back() : `<div class="tabs"><button data-act="shop" class="${tab === 'shop' ? 'on' : ''}">MineShop</button><button data-act="news" class="${tab === 'news' ? 'on' : ''}">News</button></div>`;
    if (tab === 'news') { this.open('MineNet Browser', head + this.newsHtml()); return; }
    let em = 0; for (const s of this.g.inv.slots) if (s && s.id === I.EMERALD) em += s.count;
    this.open(fromPhone ? 'MineShop' : 'MineNet Browser', head + `<div class="dev-note">${this.g.mode === 'creative' ? 'Creative: everything is free' : 'Wallet: ' + em + ' emeralds'} · Next-day delivery is instant</div><div class="shop">` +
      SHOP.map(([id, n, price], i) => `<button class="item" data-act="buy" data-arg="${i}"><img src="${iconFor(id)}" alt=""><span>${itemName(id)}${n > 1 ? ' ×' + n : ''}</span><b>${price} em</b></button>`).join('') + '</div>');
  }
  buy(i) { const [id, n, price] = SHOP[i]; if (!this.pay(price)) return; this.give(id, Math.min(n, maxStack(id))); this.o.toast('Delivered: ' + itemName(id) + (n > 1 ? ' ×' + n : '')); this.o.sfx.pop && this.o.sfx.pop(); void maxDur; }
  // ---------- elevator ----------
  elevator(b) {
    const w = this.g.world; const floors = [];
    for (let y = 1; y < 127; y++) if (w.getBlock(b.x, y, b.z) === B.ELEVATOR) floors.push(y);
    const meta = w.getMeta(b.x, b.y, b.z) & 3; const [nx, nz] = FRONT_N[meta];
    this.elev = { x: b.x, z: b.z, nx, nz, floors };
    const cur = floors.indexOf(b.y);
    this.open('Elevator', `<div class="dev-note">Select a floor</div><div class="floors">${floors.map((y, i) => `<button data-act="floor" data-arg="${y}" class="${i === cur ? 'on' : ''}">${i === 0 ? 'L' : i === floors.length - 1 && floors.length > 2 ? 'R' : i}</button>`).slice().reverse().join('')}</div>`);
  }
  goFloor(y) {
    const e = this.elev; const P = this.o.player; this.close();
    P.x = e.x + e.nx + 0.5; P.z = e.z + e.nz + 0.5; P.y = y + 0.01; P.vx = P.vy = P.vz = 0; P.fallStart = null; P.yaw = Math.atan2(-e.nx, -e.nz);
    this.o.sfx.ding && this.o.sfx.ding(); { const i = e.floors.indexOf(y); this.o.toast(i === 0 ? 'Lobby' : i === e.floors.length - 1 && e.floors.length > 2 ? 'Roof' : 'Floor ' + i); }
  }
  atm(b) { this.atmKey = b.x + ',' + b.y + ',' + b.z; const day = Math.floor(this.g.ticks / 24000); const used = this.atmDay.get(this.atmKey) === day; this.open('ATM', `<div class="atm"><div class="dev-note">Mine Bank · 24h service</div><p>${used ? 'Daily limit reached. Come back tomorrow.' : 'Your daily allowance is ready.'}</p>${used ? '' : '<button class="wide" data-act="withdraw">Withdraw 2 emeralds</button>'}</div>`); }
  withdraw() { const day = Math.floor(this.g.ticks / 24000); this.atmDay.set(this.atmKey, day); this.give(I.EMERALD, 2); this.o.toast('Withdrew 2 emeralds'); this.close(); }
  vending() { this.open('Vending Machine', `<p>Snacks and drinks</p><p class="dev-note">${this.g.mode === 'creative' ? 'Free in Creative' : '1 emerald'}</p><button class="wide" data-act="vend">Buy a snack</button>`); }
  vend() { if (!this.pay(1)) return; const opts = [[I.BREAD, 2], [I.APPLE, 3], [I.COOKED_PORK, 2], [I.STEAK, 1]]; const [id, n] = opts[Math.floor(Math.random() * opts.length)]; this.give(id, n); this.o.toast('Clunk. ' + itemName(id) + ' ×' + n); this.o.sfx.pop && this.o.sfx.pop(); }
  tv() { this.open('Smart TV', this.newsHtml()); }
}
