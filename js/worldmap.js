// VoxCraft — full-screen world map with players, homes, towns and fast travel
const BIOME_COL = { 0: [104, 160, 64], 1: [62, 122, 46], 2: [219, 204, 140], 3: [228, 236, 242], 4: [128, 128, 128], 5: [44, 92, 168], 6: [226, 214, 160] };
const SEA = 28, TILE = 64;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function createWorldMap(ctx) {
  const { game, player, net } = ctx;
  const el = document.createElement('div'); el.id = 'worldmap'; el.className = 'overlay hidden'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'World map');
  el.innerHTML = `<canvas id="wm-canvas"></canvas>
    <div class="wm-top"><button class="mini" id="wm-close">Close</button><b id="wm-title">World Map</b><span id="wm-pos"></span></div>
    <div class="wm-zoom"><button class="mini" id="wm-in" aria-label="Zoom in">+</button><button class="mini" id="wm-out" aria-label="Zoom out">−</button><button class="mini" id="wm-me">Me</button></div>
    <div class="wm-legend"><span><i style="background:#ffe14d"></i>You</span><span><i style="background:#7cff8a"></i>Friend</span><span><i style="background:#fff"></i>Player</span><span><i style="background:#ff8a3d"></i>Home</span><span><i style="background:#62c7ff"></i>City</span><span><i style="background:#c99a5b"></i>Village</span></div>
    <div class="wm-pop hidden" id="wm-pop"></div>`;
  document.body.appendChild(el);
  const cv = $('wm-canvas'); const g = cv.getContext('2d');
  const tiles = new Map(); let queue = []; let scale = 4; let cx = 0, cz = 0; let open = false, raf = 0; let markers = []; let lastTravel = -1e9;
  const SCALES = [1, 2, 4, 8, 16, 32];
  function tileKey(s, tx, tz) { return s + ':' + tx + ':' + tz; }
  function renderTile(s, tx, tz) {
    const c = document.createElement('canvas'); c.width = c.height = TILE; const tg = c.getContext('2d'); const img = tg.createImageData(TILE, TILE); const w = game.world;
    for (let j = 0; j < TILE; j++) for (let i = 0; i < TILE; i++) {
      const x = (tx * TILE + i) * s, z = (tz * TILE + j) * s;
      const col = w.column(x, z); let [r, gg, b] = BIOME_COL[col.biome] || BIOME_COL[0];
      if (col.h < SEA) { const d = Math.min(1, (SEA - col.h) / 18); r = 44 - d * 20; gg = 92 - d * 40; b = 168 - d * 50; }
      else { const k = 0.78 + Math.min(0.4, (col.h - SEA) / 90); const e = w.column(x + s, z - s).h; const sh = e > col.h ? 0.86 : e < col.h ? 1.08 : 1; r *= k * sh; gg *= k * sh; b *= k * sh; }
      const o = (j * TILE + i) * 4; img.data[o] = r; img.data[o + 1] = gg; img.data[o + 2] = b; img.data[o + 3] = 255;
    }
    tg.putImageData(img, 0, 0); return c;
  }
  function resize() { const dpr = Math.min(2, devicePixelRatio || 1); cv.width = Math.floor(innerWidth * dpr / 2); cv.height = Math.floor(innerHeight * dpr / 2); }
  function draw() {
    if (!open) return; raf = requestAnimationFrame(draw);
    const W = cv.width, Hh = cv.height; const ppb = 1 / scale; // canvas pixels per block
    g.imageSmoothingEnabled = false; g.fillStyle = '#0d1420'; g.fillRect(0, 0, W, Hh);
    const x0 = cx - W / 2 * scale, z0 = cz - Hh / 2 * scale;
    const tx0 = Math.floor(x0 / scale / TILE), tz0 = Math.floor(z0 / scale / TILE), tx1 = Math.floor((x0 + W * scale) / scale / TILE), tz1 = Math.floor((z0 + Hh * scale) / scale / TILE);
    const need = [];
    for (let tx = tx0; tx <= tx1; tx++) for (let tz = tz0; tz <= tz1; tz++) {
      const k = tileKey(scale, tx, tz); const t = tiles.get(k);
      const px = (tx * TILE * scale - x0) * ppb, pz = (tz * TILE * scale - z0) * ppb;
      if (t) g.drawImage(t, Math.floor(px), Math.floor(pz), TILE + 1, TILE + 1); else need.push([tx, tz, Math.hypot(tx * TILE * scale + TILE * scale / 2 - cx, tz * TILE * scale + TILE * scale / 2 - cz)]);
    }
    need.sort((a, b) => a[2] - b[2]); const t0 = performance.now();
    for (const [tx, tz] of need) { if (performance.now() - t0 > 18) break; tiles.set(tileKey(scale, tx, tz), renderTile(scale, tx, tz)); }
    if (tiles.size > 900) { const it = tiles.keys(); for (let i = 0; i < 200; i++) tiles.delete(it.next().value); }
    const toS = (x, z) => [(x - x0) * ppb, (z - z0) * ppb];
    markers = []; const labels = [];
    // settlements
    if (scale <= 8 && game.world.settle && game.dim === 'overworld') {
      const plans = game.world.settle.plansNear(x0, z0, x0 + W * scale, z0 + Hh * scale);
      g.font = `${Math.max(9, 11)}px MCFont, monospace`; g.textAlign = 'center';
      for (const p of plans) {
        const [sx, sz] = toS(p.x, p.z); const city = p.type === 'city', village = p.type === 'village';
        const col = city ? '#62c7ff' : village ? '#c99a5b' : '#9fe0a0';
        g.fillStyle = col; g.fillRect(sx - 3, sz - 3, 6, 6); g.strokeStyle = '#000'; g.strokeRect(sx - 3.5, sz - 3.5, 7, 7);
        const lab = p.name || p.type; const showLab = city ? scale <= 8 : scale <= 2;
        if (showLab) { const tw = g.measureText(lab).width + 4; const box = [sx - tw / 2, sz - 18, tw, 13]; if (!labels.some((q) => q[0] < box[0] + box[2] && box[0] < q[0] + q[2] && q[1] < box[1] + box[3] && box[1] < q[1] + q[3])) { labels.push(box); g.fillStyle = '#000'; g.fillText(lab, sx + 1, sz - 6); g.fillStyle = city ? '#dff3ff' : '#fff'; g.fillText(lab, sx, sz - 7); } }
        markers.push({ x: sx, z: sz, label: p.name || p.type, wx: p.x, wz: p.z, kind: city ? 'City' : village ? 'Village' : 'Landmark' });
      }
    }
    // homes
    if (net.online && net.origin && game.dim === 'overworld') {
      net.homes.forEach((h, i) => { if (!h) return; const s = net.homeSpot(i); if (!s) return; const [sx, sz] = toS(s.x, s.z + 16); g.fillStyle = h.owner === net.me.id ? '#ffe14d' : '#ff8a3d'; g.beginPath(); g.moveTo(sx, sz - 5); g.lineTo(sx + 5, sz); g.lineTo(sx - 5, sz); g.fill(); g.fillRect(sx - 3.5, sz, 7, 4); if (scale <= 2) { g.fillStyle = '#fff'; g.font = '10px MCFont, monospace'; g.fillText(h.name, sx, sz + 13); } markers.push({ x: sx, z: sz, label: h.name + "'s home", home: i, kind: 'Home' }); });
      const [hx, hz] = toS(net.origin.x + 192, net.origin.z - 6); if (scale <= 16) { g.fillStyle = '#ffd08a'; g.font = '11px MCFont, monospace'; g.fillText('Homes District', hx, hz); }
    }
    // players
    if (net.online) for (const r of net.players.values()) { if (!r.last || r.dim !== game.dim) continue; const [sx, sz] = toS(r.last.x, r.last.z); const fr = net.isFriend(r.id); g.fillStyle = fr ? '#7cff8a' : '#ffffff'; g.beginPath(); g.arc(sx, sz, 4, 0, 7); g.fill(); g.strokeStyle = '#000'; g.stroke(); g.fillStyle = '#fff'; g.font = '10px MCFont, monospace'; g.fillText(r.name, sx, sz - 7); markers.push({ x: sx, z: sz, label: r.name, player: r.id, kind: fr ? 'Friend' : 'Player' }); }
    // spawn + me
    const sp = player.spawn; if (sp) { const [sx, sz] = toS(sp.x, sp.z); g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.strokeRect(sx - 4, sz - 4, 8, 8); markers.push({ x: sx, z: sz, label: 'Spawn point', wx: sp.x, wz: sp.z, kind: 'Spawn' }); }
    const [mx, mz] = toS(player.x, player.z); g.save(); g.translate(mx, mz); g.rotate(-player.yaw); g.fillStyle = '#ffe14d'; g.strokeStyle = '#000'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, -7); g.lineTo(5, 5); g.lineTo(0, 2.5); g.lineTo(-5, 5); g.closePath(); g.fill(); g.stroke(); g.restore();
    // scale bar
    const bar = 100 * scale; g.fillStyle = '#fff'; g.fillRect(10, Hh - 14, 100, 3); g.font = '10px MCFont, monospace'; g.textAlign = 'left'; g.fillText(bar + ' blocks', 10, Hh - 18);
    $('wm-pos').textContent = `${Math.round(cx)}, ${Math.round(cz)} · 1 px = ${scale} blocks`;
  }
  function show() {
    if (game.dim === 'end') { ctx.toast('The map does not work in the End'); return; }
    open = true; el.classList.remove('hidden'); game.overlay = 'map'; ctx.endPointer && ctx.endPointer(); resize(); cx = player.x; cz = player.z; $('wm-title').textContent = game.dim === 'nether' ? 'Nether Map' : 'World Map'; $('wm-pop').classList.add('hidden'); cancelAnimationFrame(raf); draw();
  }
  function hide() { open = false; el.classList.add('hidden'); if (game.overlay === 'map') game.overlay = null; cancelAnimationFrame(raf); }
  $('wm-close').onclick = hide;
  $('wm-in').onclick = () => { scale = SCALES[Math.max(0, SCALES.indexOf(scale) - 1)]; };
  $('wm-out').onclick = () => { scale = SCALES[Math.min(SCALES.length - 1, SCALES.indexOf(scale) + 1)]; };
  $('wm-me').onclick = () => { cx = player.x; cz = player.z; };
  addEventListener('resize', () => open && resize());
  // pan + tap
  let drag = null, moved = 0; const pts = new Map(); let pinch = null;
  cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); drag = [e.clientX, e.clientY]; moved = 0; if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); } });
  cv.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 2 && pinch) { const [a, b] = [...pts.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (d / pinch > 1.35) { $('wm-in').onclick(); pinch = d; } else if (pinch / d > 1.35) { $('wm-out').onclick(); pinch = d; } moved = 99; return; }
    if (!drag) return; const k = cv.width / innerWidth; const dx = (e.clientX - drag[0]) * k, dz = (e.clientY - drag[1]) * k; moved += Math.abs(dx) + Math.abs(dz); cx -= dx * scale; cz -= dz * scale; drag = [e.clientX, e.clientY];
  });
  const up = (e) => {
    pts.delete(e.pointerId); if (pts.size < 2) pinch = null;
    if (drag && moved < 6) { const k = cv.width / innerWidth; const x = e.clientX * k, z = e.clientY * k; let best = null, bd = 14; for (const m of markers) { const d = Math.hypot(m.x - x, m.z - z); if (d < bd) { bd = d; best = m; } } popup(best, x, z); }
    drag = null;
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  function popup(m) {
    const pop = $('wm-pop'); if (!m) { pop.classList.add('hidden'); return; }
    const canGo = game.dim === 'overworld' || m.player;
    pop.innerHTML = `<b>${esc(m.label)}</b><span>${m.kind}</span>${canGo ? `<button class="btn btn-green small-btn" id="wm-go">${m.player ? 'Ask to visit' : 'Fast travel'}</button>` : ''}`;
    pop.classList.remove('hidden');
    const go = $('wm-go'); if (go) go.onclick = () => {
      if (m.player) { net.tpa(m.player, net.isFriend(m.player)); hide(); return; }
      const now = performance.now(); if (game.mode === 'survival' && now - lastTravel < 30000) { ctx.toast('Fast travel is recharging (' + Math.ceil((30000 - (now - lastTravel)) / 1000) + 's)'); return; }
      lastTravel = now; hide();
      if (m.home != null) { ctx.goHome(m.home); return; }
      ctx.travelTo(m.wx, m.wz, m.label);
    };
  }
  return { show, hide, get open() { return open; }, reset() { tiles.clear(); } };
}
