// Block + item registry, recipes, smelting
export const B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, COBBLE: 4, BEDROCK: 5, SAND: 6, GRAVEL: 7, OAK_LOG: 8, OAK_LEAVES: 9,
  PLANKS: 10, WATER: 11, GLASS: 12, COAL_ORE: 13, IRON_ORE: 14, GOLD_ORE: 15, DIAMOND_ORE: 16, REDSTONE_ORE: 17,
  SNOW_GRASS: 18, ICE: 19, CACTUS: 20, BIRCH_LOG: 21, BIRCH_LEAVES: 22, SPRUCE_LOG: 23, SPRUCE_LEAVES: 24,
  TABLE: 25, FURNACE: 26, CHEST: 27, TORCH: 28, BRICKS: 29, STONE_BRICKS: 30, SANDSTONE: 31, TALL_GRASS: 32,
  DANDELION: 33, POPPY: 34, WOOL: 35, TNT: 36, BED: 37, GLOWSTONE: 38, LAVA: 39, OBSIDIAN: 40, BOOKSHELF: 41,
  CLAY: 42, IRON_BLOCK: 43, GOLD_BLOCK: 44, DIAMOND_BLOCK: 45, PUMPKIN: 46, SNOW_BLOCK: 47, MOSSY: 48,
  RED_WOOL: 49, BLUE_WOOL: 50, GREEN_WOOL: 51, YELLOW_WOOL: 52, BLACK_WOOL: 53, LIT_FURNACE: 54, DEAD_BUSH: 55,
  JACK_O: 56, COAL_BLOCK: 57, PATH: 58, FARMLAND: 59, WHEAT_0: 60, WHEAT_1: 61, WHEAT_2: 62, WHEAT_3: 63, HAY: 64,
  BELL: 65, WHITE_CONCRETE: 66, GRAY_CONCRETE: 67, ASPHALT: 68, YELLOW_CONCRETE: 69, SMOOTH_STONE: 70, LAMP: 71,
  FENCE: 72, EMERALD_ORE: 73, EMERALD_BLOCK: 74, TERRACOTTA: 75, WINDOW: 76,
  ENCHANT_TABLE: 77, NETHERRACK: 78, SOUL_SAND: 79, QUARTZ_ORE: 80, NETHER_BRICKS: 81, PORTAL: 82, MAGMA: 83,
  NETHER_GOLD_ORE: 84, CRIMSON_NYLIUM: 85, CRIMSON_STEM: 86, WART_BLOCK: 87, SHROOMLIGHT: 88, BASALT: 89, SPAWNER: 90,
  QUARTZ_BLOCK: 91, SUGAR_CANE: 92, LAPIS_ORE: 93, LAPIS_BLOCK: 94, CRIMSON_FUNGUS: 95, SOUL_SOIL: 96,
  GLASS_BLUE: 170, GLASS_DARK: 171, LIT_WINDOW: 172, STEEL: 173, BLACK_CONCRETE: 174, BLUE_CONCRETE: 175, RED_CONCRETE: 176,
  MARBLE: 177, SOLAR_PANEL: 178, LED_SCREEN: 179, LED_AD: 180, LED_AD2: 181, SERVER_RACK: 182, COMPUTER: 183, TV: 184,
  TRAFFIC_LIGHT: 185, AC_UNIT: 186, VENDING: 187, ATM: 188, EV_CHARGER: 189, HELIPAD: 190, ELEVATOR: 191, STEEL_POLE: 192,
  HOSPITAL_SIGN: 193, ROAD_LINE: 194, GREEN_CONCRETE: 195, ORANGE_CONCRETE: 196, PLANTER: 197,
  END_STONE: 97, END_FRAME: 98, END_PORTAL: 99, END_FRAME_EYE: 198, PURPUR: 199, PURPUR_PILLAR: 200, END_BRICKS: 201,
  END_ROD: 202, CHORUS_PLANT: 203, CHORUS_FLOWER: 204, DRAGON_EGG: 205, CRACKED_BRICKS: 206, MOSSY_BRICKS: 207, IRON_BARS: 208,
  SLIME: 209, LADDER: 210, COBWEB: 211, PACKED_ICE: 212, CAMPFIRE: 213,
};
export const I = {
  STICK: 100, COAL: 101, IRON_INGOT: 102, GOLD_INGOT: 103, DIAMOND: 104, REDSTONE: 105, APPLE: 106,
  RAW_PORK: 107, COOKED_PORK: 108, RAW_BEEF: 109, STEAK: 110, GUNPOWDER: 111, ROTTEN_FLESH: 112, FLINT: 113,
  FLINT_STEEL: 114, RAW_MUTTON: 117, COOKED_MUTTON: 118, BREAD: 119, BONE: 120, ARROW: 121, BUCKET: 122, WATER_BUCKET: 123, LAVA_BUCKET: 124,
  SEEDS: 125, WHEAT: 126, EMERALD: 127, HOE: 128,
  LAPIS: 150, BOOK: 151, PAPER: 152, LEATHER: 153, QUARTZ: 154, GOLD_NUGGET: 155, BLAZE_ROD: 156, BLAZE_POWDER: 157,
  GHAST_TEAR: 158, MAGMA_CREAM: 159, NETHER_BRICK: 160,
  SMARTPHONE: 300, CAR: 301, CIRCUIT: 302, BATTERY: 303, DRONE: 304,
  EYE_OF_ENDER: 305, ENDER_PEARL: 306, ELYTRA: 307, FIREWORK: 308, BOW: 309, RAW_CHICKEN: 310, COOKED_CHICKEN: 311, EGG: 312, FEATHER: 313, CHORUS_FRUIT: 314, STRING: 315,
  COMPASS: 340, CLOCK: 341, BOAT: 342, SHEARS: 343, MILK_BUCKET: 344, FISHING_ROD: 345, RAW_COD: 346, COOKED_COD: 347, SLIME_BALL: 348, SHIELD: 349, TRIDENT: 350,
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
def(58, { name: 'Dirt Path', tex: { top: 'path_top', bottom: 'dirt', side: 'path_side' }, hardness: 0.6, tool: 'shovel', drop: 2 });
def(59, { name: 'Farmland', tex: { top: 'farmland', bottom: 'dirt', side: 'dirt' }, hardness: 0.6, tool: 'shovel', drop: 2 });
for (let s = 0; s < 4; s++) def(60 + s, { name: 'Wheat Crops', tex: 'wheat_' + s, solid: false, opaque: false, filter: 0, shape: 'cross', hardness: 0, drop: 'wheat', creative: s === 3 });
def(64, { name: 'Hay Bale', tex: { top: 'hay_top', bottom: 'hay_top', side: 'hay_side' }, hardness: 0.5 });
def(65, { name: 'Bell', tex: { top: 'bell_top', bottom: 'bell_top', side: 'bell' }, opaque: false, filter: 0, shape: 'cactus', hardness: 1, tool: 'pickaxe' });
def(66, { name: 'White Concrete', tex: 'concrete_white', hardness: 1.8, tool: 'pickaxe', tier: 1 });
def(67, { name: 'Gray Concrete', tex: 'concrete_gray', hardness: 1.8, tool: 'pickaxe', tier: 1 });
def(68, { name: 'Asphalt', tex: 'asphalt', hardness: 1.8, tool: 'pickaxe', tier: 1 });
def(69, { name: 'Yellow Concrete', tex: 'concrete_yellow', hardness: 1.8, tool: 'pickaxe', tier: 1 });
def(70, { name: 'Smooth Stone', tex: 'smooth_stone', hardness: 2, tool: 'pickaxe', tier: 1 });
def(71, { name: 'Lamp', tex: 'lamp', light: 15, hardness: 0.3 });
def(72, { name: 'Oak Fence', tex: 'planks', opaque: false, filter: 0, shape: 'post', hardness: 2, tool: 'axe' });
def(73, { name: 'Emerald Ore', tex: 'emerald_ore', hardness: 3, tool: 'pickaxe', tier: 3, drop: I.EMERALD });
def(74, { name: 'Block of Emerald', tex: 'emerald_block', hardness: 5, tool: 'pickaxe', tier: 3 });
def(75, { name: 'Terracotta', tex: 'terracotta', hardness: 1.25, tool: 'pickaxe', tier: 1 });
def(76, { name: 'Tinted Window', tex: 'window', opaque: false, filter: 0, hardness: 0.3, cullSame: true, drop: 0 });
def(77, { name: 'Enchanting Table', tex: { top: 'ench_top', bottom: 'obsidian', side: 'ench_side' }, shape: 'table', opaque: false, filter: 0, light: 7, hardness: 5, tool: 'pickaxe', tier: 1 });
def(78, { name: 'Netherrack', tex: 'netherrack', hardness: 0.4, tool: 'pickaxe', tier: 1 });
def(79, { name: 'Soul Sand', tex: 'soul_sand', hardness: 0.5, tool: 'shovel' });
def(80, { name: 'Nether Quartz Ore', tex: 'quartz_ore', hardness: 3, tool: 'pickaxe', tier: 1, drop: I.QUARTZ });
def(81, { name: 'Nether Bricks', tex: 'nether_bricks', hardness: 2, tool: 'pickaxe', tier: 1 });
def(82, { name: 'Nether Portal', tex: 'portal', solid: false, opaque: false, filter: 0, light: 11, hardness: -1, shape: 'pane', translucent: true, creative: false, drop: 0 });
def(83, { name: 'Magma Block', tex: 'magma', light: 3, hardness: 0.5, tool: 'pickaxe', tier: 1 });
def(84, { name: 'Nether Gold Ore', tex: 'nether_gold_ore', hardness: 3, tool: 'pickaxe', tier: 1, drop: 'nuggets' });
def(85, { name: 'Crimson Nylium', tex: { top: 'nylium_top', bottom: 'netherrack', side: 'nylium_side' }, hardness: 0.4, tool: 'pickaxe', tier: 1, drop: 78 });
def(86, { name: 'Crimson Stem', tex: { top: 'crimson_stem_top', bottom: 'crimson_stem_top', side: 'crimson_stem' }, hardness: 2, tool: 'axe' });
def(87, { name: 'Nether Wart Block', tex: 'wart_block', hardness: 1 });
def(88, { name: 'Shroomlight', tex: 'shroomlight', light: 15, hardness: 1 });
def(89, { name: 'Basalt', tex: { top: 'basalt_top', bottom: 'basalt_top', side: 'basalt_side' }, hardness: 1.25, tool: 'pickaxe', tier: 1 });
def(90, { name: 'Monster Spawner', tex: 'spawner', opaque: false, cutout: true, filter: 1, hardness: 5, tool: 'pickaxe', tier: 1, drop: 0, creative: false });
def(91, { name: 'Block of Quartz', tex: { top: 'quartz_top', bottom: 'quartz_top', side: 'quartz_side' }, hardness: 0.8, tool: 'pickaxe', tier: 1 });
def(92, { name: 'Sugar Cane', tex: 'sugar_cane', solid: false, opaque: false, filter: 0, shape: 'cross', hardness: 0 });
def(93, { name: 'Lapis Lazuli Ore', tex: 'lapis_ore', hardness: 3, tool: 'pickaxe', tier: 2, drop: 'lapis' });
def(94, { name: 'Block of Lapis Lazuli', tex: 'lapis_block', hardness: 3, tool: 'pickaxe', tier: 2 });
def(95, { name: 'Crimson Fungus', tex: 'crimson_fungus', solid: false, opaque: false, filter: 0, shape: 'cross', hardness: 0 });
def(96, { name: 'Soul Soil', tex: 'soul_soil', hardness: 0.5, tool: 'shovel' });
def(41, { name: 'Bookshelf', tex: { top: 'planks', bottom: 'planks', side: 'bookshelf' }, hardness: 1.5, tool: 'axe', drop: 'books' });

// ---------- modern 2025 tech blocks ----------
const pk = { tool: 'pickaxe', tier: 1 };
def(170, { name: 'Blue Curtain Glass', tex: 'glass_blue', opaque: false, filter: 0, hardness: 0.4, cullSame: true, drop: 0 });
def(171, { name: 'Smoked Glass', tex: 'glass_dark', opaque: false, filter: 0, hardness: 0.4, cullSame: true, drop: 0 });
def(172, { name: 'Lit Office Window', tex: 'lit_window', light: 10, hardness: 0.4, drop: 0 });
def(173, { name: 'Steel Block', tex: 'steel', hardness: 5, ...pk });
def(174, { name: 'Black Concrete', tex: 'black_concrete', hardness: 1.8, ...pk });
def(175, { name: 'Blue Concrete', tex: 'blue_concrete', hardness: 1.8, ...pk });
def(176, { name: 'Red Concrete', tex: 'red_concrete', hardness: 1.8, ...pk });
def(177, { name: 'Marble', tex: 'marble', hardness: 2, ...pk });
def(178, { name: 'Solar Panel', tex: { top: 'solar_top', bottom: 'steel', side: 'solar_side' }, shape: 'slab', opaque: false, filter: 0, hardness: 1.5, ...pk });
def(179, { name: 'LED Screen', tex: 'led_screen', light: 13, hardness: 1, ...pk });
def(180, { name: 'LED Billboard', tex: 'led_ad', light: 13, hardness: 1, ...pk });
def(181, { name: 'LED Sign', tex: 'led_ad2', light: 13, hardness: 1, ...pk });
def(182, { name: 'Server Rack', tex: { top: 'steel', bottom: 'steel', side: 'rack_side', front: 'rack_front' }, light: 4, hardness: 3, ...pk });
def(183, { name: 'Computer Desk', tex: { top: 'pc_top', bottom: 'planks', side: 'pc_side', front: 'pc_front' }, opaque: false, cutout: true, filter: 0, light: 5, hardness: 1.5, tool: 'axe' });
def(184, { name: 'Smart TV', tex: { top: 'black_concrete', bottom: 'black_concrete', side: 'black_concrete', front: 'tv_front' }, light: 6, hardness: 1, ...pk });
def(185, { name: 'Traffic Light', tex: { top: 'black_concrete', bottom: 'black_concrete', side: 'traffic_side' }, shape: 'cactus', opaque: false, filter: 0, light: 9, hardness: 2, ...pk });
def(186, { name: 'AC Unit', tex: { top: 'ac_top', bottom: 'steel', side: 'ac_side', front: 'ac_front' }, hardness: 2, ...pk });
def(187, { name: 'Vending Machine', tex: { top: 'steel', bottom: 'steel', side: 'vend_side', front: 'vend_front' }, light: 8, hardness: 2.5, ...pk });
def(188, { name: 'ATM', tex: { top: 'steel', bottom: 'steel', side: 'atm_side', front: 'atm_front' }, light: 5, hardness: 3, ...pk });
def(189, { name: 'EV Charger', tex: { top: 'ev_top', bottom: 'ev_top', side: 'ev_side' }, shape: 'cactus', opaque: false, filter: 0, light: 6, hardness: 2, ...pk });
def(190, { name: 'Helipad', tex: { top: 'helipad', bottom: 'concrete_gray', side: 'concrete_gray' }, hardness: 2, ...pk });
def(191, { name: 'Elevator', tex: { top: 'steel', bottom: 'steel', side: 'steel', front: 'elevator' }, light: 4, hardness: 4, ...pk });
def(192, { name: 'Steel Pole', tex: 'steel', opaque: false, filter: 0, shape: 'post', hardness: 2, ...pk });
def(193, { name: 'Hospital Sign', tex: 'hospital_sign', light: 12, hardness: 1, ...pk });
def(194, { name: 'Road Marking', tex: 'road_line', hardness: 1.8, ...pk });
def(195, { name: 'Green Concrete', tex: 'green_concrete', hardness: 1.8, ...pk });
def(196, { name: 'Orange Concrete', tex: 'orange_concrete', hardness: 1.8, ...pk });
def(97, { name: 'End Stone', tex: 'end_stone', hardness: 3, tool: 'pickaxe', tier: 1 });
def(98, { name: 'End Portal Frame', tex: { top: 'frame_top', bottom: 'end_stone', side: 'frame_side' }, hardness: -1, light: 1, creative: true });
def(99, { name: 'End Portal', tex: 'end_portal', solid: false, opaque: false, filter: 0, light: 15, hardness: -1, shape: 'slab', creative: false, drop: 0 });
def(198, { name: 'End Portal Frame (Eye)', tex: { top: 'frame_top_eye', bottom: 'end_stone', side: 'frame_side' }, hardness: -1, light: 1, creative: false, drop: 0 });
def(199, { name: 'Purpur Block', tex: 'purpur', hardness: 1.5, tool: 'pickaxe', tier: 1 });
def(200, { name: 'Purpur Pillar', tex: { top: 'purpur_pillar_top', bottom: 'purpur_pillar_top', side: 'purpur_pillar' }, hardness: 1.5, tool: 'pickaxe', tier: 1 });
def(201, { name: 'End Stone Bricks', tex: 'end_bricks', hardness: 3, tool: 'pickaxe', tier: 1 });
def(202, { name: 'End Rod', tex: 'end_rod', solid: false, opaque: false, filter: 0, shape: 'torch', light: 14, hardness: 0 });
def(203, { name: 'Chorus Plant', tex: 'chorus_plant', opaque: false, filter: 0, shape: 'post', hardness: 0.4, drop: I.CHORUS_FRUIT });
def(204, { name: 'Chorus Flower', tex: 'chorus_flower', hardness: 0.4, light: 4 });
def(205, { name: 'Dragon Egg', tex: 'dragon_egg', light: 1, hardness: 3, gravity: true });
def(206, { name: 'Cracked Stone Bricks', tex: 'cracked_bricks', hardness: 1.5, tool: 'pickaxe', tier: 1 });
def(207, { name: 'Mossy Stone Bricks', tex: 'mossy_bricks', hardness: 1.5, tool: 'pickaxe', tier: 1 });
def(208, { name: 'Iron Bars', tex: 'iron_bars', opaque: false, cutout: true, filter: 0, hardness: 5, tool: 'pickaxe', tier: 1, cullSame: true });
def(209, { name: 'Slime Block', tex: 'slime', opaque: false, filter: 0, translucent: true, hardness: 0 });
def(210, { name: 'Ladder', tex: 'ladder', solid: false, opaque: false, cutout: true, filter: 0, shape: 'ladder', hardness: 0.4, tool: 'axe' });
def(211, { name: 'Cobweb', tex: 'cobweb', solid: false, opaque: false, cutout: true, filter: 0, shape: 'cross', hardness: 4, tool: 'sword', drop: I.STRING });
def(212, { name: 'Packed Ice', tex: 'packed_ice', hardness: 0.5, tool: 'pickaxe' });
def(213, { name: 'Campfire', tex: { top: 'campfire_top', bottom: 'oak_log_top', side: 'campfire_side' }, opaque: false, filter: 0, shape: 'slab', light: 15, hardness: 2, tool: 'axe', drop: I.COAL });
def(197, { name: 'Planter', tex: { top: 'grass_top', bottom: 'concrete_gray', side: 'planter_side' }, hardness: 1.5, ...pk });

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
it(I.SEEDS, 'Wheat Seeds'); it(I.WHEAT, 'Wheat'); it(I.EMERALD, 'Emerald'); it(I.HOE, 'Hoe', { stack: 1, dur: 250 });
it(I.LAPIS, 'Lapis Lazuli'); it(I.BOOK, 'Book'); it(I.PAPER, 'Paper'); it(I.LEATHER, 'Leather'); it(I.QUARTZ, 'Nether Quartz');
it(I.GOLD_NUGGET, 'Gold Nugget'); it(I.BLAZE_ROD, 'Blaze Rod'); it(I.BLAZE_POWDER, 'Blaze Powder'); it(I.GHAST_TEAR, 'Ghast Tear');
it(I.MAGMA_CREAM, 'Magma Cream'); it(I.NETHER_BRICK, 'Nether Brick');
it(I.SMARTPHONE, 'Smartphone', { stack: 1 }); it(I.CAR, 'Electric Car', { stack: 1 }); it(I.CIRCUIT, 'Circuit Board'); it(I.BATTERY, 'Battery'); it(I.DRONE, 'Camera Drone', { stack: 1 });
it(I.EYE_OF_ENDER, 'Eye of Ender'); it(I.ENDER_PEARL, 'Ender Pearl', { stack: 16 }); it(I.ELYTRA, 'Elytra', { stack: 1, dur: 432 });
it(I.FIREWORK, 'Firework Rocket'); it(I.BOW, 'Bow', { stack: 1, dur: 384 }); it(I.RAW_CHICKEN, 'Raw Chicken', { food: 2 }); it(I.COOKED_CHICKEN, 'Cooked Chicken', { food: 6 });
it(I.EGG, 'Egg', { stack: 16 }); it(I.FEATHER, 'Feather'); it(I.CHORUS_FRUIT, 'Chorus Fruit', { food: 4 }); it(I.STRING, 'String');
it(I.COMPASS, 'Compass', { stack: 1 }); it(I.CLOCK, 'Clock', { stack: 1 }); it(I.BOAT, 'Oak Boat', { stack: 1 }); it(I.SHEARS, 'Shears', { stack: 1, dur: 238 });
it(I.MILK_BUCKET, 'Milk Bucket', { stack: 1 }); it(I.FISHING_ROD, 'Fishing Rod', { stack: 1, dur: 64 }); it(I.RAW_COD, 'Raw Cod', { food: 2 }); it(I.COOKED_COD, 'Cooked Cod', { food: 5 });
it(I.SLIME_BALL, 'Slimeball'); it(I.SHIELD, 'Shield', { stack: 1, dur: 336 }); it(I.TRIDENT, 'Trident', { stack: 1, dur: 250 });
// armor: 320 + mat*4 + piece
export const ARMOR_MATS = ['leather', 'iron', 'golden', 'diamond', 'netherite'];
export const ARMOR_PIECES = ['helmet', 'chestplate', 'leggings', 'boots'];
export const ARMOR_INFO = [
  { def: [1, 3, 2, 1], mult: 5, tough: 0, color: '#9a5a30', dark: '#6a3a18' },
  { def: [2, 6, 5, 2], mult: 15, tough: 0, color: '#e0e0e0', dark: '#9a9a9a' },
  { def: [2, 5, 3, 1], mult: 7, tough: 0, color: '#f8d848', dark: '#c09020' },
  { def: [3, 8, 6, 3], mult: 33, tough: 2, color: '#6ff2e8', dark: '#2bb8b0' },
  { def: [3, 8, 6, 3], mult: 37, tough: 3, color: '#4a4248', dark: '#2a2228' },
];
const ARMOR_BASE_DUR = [11, 16, 15, 13];
export const armorId = (m, p) => 320 + m * 4 + p;
export const isArmor = (id) => id >= 320 && id < 340;
export const armorInfo = (id) => { const m = Math.floor((id - 320) / 4), p = (id - 320) % 4; return { mat: m, piece: p, def: ARMOR_INFO[m].def[p], tough: ARMOR_INFO[m].tough, color: ARMOR_INFO[m].color, dark: ARMOR_INFO[m].dark }; };
for (let m = 0; m < 5; m++) for (let p = 0; p < 4; p++) {
  const n = ARMOR_MATS[m][0].toUpperCase() + ARMOR_MATS[m].slice(1) + ' ' + ARMOR_PIECES[p][0].toUpperCase() + ARMOR_PIECES[p].slice(1);
  it(armorId(m, p), n, { stack: 1, dur: ARMOR_BASE_DUR[p] * ARMOR_INFO[m].mult, armor: true });
}
it(I.BUCKET, 'Bucket', { stack: 16 }); it(I.WATER_BUCKET, 'Water Bucket', { stack: 1 }); it(I.LAVA_BUCKET, 'Lava Bucket', { stack: 1 });
for (let m = 0; m < 5; m++) for (let t = 0; t < 4; t++) {
  const n = TOOL_MATS[m][0].toUpperCase() + TOOL_MATS[m].slice(1) + ' ' + TOOL_TYPES[t][0].toUpperCase() + TOOL_TYPES[t].slice(1);
  it(toolId(m, t), n, { stack: 1, dur: MAT_INFO[m].dur, tool: true });
}

export const isBlock = (id) => (id > 0 && id < 100) || (id >= 170 && id < 256);
export const itemName = (id) => isBlock(id) ? BLOCKS[id].name : (ITEMS[id] ? ITEMS[id].name : '?');
export const maxStack = (id) => isBlock(id) ? 64 : (ITEMS[id] ? ITEMS[id].stack : 64);
export const maxDur = (id) => ITEMS[id] && ITEMS[id].dur ? ITEMS[id].dur : 0;

// Creative inventory ordering
export const CREATIVE_LIST = [
  1, 2, 3, 4, 48, 5, 6, 7, 31, 42, 8, 21, 23, 10, 9, 22, 24, 12, 19, 47, 18, 20, 13, 14, 15, 16, 17, 57, 43, 44, 45,
  74, 73, 93, 94, 40, 77, 78, 79, 96, 80, 84, 81, 83, 85, 86, 87, 88, 89, 91, 95, 92, 29, 30, 70, 66, 67, 68, 69, 75, 76, 58, 59, 64, 65, 71, 72, 63, 41, 35, 49, 50, 51, 52, 53, 25, 26, 27, 28, 38, 46, 56, 36, 37, 32, 33, 34, 55,
  97, 201, 199, 200, 202, 203, 204, 205, 98, 30, 206, 207, 208, 170, 171, 172, 173, 174, 175, 176, 195, 196, 177, 194, 197, 178, 179, 180, 181, 182, 183, 184, 185, 186, 187, 188, 189, 190, 191, 192, 193,
  I.SMARTPHONE, I.CAR, I.DRONE, I.CIRCUIT, I.BATTERY,
  I.EYE_OF_ENDER, I.ENDER_PEARL, I.ELYTRA, I.FIREWORK, I.BOW, I.ARROW, I.STRING, I.FEATHER, I.EGG, I.RAW_CHICKEN, I.COOKED_CHICKEN, I.CHORUS_FRUIT,
  210, 209, 211, 212, 213, I.COMPASS, I.CLOCK, I.BOAT, I.SHEARS, I.FISHING_ROD, I.RAW_COD, I.COOKED_COD, I.SLIME_BALL, I.SHIELD, I.MILK_BUCKET,
  ...[0, 1, 2, 3, 4].flatMap((m) => [0, 1, 2, 3].map((p) => armorId(m, p))),
  I.STICK, I.COAL, I.EMERALD, I.LAPIS, I.BOOK, I.PAPER, I.LEATHER, I.QUARTZ, I.GOLD_NUGGET, I.BLAZE_ROD, I.BLAZE_POWDER, I.GHAST_TEAR, I.MAGMA_CREAM, I.NETHER_BRICK, I.SEEDS, I.WHEAT, I.HOE, I.IRON_INGOT, I.GOLD_INGOT, I.DIAMOND, I.REDSTONE, I.FLINT, I.FLINT_STEEL, I.BUCKET, I.WATER_BUCKET, I.LAVA_BUCKET, I.GUNPOWDER, I.BONE,
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
shaped(['PPP', 'BBB', 'PPP'], { P: 10, B: I.BOOK }, 41);
shaped(['SSS'], { S: 92 }, I.PAPER, 3);
shapeless([I.PAPER, I.PAPER, I.PAPER, I.LEATHER], I.BOOK);
shaped(['S S', 'SSS', 'S S'], { S: I.STICK }, 210, 3);
shaped(['SSS', 'SSS', 'SSS'], { S: I.SLIME_BALL }, 209); shapeless([209], I.SLIME_BALL, 9);
shaped(['SS', 'SS'], { S: 19 }, 212);
shaped([' S ', 'SCS', 'LLL'], { S: I.STICK, C: I.COAL, L: 8 }, 213);
shaped([' I ', 'IRI', ' I '], { I: I.IRON_INGOT, R: I.REDSTONE }, I.COMPASS);
shaped([' G ', 'GRG', ' G '], { G: I.GOLD_INGOT, R: I.REDSTONE }, I.CLOCK);
shaped(['P P', 'PPP'], { P: 10 }, I.BOAT);
shaped([' I', 'I '], { I: I.IRON_INGOT }, I.SHEARS);
shaped(['  S', ' ST', 'S T'], { S: I.STICK, T: I.STRING }, I.FISHING_ROD);
shaped(['PIP', 'PPP', ' P '], { P: 10, I: I.IRON_INGOT }, I.SHIELD);
for (const [m, mat] of [[0, I.LEATHER], [1, I.IRON_INGOT], [2, I.GOLD_INGOT], [3, I.DIAMOND]]) {
  shaped(['XXX', 'X X'], { X: mat }, armorId(m, 0)); shaped(['X X', 'XXX', 'XXX'], { X: mat }, armorId(m, 1));
  shaped(['XXX', 'X X', 'X X'], { X: mat }, armorId(m, 2)); shaped(['X X', 'X X'], { X: mat }, armorId(m, 3));
}
shaped([' B ', 'DOD', 'OOO'], { B: I.BOOK, D: I.DIAMOND, O: 40 }, 77);
shaped(['III', 'III', 'III'], { I: I.LAPIS }, 94); shapeless([94], I.LAPIS, 9);
shaped(['III', 'III', 'III'], { I: I.GOLD_NUGGET }, I.GOLD_INGOT); shapeless([I.GOLD_INGOT], I.GOLD_NUGGET, 9);
shaped(['QQ', 'QQ'], { Q: I.QUARTZ }, 91);
shaped(['NN', 'NN'], { N: I.NETHER_BRICK }, 81);
shapeless([I.BLAZE_ROD], I.BLAZE_POWDER, 2);
shaped(['WWW', 'WWW', 'WWW'], { W: 95 }, 87);
shapeless([86], 10, 4);
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
shaped(['WWW'], { W: I.WHEAT }, I.BREAD);
shaped(['WWW', 'WWW', 'WWW'], { W: I.WHEAT }, 64); shapeless([64], I.WHEAT, 9);
shaped(['EEE', 'EEE', 'EEE'], { E: I.EMERALD }, 74); shapeless([74], I.EMERALD, 9);
shaped(['MM', ' S', ' S'], { M: 10, S: I.STICK }, I.HOE);
shaped(['MM', ' S', ' S'], { M: 4, S: I.STICK }, I.HOE);
shaped(['PSP', 'PSP'], { P: 10, S: I.STICK }, 72, 3);
shaped(['GGG', 'GCG', 'GGG'], { G: 12, C: I.COAL }, 76, 8);
shaped(['SSS'], { S: 3 }, 70, 3);
shaped(['GSG', 'SCS', 'GSG'], { G: 12, S: 6, C: I.COAL }, 71, 2);
shapeless([6, 7, 35], 66, 8); shapeless([6, 7, I.COAL], 68, 8); shapeless([6, 7], 67, 8); shapeless([6, 7, 52], 69, 8);
// modern tech
{ const S = 173, C = I.CIRCUIT;
shaped(['RGR', 'III'], { R: I.REDSTONE, G: I.GOLD_INGOT, I: I.IRON_INGOT }, C, 2);
shaped(['I', 'R', 'I'], { I: I.IRON_INGOT, R: I.REDSTONE }, I.BATTERY, 2);
shaped(['G', 'C', 'B'], { G: 12, C, B: I.BATTERY }, I.SMARTPHONE);
shaped(['GGG', 'ICI', 'PPP'], { G: 12, I: I.IRON_INGOT, C, P: 10 }, 183);
shaped(['GGG', 'GCG'], { G: 171, C }, 184);
shaped(['GGG', 'RLR'], { G: 12, R: I.REDSTONE, L: 38 }, 179, 4);
shapeless([179, I.LAPIS], 180); shapeless([179, I.REDSTONE], 181);
shaped(['GGG', 'LCL'], { G: 12, L: I.LAPIS, C }, 178, 3);
shaped(['II', 'II'], { I: I.IRON_INGOT }, S, 4);
shaped(['S', 'S', 'S'], { S }, 192, 6);
shapeless([12, I.LAPIS], 170, 1); shapeless([12, I.COAL], 171, 1); shapeless([12, 38], 172, 2);
shapeless([91, 66], 177, 2); shapeless([66, I.COAL], 174); shapeless([66, I.LAPIS], 175); shapeless([66, I.REDSTONE], 176);
shapeless([66, 51], 195); shapeless([66, 52, I.REDSTONE], 196); shapeless([68, 66], 194, 2); shapeless([68, 69], 190, 2);
shaped(['SCS', 'SCS', 'SCS'], { S, C }, 182);
shaped(['SSS', 'SCS', 'SSS'], { S, C }, 186);
shaped(['SGS', 'SCS', 'SES'], { S, G: 12, C, E: I.EMERALD }, 187);
shaped(['SGS', 'SCS', 'SBS'], { S, G: 12, C, B: I.GOLD_INGOT }, 188);
shaped(['SB', 'SC'], { S, B: I.BATTERY, C }, 189);
shaped(['SRS', 'SLS', 'SES'], { S, R: I.REDSTONE, L: 38, E: I.EMERALD }, 185);
shaped(['SCS'], { S, C }, 191);
shapeless([66, I.REDSTONE, I.REDSTONE, 38], 193);
shapeless([4, 2, 1], 197, 2);
shaped(['SGS', 'SCS', 'KXK'], { S, G: 12, C, K: 57, X: I.BATTERY }, I.CAR);
shaped([' S ', 'SCS', ' B '], { S, C, B: I.BATTERY }, I.DRONE);
}
shapeless([I.BLAZE_POWDER, I.ENDER_PEARL], I.EYE_OF_ENDER);
shapeless([I.PAPER, I.GUNPOWDER], I.FIREWORK, 3);
shaped([' SW', 'S W', ' SW'], { S: I.STICK, W: I.STRING }, I.BOW);
shaped(['F', 'S', 'E'], { F: I.FLINT, S: I.STICK, E: I.FEATHER }, I.ARROW, 4);
shapeless([35], I.STRING, 4);
shaped(['EE', 'EE'], { E: 97 }, 201, 4);
shaped(['FF', 'FF'], { F: I.CHORUS_FRUIT }, 199, 4);
shaped(['P', 'P'], { P: 199 }, 200);
shaped(['B', 'F'], { B: I.BLAZE_ROD, F: I.CHORUS_FRUIT }, 202, 4);
shaped(['III', 'III'], { I: I.IRON_INGOT }, 208, 16);
shapeless([30, 9], 207);
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
  [I.RAW_COD]: I.COOKED_COD,
  14: I.IRON_INGOT, 15: I.GOLD_INGOT, 6: 12, 4: 3, 73: I.EMERALD, 3: 70, [I.RAW_PORK]: I.COOKED_PORK, [I.RAW_BEEF]: I.STEAK,
  [I.RAW_MUTTON]: I.COOKED_MUTTON, [I.RAW_CHICKEN]: I.COOKED_CHICKEN, [I.CHORUS_FRUIT]: 199, 42: 29, 78: I.NETHER_BRICK, 80: I.QUARTZ, 84: I.GOLD_INGOT, 93: I.LAPIS, 8: I.COAL, 21: I.COAL, 23: I.COAL, 20: 51, 13: I.COAL, 16: I.DIAMOND, 30: 3,
};
// fuel: number of items smelted
export const FUEL = { [I.BLAZE_ROD]: 12, [I.LAVA_BUCKET]: 100, 86: 1.5, [I.COAL]: 8, 64: 4, 72: 1.5, 57: 80, 10: 1.5, 8: 1.5, 21: 1.5, 23: 1.5, [I.STICK]: 0.5, 25: 1.5, 27: 1.5, 41: 1.5 };
for (const t of [0, 1, 2, 3]) FUEL[toolId(0, t)] = 1;

// ---------- Enchantments ----------
export const ENCH = {
  efficiency: { name: 'Efficiency', max: 5, on: ['pickaxe', 'axe', 'shovel', 'hoe'], w: 10 },
  unbreaking: { name: 'Unbreaking', max: 3, on: ['pickaxe', 'axe', 'shovel', 'sword', 'hoe', 'flint', 'bow', 'elytra', 'helmet', 'chestplate', 'leggings', 'boots', 'rod', 'shield', 'shears'], w: 5 },
  fortune: { name: 'Fortune', max: 3, on: ['pickaxe', 'axe', 'shovel'], w: 2, excl: 'silk_touch' },
  power: { name: 'Power', max: 5, on: ['bow'], w: 10 },
  infinity: { name: 'Infinity', max: 1, on: ['bow'], w: 1 },
  silk_touch: { name: 'Silk Touch', max: 1, on: ['pickaxe', 'axe', 'shovel'], w: 1, excl: 'fortune' },
  sharpness: { name: 'Sharpness', max: 5, on: ['sword', 'axe'], w: 10 },
  knockback: { name: 'Knockback', max: 2, on: ['sword'], w: 5 },
  fire_aspect: { name: 'Fire Aspect', max: 2, on: ['sword'], w: 2 },
  looting: { name: 'Looting', max: 3, on: ['sword'], w: 2 },
  protection: { name: 'Protection', max: 4, on: ['helmet', 'chestplate', 'leggings', 'boots'], w: 10 },
  feather_falling: { name: 'Feather Falling', max: 4, on: ['boots'], w: 5 },
  thorns: { name: 'Thorns', max: 3, on: ['helmet', 'chestplate', 'leggings', 'boots'], w: 1 },
  respiration: { name: 'Respiration', max: 3, on: ['helmet'], w: 2 },
  depth_strider: { name: 'Depth Strider', max: 3, on: ['boots'], w: 2 },
  luck_of_the_sea: { name: 'Luck of the Sea', max: 3, on: ['rod'], w: 2 },
  lure: { name: 'Lure', max: 3, on: ['rod'], w: 2 },
};
export const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];
export const enchKind = (id) => isArmor(id) ? ARMOR_PIECES[(id - 320) % 4] : id === I.FISHING_ROD ? 'rod' : id === I.SHIELD ? 'shield' : id === I.SHEARS ? 'shears' : id === I.HOE ? 'hoe' : id === I.BOW ? 'bow' : id === I.ELYTRA ? 'elytra' : id === I.FLINT_STEEL ? 'flint' : isTool(id) ? toolInfo(id).type : null;
export const enchLevel = (stack, key) => (stack && stack.ench && stack.ench[key]) || 0;
export const enchText = (ench) => ench ? Object.entries(ench).map(([k, l]) => ENCH[k].name + (ENCH[k].max > 1 ? ' ' + ROMAN[l] : '')).join(', ') : '';
// roll enchantments for a power level (1..30) using rnd()
export function rollEnchants(id, power, rnd) {
  const kind = enchKind(id); if (!kind) return null;
  const pool = Object.keys(ENCH).filter((k) => ENCH[k].on.includes(kind));
  const out = {};
  const pickOne = () => {
    const opts = pool.filter((k) => !(k in out) && !(ENCH[k].excl && ENCH[k].excl in out));
    if (!opts.length) return false;
    let tot = opts.reduce((a, k) => a + ENCH[k].w, 0), r = rnd() * tot, k = opts[0];
    for (const o of opts) { r -= ENCH[o].w; if (r <= 0) { k = o; break; } }
    const mx = ENCH[k].max; out[k] = Math.max(1, Math.min(mx, Math.round(power / 30 * mx + (rnd() - 0.3))));
    return true;
  };
  pickOne();
  let p = power;
  while (rnd() < (p + 1) / 50) { if (!pickOne()) break; p = Math.floor(p / 2); }
  return out;
}
