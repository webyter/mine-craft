// VoxCraft — single-player save storage.
// Browser storage is used when the page is allowed to use it (local runs). When it is
// blocked or missing — for example inside a sandboxed preview iframe — saves go to the
// VoxCraft server instead, so Save and Continue keep working.
const SLOT_RE = /^[A-Za-z0-9_-]{1,40}$/;
const KEEPALIVE_LIMIT = 60000; // browsers cap keepalive request bodies at 64 KB

// a save slot can be picked with ?save=name; everyone else shares the "default" slot
function slot() {
  const s = new URLSearchParams(location.search).get('save');
  return s && SLOT_RE.test(s) ? s : 'default';
}

// HTTP base of the VoxCraft server, using the same routing rules as the multiplayer socket
export function serverBase() {
  const raw = window.__WS_BASE__ || '__PORT_8000__';
  if (raw.startsWith('__')) return `${location.protocol === 'https:' ? 'https' : 'http'}://${location.hostname || '127.0.0.1'}:8000`;
  return `${location.origin}${location.pathname.replace(/\/[^/]*$/, '')}/${raw.replace(/^\//, '')}`.replace(/\/$/, '');
}
const saveUrl = () => `${serverBase()}/saves/${slot()}`;

// browser storage lives in its own module so builds without it simply skip it
let local;
async function loadLocal() {
  if (local !== undefined) return local;
  try {
    const m = await import('./storage-local.js');
    local = m.available() ? m : null;
  } catch (_) { local = null; }
  return local;
}

let cached = null; // latest known save, so the title screen can read it synchronously
const flags = new Set(); // in-memory fallback for one-time flags such as first-run tips
let chain = Promise.resolve();

export function getCachedSave() { return cached; }
export function backendName() { return local ? 'browser' : 'server'; }

// load the saved world once at startup; resolves to the save or null
export async function initStorage() {
  const l = await loadLocal();
  if (l) { cached = l.read(); return cached; }
  try {
    const r = await fetch(saveUrl(), { cache: 'no-store' });
    if (r.ok) { const s = await r.json(); cached = s && s.v ? s : null; }
  } catch (_) { /* server unreachable: nothing to continue */ }
  return cached;
}

function reasonText(reason) {
  switch (reason) {
    case 'quota': return 'Could not save: browser storage is full';
    case 'too-large': return 'Could not save: this world is too large to save';
    case 'offline': return 'Could not save: the save server is unreachable';
    default: return 'Could not save the world';
  }
}

async function writeNow(data, { keepalive = false } = {}) {
  const l = await loadLocal();
  if (l) {
    const r = l.write(data);
    if (r.ok) cached = data;
    return r.ok ? { ok: true } : { ok: false, reason: r.reason, message: reasonText(r.reason) };
  }
  const body = JSON.stringify(data);
  try {
    const r = await fetch(saveUrl(), {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body,
      keepalive: keepalive && body.length < KEEPALIVE_LIMIT,
    });
    if (r.ok) { cached = data; return { ok: true }; }
    const reason = r.status === 413 ? 'too-large' : 'server';
    return { ok: false, reason, message: reasonText(reason) };
  } catch (_) {
    return { ok: false, reason: 'offline', message: reasonText('offline') };
  }
}

// writes are queued so an autosave never races a manual save
export function writeSave(data, opts) {
  const p = chain.then(() => writeNow(data, opts));
  chain = p.catch(() => {});
  return p;
}

// queued with writes, so a new world's first save can never be deleted by a late clear
export function clearSave() {
  cached = null;
  const p = chain.then(async () => {
    const l = await loadLocal();
    if (l) { l.clear(); return; }
    try { await fetch(saveUrl(), { method: 'DELETE' }); } catch (_) { /* ignore */ }
  });
  chain = p.catch(() => {});
  return p;
}

// returns true the first time a flag is checked, then false
export function firstTime(name) {
  if (local) return local.firstTime(name);
  if (flags.has(name)) return false;
  flags.add(name); return true;
}
