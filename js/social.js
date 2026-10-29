// VoxCraft — online lobby, character creator, social hub, emote wheel
import * as THREE from 'three';
import { Avatar, DEFAULT_SKIN, randomSkin, SKIN_TONES, HAIR_COLORS, EYE_COLORS, CLOTH_COLORS, OPTIONS, EMOTES } from './avatar.js';
import { HOME_STYLES } from './homes.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ICON = {
  people: '<svg viewBox="0 0 16 16"><circle cx="5.5" cy="5" r="2.4" fill="currentColor"/><circle cx="11" cy="5.5" r="2" fill="currentColor"/><path d="M1 14c0-3 2-5 4.5-5S10 11 10 14z" fill="currentColor"/><path d="M10.5 9.5c2 0 4.5 1.4 4.5 4.5h-4" fill="currentColor"/></svg>',
  emote: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="5" y="5.5" width="1.8" height="2" fill="currentColor"/><rect x="9.2" y="5.5" width="1.8" height="2" fill="currentColor"/><path d="M4.8 9.6c1.6 2.4 4.8 2.4 6.4 0" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  cam: '<svg viewBox="0 0 16 16"><path d="M1 8s2.6-5 7-5 7 5 7 5-2.6 5-7 5-7-5-7-5z" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="8" r="2.3" fill="currentColor"/></svg>',
  map: '<svg viewBox="0 0 16 16"><path d="M1 3l4.5-1.5 5 1.5L15 1.5v11.5l-4.5 1.5-5-1.5L1 14.5z" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M5.5 1.5v11.5M10.5 3v11.5" stroke="currentColor" stroke-width="1.2"/></svg>',
};

export function createSocial(ctx) {
  const { net, game, player } = ctx;
  let skin = { ...DEFAULT_SKIN }; let name = '';
  game.skin = skin;

  // ---------- DOM ----------
  const host = document.createElement('div'); document.body.appendChild(host);
  host.innerHTML = `
  <div id="online" class="screen dirt-bg hidden">
    <div class="panel online-panel">
      <div class="panel-head"><button class="icon-btn" id="ol-back" aria-label="Back">‹</button><h2 id="ol-title">Play Online</h2><span id="ol-count" class="ol-count"></span></div>
      <div class="ol-body">
        <div class="ol-preview"><canvas id="ol-canvas" width="200" height="280" aria-label="Character preview"></canvas><div class="ol-hint muted">Drag to turn</div>
          <button class="btn small-btn" id="ol-random">Random look</button></div>
        <div class="ol-side">
          <label class="field ol-namef" id="ol-name-field"><span>Your name</span><input id="ol-name" maxlength="16" placeholder="3 to 16 letters or numbers" autocomplete="off" /></label>
          <div class="ol-tabs" id="ol-tabs"></div>
          <div class="ol-opts" id="ol-opts"></div>
          <div id="ol-status" class="ol-status">Connecting to the online world...</div>
          <div class="ol-foot"><div class="seg" id="ol-mode"><button data-v="survival" class="on">Survival</button><button data-v="creative">Creative</button></div><button class="btn btn-green" id="ol-join" disabled>Join World</button></div>
        </div>
      </div>
    </div>
  </div>
  <div id="emotes" class="overlay hidden" role="dialog" aria-label="Emotes"><div class="emote-ring" id="emote-ring"></div><button class="btn small-btn emote-close" id="emote-close">Close</button></div>
  <div id="social" class="overlay hidden" role="dialog" aria-label="Social">
    <div class="panel social-panel">
      <div class="panel-head"><button class="icon-btn" id="so-close" aria-label="Close">×</button><h2>Social</h2><span id="so-online" class="ol-count"></span></div>
      <div class="so-tabs" id="so-tabs"><button data-t="players" class="on">Players</button><button data-t="friends">Friends</button><button data-t="chat">Chat</button><button data-t="dms">Messages<b id="so-dm-badge" class="badge hidden"></b></button><button data-t="home">Homes</button><button data-t="me">Me</button></div>
      <div class="so-body" id="so-body"></div>
    </div>
  </div>`;

  // HUD buttons
  const tr = $('top-right');
  const mk = (id, label, svg) => { const b = document.createElement('button'); b.className = 'hud-btn'; b.id = id; b.setAttribute('aria-label', label); b.innerHTML = svg; tr.insertBefore(b, $('btn-chat')); return b; };
  const bMap = mk('btn-map', 'World map', ICON.map), bCam = mk('btn-cam', 'Camera view', ICON.cam), bEmote = mk('btn-emote', 'Emotes', ICON.emote), bSocial = mk('btn-social', 'Social', ICON.people);
  const badge = document.createElement('b'); badge.className = 'badge hidden'; badge.id = 'social-badge'; bSocial.appendChild(badge);
  // title buttons
  const bOnline = document.createElement('button'); bOnline.className = 'btn btn-green'; bOnline.id = 'btn-online'; bOnline.textContent = 'Play Online'; $('btn-play').after(bOnline);
  const bChar = document.createElement('button'); bChar.className = 'btn'; bChar.id = 'btn-character'; bChar.textContent = 'Character'; bOnline.after(bChar);

  // ---------- preview renderer ----------
  let pr = null;
  function ensurePreview() {
    if (pr) return pr;
    const canvas = $('ol-canvas'); const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, preserveDrawingBuffer: false });
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace; renderer.setPixelRatio(Math.min(3, Math.max(2, devicePixelRatio))); renderer.setSize(200, 280, false);
    const scene = new THREE.Scene(); scene.add(new THREE.AmbientLight(0xffffff, 0.9)); const d = new THREE.DirectionalLight(0xffffff, 1.4); d.position.set(2, 3, -4); scene.add(d);
    const cam = new THREE.PerspectiveCamera(32, 200 / 280, 0.1, 50); cam.position.set(0, 1.1, -4.6); cam.lookAt(0, 0.95, 0);
    const av = new Avatar(skin, '', { noTag: true }); scene.add(av.group);
    pr = { renderer, scene, cam, av, rot: 0.5, drag: null, last: performance.now() };
    canvas.addEventListener('pointerdown', (e) => { pr.drag = e.clientX; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', (e) => { if (pr.drag != null) { pr.rot += (e.clientX - pr.drag) * 0.02; pr.drag = e.clientX; } });
    canvas.addEventListener('pointerup', () => { pr.drag = null; });
    const loop = () => {
      if ($('online').classList.contains('hidden')) { pr.running = false; return; }
      const now = performance.now(), dt = Math.min(0.05, (now - pr.last) / 1000); pr.last = now;
      if (pr.drag == null) pr.rot += dt * 0.5;
      pr.av.yaw = pr.rot; pr.av.speed = 0; pr.av.update(dt, null); pr.renderer.render(pr.scene, pr.cam); requestAnimationFrame(loop);
    };
    pr.loop = loop; return pr;
  }
  function startPreview() { const p = ensurePreview(); p.av.build(skin); if (!p.running) { p.running = true; p.last = performance.now(); requestAnimationFrame(p.loop); } }

  // ---------- creator ----------
  const TABS = [
    ['body', 'Body', [['skin', 'Skin tone', 'color', SKIN_TONES], ['body', 'Build', 'opt', OPTIONS.body], ['eyes', 'Eyes', 'color', EYE_COLORS]]],
    ['hair', 'Hair', [['hair', 'Style', 'opt', OPTIONS.hair], ['hairColor', 'Colour', 'color', HAIR_COLORS]]],
    ['outfit', 'Outfit', [['shirt', 'Top', 'opt', OPTIONS.shirt], ['shirtColor', 'Top colour', 'color', CLOTH_COLORS], ['pants', 'Trousers', 'color', CLOTH_COLORS], ['shoes', 'Shoes', 'color', ['#262626', '#ffffff', '#6b4a2b', '#d23c3c', '#4a4a4a', '#2f6fd0', '#f0c419']]]],
    ['extras', 'Extras', [['hat', 'Hat', 'opt', OPTIONS.hat], ['hatColor', 'Hat colour', 'color', CLOTH_COLORS], ['extra', 'Face', 'opt', OPTIONS.extra], ['cape', 'Cape', 'opt', OPTIONS.cape]]],
  ];
  let tab = 'body';
  function renderTabs() {
    $('ol-tabs').innerHTML = TABS.map(([k, l]) => `<button data-k="${k}" class="${k === tab ? 'on' : ''}">${l}</button>`).join('');
    const t = TABS.find((x) => x[0] === tab);
    $('ol-opts').innerHTML = t[2].map(([key, label, kind, list]) => `<div class="ol-row"><span>${label}</span><div class="ol-chips">${list.map((v) => {
      const val = kind === 'color' ? v : v[0]; const on = String(skin[key]) === String(val) ? ' on' : '';
      return kind === 'color' ? `<button class="sw${on}" data-key="${key}" data-v="${val}" style="background:${val}" aria-label="${label} ${val}"></button>` : `<button class="chip${on}" data-key="${key}" data-v="${val}">${v[0].startsWith('#') ? `<i style="background:${v[0]}"></i>` : ''}${v[1]}</button>`;
    }).join('')}</div></div>`).join('');
  }
  $('ol-tabs').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; tab = b.dataset.k; renderTabs(); });
  $('ol-opts').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; skin = { ...skin, [b.dataset.key]: b.dataset.v }; applySkin(); renderTabs(); });
  $('ol-random').onclick = () => { skin = randomSkin(); applySkin(); renderTabs(); };
  $('ol-mode').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; for (const c of $('ol-mode').children) c.classList.toggle('on', c === b); });
  function applySkin() { game.skin = skin; if (pr) pr.av.build(skin); ctx.onSkin && ctx.onSkin(skin); }

  let screenMode = 'online'; // 'online' | 'character' | 'edit'
  function openLobby(mode) {
    screenMode = mode; if (mode !== 'edit') ctx.show(null); else { game.overlay = 'lobby'; ctx.endPointer && ctx.endPointer(); } $('online').classList.remove('hidden');
    $('ol-title').textContent = mode === 'online' ? 'Play Online' : 'Character';
    $('ol-mode').classList.toggle('hidden', mode !== 'online');
    $('ol-name-field').classList.toggle('hidden', mode === 'edit');
    $('ol-status').classList.toggle('hidden', mode !== 'online');
    $('ol-join').textContent = mode === 'online' ? 'Join World' : 'Save';
    $('ol-join').disabled = mode === 'online' && net.state !== 'lobby';
    $('ol-name').value = name; renderTabs(); startPreview();
    if (mode === 'online') {
      $('ol-status').textContent = 'Connecting to the online world...'; $('ol-count').textContent = '';
      net.connect().then((hi) => {
        if (hi.profile) { if (!name) name = hi.profile.name; if (hi.profile.skin && Object.keys(hi.profile.skin).length) skin = { ...DEFAULT_SKIN, ...hi.profile.skin }; $('ol-name').value = name; applySkin(); renderTabs(); $('ol-status').textContent = 'Welcome back, ' + hi.profile.name + '. Your home and friends are saved.'; }
        else $('ol-status').textContent = 'Pick a name and a look, then join. Everyone shares one huge world.';
        $('ol-count').textContent = hi.online + ' online'; $('ol-join').disabled = false;
      }).catch(() => { $('ol-status').textContent = 'The online server is not reachable right now. You can still play single player.'; $('ol-join').disabled = true; });
    }
  }
  $('ol-back').onclick = () => { $('online').classList.add('hidden'); if (screenMode === 'edit') { ctx.resume(); } else { if (screenMode === 'online' && net.state === 'lobby') net.leave(); ctx.show('title'); } };
  $('ol-join').onclick = () => {
    if (screenMode === 'edit') { $('online').classList.add('hidden'); if (net.online) net.setSkin(skin); ctx.toast('Look saved'); ctx.resume(); return; }
    const n = $('ol-name').value.trim().replace(/\s+/g, '_');
    if (screenMode === 'character') { name = n || name; $('online').classList.add('hidden'); ctx.show('title'); ctx.toast('Look saved'); return; }
    if (!/^[A-Za-z0-9_]{3,16}$/.test(n)) { $('ol-status').textContent = 'Names use 3 to 16 letters, numbers or _'; $('ol-name').focus(); return; }
    name = n; $('ol-join').disabled = true; $('ol-status').textContent = 'Joining...';
    const mode = [...$('ol-mode').children].find((c) => c.classList.contains('on')).dataset.v;
    net.join(name, skin);
    const once = () => { net.listeners.welcome = (net.listeners.welcome || []).filter((f) => f !== once); $('online').classList.add('hidden'); ctx.startOnline(mode); };
    net.on('welcome', once);
  };
  bOnline.onclick = () => openLobby('online');
  bChar.onclick = () => openLobby('character');

  // ---------- emote wheel ----------
  $('emote-ring').innerHTML = EMOTES.map((e, i) => { const a = i / EMOTES.length * Math.PI * 2 - Math.PI / 2; return `<button class="emote-btn" data-e="${e.id}" style="--x:${Math.cos(a).toFixed(3)};--y:${Math.sin(a).toFixed(3)}">${e.label}</button>`; }).join('') + '<div class="emote-mid">Emotes</div>';
  $('emote-ring').addEventListener('click', (e) => { const b = e.target.closest('.emote-btn'); if (!b) return; closeOverlay('emotes'); ctx.playEmote(b.dataset.e); });
  $('emote-close').onclick = () => closeOverlay('emotes');
  bEmote.onclick = () => openOverlay('emotes');

  // ---------- social hub ----------
  let soTab = 'players', dmWith = null, allPlayers = null;
  function openOverlay(id) { for (const o of ['emotes', 'social']) $(o).classList.toggle('hidden', o !== id); game.overlay = id; ctx.endPointer && ctx.endPointer(); if (id === 'social') { if (net.online) net.list(); renderSocial(); } }
  function closeOverlay(id) { $(id).classList.add('hidden'); if (game.overlay === id) game.overlay = null; }
  bSocial.onclick = () => openOverlay('social');
  $('so-close').onclick = () => closeOverlay('social');
  $('so-tabs').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; soTab = b.dataset.t; dmWith = null; for (const c of $('so-tabs').children) c.classList.toggle('on', c === b); renderSocial(); });
  net.on('list', (all) => { allPlayers = all; if (game.overlay === 'social') renderSocial(); });
  net.on('status', () => { updateBadge(); if (game.overlay === 'social' && !(document.activeElement && document.activeElement.tagName === 'INPUT')) renderSocial(); });
  net.on('chat', () => { if (game.overlay === 'social' && soTab === 'chat') renderChatLog(); });
  net.on('dm', () => { if (game.overlay === 'social' && soTab === 'dms' && dmWith) renderThread(); else if (game.overlay === 'social' && soTab === 'dms') renderSocial(); });
  function updateBadge() {
    const n = net.unread + net.requests.length + net.tpReqs.length; badge.textContent = n > 9 ? '9+' : String(n); badge.classList.toggle('hidden', !n || !net.online);
    const d = $('so-dm-badge'); d.textContent = String(net.unread); d.classList.toggle('hidden', !net.unread);
    bSocial.classList.toggle('hidden', false);
  }
  const row = (main, sub, btns) => `<div class="so-row"><div class="so-who"><b>${main}</b>${sub ? `<span>${sub}</span>` : ''}</div><div class="so-acts">${btns}</div></div>`;
  const act = (a, id, label, cls = '') => `<button class="mini ${cls}" data-a="${a}" data-id="${esc(id)}">${label}</button>`;
  function distTo(r) { if (!r.last || r.dim !== game.dim) return r.dim && r.dim !== game.dim ? 'in the ' + (r.dim === 'nether' ? 'Nether' : r.dim === 'end' ? 'End' : r.dim) : ''; return Math.round(Math.hypot(r.last.x - player.x, r.last.z - player.z)) + ' blocks away'; }
  function renderSocial() {
    const body = $('so-body'); updateBadge();
    $('so-online').textContent = net.online ? (net.players.size + 1) + ' online' : 'offline';
    if (!net.online && soTab !== 'me') { body.innerHTML = `<div class="so-empty">You are playing single player. Choose <b>Play Online</b> on the title screen to meet other players, chat, add friends and get your own home.</div>`; return; }
    if (soTab === 'players') {
      let h = '';
      if (net.tpReqs.length) h += `<div class="so-sec">Teleport requests</div>` + net.tpReqs.map((q) => row(esc(q.name), 'wants to come to you', act('tpok', q.id, 'Accept', 'go') + act('tpno', q.id, 'Ignore'))).join('');
      h += `<div class="so-sec">Online now</div>` + row(esc(net.me.name) + ' <em>(you)</em>', game.dim === 'overworld' ? `${Math.round(player.x)}, ${Math.round(player.z)}` : '', '');
      for (const r of net.players.values()) {
        const fr = net.isFriend(r.id);
        h += row((fr ? '<i class="dot on"></i>' : '') + esc(r.name), distTo(r), act('dm', r.id, 'Message') + act('tpa', r.id, fr ? 'Join' : 'Ask to visit') + (fr ? '' : act('add', r.id, 'Add friend', 'go')) + act('more', r.id, '...'));
      }
      if (!net.players.size) h += `<div class="so-empty">Nobody else is online yet. Share the game link with friends so they can join you.</div>`;
      if (allPlayers) { const off = allPlayers.filter((p) => !p.online); if (off.length) h += `<div class="so-sec">Recently seen</div>` + off.slice(0, 30).map((p) => row(esc(p.name), p.home != null ? 'has a home' : '', act('dm', p.id, 'Message') + (net.isFriend(p.id) ? '' : act('add', p.id, 'Add friend')) + (p.home != null ? act('visit', p.home, 'Visit home') : ''))).join(''); }
      body.innerHTML = h;
    } else if (soTab === 'friends') {
      let h = '';
      if (net.requests.length) h += `<div class="so-sec">Friend requests</div>` + net.requests.map((q) => row(esc(q.name), 'wants to be friends', act('add', q.id, 'Accept', 'go') + act('decline', q.id, 'Decline'))).join('');
      h += `<div class="so-sec">Friends (${net.friends.length})</div>`;
      if (!net.friends.length) h += `<div class="so-empty">No friends yet. Open Players and tap Add friend. Friends can build at your home, join you instantly and message you even when messages are set to friends only.</div>`;
      const sorted = [...net.friends].sort((a, b) => (net.players.has(b.id) ? 1 : 0) - (net.players.has(a.id) ? 1 : 0));
      for (const f of sorted) { const on = net.players.has(f.id); h += row(`<i class="dot ${on ? 'on' : ''}"></i>` + esc(f.name), on ? distTo(net.players.get(f.id)) : 'offline', act('dm', f.id, 'Message') + (on ? act('tpa', f.id, 'Join', 'go') : '') + (f.home != null ? act('visit', f.home, 'Home') : '') + act('unfriend', f.id, 'Remove')); }
      body.innerHTML = h;
    } else if (soTab === 'chat') {
      body.innerHTML = `<div class="so-chanbar"><span>Talk to</span><div class="seg" id="so-chan"><button data-v="all" class="${net.channel === 'all' ? 'on' : ''}">Everyone</button><button data-v="near" class="${net.channel === 'near' ? 'on' : ''}">Nearby (64 blocks)</button></div></div><div class="so-log" id="so-log"></div><form class="so-send" id="so-chat-form"><input id="so-chat-in" maxlength="240" placeholder="Say something nice" autocomplete="off" /><button class="btn btn-green">Send</button></form><div class="so-quick">${['Hi everyone', 'Anyone want to build?', 'Follow me', 'Thanks', 'Good game', 'Help'].map((q) => `<button class="mini" data-q="${q}">${q}</button>`).join('')}</div>`;
      $('so-chan').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; net.channel = b.dataset.v; for (const c of $('so-chan').children) c.classList.toggle('on', c === b); };
      $('so-chat-form').onsubmit = (e) => { e.preventDefault(); const v = $('so-chat-in').value.trim(); if (v) { net.chat(v); $('so-chat-in').value = ''; } };
      body.querySelector('.so-quick').onclick = (e) => { const b = e.target.closest('[data-q]'); if (b) net.chat(b.dataset.q); };
      renderChatLog();
    } else if (soTab === 'dms') {
      if (dmWith) { renderThread(); return; }
      let h = `<div class="so-sec">Conversations</div>`;
      const ths = [...net.threads.entries()].sort((a, b) => (b[1].msgs.at(-1)?.at || 0) - (a[1].msgs.at(-1)?.at || 0));
      if (!ths.length) h += `<div class="so-empty">No messages yet. Tap Message next to any player to start a private chat.</div>`;
      for (const [id, th] of ths) { const last = th.msgs.at(-1); h += row(esc(th.name) + (th.unread ? ` <b class="badge">${th.unread}</b>` : ''), last ? esc(last.text.slice(0, 40)) : '', act('dm', id, 'Open', 'go')); }
      h += `<div class="so-sec">Who can message me</div><div class="seg" id="so-priv">${['everyone', 'friends', 'nobody'].map((v) => `<button data-v="${v}" class="${net.me.privacy === v ? 'on' : ''}">${v === 'everyone' ? 'Everyone' : v === 'friends' ? 'Friends only' : 'Nobody'}</button>`).join('')}</div>`;
      body.innerHTML = h;
      $('so-priv').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; net.privacy(b.dataset.v); renderSocial(); };
    } else if (soTab === 'home') {
      const mine = net.me.home;
      let h = `<div class="so-sec">My home</div>`;
      if (mine == null) {
        h += `<div class="so-empty">Every player gets a free 32 by 32 home plot in the Homes District, with a house, bed, chests, garden and farm. Only you and your friends can build there.</div><div class="so-styles">${HOME_STYLES.map(([k, l]) => `<button class="btn small-btn" data-style="${k}">${l}</button>`).join('')}</div>`;
      } else h += row('Plot ' + (mine + 1), 'Homes District', act('home', mine, 'Go home', 'go') + act('sethome', mine, 'Set spawn here'));
      const homes = net.homes.map((x, i) => x && { ...x, idx: i }).filter(Boolean);
      h += `<div class="so-sec">Neighbours (${homes.length})</div>` + homes.map((x) => row(esc(x.name) + "'s " + x.style, net.players.has(x.owner) ? 'online' : '', act('visit', x.idx, 'Visit'))).join('');
      body.innerHTML = h;
      const st = body.querySelector('.so-styles'); if (st) st.onclick = (e) => { const b = e.target.closest('[data-style]'); if (!b) return; if (game.dim !== 'overworld') { ctx.toast('Go back to the Overworld first'); return; } net.claim(b.dataset.style); closeOverlay('social'); };
    } else if (soTab === 'me') {
      let h = `<div class="so-sec">Character</div>` + row(esc(net.online ? net.me.name : name || 'Steve'), net.online ? 'Online' : 'Single player', act('look', '', 'Edit look', 'go') + act('cam', '', 'Camera view'));
      if (net.online) {
        h += `<div class="so-sec">Blocked players</div>` + (net.blocked.length ? net.blocked.map((id) => { const r = net.players.get(id); const n = r ? r.name : (allPlayers || []).find((p) => p.id === id)?.name || id; return row(esc(n), '', act('unblock', id, 'Unblock')); }).join('') : '<div class="so-empty">Nobody is blocked.</div>');
        h += `<div class="so-sec">Online safety</div><div class="so-empty">Bad words are filtered. Block or report anyone who bothers you. Never share passwords or personal details in chat.</div>` + row('Leave online world', '', act('leave', '', 'Leave'));
      }
      h += `<div class="so-sec">Commands</div><div class="so-empty">/msg name text, /r text, /home, /visit name, /tpa name, /friend name, /emote wave, /players, /look, /map</div>`;
      body.innerHTML = h;
    }
  }
  function renderChatLog() {
    const log = $('so-log'); if (!log) return;
    log.innerHTML = net.history.slice(-80).map((l) => l.sys ? `<div class="sys">${esc(l.text)}</div>` : `<div><b class="${net.me && l.from === net.me.id ? 'me' : net.isFriend(l.from) ? 'fr' : ''}">${esc(l.name)}</b>${l.ch === 'near' ? ' <i>nearby</i>' : ''}: ${esc(l.text)}</div>`).join('') || '<div class="sys">No messages yet</div>';
    log.scrollTop = log.scrollHeight;
  }
  function renderThread() {
    const th = net.threads.get(dmWith) || { name: (net.players.get(dmWith) || (allPlayers || []).find((p) => p.id === dmWith) || {}).name || 'Player', msgs: [], unread: 0 };
    net.unread = Math.max(0, net.unread - (th.unread || 0)); th.unread = 0; updateBadge();
    const body = $('so-body');
    body.innerHTML = `<div class="so-thead"><button class="mini" data-a="back">‹ Back</button><b>${esc(th.name)}</b><span></span></div><div class="so-log dm" id="so-log">${th.msgs.map((m) => `<div class="bub ${m.from === net.me.id ? 'out' : 'in'}">${esc(m.text)}<small>${new Date(m.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small></div>`).join('') || '<div class="sys">Say hello to ' + esc(th.name) + '</div>'}</div><form class="so-send" id="so-dm-form"><input id="so-dm-in" maxlength="400" placeholder="Private message" autocomplete="off" /><button class="btn btn-green">Send</button></form>`;
    const log = $('so-log'); log.scrollTop = log.scrollHeight;
    $('so-dm-form').onsubmit = (e) => { e.preventDefault(); const v = $('so-dm-in').value.trim(); if (v) { net.dm(dmWith, v); $('so-dm-in').value = ''; } };
  }
  $('so-body').addEventListener('click', (e) => {
    const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a, id = b.dataset.id;
    if (a === 'dm') { soTab = 'dms'; dmWith = id; for (const c of $('so-tabs').children) c.classList.toggle('on', c.dataset.t === 'dms'); renderThread(); }
    else if (a === 'back') { dmWith = null; renderSocial(); }
    else if (a === 'add') { net.friend('add', id); }
    else if (a === 'decline') net.friend('decline', id);
    else if (a === 'unfriend') net.friend('remove', id);
    else if (a === 'tpa') { net.tpa(id, net.isFriend(id)); if (net.isFriend(id)) closeOverlay('social'); }
    else if (a === 'tpok') { net.tpaccept(id); }
    else if (a === 'tpno') { net.tpReqs = net.tpReqs.filter((q) => q.id !== id); renderSocial(); }
    else if (a === 'visit' || a === 'home') { ctx.goHome(+id); closeOverlay('social'); }
    else if (a === 'sethome') { const s = net.homeSpot(+id); if (s) { player.spawn = { x: s.x, y: s.y, z: s.z + 4 }; ctx.toast('Spawn point set to your home'); } }
    else if (a === 'more') { const r = net.players.get(id); if (!r) return; b.parentElement.innerHTML = act('block', id, 'Block', 'warn') + act('report', id, 'Report', 'warn') + act('dm', id, 'Message'); }
    else if (a === 'block') { net.friend('block', id); }
    else if (a === 'unblock') net.friend('unblock', id);
    else if (a === 'report') { net.friend('report', id, 'Reported from the player list'); }
    else if (a === 'look') { closeOverlay('social'); openLobby('edit'); }
    else if (a === 'cam') { closeOverlay('social'); ctx.cycleCamera(); }
    else if (a === 'leave') { closeOverlay('social'); ctx.leaveOnline(); }
  });
  bCam.onclick = () => ctx.cycleCamera();
  bMap.onclick = () => ctx.openMap();
  updateBadge();
  return {
    openLobby, openOverlay, closeOverlay, renderSocial,
    get skin() { return skin; }, get name() { return name; },
    openDM(id) { openOverlay('social'); soTab = 'dms'; dmWith = id; for (const c of $('so-tabs').children) c.classList.toggle('on', c.dataset.t === 'dms'); renderThread(); },
    isOpen() { return !!game.overlay; },
  };
}
