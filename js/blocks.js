// Block + item registry, recipes, smelting
export const B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, COBBLE: 4, BEDROCK: 5, SAND: 6, GRAVEL: 7, OAK_LOG: 8, OAK_LEAVES: 9,
  PLANKS: 10, WATER: 11, GLASS: 12, COAL_ORE: 13, IRON_ORE: 14, GOLD_ORE: 15, DIAMOND_ORE: 16, REDSTONE_ORE: 17,
  SNOW_GRASS: 18, ICE: 19, CACTUS: 20, BIRCH_LOG: 21, BIRCH_LEAVES: 22, SPRUCE_LOG: 23, SPRUCE_LEAVES: 24,
  TABLE: 25, FURNACE: 26, CHEST: 27, TORCH: 28, BRICKS: 29, STONE_BRICKS: 30, SANDSTONE: 31, TALL_GRASS: 32,
  DANDELION: 33, POPPY: 34, WOOL: 35, TNT: 36, BED: 37, GLOWSTONE: 38, LAVA: 39, OBSIDIAN: 40, BOOKSHELF: 41,
  CLAY: 42, IRON_BLOCK: 43, GOLD_BLOCK: 44, DIAMOND_BLOCK: 45, PUMPKIN: 46, SNOW_BLOCK: 47, MOSSY: 48,
  RED_WOOL: 49, BLUE_WOOL: 50, GREEN_WOOL: 51, YELLOW_WOOL: 52, BLACK_WOOL: 53, LIT_FURNACE: 54, DEAD_BUSH: 55,
  JACK_O: 56, COAL_BLOCK: 57,
};
export const I = {
  STICK: 100, COAL: 101, IRON_INGOT: 102, GOLD_INGOT: 103, DIAMOND: 104, REDSTONE: 105, APPLE: 106,
  RAW_PORK: 107, COOKED_PORK: 108, RAW_BEEF: 109, STEAK: 110, GUNPOWDER: 111, ROTTEN_FLESH: 112, FLINT: 113,
  FLINT_STEEL: 114, RAW_MUTTON: 117, COOKED_MUTTON: 118, BREAD: 119, BONE: 120, ARROW: 121, BUCKET: 122, WATER_BUCKET: 123, LAVA_BUCKET: 124,
};
// tools: 130 + mat*4 + type
export const TOOL_MATS = ['wooden', 'stone', 'iron', 'golden', 'diamond'];
export const TOOL_TYPES = ['pickaxe', 'axe', 'shovel', 'sword'];
export const MAT_INFO = [
  { dur: 59, speed: 2, tier: 1, dmg: 0, color: '#9c7a48', dark: '#5e4524' },
  { dur: 131, speed: 4, tier: 2, dmg: 1, color: '#8a8a8a', dark: '#4e4e4e' },
  { dur: 250, speed: 6, tier: 3, dmg: 2, color: '#e6e6e6', dark: '#9a9a9a' },
  { dur: 32, speed: 12, tier: 1, dmg: 0, color: '#f7d84a', dark: '#b8901c' },
  { dur: 1561, speed: 8, tier: 4, dmg: 3, color: '#5ff0e0', dark: '#1d9c8f' },
];
export const toolId = (m, t) => 130 + m * 4 + t;
export const isTool = (id) => id >= 130 && id < 150;
export const toolInfo = (id) => isTool(id) ? { mat: Math.floor((id - 130) / 4), type: TOOL_TYPES[(id - 130) % 4], ...MAT_INFO[Math.floor((id - 130) / 4)] } : null;

// tex: tile names (resolved by textures.js)
const def = (id, o) => (BLOCKS[id] = Object.assign({
  id, name: 'Block', tex: null, solid: true, opaque: true, cutout: false, liquid: false, shape: 'cube',
  light: 0, filter: 15, hardness: 1, tool: null, tier: 0, drop: id, cullSame: false, gravity: false, creative: true,
}, o));
export const BLOCKS = [];
def(0, { name: 'Air', solid: false, opaque: false, filter: 0, creative: false });
def(1, { name: 'Grass Block', tex: { top: 'grass_top', bottom: 'dirt', side: 'grass_side' }, hardness: 0.6, tool: 'shovel', drop: 2 });
def(2, { name: 'Dirt', tex: 'dirt', hardness: 0.5, tool: 'shovel' });
def(3, { name: 'Stone', tex: 'stone', hardness: 1.5, tool: 'pickaxe', tier: 1, drop: 4 });
def(4, { name: 'Cobblestone', tex: 'cobblestone', hardness: 2, tool: 'pickaxe', tier: 1 });
def(5, { name: 'Bedrock', tex: 'bedrock', hardness: -1 });
def(6, { name: 'Sand', tex: 'sand', hardness: 0.5, tool: 'shovel', gravity: true });
def(7, { name: 'Gravel', tex: 'gravel', hardness: 0.6, tool: 'shovel', gravity: true, drop: 'gravel' });
def(8, { name: 'Oak Log', tex: { top: 'oak_log_top', bottom: 'oak_log_top', side: 'oak_log' }, hardness: 2, tool: 'axe' });
def(9, { name: 'Oak Leaves', tex: 'oak_leaves', opaque: false, cutout: true, filter: 1, hardness: 0.2, cullSame: true, drop: 'leaves' });
def(10, { name: 'Oak Planks', tex: 'planks', hardness: 2, tool: 'axe' });
def(11, { name: 'Water', tex: 'water', solid: false, opaque: false, liquid: true, filter: 2, hardness: -1, cullSame: true, creative: false });
def(12, { name: 'Glass', tex: 'glass', opaque: false, cutout: true, filter: 0, hardness: 0.3, cullSame: true, drop: 0 });
def(13, { name: 'Coal Ore', tex: 'coal_ore', hardness: 3, tool: 'pickaxe', tier: 1, drop: I.COAL });
def(14, { name: 'Iron Ore', tex: 'iron_ore', hardness: 3, tool: 'pickaxe', tier: 2 });
def(15, { name: 'Gold Ore', tex: 'gold_ore', hardness: 3, tool: 'pickaxe', tier: 3 });
def(16, { name: 'Diamond Ore', tex: 'diamond_ore', hardness: 3, tool: 'pickaxe', tier: 3, drop: I.DIAMOND });
def(17, { name: 'Redstone Ore', tex: 'redstone_ore', hardness: 3, tool: 'pickaxe', tier: 3, drop: I.REDSTONE });
def(18, { name: 'Snowy Grass', tex: { top: 'snow', bottom: 'dirt', side: 'snow_side' }, hardness: 0.6, tool: 'shovel', drop: 2 });
def(19, { name: 'Ice', tex: 'ice', opaque: false, cutout: true, filter: 2, hardness: 0.5, cullSame: true, drop: 0 });
def(20, { name: 'Cactus', tex: { top: 'cactus_top', bottom: 'cactus_top', side: 'cactus_side' }, opaque: false, filter: 0, hardness: 0.4, shape: 'cactus' });
def(21, { name: 'Birch Log', tex: { top: 'birch_log_top', bottom: 'birch_log_top', side: 'birch_log' }, hardness: 2, tool: 'axe' });
def(22, { name: 'Birch Leaves', tex: 'birch_leaves', opaque: false, cutout: true, filter: 1, hardness: 0.2, cullSame: true, drop: 'leaves' });
def(23, { name: 'Spruce Log', tex: { top: 'spruce_log_top', bottom: 'spruce_log_top', side: 'spruce_log' }, hardness: 2, tool: 'axe' });
def(24, { name: 'Spruce Leaves', tex: 'spruce_leaves', opaque: false, cutout: true, filter: 1, hardness: 0.2, cullSame: true, drop: 'leaves' });
def(25, { name: 'Crafting Table', tex: { top: 'table_top', bottom: 'planks', side: 'table_side', front: 'table_front' }, hardness: 2.5, tool: 'axe' });
def(26, { name: 'Furnace', tex: { top: 'furnace_top', bottom: 'furnace_top', side: 'furnace_side', front: 'furnace_front' }, hardness: 3.5, tool: 'pickaxe', tier: 1 });
def(27, { name: 'Chest', tex: { top: 'chest_top', bottom: 'chest_top', side: 'chest_side', front: 'chest_front' }, hardness: 2.5, tool: 'axe' });
def(28, { name: 'Torch', tex: 'torch', solid: false, opaque: false, filter: 0, shape: 'torch', light: 14, hardness: 0 });
def(29, { name: 'Bricks', tex: 'bricks', hardness: 2, tool: 'pickaxe', tier: 1 });
def(30, { name: 'Stone Bricks', tex: 'stone_bricks', hardness: 1.5, tool: 'pickaxe', tier: 1 });
def(31, { name: 'Sandstone', tex: { top: 'sandstone_top', bottom: 'sandstone_top', side: 'sandstone' }, hardness: 0.8, tool: 'pickaxe', tier: 1 });
def(32, { name: 'Grass', tex: 'tall_grass', solid: false, opaque: false, filter: 0, shape: 'cross', hardness: 0, drop: 'grass' });
def(33, { name: 'Dandelion', tex: 'dandelion', solid: false, opaque: false, filter: 0, shape: 'cross', hardness: 0 });
def(34, { name: 'Poppy', tex: 'poppy', solid: false, opaque: false, filter: 0, shape: 'cross', hardness: 0 });
def(35, { name: 'White Wool', tex: 'wool_white', hardness: 0.8 });
def(36, { name: 'TNT', tex: { top: 'tnt_top', bottom: 'tnt_bottom', side: 'tnt_side' }, hardness: 0 });
def(37, { name: 'Bed', tex: { top: 'bed_top', bottom: 'planks', side: 'bed_side' }, hardness: 0.2, shape: 'slab', opaque: false, filter: 0 });
def(38, { name: 'Glowstone', tex: 'glowstone', light: 15, hardness: 0.3 });
def(39, { name: 'Lava', tex: 'lava', solid: false, opaque: false, liquid: true, light: 15, filter: 2, hardness: -1, cullSame: true, creative: false });
def(40, { name: 'Obsidian', tex: 'obsidian', hardness: 15, tool: 'pickaxe', tier: 4 });
def(41, { name: 'Bookshelf', tex: { top: 'planks', bottom: 'planks', side: 'bookshelf' }, hardness: 1.5, tool: 'axe' });
def(42, { name: 'Clay', tex: 'clay', hardness: 0.6, tool: 'shovel' });
def(43, { name: 'Block of Iron', tex: 'iron_block', hardness: 5, tool: 'pickaxe', tier: 2 });
def(44, { name: 'Block of Gold', tex: 'gold_block', hardness: 3, tool: 'pickaxe', tier: 3 });
def(45, { name: 'Block of Diamond', tex: 'diamond_block', hardness: 5, tool: 'pickaxe', tier: 3 });
def(46, { name: 'Pumpkin', tex: { top: 'pumpkin_top', bottom: 'pumpkin_top', side: 'pumpkin_side', front: 'pumpkin_face' }, hardness: 1, tool: 'axe' });
def(47, { name: 'Snow Block', tex: 'snow', hardness: 0.2, tool: 'shovel' });
def(48, { name: 'Mossy Cobblestone', tex: 'mossy', hardness: 2, tool: 'pickaxe', tier: 1 });
def(49, { name: 'Red Wool', tex: 'wool_red', hardness: 0.8 });
def(50, { name: 'Blue Wool', tex: 'wool_blue', hardness: 0.8 });
def(51, { name: 'Green Wool', tex: 'wool_green', hardness: 0.8 });
def(52, { name: 'Yellow Wool', tex: 'wool_yellow', hardness: 0.8 });
def(53, { name: 'Black Wool', tex: 'wool_black', hardness: 0.8 });
def(54, { name: 'Lit Furnace', tex: { top: 'furnace_top', bottom: 'furnace_top', side: 'furnace_side', front: 'furnace_front_on' }, light: 13, hardness: 3.5, tool: 'pickaxe', tier: 1, drop: 26, creative: false });
def(55, { name: 'Dead Bush', tex: 'dead_bush', solid: false, opaque: false, filter: 0, shape: 'cross', hardness: 0, drop: I.STICK });
def(56, { name: "Jack o'Lantern", tex: { top: 'pumpkin_top', bottom: 'pumpkin_top', side: 'pumpkin_side', front: 'jack_face' }, light: 15, hardness: 1, tool: 'axe' });
def(57, { name: 'Block of Coal', tex: 'coal_block', hardness: 5, tool: 'pickaxe', tier: 1 });

export const ITEMS = {};
const it = (id, name, o = {}) => (ITEMS[id] = Object.assign({ id, name, stack: 64 }, o));
it(I.STICK, 'Stick'); it(I.COAL, 'Coal'); it(I.IRON_INGOT, 'Iron Ingot'); it(I.GOLD_INGOT, 'Gold Ingot');
it(I.DIAMOND, 'Diamond'); it(I.REDSTONE, 'Redstone Dust'); it(I.APPLE, 'Apple', { food: 4 });
it(I.RAW_PORK, 'Raw Porkchop', { food: 3 }); it(I.COOKED_PORK, 'Cooked Porkchop', { food: 8 });
it(I.RAW_BEEF, 'Raw Beef', { food: 3 }); it(I.STEAK, 'Steak', { food: 8 });
it(I.GUNPOWDER, 'Gunpowder'); it(I.ROTTEN_FLESH, 'Rotten Flesh', { food: 4 }); it(I.FLINT, 'Flint');
it(I.FLINT_STEEL, 'Flint and Steel', { stack: 1, dur: 64 });
it(I.RAW_MUTTON, 'Raw Mutton', { food: 2 }); it(I.COOKED_MUTTON, 'Cooked Mutton', { food: 6 });
it(I.BREAD, 'Bread', { food: 5 }); it(I.BONE, 'Bone'); it(I.ARROW, 'Arrow');
it(I.BUCKET, 'Bucket', { stack: 16 }); it(I.WATER_BUCKET, 'Water Bucket', { stack: 1 }); it(I.LAVA_BUCKET, 'Lava Bucket', { stack: 1 });
for (let m = 0; m < 5; m++) for (let t = 0; t < 4; t++) {
  const n = TOOL_MATS[m][0].toUpperCase() + TOOL_MATS[m].slice(1) + ' ' + TOOL_TYPES[t][0].toUpperCase() + TOOL_TYPES[t].slice(1);
  it(toolId(m, t), n, { stack: 1, dur: MAT_INFO[m].dur, tool: true });
}

export const isBlock = (id) => id > 0 && id < 100;
export const itemName = (id) => isBlock(id) ? BLOCKS[id].name : (ITEMS[id] ? ITEMS[id].name : '?');
export const maxStack = (id) => isBlock(id) ? 64 : (ITEMS[id] ? ITEMS[id].stack : 64);
export const maxDur = (id) => ITEMS[id] && ITEMS[id].dur ? ITEMS[id].dur : 0;

// Creative inventory ordering
export const CREATIVE_LIST = [
  1, 2, 3, 4, 48, 5, 6, 7, 31, 42, 8, 21, 23, 10, 9, 22, 24, 12, 19, 47, 18, 20, 13, 14, 15, 16, 17, 57, 43, 44, 45,
  40, 29, 30, 41, 35, 49, 50, 51, 52, 53, 25, 26, 27, 28, 38, 46, 56, 36, 37, 32, 33, 34, 55,
  I.STICK, I.COAL, I.IRON_INGOT, I.GOLD_INGOT, I.DIAMOND, I.REDSTONE, I.FLINT, I.FLINT_STEEL, I.BUCKET, I.WATER_BUCKET, I.LAVA_BUCKET, I.GUNPOWDER, I.BONE,
  I.APPLE, I.BREAD, I.RAW_PORK, I.COOKED_PORK, I.RAW_BEEF, I.STEAK, I.RAW_MUTTON, I.COOKED_MUTTON, I.ROTTEN_FLESH,
  ...[0, 1, 2, 3, 4].flatMap((m) => [0, 1, 2, 3].map((t) => toolId(m, t))),
];

// ---------- Recipes ----------
// pattern rows; key letter -> id or group name
const LOGS = [8, 21, 23];
const groupMatch = (want, have) => {
  if (want === 'log') return LOGS.includes(have);
  return want === have;
};
export const RECIPES = [];
const shaped = (rows, key, out, count = 1) => RECIPES.push({ rows, key, out, count });
const shapeless = (ins, out, count = 1) => RECIPES.push({ shapeless: ins, out, count });

shapeless(['log'], 10, 4);
shaped(['P', 'P'], { P: 10 }, I.STICK, 4);
shaped(['PP', 'PP'], { P: 10 }, 25);
shaped(['C', 'S'], { C: I.COAL, S: I.STICK }, 28, 4);
shaped(['CCC', 'C C', 'CCC'], { C: 4 }, 26);
shaped(['PPP', 'P P', 'PPP'], { P: 10 }, 27);
shaped(['SS', 'SS'], { S: 3 }, 30, 4);
shaped(['SS', 'SS'], { S: 6 }, 31);
shaped(['SS', 'SS'], { S: 47 }, 47);
shaped(['GSG', 'SGS', 'GSG'], { G: I.GUNPOWDER, S: 6 }, 36);
shaped(['WWW', 'PPP'], { W: 35, P: 10 }, 37);
shaped(['PPP', 'SSS', 'PPP'], { P: 10, S: I.STICK }, 41);
shaped(['III', 'III', 'III'], { I: I.IRON_INGOT }, 43);
shaped(['III', 'III', 'III'], { I: I.GOLD_INGOT }, 44);
shaped(['III', 'III', 'III'], { I: I.DIAMOND }, 45);
shaped(['III', 'III', 'III'], { I: I.COAL }, 57);
shapeless([43], I.IRON_INGOT, 9); shapeless([44], I.GOLD_INGOT, 9); shapeless([45], I.DIAMOND, 9); shapeless([57], I.COAL, 9);
shapeless([I.IRON_INGOT, I.FLINT], I.FLINT_STEEL);
shaped(['I I', ' I '], { I: I.IRON_INGOT }, I.BUCKET);
shapeless([35, 34], 49); shapeless([35, 33], 52); shapeless([35, I.COAL], 53);
shapeless([46, 28], 56);
shapeless([4, 9], 48);
shaped(['GG', 'GG'], { G: 12 }, 38);
const MATS = [10, 4, I.IRON_INGOT, I.GOLD_INGOT, I.DIAMOND];
for (let m = 0; m < 5; m++) {
  const k = { M: MATS[m], S: I.STICK };
  shaped(['MMM', ' S ', ' S '], k, toolId(m, 0));
  shaped(['MM', 'MS', ' S'], k, toolId(m, 1));
  shaped(['M', 'S', 'S'], k, toolId(m, 2));
  shaped(['M', 'M', 'S'], k, toolId(m, 3));
}

// grid: array of ids (0 empty), size n x n
export function matchRecipe(grid, n) {
  let minx = n, miny = n, maxx = -1, maxy = -1;
  const items = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const v = grid[y * n + x];
    if (v) { items.push(v); minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, y); maxy = Math.max(maxy, y); }
  }
  if (!items.length) return null;
  const w = maxx - minx + 1, h = maxy - miny + 1;
  for (const r of RECIPES) {
    if (r.shapeless) {
      if (r.shapeless.length !== items.length) continue;
      const pool = items.slice(); let ok = true;
      for (const want of r.shapeless) {
        const idx = pool.findIndex((h2) => groupMatch(want, h2));
        if (idx < 0) { ok = false; break; } pool.splice(idx, 1);
      }
      if (ok) return r;
      continue;
    }
    const rh = r.rows.length, rw = Math.max(...r.rows.map((s) => s.length));
    if (rh !== h || rw !== w) continue;
    for (const mirror of [false, true]) {
      let ok = true;
      for (let y = 0; y < h && ok; y++) for (let x = 0; x < w && ok; x++) {
        const ch = (r.rows[y][mirror ? w - 1 - x : x] || ' ');
        const have = grid[(y + miny) * n + (x + minx)];
        if (ch === ' ') { if (have) ok = false; } else if (!have || !groupMatch(r.key[ch], have)) ok = false;
      }
      if (ok) return r;
    }
  }
  return null;
}

export const SMELT = {
  14: I.IRON_INGOT, 15: I.GOLD_INGOT, 6: 12, 4: 3, 42: 29, [I.RAW_PORK]: I.COOKED_PORK, [I.RAW_BEEF]: I.STEAK,
  [I.RAW_MUTTON]: I.COOKED_MUTTON, 8: I.COAL, 21: I.COAL, 23: I.COAL, 20: 51, 13: I.COAL, 16: I.DIAMOND, 30: 3,
};
// fuel: number of items smelted
export const FUEL = { [I.COAL]: 8, 57: 80, 10: 1.5, 8: 1.5, 21: 1.5, 23: 1.5, [I.STICK]: 0.5, 25: 1.5, 27: 1.5, 41: 1.5 };
for (const t of [0, 1, 2, 3]) FUEL[toolId(0, t)] = 1;
