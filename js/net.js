// Mine Craft — online multiplayer client
import * as THREE from 'three';
import { Avatar } from './avatar.js';
import { findHomeOrigin, plotAt, plotRect, homeEdits, plotBase } from './homes.js';
import { textSprite } from './avatar.js';

const CS = 16, H = 128;
const lidx = (x, y, z) => (y * CS + z) * CS + x;
const ck = (cx, cz) => cx + ',' + cz;

export class Net {
  constructor(api) {
    this.api = api; this.ws = null; this.state = 'off'; this.me = null; this.players = new Map();
    this.edits = new Map(); // chunk key -> Map(lkey -> [x,y,z,id,meta])
    this.outbox = []; this.homes = []; this.origin = null; this.friends = []; this.requests = []; this.blocked = [];
    this.threads = new Map(); this.history = []; this.unread = 0; this.tpReqs = []; this.listeners = {};
    this.muted = false; this.channel = 'all'; this.lastPos = 0; this.lastSent = ''; this.swung = false;
    this.signs = new Map(); this.pendingBuild = null; this.serverTicks = null; this.weather = null;
    this.vid = Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
  get online() { return this.state === 'online'; }
  on(ev, fn) { (this.listeners[ev] = this.listeners[ev] || []).push(fn); }
  emit(ev, a) { for (const f of this.listeners[ev] || []) try { f(a); } catch (e) { console.error(e); } }
  url() {
    const raw = window.__WS_BASE__ || '__PORT_8000__';
    if (raw.startsWith('__')) return `ws://${location.hostname || '127.0.0.1'}:8000/ws?vid=${this.vid}`;
    const base = `${location.origin}${location.pathname.replace(/\/[^/]*$/, '')}/${raw.replace(/^\//, '')}`.replace(/^http/, 'ws');
    return `${base.replace(/\/$/, '')}/ws?vid=${this.vid}`;
  }
  connect() {
    return new Promise((res, rej) => {
      if (this.ws && this.ws.readyState <= 1) { res(this.hi); return; }
      this.state = 'connecting'; let done = false;
      let ws; try { ws = new WebSocket(this.url()); } catch (e) { this.state = 'off'; rej(e); return; }
      this.ws = ws;
      const to = setTimeout(() => { if (!done) { done = true; try { ws.close(); } catch (_) { } this.state = 'off'; rej(new Error('timeout')); } }, 9000);
      ws.onmessage = (ev) => {
        let m; try { m = JSON.parse(ev.data); } catch (_) { return; }
        if (m.t === 'hi' && !done) { done = true; clearTimeout(to); this.hi = m; this.state = 'lobby'; res(m); return; }
        this.handle(m);
      };
      ws.onerror = () => { if (!done) { done = true; clearTimeout(to); this.state = 'off'; rej(new Error('offline')); } };
      ws.onclose = () => {
        const was = this.state; this.state = 'off'; this.ws = null;
        if (was === 'online') { this.api.toast('Disconnected from the online world'); this.clearPlayers(); this.emit('status'); this.scheduleReconnect(); }
      };
    });
  }
  scheduleReconnect() {
    if (this.reconnecting || !this.profile) return; this.reconnecting = true; let tries = 0;
    const go = () => {
      if (this.state === 'online' || this.api.game.state === 'title') { this.reconnecting = false; return; }
      tries++;
      this.connect().then(() => { this.reconnecting = false; this.send({ t: 'hello', name: this.profile.name, skin: this.profile.skin, origin: this.origin, pos: this.posPacket() }); this.rejoin = true; this.api.toast('Reconnected'); })
        .catch(() => { if (tries < 20) setTimeout(go, Math.min(15000, 2000 * tries)); else this.reconnecting = false; });
    };
    setTimeout(go, 1500);
  }
  join(name, skin) { this.profile = { name, skin }; this.send({ t: 'hello', name, skin, pos: null }); }
  leave() { this.profile = null; if (this.ws) { try { this.ws.close(); } catch (_) { } } this.state = 'off'; this.clearPlayers(); for (const s of this.signs.values()) this.api.scene.remove(s); this.signs.clear(); }
  send(m) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(m)); }

  // ---------- world integration ----------
  attachWorld(w) {
    if (w.type === 'nether' || w.type === 'end') return;
    this.world = w; this.origin = findHomeOrigin(w);
    const orig = w.generate.bind(w);
    w.generate = (cx, cz) => { const r = orig(cx, cz); const c = r || w.getChunk(cx, cz); if (c) this.applyPending(c); return r; };
    for (const c of w.chunks.values()) this.applyPending(c);
    this.send({ t: 'pos', p: this.posPacket(), origin: this.origin });
    this.refreshSigns();
  }
  applyPending(c) {
    const m = this.edits.get(ck(c.cx, c.cz)); if (!m) return;
    for (const [x, y, z, id, meta] of m.values()) { const i = lidx(x - c.cx * CS, y, z - c.cz * CS); c.blocks[i] = id; c.meta[i] = meta || 0; }
    c.dirty = true;
  }
  storeEdit(x, y, z, id, meta) {
    const k = ck(x >> 4, z >> 4); let m = this.edits.get(k); if (!m) this.edits.set(k, (m = new Map()));
    m.set(x + ',' + y + ',' + z, [x, y, z, id, meta || 0]);
  }
  // called from game.setBlock for local changes
  localEdit(x, y, z, id, meta) {
    if (this.muted || !this.online || this.api.game.dim !== 'overworld') return;
    this.storeEdit(x, y, z, id, meta); this.outbox.push([x, y, z, id, meta || 0, 'o']);
  }
  canEdit(x, z) {
    if (!this.online || this.api.game.dim !== 'overworld') return true;
    const idx = plotAt(this.origin, x, z); if (idx < 0) return true;
    const h = this.homes[idx]; if (!h) return true;
    if (h.owner === this.me.id) return true;
    if (this.friends.some((f) => f.id === h.owner)) return true;
    return h.name;
  }
  // ---------- incoming ----------
  handle(m) {
    const api = this.api;
    switch (m.t) {
      case 'welcome': {
        this.me = m.you; this.friends = m.you.friends || []; this.requests = m.you.requests || []; this.blocked = m.you.blocked || [];
        this.homes = m.homes || [];
        if (!this.rejoin) { this.edits.clear(); }
        for (const [k, id, meta] of m.edits) { const [x, y, z] = k.split(',').map(Number); this.storeEdit(x, y, z, id, meta); }
        this.threads.clear(); for (const th of m.dms || []) this.threads.set(th.with, { name: th.withName, msgs: th.msgs, unread: 0 });
        this.serverTicks = m.ticks; this.weather = m.weather;
        this.state = 'online';
        for (const p of m.players) this.addPlayer(p);
        if (this.rejoin && this.world) { for (const [x, y, z, id, meta] of m.edits.map(([k, id, meta]) => [...k.split(',').map(Number), id, meta])) if (this.world.getChunk(x >> 4, z >> 4) && this.world.getBlock(x, y, z) !== id) this.quietSet(x, y, z, id, meta); this.refreshSigns(); }
        this.emit('welcome', m); this.emit('status');
        break;
      }
      case 'join': this.addPlayer(m.player); this.emit('status'); break;
      case 'leave': this.removePlayer(m.id); this.emit('status'); break;
      case 'ps': {
        const now = performance.now();
        for (const [id, x, y, z, yaw, pitch, dim, f] of m.a) {
          if (this.me && id === this.me.id) continue;
          const r = this.players.get(id); if (!r) continue;
          r.buf.push({ t: now, x, y, z, yaw, pitch }); if (r.buf.length > 12) r.buf.shift();
          r.dim = dim; r.av.flags = (r.av.flags & 2) | f; if (f & 2) r.av.flags |= 2; r.last = { x, y, z, dim };
        }
        break;
      }
      case 'edits': {
        for (const [x, y, z, id, meta] of m.e) {
          this.storeEdit(x, y, z, id, meta);
          if (this.world && this.api.game.dim === 'overworld' && this.world.getChunk(x >> 4, z >> 4)) this.quietSet(x, y, z, id, meta);
        }
        break;
      }
      case 'chat': {
        if (this.blocked.includes(m.from)) return;
        const line = { from: m.from, name: m.name, text: m.text, ch: m.ch, at: Date.now() };
        this.history.push(line); if (this.history.length > 150) this.history.shift();
        api.chatLog((m.ch === 'near' ? '[Nearby] ' : '') + '<' + m.name + '> ' + m.text);
        const r = this.players.get(m.from); if (r) r.av.say(m.text);
        if (this.me && m.from === this.me.id && api.selfAvatar) api.selfAvatar.say(m.text);
        this.emit('chat', line);
        break;
      }
      case 'dm': {
        const th = this.threads.get(m.with) || { name: m.withName, msgs: [], unread: 0 }; th.name = m.withName;
        th.msgs.push(m.msg); if (th.msgs.length > 100) th.msgs.shift();
        if (m.msg.from !== this.me.id) { th.unread++; this.unread++; api.toast('Message from ' + m.withName + ': ' + m.msg.text.slice(0, 40)); api.sfx && api.sfx('pop'); }
        this.threads.set(m.with, th); this.emit('dm', m); this.emit('status');
        break;
      }
      case 'sys': api.chatLog(m.text); this.history.push({ sys: true, text: m.text, at: Date.now() }); this.emit('chat'); break;
      case 'emote': { const r = this.players.get(m.id); if (r) r.av.playEmote(m.e); break; }
      case 'skin': { const r = this.players.get(m.id); if (r) { r.skin = m.skin; r.av.build(m.skin); } break; }
      case 'friends': this.friends = m.friends; this.requests = m.requests; this.recolorTags(); this.emit('status'); break;
      case 'freq': api.toast(m.name + ' sent you a friend request'); this.emit('status'); break;
      case 'blocked': this.blocked = m.blocked; this.emit('status'); break;
      case 'homes': this.homes = m.homes; this.refreshSigns(); this.emit('status'); break;
      case 'home': {
        this.me.home = m.idx;
        if (m.mine) { this.pendingBuild = { idx: m.idx, style: m.style || 'cottage', t: 0 }; const r = plotRect(this.origin, m.idx); const base = plotBase(this.world, this.origin, m.idx); api.teleport(r.cx + 0.5, base + 3, r.z0 - 1.5, true); api.toast('Building your home...'); }
        this.emit('status');
        break;
      }
      case 'tpreq': this.tpReqs = this.tpReqs.filter((q) => q.id !== m.id); this.tpReqs.push({ id: m.id, name: m.name, at: Date.now() }); api.toast(m.name + ' wants to teleport to you. Open Social to accept'); this.emit('status'); break;
      case 'tpto': if ((m.dim || 'overworld') !== api.game.dim) { api.toast(m.name + ' is in another dimension'); return; } api.teleport(m.x, m.y + 0.05, m.z); api.toast('Teleported to ' + m.name); break;
      case 'list': this.emit('list', m.all); break;
      case 'weather': this.weather = m; api.setWeather && api.setWeather(m); break;
      case 'ticks': this.serverTicks = m.ticks; api.setTicks && api.setTicks(m.ticks); break;
      case 'kicked': api.toast(m.reason); this.profile = null; break;
    }
  }
  quietSet(x, y, z, id, meta) { this.muted = true; try { this.api.game.setBlock(x, y, z, id, meta || 0); } finally { this.muted = false; } }
  // ---------- players ----------
  isFriend(id) { return this.friends.some((f) => f.id === id); }
  addPlayer(p) {
    if (!p || (this.me && p.id === this.me.id)) return;
    let r = this.players.get(p.id);
    if (r) { r.name = p.name; r.skin = p.skin; r.av.build(p.skin); r.av.setName(p.name, this.isFriend(p.id)); return; }
    const av = new Avatar(p.skin, p.name, { friend: this.isFriend(p.id) });
    r = { id: p.id, name: p.name, skin: p.skin, av, buf: [], dim: p.p ? p.p.dim : 'overworld', last: p.p };
    if (p.p) { av.pos.set(p.p.x, p.p.y, p.p.z); r.buf.push({ t: performance.now(), ...p.p }); }
    this.api.scene.add(av.group); this.players.set(p.id, r);
  }
  removePlayer(id) { const r = this.players.get(id); if (!r) return; this.api.scene.remove(r.av.group); r.av.dispose(); this.players.delete(id); }
  clearPlayers() { for (const id of [...this.players.keys()]) this.removePlayer(id); }
  recolorTags() { for (const r of this.players.values()) r.av.setName(r.name, this.isFriend(r.id)); this.refreshSigns(); }
  playerByName(n) { n = String(n || '').toLowerCase(); for (const r of this.players.values()) if (r.name.toLowerCase() === n) return r; return null; }
  // ---------- signs over homes ----------
  refreshSigns() {
    if (!this.world || !this.origin) return;
    for (const s of this.signs.values()) { this.api.scene.remove(s); s.material.map.dispose(); s.material.dispose(); }
    this.signs.clear();
    this.homes.forEach((h, i) => {
      if (!h) return; const r = plotRect(this.origin, i); const base = plotBase(this.world, this.origin, i);
      const mine = this.me && h.owner === this.me.id, fr = this.isFriend(h.owner);
      const s = textSprite([h.name + "'s Home"], { color: mine ? '#ffe680' : fr ? '#7cff8a' : '#ffffff', bg: 'rgba(30,20,10,0.6)', depthTest: true, scale: 0.016 });
      s.position.set(r.cx + 0.5, base + 5.2, r.z0 + 1.5); this.api.scene.add(s); this.signs.set(i, s);
    });
  }
  // ---------- per-frame ----------
  posPacket() {
    const p = this.api.player, g = this.api.game;
    let f = 0; if (p.sneaking) f |= 1; if (this.swung) f |= 2; if (p.flying) f |= 4; if (p.boat || p.riding || p.sitting) f |= 8; if (p.gliding) f |= 32;
    return { x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch, dim: g.dim, f };
  }
  update(dt, camera) {
    if (!this.online) return;
    const now = performance.now();
    if (now - this.lastPos > 100) {
      const pk = this.posPacket(); const key = [pk.x.toFixed(2), pk.y.toFixed(2), pk.z.toFixed(2), pk.yaw.toFixed(2), pk.pitch.toFixed(2), pk.dim, pk.f].join();
      if (key !== this.lastSent || now - this.lastPos > 1000) { this.send({ t: 'pos', p: pk }); this.lastSent = key; this.swung = false; }
      this.lastPos = now;
    }
    if (this.outbox.length && (!this.lastFlush || now - this.lastFlush > 150)) {
      const build = this.outboxBuild; this.outboxBuild = false;
      while (this.outbox.length) this.send({ t: 'edits', e: this.outbox.splice(0, 500), build });
      this.lastFlush = now;
    }
    // remote avatars: interpolate 150 ms behind
    const rt = now - 150; const dim = this.api.game.dim;
    for (const r of this.players.values()) {
      const av = r.av; const b = r.buf; av.group.visible = r.dim === dim;
      if (!av.group.visible || !b.length) continue;
      let a = b[0], c = b[b.length - 1];
      for (let i = 0; i < b.length - 1; i++) if (b[i].t <= rt && b[i + 1].t >= rt) { a = b[i]; c = b[i + 1]; break; }
      const k = c.t === a.t ? 1 : Math.max(0, Math.min(1, (rt - a.t) / (c.t - a.t)));
      const nx = a.x + (c.x - a.x) * k, ny = a.y + (c.y - a.y) * k, nz = a.z + (c.z - a.z) * k;
      const sp = Math.hypot(nx - av.pos.x, nz - av.pos.z) / Math.max(dt, 1e-3); av.speed = av.speed * 0.8 + Math.min(12, sp) * 0.2;
      av.pos.set(nx, ny, nz);
      let dy = c.yaw - a.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
      av.yaw = a.yaw + dy * k; av.pitch = a.pitch + (c.pitch - a.pitch) * k;
      av.update(dt, camera.position);
    }
    // home build once the plot is loaded
    if (this.pendingBuild && this.world) {
      const pb = this.pendingBuild; pb.t += dt; const r = plotRect(this.origin, pb.idx);
      const ok = [[r.x0, r.z0], [r.x1, r.z0], [r.x0, r.z1], [r.x1, r.z1]].every(([x, z]) => this.world.isLoaded(x, z));
      if (ok) {
        this.pendingBuild = null;
        const res = homeEdits(this.world, this.origin, pb.idx, pb.style, this.me.name);
        for (const e of res.edits) { this.api.game.setBlock(e[0], e[1], e[2], e[3], e[4]); }
        this.outboxBuild = true;
        this.api.player.spawn = { ...res.spawn }; this.api.teleport(res.gate.x, res.gate.y, res.gate.z - 1);
        this.api.toast('Welcome home. Your bed, chests and garden are ready'); this.refreshSigns();
      } else if (pb.t > 40) { this.pendingBuild = null; this.api.toast('Could not reach your plot. Try /home again'); }
    }
  }
  homeSpot(idx) { if (idx == null || !this.world) return null; const r = plotRect(this.origin, idx); const base = plotBase(this.world, this.origin, idx); return { x: r.cx + 0.5, y: base + 1.05, z: r.z0 - 0.5, base, rect: r }; }
  // ---------- outgoing helpers ----------
  chat(text) { this.send({ t: 'chat', text, ch: this.channel }); }
  dm(to, text) { this.send({ t: 'dm', to, text }); }
  emote(e) { this.send({ t: 'emote', e }); }
  setSkin(skin) { this.profile && (this.profile.skin = skin); this.send({ t: 'skin', skin }); }
  friend(op, id, why) { this.send({ t: 'friend', op, id, why }); }
  claim(style) { this.send({ t: 'claim', style }); }
  tpa(id, friendFast) { this.send({ t: 'tpa', id, friendFast }); }
  tpaccept(id) { this.tpReqs = this.tpReqs.filter((q) => q.id !== id); this.send({ t: 'tpaccept', id }); this.emit('status'); }
  privacy(v) { this.send({ t: 'privacy', v }); this.me.privacy = v; }
  list() { this.send({ t: 'list' }); }
  syncTime(ticks) { this.send({ t: 'time', ticks }); }
}
export { THREE };
