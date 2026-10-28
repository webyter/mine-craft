// VoxCraft online server — shared open world, chat, DMs, friends, homes, emotes.
// Run: node server/server.js  (listens on 0.0.0.0:8000, WebSocket path /ws)
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');

const PORT = parseInt(process.env.PORT || '8000', 10);
const DATA = path.join(__dirname, 'data');
fs.mkdirSync(DATA, { recursive: true });
const WORLD_SEED = 'voxcraft online';
const MAX_EDITS = 1500000;

function load(name, def) { try { return JSON.parse(fs.readFileSync(path.join(DATA, name), 'utf8')); } catch (_) { return def; } }
const db = {
  profiles: load('profiles.json', {}), // vid -> profile
  edits: new Map(Object.entries(load('edits.json', {}))), // "x,y,z" -> [id, meta]
  homes: load('homes.json', []), // index -> { owner(vid), name, style }
  dms: load('dms.json', {}), // "vidA|vidB" -> [{ from, text, at }]
  meta: load('meta.json', { ticks: 1000, reports: [] }),
};
let dirty = { profiles: false, edits: false, homes: false, dms: false, meta: false };
function save() {
  const w = (n, v) => { const tmp = path.join(DATA, n + '.tmp'); fs.writeFileSync(tmp, JSON.stringify(v)); fs.renameSync(tmp, path.join(DATA, n)); };
  try {
    if (dirty.profiles) w('profiles.json', db.profiles);
    if (dirty.edits) w('edits.json', Object.fromEntries(db.edits));
    if (dirty.homes) w('homes.json', db.homes);
    if (dirty.dms) w('dms.json', db.dms);
    w('meta.json', db.meta);
  } catch (e) { console.error('save failed', e); }
  dirty = { profiles: false, edits: false, homes: false, dms: false, meta: false };
}
setInterval(save, 5000);
process.on('SIGINT', () => { save(); process.exit(0); });
process.on('SIGTERM', () => { save(); process.exit(0); });

// ---------- world clock & weather ----------
let weather = { raining: false, thunder: false, t: 900 };
setInterval(() => {
  db.meta.ticks = (db.meta.ticks || 0) + 20; // 20 ticks per second
  weather.t -= 1;
  if (weather.t <= 0) {
    weather.raining = !weather.raining; weather.thunder = weather.raining && Math.random() < 0.3;
    weather.t = weather.raining ? 240 + Math.random() * 300 : 700 + Math.random() * 1200;
    broadcast({ t: 'weather', raining: weather.raining, thunder: weather.thunder });
  }
}, 1000);

// ---------- moderation ----------
const BAD = ['fuck', 'shit', 'bitch', 'cunt', 'nigger', 'nigga', 'faggot', 'retard', 'whore', 'slut', 'dick', 'pussy', 'asshole', 'bastard', 'rape'];
const badRe = new RegExp('(' + BAD.join('|') + ')', 'gi');
function filter(s) { return String(s).replace(badRe, (m) => '#'.repeat(m.length)); }
function clean(s, n) { return String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, n); }
const NAME_RE = /^[A-Za-z0-9_]{3,16}$/;

// ---------- skins ----------
const SKIN_KEYS = { skin: 6, hair: 6, hairColor: 6, eyes: 6, shirt: 6, shirtColor: 6, pants: 6, shoes: 6, hat: 6, hatColor: 6, cape: 6, extra: 6, body: 6 };
function cleanSkin(s) {
  const out = {}; if (!s || typeof s !== 'object') return out;
  for (const k of Object.keys(SKIN_KEYS)) if (s[k] != null) out[k] = clean(s[k], 12);
  return out;
}

// ---------- state ----------
const online = new Map(); // vid -> { ws, vid, p: {x,y,z,yaw,pitch,dim,f}, lastChat:[], tpa:Set }
function prof(vid) { return db.profiles[vid]; }
function pubPlayer(vid) {
  const p = prof(vid); const o = online.get(vid);
  return { id: vid.slice(0, 10), name: p.name, skin: p.skin, home: p.home, p: o ? o.p : null, online: !!o };
}
function shortId(vid) { return vid.slice(0, 10); }
function byShort(id) { for (const [vid] of online) if (shortId(vid) === id) return vid; for (const vid of Object.keys(db.profiles)) if (shortId(vid) === id) return vid; return null; }
function byName(name) { const n = String(name || '').toLowerCase(); for (const [vid, p] of Object.entries(db.profiles)) if (p.name.toLowerCase() === n) return vid; return null; }
function send(ws, m) { if (ws.readyState === 1) ws.send(JSON.stringify(m)); }
function sendTo(vid, m) { const o = online.get(vid); if (o) send(o.ws, m); }
function broadcast(m, except) { const s = JSON.stringify(m); for (const [vid, o] of online) if (vid !== except && o.ws.readyState === 1) o.ws.send(s); }
function sys(vid, text) { sendTo(vid, { t: 'sys', text }); }
function isFriend(a, b) { const p = prof(a); return !!(p && p.friends && p.friends.includes(b)); }
function isBlocked(a, b) { const p = prof(a); return !!(p && p.blocked && p.blocked.includes(b)); }

// ---------- homes (plot grid; clients know the geometry) ----------
const PLOT = 32; // keep in sync with client net.js
function homeOfVid(vid) { const p = prof(vid); return p && p.home != null ? p.home : null; }
function plotOwnerAt(x, z, origin) {
  if (!origin) return null;
  const gx = Math.floor((x - origin.x) / PLOT), gz = Math.floor((z - origin.z) / PLOT);
  if (gx < 0 || gz < 0 || gx >= 12) return null;
  const idx = gz * 12 + gx; const h = db.homes[idx]; return h ? { idx, owner: h.owner } : null;
}

// ---------- http + ws ----------
const server = http.createServer((req, res) => {
  if (req.url.startsWith('/status')) {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ ok: true, online: online.size, players: Object.keys(db.profiles).length, edits: db.edits.size, homes: db.homes.filter(Boolean).length }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('VoxCraft server');
});
const wss = new WebSocketServer({ noServer: true, maxPayload: 2 * 1024 * 1024 });
server.on('upgrade', (req, sock, head) => {
  if (!req.url.includes('/ws')) { sock.destroy(); return; }
  wss.handleUpgrade(req, sock, head, (ws) => wss.emit('connection', ws, req));
});

wss.on('connection', (ws, req) => {
  const u = new URL(req.url, 'http://x');
  let vid = req.headers['x-visitor-id'] || u.searchParams.get('vid') || '';
  vid = clean(vid, 80) || crypto.randomBytes(8).toString('hex');
  vid = crypto.createHash('sha1').update('mc:' + vid).digest('hex');
  let me = null; // set after hello
  ws.isAlive = true; ws.on('pong', () => (ws.isAlive = true));
  const rate = { chat: [], edits: 0, editT: Date.now() };

  // existing profile? tell the client so it can skip the creator
  send(ws, { t: 'hi', profile: db.profiles[vid] ? { name: db.profiles[vid].name, skin: db.profiles[vid].skin, home: db.profiles[vid].home, privacy: db.profiles[vid].privacy || 'everyone' } : null, seed: WORLD_SEED, online: online.size });

  ws.on('message', (raw) => {
    let m; try { m = JSON.parse(raw); } catch (_) { return; }
    if (!m || typeof m.t !== 'string') return;
    if (m.t === 'hello') {
      let p = db.profiles[vid];
      let name = clean(m.name, 16).replace(/\s+/g, '_');
      if (!NAME_RE.test(name)) name = 'Player' + Math.floor(Math.random() * 9000 + 1000);
      if (filter(name) !== name) name = 'Player' + Math.floor(Math.random() * 9000 + 1000);
      const taken = byName(name); if (taken && taken !== vid) { let i = 2; while (byName(name + i)) i++; name = (name + i).slice(0, 16); }
      if (!p) p = db.profiles[vid] = { name, skin: {}, friends: [], requests: [], blocked: [], home: null, privacy: 'everyone', created: Date.now() };
      p.name = name; p.skin = cleanSkin(m.skin); p.lastSeen = Date.now(); dirty.profiles = true;
      const old = online.get(vid); if (old && old.ws !== ws) { try { send(old.ws, { t: 'kicked', reason: 'You joined from another tab' }); old.ws.close(); } catch (_) { } }
      me = { ws, vid, p: m.pos || null, origin: m.origin || null };
      online.set(vid, me);
      const players = []; for (const [ov] of online) if (ov !== vid) players.push(pubPlayer(ov));
      const homes = db.homes.map((h, i) => (h ? { idx: i, name: h.name, owner: shortId(h.owner), style: h.style } : null));
      send(ws, {
        t: 'welcome', you: { id: shortId(vid), name: p.name, skin: p.skin, home: p.home, privacy: p.privacy, friends: p.friends.map((f) => friendInfo(f)), requests: (p.requests || []).map((r) => ({ id: shortId(r), name: prof(r) ? prof(r).name : '?' })), blocked: (p.blocked || []).map(shortId) },
        players, homes, edits: [...db.edits].map(([k, v]) => [k, v[0], v[1]]), ticks: db.meta.ticks, weather,
        dms: dmThreads(vid),
      });
      broadcast({ t: 'join', player: pubPlayer(vid) }, vid);
      broadcast({ t: 'sys', text: p.name + ' joined the world' }, vid);
      return;
    }
    if (!me) return;
    const p = prof(vid);
    switch (m.t) {
      case 'pos': {
        const q = m.p; if (!q || typeof q.x !== 'number') return;
        me.p = { x: +q.x.toFixed(2), y: +q.y.toFixed(2), z: +q.z.toFixed(2), yaw: +(q.yaw || 0).toFixed(3), pitch: +(q.pitch || 0).toFixed(3), dim: clean(q.dim, 10) || 'overworld', f: q.f | 0, held: q.held | 0 };
        if (m.origin && !me.origin) me.origin = m.origin;
        break;
      }
      case 'edits': {
        if (!Array.isArray(m.e)) return;
        const now = Date.now(); if (now - rate.editT > 1000) { rate.editT = now; rate.edits = 0; }
        const ok = [];
        for (const e of m.e.slice(0, 600)) {
          if (!Array.isArray(e) || e.length < 4) continue;
          const [x, y, z, id, meta = 0, dim = 'o'] = e;
          if (![x, y, z, id].every(Number.isInteger) || y < 0 || y > 127 || id < 0 || id > 255) continue;
          if (dim !== 'o') continue; // only the overworld is shared
          if (rate.edits++ > 30000) break;
          const own = plotOwnerAt(x, z, me.origin);
          if (own && own.owner !== vid && !isFriend(own.owner, vid)) continue;
          db.edits.set(x + ',' + y + ',' + z, [id, meta | 0]); ok.push([x, y, z, id, meta | 0]);
        }
        if (db.edits.size > MAX_EDITS) { const it = db.edits.keys(); for (let i = 0; i < 2000; i++) db.edits.delete(it.next().value); }
        if (ok.length) { dirty.edits = true; broadcast({ t: 'edits', e: ok, by: shortId(vid) }, vid); }
        break;
      }
      case 'chat': {
        const now = Date.now(); rate.chat = rate.chat.filter((t) => now - t < 6000);
        if (rate.chat.length >= 6) { sys(vid, 'You are sending messages too fast'); return; }
        rate.chat.push(now);
        const text = filter(clean(m.text, 240)); if (!text) return;
        const near = m.ch === 'near';
        const out = { t: 'chat', from: shortId(vid), name: p.name, text, ch: near ? 'near' : 'all' };
        for (const [ov, o] of online) {
          if (isBlocked(ov, vid)) continue;
          if (near && ov !== vid) { if (!o.p || !me.p || o.p.dim !== me.p.dim || Math.hypot(o.p.x - me.p.x, o.p.z - me.p.z) > 64) continue; }
          send(o.ws, out);
        }
        break;
      }
      case 'dm': {
        const to = m.to ? byShort(m.to) || byName(m.to) : null;
        if (!to || !prof(to)) { sys(vid, 'No player called ' + clean(m.to, 20)); return; }
        if (to === vid) return;
        const tp = prof(to);
        if (isBlocked(to, vid)) { sys(vid, tp.name + ' is not accepting messages from you'); return; }
        if (tp.privacy === 'nobody' || (tp.privacy === 'friends' && !isFriend(to, vid))) { sys(vid, tp.name + ' only accepts messages from ' + (tp.privacy === 'friends' ? 'friends' : 'nobody')); return; }
        const now = Date.now(); rate.chat = rate.chat.filter((t) => now - t < 6000); if (rate.chat.length >= 6) { sys(vid, 'You are sending messages too fast'); return; }
        rate.chat.push(now);
        const text = filter(clean(m.text, 400)); if (!text) return;
        const key = [vid, to].sort().join('|'); const th = db.dms[key] || (db.dms[key] = []);
        const msg = { from: shortId(vid), text, at: now }; th.push(msg); if (th.length > 100) th.splice(0, th.length - 100); dirty.dms = true;
        const pkt = { t: 'dm', with: shortId(to), withName: tp.name, msg, fromName: p.name };
        send(ws, pkt); sendTo(to, { ...pkt, with: shortId(vid), withName: p.name });
        break;
      }
      case 'emote': {
        const e = clean(m.e, 16); if (!e) return;
        broadcast({ t: 'emote', id: shortId(vid), e }, vid);
        break;
      }
      case 'skin': {
        p.skin = cleanSkin(m.skin); dirty.profiles = true;
        broadcast({ t: 'skin', id: shortId(vid), skin: p.skin }, vid);
        break;
      }
      case 'privacy': {
        if (['everyone', 'friends', 'nobody'].includes(m.v)) { p.privacy = m.v; dirty.profiles = true; sys(vid, 'Messages: ' + m.v); }
        break;
      }
      case 'friend': {
        const other = byShort(m.id) || byName(m.id); if (!other || other === vid) return; const op = prof(other);
        if (m.op === 'add') {
          if (p.friends.includes(other)) return;
          if ((p.requests || []).includes(other)) { // accept
            p.requests = p.requests.filter((r) => r !== other); p.friends.push(other); if (!op.friends.includes(vid)) op.friends.push(vid);
            op.requests = (op.requests || []).filter((r) => r !== vid);
            send(ws, { t: 'friends', friends: p.friends.map(friendInfo), requests: (p.requests || []).map((r) => ({ id: shortId(r), name: prof(r).name })) });
            sendTo(other, { t: 'friends', friends: op.friends.map(friendInfo), requests: (op.requests || []).map((r) => ({ id: shortId(r), name: prof(r).name })) });
            sys(vid, 'You and ' + op.name + ' are now friends'); sys(other, p.name + ' accepted your friend request');
          } else {
            if (isBlocked(other, vid)) { sys(vid, 'Friend request sent'); return; }
            op.requests = op.requests || []; if (!op.requests.includes(vid)) op.requests.push(vid);
            sendTo(other, { t: 'friends', friends: op.friends.map(friendInfo), requests: op.requests.map((r) => ({ id: shortId(r), name: prof(r).name })) });
            sendTo(other, { t: 'freq', id: shortId(vid), name: p.name });
            sys(vid, 'Friend request sent to ' + op.name);
          }
        } else if (m.op === 'remove' || m.op === 'decline') {
          p.friends = p.friends.filter((f) => f !== other); op.friends = op.friends.filter((f) => f !== vid);
          p.requests = (p.requests || []).filter((r) => r !== other);
          send(ws, { t: 'friends', friends: p.friends.map(friendInfo), requests: (p.requests || []).map((r) => ({ id: shortId(r), name: prof(r).name })) });
          sendTo(other, { t: 'friends', friends: op.friends.map(friendInfo), requests: (op.requests || []).map((r) => ({ id: shortId(r), name: prof(r).name })) });
        } else if (m.op === 'block') {
          p.blocked = p.blocked || []; if (!p.blocked.includes(other)) p.blocked.push(other);
          p.friends = p.friends.filter((f) => f !== other); op.friends = op.friends.filter((f) => f !== vid);
          send(ws, { t: 'blocked', blocked: p.blocked.map(shortId) }); sys(vid, op.name + ' is blocked');
        } else if (m.op === 'unblock') {
          p.blocked = (p.blocked || []).filter((b) => b !== other); send(ws, { t: 'blocked', blocked: p.blocked.map(shortId) }); sys(vid, op.name + ' is unblocked');
        } else if (m.op === 'report') {
          db.meta.reports.push({ by: p.name, who: op.name, why: clean(m.why, 200), at: Date.now() }); sys(vid, 'Thanks. ' + op.name + ' has been reported');
        }
        dirty.profiles = true;
        break;
      }
      case 'claim': {
        if (p.home != null && db.homes[p.home]) { sys(vid, 'You already have a home'); send(ws, { t: 'home', idx: p.home, mine: true }); return; }
        let idx = db.homes.findIndex((h) => !h); if (idx < 0) idx = db.homes.length;
        const style = ['cottage', 'modern', 'cabin', 'villa'].includes(m.style) ? m.style : 'cottage';
        db.homes[idx] = { owner: vid, name: p.name, style, at: Date.now() }; p.home = idx; dirty.homes = dirty.profiles = true;
        send(ws, { t: 'home', idx, mine: true, style });
        broadcast({ t: 'homes', homes: db.homes.map((h, i) => (h ? { idx: i, name: h.name, owner: shortId(h.owner), style: h.style } : null)) });
        break;
      }
      case 'tpa': {
        const other = byShort(m.id) || byName(m.id); if (!other || !online.get(other)) { sys(vid, 'That player is not online'); return; }
        if (isBlocked(other, vid)) { sys(vid, 'Teleport request sent'); return; }
        const o = online.get(other); o.tpa = o.tpa || new Set(); o.tpa.add(vid);
        if (isFriend(other, vid) && m.friendFast) { const q = o.p; if (q) send(ws, { t: 'tpto', x: q.x, y: q.y, z: q.z, dim: q.dim, name: prof(other).name }); return; }
        sendTo(other, { t: 'tpreq', id: shortId(vid), name: p.name }); sys(vid, 'Teleport request sent to ' + prof(other).name);
        break;
      }
      case 'tpaccept': {
        const other = byShort(m.id); if (!other) return; const o = online.get(other);
        if (!me.tpa || !me.tpa.has(other) || !o || !me.p) return; me.tpa.delete(other);
        send(o.ws, { t: 'tpto', x: me.p.x, y: me.p.y, z: me.p.z, dim: me.p.dim, name: p.name });
        sys(vid, 'Accepted ' + prof(other).name + "'s teleport request");
        break;
      }
      case 'list': {
        const all = Object.entries(db.profiles).map(([v, pp]) => ({ id: shortId(v), name: pp.name, online: online.has(v), home: pp.home }));
        send(ws, { t: 'list', all });
        break;
      }
      case 'time': { if (typeof m.ticks === 'number' && m.ticks >= 0) { db.meta.ticks = m.ticks; broadcast({ t: 'ticks', ticks: db.meta.ticks }, vid); } break; }
    }
  });
  ws.on('close', () => {
    if (me && online.get(vid) === me) {
      online.delete(vid);
      if (prof(vid)) { prof(vid).lastSeen = Date.now(); dirty.profiles = true; }
      broadcast({ t: 'leave', id: shortId(vid) });
      if (prof(vid)) broadcast({ t: 'sys', text: prof(vid).name + ' left the world' });
    }
  });
});
function friendInfo(f) { const p = prof(f); return { id: shortId(f), name: p ? p.name : '?', online: online.has(f), home: p ? p.home : null }; }
function dmThreads(vid) {
  const out = [];
  for (const [k, th] of Object.entries(db.dms)) { const [a, b] = k.split('|'); if (a !== vid && b !== vid) continue; const other = a === vid ? b : a; out.push({ with: shortId(other), withName: prof(other) ? prof(other).name : '?', msgs: th.slice(-40) }); }
  return out;
}

// position fan-out at 10 Hz
setInterval(() => {
  if (!online.size) return;
  const all = []; for (const [vid, o] of online) if (o.p) all.push([shortId(vid), o.p.x, o.p.y, o.p.z, o.p.yaw, o.p.pitch, o.p.dim, o.p.f, o.p.held]);
  const s = JSON.stringify({ t: 'ps', a: all });
  for (const [, o] of online) if (o.ws.readyState === 1) o.ws.send(s);
}, 100);
// keepalive + time sync
setInterval(() => {
  for (const ws of wss.clients) { if (!ws.isAlive) { ws.terminate(); continue; } ws.isAlive = false; try { ws.ping(); } catch (_) { } }
  broadcast({ t: 'ticks', ticks: db.meta.ticks });
}, 15000);

server.listen(PORT, '0.0.0.0', () => console.log('VoxCraft server on ' + PORT));
