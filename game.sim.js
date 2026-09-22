// 星环回声 · game.sim.js — 建造·拆除/套件与制造/物流分拣/电力/生产/科研/星际/恒星工程仿真
// （由 game.js 拆分于 2026-09-22，加载顺序：core → world → sim → ui → tools → main）

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
  showToast(`${recipe.outputLabel} 已加入建筑库存${storageHintFor(lastSpendFromStorage)}`);
  renderCraftPanel();
  updateHUD();
}

function totalAmount(resource) {
  return (state.inventory[resource] || 0) + storageAmount(resource);
}

function canAfford(cost, multiplier = 1) {
  return Object.entries(cost).every(([resource, amount]) => totalAmount(resource) >= amount * multiplier);
}

function canAffordStorage(cost, multiplier = 1) {
  return Object.entries(cost).every(([resource, amount]) => storageAmount(resource) >= amount * multiplier);
}

function takeStorageCost(cost, multiplier = 1) {
  Object.entries(cost).forEach(([resource, amount]) => takeFromStorage(resource, amount * multiplier));
}

let lastSpendFromStorage = [];
function spend(cost, multiplier = 1) {
  lastSpendFromStorage = [];
  Object.entries(cost).forEach(([resource, amount]) => {
    let remaining = amount * multiplier;
    const fromInventory = Math.min(state.inventory[resource] || 0, remaining);
    state.inventory[resource] = (state.inventory[resource] || 0) - fromInventory;
    remaining -= fromInventory;
    if (remaining <= 0) return;
    const taken = takeFromStorage(resource, remaining);
    if (taken > 0) lastSpendFromStorage.push(resource);
  });
}

function storageHintFor(usedResources) {
  if (!usedResources || !usedResources.length) return '';
  const labels = [...new Set(usedResources)].map(resource => resources[resource]?.label || resource).join('、');
  return ` · 已从物流仓储补充 ${labels}`;
}

const smelterRecipeOptions = [null, 'iron', 'copper', 'silicon'];

function cycleSmelterRecipe(building) {
  if (!building || building.type !== 'smelter') return;
  const current = building.recipeResource || null;
  const next = smelterRecipeOptions[(smelterRecipeOptions.indexOf(current) + 1) % smelterRecipeOptions.length];
  building.recipeResource = next;
  building.process = 0;
  saveGame();
  showToast(next ? `冶炼配方已切换 · ${resources[next].label}矿` : '冶炼配方已重置 · 将自动识别来料');
  updateHUD();
  render();
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
  showToast(`传送带已铺设 · ${cells.length} 格${storageHintFor(lastSpendFromStorage)}`);
}

function salvageBuildingContents(building) {
  if (!building) return 0;
  let salvaged = 0;
  const deposit = ([resource, amount]) => {
    const count = Number(amount) || 0;
    if (count <= 0) return;
    state.inventory[resource] = (state.inventory[resource] || 0) + count;
    salvaged += count;
  };
  Object.entries(building.stock || {}).forEach(deposit);
  Object.entries(building.input || {}).forEach(deposit);
  Object.entries(building.output || {}).forEach(deposit);
  building.stock = {}; building.input = {}; building.output = {};
  return salvaged;
}

function removeAt(cell, options = {}) {
  const quiet = options.quiet === true;
  const building = findBuildingAt(cell);
  if (building) {
    if (isStorageType(building) && storageUsed(building) > 0 && state.confirmRemoveId !== building.id) {
      if (!quiet) {
        state.confirmRemoveId = building.id;
        showToast(`${buildings[building.type].label}内还有物资 · 再次点击确认拆除并回收`, 'warning');
      }
      return 'confirm';
    }
    state.confirmRemoveId = null;
    const nearbySorters = state.buildings.filter(entry => entry.type === 'sorter' && isAdjacentToBuilding({ x: entry.x, y: entry.y }, building));
    const salvaged = salvageBuildingContents(building);
    state.buildings = state.buildings.filter(item => item.id !== building.id);
    const orphanSorters = nearbySorters.filter(sorter => !sorterAttachedBuilding(sorter));
    let orphanSalvaged = 0;
    orphanSorters.forEach(sorter => {
      orphanSalvaged += salvageBuildingContents(sorter);
      state.buildings = state.buildings.filter(item => item.id !== sorter.id);
    });
    const kitType = building.type === 'storage' ? 'solidStorage' : building.type;
    state.kits[kitType] = kitCount(kitType) + 1;
    state.selectedId = null;
    state.selectedBeltId = null;
    rebuildPowerGrids();
    saveGame();
    const notes = [];
    if (salvaged > 0) notes.push(`回收货物 ${salvaged} 件`);
    if (orphanSorters.length) notes.push(`连带回收分拣器 ${orphanSorters.length} 台${orphanSalvaged > 0 ? `（货物 ${orphanSalvaged} 件）` : ''}`);
    if (!quiet) showToast(`${buildings[building.type].label} 已回收${notes.length ? ` · ${notes.join(' · ')}` : ''}`);
    return 'building';
  }
  const beltIndex = state.belts.findIndex(belt => beltCells(belt).some(entry => entry.x === cell.x && entry.y === cell.y));
  if (beltIndex !== -1) {
    const [belt] = state.belts.splice(beltIndex, 1);
    state.buildings.filter(building => building.type === 'sorter').forEach(sorter => {
      Object.entries(sorter.sorterRules || {}).forEach(([resource, beltId]) => {
        if (beltId === belt.id) delete sorter.sorterRules[resource];
      });
    });
    const inFlight = state.items.filter(item => item.beltId === belt.id);
    inFlight.forEach(item => {
      state.inventory[item.resource] = (state.inventory[item.resource] || 0) + 1;
    });
    const kitCells = Math.max(0, belt.kitCells || 0);
    state.kits.belt += Math.floor(kitCells * .6);
    state.inventory.iron += Math.floor((belt.length - kitCells) * .6);
    state.selectedBeltId = null;
    state.items = state.items.filter(item => item.beltId !== belt.id);
    saveGame();
    if (!quiet) showToast(inFlight.length ? `传送带已回收 · 在途 ${inFlight.length} 件货物已转入随身库存` : '传送带已回收');
    return 'belt';
  }
  if (!quiet) showToast('这里没有可拆除对象', 'warning');
  return null;
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
  if (building.type === 'assembler') return ['copperIngot', 'siliconWafer'].includes(resource) || resource === 'water';
  if (building.type === 'workbench') return ['ironIngot', 'copperIngot', 'siliconWafer'].includes(resource) || resource === 'crudeOil';
  if (building.type === 'thermal') return resource === 'coal';
  if (['waterPump', 'oilExtractor', 'gasExtractor'].includes(building.type)) return false;
  if (building.type === 'gasTurbine') return resource === 'naturalGas';
  if (building.type === 'researchLab') {
    const cube = labProductionCube(building);
    return Object.prototype.hasOwnProperty.call(cubeRecipes[cube]?.inputs || {}, resource) || resource === 'water';
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

function beltRouteDistance(startBelt, resource, sourceId = null) {
  // 从某条带出发按"再走几条带能真正送达"做 BFS 计距；visited 保证环路安全。
  const visited = new Set();
  const queue = [[startBelt, 0]];
  while (queue.length) {
    const [current, depth] = queue.shift();
    if (!current || visited.has(current.id)) continue;
    visited.add(current.id);
    if (findDestination(current, resource, sourceId)) return depth;
    getConnectedNextBelts(current).forEach(next => {
      if (!visited.has(next.id)) queue.push([next, depth + 1]);
    });
  }
  return Number.POSITIVE_INFINITY;
}

function findNextBelt(belt, resource = null, sourceId = null) {
  const candidates = getConnectedNextBelts(belt);
  if (!candidates.length) return null;
  if (!resource || candidates.length === 1) return candidates[0];
  // 优先走"最快能送达"的方向：修环路拓扑下按 id 序乒乓、永远到不了目的地的问题
  let best = null;
  let bestScore = Number.POSITIVE_INFINITY;
  candidates.forEach(candidate => {
    const score = beltRouteDistance(candidate, resource, sourceId);
    if (score < bestScore) { bestScore = score; best = candidate; }
  });
  return best || candidates[0];
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
        if (!belt) return null;
        // 仓储物料只供应生产设施：目的地仍是仓储的直接跳过，防止仓储↔仓储无限摆渡
        const destination = findDestinationAlongRoute(belt, resource, sorter.id);
        const target = destination ? sorterAttachedBuilding(destination) : null;
        if (!target || isStorageType(target)) return null;
        return { resource, belt };
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
  return activeCareerEffect('beltSpeed') ? techFactor * .75 : techFactor;
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
      if (building.type === 'gasTurbine' && (building.input.naturalGas || 0) <= 0) return total;
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
  if (building.type === 'stellarReceiver' && (state.stellarProject?.progress || 0) < 100) return 0;
  const base = buildings[building.type]?.generation || 0;
  const careerMultiplier = activeCareerEffect('power') ? 1.2 : 1;
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
  return activeCareerEffect('research') ? 1.3 : 1;
}

const buildingCatalyst = { assembler: 'water', workbench: 'crudeOil', researchLab: 'water' };

function catalystBoostFor(building) {
  const catalyst = buildingCatalyst[building?.type] || null;
  if (!catalyst) return { catalyst: null, boost: 1 };
  return { catalyst, boost: (building.input?.[catalyst] || 0) > 0 ? .7 : 1 };
}

function noteProduced(resource, amount = 1, buildingId = null) {
  if (!state.production) state.production = { second: -1, current: {}, history: [] };
  const production = state.production;
  const second = Math.floor(state.time);
  if (production.second !== second) {
    if (production.second >= 0 && Object.keys(production.current).length) {
      production.history.push({ second: production.second, counts: production.current });
    }
    production.second = second;
    production.current = {};
    production.history = production.history.filter(entry => second - entry.second <= 60);
  }
  production.current[resource] = (production.current[resource] || 0) + amount;
  if (buildingId) production.current[`#${buildingId}`] = (production.current[`#${buildingId}`] || 0) + amount;
}

function productionRate(resource) {
  const production = state.production;
  if (!production) return 0;
  let total = production.current?.[resource] || 0;
  production.history.forEach(entry => { total += entry.counts?.[resource] || 0; });
  return total;
}

function buildingProductionRate(buildingId) {
  const production = state.production;
  if (!production || !buildingId) return 0;
  const key = `#${buildingId}`;
  let total = production.current?.[key] || 0;
  production.history.forEach(entry => { total += entry.counts?.[key] || 0; });
  return total;
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
        noteProduced(node.resource, 1, building.id);
        node.amount -= 1;
      }
    }

    if (building.type === 'smelter' && powerState.powered) {
      if (Object.values(building.output).reduce((sum, amount) => sum + amount, 0) >= outputCapacity(building)) return;
      const raw = building.recipeResource || ['copper', 'iron', 'silicon'].find(resource => (building.input[resource] || 0) > 0);
      if (!raw || (building.input[raw] || 0) <= 0) return;
      building.process += dt * efficiency;
      if (building.process >= getSmeltingTime()) {
        building.process = 0;
        building.input[raw] -= 1;
        const output = raw === 'silicon' ? 'siliconWafer' : `${raw}Ingot`;
        building.output[output] = (building.output[output] || 0) + 1;
        noteProduced(output, 1, building.id);
      }
    }

    if ((building.type === 'assembler' || building.type === 'workbench') && powerState.powered) {
      if (Object.values(building.output).reduce((sum, amount) => sum + amount, 0) >= outputCapacity(building)) return;
      const recipe = building.type === 'workbench'
        ? { inputs: { ironIngot: 1, copperIngot: 1 }, output: 'processor', time: getAssemblyTime(building) }
        : { inputs: { copperIngot: 1, siliconWafer: 1 }, output: 'processor', time: getAssemblyTime(building) };
      if (!hasRecipeInputs(building.input, recipe)) return;
      const assemblyCatalyst = catalystBoostFor(building);
      building.process += dt * efficiency;
      if (building.process >= recipe.time * assemblyCatalyst.boost) {
        building.process = 0;
        consumeRecipeInputs(building.input, recipe);
        if (assemblyCatalyst.catalyst && (building.input[assemblyCatalyst.catalyst] || 0) > 0) {
          building.input[assemblyCatalyst.catalyst] -= 1;
        }
        building.output[recipe.output] = (building.output[recipe.output] || 0) + 1;
        noteProduced(recipe.output, 1, building.id);
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
      const labCatalyst = catalystBoostFor(building);
      building.process += dt * efficiency;
      if (building.process >= getResearchProductionTime(building, cube) * labCatalyst.boost) {
        building.process = 0;
        consumeRecipeInputs(building.input, recipe);
        if (labCatalyst.catalyst && (building.input[labCatalyst.catalyst] || 0) > 0) {
          building.input[labCatalyst.catalyst] -= 1;
        }
        building.output[cube] = (building.output[cube] || 0) + 1;
        noteProduced(cube, 1, building.id);
      }
    }

    if (building.type === 'thermal' && powerState.powered && (building.input.coal || 0) > 0) {
      building.fuelTimer = (building.fuelTimer || 0) + dt * efficiency;
      if (building.fuelTimer >= 4) {
        building.fuelTimer = 0;
        building.input.coal -= 1;
      }
    }

    if (building.type === 'gasTurbine' && powerState.powered && (building.input.naturalGas || 0) > 0) {
      building.fuelTimer = (building.fuelTimer || 0) + dt * efficiency;
      if (building.fuelTimer >= 3) {
        building.fuelTimer = 0;
        building.input.naturalGas -= 1;
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
      item._stalled = 0;
      item._hops = (item._hops || 0) + 1;
      if (item._hops >= 80) {
        // 环路或长期周转始终送不到目的地：回收为随身货物，避免永动+占死分拣器在途槽位
        state.inventory[item.resource] = (state.inventory[item.resource] || 0) + 1;
        showToast(`周转货物回收 · ${resources[item.resource]?.label || item.resource} ×1 已转入随身库存`, 'warning');
        return false;
      }
      return true;
    }
    // 终端滞留：重试 40 秒后仍未消化，回收为随身货物，释放阻塞点
    item._stalled = (item._stalled || 0) + dt;
    if (item._stalled >= 40) {
      state.inventory[item.resource] = (state.inventory[item.resource] || 0) + 1;
      showToast(`终端货物回收 · ${resources[item.resource]?.label || item.resource} ×1 已转入随身库存`, 'warning');
      return false;
    }
    item.progress = 1;
    return true;
  });
  simulateStellarEnergy(dt);
}

function simulateStellarEnergy(dt) {
  const project = state.stellarProject;
  if (!project) return;
  project.energyRate = 0;
  if (project.progress < 100) return;
  const rate = state.buildings.reduce((total, building) => {
    if (building.type !== 'stellarReceiver' || !isBuildingOperational(building)) return total;
    const grid = getGridPowerState(building);
    if (!grid.grid || grid.grid.blackout) return total;
    return total + getPowerGeneration(building) * grid.efficiency;
  }, 0);
  project.energyRate = rate;
  project.energyStored = Math.max(0, (project.energyStored || 0) + rate * dt);
  project.energyCollected = Math.max(0, (project.energyCollected || 0) + rate * dt);
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

function switchActivePlanet(planetId) {
  const target = planetById[planetId];
  if (!target) return false;
  if (planetId === state.activePlanet) {
    showToast(`当前已在${target.name}`);
    return true;
  }
  if (state.interstellar.route) {
    showToast('货运舱航行中，抵达后才能切换星球', 'warning');
    return false;
  }
  if (target.id !== 'home' && !state.interstellar.visits[target.id]) {
    showToast('完成一次往返航次后，才能降落这颗星球', 'warning');
    return false;
  }
  if (target.requires.some(requirement => !isTechUnlocked(requirement))) {
    showToast(`需要接入「${techById[target.requires[0]]?.label || '对应信标'}」`, 'warning');
    return false;
  }

  snapshotCurrentPlanet();
  state.activePlanet = planetId;
  const snapshot = makePlanetSnapshot(planetId, state.planetSnapshots?.[planetId]);
  state.planetSnapshots[planetId] = snapshot;
  state.buildings = snapshot.buildings;
  state.belts = snapshot.belts;
  state.nodes = snapshot.nodes;
  const beltIds = new Set(state.belts.map(belt => belt.id));
  state.items = snapshot.items.filter(item => item && item.beltId && beltIds.has(item.beltId)).map(item => ({ ...item }));
  state.selectedId = null;
  state.selectedBeltId = null;
  state.pointer.cell = null;
  state.pointer.startCell = null;
  state.pointer.startBuildingId = null;
  state.pointer.sorterAnchor = null;
  state.camera = { x: 0, y: 1 };
  state.production = { second: -1, current: {}, history: [] };
  state.powerGrids = [];
  state.powerSummary = { gridCount: 0, highLoadCount: 0, blackoutCount: 0, generation: 0, load: 0 };
  terrainLayerSignature = '';
  rebuildPowerGrids();
  saveGame();
  const mapPanel = query('#star-map-panel');
  if (mapPanel) mapPanel.hidden = true;
  updateHUD();
  render();
  showToast(`已进入${target.name} · 本地工厂已载入`);
  return true;
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
  if (state.activePlanet !== 'home') { showToast('请先返回母星，再派遣货运舱', 'warning'); return; }
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
  showToast(`异星资源已回收 · ${resources[reward.resource].label} ×${reward.amount} · 已开放降落`);
}

const stellarModuleCost = { structureCube: 4, titanium: 2, processor: 1 };

function contributeStellarProject() {
  if (!isTechUnlocked('dyson-frame')) { showToast('需要完成「戴森框架」科技', 'warning'); return; }
  if (state.stellarProject.progress >= 100) { showToast('恒星工程已完成'); return; }
  if (!canAffordStorage(stellarModuleCost)) { showToast(`仓储材料不足 · ${formatCost(stellarModuleCost)}`, 'warning'); return; }
  takeStorageCost(stellarModuleCost);
  state.stellarProject.progress = clamp(state.stellarProject.progress + 5, 0, 100);
  state.stellarProject.modules += 1;
  // 框架施工把原材料组装成恒星框架组件，作为后续部署「恒星能量接收器」的建材来源。
  putInStorage('stellarFrame', 4);
  saveGame();
  showToast(`框架组件已部署 · ${state.stellarProject.progress}% · 恒星框架组件 +4`);
  updateStellarProjectUI();
}
