// 星环回声 · game.main.js — 事件接线/主循环/初始化与启动
// （由 game.js 拆分于 2026-09-22，加载顺序：core → world → sim → ui → tools → main）

let resetConfirmAt = 0;
query('#reset-button').addEventListener('click', () => {
  const pressedAt = performance.now();
  if (pressedAt - resetConfirmAt > 3000) {
    resetConfirmAt = pressedAt;
    showToast('再次点击「重置工厂」以确认清空全部进度', 'warning');
    return;
  }
  resetConfirmAt = 0;
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
  const before = screenToCell(event.clientX, event.clientY);
  state.zoom = clamp(oldZoom * (event.deltaY < 0 ? 1.1 : .9), .55, 1.65);
  const after = screenToCell(event.clientX, event.clientY);
  state.camera.x += before.x - after.x;
  state.camera.y += before.y - after.y;
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
let hudTimer = 0;
let gameStarted = false;
let loopBroken = false;
function loop(now) {
  let dt;
  try {
    dt = Math.min(.08, (now - lastFrame) / 1000);
    lastFrame = now;
    state.animTime = now / 1000;
    const simDt = dt * state.simulationSpeed;
    if (!state.paused) { state.time += simDt * 7; simulateBuildings(simDt); simulateResearch(simDt); simulateInterstellar(simDt); }
    autosaveTime += dt;
    if (autosaveTime >= 2) { autosaveTime = 0; saveGame(); }
    hudTimer += dt;
    if (hudTimer >= .12) { hudTimer = 0; updateHUD(); }
    if (!query('#star-map-panel').hidden) updateRouteVisual();
  } catch (error) {
    if (!loopBroken) { loopBroken = true; console.error('主循环异常，已隔离本次帧:', error); }
  } finally {
    try { render(); } catch (error) { if (!loopBroken) { loopBroken = true; console.error('渲染异常，已隔离本次帧:', error); } }
    requestAnimationFrame(loop);
  }
}
window.addEventListener('pagehide', () => saveGame());
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveGame(); });

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
