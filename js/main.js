// Mine Craft — main game
import * as THREE from 'three';
import { hashSeed, mulberry32 } from './noise.js';
import { B, I, BLOCKS, ITEMS, isBlock, isTool, toolInfo, itemName, maxDur, maxStack, SMELT, FUEL, CREATIVE_LIST } from './blocks.js';
import { buildAtlas, tileIndex, iconFor } from './textures.js';
import { World, initTables, CS, H, SEA, SOLID, LIQUID, OPAQUE, EMIT, ckey } from './world.js';
import { EntityManager, moveEntity, collides, blockGeometry, MOBS } from './entities.js';
import { Inventory, UI } from './ui.js';
import { initAudio, sfx, audioSettings, setVolumes } from './audio.js';

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
  const mk = (name) => { const t = tileIndex(name); const c = document.createElement('canvas'); c.width = c.height = 16; c.getContext('2d').drawImage(atlasCanvas, (t % 16) * 16, Math.floor(t / 16) * 16, 16, 16, 0, 0, 16, 16); return c.toDataURL(); };
  document.documentElement.style.setProperty('--stone-tex', `url(${mk('cobblestone')})`);
  const dirt = mk('dirt'); document.querySelectorAll('.dirt-bg').forEach((e) => (e.style.backgroundImage = `url(${dirt})`));
})();

const uniforms = {
  map: { value: atlasTex }, daylight: { value: 1 }, fogColor: { value: new THREE.Color(0x9cc4ff) },
  fogNear: { value: 40 }, fogFar: { value: 64 }, skyTint: { value: new THREE.Color(1, 1, 1) }, gamma: { value: settings.bright }, opacity: { value: 0.78 },
};
const VS = `attribute vec3 light; varying vec2 vUv; varying vec3 vLight; varying float vDist;
void main(){ vUv = uv; vLight = light; vec4 mv = modelViewMatrix * vec4(position, 1.0); vDist = length(mv.xyz); gl_Position = projectionMatrix * mv; }`;
const FS = (water) => `uniform sampler2D map; uniform float daylight; uniform vec3 fogColor; uniform float fogNear; uniform float fogFar; uniform vec3 skyTint; uniform float gamma; uniform float opacity;
varying vec2 vUv; varying vec3 vLight; varying float vDist;
float curve(float l){ float c = l / (4.0 - 3.0 * l); return mix(c, sqrt(l), gamma * 0.6); }
void main(){
  vec4 t = texture2D(map, vUv);
  ${water ? '' : 'if (t.a < 0.5) discard;'}
  float s = curve(vLight.x) * daylight; float b = curve(vLight.y);
  vec3 lc = max(vec3(s) * skyTint, vec3(b) * vec3(1.0, 0.88, 0.7));
  lc = max(lc, vec3(0.025 + gamma * 0.05));
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
  const t = tileIndex('destroy_' + stage); const col = t % 16, row = Math.floor(t / 16); const uv = crackGeo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (col + crackBaseUV[i * 2]) / 16, 1 - (row + 1 - crackBaseUV[i * 2 + 1]) / 16);
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
  hand.add(heldMesh);
}

// ---------- game state ----------
const game = {
  state: 'loading', scene, atlasTex, mode: 'survival', difficulty: 2, world: null, inv: new Inventory(),
  ticks: 1000, daylight: 1, raining: false, rainT: 600, paused: false, screenOpen: false, stats: { crafted: 0, mined: 0, placed: 0 },
  worldName: 'My World', seedText: '', chunkMeshes: new Map(), fluidQ: new Map(), lavaQ: new Map(),
};
window.__game = game;
const player = game.player = {
  x: 0, y: 40, z: 0, vx: 0, vy: 0, vz: 0, w: 0.3, h: 1.8, yaw: 0, pitch: 0, onGround: false, flying: false, sneaking: false, sprinting: false,
  health: 20, food: 20, sat: 5, exh: 0, air: 300, fallStart: null, dead: false, xp: 0, level: 0, hurtCd: 0, regenT: 0, starveT: 0,
  stepDist: 0, bob: 0, spawn: { x: 0.5, y: 40, z: 0.5 }, lavaT: 0, inWater: false, inLava: false, headInWater: false,
};
const ui = new UI(game);
game.ui = ui;
let ents = null;

// ---------- world lifecycle ----------
function disposeWorld() {
  for (const [, m] of game.chunkMeshes) { if (m.solid) { scene.remove(m.solid); m.solid.geometry.dispose(); } if (m.water) { scene.remove(m.water); m.water.geometry.dispose(); } }
  game.chunkMeshes.clear(); game.fluidQ.clear(); game.lavaQ.clear();
  if (ents) ents.clear();
}
function newWorld({ seedText = '', mode = 'survival', difficulty = 2, type = 'infinite', name = 'My World' } = {}) {
  disposeWorld();
  const seed = seedText ? (/^-?\d+$/.test(seedText) ? (parseInt(seedText, 10) >>> 0) : hashSeed(seedText)) : (Math.random() * 2 ** 32) >>> 0;
  game.seed = seed; game.seedText = seedText || String(seed);
  game.world = new World(seed, type); game.mode = mode; game.difficulty = difficulty; game.worldName = name;
  game.ticks = 1000; game.raining = false; game.rainT = 900 + Math.random() * 1200;
  if (!ents) ents = new EntityManager(game); else { ents.world = game.world; }
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
  game.world.ensureChunk(sx >> 4, sz >> 4);
  const top = game.world.topSolid(sx, sz);
  player.spawn = { x: sx + 0.5, y: top + 1.01, z: sz + 0.5 };
  resetPlayer();
  player.yaw = Math.PI * 0.75;
  ui.renderHotbar(); rebuildHand();
}
function resetPlayer() {
  Object.assign(player, { x: player.spawn.x, y: player.spawn.y, z: player.spawn.z, vx: 0, vy: 0, vz: 0, health: 20, food: 20, sat: 5, exh: 0, air: 300, fallStart: null, dead: false, flying: false, hurtCd: 0 });
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
  if (firstTime && game.state !== 'title' && game.world.type !== 'flat') maybeSpawnAnimals(c);
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
const NEEDS_SUPPORT = new Set([B.TALL_GRASS, B.DANDELION, B.POPPY, B.DEAD_BUSH, B.TORCH, B.CACTUS]);
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
    else if (NEEDS_SUPPORT.has(above) && !(above === B.CACTUS && w.getBlock(x, y, z) === B.CACTUS)) { popBlock(x, y + 1, z, above); }
  }
  if (BLOCKS[id] && BLOCKS[id].gravity) { const below = w.getBlock(x, y - 1, z); if (!SOLID[below]) { w.setBlock(x, y, z, 0); ents.spawnFalling(id, x, y, z); } }
};
function popBlock(x, y, z, id) {
  game.setBlock(x, y, z, 0);
  if (game.mode === 'survival') { const d = resolveDrop(id, null); if (d) ents.dropItem(d.id, d.n, x + 0.5, y + 0.3, z + 0.5); }
}
function resolveDrop(id, held) {
  const b = BLOCKS[id]; let drop = b.drop;
  const t = held ? toolInfo(held.id) : null;
  if (b.tier > 0 && !(t && t.type === 'pickaxe' && t.tier >= b.tier)) return null;
  if (drop === 'gravel') return Math.random() < 0.1 ? { id: I.FLINT, n: 1 } : { id: B.GRAVEL, n: 1 };
  if (drop === 'leaves') return (id === B.OAK_LEAVES && Math.random() < 0.06) ? { id: I.APPLE, n: 1 } : Math.random() < 0.04 ? { id: I.STICK, n: 1 } : null;
  if (drop === 'grass') return null;
  if (!drop) return null;
  if (drop === I.REDSTONE) return { id: drop, n: 4 + Math.floor(Math.random() * 2) };
  return { id: drop, n: 1 };
}
function breakTime(id, held) {
  const b = BLOCKS[id]; if (b.hardness < 0) return Infinity; if (b.hardness === 0) return 0.05;
  const t = held ? toolInfo(held.id) : null;
  let speed = 1; if (t && b.tool === t.type) speed = t.speed;
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
    if (d) ents.dropItem(d.id, d.n, x + 0.5, y + 0.4, z + 0.5);
    const xp = { [B.COAL_ORE]: 1, [B.DIAMOND_ORE]: 5, [B.REDSTONE_ORE]: 2 }[id]; if (xp && d) addXP(xp);
    if (held && maxDur(held.id) && BLOCKS[id].hardness > 0) { if (game.inv.damageHeld(toolInfo(held.id)?.type === 'sword' ? 2 : 1)) { sfx.brk(B.GLASS); toast('Your tool broke'); } }
    player.exh += 0.005;
  }
  const tile = game.world.tiles.get(tkey(x, y, z));
  if (tile) { for (const s of tile.slots) if (s && game.mode === 'survival') ents.dropItem(s.id, s.count, x + 0.5, y + 0.5, z + 0.5, undefined, undefined, undefined, s.dur); game.world.tiles.delete(tkey(x, y, z)); }
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
  player.hurtCd = 0.5; player.health -= amount; sfx.hurt(); shake = 0.25;
  if (fx !== undefined) { const dx = player.x - fx, dz = player.z - fz, d = Math.hypot(dx, dz) || 1; player.vx += dx / d * 7; player.vz += dz / d * 7; player.vy = Math.max(player.vy, 5); }
  hurtFlash.style.opacity = 1; setTimeout(() => (hurtFlash.style.opacity = 0), 200);
  player.exh += 0.1;
  if (player.health <= 0) die(cause);
};
const DEATH_MSG = { mob: 'was slain by a monster', fall: 'fell from a high place', lava: 'tried to swim in lava', drown: 'drowned', starve: 'starved to death', explode: 'blew up', void: 'fell out of the world', cactus: 'was pricked to death' };
function die(cause) {
  player.dead = true; player.health = 0;
  for (let i = 0; i < 36; i++) { const s = game.inv.slots[i]; if (s) ents.dropItem(s.id, s.count, player.x, player.y + 1, player.z, (Math.random() - 0.5) * 6, 4, (Math.random() - 0.5) * 6, s.dur); }
  game.inv.clear(); const lv = player.level; player.level = 0; player.xp = 0;
  $('death-msg').textContent = 'Steve ' + (DEATH_MSG[cause] || 'died');
  $('death-score').textContent = 'Score: ' + (lv * 7 + game.stats.mined);
  $('death').classList.remove('hidden');
  endPointer();
}
game.dropFromPlayer = (id, n, dur) => {
  const fx = -Math.sin(player.yaw) * Math.cos(player.pitch), fz = -Math.cos(player.yaw) * Math.cos(player.pitch);
  ents.dropItem(id, n, player.x + fx * 0.6, player.y + 1.3, player.z + fz * 0.6, fx * 5, 3, fz * 5, dur);
};
function dropHeld(all) {
  const h = game.inv.held(); if (!h) return;
  const n = all ? h.count : 1; game.dropFromPlayer(h.id, n, h.dur); game.inv.consumeHeld(n);
}

// ---------- explosions ----------
game.explode = (x, y, z, power) => {
  const w = game.world; const r = power; sfx.explode(); shake = 0.6;
  const rnd = Math.random;
  for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) for (let dz = -r; dz <= r; dz++) {
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz); if (d > r * (0.7 + rnd() * 0.35)) continue;
    const bx = Math.floor(x + dx), by = Math.floor(y + dy), bz = Math.floor(z + dz);
    const id = w.getBlock(bx, by, bz);
    if (!id || id === B.BEDROCK || id === B.OBSIDIAN || LIQUID[id]) continue;
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
  for (const m of ents.mobs) { const md = Math.hypot(m.x - x, m.y - y, m.z - z); if (md < r * 2) { m.hurt = 0; ents.hurtMob(m, Math.round((1 - md / (r * 2)) * power * 5), x, z); } }
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
  if (!t) { t = type === 'chest' ? { type, slots: new Array(27).fill(null) } : { type, slots: [null, null, null], burn: 0, burnMax: 0, cook: 0, x, y, z }; game.world.tiles.set(k, t); }
  return t;
}
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
  const type = ['pig', 'cow', 'sheep', 'pig', 'sheep'][Math.floor(r() * 5)];
  const n = 2 + Math.floor(r() * 3); const w = game.world;
  for (let i = 0; i < n; i++) {
    const x = c.cx * CS + Math.floor(r() * 16), z = c.cz * CS + Math.floor(r() * 16);
    const y = w.topSolid(x, z); if (w.getBlock(x, y, z) !== B.GRASS) continue;
    if (ents.mobs.filter((m) => m.def.passive).length > 30) return;
    ents.spawnMob(type, x + 0.5, y + 1, z + 0.5);
  }
}
let spawnT = 0;
function tickSpawning(dt) {
  spawnT -= dt; if (spawnT > 0) return; spawnT = 1;
  const w = game.world; if (game.world.type === 'flat' && game.difficulty === 0) return;
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
      const r = Math.random(); const type = r < 0.45 ? 'zombie' : r < 0.75 ? 'creeper' : 'skeleton';
      ents.spawnMob(type, x + 0.5, y, z + 0.5); break;
    }
  }
  const passive = ents.mobs.filter((m) => m.def.passive).length;
  if (passive < 10 && game.daylight > 0.6 && Math.random() < 0.08 && game.world.type !== 'flat') {
    const ang = Math.random() * Math.PI * 2, d = 26 + Math.random() * 20;
    const x = Math.floor(player.x + Math.cos(ang) * d), z = Math.floor(player.z + Math.sin(ang) * d);
    if (w.isLoaded(x, z)) { const y = w.topSolid(x, z); if (w.getBlock(x, y, z) === B.GRASS) { const t = ['pig', 'cow', 'sheep'][Math.floor(Math.random() * 3)]; for (let i = 0; i < 2; i++) ents.spawnMob(t, x + 0.5 + i, y + 1, z + 0.5); } }
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
    if (look.mouse && !look.breaking && !look.dragging && dt < 300) attackOnly(look.px, look.py);
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
  if (player.vy < -1 && !player.onGround) dmg *= 1.5; // crit
  if (game.mode === 'creative') dmg = 100;
  if (ents.hurtMob(m, dmg, player.x, player.z)) { if (t && game.mode === 'survival') game.inv.damageHeld(t.type === 'sword' ? 1 : 2); player.exh += 0.1; if (player.vy < -1) ents.burst(m.x, m.y + 1, m.z, [1, 1, 0.6], 8, 3, 0.08); }
  swing();
}
function attackOnly(sx, sy) { const p = pick(sx, sy); if (p.mob) attackMob(p.mob); else swing(); }
function facingMeta() {
  const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw); // forward
  if (Math.abs(fx) > Math.abs(fz)) return fx > 0 ? 3 : 1; return fz > 0 ? 2 : 0;
}
function useAt(sx, sy) {
  if (player.dead) return;
  const p = pick(sx, sy); const held = game.inv.held(); const w = game.world;
  if (p.mob) { attackMob(p.mob); return; }
  // food
  if (held && ITEMS[held.id] && ITEMS[held.id].food && game.mode === 'survival' && player.food < 20) {
    player.food = Math.min(20, player.food + ITEMS[held.id].food); player.sat = Math.min(player.food, player.sat + ITEMS[held.id].food * 0.6);
    game.inv.consumeHeld(1); sfx.eat(); setTimeout(() => sfx.burp(), 520); swing(); eatT = 0.5; return;
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
  if (!sneaking) {
    if (bid === B.TABLE) { ui.open('table'); return; }
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
  let tx = b.x + b.nx, ty = b.y + b.ny, tz = b.z + b.nz;
  if (REPLACEABLE.has(bid) && bid !== 0) { tx = b.x; ty = b.y; tz = b.z; }
  if (ty < 0 || ty >= H) return;
  const cur = w.getBlock(tx, ty, tz);
  if (!REPLACEABLE.has(cur)) return;
  const pb = BLOCKS[placeId];
  if (NEEDS_SUPPORT.has(placeId)) {
    const below = w.getBlock(tx, ty - 1, tz);
    if (placeId === B.TORCH) { if (!SOLID[below]) return; }
    else if (placeId === B.CACTUS) { if (below !== B.SAND && below !== B.CACTUS) return; }
    else if (![B.GRASS, B.DIRT, B.SNOW_GRASS, B.SAND].includes(below)) return;
  }
  if (pb.solid) {
    const pw = player.w; const e = 0.001;
    if (tx + 1 > player.x - pw + e && tx < player.x + pw - e && tz + 1 > player.z - pw + e && tz < player.z + pw - e && ty + 1 > player.y + e && ty < player.y + player.h - e) return;
    for (const m of ents.mobs) if (tx + 1 > m.x - m.w && tx < m.x + m.w && tz + 1 > m.z - m.w && tz < m.z + m.w && ty + 1 > m.y && ty < m.y + m.h) return;
  }
  const meta = pb.tiles && pb.tiles.front !== pb.tiles.side ? facingMeta() : 0;
  game.setBlock(tx, ty, tz, placeId, meta);
  sfx.place(placeId); swing(); game.stats.placed++;
  if (game.mode === 'survival') {
    if (held.id === I.WATER_BUCKET || held.id === I.LAVA_BUCKET) { game.inv.slots[game.inv.sel] = { id: I.BUCKET, count: 1 }; game.inv.onChange(); }
    else game.inv.consumeHeld(1);
  }
}
let eatT = 0;
function sleep(b) {
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
  if (c === 'help') chatLog('Commands: /gamemode s|c, /time set day|night|noon|midnight, /weather clear|rain, /give <item> [n], /tp x y z, /summon pig|cow|sheep|zombie|creeper|skeleton|tnt, /difficulty 0-3, /kill, /seed, /spawnpoint, /heal');
  else if (c === 'gamemode' || c === 'gm') { const m = (a[0] || '').toLowerCase(); setMode(m.startsWith('c') || m === '1' ? 'creative' : 'survival'); chatLog('Game mode set to ' + game.mode); }
  else if (c === 'time') { const t = (a[1] || a[0] || '').toLowerCase(); const map = { day: 1000, noon: 6000, sunset: 12000, night: 13500, midnight: 18000, sunrise: 23000 }; const base = Math.floor(game.ticks / 24000) * 24000; const n = map[t] ?? parseInt(t, 10); if (!isNaN(n)) { game.ticks = base + n; chatLog('Set the time to ' + t); } }
  else if (c === 'weather') { game.raining = (a[0] || '') === 'rain' || (a[0] || '') === 'thunder'; game.rainT = 600; chatLog('Weather: ' + (game.raining ? 'rain' : 'clear')); }
  else if (c === 'give') {
    const name = (a[0] || '').toLowerCase(); let id = NAME_TO_ID[name] ?? NAME_TO_ID[name.replace(/^minecraft:/, '')];
    if (id === undefined) id = Object.entries(NAME_TO_ID).find(([k]) => k.includes(name))?.[1];
    if (id === undefined) { chatLog('Unknown item: ' + name); return; }
    const n = Math.max(1, Math.min(640, parseInt(a[1] || '1', 10) || 1)); const left = game.inv.add(id, n); chatLog(`Gave ${n - left} ${itemName(id)}`);
  }
  else if (c === 'tp') { const [x, y, z] = a.map((s, i) => s.startsWith('~') ? [player.x, player.y, player.z][i] + (parseFloat(s.slice(1)) || 0) : parseFloat(s)); if ([x, y, z].every((q) => !isNaN(q))) { player.x = x; player.y = y; player.z = z; player.vy = 0; chatLog(`Teleported to ${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)}`); } }
  else if (c === 'summon') { const t = (a[0] || '').toLowerCase(); if (t === 'tnt') { ents.primeTNT(Math.floor(player.x - Math.sin(player.yaw) * 3), Math.floor(player.y), Math.floor(player.z - Math.cos(player.yaw) * 3)); chatLog('Summoned TNT'); } else if (MOBS[t]) { const fx = -Math.sin(player.yaw) * 3, fz = -Math.cos(player.yaw) * 3; ents.spawnMob(t, player.x + fx, player.y + 0.5, player.z + fz); chatLog('Summoned ' + t); } else chatLog('Unknown mob'); }
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
$('btn-respawn').onclick = () => { $('death').classList.add('hidden'); resetPlayer(); ui.lastStats = ''; };
$('btn-death-quit').onclick = () => { $('death').classList.add('hidden'); resetPlayer(); toTitle(); };
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
  const inputBlocked = ui.screen || game.chatOpen || game.inBed;
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
  // speeds
  let speed = p.flying ? (p.sprinting ? 21 : 10.9) : p.sneaking ? 1.3 : p.sprinting ? 5.6 : 4.317;
  if ((p.inWater || p.inLava) && !p.flying) speed *= p.inLava ? 0.35 : 0.55;
  if (eatT > 0) speed *= 0.4;
  const sy = Math.sin(p.yaw), cy = Math.cos(p.yaw);
  const tx = (mx * cy + mz * sy) * speed, tz = (-mx * sy + mz * cy) * speed;
  const accel = p.onGround || p.flying ? 12 : (p.inWater ? 6 : 3);
  p.vx += (tx - p.vx) * Math.min(1, dt * accel); p.vz += (tz - p.vz) * Math.min(1, dt * accel);
  if (p.flying) {
    const up = (jump ? 1 : 0) - ((keys.shift || keys.flyDown) ? 1 : 0);
    p.vy += (up * 8 - p.vy) * Math.min(1, dt * 10);
  } else if (p.inWater || p.inLava) {
    p.vy -= 10 * dt; p.vy *= 1 - dt * 3;
    if (jump) p.vy = Math.min(p.vy + 30 * dt, 3.6);
    p.vy = Math.max(p.vy, -3);
    if (p.fallStart !== null) p.fallStart = null;
  } else {
    p.vy -= 28 * dt; p.vy = Math.max(p.vy, -60);
    if (jump && p.onGround) { p.vy = 8.4; p.exh += p.sprinting ? 0.2 : 0.05; if (p.sprinting) { p.vx += -sy * 2; p.vz += -cy * 2; } }
  }
  // sneak edge guard
  let dx = p.vx * dt, dz = p.vz * dt;
  if (p.sneaking && p.onGround) {
    const ground = (x, z) => collides(w, x - p.w, p.y - 0.6, z - p.w, x + p.w, p.y - 0.01, z + p.w);
    if (!ground(p.x + dx, p.z)) { dx = 0; p.vx = 0; }
    if (!ground(p.x + dx, p.z + dz)) { dz = 0; p.vz = 0; }
  }
  const wasGround = p.onGround; const vyBefore = p.vy; const oy = p.y;
  const hit = moveEntity(w, p, dx, p.vy * dt, dz);
  // auto-jump
  if ((hit.hitX || hit.hitZ) && p.onGround && (settings.autojump || p.inWater) && ml > 0.2 && !p.sneaking) {
    const fx = Math.floor(p.x + Math.sign(p.vx || tx) * 0.6), fz = Math.floor(p.z + Math.sign(p.vz || tz) * 0.6);
    const fy = Math.floor(p.y + 0.1);
    if (!SOLID[w.getBlock(fx, fy + 1, fz)] && !SOLID[w.getBlock(fx, fy + 2, fz)] && !SOLID[w.getBlock(Math.floor(p.x), fy + 2, Math.floor(p.z))]) p.vy = 8.4;
  }
  if ((hit.hitX || hit.hitZ) && p.inWater && jump) p.vy = 5;
  // fall damage
  if (!p.onGround && !p.flying && !p.inWater) { if (p.fallStart === null || p.y > p.fallStart) p.fallStart = Math.max(p.fallStart ?? p.y, p.y); }
  if (p.onGround && !wasGround) {
    if (p.fallStart !== null && game.mode === 'survival') { const fd = p.fallStart - p.y; if (fd > 3.4) { p.hurtCd = 0; game.damagePlayer(Math.floor(fd - 3), undefined, undefined, 'fall'); } }
    p.fallStart = null; if (vyBefore < -6) sfx.step(w.getBlock(Math.floor(p.x), Math.floor(p.y - 0.5), Math.floor(p.z)));
  }
  if (p.flying && p.onGround && game.mode === 'creative' && vyBefore < -0.5) { p.flying = false; }
  if (p.flying) p.fallStart = null;
  // steps + bob
  const hs = Math.hypot(p.x - (p._lx ?? p.x), p.z - (p._lz ?? p.z)); p._lx = p.x; p._lz = p.z;
  if (p.onGround && !p.flying) { p.stepDist += hs; p.bob += hs * 2.2; stepAcc += hs; if (stepAcc > 1.7) { stepAcc = 0; sfx.step(w.getBlock(Math.floor(p.x), Math.floor(p.y - 0.5), Math.floor(p.z))); } }
  if (game.mode === 'survival') p.exh += hs * (p.sprinting ? 0.1 : 0.0) + (p.inWater ? hs * 0.01 : 0);
  void oy;
  // hazards
  p.hurtCd = Math.max(0, p.hurtCd - dt);
  if (game.mode === 'survival' && !p.dead) {
    if (p.inLava) { p.lavaT -= dt; if (p.lavaT <= 0) { p.lavaT = 0.5; p.hurtCd = 0; game.damagePlayer(4, undefined, undefined, 'lava'); } }
    if (p.y < -8) { p.lavaT -= dt; if (p.lavaT <= 0) { p.lavaT = 0.5; p.hurtCd = 0; game.damagePlayer(4, undefined, undefined, 'void'); } }
    // cactus
    if (collidesId(w, p, B.CACTUS)) { if (p.hurtCd <= 0) game.damagePlayer(1, undefined, undefined, 'cactus'); }
    // air
    if (p.headInWater) { p.air -= dt * 20; if (p.air <= 0) { p.air = 0; p.drownT = (p.drownT || 0) - dt; if (p.drownT <= 0) { p.drownT = 1; p.hurtCd = 0; game.damagePlayer(2, undefined, undefined, 'drown'); } } }
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
  if (!look || ui.screen || player.dead) { crack.visible = false; return; }
  const now = performance.now();
  if (!look.breaking) {
    if (look.mouse) { if (now > look.mouseStartBreakAt && !look.dragging) look.breaking = true; }
    else if (now - look.at > 300) look.breaking = true;
    if (!look.breaking) return;
  }
  const p = pick(look.px, look.py);
  look.cd -= dt;
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
  if (p.block) { outline.visible = true; const id = p.block.id; const sh = BLOCKS[id].shape; outline.position.set(p.block.x + 0.5, p.block.y + (sh === 'slab' ? 0.28 : 0.5), p.block.z + 0.5); outline.scale.set(sh === 'torch' ? 0.2 : sh === 'cross' ? 0.8 : 1, sh === 'slab' ? 0.5625 : sh === 'torch' ? 0.65 : 1, sh === 'torch' ? 0.2 : sh === 'cross' ? 0.8 : 1); if (sh === 'torch') outline.position.y = p.block.y + 0.33; }
  else outline.visible = false;
}
const skyDay = new THREE.Color(0x78a7ff), skyNight = new THREE.Color(0x070a14), fogDay = new THREE.Color(0xb8d4ff), sunset = new THREE.Color(0xf08850), tmpC = new THREE.Color(), rainSky = new THREE.Color(0x6a7a90);
function updateSky(dt, camPos) {
  const dayTime = ((game.ticks % 24000) + 24000) % 24000;
  const ang = dayTime / 24000 * Math.PI * 2; const sunH = Math.sin(ang);
  const t = THREE.MathUtils.smoothstep(sunH, -0.22, 0.25);
  let dl = 0.16 + 0.84 * t; if (game.raining) dl *= 0.72;
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
  // clouds
  const size = Math.max(400, settings.rd * CS * 4); clouds.scale.set(size, size, 1);
  clouds.position.set(camPos.x, H + 18, camPos.z);
  const cell = 12 * 64; cloudU.rep.value = size / cell;
  cloudU.off.value.set(((camPos.x + game.ticks * 0.03) / cell) - cloudU.rep.value / 2, (-camPos.z / cell) - cloudU.rep.value / 2);
  cloudU.col.value.setRGB(0.25 + 0.75 * dl, 0.25 + 0.75 * dl, 0.28 + 0.72 * dl); cloudU.fadeR.value = size / 2;
  if (game.raining) cloudU.col.value.multiplyScalar(0.7);
  // rain
  rain.visible = game.raining && game.state === 'playing';
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
    $('load-text').textContent = f < 1 ? 'Generating terrain… ' + Math.round(f * 100) + '%' : 'Spawning…';
    if (f >= 1) {
      if (loadingTarget === 'playing') {
        // fix spawn height after terrain exists
        { const w = game.world, bx = Math.floor(player.spawn.x), bz = Math.floor(player.spawn.z); let best = null;
          for (let r = 0; r < 24 && !best; r++) for (let dx = -r; dx <= r && !best; dx++) for (let dz = -r; dz <= r && !best; dz++) {
            if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue; const x = bx + dx, z = bz + dz; if (!w.isLoaded(x, z)) continue;
            const t = w.topSolid(x, z); const id = w.getBlock(x, t, z);
            if ([B.GRASS, B.SAND, B.SNOW_GRASS, B.DIRT, B.STONE].includes(id) && w.getBlock(x, t + 1, z) !== B.WATER) best = { x, y: t, z };
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
  tickSpawning(dt);
  fluidT += dt; if (fluidT > 0.25) { fluidT = 0; tickFluids(game.fluidQ, B.WATER, 7); }
  lavaT += dt; if (lavaT > 0.9) { lavaT = 0; tickFluids(game.lavaQ, B.LAVA, 3); }
  tickFurnaces(dt);
  game.rainT -= dt; if (game.rainT < 0) { game.raining = !game.raining; game.rainT = game.raining ? 300 + Math.random() * 400 : 900 + Math.random() * 1500; }
  ui.renderStats(player, game.mode);
  coordsT -= dt; if (coordsT < 0) { coordsT = 0.25; $('coords').textContent = `XYZ: ${Math.floor(player.x)} / ${Math.floor(player.y)} / ${Math.floor(player.z)}`; }
}
function render(dt) {
  const p = player;
  const eye = p.sneaking ? 1.32 : 1.62;
  const bob = game.state === 'playing' && p.onGround && !p.flying ? Math.sin(p.bob) * 0.045 : 0;
  camera.position.set(p.x, p.y + eye + Math.abs(bob) * 0.8, p.z);
  camera.rotation.y = p.yaw; camera.rotation.x = p.pitch; camera.rotation.z = bob * 0.12;
  if (shake > 0) { shake -= dt; camera.position.x += (Math.random() - 0.5) * shake * 0.4; camera.position.y += (Math.random() - 0.5) * shake * 0.4; }
  const fovK = p.sprinting ? 1.12 : p.flying && p.sprinting ? 1.18 : 1; camera.fov += (settings.fov * fovK - camera.fov) * Math.min(1, dt * 8); camera.updateProjectionMatrix();
  updateSky(dt, camera.position);
  ents.updateParticles(dt, game.daylight);
  if (game.state === 'playing') { updateOutline(); updateHand(dt); } else outline.visible = false;
  const uw = $('underwater'); const showUw = game.state === 'playing' && (p.headInWater || p.headInLava); uw.style.display = showUw ? 'block' : 'none'; uw.classList.toggle('lava', !!p.headInLava);
  renderer.clear();
  renderer.render(scene, camera);
  if (game.state === 'playing' && !p.dead) { renderer.clearDepth(); renderer.render(handScene, handCam); }
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
window.__dbg = { player, game, pick, useAt, breakBlock, ui, runCommand, keys, settings };

// ---------- boot ----------
hurtFlash = document.createElement('div'); hurtFlash.id = 'hurt-flash'; document.body.appendChild(hurtFlash);
const uwEl = document.createElement('div'); uwEl.id = 'underwater'; document.body.appendChild(uwEl);
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
void [SOLID, OPAQUE, FUEL, iconFor, isTool];
