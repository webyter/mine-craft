// Mine Craft — main game
import * as THREE from 'three';
import { hashSeed, mulberry32 } from './noise.js';
import { B, I, BLOCKS, ITEMS, isBlock, isTool, toolInfo, toolId, itemName, maxDur, maxStack, SMELT, FUEL, CREATIVE_LIST, ENCH, enchKind, enchLevel, enchText, rollEnchants, isArmor, armorInfo, armorId } from './blocks.js';
import { fortressNear, NETHER_BIOMES, netherBiome } from './nether.js';
import { endPillars, strongholdNear, endCityNear, FRAME_RING, GATEWAY, GATE_ISLAND, ARRIVAL, END_TOP } from './end.js';
import { buildAtlas, tileIndex, iconFor } from './textures.js';
import { World, initTables, CS, H, SEA, SOLID, LIQUID, OPAQUE, EMIT, ckey } from './world.js';
import { EntityManager, moveEntity, collides, blockGeometry, MOBS, BREED_FOOD } from './entities.js';
import { Inventory, UI } from './ui.js';
import { initAudio, sfx, audioSettings, setVolumes } from './audio.js';
import { Vehicles } from './vehicles.js';
import { Tech } from './tech.js';

THREE.ColorManagement.enabled = false;
const $ = (id) => document.getElementById(id);
const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
if (isTouch) document.body.classList.add('touch');

// ---------- settings ----------
const settings = {
  rd: isTouch ? 4 : 6, sens: 1, fov: 72, bright: 0.45, music: 0.5, sfx: 0.8, ctrl: 1,
  res: isTouch ? 1.25 : 2, clouds: 1, fps: 0, autojump: isTouch ? 1 : 0,
};

// ---------- renderer ----------
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.autoClear = false;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(settings.fov, innerWidth / innerHeight, 0.08, 800);
camera.rotation.order = 'YXZ';
const handScene = new THREE.Scene();
const handCam = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.01, 10);
function resize() {
  const pr = Math.min(window.devicePixelRatio || 1, settings.res);
  renderer.setPixelRatio(pr);
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = handCam.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); handCam.updateProjectionMatrix();
  $('rotate-hint').classList.toggle('hidden', !(isTouch && innerHeight > innerWidth && game.state === 'playing'));
}

// ---------- atlas + materials ----------
initTables();
const atlasCanvas = buildAtlas();
const atlasTex = new THREE.CanvasTexture(atlasCanvas);
atlasTex.magFilter = THREE.NearestFilter; atlasTex.minFilter = THREE.NearestFilter; atlasTex.generateMipmaps = false;
// stone texture for logo & dirt backgrounds
(function cssTextures() {
  const mk = (name) => { const t = tileIndex(name); const c = document.createElement('canvas'); c.width = c.height = 16; c.getContext('2d').drawImage(atlasCanvas, (t % 32) * 16, Math.floor(t / 32) * 16, 16, 16, 0, 0, 16, 16); return c.toDataURL(); };
  document.documentElement.style.setProperty('--stone-tex', `url(${mk('cobblestone')})`);
  const dirt = mk('dirt'); document.querySelectorAll('.dirt-bg').forEach((e) => (e.style.backgroundImage = `url(${dirt})`));
})();

const uniforms = {
  map: { value: atlasTex }, daylight: { value: 1 }, fogColor: { value: new THREE.Color(0x9cc4ff) },
  fogNear: { value: 40 }, fogFar: { value: 64 }, skyTint: { value: new THREE.Color(1, 1, 1) }, gamma: { value: settings.bright }, opacity: { value: 0.78 }, ambCol: { value: new THREE.Color(0, 0, 0) },
};
const VS = `attribute vec3 light; varying vec2 vUv; varying vec3 vLight; varying float vDist;
void main(){ vUv = uv; vLight = light; vec4 mv = modelViewMatrix * vec4(position, 1.0); vDist = length(mv.xyz); gl_Position = projectionMatrix * mv; }`;
const FS = (water) => `uniform sampler2D map; uniform float daylight; uniform vec3 fogColor; uniform float fogNear; uniform float fogFar; uniform vec3 skyTint; uniform float gamma; uniform float opacity; uniform vec3 ambCol;
varying vec2 vUv; varying vec3 vLight; varying float vDist;
float curve(float l){ float c = l / (4.0 - 3.0 * l); return mix(c, sqrt(l), gamma * 0.6); }
void main(){
  vec4 t = texture2D(map, vUv);
  ${water ? '' : 'if (t.a < 0.5) discard;'}
  float s = curve(vLight.x) * daylight; float b = curve(vLight.y);
  vec3 lc = max(vec3(s) * skyTint, vec3(b) * vec3(1.0, 0.88, 0.7));
  lc = max(lc, vec3(0.025 + gamma * 0.05));
  lc = max(lc, ambCol);
  vec3 col = t.rgb * lc * vLight.z;
  float f = smoothstep(fogNear, fogFar, vDist);
  gl_FragColor = vec4(mix(col, fogColor, f), ${water ? 't.a * opacity + 0.1' : '1.0'});
}`;
const solidMat = new THREE.ShaderMaterial({ uniforms, vertexShader: VS, fragmentShader: FS(false) });
const waterMat = new THREE.ShaderMaterial({ uniforms, vertexShader: VS, fragmentShader: FS(true), transparent: true, depthWrite: false, side: THREE.DoubleSide });

// lights for mobs / items
const ambient = new THREE.AmbientLight(0xffffff, 0.8); scene.add(ambient);
const sunLight = new THREE.DirectionalLight(0xffffff, 0.5); scene.add(sunLight); scene.add(sunLight.target);
const handAmb = new THREE.AmbientLight(0xffffff, 0.9); handScene.add(handAmb);
const handDir = new THREE.DirectionalLight(0xffffff, 0.5); handDir.position.set(1, 2, 1); handScene.add(handDir);

// ---------- sky ----------
const skyGroup = new THREE.Group(); scene.add(skyGroup);
function squareTex(draw, size = 32) { const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size); const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; return t; }
const sunTex = squareTex((g, s) => { g.fillStyle = 'rgba(255,240,150,0.25)'; g.fillRect(0, 0, s, s); g.fillStyle = '#fff8c0'; g.fillRect(8, 8, 16, 16); g.fillStyle = '#ffe070'; g.fillRect(10, 10, 12, 12); });
const moonTex = squareTex((g) => { g.fillStyle = '#dfe4ee'; g.fillRect(8, 8, 16, 16); g.fillStyle = '#aab1c2'; g.fillRect(11, 11, 4, 4); g.fillRect(18, 16, 3, 3); g.fillRect(13, 19, 3, 2); });
const skyMat = (t) => new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending });
const sun = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), skyMat(sunTex)); skyGroup.add(sun);
const moon = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshBasicMaterial({ map: moonTex, transparent: true, depthWrite: false, fog: false })); skyGroup.add(moon);
const starGeo = new THREE.BufferGeometry(); { const p = []; const r = mulberry32(42); for (let i = 0; i < 900; i++) { const u = r() * 2 - 1, th = r() * Math.PI * 2, s = Math.sqrt(1 - u * u); p.push(s * Math.cos(th) * 500, Math.abs(u) * 500, s * Math.sin(th) * 500); } starGeo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); }
const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
skyGroup.add(stars);
sun.renderOrder = moon.renderOrder = stars.renderOrder = -10;
// clouds
const cloudTex = (() => {
  const N = 64; let a = new Uint8Array(N * N); const r = mulberry32(7);
  for (let i = 0; i < N * N; i++) a[i] = r() < 0.42 ? 1 : 0;
  for (let it = 0; it < 4; it++) { const b = new Uint8Array(N * N); for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { let n = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) n += a[((y + dy + N) % N) * N + ((x + dx + N) % N)]; b[y * N + x] = n >= 5 ? 1 : 0; } a = b; }
  const c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'); const img = g.createImageData(N, N);
  for (let i = 0; i < N * N; i++) { img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = 255; img.data[i * 4 + 3] = a[i] ? 255 : 0; }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.generateMipmaps = false; return t;
})();
const cloudU = { map: { value: cloudTex }, off: { value: new THREE.Vector2() }, rep: { value: 1 }, col: { value: new THREE.Color(1, 1, 1) }, fadeR: { value: 300 } };
const clouds = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
  uniforms: cloudU, transparent: true, depthWrite: false, side: THREE.DoubleSide,
  vertexShader: 'varying vec2 vP; varying vec2 vUv; void main(){ vP = position.xy; vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: 'uniform sampler2D map; uniform vec2 off; uniform float rep; uniform vec3 col; uniform float fadeR; varying vec2 vP; varying vec2 vUv; void main(){ vec4 t = texture2D(map, vUv * rep + off); float a = t.a * 0.82 * (1.0 - smoothstep(fadeR * 0.55, fadeR * 0.5 * 1.9, length(vP))); if (a < 0.01) discard; gl_FragColor = vec4(col, a); }',
}));
clouds.rotation.x = -Math.PI / 2; scene.add(clouds);
// rain
const RAIN_N = 700;
const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(RAIN_N * 6), 3));
const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0x8aa8e0, transparent: true, opacity: 0.6 }));
rain.frustumCulled = false; rain.visible = false; scene.add(rain);
const drops = []; for (let i = 0; i < RAIN_N; i++) drops.push({ x: 0, y: -999, z: 0, floor: 0 });

// block outline + crack overlay
const outline = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)), new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55 }));
outline.visible = false; scene.add(outline);
const crackGeo = new THREE.BoxGeometry(1.006, 1.006, 1.006);
const crack = new THREE.Mesh(crackGeo, new THREE.MeshBasicMaterial({ map: atlasTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, opacity: 0.85 }));
crack.visible = false; scene.add(crack);
const crackBaseUV = crackGeo.attributes.uv.array.slice();
let crackStage = -1;
function setCrack(stage) {
  if (stage === crackStage) return; crackStage = stage;
  const t = tileIndex('destroy_' + stage); const col = t % 32, row = Math.floor(t / 32); const uv = crackGeo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (col + crackBaseUV[i * 2]) / 32, 1 - (row + 1 - crackBaseUV[i * 2 + 1]) / 32);
  uv.needsUpdate = true;
}

// hand
const hand = new THREE.Group(); handScene.add(hand);
const armMesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.8), new THREE.MeshLambertMaterial({ color: 0xc9946a }));
let heldMesh = null; const heldTexCache = {};
function rebuildHand() {
  if (heldMesh) { hand.remove(heldMesh); heldMesh = null; }
  hand.remove(armMesh);
  const h = game.inv.held();
  if (!h) { armMesh.position.set(0, 0, 0); armMesh.rotation.set(0.15, 0, 0.1); hand.add(armMesh); return; }
  if (isBlock(h.id) && !['cross', 'torch'].includes(BLOCKS[h.id].shape)) {
    heldMesh = new THREE.Mesh(blockGeometry(h.id, 0.36), new THREE.MeshLambertMaterial({ map: atlasTex, alphaTest: 0.5 }));
    heldMesh.rotation.set(0.1, 0.75, 0); heldMesh.position.set(0, 0.05, 0);
  } else {
    let t = heldTexCache[h.id];
    if (!t) { const img = new Image(); img.src = iconFor(h.id); t = new THREE.Texture(img); img.onload = () => (t.needsUpdate = true); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; heldTexCache[h.id] = t; }
    heldMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.55), new THREE.MeshLambertMaterial({ map: t, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide }));
    heldMesh.rotation.set(0, -1.2, 0.15); heldMesh.position.set(0, 0.12, 0);
  }
  if (h.ench && heldMesh.material.emissive) { heldMesh.material.emissive.setHex(0x5a2a9a); heldMesh.material.emissiveIntensity = 0.55; }
  hand.add(heldMesh);
}

// ---------- game state ----------
const game = {
  state: 'loading', scene, atlasTex, mode: 'survival', difficulty: 2, world: null, inv: new Inventory(),
  ticks: 1000, daylight: 1, raining: false, rainT: 600, paused: false, screenOpen: false, stats: { crafted: 0, mined: 0, placed: 0 },
  worldName: 'My World', seedText: '', chunkMeshes: new Map(), fluidQ: new Map(), lavaQ: new Map(), dim: 'overworld', dims: {},
};
window.__game = game;
const player = game.player = {
  x: 0, y: 40, z: 0, vx: 0, vy: 0, vz: 0, w: 0.3, h: 1.8, yaw: 0, pitch: 0, onGround: false, flying: false, sneaking: false, sprinting: false,
  health: 20, food: 20, sat: 5, exh: 0, air: 300, fallStart: null, dead: false, xp: 0, level: 0, hurtCd: 0, regenT: 0, starveT: 0,
  stepDist: 0, bob: 0, stepH: 0.6, stepY: 0, armor: [null, null, null, null], spawn: { x: 0.5, y: 40, z: 0.5 }, lavaT: 0, inWater: false, inLava: false, headInWater: false,
};
const ui = new UI(game);
game.ui = ui;
let ents = null;
// ---------- cars + tech ----------
let planeSndT = 0, engineT = 0;
const vehicles = new Vehicles(game, scene, {
  controls: () => { let t = 0, s = 0; if (keys.w || keys.arrowup) t += 1; if (keys.s || keys.arrowdown) t -= 1; if (keys.a || keys.arrowleft) s -= 1; if (keys.d || keys.arrowright) s += 1; if (joy.id !== null) { t += -joy.y; s += joy.x; } if (ui.screen || game.chatOpen) t = s = 0; return { throttle: Math.max(-1, Math.min(1, t)), steer: Math.max(-1, Math.min(1, s)) }; },
  horn: (c) => { if (Math.hypot(c.x - player.x, c.z - player.z) < 30) sfx.horn(); },
  hurtPlayer: (d, fx, fz) => { if (game.mode !== 'survival') return; player.hurtCd = 0; game.damagePlayer(Math.round(d), player.x - fx, player.z - fz, 'car'); },
  crash: (c, v) => { if (c === player.riding) { shake = 0.3; sfx.hit(); if (game.mode === 'survival' && v > 15) { player.hurtCd = 0; game.damagePlayer(Math.floor((v - 13) / 2), undefined, undefined, 'car'); } } },
  nearCharger: (c) => { const w = game.world; for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) for (let dy = -1; dy <= 1; dy++) if (w.getBlock(Math.floor(c.x) + dx, Math.floor(c.y) + dy, Math.floor(c.z) + dz) === B.EV_CHARGER) return true; return false; },
});
const tech = new Tech(game, scene, {
  ui, player, vehicles, sfx, toast: (m) => toast(m), runCommand: (c) => runCommand(c),
  snapshot: () => { try { render(0); return canvas.toDataURL('image/jpeg', 0.72); } catch (_) { return null; } },
  planeSound: (v) => { planeSndT -= 0.016; if (planeSndT < 0) { planeSndT = 0.35; sfx.plane(v); } },
});
game.vehicles = vehicles; game.tech = tech;
function enterCar(c) {
  if (player.riding) return;
  player.riding = c; c.ai = false; c.owned = true; c.keep = true; c.speed = 0; c.vy = 0;
  player.flying = false; endPointer(); $('car-hud').classList.remove('hidden'); $('touch').classList.add('driving');
  toast(c.kind === 'bus' ? 'Driving a bus' : c.kind === 'police' ? 'Driving a police car' : 'Driving — joystick up to accelerate, sideways to steer', 2600);
}
function exitCar() {
  const c = player.riding; if (!c) return; player.riding = null; c.speed = 0;
  $('car-hud').classList.add('hidden'); $('touch').classList.remove('driving');
  const w = game.world; const rx = Math.cos(c.yaw), rz = -Math.sin(c.yaw);
  for (const [ox, oz] of [[rx * 1.8, rz * 1.8], [-rx * 1.8, -rz * 1.8], [Math.sin(c.yaw) * 3, Math.cos(c.yaw) * 3], [-Math.sin(c.yaw) * 3, -Math.cos(c.yaw) * 3], [0, 0]]) {
    const x = c.x + ox, z = c.z + oz; let y = c.y + 0.01;
    if (ox === 0 && oz === 0) y = c.y + 1.8;
    if (!collides(w, x - 0.3, y, z - 0.3, x + 0.3, y + 1.8, z + 0.3)) { player.x = x; player.y = y; player.z = z; break; }
  }
  player.vx = player.vy = player.vz = 0; player.fallStart = null;
}

// ---------- world lifecycle ----------
function disposeWorld() {
  for (const [, m] of game.chunkMeshes) { if (m.solid) { scene.remove(m.solid); m.solid.geometry.dispose(); } if (m.water) { scene.remove(m.water); m.water.geometry.dispose(); } }
  game.chunkMeshes.clear(); game.fluidQ = new Map(); game.lavaQ = new Map();
  if (ents) ents.clear();
  if (player.riding) exitCar(); vehicles.clear(); tech.reset(); if (tech.el) tech.close();
  game.dims = {}; game.dim = 'overworld';
}
function newWorld({ seedText = '', mode = 'survival', difficulty = 2, type = 'infinite', name = 'My World' } = {}) {
  disposeWorld();
  const seed = seedText ? (/^-?\d+$/.test(seedText) ? (parseInt(seedText, 10) >>> 0) : hashSeed(seedText)) : (Math.random() * 2 ** 32) >>> 0;
  game.seed = seed; game.seedText = seedText || String(seed);
  game.world = new World(seed, type); game.dim = 'overworld'; game.dims = { overworld: { world: game.world } }; game.mode = mode; game.difficulty = difficulty; game.worldName = name;
  game.ticks = 1000; game.raining = false; game.rainT = 900 + Math.random() * 1200;
  if (!ents) ents = new EntityManager(game); else { ents.world = game.world; }
  player.elytra = null; player.gliding = false; game.endState = null; player.armor = [null, null, null, null]; player.boat = null; game.thunder = false; if (typeof setElytraBtn === 'function') setElytraBtn();
  player.portalT = 0; player.portalCd = false; player.enchSeed = (Math.random() * 1e9) | 0;
  game.ents = ents;
  game.inv.clear(); game.inv.sel = 0;
  if (mode === 'creative') {
    [B.GRASS, B.COBBLE, B.PLANKS, B.OAK_LOG, B.GLASS, B.TORCH, B.STONE_BRICKS, B.TNT, I.FLINT_STEEL].forEach((id, i) => (game.inv.slots[i] = { id, count: maxStack(id), dur: maxDur(id) }));
  }
  // spawn
  let sx = 0, sz = 0;
  outer: for (let r = 0; r < 400; r += 6) for (let a = 0; a < 8; a++) {
    const x = Math.round(Math.cos(a / 8 * Math.PI * 2) * r), z = Math.round(Math.sin(a / 8 * Math.PI * 2) * r);
    const c = game.world.column(x, z); if (c.h > SEA && c.biome !== 5 && c.biome !== 4) { sx = x; sz = z; break outer; }
  }
  { const st = game.world.settle; let hc = st && st.plan(0, 0); if ((!hc || hc.type !== 'city') && st && game.world.type !== 'flat') hc = st.nearest('city', 0, 0, 3); if (hc && hc.type === 'city') { const G = hc.grid; sx = G.x0 + 2 * G.P + G.RW - 1; sz = G.z0 + 2 * G.P; game.spawnCity = true; } else game.spawnCity = false; }
  game.world.ensureChunk(sx >> 4, sz >> 4);
  const top = game.world.topSolid(sx, sz);
  player.spawn = { x: sx + 0.5, y: top + 1.01, z: sz + 0.5 };
  resetPlayer();
  player.yaw = Math.PI * 0.75;
  ui.renderHotbar(); rebuildHand();
}
function resetPlayer() {
  Object.assign(player, { x: player.spawn.x, y: player.spawn.y, z: player.spawn.z, vx: 0, vy: 0, vz: 0, health: 20, food: 20, sat: 5, exh: 0, air: 300, fallStart: null, dead: false, flying: false, hurtCd: 0, gliding: false, boostT: 0 });
  if (game.mode === 'creative') player.flying = false;
}

// ---------- chunk streaming ----------
let needList = [], needT = 0, lastPC = '';
function updateNeeds(force) {
  const pcx = Math.floor(player.x / CS), pcz = Math.floor(player.z / CS);
  const key = pcx + ',' + pcz + ',' + settings.rd;
  if (!force && key === lastPC) return; lastPC = key;
  const rd = settings.rd; needList = [];
  for (let dx = -rd; dx <= rd; dx++) for (let dz = -rd; dz <= rd; dz++) { const d = dx * dx + dz * dz; if (d <= rd * rd + 1) needList.push([pcx + dx, pcz + dz, d]); }
  needList.sort((a, b) => a[2] - b[2]);
  // unload far meshes / data
  for (const [k, m] of game.chunkMeshes) {
    const ddx = m.cx - pcx, ddz = m.cz - pcz;
    if (ddx * ddx + ddz * ddz > (rd + 2) * (rd + 2)) { if (m.solid) { scene.remove(m.solid); m.solid.geometry.dispose(); } if (m.water) { scene.remove(m.water); m.water.geometry.dispose(); } game.chunkMeshes.delete(k); const c = game.world.getChunk(m.cx, m.cz); if (c) c.built = false; }
  }
  for (const [k, c] of game.world.chunks) { const ddx = c.cx - pcx, ddz = c.cz - pcz; if (!c.edited && ddx * ddx + ddz * ddz > (rd + 6) * (rd + 6)) game.world.chunks.delete(k); }
}
function buildMesh(c) {
  const k = ckey(c.cx, c.cz); const firstTime = !c.everBuilt;
  const old = game.chunkMeshes.get(k);
  const g = game.world.buildChunk(c);
  if (old) { if (old.solid) { scene.remove(old.solid); old.solid.geometry.dispose(); } if (old.water) { scene.remove(old.water); old.water.geometry.dispose(); } }
  const m = { cx: c.cx, cz: c.cz, solid: null, water: null };
  if (g.solid) { m.solid = new THREE.Mesh(g.solid, solidMat); m.solid.position.set(c.cx * CS, 0, c.cz * CS); m.solid.matrixAutoUpdate = false; m.solid.updateMatrix(); scene.add(m.solid); }
  if (g.water) { m.water = new THREE.Mesh(g.water, waterMat); m.water.position.set(c.cx * CS, 0, c.cz * CS); m.water.matrixAutoUpdate = false; m.water.updateMatrix(); m.water.renderOrder = 1; scene.add(m.water); }
  game.chunkMeshes.set(k, m);
  c.everBuilt = true;
  if (firstTime && game.state !== 'title' && game.world.type !== 'flat' && game.world.type !== 'nether') maybeSpawnAnimals(c);
}
function streamChunks(budgetMs) {
  const t0 = performance.now(); const w = game.world;
  // urgent remeshes first
  for (const [, c] of w.chunks) { if (c.urgent && c.built) { buildMesh(c); if (performance.now() - t0 > budgetMs) return; } }
  for (const [cx, cz] of needList) {
    const c = w.ensureChunk(cx, cz);
    if (!c.built || c.dirty) { buildMesh(c); if (performance.now() - t0 > budgetMs) return; }
  }
}
function loadedFraction(radius) {
  let n = 0, t = 0; const pcx = Math.floor(player.x / CS), pcz = Math.floor(player.z / CS);
  for (let dx = -radius; dx <= radius; dx++) for (let dz = -radius; dz <= radius; dz++) { t++; const c = game.world.getChunk(pcx + dx, pcz + dz); if (c && c.built) n++; }
  return n / t;
}

// ---------- block helpers ----------
const REPLACEABLE = new Set([0, B.WATER, B.LAVA, B.TALL_GRASS, B.DEAD_BUSH]);
const NEEDS_SUPPORT = new Set([B.TALL_GRASS, B.DANDELION, B.POPPY, B.DEAD_BUSH, B.TORCH, B.CACTUS, B.SUGAR_CANE, B.CRIMSON_FUNGUS, B.WHEAT_0, B.WHEAT_1, B.WHEAT_2, B.WHEAT_3]);
const isWheat = (id) => id >= B.WHEAT_0 && id <= B.WHEAT_3;
const tkey = (x, y, z) => x + ',' + y + ',' + z;
game.setBlock = (x, y, z, id, meta = 0) => {
  const w = game.world; w.setBlock(x, y, z, id, meta);
  // neighbors: fluids + gravity + support
  for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0]]) {
    const nx = x + dx, ny = y + dy, nz = z + dz; const n = w.getBlock(nx, ny, nz);
    if (n === B.WATER) game.fluidQ.set(tkey(nx, ny, nz), [nx, ny, nz]);
    if (n === B.LAVA) game.lavaQ.set(tkey(nx, ny, nz), [nx, ny, nz]);
  }
  if (id === B.WATER) game.fluidQ.set(tkey(x, y, z), [x, y, z]);
  if (id === B.LAVA) game.lavaQ.set(tkey(x, y, z), [x, y, z]);
  if (!SOLID[id]) {
    const above = w.getBlock(x, y + 1, z);
    if (BLOCKS[above].gravity) { w.setBlock(x, y + 1, z, 0); ents.spawnFalling(above, x, y + 1, z); game.setBlock(x, y + 1, z, 0); }
    else if (NEEDS_SUPPORT.has(above) && !((above === B.CACTUS || above === B.SUGAR_CANE) && w.getBlock(x, y, z) === above)) { popBlock(x, y + 1, z, above); }
  }
  if (id !== B.PORTAL && id !== B.OBSIDIAN) for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0]]) if (w.getBlock(x + dx, y + dy, z + dz) === B.PORTAL) { breakPortal(x + dx, y + dy, z + dz); break; }
  if (BLOCKS[id] && BLOCKS[id].gravity) { const below = w.getBlock(x, y - 1, z); if (!SOLID[below]) { w.setBlock(x, y, z, 0); ents.spawnFalling(id, x, y, z); } }
};
function popBlock(x, y, z, id) {
  game.setBlock(x, y, z, 0);
  if (game.mode === 'survival') { const d = resolveDrop(id, null); if (d) { ents.dropItem(d.id, d.n, x + 0.5, y + 0.3, z + 0.5); if (d.extra) ents.dropItem(d.extra.id, d.extra.n, x + 0.5, y + 0.3, z + 0.5); } }
}
const FORTUNE_OK = new Set(['nuggets', 'lapis', I.REDSTONE, I.COAL, I.DIAMOND, I.EMERALD, I.QUARTZ]);
function resolveDrop(id, held) {
  const d = resolveDrop0(id, held); if (!d) return d;
  const fl = enchLevel(held, 'fortune'); const b = BLOCKS[id];
  if (fl && FORTUNE_OK.has(b.drop) && d.id !== id) { const bonus = Math.max(0, Math.floor(Math.random() * (fl + 2)) - 1); d.n *= bonus + 1; }
  return d;
}
function resolveDrop0(id, held) {
  const b = BLOCKS[id]; let drop = b.drop;
  const t = held ? toolInfo(held.id) : null;
  if (b.tier > 0 && !(t && t.type === 'pickaxe' && t.tier >= b.tier)) return null;
  if (enchLevel(held, 'silk_touch') && b.hardness >= 0 && id !== B.SPAWNER && id !== B.PORTAL && !b.liquid && drop !== id && id !== B.FARMLAND && !isWheat(id)) return { id, n: 1 };
  if (drop === 'books') return { id: I.BOOK, n: 3 };
  if (drop === 'nuggets') return { id: I.GOLD_NUGGET, n: 2 + Math.floor(Math.random() * 5) };
  if (drop === 'lapis') return { id: I.LAPIS, n: 4 + Math.floor(Math.random() * 5) };
  if (drop === 'gravel') return Math.random() < 0.1 ? { id: I.FLINT, n: 1 } : { id: B.GRAVEL, n: 1 };
  if (drop === 'leaves') return (id === B.OAK_LEAVES && Math.random() < 0.06) ? { id: I.APPLE, n: 1 } : Math.random() < 0.04 ? { id: I.STICK, n: 1 } : null;
  if (drop === 'grass') return Math.random() < 0.125 ? { id: I.SEEDS, n: 1 } : null;
  if (drop === 'wheat') return id === B.WHEAT_3 ? { id: I.WHEAT, n: 1, extra: { id: I.SEEDS, n: 1 + Math.floor(Math.random() * 3) } } : { id: I.SEEDS, n: 1 };
  if (!drop) return null;
  if (drop === I.REDSTONE) return { id: drop, n: 4 + Math.floor(Math.random() * 2) };
  return { id: drop, n: 1 };
}
function breakTime(id, held) {
  const b = BLOCKS[id]; if (b.hardness < 0) return Infinity; if (b.hardness === 0) return 0.05;
  const t = held ? toolInfo(held.id) : null;
  let speed = 1; if (t && b.tool === t.type) { speed = t.speed; const ef = enchLevel(held, 'efficiency'); if (ef) speed += ef * ef + 1; }
  if (t && t.type === 'sword' && b.cutout) speed = 1.5;
  const can = b.tier === 0 || (t && t.type === 'pickaxe' && t.tier >= b.tier);
  let time = b.hardness * (can ? 1.5 : 5) / speed;
  if (player.headInWater) time *= 5;
  return time;
}
function breakBlock(x, y, z) {
  const w = game.world; const id = w.getBlock(x, y, z); if (!id || BLOCKS[id].hardness < 0) return;
  const held = game.inv.held();
  if (game.mode === 'survival') {
    const d = resolveDrop(id, held);
    if (d) { ents.dropItem(d.id, d.n, x + 0.5, y + 0.4, z + 0.5); if (d.extra) ents.dropItem(d.extra.id, d.extra.n, x + 0.5, y + 0.4, z + 0.5); }
    const xp = { [B.COAL_ORE]: 1, [B.DIAMOND_ORE]: 5, [B.REDSTONE_ORE]: 2, [B.LAPIS_ORE]: 3, [B.QUARTZ_ORE]: 3, [B.NETHER_GOLD_ORE]: 1, [B.EMERALD_ORE]: 4 }[id]; if (xp && d && d.id !== id) addXP(xp);
    if (held && maxDur(held.id) && BLOCKS[id].hardness > 0) { if (game.inv.damageHeld(toolInfo(held.id)?.type === 'sword' ? 2 : 1)) { sfx.brk(B.GLASS); toast('Your tool broke'); } }
    player.exh += 0.005;
  }
  const tile = game.world.tiles.get(tkey(x, y, z));
  if (tile) { for (const s of tile.slots) if (s && game.mode === 'survival') ents.dropItem(s.id, s.count, x + 0.5, y + 0.5, z + 0.5, undefined, undefined, undefined, s.dur, s.ench); game.world.tiles.delete(tkey(x, y, z)); }
  if (id === B.SPAWNER) game.world.spawners.delete(tkey(x, y, z));
  if (id === B.ICE && game.mode === 'survival' && SOLID[w.getBlock(x, y - 1, z)]) game.setBlock(x, y, z, B.WATER);
  else game.setBlock(x, y, z, 0);
  ents.burst(x + 0.5, y + 0.5, z + 0.5, BLOCKS[id].avgColor, 16, 3.5, 0.11);
  sfx.brk(id); game.stats.mined++;
  swing();
}

// ---------- player stats ----------
function addXP(n) { player.xp += n / (2 * player.level + 7); while (player.xp >= 1) { player.xp -= 1; player.level++; if (player.level % 5 === 0) sfx.levelup(); else sfx.pop(); } }
game.addXP = addXP;
let hurtFlash = null, shake = 0;
game.damagePlayer = (amount, fx, fz, cause = 'mob') => {
  if (game.mode !== 'survival' || player.dead || amount <= 0) return;
  if (player.hurtCd > 0 && cause !== 'starve') return;
  // shield: sneak while holding a shield to block attacks from the front
  const sh = game.inv.held();
  if (sh && sh.id === I.SHIELD && player.sneaking && ['mob', 'explode', 'arrow', 'dragon', 'enderman'].includes(cause)) {
    let front = true; if (fx !== undefined) { const lx = -Math.sin(player.yaw), lz = -Math.cos(player.yaw); front = (fx - player.x) * lx + (fz - player.z) * lz > 0; }
    if (front) { sfx.shield(); player.hurtCd = 0.3; game.inv.damageHeld(Math.max(1, Math.floor(amount / 2))); if (fx !== undefined) { const dx = player.x - fx, dz = player.z - fz, d = Math.hypot(dx, dz) || 1; player.vx += dx / d * 3; player.vz += dz / d * 3; } return; }
  }
  amount = armorReduce(amount, cause);
  if (amount <= 0) { player.hurtCd = 0.5; return; }
  player.hurtCd = 0.5; player.health -= amount; sfx.hurt(); shake = 0.25;
  if (fx !== undefined) { const dx = player.x - fx, dz = player.z - fz, d = Math.hypot(dx, dz) || 1; player.vx += dx / d * 7; player.vz += dz / d * 7; player.vy = Math.max(player.vy, 5); }
  hurtFlash.style.opacity = 1; setTimeout(() => (hurtFlash.style.opacity = 0), 200);
  player.exh += 0.1;
  if (player.health <= 0) die(cause);
};
game.armorPoints = () => player.armor ? player.armor.reduce((a, s) => a + (s ? armorInfo(s.id).def : 0), 0) : 0;
function armorReduce(amount, cause) {
  if (['void', 'starve', 'drown', 'kill'].includes(cause)) return amount;
  let a = amount; const ar = player.armor || [];
  const def = game.armorPoints(); const tough = ar.reduce((t, s) => t + (s ? armorInfo(s.id).tough : 0), 0);
  if (def > 0 && cause !== 'fall' && cause !== 'fire' && cause !== 'lava') {
    a *= 1 - Math.min(20, Math.max(def / 5, def - a / (2 + tough / 4))) / 25;
    // armor wears out
    for (let i = 0; i < 4; i++) { const s = ar[i]; if (!s) continue; const ub = enchLevel(s, 'unbreaking'); if (ub && Math.random() < ub / (ub + 1)) continue; s.dur = (s.dur ?? 100) - Math.max(1, Math.floor(amount / 4)); if (s.dur <= 0) { ar[i] = null; sfx.brk(B.IRON_BLOCK); toast(itemName(s.id) + ' broke'); } }
  }
  let epf = 0; for (const s of ar) if (s) { epf += enchLevel(s, 'protection'); if (cause === 'fall' && armorInfo(s.id).piece === 3) epf += enchLevel(s, 'feather_falling') * 3; }
  a *= 1 - Math.min(20, epf) * 0.04;
  // thorns
  if (cause === 'mob' && game.lastAttacker && !game.lastAttacker.dead) { let th = 0; for (const s of ar) if (s) th += enchLevel(s, 'thorns'); if (th && Math.random() < 0.15 * th) ents.hurtMob(game.lastAttacker, 1 + Math.floor(Math.random() * 4), player.x, player.z); }
  return Math.round(a * 2) / 2;
}
function equipArmor() {
  const h = game.inv.held(); const piece = armorInfo(h.id).piece; const old = player.armor[piece];
  player.armor[piece] = { ...h, count: 1 }; game.inv.slots[game.inv.sel] = old || null; game.inv.onChange(); sfx.armor(); ui.lastStats = '';
  toast(itemName(h.id) + ' equipped');
}
const DEATH_MSG = { mob: 'was slain by a monster', fall: 'fell from a high place', lava: 'tried to swim in lava', drown: 'drowned', starve: 'starved to death', explode: 'blew up', void: 'fell out of the world', cactus: 'was pricked to death', dragon: 'was slain by the Ender Dragon', kinetic: 'experienced kinetic energy', enderman: 'was slain by an Enderman', fire: 'went up in flames', lightning: 'was struck by lightning', kill: 'died' };
function die(cause) {
  player.dead = true; player.health = 0;
  for (let i = 0; i < 36; i++) { const s = game.inv.slots[i]; if (s) ents.dropItem(s.id, s.count, player.x, player.y + 1, player.z, (Math.random() - 0.5) * 6, 4, (Math.random() - 0.5) * 6, s.dur, s.ench); }
  game.inv.clear(); const lv = player.level; player.level = 0; player.xp = 0;
  $('death-msg').textContent = 'Steve ' + (DEATH_MSG[cause] || 'died');
  $('death-score').textContent = 'Score: ' + (lv * 7 + game.stats.mined);
  $('death').classList.remove('hidden');
  endPointer();
}
game.dropFromPlayer = (id, n, dur, ench) => {
  const fx = -Math.sin(player.yaw) * Math.cos(player.pitch), fz = -Math.cos(player.yaw) * Math.cos(player.pitch);
  ents.dropItem(id, n, player.x + fx * 0.6, player.y + 1.3, player.z + fz * 0.6, fx * 5, 3, fz * 5, dur, ench);
};
function dropHeld(all) {
  const h = game.inv.held(); if (!h) return;
  const n = all ? h.count : 1; game.dropFromPlayer(h.id, n, h.dur, h.ench); game.inv.consumeHeld(n);
}

// ---------- enchanting ----------
function countShelves(x, y, z) {
  const w = game.world; let n = 0;
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
    if (Math.max(Math.abs(dx), Math.abs(dz)) !== 2) continue;
    for (let dy = 0; dy <= 1; dy++) if (w.getBlock(x + dx, y + dy, z + dz) === B.BOOKSHELF) {
      // the space between table and shelf must be clear
      const ix = x + Math.sign(dx) * (Math.abs(dx) === 2 ? 1 : 0), iz = z + Math.sign(dz) * (Math.abs(dz) === 2 ? 1 : 0);
      if (w.getBlock(ix, y + dy, iz) === 0 || w.getBlock(ix, y + dy, iz) === B.TALL_GRASS) n++;
    }
  }
  return Math.min(15, n);
}
game.enchantOptions = (t) => {
  const item = t.slots[0]; if (!item || item.ench || !enchKind(item.id)) return [];
  const r = mulberry32((player.enchSeed ^ (item.id * 2654435761)) >>> 0);
  const b = t.shelves; const ri = (a, c) => a + Math.floor(r() * (c - a + 1));
  const base = ri(1, 8) + Math.floor(b / 2) + ri(0, b);
  const costs = [Math.max(Math.floor(base / 3), 1), Math.floor(base * 2 / 3) + 1, Math.max(base, b * 2)];
  return costs.map((cost, k) => {
    const rr = mulberry32((player.enchSeed + k * 7919 + item.id * 31) >>> 0);
    const power = Math.max(1, Math.round(cost * (0.85 + rr() * 0.3)));
    return { cost, ench: rollEnchants(item.id, power, rr) };
  }).filter((o) => o.ench && Object.keys(o.ench).length);
};
game.applyEnchant = (t, k) => {
  const opts = game.enchantOptions(t); const o = opts[k]; if (!o) return false;
  const lapis = t.slots[1]; const creative = game.mode === 'creative';
  if (!creative && (player.level < o.cost || !lapis || lapis.count < k + 1)) { sfx.villagerNo(); return false; }
  if (!creative) { player.level -= k + 1; lapis.count -= k + 1; if (lapis.count <= 0) t.slots[1] = null; }
  t.slots[0].ench = { ...o.ench };
  player.enchSeed = (Math.random() * 1e9) | 0; ui.lastStats = '';
  sfx.enchant(); ents.burst(t.x + 0.5, t.y + 1.2, t.z + 0.5, [0.7, 0.5, 1], 20, 2, 0.08, 1);
  toast('Enchanted: ' + enchText(t.slots[0].ench), 2200);
  return true;
};
game.countBeds = (x, y, z) => {
  const w = game.world; let n = 0;
  for (let dx = -16; dx <= 16; dx++) for (let dz = -16; dz <= 16; dz++) for (let dy = -5; dy <= 6; dy++) if (w.getBlock(x + dx, y + dy, z + dz) === B.BED) n++;
  return n;
};

// ---------- nether portals ----------
function tryLightPortal(x, y, z) {
  const w = game.world; const air = (id) => id === 0 || id === B.TALL_GRASS;
  if (!air(w.getBlock(x, y, z))) return false;
  for (const axis of [0, 1]) {
    const ax = axis === 0 ? 1 : 0, az = axis === 0 ? 0 : 1;
    // drop to the bottom of the opening
    let by = y, k = 0; while (k++ < 22 && air(w.getBlock(x, by - 1, z))) by--;
    if (w.getBlock(x, by - 1, z) !== B.OBSIDIAN) continue;
    // slide to the left edge
    let lx = x, lz = z; k = 0; while (k++ < 22 && air(w.getBlock(lx - ax, by, lz - az))) { lx -= ax; lz -= az; }
    if (w.getBlock(lx - ax, by, lz - az) !== B.OBSIDIAN) continue;
    let wd = 0; while (wd < 22 && air(w.getBlock(lx + ax * wd, by, lz + az * wd))) wd++;
    if (wd < 2 || wd > 21 || w.getBlock(lx + ax * wd, by, lz + az * wd) !== B.OBSIDIAN) continue;
    let ht = 0; while (ht < 22 && air(w.getBlock(lx, by + ht, lz))) ht++;
    if (ht < 3 || ht > 21) continue;
    let ok = true;
    for (let i = 0; i < wd && ok; i++) {
      if (w.getBlock(lx + ax * i, by - 1, lz + az * i) !== B.OBSIDIAN || w.getBlock(lx + ax * i, by + ht, lz + az * i) !== B.OBSIDIAN) ok = false;
      for (let j = 0; j < ht && ok; j++) if (!air(w.getBlock(lx + ax * i, by + j, lz + az * i))) ok = false;
    }
    for (let j = 0; j < ht && ok; j++) if (w.getBlock(lx - ax, by + j, lz - az) !== B.OBSIDIAN || w.getBlock(lx + ax * wd, by + j, lz + az * wd) !== B.OBSIDIAN) ok = false;
    if (!ok) continue;
    for (let i = 0; i < wd; i++) for (let j = 0; j < ht; j++) w.setBlock(lx + ax * i, by + j, lz + az * i, B.PORTAL, axis);
    w.portals.push({ x: lx, y: by, z: lz, axis });
    sfx.portal(); ents.burst(lx + 0.5 + ax * wd / 2, by + ht / 2, lz + 0.5 + az * wd / 2, [0.7, 0.3, 1], 30, 3, 0.1, 1.2);
    toast('Nether portal activated');
    return true;
  }
  return false;
}
function breakPortal(x, y, z) {
  const w = game.world; const q = [[x, y, z]]; let n = 0; const seen = new Set();
  while (q.length && n < 600) {
    const [cx, cy, cz] = q.pop(); const k = tkey(cx, cy, cz); if (seen.has(k)) continue; seen.add(k);
    if (w.getBlock(cx, cy, cz) !== B.PORTAL) continue;
    w.setBlock(cx, cy, cz, 0); n++;
    for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) q.push([cx + dx, cy + dy, cz + dz]);
  }
  if (n) { sfx.brk(B.GLASS); ents.burst(x + 0.5, y + 0.5, z + 0.5, [0.6, 0.3, 1], 20, 3, 0.1); }
}
function findPortal(w, x, z, range) {
  let best = null, bd = range;
  w.portals = w.portals.filter((p) => w.getBlock(p.x, p.y, p.z) === B.PORTAL);
  for (const p of w.portals) { const d = Math.max(Math.abs(p.x - x), Math.abs(p.z - z)); if (d <= bd) { bd = d; best = p; } }
  return best;
}
// builds a 4x5 obsidian portal near (x, z) and returns the portal record
function buildPortalNear(w, x, z) {
  const nether = w.type === 'nether';
  const fits = (fx, fy, fz) => {
    for (let dx = 0; dx < 4; dx++) {
      const f = w.getBlock(fx + dx, fy, fz); if (!SOLID[f] || LIQUID[f]) return false;
      for (let dy = 1; dy <= 4; dy++) for (const dz of [-1, 0, 1]) { const id = w.getBlock(fx + dx, fy + dy, fz + dz); if (SOLID[id] || LIQUID[id]) return false; }
    }
    return true;
  };
  let spot = null;
  for (let r = 0; r <= 14 && !spot; r++) for (let dx = -r; dx <= r && !spot; dx++) for (let dz = -r; dz <= r && !spot; dz++) {
    if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
    const cx = x + dx, cz = z + dz;
    if (nether) { for (let fy = 26; fy < 70 && !spot; fy++) if (fits(cx, fy, cz)) spot = [cx, fy, cz]; }
    else { const fy = w.topSolid(cx, cz); if (fy > 2 && fy < H - 8 && fits(cx, fy, cz)) spot = [cx, fy, cz]; }
  }
  if (!spot) {
    const fy = nether ? 40 : Math.max(SEA, w.topSolid(x, z));
    spot = [x, fy, z];
    for (let dx = -1; dx <= 4; dx++) for (let dz = -1; dz <= 1; dz++) {
      if (w.getBlock(x + dx, fy, z + dz) !== B.BEDROCK) w.setBlock(x + dx, fy, z + dz, B.OBSIDIAN);
      for (let dy = 1; dy <= 4; dy++) if (w.getBlock(x + dx, fy + dy, z + dz) !== B.BEDROCK) w.setBlock(x + dx, fy + dy, z + dz, 0);
    }
  }
  const [fx, fy, fz] = spot;
  for (let dx = 0; dx < 4; dx++) for (let dy = 0; dy < 5; dy++) {
    const edge = dx === 0 || dx === 3 || dy === 0 || dy === 4;
    w.setBlock(fx + dx, fy + dy, fz, edge ? B.OBSIDIAN : B.PORTAL, edge ? 0 : 0);
  }
  for (let dx = 0; dx < 4; dx++) for (const dz of [-1, 1]) { const id = w.getBlock(fx + dx, fy, fz + dz); if (!SOLID[id] || LIQUID[id]) w.setBlock(fx + dx, fy, fz + dz, B.OBSIDIAN); }
  const p = { x: fx + 1, y: fy + 1, z: fz, axis: 0 }; w.portals.push(p); return p;
}
// ---------- dimensions ----------
let arrival = null;
const ENT_LISTS = ['mobs', 'items', 'tnts', 'falling', 'arrows', 'fireballs'];
function entMesh(e) { return e.model ? e.model.g : e.mesh; }
function switchDim(target, opts = {}) {
  if (player.riding) exitCar();
  if (ui.screen) ui.close();
  if (game.dim === 'end' && target !== 'end') opts = { ...opts, fromEnd: true };
  player.gliding = false;
  const cur = game.dims[game.dim];
  cur.world = game.world; cur.fluidQ = game.fluidQ; cur.lavaQ = game.lavaQ; cur.ents = {};
  for (const k of ENT_LISTS) { cur.ents[k] = ents[k]; for (const e of ents[k]) scene.remove(entMesh(e)); ents[k] = []; }
  ents.parts = [];
  for (const [, m] of game.chunkMeshes) { if (m.solid) { scene.remove(m.solid); m.solid.geometry.dispose(); } if (m.water) { scene.remove(m.water); m.water.geometry.dispose(); } }
  game.chunkMeshes.clear(); for (const [, c] of game.world.chunks) c.built = false;
  let d = game.dims[target];
  if (!d) d = game.dims[target] = { world: new World((game.seed + (target === 'end' ? 2 : 1)) >>> 0, target), fluidQ: new Map(), lavaQ: new Map(), ents: null };
  game.dim = target; game.world = d.world; ents.world = d.world; game.fluidQ = d.fluidQ || new Map(); game.lavaQ = d.lavaQ || new Map();
  if (d.ents) for (const k of ENT_LISTS) { ents[k] = d.ents[k] || []; for (const e of ents[k]) scene.add(entMesh(e)); }
  game.lastSettlement = null;
  // destination
  if (opts.respawn) { arrival = { respawn: true }; player.x = player.spawn.x; player.z = player.spawn.z; player.y = player.spawn.y; }
  else if (target === 'end') { arrival = { end: opts.outer ? 'outer' : 'main' }; const A = opts.outer ? { x: GATE_ISLAND.x, z: GATE_ISLAND.z + 30 } : ARRIVAL; player.x = A.x + 0.5; player.z = A.z + 0.5; player.y = 90; }
  else if (opts.fromEnd && target === 'overworld') { arrival = { respawn: true }; player.x = player.spawn.x; player.z = player.spawn.z; player.y = player.spawn.y; }
  else {
    const k = target === 'nether' ? 1 / 8 : 8;
    const tx = Math.floor(player.x * k), tz = Math.floor(player.z * k);
    const found = findPortal(d.world, tx, tz, target === 'nether' ? 16 : 128);
    arrival = found ? { portal: found } : { build: [tx, tz] };
    const px = found ? found.x : tx, pz = found ? found.z : tz;
    player.x = px + 0.5; player.z = pz + 0.5; player.y = 60;
  }
  player.vx = player.vy = player.vz = 0; player.portalT = 0; player.portalCd = true; player.fallStart = null;
  $('load-text').textContent = target === 'nether' ? 'Entering the Nether…' : target === 'end' ? 'Entering the End…' : 'Returning to the Overworld…';
  startLoading('dim');
}
function finishArrival() {
  const w = game.world; let p = null;
  if (arrival && arrival.build) p = buildPortalNear(w, arrival.build[0], arrival.build[1]);
  else if (arrival && arrival.portal) p = arrival.portal;
  if (p) {
    const ax = p.axis === 0 ? 1 : 0, az = p.axis === 0 ? 0 : 1;
    // stand just in front of the portal so it does not trigger again
    let sx = p.x + ax * 0.5 + 0.5, sz = p.z + az * 0.5 + 0.5; const fx = az, fz = ax;
    const freeAt = (ox, oz) => !SOLID[w.getBlock(Math.floor(ox), p.y, Math.floor(oz))] && !SOLID[w.getBlock(Math.floor(ox), p.y + 1, Math.floor(oz))];
    if (freeAt(sx + fx, sz + fz)) { sx += fx; sz += fz; } else if (freeAt(sx - fx, sz - fz)) { sx -= fx; sz -= fz; }
    Object.assign(player, { x: sx, y: p.y + 0.01, z: sz });
    const cx = p.x + ax + 0.5 - ax * 0.5, cz = p.z + az + 0.5 - az * 0.5;
    player.yaw = Math.atan2(-(sx - cx), -(sz - cz)); player.pitch = 0;
    sfx.portalTravel();
  } else if (arrival && arrival.respawn) {
    const t = w.topSolid(Math.floor(player.x), Math.floor(player.z)); if (player.y < t + 1) player.y = t + 1.01;
  } else if (arrival && arrival.end) {
    const t = w.topSolid(Math.floor(player.x), Math.floor(player.z)); player.y = (t > 0 ? t : 60) + 1.01; player.yaw = arrival.end === 'main' ? Math.PI / 2 : 0; player.pitch = 0.1;
    sfx.portalTravel(); setupEnd(); if (arrival.end === 'outer' && !game.world.returnGate) { game.world.returnGate = true; buildReturnGateway(); }
  }
  const wasEnd = arrival && arrival.end; arrival = null;
  show(null); $('hud').classList.remove('hidden'); game.state = 'playing'; ui.lastStats = ''; ui.renderStats(player, game.mode);
  toast(game.dim === 'nether' ? 'The Nether' : game.dim === 'end' ? (wasEnd === 'outer' ? 'The Outer End Islands' : 'The End') : game.worldName, 2000); resize();
}
game.switchDim = switchDim;
// ---------- physics helpers ----------
function armorEnch(piece, key) { const s = player.armor && player.armor[piece]; return enchLevel(s, key); }
function waterFlow(w, x, y, z) {
  if (w.getBlock(x, y, z) !== B.WATER) return null;
  const m = w.getMeta(x, y, z); let fx = 0, fz = 0; const down = w.getBlock(x, y + 1, z) === B.WATER && m > 0;
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const n = w.getBlock(x + dx, y, z + dz);
    if (n === B.WATER) { const nm = w.getMeta(x + dx, y, z + dz); if (nm > m) { fx += dx * (nm - m); fz += dz * (nm - m); } else if (nm < m) { fx -= dx * (m - nm) * 0.5; fz -= dz * (m - nm) * 0.5; } }
    else if (!SOLID[n] && m > 0 && w.getBlock(x + dx, y - 1, z + dz) !== B.WATER && !SOLID[w.getBlock(x + dx, y - 1, z + dz)]) { fx += dx * 2; fz += dz * 2; }
  }
  const l = Math.hypot(fx, fz); if (l < 0.01 && !down) return null;
  return [l ? fx / l : 0, l ? fz / l : 0, down];
}
// ---------- boats ----------
const boats = []; game.boats = boats;
function makeBoatMesh() {
  const g = new THREE.Group(); const wood = new THREE.MeshLambertMaterial({ color: 0x9c7a48 }), dark = new THREE.MeshLambertMaterial({ color: 0x6b4a24 });
  const add = (w2, h2, d2, x, y, z, m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w2, h2, d2), m); b.position.set(x, y, z); g.add(b); return b; };
  add(1.3, 0.12, 2.2, 0, 0.06, 0, dark);
  add(0.1, 0.42, 2.2, -0.65, 0.3, 0, wood); add(0.1, 0.42, 2.2, 0.65, 0.3, 0, wood);
  add(1.3, 0.42, 0.1, 0, 0.3, -1.1, wood); add(1.3, 0.42, 0.1, 0, 0.3, 1.1, wood);
  add(1.2, 0.08, 0.3, 0, 0.36, 0.2, dark);
  for (const s2 of [-1, 1]) { const o = add(0.08, 0.08, 1.4, s2 * 0.85, 0.42, 0, dark); o.rotation.x = 0.3; o.userData.oar = s2; }
  return g;
}
function placeBoat(x, y, z) {
  const mesh = makeBoatMesh(); scene.add(mesh);
  const b = { x, y, z, vy: 0, yaw: player.yaw + Math.PI, speed: 0, w: 0.68, h: 0.55, onGround: false, mesh, oarT: 0 };
  boats.push(b); return b;
}
function boatWaterTop(w, b) {
  const x = Math.floor(b.x), z = Math.floor(b.z);
  for (let y = Math.floor(b.y + 0.6); y >= Math.floor(b.y - 1); y--) if (w.getBlock(x, y, z) === B.WATER && w.getBlock(x, y + 1, z) !== B.WATER) return y + 0.88;
  return null;
}
function updateBoats(dt) {
  const w = game.world;
  for (let i = boats.length - 1; i >= 0; i--) {
    const b = boats[i]; if (!w.isLoaded(Math.floor(b.x), Math.floor(b.z))) continue;
    const top = boatWaterTop(w, b);
    if (top !== null) { b.vy += ((top - 0.32) - b.y) * 18 * dt; b.vy *= 1 - dt * 4; b.onWater = true; }
    else { b.vy -= 28 * dt; b.onWater = false; }
    if (!b.onWater && b.onGround) b.speed *= Math.max(0, 1 - dt * 6);
    else b.speed *= Math.max(0, 1 - dt * (b === (player.boat) ? 0.6 : 1.5));
    const fx = -Math.sin(b.yaw + Math.PI), fz = -Math.cos(b.yaw + Math.PI);
    const r = moveEntity(w, b, fx * b.speed * dt, b.vy * dt, fz * b.speed * dt);
    if ((r.hitX || r.hitZ) && Math.abs(b.speed) > 2) b.speed *= -0.25;
    b.mesh.position.set(b.x, b.y, b.z); b.mesh.rotation.y = b.yaw;
    b.mesh.rotation.z = Math.sin(performance.now() / 700 + i) * (b.onWater ? 0.03 : 0);
    if (b.y < -20) { scene.remove(b.mesh); boats.splice(i, 1); }
  }
}
function updateBoatRide(dt, blocked) {
  const p = player, b = p.boat; const w = game.world;
  let mx = 0, mz = 0;
  if (!blocked) { if (keys.w || keys.arrowup) mz -= 1; if (keys.s || keys.arrowdown) mz += 1; if (keys.a || keys.arrowleft) mx -= 1; if (keys.d || keys.arrowright) mx += 1; if (joy.id !== null) { mx += joy.x; mz += joy.y; } }
  const acc = b.onWater ? 9 : 1.5, max = b.onWater ? 8 : 1.2;
  b.speed += -mz * acc * dt; b.speed = Math.max(-max * 0.4, Math.min(max, b.speed));
  b.yaw -= mx * 1.9 * dt * (b.onWater ? 1 : 0.4);
  if (Math.abs(mz) > 0.2 || Math.abs(mx) > 0.2) { b.oarT += dt * 7; b.mesh.children.forEach((c) => { if (c.userData.oar) c.rotation.x = 0.3 + Math.sin(b.oarT) * 0.5; }); if (Math.sin(b.oarT) > 0.97 && b.onWater) sfx.paddle(); }
  p.x = b.x; p.z = b.z; p.y = b.y - 0.25; p.vx = p.vy = p.vz = 0; p.onGround = true; p.fallStart = null; p.sneaking = p.sprinting = false;
  p.inWater = false; p.headInWater = w.getBlock(Math.floor(p.x), Math.floor(p.y + 1.62), Math.floor(p.z)) === B.WATER;
  const jump = !blocked && (jumpHeld || keys.space);
  if (jump && !p._jumpPrev && p.boatT > 0.4) leaveBoat();
  p._jumpPrev = jump; p.boatT = (p.boatT || 0) + dt;
}
function leaveBoat() {
  const p = player, b = p.boat; if (!b) return; p.boat = null; const w = game.world;
  for (const [dx, dz] of [[1.3, 0], [-1.3, 0], [0, 1.3], [0, -1.3], [0, 0]]) {
    const x = b.x + dx, z = b.z + dz; const y = b.y + 0.3;
    if (!collides(w, x - p.w, y, z - p.w, x + p.w, y + p.h, z + p.w)) { p.x = x; p.y = y; p.z = z; break; }
  }
  p.y += 0.2; toast('Left the boat');
}
function rayHitBoat(o, d, maxT = 5) {
  let best = null, bt = maxT;
  for (const b of boats) { const cx = b.x - o.x, cy = b.y + 0.3 - o.y, cz = b.z - o.z; const t = cx * d.x + cy * d.y + cz * d.z; if (t < 0 || t > bt) continue; const px = o.x + d.x * t - b.x, py = o.y + d.y * t - b.y - 0.3, pz = o.z + d.z * t - b.z; if (Math.hypot(px, py * 2, pz) < 1.1) { best = b; bt = t; } }
  return best;
}
// ---------- fishing ----------
let bobber = null;
function castRod(sx, sy) {
  if (bobber) { reelIn(); return; }
  const lp = pickLiquid(sx, sy); const o = camera.position; const d = new THREE.Vector3(); camera.getWorldDirection(d);
  let hx, hy, hz;
  const h = game.world.raycast(o.x, o.y, o.z, d.x, d.y, d.z, 22, (id) => id !== 0);
  if (!h || game.world.getBlock(h.x, h.y, h.z) !== B.WATER) { void lp; toast('Cast your line into water'); sfx.cast(); swing(); return; }
  hx = h.x + 0.5; hz = h.z + 0.5; hy = h.y; while (game.world.getBlock(h.x, hy + 1, h.z) === B.WATER) hy++;
  const mesh = new THREE.Group(); const red = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.16), new THREE.MeshBasicMaterial({ color: 0xd02020 })); const wh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.16), new THREE.MeshBasicMaterial({ color: 0xf0f0f0 })); wh.position.y = 0.1; mesh.add(red, wh); scene.add(mesh);
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0x222222 })); scene.add(line);
  const lure = enchLevel(game.inv.held(), 'lure');
  bobber = { x: hx, y: hy + 0.9, z: hz, mesh, line, wait: Math.max(1.5, 4 + Math.random() * 14 - lure * 4), bite: 0, t: 0 };
  sfx.cast(); swing(); ents.burst(hx, hy + 1, hz, [0.6, 0.75, 1], 8, 1.5, 0.06);
}
function updateBobber(dt) {
  if (!bobber) return; const b = bobber; b.t += dt;
  const h = game.inv.held(); if (!h || h.id !== I.FISHING_ROD || Math.hypot(b.x - player.x, b.z - player.z) > 30 || game.dim !== b.dim && b.dim) { removeBobber(); return; }
  b.dim = game.dim;
  if (b.bite > 0) { b.bite -= dt; if (b.bite <= 0) { b.wait = 3 + Math.random() * 10; } }
  else { b.wait -= dt * (game.raining ? 1.3 : 1); if (b.wait <= 0) { b.bite = 1.3; sfx.bite(); ents.burst(b.x, b.y, b.z, [0.7, 0.85, 1], 14, 2.4, 0.07); } }
  const dip = b.bite > 0 ? -0.25 : Math.sin(b.t * 2.5) * 0.04;
  b.mesh.position.set(b.x, b.y + dip, b.z);
  const pos = b.line.geometry.attributes.position; const d = new THREE.Vector3(); camera.getWorldDirection(d);
  const rx = Math.cos(player.yaw) * 0.35, rz = -Math.sin(player.yaw) * 0.35;
  pos.setXYZ(0, camera.position.x + d.x * 0.8 + rx, camera.position.y + 0.2 + d.y * 0.8, camera.position.z + d.z * 0.8 + rz); pos.setXYZ(1, b.x, b.y + dip + 0.12, b.z); pos.needsUpdate = true;
}
function removeBobber() { if (!bobber) return; scene.remove(bobber.mesh); scene.remove(bobber.line); bobber = null; }
const FISH_LOOT = { fish: [[I.RAW_COD, 1]], junk: [[I.STRING, 1], [I.BONE, 1], [I.LEATHER, 1], [I.STICK, 1], [I.BOWL || I.STICK, 1]], treasure: [[I.EMERALD, 2], [I.DIAMOND, 1], [I.BOW, 1], [I.FISHING_ROD, 1], [I.ENDER_PEARL, 1], [I.SLIME_BALL, 2]] };
function reelIn() {
  const b = bobber; const h = game.inv.held(); sfx.reel(); swing();
  if (b.bite > 0) {
    const luck = enchLevel(h, 'luck_of_the_sea'); const r = Math.random();
    const kind = r < 0.05 + luck * 0.025 ? 'treasure' : r < 0.15 - luck * 0.02 ? 'junk' : 'fish';
    const pool = FISH_LOOT[kind]; const [id, n] = pool[Math.floor(Math.random() * pool.length)];
    let ench; if (kind === 'treasure' && (id === I.BOW || id === I.FISHING_ROD)) ench = rollEnchants(id, 25, Math.random) || undefined;
    const left = game.inv.add(id, n, maxDur(id) || undefined, ench); if (left) game.dropFromPlayer(id, left);
    game.addXP ? game.addXP(1 + Math.floor(Math.random() * 6)) : 0;
    toast((kind === 'treasure' ? 'Treasure: ' : 'Caught ') + itemName(id) + (n > 1 ? ' x' + n : ''), 2000); sfx.pop();
    if (game.mode === 'survival') game.inv.damageHeld(1);
  }
  removeBobber();
}
// ---------- trident ----------
function throwTrident() {
  const h = game.inv.held(); const d = new THREE.Vector3(); camera.getWorldDirection(d); const sp = 30;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 1.2), new THREE.MeshLambertMaterial({ color: 0x3a9a9a })); scene.add(mesh);
  ents.arrows.push({ x: camera.position.x + d.x * 0.7, y: camera.position.y + d.y * 0.7 - 0.1, z: camera.position.z + d.z * 0.7, vx: d.x * sp, vy: d.y * sp + 0.5, vz: d.z * sp, life: 3, mesh, dmg: 8 + enchLevel(h, 'sharpness'), fromPlayer: true });
  const back = { ...h }; game.inv.slots[game.inv.sel] = null; game.inv.onChange(); sfx.bow(); swing();
  setTimeout(() => { if (game.mode === 'survival') back.dur = (back.dur ?? 250) - 1; if (back.dur > 0 || game.mode !== 'survival') { if (!game.inv.slots[game.inv.sel]) { game.inv.slots[game.inv.sel] = back; game.inv.onChange(); } else game.inv.add(back.id, 1, back.dur, back.ench); sfx.pop(); } }, 1600);
}
// ---------- campfires ----------
const cooking = [];
function cookOnCampfire(b, held) {
  const out = SMELT[held.id]; if (!out || !ITEMS[held.id] || !ITEMS[held.id].food) return false;
  if (cooking.filter((c) => c.x === b.x && c.y === b.y && c.z === b.z).length >= 4) { toast('The campfire is full'); return true; }
  cooking.push({ x: b.x, y: b.y, z: b.z, out, t: 8 }); if (game.mode === 'survival') game.inv.consumeHeld(1); sfx.place(B.PLANKS); swing(); toast('Cooking ' + itemName(held.id) + '...'); return true;
}
let fireFxT = 0;
function updateCampfires(dt) {
  for (let i = cooking.length - 1; i >= 0; i--) { const c = cooking[i]; c.t -= dt; if (c.t <= 0) { cooking.splice(i, 1); if (game.world.getBlock(c.x, c.y, c.z) === B.CAMPFIRE) { ents.dropItem(c.out, 1, c.x + 0.5, c.y + 0.8, c.z + 0.5, 0, 2, 0); sfx.pop(); } } }
  fireFxT -= dt; if (fireFxT > 0) return; fireFxT = 0.12;
  const w = game.world; const px = Math.floor(player.x), py = Math.floor(player.y), pz = Math.floor(player.z);
  for (let k = 0; k < 6; k++) { const x = px + Math.floor((Math.random() - 0.5) * 24), y = py + Math.floor((Math.random() - 0.5) * 10), z = pz + Math.floor((Math.random() - 0.5) * 24); if (w.getBlock(x, y, z) === B.CAMPFIRE) { ents.burst(x + 0.5, y + 0.8, z + 0.5, [0.55, 0.55, 0.55], 3, 0.4, 0.14, 2.5); ents.burst(x + 0.5, y + 0.6, z + 0.5, [1, 0.6, 0.15], 2, 0.6, 0.06, 0.4); } }
}
// ---------- lightning & thunderstorms ----------
let boltT = 6, flashT = 0; const bolts = [];
function strikeLightning(x, z) {
  const w = game.world; const y = Math.max(w.topSolid(Math.floor(x), Math.floor(z)) + 1, 2);
  const g = new THREE.Group(); const mat = new THREE.MeshBasicMaterial({ color: 0xe8f0ff, transparent: true, opacity: 0.95 });
  let cx = x, cz = z; for (let yy = y + 90; yy > y; yy -= 6) { const nx = cx + (Math.random() - 0.5) * 3, nz = cz + (Math.random() - 0.5) * 3; const len = 6; const seg = new THREE.Mesh(new THREE.BoxGeometry(0.25, len, 0.25), mat); seg.position.set((cx + nx) / 2, yy - len / 2, (cz + nz) / 2); seg.rotation.z = Math.atan2(nx - cx, len) * 0.9; seg.rotation.x = -Math.atan2(nz - cz, len) * 0.9; g.add(seg); cx = nx; cz = nz; }
  scene.add(g); bolts.push({ g, t: 0.35 }); flashT = 0.25;
  const dist = Math.hypot(x - player.x, z - player.z); setTimeout(() => sfx.thunder(), Math.min(4000, dist / 0.34)); if (dist < 40) sfx.zap();
  if (Math.hypot(x - player.x, y - player.y, z - player.z) < 3.5 && game.mode === 'survival') { player.hurtCd = 0; game.damagePlayer(5, x, z, 'lightning'); }
  for (const m of [...ents.mobs]) {
    if (Math.hypot(m.x - x, m.y - y, m.z - z) > 3.5) continue;
    if (m.type === 'pig') { ents.remove ? ents.remove(m) : (m.dead = 0.01); ents.spawnMob('zombified_piglin', m.x, m.y, m.z); }
    else if (m.type === 'creeper') { m.charged = true; m.hp = m.def.hp; }
    else ents.hurtMob(m, 5, x, z);
  }
  ents.burst(x, y + 0.5, z, [1, 1, 1], 20, 4, 0.12);
}
function updateWeatherFx(dt) {
  for (let i = bolts.length - 1; i >= 0; i--) { const b = bolts[i]; b.t -= dt; b.g.visible = b.t > 0.2 || (b.t * 30 | 0) % 2 === 0; if (b.t <= 0) { scene.remove(b.g); bolts.splice(i, 1); } }
  if (flashT > 0) { flashT -= dt; }
  $('flash').style.opacity = flashT > 0 ? Math.min(0.55, flashT * 2.4) : 0;
  if (!game.raining || !game.thunder || game.dim !== 'overworld') return;
  boltT -= dt; if (boltT > 0) return; boltT = 4 + Math.random() * 12;
  const a = Math.random() * Math.PI * 2, d = 8 + Math.random() * 70;
  strikeLightning(player.x + Math.cos(a) * d, player.z + Math.sin(a) * d);
}
// ---------- compass & clock ----------
function heldInfo() {
  const el = $('held-info'); const h = game.inv.held(); let t = '';
  if (h && h.id === I.COMPASS) {
    if (game.dim !== 'overworld') t = 'The compass needle spins wildly';
    else { const dx = player.spawn.x - player.x, dz = player.spawn.z - player.z, d = Math.hypot(dx, dz); const ang = Math.atan2(-dx, -dz) - player.yaw; const arrows = ['↑', '↖', '←', '↙', '↓', '↘', '→', '↗']; const k = ((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8; t = d < 3 ? 'You are at your spawn point' : `${arrows[k]}  Spawn ${Math.round(d)} blocks`; }
  } else if (h && h.id === I.CLOCK) {
    if (game.dim !== 'overworld') t = 'The clock hands spin wildly';
    else { const tk = (game.ticks + 6000) % 24000; const hh = Math.floor(tk / 1000), mm = Math.floor((tk % 1000) * 0.06); const tod = game.ticks % 24000; t = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}  ${tod < 12000 ? 'Day' : tod < 13000 ? 'Sunset' : tod < 23000 ? 'Night' : 'Sunrise'}${game.thunder && game.raining ? ' · Storm' : game.raining ? ' · Rain' : ''}`; }
  } else if (h && h.id === I.SHIELD && player.sneaking) t = 'Blocking';
  else if (player.boat) t = 'Joystick to row · jump to leave the boat';
  el.textContent = t; el.classList.toggle('hidden', !t);
}
function shearSheep(m) {
  if (m.sheared || m.baby) return false;
  m.sheared = 90; const n = 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) ents.dropItem(m.woolColor || B.WOOL, 1, m.x, m.y + 1, m.z, (Math.random() - 0.5) * 3, 4, (Math.random() - 0.5) * 3);
  m.model.g.traverse((o) => { if (o.isMesh && o.material && o.material.color && o.material.color.getHex() === 0xf2f2f2) { o.userData.wool = true; o.material.color.setHex(0xd8c8b8); o.scale.multiplyScalar(0.86); } });
  sfx.sheep(); swing(); if (game.mode === 'survival') game.inv.damageHeld(1); return true;
}
let sheepT = 0;
function tickSheep(dt) {
  sheepT -= dt; if (sheepT > 0) return; sheepT = 2;
  for (const m of ents.mobs) if (m.type === 'sheep' && m.sheared) { m.sheared -= 2; if (m.sheared <= 0) { m.sheared = 0; m.model.g.traverse((o) => { if (o.userData.wool) { o.userData.wool = false; o.material.color.setHex(0xf2f2f2); o.scale.multiplyScalar(1 / 0.86); } }); } }
}

// ---------- the End ----------
function setupEnd() {
  const w = game.world; game.endState = game.endState || { dragonDead: false };
  ents.endCenter = { x: 0, y: END_TOP, z: 0 };
  if (game.endState.dragonDead) return;
  if (!ents.mobs.some((m) => m.type === 'ender_dragon')) {
    if (!game.endState.crystals) { game.endState.crystals = true; for (const pl of endPillars(w)) ents.spawnMob('end_crystal', pl.x + 0.5, pl.top + 2, pl.z + 0.5); }
    ents.spawnMob('ender_dragon', 0.5, END_TOP + 32, 0.5);
  }
}
function setB(x, y, z, id) { if (game.world.chunks.has(ckey(x >> 4, z >> 4))) game.setBlock(x, y, z, id); }
game.onDragonDeath = () => {
  const w = game.world; game.endState = game.endState || {}; game.endState.dragonDead = true;
  w.endPortalOpen = true; w.endEgg = true; w.gatewayOpen = true;
  for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) { const r = Math.hypot(dx, dz); if (r < 2.6 && (dx || dz)) setB(dx, END_TOP, dz, B.END_PORTAL); }
  setB(0, END_TOP + 4, 0, B.DRAGON_EGG);
  const G = GATEWAY; setB(G.x, G.y, G.z, B.END_PORTAL); setB(G.x, G.y - 2, G.z, B.BEDROCK); setB(G.x, G.y + 2, G.z, B.BEDROCK);
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { setB(G.x + dx, G.y - 1, G.z + dz, B.BEDROCK); setB(G.x + dx, G.y + 1, G.z + dz, B.BEDROCK); }
  sfx.endPortal(); toast('The Ender Dragon has been slain. The exit portal is open.', 4200); chatLog('A gateway to the outer islands opened at ' + G.x + ', ' + G.y + ', ' + G.z);
};
function buildReturnGateway() {
  // small gateway on the outer island that leads back to the main island
  const w = game.world; const x = Math.floor(player.x) + 3, z = Math.floor(player.z); const y = Math.max(w.topSolid(x, z), 30) + 2;
  game.setBlock(x, y, z, B.END_PORTAL); game.setBlock(x, y - 2, z, B.BEDROCK); game.setBlock(x, y + 2, z, B.BEDROCK);
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { game.setBlock(x + dx, y - 1, z + dz, B.BEDROCK); game.setBlock(x + dx, y + 1, z + dz, B.BEDROCK); }
}
function checkEndPortal(x, y, z) {
  const w = game.world;
  for (let cx = x - 2; cx <= x + 2; cx++) for (let cz = z - 2; cz <= z + 2; cz++) {
    if (FRAME_RING.every(([dx, dz]) => w.getBlock(cx + dx, y, cz + dz) === B.END_FRAME_EYE)) {
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) game.setBlock(cx + dx, y, cz + dz, B.END_PORTAL);
      sfx.endPortal(); toast('The End portal opens', 3000); return true;
    }
  }
  return false;
}
function throwEye() {
  if (game.dim !== 'overworld') { toast('The eye of ender does nothing here'); return; }
  const sh = strongholdNear(game.world, player.x, player.z); if (!sh) { toast('No stronghold nearby'); return; }
  const tx = sh.portal.x + 0.5, tz = sh.portal.z + 0.5; const d = Math.hypot(tx - player.x, tz - player.z);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.25), new THREE.MeshBasicMaterial({ color: 0x2fae86 })); scene.add(mesh);
  const ux = (tx - player.x) / (d || 1), uz = (tz - player.z) / (d || 1); const fly = Math.min(12, d);
  const eye = { x: player.x, y: player.y + 1.5, z: player.z, t: 0, mesh, ux, uz, fly, y0: player.y + 1.5 };
  eyes.push(eye); sfx.eye(); swing();
  if (game.mode === 'survival') game.inv.consumeHeld(1);
  const dirs = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
  const ang = Math.atan2(tz - player.z, tx - player.x); const di = ((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8;
  toast(d < 8 ? 'The stronghold portal room is right below you' : `The eye flies ${dirs[di]} — stronghold about ${Math.round(d)} blocks away`, 3000);
}
const eyes = [];
function updateEyes(dt) {
  for (let i = eyes.length - 1; i >= 0; i--) {
    const e = eyes[i]; e.t += dt; const k = Math.min(1, e.t / 2);
    e.x += e.ux * e.fly * dt / 2 * (k < 1 ? 1 : 0); e.z += e.uz * e.fly * dt / 2 * (k < 1 ? 1 : 0); e.y = e.y0 + Math.sin(k * Math.PI / 2) * 5;
    e.mesh.position.set(e.x, e.y, e.z); e.mesh.rotation.y += dt * 4;
    if (Math.random() < dt * 20) ents.burst(e.x, e.y, e.z, [0.7, 0.3, 1], 1, 0.3, 0.06, 0.5);
    if (e.t > 2.8) {
      scene.remove(e.mesh); eyes.splice(i, 1);
      if (Math.random() < 0.8) { const y = game.world.topSolid(Math.floor(e.x), Math.floor(e.z)) + 1.2; ents.dropItem ? ents.dropItem(I.EYE_OF_ENDER, 1, e.x, Math.max(y, 2), e.z) : game.inv.add(I.EYE_OF_ENDER, 1); }
      else { ents.burst(e.x, e.y, e.z, [0.3, 0.8, 0.6], 14, 2, 0.1); sfx.eye(); toast('The eye of ender shattered'); }
    }
  }
}
function shootBow() {
  const h = game.inv.held(); const inf = enchLevel(h, 'infinity'); const pw = enchLevel(h, 'power'); const flame = enchLevel(h, 'flame');
  if (game.mode === 'survival' && !inf && !game.inv.count(I.ARROW)) { toast('You need arrows to shoot'); return; }
  if (bowCd > 0) return; bowCd = 0.55;
  if (game.mode === 'survival') { if (!inf) game.inv.remove(I.ARROW, 1); game.inv.damageHeld(1); }
  const d = new THREE.Vector3(); camera.getWorldDirection(d); const sp = 34;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.5), new THREE.MeshLambertMaterial({ color: 0x8a6232 })); scene.add(mesh);
  ents.arrows.push({ x: camera.position.x + d.x * 0.6, y: camera.position.y + d.y * 0.6 - 0.1, z: camera.position.z + d.z * 0.6, vx: d.x * sp, vy: d.y * sp + 1, vz: d.z * sp, life: 4, mesh, dmg: Math.round(6 + pw * 1.5), fromPlayer: true, fire: !!flame });
  sfx.bow(); swing();
}
let bowCd = 0;
function teleportPlayer(x, y, z) { player.x = x; player.y = y; player.z = z; player.vx = player.vy = player.vz = 0; player.fallStart = null; sfx.teleport(); ents.burst(x, y + 1, z, [0.6, 0.2, 0.9], 16, 2, 0.1); }
function chorusTeleport() {
  const w = game.world;
  for (let a = 0; a < 16; a++) {
    const x = Math.floor(player.x + (Math.random() - 0.5) * 16), z = Math.floor(player.z + (Math.random() - 0.5) * 16);
    if (!w.isLoaded(x, z)) continue;
    for (let y = Math.min(H - 3, Math.floor(player.y) + 8); y > Math.max(1, player.y - 8); y--) if (SOLID[w.getBlock(x, y - 1, z)] && !SOLID[w.getBlock(x, y, z)] && !SOLID[w.getBlock(x, y + 1, z)] && !LIQUID[w.getBlock(x, y, z)]) { teleportPlayer(x + 0.5, y, z + 0.5); return; }
  }
}
function setElytraBtn() { const b = $('btn-elytra'); if (b) b.classList.toggle('hidden', !player.elytra); }
let netherT = 0;
function tickNetherSpawning() {
  const w = game.world; netherT++;
  const count = (t) => ents.mobs.filter((m) => m.type === t && !m.dead).length;
  // fortress spawners
  for (const [, sp] of w.spawners) {
    if (Math.hypot(sp.x - player.x, sp.y - player.y, sp.z - player.z) > 18 || game.difficulty === 0) continue;
    sp.t = (sp.t || 0) - 1; if (sp.t > 0) continue; sp.t = 6 + Math.floor(Math.random() * 10);
    if (ents.mobs.filter((m) => m.type === 'blaze' && Math.hypot(m.x - sp.x, m.z - sp.z) < 12).length >= 4) continue;
    for (let a = 0; a < 6; a++) {
      const x = sp.x + Math.floor((Math.random() - 0.5) * 7), y = sp.y + Math.floor(Math.random() * 3) - 1, z = sp.z + Math.floor((Math.random() - 0.5) * 7);
      if (!SOLID[w.getBlock(x, y, z)] && !SOLID[w.getBlock(x, y + 1, z)]) { ents.spawnMob('blaze', x + 0.5, y, z + 0.5); ents.burst(x + 0.5, y + 1, z + 0.5, [0.3, 0.3, 0.3], 10, 1.5, 0.12); break; }
    }
  }
  for (let a = 0; a < 3; a++) {
    const ang = Math.random() * Math.PI * 2, d = 18 + Math.random() * 26;
    const x = Math.floor(player.x + Math.cos(ang) * d), z = Math.floor(player.z + Math.sin(ang) * d);
    if (!w.isLoaded(x, z)) continue;
    const yy = Math.max(24, Math.min(H - 6, Math.floor(player.y + (Math.random() - 0.5) * 30)));
    let y = -1; for (let k = 0; k < 10; k++) { const t = yy - k; if (!SOLID[w.getBlock(x, t, z)] && !LIQUID[w.getBlock(x, t, z)] && !SOLID[w.getBlock(x, t + 1, z)] && SOLID[w.getBlock(x, t - 1, z)]) { y = t; break; } }
    if (y < 0) continue;
    const biome = netherBiome(w, x, z); const r = Math.random();
    if (r < 0.5 && biome !== 2) { if (count('zombified_piglin') < 8) { const n = 1 + Math.floor(Math.random() * 3); for (let i = 0; i < n; i++) ents.spawnMob('zombified_piglin', x + 0.5 + i * 0.6, y, z + 0.5); } }
    else if (r < 0.72 && biome !== 1) { if (count('magma_cube') < 3 && game.difficulty > 0) ents.spawnMob('magma_cube', x + 0.5, y, z + 0.5); }
    else if (r < 0.86 && biome !== 1 && game.difficulty > 0 && count('ghast') < 2 && d > 24) {
      let open = true; for (let dy = 2; dy <= 6 && open; dy++) for (const [dx, dz] of [[0, 0], [2, 0], [-2, 0], [0, 2], [0, -2]]) if (SOLID[w.getBlock(x + dx, y + dy, z + dz)]) { open = false; break; }
      if (open) ents.spawnMob('ghast', x + 0.5, y + 2, z + 0.5);
    }
  }
}

let endSpawnT = 0;
function tickEndSpawning() {
  const w = game.world; endSpawnT++;
  if (ents.mobs.filter((m) => m.type === 'enderman').length >= 7) return;
  for (let a = 0; a < 3; a++) {
    const ang = Math.random() * Math.PI * 2, d = 16 + Math.random() * 28;
    const x = Math.floor(player.x + Math.cos(ang) * d), z = Math.floor(player.z + Math.sin(ang) * d);
    if (!w.isLoaded(x, z)) continue; const y = w.topSolid(x, z);
    if (y < 10 || w.getBlock(x, y, z) !== B.END_STONE) continue;
    ents.spawnMob('enderman', x + 0.5, y + 1, z + 0.5); break;
  }
}
function tickStrongholdSpawners() {
  const w = game.world; if (game.difficulty === 0) return;
  for (const [, sp] of w.spawners) {
    if (Math.hypot(sp.x - player.x, sp.y - player.y, sp.z - player.z) > 16) continue;
    sp.t = (sp.t || 0) - 1; if (sp.t > 0) continue; sp.t = 8 + Math.floor(Math.random() * 10);
    const type = sp.type || 'zombie';
    if (ents.mobs.filter((m) => m.type === type && Math.hypot(m.x - sp.x, m.z - sp.z) < 10).length >= 4) continue;
    for (let a = 0; a < 6; a++) {
      const x = sp.x + Math.floor((Math.random() - 0.5) * 7), y = sp.y + Math.floor(Math.random() * 3) - 1, z = sp.z + Math.floor((Math.random() - 0.5) * 7);
      if (!SOLID[w.getBlock(x, y, z)] && !SOLID[w.getBlock(x, y + 1, z)] && SOLID[w.getBlock(x, y - 1, z)]) { ents.spawnMob(type, x + 0.5, y, z + 0.5); ents.burst(x + 0.5, y + 1, z + 0.5, [0.3, 0.3, 0.3], 10, 1.5, 0.12); break; }
    }
  }
}
let stareT = 0;
function tickEndermanStare(dt) {
  stareT -= dt; if (stareT > 0) return; stareT = 0.25;
  if (game.mode !== 'survival' || player.dead) return;
  const o = camera.position; const d = new THREE.Vector3(); camera.getWorldDirection(d);
  const hit = ents.raycastMobs(o, d, 48);
  if (hit && hit.mob.type === 'enderman' && !(hit.mob.angry > 0)) {
    const m = hit.mob; const bh = game.world.raycast(o.x, o.y, o.z, d.x, d.y, d.z, hit.t, (id) => id !== 0 && OPAQUE[id]);
    if (!bh) { m.angry = 30; sfx.ender(); m.stareShake = 0.6; }
  }
}
function updateBossBar() {
  const el = $('bossbar'); if (!el) return;
  const dr = game.dim === 'end' ? ents.mobs.find((m) => m.type === 'ender_dragon' && !m.dead) : null;
  const show = !!dr && Math.hypot(dr.x - player.x, dr.z - player.z) < 180 && game.state === 'playing';
  el.classList.toggle('hidden', !show);
  if (show) { const f = Math.max(0, dr.hp / dr.def.hp); $('bossbar-fill').style.width = (f * 100).toFixed(1) + '%'; const n = ents.mobs.filter((m) => m.type === 'end_crystal').length; $('bossbar-name').textContent = 'Ender Dragon' + (n ? ' · ' + n + ' crystals' : ''); }
}

// ---------- explosions ----------
game.explode = (x, y, z, power) => {
  const w = game.world; const r = power; sfx.explode(); shake = 0.6;
  const rnd = Math.random;
  for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) for (let dz = -r; dz <= r; dz++) {
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz); if (d > r * (0.7 + rnd() * 0.35)) continue;
    const bx = Math.floor(x + dx), by = Math.floor(y + dy), bz = Math.floor(z + dz);
    const id = w.getBlock(bx, by, bz);
    if (!id || id === B.BEDROCK || id === B.OBSIDIAN || id === B.PORTAL || id === B.ENCHANT_TABLE || LIQUID[id]) continue;
    if (id === B.TNT) { w.setBlock(bx, by, bz, 0); ents.primeTNT(bx, by, bz, 0.5 + rnd()); continue; }
    const tile = w.tiles.get(tkey(bx, by, bz)); if (tile) { for (const s of tile.slots) if (s) ents.dropItem(s.id, s.count, bx + 0.5, by + 0.5, bz + 0.5); w.tiles.delete(tkey(bx, by, bz)); }
    w.setBlock(bx, by, bz, 0);
    if (game.mode === 'survival' && rnd() < 0.18) { const dr = resolveDrop(id, { id: 146 }); if (dr) ents.dropItem(dr.id, dr.n, bx + 0.5, by + 0.5, bz + 0.5); }
  }
  for (let dx = -r - 1; dx <= r + 1; dx++) for (let dy = -r - 1; dy <= r + 1; dy++) for (let dz = -r - 1; dz <= r + 1; dz++) {
    const bx = Math.floor(x + dx), by = Math.floor(y + dy), bz = Math.floor(z + dz); const id = w.getBlock(bx, by, bz);
    if (id === B.WATER) game.fluidQ.set(tkey(bx, by, bz), [bx, by, bz]); else if (id === B.LAVA) game.lavaQ.set(tkey(bx, by, bz), [bx, by, bz]);
    else if (BLOCKS[id] && BLOCKS[id].gravity && !SOLID[w.getBlock(bx, by - 1, bz)]) { w.setBlock(bx, by, bz, 0); ents.spawnFalling(id, bx, by, bz); }
  }
  ents.smoke(x, y, z, 50);
  const pd = Math.hypot(player.x - x, player.y + 0.9 - y, player.z - z);
  if (pd < r * 2) {
    const k = 1 - pd / (r * 2); const dmg = Math.round(k * power * 4.5 * [0, 0.5, 1, 1.5][game.difficulty]);
    player.hurtCd = 0; game.damagePlayer(dmg, x, z, 'explode');
    const d = pd || 1; player.vx += (player.x - x) / d * k * 14; player.vy += k * 9; player.vz += (player.z - z) / d * k * 14;
  }
  for (const m of ents.mobs) { const md = Math.hypot(m.x - x, m.y - y, m.z - z); if (md < r * 2) { m.hurt = 0; ents.hurtMob(m, Math.round((1 - md / (r * 2)) * power * 5), x, z, false); } }
};

// ---------- fluids ----------
let fluidT = 0, lavaT = 0;
function tickFluids(q, liquid, maxLevel) {
  if (!q.size) return; const w = game.world;
  const list = [...q.values()].slice(0, 96); for (const [x, y, z] of list) q.delete(tkey(x, y, z));
  for (const [x, y, z] of list) {
    if (w.getBlock(x, y, z) !== liquid) continue;
    const lvl = w.getMeta(x, y, z);
    const other = liquid === B.WATER ? B.LAVA : B.WATER;
    const below = w.getBlock(x, y - 1, z);
    if (below === other) { game.setBlock(x, y - 1, z, liquid === B.WATER ? (w.getMeta(x, y - 1, z) === 0 ? B.OBSIDIAN : B.COBBLE) : B.STONE); sfx.fuse(); continue; }
    if (REPLACEABLE.has(below) && below !== liquid && y > 0) { game.setBlock(x, y - 1, z, liquid, 1); continue; }
    if (below === liquid) continue;
    if (lvl >= maxLevel) continue;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, nz = z + dz; const n = w.getBlock(nx, y, nz);
      if (!w.isLoaded(nx, nz)) continue;
      if (n === other) { game.setBlock(nx, y, nz, liquid === B.WATER ? (w.getMeta(nx, y, nz) === 0 ? B.OBSIDIAN : B.COBBLE) : B.COBBLE); continue; }
      if (n === liquid) { if (w.getMeta(nx, y, nz) > lvl + 1) game.setBlock(nx, y, nz, liquid, lvl + 1); continue; }
      if (REPLACEABLE.has(n)) { if (n === B.TORCH || BLOCKS[n].shape === 'cross') popBlock(nx, y, nz, n); game.setBlock(nx, y, nz, liquid, lvl + 1); }
    }
  }
}

// ---------- tiles (furnace/chest) ----------
function getTile(x, y, z, type) {
  const k = tkey(x, y, z); let t = game.world.tiles.get(k);
  if (!t) {
    t = type === 'chest' ? { type, slots: new Array(27).fill(null) } : { type, slots: [null, null, null], burn: 0, burnMax: 0, cook: 0, x, y, z }; game.world.tiles.set(k, t);
    const lt = game.world.loot.get(k); if (type === 'chest' && lt) { fillLoot(t.slots, lt); game.world.loot.delete(k); }
  }
  return t;
}
const LOOT = {
  house: [[I.BREAD, 1, 4, 0.8], [I.WHEAT, 1, 6, 0.6], [I.SEEDS, 1, 5, 0.5], [I.APPLE, 1, 3, 0.5], [I.EMERALD, 1, 2, 0.4], [B.TORCH, 2, 6, 0.4]],
  smith: [[I.IRON_INGOT, 1, 5, 0.9], [I.BREAD, 1, 3, 0.6], [I.COAL, 2, 6, 0.6], [I.EMERALD, 1, 3, 0.5], [toolId(2, 0), 1, 1, 0.3], [toolId(2, 3), 1, 1, 0.25], [B.OBSIDIAN, 1, 3, 0.3], [I.DIAMOND, 1, 2, 0.12]],
  library: [[I.EMERALD, 1, 3, 0.6], [B.BOOKSHELF, 1, 2, 0.4], [I.STICK, 2, 8, 0.5], [B.GLASS, 2, 5, 0.4], [B.TORCH, 2, 6, 0.5]],
  butcher: [[I.RAW_PORK, 1, 4, 0.7], [I.RAW_BEEF, 1, 4, 0.6], [I.RAW_MUTTON, 1, 3, 0.5], [I.COAL, 1, 4, 0.6], [I.EMERALD, 1, 2, 0.3]],
  mall: [[I.EMERALD, 1, 4, 0.8], [I.SMARTPHONE, 1, 1, 0.25], [I.BATTERY, 1, 3, 0.5], [I.CIRCUIT, 1, 2, 0.4], [B.LED_SCREEN, 2, 6, 0.4], [I.BREAD, 2, 5, 0.6], [I.STEAK, 1, 4, 0.5], [B.GLASS_BLUE, 4, 12, 0.4]],
  city: [[I.SMARTPHONE, 1, 1, 0.3], [I.CIRCUIT, 1, 3, 0.5], [I.BATTERY, 1, 2, 0.4], [I.EMERALD, 2, 6, 0.9], [I.IRON_INGOT, 2, 6, 0.7], [I.GOLD_INGOT, 1, 4, 0.5], [I.DIAMOND, 1, 3, 0.3], [B.GLOWSTONE, 1, 4, 0.5], [I.BREAD, 2, 5, 0.6], [I.STEAK, 1, 4, 0.5]],
  fortress: [[I.GOLD_INGOT, 1, 4, 0.7], [I.IRON_INGOT, 1, 5, 0.6], [I.DIAMOND, 1, 3, 0.3], [B.OBSIDIAN, 2, 6, 0.4], [I.FLINT_STEEL, 1, 1, 0.35], [I.GOLD_NUGGET, 3, 12, 0.5], [I.BLAZE_ROD, 1, 2, 0.25], [I.LAPIS, 3, 9, 0.4], [toolId(3, 3), 1, 1, 0.25]],
  stronghold: [[I.ENDER_PEARL, 1, 3, 0.6], [I.IRON_INGOT, 1, 5, 0.7], [I.BREAD, 1, 3, 0.6], [I.DIAMOND, 1, 3, 0.25], [I.EYE_OF_ENDER, 1, 2, 0.35], [I.GOLD_INGOT, 1, 3, 0.4], [I.APPLE, 1, 3, 0.5], [toolId(2, 3), 1, 1, 0.3]],
  stronghold_library: [[I.BOOK, 2, 6, 0.9], [I.PAPER, 3, 9, 0.8], [I.LAPIS, 3, 9, 0.5], [B.BOOKSHELF, 1, 3, 0.4], [I.ENDER_PEARL, 1, 2, 0.35], [I.EMERALD, 1, 3, 0.4]],
  end_city: [[I.DIAMOND, 2, 6, 0.6], [I.IRON_INGOT, 3, 8, 0.7], [I.GOLD_INGOT, 2, 7, 0.6], [I.EMERALD, 2, 6, 0.5], [toolId(3, 3), 1, 1, 0.35, 1], [toolId(3, 0), 1, 1, 0.3, 1], [I.FIREWORK, 3, 9, 0.5], [I.CHORUS_FRUIT, 2, 6, 0.5], [I.ENDER_PEARL, 1, 3, 0.5]],
  end_city_elytra: [[I.ELYTRA, 1, 1, 1], [I.FIREWORK, 8, 16, 1], [I.DIAMOND, 2, 5, 0.8], [toolId(3, 3), 1, 1, 0.6, 1], [I.EMERALD, 3, 8, 0.6]],
  shop: [[I.EMERALD, 1, 4, 0.8], [B.GLASS, 4, 12, 0.5], [B.BRICKS, 4, 12, 0.4], [B.TORCH, 4, 10, 0.5], [I.BREAD, 2, 5, 0.6], [I.COOKED_PORK, 1, 4, 0.5], [B.LAMP, 1, 3, 0.3]],
};
function fillLoot(slots, table) {
  for (const [id, a, b, p, en] of LOOT[table] || LOOT.house) {
    if (Math.random() > p) continue;
    const n = a + Math.floor(Math.random() * (b - a + 1)); let i = Math.floor(Math.random() * 27), tries = 0;
    while (slots[i] && tries++ < 30) i = Math.floor(Math.random() * 27);
    slots[i] = { id, count: Math.min(n, maxStack(id)), dur: maxDur(id) }; if (en) { const e = rollEnchants(id, 20 + Math.floor(Math.random() * 10), Math.random); if (e && Object.keys(e).length) slots[i].ench = e; }
  }
}
// ---------- crops ----------
let cropT = 0;
function tickCrops(dt) {
  cropT += dt; if (cropT < 1) return; cropT = 0;
  const w = game.world;
  for (const [k, [x, y, z]] of w.crops) {
    if (!w.isLoaded(x, z)) continue;
    const id = w.getBlock(x, y, z);
    if (id === B.SUGAR_CANE) {
      let h = 1; while (h < 4 && w.getBlock(x, y - h, z) === B.SUGAR_CANE) h++;
      if (h >= 3 || w.getBlock(x, y + 1, z) !== 0) { w.crops.delete(k); continue; }
      if (Math.random() < 1 / 40) { w.setBlock(x, y + 1, z, B.SUGAR_CANE); w.crops.delete(k); w.crops.set(tkey(x, y + 1, z), [x, y + 1, z]); }
      continue;
    }
    if (!isWheat(id) || id === B.WHEAT_3) { w.crops.delete(k); continue; }
    if (Math.random() < 1 / 30) w.setBlock(x, y, z, id + 1);
  }
}
// ---------- settlements: villagers ----------
let settleT = 0;
function tickSettlements(dt) {
  settleT -= dt; if (settleT > 0) return; settleT = 1.5;
  const w = game.world; if (!w.settle) return; const px = player.x, pz = player.z;
  for (const p of w.settle.plansNear(px - 90, pz - 90, px + 90, pz + 90)) {
    const d = Math.hypot(p.x - px, p.z - pz);
    if (!p.pending && !p.spawned && d < 90) { p.pending = p.mobs.slice(); p.spawned = true; }
    if (p.pending && p.pending.length) {
      p.pending = p.pending.filter((e) => {
        if (!w.isLoaded(Math.floor(e.x), Math.floor(e.z))) return true;
        let y = e.y; while (y < H - 2 && (SOLID[w.getBlock(Math.floor(e.x), Math.floor(y), Math.floor(e.z))] || SOLID[w.getBlock(Math.floor(e.x), Math.floor(y) + 1, Math.floor(e.z))])) y++;
        const m = ents.spawnMob(e.type, e.x, y + 0.01, e.z, { prof: e.prof, home: { x: e.x, z: e.z }, plan: p });
        if (m.def.villager) m.trades = makeTrades(m.prof);
        return false;
      });
    }
  }
  // reset settlements the player has left so they repopulate on return
  for (const [, p] of w.settle.plans) {
    if (!p || !p.spawned) continue;
    if (Math.hypot(p.x - px, p.z - pz) > 160 && !ents.mobs.some((m) => m.plan === p)) { p.spawned = false; p.pending = null; }
  }
  // announce arrival
  const here = w.settle.at(Math.floor(px), Math.floor(pz));
  if (here !== game.lastSettlement) { game.lastSettlement = here; if (here) toast((here.type === 'village' ? 'Village of ' : '') + here.name + (here.type === 'city' ? ' — population ' + (here.mobs.length * (here.town ? 320 : 1250)).toLocaleString() : ''), 2600); }
}
const TRADES = {
  farmer: [[[I.WHEAT, 20], [I.EMERALD, 1]], [[B.PUMPKIN, 6], [I.EMERALD, 1]], [[I.EMERALD, 1], [I.BREAD, 6]], [[I.EMERALD, 1], [I.APPLE, 4]], [[I.EMERALD, 1], [I.SEEDS, 12]]],
  librarian: [[[I.PAPER, 24], [I.EMERALD, 1]], [[I.EMERALD, 1], [I.BOOK, 2]], [[I.EMERALD, 2], [I.LAPIS, 4]], [[I.STICK, 32], [I.EMERALD, 1]], [[I.EMERALD, 1], [B.GLASS, 6]], [[I.EMERALD, 1], [B.TORCH, 12]], [[I.EMERALD, 4], [B.BOOKSHELF, 1]], [[I.EMERALD, 3], [B.LAMP, 2]]],
  smith: [[[I.COAL, 15], [I.EMERALD, 1]], [[I.IRON_INGOT, 4], [I.EMERALD, 1]], [[I.EMERALD, 3], [toolId(2, 0), 1]], [[I.EMERALD, 4], [toolId(2, 3), 1]], [[I.EMERALD, 14], [toolId(4, 0), 1]], [[I.DIAMOND, 1], [I.EMERALD, 3]]],
  cleric: [[[I.ROTTEN_FLESH, 24], [I.EMERALD, 1]], [[I.EMERALD, 1], [I.LAPIS, 2]], [[I.BONE, 12], [I.EMERALD, 1]], [[I.EMERALD, 1], [I.REDSTONE, 4]], [[I.EMERALD, 2], [B.GLOWSTONE, 1]], [[I.GOLD_INGOT, 3], [I.EMERALD, 1]]],
  butcher: [[[I.RAW_PORK, 10], [I.EMERALD, 1]], [[I.LEATHER, 6], [I.EMERALD, 1]], [[I.RAW_BEEF, 10], [I.EMERALD, 1]], [[I.EMERALD, 1], [I.STEAK, 5]], [[I.EMERALD, 1], [I.COOKED_PORK, 5]], [[I.COAL, 15], [I.EMERALD, 1]]],
  shepherd: [[[B.WOOL, 16], [I.EMERALD, 1]], [[I.EMERALD, 1], [B.RED_WOOL, 4]], [[I.EMERALD, 1], [B.BLUE_WOOL, 4]], [[I.EMERALD, 2], [B.BED, 1]], [[I.EMERALD, 1], [B.WOOL, 8]]],
  mason: [[[B.CLAY, 10], [I.EMERALD, 1]], [[B.STONE, 20], [I.EMERALD, 1]], [[I.EMERALD, 1], [B.BRICKS, 10]], [[I.EMERALD, 1], [B.WHITE_CONCRETE, 12]], [[I.EMERALD, 1], [B.WINDOW, 8]], [[I.EMERALD, 2], [B.TERRACOTTA, 12]]],
  nitwit: [],
  tech: [[[I.EMERALD, 6], [I.SMARTPHONE, 1]], [[I.EMERALD, 3], [I.CIRCUIT, 2]], [[I.EMERALD, 2], [I.BATTERY, 3]], [[I.EMERALD, 6], [B.COMPUTER, 1]], [[I.EMERALD, 4], [B.SOLAR_PANEL, 6]], [[I.EMERALD, 4], [B.LED_SCREEN, 4]], [[I.EMERALD, 18], [I.CAR, 1]], [[I.EMERALD, 8], [I.DRONE, 1]], [[I.REDSTONE, 12], [I.EMERALD, 1]]],
  citizen: [[[I.EMERALD, 2], [B.GLASS_BLUE, 12]], [[I.EMERALD, 2], [B.STEEL, 8]], [[I.EMERALD, 3], [B.TV, 1]], [[I.EMERALD, 1], [B.MARBLE, 8]], [[I.STEAK, 8], [I.EMERALD, 1]], [[I.EMERALD, 2], [B.TRAFFIC_LIGHT, 2]]],
  shopper: [[[I.EMERALD, 1], [I.BREAD, 6]], [[I.EMERALD, 2], [B.VENDING, 1]], [[I.EMERALD, 1], [B.RED_CONCRETE, 8]], [[I.EMERALD, 1], [B.BLUE_CONCRETE, 8]], [[I.GOLD_INGOT, 3], [I.EMERALD, 1]]],
  doctor: [[[I.ROTTEN_FLESH, 20], [I.EMERALD, 1]], [[I.EMERALD, 1], [I.APPLE, 6]], [[I.EMERALD, 1], [I.BREAD, 4]], [[I.EMERALD, 2], [B.HOSPITAL_SIGN, 2]], [[I.EMERALD, 4], [B.BED, 1]]],
  officer: [[[I.IRON_INGOT, 6], [I.EMERALD, 1]], [[I.EMERALD, 3], [toolId(2, 3), 1]], [[I.GUNPOWDER, 8], [I.EMERALD, 1]]],
  worker: [[[I.COAL, 15], [I.EMERALD, 1]], [[I.EMERALD, 1], [B.ORANGE_CONCRETE, 10]], [[I.EMERALD, 2], [B.STEEL_POLE, 8]], [[I.EMERALD, 3], [B.EV_CHARGER, 1]], [[I.EMERALD, 2], [B.HELIPAD, 8]]],
};
function makeTrades(prof) { return (TRADES[prof] || []).map(([cost, out]) => ({ cost, out, uses: 0, max: 8 + Math.floor(Math.random() * 5) })); }
game.makeTrades = makeTrades;
let furnaceUiT = 0;
function tickFurnaces(dt) {
  for (const [, t] of game.world.tiles) {
    if (t.type !== 'furnace') continue;
    const [inp, fuel, out] = t.slots;
    const res = inp ? SMELT[inp.id] : undefined;
    const canSmelt = res !== undefined && (!out || (out.id === res && out.count < maxStack(res)));
    if (t.burn > 0) t.burn -= dt;
    if (t.burn <= 0 && canSmelt && fuel && FUEL[fuel.id]) {
      t.burnMax = t.burn = FUEL[fuel.id] * 8; fuel.count--; if (fuel.count <= 0) t.slots[1] = null;
    }
    if (t.burn > 0 && canSmelt) {
      t.cook += dt;
      if (t.cook >= 8) { t.cook = 0; inp.count--; if (inp.count <= 0) t.slots[0] = null; if (out) out.count++; else t.slots[2] = { id: res, count: 1, dur: maxDur(res) }; }
    } else t.cook = Math.max(0, t.cook - dt * 2);
    const lit = t.burn > 0; const cur = game.world.getBlock(t.x, t.y, t.z);
    if (lit && cur === B.FURNACE) game.world.setBlock(t.x, t.y, t.z, B.LIT_FURNACE, game.world.getMeta(t.x, t.y, t.z));
    else if (!lit && cur === B.LIT_FURNACE) game.world.setBlock(t.x, t.y, t.z, B.FURNACE, game.world.getMeta(t.x, t.y, t.z));
  }
  furnaceUiT += dt; if (furnaceUiT > 0.25 && ui.screen === 'furnace' && !ui.pressing) { furnaceUiT = 0; const t = ui.tile; const sig = t ? JSON.stringify(t.slots) + '|' + Math.round(t.cook * 4) + '|' + Math.round((t.burnMax ? t.burn / t.burnMax : 0) * 10) : ''; if (sig !== ui._fsig) { ui._fsig = sig; ui.renderScreen(); } }
}

// ---------- spawning ----------
function maybeSpawnAnimals(c) {
  const r = mulberry32(c.cx * 73856093 ^ c.cz * 19349663 ^ game.seed);
  if (r() > 0.12) return;
  const type = ['pig', 'cow', 'sheep', 'chicken', 'sheep', 'pig'][Math.floor(r() * 6)];
  const n = 2 + Math.floor(r() * 3); const w = game.world;
  for (let i = 0; i < n; i++) {
    const x = c.cx * CS + Math.floor(r() * 16), z = c.cz * CS + Math.floor(r() * 16);
    const y = w.topSolid(x, z); if (w.getBlock(x, y, z) !== B.GRASS) continue;
    if (ents.mobs.filter((m) => m.def.passive && !m.def.villager).length > 30) return;
    ents.spawnMob(type, x + 0.5, y + 1, z + 0.5);
  }
}
let spawnT = 0;
function tickSpawning(dt) {
  spawnT -= dt; if (spawnT > 0) return; spawnT = 1;
  const w = game.world; if (w.type === 'nether') { tickNetherSpawning(); return; } if (w.type === 'end') { tickEndSpawning(); return; }
  tickStrongholdSpawners(); if (game.world.type === 'flat' && game.difficulty === 0) return;
  const hostile = ents.mobs.filter((m) => m.def.hostile).length;
  const cap = [0, 4, 8, 12][game.difficulty];
  if (hostile < cap) {
    for (let a = 0; a < 3; a++) {
      const ang = Math.random() * Math.PI * 2, d = 20 + Math.random() * 18;
      const x = Math.floor(player.x + Math.cos(ang) * d), z = Math.floor(player.z + Math.sin(ang) * d);
      if (!w.isLoaded(x, z)) continue;
      const top = w.topSolid(x, z);
      let y = -1;
      if (game.daylight < 0.45 && !game.inBed) { const g = w.getBlock(x, top, z); if (SOLID[g] && OPAQUE[g]) y = top + 1; }
      if (y < 0) {
        const yy = Math.floor(player.y + (Math.random() - 0.5) * 24);
        if (yy > 2 && yy < top - 3 && w.getBlock(x, yy, z) === 0 && w.getBlock(x, yy + 1, z) === 0 && SOLID[w.getBlock(x, yy - 1, z)] && OPAQUE[w.getBlock(x, yy - 1, z)]) y = yy;
      }
      if (y < 0) continue;
      let lit = false;
      for (let dx = -6; dx <= 6 && !lit; dx += 1) for (let dy = -3; dy <= 3 && !lit; dy++) for (let dz = -6; dz <= 6; dz++) if (EMIT[w.getBlock(x + dx, y + dy, z + dz)]) { lit = true; break; }
      if (lit) continue;
      const r = Math.random(); const type = r < 0.42 ? 'zombie' : r < 0.7 ? 'creeper' : r < 0.93 ? 'skeleton' : 'enderman';
      const typ2 = y < 40 && Math.random() < 0.22 ? 'slime' : type;
      ents.spawnMob(typ2, x + 0.5, y, z + 0.5); break;
    }
  }
  const passive = ents.mobs.filter((m) => m.def.passive && !m.def.villager).length;
  if (passive < 10 && game.daylight > 0.6 && Math.random() < 0.08 && game.world.type !== 'flat') {
    const ang = Math.random() * Math.PI * 2, d = 26 + Math.random() * 20;
    const x = Math.floor(player.x + Math.cos(ang) * d), z = Math.floor(player.z + Math.sin(ang) * d);
    if (w.isLoaded(x, z)) { const y = w.topSolid(x, z); if (w.getBlock(x, y, z) === B.GRASS || w.getBlock(x, y, z) === B.SNOW_GRASS) { const bio = w.column(x, z).biome; const wolfy = (bio === 1 || bio === 3) && Math.random() < 0.3; const t = wolfy ? 'wolf' : ['pig', 'cow', 'sheep', 'chicken'][Math.floor(Math.random() * 4)]; for (let i = 0; i < (wolfy ? 3 : 2); i++) ents.spawnMob(t, x + 0.5 + i, y + 1, z + 0.5); } }
  }
}

// ---------- input ----------
const keys = {};
const joy = { id: null, cx: 0, cy: 0, x: 0, y: 0 };
let look = null; // active look/break pointer
let jumpHeld = false, lastJumpTap = 0, sneakToggle = false;
const joyEl = $('joy'), knob = $('joy-knob');
function joyDefault() { joyEl.style.left = ''; joyEl.style.top = ''; joyEl.style.bottom = ''; knob.style.transform = ''; }
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('pointerdown', (e) => {
  initAudio();
  if (game.state !== 'playing' || game.paused || ui.screen || player.dead) return;
  e.preventDefault();
  if (e.pointerType === 'touch' && e.clientX < innerWidth * 0.38 && e.clientY > innerHeight * 0.3 && joy.id === null) {
    joy.id = e.pointerId; joy.cx = e.clientX; joy.cy = e.clientY; joy.x = joy.y = 0;
    const s = joyEl.offsetWidth; joyEl.style.left = (e.clientX - s / 2) + 'px'; joyEl.style.top = (e.clientY - s / 2) + 'px'; joyEl.style.bottom = 'auto';
    return;
  }
  if (e.pointerType === 'mouse' && e.button === 2) { useAt(e.clientX, e.clientY); return; }
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  if (look) return;
  look = { id: e.pointerId, lx: e.clientX, ly: e.clientY, px: e.clientX, py: e.clientY, t0: performance.now(), moved: 0, ax: e.clientX, ay: e.clientY, at: performance.now(), breaking: e.pointerType === 'mouse', mouse: e.pointerType === 'mouse', prog: 0, target: null, cd: 0 };
  if (look.mouse) look.mouseStartBreakAt = performance.now() + 140, look.breaking = false;
  try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
});
canvas.addEventListener('pointermove', (e) => {
  mouseX = e.clientX; mouseY = e.clientY;
  if (joy.id === e.pointerId) {
    const r = joyEl.offsetWidth * 0.36; let dx = e.clientX - joy.cx, dy = e.clientY - joy.cy; const d = Math.hypot(dx, dy);
    if (d > r) { dx = dx / d * r; dy = dy / d * r; }
    joy.x = dx / r; joy.y = dy / r; knob.style.transform = `translate(${dx}px, ${dy}px)`; return;
  }
  if (look && look.id === e.pointerId) {
    const dx = e.clientX - look.lx, dy = e.clientY - look.ly; look.lx = e.clientX; look.ly = e.clientY; look.px = e.clientX; look.py = e.clientY;
    const k = 0.0058 * settings.sens * (look.mouse ? 0.75 : 1);
    player.yaw -= dx * k; player.pitch = Math.max(-1.55, Math.min(1.55, player.pitch - dy * k));
    look.moved += Math.abs(dx) + Math.abs(dy);
    if (Math.hypot(e.clientX - look.ax, e.clientY - look.ay) > 14) { look.ax = e.clientX; look.ay = e.clientY; look.at = performance.now(); if (look.mouse) look.dragging = true; }
  }
});
let mouseX = innerWidth / 2, mouseY = innerHeight / 2;
function endPointer(e) {
  if (!e) { look = null; joy.id = null; joy.x = joy.y = 0; joyDefault(); crack.visible = false; $('breakring').classList.add('hidden'); return; }
  if (joy.id === e.pointerId) { joy.id = null; joy.x = joy.y = 0; joyDefault(); return; }
  if (look && look.id === e.pointerId) {
    const dt = performance.now() - look.t0;
    if (!look.breaking && dt < 300 && look.moved < 16 && !look.mouse) useAt(look.px, look.py);
    if (look && look.mouse && !look.breaking && !look.dragging && dt < 300) attackOnly(look.px, look.py);
    look = null; crack.visible = false; setCrack(0); $('breakring').classList.add('hidden');
  }
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('wheel', (e) => { if (game.state === 'playing' && !ui.screen) ui.select((game.inv.sel + (e.deltaY > 0 ? 1 : 8)) % 9); }, { passive: true });
function holdBtn(el, on, off) {
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); initAudio(); on(); el.classList.add('on'); try { el.setPointerCapture(e.pointerId); } catch (_) { /* */ } });
  const up = (e) => { e.preventDefault(); off && off(); if (el.id !== 'btn-sneak') el.classList.remove('on'); };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
}
holdBtn($('btn-jump'), () => {
  jumpHeld = true; const now = performance.now();
  if (game.mode === 'creative' && now - lastJumpTap < 320) { player.flying = !player.flying; player.vy = 0; toast(player.flying ? 'Flying' : 'Landed', 700); }
  lastJumpTap = now;
}, () => (jumpHeld = false));
holdBtn($('btn-sneak'), () => {
  if (player.flying) { keys.flyDown = true; return; }
  sneakToggle = !sneakToggle; $('btn-sneak').classList.toggle('on', sneakToggle);
}, () => { keys.flyDown = false; if (player.flying) $('btn-sneak').classList.remove('on'); else $('btn-sneak').classList.toggle('on', sneakToggle); });

addEventListener('keydown', (e) => {
  if (document.activeElement && document.activeElement.tagName === 'INPUT') { if (e.key === 'Escape') closeChat(); return; }
  initAudio();
  const k = e.key.toLowerCase(); keys[k] = true; if (e.code === 'Space') keys.space = true;
  if (game.state !== 'playing') return;
  if (k === 'escape') { if (ui.screen) ui.close(); else if (game.paused) resume(); else pause(); }
  if (k === 'e' && !game.paused) { if (ui.screen) ui.close(); else ui.openInventory(); }
  if ((k === 't' || k === '/') && !ui.screen && !game.paused) { e.preventDefault(); openChat(k === '/' ? '/' : ''); }
  if (k >= '1' && k <= '9' && !ui.screen) ui.select(parseInt(k, 10) - 1);
  if (k === 'f' && game.mode === 'creative') { player.flying = !player.flying; player.vy = 0; }
  if (k === 'q' && !ui.screen) dropHeld(e.ctrlKey);
  if (e.code === 'Space' && game.mode === 'creative' && !e.repeat) { const now = performance.now(); if (now - lastJumpTap < 300) { player.flying = !player.flying; player.vy = 0; } lastJumpTap = now; }
});
addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; if (e.code === 'Space') keys.space = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; jumpHeld = false; });

// ---------- picking ----------
const raycaster = new THREE.Raycaster(); const ndc = new THREE.Vector2();
function pick(sx, sy) {
  ndc.set((sx / innerWidth) * 2 - 1, -(sy / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const o = raycaster.ray.origin, d = raycaster.ray.direction;
  const reach = game.mode === 'creative' ? 7 : 5;
  const hit = game.world.raycast(o.x, o.y, o.z, d.x, d.y, d.z, reach, (id) => id !== 0 && !LIQUID[id]);
  const mob = ents.raycastMobs(o, d, reach - 1.5);
  const fb = ents.raycastFireballs(o, d, reach + 1);
  if (fb && (!hit || fb.t < hit.t) && (!mob || fb.t < mob.t)) return { fireball: fb.fireball, o, d };
  if (mob && (!hit || mob.t < hit.t)) return { mob: mob.mob, o, d };
  return hit ? { block: hit, o, d } : { o, d };
}
function pickLiquid(sx, sy) {
  ndc.set((sx / innerWidth) * 2 - 1, -(sy / innerHeight) * 2 + 1); raycaster.setFromCamera(ndc, camera);
  const o = raycaster.ray.origin, d = raycaster.ray.direction;
  return game.world.raycast(o.x, o.y, o.z, d.x, d.y, d.z, 5, (id, x, y, z) => (LIQUID[id] && game.world.getMeta(x, y, z) === 0) || (id !== 0 && !LIQUID[id]));
}
let swingT = 0;
function swing() { swingT = 0.28; }
function attackMob(m) {
  const held = game.inv.held(); const t = held ? toolInfo(held.id) : null;
  let dmg = 1; if (t) dmg = t.type === 'sword' ? 4 + t.dmg : t.type === 'axe' ? 3 + t.dmg : 2 + t.dmg * 0.5;
  dmg += enchLevel(held, 'sharpness') * 1.25;
  if (player.vy < -1 && !player.onGround) dmg *= 1.5; // crit
  if (game.mode === 'creative') dmg = 100;
  m.looting = enchLevel(held, 'looting');
  const fa = enchLevel(held, 'fire_aspect');
  if (ents.hurtMob(m, dmg, player.x, player.z, true, 1 + enchLevel(held, 'knockback') * 0.9)) {
    if (fa && !m.def.fireImmune) m.fireT = 4 * fa; if (t && game.mode === 'survival') game.inv.damageHeld(t.type === 'sword' ? 1 : 2); player.exh += 0.1; if (player.vy < -1) ents.burst(m.x, m.y + 1, m.z, [1, 1, 0.6], 8, 3, 0.08); }
  swing();
}
function attackOnly(sx, sy) { const p = pick(sx, sy); if (p.fireball) { ents.deflect(p.fireball, p.d); swing(); } else if (p.mob) attackMob(p.mob); else swing(); }
function facingMeta() {
  const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw); // forward
  if (Math.abs(fx) > Math.abs(fz)) return fx > 0 ? 3 : 1; return fz > 0 ? 2 : 0;
}
function useAt(sx, sy) {
  if (player.dead || player.riding) return;
  const p = pick(sx, sy); const held = game.inv.held(); const w = game.world;
  if (p.fireball) { ents.deflect(p.fireball, p.d); swing(); return; }
  { const ch = game.dim === 'overworld' ? vehicles.raycast(p.o, p.d, 6) : null;
    if (ch && (!p.block || ch.t < p.block.t) && (!p.mob || ch.t < 99)) {
      const c = ch.car; swing();
      if (player.sneaking && !c.ai) { vehicles.remove(c); if (game.mode === 'survival') { const left = game.inv.add(I.CAR, 1); if (left) game.dropFromPlayer(I.CAR, 1); } toast('Picked up the car'); return; }
      enterCar(c); return;
    } }
  { const bt = rayHitBoat(p.o, p.d, 5);
    if (bt && bt !== player.boat && !p.mob) {
      swing();
      if (player.sneaking) { scene.remove(bt.mesh); boats.splice(boats.indexOf(bt), 1); if (game.mode === 'survival') { const left = game.inv.add(I.BOAT, 1); if (left) game.dropFromPlayer(I.BOAT, 1); } toast('Picked up the boat'); return; }
      player.boat = bt; player.boatT = 0; toast('Joystick to row. Tap jump to leave the boat', 2600); return;
    } }
  if (held && isArmor(held.id)) { equipArmor(); return; }
  if (held && held.id === I.BOAT) {
    const o = p.o, d = p.d; const h = w.raycast(o.x, o.y, o.z, d.x, d.y, d.z, 6, (id) => id !== 0);
    if (!h) return; let bx = h.x + 0.5, bz = h.z + 0.5, by;
    if (w.getBlock(h.x, h.y, h.z) === B.WATER) { let y = h.y; while (w.getBlock(h.x, y + 1, h.z) === B.WATER) y++; by = y + 0.6; }
    else { bx = h.x + h.nx + 0.5; bz = h.z + h.nz + 0.5; by = h.y + h.ny + (h.ny === 1 ? 0 : 0.01); if (h.ny !== 1) return; }
    placeBoat(bx, by, bz); sfx.place(B.PLANKS); swing(); if (game.mode === 'survival') game.inv.consumeHeld(1); return;
  }
  if (held && held.id === I.FISHING_ROD) { castRod(sx, sy); return; }
  if (held && held.id === I.TRIDENT && !p.mob) { throwTrident(); return; }
  if (held && held.id === I.MILK_BUCKET) { sfx.eat(); swing(); player.fireT = 0; player.burnT = 0; if (game.mode === 'survival') { game.inv.slots[game.inv.sel] = { id: I.BUCKET, count: 1 }; game.inv.onChange(); } toast('You drank the milk. All effects cleared'); return; }
  if (held && held.id === I.SHIELD) { toast('Sneak while holding the shield to block attacks'); return; }
  if (held && p.block && p.block.id === B.CAMPFIRE && !p.mob && cookOnCampfire(p.block, held)) return;
  if (held && held.id === I.BOW) { shootBow(); return; }
  if (held && held.id === I.ELYTRA) { if (player.elytra) { const o = player.elytra; game.inv.slots[game.inv.sel] = { id: I.ELYTRA, count: 1, dur: o.dur, ench: o.ench }; } else game.inv.slots[game.inv.sel] = null; player.elytra = { dur: held.dur ?? maxDur(I.ELYTRA), ench: held.ench }; game.inv.onChange(); sfx.place(B.WOOL); setElytraBtn(); toast('Elytra equipped. Jump, then tap jump again in mid-air to glide', 3200); return; }
  if (held && held.id === I.FIREWORK) {
    if (player.gliding) { player.boostT = 1.6; sfx.firework(); if (game.mode === 'survival') game.inv.consumeHeld(1); return; }
    if (p.block) { const b = p.block; const x = b.x + 0.5, z = b.z + 0.5, y = b.y + 1; sfx.firework(); if (game.mode === 'survival') game.inv.consumeHeld(1); swing();
      const col = [[1, 0.3, 0.3], [0.3, 0.6, 1], [1, 0.9, 0.3], [0.5, 1, 0.4], [1, 0.4, 1]][Math.floor(Math.random() * 5)];
      for (let i = 0; i < 8; i++) setTimeout(() => ents.burst(x, y + i * 1.6, z, [1, 0.8, 0.4], 2, 0.3, 0.06, 0.5), i * 90);
      setTimeout(() => { ents.burst(x, y + 13, z, col, 60, 7, 0.14, 1.4); sfx.firework(); }, 800); }
    return;
  }
  if (held && held.id === I.ENDER_PEARL) {
    const d = p.d; const h = w.raycast(p.o.x, p.o.y, p.o.z, d.x, d.y, d.z, 40, (id) => id !== 0 && !LIQUID[id]);
    if (!h) { toast('Too far to throw'); return; }
    if (game.mode === 'survival') game.inv.consumeHeld(1); swing(); sfx.ender();
    const tx = h.x + h.nx + 0.5, tz = h.z + h.nz + 0.5; let ty = h.y + (h.ny === 1 ? 1 : h.ny); if (h.ny === 0) { while (ty > 1 && !SOLID[w.getBlock(Math.floor(tx), ty - 1, Math.floor(tz))]) ty--; }
    setTimeout(() => { teleportPlayer(tx, ty + 0.01, tz); if (game.mode === 'survival') { player.hurtCd = 0; game.damagePlayer(2, undefined, undefined, 'fall'); } }, 250); return;
  }
  if (held && held.id === I.EGG && !p.mob) {
    if (game.mode === 'survival') game.inv.consumeHeld(1); swing(); const b = p.block;
    const x = b ? b.x + b.nx + 0.5 : p.o.x + p.d.x * 8, y = b ? b.y + b.ny + 0.1 : p.o.y + p.d.y * 8, z = b ? b.z + b.nz + 0.5 : p.o.z + p.d.z * 8;
    ents.burst(x, y + 0.3, z, [0.95, 0.9, 0.75], 10, 2, 0.08);
    if (b && Math.random() < 0.125) { const m = ents.spawnMob('chicken', x, y, z, { baby: true }); if (m) { m.baby = true; m.growT = 600; } toast('A chick hatched'); }
    return;
  }
  if (held && held.id === I.EYE_OF_ENDER && !(p.block && p.block.id === B.END_FRAME)) { throwEye(); return; }
  if (held && held.id === I.EYE_OF_ENDER && p.block && p.block.id === B.END_FRAME) {
    const b = p.block; const meta = w.getMeta ? w.getMeta(b.x, b.y, b.z) : 0; game.setBlock(b.x, b.y, b.z, B.END_FRAME_EYE, meta); sfx.eye(); swing();
    if (game.mode === 'survival') game.inv.consumeHeld(1); checkEndPortal(b.x, b.y, b.z); return;
  }
  if (held && held.id === I.SMARTPHONE && !p.mob) { swing(); tech.phone(); return; }
  if (held && held.id === I.DRONE && !p.mob) { swing(); game.droneView = !game.droneView; toast(game.droneView ? 'Drone camera on — use the drone again to land' : 'Drone landed'); return; }
  if (held && held.id === I.CAR && p.block && game.dim === 'overworld') {
    const b = p.block; const x = b.x + b.nx + 0.5, z = b.z + b.nz + 0.5; const y = b.ny === 1 ? b.y + 1.01 : b.y + b.ny + 0.01;
    if (collides(w, x - 0.9, y, z - 0.9, x + 0.9, y + 1.5, z + 0.9)) { toast('Not enough space for a car'); return; }
    vehicles.place(x, y, z, player.yaw + Math.PI); if (game.mode === 'survival') game.inv.consumeHeld(1); sfx.place(B.IRON_BLOCK); swing(); return;
  }
  if (p.mob) {
    const m = p.mob;
    if (held && held.id === I.SHEARS && m.type === 'sheep') { if (!shearSheep(m)) toast('This sheep has no wool yet'); return; }
    if (held && held.id === I.BUCKET && m.type === 'cow' && !m.baby) { sfx.splash(); swing(); if (game.mode === 'survival') { if (held.count > 1) { held.count--; const l = game.inv.add(I.MILK_BUCKET, 1); if (l) game.dropFromPlayer(I.MILK_BUCKET, 1); } else game.inv.slots[game.inv.sel] = { id: I.MILK_BUCKET, count: 1 }; game.inv.onChange(); } else game.inv.add(I.MILK_BUCKET, 1); toast('Milk bucket'); return; }
    if (held && held.id === I.BONE && m.type === 'wolf' && !m.owner && !m.dead) {
      if (game.mode === 'survival') game.inv.consumeHeld(1); swing();
      if (Math.random() < 0.34) { m.owner = true; m.angry = 0; m.hp = m.maxHp = 20; if (m.model.g.userData.collar) m.model.g.userData.collar.visible = true; ents.hearts(m.x, m.y + m.h, m.z, 8); sfx.heart(); toast('Wolf tamed. It will follow you and fight for you'); }
      else ents.smoke(m.x, m.y + m.h, m.z, 6);
      return;
    }
    if (m.owner && m.type === 'wolf' && player.sneaking) { m.sitting = !m.sitting; toast(m.sitting ? 'Wolf is sitting' : 'Wolf is following'); return; }
    // feeding / breeding
    if (held && BREED_FOOD[m.type] === held.id && !m.baby && !m.dead) {
      if (m.breedCd > 0 && !m.def.villager) { toast('Not ready to breed yet'); return; }
      if (m.def.villager && m.breedCd > 0 && m.willing <= 0) { m.breedCd = 0; }
      m.willing = 30; m.lookP = 2; ents.hearts(m.x, m.y + m.h, m.z, 6); sfx.heart(); if (m.def.villager) sfx.villager(); else if (m.def.sound) sfx[m.def.sound]();
      if (game.mode === 'survival') game.inv.consumeHeld(1); swing(); return;
    }
    if (m.def.villager && m.baby && !player.sneaking) { sfx.villagerNo(); toast('Baby villagers cannot trade'); return; }
    if (m.def.villager && !player.sneaking) {
      if (!m.trades) m.trades = makeTrades(m.prof);
      m.lookP = 8; m.targetYaw = Math.atan2(player.x - m.x, player.z - m.z);
      if (!m.trades.length) { sfx.villagerNo(); toast('This villager has nothing to trade'); return; }
      sfx.villager(); ui.open('trade', { type: 'trade', mob: m }); return;
    }
    attackMob(m); return;
  }
  // food
  if (held && ITEMS[held.id] && ITEMS[held.id].food && game.mode === 'survival' && player.food < 20) {
    player.food = Math.min(20, player.food + ITEMS[held.id].food); player.sat = Math.min(player.food, player.sat + ITEMS[held.id].food * 0.6);
    const ate = held.id; game.inv.consumeHeld(1); sfx.eat(); setTimeout(() => sfx.burp(), 520); swing(); eatT = 0.5; if (ate === I.CHORUS_FRUIT) setTimeout(chorusTeleport, 300); return;
  }
  // buckets
  if (held && (held.id === I.BUCKET)) {
    const h = pickLiquid(sx, sy);
    if (h && LIQUID[h.id]) { game.setBlock(h.x, h.y, h.z, 0); sfx.splash(); if (game.mode === 'survival') { game.inv.consumeHeld(1); const left = game.inv.add(h.id === B.WATER ? I.WATER_BUCKET : I.LAVA_BUCKET, 1); if (left) game.dropFromPlayer(h.id === B.WATER ? I.WATER_BUCKET : I.LAVA_BUCKET, 1); } swing(); }
    return;
  }
  if (!p.block) { swing(); return; }
  const b = p.block; const bid = b.id;
  const sneaking = player.sneaking;
  const above = w.getBlock(b.x, b.y + 1, b.z);
  if (bid === B.BELL) { sfx.bell(); swing(); for (const m of ents.mobs) if (m.def.villager && Math.hypot(m.x - b.x, m.z - b.z) < 32) m.panic = 3; toast('The bell rings'); return; }
  if (held && held.id === I.HOE && (bid === B.GRASS || bid === B.DIRT || bid === B.PATH || bid === B.SNOW_GRASS) && (above === 0 || above === B.TALL_GRASS)) {
    if (above) game.setBlock(b.x, b.y + 1, b.z, 0);
    game.setBlock(b.x, b.y, b.z, B.FARMLAND); sfx.till(); swing(); if (game.mode === 'survival') game.inv.damageHeld(1); return;
  }
  if (held && isTool(held.id) && toolInfo(held.id).type === 'shovel' && bid === B.GRASS && above === 0) {
    game.setBlock(b.x, b.y, b.z, B.PATH); sfx.till(); swing(); if (game.mode === 'survival') game.inv.damageHeld(1); return;
  }
  if (held && held.id === I.SEEDS && bid === B.FARMLAND && above === 0) {
    game.setBlock(b.x, b.y + 1, b.z, B.WHEAT_0); w.crops.set(tkey(b.x, b.y + 1, b.z), [b.x, b.y + 1, b.z]); sfx.place(B.TALL_GRASS); swing();
    if (game.mode === 'survival') game.inv.consumeHeld(1); return;
  }
  if (held && held.id === I.BONE && isWheat(bid) && bid !== B.WHEAT_3) {
    w.setBlock(b.x, b.y, b.z, Math.min(B.WHEAT_3, bid + 1 + Math.floor(Math.random() * 2))); ents.burst(b.x + 0.5, b.y + 0.5, b.z + 0.5, [0.5, 1, 0.5], 10, 2, 0.08); swing();
    if (game.mode === 'survival') game.inv.consumeHeld(1); return;
  }
  if (held && held.id === I.FLINT_STEEL && bid === B.OBSIDIAN) {
    if (tryLightPortal(b.x + b.nx, b.y + b.ny, b.z + b.nz)) { if (game.mode === 'survival') game.inv.damageHeld(1); swing(); return; }
  }
  if (!sneaking) {
    if (bid === B.COMPUTER) { tech.computer('shop'); return; }
    if (bid === B.ELEVATOR) { tech.elevator(b); return; }
    if (bid === B.ATM) { tech.atm(b); return; }
    if (bid === B.VENDING) { tech.vending(); return; }
    if (bid === B.TV) { tech.tv(); return; }
    if (bid === B.SERVER_RACK) { toast('Server online · 99.99% uptime · 42 TB stored'); return; }
    if (bid === B.EV_CHARGER) { toast('Park an electric car next to a charger to recharge it'); return; }
    if (bid === B.SOLAR_PANEL) { toast('Solar panel output: ' + (game.daylight > 0.5 && !game.raining ? Math.round(game.daylight * 400) + ' W' : '0 W')); return; }
    if (bid === B.TABLE) { ui.open('table'); return; }
    if (bid === B.ENCHANT_TABLE) { ui.open('enchant', { type: 'enchant', slots: [null, null], shelves: countShelves(b.x, b.y, b.z), x: b.x, y: b.y, z: b.z }); for (let i = 0; i < 6; i++) setTimeout(() => ents.burst(b.x + 0.5 + (Math.random() - 0.5) * 3, b.y + 1.6, b.z + 0.5 + (Math.random() - 0.5) * 3, [0.75, 0.6, 1], 2, 0.6, 0.06, 1), i * 80); return; }
    if (bid === B.FURNACE || bid === B.LIT_FURNACE) { ui.open('furnace', getTile(b.x, b.y, b.z, 'furnace')); return; }
    if (bid === B.CHEST) { ui.open('chest', getTile(b.x, b.y, b.z, 'chest')); return; }
    if (bid === B.BED) { sleep(b); return; }
    if (bid === B.TNT && held && held.id === I.FLINT_STEEL) { game.world.setBlock(b.x, b.y, b.z, 0); ents.primeTNT(b.x, b.y, b.z); if (game.mode === 'survival') game.inv.damageHeld(1); swing(); return; }
    if (bid === B.TNT && (!held || !isBlock(held.id)) && game.mode === 'creative') { game.world.setBlock(b.x, b.y, b.z, 0); ents.primeTNT(b.x, b.y, b.z); swing(); return; }
  }
  if (!held) return;
  let placeId = null;
  if (isBlock(held.id)) placeId = held.id;
  else if (held.id === I.WATER_BUCKET) placeId = B.WATER;
  else if (held.id === I.LAVA_BUCKET) placeId = B.LAVA;
  if (!placeId) { swing(); return; }
  if (placeId === B.WATER && game.world.type === 'nether') {
    const tx0 = b.x + b.nx, ty0 = b.y + b.ny, tz0 = b.z + b.nz; sfx.fizz(); ents.smoke(tx0 + 0.5, ty0 + 0.5, tz0 + 0.5, 14); swing();
    if (game.mode === 'survival') { game.inv.slots[game.inv.sel] = { id: I.BUCKET, count: 1 }; game.inv.onChange(); }
    toast('The water evaporates'); return;
  }
  let tx = b.x + b.nx, ty = b.y + b.ny, tz = b.z + b.nz;
  if (REPLACEABLE.has(bid) && bid !== 0) { tx = b.x; ty = b.y; tz = b.z; }
  if (ty < 0 || ty >= H) return;
  const cur = w.getBlock(tx, ty, tz);
  if (!REPLACEABLE.has(cur)) return;
  const pb = BLOCKS[placeId];
  if (NEEDS_SUPPORT.has(placeId)) {
    const below = w.getBlock(tx, ty - 1, tz);
    if (placeId === B.TORCH || placeId === B.FENCE) { if (!SOLID[below]) return; }
    else if (isWheat(placeId)) { if (below !== B.FARMLAND) return; }
    else if (placeId === B.CACTUS) { if (below !== B.SAND && below !== B.CACTUS) return; }
    else if (placeId === B.SUGAR_CANE) {
      if (below !== B.SUGAR_CANE) {
        if (![B.GRASS, B.DIRT, B.SAND, B.SNOW_GRASS].includes(below)) return;
        if (![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => w.getBlock(tx + dx, ty - 1, tz + dz) === B.WATER)) { toast('Sugar cane needs water next to it'); return; }
      }
    }
    else if (placeId === B.CRIMSON_FUNGUS) { if (![B.CRIMSON_NYLIUM, B.NETHERRACK, B.GRASS, B.DIRT, B.SOUL_SOIL].includes(below)) return; }
    else if (![B.GRASS, B.DIRT, B.SNOW_GRASS, B.SAND].includes(below)) return;
  }
  if (pb.solid) {
    const pw = player.w; const e = 0.001;
    if (tx + 1 > player.x - pw + e && tx < player.x + pw - e && tz + 1 > player.z - pw + e && tz < player.z + pw - e && ty + 1 > player.y + e && ty < player.y + player.h - e) return;
    for (const m of ents.mobs) if (tx + 1 > m.x - m.w && tx < m.x + m.w && tz + 1 > m.z - m.w && tz < m.z + m.w && ty + 1 > m.y && ty < m.y + m.h) return;
  }
  let meta = pb.tiles && pb.tiles.front !== pb.tiles.side ? facingMeta() : 0;
  if (placeId === B.LADDER) {
    if (b.ny === 0) meta = b.nz === -1 ? 0 : b.nz === 1 ? 1 : b.nx === -1 ? 2 : 3;
    else { meta = { 3: 2, 1: 3, 2: 0, 0: 1 }[facingMeta()]; }
    const wall = [[0, 1], [0, -1], [1, 0], [-1, 0]][meta]; if (!SOLID[w.getBlock(tx + wall[0], ty, tz + wall[1])]) { toast('Ladders need a wall behind them'); return; }
  }
  game.setBlock(tx, ty, tz, placeId, meta);
  if (placeId === B.SUGAR_CANE) w.crops.set(tkey(tx, ty, tz), [tx, ty, tz]);
  sfx.place(placeId); swing(); game.stats.placed++;
  if (game.mode === 'survival') {
    if (held.id === I.WATER_BUCKET || held.id === I.LAVA_BUCKET) { game.inv.slots[game.inv.sel] = { id: I.BUCKET, count: 1 }; game.inv.onChange(); }
    else game.inv.consumeHeld(1);
  }
}
let eatT = 0;
function sleep(b) {
  if (game.world.type === 'nether') { game.world.setBlock(b.x, b.y, b.z, 0); game.explode(b.x + 0.5, b.y + 0.5, b.z + 0.5, 4); toast('Beds explode in the Nether'); return; }
  if (game.daylight > 0.45) { toast('You can only sleep at night'); player.spawn = { x: b.x + 0.5, y: b.y + 1, z: b.z + 0.5 }; return; }
  if (ents.mobs.some((m) => m.def.hostile && Math.hypot(m.x - player.x, m.z - player.z) < 9)) { toast('You may not rest now; there are monsters nearby'); return; }
  player.spawn = { x: b.x + 0.5, y: b.y + 1, z: b.z + 0.5 };
  game.inBed = true; $('sleep').classList.remove('hidden'); requestAnimationFrame(() => $('sleep').classList.add('on'));
  setTimeout(() => {
    game.ticks = Math.ceil(game.ticks / 24000) * 24000 + 200; game.raining = false; rain.visible = false;
    $('sleep').classList.remove('on'); setTimeout(() => { $('sleep').classList.add('hidden'); game.inBed = false; }, 1500);
    toast('Respawn point set', 1800);
  }, 2200);
}

// ---------- toast & chat ----------
let toastT = 0;
function toast(msg, ms = 1800) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms); }
function chatLog(msg) { const d = document.createElement('div'); d.textContent = msg; $('chat-log').appendChild(d); setTimeout(() => d.remove(), 8200); while ($('chat-log').children.length > 8) $('chat-log').firstChild.remove(); }
function openChat(prefill = '') { $('chat').classList.remove('hidden'); const inp = $('chat-input'); inp.value = prefill; inp.focus(); game.chatOpen = true; endPointer(); }
function closeChat() { $('chat').classList.add('hidden'); $('chat-input').blur(); game.chatOpen = false; }
$('btn-chat').addEventListener('pointerdown', (e) => { e.stopPropagation(); openChat(); });
$('chat-close').addEventListener('click', closeChat);
$('chat-form').addEventListener('submit', (e) => { e.preventDefault(); const v = $('chat-input').value.trim(); if (v) runCommand(v); closeChat(); });
const NAME_TO_ID = {};
for (const id of CREATIVE_LIST) NAME_TO_ID[itemName(id).toLowerCase().replace(/[^a-z0-9]+/g, '_')] = id;
function runCommand(v) {
  if (!v.startsWith('/')) { chatLog('<Steve> ' + v); return; }
  const [cmd, ...a] = v.slice(1).split(/\s+/);
  const c = cmd.toLowerCase();
  if (c === 'help') chatLog('Commands: /gamemode s|c, /time set day|night|noon|midnight, /weather clear|rain|thunder, /give <item> [n], /tp x y z, /summon pig|cow|sheep|chicken|wolf|cat|villager|iron_golem|zombie|creeper|skeleton|enderman|slime|zombified_piglin|ghast|blaze|magma_cube|ender_dragon|tnt, /locate village|town|city|windfarm|stronghold|fortress|end_city, /car [bus|police|taxi], /phone, /dim nether|end|overworld, /enchant <name> [level], /difficulty 0-3, /kill, /seed, /spawnpoint, /heal');
  else if (c === 'gamemode' || c === 'gm') { const m = (a[0] || '').toLowerCase(); setMode(m.startsWith('c') || m === '1' ? 'creative' : 'survival'); chatLog('Game mode set to ' + game.mode); }
  else if (c === 'time') { const t = (a[1] || a[0] || '').toLowerCase(); const map = { day: 1000, noon: 6000, sunset: 12000, night: 13500, midnight: 18000, sunrise: 23000 }; const base = Math.floor(game.ticks / 24000) * 24000; const n = map[t] ?? parseInt(t, 10); if (!isNaN(n)) { game.ticks = base + n; chatLog('Set the time to ' + t); } }
  else if (c === 'weather') { game.raining = (a[0] || '') === 'rain' || (a[0] || '') === 'thunder'; game.thunder = (a[0] || '') === 'thunder'; game.rainT = 600; boltT = 2; chatLog('Weather: ' + (game.thunder ? 'thunderstorm' : game.raining ? 'rain' : 'clear')); }
  else if (c === 'give') {
    const name = (a[0] || '').toLowerCase(); let id = NAME_TO_ID[name] ?? NAME_TO_ID[name.replace(/^minecraft:/, '')];
    if (id === undefined) id = Object.entries(NAME_TO_ID).find(([k]) => k.includes(name))?.[1];
    if (id === undefined) { chatLog('Unknown item: ' + name); return; }
    const n = Math.max(1, Math.min(640, parseInt(a[1] || '1', 10) || 1)); const left = game.inv.add(id, n); chatLog(`Gave ${n - left} ${itemName(id)}`);
  }
  else if (c === 'tp') { const [x, y, z] = a.map((s, i) => s.startsWith('~') ? [player.x, player.y, player.z][i] + (parseFloat(s.slice(1)) || 0) : parseFloat(s)); if ([x, y, z].every((q) => !isNaN(q))) { player.x = x; player.y = y; player.z = z; player.vy = 0; chatLog(`Teleported to ${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)}`); } }
  else if (c === 'summon') { const t = (a[0] || '').toLowerCase(); if (t === 'tnt') { ents.primeTNT(Math.floor(player.x - Math.sin(player.yaw) * 3), Math.floor(player.y), Math.floor(player.z - Math.cos(player.yaw) * 3)); chatLog('Summoned TNT'); } else if (MOBS[t]) { const fx = -Math.sin(player.yaw) * 3, fz = -Math.cos(player.yaw) * 3; ents.spawnMob(t, player.x + fx, player.y + 0.5, player.z + fz); if (t === 'ender_dragon') ents.endCenter = ents.endCenter || { x: player.x, y: player.y, z: player.z }; chatLog('Summoned ' + t); } else chatLog('Unknown mob'); }
  else if (c === 'dim' || c === 'dimension') {
    const t = (a[0] || '').toLowerCase(); const target = t.startsWith('n') ? 'nether' : t.startsWith('e') || t.includes('end') ? 'end' : 'overworld';
    if (target === game.dim) chatLog('Already in the ' + target); else { chatLog('Travelling to the ' + target); switchDim(target); }
  }
  else if (c === 'enchant') {
    const h = game.inv.held(); const key = (a[0] || '').toLowerCase(); const e = ENCH[key];
    if (!h || !enchKind(h.id)) chatLog('Hold a tool or sword to enchant');
    else if (!e || !e.on.includes(enchKind(h.id))) chatLog('Enchantments: ' + Object.keys(ENCH).join(', '));
    else { const lv = Math.max(1, Math.min(e.max, parseInt(a[1] || '1', 10) || 1)); h.ench = { ...(h.ench || {}), [key]: lv }; if (e.excl) delete h.ench[e.excl]; game.inv.onChange(); chatLog('Enchanted with ' + enchText({ [key]: lv })); }
  }
  else if (c === 'locate' && /^(stronghold|sh)/.test((a[0] || '').toLowerCase())) {
    if (game.dim !== 'overworld') chatLog('Strongholds are found in the Overworld');
    else { const f = strongholdNear(game.world, player.x, player.z); if (!f) chatLog('No stronghold nearby'); else chatLog(`Stronghold portal room at ${f.portal.x}, ${f.portal.y + 1}, ${f.portal.z} (${Math.round(Math.hypot(f.portal.x - player.x, f.portal.z - player.z))} blocks). Try /tp ${f.portal.x} ${f.portal.y + 1} ${f.portal.z - 4}`); }
  }
  else if (c === 'locate' && /^end/.test((a[0] || '').toLowerCase())) {
    if (game.dim !== 'end') chatLog('End cities are found in the outer End islands');
    else { const f = endCityNear(game.world, player.x, player.z); if (!f) chatLog('No end city nearby'); else chatLog(`End city at ${f.x}, ${f.y}, ${f.z} (${Math.round(Math.hypot(f.x - player.x, f.z - player.z))} blocks). Try /tp ${f.x} ${f.y + 2} ${f.z + 6}`); }
  }
  else if (c === 'locate' && (a[0] || '').toLowerCase().includes('fort')) {
    if (game.world.type !== 'nether') chatLog('Fortresses are found in the Nether');
    else { const f = fortressNear(game.world, player.x, player.z); if (!f) chatLog('No fortress nearby'); else chatLog(`Nether fortress at ${f.x}, ${f.y + 1}, ${f.z} (${Math.round(Math.hypot(f.x - player.x, f.z - player.z))} blocks). Try /tp ${f.x} ${f.y + 1} ${f.z}`); }
  }
  else if (c === 'locate') {
    if (!game.world.settle) { chatLog('There are no villages in this dimension'); return; }
    const t = (a[0] || 'village').toLowerCase().replace(/^minecraft:/, ''); const town = t.startsWith('t'); const type = t.startsWith('c') || town ? 'city' : (t.startsWith('w') || t.startsWith('e')) ? 'energy' : 'village';
    const p = town ? game.world.settle.nearest('city', player.x, player.z, 14, (q) => q.town) : game.world.settle.nearest(type, player.x, player.z, 14, (q) => type !== 'city' || !q.town);
    if (!p) chatLog('Could not find a ' + type + ' nearby');
    else { const d = Math.round(Math.hypot(p.x - player.x, p.z - player.z)); chatLog(`${type === 'village' ? 'Village of ' + p.name : p.name} is at ${p.x}, ${p.y + 2}, ${p.z} (${d} blocks away). Try /tp ${p.x} ${p.y + 2} ${p.z}`); }
  }
  else if (c === 'car') { if (game.dim !== 'overworld') { chatLog('Cars only work in the Overworld'); return; } const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw); const kind = ['bus', 'police', 'taxi'].includes(a[0]) ? a[0] : 'car'; vehicles.add({ x: player.x + fx * 4, y: player.y + 0.5, z: player.z + fz * 4, yaw: player.yaw + Math.PI, kind, owned: true, color: kind === 'taxi' ? 0xf0c020 : kind === 'bus' ? 0x2a7ad8 : kind === 'police' ? 0x1a2a6a : undefined }); chatLog('Spawned a ' + kind); }
  else if (c === 'phone') { tech.phone(); }
  else if (c === 'difficulty') { const d = parseInt(a[0], 10); if (d >= 0 && d <= 3) { game.difficulty = d; chatLog('Difficulty ' + ['Peaceful', 'Easy', 'Normal', 'Hard'][d]); } }
  else if (c === 'kill') { if (game.mode === 'survival') { player.hurtCd = 0; game.damagePlayer(999, undefined, undefined, 'void'); } }
  else if (c === 'seed') chatLog('Seed: ' + game.seedText);
  else if (c === 'spawnpoint') { player.spawn = { x: player.x, y: player.y, z: player.z }; chatLog('Spawn point set'); }
  else if (c === 'heal') { player.health = 20; player.food = 20; chatLog('Healed'); }
  else chatLog('Unknown command. Type /help');
}
function setMode(m) {
  game.mode = m; if (m === 'survival') player.flying = false;
  $('btn-mode').textContent = 'Mode: ' + (m === 'creative' ? 'Creative' : 'Survival');
  ui.lastStats = ''; ui.renderStats(player, game.mode);
}

// ---------- menus ----------
function show(id) { for (const s of ['title', 'create', 'howto', 'settings', 'loading']) $(s).classList.toggle('hidden', s !== id); }
let settingsReturn = 'title';
function pause() { if (game.state !== 'playing') return; game.paused = true; $('pause').classList.remove('hidden'); endPointer(); $('btn-mode').textContent = 'Mode: ' + (game.mode === 'creative' ? 'Creative' : 'Survival'); $('pause-info').textContent = `${game.worldName} · Seed ${game.seedText} · Day ${Math.floor(game.ticks / 24000) + 1}`; updateTimeBtn(); }
function resume() { game.paused = false; $('pause').classList.add('hidden'); }
function updateTimeBtn() { $('btn-time').textContent = game.daylight > 0.5 ? 'Set Night' : 'Set Day'; }
$('btn-pause').addEventListener('pointerdown', (e) => { e.stopPropagation(); pause(); });
$('btn-elytra').addEventListener('pointerdown', (e) => { e.stopPropagation(); if (!player.elytra) return; if (player.gliding) { player.gliding = false; return; } const o = player.elytra; const left = game.inv.add(I.ELYTRA, 1, o.dur, o.ench); if (left) game.dropFromPlayer(I.ELYTRA, 1, o.dur, o.ench); player.elytra = null; setElytraBtn(); toast('Elytra removed'); });
$('btn-exit-car').addEventListener('pointerdown', (e) => { e.stopPropagation(); exitCar(); });
$('btn-horn').addEventListener('pointerdown', (e) => { e.stopPropagation(); initAudio(); sfx.horn(); });
for (const id of ['device', 'car-hud', 'waypoint']) for (const ev of ['pointerdown', 'touchstart']) $(id).addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
$('btn-resume').onclick = resume;
$('btn-mode').onclick = () => { setMode(game.mode === 'creative' ? 'survival' : 'creative'); };
$('btn-time').onclick = () => { const base = Math.floor(game.ticks / 24000) * 24000; game.ticks = base + (game.daylight > 0.5 ? 13800 : 24000 + 1000); setTimeout(updateTimeBtn, 50); };
$('btn-quit').onclick = () => { resume(); toTitle(); };
$('btn-settings-pause').onclick = () => { settingsReturn = 'pause'; $('pause').classList.add('hidden'); show('settings'); };
$('btn-settings-title').onclick = () => { settingsReturn = 'title'; show('settings'); };
$('settings-back').onclick = () => { if (settingsReturn === 'pause') { $('settings').classList.add('hidden'); $('pause').classList.remove('hidden'); } else show('title'); };
$('btn-howto').onclick = () => show('howto');
document.querySelectorAll('[data-back]').forEach((b) => (b.onclick = () => show(b.dataset.back)));
$('btn-play').onclick = () => { initAudio(); show('create'); };
document.querySelectorAll('.seg').forEach((seg) => seg.addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return; seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
  const name = seg.dataset.name; if (name in settings) { settings[name] = parseFloat(b.dataset.v); applySettings(); }
}));
const segVal = (name) => seg(name).querySelector('.on').dataset.v; const seg = (name) => document.querySelector(`.seg[data-name="${name}"]`);
$('btn-create').onclick = () => {
  initAudio();
  newWorld({ seedText: $('world-seed').value.trim(), mode: segVal('mode'), difficulty: parseInt(segVal('difficulty'), 10), type: segVal('wtype'), name: $('world-name').value.trim() || 'My World' });
  startLoading('playing');
};
$('btn-respawn').onclick = () => { $('death').classList.add('hidden'); resetPlayer(); ui.lastStats = ''; if (game.dim !== 'overworld') switchDim('overworld', { respawn: true }); };
$('btn-death-quit').onclick = () => { $('death').classList.add('hidden'); resetPlayer(); if (game.dim !== 'overworld') { switchDim('overworld', { respawn: true }); finishArrival(); } toTitle(); };
function toTitle() {
  game.state = 'title'; $('hud').classList.add('hidden'); show('title'); ui.close(); closeChat();
  let cont = $('btn-continue');
  if (!cont) { cont = document.createElement('button'); cont.className = 'btn'; cont.id = 'btn-continue'; $('btn-play').after(cont); cont.onclick = () => { show(null); $('hud').classList.remove('hidden'); game.state = 'playing'; resize(); }; }
  cont.textContent = 'Continue: ' + game.worldName;
  $('btn-play').textContent = 'New World';
  titleCam.x = player.x; titleCam.z = player.z;
}
// settings UI
const ranges = { rd: ['s-rd', 'v-rd', (v) => v + ' chunks'], sens: ['s-sens', 'v-sens', (v) => Math.round(v * 100) + '%'], fov: ['s-fov', 'v-fov', (v) => v + '°'], bright: ['s-bright', 'v-bright', (v) => (v === 0 ? 'Moody' : v >= 1 ? 'Bright' : Math.round(v * 100) + '%')], music: ['s-music', 'v-music', (v) => Math.round(v * 100) + '%'], sfx: ['s-sfx', 'v-sfx', (v) => Math.round(v * 100) + '%'], ctrl: ['s-ctrl', 'v-ctrl', (v) => Math.round(v * 100) + '%'] };
for (const [k, [inp, lab, fmt]] of Object.entries(ranges)) {
  const el = $(inp); el.value = settings[k]; $(lab).textContent = fmt(settings[k]);
  el.addEventListener('input', () => { settings[k] = parseFloat(el.value); $(lab).textContent = fmt(settings[k]); applySettings(); });
}
for (const name of ['res', 'clouds', 'fps']) { const s = seg(name); s.querySelectorAll('button').forEach((b) => b.classList.toggle('on', parseFloat(b.dataset.v) === settings[name])); }
// add auto-jump toggle to settings
(() => {
  const f = document.createElement('div'); f.className = 'field'; f.innerHTML = '<span>Auto Jump</span><div class="seg" data-name="autojump"><button data-v="1">On</button><button data-v="0">Off</button></div>';
  $('settings').querySelector('.form').appendChild(f);
  const s = f.querySelector('.seg'); s.querySelectorAll('button').forEach((b) => b.classList.toggle('on', parseFloat(b.dataset.v) === settings.autojump));
  s.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; s.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); settings.autojump = parseFloat(b.dataset.v); });
})();
function applySettings() {
  camera.fov = settings.fov; camera.updateProjectionMatrix();
  uniforms.gamma.value = settings.bright;
  audioSettings.music = settings.music; audioSettings.sfx = settings.sfx; setVolumes();
  document.documentElement.style.setProperty('--s', settings.ctrl);
  $('fps').classList.toggle('hidden', !settings.fps);
  clouds.visible = !!settings.clouds;
  resize(); if (game.world) updateNeeds(true);
}

// ---------- loading ----------
let loadingTarget = 'title';
function startLoading(target) {
  loadingTarget = target; game.state = 'loading'; show('loading');
  $('hud').classList.add('hidden'); $('load-fill').style.width = '0%';
  updateNeeds(true);
}

// ---------- update ----------
const titleCam = { x: 0, z: 0, a: 0 };
let stepAcc = 0;
function updatePlayer(dt) {
  const w = game.world; const p = player;
  if (!w.isLoaded(Math.floor(p.x), Math.floor(p.z))) return; // wait for terrain
  if (p.riding) { if (!vehicles.list.includes(p.riding)) exitCar(); else { p.yaw = p.riding.yaw + Math.PI; p.sneaking = p.sprinting = false; p.inWater = p.inLava = p.headInWater = p.headInLava = false; return; } }
  const inputBlocked = ui.screen || game.chatOpen || game.inBed;
  if (p.boat) { updateBoatRide(dt, inputBlocked); return; }
  // input vector
  let mx = 0, mz = 0;
  if (!inputBlocked) {
    if (keys.w || keys.arrowup) mz -= 1; if (keys.s || keys.arrowdown) mz += 1; if (keys.a || keys.arrowleft) mx -= 1; if (keys.d || keys.arrowright) mx += 1;
    if (joy.id !== null) { mx += joy.x; mz += joy.y; }
  }
  const ml = Math.hypot(mx, mz); if (ml > 1) { mx /= ml; mz /= ml; }
  const jump = !inputBlocked && (jumpHeld || keys.space);
  p.sneaking = !inputBlocked && !p.flying && (keys.shift || sneakToggle);
  const wantSprint = !inputBlocked && (keys.control || (joy.id !== null && Math.hypot(joy.x, joy.y) > 0.94 && joy.y < -0.6)) && mz < -0.3;
  p.sprinting = wantSprint && !p.sneaking && (game.mode === 'creative' || p.food > 6);
  // environment
  const feet = w.getBlock(Math.floor(p.x), Math.floor(p.y + 0.1), Math.floor(p.z));
  const mid = w.getBlock(Math.floor(p.x), Math.floor(p.y + 0.9), Math.floor(p.z));
  const head = w.getBlock(Math.floor(p.x), Math.floor(p.y + 1.62), Math.floor(p.z));
  p.inWater = feet === B.WATER || mid === B.WATER; p.inLava = feet === B.LAVA || mid === B.LAVA; p.headInWater = head === B.WATER; p.headInLava = head === B.LAVA;
  const below = w.getBlock(Math.floor(p.x), Math.floor(p.y - 0.06), Math.floor(p.z));
  const inWeb = !p.flying && collidesId(w, p, B.COBWEB);
  const onLadder = !p.flying && !p.gliding && collidesId(w, p, B.LADDER);
  const icy = p.onGround && (below === B.ICE || below === B.PACKED_ICE);
  // speeds
  let speed = p.flying ? (p.sprinting ? 21 : 10.9) : p.sneaking ? 1.3 : p.sprinting ? 5.6 : 4.317;
  const ds = armorEnch(3, 'depth_strider');
  if ((p.inWater || p.inLava) && !p.flying) speed *= p.inLava ? 0.35 : 0.55 + ds * 0.15;
  if (p.onGround && !p.flying && below === B.SOUL_SAND) speed *= 0.45;
  if (p.onGround && !p.flying && below === B.SLIME) speed *= 0.7;
  if (icy) speed *= 1.15;
  if (inWeb) speed *= 0.15;
  if (eatT > 0) speed *= 0.4;
  const sy = Math.sin(p.yaw), cy = Math.cos(p.yaw);
  const tx = (mx * cy + mz * sy) * speed, tz = (-mx * sy + mz * cy) * speed;
  const accel = icy ? 1.4 : p.onGround || p.flying ? 12 : (p.inWater ? 6 : 3);
  p.vx += (tx - p.vx) * Math.min(1, dt * accel); p.vz += (tz - p.vz) * Math.min(1, dt * accel);
  if (p.flying) {
    const up = (jump ? 1 : 0) - ((keys.shift || keys.flyDown) ? 1 : 0);
    p.vy += (up * 8 - p.vy) * Math.min(1, dt * 10);
  } else if (p.inWater || p.inLava) {
    p.vy -= 10 * dt; p.vy *= 1 - dt * 3;
    if (jump) p.vy = Math.min(p.vy + 30 * dt, 3.6);
    p.vy = Math.max(p.vy, -3);
    if (p.fallStart !== null) p.fallStart = null;
    // flowing water pushes you along
    const fl = waterFlow(w, Math.floor(p.x), Math.floor(p.y + 0.1), Math.floor(p.z));
    if (fl) { p.vx += fl[0] * 9 * dt; p.vz += fl[1] * 9 * dt; if (fl[2]) p.vy -= 6 * dt; }
  } else if (onLadder) {
    p.vy -= 28 * dt;
    if (jump || (p._hitH && ml > 0.2)) p.vy = 3.2; else if (p.sneaking) p.vy = 0; else p.vy = Math.max(p.vy, -2.4);
    p.fallStart = null;
  } else if (p.gliding) {
    const cp = Math.cos(p.pitch); const lx = -Math.sin(p.yaw) * cp, lz = -Math.cos(p.yaw) * cp, ly = Math.sin(p.pitch);
    let gs = p.glideSpeed; gs += (-ly * 16 - gs * 0.08) * dt; if (p.boostT > 0) { p.boostT -= dt; gs += (30 - gs) * Math.min(1, dt * 3); if (Math.random() < dt * 30) ents.burst(p.x, p.y + 0.4, p.z, [1, 0.8, 0.5], 1, 0.4, 0.08, 0.4); }
    gs = Math.max(0, Math.min(gs, 40)); p.glideSpeed = gs;
    const stall = Math.max(0, 1 - gs / 6);
    p.vx += (lx * gs - p.vx) * Math.min(1, dt * 4); p.vz += (lz * gs - p.vz) * Math.min(1, dt * 4);
    const tvy = ly * gs - 1.2 - stall * 10; p.vy += (tvy - p.vy) * Math.min(1, dt * 3);
    p.glideDurT = (p.glideDurT || 0) + dt; if (p.glideDurT > 1 && game.mode === 'survival' && p.elytra) { p.glideDurT = 0; p.elytra.dur = (p.elytra.dur ?? 432) - (enchLevel(p.elytra, 'unbreaking') && Math.random() < 0.5 ? 0 : 1); if (p.elytra.dur <= 1) { p.gliding = false; toast('Your elytra is broken. Repair it with phantom... or craft a new one'); } }
    p.fallStart = null;
    if (jump && !p._jumpPrev && p.glideT > 0.4) p.gliding = false;
    p.glideT = (p.glideT || 0) + dt;
  } else {
    p.vy -= 28 * dt; p.vy = Math.max(p.vy, -60);
    if (jump && !p._jumpPrev && !p.onGround && p.elytra && (p.elytra.dur ?? 2) > 1 && p.vy < 4 && !p.riding) { p.gliding = true; p.glideT = 0; p.glideSpeed = Math.max(6, Math.hypot(p.vx, p.vz, p.vy)); sfx.ender && sfx.place(B.WOOL); }
    if (inWeb) { p.vy = Math.max(-1, Math.min(p.vy, 1)); p.fallStart = null; }
    if (jump && p.onGround) { p.vy = (below === B.HAY || below === B.SOUL_SAND) ? 7.6 : 8.4; p.exh += p.sprinting ? 0.2 : 0.05; if (p.sprinting) { p.vx += -sy * 2; p.vz += -cy * 2; } }
  }
  // sneak edge guard
  let dx = p.vx * dt, dz = p.vz * dt;
  if (p.sneaking && p.onGround) {
    const ground = (x, z) => collides(w, x - p.w, p.y - 0.6, z - p.w, x + p.w, p.y - 0.01, z + p.w);
    if (!ground(p.x + dx, p.z)) { dx = 0; p.vx = 0; }
    if (!ground(p.x + dx, p.z + dz)) { dz = 0; p.vz = 0; }
  }
  const wasGround = p.onGround; const vyBefore = p.vy; const oy = p.y;
  p.stepH = p.sneaking ? 0.6 : 0.6;
  const hit = moveEntity(w, p, dx, p.vy * dt, dz);
  p._hitH = hit.hitX || hit.hitZ;
  // slime blocks bounce you back up
  const landOn = w.getBlock(Math.floor(p.x), Math.floor(p.y - 0.06), Math.floor(p.z));
  if (p.onGround && !wasGround && landOn === B.SLIME && vyBefore < -3 && !p.sneaking) { p.vy = -vyBefore * 0.82; p.onGround = false; p.fallStart = p.y; sfx.bounce(); }
  // campfires and magma burn your feet
  if (p.onGround && (landOn === B.CAMPFIRE || landOn === B.MAGMA) && !p.sneaking && game.mode === 'survival' && p.hurtCd <= 0) game.damagePlayer(1, undefined, undefined, 'fire');
  // auto-jump
  if ((hit.hitX || hit.hitZ) && p.onGround && (settings.autojump || p.inWater) && ml > 0.2 && !p.sneaking) {
    const fx = Math.floor(p.x + Math.sign(p.vx || tx) * 0.6), fz = Math.floor(p.z + Math.sign(p.vz || tz) * 0.6);
    const fy = Math.floor(p.y + 0.1);
    if (!SOLID[w.getBlock(fx, fy + 1, fz)] && !SOLID[w.getBlock(fx, fy + 2, fz)] && !SOLID[w.getBlock(Math.floor(p.x), fy + 2, Math.floor(p.z))]) p.vy = 8.4;
  }
  if ((hit.hitX || hit.hitZ) && p.inWater && jump) p.vy = 5;
  if (p.gliding) {
    if ((hit.hitX || hit.hitZ) && p.glideSpeed > 12 && game.mode === 'survival') { p.hurtCd = 0; game.damagePlayer(Math.floor((p.glideSpeed - 10) * 0.5), undefined, undefined, 'kinetic'); p.glideSpeed *= 0.3; }
    if (p.onGround || p.inWater || p.inLava || p.flying) { p.gliding = false; p.boostT = 0; }
  }
  p._jumpPrev = jump;
  // fall damage
  if (!p.onGround && !p.flying && !p.inWater) { if (p.fallStart === null || p.y > p.fallStart) p.fallStart = Math.max(p.fallStart ?? p.y, p.y); }
  if (p.onGround && !wasGround) {
    if (p.fallStart !== null && game.mode === 'survival' && landOn !== B.SLIME && !inWeb) { const fd = p.fallStart - p.y; if (fd > 3.4) { let fdm = Math.floor(fd - 3); if (landOn === B.HAY) fdm = Math.floor(fdm * 0.2); else if (landOn === B.WOOL || landOn === B.BED) fdm = Math.floor(fdm * 0.5); if (fdm > 0) { p.hurtCd = 0; game.damagePlayer(fdm, undefined, undefined, 'fall'); } } }
    p.fallStart = null; if (vyBefore < -6) sfx.step(w.getBlock(Math.floor(p.x), Math.floor(p.y - 0.5), Math.floor(p.z)));
  }
  if (p.flying && p.onGround && game.mode === 'creative' && vyBefore < -0.5) { p.flying = false; }
  if (p.flying) p.fallStart = null;
  // steps + bob
  const hs = Math.hypot(p.x - (p._lx ?? p.x), p.z - (p._lz ?? p.z)); p._lx = p.x; p._lz = p.z;
  if (p.onGround && !p.flying) { p.stepDist += hs; p.bob += hs * 2.2; stepAcc += hs; if (stepAcc > 1.7) { stepAcc = 0; sfx.step(w.getBlock(Math.floor(p.x), Math.floor(p.y - 0.5), Math.floor(p.z))); } }
  if (game.mode === 'survival') p.exh += hs * (p.sprinting ? 0.1 : 0.0) + (p.inWater ? hs * 0.01 : 0);
  void oy;
  // end portal
  if (collidesId(w, p, B.END_PORTAL) && !p.portalCd) {
    portalFx.style.opacity = 0;
    if (game.dim === 'overworld' || game.dim === 'nether') { switchDim('end'); return; }
    if (game.dim === 'end') {
      const r = Math.hypot(p.x, p.z);
      if (r < 20) { switchDim('overworld', { fromEnd: true }); return; }
      if (r < 200) { switchDim('end', { outer: true }); return; }
      switchDim('end', {}); return;
    }
  }
  // nether portal
  if (collidesId(w, p, B.PORTAL)) {
    if (!p.portalCd) {
      if (p.portalT === 0) sfx.portal();
      p.portalT += dt; const need = game.mode === 'creative' ? 1 : 4;
      portalFx.style.opacity = Math.min(1, p.portalT / need) * 0.9;
      if (p.portalT >= need) { portalFx.style.opacity = 0; switchDim(game.dim === 'nether' ? 'overworld' : 'nether'); return; }
    }
  } else { p.portalCd = false; if (p.portalT) { p.portalT = 0; portalFx.style.opacity = 0; } }
  // hazards
  p.hurtCd = Math.max(0, p.hurtCd - dt);
  if (game.mode === 'survival' && !p.dead) {
    if (p.inLava) { p.lavaT -= dt; if (p.lavaT <= 0) { p.lavaT = 0.5; p.hurtCd = 0; game.damagePlayer(4, undefined, undefined, 'lava'); } }
    if (p.y < -8) { p.lavaT -= dt; if (p.lavaT <= 0) { p.lavaT = 0.5; p.hurtCd = 0; game.damagePlayer(4, undefined, undefined, 'void'); } }
    // cactus
    if (collidesId(w, p, B.CACTUS)) { if (p.hurtCd <= 0) game.damagePlayer(1, undefined, undefined, 'cactus'); }
    // air
    if (p.headInWater) { p.air -= dt * 20 / (1 + armorEnch(0, 'respiration')); if (p.air <= 0) { p.air = 0; p.drownT = (p.drownT || 0) - dt; if (p.drownT <= 0) { p.drownT = 1; p.hurtCd = 0; game.damagePlayer(2, undefined, undefined, 'drown'); } } }
    else p.air = Math.min(300, p.air + dt * 100);
    // hunger
    if (p.exh >= 4) { p.exh -= 4; if (p.sat > 0) p.sat = Math.max(0, p.sat - 1); else if (game.difficulty > 0) p.food = Math.max(0, p.food - 1); }
    p.regenT += dt;
    if (p.food >= 18 && p.health < 20 && p.regenT > (p.food >= 20 && p.sat > 0 ? 0.5 : 4)) { p.regenT = 0; p.health = Math.min(20, p.health + 1); p.exh += 6; }
    if (game.difficulty === 0 && p.regenT > 1) { p.regenT = 0; p.health = Math.min(20, p.health + 1); p.food = Math.min(20, p.food + 1); }
    if (p.food <= 0) { p.starveT += dt; if (p.starveT > 4) { p.starveT = 0; const floor = [20, 10, 1, 0][game.difficulty]; if (p.health > floor) { p.hurtCd = 0; game.damagePlayer(1, undefined, undefined, 'starve'); } } }
  } else { p.air = 300; }
  eatT = Math.max(0, eatT - dt);
}
function collidesId(w, e, id) {
  for (let x = Math.floor(e.x - e.w - 0.05); x <= Math.floor(e.x + e.w + 0.05); x++) for (let y = Math.floor(e.y); y <= Math.floor(e.y + e.h); y++) for (let z = Math.floor(e.z - e.w - 0.05); z <= Math.floor(e.z + e.w + 0.05); z++) if (w.getBlock(x, y, z) === id) return true;
  return false;
}
let breakSoundT = 0;
function updateBreaking(dt) {
  if (!look || ui.screen || player.dead || player.riding) { crack.visible = false; return; }
  const now = performance.now();
  if (!look.breaking) {
    if (look.mouse) { if (now > look.mouseStartBreakAt && !look.dragging) look.breaking = true; }
    else if (now - look.at > 300) look.breaking = true;
    if (!look.breaking) return;
  }
  const p = pick(look.px, look.py);
  look.cd -= dt;
  if (p.fireball) { crack.visible = false; if (look.cd <= 0) { ents.deflect(p.fireball, p.d); swing(); look.cd = 0.3; } return; }
  if (p.mob) { crack.visible = false; if (look.cd <= 0) { attackMob(p.mob); look.cd = 0.5; } return; }
  if (!p.block) { crack.visible = false; look.target = null; $('breakring').classList.add('hidden'); return; }
  const b = p.block; const key = tkey(b.x, b.y, b.z);
  if (look.target !== key) { look.target = key; look.prog = 0; }
  if (game.mode === 'creative') {
    if (look.cd <= 0) { breakBlock(b.x, b.y, b.z); look.cd = 0.22; }
    return;
  }
  const t = breakTime(b.id, game.inv.held()); if (!isFinite(t)) return;
  look.prog += dt / t;
  breakSoundT -= dt; if (breakSoundT <= 0) { breakSoundT = 0.24; sfx.dig(b.id); swing(); ents.burst(b.x + 0.5, b.y + 0.5, b.z + 0.5, BLOCKS[b.id].avgColor, 2, 2, 0.08, 0.4); }
  crack.visible = true; crack.position.set(b.x + 0.5, b.y + 0.5, b.z + 0.5); setCrack(Math.min(9, Math.floor(look.prog * 10)));
  if (isTouch) { const r = $('breakring'); r.classList.remove('hidden'); r.style.left = look.px + 'px'; r.style.top = (look.py - 60) + 'px'; r.style.setProperty('--p', Math.min(1, look.prog)); }
  if (look.prog >= 1) { breakBlock(b.x, b.y, b.z); look.prog = 0; look.target = null; crack.visible = false; $('breakring').classList.add('hidden'); }
}
function updateOutline() {
  let sx, sy;
  if (look) { sx = look.px; sy = look.py; } else if (!isTouch) { sx = mouseX; sy = mouseY; } else { outline.visible = false; return; }
  if (ui.screen || game.paused) { outline.visible = false; return; }
  const p = pick(sx, sy);
  if (p.block) { outline.visible = true; const id = p.block.id; const sh = BLOCKS[id].shape; outline.position.set(p.block.x + 0.5, p.block.y + (sh === 'slab' ? 0.28 : sh === 'table' ? 0.375 : 0.5), p.block.z + 0.5); outline.scale.set(sh === 'torch' ? 0.2 : sh === 'cross' ? 0.8 : 1, sh === 'slab' ? 0.5625 : sh === 'table' ? 0.75 : sh === 'torch' ? 0.65 : 1, sh === 'torch' ? 0.2 : sh === 'cross' ? 0.8 : 1); if (sh === 'torch') outline.position.y = p.block.y + 0.33; }
  else outline.visible = false;
}
const skyDay = new THREE.Color(0x78a7ff), skyNight = new THREE.Color(0x070a14), fogDay = new THREE.Color(0xb8d4ff), sunset = new THREE.Color(0xf08850), tmpC = new THREE.Color(), rainSky = new THREE.Color(0x6a7a90);
function updateSky(dt, camPos) {
  const dayTime = ((game.ticks % 24000) + 24000) % 24000;
  const ang = dayTime / 24000 * Math.PI * 2; const sunH = Math.sin(ang);
  const t = THREE.MathUtils.smoothstep(sunH, -0.22, 0.25);
  let dl = 0.16 + 0.84 * t; if (game.raining) dl *= game.thunder ? 0.5 : 0.72; if (flashT > 0) dl = Math.min(1, dl + flashT * 2);
  game.daylight = dl; uniforms.daylight.value = dl;
  const sky = tmpC.copy(skyNight).lerp(game.raining ? rainSky : skyDay, t);
  const fog = new THREE.Color().copy(skyNight).lerp(game.raining ? rainSky : fogDay, t);
  const ss = Math.max(0, 1 - Math.abs(sunH) * 4.5) * (game.raining ? 0.3 : 1);
  fog.lerp(sunset, ss * 0.55);
  // underwater
  const p = player; let fNear = settings.rd * CS * 0.62, fFar = settings.rd * CS * 0.95;
  if (game.state === 'playing' && p.headInWater) { fog.setRGB(0.05 * dl + 0.02, 0.12 * dl + 0.03, 0.45 * dl + 0.06); fNear = 0; fFar = 18; }
  if (game.state === 'playing' && p.headInLava) { fog.setRGB(0.9, 0.3, 0.02); fNear = 0; fFar = 2.5; }
  scene.background = sky.clone().lerp(fog, 0.25);
  uniforms.fogColor.value.copy(fog); uniforms.fogNear.value = fNear; uniforms.fogFar.value = fFar;
  uniforms.skyTint.value.setRGB(1, 1 - ss * 0.12, 1 - ss * 0.25);
  const nether = game.world && game.world.type === 'nether';
  uniforms.ambCol.value.setRGB(0, 0, 0);
  if (nether) {
    const nf = new THREE.Color(0x3a0c08); game.daylight = 0.3; uniforms.daylight.value = 0;
    if (!(game.state === 'playing' && (p.headInLava))) { uniforms.fogColor.value.copy(nf); uniforms.fogNear.value = settings.rd * CS * 0.25; uniforms.fogFar.value = settings.rd * CS * 0.85; }
    scene.background = nf; uniforms.ambCol.value.setRGB(0.34 + settings.bright * 0.12, 0.2 + settings.bright * 0.08, 0.17 + settings.bright * 0.06);
    uniforms.skyTint.value.setRGB(1, 1, 1);
  }
  const isEnd = game.world && game.world.type === 'end';
  if (isEnd) {
    const ef = new THREE.Color(0x150e1e); game.daylight = 0.35; uniforms.daylight.value = 0;
    uniforms.fogColor.value.copy(ef); uniforms.fogNear.value = settings.rd * CS * 0.35; uniforms.fogFar.value = settings.rd * CS * 0.95;
    scene.background = ef; uniforms.ambCol.value.setRGB(0.42 + settings.bright * 0.12, 0.38 + settings.bright * 0.1, 0.5 + settings.bright * 0.12);
    uniforms.skyTint.value.setRGB(1, 1, 1);
  }
  skyGroup.visible = !nether && !isEnd; clouds.visible = !!settings.clouds && !nether && !isEnd;
  skyGroup.position.copy(camPos);
  const dir = new THREE.Vector3(Math.cos(ang), Math.sin(ang), 0.15).normalize();
  sun.position.copy(dir).multiplyScalar(400); sun.lookAt(camPos); sun.visible = !game.raining;
  moon.position.copy(dir).multiplyScalar(-400); moon.lookAt(camPos); moon.visible = !game.raining;
  sun.quaternion.copy(camera.quaternion); moon.quaternion.copy(camera.quaternion);
  sun.lookAt(skyGroup.position); moon.lookAt(skyGroup.position);
  stars.material.opacity = Math.max(0, 1 - t * 1.6) * (game.raining ? 0 : 0.9);
  sunLight.position.copy(camPos).addScaledVector(dir.y > 0 ? dir : dir.clone().negate(), 50); sunLight.target.position.copy(camPos);
  sunLight.intensity = 0.55 * dl; ambient.intensity = 0.25 + 0.6 * dl;
  handAmb.intensity = 0.35 + 0.6 * dl;
  if (nether || isEnd) { sunLight.intensity = 0.15; ambient.intensity = 0.6; handAmb.intensity = 0.7; }
  // clouds
  const size = Math.max(400, settings.rd * CS * 4); clouds.scale.set(size, size, 1);
  clouds.position.set(camPos.x, 150, camPos.z);
  const cell = 12 * 64; cloudU.rep.value = size / cell;
  cloudU.off.value.set(((camPos.x + game.ticks * 0.03) / cell) - cloudU.rep.value / 2, (-camPos.z / cell) - cloudU.rep.value / 2);
  cloudU.col.value.setRGB(0.25 + 0.75 * dl, 0.25 + 0.75 * dl, 0.28 + 0.72 * dl); cloudU.fadeR.value = size / 2;
  if (game.raining) cloudU.col.value.multiplyScalar(0.7);
  // rain
  rain.visible = game.raining && game.state === 'playing' && !nether && !isEnd;
  if (rain.visible) {
    const arr = rainGeo.attributes.position.array;
    for (let i = 0; i < RAIN_N; i++) {
      const d = drops[i];
      d.y -= dt * 22;
      if (d.y < d.floor || d.y < camPos.y - 14) {
        d.x = camPos.x + (Math.random() - 0.5) * 36; d.z = camPos.z + (Math.random() - 0.5) * 36; d.y = camPos.y + 8 + Math.random() * 10;
        d.floor = game.world.topSolid(Math.floor(d.x), Math.floor(d.z)) + 1;
        if (d.floor > d.y) d.y = -999;
      }
      arr[i * 6] = d.x; arr[i * 6 + 1] = d.y; arr[i * 6 + 2] = d.z; arr[i * 6 + 3] = d.x; arr[i * 6 + 4] = d.y + 0.6; arr[i * 6 + 5] = d.z;
    }
    rainGeo.attributes.position.needsUpdate = true;
    rain.material.color.setRGB(0.4 + 0.4 * dl, 0.5 + 0.4 * dl, 0.7 + 0.3 * dl);
  }
}
function updateHand(dt) {
  swingT = Math.max(0, swingT - dt);
  const s = swingT > 0 ? Math.sin((1 - swingT / 0.28) * Math.PI) : 0;
  const bob = player.onGround ? Math.sin(player.bob) * 0.025 : 0, bob2 = player.onGround ? Math.abs(Math.cos(player.bob)) * 0.02 : 0;
  const eat = eatT > 0 ? Math.sin(eatT * 40) * 0.03 : 0;
  hand.position.set(0.42 + bob - s * 0.18, -0.38 - bob2 + s * 0.08 + eat + (eatT > 0 ? 0.15 : 0), -0.62 - s * 0.12);
  hand.rotation.set(-s * 0.9, -0.15 - s * 0.3, -s * 0.2);
}
let fpsAcc = 0, fpsN = 0, coordsT = 0;
function update(dt) {
  if (!game.world) return;
  if (game.state === 'loading') {
    streamChunks(40);
    const f = loadedFraction(Math.min(2, settings.rd)); $('load-fill').style.width = Math.round(f * 100) + '%';
    if (loadingTarget === 'dim') { if (f >= 1) finishArrival(); return; }
    $('load-text').textContent = f < 1 ? 'Generating terrain… ' + Math.round(f * 100) + '%' : 'Spawning…';
    if (f >= 1) {
      if (loadingTarget === 'playing') {
        // fix spawn height after terrain exists
        { const w = game.world, bx = Math.floor(player.spawn.x), bz = Math.floor(player.spawn.z); let best = null;
          for (let r = 0; r < 24 && !best; r++) for (let dx = -r; dx <= r && !best; dx++) for (let dz = -r; dz <= r && !best; dz++) {
            if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue; const x = bx + dx, z = bz + dz; if (!w.isLoaded(x, z)) continue;
            const t = w.topSolid(x, z); const id = w.getBlock(x, t, z);
            if (([B.GRASS, B.SAND, B.SNOW_GRASS, B.DIRT, B.STONE].includes(id) || (game.spawnCity && [B.SMOOTH_STONE, B.ASPHALT, B.MARBLE].includes(id))) && w.getBlock(x, t + 1, z) !== B.WATER) best = { x, y: t, z };
          }
          if (!best) best = { x: bx, y: w.topSolid(bx, bz), z: bz };
          for (let y = best.y + 1; y < best.y + 3; y++) if (!LIQUID[w.getBlock(best.x, y, best.z)]) w.setBlock(best.x, y, best.z, 0);
          player.spawn = { x: best.x + 0.5, y: best.y + 1.01, z: best.z + 0.5 }; Object.assign(player, { x: player.spawn.x, y: player.spawn.y, z: player.spawn.z }); }
        if (player.y < 1) player.y = 40;
        show(null); $('hud').classList.remove('hidden'); game.state = 'playing'; ui.lastStats = ''; ui.renderStats(player, game.mode); setMode(game.mode);
        // initial animals around spawn
        for (const [, c] of game.world.chunks) if (c.built && Math.abs(c.cx * 16 - player.x) < 40 && Math.abs(c.cz * 16 - player.z) < 40) maybeSpawnAnimals(c);
        toast(game.worldName, 2000); resize();
      } else { game.state = 'title'; show('title'); }
    }
    return;
  }
  if (game.state === 'title') {
    titleCam.a += dt * 0.05; player.yaw = titleCam.a; player.pitch = -0.12;
    const top = game.world.isLoaded(Math.floor(titleCam.x), Math.floor(titleCam.z)) ? game.world.topSolid(Math.floor(titleCam.x), Math.floor(titleCam.z)) : 40;
    player.x = titleCam.x; player.z = titleCam.z; player.y += ((Math.max(top, SEA) + 6) - player.y) * Math.min(1, dt);
    game.ticks += dt * 20 * 4;
    needT -= dt; if (needT < 0) { needT = 0.5; updateNeeds(); }
    streamChunks(10);
    return;
  }
  if (game.paused) return;
  needT -= dt; if (needT < 0) { needT = 0.3; updateNeeds(); }
  streamChunks(game.chunkMeshes.size < 20 ? 24 : 7);
  if (!player.dead) updatePlayer(dt);
  updateBreaking(dt);
  game.ticks += dt * 20;
  ents.update(dt);
  vehicles.update(dt, player, ents); tech.update(dt, player, vehicles);
  if (player.riding) {
    const c = player.riding; const kmh = Math.round(Math.abs(c.speed) * 3.6);
    $('car-speed').textContent = kmh; $('car-batt').textContent = Math.round(c.charge) + '%' + (c.charging ? ' charging' : '');
    $('car-batt').classList.toggle('low', c.charge < 15);
    engineT -= dt; if (engineT < 0) { engineT = 0.11; sfx.engine(Math.abs(c.speed)); }
    if (player.dead) exitCar();
  }
  updateBoats(dt); updateBobber(dt); updateCampfires(dt); updateWeatherFx(dt); tickSheep(dt);
  tickSpawning(dt); updateEyes(dt); bowCd = Math.max(0, bowCd - dt); tickEndermanStare(dt); updateBossBar();
  fluidT += dt; if (fluidT > 0.25) { fluidT = 0; tickFluids(game.fluidQ, B.WATER, 7); }
  lavaT += dt; if (lavaT > 0.9) { lavaT = 0; tickFluids(game.lavaQ, B.LAVA, 3); }
  tickFurnaces(dt);
  tickCrops(dt);
  tickSettlements(dt);
  game.rainT -= dt; if (game.rainT < 0) { game.raining = !game.raining; game.thunder = game.raining && Math.random() < 0.35; game.rainT = game.raining ? 300 + Math.random() * 400 : 900 + Math.random() * 1500; if (game.thunder) toast('A thunderstorm is rolling in'); }
  ui.renderStats(player, game.mode);
  coordsT -= dt; if (coordsT < 0) { coordsT = 0.25; heldInfo(); $('coords').textContent = `XYZ: ${Math.floor(player.x)} / ${Math.floor(player.y)} / ${Math.floor(player.z)}`; }
}
function render(dt) {
  const p = player;
  const eye = p.sneaking ? 1.32 : 1.62;
  const bob = game.state === 'playing' && p.onGround && !p.flying ? Math.sin(p.bob) * 0.045 : 0;
  const thirdPerson = !!(p.riding || game.droneView) && game.state === 'playing';
  if (p.riding) {
    const c = p.riding; const ry = c.mesh.rotation.y; const fx = Math.sin(ry), fz = Math.cos(ry); const back = c.kind === 'bus' ? 11 : 7.2;
    camera.position.set(c.x - fx * back, c.y + 3.3, c.z - fz * back); camera.lookAt(c.x + fx * 4, c.y + 1.1, c.z + fz * 4);
  } else if (game.droneView && game.state === 'playing') {
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw); camera.position.set(p.x - fx * 16, Math.min(H + 20, p.y + 28), p.z - fz * 16); camera.lookAt(p.x + fx * 10, p.y, p.z + fz * 10);
  } else {
    p.stepY = (p.stepY || 0) * Math.exp(-dt * 16); if (p.stepY < 0.005) p.stepY = 0;
    camera.position.set(p.x, p.y + eye + Math.abs(bob) * 0.8 - p.stepY, p.z);
    camera.rotation.y = p.yaw; camera.rotation.x = p.pitch; camera.rotation.z = bob * 0.12;
  }
  if (shake > 0) { shake -= dt; camera.position.x += (Math.random() - 0.5) * shake * 0.4; camera.position.y += (Math.random() - 0.5) * shake * 0.4; }
  const fovK = p.sprinting ? 1.12 : p.flying && p.sprinting ? 1.18 : 1; camera.fov += (settings.fov * fovK - camera.fov) * Math.min(1, dt * 8); camera.updateProjectionMatrix();
  updateSky(dt, camera.position);
  ents.updateParticles(dt, game.daylight);
  if (game.state === 'playing' && !thirdPerson) { updateOutline(); updateHand(dt); } else outline.visible = false;
  const uw = $('underwater'); const showUw = game.state === 'playing' && (p.headInWater || p.headInLava); uw.style.display = showUw ? 'block' : 'none'; uw.classList.toggle('lava', !!p.headInLava);
  renderer.clear();
  renderer.render(scene, camera);
  if (game.state === 'playing' && !p.dead && !thirdPerson) { renderer.clearDepth(); renderer.render(handScene, handCam); }
}
game.dropHeld = dropHeld;
game.onHeldChange = () => { if (game.world) rebuildHand(); };
game.onScreenOpen = () => { endPointer(); sfx.click(); };
game.onScreenClose = () => { };

// ---------- loop ----------
let last = performance.now(); let manual = false;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (!manual) { update(dt); render(dt); }
  fpsAcc += dt; fpsN++; if (fpsAcc > 0.5) { $('fps').textContent = Math.round(fpsN / fpsAcc) + ' fps · ' + game.chunkMeshes.size + ' chunks'; fpsAcc = 0; fpsN = 0; }
  requestAnimationFrame(frame);
}
window.advanceTime = (ms) => { manual = true; const steps = Math.max(1, Math.round(ms / (1000 / 60))); for (let i = 0; i < steps; i++) update(1 / 60); render(1 / 60); manual = false; };
window.render_game_to_text = () => JSON.stringify({
  coords: 'x east, y up, z south; player feet position', state: game.state, mode: game.mode, paused: game.paused, screen: ui.screen,
  player: { x: +player.x.toFixed(2), y: +player.y.toFixed(2), z: +player.z.toFixed(2), vy: +player.vy.toFixed(2), yaw: +player.yaw.toFixed(2), pitch: +player.pitch.toFixed(2), onGround: player.onGround, flying: player.flying, health: player.health, food: player.food, air: Math.round(player.air), dead: player.dead, level: player.level },
  held: game.inv.held() ? itemName(game.inv.held().id) + ' x' + game.inv.held().count : null,
  hotbar: game.inv.slots.slice(0, 9).map((s) => (s ? itemName(s.id) + ' x' + s.count : null)),
  time: Math.floor(game.ticks % 24000), daylight: +game.daylight.toFixed(2), raining: game.raining,
  mobs: ents ? ents.mobs.slice(0, 12).map((m) => ({ type: m.type, x: +m.x.toFixed(1), y: +m.y.toFixed(1), z: +m.z.toFixed(1), hp: m.hp })) : [],
  items: ents ? ents.items.length : 0, chunks: game.chunkMeshes.size, breaking: look ? { breaking: look.breaking, prog: +(look.prog || 0).toFixed(2) } : null,
});
window.__dbg = { vehicles, tech, enterCar, exitCar, player, game, pick, useAt, breakBlock, ui, runCommand, keys, settings, switchDim, tryLightPortal, countShelves, checkEndPortal, get ents() { return ents; }, get bobber() { return bobber; }, get boats() { return boats; } };

// ---------- boot ----------
hurtFlash = document.createElement('div'); hurtFlash.id = 'hurt-flash'; document.body.appendChild(hurtFlash);
const uwEl = document.createElement('div'); uwEl.id = 'underwater'; document.body.appendChild(uwEl);
const portalFx = document.createElement('div'); portalFx.id = 'portal-fx'; document.body.appendChild(portalFx);
const SPLASHES = ['Made for phones!', 'Now with creepers!', 'Tap to place!', '100% blocks!', 'Punch a tree!', 'Hold to mine!', 'Bedrock style!', 'Infinite worlds!', 'Akwaaba!', 'Also try survival!'];
$('splash').textContent = SPLASHES[Math.floor(Math.random() * SPLASHES.length)];
addEventListener('resize', resize);
applySettings();
// panorama world for the title screen
newWorld({ seedText: 'minecraft', mode: 'creative', type: 'infinite', name: 'Panorama' });
titleCam.x = player.x + 6; titleCam.z = player.z + 6;
player.x = titleCam.x; player.z = titleCam.z; player.y = 50;
startLoading('title');
requestAnimationFrame(frame);
void [SOLID, OPAQUE, FUEL, iconFor, isTool, NETHER_BIOMES];
