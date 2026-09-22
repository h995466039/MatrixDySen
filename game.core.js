// 星环回声 · game.core.js — 常量/数据表/素材加载/存档系统/全局状态/基础工具
// （由 game.js 拆分于 2026-09-22；加载顺序：core → world → sim → ui → tools → main）

const canvas = document.querySelector('#game-canvas');
const ctx = canvas.getContext('2d');
const shell = document.querySelector('#game-shell');
const TILE = 48;
const WORLD_BOUNDS = Object.freeze({ minX: -18, maxX: 18, minY: -12, maxY: 12 });
const terrainRegions = [
  { kind: 'rock', label: '玄武岩岩场', short: '岩石', minX: -16, maxX: -13, minY: -9, maxY: -6 },
  { kind: 'rock', label: '玄武岩岩场', short: '岩石', minX: 12, maxX: 15, minY: -8, maxY: -5 },
  { kind: 'water', label: '低洼水域', short: '水域', minX: -15, maxX: -11, minY: 7, maxY: 10 },
  { kind: 'water', label: '低洼水域', short: '水域', minX: 15, maxX: 17, minY: 8, maxY: 10 }
];
const SAVE_KEY = 'stellar-echo-sandbox-v2';
const LEGACY_SAVE_KEY = 'stellar-echo-sandbox-v1';
const urlParams = new URLSearchParams(window.location.search);
const qaDemoMode = urlParams.get('demo');
const qaPlaythroughMode = urlParams.get('qa') === 'playthrough';
const requestedPanel = urlParams.get('panel');

const assets = {};
const assetPaths = {
  copper: 'output/imagegen/resource-copper-ore-v01.png',
  silicon: 'output/imagegen/resource-silicon-crystal-v01.png',
  iron: 'output/imagegen/resource-iron-ore-v01.png',
  ice: 'output/imagegen/resource-ice-crystal-v01.png',
  copperIngot: 'output/imagegen/resource-copper-ingot-v01.png',
  siliconWafer: 'output/imagegen/resource-silicon-wafer-v01.png',
  processor: 'output/imagegen/resource-processor-chip-v01.png',
  titanium: 'output/imagegen/resource-titanium-crystal-v01.png',
  electromagneticCube: 'godot_game/assets/generated/resource_matrix_v02.png',
  miner: 'output/imagegen/building-mining-drill-v01.png',
  smelter: 'output/imagegen/building-smelter-v01.png',
  assembler: 'output/imagegen/building-assembler-v01.png',
  researchLab: 'godot_game/assets/generated/building_research-lab_north.png',
  sorter: 'godot_game/assets/generated/building_sorter_north.png',
  wind: 'godot_game/assets/generated/building_wind-generator_north.png',
  thermal: 'godot_game/assets/generated/building_thermal-generator_north.png',
  oilExtractor: 'godot_game/assets/generated/building_oil-extractor_north.png',
  storage: 'godot_game/assets/generated/building_storage_north.png',
  groundTile: 'output/imagegen/godot-v02-ground-tile.png',
  rockTile: 'output/imagegen/godot-v02-ground-tile.png',
  waterTile: 'godot_game/assets/generated/terrain_water_tile_v01.png',
};
const assetSvgFallbacks = {
  miner: 'godot_game/assets/generated/building_miner.svg',
  smelter: 'godot_game/assets/generated/building_smelter.svg',
  researchLab: 'godot_game/assets/generated/building_research.svg',
  sorter: 'godot_game/assets/generated/building_sorter.svg',
  storage: 'godot_game/assets/generated/building_storage.svg',
  copper: 'godot_game/assets/generated/resource_copper.svg',
  iron: 'godot_game/assets/generated/resource_iron.svg',
  electromagneticCube: 'godot_game/assets/generated/resource_matrix.svg',
  groundTile: 'godot_game/assets/generated/ground_tile.svg',
  rockTile: 'godot_game/assets/generated/ground_tile.svg'
};
Object.entries(assetPaths).forEach(([key, path]) => {
  const image = new Image();
  const fallback = assetSvgFallbacks[key];
  if (fallback) {
    // 初代矢量占位素材：PNG 缺失时用 SVG 兜底，让"被取代的素材"重新上岗。
    image.addEventListener('error', () => {
      if (image.dataset.svgFallback === '1') return;
      image.dataset.svgFallback = '1';
      image.src = fallback;
    });
  }
  image.src = path;
  assets[key] = image;
});

// SVG 缩放到画布每帧都会重新栅格化（实测比 PNG 贵约 7 倍）。首次使用时
// 预栅格化到离屏画布，之后走廉价的位图绘制；PNG 直接返回原图。
const rasterCache = new Map();
function rasterizedAsset(key) {
  const image = assets[key];
  if (!image || !hasImage(image)) return null;
  if (image.dataset.svgFallback !== '1') return image;
  if (!rasterCache.has(key)) {
    const canvas = document.createElement('canvas');
    canvas.width = 192;
    canvas.height = 192;
    canvas.getContext('2d').drawImage(image, 0, 0, 192, 192);
    rasterCache.set(key, canvas);
  }
  return rasterCache.get(key);
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
  addEntry('output/imagegen/stellar-ring-concept-v01.png', null, '星图背景');
  if (typeof careerCatalog !== 'undefined') Object.values(careerCatalog).forEach(career => addEntry(`output/imagegen/${career.image}`, null, career.label));

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
  copper: { label: '铜', color: '#ff9b3d', image: 'copper' },
  silicon: { label: '硅', color: '#69d8da', image: 'silicon' },
  iron: { label: '铁', color: '#b56e58', image: 'iron' },
  coal: { label: '煤', color: '#827a88' },
  crudeOil: { label: '原油', color: '#c97849' },
  water: { label: '水', color: '#5cc8ed' },
  ironIngot: { label: '铁锭', color: '#d58a6c' },
  ice: { label: '冰', color: '#8ccfff', image: 'ice' },
  copperIngot: { label: '铜锭', color: '#ffc266', image: 'copperIngot' },
  siliconWafer: { label: '硅片', color: '#b0ffff', image: 'siliconWafer' },
  processor: { label: '芯片', color: '#c7d94c', image: 'processor' },
  titanium: { label: '钛', color: '#b9a7ff', image: 'titanium' },
  electromagneticCube: { label: '电磁矩阵', color: '#61d9e4', image: 'electromagneticCube' },
  energyCube: { label: '能量矩阵', color: '#f5c85b', image: 'energyCube' },
  structureCube: { label: '结构矩阵', color: '#e894e8', image: 'structureCube' },
  informationCube: { label: '信息矩阵', color: '#7ed6ff', image: 'informationCube' }
};

const sorterRouteCatalog = [
  'iron', 'copper', 'silicon', 'coal', 'crudeOil', 'water', 'ice', 'titanium',
  'ironIngot', 'copperIngot', 'siliconWafer', 'processor',
  'electromagneticCube', 'energyCube', 'structureCube', 'informationCube'
];

const buildings = {
  miner: { label: '采矿机', size: 2, color: '#ff9b3d', power: .6, cost: { iron: 8, copper: 2 }, tech: 'foundation', image: 'miner' },
  smelter: { label: '冶炼机', size: 2, color: '#f7c35e', power: .9, cost: { iron: 10, copper: 2 }, tech: 'foundation', image: 'smelter' },
  waterPump: { label: '水泵', size: 2, color: '#5cc8ed', power: .7, cost: { iron: 10, copper: 2 }, tech: 'foundation' },
  powerTower: { label: '电力塔', size: 1, color: '#69d8da', power: .08, transmissionRange: 5, cost: { iron: 6, copper: 2 }, tech: 'foundation' },
  // The first assembler is the bootstrap for processors, so it cannot itself
  // require a processor. Later buildings still carry the same production
  // recipe and remain gated by power, inputs, and logistics.
  assembler: { label: '组装机', size: 2, color: '#c7d94c', power: 1.2, cost: { iron: 8, copper: 4, processor: 1 }, tech: 'automated-smelting', image: 'assembler' },
  // The first sorter is part of the foundation loop. Smart sorting later
  // upgrades the same physical interface with rules and multiple exits.
  sorter: { label: '分拣器', size: 1, color: '#69d8da', power: .1, cost: { iron: 4, copper: 2 }, tech: 'foundation', image: 'sorter' },
  workbench: { label: '工作台', size: 2, color: '#e8a46e', power: .5, cost: { iron: 12, copper: 4 }, tech: 'workbench-tech' },
  wind: { label: '风力发电机', size: 2, color: '#a8e7dd', power: 0, generation: 2.6, cost: { iron: 10, copper: 6 }, tech: 'wind-power' },
  thermal: { label: '火力发电机', size: 2, color: '#ee765c', power: .2, generation: 6, cost: { iron: 18, copper: 10 }, tech: 'thermal-power' },
  longPowerTower: { label: '远距离电力塔', size: 1, color: '#8ccfff', power: .14, transmissionRange: 9, cost: { iron: 12, copper: 6, processor: 1 }, tech: 'power-transmission' },
  ultraPowerTower: { label: '超远距离电力塔', size: 2, color: '#c58cff', power: .24, transmissionRange: 15, cost: { iron: 24, copper: 12, processor: 3 }, tech: 'advanced-power-grid' },
  oilExtractor: { label: '石油提取机', size: 2, color: '#d18a57', power: 2.2, cost: { iron: 24, processor: 2 }, tech: 'oil-processing' },
  researchLab: { label: '科研站', size: 2, color: '#7ed6ff', power: 1.6, cost: { iron: 20, processor: 4 }, tech: 'foundation', image: 'researchLab' },
  storage: { label: '物流仓储', size: 2, color: '#a7c7ff', power: .15, cost: { iron: 16, copper: 4 }, tech: 'foundation', image: 'storage' },
  logisticsStation: { label: '行星物流站', size: 3, color: '#c58cff', power: 2.8, cost: { iron: 32, processor: 6, titanium: 4 }, tech: 'interstellar-logistics' }
};

const cubeRecipes = {
  electromagneticCube: { label: '电磁矩阵', color: '#61d9e4', time: 2.4, inputs: { copperIngot: 1, siliconWafer: 1 } },
  energyCube: { label: '能量矩阵', color: '#f5c85b', time: 2.8, inputs: { copperIngot: 1, coal: 1 } },
  structureCube: { label: '结构矩阵', color: '#e894e8', time: 3.2, inputs: { ironIngot: 1, processor: 1 } },
  informationCube: { label: '信息矩阵', color: '#7ed6ff', time: 4.2, inputs: { energyCube: 1, structureCube: 1 } }
};

const techTree = {
  mainline: [
    { id: 'planetary-logistics', label: '行星物流', short: '物流主干', description: '建立行星级物流网络，研究分拣与长距离运输。', cube: 'electromagneticCube', cost: 12 },
    { id: 'automated-smelting', label: '自动冶炼', short: '工业主干', description: '把原矿加工成稳定的工业中间品，并授权第一座自动组装设备。', requires: ['planetary-logistics'], cube: 'energyCube', cost: 16, unlocks: ['assembler'], upgrades: ['smelter'], effectText: '解锁组装机 · 冶炼机速度 +33%' },
    { id: 'matrix-lab', label: '矩阵实验室', short: '科研主干', description: '将研究矩阵转化为可持续的科技推进力。', requires: ['automated-smelting'], cube: 'structureCube', cost: 22, upgrades: ['researchLab'], effectText: '科研站矩阵制备速度 +25%' },
    { id: 'interstellar-logistics', label: '星际物流', short: '跨星际主干', description: '接入恒星系航线，授权行星物流站并允许派遣货运舱回收异星资源。', requires: ['matrix-lab'], cube: 'informationCube', cost: 32, unlocks: ['行星物流站、星图与货运舱'] },
    { id: 'stellar-network', label: '恒星网络', short: '跨星际主干', description: '让远端信标加入同一条物流网络，开放档案星航线。', requires: ['interstellar-logistics'], cube: 'informationCube', cost: 40, unlocks: ['档案星航线'] },
    { id: 'dyson-frame', label: '戴森框架', short: '恒星工程', description: '用异星资源搭建包围恒星的第一圈能量框架。', requires: ['stellar-network'], cube: 'structureCube', cost: 48, unlocks: ['恒星工程阶段'] }
  ],
  branches: [
    { id: 'sorter-tech', label: '智能分拣', short: '物流分支', description: '升级基础分拣器的识别与分流能力，让同一条物流线可以按物料接入不同产线。', requires: ['planetary-logistics'], cube: 'electromagneticCube', cost: 12, upgrades: ['sorter'], effectText: '分拣器获得多出口规则与自动分流' },
    { id: 'belt-mk2', label: '高速传送', short: '物流分支', description: '提升物流网络的吞吐能力。', requires: ['sorter-tech'], cube: 'energyCube', cost: 14, upgrades: ['belt'], effectText: '传送带速度 +43%' },
    { id: 'storage-mk2', label: '仓储扩容', short: '物流分支', description: '增加仓储箱容量，并允许更高频率的分拣器取放。', requires: ['sorter-tech'], cube: 'energyCube', cost: 18, upgrades: ['storage'], effectText: '物流仓储容量 240 → 480' },
    { id: 'wind-power', label: '风能捕获', short: '能源分支', description: '用行星风场提供稳定的基础电力。', requires: ['planetary-logistics'], cube: 'electromagneticCube', cost: 8, unlocks: ['wind'], effectText: '解锁风力发电机' },
    { id: 'thermal-power', label: '热能转化', short: '能源分支', description: '消耗煤炭，将化学能转化为电力。', requires: ['wind-power'], cube: 'energyCube', cost: 14, unlocks: ['thermal'], effectText: '解锁火力发电机' },
    { id: 'oil-processing', label: '石化开采', short: '能源分支', description: '从原油渗流区建立压力开采。', requires: ['planetary-logistics'], cube: 'energyCube', cost: 16, unlocks: ['oilExtractor'], effectText: '解锁石油提取机' },
    { id: 'workbench-tech', label: '精密工作台', short: '制造分支', description: '允许小批量制造电路与研究组件。', cube: 'electromagneticCube', cost: 8, unlocks: ['workbench'], upgrades: ['workbench'], effectText: '解锁工作台 · 工作台速度 +27%' },
    { id: 'advanced-assembly', label: '高级组装', short: '制造分支', description: '为处理器和矩阵生产提供更高效率。', requires: ['automated-smelting'], cube: 'structureCube', cost: 18, upgrades: ['assembler', 'workbench'], effectText: '组装机与工作台速度 +30%' },
    { id: 'mining-mk2', label: '高压采掘', short: '工业分支', description: '升级采矿机钻头与排矿节拍，减少矿脉等待时间。', requires: ['planetary-logistics'], cube: 'energyCube', cost: 18, upgrades: ['miner'], effectText: '采矿机速度 +35%' },
    { id: 'power-transmission', label: '远距输电', short: '能源分支', description: '用高压线圈延长电力塔的传输半径，允许多个局部电网稳定互联。', requires: ['thermal-power'], cube: 'energyCube', cost: 18, unlocks: ['longPowerTower'], effectText: '解锁远距离电力塔 · 基础电塔覆盖范围 +15%' },
    { id: 'power-grid-mk2', label: '电网增容', short: '能源分支', description: '升级发电设施的能量转换模块，提高整个生存电网的余量。', requires: ['thermal-power'], cube: 'structureCube', cost: 24, upgrades: ['wind', 'thermal'], effectText: '风力与火力发电机输出 +25%' },
    { id: 'advanced-power-grid', label: '超远距骨干网', short: '能源分支', description: '建立跨区域骨干输电，允许超远距离电力塔接管整片工业区。', requires: ['power-transmission', 'power-grid-mk2'], cube: 'informationCube', cost: 32, unlocks: ['ultraPowerTower'], effectText: '解锁超远距离电力塔 · 全部电塔覆盖范围 +10%' },
    { id: 'oil-extractor-mk2', label: '深层泵压', short: '能源分支', description: '为石油提取机加装深层泵压模块，提升原油采集速率。', requires: ['oil-processing'], cube: 'structureCube', cost: 20, upgrades: ['oilExtractor'], effectText: '石油提取机速度 +35%' }
  ]
};
const foundationTech = { id: 'foundation', label: '基础工业授权', short: '初始权限', description: '授予着陆舱周边的第一套工业设施许可证。基础电力塔把着陆舱、发电机和早期产线接成局部电网。', requires: [], cube: 'electromagneticCube', cost: 0, unlocks: ['miner', 'smelter', 'waterPump', 'researchLab', 'storage', 'sorter', 'powerTower'], effectText: '解锁采矿机、水泵、冶炼机、科研站、物流仓储、基础分拣器与电力塔' };
const techNodes = [foundationTech, ...techTree.mainline, ...techTree.branches];
const techById = Object.fromEntries(techNodes.map(tech => [tech.id, tech]));
const startingTech = ['foundation'];
const startingInventory = { iron: 72, copper: 28, silicon: 16, coal: 4, crudeOil: 0, water: 0, titanium: 0, ironIngot: 4, copperIngot: 4, siliconWafer: 4, processor: 6, electromagneticCube: 0, energyCube: 0, structureCube: 0, informationCube: 0 };
const startingStorageStock = { iron: 96, copper: 48, silicon: 32, coal: 8, crudeOil: 0, water: 0, titanium: 0, ironIngot: 4, copperIngot: 6, siliconWafer: 6, processor: 8, electromagneticCube: 0, energyCube: 0, structureCube: 0, informationCube: 0 };
const startingKits = { miner: 1, smelter: 1, waterPump: 0, sorter: 1, powerTower: 1, longPowerTower: 0, ultraPowerTower: 0, belt: 8 };
const handcraftRecipes = [
  { id: 'miner', label: '采矿机套件', description: '覆盖矿脉，开始采集基础原矿。', outputLabel: '采矿机 ×1', outputType: 'kit', output: 'miner', amount: 1, cost: { iron: 8, copper: 2 } },
  { id: 'smelter', label: '熔炼炉套件', description: '把原矿加工成金属锭或硅片。', outputLabel: '熔炼炉 ×1', outputType: 'kit', output: 'smelter', amount: 1, cost: { iron: 10, copper: 2 } },
  { id: 'waterPump', label: '水泵套件', description: '覆盖水源采集区，提供基础水资源。', outputLabel: '水泵 ×1', outputType: 'kit', output: 'waterPump', amount: 1, cost: { iron: 10, copper: 2 } },
  { id: 'sorter', label: '分拣器套件', description: '把建筑接口接入传送带物流。', outputLabel: '分拣器 ×1', outputType: 'kit', output: 'sorter', amount: 1, cost: { iron: 4, copper: 2 } },
  { id: 'powerTower', label: '电力塔套件', description: '以塔为圆心覆盖局部电网，连接发电与用电设施。', outputLabel: '电力塔 ×1', outputType: 'kit', output: 'powerTower', amount: 1, cost: { iron: 6, copper: 2 } },
  { id: 'belt', label: '传送带组件', description: '铺设四格基础物流线路。', outputLabel: '传送带 ×4 格', outputType: 'kit', output: 'belt', amount: 4, cost: { iron: 4 } }
];
const simulationSpeeds = [1, 2, 4];

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
    bonus: '发电量 +20%', detail: '着陆舱基础电源、风力和火力发电机提供更多电力，适合早期铺开多条产线。',
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
  { id: 'copper-south', x: 0, y: 8, resource: 'copper', amount: 48800 },
  { id: 'copper-west', x: -12, y: 2, resource: 'copper', amount: 35200 },
  { id: 'silicon-west', x: 5, y: -4, resource: 'silicon', amount: 28100 },
  { id: 'silicon-north', x: 1, y: -8, resource: 'silicon', amount: 33400 },
  { id: 'silicon-south', x: 10, y: 9, resource: 'silicon', amount: 21600 },
  { id: 'iron-east', x: 6, y: 5, resource: 'iron', amount: 91600 },
  { id: 'iron-west', x: -12, y: -2, resource: 'iron', amount: 74600 },
  { id: 'iron-south', x: 2, y: 11, resource: 'iron', amount: 52800 },
  { id: 'ice-south', x: -6, y: 7, resource: 'ice', amount: 46200 },
  { id: 'ice-north', x: -2, y: -10, resource: 'ice', amount: 29800 },
  { id: 'water-west', x: -10, y: 7, resource: 'water', amount: 100000 },
  { id: 'water-east', x: 14, y: 8, resource: 'water', amount: 82000 },
  { id: 'coal-north-east', x: 10, y: -5, resource: 'coal', amount: 53600 },
  { id: 'coal-west', x: -10, y: -8, resource: 'coal', amount: 41800 },
  { id: 'coal-south', x: 12, y: 11, resource: 'coal', amount: 26700 },
  { id: 'oil-east', x: 11, y: 6, resource: 'crudeOil', amount: 78000 }
  ,{ id: 'oil-north', x: 13, y: 2, resource: 'crudeOil', amount: 43200 }
  ,{ id: 'oil-west', x: -4, y: 10, resource: 'crudeOil', amount: 30100 }
];
const initialNodeState = nodes.map(node => ({ ...node }));

const planetCatalog = [
  { id: 'home', name: '晨星-03', kicker: 'HOMEWORLD / BASE', role: '母星基地', description: '母星工业区。所有货运舱从这里发射，回收物会直接进入物流仓储。', resources: '本地资源：铁、铜、硅', color: '#69d8da', requires: [], position: { x: .5, y: .5 } },
  { id: 'forge', name: '熔火-β', kicker: 'FORGE OUTPOST / MINING', role: '钛矿前哨', description: '一颗被潮汐锁定的熔岩行星。稳定的钛矿带埋在昼夜交界线上。', resources: '航线回收：钛 ×8', color: '#ff8d63', requires: ['interstellar-logistics'], reward: { resource: 'titanium', amount: 8 }, travelTime: 12, position: { x: .23, y: .28 } },
  { id: 'frost', name: '霜环-7', kicker: 'FROST MOON / ICE', role: '冰卫星', description: '环带中的低温卫星。冰晶可以稳定能量矩阵，也能支持远距离燃料储备。', resources: '航线回收：冰 ×28', color: '#8ccfff', requires: ['interstellar-logistics'], reward: { resource: 'ice', amount: 28 }, travelTime: 16, position: { x: .78, y: .27 } },
  { id: 'archive', name: '档案星', kicker: 'ARCHIVE WORLD / SIGNAL', role: '远古信标', description: '失落文明留下的静默信标。只有恒星网络完成后，货运舱才能安全穿过信号风暴。', resources: '航线回收：信息矩阵 ×3', color: '#c58cff', requires: ['stellar-network'], reward: { resource: 'informationCube', amount: 3 }, travelTime: 20, position: { x: .73, y: .73 } }
];
const planetById = Object.fromEntries(planetCatalog.map(planet => [planet.id, planet]));

function makeInterstellarState(savedState = null) {
  return {
    selectedPlanet: savedState?.selectedPlanet || 'forge',
    cargo: savedState?.cargo || 'processor',
    route: savedState?.route || null,
    completedTrips: Number.isFinite(savedState?.completedTrips) ? savedState.completedTrips : 0,
    log: Array.isArray(savedState?.log) ? savedState.log.slice(-8) : [],
    visits: savedState?.visits && typeof savedState.visits === 'object' ? savedState.visits : {}
  };
}

function makeStellarProject(savedState = null) {
  return {
    progress: Number.isFinite(savedState?.progress) ? clamp(savedState.progress, 0, 100) : 0,
    modules: Number.isFinite(savedState?.modules) ? savedState.modules : 0
  };
}

function makeBuilding(type, x, y, rotation = 0) {
  return {
    id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type, x, y, rotation, input: {}, output: {}, stock: isStorageType(type) ? {} : undefined,
    process: 0, timer: 0, nodeId: null, constructionKit: false,
    researchMode: type === 'researchLab' ? 'auto' : undefined,
    manualResearchMode: false,
    gridEnabled: isPowerTowerType(type) ? true : undefined,
    baseHub: type === 'storage' ? false : undefined,
    sorterRules: type === 'sorter' ? {} : undefined,
    routeCursor: type === 'sorter' ? 0 : undefined,
    sorterMode: type === 'sorter' ? 'input' : undefined
  };
}

function isStorageType(typeOrBuilding) {
  const type = typeof typeOrBuilding === 'string' ? typeOrBuilding : typeOrBuilding?.type;
  return type === 'storage' || type === 'logisticsStation';
}

function isPowerTowerType(typeOrBuilding) {
  const type = typeof typeOrBuilding === 'string' ? typeOrBuilding : typeOrBuilding?.type;
  return type === 'powerTower' || type === 'longPowerTower' || type === 'ultraPowerTower';
}

function storageCapacity(building) {
  if (!isStorageType(building)) return 0;
  if (building.type === 'logisticsStation') return 960;
  return isTechUnlocked('storage-mk2') ? 480 : 240;
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
  return storageBuildings().reduce((sum, building) => sum + (building.stock?.[resource] || 0), 0);
}

function takeFromStorage(resource, amount) {
  let remaining = amount;
  storageBuildings().forEach(building => {
    if (remaining <= 0) return;
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
    const available = Math.min(remaining, Math.max(0, storageCapacity(building) - storageUsed(building)));
    if (available <= 0) return;
    building.stock[resource] = (building.stock[resource] || 0) + available;
    remaining -= available;
  });
  return amount - remaining;
}

function normalizeSavedBuildings(savedBuildings) {
  return savedBuildings.filter(building => building && buildings[building.type]).map(building => {
    const normalized = {
      ...building,
      input: { ...(building.input || {}) },
      output: { ...(building.output || {}) },
      stock: isStorageType(building) ? { ...(building.stock || {}) } : undefined,
      sorterRules: building.type === 'sorter' ? { ...(building.sorterRules || {}) } : undefined,
      routeCursor: building.type === 'sorter' ? Math.max(0, Number.isInteger(building.routeCursor) ? building.routeCursor : 0) : undefined,
      sorterMode: building.type === 'sorter' ? (building.sorterMode === 'output' ? 'output' : 'input') : undefined,
      gridEnabled: isPowerTowerType(building.type) ? building.gridEnabled !== false : undefined,
      baseHub: building.type === 'storage' ? building.baseHub === true : undefined
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
    if (repaired.type === 'miner' || repaired.type === 'oilExtractor' || repaired.type === 'waterPump') {
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
      nodes: savedNodes,
      time: Number.isFinite(saved.time) ? saved.time : 6 * 3600,
      tech: Array.isArray(saved.tech) && saved.tech.length ? [...new Set(['foundation', ...saved.tech])] : [...startingTech],
      research: saved.research && typeof saved.research === 'object' ? saved.research : { current: null, progress: 0 },
      interstellar: makeInterstellarState(saved.interstellar),
      stellarProject: makeStellarProject(saved.stellarProject),
      items: Array.isArray(saved.items) ? saved.items : [],
      career: saved.career || 'logistics',
      careerChosen: saved.careerChosen !== false,
      powerMigration: hasPowerConsumer && !hasTransmissionTower
    };
  } catch {
    return null;
  }
}

const saved = readSave();
const state = {
  viewport: { width: window.innerWidth, height: window.innerHeight },
  camera: { x: 0, y: 1 },
  zoom: .78,
  tool: 'inspect',
  rotation: 0,
  paused: false,
  animTime: 0,
  selectedId: null,
  selectedBeltId: null,
  pointer: { cell: { x: 0, y: 0 }, down: false, startCell: null, startBuildingId: null, sorterAnchor: null, panning: false, lastX: 0, lastY: 0 },
  buildings: saved?.buildings || [(() => { const storage = makeBuilding('storage', 3, -1); storage.baseHub = true; storage.stock = { ...startingStorageStock }; return storage; })()],
  belts: saved?.belts || [],
  nodes: saved?.nodes || initialNodeState.map(node => ({ ...node })),
  items: (saved?.items || [])
    .filter(item => item && item.beltId && (saved?.belts || []).some(belt => belt.id === item.beltId))
    .map(item => ({ id: item.id, beltId: item.beltId, sourceId: item.sourceId || null, resource: item.resource, progress: clamp(Number(item.progress) || 0, 0, 1), wait: 0, retry: .5 })),
  inventory: { ...startingInventory, ...(saved?.inventory || {}) },
  kits: { ...startingKits, ...(saved?.kits || {}) },
  time: saved?.time ?? 6 * 3600,
  tech: saved?.tech || [...startingTech],
  research: saved?.research || { current: null, progress: 0 },
  interstellar: makeInterstellarState(saved?.interstellar),
  stellarProject: makeStellarProject(saved?.stellarProject),
  career: saved ? (saved.career || 'logistics') : null,
  careerChosen: saved ? saved.careerChosen !== false : false,
  pendingCareer: saved?.career || 'logistics',
  powerMigration: !qaDemoMode && !qaPlaythroughMode && saved?.powerMigration === true,
  researchRate: 0,
  powerGeneration: 4.5,
  basePowerGeneration: 4.5,
  lastToast: 0,
  powerLoad: 0,
  powerGrids: [],
  powerSummary: { gridCount: 0, highLoadCount: 0, blackoutCount: 0, generation: 0, load: 0 },
  simulationSpeed: 1,
  sorterRoutingSignature: '',
  assetFallbacks: 0
};
function query(selector) { return document.querySelector(selector); }
function all(selector) { return [...document.querySelectorAll(selector)]; }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function formatNumber(value) { return Math.max(0, Math.floor(value)).toLocaleString('en-US'); }
function hasImage(image) { return image && image.complete && image.naturalWidth > 0; }
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character])); }

function isInsideWorld(cell) {
  return Boolean(cell)
    && cell.x >= WORLD_BOUNDS.minX && cell.x <= WORLD_BOUNDS.maxX
    && cell.y >= WORLD_BOUNDS.minY && cell.y <= WORLD_BOUNDS.maxY;
}

function terrainAt(cell) {
  if (!isInsideWorld(cell)) return { kind: 'void', label: '地图边界', short: '边界' };
  return terrainRegions.find(region => cell.x >= region.minX && cell.x <= region.maxX && cell.y >= region.minY && cell.y <= region.maxY)
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
