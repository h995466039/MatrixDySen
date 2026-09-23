// 星环回声 · game.core.js — 常量/数据表/素材加载/存档系统/全局状态/基础工具
// （由 game.js 拆分于 2026-09-22，加载顺序：core → world → sim → ui → tools → main）

const canvas = document.querySelector('#game-canvas');
const ctx = canvas.getContext('2d');
const shell = document.querySelector('#game-shell');
const TILE = 48;
// One map represents a whole planet.  The landing zone is intentionally only
// a small, resource-scarce part of the world; the camera can pan to the remote
// extraction regions as the factory grows.
const WORLD_BOUNDS = Object.freeze({ minX: -36, maxX: 36, minY: -24, maxY: 24 });
const terrainRegions = [
  { kind: 'rock', label: '玄武岩岩场', short: '岩石', minX: -33, maxX: -27, minY: -20, maxY: -14 },
  { kind: 'rock', label: '玄武岩岩场', short: '岩石', minX: 12, maxX: 15, minY: -8, maxY: -5 },
  { kind: 'rock', label: '玄武岩岩场', short: '岩石', minX: 26, maxX: 34, minY: -18, maxY: -12 },
  { kind: 'rock', label: '玄武岩岩场', short: '岩石', minX: -6, maxX: 2, minY: 18, maxY: 23 },
  { kind: 'water', label: '低洼水域', short: '水域', minX: -15, maxX: -11, minY: 7, maxY: 10 },
  { kind: 'water', label: '低洼水域', short: '水域', minX: 15, maxX: 17, minY: 8, maxY: 10 },
  { kind: 'water', label: '低洼水域', short: '水域', minX: -33, maxX: -25, minY: 12, maxY: 19 },
  { kind: 'water', label: '低洼水域', short: '水域', minX: 25, maxX: 35, minY: 14, maxY: 21 },
  { kind: 'water', label: '低洼水域', short: '水域', minX: -35, maxX: -29, minY: -3, maxY: 2 }
];
const terrainProfiles = {
  home: terrainRegions,
  forge: [
    { kind: 'rock', label: '熔岩玄武岩', short: '岩场', minX: -31, maxX: -24, minY: -18, maxY: -11 },
    { kind: 'rock', label: '熔岩玄武岩', short: '岩场', minX: 9, maxX: 18, minY: 10, maxY: 18 },
    { kind: 'water', label: '硫化低洼地', short: '低洼', minX: -15, maxX: -9, minY: 8, maxY: 14 },
    { kind: 'water', label: '硫化低洼地', short: '低洼', minX: 21, maxX: 28, minY: -12, maxY: -6 }
  ],
  frost: [
    { kind: 'rock', label: '冰壳断层', short: '冰岩', minX: -27, maxX: -18, minY: -20, maxY: -14 },
    { kind: 'rock', label: '冰壳断层', short: '冰岩', minX: 17, maxX: 28, minY: 3, maxY: 11 },
    { kind: 'water', label: '融冰湖', short: '冰湖', minX: -12, maxX: -3, minY: 8, maxY: 17 },
    { kind: 'water', label: '融冰湖', short: '冰湖', minX: 24, maxX: 34, minY: -20, maxY: -12 }
  ],
  archive: [
    { kind: 'rock', label: '遗迹基岩', short: '基岩', minX: -22, maxX: -14, minY: -8, maxY: 0 },
    { kind: 'rock', label: '遗迹基岩', short: '基岩', minX: 13, maxX: 23, minY: -19, maxY: -10 },
    { kind: 'water', label: '古代蓄水层', short: '蓄水层', minX: -32, maxX: -24, minY: 12, maxY: 20 },
    { kind: 'water', label: '古代蓄水层', short: '蓄水层', minX: 1, maxX: 9, minY: 7, maxY: 15 }
  ]
};
const SAVE_KEY = 'stellar-echo-sandbox-v2';
const LEGACY_SAVE_KEY = 'stellar-echo-sandbox-v1';
const urlParams = new URLSearchParams(window.location.search);
const qaDemoMode = urlParams.get('demo');
const qaPlaythroughMode = urlParams.get('qa') === 'playthrough';
const requestedPanel = urlParams.get('panel');

const assets = {};
const assetPaths = {
  copper: 'godot_game/assets/generated/resource-copper-ore-v01.png',
  silicon: 'godot_game/assets/generated/resource-silicon-crystal-v01.png',
  iron: 'godot_game/assets/generated/resource-iron-ore-v01.png',
  ice: 'godot_game/assets/generated/resource-ice-crystal-v01.png',
  copperIngot: 'godot_game/assets/generated/resource-copper-ingot-v01.png',
  siliconWafer: 'godot_game/assets/generated/resource-silicon-wafer-v01.png',
  processor: 'godot_game/assets/generated/resource-processor-chip-v01.png',
  titanium: 'godot_game/assets/generated/resource-titanium-crystal-v01.png',
  electromagneticCube: 'godot_game/assets/generated/resource_matrix_v02.png',
  miner: 'godot_game/assets/generated/building-mining-drill-v01.png',
  smelter: 'godot_game/assets/generated/building-smelter-v01.png',
  assembler: 'godot_game/assets/generated/building-assembler-v01.png',
  researchLab: 'godot_game/assets/generated/building_research-lab_north.png',
  sorter: 'godot_game/assets/generated/building_sorter_north.png',
  wind: 'godot_game/assets/generated/building_wind-generator_north.png',
  thermal: 'godot_game/assets/generated/building_thermal-generator_north.png',
  oilExtractor: 'godot_game/assets/generated/building_oil-extractor_north.png',
  storage: 'godot_game/assets/generated/building_storage_north.png',
  waterPump: 'godot_game/assets/generated/building_water-pump_v01.png',
  gasExtractor: 'godot_game/assets/generated/building_gas-extractor_v01.svg',
  gasTurbine: 'godot_game/assets/generated/building_gas-turbine_v01.svg',
  powerTower: 'godot_game/assets/generated/building_power-tower_v01.svg',
  longPowerTower: 'godot_game/assets/generated/building_long-power-tower_v01.svg',
  ultraPowerTower: 'godot_game/assets/generated/building_ultra-power-tower_v01.svg',
  solidStorage: 'godot_game/assets/generated/building_solid-storage_v01.svg',
  liquidStorage: 'godot_game/assets/generated/building_liquid-storage_v01.svg',
  gasStorage: 'godot_game/assets/generated/building_gas-storage_v01.svg',
  groundTile: 'godot_game/assets/generated/godot-v02-ground-tile.png',
  rockTile: 'godot_game/assets/generated/godot-v02-ground-tile.png',
  waterTile: 'godot_game/assets/generated/terrain_water_tile_v01.png',
};
Object.entries(assetPaths).forEach(([key, path]) => {
  const image = new Image();
  image.src = path;
  assets[key] = image;
});

const rasterCache = new WeakMap();
const nodeLabelCache = new WeakMap();
function rasterizedAsset(key) {
  const image = assets[key];
  if (!image || !image.complete || image.naturalWidth <= 0) return null;
  const source = image.currentSrc || image.src || '';
  if (!/\.svg($|[?#])/i.test(source)) return image;
  let raster = rasterCache.get(image);
  if (!raster) {
    raster = document.createElement('canvas');
    raster.width = 96;
    raster.height = 96;
    raster.getContext('2d').drawImage(image, 0, 0, 96, 96);
    rasterCache.set(image, raster);
  }
  return raster;
}

function imageLoadState(image) {
  return hasImage(image) ? 'loaded' : 'fallback';
}

function waitForImage(image) {
  return new Promise(resolve => {
    let settled = false;
    const settle = loaded => {
      if (settled) return;
      settled = true;
      image.removeEventListener('load', onLoad);
      image.removeEventListener('error', onError);
      resolve(loaded);
    };
    const onLoad = () => settle(true);
    const onError = () => settle(false);
    image.addEventListener('load', onLoad, { once: true });
    image.addEventListener('error', onError, { once: true });
    if (image.complete) window.setTimeout(() => settle(imageLoadState(image) === 'loaded'), 0);
  });
}

async function preloadGameAssets() {
  const entries = new Map();
  const addEntry = (src, image, label) => {
    if (!src) return;
    const url = new URL(src, document.baseURI).href;
    if (entries.has(url)) return;
    const resource = image || new Image();
    if (!resource.src || new URL(resource.src, document.baseURI).href !== url) resource.src = src;
    entries.set(url, { image: resource, label: label || src });
  };
  Object.entries(assetPaths).forEach(([key, src]) => addEntry(src, assets[key], key));
  [...document.images].forEach((image, index) => addEntry(image.currentSrc || image.src, image, `界面素材 ${index + 1}`));
  addEntry('godot_game/assets/generated/stellar-ring-concept-v01.png', null, '星图背景');
  if (typeof careerCatalog !== 'undefined') Object.values(careerCatalog).forEach(career => addEntry(`godot_game/assets/generated/${career.image}`, null, career.label));

  const loader = query('#asset-loader');
  const fill = query('#asset-loader-fill');
  const percent = query('#asset-loader-percent');
  const detail = query('#asset-loader-detail');
  const status = query('#asset-loader-status');
  const total = entries.size;
  let completed = 0;
  const update = (label, loaded) => {
    completed += 1;
    const progress = total ? completed / total : 1;
    if (fill) fill.style.width = `${progress * 100}%`;
    if (percent) percent.textContent = `${Math.round(progress * 100)}%`;
    if (detail) detail.textContent = `${completed} / ${total} 资源已校验`;
    if (status) status.textContent = loaded ? `已接入 · ${label}` : `素材不可用 · ${label} · 使用程序绘制`;
  };
  const results = await Promise.all([...entries.values()].map(async entry => {
    const loaded = await waitForImage(entry.image);
    update(entry.label, loaded);
    return { ...entry, loaded };
  }));
  const failures = results.filter(entry => !entry.loaded);
  document.body.dataset.assetsReady = 'true';
  document.body.dataset.assetFailures = String(failures.length);
  if (status) status.textContent = failures.length ? `资源校验完成 · ${failures.length} 项使用程序绘制` : '资源校验完成 · 工厂系统就绪';
  if (detail) detail.textContent = `${total} / ${total} 资源已校验`;
  if (percent) percent.textContent = '100%';
  if (fill) fill.style.width = '100%';
  if (loader) query('#asset-loader-note').textContent = failures.length ? '缺失素材已切换为程序绘制，不影响建造与物流' : '所有素材已就绪，正在进入地表工厂';
  return results;
}

const resources = {
  copper: { label: '铜', color: '#ff9b3d', image: 'copper', form: 'solid', tier: 0 },
  silicon: { label: '硅', color: '#69d8da', image: 'silicon', form: 'solid', tier: 0 },
  iron: { label: '铁', color: '#b56e58', image: 'iron', form: 'solid', tier: 0 },
  coal: { label: '煤', color: '#827a88', form: 'solid', tier: 0 },
  crudeOil: { label: '原油', color: '#c97849', form: 'liquid', tier: 0 },
  water: { label: '水', color: '#5cc8ed', form: 'liquid', tier: 0 },
  naturalGas: { label: '天然气', color: '#b6e7ba', form: 'gas', tier: 0 },
  ice: { label: '冰', color: '#8ccfff', image: 'ice', form: 'solid', tier: 0 },
  titanium: { label: '钛', color: '#b9a7ff', image: 'titanium', form: 'solid', tier: 0 },
  ironIngot: { label: '铁锭', color: '#d58a6c', form: 'solid', tier: 1 },
  copperIngot: { label: '铜锭', color: '#ffc266', image: 'copperIngot', form: 'solid', tier: 1 },
  siliconWafer: { label: '硅片', color: '#b0ffff', image: 'siliconWafer', form: 'solid', tier: 1 },
  processor: { label: '芯片', color: '#c7d94c', image: 'processor', form: 'solid', tier: 2 },
  electromagneticCube: { label: '电磁矩阵', color: '#61d9e4', image: 'electromagneticCube', form: 'solid', tier: 3 },
  energyCube: { label: '能量矩阵', color: '#f5c85b', image: 'energyCube', form: 'solid', tier: 3 },
  structureCube: { label: '结构矩阵', color: '#e894e8', image: 'structureCube', form: 'solid', tier: 3 },
  informationCube: { label: '信息矩阵', color: '#7ed6ff', image: 'informationCube', form: 'solid', tier: 4 },
  stellarFrame: { label: '恒星框架组件', color: '#f5e29b', form: 'solid', tier: 5 },
  gear: { label: '齿轮', color: '#d9b77c', form: 'solid', tier: 1 },
  magneticCoil: { label: '磁线圈', color: '#d783ff', form: 'solid', tier: 2 },
  circuitBoard: { label: '电路板', color: '#79d6a2', form: 'solid', tier: 2 },
  glass: { label: '玻璃', color: '#9feaff', form: 'solid', tier: 2 },
  motor: { label: '电动机', color: '#f1a45e', form: 'solid', tier: 3 },
  turbine: { label: '涡轮机', color: '#c2e0ff', form: 'solid', tier: 3 },
  particleContainer: { label: '粒子容器', color: '#f6d86b', form: 'solid', tier: 4 },
  solarSail: { label: '太阳帆', color: '#f7f0ae', form: 'solid', tier: 4 },
  structureRocket: { label: '结构火箭', color: '#ffbd81', form: 'solid', tier: 5 },
  orbitNode: { label: '轨道节点', color: '#bff5de', form: 'solid', tier: 5 }
};

const sorterRouteCatalog = [
  'iron', 'copper', 'silicon', 'coal', 'crudeOil', 'water', 'naturalGas', 'ice', 'titanium',
  'ironIngot', 'copperIngot', 'siliconWafer', 'processor',
  'electromagneticCube', 'energyCube', 'structureCube', 'informationCube',
  'gear', 'magneticCoil', 'circuitBoard', 'glass', 'motor', 'turbine', 'particleContainer', 'solarSail', 'structureRocket', 'orbitNode'
];

const buildings = {
  miner: { label: '采矿机', size: 2, color: '#ff9b3d', power: .6, cost: { iron: 8, copper: 2 }, tech: 'foundation', image: 'miner', extractionForm: 'solid' },
  smelter: { label: '冶炼机', size: 2, color: '#f7c35e', power: .9, cost: { iron: 10, copper: 2 }, tech: 'foundation', image: 'smelter' },
  waterPump: { label: '水泵', size: 2, color: '#5cc8ed', power: .7, cost: { iron: 10, copper: 2 }, tech: 'foundation', image: 'waterPump', extractionForm: 'liquid' },
  gasExtractor: { label: '天然气压采机', size: 2, color: '#a8e7dd', power: 1.9, cost: { iron: 20, copper: 6, processor: 1 }, tech: 'gas-extraction', image: 'gasExtractor', extractionForm: 'gas' },
  powerTower: { label: '电力塔', size: 1, color: '#69d8da', power: .08, transmissionRange: 5, cost: { iron: 6, copper: 2 }, tech: 'foundation', image: 'powerTower' },
  // The first assembler is the bootstrap for processors, so it cannot itself
  // require a processor. Later buildings still carry the same production
  // recipe and remain gated by power, inputs, and logistics.
  assembler: { label: '组装机', size: 2, color: '#c7d94c', power: 1.2, cost: { iron: 8, copper: 4, processor: 1 }, tech: 'automated-smelting', image: 'assembler' },
  // The first sorter is part of the foundation loop. Smart sorting later
  // upgrades the same physical interface with rules and multiple exits.
  sorter: { label: '分拣器', size: 1, color: '#69d8da', power: .1, cost: { iron: 4, copper: 2 }, tech: 'foundation', image: 'sorter' },
  workbench: { label: '工作台', size: 2, color: '#e8a46e', power: .5, cost: { iron: 12, copper: 4 }, tech: 'workbench-tech' },
  wind: { label: '风力发电机', size: 2, color: '#a8e7dd', power: 0, generation: 2.6, cost: { iron: 10, copper: 6 }, tech: 'foundation' },
  thermal: { label: '火力发电机', size: 2, color: '#ee765c', power: .2, generation: 6, cost: { iron: 18, copper: 10 }, tech: 'thermal-power' },
  gasTurbine: { label: '燃气轮机', size: 2, color: '#b6e7ba', power: .5, generation: 9, cost: { iron: 22, copper: 8, processor: 2 }, tech: 'gas-power', image: 'gasTurbine' },
  longPowerTower: { label: '远距离电力塔', size: 1, color: '#8ccfff', power: .14, transmissionRange: 9, cost: { iron: 12, copper: 6, processor: 1 }, tech: 'power-transmission', image: 'longPowerTower' },
  ultraPowerTower: { label: '超远距离电力塔', size: 2, color: '#c58cff', power: .24, transmissionRange: 15, cost: { iron: 24, copper: 12, processor: 3 }, tech: 'advanced-power-grid', image: 'ultraPowerTower' },
  oilExtractor: { label: '石油提取机', size: 2, color: '#d18a57', power: 2.2, cost: { iron: 24, processor: 2 }, tech: 'oil-processing', image: 'oilExtractor', extractionForm: 'liquid' },
  researchLab: { label: '科研站', size: 2, color: '#7ed6ff', power: 1.6, cost: { iron: 20, processor: 4 }, tech: 'foundation', image: 'researchLab' },
  // `storage` remains as a save-compatible alias for the old starter chest.
  storage: { label: '固体仓储', size: 2, color: '#a7c7ff', power: .15, cost: { iron: 16, copper: 4 }, tech: 'foundation', image: 'storage', storageForm: 'solid' },
  solidStorage: { label: '固体仓储', size: 2, color: '#a7c7ff', power: .15, cost: { iron: 16, copper: 4 }, tech: 'foundation', image: 'solidStorage', storageForm: 'solid' },
  liquidStorage: { label: '液体仓储', size: 2, color: '#5cc8ed', power: .2, cost: { iron: 18, copper: 4 }, tech: 'fluid-storage', image: 'liquidStorage', storageForm: 'liquid' },
  gasStorage: { label: '气体仓储', size: 2, color: '#b6e7ba', power: .22, cost: { iron: 20, copper: 6, processor: 1 }, tech: 'gas-storage', image: 'gasStorage', storageForm: 'gas' },
  logisticsStation: { label: '行星物流站', size: 3, color: '#c58cff', power: 2.8, cost: { iron: 32, processor: 6, titanium: 4 }, tech: 'interstellar-logistics' },
  stellarReceiver: { label: '恒星能量接收器', size: 2, color: '#f5e29b', power: .6, generation: 10, cost: { iron: 28, processor: 4, orbitNode: 2 }, tech: 'dyson-frame' },
  solarSailLauncher: { label: '太阳帆发射台', size: 3, color: '#f7e69c', power: 3.8, cost: { iron: 30, processor: 4, structureCube: 4 }, tech: 'orbital-construction' },
  structureLauncher: { label: '结构火箭发射台', size: 3, color: '#ffb879', power: 4.8, cost: { iron: 36, processor: 6, titanium: 4, structureCube: 4 }, tech: 'orbital-construction' }
};

const cubeRecipes = {
  electromagneticCube: { label: '电磁矩阵', color: '#61d9e4', time: 2.4, inputs: { copperIngot: 1, siliconWafer: 1 } },
  energyCube: { label: '能量矩阵', color: '#f5c85b', time: 2.8, inputs: { copperIngot: 1, coal: 1 } },
  structureCube: { label: '结构矩阵', color: '#e894e8', time: 3.2, inputs: { ironIngot: 1, processor: 1 } },
  informationCube: { label: '信息矩阵', color: '#7ed6ff', time: 4.2, inputs: { energyCube: 1, structureCube: 1 } }
};

const assemblyRecipes = {
  processor: { label: '芯片', output: 'processor', time: 3.2, tier: 2, tech: 'automated-smelting', inputs: { copperIngot: 1, siliconWafer: 1 } },
  gear: { label: '齿轮', output: 'gear', time: 1.8, tier: 1, tech: 'automated-smelting', inputs: { ironIngot: 2 } },
  magneticCoil: { label: '磁线圈', output: 'magneticCoil', time: 2.6, tier: 2, tech: 'advanced-materials', inputs: { copperIngot: 2, ironIngot: 1 } },
  circuitBoard: { label: '电路板', output: 'circuitBoard', time: 2.8, tier: 2, tech: 'advanced-materials', inputs: { copperIngot: 2, siliconWafer: 2 } },
  glass: { label: '玻璃', output: 'glass', time: 2.4, tier: 2, tech: 'advanced-materials', inputs: { siliconWafer: 2, coal: 1 } },
  motor: { label: '电动机', output: 'motor', time: 4.2, tier: 3, tech: 'advanced-materials', inputs: { gear: 1, magneticCoil: 1, circuitBoard: 1 } },
  turbine: { label: '涡轮机', output: 'turbine', time: 4.8, tier: 3, tech: 'advanced-materials', inputs: { motor: 1, magneticCoil: 2 } },
  particleContainer: { label: '粒子容器', output: 'particleContainer', time: 5.4, tier: 4, tech: 'stellar-fabrication', inputs: { titanium: 1, processor: 1, magneticCoil: 1 } },
  solarSail: { label: '太阳帆', output: 'solarSail', time: 4.5, tier: 4, tech: 'stellar-fabrication', inputs: { glass: 1, siliconWafer: 1, processor: 1 } },
  structureRocket: { label: '结构火箭', output: 'structureRocket', time: 7.2, tier: 5, tech: 'stellar-fabrication', inputs: { titanium: 2, motor: 1, particleContainer: 1, structureCube: 1 } },
  orbitNode: { label: '轨道节点', output: 'orbitNode', time: 8.4, tier: 5, tech: 'orbital-construction', inputs: { structureRocket: 1, solarSail: 1, structureCube: 2 } }
};
const assemblyRecipeOrder = Object.keys(assemblyRecipes);
const workbenchAssemblyRecipes = ['gear', 'magneticCoil', 'circuitBoard', 'glass'];
const assemblerAssemblyRecipes = ['processor', 'motor', 'turbine', 'particleContainer', 'solarSail', 'structureRocket', 'orbitNode'];
const ORBIT_COMPONENT_LIFETIME = { node: 1800, sail: 600, rocket: 600 };

const techTree = {
  mainline: [
    { id: 'planetary-logistics', label: '行星物流', short: '物流主干', description: '建立行星级物流网络，研究分拣与长距离运输。', cube: 'electromagneticCube', cost: 12 },
    { id: 'automated-smelting', label: '自动冶炼', short: '工业主干', description: '把原矿加工成稳定的工业中间品，并授权第一座自动组装设备。', requires: ['planetary-logistics'], cube: 'energyCube', cost: 16, unlocks: ['assembler'], upgrades: ['smelter'], upgradeTier: 2, effectText: '解锁组装机 · 冶炼机速度 +33%' },
    { id: 'matrix-lab', label: '矩阵实验室', short: '科研主干', description: '将研究矩阵转化为可持续的科技推进力。', requires: ['automated-smelting'], cube: 'structureCube', cost: 22, upgrades: ['researchLab'], upgradeTier: 2, effectText: '科研站矩阵制备速度 +25%' },
    { id: 'interstellar-logistics', label: '星际物流', short: '跨星际主干', description: '接入恒星系航线，授权行星物流站并允许派遣货运舱回收异星资源。', requires: ['matrix-lab'], cube: 'informationCube', cost: 32, unlocks: ['行星物流站、星图与货运舱'] },
    { id: 'stellar-network', label: '恒星网络', short: '跨星际主干', description: '让远端信标加入同一条物流网络，开放档案星航线。', requires: ['interstellar-logistics'], cube: 'informationCube', cost: 40, unlocks: ['档案星航线'] },
    { id: 'dyson-frame', label: '戴森框架', short: '恒星工程', description: '用异星资源搭建包围恒星的第一圈能量框架。', requires: ['stellar-network'], cube: 'structureCube', cost: 48, unlocks: ['恒星能量接收器'] }
  ],
  branches: [
    { id: 'sorter-tech', label: '智能分拣', short: '物流分支', description: '升级基础分拣器的识别与分流能力，让同一条物流线可以按物料接入不同产线。', requires: ['planetary-logistics'], cube: 'electromagneticCube', cost: 12, upgrades: ['sorter'], upgradeTier: 2, effectText: '分拣器获得多出口规则与自动分流' },
    { id: 'belt-mk2', label: '高速传送', short: '物流分支', description: '提升物流网络的吞吐能力。', requires: ['sorter-tech'], cube: 'energyCube', cost: 14, upgrades: ['belt'], upgradeTier: 2, effectText: '传送带速度 +43%' },
    { id: 'storage-mk2', label: '仓储扩容', short: '物流分支', description: '增加仓储箱容量，并允许更高频率的分拣器取放。', requires: ['sorter-tech'], cube: 'energyCube', cost: 18, upgrades: ['storage', 'solidStorage', 'liquidStorage', 'gasStorage'], upgradeTier: 2, effectText: '仓储容量提升至 Mk-II' },
    { id: 'wind-power', label: '风能捕获', short: '能源分支', description: '改良风机叶片与发电模块，提高每座风力发电机的输出。', requires: ['planetary-logistics'], cube: 'electromagneticCube', cost: 8, upgrades: ['wind'], upgradeTier: 2, effectText: '风力发电机升级至 Mk-II · 输出提升' },
    { id: 'thermal-power', label: '热能转化', short: '能源分支', description: '消耗煤炭，将化学能转化为电力。', requires: ['wind-power'], cube: 'energyCube', cost: 14, unlocks: ['thermal'], effectText: '解锁火力发电机' },
    { id: 'oil-processing', label: '石化开采', short: '能源分支', description: '从原油渗流区建立压力开采。', requires: ['planetary-logistics'], cube: 'energyCube', cost: 16, unlocks: ['oilExtractor'], effectText: '解锁石油提取机' },
    { id: 'workbench-tech', label: '精密工作台', short: '制造分支', description: '允许小批量制造电路与研究组件。', cube: 'electromagneticCube', cost: 8, unlocks: ['workbench'], upgrades: ['workbench'], upgradeTier: 2, effectText: '解锁工作台 · 工作台速度 +27%' },
    { id: 'advanced-assembly', label: '高级组装', short: '制造分支', description: '为处理器和矩阵生产提供更高效率。', requires: ['automated-smelting'], cube: 'structureCube', cost: 18, upgrades: ['assembler', 'workbench'], upgradeTier: 3, effectText: '组装机与工作台速度 +30%' },
    { id: 'advanced-materials', label: '复合材料', short: '制造分支', description: '把金属、硅和流体加工成电路板、线圈、电动机等二级工业材料。', requires: ['advanced-assembly'], cube: 'structureCube', cost: 24, effectText: '开放齿轮、线圈、电路板、玻璃、电动机和涡轮机配方' },
    { id: 'stellar-fabrication', label: '恒星制造', short: '恒星分支', description: '把异星钛和复合材料加工成粒子容器、太阳帆与结构火箭。', requires: ['advanced-materials', 'stellar-network'], cube: 'informationCube', cost: 42, effectText: '开放粒子容器、太阳帆和结构火箭配方' },
    { id: 'orbital-construction', label: '轨道施工', short: '恒星分支', description: '授权太阳帆发射台与结构火箭发射台，让生产线真正把组件送上恒星轨道。', requires: ['stellar-fabrication', 'dyson-frame'], cube: 'informationCube', cost: 56, unlocks: ['solarSailLauncher', 'structureLauncher'], effectText: '开放轨道节点配方、太阳帆发射台与结构火箭发射台' },
    { id: 'mining-mk2', label: '高压采掘', short: '工业分支', description: '升级采矿机钻头与排矿节拍，减少矿脉等待时间。', requires: ['planetary-logistics'], cube: 'energyCube', cost: 18, upgrades: ['miner'], upgradeTier: 2, effectText: '采矿机速度 +35%' },
    { id: 'power-transmission', label: '远距输电', short: '能源分支', description: '用高压线圈延长电力塔的传输半径，允许多个局部电网稳定互联。', requires: ['thermal-power'], cube: 'energyCube', cost: 18, unlocks: ['longPowerTower'], effectText: '解锁远距离电力塔 · 基础电塔覆盖范围 +15%' },
    { id: 'power-grid-mk2', label: '电网增容', short: '能源分支', description: '升级发电设施的能量转换模块，提高整个生存电网的余量。', requires: ['thermal-power'], cube: 'structureCube', cost: 24, upgrades: ['wind', 'thermal'], upgradeTier: 2, effectText: '风力与火力发电机输出 +25%' },
    { id: 'advanced-power-grid', label: '超远距骨干网', short: '能源分支', description: '建立跨区域骨干输电，允许超远距离电力塔接管整片工业区。', requires: ['power-transmission', 'power-grid-mk2'], cube: 'informationCube', cost: 32, unlocks: ['ultraPowerTower'], effectText: '解锁超远距离电力塔 · 全部电塔覆盖范围 +10%' },
    { id: 'oil-extractor-mk2', label: '深层泵压', short: '能源分支', description: '为石油提取机加装深层泵压模块，提升原油采集速率。', requires: ['oil-processing'], cube: 'structureCube', cost: 20, upgrades: ['oilExtractor'], upgradeTier: 2, effectText: '石油提取机速度 +35%' },
    { id: 'fluid-storage', label: '流体罐区', short: '物流分支', description: '用密封罐体存放水与原油。液体仓储只接受液体资源，不能混入固体或气体。', requires: ['planetary-logistics'], cube: 'energyCube', cost: 16, unlocks: ['liquidStorage'], effectText: '解锁液体仓储' },
    { id: 'gas-extraction', label: '气体压采', short: '能源分支', description: '建立气体采集头，把天然气从独立气田压入生产网络。', requires: ['oil-processing'], cube: 'structureCube', cost: 22, unlocks: ['gasExtractor'], effectText: '解锁天然气压采机' },
    { id: 'gas-storage', label: '高压气库', short: '物流分支', description: '使用高压容器存放天然气，气体资源不能进入固体或液体仓储。', requires: ['gas-extraction'], cube: 'informationCube', cost: 28, unlocks: ['gasStorage'], effectText: '解锁气体仓储' },
    { id: 'gas-power', label: '燃气发电', short: '能源分支', description: '用天然气驱动燃气轮机：出力稳定、无需煤线。', requires: ['gas-extraction'], cube: 'structureCube', cost: 20, unlocks: ['gasTurbine'], effectText: '解锁燃气轮机 · 天然气发电' },
    { id: 'logistics-mk3', label: '物流 Mk-III', short: '物流分支', description: '第三代物流控制器同步提升传送带、分拣器和三类仓储的吞吐能力。', requires: ['sorter-tech', 'belt-mk2', 'storage-mk2'], cube: 'structureCube', cost: 26, upgrades: ['belt', 'sorter', 'storage', 'solidStorage', 'liquidStorage', 'gasStorage'], upgradeTier: 3, effectText: '物流设备升级至 Mk-III' },
    { id: 'logistics-mk4', label: '物流 Mk-IV', short: '物流分支', description: '相位物流节点进一步压缩传输延迟，并扩大三类仓储容量。', requires: ['logistics-mk3', 'advanced-assembly'], cube: 'informationCube', cost: 40, upgrades: ['belt', 'sorter', 'storage', 'solidStorage', 'liquidStorage', 'gasStorage'], upgradeTier: 4, effectText: '物流设备升级至 Mk-IV' },
    { id: 'logistics-mk5', label: '物流 Mk-V', short: '物流分支', description: '恒星级物流协议，提供最高移动速度、分拣速度和仓储容量。', requires: ['logistics-mk4', 'stellar-network'], cube: 'informationCube', cost: 64, upgrades: ['belt', 'sorter', 'storage', 'solidStorage', 'liquidStorage', 'gasStorage'], upgradeTier: 5, effectText: '物流设备升级至 Mk-V' },
    { id: 'industrial-mk3', label: '工业 Mk-III', short: '工业分支', description: '让采集、加工与组装设备进入中型工厂效率档位。', requires: ['mining-mk2', 'advanced-assembly'], cube: 'structureCube', cost: 28, upgrades: ['miner', 'smelter', 'assembler', 'workbench', 'waterPump', 'oilExtractor', 'gasExtractor'], upgradeTier: 3, effectText: '工业设备升级至 Mk-III' },
    { id: 'industrial-mk4', label: '工业 Mk-IV', short: '工业分支', description: '高级执行器降低加工节拍和采集等待。', requires: ['industrial-mk3', 'matrix-lab'], cube: 'informationCube', cost: 44, upgrades: ['miner', 'smelter', 'assembler', 'workbench', 'waterPump', 'oilExtractor', 'gasExtractor'], upgradeTier: 4, effectText: '工业设备升级至 Mk-IV' },
    { id: 'industrial-mk5', label: '工业 Mk-V', short: '工业分支', description: '恒星工程级设备，材料消耗更高但可以支撑远端巨型产线。', requires: ['industrial-mk4', 'stellar-network'], cube: 'informationCube', cost: 68, upgrades: ['miner', 'smelter', 'assembler', 'workbench', 'waterPump', 'oilExtractor', 'gasExtractor'], upgradeTier: 5, effectText: '工业设备升级至 Mk-V' }
  ]
};
const foundationTech = { id: 'foundation', label: '基础工业授权', short: '初始权限', description: '授予着陆舱周边的第一套工业设施许可证。着陆后没有现成电力，必须先部署风力发电机，再让电塔把早期产线接入电网。', requires: [], cube: 'electromagneticCube', cost: 0, unlocks: ['miner', 'smelter', 'waterPump', 'researchLab', 'storage', 'solidStorage', 'sorter', 'powerTower', 'wind'], effectText: '解锁采矿机、水泵、冶炼机、科研站、固体仓储、基础分拣器、电力塔与风力发电机' };
const techNodes = [foundationTech, ...techTree.mainline, ...techTree.branches];
const techById = Object.fromEntries(techNodes.map(tech => [tech.id, tech]));
const startingTech = ['foundation'];
const startingInventory = { iron: 72, copper: 28, silicon: 16, coal: 4, crudeOil: 0, water: 0, naturalGas: 0, titanium: 0, ironIngot: 4, copperIngot: 4, siliconWafer: 4, processor: 6, electromagneticCube: 0, energyCube: 0, structureCube: 0, informationCube: 0, stellarFrame: 0, gear: 0, magneticCoil: 0, circuitBoard: 0, glass: 0, motor: 0, turbine: 0, particleContainer: 0, solarSail: 0, structureRocket: 0, orbitNode: 0 };
const startingStorageStock = { iron: 96, copper: 48, silicon: 32, coal: 8, titanium: 0, ironIngot: 4, copperIngot: 6, siliconWafer: 6, processor: 8, electromagneticCube: 0, energyCube: 0, structureCube: 0, informationCube: 0, stellarFrame: 0, gear: 0, magneticCoil: 0, circuitBoard: 0, glass: 0, motor: 0, turbine: 0, particleContainer: 0, solarSail: 0, structureRocket: 0, orbitNode: 0 };
const startingKits = {
  miner: 1,
  smelter: 1,
  researchLab: 1,
  sorter: 1,
  powerTower: 1,
  wind: 2,
  waterPump: 0,
  thermal: 0,
  assembler: 0,
  workbench: 0,
  oilExtractor: 0,
  gasExtractor: 0,
  solidStorage: 0,
  liquidStorage: 0,
  gasStorage: 0,
  gasTurbine: 0,
  logisticsStation: 0,
  stellarReceiver: 0,
  solarSailLauncher: 0,
  structureLauncher: 0,
  longPowerTower: 0,
  ultraPowerTower: 0,
  belt: 8
};
const kitDescriptions = {
  miner: '覆盖固体矿脉，开始采集基础原矿。',
  smelter: '把原矿加工成金属锭或硅片。',
  researchLab: '消耗矩阵推进科技研究。',
  sorter: '把建筑接口接入传送带物流，分拣器本身需要电力。',
  powerTower: '以塔为圆心覆盖局部电网，连接发电与用电设施。',
  wind: '不消耗燃料，把行星风场转化为基础电力。',
  waterPump: '覆盖水源采集区，提供基础水资源。',
  thermal: '消耗煤炭，把化学能转化为电力。',
  assembler: '把中间材料组装成更高等级产品。',
  workbench: '手工生产基础电路与研究组件。',
  oilExtractor: '覆盖原油渗流区，采集液态原油。',
  gasExtractor: '覆盖天然气田，采集气态天然气。',
  solidStorage: '只接受铁、铜、硅、煤等固体资源。',
  liquidStorage: '只接受水与原油等液体资源。',
  gasStorage: '只接受天然气等气体资源。',
  gasTurbine: '消耗天然气，输出稳定电力。',
  logisticsStation: '建立跨星球货运与资源回收节点。',
  stellarReceiver: '框架完成后收集恒星能量，并把它转化为本地电网的稳定发电。',
  solarSailLauncher: '消耗太阳帆，把恒星光压转成轨道组件。',
  structureLauncher: '消耗结构火箭，把承力节点送入恒星轨道。',
  longPowerTower: '扩大输电半径，连接更远的局部电网。',
  ultraPowerTower: '建立超远距离骨干输电网络。'
};
const handcraftRecipes = [
  ...Object.keys(buildings).filter(type => type !== 'storage').map(type => ({
    id: type,
    label: `${buildings[type].label}`,
    description: kitDescriptions[type] || `${buildings[type].label}的部署组件。`,
    outputLabel: `${buildings[type].label} ×1`,
    outputType: 'kit',
    output: type,
    amount: 1,
    buildingType: type,
    tech: buildings[type].tech
  })),
  { id: 'belt', label: '传送带组件', description: '铺设四格基础物流线路。', outputLabel: '传送带 ×4 格', outputType: 'kit', output: 'belt', amount: 4, cost: { iron: 4 } }
];
const simulationSpeeds = [1, 2, 4, 10];

const careerCatalog = {
  logistics: {
    id: 'logistics', label: '物流主管', image: 'character-logistics-director-v01.png', accent: '#69d8da',
    summary: '先把物料流动起来，再让工厂自己扩张。',
    bonus: '传送带运输速度 +25%', detail: '初始物流网络更容易连通，适合喜欢规划线路、分流和跨星际调度的玩家。',
    effect: 'beltSpeed'
  },
  power: {
    id: 'power', label: '能源工程师', image: 'character-production-engineer-v01.png', accent: '#ff9b3d',
    summary: '把每一座机器都接入稳定的能源脉搏。',
    bonus: '发电量 +20%', detail: '风力和火力发电机提供更多电力，适合早期铺开多条产线。',
    effect: 'power'
  },
  research: {
    id: 'research', label: '科研先驱', image: 'character-production-engineer-v01.png', accent: '#c7d94c',
    summary: '用更快的矩阵循环抢先打开科技树。',
    bonus: '科研消耗效率 +30%', detail: '科研站每秒推进更多矩阵，适合优先冲主线、尽快接入星际物流。',
    effect: 'research'
  }
};

const nodes = [
  { id: 'copper-north', x: -6, y: -2, resource: 'copper', amount: 62400 },
  { id: 'copper-south', x: -24, y: 16, resource: 'copper', amount: 48800 },
  { id: 'copper-west', x: -30, y: 4, resource: 'copper', amount: 35200 },
  { id: 'silicon-west', x: 5, y: -4, resource: 'silicon', amount: 28100 },
  { id: 'silicon-north', x: 20, y: -19, resource: 'silicon', amount: 33400 },
  { id: 'silicon-south', x: 30, y: 3, resource: 'silicon', amount: 21600 },
  { id: 'iron-east', x: 17, y: 14, resource: 'iron', amount: 91600 },
  { id: 'iron-west', x: -28, y: -10, resource: 'iron', amount: 74600 },
  { id: 'iron-south', x: 4, y: 21, resource: 'iron', amount: 52800 },
  { id: 'ice-south', x: -23, y: 20, resource: 'ice', amount: 46200 },
  { id: 'ice-north', x: 16, y: -20, resource: 'ice', amount: 29800 },
  { id: 'water-west', x: -25, y: 21, resource: 'water', amount: 100000 },
  { id: 'water-east', x: 31, y: 18, resource: 'water', amount: 82000 },
  { id: 'coal-north-east', x: 22, y: -9, resource: 'coal', amount: 53600 },
  { id: 'coal-west', x: -30, y: -18, resource: 'coal', amount: 41800 },
  { id: 'coal-south', x: 22, y: 22, resource: 'coal', amount: 26700 },
  { id: 'oil-east', x: 11, y: 6, resource: 'crudeOil', amount: 78000 },
  { id: 'oil-north', x: -5, y: 20, resource: 'crudeOil', amount: 43200 },
  { id: 'oil-west', x: -17, y: -19, resource: 'crudeOil', amount: 30100 },
  { id: 'gas-north', x: -2, y: -22, resource: 'naturalGas', amount: 68000 },
  { id: 'gas-east', x: 27, y: 7, resource: 'naturalGas', amount: 54000 },
  { id: 'gas-west', x: -22, y: -18, resource: 'naturalGas', amount: 47000 },
  { id: 'copper-rim-east', x: 25, y: -2, resource: 'copper', amount: 44600 },
  { id: 'copper-rim-west', x: -20, y: -5, resource: 'copper', amount: 38400 },
  { id: 'copper-rim-south', x: 2, y: -20, resource: 'copper', amount: 31200 },
  { id: 'iron-rim-east', x: 32, y: -2, resource: 'iron', amount: 60400 },
  { id: 'iron-rim-west', x: -22, y: 5, resource: 'iron', amount: 45600 },
  { id: 'silicon-rim-west', x: -33, y: 0, resource: 'silicon', amount: 27600 },
  { id: 'silicon-rim-south', x: -18, y: 20, resource: 'silicon', amount: 24800 },
  { id: 'coal-rim-east', x: 34, y: 22, resource: 'coal', amount: 38200 },
  { id: 'coal-rim-south', x: -2, y: 22, resource: 'coal', amount: 33400 },
  { id: 'ice-rim-west', x: -31, y: 21, resource: 'ice', amount: 28600 },
  { id: 'water-rim-north', x: -9, y: -18, resource: 'water', amount: 72000 },
  { id: 'water-rim-east', x: 33, y: 2, resource: 'water', amount: 69000 },
  { id: 'oil-rim-east', x: 18, y: -18, resource: 'crudeOil', amount: 52200 }
];
const initialNodeState = nodes.map(node => ({ ...node }));

// 每颗星球都有自己的资源带。资源节点随工厂快照保存，远端星球不再复用母星的矿脉。
const planetNodeTemplates = {
  home: initialNodeState,
  forge: [
    { id: 'forge-titanium-west', x: -10, y: -4, resource: 'titanium', amount: 78000 },
    { id: 'forge-titanium-east', x: 8, y: -14, resource: 'titanium', amount: 62400 },
    { id: 'forge-titanium-south', x: 26, y: 5, resource: 'titanium', amount: 48600 },
    { id: 'forge-iron-west', x: -24, y: -4, resource: 'iron', amount: 72000 },
    { id: 'forge-iron-south', x: 4, y: 18, resource: 'iron', amount: 56000 },
    { id: 'forge-coal-east', x: 19, y: -5, resource: 'coal', amount: 52000 },
    { id: 'forge-coal-south', x: -20, y: 16, resource: 'coal', amount: 38000 },
    { id: 'forge-oil-center', x: 10, y: 6, resource: 'crudeOil', amount: 82000 },
    { id: 'forge-water-west', x: -20, y: 15, resource: 'water', amount: 68000 },
    { id: 'forge-gas-north', x: -2, y: -12, resource: 'naturalGas', amount: 66000 }
  ],
  frost: [
    { id: 'frost-ice-west', x: -18, y: -4, resource: 'ice', amount: 92000 },
    { id: 'frost-ice-east', x: 24, y: -8, resource: 'ice', amount: 74000 },
    { id: 'frost-ice-south', x: -10, y: 15, resource: 'ice', amount: 58000 },
    { id: 'frost-silicon-north', x: 8, y: -10, resource: 'silicon', amount: 66000 },
    { id: 'frost-silicon-east', x: 24, y: 7, resource: 'silicon', amount: 52000 },
    { id: 'frost-iron-west', x: -25, y: -8, resource: 'iron', amount: 64000 },
    { id: 'frost-coal-south', x: 18, y: 16, resource: 'coal', amount: 42000 },
    { id: 'frost-water-west', x: -30, y: 8, resource: 'water', amount: 94000 },
    { id: 'frost-water-east', x: 29, y: 10, resource: 'water', amount: 76000 }
  ],
  archive: [
    { id: 'archive-silicon-west', x: -18, y: -12, resource: 'silicon', amount: 64000 },
    { id: 'archive-silicon-east', x: 12, y: 13, resource: 'silicon', amount: 52000 },
    { id: 'archive-iron-north', x: -6, y: -10, resource: 'iron', amount: 72000 },
    { id: 'archive-iron-south', x: 28, y: -4, resource: 'iron', amount: 48000 },
    { id: 'archive-coal-east', x: 26, y: 5, resource: 'coal', amount: 42000 },
    { id: 'archive-gas-west', x: -21, y: 9, resource: 'naturalGas', amount: 68000 },
    { id: 'archive-water-north', x: 0, y: -14, resource: 'water', amount: 72000 },
    { id: 'archive-ice-south', x: 22, y: 20, resource: 'ice', amount: 56000 }
  ]
};

const planetCatalog = [
  { id: 'home', name: '晨星-03', kicker: '母星基地', role: '母星基地', description: '母星工业区。所有货运舱从这里发射，回收物会直接进入物流仓储。', resources: '本地资源：铁、铜、硅、煤、油、水', localResources: ['iron', 'copper', 'silicon', 'coal', 'crudeOil', 'water', 'naturalGas'], color: '#69d8da', requires: [], position: { x: .5, y: .5 } },
  { id: 'forge', name: '熔火-β', kicker: '钛矿前哨', role: '钛矿前哨', description: '一颗被潮汐锁定的熔岩行星。稳定的钛矿带埋在昼夜交界线上，适合建立重工业前哨。', resources: '本地资源：钛、铁、煤、原油、水、天然气', localResources: ['titanium', 'iron', 'coal', 'crudeOil', 'water', 'naturalGas'], color: '#ff8d63', requires: ['interstellar-logistics'], reward: { resource: 'titanium', amount: 8 }, travelTime: 12, position: { x: .23, y: .28 } },
  { id: 'frost', name: '霜环-7', kicker: '冰卫星', role: '冰卫星', description: '环带中的低温卫星。冰晶与水脉密集，是稳定能量矩阵和远距离燃料储备的理想产地。', resources: '本地资源：冰、水、硅、铁、煤', localResources: ['ice', 'water', 'silicon', 'iron', 'coal'], color: '#8ccfff', requires: ['interstellar-logistics'], reward: { resource: 'ice', amount: 28 }, travelTime: 16, position: { x: .78, y: .27 } },
  { id: 'archive', name: '档案星', kicker: '远古信标', role: '远古信标', description: '失落文明留下的静默信标。稀有硅脉和冰层围绕旧设施分布，适合建设高阶材料前哨。', resources: '本地资源：硅、铁、煤、天然气、水、冰', localResources: ['silicon', 'iron', 'coal', 'naturalGas', 'water', 'ice'], color: '#c58cff', requires: ['stellar-network'], reward: { resource: 'informationCube', amount: 3 }, travelTime: 20, position: { x: .73, y: .73 } }
];
const planetById = Object.fromEntries(planetCatalog.map(planet => [planet.id, planet]));

function clonePlanetNodes(planetId) {
  const template = planetNodeTemplates[planetId] || planetNodeTemplates.home;
  return template.map(node => ({ ...node }));
}

function makeInterstellarState(savedState = null) {
  return {
    selectedPlanet: savedState?.selectedPlanet || 'forge',
    cargo: savedState?.cargo || 'processor',
    returnCargo: savedState?.returnCargo || 'titanium',
    route: savedState?.route || null,
    completedTrips: Number.isFinite(savedState?.completedTrips) ? savedState.completedTrips : 0,
    log: Array.isArray(savedState?.log) ? savedState.log.slice(-8) : [],
    visits: savedState?.visits && typeof savedState.visits === 'object' ? savedState.visits : {}
  };
}

function makeStellarProject(savedState = null) {
  const legacyModules = Number.isFinite(savedState?.modules) ? savedState.modules : 0;
  let components = Array.isArray(savedState?.components)
    ? savedState.components.filter(component => component && component.type).map(component => ({
      id: component.id || `orbit-component-${Math.random().toString(36).slice(2, 8)}`,
      type: component.type,
      remaining: Math.max(0, Number(component.remaining) || 0),
      maxLifetime: Math.max(1, Number(component.maxLifetime) || (ORBIT_COMPONENT_LIFETIME[component.type] || 240))
    }))
    : [];
  // 旧档只有模块计数：迁移节点组件，并为完成框架的旧档补发一套帆/火箭，
  // 保证老存档的恒星接收器仍可供电（新档仍需发射台部署帆/火箭）。
  if (!components.length && legacyModules > 0) {
    const migrated = Math.min(legacyModules, 20);
    for (let index = 0; index < migrated; index += 1) {
      components.push({
        id: `orbit-node-legacy-${index}`,
        type: 'node',
        remaining: ORBIT_COMPONENT_LIFETIME.node,
        maxLifetime: ORBIT_COMPONENT_LIFETIME.node
      });
    }
    if (migrated >= 20) {
      components.push({
        id: 'orbit-sail-legacy-0',
        type: 'sail',
        remaining: ORBIT_COMPONENT_LIFETIME.sail,
        maxLifetime: ORBIT_COMPONENT_LIFETIME.sail
      });
      components.push({
        id: 'orbit-rocket-legacy-0',
        type: 'rocket',
        remaining: ORBIT_COMPONENT_LIFETIME.rocket,
        maxLifetime: ORBIT_COMPONENT_LIFETIME.rocket
      });
    }
  }
  const nodesDeployed = components.filter(component => component.type === 'node').length;
  return {
    progress: clamp(nodesDeployed / 20 * 100, 0, 100),
    modules: legacyModules,
    components,
    nodesDeployed,
    sailsDeployed: components.filter(component => component.type === 'sail').length,
    rocketsDeployed: components.filter(component => component.type === 'rocket').length,
    stabilitySeconds: Number.isFinite(savedState?.stabilitySeconds) ? Math.max(0, savedState.stabilitySeconds) : 0,
    targetEnergy: Number.isFinite(savedState?.targetEnergy) ? Math.max(600, savedState.targetEnergy) : 600,
    energyStored: Number.isFinite(savedState?.energyStored) ? Math.max(0, savedState.energyStored) : 0,
    energyCollected: Number.isFinite(savedState?.energyCollected) ? Math.max(0, savedState.energyCollected) : 0,
    energyRate: 0
  };
}

function makeBuilding(type, x, y, rotation = 0) {
  return {
    id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type, x, y, rotation, input: {}, output: {}, stock: isStorageType(type) ? {} : undefined,
    process: 0, timer: 0, nodeId: null, constructionKit: true,
    researchMode: type === 'researchLab' ? 'auto' : undefined,
    manualResearchMode: false,
    gridEnabled: isPowerTowerType(type) ? true : undefined,
    baseHub: ['storage', 'solidStorage'].includes(type) ? false : undefined,
    sorterRules: type === 'sorter' ? {} : undefined,
    routeCursor: type === 'sorter' ? 0 : undefined,
    sorterMode: type === 'sorter' ? 'input' : undefined,
    recipeId: type === 'assembler' ? 'processor' : type === 'workbench' ? 'gear' : undefined,
    fuelTimer: 0
  };
}

function makePlanetSnapshot(planetId, savedSnapshot = null) {
  if (savedSnapshot && Array.isArray(savedSnapshot.buildings)) {
    return {
      buildings: savedSnapshot.buildings,
      belts: Array.isArray(savedSnapshot.belts) ? savedSnapshot.belts : [],
      nodes: Array.isArray(savedSnapshot.nodes) && savedSnapshot.nodes.length ? savedSnapshot.nodes : clonePlanetNodes(planetId),
      items: Array.isArray(savedSnapshot.items) ? savedSnapshot.items : []
    };
  }
  const landingStorage = makeBuilding('storage', 3, -1);
  landingStorage.baseHub = true;
  landingStorage.stock = {};
  return { buildings: [landingStorage], belts: [], nodes: clonePlanetNodes(planetId), items: [] };
}

function snapshotCurrentPlanet() {
  if (!state?.activePlanet) return;
  state.planetSnapshots = state.planetSnapshots || {};
  state.planetSnapshots[state.activePlanet] = {
    buildings: state.buildings,
    belts: state.belts,
    nodes: state.nodes,
    items: state.items
  };
}

function isStorageType(typeOrBuilding) {
  const type = typeof typeOrBuilding === 'string' ? typeOrBuilding : typeOrBuilding?.type;
  return ['storage', 'solidStorage', 'liquidStorage', 'gasStorage', 'logisticsStation'].includes(type);
}

function storageFormOf(typeOrBuilding) {
  const type = typeof typeOrBuilding === 'string' ? typeOrBuilding : typeOrBuilding?.type;
  return buildings[type]?.storageForm || (type === 'logisticsStation' ? 'solid' : null);
}

function resourceForm(resource) {
  return resources[resource]?.form || 'solid';
}

function isPowerTowerType(typeOrBuilding) {
  const type = typeof typeOrBuilding === 'string' ? typeOrBuilding : typeOrBuilding?.type;
  return type === 'powerTower' || type === 'longPowerTower' || type === 'ultraPowerTower';
}

function storageCapacity(building) {
  if (!isStorageType(building)) return 0;
  const level = clamp(getBuildingLevel(building.type), 1, 5);
  if (building.type === 'logisticsStation') return 960 + (level - 1) * 240;
  const capacityByForm = {
    solid: [240, 480, 720, 1024, 1400],
    liquid: [160, 320, 520, 760, 1040],
    gas: [120, 240, 400, 600, 840]
  };
  return capacityByForm[storageFormOf(building)]?.[level - 1] || 0;
}

function storageUsed(building) {
  return Object.values(building?.stock || {}).reduce((sum, amount) => sum + Math.max(0, amount), 0);
}

function storageHasSpace(building, amount = 1) {
  return storageUsed(building) + amount <= storageCapacity(building);
}

function storageBuildings() {
  return state.buildings.filter(building => isStorageType(building) && isBuildingOperational(building));
}

function storageAmount(resource) {
  const form = resourceForm(resource);
  return storageBuildings().reduce((sum, building) => storageFormOf(building) === form ? sum + (building.stock?.[resource] || 0) : sum, 0);
}

function takeFromStorage(resource, amount) {
  let remaining = amount;
  storageBuildings().forEach(building => {
    if (remaining <= 0) return;
    if (storageFormOf(building) !== resourceForm(resource)) return;
    const available = Math.min(remaining, building.stock?.[resource] || 0);
    if (available <= 0) return;
    building.stock[resource] -= available;
    remaining -= available;
  });
  return amount - remaining;
}

function putInStorage(resource, amount) {
  let remaining = amount;
  storageBuildings().forEach(building => {
    if (remaining <= 0) return;
    if (storageFormOf(building) !== resourceForm(resource)) return;
    const available = Math.min(remaining, Math.max(0, storageCapacity(building) - storageUsed(building)));
    if (available <= 0) return;
    building.stock[resource] = (building.stock[resource] || 0) + available;
    remaining -= available;
  });
  return amount - remaining;
}

// —— 载入期安全区 ——
// readSave() 在 core 顶层同步执行；其调用链（repairSavedBuildingFootprints →
// normalizeSavedBuildings）会同步用到下面这些函数。它们必须定义在 core，
// 否则读档时抛出 ReferenceError 被 readSave 的 catch 吞掉 → 存档静默回退为新档。
// 禁止把其中任何一个移回 world/sim 文件。
function isInsideWorld(cell) {
  return Boolean(cell)
    && cell.x >= WORLD_BOUNDS.minX && cell.x <= WORLD_BOUNDS.maxX
    && cell.y >= WORLD_BOUNDS.minY && cell.y <= WORLD_BOUNDS.maxY;
}

function terrainAt(cell, planetId = null) {
  if (!isInsideWorld(cell)) return { kind: 'void', label: '地图边界', short: '边界' };
  const currentPlanet = planetId || (typeof state !== 'undefined' ? state.activePlanet : 'home');
  const profile = terrainProfiles[currentPlanet] || terrainRegions;
  return profile.find(region => cell.x >= region.minX && cell.x <= region.maxX && cell.y >= region.minY && cell.y <= region.maxY)
    || { kind: 'plain', label: '稳定平原', short: '平原' };
}

function isTerrainBlocked(cell) {
  return terrainAt(cell).kind === 'rock' || terrainAt(cell).kind === 'water' || terrainAt(cell).kind === 'void';
}

function footprintCells(cell, size) {
  const cells = [];
  for (let x = 0; x < size; x += 1) {
    for (let y = 0; y < size; y += 1) cells.push({ x: cell.x + x, y: cell.y + y });
  }
  return cells;
}

function inputCapacity(building) {
  if (!building) return 0;
  if (building.type === 'researchLab') return 6;
  if (building.type === 'smelter' || building.type === 'thermal' || building.type === 'gasTurbine') return 8;
  if (building.type === 'assembler' || building.type === 'workbench') return 6;
  return 4;
}

function outputCapacity(building) {
  return ['miner', 'oilExtractor', 'waterPump', 'gasExtractor'].includes(building?.type) ? 5 : 6;
}

function normalizeSavedBuildings(savedBuildings) {
  return savedBuildings.filter(building => building && buildings[building.type]).map(building => {
    const normalized = {
      ...building,
      input: { ...(building.input || {}) },
      output: { ...(building.output || {}) },
      stock: isStorageType(building)
        ? Object.fromEntries(Object.entries(building.stock || {}).filter(([resource]) => storageFormOf(building) === resourceForm(resource)))
        : undefined,
      sorterRules: building.type === 'sorter' ? { ...(building.sorterRules || {}) } : undefined,
      routeCursor: building.type === 'sorter' ? Math.max(0, Number.isInteger(building.routeCursor) ? building.routeCursor : 0) : undefined,
      sorterMode: building.type === 'sorter' ? (building.sorterMode === 'output' ? 'output' : 'input') : undefined,
      recipeId: building.type === 'assembler' || building.type === 'workbench'
        ? (assemblyRecipes[building.recipeId] ? building.recipeId : building.type === 'workbench' ? 'gear' : 'processor')
        : undefined,
      fuelTimer: Number.isFinite(building.fuelTimer) ? Math.max(0, building.fuelTimer) : 0,
      constructionKit: true,
      gridEnabled: isPowerTowerType(building.type) ? building.gridEnabled !== false : undefined,
      baseHub: ['storage', 'solidStorage'].includes(building.type) ? building.baseHub === true : undefined
    };
    Object.keys(normalized.input).forEach(resource => {
      normalized.input[resource] = clamp(normalized.input[resource] || 0, 0, inputCapacity(normalized));
    });
    Object.keys(normalized.output).forEach(resource => {
      normalized.output[resource] = clamp(normalized.output[resource] || 0, 0, outputCapacity(normalized));
    });
    if (building.type === 'smelter' && !building.recipeResource) {
      const recipeResource = ['copper', 'iron', 'silicon'].find(resource => (building.input?.[resource] || 0) > 0);
      return recipeResource ? { ...normalized, recipeResource } : normalized;
    }
    if (building.type !== 'researchLab') return normalized;
    // Older saves stored the target cube directly. Treat those values as the
    // old automatic mode so a save made before lab presets remains playable.
    if (building.manualResearchMode !== true) return { ...normalized, researchMode: 'auto', manualResearchMode: false };
    return { ...normalized, researchMode: building.researchMode || 'auto' };
  });
}

let savedPlacementRepairCount = 0;

function savedResourceNodeAt(cell, savedNodes) {
  return savedNodes.find(node => node.x === cell.x && node.y === cell.y) || null;
}

function savedBuildingOverlaps(candidate, building) {
  const candidateSize = buildings[candidate.type].size;
  const buildingSize = buildings[building.type].size;
  return candidate.x < building.x + buildingSize
    && candidate.x + candidateSize > building.x
    && candidate.y < building.y + buildingSize
    && candidate.y + candidateSize > building.y;
}

function savedPlacementIsClear(candidate, placedBuildings, savedNodes) {
  const footprint = footprintCells(candidate, buildings[candidate.type].size);
  return footprint.every(cell => isInsideWorld(cell) && !isTerrainBlocked(cell) && !savedResourceNodeAt(cell, savedNodes))
    && !placedBuildings.some(building => savedBuildingOverlaps(candidate, building));
}

function nearbyLegalSavedCell(building, placedBuildings, savedNodes) {
  for (let radius = 0; radius <= 12; radius += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      const dy = radius - Math.abs(dx);
      const candidates = dy === 0 ? [0] : [-dy, dy];
      for (const offsetY of candidates) {
        const candidate = { ...building, x: building.x + dx, y: building.y + offsetY };
        if (savedPlacementIsClear(candidate, placedBuildings, savedNodes)) return candidate;
      }
    }
  }
  return building;
}

function repairSavedBuildingFootprints(savedBuildings, savedNodes) {
  const repairedBuildings = [];
  savedBuildings.forEach(building => {
    const repaired = savedPlacementIsClear(building, repairedBuildings, savedNodes)
      ? building
      : nearbyLegalSavedCell(building, repairedBuildings, savedNodes);
    if (repaired.x !== building.x || repaired.y !== building.y) savedPlacementRepairCount += 1;
    if (['miner', 'oilExtractor', 'waterPump', 'gasExtractor'].includes(repaired.type)) {
      const size = buildings[repaired.type].size;
      repaired.nodeId = savedNodes.find(node => node.x >= repaired.x - 1 && node.x < repaired.x + size + 1 && node.y >= repaired.y - 1 && node.y < repaired.y + size + 1)?.id || null;
    }
    repairedBuildings.push(repaired);
  });
  return repairedBuildings;
}

function readSave() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || localStorage.getItem(LEGACY_SAVE_KEY) || 'null');
    if (!saved) return null;
    const savedNodes = Array.isArray(saved.nodes) && saved.nodes.length ? saved.nodes : initialNodeState.map(node => ({ ...node }));
    const savedBuildings = Array.isArray(saved.buildings)
      ? repairSavedBuildingFootprints(normalizeSavedBuildings(saved.buildings), savedNodes)
      : [];
    if (!savedBuildings.some(building => isStorageType(building))) {
      const starterStorage = makeBuilding('storage', 3, -1);
      starterStorage.stock = { ...startingStorageStock };
      starterStorage.baseHub = true;
      savedBuildings.push(starterStorage);
    }
    if (!savedBuildings.some(building => building.baseHub)) {
      const starterStorage = savedBuildings.find(building => isStorageType(building));
      if (starterStorage) starterStorage.baseHub = true;
    }
    const hasPowerConsumer = savedBuildings.some(building => {
      const meta = buildings[building.type];
      return !building.baseHub && Boolean(meta && (meta.power > 0 || meta.generation > 0));
    });
    const hasTransmissionTower = savedBuildings.some(building => isPowerTowerType(building.type));
    return {
      buildings: savedBuildings,
      belts: Array.isArray(saved.belts) ? saved.belts : [],
      inventory: { ...startingInventory, ...(saved.inventory || {}) },
      kits: { ...startingKits, ...(saved.kits || {}) },
      items: (Array.isArray(saved.items) ? saved.items : []).filter(item => item && item.beltId && item.resource),
      nodes: savedNodes,
      time: Number.isFinite(saved.time) ? saved.time : 6 * 3600,
      tech: Array.isArray(saved.tech) && saved.tech.length ? [...new Set(['foundation', ...saved.tech])] : [...startingTech],
      research: saved.research && typeof saved.research === 'object' ? saved.research : { current: null, progress: 0 },
      interstellar: makeInterstellarState(saved.interstellar),
      stellarProject: makeStellarProject(saved.stellarProject),
      activePlanet: planetById[saved.activePlanet] ? saved.activePlanet : 'home',
      planetSnapshots: saved.planetSnapshots && typeof saved.planetSnapshots === 'object' ? saved.planetSnapshots : {},
      career: saved.career || 'logistics',
      careerChosen: saved.careerChosen !== false,
      powerMigration: hasPowerConsumer && !hasTransmissionTower
    };
  } catch (error) {
    console.error('读档失败，已回退为新档（请把此错误发回排查）:', error);
    return null;
  }
}

const saved = readSave();
const state = {
  viewport: { width: window.innerWidth, height: window.innerHeight },
  camera: { x: 0, y: 1 },
  zoom: .78,
  tool: 'inspect',
  dockCategory: 'extract',
  rotation: 0,
  paused: false,
  animTime: 0,
  selectedId: null,
  selectedBeltId: null,
  pointer: { cell: { x: 0, y: 0 }, down: false, startCell: null, startBuildingId: null, sorterAnchor: null, panning: false, lastX: 0, lastY: 0 },
  buildings: saved?.buildings || [(() => { const storage = makeBuilding('storage', 3, -1); storage.baseHub = true; storage.stock = { ...startingStorageStock }; return storage; })()],
  belts: saved?.belts || [],
  nodes: saved?.nodes || initialNodeState.map(node => ({ ...node })),
  items: [],
  inventory: { ...startingInventory, ...(saved?.inventory || {}) },
  kits: { ...startingKits, ...(saved?.kits || {}) },
  time: saved?.time ?? 6 * 3600,
  tech: saved?.tech || [...startingTech],
  research: saved?.research || { current: null, progress: 0 },
  interstellar: makeInterstellarState(saved?.interstellar),
  stellarProject: makeStellarProject(saved?.stellarProject),
  activePlanet: saved?.activePlanet && planetById[saved.activePlanet] ? saved.activePlanet : 'home',
  planetSnapshots: saved?.planetSnapshots && typeof saved.planetSnapshots === 'object' ? saved.planetSnapshots : {},
  career: saved ? (saved.career || 'logistics') : null,
  careerChosen: saved ? saved.careerChosen !== false : false,
  pendingCareer: saved?.career || 'logistics',
  powerMigration: !qaDemoMode && !qaPlaythroughMode && saved?.powerMigration === true,
  researchRate: 0,
  powerGeneration: 0,
  basePowerGeneration: 0,
  lastToast: 0,
  powerLoad: 0,
  powerGrids: [],
  powerSummary: { gridCount: 0, highLoadCount: 0, blackoutCount: 0, generation: 0, load: 0 },
  simulationSpeed: 1,
  sorterRoutingSignature: '',
  assetFallbacks: 0,
  production: { second: -1, current: {}, history: [] }
};
{
  const savedBeltIds = new Set(state.belts.map(belt => belt.id));
  state.items = (saved?.items || []).filter(item => item && item.beltId && item.resource && savedBeltIds.has(item.beltId)).map(item => ({
    id: item.id || `item-${Math.random().toString(36).slice(2, 7)}`,
    beltId: item.beltId,
    sourceId: item.sourceId || null,
    resource: item.resource,
    progress: Math.min(1, Math.max(0, Number(item.progress) || 0))
  }));
}
function query(selector) { return document.querySelector(selector); }
function all(selector) { return [...document.querySelectorAll(selector)]; }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function formatNumber(value) { return Math.max(0, Math.floor(value)).toLocaleString('en-US'); }
function hasImage(image) { return image && image.complete && image.naturalWidth > 0; }
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character])); }

const dockCategoryByTool = Object.freeze({
  inspect: 'tools', demolish: 'tools',
  miner: 'extract', waterPump: 'extract', oilExtractor: 'extract', gasExtractor: 'extract',
  belt: 'logistics', sorter: 'logistics', logisticsStation: 'logistics',
  smelter: 'manufacture', assembler: 'manufacture', workbench: 'manufacture',
  researchLab: 'research',
  wind: 'power', thermal: 'power', gasTurbine: 'power', stellarReceiver: 'power', solarSailLauncher: 'power', structureLauncher: 'power', powerTower: 'power', longPowerTower: 'power', ultraPowerTower: 'power',
  storage: 'storage', solidStorage: 'storage', liquidStorage: 'storage', gasStorage: 'storage'
});
const dockCategories = new Set(['tools', 'extract', 'logistics', 'manufacture', 'research', 'power', 'storage']);
let renderedDockCategory = null;
