// 星环回声 · game.tools.js — 提示/focus/工具与诊断动作 + QA 演示与回归链路
// （由 game.js 拆分于 2026-09-22，加载顺序：core → world → sim → ui → tools → main）

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
  state.pointer.cell = null;
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
  state.activePlanet = 'home';
  state.planetSnapshots = {};
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
  state.activePlanet = 'home';
  state.planetSnapshots = {};
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
  researchQaTech('gas-power');
  const qaTurbine = makeBuilding('gasTurbine', 50, 50);
  state.buildings.push(qaTurbine);
  check(acceptsBuildingResource(qaTurbine, 'naturalGas') && !acceptsBuildingResource(qaTurbine, 'coal'), '燃气轮机只接受天然气燃料');
  const qaTurbineBaseGen = (rebuildPowerGrids().find(grid => grid.buildingIds.includes(qaTurbine.id)) || {}).generation || 0;
  qaTurbine.input = { naturalGas: 4 };
  const qaTurbineFueledGen = (rebuildPowerGrids().find(grid => grid.buildingIds.includes(qaTurbine.id)) || {}).generation || 0;
  check(qaTurbineFueledGen > qaTurbineBaseGen, '燃气轮机有燃料时应计入发电');
  const qaCatalystProbe = makeBuilding('assembler', 52, 52);
  qaCatalystProbe.input = { water: 2 };
  check(catalystBoostFor(qaCatalystProbe).boost < 1, '水冷却未提供装配加速');
  state.buildings = state.buildings.filter(building => building.id !== qaTurbine.id);
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
  const homeFactoryBeforeLanding = state.buildings;
  switchActivePlanet('forge');
  check(state.activePlanet === 'forge' && state.nodes.some(node => node.resource === 'titanium'), '完成航次后没有载入熔火-β的独立矿脉');
  check(state.buildings.length === 1 && state.buildings[0].baseHub, '远端星球没有生成独立着陆仓储');
  switchActivePlanet('home');
  check(state.activePlanet === 'home' && state.buildings === homeFactoryBeforeLanding, '返回母星后没有恢复原工厂快照');
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
  const qaReceiver = makeBuilding('stellarReceiver', 20, 8);
  state.buildings.push(qaReceiver);
  rebuildPowerGrids();
  const energyBefore = state.stellarProject.energyStored;
  simulateBuildings(2);
  check(getPowerGeneration(qaReceiver) > 0 && state.stellarProject.energyStored > energyBefore, '恒星能量接收器没有把戴森框架转成可收集能源');
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
  // —— 扩展回归（Hermes 移植）：拆除回收 / 在途货物 / 仓储补料 / 堵塞判定 ——
  const qaPortStorage = makeBuilding('storage', 40, 40);
  qaPortStorage.stock = { copperIngot: 3 };
  state.buildings.push(qaPortStorage);
  const qaPortKitBefore = kitCount('solidStorage');
  removeAt({ x: 40, y: 40 });
  check(state.buildings.some(building => building.id === qaPortStorage.id), '拆除仓储时未进行二次确认保护');
  removeAt({ x: 40, y: 40 });
  check(!state.buildings.some(building => building.id === qaPortStorage.id), '二次确认后仓储仍未拆除');
  check((state.inventory.copperIngot || 0) >= 3, '拆除仓储时库存未回收');
  check(kitCount('solidStorage') === qaPortKitBefore + 1, '拆除仓储未回收储存套件');
  const qaPortSmelter = makeBuilding('smelter', 42, 42);
  qaPortSmelter.input = { iron: 2 };
  qaPortSmelter.output = { ironIngot: 2 };
  state.buildings.push(qaPortSmelter);
  const qaPortKitBefore2 = kitCount('smelter');
  const qaPortIngotBefore = state.inventory.ironIngot || 0;
  removeAt({ x: 42, y: 42 });
  check(kitCount('smelter') === qaPortKitBefore2 + 1, '拆除冶炼机未回收建筑套件');
  check((state.inventory.ironIngot || 0) >= qaPortIngotBefore + 2, '拆除冶炼机时产出未回收');
  const qaPortBelt = { x: 44, y: 44, dx: 1, dy: 0, length: 2, kitCells: 2, id: 'qa-port-belt' };
  state.belts.push(qaPortBelt);
  state.items.push({ id: 'qa-port-item', beltId: 'qa-port-belt', sourceId: null, resource: 'copper', progress: .5 });
  const qaPortCopperBefore = state.inventory.copper || 0;
  removeAt({ x: 44, y: 44 });
  check(!state.belts.some(belt => belt.id === 'qa-port-belt'), '传送带未拆除');
  check((state.inventory.copper || 0) === qaPortCopperBefore + 1, '拆除传送带时在途货物未回收');
  state.inventory.titanium = 0;
  const qaPortRefill = makeBuilding('storage', 46, 46);
  qaPortRefill.stock = { titanium: 12 };
  state.buildings.push(qaPortRefill);
  const qaPortTitaniumBefore = storageAmount('titanium');
  check(canAfford({ titanium: 10 }), '随身材料不足时未采用仓储库存判定');
  spend({ titanium: 10 });
  check((state.inventory.titanium || 0) === 0 && storageAmount('titanium') === qaPortTitaniumBefore - 10, '仓储补料扣减不正确');
  state.buildings = state.buildings.filter(building => building.id !== qaPortRefill.id);
  const qaPortCongestion = makeBuilding('smelter', 48, 48);
  qaPortCongestion.output = { ironIngot: 1 };
  check(buildingStatus(qaPortCongestion) !== '输出堵塞', '冶炼机仅 1 件产物即误报输出堵塞');
  qaPortCongestion.output = { ironIngot: outputCapacity(qaPortCongestion) };
  check(buildingStatus(qaPortCongestion) === '输出堵塞', '产物达到容量上限后未标记输出堵塞');
  state.buildings = state.buildings.filter(building => building.id !== qaPortCongestion.id);
  state.confirmRemoveId = null;
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
