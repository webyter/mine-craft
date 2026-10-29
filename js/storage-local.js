// VoxCraft — browser storage backend for single-player saves (local runs only).
const SAVE_KEY = 'voxcraft.save.v1';
const LEGACY_SAVE_KEY = 'minecraft.save.v1';

function store() { try { return window.localStorage; } catch (_) { return null; } }

// storage can exist but still throw (private mode, sandboxed frames), so probe it
export function available() {
  const s = store(); if (!s) return false;
  try { s.setItem('voxcraft.probe', '1'); s.removeItem('voxcraft.probe'); return true; } catch (_) { return false; }
}

function isQuota(e) {
  return !!e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014);
}

export function read() {
  const s = store(); if (!s) return null;
  try {
    let raw = s.getItem(SAVE_KEY);
    if (!raw) {
      raw = s.getItem(LEGACY_SAVE_KEY);
      if (raw) { try { s.setItem(SAVE_KEY, raw); s.removeItem(LEGACY_SAVE_KEY); } catch (_) { /* ignore */ } }
    }
    if (!raw) return null; const v = JSON.parse(raw); return v && v.v ? v : null;
  } catch (_) { return null; }
}

export function write(data) {
  const s = store(); if (!s) return { ok: false, reason: 'unavailable' };
  try {
    s.setItem(SAVE_KEY, JSON.stringify(data));
    try { s.removeItem(LEGACY_SAVE_KEY); } catch (_) { /* ignore */ }
    return { ok: true };
  } catch (e) { return { ok: false, reason: isQuota(e) ? 'quota' : 'unavailable' }; }
}

export function clear() { const s = store(); try { s && s.removeItem(SAVE_KEY); } catch (_) { /* ignore */ } }

export function firstTime(name) {
  const s = store(); const key = 'voxcraft.' + name;
  try { if (s.getItem(key)) return false; s.setItem(key, '1'); return true; } catch (_) { return false; }
}
