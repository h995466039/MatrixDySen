const canvas = document.querySelector('#game-canvas');
const ctx = canvas.getContext('2d');
const shell = document.querySelector('#game-shell');
const TILE = 48;
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
  electromagneticCube: 'output/imagegen/resource-electromagnetic-matrix-v01.png',
  energyCube: 'output/imagegen/resource-energy-matrix-v01.png',
  structureCube: 'output/imagegen/resource-structure-matrix-v01.png',
  informationCube: 'output/imagegen/resource-information-matrix-v01.png',
  miner: 'output/imagegen/building-mining-drill-v01.png',
  smelter: 'output/imagegen/building-smelter-v01.png',
  assembler: 'output/imagegen/building-assembler-v01.png',
  researchLab: 'output/imagegen/building-research-lab-v01.png',
  sorter: 'output/imagegen/building-sorter-v01.png',
  wind: 'output/imagegen/building-wind-generator-v01.png',
  thermal: 'output/imagegen/building-thermal-generator-v01.png',
  oilExtractor: 'output/imagegen/building-oil-extractor-v01.png',
  cargoShip: 'output/imagegen/space-cargo-ship-v01.png',
  hub: 'output/imagegen/building-energy-core-v01.png'
};
Object.entries(assetPaths).forEach(([key, path]) => {
  const image = new Image();
  image.src = path;
  assets[key] = image;
});

const resources = {
  copper: { label: '铜', color: '#ff9b3d', image: 'copper' },
  silicon: { label: '硅', color: '#69d8da', image: 'silicon' },
  iron: { label: '铁', color: '#b56e58', image: 'iron' },
  coal: { label: '煤', color: '#827a88' },
  crudeOil: { label: '原油', color: '#c97849' },
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
  'iron', 'copper', 'silicon', 'coal', 'crudeOil', 'ice', 'titanium',
  'ironIngot', 'copperIngot', 'siliconWafer', 'processor',
  'electromagneticCube', 'energyCube', 'structureCube', 'informationCube'
];

const buildings = {
  miner: { label: '采矿机', size: 2, color: '#ff9b3d', power: .6, cost: { iron: 8 }, tech: 'foundation', image: 'miner' },
  smelter: { label: '冶炼机', size: 2, color: '#f7c35e', power: .9, cost: { iron: 10 }, tech: 'foundation', image: 'smelter' },
  // The first assembler is the bootstrap for processors, so it cannot itself
  // require a processor. Later buildings still carry the same production
  // recipe and remain gated by power, inputs, and logistics.
  assembler: { label: '组装机', size: 2, color: '#c7d94c', power: 1.2, cost: { iron: 2 }, tech: 'automated-smelting', image: 'assembler' },
  sorter: { label: '分拣器', size: 1, color: '#69d8da', power: .1, cost: { iron: 4, copper: 2 }, tech: 'sorter-tech' },
  workbench: { label: '工作台', size: 2, color: '#e8a46e', power: .5, cost: { iron: 12, copper: 4 }, tech: 'workbench-tech' },
  wind: { label: '风力发电机', size: 2, color: '#a8e7dd', power: 0, generation: 2.6, cost: { iron: 10, copper: 6 }, tech: 'wind-power' },
  thermal: { label: '火力发电机', size: 2, color: '#ee765c', power: .2, generation: 6, cost: { iron: 18, copper: 10 }, tech: 'thermal-power' },
  oilExtractor: { label: '石油提取机', size: 2, color: '#d18a57', power: 2.2, cost: { iron: 24, processor: 2 }, tech: 'oil-processing' },
  researchLab: { label: '科研站', size: 2, color: '#7ed6ff', power: 1.6, cost: { iron: 20, processor: 4 }, tech: 'foundation', image: 'researchLab' },
  hub: { label: '能源核心', size: 3, color: '#69d8da', power: 0, generation: 12, cost: {}, tech: 'foundation', image: 'hub' }
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
    { id: 'interstellar-logistics', label: '星际物流', short: '跨星际主干', description: '接入恒星系航线，允许派遣货运舱回收异星资源。', requires: ['matrix-lab'], cube: 'informationCube', cost: 32, unlocks: ['星图与货运舱'] },
    { id: 'stellar-network', label: '恒星网络', short: '跨星际主干', description: '让远端信标加入同一条物流网络，开放档案星航线。', requires: ['interstellar-logistics'], cube: 'informationCube', cost: 40, unlocks: ['档案星航线'] },
    { id: 'dyson-frame', label: '戴森框架', short: '恒星工程', description: '用异星资源搭建包围恒星的第一圈能量框架。', requires: ['stellar-network'], cube: 'structureCube', cost: 48, unlocks: ['恒星工程阶段'] }
  ],
  branches: [
    { id: 'sorter-tech', label: '智能分拣', short: '物流分支', description: '允许将物料包导向不同产线。', requires: ['planetary-logistics'], cube: 'electromagneticCube', cost: 12, unlocks: ['sorter'], effectText: '解锁分拣器' },
    { id: 'belt-mk2', label: '高速传送', short: '物流分支', description: '提升物流网络的吞吐能力。', requires: ['sorter-tech'], cube: 'energyCube', cost: 14, upgrades: ['belt'], effectText: '传送带速度 +43%' },
    { id: 'wind-power', label: '风能捕获', short: '能源分支', description: '用行星风场提供稳定的基础电力。', requires: ['planetary-logistics'], cube: 'electromagneticCube', cost: 8, unlocks: ['wind'], effectText: '解锁风力发电机' },
    { id: 'thermal-power', label: '热能转化', short: '能源分支', description: '消耗煤炭，将化学能转化为电力。', requires: ['wind-power'], cube: 'energyCube', cost: 14, unlocks: ['thermal'], effectText: '解锁火力发电机' },
    { id: 'oil-processing', label: '石化开采', short: '能源分支', description: '从原油渗流区建立压力开采。', requires: ['planetary-logistics'], cube: 'energyCube', cost: 16, unlocks: ['oilExtractor'], effectText: '解锁石油提取机' },
    { id: 'workbench-tech', label: '精密工作台', short: '制造分支', description: '允许小批量制造电路与研究组件。', cube: 'electromagneticCube', cost: 8, unlocks: ['workbench'], upgrades: ['workbench'], effectText: '解锁工作台 · 工作台速度 +27%' },
    { id: 'advanced-assembly', label: '高级组装', short: '制造分支', description: '为处理器和矩阵生产提供更高效率。', requires: ['automated-smelting'], cube: 'structureCube', cost: 18, upgrades: ['assembler', 'workbench'], effectText: '组装机与工作台速度 +30%' },
    { id: 'mining-mk2', label: '高压采掘', short: '工业分支', description: '升级采矿机钻头与排矿节拍，减少矿脉等待时间。', requires: ['planetary-logistics'], cube: 'energyCube', cost: 18, upgrades: ['miner'], effectText: '采矿机速度 +35%' },
    { id: 'power-grid-mk2', label: '电网增容', short: '能源分支', description: '升级能源核心与发电设施的能量转换模块。', requires: ['thermal-power'], cube: 'structureCube', cost: 24, upgrades: ['hub', 'wind', 'thermal'], effectText: '能源核心与发电机输出 +25%' },
    { id: 'oil-extractor-mk2', label: '深层泵压', short: '能源分支', description: '为石油提取机加装深层泵压模块，提升原油采集速率。', requires: ['oil-processing'], cube: 'structureCube', cost: 20, upgrades: ['oilExtractor'], effectText: '石油提取机速度 +35%' }
  ]
};
const foundationTech = { id: 'foundation', label: '基础工业授权', short: '初始权限', description: '授予母星基地的第一套工业设施许可证。', requires: [], cube: 'electromagneticCube', cost: 0, unlocks: ['miner', 'smelter', 'researchLab', 'hub'], effectText: '解锁采矿机、冶炼机、科研站与能源核心' };
const techNodes = [foundationTech, ...techTree.mainline, ...techTree.branches];
const techById = Object.fromEntries(techNodes.map(tech => [tech.id, tech]));
const startingTech = ['foundation'];
const startingInventory = { iron: 180, copper: 80, silicon: 50, coal: 8, crudeOil: 0, titanium: 0, ironIngot: 4, copperIngot: 6, siliconWafer: 6, processor: 12, electromagneticCube: 0, energyCube: 0, structureCube: 0, informationCube: 0 };
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
    bonus: '发电量 +20%', detail: '能源核心、风力和火力发电机提供更多电力，适合早期铺开多条产线。',
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
  { id: 'silicon-west', x: 5, y: -4, resource: 'silicon', amount: 28100 },
  { id: 'iron-east', x: 6, y: 5, resource: 'iron', amount: 91600 },
  { id: 'ice-south', x: -6, y: 7, resource: 'ice', amount: 46200 },
  { id: 'coal-north-east', x: 10, y: -5, resource: 'coal', amount: 53600 },
  { id: 'oil-east', x: 11, y: 6, resource: 'crudeOil', amount: 78000 }
];
const initialNodeState = nodes.map(node => ({ ...node }));

const planetCatalog = [
  { id: 'home', name: '晨星-03', kicker: 'HOMEWORLD / BASE', role: '母星基地', description: '母星工业区。所有货运舱从这里发射，回收物会直接进入能源核心库存。', resources: '本地资源：铁、铜、硅', color: '#69d8da', requires: [], position: { x: .5, y: .5 } },
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
  return { id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type, x, y, rotation, input: {}, output: {}, process: 0, timer: 0, nodeId: null, researchMode: type === 'researchLab' ? 'auto' : undefined, manualResearchMode: false, sorterRules: type === 'sorter' ? {} : undefined, routeCursor: type === 'sorter' ? 0 : undefined };
}

function normalizeSavedBuildings(savedBuildings) {
  return savedBuildings.filter(building => building && buildings[building.type]).map(building => {
    const normalized = {
      ...building,
      input: { ...(building.input || {}) },
      output: { ...(building.output || {}) },
      sorterRules: building.type === 'sorter' ? { ...(building.sorterRules || {}) } : undefined,
      routeCursor: building.type === 'sorter' ? Math.max(0, Number.isInteger(building.routeCursor) ? building.routeCursor : 0) : undefined
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

function readSave() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || localStorage.getItem(LEGACY_SAVE_KEY) || 'null');
    if (!saved) return null;
    const savedBuildings = Array.isArray(saved.buildings) ? normalizeSavedBuildings(saved.buildings) : [];
    return {
      buildings: savedBuildings.length ? savedBuildings : [makeBuilding('hub', -1, -1)],
      belts: Array.isArray(saved.belts) ? saved.belts : [],
      inventory: { ...startingInventory, ...(saved.inventory || {}) },
      nodes: Array.isArray(saved.nodes) && saved.nodes.length ? saved.nodes : initialNodeState.map(node => ({ ...node })),
      time: Number.isFinite(saved.time) ? saved.time : 6 * 3600,
      tech: Array.isArray(saved.tech) && saved.tech.length ? [...new Set(['foundation', ...saved.tech])] : [...startingTech],
      research: saved.research && typeof saved.research === 'object' ? saved.research : { current: null, progress: 0 },
      interstellar: makeInterstellarState(saved.interstellar),
      stellarProject: makeStellarProject(saved.stellarProject),
      career: saved.career || 'logistics',
      careerChosen: saved.careerChosen !== false
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
  tool: 'miner',
  rotation: 0,
  paused: false,
  animTime: 0,
  selectedId: null,
  pointer: { cell: { x: 0, y: 0 }, down: false, startCell: null, startBuildingId: null, panning: false, lastX: 0, lastY: 0 },
  buildings: saved?.buildings || [makeBuilding('hub', -1, -1)],
  belts: saved?.belts || [],
  nodes: saved?.nodes || initialNodeState.map(node => ({ ...node })),
  items: [],
  inventory: { ...startingInventory, ...(saved?.inventory || {}) },
  time: saved?.time ?? 6 * 3600,
  tech: saved?.tech || [...startingTech],
  research: saved?.research || { current: null, progress: 0 },
  interstellar: makeInterstellarState(saved?.interstellar),
  stellarProject: makeStellarProject(saved?.stellarProject),
  career: saved ? (saved.career || 'logistics') : null,
  careerChosen: saved ? saved.careerChosen !== false : false,
  pendingCareer: saved?.career || 'logistics',
  researchRate: 0,
  powerGeneration: 12,
  lastToast: 0,
  powerLoad: 0,
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

function drawGround() {
  const { width, height } = state.viewport;
  ctx.fillStyle = '#081522';
  ctx.fillRect(0, 0, width, height);

  const minX = Math.floor(state.camera.x - width / (2 * TILE * state.zoom)) - 2;
  const maxX = Math.ceil(state.camera.x + width / (2 * TILE * state.zoom)) + 2;
  const minY = Math.floor(state.camera.y - height / (2 * TILE * state.zoom)) - 2;
  const maxY = Math.ceil(state.camera.y + height / (2 * TILE * state.zoom)) + 2;
  for (let x = minX; x <= maxX; x += 1) {
    for (let y = minY; y <= maxY; y += 1) {
      const point = worldToScreen(x, y);
      const size = TILE * state.zoom;
      ctx.fillStyle = (x + y) % 2 === 0 ? 'rgba(18,42,54,.64)' : 'rgba(14,35,47,.64)';
      ctx.fillRect(point.x, point.y, size + 1, size + 1);
    }
  }

  ctx.strokeStyle = state.tool === 'belt' ? 'rgba(105,216,218,.31)' : 'rgba(165,204,200,.18)';
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

  const hub = worldToScreen(-1, -1);
  const hubSize = 3 * TILE * state.zoom;
  ctx.strokeStyle = 'rgba(105,216,218,.2)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(hub.x + hubSize / 2, hub.y + hubSize / 2, hubSize * .76, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(199,217,76,.12)';
  ctx.beginPath(); ctx.arc(hub.x + hubSize / 2, hub.y + hubSize / 2, hubSize * 1.2, 0, Math.PI * 2); ctx.stroke();
}

function drawDysonConstruction() {
  const progress = state.stellarProject?.progress || 0;
  if (progress <= 0) return;
  const hub = worldToScreen(.5, .5);
  const radius = TILE * state.zoom * 2.8;
  const builtSegments = Math.ceil(progress / 12.5);
  ctx.save();
  ctx.translate(hub.x, hub.y);
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
  const bounds = { minX: -18, maxX: 18, minY: -12, maxY: 12 };
  const isOpen = cell => {
    if (cell.x < bounds.minX || cell.x > bounds.maxX || cell.y < bounds.minY || cell.y > bounds.maxY) return false;
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
  const color = preview ? '#69d8da' : '#4db7c2';
  beltCells(belt).forEach((cell, index) => {
    const point = worldToScreen(cell.x, cell.y);
    const size = TILE * state.zoom;
    const horizontal = belt.dx !== 0;
    ctx.save();
    ctx.globalAlpha = preview ? .55 : .88;
    ctx.fillStyle = preview ? 'rgba(105,216,218,.22)' : 'rgba(16,49,63,.94)';
    const bridge = belt.dx === 0 && belt.dy === 0;
    const beltX = bridge ? point.x + size * .2 : horizontal ? point.x + 4 : point.x + size * .33;
    const beltY = bridge ? point.y + size * .2 : horizontal ? point.y + size * .33 : point.y + 4;
    const beltWidth = bridge ? size * .6 : horizontal ? size - 8 : size * .34;
    const beltHeight = bridge ? size * .6 : horizontal ? size * .34 : size - 8;
    roundedRect(ctx, beltX, beltY, beltWidth, beltHeight, 4); ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, state.zoom * 1.5);
    ctx.stroke();
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
  if (building.type === 'hub') return true;
  if (state.paused) return false;
  if (building.type === 'wind') return true;
  if (building.type === 'thermal') return (building.input.coal || 0) > 0;
  if (building.type === 'miner' || building.type === 'oilExtractor') return building.timer > .15 || Object.values(building.output).some(amount => amount > 0);
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
  } else if (building.type === 'hub') {
    ctx.rotate(time * .28);
    ctx.strokeStyle = '#69d8da66'; ctx.lineWidth = Math.max(1, size * .012);
    ctx.beginPath(); ctx.arc(0, 0, size * .36, -.2, Math.PI * 1.25); ctx.stroke();
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
  ctx.fillStyle = building.type === 'hub' ? 'rgba(18,66,82,.94)' : 'rgba(14,29,42,.96)';
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
  } else if (building.type === 'hub') {
    ctx.strokeStyle = '#69d8da'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(size / 2, size / 2 - 2, size * .25, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#b9ffff'; ctx.beginPath(); ctx.arc(size / 2, size / 2 - 2, size * .08, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(105,216,218,.5)';
    ctx.beginPath(); ctx.moveTo(size * .2, size * .72); ctx.lineTo(size * .8, size * .72); ctx.stroke();
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
  if (building.type !== 'hub' && ['科技锁定', '电力不足', '输出堵塞', '缺少输入', '等待矩阵组件', '缺煤'].includes(status)) {
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

function drawBeltPortHints() {
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
        const invalid = cells.some(cell => overlapsBuilding(cell.x, cell.y, 1) || beltAt(cell));
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

function overlapsBuilding(x, y, size) {
  return state.buildings.some(building => x < building.x + buildings[building.type].size && x + size > building.x && y < building.y + buildings[building.type].size && y + size > building.y);
}

function canAfford(cost, multiplier = 1) {
  return Object.entries(cost).every(([resource, amount]) => (state.inventory[resource] || 0) >= amount * multiplier);
}

function spend(cost, multiplier = 1) {
  Object.entries(cost).forEach(([resource, amount]) => { state.inventory[resource] = (state.inventory[resource] || 0) - amount * multiplier; });
}

function refund(cost, ratio = .6) {
  Object.entries(cost).forEach(([resource, amount]) => { state.inventory[resource] = (state.inventory[resource] || 0) + Math.floor(amount * ratio); });
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
    if ((state.inventory.energyCube || 0) < 1) return 'energyCube';
    if ((state.inventory.structureCube || 0) < 1) return 'structureCube';
  }
  return targetCube;
}

function placementCheck(type, cell) {
  const meta = buildings[type];
  if (!meta) return { valid: false, reason: '未知设施' };
  if (!isBuildingUnlocked(type)) {
    return { valid: false, reason: `需要完成「${buildingTechName(type)}」` };
  }
  if (cell.x < -18 || cell.x > 18 || cell.y < -12 || cell.y > 12) return { valid: false, reason: '超出可建造区域' };
  if (overlapsBuilding(cell.x, cell.y, meta.size)) return { valid: false, reason: '空间被占用' };
  if (!canAfford(meta.cost)) return { valid: false, reason: '建材不足' };
  const node = findNodeForBuilding({ type, x: cell.x, y: cell.y });
  if (type === 'miner' && (!node || node.resource === 'crudeOil')) return { valid: false, reason: '采矿机必须覆盖矿脉' };
  if (type === 'oilExtractor' && node?.resource !== 'crudeOil') return { valid: false, reason: '石油提取机必须覆盖原油渗流区' };
  return { valid: true };
}

function placeBuilding(cell) {
  const check = placementCheck(state.tool, cell);
  if (!check.valid) { showToast(check.reason, 'warning'); return; }
  const building = makeBuilding(state.tool, cell.x, cell.y, state.rotation);
  if (state.tool === 'miner') building.nodeId = findNodeForBuilding(building)?.id || null;
  if (state.tool === 'oilExtractor') building.nodeId = findNodeForBuilding(building)?.id || null;
  spend(buildings[state.tool].cost);
  state.buildings.push(building);
  state.selectedId = building.id;
  saveGame();
  showToast(`${buildings[state.tool].label} 已部署`);
}

function beltAt(cell) {
  return state.belts.find(belt => beltCells(belt).some(entry => entry.x === cell.x && entry.y === cell.y));
}

function placeBelt(start, end, presetSegments = null) {
  const rawSegments = presetSegments || (start && end ? beltSegmentsBetween(start, end) : []);
  const segments = freeBeltSegments(trimBeltExtension(start, rawSegments), start);
  if (!segments.length) { showToast('传送带至少需要两个网格', 'warning'); return; }
  const cells = segments.flatMap(beltCells);
  if (cells.some(cell => cell.x < -18 || cell.x > 18 || cell.y < -12 || cell.y > 12 || overlapsBuilding(cell.x, cell.y, 1))) { showToast('传送带不能穿过设施或边界', 'warning'); return; }
  const newCells = cells.filter(cell => !beltAt(cell));
  if (!canAfford({ iron: 1 }, newCells.length)) { showToast('铁锭不足，无法铺设这段传送带', 'warning'); return; }
  spend({ iron: 1 }, newCells.length);
  state.belts.push(...segments.map(segment => ({
    ...segment,
    id: `belt-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`
  })));
  saveGame();
  showToast(`传送带已铺设 · ${cells.length} 格`);
}

function removeAt(cell) {
  const building = findBuildingAt(cell);
  if (building && building.type !== 'hub') {
    state.buildings = state.buildings.filter(item => item.id !== building.id);
    refund(buildings[building.type].cost);
    state.selectedId = null;
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
    state.inventory.iron += Math.floor(belt.length * .6);
    state.items = state.items.filter(item => item.beltId !== belt.id);
    saveGame();
    showToast('传送带已回收');
    return;
  }
  showToast('这里没有可拆除对象', 'warning');
}

function findBeltStartingNear(building, resource) {
  if (building.type === 'sorter') return findSorterOutputBelt(building, resource);
  return state.belts.find(belt => isAdjacentToBuilding({ x: belt.x, y: belt.y }, building) && Boolean(findDestinationAlongRoute(belt, resource, building.id)));
}

function sorterOutputBelts(sorter) {
  if (!sorter || sorter.type !== 'sorter') return [];
  return state.belts
    .filter(belt => isAdjacentToBuilding({ x: belt.x, y: belt.y }, sorter))
    .sort((left, right) => left.y - right.y || left.x - right.x || left.id.localeCompare(right.id));
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

function accepts(building, resource) {
  if (!isBuildingOperational(building)) return false;
  if (building.type === 'hub') return Boolean(resources[resource]);
  if (building.type === 'smelter') {
    // One smelter is one recipe line. This prevents a shared line from
    // silently filling with three ores while producing none of them reliably.
    return ['copper', 'iron', 'silicon'].includes(resource) && (!building.recipeResource || building.recipeResource === resource);
  }
  if (building.type === 'assembler') return ['copperIngot', 'siliconWafer'].includes(resource);
  if (building.type === 'workbench') return ['ironIngot', 'copperIngot', 'siliconWafer'].includes(resource);
  if (building.type === 'thermal') return resource === 'coal';
  if (building.type === 'sorter') return Boolean(resources[resource]);
  if (building.type === 'researchLab') {
    const cube = labProductionCube(building);
    return Object.prototype.hasOwnProperty.call(cubeRecipes[cube]?.inputs || {}, resource);
  }
  return false;
}

function inputCapacity(building) {
  if (!building || building.type === 'hub') return Infinity;
  if (building.type === 'researchLab') return 6;
  if (building.type === 'smelter' || building.type === 'thermal') return 8;
  if (building.type === 'assembler' || building.type === 'workbench') return 6;
  return 4;
}

function outputCapacity(building) {
  return building?.type === 'miner' || building?.type === 'oilExtractor' ? 5 : 6;
}

function deliver(building, resource) {
  if (!accepts(building, resource)) return false;
  if (building.type === 'hub') state.inventory[resource] = (state.inventory[resource] || 0) + 1;
  else if (building.type === 'sorter') {
    if ((building.input[resource] || 0) >= inputCapacity(building)) return false;
    building.input[resource] = (building.input[resource] || 0) + 1;
  }
  else {
    if ((building.input[resource] || 0) >= inputCapacity(building)) return false;
    if (building.type === 'smelter' && !building.recipeResource) building.recipeResource = resource;
    building.input[resource] = (building.input[resource] || 0) + 1;
  }
  return true;
}

function findDestination(belt, resource, sourceId = null) {
  const end = getBeltEnd(belt);
  const candidates = state.buildings.filter(building => building.id !== sourceId && accepts(building, resource) && isAdjacentToBuilding(end, building));
  // The core is a warehouse fallback. Processing buildings must win when both
  // a machine and the core touch the same belt endpoint.
  return candidates.find(building => building.type !== 'hub') || candidates.find(building => building.type === 'hub');
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

function dispatchWarehouseStock() {
  const hub = state.buildings.find(building => building.type === 'hub');
  if (!isBuildingOperational(hub)) return;
  state.belts
    .filter(belt => isAdjacentToBuilding({ x: belt.x, y: belt.y }, hub))
    .forEach(belt => {
      // Keep one warehouse cargo per belt in flight. A full destination must
      // not turn into an unbounded queue of invisible cargo.
      if (state.items.some(item => item.sourceId === hub.id && item.beltId === belt.id)) return;
      const resource = Object.keys(state.inventory).find(candidate => {
        if ((state.inventory[candidate] || 0) <= 0) return false;
        const destination = findDestinationAlongRoute(belt, candidate, hub.id);
        return destination && destination.id !== hub.id;
      });
      if (!resource) return;
      state.inventory[resource] -= 1;
      state.items.push({ id: `${Date.now()}-${Math.random()}`, beltId: belt.id, sourceId: hub.id, resource, progress: 0 });
    });
}

function hasRecipeInputs(input, recipe) {
  return Object.entries(recipe.inputs).every(([resource, amount]) => (input[resource] || 0) >= amount);
}

function consumeRecipeInputs(input, recipe) {
  Object.entries(recipe.inputs).forEach(([resource, amount]) => { input[resource] -= amount; });
}

function getBeltTravelFactor() {
  const techFactor = isTechUnlocked('belt-mk2') ? .28 : .4;
  return activeCareer().effect === 'beltSpeed' ? techFactor * .75 : techFactor;
}

function getMiningTime(building) {
  const base = building?.type === 'oilExtractor' ? 1.2 : .9;
  if (building?.type === 'oilExtractor' && isTechUnlocked('oil-extractor-mk2')) return base * .65;
  if (building?.type === 'miner' && isTechUnlocked('mining-mk2')) return base * .65;
  return base;
}

function getSmeltingTime() {
  return isTechUnlocked('automated-smelting') ? 1.05 : 1.4;
}

function getAssemblyTime(building) {
  const base = building.type === 'workbench' ? 2.8 : 2.2;
  const workbenchUpgrade = building.type === 'workbench' && isTechUnlocked('workbench-tech') ? .79 : 1;
  const advancedUpgrade = isTechUnlocked('advanced-assembly') ? .7 : 1;
  return base * workbenchUpgrade * advancedUpgrade;
}

function getResearchProductionTime(building, cube) {
  const base = cubeRecipes[cube]?.time || 4.2;
  return isTechUnlocked('matrix-lab') ? base * .8 : base;
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
  return 1 + buildingUpgradeTechs(type).filter(tech => isTechUnlocked(tech.id)).length;
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

function pullResearchInputsFromCore(building, recipe) {
  const hub = state.buildings.find(entry => entry.type === 'hub');
  if (!hub || !building || !recipe) return;
  Object.entries(recipe.inputs).forEach(([resource, amount]) => {
    const missing = Math.max(0, amount - (building.input[resource] || 0));
    if (!missing) return;
    const available = Math.min(missing, state.inventory[resource] || 0);
    if (available <= 0) return;
    state.inventory[resource] -= available;
    building.input[resource] = (building.input[resource] || 0) + available;
  });
}

function getResearchSpeed() {
  return activeCareer().effect === 'research' ? 1.3 : 1;
}

function simulateBuildings(dt) {
  const operationalBuildings = state.buildings.filter(isBuildingOperational);
  state.powerLoad = operationalBuildings.reduce((total, building) => total + (buildings[building.type]?.power || 0), 0);
  state.powerGeneration = operationalBuildings.reduce((total, building) => {
    if (building.type === 'thermal' && (building.input.coal || 0) <= 0) return total;
    return total + getPowerGeneration(building);
  }, 0);
  const powered = state.powerGeneration >= state.powerLoad;

  dispatchWarehouseStock();

  state.buildings.forEach(building => {
    if (!isBuildingOperational(building)) return;
    if (building.type === 'miner' || building.type === 'oilExtractor') {
      const node = state.nodes.find(item => item.id === building.nodeId);
      const correctResource = building.type === 'oilExtractor' ? node?.resource === 'crudeOil' : node?.resource !== 'crudeOil';
      if (!node || !correctResource || node.amount <= 0 || !powered) return;
      building.timer += dt;
      const extractionTime = getMiningTime(building);
      if (building.timer >= extractionTime && Object.values(building.output).reduce((a, b) => a + b, 0) < 5) {
        building.timer = 0;
        building.output[node.resource] = (building.output[node.resource] || 0) + 1;
        node.amount -= 1;
      }
    }

    if (building.type === 'smelter' && powered) {
      if (Object.values(building.output).reduce((sum, amount) => sum + amount, 0) >= outputCapacity(building)) return;
      const raw = building.recipeResource || ['copper', 'iron', 'silicon'].find(resource => (building.input[resource] || 0) > 0);
      if (!raw) return;
      building.process += dt;
      if (building.process >= getSmeltingTime()) {
        building.process = 0;
        building.input[raw] -= 1;
        const output = raw === 'silicon' ? 'siliconWafer' : `${raw}Ingot`;
        building.output[output] = (building.output[output] || 0) + 1;
      }
    }

    if ((building.type === 'assembler' || building.type === 'workbench') && powered) {
      if (Object.values(building.output).reduce((sum, amount) => sum + amount, 0) >= outputCapacity(building)) return;
      const recipe = building.type === 'workbench'
        ? { inputs: { ironIngot: 1, copperIngot: 1 }, output: 'processor', time: getAssemblyTime(building) }
        : { inputs: { copperIngot: 1, siliconWafer: 1 }, output: 'processor', time: getAssemblyTime(building) };
      if (!hasRecipeInputs(building.input, recipe)) return;
      building.process += dt;
      if (building.process >= recipe.time) {
        building.process = 0;
        consumeRecipeInputs(building.input, recipe);
        building.output[recipe.output] = (building.output[recipe.output] || 0) + 1;
      }
    }

    if (building.type === 'sorter' && powered) {
      if (Object.values(building.output).reduce((sum, amount) => sum + amount, 0) >= outputCapacity(building)) return;
      const entry = Object.entries(building.input).find(([, amount]) => amount > 0);
      if (!entry) return;
      building.process += dt;
      if (building.process >= .22) {
        building.process = 0;
        const [resource] = entry;
        building.input[resource] -= 1;
        building.output[resource] = (building.output[resource] || 0) + 1;
      }
    }

    if (building.type === 'researchLab' && powered) {
      if (Object.values(building.output).reduce((sum, amount) => sum + amount, 0) >= outputCapacity(building)) return;
      const target = researchTarget();
      const cube = labProductionCube(building);
      const recipe = cubeRecipes[cube];
      if (!recipe) return;
      pullResearchInputsFromCore(building, recipe);
      Object.entries(building.input).forEach(([resource, amount]) => {
        if (recipe.inputs[resource] === undefined) {
          state.inventory[resource] = (state.inventory[resource] || 0) + amount;
          delete building.input[resource];
        }
      });
      if (!hasRecipeInputs(building.input, recipe)) return;
      building.process += dt;
      if (building.process >= getResearchProductionTime(building, cube)) {
        building.process = 0;
        consumeRecipeInputs(building.input, recipe);
        building.output[cube] = (building.output[cube] || 0) + 1;
      }
    }

    if (building.type === 'thermal' && powered && (building.input.coal || 0) > 0) {
      building.fuelTimer = (building.fuelTimer || 0) + dt;
      if (building.fuelTimer >= 4) {
        building.fuelTimer = 0;
        building.input.coal -= 1;
      }
    }
  });

  state.buildings.forEach(building => {
    if (!isBuildingOperational(building)) return;
    Object.entries(building.output).forEach(([resource, amount]) => {
      if (amount <= 0 || state.items.some(item => item.sourceId === building.id && item.resource === resource)) return;
      const belt = findBeltStartingNear(building, resource);
      if (!belt) {
        if (building.type === 'researchLab') {
          building.output[resource] -= 1;
          state.inventory[resource] = (state.inventory[resource] || 0) + 1;
        }
        return;
      }
      building.output[resource] -= 1;
      state.items.push({ id: `${Date.now()}-${Math.random()}`, beltId: belt.id, sourceId: building.id, resource, progress: 0 });
    });
  });

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
    } else if (item.sourceId === state.buildings.find(building => building.type === 'hub')?.id) {
      // Return rejected warehouse cargo instead of leaving a dead item at a port.
      state.inventory[item.resource] = (state.inventory[item.resource] || 0) + 1;
      return false;
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
  const labCount = state.buildings.filter(building => building.type === 'researchLab' && isBuildingOperational(building)).length;
  if (!labCount) return;
  const available = state.inventory[tech.cube] || 0;
  if (available <= 0) return;
  const consumed = Math.min(available, dt * 1.25 * labCount * getResearchSpeed());
  state.inventory[tech.cube] -= consumed;
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
  if ((state.inventory[cargo.resource] || 0) < cargo.amount) {
    showToast(`货舱需要 ${resources[cargo.resource].label} ×${cargo.amount}`, 'warning');
    return;
  }
  state.inventory[cargo.resource] -= cargo.amount;
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
  state.inventory[reward.resource] = (state.inventory[reward.resource] || 0) + reward.amount;
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
  if (!canAfford(stellarModuleCost)) { showToast(`材料不足 · ${formatCost(stellarModuleCost)}`, 'warning'); return; }
  spend(stellarModuleCost);
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
  button.disabled = !unlocked || complete || !canAfford(stellarModuleCost);
  query('#stellar-project-cost').textContent = !unlocked ? '完成「戴森框架」后可用' : complete ? '恒星工程阶段完成' : button.disabled ? `材料不足 · ${formatCost(stellarModuleCost)}` : `消耗 ${formatCost(stellarModuleCost)}`;
}

function renderCargoOptions() {
  const host = query('#cargo-options');
  if (!host) return;
  host.innerHTML = cargoOptions().map(option => {
    const active = state.interstellar.cargo === option.resource;
    const available = state.inventory[option.resource] || 0;
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
  const cargoAvailable = (state.inventory[cargo.resource] || 0) >= cargo.amount;
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
  const available = tech ? state.inventory[tech.cube] || 0 : 0;
  const status = !tech
    ? (labs ? '科研网络待命' : '需要部署科研站')
    : !labs
      ? '等待科研站接入'
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
  query('#tech-button-state').textContent = tech ? `研究 ${Math.floor(percent)}%` : `${state.tech.filter(id => techTree.mainline.some(node => node.id === id)).length}/${techTree.mainline.length}`;
  query('#mainline-count').textContent = `${techTree.mainline.filter(node => isTechUnlocked(node.id)).length} / ${techTree.mainline.length}`;
  query('#branch-count').textContent = `${techTree.branches.filter(node => isTechUnlocked(node.id)).length} / ${techTree.branches.length}`;
  all('[data-matrix]').forEach(item => {
    const resource = item.dataset.matrix;
    item.classList.toggle('matrix-active', tech?.cube === resource);
    const counter = query(`#matrix-${resource}`);
    if (counter) counter.textContent = formatNumber(state.inventory[resource] || 0);
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
  const hub = state.buildings.find(building => building.type === 'hub');
  if (!hub) return;
  const hubPoint = worldToScreen(hub.x + 1.5, hub.y + 1.5);
  state.buildings.forEach((building, index) => {
    if (building.type === 'hub' || !isBuildingActive(building)) return;
    const point = worldToScreen(building.x + buildings[building.type].size / 2, building.y + buildings[building.type].size / 2);
    ctx.save();
    ctx.strokeStyle = 'rgba(105,216,218,.12)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 7]);
    ctx.beginPath(); ctx.moveTo(hubPoint.x, hubPoint.y); ctx.lineTo(point.x, point.y); ctx.stroke();
    ctx.setLineDash([]);
    const pulse = (state.animTime * .72 + index * .21) % 1;
    const pulsePoint = { x: hubPoint.x + (point.x - hubPoint.x) * pulse, y: hubPoint.y + (point.y - hubPoint.y) * pulse };
    ctx.fillStyle = 'rgba(185,255,255,.82)';
    ctx.shadowColor = '#69d8da'; ctx.shadowBlur = 9;
    ctx.beginPath(); ctx.arc(pulsePoint.x, pulsePoint.y, Math.max(1.5, state.zoom * 1.8), 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  });
  const orbitRadius = 34 * state.zoom;
  for (let index = 0; index < 4; index += 1) {
    const angle = state.animTime * (.55 + index * .04) + index * Math.PI / 2;
    const point = { x: hubPoint.x + Math.cos(angle) * orbitRadius, y: hubPoint.y + Math.sin(angle) * orbitRadius * .58 };
    ctx.fillStyle = index % 2 ? '#c7d94c' : '#69d8da';
    ctx.globalAlpha = .7;
    ctx.beginPath(); ctx.arc(point.x, point.y, Math.max(1.1, state.zoom * 1.5), 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawPreview() {
  const cell = state.pointer.cell;
  if (!cell) return;
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
  ctx.save();
  ctx.globalAlpha = .45;
  ctx.fillStyle = check.valid ? `${meta.color}36` : 'rgba(238,106,101,.24)';
  ctx.strokeStyle = check.valid ? meta.color : '#ee6a65';
  ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
  ctx.translate(point.x + size / 2, point.y + size / 2); ctx.rotate((state.rotation * Math.PI) / 180); ctx.strokeRect(-size / 2 + 2, -size / 2 + 2, size - 4, size - 6); ctx.fillRect(-size / 2 + 2, -size / 2 + 2, size - 4, size - 6); ctx.restore();
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
  drawFactorySignals();
  state.buildings.forEach(drawBuilding);
  drawBeltPortHints();
  drawItems();
  drawPreview();
}

function hasBeltToBuilding(target, resourcesToCheck) {
  return state.belts.some(belt => resourcesToCheck.some(resource => findDestination(belt, resource) === target));
}

function hasWarehouseRoute(target, resourcesToCheck) {
  const hub = state.buildings.find(building => building.type === 'hub');
  if (!hub || !target) return false;
  return state.belts.some(belt => {
    if (!isAdjacentToBuilding({ x: belt.x, y: belt.y }, hub)) return false;
    return resourcesToCheck.some(resource => findDestinationAlongRoute(belt, resource, hub.id) === target);
  });
}

function hasInputRouteToBuilding(target, resource) {
  if (!target) return false;
  const direct = state.belts.some(belt => {
    if (!isAdjacentToBuilding({ x: belt.x, y: belt.y }, target)) return false;
    return findDestinationAlongRoute(belt, resource, target.id) === target;
  });
  return direct || hasWarehouseRoute(target, [resource]);
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

function updateObjective() {
  const hasMiner = state.buildings.some(building => building.type === 'miner' && isBuildingOperational(building));
  const hasSmelter = state.buildings.some(building => building.type === 'smelter' && isBuildingOperational(building));
  const hasResearchLab = state.buildings.some(building => building.type === 'researchLab' && isBuildingOperational(building));
  const miner = state.buildings.find(building => building.type === 'miner' && isBuildingOperational(building));
  const minerNode = miner && state.nodes.find(node => node.id === miner.nodeId);
  const hasProcessingLink = Boolean(miner && minerNode && findBeltStartingNear(miner, minerNode.resource));
  const researchLab = state.buildings.find(building => building.type === 'researchLab' && isBuildingOperational(building));
  const researchInputs = researchLab ? Object.keys(researchLab.input || {}) : [];
  const hasResearchLink = Boolean(researchLab && (
    state.research.current
    || !state.research.current && researchInputs.some(resource => ['copperIngot', 'siliconWafer', 'energyCube', 'structureCube'].includes(resource))
    || hasBeltToBuilding(researchLab, ['copperIngot', 'siliconWafer', 'energyCube', 'structureCube'])
    || state.tech.some(id => techTree.mainline.some(tech => tech.id === id))
  ));
  const hasFirstResearch = state.tech.some(id => techTree.mainline.some(tech => tech.id === id));
  const hasFirstTrip = state.interstellar.completedTrips > 0;
  const title = query('#objective-title');
  const text = query('#objective-text');
  const fill = query('#objective-fill');
  const nextTech = techTree.mainline.find(tech => !isTechUnlocked(tech.id) && hasTechPrerequisites(tech));
  const processorGap = processorProductionGap();
  let action = '选择采矿机';
  if (!hasMiner) { title.textContent = '让第一条产线跑起来'; text.textContent = '先选采矿机，放在铜矿脉上，再把矿石送入熔炼炉。'; fill.style.width = '14%'; action = '选择采矿机'; }
  else if (!hasSmelter) { title.textContent = '先放加工端'; text.textContent = '把熔炼机放在矿机旁边，留出一格或两格作为传送带接口。'; fill.style.width = '28%'; action = '选择熔炼炉'; }
  else if (!hasProcessingLink) { title.textContent = '把矿石送进加工端'; text.textContent = '按住鼠标，从矿机边缘拖到熔炼机边缘；建筑之间只留一格也能连接。'; fill.style.width = '42%'; action = '选择传送带'; }
  else if (!hasResearchLab) { title.textContent = '建立科研链'; text.textContent = '部署科研站，再用传送带把铜锭与硅片送入矩阵生产。'; fill.style.width = '56%'; action = '选择科研站'; }
  else if (!hasResearchLink) { title.textContent = '接通科研站'; text.textContent = '从能源核心或冶炼机边缘拖到科研站，铜锭和硅片会自动进入配方。'; fill.style.width = '64%'; action = '选择传送带'; }
  else if (!state.research.current && nextTech) {
    if (nextTech.id === 'matrix-lab' && processorGap) {
      if (processorGap.kind === 'assembler') {
        title.textContent = '先搭芯片产线';
        text.textContent = '矩阵实验室会消耗芯片。先部署组装机，接入铜锭与硅片，避免科研过程中断。';
        action = '选择组装机';
      } else if (processorGap.kind === 'assemblerInputBelt') {
        title.textContent = `接通${resources[processorGap.resource].label}`;
        text.textContent = `组装机还缺${resources[processorGap.resource].label}，从能源核心或上游生产端接入物料。`;
        action = '选择传送带';
      } else {
        title.textContent = '接通芯片产物';
        text.textContent = '从组装机拖到能源核心或科研站，芯片会进入库存并支撑后续矩阵研究。';
        action = '选择传送带';
      }
    } else {
      title.textContent = `启动「${nextTech.label}」`;
      text.textContent = `打开科技中枢，点击可研究节点；科研站会消耗${resources[nextTech.cube].label}推进主线。`;
      action = '打开科技中枢';
    }
    fill.style.width = '66%';
  }
  else if (state.research.current) {
    const tech = researchTarget();
    const researchLab = state.buildings.find(building => building.type === 'researchLab' && isBuildingOperational(building));
    const missing = missingInputsFor(researchLab);
    const productionGap = researchProductionGap();
    const advice = researchGapAdvice(productionGap, missing);
    if (advice) {
      title.textContent = advice.title;
      text.textContent = advice.text;
      action = advice.action;
    } else if (missing.length) {
      title.textContent = '补齐科研输入';
      text.textContent = `科研站还缺 ${missing.join('、')}；输入齐备后，当前科技会自动继续。`;
      action = '选择传送带';
    } else {
      title.textContent = `供给${resources[tech?.cube]?.label || '研究矩阵'}`;
      text.textContent = `对应原料会在科研站制备成${resources[tech?.cube]?.label || '研究矩阵'}，完成后自动进入研究库存。`;
      action = '打开科技中枢';
    }
    fill.style.width = '74%';
  }
  else if (!isInterstellarUnlocked()) { title.textContent = '接入星际物流'; text.textContent = '继续完成主线科技，星图会在「星际物流」完成后解锁。'; fill.style.width = '82%'; action = '查看主线科技'; }
  else if (!hasFirstTrip) { title.textContent = '完成第一次异星航次'; text.textContent = '打开星图，选择熔火-β，装载处理器并派遣货运舱。'; fill.style.width = '90%'; action = '打开星图'; }
  else if (!isTechUnlocked('stellar-network')) { title.textContent = '扩展恒星网络'; text.textContent = '把钛和科研矩阵带回母星，继续研究恒星网络。'; fill.style.width = '95%'; action = '打开科技中枢'; }
  else if (!isTechUnlocked('dyson-frame')) { title.textContent = '研究戴森框架'; text.textContent = '用信息矩阵和结构矩阵完成主线研究，开启恒星工程施工台。'; fill.style.width = '97%'; action = '打开科技中枢'; }
  else if (state.stellarProject.progress < 100) { title.textContent = `部署恒星框架 · ${state.stellarProject.progress}%`; text.textContent = '从熔火-β回收钛，用结构矩阵和处理器逐个部署轨道组件。'; fill.style.width = `${97 + state.stellarProject.progress * .03}%`; action = '打开星图'; }
  else { title.textContent = '第一圈戴森框架已点亮'; text.textContent = '恒星能量网络已经建立，继续扩展将进入下一阶段。'; fill.style.width = '100%'; action = '打开星图'; }
  query('#objective-action').textContent = action;
  const steps = [
    { label: '采矿', done: hasMiner },
    { label: '加工', done: hasSmelter && hasProcessingLink },
    { label: '科研', done: hasResearchLab && hasResearchLink && hasFirstResearch },
    { label: '星际', done: isInterstellarUnlocked() && hasFirstTrip },
    { label: '恒星工程', done: isTechUnlocked('dyson-frame') && state.stellarProject.progress >= 100 }
  ];
  query('#objective-steps').innerHTML = steps.map(step => `<span class="objective-step${step.done ? ' done' : ''}"><i>${step.done ? '✓' : '·'}</i>${step.label}</span>`).join('');
  query('#objective-action').dataset.action = action;
}

function buildingRecipeText(building) {
  if (building.type === 'hub') return '库存 → 物流网络';
  if (building.type === 'miner') {
    const node = state.nodes.find(item => item.id === building.nodeId);
    return node ? `${resources[node.resource].label}矿脉 → ${resources[node.resource].label}` : '矿脉 → 原矿';
  }
  if (building.type === 'oilExtractor') return '原油渗流 → 原油';
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
  if (building.type === 'sorter') return '输入 → 分流';
  return '系统节点';
}

function buildingStatus(building) {
  if (!isBuildingOperational(building)) return '科技锁定';
  if (building.type === 'hub') return '物流枢纽';
  if (state.powerGeneration < state.powerLoad && building.type !== 'wind') return '电力不足';
  if (building.type === 'wind') return '供电中';
  if (building.type === 'thermal') return (building.input.coal || 0) > 0 ? '供电中' : '缺煤';
  if (building.type === 'sorter' && building.process > .05) return '分流中';
  if (building.type === 'miner' || building.type === 'oilExtractor') {
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
  if (building.type === 'sorter') return clamp(building.process / .22, 0, 1);
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
    // Inventory is stored in the energy core, so it still needs a belt route
    // before the lab can consume it. Surface that route instead of sending the
    // player to mine a resource they already own.
    if ((state.inventory[resource] || 0) >= 1) {
      // The energy core is the starter warehouse. A belt can make this flow
      // visible and faster, but a stocked component must not deadlock the
      // first research loop while the player is learning the build controls.
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
      // The energy core is a real warehouse, and research labs pull stocked
      // inputs from it automatically. A miner-to-core route is therefore a
      // complete supply path even when there is no second core-to-lab belt.
      return destination === lab || destination?.type === 'hub';
    });
    if (!rawBelt) return { kind: 'belt', raw, miner, smelter, source: miner };
    if (raw === 'coal') continue;
    const output = raw === 'silicon' ? 'siliconWafer' : `${raw}Ingot`;
    const directOutputBelt = state.belts.find(belt => {
      if (!isAdjacentToBuilding({ x: belt.x, y: belt.y }, smelter)) return false;
      const destination = findDestinationAlongRoute(belt, output, smelter.id);
      return destination === lab;
    });
    if (directOutputBelt) continue;
    const warehouseOutputBelt = state.belts.find(belt => {
      if (!isAdjacentToBuilding({ x: belt.x, y: belt.y }, smelter)) return false;
      return findDestinationAlongRoute(belt, output, smelter.id)?.type === 'hub';
    });
    if (warehouseOutputBelt && !hasWarehouseRoute(lab, [output])) return { kind: 'warehouseBelt', raw, output, smelter };
    if (!warehouseOutputBelt) return { kind: 'outputBelt', raw, smelter };
  }
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
      text: `${missingText}从${rawLabel}矿机边缘拖到冶炼机；煤矿可以直接接入能源核心或科研站。`,
      action: '选择传送带'
    };
  }
  if (gap.kind === 'outputBelt') {
    const rawLabel = resources[gap.raw]?.label || gap.raw;
    const outputLabel = gap.raw === 'silicon' ? '硅片' : `${rawLabel}锭`;
    return {
      title: `接通${outputLabel}产物`,
      text: `${missingText}从${rawLabel}冶炼机拖到科研站或能源核心，${outputLabel}才会进入矩阵配方。`,
      action: '选择传送带'
    };
  }
  if (gap.kind === 'warehouseBelt') {
    const outputLabel = resources[gap.output]?.label || '研究组件';
    return {
      title: `接通核心出库`,
      text: `${missingText}能源核心已经收到${outputLabel}，从核心边缘拖到科研站，把库存物料送回研究链。`,
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
      text: `${missingText}组装机还缺${inputLabel}，从能源核心或上游生产端接入物料。`,
      action: '选择传送带'
    };
  }
  if (gap.kind === 'assemblerOutputBelt') {
    return {
      title: '接通芯片产物',
      text: `${missingText}从组装机拖到能源核心或科研站，让芯片进入科研链。`,
      action: '选择传送带'
    };
  }
  return null;
}

function updateFactoryMonitor() {
  const activeBuildings = state.buildings.filter(building => building.type !== 'hub' && isBuildingActive(building)).length;
  const powerShortage = state.powerGeneration < state.powerLoad;
  const currentTech = researchTarget();
  let status = powerShortage ? '电力紧张' : state.interstellar.route ? '星际联机' : currentTech ? '科研推进' : activeBuildings ? '生产运行' : '待命';
  let advice = '选择设施，在网格中开始建造。';
  if (powerShortage) advice = `电网缺口 ${(state.powerLoad - state.powerGeneration).toFixed(1)} MW · 建造风力或火力发电机`;
  else {
    const researchLab = state.buildings.find(building => building.type === 'researchLab' && isBuildingOperational(building));
    const researchMissing = missingInputsFor(researchLab);
    const researchAdvice = currentTech && researchLab ? researchGapAdvice(researchProductionGap(), researchMissing) : null;
    if (researchAdvice) advice = `${researchAdvice.title} · ${researchAdvice.text}`;
    else if (state.interstellar.route) advice = `货运舱正在${state.interstellar.route.phase === 'outbound' ? '去程' : '返航'} · 星图可查看实时轨迹`;
    else if (currentTech) {
      if (researchMissing.length) advice = `科研站缺少 ${researchMissing.join('、')} · 先补齐对应输入`;
      else if ((state.inventory[currentTech.cube] || 0) <= 0) advice = `科研等待${resources[currentTech.cube].label} · 先补齐矩阵产线`;
    } else {
      const blocked = state.buildings.find(building => ['科技锁定', '输出堵塞', '缺少输入', '缺少矩阵组件', '缺煤', '未接入矿脉'].includes(buildingStatus(building)));
      if (blocked) advice = `${buildings[blocked.type].label}：${buildingStatus(blocked)} · 点击设施查看配方`;
      else if (state.items.length) advice = `物流网络正在运输 ${state.items.length} 件物料`;
      else if (activeBuildings) advice = '产线在线 · 点击任意设施检查输入、输出和进度';
    }
  }
  query('#monitor-status').textContent = status;
  query('#monitor-status').className = powerShortage ? 'monitor-state-warning' : state.interstellar.route ? 'monitor-state-route' : '';
  query('#monitor-buildings').textContent = `${activeBuildings}/${Math.max(0, state.buildings.length - 1)}`;
  query('#monitor-items').textContent = formatNumber(state.items.length);
  query('#monitor-trips').textContent = formatNumber(state.interstellar.completedTrips);
  query('#monitor-advice-text').textContent = advice;
}

function renderCareerPanel() {
  const host = query('#career-grid');
  if (!host) return;
  const pending = state.pendingCareer || state.career || 'logistics';
  host.innerHTML = Object.values(careerCatalog).map(career => {
    const selected = career.id === pending;
    const current = career.id === state.career;
    return `<button type="button" class="career-card${selected ? ' selected' : ''}${current ? ' current' : ''}" data-career="${career.id}" ${state.careerChosen && !current ? 'disabled' : ''} style="--career-accent:${career.accent}">
      <span class="career-card-portrait"><img src="output/imagegen/${career.image}" alt="" /></span>
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
  if (!building || building.type !== 'sorter') {
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
    renderCareerPanel();
  }
}

function updateHUD() {
  const hours = Math.floor(state.time / 3600) % 24;
  const minutes = Math.floor(state.time / 60) % 60;
  query('#game-clock').textContent = `DAY 001 · ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  query('#career-label').textContent = careerLabel();
  query('#career-button img').src = `output/imagegen/${state.career ? activeCareer().image : careerCatalog.logistics.image}`;
  query('#count-iron').textContent = formatNumber(state.inventory.iron);
  query('#count-copper').textContent = formatNumber(state.inventory.copper);
  query('#count-silicon').textContent = formatNumber(state.inventory.silicon);
  query('#count-processor').textContent = formatNumber(state.inventory.processor);
  query('#count-titanium').textContent = formatNumber(state.inventory.titanium);
  const netPower = state.powerGeneration - state.powerLoad;
  query('#power-readout').textContent = `${netPower >= 0 ? '+' : ''}${netPower.toFixed(1)} MW`;
  query('#power-readout').style.color = netPower < 0 ? '#ee6a65' : '#62d69a';
  query('#power-fill').style.width = `${clamp(state.powerGeneration > 0 ? (state.powerLoad / state.powerGeneration) * 100 : 100, 4, 100)}%`;
  query('#power-fill').style.background = netPower < 0 ? '#ee6a65' : '#62d69a';
  query('#tool-label').textContent = state.tool === 'demolish' ? '拆除模式' : buildings[state.tool]?.label || '传送带';
  if (state.pointer.cell) query('#cursor-readout').textContent = `GRID ${String(state.pointer.cell.x).padStart(2, '0')},${String(state.pointer.cell.y).padStart(2, '0')}`;
  all('.tool-button').forEach(button => button.classList.toggle('selected', button.dataset.tool === state.tool));
  all('.tool-button').forEach(button => {
    const meta = buildings[button.dataset.tool];
    const techLock = button.dataset.techLock || meta?.tech;
    const locked = techLock && !isTechUnlocked(techLock);
    button.classList.toggle('locked', Boolean(locked));
    const cost = button.querySelector('small');
    if (cost && meta) cost.textContent = locked ? `需 ${techById[techLock]?.label || '科技'}` : formatCost(meta.cost);
  });
  query('#map-button-state').textContent = state.interstellar.route ? '航线中' : isInterstellarUnlocked() ? '已接入' : '未接入';
  const selected = state.buildings.find(building => building.id === state.selectedId);
  const selection = query('#selection-card');
  const labModePicker = query('#lab-mode-picker');
  renderSorterRouting(selected?.type === 'sorter' ? selected : null);
  if (!selected) { selection.hidden = true; labModePicker.hidden = true; } else {
    const meta = buildings[selected.type];
    selection.hidden = false;
    labModePicker.hidden = selected.type !== 'researchLab';
    if (selected.type === 'researchLab') all('[data-lab-mode]').forEach(button => button.classList.toggle('active', (selected.researchMode || 'auto') === button.dataset.labMode));
    query('#selection-name').textContent = meta.label;
    const input = Object.entries(selected.input || {}).filter(([, amount]) => amount > 0).map(([resource, amount]) => `${resources[resource]?.label || resource} ${Math.floor(amount)}`).join(' · ');
    query('#selection-input').textContent = input || '无';
    const output = Object.entries(selected.output).find(([, amount]) => amount > 0);
    const status = buildingStatus(selected);
    query('#selection-state').textContent = status;
    query('#selection-state').style.color = ['科技锁定', '电力不足', '输出堵塞', '缺少输入', '缺少矩阵组件', '缺煤', '未接入矿脉'].includes(status) ? '#ff9b3d' : '#62d69a';
    query('#selection-output').textContent = output ? `${formatNumber(output[1])} 单位缓存` : selected.type === 'miner' || selected.type === 'oilExtractor' ? '采掘中 · 等待输出' : selected.type === 'hub' ? '库存接入' : '等待产出';
    query('#selection-recipe').textContent = buildingRecipeText(selected);
    query('#selection-tech').textContent = isBuildingUnlocked(selected.type) ? `${buildingTechName(selected.type)} · 已授权` : `需完成「${buildingTechName(selected.type)}」`;
    const selectionLevel = isBuildingUnlocked(selected.type) ? `MK-${Math.min(getBuildingLevel(selected.type), 3)}` : '锁定';
    query('#selection-license').textContent = `${selectionLevel} · ${isBuildingUnlocked(selected.type) ? '可运行' : '等待科技'}`;
    const upgradeState = getBuildingUpgradeState(selected.type);
    const researchedUpgrades = upgradeState.researched.map(tech => tech.label).join('、');
    query('#selection-upgrade').textContent = upgradeState.next
      ? `${researchedUpgrades ? `已研究 ${researchedUpgrades} · ` : ''}下一项「${upgradeState.next.label}」`
      : researchedUpgrades || '暂无后续升级';
    query('#selection-progress-fill').style.width = `${buildingProgress(selected) * 100}%`;
    query('#selection-power-label').textContent = meta.generation ? '发电' : '耗电';
    query('#selection-power').textContent = `${meta.generation ? '+' : ''}${(meta.generation ? getPowerGeneration(selected) : meta.power).toFixed(1)} MW`;
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
  state.pointer.cell = null;
  showToast(`${resources[resource]?.label || resource}矿脉已定位`);
  return true;
}

function focusBuilding(building) {
  if (!building) return false;
  const center = buildingCenter(building);
  state.camera = { x: center.x, y: center.y };
  state.selectedId = building.id;
  state.pointer.cell = null;
  return true;
}

function selectTool(tool) {
  if (tool !== 'belt' && tool !== 'demolish' && !isBuildingUnlocked(tool)) {
    showToast(`需要完成 ${buildingTechName(tool)}`, 'warning');
    return;
  }
  state.tool = tool;
  state.selectedId = null;
  state.pointer.startCell = null;
  state.pointer.startBuildingId = null;
  showToast(tool === 'demolish' ? '拆除模式' : `${buildings[tool]?.label || '传送带'} 已选中`, 'ok');
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
    makeDemoBuilding('hub', -1, -1),
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
    const sorter = makeDemoBuilding('sorter', -5, -2, { input: { copper: 1, iron: 1 }, process: .13 });
    const copperLine = makeDemoBuilding('smelter', -1, -4, { recipeResource: 'copper' });
    const ironLine = makeDemoBuilding('smelter', -5, 2, { recipeResource: 'iron' });
    const copperOutput = { id: 'qa-demo-sorter-copper', x: -4, y: -2, dx: 1, dy: 0, length: 3 };
    const copperTurn = { id: 'qa-demo-sorter-copper-turn', x: -2, y: -2, dx: 0, dy: -1, length: 2 };
    const ironOutput = { id: 'qa-demo-sorter-iron', x: -5, y: -1, dx: 0, dy: 1, length: 3 };
    sorter.sorterRules.copper = copperOutput.id;
    state.tech = ['foundation', 'planetary-logistics', 'sorter-tech', 'belt-mk2', 'automated-smelting'];
    state.buildings = [makeDemoBuilding('hub', -1, -1), sorter, copperLine, ironLine];
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
  const check = (condition, message) => { if (!condition) failures.push(message); };
  const makeQaBelt = (x, y, dx, dy, length) => ({ id: `qa-playthrough-belt-${x}-${y}-${length}`, x, y, dx, dy, length });
  const researchQaTech = id => {
    state.research = { current: null, progress: 0 };
    state.inventory[techById[id].cube] = Math.max(state.inventory[techById[id].cube] || 0, techById[id].cost + 4);
    startResearch(id);
    check(state.research.current === id, `${id} 未进入研究 · 当前 ${state.research.current || '待命'}`);
    simulateResearch(1000);
    check(isTechUnlocked(id), `${id} 未完成`);
  };
  state.career = 'logistics';
  state.careerChosen = true;
  state.pendingCareer = 'logistics';
  const hub = makeBuilding('hub', -1, -1);
  const miner = makeBuilding('miner', -8, -3);
  miner.nodeId = 'copper-north';
  const smelter = makeBuilding('smelter', -3, -2);
  smelter.recipeResource = 'copper';
  const assembler = makeBuilding('assembler', 3, -2);
  assembler.input = { copperIngot: 1, siliconWafer: 1 };
  const lab = makeBuilding('researchLab', 3, 3);
  state.buildings = [hub, miner, smelter, assembler, lab];
  state.belts = [makeQaBelt(-6, -1, 1, 0, 3), makeQaBelt(-1, -1, 1, 0, 4), makeQaBelt(4, 0, 0, 1, 4)];
  state.nodes = initialNodeState.map(node => ({ ...node }));
  state.items = [];
  state.inventory = { ...startingInventory, electromagneticCube: 160, energyCube: 160, structureCube: 160, informationCube: 160, processor: 20, titanium: 0 };
  state.tech = [...startingTech];
  state.research = { current: null, progress: 0 };
  state.interstellar = makeInterstellarState({ selectedPlanet: 'forge', cargo: 'processor' });
  state.stellarProject = makeStellarProject();
  simulateBuildings(2);
  check(state.nodes.find(node => node.id === 'copper-north').amount < 62400, '采矿脉冲未消耗矿脉');
  check(!isBuildingUnlocked('assembler'), '组装机提前解锁');
  check(buildingStatus(assembler) === '科技锁定', '未授权建筑没有进入锁定状态');
  check((assembler.output.processor || 0) === 0, '未授权建筑仍在生产');
  const expectedLoad = state.buildings
    .filter(isBuildingOperational)
    .reduce((total, building) => total + (buildings[building.type]?.power || 0), 0);
  check(Math.abs(state.powerLoad - expectedLoad) < .001, '未授权建筑错误计入电网');
  state.inventory.electromagneticCube = 0;
  state.research = { current: 'planetary-logistics', progress: 0 };
  simulateBuildings(3);
  check(state.inventory.electromagneticCube > 0, '科研站未从实际输入生产电磁矩阵');
  simulateResearch(1);
  check(state.research.progress > 0, '研究循环未消费科研站产出的矩阵');
  state.research = { current: null, progress: 0 };
  const smeltingTimeBefore = getSmeltingTime();
  researchQaTech('planetary-logistics');
  const beltSpeedBefore = getBeltTravelFactor();
  researchQaTech('sorter-tech');
  check(isBuildingUnlocked('sorter'), '分拣器未随科技解锁');
  researchQaTech('belt-mk2');
  check(getBeltTravelFactor() < beltSpeedBefore, '高速传送未改变运输速度');
  const miningTimeBefore = getMiningTime(miner);
  researchQaTech('mining-mk2');
  check(getMiningTime(miner) < miningTimeBefore, '高压采掘未升级采矿速度');
  const oilExtractor = makeBuilding('oilExtractor', 10, 5);
  const oilTimeBefore = getMiningTime(oilExtractor);
  researchQaTech('oil-processing');
  check(isBuildingUnlocked('oilExtractor'), '石油提取机未随石化开采解锁');
  check(placementCheck('oilExtractor', { x: 10, y: 5 }).valid, '石油提取机解锁后无法覆盖原油渗流区');
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
  researchQaTech('automated-smelting');
  check(isBuildingUnlocked('assembler'), '自动冶炼未解锁组装机');
  check(getSmeltingTime() < smeltingTimeBefore, '自动冶炼未升级冶炼速度');
  check(placementCheck('assembler', { x: 12, y: 8 }).valid, '组装机解锁后仍无法进入建造状态');
  simulateBuildings(3);
  check((assembler.output.processor || 0) > 0, '建筑解锁后没有恢复生产');
  const assemblyTimeBefore = getAssemblyTime(assembler);
  researchQaTech('advanced-assembly');
  check(getAssemblyTime(assembler) < assemblyTimeBefore, '高级组装未升级组装机速度');
  const researchQaLab = makeBuilding('researchLab', 0, 0);
  const researchTimeBefore = getResearchProductionTime(researchQaLab, 'electromagneticCube');
  researchQaTech('matrix-lab');
  check(getResearchProductionTime(researchQaLab, 'electromagneticCube') < researchTimeBefore, '矩阵实验室未升级科研站速度');
  check(getBuildingLevel('miner') >= 2 && getBuildingLevel('oilExtractor') >= 2 && getBuildingLevel('wind') >= 2, '建筑升级等级未同步');
  researchQaTech('interstellar-logistics');
  state.interstellar.cargo = 'processor';
  launchRoute();
  check(state.interstellar.route?.phase === 'outbound', '货运舱未进入去程');
  simulateInterstellar(13);
  check(state.interstellar.route?.phase === 'returning', '货运舱未进入返航');
  simulateInterstellar(13);
  check(state.interstellar.completedTrips === 1 && state.inventory.titanium === 8, '异星钛资源未回收');
  researchQaTech('stellar-network');
  researchQaTech('dyson-frame');
  state.inventory.structureCube = 80;
  state.inventory.titanium = 40;
  state.inventory.processor = 20;
  for (let index = 0; index < 20; index += 1) contributeStellarProject();
  check(state.stellarProject.progress === 100, '恒星工程未完成');
  const qaSorter = makeBuilding('sorter', -12, -5);
  const qaCopperLine = makeBuilding('smelter', -8, -7);
  qaCopperLine.recipeResource = 'copper';
  const qaIronLine = makeBuilding('smelter', -12, -1);
  qaIronLine.recipeResource = 'iron';
  const qaSorterInput = { id: 'qa-sorter-input', x: -16, y: -5, dx: 1, dy: 0, length: 4 };
  const qaCopperTurn = { id: 'qa-sorter-copper-turn', x: -9, y: -5, dx: 0, dy: -1, length: 2 };
  const qaCopperOutput = { id: 'qa-sorter-copper-output', x: -11, y: -5, dx: 1, dy: 0, length: 2 };
  const qaIronOutput = { id: 'qa-sorter-iron-output', x: -12, y: -4, dx: 0, dy: 1, length: 3 };
  state.buildings.push(qaSorter, qaCopperLine, qaIronLine);
  state.belts.push(qaSorterInput, qaCopperOutput, qaCopperTurn, qaIronOutput);
  qaSorter.sorterRules.copper = qaCopperOutput.id;
  check(findSorterOutputBelt(qaSorter, 'copper') === qaCopperOutput, '分拣器未按物料规则选择出口');
  check(findSorterOutputBelt(qaSorter, 'iron') === qaIronOutput, '分拣器自动分流未识别下游产线');
  qaSorter.sorterRules.iron = 'deleted-belt-rule';
  check(findSorterOutputBelt(qaSorter, 'iron') === qaIronOutput && !qaSorter.sorterRules.iron, '失效分流规则未自动恢复');
  check(findNextBelt(qaCopperOutput, 'copper', qaSorter.id) === qaCopperTurn, '多段转向传送带未接续');
  deliver(qaSorter, 'copper');
  simulateBuildings(.3);
  check(state.items.some(item => item.beltId === qaCopperOutput.id && item.resource === 'copper'), '分拣器铜物料未进入指定出口');
  deliver(qaSorter, 'iron');
  simulateBuildings(.3);
  check(state.items.some(item => item.beltId === qaIronOutput.id && item.resource === 'iron'), '分拣器铁物料未进入自动出口');
  const passed = failures.length === 0;
  const report = passed
    ? 'QA PASS · 采矿/矩阵生产 → 全设施授权/升级 → 分拣分流 → 星际去返 → 恒星工程 100%'
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
query('#pause-button').addEventListener('click', togglePause);
query('#speed-button').addEventListener('click', toggleSimulationSpeed);
query('#career-button').addEventListener('click', () => toggleCareerPanel());
query('#close-career-panel').addEventListener('click', () => toggleCareerPanel(false));
query('#career-confirm').addEventListener('click', confirmCareer);
query('#tech-button').addEventListener('click', () => toggleTechPanel());
query('#brief-tech-button').addEventListener('click', () => toggleTechPanel(true));
query('#close-tech-panel').addEventListener('click', () => toggleTechPanel(false));
query('#map-button').addEventListener('click', () => toggleStarMap());
query('#close-star-map').addEventListener('click', () => toggleStarMap(false));
query('#launch-route-button').addEventListener('click', launchRoute);
query('#stellar-project-button').addEventListener('click', contributeStellarProject);
query('#objective-action').addEventListener('click', () => {
  const action = query('#objective-action').dataset.action;
  const productionGap = researchProductionGap();
  const closePanelsForBuild = () => {
    query('#tech-panel').hidden = true;
    query('#star-map-panel').hidden = true;
    query('#career-panel').hidden = true;
  };
  if (action === '选择采矿机') {
    closePanelsForBuild();
    const researchResource = productionGap?.kind === 'miner' ? productionGap.raw : researchMissingRawResource();
    focusResourceNode(researchResource || 'copper');
    selectTool('miner');
  }
  else if (action === '选择熔炼炉') {
    closePanelsForBuild();
    focusResourceNode(productionGap?.raw || 'copper');
    selectTool('smelter');
  }
  else if (action === '选择组装机') {
    closePanelsForBuild();
    selectTool('assembler');
  }
  else if (action === '选择传送带') {
    closePanelsForBuild();
    const focusTarget = productionGap?.kind === 'warehouseBelt'
      ? state.buildings.find(building => building.type === 'hub')
      : productionGap?.kind === 'rawToSmelter'
        ? productionGap.miner
      : productionGap?.source || productionGap?.smelter || productionGap?.producer || null;
    focusBuilding(focusTarget);
    selectTool('belt');
  }
  else if (action === '选择熔炼炉') selectTool('smelter');
  else if (action === '选择科研站') selectTool('researchLab');
  else if (action === '打开星图') toggleStarMap(true);
  else toggleTechPanel(true);
});
query('#reset-button').addEventListener('click', () => {
  state.buildings = [makeBuilding('hub', -1, -1)];
  state.belts = [];
  state.items = [];
  state.selectedId = null;
  state.inventory = { ...startingInventory };
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
  state.powerGeneration = 12;
  state.powerLoad = 0;
  state.simulationSpeed = 1;
  state.camera = { x: 0, y: 1 };
  state.zoom = .78;
  state.tool = 'miner';
  state.rotation = 0;
  state.pointer.startCell = null;
  state.pointer.startBuildingId = null;
  saveGame();
  renderTechPanel();
  renderStarMap();
  toggleCareerPanel(true);
  showToast('本地工厂已重置');
});
query('#close-selection').addEventListener('click', () => { state.selectedId = null; });
query('#selection-delete').addEventListener('click', () => {
  const building = state.buildings.find(entry => entry.id === state.selectedId);
  if (building) removeAt({ x: building.x, y: building.y });
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
    state.pointer.panning = true; state.pointer.lastX = event.clientX; state.pointer.lastY = event.clientY; canvas.setPointerCapture(event.pointerId); return;
  }
  if (event.button !== 0) return;
  state.pointer.down = true;
  state.pointer.cell = screenToCell(event.clientX, event.clientY);
  if (state.tool === 'belt') {
    const source = findBuildingAt(state.pointer.cell);
    state.pointer.startBuildingId = source?.id || null;
    state.pointer.startCell = source ? buildingPortToward(source, state.pointer.cell) : state.pointer.cell;
    canvas.setPointerCapture(event.pointerId);
    return;
  }
  const existing = findBuildingAt(state.pointer.cell);
  if (state.tool === 'demolish') removeAt(state.pointer.cell);
  else if (existing) { state.selectedId = existing.id; showToast(`${buildings[existing.type].label} 已选中`); }
  else placeBuilding(state.pointer.cell);
});
canvas.addEventListener('pointerup', event => {
  if (event.button === 2) { state.pointer.panning = false; return; }
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
  if (event.key >= '1' && event.key <= '5') selectTool(['miner', 'smelter', 'assembler', 'belt', 'demolish'][Number(event.key) - 1]);
  if (event.key.toLowerCase() === 'r' && state.tool !== 'belt' && state.tool !== 'demolish') { state.rotation = (state.rotation + 90) % 360; showToast(`建筑朝向 ${state.rotation}°`); }
  if (event.key.toLowerCase() === 't') toggleTechPanel();
  if (event.key.toLowerCase() === 'm') toggleStarMap();
  if (event.key.toLowerCase() === 'c') toggleCareerPanel();
  if (event.code === 'Space') { event.preventDefault(); togglePause(); }
if (event.key === 'Escape') { state.pointer.startCell = null; state.pointer.startBuildingId = null; selectTool('miner'); }
});

let lastFrame = performance.now();
let autosaveTime = 0;
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

window.addEventListener('resize', resize);
resize();
applyQaDemoState();
if (qaPlaythroughMode) runQaPlaythrough();
renderTechPanel();
renderCareerPanel();
wireOptionalAssetImages();
updateHUD();
showToast('选择设施，在地表网格中开始建造');
if (requestedPanel === 'tech') toggleTechPanel(true);
else if (requestedPanel === 'map') toggleStarMap(true);
else if (!state.careerChosen) toggleCareerPanel(true);
requestAnimationFrame(loop);
