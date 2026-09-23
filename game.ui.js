// 星环回声 · game.ui.js — 星图/科技/职业/工坊面板 + 工厂诊断/HUD
// （由 game.js 拆分于 2026-09-22，加载顺序：core → world → sim → ui → tools → main）

function updateStellarProjectUI() {
  const section = query('#stellar-project');
  if (!section) return;
  const project = state.stellarProject;
  const unlocked = isTechUnlocked('dyson-frame');
  const complete = project.progress >= 100;
  const progress = project.progress;
  const missing = [];
  if (project.sailsDeployed < 1) missing.push('太阳帆组件');
  if (project.rocketsDeployed < 1) missing.push('结构火箭组件');
  section.classList.toggle('project-locked', !unlocked);
  section.classList.toggle('project-complete', complete);
  query('#stellar-project-state').textContent = !unlocked ? '未解锁' : complete ? '已完成' : '施工中';
  query('#stellar-project-title').textContent = complete ? '第一圈戴森框架已点亮' : '戴森框架施工台';
  query('#stellar-project-copy').textContent = !unlocked
    ? '完成主线科技「戴森框架」，才能把异星材料转化为恒星轨道组件。'
    : complete
      ? (missing.length ? `恒星能量网络已建立，但轨道组件脱落：${missing.join('、')} 待补发。` : '恒星能量网络已建立，继续扩展将进入下一阶段。')
      : '从熔火-β回收钛，用结构矩阵和处理器部署轨道节点，再用发射台补发太阳帆与结构火箭组件。';
  query('#stellar-project-fill').style.width = `${progress}%`;
  query('#stellar-project-progress').textContent = `节点 ${project.nodesDeployed} / ${ORBIT_NODE_TARGET} · 太阳帆 ${project.sailsDeployed} · 结构火箭 ${project.rocketsDeployed}`;
  query('#stellar-project-supply').textContent = formatCost(stellarModuleCost);
  const componentLine = query('#stellar-project-components');
  if (componentLine) componentLine.textContent = !unlocked ? '解锁后开始部署轨道节点' : complete ? (missing.length ? `缺失 ${missing.length} 类组件 · ${missing.join('、')}` : '轨道组件运转中') : `框架完成前需部署 ${ORBIT_NODE_TARGET - project.nodesDeployed} 个轨道节点${missing.length ? ` · 后续需 ${missing.join('、')}` : ''}`;
  const energyReadout = query('#stellar-energy-readout');
  if (energyReadout) {
    energyReadout.textContent = !complete
      ? '节点部署到 20 且帆/火箭组件齐备后，可部署恒星接收器收集并转化能源。'
      : `恒星储能 ${formatNumber(Math.floor(project.energyStored || 0))} · 接收速率 ${(project.energyRate || 0).toFixed(1)} / 秒`;
  }
  const button = query('#stellar-project-button');
  button.disabled = !unlocked || complete || project.nodesDeployed >= ORBIT_NODE_TARGET || !canAffordStorage(stellarModuleCost);
  query('#stellar-project-cost').textContent = !unlocked ? '完成「戴森框架」后可用' : complete ? '恒星工程阶段完成' : project.nodesDeployed >= ORBIT_NODE_TARGET ? '轨道节点已部署完成' : button.disabled ? `材料不足 · ${formatCost(stellarModuleCost)}` : `消耗 ${formatCost(stellarModuleCost)}`;
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
  const activePlanet = planetById[state.activePlanet] || planetById.home;
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
    button.classList.toggle('current-planet', planet.id === activePlanet.id);
    const markerMeta = button.querySelector('small');
    if (markerMeta) markerMeta.textContent = locked
      ? '信标未接入'
      : planet.id === activePlanet.id
        ? '当前工厂'
        : state.interstellar.visits[planet.id]
          ? `${planet.role} · ${state.interstellar.visits[planet.id]} 航次`
          : planet.role;
  });
  query('#map-button-state').textContent = route ? '航线中' : unlocked ? '已接入' : '未接入';
  const worldName = query('#world-name');
  if (worldName) worldName.textContent = activePlanet.name;
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
  launch.disabled = !unlocked || activePlanet.id !== 'home' || target.id === 'home' || Boolean(route) || !cargoAvailable || target.requires.some(requirement => !isTechUnlocked(requirement));
  query('#launch-route-cost').textContent = activePlanet.id !== 'home'
    ? '返回母星后才能派遣'
    : !unlocked
      ? '完成「星际物流」后可用'
      : route
        ? '当前货运舱完成后可再次派遣'
        : `${resources[cargo.resource].label} ×${cargo.amount} · 往返 ${target.travelTime || 0} 秒`;
  const landButton = query('#planet-land-button');
  const landLabel = query('#planet-land-label');
  const landNote = query('#planet-land-note');
  const targetVisited = target.id === 'home' || Boolean(state.interstellar.visits[target.id]);
  const landingLocked = target.id !== 'home' && !targetVisited;
  landButton.disabled = Boolean(route) || !unlocked || landingLocked || target.id === activePlanet.id;
  if (target.id === activePlanet.id) {
    landLabel.textContent = '当前星球';
    landNote.textContent = `${activePlanet.name} 工厂运行中`;
  } else if (target.id === 'home') {
    landLabel.textContent = '返回母星';
    landNote.textContent = route ? '货运舱航行中' : '回到晨星-03主工厂';
  } else {
    landLabel.textContent = '进入星球';
    landNote.textContent = landingLocked ? '完成一次往返航次后开放' : `载入 ${target.name} 的本地工厂`;
  }
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
  query('#planet-land-button').onclick = () => {
    switchActivePlanet(state.interstellar.selectedPlanet);
    updateStarMapUI();
  };
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
      const itemSprite = rasterizedAsset(meta.image) || assets[meta.image];
      ctx.drawImage(itemSprite, point.x - itemSize / 2, point.y - itemSize / 2, itemSize, itemSize);
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
  if (state.tool === 'inspect') { drawSelectionOverlays(); return; }
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
    const dockSprite = rasterizedAsset(meta.image) || assets[meta.image];
    ctx.drawImage(dockSprite, -size * .44, -size * .44, size * .88, size * .88);
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
  drawDebugOverlay();
  drawPreview();
}

function drawDebugOverlay() {
  if (!state.debugOverlay) return;
  // 全部电网连线（不仅限于选中建筑）
  state.powerGrids.forEach(grid => {
    const members = new Map(grid.buildings.map(building => [building.id, building]));
    const color = powerGridColor(grid);
    ctx.save();
    ctx.globalAlpha = .5;
    ctx.lineWidth = Math.max(1, state.zoom);
    ctx.setLineDash([3, 6]);
    (grid.links || []).forEach(link => {
      const left = members.get(link.left);
      const right = members.get(link.right);
      if (!left || !right) return;
      const leftPoint = buildingCenter(left);
      const rightPoint = buildingCenter(right);
      const leftScreen = worldToScreen(leftPoint.x, leftPoint.y);
      const rightScreen = worldToScreen(rightPoint.x, rightPoint.y);
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(leftScreen.x, leftScreen.y);
      ctx.lineTo(rightScreen.x, rightScreen.y);
      ctx.stroke();
    });
    ctx.setLineDash([]);
    ctx.restore();
  });
  // 传送带流量标识：速度 + 在途件数
  state.belts.forEach(belt => {
    const end = getBeltEnd(belt);
    const start = worldToScreen(belt.x, belt.y);
    const finish = worldToScreen(end.x, end.y);
    const items = state.items.filter(item => item.beltId === belt.id).length;
    const midX = (start.x + finish.x) / 2;
    const midY = (start.y + finish.y) / 2;
    const label = `${getBeltTravelFactor().toFixed(1)} 格/s · ${items} 件`;
    ctx.save();
    ctx.globalAlpha = .85;
    ctx.fillStyle = 'rgba(4,13,22,.85)';
    ctx.font = '700 9px Bahnschrift, sans-serif';
    ctx.textAlign = 'center';
    roundedRect(ctx, midX - 40, midY - 9, 80, 16, 3);
    ctx.fill();
    ctx.fillStyle = '#69d8da';
    ctx.fillText(label, midX, midY + 2);
    ctx.restore();
  });
}

function drawSelectionOverlays() {
  const { selectionRect, movePreview, pasteMode, clipboard } = state;
  if (selectionRect) {
    const p0 = worldToScreen(selectionRect.x0, selectionRect.y0);
    const p1 = worldToScreen(selectionRect.x1 + 1, selectionRect.y1 + 1);
    const x = Math.min(p0.x, p1.x);
    const y = Math.min(p0.y, p1.y);
    const w = Math.abs(p1.x - p0.x);
    const h = Math.abs(p1.y - p0.y);
    ctx.save();
    ctx.fillStyle = 'rgba(199, 217, 76, .08)';
    ctx.strokeStyle = 'rgba(199, 217, 76, .8)';
    ctx.lineWidth = 1.5;
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
  }
  if (movePreview) {
    const groupIds = state.selectedIds.length ? state.selectedIds : (state.selectedId ? [state.selectedId] : []);
    state.buildings.filter(building => groupIds.includes(building.id)).forEach(building => {
      const meta = buildings[building.type];
      const target = { x: building.x + movePreview.dx, y: building.y + movePreview.dy };
      const result = verifyMoveTarget(building, target, new Set(groupIds));
      const color = result.valid ? '#62d69a' : '#ee6a65';
      const footprint = footprintCells(target, meta.size);
      ctx.save();
      ctx.globalAlpha = .5;
      ctx.fillStyle = `${color}30`;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      footprint.forEach(entry => {
        const point = worldToScreen(entry.x, entry.y);
        ctx.fillRect(point.x + 2, point.y + 2, TILE * state.zoom - 4, TILE * state.zoom - 4);
        ctx.strokeRect(point.x + 2, point.y + 2, TILE * state.zoom - 4, TILE * state.zoom - 4);
      });
      ctx.restore();
    });
  }
  if (pasteMode?.active && clipboard?.length && state.pointer.cell) {
    clipboard.forEach(entry => {
      const meta = buildings[entry.type];
      if (!meta) return;
      const target = { x: state.pointer.cell.x + entry.dx, y: state.pointer.cell.y + entry.dy };
      const check = placementCheck(entry.type, target);
      const color = check.valid ? meta.color : '#ee6a65';
      const footprint = footprintCells(target, meta.size);
      ctx.save();
      ctx.globalAlpha = .45;
      ctx.fillStyle = `${color}33`;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      footprint.forEach(footprintCell => {
        const point = worldToScreen(footprintCell.x, footprintCell.y);
        ctx.fillRect(point.x + 2, point.y + 2, TILE * state.zoom - 4, TILE * state.zoom - 4);
        ctx.strokeRect(point.x + 2, point.y + 2, TILE * state.zoom - 4, TILE * state.zoom - 4);
      });
      ctx.restore();
    });
  }
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
  const inputs = Object.keys(assemblyRecipeFor(producer).inputs);
  const output = assemblyRecipeFor(producer).output;
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
    return { kind: 'assemblerInputBelt', producer, source, resource: missingInput, output };
  }
  if (!findBeltStartingNear(producer, output)) return { kind: 'assemblerOutputBelt', producer, output };
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
  if (renderedDockCategory === nextCategory) return;
  all('.dock-category-button').forEach(button => {
    const active = button.dataset.dockCategory === nextCategory;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
  all('.tool-button').forEach(button => {
    button.hidden = button.dataset.dockCategory !== nextCategory;
  });
  renderedDockCategory = nextCategory;
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
  if (building.type === 'smelter') {
    const recipeLabel = building.recipeResource ? `${resources[building.recipeResource].label}矿` : '自动识别';
    return `${recipeLabel} → 金属锭 / 硅片 · 点击切换`;
  }
  if (building.type === 'assembler' || building.type === 'workbench') {
    const recipe = assemblyRecipeFor(building);
    const catalyst = building.type === 'assembler' && (building.input?.water || 0) > 0 ? ' · 水冷却加速中'
      : building.type === 'workbench' && (building.input?.crudeOil || 0) > 0 ? ' · 油润滑加速中'
        : '';
    return assemblyRecipeUnlocked(building, recipe)
      ? `${formatRecipeInputs(recipe.inputs)} → ${recipe.label}${catalyst} · 点击切换`
      : `配方锁定 · 需要「${techById[recipe.tech]?.label || '对应科技'}」`;
  }
  if (building.type === 'researchLab') {
    const cube = labProductionCube(building);
    const recipe = cubeRecipes[cube];
    return recipe ? `${building.researchMode === 'auto' ? '自动 · ' : ''}${formatRecipeInputs(recipe.inputs)} → ${recipe.label}${(building.input?.water || 0) > 0 ? ' · 水冷却加速中' : ''}` : '等待研究目标';
  }
  if (building.type === 'thermal') return '煤 → 电力';
  if (building.type === 'gasTurbine') return '天然气 → 电力';
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
  if ((building.type === 'assembler' || building.type === 'workbench') && !assemblyRecipeUnlocked(building, assemblyRecipeFor(building))) return '配方锁定';
  if (building.type === 'thermal' && (building.input.coal || 0) <= 0) return '缺煤';
  if (building.type === 'gasTurbine' && (building.input.naturalGas || 0) <= 0) return '缺气';
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
  if (building.type === 'gasTurbine') return '供电中';
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
    if (building.sorterMode === 'output') {
      const outBelts = sorterOutputBelts(building);
      const buffered = outBelts.reduce((sum, belt) => sum + state.items.filter(item => item.beltId === belt.id).length, 0);
      const beltCapacity = outBelts.reduce((sum, belt) => sum + Math.max(1, belt.length), 0);
      return buffered >= beltCapacity ? '出料受阻' : '等待取货';
    }
    return building.process > .05 ? '取放中' : '等待来料';
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
  if (Object.values(building.output).reduce((sum, amount) => sum + amount, 0) >= outputCapacity(building)) return '输出堵塞';
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
  if (building.type === 'assembler' || building.type === 'workbench') return clamp(building.process / Math.max(.1, assemblyRecipeFor(building).time), 0, 1);
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
  if (building.type === 'assembler' || building.type === 'workbench') recipe = { inputs: assemblyRecipeFor(building).inputs };
  if (building.type === 'researchLab') {
    const cube = labProductionCube(building);
    recipe = cubeRecipes[cube];
  }
  if (building.type === 'thermal') recipe = { inputs: { coal: 1 } };
  if (building.type === 'gasTurbine') recipe = { inputs: { naturalGas: 1 } };
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
    const hasGenerator = state.buildings.some(building => ['wind', 'thermal', 'gasTurbine'].includes(building.type) && isBuildingOperational(building));
    const hasTower = state.buildings.some(building => isPowerTowerType(building));
    const canDeployStarterGenerator = !hasGenerator && kitCount('wind') > 0;
    const canDeployStarterTower = hasGenerator && !hasTower && kitCount('powerTower') > 0;
    const powerTool = canDeployStarterGenerator
      ? 'wind'
      : canDeployStarterTower
        ? 'powerTower'
      : isBuildingUnlocked('wind') ? 'wind' : isBuildingUnlocked('thermal') ? 'thermal' : null;
    const powerLabel = powerTool ? buildings[powerTool].label : '风能捕获科技';
    const powerGapText = state.powerSummary.generation > POWER_EPSILON
      ? `当前发电 ${state.powerSummary.generation.toFixed(1)} MW，用电 ${state.powerSummary.load.toFixed(1)} MW。`
      : '当前没有可用发电。';
    const powerText = state.powerSummary.blackoutCount > 0
      ? canDeployStarterGenerator
        ? '着陆区还没有发电设备。先部署风力发电机，再用电力塔把厂区接入供电范围。'
        : canDeployStarterTower
          ? `${state.powerSummary.blackoutCount} 个电网已瘫痪。发电设备已就位，先部署基础电力塔，把设备纳入圆形覆盖范围。`
        : `${state.powerSummary.blackoutCount} 个电网已瘫痪。${powerGapText}先断开过载电塔或再部署一台发电设备，恢复一个小范围电网。`
      : `${state.powerSummary.highLoadCount} 个电网处于高负载，所有用电设施效率减半。${powerGapText}建议增设发电设备或拆分电网。`;
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
  const materialSummary = ['iron', 'copper', 'silicon'].map(resource => `${resources[resource].label} ${formatNumber(totalAmount(resource))}`).join(' · ');
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
  const day = Math.floor(state.time / 86400) + 1;
  query('#game-clock').textContent = `DAY ${String(day).padStart(3, '0')} · ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  const activePlanet = planetById[state.activePlanet] || planetById.home;
  const worldName = query('#world-name');
  if (worldName) worldName.textContent = activePlanet.name;
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
  const rateResources = ['iron', 'copper', 'silicon', 'ironIngot', 'copperIngot', 'siliconWafer', 'processor', 'electromagneticCube', 'energyCube', 'structureCube', 'informationCube'];
  const shownRates = rateResources
    .map(resource => ({ resource, rate: productionRate(resource) }))
    .filter(entry => entry.rate > 0)
    .sort((left, right) => right.rate - left.rate)
    .slice(0, 4);
  query('#production-rates').textContent = shownRates.length
    ? shownRates.map(entry => `${resources[entry.resource].label} ${Math.round(entry.rate)}/分`).join(' · ')
    : '暂无产出';
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
  } else {
    query('#cursor-readout').textContent = state.tool === 'inspect'
      ? '移动到建筑或传送带查看详情'
      : '移动到地图上预览放置位置';
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
  const multiCount = state.selectedIds?.length || 0;
  if (!selected && !selectedBelt && multiCount <= 1) { selection.hidden = true; labModePicker.hidden = true; sorterInterface.hidden = true; stockLine.hidden = true; interfaceLine.hidden = true; gridLine.hidden = true; gridAction.hidden = true; }
  else if (!selected && !selectedBelt && multiCount > 1) {
    selection.hidden = false;
    labModePicker.hidden = true;
    sorterInterface.hidden = true;
    stockLine.hidden = true;
    interfaceLine.hidden = true;
    gridLine.hidden = true;
    gridAction.hidden = true;
    query('#selection-name').textContent = `${multiCount} 座建筑`;
    query('#selection-state').textContent = '框选状态 · 拖拽整体移动';
    query('#selection-state').style.color = '#62d69a';
    query('#selection-input').textContent = state.selectedIds.map(id => buildings[state.buildings.find(building => building.id === id)?.type]?.label || '未知').join('、');
    query('#selection-output').textContent = '—';
    query('#selection-recipe').textContent = 'Ctrl+C 复制布局 · 拖拽移动';
    query('#selection-recipe').style.cursor = 'default';
    query('#selection-production').textContent = '—';
    query('#selection-tech').textContent = '—';
    query('#selection-license').textContent = '—';
    query('#selection-upgrade').textContent = '—';
  }
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
    query('#selection-recipe').style.cursor = 'default';
    query('#selection-production').textContent = '—';
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
    query('#selection-state').style.color = ['科技锁定', '配方锁定', '电力不足', '电网瘫痪', '电网高负载', '输出堵塞', '缺少输入', '缺少矩阵组件', '缺煤', '缺气', '未接入矿脉', '未接入水源', '未接入电网'].includes(status) ? '#ff9b3d' : '#62d69a';
    query('#selection-output').textContent = output ? `${formatNumber(output[1])} 单位缓存` : ['miner', 'oilExtractor', 'waterPump', 'gasExtractor'].includes(selected.type) ? '采掘中 · 等待输出' : '等待产出';
    query('#selection-recipe').textContent = buildingRecipeText(selected);
    query('#selection-recipe').style.cursor = ['smelter', 'assembler', 'workbench'].includes(selected.type) ? 'pointer' : 'default';
    const selectionProduction = buildingProductionRate(selected.id);
    query('#selection-production').textContent = selectionProduction > 0 ? `≈ ${Math.round(selectionProduction)} 件 / 分` : '近一分钟无产出';
    const selectionInputFill = query('#selection-input-fill');
    if (selectionInputFill) selectionInputFill.style.width = `${Math.round(inputReadiness(selected) * 100)}%`;
    const selectionOutputFill = query('#selection-output-fill');
    if (selectionOutputFill) {
      const selectionOutputTotal = Object.values(selected.output || {}).reduce((sum, amount) => sum + amount, 0);
      selectionOutputFill.style.width = `${Math.round(selectionOutputTotal / Math.max(1, outputCapacity(selected)) * 100)}%`;
    }
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
    const fuelResource = selected.type === 'thermal' ? 'coal' : selected.type === 'gasTurbine' ? 'naturalGas' : null;
    const hasFuel = !fuelResource || (selected.input?.[fuelResource] || 0) > 0;
    if (isPowerTowerType(selected)) {
      query('#selection-power-label').textContent = '自身耗电';
      query('#selection-power').textContent = `${nominalPower.toFixed(2)} MW`;
    } else if (meta.generation) {
      query('#selection-power-label').textContent = hasFuel ? '当前发电' : fuelResource === 'naturalGas' ? '当前发电 · 缺气' : '当前发电 · 缺煤';
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
