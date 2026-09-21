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
  stellarFrame: { label: '恒星框架组件', color: '#f5e29b', form: 'solid', tier: 5 }
};

const sorterRouteCatalog = [
  'iron', 'copper', 'silicon', 'coal', 'crudeOil', 'water', 'naturalGas', 'ice', 'titanium',
  'ironIngot', 'copperIngot', 'siliconWafer', 'processor',
  'electromagneticCube', 'energyCube', 'structureCube', 'informationCube'
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
  longPowerTower: { label: '远距离电力塔', size: 1, color: '#8ccfff', power: .14, transmissionRange: 9, cost: { iron: 12, copper: 6, processor: 1 }, tech: 'power-transmission', image: 'longPowerTower' },
  ultraPowerTower: { label: '超远距离电力塔', size: 2, color: '#c58cff', power: .24, transmissionRange: 15, cost: { iron: 24, copper: 12, processor: 3 }, tech: 'advanced-power-grid', image: 'ultraPowerTower' },
  oilExtractor: { label: '石油提取机', size: 2, color: '#d18a57', power: 2.2, cost: { iron: 24, processor: 2 }, tech: 'oil-processing', image: 'oilExtractor', extractionForm: 'liquid' },
  researchLab: { label: '科研站', size: 2, color: '#7ed6ff', power: 1.6, cost: { iron: 20, processor: 4 }, tech: 'foundation', image: 'researchLab' },
  // `storage` remains as a save-compatible alias for the old starter chest.
  storage: { label: '固体仓储', size: 2, color: '#a7c7ff', power: .15, cost: { iron: 16, copper: 4 }, tech: 'foundation', image: 'storage', storageForm: 'solid' },
  solidStorage: { label: '固体仓储', size: 2, color: '#a7c7ff', power: .15, cost: { iron: 16, copper: 4 }, tech: 'foundation', image: 'solidStorage', storageForm: 'solid' },
  liquidStorage: { label: '液体仓储', size: 2, color: '#5cc8ed', power: .2, cost: { iron: 18, copper: 4 }, tech: 'fluid-storage', image: 'liquidStorage', storageForm: 'liquid' },
  gasStorage: { label: '气体仓储', size: 2, color: '#b6e7ba', power: .22, cost: { iron: 20, copper: 6, processor: 1 }, tech: 'gas-storage', image: 'gasStorage', storageForm: 'gas' },
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
    { id: 'automated-smelting', label: '自动冶炼', short: '工业主干', description: '把原矿加工成稳定的工业中间品，并授权第一座自动组装设备。', requires: ['planetary-logistics'], cube: 'energyCube', cost: 16, unlocks: ['assembler'], upgrades: ['smelter'], upgradeTier: 2, effectText: '解锁组装机 · 冶炼机速度 +33%' },
    { id: 'matrix-lab', label: '矩阵实验室', short: '科研主干', description: '将研究矩阵转化为可持续的科技推进力。', requires: ['automated-smelting'], cube: 'structureCube', cost: 22, upgrades: ['researchLab'], upgradeTier: 2, effectText: '科研站矩阵制备速度 +25%' },
    { id: 'interstellar-logistics', label: '星际物流', short: '跨星际主干', description: '接入恒星系航线，授权行星物流站并允许派遣货运舱回收异星资源。', requires: ['matrix-lab'], cube: 'informationCube', cost: 32, unlocks: ['行星物流站、星图与货运舱'] },
    { id: 'stellar-network', label: '恒星网络', short: '跨星际主干', description: '让远端信标加入同一条物流网络，开放档案星航线。', requires: ['interstellar-logistics'], cube: 'informationCube', cost: 40, unlocks: ['档案星航线'] },
    { id: 'dyson-frame', label: '戴森框架', short: '恒星工程', description: '用异星资源搭建包围恒星的第一圈能量框架。', requires: ['stellar-network'], cube: 'structureCube', cost: 48, unlocks: ['恒星工程阶段'] }
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
    { id: 'mining-mk2', label: '高压采掘', short: '工业分支', description: '升级采矿机钻头与排矿节拍，减少矿脉等待时间。', requires: ['planetary-logistics'], cube: 'energyCube', cost: 18, upgrades: ['miner'], upgradeTier: 2, effectText: '采矿机速度 +35%' },
    { id: 'power-transmission', label: '远距输电', short: '能源分支', description: '用高压线圈延长电力塔的传输半径，允许多个局部电网稳定互联。', requires: ['thermal-power'], cube: 'energyCube', cost: 18, unlocks: ['longPowerTower'], effectText: '解锁远距离电力塔 · 基础电塔覆盖范围 +15%' },
    { id: 'power-grid-mk2', label: '电网增容', short: '能源分支', description: '升级发电设施的能量转换模块，提高整个生存电网的余量。', requires: ['thermal-power'], cube: 'structureCube', cost: 24, upgrades: ['wind', 'thermal'], upgradeTier: 2, effectText: '风力与火力发电机输出 +25%' },
    { id: 'advanced-power-grid', label: '超远距骨干网', short: '能源分支', description: '建立跨区域骨干输电，允许超远距离电力塔接管整片工业区。', requires: ['power-transmission', 'power-grid-mk2'], cube: 'informationCube', cost: 32, unlocks: ['ultraPowerTower'], effectText: '解锁超远距离电力塔 · 全部电塔覆盖范围 +10%' },
    { id: 'oil-extractor-mk2', label: '深层泵压', short: '能源分支', description: '为石油提取机加装深层泵压模块，提升原油采集速率。', requires: ['oil-processing'], cube: 'structureCube', cost: 20, upgrades: ['oilExtractor'], upgradeTier: 2, effectText: '石油提取机速度 +35%' },
    { id: 'fluid-storage', label: '流体罐区', short: '物流分支', description: '用密封罐体存放水与原油。液体仓储只接受液体资源，不能混入固体或气体。', requires: ['planetary-logistics'], cube: 'energyCube', cost: 16, unlocks: ['liquidStorage'], effectText: '解锁液体仓储' },
    { id: 'gas-extraction', label: '气体压采', short: '能源分支', description: '建立气体采集头，把天然气从独立气田压入生产网络。', requires: ['oil-processing'], cube: 'structureCube', cost: 22, unlocks: ['gasExtractor'], effectText: '解锁天然气压采机' },
    { id: 'gas-storage', label: '高压气库', short: '物流分支', description: '使用高压容器存放天然气，气体资源不能进入固体或液体仓储。', requires: ['gas-extraction'], cube: 'informationCube', cost: 28, unlocks: ['gasStorage'], effectText: '解锁气体仓储' },
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
const startingInventory = { iron: 72, copper: 28, silicon: 16, coal: 4, crudeOil: 0, water: 0, naturalGas: 0, titanium: 0, ironIngot: 4, copperIngot: 4, siliconWafer: 4, processor: 6, electromagneticCube: 0, energyCube: 0, structureCube: 0, informationCube: 0, stellarFrame: 0 };
const startingStorageStock = { iron: 96, copper: 48, silicon: 32, coal: 8, titanium: 0, ironIngot: 4, copperIngot: 6, siliconWafer: 6, processor: 8, electromagneticCube: 0, energyCube: 0, structureCube: 0, informationCube: 0, stellarFrame: 0 };
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
  logisticsStation: 0,
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
  logisticsStation: '建立跨星球货运与资源回收节点。',
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
    process: 0, timer: 0, nodeId: null, constructionKit: true,
    researchMode: type === 'researchLab' ? 'auto' : undefined,
    manualResearchMode: false,
    gridEnabled: isPowerTowerType(type) ? true : undefined,
    baseHub: ['storage', 'solidStorage'].includes(type) ? false : undefined,
    sorterRules: type === 'sorter' ? {} : undefined,
    routeCursor: type === 'sorter' ? 0 : undefined,
    sorterMode: type === 'sorter' ? 'input' : undefined
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
      nodes: savedNodes,
      time: Number.isFinite(saved.time) ? saved.time : 6 * 3600,
      tech: Array.isArray(saved.tech) && saved.tech.length ? [...new Set(['foundation', ...saved.tech])] : [...startingTech],
      research: saved.research && typeof saved.research === 'object' ? saved.research : { current: null, progress: 0 },
      interstellar: makeInterstellarState(saved.interstellar),
      stellarProject: makeStellarProject(saved.stellarProject),
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
  assetFallbacks: 0
};
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
  wind: 'power', thermal: 'power', powerTower: 'power', longPowerTower: 'power', ultraPowerTower: 'power',
  storage: 'storage', solidStorage: 'storage', liquidStorage: 'storage', gasStorage: 'storage'
});
const dockCategories = new Set(['tools', 'extract', 'logistics', 'manufacture', 'research', 'power', 'storage']);

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

function activeCareer() {
  return careerCatalog[state.career] || careerCatalog.logistics;
}

function careerLabel() {
  return state.career ? activeCareer().label : '选择职业';
}

function saveGame() {
  if (qaDemoMode || qaPlaythroughMode) return;
  localStorage.setItem(SAVE_KEY, JSON.stringify({
    buildings: state.buildings,
    belts: state.belts,
    inventory: state.inventory,
    kits: state.kits,
    nodes: state.nodes,
    time: state.time,
    tech: state.tech,
    research: state.research,
    interstellar: state.interstellar,
    stellarProject: state.stellarProject,
    career: state.career || 'logistics',
    careerChosen: state.careerChosen
  }));
}

function resize() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  state.viewport = { width: rect.width, height: rect.height };
}

function worldToScreen(x, y) {
  return {
    x: state.viewport.width / 2 + (x - state.camera.x) * TILE * state.zoom,
    y: state.viewport.height / 2 + (y - state.camera.y) * TILE * state.zoom
  };
}

function screenToCell(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const x = (clientX - rect.left - state.viewport.width / 2) / (TILE * state.zoom) + state.camera.x;
  const y = (clientY - rect.top - state.viewport.height / 2) / (TILE * state.zoom) + state.camera.y;
  return { x: Math.floor(x), y: Math.floor(y) };
}

function roundedRect(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

function drawTerrainTile(terrain, point, size, parity, gridX, gridY) {
  const base = terrain.kind === 'rock'
    ? (parity ? 'rgba(61,79,91,.58)' : 'rgba(54,71,84,.58)')
    : terrain.kind === 'water'
      ? (parity ? 'rgba(18,73,101,.7)' : 'rgba(15,63,91,.7)')
      : terrain.kind === 'void'
        ? 'rgba(4,12,21,.86)'
        : (parity ? 'rgba(18,42,54,.45)' : 'rgba(14,35,47,.45)');
  ctx.fillStyle = base;
  ctx.fillRect(point.x, point.y, size + 1, size + 1);

  const terrainTile = terrain.kind === 'water' ? assets.waterTile : terrain.kind === 'rock' ? assets.rockTile : assets.groundTile;
  if (terrain.kind !== 'void' && hasImage(terrainTile)) {
    ctx.save();
    ctx.globalAlpha = terrain.kind === 'water' ? .86 : terrain.kind === 'rock' ? .48 : .18;
    ctx.beginPath();
    ctx.rect(point.x, point.y, size + 1, size + 1);
    ctx.clip();
    const sourceSize = 48;
    const sourceX = ((gridX * sourceSize) % terrainTile.width + terrainTile.width) % terrainTile.width;
    const sourceY = ((gridY * sourceSize) % terrainTile.height + terrainTile.height) % terrainTile.height;
    ctx.drawImage(terrainTile, sourceX, sourceY, sourceSize, sourceSize, point.x, point.y, size, size);
    ctx.restore();
  }

  if (terrain.kind === 'water') {
    ctx.save();
      ctx.strokeStyle = 'rgba(142,236,235,.28)';
    ctx.lineWidth = Math.max(1, state.zoom * .8);
    [.28, .56, .78].forEach((offset, index) => {
      const waveY = point.y + size * offset;
      ctx.beginPath();
      ctx.moveTo(point.x + size * (.12 + (index % 2) * .08), waveY);
      ctx.quadraticCurveTo(point.x + size * .34, waveY - size * .06, point.x + size * .5, waveY);
      ctx.quadraticCurveTo(point.x + size * .66, waveY + size * .06, point.x + size * .88, waveY);
      ctx.stroke();
    });
    ctx.restore();
  } else if (terrain.kind === 'rock') {
    ctx.save();
    ctx.strokeStyle = 'rgba(183,204,207,.34)';
    ctx.fillStyle = 'rgba(183,204,207,.13)';
    ctx.lineWidth = Math.max(1, state.zoom * .8);
    ctx.beginPath();
    ctx.moveTo(point.x + size * .18, point.y + size * .7);
    ctx.lineTo(point.x + size * .34, point.y + size * .36);
    ctx.lineTo(point.x + size * .55, point.y + size * .54);
    ctx.lineTo(point.x + size * .77, point.y + size * .24);
    ctx.lineTo(point.x + size * .86, point.y + size * .76);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  } else if (terrain.kind === 'plain') {
    ctx.save();
    ctx.strokeStyle = 'rgba(105,216,218,.08)';
    ctx.lineWidth = 1;
    ctx.strokeRect(point.x + size * .16, point.y + size * .16, size * .68, size * .68);
    ctx.restore();
  }
}

function drawGround() {
  const { width, height } = state.viewport;
  ctx.fillStyle = '#081522';
  ctx.fillRect(0, 0, width, height);
  if (hasImage(assets.groundTile)) {
    const groundPattern = ctx.createPattern(assets.groundTile, 'repeat');
    if (groundPattern) {
      ctx.save();
      ctx.globalAlpha = .16;
      ctx.fillStyle = groundPattern;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }
  }

  const minX = Math.floor(state.camera.x - width / (2 * TILE * state.zoom)) - 2;
  const maxX = Math.ceil(state.camera.x + width / (2 * TILE * state.zoom)) + 2;
  const minY = Math.floor(state.camera.y - height / (2 * TILE * state.zoom)) - 2;
  const maxY = Math.ceil(state.camera.y + height / (2 * TILE * state.zoom)) + 2;
  for (let x = minX; x <= maxX; x += 1) {
    for (let y = minY; y <= maxY; y += 1) {
      const point = worldToScreen(x, y);
      const size = TILE * state.zoom;
      drawTerrainTile(terrainAt({ x, y }), point, size, Math.abs(x + y) % 2, x, y);
    }
  }

  ctx.strokeStyle = state.tool === 'belt' ? 'rgba(105,216,218,.28)' : 'rgba(165,204,200,.1)';
  ctx.lineWidth = 1;
  for (let x = minX; x <= maxX + 1; x += 1) {
    const point = worldToScreen(x, minY);
    ctx.beginPath(); ctx.moveTo(point.x, point.y); ctx.lineTo(point.x, worldToScreen(x, maxY + 1).y); ctx.stroke();
  }
  for (let y = minY; y <= maxY + 1; y += 1) {
    const point = worldToScreen(minX, y);
    ctx.beginPath(); ctx.moveTo(point.x, point.y); ctx.lineTo(worldToScreen(maxX + 1, y).x, point.y); ctx.stroke();
  }

  for (let index = 0; index < 90; index += 1) {
    const x = ((index * 83) % Math.max(width, 1));
    const y = ((index * 47 + 31) % Math.max(height, 1));
    const radius = index % 7 === 0 ? 1.4 : .7;
    const twinkle = .7 + Math.sin(state.animTime * 1.7 + index * 2.4) * .3;
    ctx.fillStyle = index % 4 === 0 ? `rgba(105,216,218,${.32 * twinkle})` : `rgba(225,241,230,${.28 * twinkle})`;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

}

function drawDysonConstruction() {
  const progress = state.stellarProject?.progress || 0;
  if (progress <= 0) return;
  const projectCenter = worldToScreen(.5, .5);
  const radius = TILE * state.zoom * 2.8;
  const builtSegments = Math.ceil(progress / 12.5);
  ctx.save();
  ctx.translate(projectCenter.x, projectCenter.y);
  ctx.rotate(state.animTime * .05);
  for (let index = 0; index < 8; index += 1) {
    const angle = index * Math.PI / 4;
    const start = angle + .08;
    const end = angle + Math.PI / 4 - .08;
    ctx.strokeStyle = index < builtSegments ? '#c7d94cbb' : '#69d8da25';
    ctx.lineWidth = Math.max(1, state.zoom * 1.3);
    ctx.beginPath(); ctx.arc(0, 0, radius + Math.sin(state.animTime * 1.2 + index) * 2, start, end); ctx.stroke();
    if (index < builtSegments) {
      const nodeAngle = (start + end) / 2;
      ctx.fillStyle = '#f7f5bb'; ctx.shadowColor = '#c7d94c'; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(Math.cos(nodeAngle) * radius, Math.sin(nodeAngle) * radius, Math.max(1.5, state.zoom * 2), 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}

function drawResourceNode(node) {
  const point = worldToScreen(node.x + .5, node.y + .5);
  const size = clamp(92 * state.zoom, 45, 120);
  const meta = resources[node.resource];
  ctx.save();
  ctx.globalAlpha = .96;
  ctx.fillStyle = `${meta.color}18`;
  ctx.beginPath(); ctx.arc(point.x, point.y + size * .22, size * .46, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = `${meta.color}55`;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(point.x, point.y + size * .22, size * .46, 0, Math.PI * 2); ctx.stroke();
  if (hasImage(assets[meta.image])) {
    const pulse = 1 + Math.sin(state.animTime * 1.8 + node.x * .7 + node.y) * .035;
    const imageSize = size * pulse;
    ctx.drawImage(assets[meta.image], point.x - imageSize / 2, point.y - imageSize / 2, imageSize, imageSize);
  } else {
    drawResourceGlyph(node.resource, point.x, point.y, size * .72, .92);
  }
  ctx.fillStyle = 'rgba(4,13,22,.82)';
  roundedRect(ctx, point.x - 39, point.y + size * .44, 78, 18, 3); ctx.fill();
  ctx.fillStyle = meta.color;
  ctx.font = '700 9px Bahnschrift, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(`${meta.label}矿脉  ${formatNumber(node.amount)}`, point.x, point.y + size * .44 + 12);
  ctx.restore();
}

function drawResourceNodeCore(node) {
  const point = worldToScreen(node.x, node.y);
  const size = TILE * state.zoom;
  const meta = resources[node.resource];
  ctx.save();
  ctx.globalAlpha = .84;
  ctx.fillStyle = `${meta.color}10`;
  ctx.fillRect(point.x + 2, point.y + 2, size - 4, size - 4);
  ctx.strokeStyle = `${meta.color}b8`;
  ctx.lineWidth = Math.max(1, state.zoom * 1.4);
  ctx.setLineDash([4, 3]);
  ctx.strokeRect(point.x + 2, point.y + 2, size - 4, size - 4);
  ctx.setLineDash([]);
  ctx.strokeStyle = `${meta.color}dd`;
  ctx.lineWidth = Math.max(1, state.zoom);
  ctx.beginPath();
  ctx.moveTo(point.x + size * .32, point.y + size * .5);
  ctx.lineTo(point.x + size * .68, point.y + size * .5);
  ctx.moveTo(point.x + size * .5, point.y + size * .32);
  ctx.lineTo(point.x + size * .5, point.y + size * .68);
  ctx.stroke();
  ctx.restore();
}

function drawResourceGlyph(resource, centerX, centerY, size, alpha = 1) {
  const meta = resources[resource] || { color: '#c7d94c' };
  const color = meta.color;
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.fillStyle = `${color}55`;
  ctx.lineWidth = Math.max(1, size * .035);
  if (resource.endsWith('Cube')) {
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-size * .25, -size * .25, size * .5, size * .5);
    ctx.strokeRect(-size * .25, -size * .25, size * .5, size * .5);
    ctx.globalAlpha *= .8;
    ctx.strokeRect(-size * .14, -size * .14, size * .28, size * .28);
    ctx.rotate(-Math.PI / 4);
    ctx.beginPath(); ctx.arc(0, 0, size * .42, 0, Math.PI * 2); ctx.stroke();
    if (resource === 'energyCube') {
      ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, -size * .3); ctx.lineTo(size * .09, -size * .03); ctx.lineTo(-size * .06, -size * .03); ctx.lineTo(size * .02, size * .3); ctx.lineTo(-size * .12, size * .04); ctx.lineTo(size * .03, size * .04); ctx.closePath(); ctx.fill();
    } else if (resource === 'informationCube') {
      ctx.strokeStyle = color; ctx.lineWidth = Math.max(1, size * .022);
      [-.16, 0, .16].forEach(offset => { ctx.beginPath(); ctx.moveTo(-size * .23, size * offset); ctx.lineTo(size * .23, size * offset); ctx.stroke(); });
    } else if (resource === 'structureCube') {
      ctx.strokeStyle = '#fff1ffaa'; ctx.lineWidth = Math.max(1, size * .024);
      ctx.beginPath(); ctx.moveTo(-size * .2, 0); ctx.lineTo(0, -size * .2); ctx.lineTo(size * .2, 0); ctx.lineTo(0, size * .2); ctx.closePath(); ctx.stroke();
    }
  } else {
    ctx.beginPath(); ctx.moveTo(0, -size * .42); ctx.lineTo(size * .34, size * .12); ctx.lineTo(0, size * .42); ctx.lineTo(-size * .34, size * .12); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff6d688'; ctx.beginPath(); ctx.arc(-size * .08, -size * .1, size * .055, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function getBeltEnd(belt) {
  return { x: belt.x + belt.dx * (belt.length - 1), y: belt.y + belt.dy * (belt.length - 1) };
}

function beltCells(belt) {
  return Array.from({ length: belt.length }, (_, index) => ({ x: belt.x + belt.dx * index, y: belt.y + belt.dy * index }));
}

function beltEndsAt(cell) {
  return state.belts.some(belt => {
    const end = getBeltEnd(belt);
    return end.x === cell.x && end.y === cell.y;
  });
}

function trimBeltExtension(start, segments) {
  if (!start || !beltEndsAt(start) || !segments.length) return segments;
  const first = segments[0];
  if (first.x !== start.x || first.y !== start.y || first.length <= 1 || (first.dx === 0 && first.dy === 0)) return segments;
  return [{ ...first, x: first.x + first.dx, y: first.y + first.dy, length: first.length - 1 }, ...segments.slice(1)];
}

function freeBeltSegments(segments, start) {
  const free = [];
  segments.forEach(segment => {
    let run = null;
    const flush = () => {
      if (run) free.push(run);
      run = null;
    };
    beltCells(segment).forEach((cell, index) => {
      const isSharedStart = segment === segments[0] && index === 0 && start
        && cell.x === start.x && cell.y === start.y;
      if (beltAt(cell) && !isSharedStart) { flush(); return; }
      if (!run) run = { x: cell.x, y: cell.y, dx: segment.dx, dy: segment.dy, length: 0 };
      run.length += 1;
    });
    flush();
  });
  return free;
}

function beltSegmentsBetween(start, end) {
  return beltSegmentsBetweenOrder(start, end, false);
}

function beltSegmentsBetweenOrder(start, end, verticalFirst = false) {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  // A one-cell belt is a valid port bridge between two adjacent buildings.
  if (deltaX === 0 && deltaY === 0) return [{ x: start.x, y: start.y, dx: 0, dy: 0, length: 1 }];
  if (deltaX === 0) return [{ x: start.x, y: start.y, dx: 0, dy: Math.sign(deltaY), length: Math.abs(deltaY) + 1 }];
  if (deltaY === 0) return [{ x: start.x, y: start.y, dx: Math.sign(deltaX), dy: 0, length: Math.abs(deltaX) + 1 }];

  if (verticalFirst) {
    return [
      { x: start.x, y: start.y, dx: 0, dy: Math.sign(deltaY), length: Math.abs(deltaY) },
      { x: start.x, y: end.y, dx: Math.sign(deltaX), dy: 0, length: Math.abs(deltaX) + 1 }
    ];
  }

  return [
    { x: start.x, y: start.y, dx: Math.sign(deltaX), dy: 0, length: Math.abs(deltaX) },
    { x: end.x, y: start.y, dx: 0, dy: Math.sign(deltaY), length: Math.abs(deltaY) + 1 }
  ];
}

function beltPathToSegments(path) {
  if (!path || path.length < 2) return [];
  const segments = [];
  let segmentStart = 0;
  let dx = path[1].x - path[0].x;
  let dy = path[1].y - path[0].y;
  for (let index = 1; index < path.length; index += 1) {
    const nextDx = index < path.length - 1 ? path[index + 1].x - path[index].x : dx;
    const nextDy = index < path.length - 1 ? path[index + 1].y - path[index].y : dy;
    if (index === path.length - 1) {
      segments.push({ x: path[segmentStart].x, y: path[segmentStart].y, dx, dy, length: index - segmentStart + 1 });
    } else if (nextDx !== dx || nextDy !== dy) {
      // Put a corner cell on the following segment, matching the straight-L
      // route representation used by the rest of the belt system.
      segments.push({ x: path[segmentStart].x, y: path[segmentStart].y, dx, dy, length: index - segmentStart });
      segmentStart = index;
      dx = nextDx;
      dy = nextDy;
    }
  }
  return segments;
}

function findBeltPath(start, end) {
  if (!start || !end || (start.x === end.x && start.y === end.y)) return [];
  const queue = [{ cell: start, path: [start], direction: null }];
  const visited = new Set([`${start.x},${start.y},none`]);
  const directions = [
    { dx: Math.sign(end.x - start.x), dy: 0 },
    { dx: 0, dy: Math.sign(end.y - start.y) },
    { dx: Math.sign(start.x - end.x), dy: 0 },
    { dx: 0, dy: Math.sign(start.y - end.y) }
  ].filter(direction => direction.dx !== 0 || direction.dy !== 0);
  const isOpen = cell => {
    if (!isInsideWorld(cell) || isTerrainBlocked(cell)) return false;
    if ((cell.x !== start.x || cell.y !== start.y) && (cell.x !== end.x || cell.y !== end.y) && beltAt(cell)) return false;
    return !overlapsBuilding(cell.x, cell.y, 1);
  };
  while (queue.length) {
    const current = queue.shift();
    if (current.cell.x === end.x && current.cell.y === end.y) return beltPathToSegments(current.path);
    directions.forEach(direction => {
      const next = { x: current.cell.x + direction.dx, y: current.cell.y + direction.dy };
      if (!isOpen(next)) return;
      const key = `${next.x},${next.y},${direction.dx},${direction.dy}`;
      if (visited.has(key)) return;
      visited.add(key);
      queue.push({ cell: next, path: [...current.path, next], direction });
    });
  }
  return [];
}

function drawBelt(belt, preview = false) {
  const selected = state.selectedBeltId === belt.id;
  const color = preview ? '#69d8da' : selected ? '#c7d94c' : '#4db7c2';
  beltCells(belt).forEach((cell, index) => {
    const point = worldToScreen(cell.x, cell.y);
    const size = TILE * state.zoom;
    const horizontal = belt.dx !== 0;
    ctx.save();
    ctx.globalAlpha = preview ? .55 : selected ? .98 : .88;
    ctx.fillStyle = preview ? 'rgba(105,216,218,.22)' : 'rgba(16,49,63,.94)';
    const bridge = belt.dx === 0 && belt.dy === 0;
    const beltX = bridge ? point.x + size * .2 : horizontal ? point.x + 4 : point.x + size * .33;
    const beltY = bridge ? point.y + size * .2 : horizontal ? point.y + size * .33 : point.y + 4;
    const beltWidth = bridge ? size * .6 : horizontal ? size - 8 : size * .34;
    const beltHeight = bridge ? size * .6 : horizontal ? size * .34 : size - 8;
    roundedRect(ctx, beltX, beltY, beltWidth, beltHeight, 4); ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, state.zoom * (selected ? 2.4 : 1.5));
    ctx.stroke();
    if (selected) {
      ctx.save();
      ctx.strokeStyle = 'rgba(199,217,76,.5)';
      ctx.lineWidth = Math.max(1, state.zoom * 4.2);
      ctx.globalAlpha = .34;
      ctx.stroke();
      ctx.restore();
    }
    const arrowX = point.x + size / 2 + belt.dx * size * .17;
    const arrowY = point.y + size / 2 + belt.dy * size * .17;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    if (!bridge) {
      ctx.beginPath();
      ctx.moveTo(arrowX - belt.dx * 4 - belt.dy * 3, arrowY - belt.dy * 4 + belt.dx * 3);
      ctx.lineTo(arrowX, arrowY);
      ctx.lineTo(arrowX - belt.dx * 4 + belt.dy * 3, arrowY - belt.dy * 4 - belt.dx * 3);
      ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(arrowX, arrowY, Math.max(2, state.zoom * 2.3), 0, Math.PI * 2); ctx.stroke();
    }
    if (!preview) {
      const flow = (state.animTime * 1.8 + index * .21) % 1;
      const flowPoint = {
        x: point.x + size / 2 + belt.dx * (flow - .5) * size * .58,
        y: point.y + size / 2 + belt.dy * (flow - .5) * size * .58
      };
      ctx.fillStyle = '#b9ffff';
      ctx.globalAlpha = .42;
      ctx.beginPath(); ctx.arc(flowPoint.x, flowPoint.y, Math.max(1.2, state.zoom * 1.4), 0, Math.PI * 2); ctx.fill();
    }
    if (index === belt.length - 1 && !preview) {
      ctx.fillStyle = '#b9ffff'; ctx.beginPath(); ctx.arc(point.x + size / 2, point.y + size / 2, 2.4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  });
}

function isBuildingActive(building) {
  if (!isBuildingOperational(building)) return false;
  if (state.paused) return false;
  if (isPowerTowerType(building)) return getGridPowerState(building).powered;
  if (building.type === 'wind') return getGridPowerState(building).powered;
  if (building.type === 'thermal') return getGridPowerState(building).powered && (building.input.coal || 0) > 0;
  if (['miner', 'oilExtractor', 'waterPump', 'gasExtractor'].includes(building.type)) return building.timer > .15 || Object.values(building.output).some(amount => amount > 0);
  return building.process > .05 || Object.values(building.input).some(amount => amount > 0);
}

function drawMachineAnimation(building, size) {
  const meta = buildings[building.type];
  const active = isBuildingActive(building);
  const time = state.animTime;
  const color = meta.color;
  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  if (building.type === 'miner') {
    ctx.rotate(time * (active ? 3.4 : .35));
    ctx.strokeStyle = `${color}${active ? 'bb' : '45'}`;
    ctx.lineWidth = Math.max(1, size * .018);
    for (let index = 0; index < 3; index += 1) {
      ctx.rotate(Math.PI * 2 / 3);
      ctx.beginPath(); ctx.moveTo(0, -size * .08); ctx.lineTo(size * .28, -size * .05); ctx.stroke();
    }
    ctx.fillStyle = `${color}${active ? 'dd' : '55'}`;
    ctx.beginPath(); ctx.arc(0, 0, size * .055, 0, Math.PI * 2); ctx.fill();
  } else if (building.type === 'smelter' || building.type === 'thermal') {
    const flicker = .82 + Math.sin(time * 9 + building.x) * .12;
    ctx.fillStyle = `${building.type === 'thermal' ? '#ffb15b' : '#ffd06a'}${active ? 'bb' : '28'}`;
    ctx.beginPath(); ctx.moveTo(-size * .13, size * .25); ctx.quadraticCurveTo(-size * .2, size * (.04 - flicker * .08), 0, -size * (.2 + flicker * .06)); ctx.quadraticCurveTo(size * .18, size * .02, size * .12, size * .25); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff1b0'; ctx.globalAlpha = active ? .78 : .12;
    ctx.beginPath(); ctx.arc(0, size * .08, size * .04, 0, Math.PI * 2); ctx.fill();
  } else if (building.type === 'assembler' || building.type === 'workbench') {
    ctx.rotate(Math.sin(time * (active ? 3.2 : .45) + building.y) * .4);
    ctx.strokeStyle = `${color}${active ? 'c0' : '3d'}`;
    ctx.lineWidth = Math.max(1, size * .02);
    ctx.beginPath(); ctx.moveTo(-size * .28, -size * .2); ctx.lineTo(size * .12, -size * .06); ctx.lineTo(size * .25, size * .18); ctx.stroke();
    ctx.fillStyle = `${color}${active ? 'dd' : '45'}`;
    ctx.beginPath(); ctx.arc(-size * .28, -size * .2, size * .045, 0, Math.PI * 2); ctx.arc(size * .25, size * .18, size * .065, 0, Math.PI * 2); ctx.fill();
  } else if (building.type === 'researchLab') {
    ctx.rotate(time * (active ? .8 : .12));
    ctx.strokeStyle = `${color}${active ? 'c8' : '38'}`;
    ctx.lineWidth = Math.max(1, size * .014);
    ctx.beginPath(); ctx.arc(0, 0, size * .29, -.6, Math.PI * 1.15); ctx.stroke();
    ctx.strokeStyle = '#c7d94c66';
    ctx.beginPath(); ctx.arc(0, 0, size * .22, Math.PI * .4, Math.PI * 1.65); ctx.stroke();
    if (active) { ctx.fillStyle = '#eafecf'; ctx.beginPath(); ctx.arc(Math.cos(time * 2) * size * .29, Math.sin(time * 2) * size * .29, size * .035, 0, Math.PI * 2); ctx.fill(); }
  } else if (building.type === 'wind') {
    ctx.rotate(time * .9);
    ctx.strokeStyle = `${color}aa`; ctx.lineWidth = Math.max(1, size * .018);
    for (let index = 0; index < 4; index += 1) { ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(size * .12, -size * .16, size * .3, -size * .27); ctx.stroke(); }
    ctx.fillStyle = '#effff8'; ctx.beginPath(); ctx.arc(0, 0, size * .045, 0, Math.PI * 2); ctx.fill();
  } else if (building.type === 'oilExtractor') {
    const lift = Math.sin(time * 2.7) * size * .12;
    ctx.strokeStyle = `${color}aa`; ctx.lineWidth = Math.max(1, size * .022);
    ctx.beginPath(); ctx.moveTo(0, -size * .18); ctx.lineTo(0, size * .2 + lift); ctx.stroke();
    ctx.fillStyle = `${color}bb`; ctx.beginPath(); ctx.arc(0, size * .2 + lift, size * .07, 0, Math.PI * 2); ctx.fill();
  } else if (building.type === 'waterPump') {
    const lift = Math.sin(time * 2.7) * size * .08;
    ctx.strokeStyle = `${color}aa`; ctx.lineWidth = Math.max(1, size * .022);
    ctx.beginPath(); ctx.moveTo(-size * .2, size * .18); ctx.lineTo(0, -size * .18 + lift); ctx.lineTo(size * .2, size * .18); ctx.stroke();
    ctx.fillStyle = `${color}bb`; ctx.beginPath(); ctx.arc(0, -size * .18 + lift, size * .07, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawBuildingFallback(building, size) {
  const color = buildings[building.type].color;
  ctx.save();
  ctx.lineWidth = Math.max(1, size * .018);
  ctx.strokeStyle = color;
  ctx.fillStyle = `${color}2c`;
  if (building.type === 'researchLab') {
    ctx.fillStyle = '#0b3449';
    ctx.beginPath(); ctx.moveTo(size * .17, size * .7); ctx.lineTo(size * .28, size * .26); ctx.lineTo(size * .72, size * .26); ctx.lineTo(size * .83, size * .7); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = `${color}88`; ctx.beginPath(); ctx.arc(size / 2, size * .4, size * .16, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#d8ffffaa'; ctx.beginPath(); ctx.moveTo(size * .23, size * .74); ctx.lineTo(size * .77, size * .74); ctx.stroke();
  } else if (building.type === 'sorter') {
    ctx.fillStyle = '#123b4a'; ctx.fillRect(size * .2, size * .3, size * .6, size * .4); ctx.strokeRect(size * .2, size * .3, size * .6, size * .4);
    ctx.beginPath(); ctx.moveTo(size * .48, size * .48); ctx.lineTo(size * .78, size * .18); ctx.moveTo(size * .52, size * .52); ctx.lineTo(size * .8, size * .82); ctx.stroke();
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(size * .48, size * .5, size * .07, 0, Math.PI * 2); ctx.fill();
  } else if (building.type === 'wind') {
    ctx.fillStyle = '#183d4a'; ctx.fillRect(size * .42, size * .45, size * .16, size * .32); ctx.strokeRect(size * .42, size * .45, size * .16, size * .32);
    ctx.beginPath(); ctx.moveTo(size * .5, size * .5); ctx.lineTo(size * .18, size * .25); ctx.moveTo(size * .5, size * .5); ctx.lineTo(size * .78, size * .24); ctx.moveTo(size * .5, size * .5); ctx.lineTo(size * .82, size * .72); ctx.stroke();
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(size * .5, size * .5, size * .07, 0, Math.PI * 2); ctx.fill();
  } else if (isPowerTowerType(building)) {
    ctx.strokeStyle = `${color}aa`;
    ctx.lineWidth = Math.max(1, size * .025);
    ctx.beginPath(); ctx.moveTo(size * .5, size * .16); ctx.lineTo(size * .5, size * .84); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(size * .28, size * .82); ctx.lineTo(size * .5, size * .16); ctx.lineTo(size * .72, size * .82); ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(size * .5, size * .16, size * .08, 0, Math.PI * 2); ctx.fill();
    if (building.gridEnabled === false) {
      ctx.strokeStyle = '#ee6a65';
      ctx.beginPath(); ctx.moveTo(size * .27, size * .27); ctx.lineTo(size * .73, size * .73); ctx.stroke();
    }
  } else if (building.type === 'thermal') {
    ctx.fillStyle = '#351f27'; ctx.fillRect(size * .2, size * .36, size * .6, size * .38); ctx.strokeRect(size * .2, size * .36, size * .6, size * .38);
    ctx.fillStyle = '#ffb15b'; ctx.beginPath(); ctx.arc(size * .5, size * .55, size * .13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1e2835'; ctx.fillRect(size * .55, size * .12, size * .16, size * .28); ctx.strokeRect(size * .55, size * .12, size * .16, size * .28);
  } else if (building.type === 'oilExtractor') {
    ctx.fillStyle = '#382b2a'; ctx.fillRect(size * .18, size * .64, size * .64, size * .1); ctx.strokeRect(size * .18, size * .64, size * .64, size * .1);
    ctx.beginPath(); ctx.moveTo(size * .28, size * .64); ctx.lineTo(size * .4, size * .2); ctx.lineTo(size * .6, size * .2); ctx.lineTo(size * .73, size * .64); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(size * .3, size * .24); ctx.lineTo(size * .73, size * .4); ctx.stroke();
  } else if (building.type === 'workbench') {
    ctx.fillStyle = '#3d2a2b'; ctx.fillRect(size * .16, size * .46, size * .68, size * .22); ctx.strokeRect(size * .16, size * .46, size * .68, size * .22);
    ctx.beginPath(); ctx.moveTo(size * .26, size * .68); ctx.lineTo(size * .22, size * .82); ctx.moveTo(size * .72, size * .68); ctx.lineTo(size * .77, size * .82); ctx.stroke();
    ctx.fillStyle = color; ctx.fillRect(size * .42, size * .25, size * .18, size * .2); ctx.strokeRect(size * .42, size * .25, size * .18, size * .2);
  } else if (building.type === 'waterPump') {
    ctx.fillStyle = '#123849'; ctx.fillRect(size * .18, size * .58, size * .64, size * .12); ctx.strokeRect(size * .18, size * .58, size * .64, size * .12);
    ctx.beginPath(); ctx.moveTo(size * .28, size * .58); ctx.lineTo(size * .5, size * .2); ctx.lineTo(size * .72, size * .58); ctx.stroke();
    ctx.fillStyle = '#78e1ff'; ctx.beginPath(); ctx.arc(size * .5, size * .22, size * .07, 0, Math.PI * 2); ctx.fill();
  } else if (building.type === 'gasExtractor') {
    ctx.fillStyle = '#203b3c'; ctx.fillRect(size * .18, size * .58, size * .64, size * .12); ctx.strokeRect(size * .18, size * .58, size * .64, size * .12);
    ctx.beginPath(); ctx.moveTo(size * .3, size * .58); ctx.lineTo(size * .5, size * .18); ctx.lineTo(size * .7, size * .58); ctx.stroke();
    ctx.strokeStyle = '#b6e7ba'; ctx.beginPath(); ctx.arc(size * .5, size * .3, size * .1, 0, Math.PI * 2); ctx.stroke();
  } else if (isStorageType(building)) {
    ctx.fillStyle = building.type === 'logisticsStation' ? '#302447' : '#20344e';
    roundedRect(ctx, size * .15, size * .2, size * .7, size * .54, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = `${color}99`;
    for (let index = 0; index < (building.type === 'logisticsStation' ? 3 : 2); index += 1) {
      ctx.fillRect(size * (.25 + index * .2), size * .31, size * .12, size * .28);
    }
    ctx.strokeStyle = '#e5f5ff88';
    ctx.beginPath(); ctx.moveTo(size * .2, size * .8); ctx.lineTo(size * .8, size * .8); ctx.stroke();
  } else {
    ctx.fillStyle = `${color}25`;
    roundedRect(ctx, size * .18, size * .18, size * .64, size * .46, 4); ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 1.3;
    roundedRect(ctx, size * .18, size * .18, size * .64, size * .46, 4); ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(size / 2, size * .41, size * .1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(225,241,230,.56)';
    ctx.fillRect(size * .22, size * .76, size * .12, 3); ctx.fillRect(size * .44, size * .76, size * .12, 3); ctx.fillRect(size * .66, size * .76, size * .12, 3);
  }
  ctx.restore();
}

function drawBuilding(building) {
  const meta = buildings[building.type];
  const point = worldToScreen(building.x, building.y);
  const size = meta.size * TILE * state.zoom;
  const selected = state.selectedId === building.id;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,.34)';
  roundedRect(ctx, point.x + 4, point.y + 7, size - 8, size - 7, 5); ctx.fill();
  ctx.translate(point.x + size / 2, point.y + size / 2);
  ctx.rotate((building.rotation * Math.PI) / 180);
  ctx.translate(-size / 2, -size / 2);
  ctx.fillStyle = 'rgba(14,29,42,.96)';
  roundedRect(ctx, 2, 2, size - 4, size - 6, 5); ctx.fill();
  ctx.strokeStyle = meta.color;
  ctx.lineWidth = selected ? 2.4 : 1.2;
  ctx.stroke();

  if (hasImage(assets[meta.image])) {
    const active = isBuildingActive(building);
    const imageScale = active ? 1 + Math.sin(state.animTime * 4 + building.x) * .014 : 1;
    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.scale(imageScale, imageScale);
    ctx.drawImage(assets[meta.image], -size * .48, -size * .48, size * .96, size * .96);
    if (active) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `${meta.color}66`;
      ctx.lineWidth = Math.max(1, state.zoom * 1.7);
      ctx.beginPath(); ctx.arc(0, 0, size * (.34 + Math.sin(state.animTime * 3) * .012), state.animTime * .7, state.animTime * .7 + Math.PI * 1.35); ctx.stroke();
    }
    ctx.restore();
  } else {
    drawBuildingFallback(building, size);
  }
  drawMachineAnimation(building, size);
  ctx.restore();

  if (selected) {
    ctx.save();
    ctx.strokeStyle = `${meta.color}cc`; ctx.setLineDash([5, 4]); ctx.lineWidth = 1;
    ctx.strokeRect(point.x - 3, point.y - 3, size + 6, size + 2); ctx.setLineDash([]);
    ctx.fillStyle = meta.color; ctx.beginPath(); ctx.arc(point.x + size / 2, point.y - 8, 3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  const level = getBuildingLevel(building.type);
  if (level > 1) {
    ctx.save();
    const badge = `MK-${Math.min(level, 3)}`;
    const badgeWidth = 30 * state.zoom;
    const badgeHeight = 12 * state.zoom;
    ctx.fillStyle = 'rgba(6, 16, 27, .9)';
    ctx.strokeStyle = '#c7d94c';
    ctx.lineWidth = 1;
    roundedRect(ctx, point.x + size - badgeWidth - 2, point.y - badgeHeight - 3, badgeWidth, badgeHeight, 3);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#c7d94c';
    ctx.font = `${Math.max(7, 8 * state.zoom)}px Bahnschrift, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(badge, point.x + size - badgeWidth / 2 - 2, point.y - badgeHeight / 2 - 3);
    ctx.restore();
  }

  const status = buildingStatus(building);
  if (['科技锁定', '电力不足', '电网瘫痪', '电网高负载', '输出堵塞', '缺少输入', '等待矩阵组件', '缺煤', '未接入水源', '未接入电网'].includes(status)) {
    const pulse = 1 + Math.sin(state.animTime * 4.2 + building.x * .7 + building.y) * .08;
    ctx.save();
    ctx.strokeStyle = status === '输出堵塞' ? '#ff9b3d' : '#ee6a65';
    ctx.globalAlpha = .48;
    ctx.lineWidth = Math.max(1, state.zoom * 1.2);
    ctx.beginPath();
    ctx.arc(point.x + size / 2, point.y + size / 2, size * .53 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function buildingPortCells(building) {
  const size = buildings[building.type].size;
  const ports = [];
  for (let index = 0; index < size; index += 1) {
    ports.push({ x: building.x + index, y: building.y - 1 });
    ports.push({ x: building.x + index, y: building.y + size });
    ports.push({ x: building.x - 1, y: building.y + index });
    ports.push({ x: building.x + size, y: building.y + index });
  }
  return ports.filter((port, index, allPorts) => allPorts.findIndex(item => item.x === port.x && item.y === port.y) === index);
}

function isSorterTargetBuilding(building) {
  return Boolean(building && building.type !== 'sorter' && !isPowerTowerType(building) && buildings[building.type]);
}

function sorterBeltEndpointAt(cell, preferred = 'end') {
  if (!cell) return null;
  const matches = [];
  state.belts.forEach(belt => {
    const start = { x: belt.x, y: belt.y };
    const end = getBeltEnd(belt);
    const sameStart = start.x === cell.x && start.y === cell.y;
    const sameEnd = end.x === cell.x && end.y === cell.y;
    if (sameStart && sameEnd) matches.push({ belt, endpoint: preferred });
    else if (sameStart) matches.push({ belt, endpoint: 'start' });
    else if (sameEnd) matches.push({ belt, endpoint: 'end' });
  });
  return matches.sort((left, right) => (left.endpoint === preferred ? -1 : 1) - (right.endpoint === preferred ? -1 : 1) || left.belt.id.localeCompare(right.belt.id))[0] || null;
}

function sorterPlacementCandidates(building, belt, mode) {
  if (!isSorterTargetBuilding(building) || !belt) return [];
  const endpoint = mode === 'output' ? { x: belt.x, y: belt.y } : getBeltEnd(belt);
  const center = buildingCenter(building);
  const seen = new Set();
  return buildingPortCells(building)
    .filter(cell => {
      const key = `${cell.x},${cell.y}`;
      if (seen.has(key)) return false;
      seen.add(key);
      const candidate = { type: 'sorter', x: cell.x, y: cell.y };
      return isInsideWorld(cell)
        && !isTerrainBlocked(cell)
        && !resourceNodeAt(cell)
        && !overlapsBuilding(cell.x, cell.y, 1)
        && !beltAt(cell)
        && isAdjacentToBuilding(endpoint, candidate);
    })
    .map(cell => ({
      cell,
      score: Math.abs(cell.x - endpoint.x) + Math.abs(cell.y - endpoint.y) * 1.2
        + Math.abs(cell.x - center.x) * .2 + Math.abs(cell.y - center.y) * .2
    }))
    .sort((left, right) => left.score - right.score || left.cell.y - right.cell.y || left.cell.x - right.cell.x);
}

function findSorterPlacement(building, belt, mode) {
  return sorterPlacementCandidates(building, belt, mode)[0] || null;
}

function sorterPlacementPreview() {
  const anchor = state.pointer.sorterAnchor;
  if (!anchor) return null;
  if (anchor.kind === 'building') {
    const building = state.buildings.find(entry => entry.id === anchor.id);
    const endpoint = sorterBeltEndpointAt(state.pointer.cell, 'start');
    if (!isSorterTargetBuilding(building)) return { valid: false, building, mode: 'output', reason: '分拣器不能作为物料接口' };
    if (!endpoint) return { valid: false, building, mode: 'output', reason: '请拖到传送带起点' };
    if (endpoint.endpoint !== 'start') return { valid: false, building, belt: endpoint.belt, mode: 'output', endpointCell: getBeltEnd(endpoint.belt), reason: '建筑出料必须接入传送带起点' };
    const placement = findSorterPlacement(building, endpoint.belt, 'output');
    return { valid: Boolean(placement), building, belt: endpoint.belt, mode: 'output', endpointCell: { x: endpoint.belt.x, y: endpoint.belt.y }, placement, reason: placement ? '' : '建筑接口和传送带起点之间没有空位' };
  }
  const belt = state.belts.find(entry => entry.id === anchor.id);
  const building = findBuildingAt(state.pointer.cell);
  if (anchor.endpoint !== 'end') return { valid: false, building, belt, mode: 'input', reason: '建筑进料必须从传送带末端开始' };
  if (!isSorterTargetBuilding(building)) return { valid: false, building, belt, mode: 'input', reason: '请拖到需要物料的建筑接口' };
  const placement = findSorterPlacement(building, belt, 'input');
  return { valid: Boolean(placement), building, belt, mode: 'input', endpointCell: belt ? getBeltEnd(belt) : null, placement, reason: placement ? '' : '建筑接口和传送带末端之间没有空位' };
}

function placeSorterBetween(building, belt, mode) {
  const placement = findSorterPlacement(building, belt, mode);
  if (!placement) { showToast('分拣器需要同时贴近建筑接口和传送带端点', 'warning'); return false; }
  if (!canUseKit('sorter')) { showToast('没有分拣器库存 · 请打开制造面板', 'warning'); return false; }
  const sorter = makeBuilding('sorter', placement.cell.x, placement.cell.y);
  sorter.sorterMode = mode;
  sorter.rotation = mode === 'output' ? 0 : 180;
  consumeBuildKit('sorter');
  state.buildings.push(sorter);
  rebuildPowerGrids();
  state.selectedId = sorter.id;
  state.sorterRoutingSignature = '';
  saveGame();
  showToast(mode === 'output' ? '分拣器已安装 · 建筑 → 传送带' : '分拣器已安装 · 传送带 → 建筑');
  return true;
}

function drawSorterPortMarker(cell, color, active = false, occupied = false) {
  const point = worldToScreen(cell.x + .5, cell.y + .5);
  const pulse = active ? 1 + Math.sin(state.animTime * 5) * .16 : 1;
  ctx.save();
  ctx.globalAlpha = occupied ? .22 : active ? .94 : .58;
  ctx.strokeStyle = color;
  ctx.fillStyle = `${color}${occupied ? '10' : '22'}`;
  ctx.lineWidth = active ? 2 : 1;
  ctx.beginPath();
  ctx.arc(point.x, point.y, (occupied ? 4 : 5) * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawSorterPortHints() {
  const anchor = state.pointer.sorterAnchor;
  const preview = sorterPlacementPreview();
  state.buildings.filter(isSorterTargetBuilding).forEach(building => {
    buildingPortCells(building).forEach(port => {
      const selected = anchor?.kind === 'building' && anchor.id === building.id;
      drawSorterPortMarker(port, selected ? '#c7d94c' : '#69d8da', selected);
    });
  });
  state.belts.forEach(belt => {
    const start = { x: belt.x, y: belt.y };
    const end = getBeltEnd(belt);
    drawSorterPortMarker(start, '#c7d94c', anchor?.kind === 'belt' && anchor.id === belt.id && anchor.endpoint === 'start', true);
    if (end.x !== start.x || end.y !== start.y) drawSorterPortMarker(end, '#f7c35e', anchor?.kind === 'belt' && anchor.id === belt.id && anchor.endpoint === 'end', true);
  });
  if (preview?.endpointCell) drawSorterPortMarker(preview.endpointCell, preview.valid ? '#62d69a' : '#ee6a65', true);
}

function drawSorterPreview() {
  const anchor = state.pointer.sorterAnchor;
  if (!anchor) return;
  const preview = sorterPlacementPreview();
  if (!preview) return;
  const valid = preview.valid;
  const color = valid ? '#62d69a' : '#ee6a65';
  if (preview.building && preview.endpointCell) {
    const from = buildingCenter(preview.building);
    const to = { x: preview.endpointCell.x + .5, y: preview.endpointCell.y + .5 };
    const ghost = preview.placement?.cell;
    const ghostPoint = ghost ? worldToScreen(ghost.x, ghost.y) : null;
    ctx.save();
    ctx.strokeStyle = `${color}bb`;
    ctx.lineWidth = Math.max(1.5, state.zoom * 1.5);
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(worldToScreen(from.x, from.y).x, worldToScreen(from.x, from.y).y);
    ctx.lineTo(ghostPoint ? ghostPoint.x + TILE * state.zoom / 2 : worldToScreen(to.x, to.y).x, ghostPoint ? ghostPoint.y + TILE * state.zoom / 2 : worldToScreen(to.x, to.y).y);
    ctx.lineTo(worldToScreen(to.x, to.y).x, worldToScreen(to.x, to.y).y);
    ctx.stroke();
    ctx.restore();
    if (ghostPoint) {
      const size = TILE * state.zoom;
      ctx.save();
      ctx.globalAlpha = .64;
      ctx.fillStyle = `${color}28`;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.fillRect(ghostPoint.x + 2, ghostPoint.y + 2, size - 4, size - 4);
      ctx.strokeRect(ghostPoint.x + 2, ghostPoint.y + 2, size - 4, size - 4);
      if (hasImage(assets.sorter)) {
        ctx.globalAlpha = .26;
        ctx.drawImage(assets.sorter, ghostPoint.x + size * .06, ghostPoint.y + size * .06, size * .88, size * .88);
      }
      ctx.restore();
    }
  }
}

function drawBeltPortHints() {
  if (state.tool === 'sorter') {
    drawSorterPortHints();
    return;
  }
  if (state.tool !== 'belt') return;
  const hoverBuilding = findBuildingAt(state.pointer.cell);
  state.buildings.forEach(building => {
    buildingPortCells(building).forEach(port => {
      const occupied = Boolean(beltAt(port));
      const selectedPort = state.pointer.startBuildingId === building.id && state.pointer.startCell?.x === port.x && state.pointer.startCell?.y === port.y;
      const targetPort = hoverBuilding?.id === building.id && !selectedPort;
      const point = worldToScreen(port.x + .5, port.y + .5);
      const pulse = selectedPort || targetPort ? 1 + Math.sin(state.animTime * 5) * .16 : 1;
      ctx.save();
      ctx.globalAlpha = occupied ? .24 : selectedPort || targetPort ? .9 : .5;
      ctx.strokeStyle = selectedPort ? '#c7d94c' : targetPort ? '#f7c35e' : '#69d8da';
      ctx.fillStyle = occupied ? 'rgba(105,216,218,.08)' : 'rgba(105,216,218,.16)';
      ctx.lineWidth = selectedPort || targetPort ? 2 : 1;
      ctx.beginPath();
      ctx.arc(point.x, point.y, (occupied ? 4 : 5) * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    });
  });
}

function isAdjacentToBuilding(cell, building) {
  const size = buildings[building.type].size;
  const horizontal = (cell.x === building.x - 1 || cell.x === building.x + size) && cell.y >= building.y - 1 && cell.y <= building.y + size;
  const vertical = (cell.y === building.y - 1 || cell.y === building.y + size) && cell.x >= building.x - 1 && cell.x <= building.x + size;
  return horizontal || vertical;
}

function findBuildingAt(cell) {
  if (!cell) return null;
  return [...state.buildings].reverse().find(building => {
    const size = buildings[building.type].size;
    return cell.x >= building.x && cell.x < building.x + size && cell.y >= building.y && cell.y < building.y + size;
  });
}

function buildingPortToward(building, targetCell) {
  const size = buildings[building.type].size;
  const center = { x: building.x + (size - 1) / 2, y: building.y + (size - 1) / 2 };
  const delta = { x: (targetCell?.x ?? center.x + 1) - center.x, y: (targetCell?.y ?? center.y) - center.y };
  if (Math.abs(delta.x) >= Math.abs(delta.y)) {
    return {
      x: delta.x < 0 ? building.x - 1 : building.x + size,
      y: clamp(Math.round(targetCell?.y ?? center.y), building.y, building.y + size - 1)
    };
  }
  return {
    x: clamp(Math.round(targetCell?.x ?? center.x), building.x, building.x + size - 1),
    y: delta.y < 0 ? building.y - 1 : building.y + size
  };
}

function buildingCenter(building) {
  const size = buildings[building.type].size;
  return { x: building.x + (size - 1) / 2, y: building.y + (size - 1) / 2 };
}

function beltPortsBetweenBuildings(source, target) {
  const candidates = [];
  buildingPortCells(source).forEach(start => {
    buildingPortCells(target).forEach(end => {
      [false, true].forEach(verticalFirst => {
        const segments = beltSegmentsBetweenOrder(start, end, verticalFirst);
        const cells = segments.flatMap(beltCells);
        const invalid = cells.some(cell => isTerrainBlocked(cell) || overlapsBuilding(cell.x, cell.y, 1) || beltAt(cell));
        if (invalid) return;
        const length = cells.length;
        const turns = segments.length - 1;
        const distance = Math.abs(end.x - start.x) + Math.abs(end.y - start.y);
        candidates.push({ start, end, segments, score: length * 10 + turns * 2 + distance });
      });
    });
  });
  let route = candidates.sort((left, right) => left.score - right.score)[0];
  if (!route) {
    buildingPortCells(source).forEach(start => {
      buildingPortCells(target).forEach(end => {
        const segments = findBeltPath(start, end);
        if (!segments.length) return;
        const cells = segments.flatMap(beltCells);
        const length = cells.length;
        const turns = segments.length - 1;
        candidates.push({ start, end, segments, score: length * 10 + turns * 2 });
      });
    });
    route = candidates.sort((left, right) => left.score - right.score)[0];
  }
  if (route) return { start: route.start, end: route.end, segments: route.segments };
  return {
    start: buildingPortToward(source, buildingCenter(target)),
    end: buildingPortToward(target, buildingCenter(source)),
    segments: null
  };
}

function beltPreviewEnd(cell) {
  const building = findBuildingAt(cell);
  if (!building || building.id === state.pointer.startBuildingId) return cell;
  return buildingPortToward(building, state.pointer.startCell || cell);
}

function findNodeForBuilding(building) {
  return state.nodes.find(node => node.x >= building.x - 1 && node.x < building.x + buildings[building.type].size + 1 && node.y >= building.y - 1 && node.y < building.y + buildings[building.type].size + 1);
}

function resourceNodeAt(cell) {
  return state.nodes.find(node => node.x === cell.x && node.y === cell.y) || null;
}

function resourceNodeCollisionAt(cell, size) {
  const blockedCell = footprintCells(cell, size).find(entry => resourceNodeAt(entry));
  return blockedCell ? { cell: blockedCell, node: resourceNodeAt(blockedCell) } : null;
}

function buildingCollisionAt(cell, size, ignoreId = null) {
  const cells = footprintCells(cell, size);
  return state.buildings.find(building => building.id !== ignoreId && cells.some(entry => {
    const buildingSize = buildings[building.type].size;
    return entry.x >= building.x && entry.x < building.x + buildingSize && entry.y >= building.y && entry.y < building.y + buildingSize;
  })) || null;
}

function footprintBeltAt(cell, size) {
  return footprintCells(cell, size).find(entry => beltAt(entry)) || null;
}

function overlapsBuilding(x, y, size) {
  return Boolean(buildingCollisionAt({ x, y }, size));
}

function kitCount(type) {
  const kitType = type === 'storage' ? 'solidStorage' : type;
  return Math.max(0, Math.floor(state.kits?.[kitType] || 0));
}

function buildingMaterialCost(type) {
  const meta = buildings[type];
  if (!meta?.cost) return {};
  const level = clamp(getBuildingLevel(type), 1, 5);
  const markup = [1, 1.35, 1.8, 2.4, 3.2][level - 1];
  const cost = Object.fromEntries(Object.entries(meta.cost).map(([resource, amount]) => [resource, Math.ceil(amount * markup)]));
  if (level >= 3) cost.processor = (cost.processor || 0) + level - 2;
  if (level >= 5) cost.structureCube = (cost.structureCube || 0) + 1;
  return cost;
}

function canUseKit(type) {
  return kitCount(type) > 0;
}

function consumeBuildKit(type) {
  if (!canUseKit(type)) return false;
  const kitType = type === 'storage' ? 'solidStorage' : type;
  state.kits[kitType] = kitCount(kitType) - 1;
  return true;
}

function craftCost(recipe) {
  return recipe.buildingType ? buildingMaterialCost(recipe.buildingType) : (recipe.cost || {});
}

function craftRecipe(id) {
  const recipe = handcraftRecipes.find(entry => entry.id === id);
  if (!recipe) return;
  if (recipe.tech && !isTechUnlocked(recipe.tech)) {
    showToast(`需要完成「${buildingTechName(recipe.buildingType || recipe.output)}」`, 'warning');
    return;
  }
  const cost = craftCost(recipe);
  if (!canAfford(cost)) {
    showToast(`材料不足 · 需要 ${formatCost(cost)}`, 'warning');
    return;
  }
  spend(cost);
  if (recipe.outputType === 'kit') state.kits[recipe.output] = kitCount(recipe.output) + recipe.amount;
  else state.inventory[recipe.output] = (state.inventory[recipe.output] || 0) + recipe.amount;
  saveGame();
  showToast(`${recipe.outputLabel} 已加入建筑库存`);
  renderCraftPanel();
  updateHUD();
}

function canAfford(cost, multiplier = 1) {
  return Object.entries(cost).every(([resource, amount]) => (state.inventory[resource] || 0) >= amount * multiplier);
}

function canAffordStorage(cost, multiplier = 1) {
  return Object.entries(cost).every(([resource, amount]) => storageAmount(resource) >= amount * multiplier);
}

function takeStorageCost(cost, multiplier = 1) {
  Object.entries(cost).forEach(([resource, amount]) => takeFromStorage(resource, amount * multiplier));
}

function spend(cost, multiplier = 1) {
  Object.entries(cost).forEach(([resource, amount]) => { state.inventory[resource] = (state.inventory[resource] || 0) - amount * multiplier; });
}

function isTechUnlocked(id) {
  return state.tech.includes(id);
}

function hasTechPrerequisites(tech) {
  return (tech.requires || []).every(requirement => isTechUnlocked(requirement));
}

function buildingTechId(type) {
  return buildings[type]?.tech || null;
}

function buildingTechName(type) {
  return techById[buildingTechId(type)]?.label || '对应科技';
}

function isBuildingUnlocked(type) {
  const meta = buildings[type];
  if (!meta) return false;
  return !meta.tech || isTechUnlocked(meta.tech);
}

function isBuildingOperational(building) {
  return Boolean(building && buildings[building.type] && isBuildingUnlocked(building.type));
}

function formatRecipeInputs(inputs) {
  return Object.entries(inputs).map(([resource, amount]) => `${resources[resource]?.label || resource} ×${amount}`).join(' + ');
}

function researchTarget() {
  return state.research.current ? techById[state.research.current] : null;
}

function labProductionCube(building) {
  const targetCube = researchTarget()?.cube || 'electromagneticCube';
  const selectedMode = building?.researchMode || 'auto';
  if (selectedMode !== 'auto') return selectedMode;

  // Information research is the first nested recipe. An automatic lab keeps
  // its own inputs alive by making the missing lower-tier matrix first.
  if (targetCube === 'informationCube') {
    if (storageAmount('energyCube') < 1) return 'energyCube';
    if (storageAmount('structureCube') < 1) return 'structureCube';
  }
  return targetCube;
}

function placementCheck(type, cell) {
  const meta = buildings[type];
  if (!meta) return { valid: false, reason: '未知设施' };
  if (!isBuildingUnlocked(type)) {
    return { valid: false, reason: `需要完成「${buildingTechName(type)}」`, reasonCode: 'tech' };
  }
  if (!canUseKit(type)) {
    return { valid: false, reason: `没有${meta.label}库存 · 请打开制造面板`, reasonCode: 'kit' };
  }
  const footprint = footprintCells(cell, meta.size);
  const outOfBounds = footprint.find(entry => !isInsideWorld(entry));
  if (outOfBounds) return { valid: false, reason: '建筑体积超出可建造区域', reasonCode: 'bounds', blockedCell: outOfBounds };
  const collision = buildingCollisionAt(cell, meta.size);
  if (collision) return { valid: false, reason: `建筑体积与${buildings[collision.type].label}重叠`, reasonCode: 'building', collision };
  const beltCollision = footprintBeltAt(cell, meta.size);
  if (beltCollision) return { valid: false, reason: '建筑体积压到传送带', reasonCode: 'belt', blockedCell: beltCollision };
  const terrainCollision = footprint.find(entry => isTerrainBlocked(entry));
  if (terrainCollision) {
    const terrain = terrainAt(terrainCollision);
    return { valid: false, reason: `${terrain.label}不可建造`, reasonCode: 'terrain', blockedCell: terrainCollision, terrain };
  }
  const resourceCollision = resourceNodeCollisionAt(cell, meta.size);
  if (resourceCollision) {
    const resourceLabel = resources[resourceCollision.node.resource]?.label || '资源';
    return {
      valid: false,
      reason: `建筑体积压住${resourceLabel}矿脉核心格`,
      reasonCode: 'resource',
      blockedCell: resourceCollision.cell,
      node: resourceCollision.node
    };
  }
  const node = findNodeForBuilding({ type, x: cell.x, y: cell.y });
  if (type === 'miner' && (!node || ['crudeOil', 'water', 'naturalGas'].includes(node.resource))) return { valid: false, reason: '采矿机必须覆盖固体矿脉', reasonCode: 'resource' };
  if (type === 'oilExtractor' && node?.resource !== 'crudeOil') return { valid: false, reason: '石油提取机必须覆盖原油渗流区', reasonCode: 'resource' };
  if (type === 'waterPump' && node?.resource !== 'water') return { valid: false, reason: '水泵必须覆盖水源采集区', reasonCode: 'resource' };
  if (type === 'gasExtractor' && node?.resource !== 'naturalGas') return { valid: false, reason: '天然气压采机必须覆盖气田', reasonCode: 'resource' };
  return { valid: true };
}

function placeBuilding(cell) {
  const check = placementCheck(state.tool, cell);
  if (!check.valid) { showToast(check.reason, 'warning'); return; }
  const building = makeBuilding(state.tool, cell.x, cell.y, state.rotation);
  if (state.tool === 'miner') building.nodeId = findNodeForBuilding(building)?.id || null;
  if (['oilExtractor', 'waterPump', 'gasExtractor'].includes(state.tool)) building.nodeId = findNodeForBuilding(building)?.id || null;
  consumeBuildKit(state.tool);
  state.buildings.push(building);
  rebuildPowerGrids();
  state.selectedId = building.id;
  state.selectedBeltId = null;
  saveGame();
  showToast(`${buildings[state.tool].label} 已部署`);
}

function beltAt(cell) {
  return state.belts.find(belt => beltCells(belt).some(entry => entry.x === cell.x && entry.y === cell.y));
}

function findBeltAt(cell) {
  if (!cell) return null;
  return [...state.belts].reverse().find(belt => beltCells(belt).some(entry => entry.x === cell.x && entry.y === cell.y)) || null;
}

function placeBelt(start, end, presetSegments = null) {
  const rawSegments = presetSegments || (start && end ? beltSegmentsBetween(start, end) : []);
  const segments = freeBeltSegments(trimBeltExtension(start, rawSegments), start);
  if (!segments.length) { showToast('传送带至少需要两个网格', 'warning'); return; }
  const cells = segments.flatMap(beltCells);
  const boundaryCell = cells.find(cell => !isInsideWorld(cell));
  if (boundaryCell) { showToast('传送带不能超出可建造区域', 'warning'); return; }
  const terrainCell = cells.find(cell => isTerrainBlocked(cell));
  if (terrainCell) { showToast(`${terrainAt(terrainCell).label}不可铺设传送带`, 'warning'); return; }
  if (cells.some(cell => overlapsBuilding(cell.x, cell.y, 1))) { showToast('传送带不能穿过设施', 'warning'); return; }
  const newCells = cells.filter(cell => !beltAt(cell));
  const kitCells = Math.min(kitCount('belt'), newCells.length);
  const rawCells = newCells.length - kitCells;
  if (!canAfford({ iron: 1 }, rawCells)) { showToast(`铁锭不足 · 还需要 ${rawCells} 个传送带组件`, 'warning'); return; }
  state.kits.belt -= kitCells;
  spend({ iron: 1 }, rawCells);
  let remainingKits = kitCells;
  state.belts.push(...segments.map(segment => {
    const segmentCells = beltCells(segment).filter(cell => newCells.some(entry => entry.x === cell.x && entry.y === cell.y));
    const segmentKitCells = Math.min(remainingKits, segmentCells.length);
    remainingKits -= segmentKitCells;
    return {
      ...segment,
      kitCells: segmentKitCells,
      id: `belt-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`
    };
  }));
  saveGame();
  showToast(`传送带已铺设 · ${cells.length} 格`);
}

function removeAt(cell) {
  const building = findBuildingAt(cell);
  if (building) {
    state.buildings = state.buildings.filter(item => item.id !== building.id);
    const kitType = building.type === 'storage' ? 'solidStorage' : building.type;
    state.kits[kitType] = kitCount(kitType) + 1;
    state.selectedId = null;
    state.selectedBeltId = null;
    rebuildPowerGrids();
    saveGame();
    showToast(`${buildings[building.type].label} 已回收`);
    return;
  }
  const beltIndex = state.belts.findIndex(belt => beltCells(belt).some(entry => entry.x === cell.x && entry.y === cell.y));
  if (beltIndex !== -1) {
    const [belt] = state.belts.splice(beltIndex, 1);
    state.buildings.filter(building => building.type === 'sorter').forEach(sorter => {
      Object.entries(sorter.sorterRules || {}).forEach(([resource, beltId]) => {
        if (beltId === belt.id) delete sorter.sorterRules[resource];
      });
    });
    const kitCells = Math.max(0, belt.kitCells || 0);
    state.kits.belt += Math.floor(kitCells * .6);
    state.inventory.iron += Math.floor((belt.length - kitCells) * .6);
    state.selectedBeltId = null;
    state.items = state.items.filter(item => item.beltId !== belt.id);
    saveGame();
    showToast('传送带已回收');
    return;
  }
  showToast('这里没有可拆除对象', 'warning');
}

function findBeltStartingNear(building, resource) {
  const sorter = findSorterForBuilding(building, resource, 'output');
  return sorter ? sorterOutputBelts(sorter).find(belt => Boolean(findNextBelt(belt, resource, sorter.id)) || Boolean(findDestination(belt, resource, sorter.id))) : null;
}

function sorterOutputBelts(sorter) {
  if (!sorter || sorter.type !== 'sorter') return [];
  return state.belts
    .filter(belt => isAdjacentToBuilding({ x: belt.x, y: belt.y }, sorter))
    .sort((left, right) => left.y - right.y || left.x - right.x || left.id.localeCompare(right.id));
}

function sorterAttachedBuildings(sorter) {
  if (!sorter || sorter.type !== 'sorter') return [];
  return state.buildings
    .filter(building => building.id !== sorter.id && building.type !== 'sorter' && !isPowerTowerType(building) && isAdjacentToBuilding({ x: sorter.x, y: sorter.y }, building))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function sorterAttachedBuilding(sorter) {
  return sorterAttachedBuildings(sorter)[0] || null;
}

function sorterInputBelts(sorter) {
  if (!sorter || sorter.type !== 'sorter') return [];
  return state.belts
    .filter(belt => isAdjacentToBuilding(getBeltEnd(belt), sorter))
    .sort((left, right) => left.y - right.y || left.x - right.x || left.id.localeCompare(right.id));
}

function findSorterForBuilding(building, resource, mode) {
  if (!building) return null;
  return state.buildings
    .filter(sorter => sorter.type === 'sorter' && (sorter.sorterMode || 'input') === mode)
    .filter(sorter => sorterAttachedBuilding(sorter)?.id === building.id)
    .filter(sorter => mode === 'output' || acceptsBuildingResource(building, resource))
    .find(sorter => mode === 'input' ? sorterInputBelts(sorter).length > 0 : sorterOutputBelts(sorter).length > 0) || null;
}

function sorterPortDirection(sorter, belt) {
  const center = buildingCenter(sorter);
  const deltaX = belt.x - center.x;
  const deltaY = belt.y - center.y;
  if (Math.abs(deltaX) >= Math.abs(deltaY)) return deltaX < 0 ? '西' : '东';
  return deltaY < 0 ? '北' : '南';
}

function sorterOutputLabel(sorter, belt, index = sorterOutputBelts(sorter).indexOf(belt)) {
  return `出口 ${String.fromCharCode(65 + Math.max(0, index))} · ${sorterPortDirection(sorter, belt)}`;
}

function findSorterOutputBelt(sorter, resource) {
  const outputs = sorterOutputBelts(sorter);
  if (!outputs.length) return null;
  const explicitId = sorter.sorterRules?.[resource];
  if (explicitId) {
    const explicit = outputs.find(belt => belt.id === explicitId);
    if (explicit) return explicit;
    // A saved rule can outlive a deleted belt. Do not strand that resource;
    // clear the stale route and let the topology resolver choose a viable one.
    delete sorter.sorterRules[resource];
  }
  const viable = outputs.filter(belt => Boolean(findDestinationAlongRoute(belt, resource, sorter.id)));
  if (!viable.length) return null;
  const cursor = Number.isInteger(sorter.routeCursor) ? sorter.routeCursor : 0;
  const selected = viable[cursor % viable.length];
  sorter.routeCursor = cursor + 1;
  return selected;
}

function acceptsBuildingResource(building, resource) {
  if (!isBuildingOperational(building)) return false;
  if (isStorageType(building)) return storageFormOf(building) === resourceForm(resource) && storageHasSpace(building);
  if (building.type === 'smelter') {
    // One smelter is one recipe line. This prevents a shared line from
    // silently filling with three ores while producing none of them reliably.
    return ['copper', 'iron', 'silicon'].includes(resource) && (!building.recipeResource || building.recipeResource === resource);
  }
  if (building.type === 'assembler') return ['copperIngot', 'siliconWafer'].includes(resource);
  if (building.type === 'workbench') return ['ironIngot', 'copperIngot', 'siliconWafer'].includes(resource);
  if (building.type === 'thermal') return resource === 'coal';
  if (['waterPump', 'oilExtractor', 'gasExtractor'].includes(building.type)) return false;
  if (building.type === 'researchLab') {
    const cube = labProductionCube(building);
    return Object.prototype.hasOwnProperty.call(cubeRecipes[cube]?.inputs || {}, resource);
  }
  return false;
}

function accepts(building, resource) {
  if (!isBuildingOperational(building)) return false;
  if (building.type !== 'sorter') return acceptsBuildingResource(building, resource);
  const mode = building.sorterMode || 'input';
  const target = sorterAttachedBuilding(building);
  return mode === 'input' && Boolean(target) && acceptsBuildingResource(target, resource) && sorterInputBelts(building).length > 0;
}

function inputCapacity(building) {
  if (!building) return 0;
  if (building.type === 'researchLab') return 6;
  if (building.type === 'smelter' || building.type === 'thermal') return 8;
  if (building.type === 'assembler' || building.type === 'workbench') return 6;
  return 4;
}

function outputCapacity(building) {
  return ['miner', 'oilExtractor', 'waterPump', 'gasExtractor'].includes(building?.type) ? 5 : 6;
}

function deliver(building, resource) {
  // Belts may terminate at a sorter only. The sorter simulation owns the
  // second hop into a machine or warehouse, keeping the logistics contract
  // explicit even when a caller tries to bypass the topology.
  if (!building || building.type !== 'sorter' || !accepts(building, resource)) return false;
  if ((building.input[resource] || 0) >= inputCapacity(building)) return false;
  building.input[resource] = (building.input[resource] || 0) + 1;
  return true;
}

function findDestination(belt, resource, sourceId = null) {
  const end = getBeltEnd(belt);
  return state.buildings.find(building => building.id !== sourceId && building.type === 'sorter' && accepts(building, resource) && isAdjacentToBuilding(end, building)) || null;
}

function findDestinationAlongRoute(belt, resource, sourceId = null) {
  const visited = new Set();
  const queue = belt ? [belt] : [];
  while (queue.length) {
    const current = queue.shift();
    if (!current || visited.has(current.id)) continue;
    visited.add(current.id);
    const destination = findDestination(current, resource, sourceId);
    if (destination) return destination;
    getConnectedNextBelts(current).forEach(next => {
      if (!visited.has(next.id)) queue.push(next);
    });
  }
  return null;
}

function getConnectedNextBelts(belt) {
  const end = getBeltEnd(belt);
  return state.belts.filter(candidate => {
    if (candidate.id === belt.id) return false;
    const distance = Math.abs(candidate.x - end.x) + Math.abs(candidate.y - end.y);
    if (distance !== 1 && distance !== 0) return false;
    // A corner connects when the next segment starts beside the current end.
    // Its forward direction does not need to point directly away from the
    // previous segment's endpoint, only avoid pointing back into it.
    if (candidate.length <= 1 || (candidate.dx === 0 && candidate.dy === 0)) return true;
    const nextCell = { x: candidate.x + candidate.dx, y: candidate.y + candidate.dy };
    return nextCell.x !== end.x || nextCell.y !== end.y;
  }).sort((left, right) => left.id.localeCompare(right.id));
}

function findNextBelt(belt, resource = null, sourceId = null) {
  const candidates = getConnectedNextBelts(belt);
  if (!candidates.length) return null;
  if (!resource || candidates.length === 1) return candidates[0];
  return candidates.find(candidate => findDestinationAlongRoute(candidate, resource, sourceId)) || candidates[0];
}

function warehouseResourceNeedScore(destination, resource) {
  if (!destination) return Number.POSITIVE_INFINITY;
  const current = destination.input?.[resource] || 0;
  if (current >= inputCapacity(destination)) return Number.POSITIVE_INFINITY;
  let required = 0;
  if (destination.type === 'researchLab') required = cubeRecipes[labProductionCube(destination)]?.inputs?.[resource] || 0;
  else if (destination.type === 'smelter') required = destination.recipeResource === resource ? 1 : 0;
  else if (destination.type === 'assembler') required = ({ copperIngot: 1, siliconWafer: 1 })[resource] || 0;
  else if (destination.type === 'workbench') required = ({ ironIngot: 1, copperIngot: 1 })[resource] || 0;
  else if (destination.type === 'thermal') required = resource === 'coal' ? 1 : 0;
  if (required > current) return 0;
  return 1 + current / Math.max(1, inputCapacity(destination));
}

function dispatchStorageStock() {
  storageBuildings().forEach(storage => {
    const outputSorters = state.buildings.filter(sorter => sorter.type === 'sorter'
      && (sorter.sorterMode || 'input') === 'output'
      && sorterAttachedBuilding(sorter)?.id === storage.id
      && getGridPowerState(sorter).powered
      && sorterOutputBelts(sorter).length);
    outputSorters.forEach(sorter => {
      if (Object.values(sorter.output || {}).reduce((sum, amount) => sum + amount, 0) >= inputCapacity(sorter)) return;
      const candidates = Object.keys(storage.stock || {}).map(resource => {
        if ((storage.stock[resource] || 0) <= 0) return null;
        const belt = sorterOutputBelts(sorter).find(candidate => Boolean(findDestinationAlongRoute(candidate, resource, sorter.id)));
        return belt ? { resource, belt } : null;
      }).filter(Boolean);
      const candidate = candidates[0];
      if (!candidate) return;
      storage.stock[candidate.resource] -= 1;
      sorter.output[candidate.resource] = (sorter.output[candidate.resource] || 0) + 1;
    });
  });
}

function simulateSorters(dt) {
  state.buildings.filter(building => building.type === 'sorter' && isBuildingOperational(building)).forEach(sorter => {
    const target = sorterAttachedBuilding(sorter);
    const powerState = getGridPowerState(sorter);
    if (!target || !powerState.powered) return;
    const mode = sorter.sorterMode || 'input';
    if (mode === 'input') {
      const entry = Object.entries(sorter.input || {}).find(([resource, amount]) => amount > 0 && acceptsBuildingResource(target, resource));
      if (!entry) return;
      sorter.process = (sorter.process || 0) + dt * powerState.efficiency;
      if (sorter.process < getSorterCycleTime(sorter)) return;
      const [resource] = entry;
      if (isStorageType(target)) {
        if (storageFormOf(target) !== resourceForm(resource) || !storageHasSpace(target)) return;
        target.stock[resource] = (target.stock[resource] || 0) + 1;
      } else {
        if (!acceptsBuildingResource(target, resource) || (target.input[resource] || 0) >= inputCapacity(target)) return;
        if (target.type === 'smelter' && !target.recipeResource) target.recipeResource = resource;
        target.input[resource] = (target.input[resource] || 0) + 1;
      }
      sorter.input[resource] -= 1;
      sorter.process = 0;
    }
  });
}

function dispatchSorterOutputs() {
  state.buildings.filter(building => building.type === 'sorter' && isBuildingOperational(building) && getGridPowerState(building).powered && (building.sorterMode || 'input') === 'output').forEach(sorter => {
    Object.entries(sorter.output || {}).forEach(([resource, amount]) => {
      if (amount <= 0 || state.items.some(item => item.sourceId === sorter.id && item.resource === resource)) return;
      const belt = findSorterOutputBelt(sorter, resource);
      if (!belt) return;
      sorter.output[resource] -= 1;
      state.items.push({ id: `${Date.now()}-${Math.random()}`, beltId: belt.id, sourceId: sorter.id, resource, progress: 0 });
    });
  });
}

function hasRecipeInputs(input, recipe) {
  return Object.entries(recipe.inputs).every(([resource, amount]) => (input[resource] || 0) >= amount);
}

function consumeRecipeInputs(input, recipe) {
  Object.entries(recipe.inputs).forEach(([resource, amount]) => { input[resource] -= amount; });
}

function getBeltTravelFactor() {
  const level = clamp(getBuildingLevel('belt'), 1, 5);
  const techFactor = [.4, .28, .21, .16, .12][level - 1];
  return activeCareer().effect === 'beltSpeed' ? techFactor * .75 : techFactor;
}

function getMiningTime(building) {
  const base = ['oilExtractor', 'gasExtractor'].includes(building?.type) ? 1.2 : .9;
  const level = clamp(getBuildingLevel(building?.type), 1, 5);
  return base * Math.pow(.86, level - 1);
}

function getSmeltingTime() {
  const base = isTechUnlocked('automated-smelting') ? 1.05 : 1.4;
  return base * Math.pow(.86, clamp(getBuildingLevel('smelter'), 1, 5) - 1);
}

function getAssemblyTime(building) {
  const base = building.type === 'workbench' ? 2.8 : 2.2;
  const workbenchUpgrade = building.type === 'workbench' && isTechUnlocked('workbench-tech') ? .79 : 1;
  const advancedUpgrade = isTechUnlocked('advanced-assembly') ? .7 : 1;
  const levelFactor = Math.pow(.86, clamp(getBuildingLevel(building.type), 1, 5) - 1);
  return base * workbenchUpgrade * advancedUpgrade * levelFactor;
}

function getResearchProductionTime(building, cube) {
  const base = cubeRecipes[cube]?.time || 4.2;
  return (isTechUnlocked('matrix-lab') ? base * .8 : base) * Math.pow(.9, clamp(getBuildingLevel('researchLab'), 1, 5) - 1);
}

function getSorterCycleTime(sorter) {
  const level = clamp(getBuildingLevel('sorter'), 1, 5);
  return .22 * [1, .78, .62, .5, .4][level - 1];
}

const LOCAL_POWER_LINK_RANGE = 3.7;
const POWER_EPSILON = .0001;

function powerBuildingCenter(building) {
  return buildingCenter(building);
}

function getTransmissionRange(building) {
  if (!isPowerTowerType(building)) return 0;
  const baseRange = buildings[building.type]?.transmissionRange || 0;
  const transmissionUpgrade = isTechUnlocked('power-transmission') ? 1.15 : 1;
  const backboneUpgrade = isTechUnlocked('advanced-power-grid') ? 1.1 : 1;
  return baseRange * transmissionUpgrade * backboneUpgrade;
}

function isPowerBuilding(building) {
  const meta = buildings[building?.type];
  return Boolean(building && meta && (meta.power > 0 || meta.generation > 0 || isPowerTowerType(building)));
}

function powerDistance(left, right) {
  const leftCenter = powerBuildingCenter(left);
  const rightCenter = powerBuildingCenter(right);
  return Math.hypot(leftCenter.x - rightCenter.x, leftCenter.y - rightCenter.y);
}

function powerNodesConnected(left, right) {
  const leftTower = isPowerTowerType(left);
  const rightTower = isPowerTowerType(right);
  const distance = powerDistance(left, right);
  if (leftTower && rightTower) {
    return left.gridEnabled !== false
      && right.gridEnabled !== false
      && distance <= getTransmissionRange(left) + getTransmissionRange(right);
  }
  if (leftTower || rightTower) {
    const tower = leftTower ? left : right;
    return distance <= getTransmissionRange(tower);
  }
  return distance <= LOCAL_POWER_LINK_RANGE;
}

function getGridPowerState(building) {
  if (!isPowerBuilding(building)) return { grid: null, powered: true, efficiency: 1, status: '无需供电' };
  const grid = state.powerGrids.find(entry => entry.buildingIds.includes(building.id));
  if (!grid) return { grid: null, powered: false, efficiency: 0, status: '未接入电网' };
  if (grid.blackout) return { grid, powered: false, efficiency: 0, status: '电网瘫痪' };
  return {
    grid,
    powered: true,
    efficiency: grid.highLoad && (buildings[building.type]?.power || 0) > 0 ? .5 : 1,
    status: grid.highLoad ? '电网高负载' : '电网在线'
  };
}

function rebuildPowerGrids() {
  const powerBuildings = state.buildings.filter(building => isBuildingOperational(building) && isPowerBuilding(building));
  const adjacency = new Map(powerBuildings.map(building => [building.id, []]));
  const links = [];
  for (let leftIndex = 0; leftIndex < powerBuildings.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < powerBuildings.length; rightIndex += 1) {
      const left = powerBuildings[leftIndex];
      const right = powerBuildings[rightIndex];
      if (!powerNodesConnected(left, right)) continue;
      adjacency.get(left.id).push(right.id);
      adjacency.get(right.id).push(left.id);
      links.push({ left: left.id, right: right.id });
    }
  }

  const visited = new Set();
  const grids = [];
  powerBuildings.slice().sort((left, right) => left.id.localeCompare(right.id)).forEach(seed => {
    if (visited.has(seed.id)) return;
    const queue = [seed.id];
    const buildingIds = [];
    visited.add(seed.id);
    while (queue.length) {
      const id = queue.shift();
      buildingIds.push(id);
      (adjacency.get(id) || []).forEach(nextId => {
        if (visited.has(nextId)) return;
        visited.add(nextId);
        queue.push(nextId);
      });
    }
    const members = buildingIds.map(id => powerBuildings.find(building => building.id === id)).filter(Boolean);
    const generation = members.reduce((total, building) => {
      if (building.type === 'thermal' && (building.input.coal || 0) <= 0) return total;
      return total + getPowerGeneration(building);
    }, 0);
    const load = members.reduce((total, building) => total + (buildings[building.type]?.power || 0), 0);
    const ratio = generation > POWER_EPSILON ? load / generation : load > 0 ? Number.POSITIVE_INFINITY : 0;
    const blackout = load > generation + POWER_EPSILON;
    const highLoad = !blackout && generation > POWER_EPSILON && ratio >= .8;
    const grid = {
      id: `grid-${grids.length + 1}`,
      buildingIds,
      buildings: members,
      links: links.filter(link => buildingIds.includes(link.left) && buildingIds.includes(link.right)),
      towers: members.filter(isPowerTowerType),
      generation,
      load,
      ratio,
      highLoad,
      blackout,
      efficiency: blackout ? 0 : highLoad ? .5 : 1,
      status: blackout ? '瘫痪' : highLoad ? '高负载' : '稳定'
    };
    members.forEach(building => { building.powerGridId = grid.id; });
    grids.push(grid);
  });

  state.powerGrids = grids;
  state.powerSummary = {
    gridCount: grids.length,
    highLoadCount: grids.filter(grid => grid.highLoad).length,
    blackoutCount: grids.filter(grid => grid.blackout).length,
    generation: grids.reduce((total, grid) => total + grid.generation, 0),
    load: grids.reduce((total, grid) => total + grid.load, 0)
  };
  state.powerGeneration = state.powerSummary.generation;
  state.powerLoad = state.powerSummary.load;
  return grids;
}

function getPowerGeneration(building) {
  if (!isBuildingOperational(building)) return 0;
  const base = buildings[building.type]?.generation || 0;
  const careerMultiplier = activeCareer().effect === 'power' ? 1.2 : 1;
  const gridMultiplier = isTechUnlocked('power-grid-mk2') ? 1.25 : 1;
  return base * careerMultiplier * gridMultiplier;
}

function buildingLabel(type) {
  return type === 'belt' ? '传送带' : buildings[type]?.label || type;
}

function buildingUpgradeTechs(type) {
  return techNodes.filter(tech => tech.upgrades?.includes(type));
}

function getBuildingLevel(type) {
  const researched = buildingUpgradeTechs(type).filter(tech => isTechUnlocked(tech.id));
  const explicitTier = researched.map(tech => tech.upgradeTier || 0).filter(Boolean);
  if (explicitTier.length) return Math.min(5, Math.max(1, ...explicitTier));
  return Math.min(5, 1 + researched.length);
}

function getBuildingUpgradeState(type) {
  const techs = buildingUpgradeTechs(type);
  const researched = techs.filter(tech => isTechUnlocked(tech.id));
  const next = techs.find(tech => !isTechUnlocked(tech.id));
  return { researched, next };
}

function techUnlockText(tech) {
  if (!tech.unlocks?.length) return '';
  return `解锁：${tech.unlocks.map(buildingLabel).join('、')}`;
}

function techUpgradeText(tech) {
  if (!tech.upgrades?.length) return '';
  return `升级：${tech.upgrades.map(buildingLabel).join('、')}`;
}

function getResearchSpeed() {
  return activeCareer().effect === 'research' ? 1.3 : 1;
}

function simulateBuildings(dt) {
  rebuildPowerGrids();

  dispatchStorageStock();

  state.buildings.forEach(building => {
    if (!isBuildingOperational(building)) return;
    const powerState = getGridPowerState(building);
    const efficiency = powerState.efficiency;
    if (isPowerBuilding(building) && !powerState.powered && buildings[building.type]?.power > 0) return;
    if (['miner', 'oilExtractor', 'waterPump', 'gasExtractor'].includes(building.type)) {
      const node = state.nodes.find(item => item.id === building.nodeId);
      const correctResource = building.type === 'oilExtractor'
        ? node?.resource === 'crudeOil'
        : building.type === 'waterPump'
          ? node?.resource === 'water'
          : building.type === 'gasExtractor'
            ? node?.resource === 'naturalGas'
            : node?.resource && resources[node.resource]?.form === 'solid';
      if (!node || !correctResource || node.amount <= 0 || !powerState.powered) return;
      building.timer += dt * efficiency;
      const extractionTime = getMiningTime(building);
      if (building.timer >= extractionTime && Object.values(building.output).reduce((a, b) => a + b, 0) < 5) {
        building.timer = 0;
        building.output[node.resource] = (building.output[node.resource] || 0) + 1;
        node.amount -= 1;
      }
    }

    if (building.type === 'smelter' && powerState.powered) {
      if (Object.values(building.output).reduce((sum, amount) => sum + amount, 0) >= outputCapacity(building)) return;
      const raw = building.recipeResource || ['copper', 'iron', 'silicon'].find(resource => (building.input[resource] || 0) > 0);
      if (!raw) return;
      building.process += dt * efficiency;
      if (building.process >= getSmeltingTime()) {
        building.process = 0;
        building.input[raw] -= 1;
        const output = raw === 'silicon' ? 'siliconWafer' : `${raw}Ingot`;
        building.output[output] = (building.output[output] || 0) + 1;
      }
    }

    if ((building.type === 'assembler' || building.type === 'workbench') && powerState.powered) {
      if (Object.values(building.output).reduce((sum, amount) => sum + amount, 0) >= outputCapacity(building)) return;
      const recipe = building.type === 'workbench'
        ? { inputs: { ironIngot: 1, copperIngot: 1 }, output: 'processor', time: getAssemblyTime(building) }
        : { inputs: { copperIngot: 1, siliconWafer: 1 }, output: 'processor', time: getAssemblyTime(building) };
      if (!hasRecipeInputs(building.input, recipe)) return;
      building.process += dt * efficiency;
      if (building.process >= recipe.time) {
        building.process = 0;
        consumeRecipeInputs(building.input, recipe);
        building.output[recipe.output] = (building.output[recipe.output] || 0) + 1;
      }
    }

    if (building.type === 'researchLab' && powerState.powered) {
      if (Object.values(building.output).reduce((sum, amount) => sum + amount, 0) >= outputCapacity(building)) return;
      const target = researchTarget();
      const cube = labProductionCube(building);
      const recipe = cubeRecipes[cube];
      if (!recipe) return;
      Object.entries(building.input).forEach(([resource, amount]) => {
        if (recipe.inputs[resource] === undefined) {
          putInStorage(resource, amount);
          delete building.input[resource];
        }
      });
      if (!hasRecipeInputs(building.input, recipe)) return;
      building.process += dt * efficiency;
      if (building.process >= getResearchProductionTime(building, cube)) {
        building.process = 0;
        consumeRecipeInputs(building.input, recipe);
        building.output[cube] = (building.output[cube] || 0) + 1;
      }
    }

    if (building.type === 'thermal' && powerState.powered && (building.input.coal || 0) > 0) {
      building.fuelTimer = (building.fuelTimer || 0) + dt * efficiency;
      if (building.fuelTimer >= 4) {
        building.fuelTimer = 0;
        building.input.coal -= 1;
      }
    }
  });

  state.buildings.forEach(building => {
    if (!isBuildingOperational(building) || isStorageType(building) || building.type === 'sorter') return;
    Object.entries(building.output).forEach(([resource, amount]) => {
      if (amount <= 0 || state.items.some(item => item.sourceId === building.id && item.resource === resource)) return;
      const sorter = findSorterForBuilding(building, resource, 'output');
      if (!sorter || Object.values(sorter.output || {}).reduce((sum, value) => sum + value, 0) >= inputCapacity(sorter)) return;
      building.output[resource] -= 1;
      sorter.output[resource] = (sorter.output[resource] || 0) + 1;
    });
  });

  state.buildings.forEach(building => {
    if (building.type !== 'sorter' || !isBuildingOperational(building)) return;
    const powerState = getGridPowerState(building);
    building.powerEfficiency = powerState.efficiency;
  });
  simulateSorters(dt);
  dispatchSorterOutputs();

  state.items = state.items.filter(item => {
    const belt = state.belts.find(entry => entry.id === item.beltId);
    if (!belt) return false;
    item.progress += dt / Math.max(.55, belt.length * getBeltTravelFactor());
    if (item.progress < 1) return true;
    const destination = findDestination(belt, item.resource, item.sourceId);
    if (destination && deliver(destination, item.resource)) return false;
    const nextBelt = findNextBelt(belt, item.resource, item.sourceId);
    if (nextBelt) {
      item.beltId = nextBelt.id;
      item.progress = 0;
    } else {
      // Keep a single cargo unit parked at the terminal. It will be retried on
      // the next tick after the destination consumes space.
      item.progress = 1;
    }
    return true;
  });
}

function simulateResearch(dt) {
  state.researchRate = 0;
  const tech = researchTarget();
  if (!tech || isTechUnlocked(tech.id)) return;
  const labPower = state.buildings
    .filter(building => building.type === 'researchLab' && isBuildingOperational(building))
    .reduce((total, building) => {
      const powerState = getGridPowerState(building);
      return total + (powerState.powered ? powerState.efficiency : 0);
    }, 0);
  if (!labPower) return;
  const available = storageAmount(tech.cube);
  if (available <= 0) return;
  const consumed = Math.min(available, dt * 1.25 * labPower * getResearchSpeed());
  takeFromStorage(tech.cube, consumed);
  state.research.progress += consumed;
  state.researchRate = consumed / Math.max(dt, .001);
  if (state.research.progress >= tech.cost) {
    state.tech = [...new Set([...state.tech, tech.id])];
    state.research = { current: null, progress: 0 };
    saveGame();
    showToast(`${tech.label} 研究完成`);
  }
}

function isInterstellarUnlocked() {
  return isTechUnlocked('interstellar-logistics');
}

function routeTarget() {
  const route = state.interstellar.route;
  return route ? planetById[route.targetId] : null;
}

function addFlightLog(message) {
  state.interstellar.log.push({ message, at: state.time });
  state.interstellar.log = state.interstellar.log.slice(-8);
}

function cargoOptions() {
  return [
    { resource: 'processor', amount: 2, note: '稳定货物' },
    { resource: 'electromagneticCube', amount: 4, note: '科研样本' },
    { resource: 'energyCube', amount: 3, note: '高能样本' }
  ];
}

function launchRoute() {
  const target = planetById[state.interstellar.selectedPlanet];
  if (!isInterstellarUnlocked()) { showToast('需要完成「星际物流」', 'warning'); return; }
  if (!target || target.id === 'home') { showToast('请选择一个远端星球', 'warning'); return; }
  if (state.interstellar.route) { showToast('当前已有货运舱在航线上', 'warning'); return; }
  if (!hasTechPrerequisites({ requires: target.requires })) { showToast('该星球的信标尚未接入', 'warning'); return; }
  const cargo = cargoOptions().find(option => option.resource === state.interstellar.cargo) || cargoOptions()[0];
  if (storageAmount(cargo.resource) < cargo.amount) {
    showToast(`货舱需要 ${resources[cargo.resource].label} ×${cargo.amount}`, 'warning');
    return;
  }
  takeFromStorage(cargo.resource, cargo.amount);
  state.interstellar.route = { id: `route-${Date.now()}`, targetId: target.id, cargo: cargo.resource, amount: cargo.amount, progress: 0, phase: 'outbound' };
  addFlightLog(`货运舱发射 → ${target.name} · ${resources[cargo.resource].label} ×${cargo.amount}`);
  saveGame();
  showToast(`货运舱已发射 · ${target.name}`);
  updateStarMapUI();
}

function simulateInterstellar(dt) {
  const route = state.interstellar.route;
  const target = routeTarget();
  if (!route || !target) return;
  route.progress += dt / Math.max(target.travelTime || 12, 8);
  if (route.progress < 1) return;
  if (route.phase === 'outbound') {
    route.phase = 'returning';
    route.progress = 0;
    addFlightLog(`货运舱抵达 ${target.name} · 开始返航`);
    showToast(`${target.name} 已接入 · 货舱返航中`);
    return;
  }
  const reward = target.reward;
  const stored = putInStorage(reward.resource, reward.amount);
  if (stored < reward.amount) state.inventory[reward.resource] = (state.inventory[reward.resource] || 0) + reward.amount - stored;
  state.interstellar.completedTrips += 1;
  state.interstellar.visits[target.id] = (state.interstellar.visits[target.id] || 0) + 1;
  addFlightLog(`航次完成 ← ${target.name} · ${resources[reward.resource].label} ×${reward.amount}`);
  state.interstellar.route = null;
  saveGame();
  showToast(`异星资源已回收 · ${resources[reward.resource].label} ×${reward.amount}`);
}

const stellarModuleCost = { structureCube: 4, titanium: 2, processor: 1 };

function contributeStellarProject() {
  if (!isTechUnlocked('dyson-frame')) { showToast('需要完成「戴森框架」科技', 'warning'); return; }
  if (state.stellarProject.progress >= 100) { showToast('恒星工程已完成'); return; }
  if (!canAffordStorage(stellarModuleCost)) { showToast(`仓储材料不足 · ${formatCost(stellarModuleCost)}`, 'warning'); return; }
  takeStorageCost(stellarModuleCost);
  state.stellarProject.progress = clamp(state.stellarProject.progress + 5, 0, 100);
  state.stellarProject.modules += 1;
  saveGame();
  showToast(`框架组件已部署 · ${state.stellarProject.progress}%`);
  updateStellarProjectUI();
}

function updateStellarProjectUI() {
  const section = query('#stellar-project');
  if (!section) return;
  const unlocked = isTechUnlocked('dyson-frame');
  const complete = state.stellarProject.progress >= 100;
  const progress = state.stellarProject.progress;
  section.classList.toggle('project-locked', !unlocked);
  section.classList.toggle('project-complete', complete);
  query('#stellar-project-state').textContent = !unlocked ? '未解锁' : complete ? '已完成' : '施工中';
  query('#stellar-project-title').textContent = complete ? '第一圈戴森框架已点亮' : '戴森框架施工台';
  query('#stellar-project-copy').textContent = !unlocked ? '完成主线科技「戴森框架」，才能把异星材料转化为恒星轨道组件。' : complete ? '恒星能量网络已建立，继续扩展将进入下一阶段。' : '从熔火-β回收钛，用结构矩阵和处理器部署轨道组件。';
  query('#stellar-project-fill').style.width = `${progress}%`;
  query('#stellar-project-progress').textContent = `${progress} / 100 · ${state.stellarProject.modules} 个组件`;
  query('#stellar-project-supply').textContent = formatCost(stellarModuleCost);
  const button = query('#stellar-project-button');
  button.disabled = !unlocked || complete || !canAffordStorage(stellarModuleCost);
  query('#stellar-project-cost').textContent = !unlocked ? '完成「戴森框架」后可用' : complete ? '恒星工程阶段完成' : button.disabled ? `材料不足 · ${formatCost(stellarModuleCost)}` : `消耗 ${formatCost(stellarModuleCost)}`;
}

function renderCargoOptions() {
  const host = query('#cargo-options');
  if (!host) return;
  host.innerHTML = cargoOptions().map(option => {
    const active = state.interstellar.cargo === option.resource;
    const available = storageAmount(option.resource);
    return `<button type="button" class="cargo-option${active ? ' active' : ''}" data-cargo="${option.resource}"><span class="cargo-option-icon" style="--cargo-color:${resources[option.resource].color}">${resources[option.resource].label.slice(0, 1)}</span><span><b>${resources[option.resource].label} ×${option.amount}</b><small>${option.note} · 库存 ${formatNumber(available)}</small></span></button>`;
  }).join('');
  all('[data-cargo]').forEach(button => button.addEventListener('click', () => {
    state.interstellar.cargo = button.dataset.cargo;
    renderCargoOptions();
    updateStarMapUI();
  }));
}

function updateRouteVisual() {
  const stage = query('#star-map-stage');
  const line = query('#route-line');
  const ship = query('#cargo-ship');
  const route = state.interstellar.route;
  const target = routeTarget();
  if (!stage || !line || !ship || !route || !target) {
    if (line) line.hidden = true;
    if (ship) ship.hidden = true;
    return;
  }
  const from = planetById.home.position;
  const to = target.position;
  const rect = stage.getBoundingClientRect();
  const dx = (to.x - from.x) * rect.width;
  const dy = (to.y - from.y) * rect.height;
  const distance = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  line.hidden = false;
  line.style.left = `${from.x * 100}%`;
  line.style.top = `${from.y * 100}%`;
  line.style.width = `${distance}px`;
  line.style.transform = `rotate(${angle}deg)`;
  const progress = route.phase === 'outbound' ? route.progress : 1 - route.progress;
  ship.hidden = false;
  ship.style.left = `${(from.x + (to.x - from.x) * progress) * 100}%`;
  ship.style.top = `${(from.y + (to.y - from.y) * progress) * 100}%`;
  ship.classList.toggle('returning', route.phase === 'returning');
}

function updateStarMapUI() {
  const panel = query('#star-map-panel');
  if (!panel) return;
  const unlocked = isInterstellarUnlocked();
  const target = planetById[state.interstellar.selectedPlanet] || planetById.home;
  const route = state.interstellar.route;
  const activeTarget = routeTarget();
  const cargo = cargoOptions().find(option => option.resource === state.interstellar.cargo) || cargoOptions()[0];
  query('#star-map-lock').hidden = unlocked;
  panel.classList.toggle('star-map-locked', !unlocked);
  all('[data-planet]').forEach(button => {
    const planet = planetById[button.dataset.planet];
    const locked = planet.requires.length > 0 && !planet.requires.every(requirement => isTechUnlocked(requirement));
    button.classList.toggle('selected', planet.id === target.id);
    button.classList.toggle('locked', locked);
    button.classList.toggle('in-flight', route?.targetId === planet.id);
    button.classList.toggle('visited', Boolean(state.interstellar.visits[planet.id]));
    const markerMeta = button.querySelector('small');
    if (markerMeta) markerMeta.textContent = locked ? '信标未接入' : state.interstellar.visits[planet.id] ? `${planet.role} · ${state.interstellar.visits[planet.id]} 航次` : planet.role;
  });
  query('#map-button-state').textContent = route ? '航线中' : unlocked ? '已接入' : '未接入';
  query('#planet-dock-kicker').textContent = target.kicker;
  query('#planet-dock-name').textContent = target.name;
  query('#planet-dock-description').textContent = target.description;
  query('#planet-reward').textContent = target.resources;
  query('#route-trip-count').textContent = formatNumber(state.interstellar.completedTrips);
  query('#route-log-count').textContent = `${state.interstellar.log.length} 条`;
  const routeTitle = query('#route-title');
  const routeStatus = query('#route-status');
  const routePhase = query('#route-phase-label');
  const routeTime = query('#route-time-label');
  const routeFill = query('#route-progress-fill');
  if (route && activeTarget) {
    const percent = clamp(route.progress * 100, 0, 100);
    routeTitle.textContent = `${activeTarget.name} · ${resources[route.cargo].label} ×${route.amount}`;
    routeStatus.textContent = route.phase === 'outbound' ? '货运舱正在前往目标星球' : '已抵达目标星球，正在返航';
    routePhase.textContent = route.phase === 'outbound' ? '去程' : '返航';
    routeTime.textContent = `${Math.ceil((1 - route.progress) * activeTarget.travelTime)} 秒`;
    routeFill.style.width = `${percent}%`;
  } else if (!unlocked) {
    routeTitle.textContent = '星图接入受限';
    routeStatus.textContent = '完成「星际物流」后，才能派遣货运舱。';
    routePhase.textContent = '等待主线科技';
    routeTime.textContent = '--';
    routeFill.style.width = '0%';
  } else {
    routeTitle.textContent = '暂无运行中的航线';
    routeStatus.textContent = target.id === 'home' ? '母星是所有货运舱的出发点。请选择一个远端星球。' : `准备向 ${target.name} 装载货物。`;
    routePhase.textContent = '航线待命';
    routeTime.textContent = '--';
    routeFill.style.width = '0%';
  }
  const launch = query('#launch-route-button');
  const cargoAvailable = storageAmount(cargo.resource) >= cargo.amount;
  launch.disabled = !unlocked || target.id === 'home' || Boolean(route) || !cargoAvailable || target.requires.some(requirement => !isTechUnlocked(requirement));
  query('#launch-route-cost').textContent = !unlocked ? '完成「星际物流」后可用' : route ? '当前货运舱完成后可再次派遣' : `${resources[cargo.resource].label} ×${cargo.amount} · 往返 ${target.travelTime || 0} 秒`;
  const log = query('#route-log');
  log.innerHTML = state.interstellar.log.length
    ? state.interstellar.log.slice().reverse().map(entry => `<div class="route-log-entry"><span class="route-log-dot"></span><span>${entry.message}</span></div>`).join('')
    : '<span class="route-log-empty">暂无航线记录</span>';
  updateStellarProjectUI();
  updateRouteVisual();
}

function renderStarMap() {
  all('[data-planet]').forEach(button => button.onclick = () => {
    state.interstellar.selectedPlanet = button.dataset.planet;
    updateStarMapUI();
  });
  renderCargoOptions();
  updateStarMapUI();
}

function wireOptionalAssetImages() {
  const wireImage = image => {
    const host = image.parentElement;
    const showImage = () => {
      if (!hasImage(image)) return;
      image.hidden = false;
      host.classList.add('has-image');
      host.classList.remove('asset-fallback');
    };
    const hideImage = () => {
      image.hidden = true;
      host.classList.remove('has-image');
      host.classList.add('asset-fallback');
      state.assetFallbacks += 1;
      document.body.dataset.assetFallbacks = String(state.assetFallbacks);
    };
    image.addEventListener('load', showImage);
    image.addEventListener('error', hideImage);
    if (image.complete && image.naturalWidth === 0) hideImage();
    else showImage();
  };
  all('.matrix-icon img, .image-tool img').forEach(wireImage);
  const ship = query('#cargo-ship');
  const shipImage = query('#cargo-ship-image');
  if (ship && shipImage) {
    const showShipImage = () => {
      if (!hasImage(shipImage)) return;
      shipImage.hidden = false;
      ship.classList.add('has-image');
    };
    shipImage.addEventListener('load', showShipImage);
    shipImage.addEventListener('error', () => { shipImage.hidden = true; ship.classList.remove('has-image'); });
    showShipImage();
  }
}

function startResearch(id) {
  const tech = techById[id];
  if (!tech || isTechUnlocked(id)) return;
  if (state.research.current === id) { showToast(`${tech.label} 正在研究中`); return; }
  if (state.research.current && state.research.progress > 0) { showToast('当前研究尚未完成，请先完成它', 'warning'); return; }
  if (!hasTechPrerequisites(tech)) { showToast('主线前置科技尚未完成', 'warning'); return; }
  state.research = { current: id, progress: 0 };
  saveGame();
  showToast(`${tech.label} 研究启动`);
  if (!query('#tech-panel').hidden) renderTechPanel();
}

function formatCost(cost) {
  return Object.entries(cost).map(([resource, amount]) => `${resources[resource]?.label || resource} ${amount}`).join(' · ');
}

function techNodeMarkup(tech, mainline = false) {
  const unlocked = isTechUnlocked(tech.id);
  const available = hasTechPrerequisites(tech);
  const active = state.research.current === tech.id;
  const locked = !unlocked && !available;
  const cube = resources[tech.cube] || { label: tech.cube, color: '#69d8da' };
  const requirement = tech.requires?.length
    ? tech.requires.map(id => techById[id]?.label || id).join(' / ')
    : '基础权限';
  const unlocks = techUnlockText(tech) || '扩展研究权限';
  const upgrades = techUpgradeText(tech);
  const progress = active ? state.research.progress : unlocked ? tech.cost : 0;
  const percent = clamp((progress / tech.cost) * 100, 0, 100);
  const classes = ['tech-node', mainline ? 'mainline-node' : 'branch-node'];
  if (unlocked) classes.push('researched');
  if (active) classes.push('researching');
  if (locked) classes.push('locked');
  return `<button type="button" class="${classes.join(' ')}" data-research="${tech.id}" ${locked || unlocked ? 'disabled' : ''} title="${tech.description}">
    <span class="tech-node-top"><span class="tech-node-code">${mainline ? 'CORE' : 'BRANCH'}</span><span class="tech-node-state">${unlocked ? '已解锁' : active ? '研究中' : locked ? '前置未完成' : '可研究'}</span></span>
    <strong>${tech.label}</strong>
    <span class="tech-node-short">${tech.short}</span>
    <span class="tech-node-detail">${tech.description}</span>
    <span class="tech-node-footer"><span class="cube-key" style="--cube-color:${cube.color}">${cube.label} ×${tech.cost}</span><span>${unlocks}</span>${upgrades ? `<span class="tech-node-upgrade">${upgrades}</span>` : ''}<span class="tech-node-effect">${tech.effectText || '扩展研究权限'}</span></span>
    <span class="tech-node-requirement">前置：${requirement}</span>
    <span class="tech-node-progress"><i style="width:${percent}%"></i></span>
    <span class="tech-node-action">${unlocked ? '研究完成' : active ? '正在消耗矩阵' : locked ? '等待前置' : '开始研究'}</span>
  </button>${mainline ? '<span class="tech-link" aria-hidden="true"></span>' : ''}`;
}

function renderTechPanel() {
  query('#mainline-tech').innerHTML = techTree.mainline.map(tech => techNodeMarkup(tech, true)).join('');
  query('#branch-tech').innerHTML = techTree.branches.map(tech => techNodeMarkup(tech)).join('');
  all('[data-research]').forEach(button => button.addEventListener('click', () => startResearch(button.dataset.research)));
  updateResearchUI();
}

function updateResearchUI() {
  const tech = researchTarget();
  const labs = state.buildings.filter(building => building.type === 'researchLab' && isBuildingOperational(building)).length;
  const currentProgress = tech ? clamp(state.research.progress, 0, tech.cost) : 0;
  const percent = tech ? clamp((currentProgress / tech.cost) * 100, 0, 100) : 0;
  const cube = tech ? resources[tech.cube] : null;
  const available = tech ? storageAmount(tech.cube) : 0;
  const diagnostic = getFactoryDiagnostic();
  const currentResearchDiagnostic = state.research.current && diagnostic.kind === 'research' ? diagnostic : null;
  const panelDiagnostic = diagnostic.kind === 'complete' ? null : diagnostic;
  const status = !tech
    ? (labs ? '科研网络待命' : '需要部署科研站')
    : !labs
      ? '等待科研站接入'
        : currentResearchDiagnostic
          ? currentResearchDiagnostic.title
      : available <= 0
        ? `等待 ${cube.label}`
        : `研究中 · ${labs} 座科研站`;
  query('#research-name').textContent = tech?.label || '选择研究目标';
  query('#research-status').textContent = status;
  query('#research-progress-label').textContent = tech ? `${formatNumber(currentProgress)} / ${tech.cost}` : '0 / 0';
  query('#research-rate').textContent = `矩阵 ${state.researchRate.toFixed(2)} / 秒`;
  query('#research-progress-fill').style.width = `${percent}%`;
  query('#research-cube-label').textContent = tech ? `${cube.label} · 消耗 ${tech.cost}` : '研究矩阵待命';
  query('#research-supply-label').textContent = tech ? `库存 ${formatNumber(available)}` : '库存 0';
  query('#brief-research-name').textContent = tech?.label || '科研网络待命';
  query('#brief-research-cube').textContent = tech ? `${cube.label} · ${labs ? '自动推进' : '等待科研站'}` : '未选择矩阵';
  query('#brief-research-value').textContent = tech ? `${Math.floor(percent)}%` : '0%';
  query('#brief-research-fill').style.width = `${percent}%`;
  query('#research-diagnostic-text').textContent = panelDiagnostic ? `${panelDiagnostic.title} · ${panelDiagnostic.text}` : tech ? '科研输入和矩阵库存会在这里同步诊断。' : '科研链待命';
  const diagnosticAction = query('#research-diagnostic-action');
  diagnosticAction.hidden = !panelDiagnostic?.action;
  diagnosticAction.textContent = panelDiagnostic?.action || '处理缺口';
  query('#tech-button-state').textContent = tech ? `研究 ${Math.floor(percent)}%` : `${state.tech.filter(id => techTree.mainline.some(node => node.id === id)).length}/${techTree.mainline.length}`;
  query('#mainline-count').textContent = `${techTree.mainline.filter(node => isTechUnlocked(node.id)).length} / ${techTree.mainline.length}`;
  query('#branch-count').textContent = `${techTree.branches.filter(node => isTechUnlocked(node.id)).length} / ${techTree.branches.length}`;
  all('[data-matrix]').forEach(item => {
    const resource = item.dataset.matrix;
    item.classList.toggle('matrix-active', tech?.cube === resource);
    const counter = query(`#matrix-${resource}`);
    if (counter) counter.textContent = formatNumber(storageAmount(resource));
  });
  all('[data-research]').forEach(button => {
    const node = techById[button.dataset.research];
    const unlocked = isTechUnlocked(node.id);
    const active = state.research.current === node.id;
    const locked = !unlocked && !hasTechPrerequisites(node);
    button.classList.toggle('researched', unlocked);
    button.classList.toggle('researching', active);
    button.classList.toggle('locked', locked);
    button.disabled = unlocked || locked;
    const action = button.querySelector('.tech-node-action');
    if (action) action.textContent = unlocked ? '研究完成' : active ? '正在消耗矩阵' : locked ? '等待前置' : '开始研究';
  });
}

function toggleTechPanel(force) {
  const panel = query('#tech-panel');
  const open = typeof force === 'boolean' ? force : panel.hidden;
  panel.hidden = !open;
  if (open) {
    query('#star-map-panel').hidden = true;
    query('#career-panel').hidden = true;
    query('#craft-panel').hidden = true;
    renderTechPanel();
  }
}

function toggleStarMap(force) {
  const panel = query('#star-map-panel');
  const open = typeof force === 'boolean' ? force : panel.hidden;
  panel.hidden = !open;
  if (open) {
    query('#tech-panel').hidden = true;
    query('#career-panel').hidden = true;
    query('#craft-panel').hidden = true;
    renderStarMap();
  }
}

function getItemPoint(item) {
  const belt = state.belts.find(entry => entry.id === item.beltId);
  if (!belt) return null;
  const travel = Math.min(belt.length - 1, item.progress * (belt.length - 1));
  return worldToScreen(belt.x + belt.dx * travel + .5, belt.y + belt.dy * travel + .5);
}

function drawItems() {
  state.items.forEach(item => {
    const point = getItemPoint(item);
    if (!point) return;
    const meta = resources[item.resource] || { color: '#c7d94c' };
    const color = meta.color;
    const itemSize = clamp(15 * state.zoom * (1 + Math.sin(state.animTime * 5 + item.progress * 6) * .06), 8, 18);
    ctx.fillStyle = color;
    ctx.shadowColor = color; ctx.shadowBlur = 10;
    if (hasImage(assets[meta.image])) {
      ctx.drawImage(assets[meta.image], point.x - itemSize / 2, point.y - itemSize / 2, itemSize, itemSize);
    } else {
      drawResourceGlyph(item.resource, point.x, point.y, itemSize, .95);
    }
    ctx.shadowBlur = 0;
  });
}

function drawFactorySignals() {
  state.powerGrids.forEach((grid, gridIndex) => {
    const color = powerGridColor(grid);
    const members = new Map(grid.buildings.map(building => [building.id, building]));
    grid.links.forEach((link, linkIndex) => {
      const left = members.get(link.left);
      const right = members.get(link.right);
      if (!left || !right) return;
      const leftCenter = buildingCenter(left);
      const rightCenter = buildingCenter(right);
      const start = worldToScreen(leftCenter.x, leftCenter.y);
      const end = worldToScreen(rightCenter.x, rightCenter.y);
      ctx.save();
      ctx.strokeStyle = `${color}38`;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 8]);
      ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y); ctx.stroke();
      ctx.setLineDash([]);
      if (grid.blackout) { ctx.restore(); return; }
      const pulse = (state.animTime * .7 + gridIndex * .33 + linkIndex * .17) % 1;
      const pulsePoint = { x: start.x + (end.x - start.x) * pulse, y: start.y + (end.y - start.y) * pulse };
      ctx.fillStyle = `${color}aa`;
      ctx.shadowColor = color; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(pulsePoint.x, pulsePoint.y, Math.max(1.1, state.zoom * 1.4), 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });
  });
}

function powerGridColor(grid) {
  if (!grid) return '#ee6a65';
  if (grid.blackout) return '#ee6a65';
  if (grid.highLoad) return '#ff9b3d';
  return '#69d8da';
}

function drawPowerCoverage(building, preview = false) {
  if (!isPowerTowerType(building)) return;
  const point = worldToScreen(buildingCenter(building).x, buildingCenter(building).y);
  const radius = getTransmissionRange(building) * TILE * state.zoom;
  const grid = state.powerGrids.find(entry => entry.buildingIds.includes(building.id));
  const color = preview ? buildings[building.type].color : powerGridColor(grid);
  ctx.save();
  ctx.globalAlpha = preview ? .12 : .1;
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(point.x, point.y, radius, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = preview ? .7 : .72;
  ctx.strokeStyle = building.gridEnabled === false ? '#8d9aa4' : color;
  ctx.lineWidth = Math.max(1, state.zoom * (preview ? 1.1 : 1.35));
  ctx.setLineDash(building.gridEnabled === false ? [7, 6] : [4, 4]);
  ctx.beginPath(); ctx.arc(point.x, point.y, radius, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawPowerNetworks() {
  const selected = state.buildings.find(building => building.id === state.selectedId);
  if (!selected || !isPowerBuilding(selected)) return;
  const grid = state.powerGrids.find(entry => entry.buildingIds.includes(selected.id));
  if (!grid) return;
  const members = new Map(grid.buildings.map(building => [building.id, building]));
  const color = powerGridColor(grid);
  ctx.save();
  ctx.globalAlpha = .7;
  ctx.lineWidth = Math.max(1, state.zoom * 1.1);
  ctx.setLineDash([3, 6]);
  grid.links.forEach(link => {
    const left = members.get(link.left);
    const right = members.get(link.right);
    if (!left || !right) return;
    const leftPoint = buildingCenter(left);
    const rightPoint = buildingCenter(right);
    const leftScreen = worldToScreen(leftPoint.x, leftPoint.y);
    const rightScreen = worldToScreen(rightPoint.x, rightPoint.y);
    ctx.strokeStyle = color;
    ctx.beginPath(); ctx.moveTo(leftScreen.x, leftScreen.y); ctx.lineTo(rightScreen.x, rightScreen.y); ctx.stroke();
  });
  ctx.setLineDash([]);
  ctx.restore();
  if (isPowerTowerType(selected)) drawPowerCoverage(selected);
}

function drawPreview() {
  const cell = state.pointer.cell;
  if (!cell) return;
  if (state.tool === 'inspect') return;
  if (state.tool === 'sorter') {
    drawSorterPreview();
    return;
  }
  if (state.tool === 'belt') {
    const source = state.pointer.startBuildingId
      ? state.buildings.find(building => building.id === state.pointer.startBuildingId)
      : null;
    const target = source ? findBuildingAt(cell) : null;
    const segments = source && target && target.id !== source.id
      ? beltPortsBetweenBuildings(source, target).segments
      : beltSegmentsBetween(state.pointer.startCell || cell, beltPreviewEnd(cell));
    segments?.forEach(segment => drawBelt(segment, true));
    return;
  }
  if (state.tool === 'demolish') {
    const point = worldToScreen(cell.x, cell.y);
    ctx.strokeStyle = '#ee6a65'; ctx.fillStyle = 'rgba(238,106,101,.14)'; ctx.lineWidth = 2;
    ctx.fillRect(point.x, point.y, TILE * state.zoom, TILE * state.zoom); ctx.strokeRect(point.x + 2, point.y + 2, TILE * state.zoom - 4, TILE * state.zoom - 4);
    return;
  }
  const meta = buildings[state.tool];
  const check = placementCheck(state.tool, cell);
  const point = worldToScreen(cell.x, cell.y);
  const size = meta.size * TILE * state.zoom;
  if (isPowerTowerType(state.tool)) {
    drawPowerCoverage({ type: state.tool, x: cell.x, y: cell.y, id: `preview-${state.tool}`, gridEnabled: true }, true);
  }
  const footprint = footprintCells(cell, meta.size);
  const cellColor = check.valid ? meta.color : check.reasonCode === 'terrain' ? '#ff9b3d' : '#ee6a65';
  ctx.save();
  const gap = clamp(state.zoom * 3, 1, 3);
  footprint.forEach(footprintCell => {
    const tilePoint = worldToScreen(footprintCell.x, footprintCell.y);
    const issue = !isInsideWorld(footprintCell)
      ? 'bounds'
      : buildingCollisionAt(footprintCell, 1)
        ? 'building'
        : beltAt(footprintCell)
          ? 'belt'
          : isTerrainBlocked(footprintCell)
            ? 'terrain'
            : resourceNodeAt(footprintCell) ? 'resource' : null;
    const tileColor = issue === 'terrain' ? '#ff9b3d' : issue === 'resource' ? '#f4b04d' : issue ? '#ee6a65' : cellColor;
    ctx.globalAlpha = issue ? .56 : .36;
    ctx.fillStyle = `${tileColor}36`;
    ctx.strokeStyle = tileColor;
    ctx.lineWidth = Math.max(1, state.zoom * 1.7);
    ctx.setLineDash([4, 3]);
    ctx.fillRect(tilePoint.x + gap, tilePoint.y + gap, TILE * state.zoom - gap * 2, TILE * state.zoom - gap * 2);
    ctx.strokeRect(tilePoint.x + gap, tilePoint.y + gap, TILE * state.zoom - gap * 2, TILE * state.zoom - gap * 2);
    if (issue) {
      ctx.globalAlpha = .82;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(tilePoint.x + size / meta.size * .28, tilePoint.y + size / meta.size * .28);
      ctx.lineTo(tilePoint.x + size / meta.size * .72, tilePoint.y + size / meta.size * .72);
      ctx.moveTo(tilePoint.x + size / meta.size * .72, tilePoint.y + size / meta.size * .28);
      ctx.lineTo(tilePoint.x + size / meta.size * .28, tilePoint.y + size / meta.size * .72);
      ctx.stroke();
      if (issue === 'resource') {
        ctx.beginPath();
        ctx.arc(tilePoint.x + (TILE * state.zoom) / 2, tilePoint.y + (TILE * state.zoom) / 2, Math.max(3, TILE * state.zoom * .11), 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  });
  ctx.restore();
  if (check.valid && hasImage(assets[meta.image])) {
    ctx.save();
    ctx.globalAlpha = .28;
    ctx.translate(point.x + size / 2, point.y + size / 2);
    ctx.rotate((state.rotation * Math.PI) / 180);
    ctx.drawImage(assets[meta.image], -size * .44, -size * .44, size * .88, size * .88);
    ctx.restore();
  }
}

function render() {
  drawGround();
  drawDysonConstruction();
  state.nodes.forEach(drawResourceNode);
  state.belts.forEach(belt => drawBelt(belt));
  drawPowerNetworks();
  drawFactorySignals();
  state.buildings.forEach(drawBuilding);
  state.nodes.forEach(drawResourceNodeCore);
  drawBeltPortHints();
  drawItems();
  drawPreview();
}

function hasBeltToBuilding(target, resourcesToCheck) {
  return resourcesToCheck.some(resource => Boolean(findSorterForBuilding(target, resource, 'input')));
}

function hasWarehouseRoute(target, resourcesToCheck) {
  if (!target) return false;
  return resourcesToCheck.some(resource => storageBuildings().some(storage => {
    const sorter = findSorterForBuilding(storage, resource, 'output');
    return Boolean(sorter && sorterOutputBelts(sorter).some(belt => findDestinationAlongRoute(belt, resource, sorter.id)));
  }));
}

function hasInputRouteToBuilding(target, resource) {
  return Boolean(target && findSorterForBuilding(target, resource, 'input'));
}

function processorProductionGap() {
  const producer = state.buildings.find(building => ['assembler', 'workbench'].includes(building.type));
  if (!producer) return { kind: 'assembler', output: 'processor' };
  const inputs = producer.type === 'workbench' ? ['ironIngot', 'copperIngot'] : ['copperIngot', 'siliconWafer'];
  // A route can be valid while its first batch is already in the machine.
  // Prefer the live input buffer so the assistant follows the next real gap.
  const missingInput = inputs.find(resource => (producer.input?.[resource] || 0) < 1 && !hasInputRouteToBuilding(producer, resource));
  if (missingInput) {
    const raw = rawResourceForInput(missingInput);
    // Older saves did not bind a smelter to a node. The recipe is the
    // authoritative source in that case, so the task assistant can still
    // center the correct upstream machine for the player.
    const source = raw && state.buildings.find(building => building.type === 'smelter'
      && (building.recipeResource === raw || state.nodes.find(node => node.id === building.nodeId)?.resource === raw));
    return { kind: 'assemblerInputBelt', producer, source, resource: missingInput, output: 'processor' };
  }
  if (!findBeltStartingNear(producer, 'processor')) return { kind: 'assemblerOutputBelt', producer, output: 'processor' };
  return null;
}

function findUnconfiguredSmelter(raw) {
  const miner = state.buildings.find(building => building.type === 'miner'
    && state.nodes.find(node => node.id === building.nodeId)?.resource === raw);
  const candidates = state.buildings.filter(building => building.type === 'smelter'
    && !building.recipeResource
    && !Object.values(building.input || {}).some(amount => amount > 0)
    && !Object.values(building.output || {}).some(amount => amount > 0));
  if (!candidates.length) return null;
  if (!miner) return candidates[0];
  const minerCenter = buildingCenter(miner);
  return candidates.slice().sort((left, right) => {
    const leftCenter = buildingCenter(left);
    const rightCenter = buildingCenter(right);
    const leftDistance = Math.abs(leftCenter.x - minerCenter.x) + Math.abs(leftCenter.y - minerCenter.y);
    const rightDistance = Math.abs(rightCenter.x - minerCenter.x) + Math.abs(rightCenter.y - minerCenter.y);
    return leftDistance - rightDistance;
  })[0];
}

function dockCategoryForTool(tool) {
  return dockCategoryByTool[tool] || 'extract';
}

function setDockCategory(category) {
  const nextCategory = dockCategories.has(category) ? category : 'extract';
  state.dockCategory = nextCategory;
  all('.dock-category-button').forEach(button => {
    const active = button.dataset.dockCategory === nextCategory;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
  all('.tool-button').forEach(button => {
    button.hidden = button.dataset.dockCategory !== nextCategory;
  });
}

function updateDock() {
  setDockCategory(state.dockCategory || 'extract');
}

function updateGoalPanel(diagnostic = getFactoryDiagnostic()) {
  const panel = query('#goal-panel');
  if (!panel) return;
  const phaseLabels = { mining: '落地阶段', smelting: '工业阶段', power: '能源阶段', research: '科研阶段', interstellar: '远征阶段', stellar: '恒星工程', complete: '能源网络' };
  const phase = phaseLabels[diagnostic.stage] || '当前阶段';
  query('#goal-phase-label').textContent = phase;
  query('#goal-current-title').textContent = diagnostic.title;
  query('#goal-current-text').textContent = diagnostic.text;
  query('#goal-current-fill').style.width = `${diagnostic.progress}%`;
  query('#goal-current-progress').textContent = `${Math.round(diagnostic.progress)}% 完成`;
  query('#goal-current-action').textContent = diagnostic.action || '查看工厂';
  query('#goal-button-state').textContent = phase.replace('阶段', '');
}

function toggleGoalPanel(force) {
  const panel = query('#goal-panel');
  const open = typeof force === 'boolean' ? force : panel.hidden;
  panel.hidden = !open;
  if (open) {
    query('#tech-panel').hidden = true;
    query('#star-map-panel').hidden = true;
    query('#career-panel').hidden = true;
    query('#craft-panel').hidden = true;
    updateGoalPanel();
  }
}

function updateObjective() {
  const diagnostic = getFactoryDiagnostic();
  const snapshot = factoryProgressSnapshot();
  const title = query('#objective-title');
  const text = query('#objective-text');
  const fill = query('#objective-fill');
  const phaseLabels = { mining: '落地阶段', smelting: '工业阶段', power: '能源阶段', research: '科研阶段', interstellar: '远征阶段', stellar: '恒星工程', complete: '能源网络' };
  title.textContent = diagnostic.title;
  text.textContent = diagnostic.text;
  fill.style.width = `${diagnostic.progress}%`;
  query('#objective-stage').textContent = phaseLabels[diagnostic.stage] || '当前阶段';
  query('#objective-progress-label').textContent = `${Math.round(diagnostic.progress)}%`;
  query('#objective-action').textContent = diagnostic.action || '查看工厂';
  const steps = [
    { label: '采矿', done: snapshot.hasMiner },
    { label: '加工', done: snapshot.hasSmelter && snapshot.hasProcessingLink },
    { label: '科研', done: snapshot.hasResearchLab && snapshot.hasResearchLink && snapshot.hasFirstResearch },
    { label: '星际', done: isInterstellarUnlocked() && snapshot.hasFirstTrip },
    { label: '恒星工程', done: isTechUnlocked('dyson-frame') && state.stellarProject.progress >= 100 }
  ];
  query('#objective-steps').innerHTML = steps.map(step => `<span class="objective-step${step.done ? ' done' : ''}"><i>${step.done ? '✓' : '·'}</i>${step.label}</span>`).join('');
  query('#objective-action').dataset.action = diagnostic.action || '查看设施';
  updateGoalPanel(diagnostic);
}

function buildingRecipeText(building) {
  if (isStorageType(building)) return `${building.type === 'logisticsStation' ? '星际货物中转' : `${storageFormOf(building) === 'solid' ? '固体' : storageFormOf(building) === 'liquid' ? '液体' : '气体'}仓储`} · ${storageUsed(building)}/${storageCapacity(building)}`;
  if (building.type === 'miner') {
    const node = state.nodes.find(item => item.id === building.nodeId);
    return node ? `${resources[node.resource].label}矿脉 → ${resources[node.resource].label}` : '矿脉 → 原矿';
  }
  if (building.type === 'oilExtractor') return '原油渗流 → 原油';
  if (building.type === 'waterPump') return '水源采集区 → 水';
  if (building.type === 'gasExtractor') return '天然气田 → 天然气';
  if (building.type === 'smelter') return '原矿 → 金属锭 / 硅片';
  if (building.type === 'assembler') return '铜锭 + 硅片 → 芯片';
  if (building.type === 'workbench') return '铁锭 + 铜锭 → 芯片';
  if (building.type === 'researchLab') {
    const cube = labProductionCube(building);
    const recipe = cubeRecipes[cube];
    return recipe ? `${building.researchMode === 'auto' ? '自动 · ' : ''}${formatRecipeInputs(recipe.inputs)} → ${recipe.label}` : '等待研究目标';
  }
  if (building.type === 'thermal') return '煤 → 电力';
  if (building.type === 'wind') return '风场 → 电力';
  if (isPowerTowerType(building)) return `${building.gridEnabled === false ? '局部覆盖 · 外部断开' : '圆形覆盖 · 外部接入'} · ${getTransmissionRange(building).toFixed(1)} 格`;
  if (building.type === 'sorter') {
    const target = sorterAttachedBuilding(building);
    return `${building.sorterMode === 'output' ? '建筑 → 传送带' : '传送带 → 建筑'} · ${target ? buildings[target.type].label : '未连接建筑'}`;
  }
  return '系统节点';
}

function buildingStatus(building) {
  if (!isBuildingOperational(building)) return '科技锁定';
  if (building.type === 'thermal' && (building.input.coal || 0) <= 0) return '缺煤';
  const powerState = getGridPowerState(building);
  if (isPowerTowerType(building)) {
    if (!powerState.grid) return '未接入电网';
    if (powerState.grid.blackout) return '电网瘫痪';
    return building.gridEnabled === false ? '外部连接已断开' : '输电在线';
  }
  if (isPowerBuilding(building) && powerState.grid?.blackout && (buildings[building.type]?.power || 0) > 0) return '电网瘫痪';
  if (isPowerBuilding(building) && powerState.grid?.highLoad && (buildings[building.type]?.power || 0) > 0) return '电网高负载';
  if (building.type === 'wind') return '供电中';
  if (building.type === 'thermal') return '供电中';
  if (building.type === 'waterPump') {
    const node = state.nodes.find(item => item.id === building.nodeId);
    return node?.resource === 'water' && node.amount > 0 ? '采水中' : '未接入水源';
  }
  if (building.type === 'oilExtractor' || building.type === 'gasExtractor') {
    const node = state.nodes.find(item => item.id === building.nodeId);
    const expected = building.type === 'oilExtractor' ? 'crudeOil' : 'naturalGas';
    return node?.resource === expected && node.amount > 0 ? '采集流体' : '未接入资源田';
  }
  if (building.type === 'sorter') {
    const target = sorterAttachedBuilding(building);
    if (!target) return '未连接建筑';
    const beltCount = building.sorterMode === 'output' ? sorterOutputBelts(building).length : sorterInputBelts(building).length;
    if (!beltCount) return '未连接传送带';
    return building.sorterMode === 'output' ? '等待取货' : building.process > .05 ? '取放中' : '等待来料';
  }
  if (isStorageType(building)) {
    if (storageUsed(building) >= storageCapacity(building)) return '仓储已满';
    return storageUsed(building) ? '仓储在线' : '等待入库';
  }
  if (['miner', 'oilExtractor', 'waterPump', 'gasExtractor'].includes(building.type)) {
    const node = state.nodes.find(item => item.id === building.nodeId);
    if (!node) return '未接入矿脉';
    if (node.amount <= 0) return '矿脉耗尽';
    if (Object.values(building.output).reduce((sum, amount) => sum + amount, 0) >= 5) return '输出堵塞';
    return building.timer > .05 ? '采掘中' : '等待脉冲';
  }
  if (building.type === 'researchLab' && !researchTarget()) return '待选择科技';
  if (Object.values(building.output).some(amount => amount > 0)) return '输出堵塞';
  if (building.process > .05) return building.type === 'researchLab' ? '制备矩阵' : '生产中';
  if (Object.values(building.input).some(amount => amount > 0)) return '等待加工';
  return building.type === 'researchLab' ? '等待矩阵组件' : '缺少输入';
}

function buildingProgress(building) {
  if (!isBuildingOperational(building)) return 0;
  if (building.type === 'miner' || building.type === 'oilExtractor') {
    return clamp(building.timer / getMiningTime(building), 0, 1);
  }
  if (building.type === 'smelter') return clamp(building.process / getSmeltingTime(), 0, 1);
  if (building.type === 'assembler' || building.type === 'workbench') return clamp(building.process / getAssemblyTime(building), 0, 1);
  if (building.type === 'sorter') return clamp(building.process / getSorterCycleTime(building), 0, 1);
  if (isStorageType(building)) return clamp(storageUsed(building) / Math.max(1, storageCapacity(building)), 0, 1);
  if (building.type === 'researchLab') {
    const cube = labProductionCube(building);
    return cubeRecipes[cube] ? clamp(building.process / getResearchProductionTime(building, cube), 0, 1) : 0;
  }
  return 0;
}

function missingInputsFor(building) {
  if (!building) return [];
  let recipe = null;
  if (building.type === 'smelter') return Object.values(building.input || {}).some(amount => amount > 0) ? [] : ['原矿'];
  if (building.type === 'assembler') recipe = { inputs: { copperIngot: 1, siliconWafer: 1 } };
  if (building.type === 'workbench') recipe = { inputs: { ironIngot: 1, copperIngot: 1 } };
  if (building.type === 'researchLab') {
    const cube = labProductionCube(building);
    recipe = cubeRecipes[cube];
  }
  if (building.type === 'thermal') recipe = { inputs: { coal: 1 } };
  if (!recipe) return [];
  return Object.entries(recipe.inputs)
    .filter(([resource, amount]) => (building.input?.[resource] || 0) < amount)
    .map(([resource, amount]) => `${resources[resource]?.label || resource} ×${amount - (building.input?.[resource] || 0)}`);
}

function rawResourceForInput(resource) {
  return { copperIngot: 'copper', siliconWafer: 'silicon', ironIngot: 'iron', coal: 'coal' }[resource] || null;
}

function researchMissingRawResource() {
  const lab = state.buildings.find(building => building.type === 'researchLab' && isBuildingOperational(building));
  const cube = lab ? labProductionCube(lab) : researchTarget()?.cube;
  const recipe = cubeRecipes[cube];
  if (!recipe) return null;
  const missing = Object.entries(recipe.inputs).find(([resource, amount]) => {
    if ((lab?.input?.[resource] || 0) >= amount) return false;
    const raw = rawResourceForInput(resource);
    if (!raw) return false;
    return !state.buildings.some(building => building.type === 'miner' && isBuildingOperational(building) && state.nodes.find(node => node.id === building.nodeId)?.resource === raw);
  }) || Object.entries(recipe.inputs).find(([resource, amount]) => (lab?.input?.[resource] || 0) < amount);
  if (!missing) return null;
  const raw = rawResourceForInput(missing[0]);
  if (!raw) return null;
  const hasMiner = state.buildings.some(building => {
    if (building.type !== 'miner' || !isBuildingOperational(building)) return false;
    return state.nodes.find(node => node.id === building.nodeId)?.resource === raw;
  });
  return hasMiner ? null : raw;
}

function researchProductionGap() {
  const lab = state.buildings.find(building => building.type === 'researchLab' && isBuildingOperational(building));
  const cube = lab ? labProductionCube(lab) : researchTarget()?.cube;
  const recipe = cubeRecipes[cube];
  if (!lab || !recipe) return null;
  const missingEntries = Object.entries(recipe.inputs).filter(([resource, amount]) => (lab.input?.[resource] || 0) < amount);
  for (const [resource] of missingEntries) {
    if (storageAmount(resource) >= 1) {
      if (!hasInputRouteToBuilding(lab, resource)) return { kind: 'sorterInput', target: lab, resource };
      continue;
    }
    const raw = rawResourceForInput(resource);
    if (!raw) {
      if (resource === 'processor') return processorProductionGap();
      continue;
    }
    const miner = state.buildings.find(building => building.type === 'miner' && isBuildingOperational(building) && state.nodes.find(node => node.id === building.nodeId)?.resource === raw);
    if (!miner) return { kind: 'miner', raw };
    let smelter = null;
    if (raw !== 'coal') {
      smelter = state.buildings.find(building => building.type === 'smelter' && isBuildingOperational(building)
        && (building.recipeResource === raw || state.nodes.find(node => node.id === building.nodeId)?.resource === raw));
      if (!smelter) {
        const unconfigured = findUnconfiguredSmelter(raw);
        if (unconfigured) return { kind: 'rawToSmelter', raw, miner, smelter: unconfigured };
      }
      if (!smelter) return { kind: 'smelter', raw };
    }
    const rawBelt = state.belts.find(belt => {
      if (!isAdjacentToBuilding({ x: belt.x, y: belt.y }, miner)) return false;
      const destination = findDestinationAlongRoute(belt, raw, miner.id);
      if (!destination) return false;
      if (raw !== 'coal') return destination === smelter;
      return destination === lab;
    });
    if (!rawBelt) return { kind: 'belt', raw, miner, smelter, source: miner };
    if (raw === 'coal') continue;
    const output = raw === 'silicon' ? 'siliconWafer' : `${raw}Ingot`;
    const smelterOutputSorter = findSorterForBuilding(smelter, output, 'output');
    if (!smelterOutputSorter) return { kind: 'sorterOutput', raw, output, smelter };
    const outputBelt = sorterOutputBelts(smelterOutputSorter).find(belt => Boolean(findDestinationAlongRoute(belt, output, smelterOutputSorter.id)));
    if (!outputBelt) return { kind: 'outputBelt', raw, smelter };
    if (storageAmount(output) >= 1 && !hasInputRouteToBuilding(lab, output)) return { kind: 'sorterInput', target: lab, resource: output };
  }
  const matrixOutput = labProductionCube(lab);
  if (!findSorterForBuilding(lab, matrixOutput, 'output')) return { kind: 'sorterOutput', source: lab, output: matrixOutput };
  if (!findBeltStartingNear(lab, matrixOutput)) return { kind: 'researchOutputBelt', source: lab, output: matrixOutput };
  return null;
}

function researchGapAdvice(gap, missing = []) {
  if (!gap) return null;
  const missingText = missing.length ? `科研站还缺 ${missing.join('、')}。` : '';
  if (gap.kind === 'miner') {
    const rawLabel = resources[gap.raw]?.label || gap.raw;
    return {
      title: `部署${rawLabel}矿机`,
      text: `${missingText}把采矿机放在${rawLabel}矿脉上，产线会继续制备科研矩阵。`,
      action: '选择采矿机'
    };
  }
  if (gap.kind === 'rawToSmelter') {
    const rawLabel = resources[gap.raw]?.label || gap.raw;
    return {
      title: `接通${rawLabel}加工`,
      text: `${missingText}从${rawLabel}矿机拖到待配置的冶炼机，让原矿进入加工端。`,
      action: '选择传送带'
    };
  }
  if (gap.kind === 'smelter') {
    const rawLabel = resources[gap.raw]?.label || gap.raw;
    return {
      title: `部署${rawLabel}冶炼机`,
      text: `${missingText}先补一座冶炼机，再把${rawLabel}矿机的原矿接入。`,
      action: '选择熔炼炉'
    };
  }
  if (gap.kind === 'belt') {
    const rawLabel = resources[gap.raw]?.label || gap.raw;
    return {
      title: `接通${rawLabel}矿机`,
      text: `${missingText}从${rawLabel}矿机边缘拖到冶炼机；煤矿可以直接接入火力发电机或科研站。`,
      action: '选择传送带'
    };
  }
  if (gap.kind === 'outputBelt') {
    const rawLabel = resources[gap.raw]?.label || gap.raw;
    const outputLabel = gap.raw === 'silicon' ? '硅片' : `${rawLabel}锭`;
    return {
      title: `接通${outputLabel}产物`,
      text: `${missingText}给冶炼机安装出料分拣器，再把${outputLabel}送入物流仓储，产物才会进入后续配方。`,
      action: '选择传送带'
    };
  }
  if (gap.kind === 'warehouseBelt') {
    const outputLabel = resources[gap.output]?.label || '研究组件';
    return {
      title: `接通仓储出库`,
      text: `${missingText}从物流仓储旁的出料分拣器铺设传送带到科研站进料分拣器，仓储物料才会进入研究链。`,
      action: '选择传送带'
    };
  }
  if (gap.kind === 'sorterInput') {
    const targetLabel = gap.target ? buildings[gap.target.type].label : '建筑';
    const resourceLabel = resources[gap.resource]?.label || gap.resource;
    return {
      title: `给${targetLabel}接入分拣器`,
      text: `${missingText}传送带只负责运输。请在${targetLabel}旁放置分拣器，切换为“传送带 → 建筑”，再把传送带接到分拣器。`,
      action: '选择分拣器'
    };
  }
  if (gap.kind === 'sorterOutput') {
    const sourceLabel = gap.source ? buildings[gap.source.type].label : `${resources[gap.raw]?.label || gap.raw}冶炼机`;
    return {
      title: `给${sourceLabel}安装出料分拣器`,
      text: `${missingText}建筑不会把货物直接放上传送带。请在${sourceLabel}旁放置分拣器，切换为“建筑 → 传送带”。`,
      action: '选择分拣器'
    };
  }
  if (gap.kind === 'researchOutputBelt') {
    const cubeLabel = resources[gap.output]?.label || '研究矩阵';
    return {
      title: '接通矩阵回流',
      text: `${missingText}从科研站安装出料分拣器，把${cubeLabel}送入物流仓储，研究循环才会消费它。`,
      action: '选择传送带'
    };
  }
  if (gap.kind === 'assembler') {
    return {
      title: '部署芯片组装机',
      text: `${missingText}矩阵实验室需要芯片。部署组装机，再把铜锭和硅片接入组装机。`,
      action: '选择组装机'
    };
  }
  if (gap.kind === 'assemblerInputBelt') {
    const inputLabel = resources[gap.resource]?.label || gap.resource;
    return {
      title: `接通${inputLabel}`,
      text: `${missingText}组装机还缺${inputLabel}，从物流仓储或上游生产端接入物料。`,
      action: '选择传送带'
    };
  }
  if (gap.kind === 'assemblerOutputBelt') {
    return {
      title: '接通芯片产物',
      text: `${missingText}给组装机安装出料分拣器，再把芯片送入物流仓储，让它进入科研链。`,
      action: '选择传送带'
    };
  }
  return null;
}

function hasProcessingRoute(miner, resource, smelter) {
  if (!miner || !smelter) return false;
  const outputSorter = findSorterForBuilding(miner, resource, 'output');
  if (!outputSorter) return false;
  return sorterOutputBelts(outputSorter).some(belt => {
    const targetSorter = findDestinationAlongRoute(belt, resource, outputSorter.id);
    return Boolean(targetSorter && sorterAttachedBuilding(targetSorter)?.id === smelter.id);
  });
}

function factoryProgressSnapshot() {
  const hasMiner = state.buildings.some(building => building.type === 'miner' && isBuildingOperational(building));
  const hasSmelter = state.buildings.some(building => building.type === 'smelter' && isBuildingOperational(building));
  const hasResearchLab = state.buildings.some(building => building.type === 'researchLab' && isBuildingOperational(building));
  const miner = state.buildings.find(building => building.type === 'miner' && isBuildingOperational(building));
  const minerNode = miner && state.nodes.find(node => node.id === miner.nodeId);
  const smelter = minerNode && state.buildings.find(building => building.type === 'smelter'
    && isBuildingOperational(building)
    && (!building.recipeResource || building.recipeResource === minerNode.resource));
  const hasProcessingLink = Boolean(miner && minerNode && smelter && hasProcessingRoute(miner, minerNode.resource, smelter));
  const researchLab = state.buildings.find(building => building.type === 'researchLab' && isBuildingOperational(building));
  const researchInputs = Object.keys(cubeRecipes[labProductionCube(researchLab)]?.inputs || {});
  const hasResearchLink = Boolean(researchLab && researchInputs.some(resource => hasInputRouteToBuilding(researchLab, resource)));
  const hasFirstResearch = state.tech.some(id => id !== 'foundation' && techTree.mainline.some(tech => tech.id === id));
  const nextTech = techTree.mainline.find(tech => !isTechUnlocked(tech.id) && hasTechPrerequisites(tech));
  return {
    hasMiner,
    hasSmelter,
    hasProcessingLink,
    hasResearchLab,
    hasResearchLink,
    hasFirstResearch,
    hasFirstTrip: state.interstellar.completedTrips > 0,
    miner,
    minerNode,
    smelter,
    researchLab,
    nextTech
  };
}

function diagnosticFocusBuilding(gap, fallback = null) {
  return gap?.target || gap?.source || gap?.smelter || gap?.producer || gap?.miner || fallback || null;
}

function getFactoryDiagnostic() {
  const snapshot = factoryProgressSnapshot();
  const powerIssue = state.powerSummary.blackoutCount > 0 || state.powerSummary.highLoadCount > 0;
  if (powerIssue) {
    const hasTower = state.buildings.some(building => isPowerTowerType(building));
    const canDeployStarterTower = !hasTower && kitCount('powerTower') > 0;
    const powerTool = canDeployStarterTower
      ? 'powerTower'
      : isBuildingUnlocked('wind') ? 'wind' : isBuildingUnlocked('thermal') ? 'thermal' : null;
    const powerLabel = powerTool ? buildings[powerTool].label : '风能捕获科技';
    const powerText = state.powerSummary.blackoutCount > 0
      ? canDeployStarterTower
        ? `${state.powerSummary.blackoutCount} 个电网已瘫痪。旧产线还没有电力塔，先部署基础电力塔，把设备纳入圆形覆盖范围。`
        : `${state.powerSummary.blackoutCount} 个电网已瘫痪。先断开过载电塔，恢复一个小范围电网，再逐步重新接入。`
      : `${state.powerSummary.highLoadCount} 个电网处于高负载，所有用电设施效率减半。建议增设发电设备或拆分电网。`;
    return {
      kind: 'power', stage: 'power', severity: 'warning', progress: 18,
      title: '稳定电力网络',
      text: `${powerText}${powerTool ? ` 当前可用：${powerLabel}。` : ` 先研究${powerLabel}。`}`,
      action: powerTool ? `选择${powerLabel}` : '打开科技中枢', tool: powerTool
    };
  }
  if (!snapshot.hasMiner) return { kind: 'progress', stage: 'mining', progress: 14, title: '让第一条产线跑起来', text: '先选采矿机，放在铜矿脉上，开始积累原矿。', action: '选择采矿机', focusResource: 'copper' };
  if (!snapshot.hasSmelter) return { kind: 'progress', stage: 'smelting', progress: 28, title: '先放加工端', text: '把熔炼机放在矿机旁边，留出一格或两格作为传送带接口。', action: '选择熔炼炉', focusResource: snapshot.minerNode?.resource || 'copper' };
  if (!snapshot.hasProcessingLink) return { kind: 'progress', stage: 'smelting', progress: 42, title: '用分拣器接通加工端', text: '矿机出料分拣器和熔炼机进料分拣器之间还没有完整路线。', action: '选择分拣器', focusBuilding: snapshot.smelter || snapshot.miner };
  if (!snapshot.hasResearchLab) return { kind: 'progress', stage: 'research', progress: 56, title: '建立科研链', text: '部署科研站和物流仓储，科研站的输入与矩阵产出都必须通过分拣器接入。', action: '选择科研站' };
  if (!snapshot.hasResearchLink) return { kind: 'research', stage: 'research', progress: 64, title: '接通科研站', text: '科研站当前没有有效的进料分拣器。把物流仓储或上游产线接到科研站接口。', action: '选择分拣器', focusBuilding: snapshot.researchLab };

  if (!state.research.current && snapshot.nextTech) {
    const processorGap = snapshot.nextTech.id === 'matrix-lab' ? processorProductionGap() : null;
    if (processorGap) {
      const advice = researchGapAdvice(processorGap);
      if (advice) return { ...advice, kind: 'research', stage: 'research', progress: 66, focusBuilding: diagnosticFocusBuilding(processorGap) };
    }
    return {
      kind: 'research', stage: 'research', progress: 66,
      title: `启动「${snapshot.nextTech.label}」`,
      text: `打开科技中枢，点击可研究节点；科研站会消耗${resources[snapshot.nextTech.cube].label}推进主线。`,
      action: '打开科技中枢'
    };
  }

  if (state.research.current) {
    const missing = missingInputsFor(snapshot.researchLab);
    const gap = researchProductionGap();
    const advice = researchGapAdvice(gap, missing);
    if (advice) return { ...advice, kind: 'research', stage: 'research', progress: 74, focusBuilding: diagnosticFocusBuilding(gap, snapshot.researchLab), focusResource: gap?.kind === 'miner' ? gap.raw : null };
    if (missing.length) return {
      kind: 'research', stage: 'research', progress: 74,
      title: '补齐科研输入', text: `科研站还缺 ${missing.join('、')}；输入齐备后，当前科技会自动继续。`,
      action: '选择分拣器', focusBuilding: snapshot.researchLab
    };
    const tech = researchTarget();
    return {
      kind: 'research', stage: 'research', progress: 74,
      title: `供给${resources[tech?.cube]?.label || '研究矩阵'}`,
      text: `对应原料会在科研站制备成${resources[tech?.cube]?.label || '研究矩阵'}，完成后自动进入研究库存。`,
      action: '打开科技中枢'
    };
  }
  if (!isInterstellarUnlocked()) return { kind: 'progress', stage: 'interstellar', progress: 82, title: '接入星际物流', text: '继续完成主线科技，星图会在「星际物流」完成后解锁。', action: '查看主线科技' };
  if (!snapshot.hasFirstTrip) return { kind: 'progress', stage: 'interstellar', progress: 90, title: '完成第一次异星航次', text: '打开星图，选择熔火-β，装载处理器并派遣货运舱。', action: '打开星图' };
  if (!isTechUnlocked('stellar-network')) return { kind: 'progress', stage: 'stellar', progress: 95, title: '扩展恒星网络', text: '把钛和科研矩阵带回母星，继续研究恒星网络。', action: '打开科技中枢' };
  if (!isTechUnlocked('dyson-frame')) return { kind: 'progress', stage: 'stellar', progress: 97, title: '研究戴森框架', text: '用信息矩阵和结构矩阵完成主线研究，开启恒星工程施工台。', action: '打开科技中枢' };
  if (state.stellarProject.progress < 100) return { kind: 'progress', stage: 'stellar', progress: 97 + state.stellarProject.progress * .03, title: `部署恒星框架 · ${state.stellarProject.progress}%`, text: '从熔火-β回收钛，用结构矩阵和处理器逐个部署轨道组件。', action: '打开星图' };
  return { kind: 'complete', stage: 'complete', progress: 100, title: '第一圈戴森框架已点亮', text: '恒星能量网络已经建立，继续扩展将进入下一阶段。', action: '打开星图' };
}

function updateFactoryMonitor() {
  const activeBuildings = state.buildings.filter(isBuildingActive).length;
  const diagnostic = getFactoryDiagnostic();
  const status = diagnostic.severity === 'warning'
    ? '电力紧张'
    : state.interstellar.route ? '星际联机'
      : diagnostic.stage === 'research' ? '科研推进'
        : diagnostic.kind === 'complete' ? '恒星工程'
          : activeBuildings ? '生产运行' : '待命';
  query('#monitor-status').textContent = status;
  query('#monitor-status').className = diagnostic.severity === 'warning' ? 'monitor-state-warning' : state.interstellar.route ? 'monitor-state-route' : '';
  query('#monitor-buildings').textContent = `${activeBuildings}/${state.buildings.length}`;
  query('#monitor-items').textContent = formatNumber(state.items.length);
  query('#monitor-trips').textContent = formatNumber(state.interstellar.completedTrips);
  query('#monitor-advice-text').textContent = diagnostic.title;
  const action = query('#monitor-advice-action');
  action.hidden = !diagnostic.action;
  action.textContent = diagnostic.action || '执行建议';
}

function renderCareerPanel() {
  const host = query('#career-grid');
  if (!host) return;
  const pending = state.pendingCareer || state.career || 'logistics';
  host.innerHTML = Object.values(careerCatalog).map(career => {
    const selected = career.id === pending;
    const current = career.id === state.career;
    return `<button type="button" class="career-card${selected ? ' selected' : ''}${current ? ' current' : ''}" data-career="${career.id}" ${state.careerChosen && !current ? 'disabled' : ''} style="--career-accent:${career.accent}">
      <span class="career-card-portrait"><img src="godot_game/assets/generated/${career.image}" alt="" /></span>
      <span class="career-card-copy"><strong>${career.label}</strong><small>${career.summary}</small><b>${career.bonus}</b><em>${career.detail}</em></span>
      <span class="career-card-state">${current ? '当前职业' : selected ? '待确认' : '选择'}</span>
    </button>`;
  }).join('');
  all('[data-career]').forEach(button => button.addEventListener('click', () => {
    if (state.careerChosen) return;
    state.pendingCareer = button.dataset.career;
    renderCareerPanel();
  }));
  const confirm = query('#career-confirm');
  confirm.disabled = state.careerChosen || !state.pendingCareer;
  confirm.textContent = state.careerChosen ? '职业已锁定' : '确认职业';
  query('#career-panel-note').textContent = state.careerChosen ? `当前职业：${careerLabel()} · 职业在本地工厂档案中生效。` : '选择一个职业后，增益会写入本地工厂档案。';
}

function renderSorterRouting(building) {
  const panel = query('#sorter-routing');
  const rulesHost = query('#sorter-routing-rules');
  if (!panel || !rulesHost) return;
  if (!building || building.type !== 'sorter' || (building.sorterMode || 'input') !== 'output') {
    panel.hidden = true;
    state.sorterRoutingSignature = '';
    return;
  }
  const outputs = sorterOutputBelts(building);
  const rules = building.sorterRules || {};
  const signature = `${building.id}|${outputs.map(belt => belt.id).join(',')}|${JSON.stringify(rules)}|${Object.keys(building.input || {}).join(',')}`;
  if (state.sorterRoutingSignature === signature) return;
  state.sorterRoutingSignature = signature;
  panel.hidden = false;
  query('#sorter-routing-status').textContent = outputs.length
    ? `${outputs.length} 个出口 · 未配置物料自动寻找可用路线`
    : '先从分拣器边缘铺设输出传送带';
  const visibleResources = [...new Set([
    ...sorterRouteCatalog,
    ...Object.keys(building.input || {}),
    ...Object.keys(building.output || {}),
    ...Object.keys(rules)
  ])].filter(resource => resources[resource]);
  rulesHost.innerHTML = visibleResources.map(resource => {
    const selected = rules[resource] || '';
    const options = outputs.map((belt, index) => `<option value="${escapeHtml(belt.id)}"${selected === belt.id ? ' selected' : ''}>${escapeHtml(sorterOutputLabel(building, belt, index))}</option>`).join('');
    return `<label class="sorter-rule-row"><span>${escapeHtml(resources[resource].label)}</span><select data-sorter-resource="${escapeHtml(resource)}"><option value="">自动选择</option>${options}</select></label>`;
  }).join('');
}

function confirmCareer() {
  if (state.careerChosen || !careerCatalog[state.pendingCareer]) return;
  state.career = state.pendingCareer;
  state.careerChosen = true;
  saveGame();
  toggleCareerPanel(false);
  showToast(`${careerLabel()} 已接入指挥系统`);
  updateHUD();
}

function toggleCareerPanel(force) {
  const panel = query('#career-panel');
  const open = typeof force === 'boolean' ? force : panel.hidden;
  panel.hidden = !open;
  if (open) {
    query('#tech-panel').hidden = true;
    query('#star-map-panel').hidden = true;
    query('#craft-panel').hidden = true;
    renderCareerPanel();
  }
}

function renderCraftPanel() {
  const host = query('#craft-recipes');
  if (!host) return;
  const materialSummary = ['iron', 'copper', 'silicon'].map(resource => `${resources[resource].label} ${formatNumber(state.inventory[resource] || 0)}`).join(' · ');
  const kitSummary = handcraftRecipes
    .filter(recipe => recipe.outputType === 'kit' && kitCount(recipe.output) > 0)
    .map(recipe => `${recipe.label} ${kitCount(recipe.output)}`)
    .join(' · ') || '暂无可用建筑';
  query('#craft-material-summary').textContent = materialSummary;
  query('#craft-kit-summary').textContent = kitSummary;
  host.innerHTML = handcraftRecipes.map(recipe => {
    const cost = craftCost(recipe);
    const techLocked = recipe.tech && !isTechUnlocked(recipe.tech);
    const available = !techLocked && canAfford(cost);
    const owned = recipe.outputType === 'kit' ? kitCount(recipe.output) : state.inventory[recipe.output] || 0;
    return `<button class="craft-recipe" data-craft="${recipe.id}" ${available ? '' : 'disabled'}>
      <span class="craft-recipe-icon">${recipe.output === 'belt' ? '╱╲' : recipe.output === 'sorter' ? '⇥' : '⌁'}</span>
      <span class="craft-recipe-copy"><b>${recipe.label}</b><small>${recipe.description}</small><em>${techLocked ? `需要 ${techById[recipe.tech]?.label || '科技'}` : `消耗 ${formatCost(cost)}`}</em></span>
      <span class="craft-recipe-output"><strong>${recipe.outputLabel}</strong><small>现有 ${owned}</small></span>
    </button>`;
  }).join('');
}

function toggleCraftPanel(force) {
  const panel = query('#craft-panel');
  const open = typeof force === 'boolean' ? force : panel.hidden;
  panel.hidden = !open;
  if (open) {
    query('#tech-panel').hidden = true;
    query('#star-map-panel').hidden = true;
    query('#career-panel').hidden = true;
    renderCraftPanel();
  }
}

function updateHUD() {
  const hours = Math.floor(state.time / 3600) % 24;
  const minutes = Math.floor(state.time / 60) % 60;
  query('#game-clock').textContent = `DAY 001 · ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  query('#career-label').textContent = careerLabel();
  query('#career-button img').src = `godot_game/assets/generated/${state.career ? activeCareer().image : careerCatalog.logistics.image}`;
  query('#count-iron').textContent = formatNumber((state.inventory.iron || 0) + storageAmount('iron'));
  query('#count-copper').textContent = formatNumber((state.inventory.copper || 0) + storageAmount('copper'));
  query('#count-silicon').textContent = formatNumber((state.inventory.silicon || 0) + storageAmount('silicon'));
  query('#count-coal').textContent = formatNumber((state.inventory.coal || 0) + storageAmount('coal'));
  query('#count-crudeOil').textContent = formatNumber((state.inventory.crudeOil || 0) + storageAmount('crudeOil'));
  query('#count-water').textContent = formatNumber((state.inventory.water || 0) + storageAmount('water'));
  query('#count-naturalGas').textContent = formatNumber((state.inventory.naturalGas || 0) + storageAmount('naturalGas'));
  query('#count-processor').textContent = formatNumber((state.inventory.processor || 0) + storageAmount('processor'));
  query('#count-titanium').textContent = formatNumber((state.inventory.titanium || 0) + storageAmount('titanium'));
  const totalLoadRatio = state.powerGeneration > POWER_EPSILON ? state.powerLoad / state.powerGeneration : state.powerLoad > 0 ? Number.POSITIVE_INFINITY : 0;
  const gridIssues = [];
  if (state.powerSummary.blackoutCount > 0) gridIssues.push(`瘫痪 ${state.powerSummary.blackoutCount}`);
  if (state.powerSummary.highLoadCount > 0) gridIssues.push(`高负载 ${state.powerSummary.highLoadCount}`);
  const gridStatus = state.powerSummary.gridCount === 0
    ? '未接入电网'
    : `${state.powerSummary.gridCount} 个电网 · ${gridIssues.length ? gridIssues.join(' · ') : `负载 ${Number.isFinite(totalLoadRatio) ? Math.round(totalLoadRatio * 100) : '∞'}%`}`;
  query('#power-readout').textContent = `${state.powerGeneration.toFixed(1)} / ${state.powerLoad.toFixed(1)} MW`;
  query('#power-readout').title = `发电 ${state.powerGeneration.toFixed(2)} MW · 用电 ${state.powerLoad.toFixed(2)} MW`;
  query('#power-status').textContent = gridStatus;
  query('#power-readout').style.color = state.powerSummary.blackoutCount > 0 ? '#ee6a65' : state.powerSummary.highLoadCount > 0 ? '#ff9b3d' : '#62d69a';
  query('#power-fill').style.width = `${clamp(Number.isFinite(totalLoadRatio) ? totalLoadRatio * 100 : 100, 4, 100)}%`;
  query('#power-fill').style.background = state.powerSummary.blackoutCount > 0 ? '#ee6a65' : state.powerSummary.highLoadCount > 0 ? '#ff9b3d' : '#62d69a';
  query('#craft-button-state').textContent = `可用 ${Object.values(state.kits).reduce((total, amount) => total + Math.floor(amount || 0), 0)}`;
  const modeLabel = state.tool === 'inspect' ? '检视模式' : state.tool === 'demolish' ? '拆除模式' : buildings[state.tool]?.label || '传送带';
  query('#tool-label').textContent = modeLabel;
  query('#build-mode-badge').dataset.mode = state.tool;
  if (state.tool === 'sorter') {
    const anchor = state.pointer.sorterAnchor;
    query('#cursor-readout').textContent = anchor?.kind === 'building'
      ? '拖到传送带起点 · 建筑 → 传送带'
      : anchor?.kind === 'belt'
        ? '拖到建筑接口 · 传送带 → 建筑'
        : '从建筑或传送带端点开始拖拽';
  } else if (state.pointer.cell) {
    const cell = state.pointer.cell;
    const terrain = terrainAt(cell);
    let readout = `GRID ${String(cell.x).padStart(2, '0')},${String(cell.y).padStart(2, '0')} · ${terrain.short}`;
    if (state.tool === 'inspect') {
      const building = findBuildingAt(cell);
      const belt = building ? null : findBeltAt(cell);
      readout += building ? ` · ${buildings[building.type].label} · 点击查看` : belt ? ` · 传送带 ${belt.length} 格 · 点击查看` : ' · 点击建筑或传送带查看详情';
    } else if (state.tool === 'belt') {
      if (isTerrainBlocked(cell)) readout += ` · ${terrain.short}禁建`;
    } else if (state.tool !== 'demolish') {
      const placement = placementCheck(state.tool, cell);
      if (placement.reasonCode === 'terrain' && placement.terrain) readout = `GRID ${String(cell.x).padStart(2, '0')},${String(cell.y).padStart(2, '0')} · ${placement.terrain.short}`;
      const placementLabel = placement.valid
        ? '可建造'
        : ({ building: '体积重叠', resource: '资源占用', belt: '传送带冲突', terrain: `${placement.terrain?.short || '地形'}禁建`, bounds: '超出边界', kit: '库存不足', tech: '科技未解锁' }[placement.reasonCode] || placement.reason);
      readout += ` · ${placementLabel}`;
    }
    query('#cursor-readout').textContent = readout;
  }
  updateDock();
  all('.tool-button').forEach(button => button.classList.toggle('selected', button.dataset.tool === state.tool));
  all('.tool-button').forEach(button => {
    const meta = buildings[button.dataset.tool];
    const techLock = button.dataset.techLock || meta?.tech;
    const locked = techLock && !isTechUnlocked(techLock);
    button.classList.toggle('locked', Boolean(locked));
    const cost = button.querySelector('small');
    if (cost && meta) cost.textContent = locked
      ? `需 ${techById[techLock]?.label || '科技'}`
      : `库存 ${kitCount(button.dataset.tool)} · ${kitCount(button.dataset.tool) > 0 ? '可建造' : '先制造'}`;
  });
  query('#map-button-state').textContent = state.interstellar.route ? '航线中' : isInterstellarUnlocked() ? '已接入' : '未接入';
  const selected = state.buildings.find(building => building.id === state.selectedId);
  const selectedBelt = !selected && state.selectedBeltId ? state.belts.find(belt => belt.id === state.selectedBeltId) : null;
  const selection = query('#selection-card');
  const labModePicker = query('#lab-mode-picker');
  const sorterInterface = query('#sorter-interface');
  const stockLine = query('#selection-stock-line');
  const interfaceLine = query('#selection-interface-line');
  const gridLine = query('#selection-grid-line');
  const gridAction = query('#selection-grid-action');
  renderSorterRouting(selected?.type === 'sorter' ? selected : null);
  if (!selected && !selectedBelt) { selection.hidden = true; labModePicker.hidden = true; sorterInterface.hidden = true; stockLine.hidden = true; interfaceLine.hidden = true; gridLine.hidden = true; gridAction.hidden = true; }
  else if (selectedBelt) {
    const beltItems = state.items.filter(item => item.beltId === selectedBelt.id);
    const resourcesOnBelt = [...new Set(beltItems.map(item => resources[item.resource]?.label || item.resource))];
    const direction = selectedBelt.dx === 0 && selectedBelt.dy === 0 ? '端口桥接' : selectedBelt.dx > 0 ? '向东' : selectedBelt.dx < 0 ? '向西' : selectedBelt.dy > 0 ? '向南' : '向北';
    selection.hidden = false;
    labModePicker.hidden = true;
    sorterInterface.hidden = true;
    stockLine.hidden = true;
    interfaceLine.hidden = true;
    gridLine.hidden = true;
    gridAction.hidden = true;
    query('#selection-name').textContent = `传送带 · ${selectedBelt.length} 格`;
    query('#selection-state').textContent = beltItems.length ? '运输中' : '待命';
    query('#selection-state').style.color = '#62d69a';
    query('#selection-input').textContent = resourcesOnBelt.length ? resourcesOnBelt.join('、') : '暂无物料';
    query('#selection-output').textContent = `${beltItems.length} 件运输中`;
    query('#selection-recipe').textContent = `方向 ${direction} · 起点 ${selectedBelt.x},${selectedBelt.y}`;
    query('#selection-tech').textContent = '基础物流授权 · 已接入';
    const beltLevel = getBuildingLevel('belt');
    query('#selection-license').textContent = `MK-${beltLevel} · ${getBeltTravelFactor().toFixed(2)} 格/秒`;
    const beltUpgrade = buildingUpgradeTechs('belt').find(tech => !isTechUnlocked(tech.id));
    query('#selection-upgrade').textContent = beltUpgrade ? `下一项「${beltUpgrade.label}」` : '已达到 MK-V';
    query('#selection-progress-fill').style.width = `${clamp(beltItems.length / Math.max(1, selectedBelt.length), 0, 1) * 100}%`;
    query('#selection-power-label').textContent = '物流';
    query('#selection-power').textContent = '无独立耗电';
  } else {
    const meta = buildings[selected.type];
    selection.hidden = false;
    labModePicker.hidden = selected.type !== 'researchLab';
    sorterInterface.hidden = selected.type !== 'sorter';
    stockLine.hidden = !isStorageType(selected);
    interfaceLine.hidden = !isStorageType(selected) && selected.type !== 'sorter';
    if (selected.type === 'researchLab') all('[data-lab-mode]').forEach(button => button.classList.toggle('active', (selected.researchMode || 'auto') === button.dataset.labMode));
    query('#selection-name').textContent = meta.label;
    const input = Object.entries(selected.input || {}).filter(([, amount]) => amount > 0).map(([resource, amount]) => `${resources[resource]?.label || resource} ${Math.floor(amount)}`).join(' · ');
    query('#selection-input').textContent = input || '无';
    const output = Object.entries(selected.output).find(([, amount]) => amount > 0);
    const status = buildingStatus(selected);
    query('#selection-state').textContent = status;
    query('#selection-state').style.color = ['科技锁定', '电力不足', '电网瘫痪', '电网高负载', '输出堵塞', '缺少输入', '缺少矩阵组件', '缺煤', '未接入矿脉', '未接入水源', '未接入电网'].includes(status) ? '#ff9b3d' : '#62d69a';
    query('#selection-output').textContent = output ? `${formatNumber(output[1])} 单位缓存` : ['miner', 'oilExtractor', 'waterPump', 'gasExtractor'].includes(selected.type) ? '采掘中 · 等待输出' : '等待产出';
    query('#selection-recipe').textContent = buildingRecipeText(selected);
    query('#selection-tech').textContent = isBuildingUnlocked(selected.type) ? `${buildingTechName(selected.type)} · 已授权` : `需完成「${buildingTechName(selected.type)}」`;
    const selectionLevel = isBuildingUnlocked(selected.type) ? `MK-${Math.min(getBuildingLevel(selected.type), 5)}` : '锁定';
    query('#selection-license').textContent = `${selectionLevel} · ${isBuildingUnlocked(selected.type) ? '可运行' : '等待科技'}`;
    const upgradeState = getBuildingUpgradeState(selected.type);
    const researchedUpgrades = upgradeState.researched.map(tech => tech.label).join('、');
    query('#selection-upgrade').textContent = upgradeState.next
      ? `${researchedUpgrades ? `已研究 ${researchedUpgrades} · ` : ''}下一项「${upgradeState.next.label}」`
      : researchedUpgrades || '暂无后续升级';
    if (isStorageType(selected)) query('#selection-stock').textContent = `${formatNumber(storageUsed(selected))} / ${formatNumber(storageCapacity(selected))}`;
    if (isStorageType(selected)) query('#selection-interface').textContent = `${state.buildings.filter(sorter => sorter.type === 'sorter' && sorterAttachedBuilding(sorter)?.id === selected.id).length} 个分拣器接口`;
    if (selected.type === 'sorter') {
      const target = sorterAttachedBuilding(selected);
      const beltCount = selected.sorterMode === 'output' ? sorterOutputBelts(selected).length : sorterInputBelts(selected).length;
      query('#sorter-interface-status').textContent = target ? `${buildings[target.type].label} · ${beltCount} 条${selected.sorterMode === 'output' ? '出料' : '进料'}传送带` : '先让分拣器同时贴近建筑和传送带';
      all('[data-sorter-mode]').forEach(button => button.classList.toggle('active', (selected.sorterMode || 'input') === button.dataset.sorterMode));
    }
    const selectedGridState = getGridPowerState(selected);
    gridLine.hidden = !isPowerBuilding(selected);
    gridAction.hidden = !isPowerTowerType(selected);
    if (isPowerBuilding(selected)) {
      const grid = selectedGridState.grid;
      const ratio = grid
        ? grid.blackout ? '超负荷' : Number.isFinite(grid.ratio) ? `${Math.round(grid.ratio * 100)}%` : '--'
        : '--';
      query('#selection-grid').textContent = grid ? `${grid.id.replace('grid-', '电网 ')} · ${grid.status}` : '未接入电网';
      query('#selection-grid-metrics').textContent = grid ? `发电 ${grid.generation.toFixed(1)} · 用电 ${grid.load.toFixed(1)} MW · 负载 ${ratio}` : '没有可共享的供电节点';
      if (isPowerTowerType(selected)) {
        gridAction.textContent = selected.gridEnabled === false ? '重新接入外部电网' : '断开外部电网';
        const gridActionNote = query('#selection-grid-action-note');
        if (gridActionNote) gridActionNote.textContent = selected.gridEnabled === false ? '保留本塔覆盖范围，先恢复局部供电' : '与覆盖范围内的其他电塔共享电力';
      }
    }
    query('#selection-progress-fill').style.width = `${buildingProgress(selected) * 100}%`;
    const selectedPowerState = getGridPowerState(selected);
    const nominalPower = meta.power || 0;
    const hasFuel = selected.type !== 'thermal' || (selected.input?.coal || 0) > 0;
    if (isPowerTowerType(selected)) {
      query('#selection-power-label').textContent = '自身耗电';
      query('#selection-power').textContent = `${nominalPower.toFixed(2)} MW`;
    } else if (meta.generation) {
      query('#selection-power-label').textContent = hasFuel ? '当前发电' : '当前发电 · 缺煤';
      query('#selection-power').textContent = hasFuel ? `+${getPowerGeneration(selected).toFixed(2)} MW` : '+0.00 MW';
    } else {
      query('#selection-power-label').textContent = selectedPowerState.grid?.highLoad ? '耗电 · 有效 50%' : '耗电';
      query('#selection-power').textContent = `${nominalPower.toFixed(2)} MW`;
    }
  }
  updateResearchUI();
  updateObjective();
  updateFactoryMonitor();
  updateStellarProjectUI();
  if (!query('#star-map-panel').hidden) updateStarMapUI();
}

let toastTimer;
function showToast(message, type = 'ok') {
  const toast = query('#game-toast');
  query('#toast-message').textContent = message;
  toast.className = `game-toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
}

function focusResourceNode(resource) {
  const node = state.nodes.find(entry => entry.resource === resource && entry.amount > 0);
  if (!node) return false;
  state.camera = { x: node.x + .5, y: node.y + .5 };
  state.selectedId = null;
  state.selectedBeltId = null;
  state.pointer.cell = null;
  showToast(`${resources[resource]?.label || resource}矿脉已定位`);
  return true;
}

function focusBuilding(building) {
  if (!building) return false;
  const center = buildingCenter(building);
  state.camera = { x: center.x, y: center.y };
  state.selectedId = building.id;
  state.selectedBeltId = null;
  state.pointer.cell = null;
  return true;
}

function cancelToolSelection(announce = false) {
  state.tool = 'inspect';
  setDockCategory('tools');
  state.selectedId = null;
  state.selectedBeltId = null;
  state.pointer.startCell = null;
  state.pointer.startBuildingId = null;
  state.pointer.sorterAnchor = null;
  state.pointer.down = false;
  if (announce) showToast('已取消建筑选择');
}

function selectTool(tool) {
  if (!['inspect', 'belt', 'demolish'].includes(tool) && !isBuildingUnlocked(tool)) {
    showToast(`需要完成 ${buildingTechName(tool)}`, 'warning');
    return;
  }
  if (tool !== 'inspect' && tool === state.tool) {
    cancelToolSelection(true);
    return;
  }
  if (tool === 'inspect') {
    cancelToolSelection();
    showToast('检视模式 · 点击建筑或传送带查看详情');
    return;
  }
  state.tool = tool;
  setDockCategory(dockCategoryForTool(tool));
  state.selectedId = null;
  state.selectedBeltId = null;
  state.pointer.startCell = null;
  state.pointer.startBuildingId = null;
  state.pointer.sorterAnchor = null;
  const message = tool === 'inspect'
    ? '检视模式 · 点击建筑查看详情'
    : tool === 'demolish'
      ? '拆除模式'
      : `${buildings[tool]?.label || '传送带'} 已选中`;
  showToast(message, 'ok');
}

function closeFactoryPanels() {
  query('#tech-panel').hidden = true;
  query('#star-map-panel').hidden = true;
  query('#career-panel').hidden = true;
  query('#craft-panel').hidden = true;
  query('#goal-panel').hidden = true;
}

function runDiagnosticAction(diagnostic = getFactoryDiagnostic()) {
  const action = diagnostic.action;
  if (!action) return;
  if (action === '打开星图') { toggleStarMap(true); return; }
  if (action === '打开科技中枢' || action === '查看主线科技') { toggleTechPanel(true); return; }
  if (action === '查看设施') {
    focusBuilding(diagnostic.focusBuilding);
    return;
  }
  closeFactoryPanels();
  if (action === '选择采矿机') {
    selectTool('miner');
    focusResourceNode(diagnostic.focusResource || 'copper');
    return;
  }
  if (action === '选择熔炼炉') {
    selectTool('smelter');
    if (diagnostic.focusResource) focusResourceNode(diagnostic.focusResource);
    return;
  }
  if (action === '选择组装机') {
    selectTool('assembler');
    focusBuilding(diagnostic.focusBuilding);
    return;
  }
  if (action === '选择传送带') {
    selectTool('belt');
    focusBuilding(diagnostic.focusBuilding);
    return;
  }
  if (action === '选择分拣器') {
    selectTool('sorter');
    focusBuilding(diagnostic.focusBuilding);
    return;
  }
  if (diagnostic.tool) {
    selectTool(diagnostic.tool);
    focusBuilding(diagnostic.focusBuilding);
  }
}

function togglePause() {
  state.paused = !state.paused;
  query('#pause-label').textContent = state.paused ? '继续' : '暂停';
  query('#pause-glyph').textContent = state.paused ? '▶' : 'Ⅱ';
  query('#paused-overlay').hidden = !state.paused;
  showToast(state.paused ? '模拟已暂停' : '模拟已继续');
}

function toggleSimulationSpeed() {
  const index = simulationSpeeds.indexOf(state.simulationSpeed);
  state.simulationSpeed = simulationSpeeds[(index + 1) % simulationSpeeds.length];
  query('#speed-label').textContent = `${state.simulationSpeed}x`;
  showToast(`模拟速度 · ${state.simulationSpeed}x`);
}

function applyQaDemoState() {
  const mode = qaDemoMode;
  if (!mode) return;
  const makeDemoBuilding = (type, x, y, overrides = {}) => ({
    ...makeBuilding(type, x, y),
    ...overrides
  });
  const makeDemoBelt = (x, y, dx, dy, length) => ({
    id: `qa-belt-${x}-${y}-${length}`,
    x, y, dx, dy, length
  });
  const demoBuildings = [
    makeDemoBuilding('miner', -8, -3, { nodeId: 'copper-north', timer: .55, output: { copper: 2 } }),
    makeDemoBuilding('smelter', -3, -2, { recipeResource: 'copper', process: .7, input: { copper: 2 } }),
    makeDemoBuilding('assembler', 3, -2, { process: .82, input: { copperIngot: 1, siliconWafer: 1 } }),
    makeDemoBuilding('researchLab', 3, 3, { process: .45, input: { copperIngot: 1, siliconWafer: 1 } }),
    makeDemoBuilding('wind', -7, 4),
    makeDemoBuilding('sorter', 7, 3, { process: .13, input: { copperIngot: 1 } }),
    makeDemoBuilding('thermal', 9, 4, { input: { coal: 2 }, fuelTimer: 2.1 })
  ];
  const demoBelts = [
    makeDemoBelt(-6, -1, 1, 0, 3),
    makeDemoBelt(-1, -1, 1, 0, 4),
    makeDemoBelt(4, 0, 0, 1, 4),
    makeDemoBelt(2, 3, 1, 0, 4),
    makeDemoBelt(6, 4, 1, 0, 3)
  ];
  state.career = 'logistics';
  state.careerChosen = true;
  state.pendingCareer = 'logistics';
  state.buildings = demoBuildings;
  state.belts = demoBelts;
  state.nodes = initialNodeState.map(node => ({ ...node }));
  state.inventory = { ...startingInventory, iron: 320, copper: 160, silicon: 120, coal: 24, ironIngot: 18, copperIngot: 24, siliconWafer: 18, processor: 12, electromagneticCube: 28, energyCube: 18, structureCube: 16, informationCube: 8, titanium: 14 };
  state.items = [{ id: 'qa-item-1', beltId: demoBelts[0].id, sourceId: demoBuildings[1].id, resource: 'copper', progress: .35 }, { id: 'qa-item-2', beltId: demoBelts[1].id, sourceId: demoBuildings[2].id, resource: 'copperIngot', progress: .68 }];
  state.research = { current: null, progress: 0 };
  state.interstellar = makeInterstellarState();
  state.stellarProject = makeStellarProject();
  if (mode === 'tech') {
    state.tech = ['foundation', 'planetary-logistics'];
    state.research = { current: 'automated-smelting', progress: 7 };
  } else if (mode === 'map') {
    state.tech = ['foundation', 'planetary-logistics', 'automated-smelting', 'matrix-lab', 'interstellar-logistics'];
    state.interstellar = makeInterstellarState({ selectedPlanet: 'forge', cargo: 'processor', route: { id: 'qa-route', targetId: 'forge', cargo: 'processor', amount: 2, progress: .42, phase: 'outbound' }, completedTrips: 2, visits: { forge: 1 } });
  } else if (mode === 'stellar') {
    state.tech = ['foundation', 'planetary-logistics', 'automated-smelting', 'matrix-lab', 'interstellar-logistics', 'stellar-network', 'dyson-frame'];
    state.stellarProject = makeStellarProject({ progress: 45, modules: 9 });
    state.interstellar = makeInterstellarState({ selectedPlanet: 'forge', cargo: 'processor', route: { id: 'qa-route', targetId: 'forge', cargo: 'processor', amount: 2, progress: .72, phase: 'returning' }, completedTrips: 6, visits: { forge: 4, frost: 2 } });
  } else if (mode === 'sorter') {
    const sorter = makeDemoBuilding('sorter', -5, -2, { sorterMode: 'output', output: { copperIngot: 1, ironIngot: 1 }, process: .13 });
    const copperLine = makeDemoBuilding('smelter', -5, -4, { recipeResource: 'copper' });
    const ironLine = makeDemoBuilding('smelter', -5, 2, { recipeResource: 'iron' });
    const copperOutput = { id: 'qa-demo-sorter-copper', x: -4, y: -2, dx: 1, dy: 0, length: 3 };
    const copperTurn = { id: 'qa-demo-sorter-copper-turn', x: -2, y: -2, dx: 0, dy: -1, length: 2 };
    const ironOutput = { id: 'qa-demo-sorter-iron', x: -5, y: -1, dx: 0, dy: 1, length: 3 };
    sorter.sorterRules.copper = copperOutput.id;
    state.tech = ['foundation', 'planetary-logistics', 'sorter-tech', 'belt-mk2', 'automated-smelting'];
    state.buildings = [sorter, copperLine, ironLine];
    state.belts = [
      { id: 'qa-demo-sorter-input', x: -9, y: -2, dx: 1, dy: 0, length: 4 },
      copperOutput,
      copperTurn,
      ironOutput
    ];
    state.items = [{ id: 'qa-demo-sorter-item', beltId: copperOutput.id, sourceId: sorter.id, resource: 'copper', progress: .42 }];
    state.selectedId = sorter.id;
  } else {
    state.tech = ['foundation'];
  }
  state.camera = { x: 0, y: 1 };
  state.selectedId = mode === 'sorter' ? state.buildings.find(building => building.type === 'sorter')?.id || null : null;
  state.paused = false;
}

function runQaPlaythrough() {
  const failures = [];
  // QA places an explicit wind generator and grants kits so it can exercise
  // the full progression without bypassing the live inventory rules.
  state.basePowerGeneration = 0;
  state.kits = {
    ...startingKits,
    ...Object.fromEntries(Object.keys(buildings).filter(type => type !== 'storage').map(type => [type, 99])),
    belt: 200
  };
  const check = (condition, message) => { if (!condition) failures.push(message); };
  const makeQaSorter = (x, y, mode) => {
    const sorter = makeBuilding('sorter', x, y);
    sorter.sorterMode = mode;
    return sorter;
  };
  const addQaRoute = (source, target, prefix) => {
    const route = beltPortsBetweenBuildings(source, target);
    (route.segments || []).forEach((segment, index) => state.belts.push({ ...segment, id: `${prefix}-${index}` }));
    return route;
  };
  const seedQaResearchStock = (cube, amount) => {
    const storage = storageBuildings()[0];
    Object.keys(storage.stock || {}).forEach(resource => {
      if (resource !== cube && resource !== 'processor') storage.stock[resource] = 0;
    });
    storage.stock[cube] = Math.max(storage.stock[cube] || 0, amount);
  };
  const researchQaTech = id => {
    state.research = { current: null, progress: 0 };
    const cube = techById[id].cube;
    seedQaResearchStock(cube, techById[id].cost + 4);
    check(storageAmount(cube) >= techById[id].cost, `${id} 研究材料没有进入物流仓储`);
    startResearch(id);
    check(state.research.current === id, `${id} 未进入研究 · 当前 ${state.research.current || '待命'}`);
    simulateResearch(1000);
    check(isTechUnlocked(id), `${id} 未完成`);
  };
  state.career = 'logistics';
  state.careerChosen = true;
  state.pendingCareer = 'logistics';
  const miner = makeBuilding('miner', -8, -3);
  miner.nodeId = 'copper-north';
  const smelter = makeBuilding('smelter', -3, -2);
  smelter.recipeResource = 'copper';
  const assembler = makeBuilding('assembler', 3, -2);
  assembler.input = { copperIngot: 1, siliconWafer: 1 };
  const lab = makeBuilding('researchLab', 3, 3);
  const storage = makeBuilding('storage', 8, -1);
  storage.baseHub = true;
  storage.stock = { ...startingStorageStock, processor: 20 };
  const qaWind = makeBuilding('wind', 14, 1);
  const qaWindTwo = makeBuilding('wind', 16, 1);
  const qaWindThree = makeBuilding('wind', 12, 4);
  const qaThermal = makeBuilding('thermal', 14, 4, 0);
  qaThermal.input = { coal: 20 };
  const qaTowers = [-6, 0, 6, 12].map((x, index) => makeBuilding('powerTower', x, 0, 0));
  const minerOutput = makeQaSorter(-6, -2, 'output');
  const smelterInput = makeQaSorter(-1, -2, 'input');
  const smelterOutput = makeQaSorter(-3, -3, 'output');
  const storageInput = makeQaSorter(7, -2, 'input');
  const storageOutput = makeQaSorter(7, 0, 'output');
  const storageInputTwo = makeQaSorter(10, 0, 'input');
  const storageOutputTwo = makeQaSorter(8, 1, 'output');
  const labInput = makeQaSorter(2, 3, 'input');
  const labOutput = makeQaSorter(5, 3, 'output');
  const assemblerInput = makeQaSorter(3, -3, 'input');
  const assemblerOutput = makeQaSorter(5, -2, 'output');
  state.buildings = [storage, miner, smelter, assembler, lab, qaWind, qaWindTwo, qaWindThree, qaThermal, minerOutput, smelterInput, smelterOutput, storageInput, storageOutput, storageInputTwo, storageOutputTwo, labInput, labOutput, assemblerInput, assemblerOutput];
  state.belts = [];
  addQaRoute(minerOutput, smelterInput, 'qa-miner-smelter');
  addQaRoute(smelterOutput, storageInput, 'qa-smelter-storage');
  addQaRoute(storageOutput, labInput, 'qa-storage-lab');
  addQaRoute(labOutput, storageInputTwo, 'qa-lab-storage');
  addQaRoute(storageOutputTwo, assemblerInput, 'qa-storage-assembler');
  addQaRoute(assemblerOutput, storageInputTwo, 'qa-assembler-storage');
  // Place transmission towers after routing QA creates its belts so they do
  // not accidentally change the logistics pathfinder's obstacle map.
  state.buildings.push(...qaTowers);
  state.nodes = initialNodeState.map(node => ({ ...node }));
  state.items = [];
  state.inventory = { ...startingInventory, titanium: 0 };
  state.tech = [...startingTech];
  state.research = { current: null, progress: 0 };
  state.interstellar = makeInterstellarState({ selectedPlanet: 'forge', cargo: 'processor' });
  state.stellarProject = makeStellarProject();
  check(!state.buildings.some(building => building.type === 'hub'), '旧能源核心仍然存在于运行时场景');
  check(WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX >= 72 && WORLD_BOUNDS.maxY - WORLD_BOUNDS.minY >= 48, '单星球地图边界没有扩大到行星尺度');
  check(state.nodes.length >= 30 && state.nodes.some(node => Math.abs(node.x) > 20 && Math.abs(node.y) > 14), '资源节点仍然集中在着陆区附近');
  check(resources.crudeOil.form === 'liquid' && resources.water.form === 'liquid' && resources.naturalGas.form === 'gas', '流体资源形态元数据缺失');
  check(!Object.prototype.hasOwnProperty.call(startingStorageStock, 'crudeOil') && !Object.prototype.hasOwnProperty.call(startingStorageStock, 'water') && !Object.prototype.hasOwnProperty.call(startingStorageStock, 'naturalGas'), '初始固体仓储仍混入液体或气体库存');
  check(storageCapacity(storage) === 240, '基础物流仓储容量错误');
  check(isBuildingUnlocked('sorter'), '基础工业授权没有解锁基础分拣器');
  check(terrainAt({ x: 13, y: -7 }).kind === 'rock' && terrainAt({ x: -14, y: 8 }).kind === 'water', '固定地形瓦片没有生成');
  const footprintOverlap = placementCheck('smelter', { x: -7, y: -2 });
  check(!footprintOverlap.valid && footprintOverlap.reasonCode === 'building', '建筑 footprint 没有阻止与已有设施重叠');
  const beltOverlap = placementCheck('smelter', { x: -5, y: -2 });
  check(!beltOverlap.valid && beltOverlap.reasonCode === 'belt', '建筑 footprint 没有阻止压到传送带');
  const rockPlacement = placementCheck('smelter', { x: 13, y: -7 });
  const waterPlacement = placementCheck('smelter', { x: -14, y: 8 });
  const resourcePlacementBuildings = state.buildings;
  const resourcePlacementBelts = state.belts;
  state.buildings = [];
  state.belts = [];
  const mineralCorePlacement = placementCheck('smelter', { x: 5, y: -4 });
  const minerCorePlacement = placementCheck('miner', { x: -6, y: -2 });
  const adjacentMinerCell = { x: 3, y: -6 };
  const adjacentMinerPlacement = placementCheck('miner', adjacentMinerCell);
  state.buildings = resourcePlacementBuildings;
  state.belts = resourcePlacementBelts;
  check(!rockPlacement.valid && rockPlacement.reasonCode === 'terrain', '岩石地形仍然允许放置建筑');
  check(!waterPlacement.valid && waterPlacement.reasonCode === 'terrain', '水域地形仍然允许放置建筑');
  check(!mineralCorePlacement.valid && mineralCorePlacement.reasonCode === 'resource' && mineralCorePlacement.blockedCell.x === 5 && mineralCorePlacement.blockedCell.y === -4, '建筑 footprint 仍然可以压住矿脉核心格');
  check(!minerCorePlacement.valid && minerCorePlacement.reasonCode === 'resource', '采矿机仍然可以压住矿脉核心格');
  check(Boolean(adjacentMinerPlacement.valid && findNodeForBuilding({ type: 'miner', ...adjacentMinerCell })?.id === 'silicon-west'), '采矿机贴近矿脉时没有保留覆盖范围判定');
  check(findBeltPath({ x: 13, y: -7 }, { x: 13, y: -5 }).length === 0, '传送带仍然可以穿过禁建地形');
  check(!deliver(lab, 'copperIngot'), '建筑仍然允许绕过分拣器直接进料');
  check(findSorterForBuilding(miner, 'copper', 'output') === minerOutput, '矿机没有识别出料分拣器');
  check(findSorterForBuilding(smelter, 'copper', 'input') === smelterInput, '冶炼机没有识别进料分拣器');
  check(findSorterForBuilding(storage, 'copperIngot', 'input') === storageInput, '仓储没有识别进料分拣器');
  check(findSorterForBuilding(storage, 'copperIngot', 'output') === storageOutput, '仓储没有识别出料分拣器');
  const installBuilding = makeBuilding('smelter', 14, 7);
  const installOutputBelt = { id: 'qa-install-output', x: 16, y: 6, dx: 1, dy: 0, length: 2 };
  const installInputBelt = { id: 'qa-install-input', x: 17, y: 7, dx: 0, dy: 0, length: 1 };
  const outputInstall = findSorterPlacement(installBuilding, installOutputBelt, 'output');
  const inputInstall = findSorterPlacement(installBuilding, installInputBelt, 'input');
  check(outputInstall?.cell?.x === 15 && outputInstall?.cell?.y === 6, '建筑拖到传送带起点时没有自动吸附出料分拣器');
  check(inputInstall?.cell?.x === 16 && inputInstall?.cell?.y === 7, '传送带末端拖到建筑时没有自动吸附进料分拣器');
  const buildingsBeforeInstall = state.buildings;
  const beltsBeforeInstall = state.belts;
  const inventoryBeforeInstall = { ...state.inventory };
  state.buildings = [...state.buildings, installBuilding];
  state.belts = [...state.belts, installOutputBelt];
  const installedSorter = placeSorterBetween(installBuilding, installOutputBelt, 'output');
  check(installedSorter && state.buildings.some(building => building.type === 'sorter' && building.sorterMode === 'output' && building.x === 15 && building.y === 6), '分拣器拖拽安装没有生成建筑出料接口');
  state.buildings = buildingsBeforeInstall;
  state.belts = beltsBeforeInstall;
  state.inventory = inventoryBeforeInstall;
  simulateBuildings(2);
  check(state.nodes.find(node => node.id === 'copper-north').amount < 62400, '采矿脉冲未消耗矿脉');
  check(
    (smelter.input.copper || 0) > 0
      || (smelter.output.copperIngot || 0) > 0
      || state.items.some(item => item.resource === 'copper' || item.resource === 'copperIngot'),
    '矿机到冶炼机的真实物流未推进'
  );
  check(!isBuildingUnlocked('assembler'), '组装机提前解锁');
  check(buildingStatus(assembler) === '科技锁定', '未授权建筑没有进入锁定状态');
  check((assembler.output.processor || 0) === 0, '未授权建筑仍在生产');
  const expectedLoad = state.buildings
    .filter(isBuildingOperational)
    .reduce((total, building) => total + (buildings[building.type]?.power || 0), 0);
  check(Math.abs(state.powerLoad - expectedLoad) < .001, '未授权建筑错误计入电网');
  state.research = { current: 'planetary-logistics', progress: 0 };
  for (let tick = 0; tick < 14; tick += 1) simulateBuildings(1);
  const matrixBeforeResearch = storageAmount('electromagneticCube');
  check(matrixBeforeResearch > 0, '科研站未通过分拣器向物流仓储输出电磁矩阵');
  simulateResearch(1);
  check(state.research.progress > 0 && storageAmount('electromagneticCube') < matrixBeforeResearch, '研究循环未从物流仓储消费矩阵');
  state.research = { current: null, progress: 0 };
  const smeltingTimeBefore = getSmeltingTime();
  researchQaTech('planetary-logistics');
  const beltSpeedBefore = getBeltTravelFactor();
  researchQaTech('sorter-tech');
  check(getBuildingLevel('sorter') >= 2, '智能分拣没有升级分拣器等级');
  const storageCapacityBefore = storageCapacity(storage);
  researchQaTech('storage-mk2');
  check(storageCapacity(storage) > storageCapacityBefore && storageCapacity(storage) === 480, '仓储扩容没有改变真实容量');
  const liquidStorage = makeBuilding('liquidStorage', 18, 8);
  const gasStorage = makeBuilding('gasStorage', 22, 8);
  researchQaTech('fluid-storage');
  state.buildings.push(liquidStorage);
  check(storageFormOf(storage) === 'solid' && storageFormOf(liquidStorage) === 'liquid' && storageFormOf(gasStorage) === 'gas', '三类仓储没有绑定独立物态');
  check(!acceptsBuildingResource(storage, 'water') && acceptsBuildingResource(liquidStorage, 'water') && !acceptsBuildingResource(liquidStorage, 'iron'), '液体仓储错误接受了固体或拒绝了液体');
  check(putInStorage('water', 3) === 3 && storageAmount('water') === 3, '液体资源没有进入独立液体仓储');
  check(putInStorage('water', 1) === 0 || storageAmount('water') === 4, '仓储形态校验出现异常');
  researchQaTech('belt-mk2');
  check(getBeltTravelFactor() < beltSpeedBefore, '高速传送未改变运输速度');
  const miningTimeBefore = getMiningTime(miner);
  researchQaTech('mining-mk2');
  check(getMiningTime(miner) < miningTimeBefore, '高压采掘未升级采矿速度');
  const oilExtractor = makeBuilding('oilExtractor', 9, 5);
  const oilTimeBefore = getMiningTime(oilExtractor);
  researchQaTech('oil-processing');
  check(isBuildingUnlocked('oilExtractor'), '石油提取机未随石化开采解锁');
  researchQaTech('gas-extraction');
  researchQaTech('gas-storage');
  state.buildings.push(gasStorage);
  check(!acceptsBuildingResource(storage, 'naturalGas') && acceptsBuildingResource(gasStorage, 'naturalGas') && !acceptsBuildingResource(gasStorage, 'water'), '气体仓储错误接受了其他物态');
  check(putInStorage('naturalGas', 3) === 3 && storageAmount('naturalGas') === 3, '气体资源没有进入独立气体仓储');
  check(placementCheck('gasExtractor', { x: -4, y: -22 }).valid, '天然气压采机无法覆盖远端气田');
  check(!placementCheck('gasExtractor', { x: -2, y: -22 }).valid, '天然气压采机可以压住气田核心格');
  const oilPlacementBelts = state.belts;
  state.belts = [];
  const oilPlacement = placementCheck('oilExtractor', { x: 9, y: 5 });
  check(oilPlacement.valid, `石油提取机贴近原油渗流区时无法放置 · ${oilPlacement.reason || '未知原因'}`);
  const oilCorePlacement = placementCheck('oilExtractor', { x: 11, y: 6 });
  check(!oilCorePlacement.valid && oilCorePlacement.reasonCode === 'resource', `石油提取机仍然可以压住原油核心格 · ${oilCorePlacement.reason || '未知原因'}`);
  state.belts = oilPlacementBelts;
  researchQaTech('oil-extractor-mk2');
  check(getMiningTime(oilExtractor) < oilTimeBefore, '深层泵压未升级石油提取速度');
  const workbench = makeBuilding('workbench', 0, 0);
  const workbenchTimeBefore = getAssemblyTime(workbench);
  researchQaTech('workbench-tech');
  check(isBuildingUnlocked('workbench'), '工作台未随精密工作台解锁');
  check(getAssemblyTime(workbench) < workbenchTimeBefore, '精密工作台未升级工作台速度');
  researchQaTech('wind-power');
  const wind = makeBuilding('wind', 0, 0);
  check(isBuildingUnlocked('wind'), '风力发电机未随风能捕获解锁');
  const windOutputBefore = getPowerGeneration(wind);
  researchQaTech('thermal-power');
  const thermal = makeBuilding('thermal', 0, 0);
  check(isBuildingUnlocked('thermal'), '火力发电机未随热能转化解锁');
  const thermalOutputBefore = getPowerGeneration(thermal);
  researchQaTech('power-grid-mk2');
  check(getPowerGeneration(wind) > windOutputBefore && getPowerGeneration(thermal) > thermalOutputBefore, '电网增容未升级发电输出');
  researchQaTech('power-transmission');
  check(isBuildingUnlocked('longPowerTower') && getTransmissionRange(qaTowers[0]) > buildings.powerTower.transmissionRange, '远距输电没有解锁或扩大电塔覆盖');
  researchQaTech('advanced-power-grid');
  check(isBuildingUnlocked('ultraPowerTower'), '超远距骨干网没有解锁超远距离电力塔');
  researchQaTech('automated-smelting');
  check(isBuildingUnlocked('assembler'), '自动冶炼未解锁组装机');
  check(getSmeltingTime() < smeltingTimeBefore, '自动冶炼未升级冶炼速度');
  const assemblerPlacementCell = { x: 12, y: 8 };
  const assemblerKitsBeforePlacementQa = kitCount('assembler');
  state.kits.assembler = 0;
  check(placementCheck('assembler', assemblerPlacementCell).reasonCode === 'kit', '建筑库存耗尽后仍可绕过库存限制');
  state.kits.assembler = assemblerKitsBeforePlacementQa;
  check(placementCheck('assembler', assemblerPlacementCell).valid, '组装机解锁并拥有库存后仍无法进入建造状态');
  const windKitsBeforeDemolitionQa = kitCount('wind');
  const demolitionQaBuilding = makeBuilding('wind', 25, 12);
  state.buildings.push(demolitionQaBuilding);
  removeAt({ x: demolitionQaBuilding.x, y: demolitionQaBuilding.y });
  check(kitCount('wind') === windKitsBeforeDemolitionQa + 1, '拆除建筑没有返还对应建筑库存');
  const processorBeforeAssemblerCheck = storageAmount('processor');
  simulateBuildings(3);
  const assemblerHasProduced = (assembler.output.processor || 0) > 0
    || state.items.some(item => item.sourceId === assembler.id && item.resource === 'processor')
    || state.items.some(item => item.resource === 'processor')
    || storageAmount('processor') > processorBeforeAssemblerCheck
    || state.buildings.some(building => building.type === 'sorter' && (building.output.processor || 0) > 0);
  check(assemblerHasProduced, `建筑解锁后没有恢复生产 · ${buildingStatus(assembler)} · 电力 ${state.powerGeneration.toFixed(1)}/${state.powerLoad.toFixed(1)} · 输入 ${JSON.stringify(assembler.input)}`);
  const assemblyTimeBefore = getAssemblyTime(assembler);
  researchQaTech('advanced-assembly');
  check(getAssemblyTime(assembler) < assemblyTimeBefore, '高级组装未升级组装机速度');
  const logisticsLevelBefore = getBuildingLevel('belt');
  researchQaTech('logistics-mk3');
  check(getBuildingLevel('belt') === 3 && getBeltTravelFactor() < beltSpeedBefore, '物流 Mk-III 没有改变传送带等级或速度');
  researchQaTech('logistics-mk4');
  check(getBuildingLevel('belt') === 4, '物流 Mk-IV 没有升级传送带');
  const researchQaLab = makeBuilding('researchLab', 0, 0);
  const researchTimeBefore = getResearchProductionTime(researchQaLab, 'electromagneticCube');
  researchQaTech('matrix-lab');
  check(getResearchProductionTime(researchQaLab, 'electromagneticCube') < researchTimeBefore, '矩阵实验室未升级科研站速度');
  check(getBuildingLevel('miner') >= 2 && getBuildingLevel('oilExtractor') >= 2 && getBuildingLevel('wind') >= 2, '建筑升级等级未同步');
  researchQaTech('interstellar-logistics');
  check(isBuildingUnlocked('logisticsStation'), '星际物流没有解锁行星物流站');
  storage.stock = { processor: 20, electromagneticCube: 0, energyCube: 0, structureCube: 0, informationCube: 0, titanium: 0 };
  state.interstellar.cargo = 'processor';
  launchRoute();
  check(state.interstellar.route?.phase === 'outbound', '货运舱未进入去程');
  simulateInterstellar(13);
  check(state.interstellar.route?.phase === 'returning', '货运舱未进入返航');
  simulateInterstellar(13);
  check(state.interstellar.completedTrips === 1 && storageAmount('titanium') === 8, '异星钛资源未回收到物流仓储');
  researchQaTech('stellar-network');
  researchQaTech('logistics-mk5');
  check(getBuildingLevel('belt') === 5 && storageCapacity(storage) === 1400, '物流 Mk-V 没有达到五级速度与容量');
  researchQaTech('industrial-mk3');
  researchQaTech('industrial-mk4');
  researchQaTech('industrial-mk5');
  check(getBuildingLevel('miner') === 5 && getMiningTime(miner) < .55, '工业设备没有完成五级升级链');
  state.buildings = state.buildings.filter(building => building !== liquidStorage && building !== gasStorage);
  rebuildPowerGrids();
  researchQaTech('dyson-frame');
  storage.stock = { structureCube: 80, titanium: 40, processor: 20 };
  for (let index = 0; index < 20; index += 1) contributeStellarProject();
  check(state.stellarProject.progress === 100, '恒星工程未完成');
  const completedBuildings = state.buildings;
  const completedBelts = state.belts;
  const completedItems = state.items;
  const qaPowerBase = state.basePowerGeneration;
  const qaPowerBuildings = [
    makeBuilding('wind', -10, -10),
    makeBuilding('powerTower', -10, -6),
    makeBuilding('powerTower', 0, -6),
    makeBuilding('miner', -10, -8),
    makeBuilding('miner', -7, -8),
    makeBuilding('miner', -4, -8),
    makeBuilding('miner', -1, -8),
    makeBuilding('miner', 2, -8)
  ];
  state.basePowerGeneration = 0;
  state.buildings = qaPowerBuildings;
  state.belts = [];
  state.items = [];
  rebuildPowerGrids();
  const highLoadGrid = state.powerGrids.find(grid => grid.buildingIds.includes(qaPowerBuildings[0].id));
  check(Boolean(highLoadGrid?.highLoad && getGridPowerState(qaPowerBuildings[3]).efficiency === .5), '电网达到 80% 负载后没有将用电设施效率减半');
  const blackoutMiner = makeBuilding('miner', 5, -8);
  state.buildings.push(blackoutMiner);
  rebuildPowerGrids();
  check(Boolean(state.powerGrids.find(grid => grid.buildingIds.includes(blackoutMiner.id))?.blackout), '用电大于发电时电网没有进入瘫痪');
  const disconnectWind = makeBuilding('wind', -10, -10);
  const disconnectTower = makeBuilding('powerTower', -10, -6);
  const isolatedTower = makeBuilding('powerTower', 0, -6);
  const disconnectMiner = makeBuilding('miner', -10, -8);
  state.buildings = [disconnectWind, disconnectTower, isolatedTower, disconnectMiner];
  rebuildPowerGrids();
  isolatedTower.gridEnabled = false;
  rebuildPowerGrids();
  check(state.powerSummary.gridCount >= 2 && state.powerGrids.some(grid => grid.buildingIds.includes(isolatedTower.id) && grid.blackout), '断开电塔外部连接后没有形成可恢复的局部电网');
  state.basePowerGeneration = qaPowerBase;
  state.buildings = completedBuildings;
  state.belts = completedBelts;
  state.items = completedItems;
  rebuildPowerGrids();
  check(getFactoryDiagnostic().kind === 'complete', '完整主流程诊断没有进入完成态');
  // Use a fresh two-branch topology to test that one output sorter can route
  // different products to different input sorters after the mainline checks.
  state.buildings = [storage];
  state.belts = [];
  state.items = [];
  const qaSource = makeBuilding('smelter', -10, -8);
  qaSource.recipeResource = 'copper';
  qaSource.output = { copperIngot: 1, ironIngot: 1 };
  const qaSorter = makeQaSorter(-10, -6, 'output');
  const qaCopperTarget = makeBuilding('assembler', -4, -8);
  const qaCopperInput = makeQaSorter(-2, -8, 'input');
  const qaIronTarget = makeBuilding('workbench', -4, 1);
  const qaIronInput = makeQaSorter(-2, 1, 'input');
  state.buildings.push(qaSource, qaSorter, qaCopperTarget, qaCopperInput, qaIronTarget, qaIronInput);
  addQaRoute(qaSorter, qaCopperInput, 'qa-copper');
  addQaRoute(qaSorter, qaIronInput, 'qa-iron');
  const qaBranchWind = makeBuilding('wind', -8, -5);
  const qaBranchTowers = [makeBuilding('powerTower', -8, -6), makeBuilding('powerTower', -3, -6), makeBuilding('powerTower', -3, 1)];
  state.buildings.push(qaBranchWind, ...qaBranchTowers);
  const qaCopperOutput = state.belts.find(belt => belt.id === 'qa-copper-0');
  const qaIronOutput = state.belts.find(belt => belt.id === 'qa-iron-0');
  check(Boolean(qaCopperOutput && qaIronOutput), '分拣器没有形成两个独立输出端口');
  qaSorter.sorterRules.copperIngot = qaCopperOutput?.id;
  check(findSorterOutputBelt(qaSorter, 'copperIngot') === qaCopperOutput, '分拣器未按物料规则选择铜锭出口');
  check(findSorterOutputBelt(qaSorter, 'ironIngot') === qaIronOutput, '分拣器自动分流未识别铁锭产线');
  qaSorter.sorterRules.ironIngot = 'deleted-belt-rule';
  check(findSorterOutputBelt(qaSorter, 'ironIngot') === qaIronOutput && !qaSorter.sorterRules.ironIngot, '失效分流规则未自动恢复');
  check(findSorterForBuilding(qaCopperTarget, 'copperIngot', 'input') === qaCopperInput, '铜锭目标没有识别进料分拣器');
  check(!deliver(qaCopperTarget, 'copperIngot'), '分拣器分流 QA 仍允许建筑直连');
  simulateBuildings(.3);
  check(state.items.some(item => item.beltId === qaCopperOutput?.id && item.resource === 'copperIngot'), '分拣器铜锭物料未进入指定出口');
  check(state.items.some(item => item.beltId === qaIronOutput?.id && item.resource === 'ironIngot'), '分拣器铁锭物料未进入自动出口');
  check(storageUsed(storage) <= storageCapacity(storage), '物流仓储库存超过容量上限');
  state.buildings = completedBuildings;
  state.belts = completedBelts;
  state.items = completedItems;
  state.selectedId = null;
  state.selectedBeltId = null;
  simulateBuildings(.01);
  const passed = failures.length === 0;
  const report = passed
    ? 'QA PASS · 矿机→冶炼→矩阵生产 → 全设施授权/升级 → 分拣分流 → 星际去返 → 恒星工程 100%'
    : `QA FAIL · ${failures.join(' · ')}`;
  document.body.dataset.qaResult = passed ? 'pass' : 'fail';
  const reportNode = document.createElement('div');
  reportNode.className = `qa-report${passed ? '' : ' fail'}`;
  reportNode.textContent = report;
  query('#game-shell').append(reportNode);
  showToast(report, passed ? 'ok' : 'warning');
}

document.querySelectorAll('[data-tool]').forEach(button => {
  button.addEventListener('pointerdown', event => event.stopPropagation());
  button.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    selectTool(button.dataset.tool);
  });
});
document.querySelectorAll('[data-dock-category]').forEach(button => {
  button.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    setDockCategory(button.dataset.dockCategory);
  });
});
query('#goal-button').addEventListener('click', () => toggleGoalPanel());
query('#close-goal-panel').addEventListener('click', () => toggleGoalPanel(false));
query('#objective-detail').addEventListener('click', () => toggleGoalPanel(true));
query('#monitor-detail-button').addEventListener('click', () => toggleGoalPanel(true));
query('#goal-current-action').addEventListener('click', () => {
  const diagnostic = getFactoryDiagnostic();
  toggleGoalPanel(false);
  runDiagnosticAction(diagnostic);
});
query('#pause-button').addEventListener('click', togglePause);
query('#speed-button').addEventListener('click', toggleSimulationSpeed);
query('#career-button').addEventListener('click', () => toggleCareerPanel());
query('#close-career-panel').addEventListener('click', () => toggleCareerPanel(false));
query('#career-confirm').addEventListener('click', confirmCareer);
query('#craft-button').addEventListener('click', () => toggleCraftPanel());
query('#close-craft-panel').addEventListener('click', () => toggleCraftPanel(false));
query('#craft-recipes').addEventListener('click', event => {
  const button = event.target.closest('[data-craft]');
  if (button && !button.disabled) craftRecipe(button.dataset.craft);
});
query('#tech-button').addEventListener('click', () => toggleTechPanel());
query('#brief-tech-button').addEventListener('click', () => toggleTechPanel(true));
query('#close-tech-panel').addEventListener('click', () => toggleTechPanel(false));
query('#map-button').addEventListener('click', () => toggleStarMap());
query('#close-star-map').addEventListener('click', () => toggleStarMap(false));
query('#launch-route-button').addEventListener('click', launchRoute);
query('#stellar-project-button').addEventListener('click', contributeStellarProject);
query('#objective-action').addEventListener('click', () => runDiagnosticAction());
query('#monitor-advice-action').addEventListener('click', () => runDiagnosticAction());
query('#research-diagnostic-action').addEventListener('click', () => runDiagnosticAction());
query('#reset-button').addEventListener('click', () => {
  const storage = makeBuilding('storage', 3, -1);
  storage.baseHub = true;
  storage.stock = { ...startingStorageStock };
  state.buildings = [storage];
  state.belts = [];
  state.items = [];
  state.selectedId = null;
  state.inventory = { ...startingInventory };
  state.kits = { ...startingKits };
  state.nodes = initialNodeState.map(node => ({ ...node }));
  state.time = 6 * 3600;
  state.tech = [...startingTech];
  state.research = { current: null, progress: 0 };
  state.interstellar = makeInterstellarState();
  state.stellarProject = makeStellarProject();
  state.career = null;
  state.careerChosen = false;
  state.pendingCareer = 'logistics';
  state.researchRate = 0;
  state.basePowerGeneration = 0;
  state.powerGeneration = 0;
  state.powerLoad = 0;
  state.powerGrids = [];
  state.powerSummary = { gridCount: 0, highLoadCount: 0, blackoutCount: 0, generation: 0, load: 0 };
  state.simulationSpeed = 1;
  state.camera = { x: 0, y: 1 };
  state.zoom = .78;
  state.tool = 'inspect';
  state.dockCategory = 'extract';
  state.selectedBeltId = null;
  state.rotation = 0;
  state.pointer.startCell = null;
  state.pointer.startBuildingId = null;
  saveGame();
  renderTechPanel();
  renderStarMap();
  toggleCareerPanel(true);
  showToast('本地工厂已重置');
});
query('#close-selection').addEventListener('click', () => cancelToolSelection());
query('#selection-grid-action').addEventListener('click', () => {
  const building = state.buildings.find(entry => entry.id === state.selectedId);
  if (!building || !isPowerTowerType(building)) return;
  building.gridEnabled = building.gridEnabled === false;
  rebuildPowerGrids();
  saveGame();
  showToast(building.gridEnabled ? '电塔已重新接入外部电网' : '电塔已断开外部连接，保留局部覆盖', building.gridEnabled ? 'ok' : 'warning');
  updateHUD();
  render();
});
query('#selection-delete').addEventListener('click', () => {
  const building = state.buildings.find(entry => entry.id === state.selectedId);
  if (building) removeAt({ x: building.x, y: building.y });
  else if (state.selectedBeltId) {
    const belt = state.belts.find(entry => entry.id === state.selectedBeltId);
    if (belt) removeAt({ x: belt.x, y: belt.y });
  }
});
query('#lab-mode-options').addEventListener('click', event => {
  const button = event.target.closest('[data-lab-mode]');
  if (!button) return;
  const building = state.buildings.find(entry => entry.id === state.selectedId);
  if (!building || building.type !== 'researchLab') return;
  building.researchMode = button.dataset.labMode;
  building.manualResearchMode = button.dataset.labMode !== 'auto';
  building.process = 0;
  saveGame();
  showToast(button.dataset.labMode === 'auto' ? '科研站已切换为自动跟随' : `科研站矩阵模式 · ${resources[button.dataset.labMode].label}`);
  updateHUD();
});
query('#sorter-routing-rules').addEventListener('change', event => {
  const select = event.target.closest('[data-sorter-resource]');
  if (!select) return;
  const sorter = state.buildings.find(building => building.id === state.selectedId && building.type === 'sorter');
  if (!sorter) return;
  sorter.sorterRules = sorter.sorterRules || {};
  if (select.value) sorter.sorterRules[select.dataset.sorterResource] = select.value;
  else delete sorter.sorterRules[select.dataset.sorterResource];
  state.sorterRoutingSignature = '';
  saveGame();
  showToast(select.value ? `${resources[select.dataset.sorterResource].label} 已指定分流出口` : `${resources[select.dataset.sorterResource].label} 已恢复自动分流`);
  updateHUD();
});
query('#sorter-interface').addEventListener('click', event => {
  const button = event.target.closest('[data-sorter-mode]');
  if (!button) return;
  const sorter = state.buildings.find(entry => entry.id === state.selectedId && entry.type === 'sorter');
  if (!sorter) return;
  sorter.sorterMode = button.dataset.sorterMode === 'output' ? 'output' : 'input';
  sorter.input = sorter.input || {};
  sorter.output = sorter.output || {};
  state.sorterRoutingSignature = '';
  saveGame();
  showToast(sorter.sorterMode === 'output' ? '分拣器已切换为建筑出料' : '分拣器已切换为建筑进料');
  updateHUD();
});

canvas.addEventListener('contextmenu', event => event.preventDefault());
canvas.addEventListener('pointermove', event => {
  if (state.pointer.panning) {
    const dx = event.clientX - state.pointer.lastX;
    const dy = event.clientY - state.pointer.lastY;
    state.camera.x -= dx / (TILE * state.zoom);
    state.camera.y -= dy / (TILE * state.zoom);
    state.pointer.lastX = event.clientX; state.pointer.lastY = event.clientY;
  }
  state.pointer.cell = screenToCell(event.clientX, event.clientY);
  if (state.tool === 'belt' && state.pointer.startBuildingId) {
    const source = state.buildings.find(building => building.id === state.pointer.startBuildingId);
    if (source) state.pointer.startCell = buildingPortToward(source, state.pointer.cell);
  }
});
canvas.addEventListener('pointerdown', event => {
  if (event.button === 2) {
    if (state.tool !== 'inspect') {
      cancelToolSelection(true);
      return;
    }
    state.pointer.panning = true; state.pointer.lastX = event.clientX; state.pointer.lastY = event.clientY; canvas.setPointerCapture(event.pointerId); return;
  }
  if (event.button !== 0) return;
  state.pointer.down = true;
  state.pointer.cell = screenToCell(event.clientX, event.clientY);
  if (state.tool === 'sorter') {
    const building = findBuildingAt(state.pointer.cell);
    if (isSorterTargetBuilding(building)) {
      state.pointer.sorterAnchor = { kind: 'building', id: building.id };
      state.selectedId = building.id;
      canvas.setPointerCapture(event.pointerId);
      return;
    }
    const endpoint = sorterBeltEndpointAt(state.pointer.cell, 'end');
    if (endpoint) {
      state.pointer.sorterAnchor = { kind: 'belt', id: endpoint.belt.id, endpoint: endpoint.endpoint };
      canvas.setPointerCapture(event.pointerId);
      return;
    }
    state.pointer.down = false;
    showToast('从建筑接口或传送带端点开始拖拽', 'warning');
    return;
  }
  if (state.tool === 'belt') {
    const source = findBuildingAt(state.pointer.cell);
    state.pointer.startBuildingId = source?.id || null;
    state.pointer.startCell = source ? buildingPortToward(source, state.pointer.cell) : state.pointer.cell;
    canvas.setPointerCapture(event.pointerId);
    return;
  }
  if (state.tool === 'demolish') removeAt(state.pointer.cell);
  else if (state.tool === 'inspect') {
    const existing = findBuildingAt(state.pointer.cell);
    if (existing) {
      state.selectedId = existing.id;
      state.selectedBeltId = null;
      showToast(`${buildings[existing.type].label} · 已打开详情`);
    } else {
      const belt = findBeltAt(state.pointer.cell);
      if (belt) {
        state.selectedId = null;
        state.selectedBeltId = belt.id;
        showToast(`传送带 · ${belt.length} 格 · 已打开详情`);
      } else {
        state.selectedId = null;
        state.selectedBeltId = null;
        showToast('已取消选择');
      }
    }
  } else placeBuilding(state.pointer.cell);
});
canvas.addEventListener('pointerup', event => {
  if (event.button === 2) { state.pointer.panning = false; return; }
  if (state.tool === 'sorter' && state.pointer.sorterAnchor) {
    const preview = sorterPlacementPreview();
    if (preview?.valid) placeSorterBetween(preview.building, preview.belt, preview.mode);
    else if (preview?.reason) showToast(preview.reason, 'warning');
    state.pointer.sorterAnchor = null;
    state.pointer.down = false;
    return;
  }
  if (state.tool === 'belt' && state.pointer.startCell) {
    const releaseCell = screenToCell(event.clientX, event.clientY);
    const source = state.buildings.find(building => building.id === state.pointer.startBuildingId);
    const target = findBuildingAt(releaseCell);
    if (source && target && target.id === source.id) showToast('请把传送带拖到另一座设施', 'warning');
    else if (source && target) {
      const ports = beltPortsBetweenBuildings(source, target);
      placeBelt(ports.start, ports.end, ports.segments);
    } else {
      placeBelt(state.pointer.startCell, beltPreviewEnd(releaseCell));
    }
  }
  state.pointer.down = false; state.pointer.startCell = null;
  state.pointer.startBuildingId = null;
});
canvas.addEventListener('pointerleave', () => { if (!state.pointer.down) state.pointer.cell = null; });
canvas.addEventListener('wheel', event => {
  event.preventDefault();
  const oldZoom = state.zoom;
  state.zoom = clamp(state.zoom * (event.deltaY < 0 ? 1.1 : .9), .55, 1.65);
  const rect = canvas.getBoundingClientRect();
  const before = screenToCell(event.clientX, event.clientY);
  state.camera.x += before.x - ((event.clientX - rect.left - state.viewport.width / 2) / (TILE * state.zoom) + state.camera.x);
  state.camera.y += before.y - ((event.clientY - rect.top - state.viewport.height / 2) / (TILE * state.zoom) + state.camera.y);
  if (oldZoom !== state.zoom) showToast(`视野缩放 · ${Math.round(state.zoom * 100)}%`);
}, { passive: false });

document.addEventListener('keydown', event => {
  if (event.target.tagName === 'INPUT') return;
  const panKey = {
    arrowleft: [-1, 0],
    a: [-1, 0],
    arrowright: [1, 0],
    d: [1, 0],
    arrowup: [0, -1],
    w: [0, -1],
    arrowdown: [0, 1],
    s: [0, 1]
  }[event.key.toLowerCase()];
  if (panKey) {
    state.camera.x += panKey[0] * 1.6;
    state.camera.y += panKey[1] * 1.6;
    state.pointer.cell = null;
    event.preventDefault();
    return;
  }
  if (event.key === '0') selectTool('inspect');
  if (event.key >= '1' && event.key <= '9') selectTool(['miner', 'smelter', 'assembler', 'belt', 'demolish', 'waterPump', 'powerTower', 'longPowerTower', 'ultraPowerTower'][Number(event.key) - 1]);
  if (event.key.toLowerCase() === 'r' && state.tool !== 'inspect' && state.tool !== 'belt' && state.tool !== 'demolish') { state.rotation = (state.rotation + 90) % 360; showToast(`建筑朝向 ${state.rotation}°`); }
  if (event.key.toLowerCase() === 't') toggleTechPanel();
  if (event.key.toLowerCase() === 'm') toggleStarMap();
  if (event.key.toLowerCase() === 'c') toggleCareerPanel();
  if (event.key.toLowerCase() === 'b') toggleCraftPanel();
  if (event.code === 'Space') { event.preventDefault(); togglePause(); }
  if (event.key === 'Escape') cancelToolSelection(true);
});

let lastFrame = performance.now();
let autosaveTime = 0;
let gameStarted = false;
function loop(now) {
  const dt = Math.min(.08, (now - lastFrame) / 1000);
  lastFrame = now;
  state.animTime = now / 1000;
  const simDt = dt * state.simulationSpeed;
  if (!state.paused) { state.time += simDt * 7; simulateBuildings(simDt); simulateResearch(simDt); simulateInterstellar(simDt); }
  autosaveTime += dt;
  if (autosaveTime >= 2) { autosaveTime = 0; saveGame(); }
  updateHUD();
  render();
  requestAnimationFrame(loop);
}

function initializeGame() {
  if (gameStarted) return;
  gameStarted = true;
  window.addEventListener('resize', resize);
  resize();
  applyQaDemoState();
  if (qaPlaythroughMode) runQaPlaythrough();
  renderTechPanel();
  renderCareerPanel();
  wireOptionalAssetImages();
  updateHUD();
  if (savedPlacementRepairCount > 0) saveGame();
  showToast('选择设施，在地表网格中开始建造');
  if (savedPlacementRepairCount > 0) showToast(`已修正 ${savedPlacementRepairCount} 座压住矿脉的建筑`, 'warning');
  if (requestedPanel === 'tech') toggleTechPanel(true);
  else if (requestedPanel === 'map') toggleStarMap(true);
  else if (!state.careerChosen) toggleCareerPanel(true);
  requestAnimationFrame(loop);
}

async function bootGame() {
  try {
    await preloadGameAssets();
  } catch (error) {
    console.error('Asset preload failed; continuing with runtime fallbacks.', error);
    document.body.dataset.assetsReady = 'true';
    document.body.dataset.assetFailures = 'unknown';
    query('#asset-loader-status').textContent = '资源校验完成 · 使用程序绘制继续';
    query('#asset-loader-note').textContent = '资源请求异常已隔离，不影响建造与物流';
  }
  initializeGame();
  document.body.classList.remove('loading');
  document.body.classList.add('game-ready');
  const loader = query('#asset-loader');
  loader.classList.add('is-complete');
  window.setTimeout(() => { loader.hidden = true; }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 280);
  if (state.powerMigration) {
    window.setTimeout(() => showToast('电网规则已升级 · 请先部署基础电力塔接入旧产线', 'warning'), 360);
  }
}

bootGame();
