const careers = {
  production: {
    name: '生产工程师',
    short: 'Production Engineer',
    summary: '让工厂先跑起来，再用能源换取产能爆发。',
    advantage: '+12% 组装效率',
    starter: '+1 初始组装机',
    ability: '超频生产',
    tradeoff: '高峰期更容易产生电力压力',
    color: 'olive',
    image: 'output/imagegen/character-production-engineer-v01.png'
  },
  energy: {
    name: '能源工程师',
    short: 'Energy Engineer',
    summary: '先把电网变成底座，再让每一条产线安心扩张。',
    advantage: '+12% 发电效率',
    starter: '+25% 储能容量',
    ability: '紧急并网',
    tradeoff: '早期生产建筑选择较少',
    color: 'amber',
    image: 'output/imagegen/character-production-engineer-v01.png'
  },
  logistics: {
    name: '物流调度师',
    short: 'Logistics Planner',
    summary: '用航线解决距离，让工厂从第一天就学会共享资源。',
    advantage: '+15% 运输速度',
    starter: '提前获得基础物流站',
    ability: '运输优先级',
    tradeoff: '需要更早投入运输资源',
    color: 'cyan',
    image: 'output/imagegen/character-production-engineer-v01.png'
  },
  exploration: {
    name: '星球勘探师',
    short: 'Planetary Scout',
    summary: '先找到最值得开发的地方，再决定工厂应该长成什么样。',
    advantage: '+30% 资源扫描范围',
    starter: '深层资源扫描器',
    ability: '深层扫描',
    tradeoff: '本地工业起步能力较弱',
    color: 'violet',
    image: 'output/imagegen/character-production-engineer-v01.png'
  },
  research: {
    name: '科研工程师',
    short: 'Research Engineer',
    summary: '提前看见生产链的尽头，用研究换取更早的系统解锁。',
    advantage: '+15% 研究速度',
    starter: '分析实验室',
    ability: '临时推演',
    tradeoff: '前期直接产能不突出',
    color: 'violet',
    image: 'output/imagegen/character-production-engineer-v01.png'
  }
};

const buildings = {
  assembler: {
    title: '高级组装机',
    state: '输入不足',
    detail: '当前效率 68% · 等待硅片',
    code: 'E-104',
    recipe: '处理器',
    one: '30 / min',
    two: '18 / 30 min',
    warning: true
  },
  miner: {
    title: '采矿机群 A-04',
    state: '运行正常',
    detail: '当前效率 100% · 矿脉稳定',
    code: 'OK-204',
    recipe: '铜矿',
    one: '42 / min',
    two: '资源充足',
    warning: false
  },
  smelter: {
    title: '熔炼阵列 B-02',
    state: '运行正常',
    detail: '当前效率 94% · 热能稳定',
    code: 'OK-118',
    recipe: '铜锭',
    one: '36 / min',
    two: '输入正常',
    warning: false
  },
  silicon: {
    title: '硅片冶炼区',
    state: '供应不足',
    detail: '当前效率 60% · 需要火山星补给',
    code: 'L-220',
    recipe: '硅片',
    one: '18 / min',
    two: '缺口 12 / min',
    warning: true
  },
  microcrystal: {
    title: '微晶组件线',
    state: '等待输入',
    detail: '当前效率 74% · 上游硅片不足',
    code: 'E-117',
    recipe: '微晶组件',
    one: '18 / min',
    two: '等待硅片',
    warning: true
  },
  power: {
    title: '储能阵列 D-03',
    state: '接近上限',
    detail: '当前容量 91% · 建议扩容',
    code: 'P-091',
    recipe: '储能',
    one: '31.6 MW',
    two: '容量 91%',
    warning: true
  },
  logistics: {
    title: '行星物流站 P-02',
    state: '等待装载',
    detail: '北辰航线 · 预计 04:18',
    code: 'T-042',
    recipe: '星际运输',
    one: '12 条航线',
    two: '等待货物',
    warning: true
  }
};

const resources = {
  copper: { name: '铜矿', location: '晨星-03 · 北部铜矿脉', status: '富集', amount: '62.4k', rate: '42/min' },
  silicon: { name: '硅矿', location: '晨星-03 · 西侧硅晶带', status: '中等', amount: '28.1k', rate: '18/min' },
  iron: { name: '铁矿', location: '晨星-03 · 东南铁矿层', status: '未开发', amount: '91.6k', rate: '扫描' },
  titanium: { name: '钛晶', location: '炽流-07 · 外环断层', status: '未发现', amount: '--', rate: '锁定' },
  ice: { name: '冰晶', location: '凛冬-12 · 冰冠带', status: '航线外', amount: '46.2k', rate: '等待' }
};

const buildCatalog = {
  miner: { name: '采矿机', kind: 'building', icon: '⌁', className: 'miner', size: 2, power: 0.6 },
  smelter: { name: '熔炼炉', kind: 'building', icon: '◈', className: 'smelter', size: 2, power: 0.9 },
  assembler: { name: '组装机', kind: 'building', icon: '⌬', className: 'assembler', size: 2, power: 1.2 },
  logistics: { name: '物流站', kind: 'building', icon: '✦', className: 'logistics', size: 3, power: 2.4 },
  belt: { name: '传送带', kind: 'belt', icon: '╱╲', className: 'belt', size: 1, power: 0 },
  demolish: { name: '拆除', kind: 'demolish', icon: '⌫', className: 'demolish', size: 1, power: 0 }
};

function loadLayout() {
  try {
    const saved = JSON.parse(localStorage.getItem('stellar-echo-build-layout') || '[]');
    return Array.isArray(saved) ? saved.filter(item => item && buildCatalog[item.tool]) : [];
  } catch {
    return [];
  }
}

const state = {
  view: 'overview',
  selectedCareer: 'production',
  pendingCareer: 'production',
  selectedBuilding: 'assembler',
  selectedResource: 'copper',
  buildMode: false,
  buildTool: 'miner',
  buildRotation: 0,
  hoveredCell: null,
  dragStart: null,
  placedStructures: loadLayout(),
  paused: false,
  notificationsOpen: false,
  searchOpen: false,
  simMinutes: 18 * 60 + 42
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const viewMeta = {
  overview: ['晨星-03 · 工业中枢', '第一工业带运行稳定。处理器供应出现轻微缺口，建议检查硅片输入。'],
  production: ['生产分析 · 处理器链路', '从成品向上追踪，定位当前工业系统里最值得先解决的瓶颈。'],
  starmap: ['赫利俄斯 · 星际地图', '三颗星球已经接入同一条物流网络，下一条航线等待你的规划。'],
  blueprints: ['蓝图仓库 · 工业方案', '保存经过验证的生产布局，把一次思考变成可以重复部署的系统。'],
  career: ['职业档案 · 工业许可', '职业改变你的起步路线，不会限制最终的恒星级工程。']
};

function renderCareerOptions() {
  const container = $('#career-options');
  container.innerHTML = Object.entries(careers).map(([key, career]) => `
    <button class="career-card ${key === state.pendingCareer ? 'selected' : ''} ${career.color}" data-career="${key}">
      <div class="career-card-top"><span class="career-symbol">${key === 'production' ? '⌬' : key === 'energy' ? '◉' : key === 'logistics' ? '↗' : key === 'exploration' ? '⌖' : '✦'}</span><span class="career-choice">${key === state.pendingCareer ? '已选择' : '选择'}</span></div>
      <div class="career-card-copy"><h3>${career.name}</h3><small>${career.short}</small><p>${career.summary}</p></div>
      <div class="career-card-perks"><span><b>${career.advantage.split(' ')[0]}</b> ${career.advantage.split(' ').slice(1).join(' ')}</span><span><b>${career.ability}</b> 主动能力</span></div>
      <div class="career-card-tradeoff"><small>考虑代价</small><span>${career.tradeoff}</span></div>
    </button>
  `).join('');
  $('#pending-career-name').textContent = careers[state.pendingCareer].name;
}

function setView(view) {
  if (!viewMeta[view]) return;
  if (view !== 'overview') exitBuildMode();
  state.view = view;
  $$('.view').forEach(panel => panel.classList.toggle('active', panel.dataset.viewPanel === view));
  $$('.nav-item[data-view]').forEach(item => item.classList.toggle('active', item.dataset.view === view));
  $('#page-title').textContent = viewMeta[view][0];
  $('#page-subtitle').textContent = viewMeta[view][1];
  closeTransientPanels();
  window.location.hash = view;
}

function updateCareerUI() {
  const career = careers[state.selectedCareer];
  $('#top-career-name').textContent = career.name;
  $('#sidebar-career-name').textContent = career.name;
  $('#career-page-name').textContent = career.name;
  $('#career-page-summary').textContent = career.summary;
  $('#sidebar-career-level').textContent = `职业等级 01 · ${career.advantage}`;
}

function updateInspector(buildingKey = state.selectedBuilding) {
  const building = buildings[buildingKey] || buildings.assembler;
  state.selectedBuilding = buildingKey;
  $('#inspector-title').textContent = building.title;
  $('#inspector-state').textContent = building.state;
  $('#inspector-state-detail').textContent = building.detail;
  $('.state-code').textContent = building.code;
  $('#recipe-name').textContent = building.recipe;
  $('#recipe-input-one').textContent = building.one;
  $('#recipe-input-two').textContent = building.two;
  $('.inspector-state').classList.toggle('normal', !building.warning);
  $('.inspector-state').classList.toggle('warning', building.warning);
  $$('.building-marker').forEach(marker => marker.classList.toggle('selected', marker.dataset.building === buildingKey));
  $$('.chain-node').forEach(node => node.classList.toggle('selected', node.dataset.building === buildingKey));
}

function updateResourceFocus(resourceKey = state.selectedResource) {
  const resource = resources[resourceKey] || resources.copper;
  state.selectedResource = resourceKey;
  $$('.resource-node, .resource-card').forEach(node => node.classList.toggle('selected', node.dataset.resource === resourceKey));
  toast(`已定位资源：${resource.name} · ${resource.location}`, 'info');
}

function getBuildCell(event) {
  const scene = $('#world-scene');
  const rect = scene.getBoundingClientRect();
  const cellSize = parseFloat(getComputedStyle(scene).getPropertyValue('--grid-size')) || 42;
  const columns = Math.max(1, Math.floor(rect.width / cellSize));
  const rows = Math.max(1, Math.floor(rect.height / cellSize));
  return {
    x: Math.max(0, Math.min(columns - 1, Math.floor((event.clientX - rect.left) / cellSize))),
    y: Math.max(0, Math.min(rows - 1, Math.floor((event.clientY - rect.top) / cellSize))),
    size: cellSize
  };
}

function buildToolFromName(name = '') {
  return Object.entries(buildCatalog).find(([, item]) => item.name === name)?.[0] || 'miner';
}

function updateBuildModeUI() {
  const scene = $('#world-scene');
  const hud = $('#construction-hud');
  const catalog = buildCatalog[state.buildTool];
  scene.classList.toggle('build-mode', state.buildMode);
  hud.hidden = !state.buildMode;
  hud.setAttribute('aria-hidden', String(!state.buildMode));
  $('#build-tool-name').textContent = catalog?.name || '采矿机';
  $('#build-status-readout').textContent = state.buildMode ? `自由建造：${catalog?.name || '设施'} · ${state.placedStructures.length} 已放置` : '自由建造：未启用';
  $$('.construction-tool').forEach(button => button.classList.toggle('selected', button.dataset.buildTool === state.buildTool));
  if (!state.buildMode) $('#build-preview').hidden = true;
}

function enterBuildMode(tool = state.buildTool) {
  state.buildTool = buildCatalog[tool] ? tool : 'miner';
  state.buildMode = true;
  state.dragStart = null;
  updateBuildModeUI();
  toast(`已进入自由建造：${buildCatalog[state.buildTool].name}`, 'info');
}

function exitBuildMode() {
  if (!state.buildMode) return;
  state.buildMode = false;
  state.dragStart = null;
  updateBuildModeUI();
}

function updateBuildPreview(cell) {
  const preview = $('#build-preview');
  if (!state.buildMode || !cell) {
    preview.hidden = true;
    return;
  }
  const catalog = buildCatalog[state.buildTool];
  const start = state.dragStart || cell;
  preview.hidden = false;
  state.hoveredCell = cell;
  preview.className = `build-preview tool-${catalog.className}`;
  preview.style.left = `${cell.x * cell.size + 2}px`;
  preview.style.top = `${cell.y * cell.size + 2}px`;
  preview.style.width = `${Math.max(16, cell.size * (catalog.size || 1) - 4)}px`;
  preview.style.height = `${Math.max(16, cell.size * (catalog.size || 1) - 4)}px`;
  preview.style.transform = `rotate(${state.buildRotation}deg)`;
  if (catalog.kind === 'belt') {
    const horizontal = Math.abs(cell.x - start.x) >= Math.abs(cell.y - start.y);
    const length = horizontal ? Math.abs(cell.x - start.x) + 1 : Math.abs(cell.y - start.y) + 1;
    preview.className = `build-preview belt-preview ${horizontal ? 'horizontal' : 'vertical'}`;
    preview.style.left = `${(horizontal ? Math.min(start.x, cell.x) : cell.x) * cell.size + 4}px`;
    preview.style.top = `${(horizontal ? cell.y : Math.min(start.y, cell.y)) * cell.size + cell.size / 2 - 3}px`;
    preview.style.width = horizontal ? `${length * cell.size - 8}px` : '6px';
    preview.style.height = horizontal ? '6px' : `${length * cell.size - 8}px`;
    preview.style.transform = 'none';
  }
  $('#build-grid-readout').textContent = `GRID ${String(cell.x).padStart(2, '0')},${String(cell.y).padStart(2, '0')}`;
}

function renderPlacedStructures() {
  const layer = $('#placed-layer');
  layer.innerHTML = state.placedStructures.map(item => {
    const catalog = buildCatalog[item.tool];
    if (item.kind === 'belt') {
      const style = `--grid-x:${item.x};--grid-y:${item.y};--belt-length:${item.length};--belt-rotation:${item.orientation === 'vertical' ? 90 : 0}deg;`;
      return `<button class="placed-belt ${item.orientation}" data-placed-id="${item.id}" style="${style}" title="传送带 · 点击选择"><span>${catalog.icon}</span></button>`;
    }
    const style = `--grid-x:${item.x};--grid-y:${item.y};--building-size:${catalog.size};--building-rotation:${item.rotation}deg;`;
    return `<button class="placed-structure tool-${catalog.className}" data-placed-id="${item.id}" style="${style}" title="${catalog.name} · 点击选择"><span>${catalog.icon}</span><small>${catalog.name}</small></button>`;
  }).join('');
  const power = state.placedStructures.reduce((total, item) => total + (buildCatalog[item.tool]?.power || 0), 0);
  localStorage.setItem('stellar-echo-build-layout', JSON.stringify(state.placedStructures));
  $('#facility-count').textContent = 12 + state.placedStructures.filter(item => item.kind !== 'belt').length;
  $('#build-status-readout').textContent = state.buildMode ? `自由建造：${buildCatalog[state.buildTool]?.name || '设施'} · ${state.placedStructures.length} 已放置 · +${power.toFixed(1)} MW` : `自由建造：${state.placedStructures.length} 个自建对象`;
}

function isOccupied(x, y, size = 1) {
  return state.placedStructures.some(item => {
    if (item.kind === 'belt') return false;
    const otherSize = buildCatalog[item.tool]?.size || 1;
    return x < item.x + otherSize && x + size > item.x && y < item.y + otherSize && y + size > item.y;
  });
}

function removePlacedAt(cell) {
  const index = state.placedStructures.findIndex(item => {
    if (item.kind === 'belt') {
      return item.orientation === 'horizontal' ? cell.y === item.y && cell.x >= item.x && cell.x < item.x + item.length : cell.x === item.x && cell.y >= item.y && cell.y < item.y + item.length;
    }
    const size = buildCatalog[item.tool]?.size || 1;
    return cell.x >= item.x && cell.x < item.x + size && cell.y >= item.y && cell.y < item.y + size;
  });
  if (index === -1) {
    toast('这里没有可拆除的自建对象', 'warning');
    return;
  }
  const [removed] = state.placedStructures.splice(index, 1);
  renderPlacedStructures();
  updateBuildModeUI();
  addActivity(`已拆除「${buildCatalog[removed.tool].name}」`, '建材已回收到本地仓储', 'amber');
  toast(`已拆除：${buildCatalog[removed.tool].name}`, 'success');
}

function placeBuildingAt(cell) {
  const catalog = buildCatalog[state.buildTool];
  if (state.buildTool === 'demolish') {
    removePlacedAt(cell);
    return;
  }
  if (catalog.kind === 'belt') return;
  if (isOccupied(cell.x, cell.y, catalog.size)) {
    toast('空间被占用：请换一个网格位置', 'warning');
    return;
  }
  const id = `placed-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  state.placedStructures.push({ id, tool: state.buildTool, kind: catalog.kind, x: cell.x, y: cell.y, rotation: state.buildRotation });
  renderPlacedStructures();
  updateBuildModeUI();
  addActivity(`已放置「${catalog.name}」`, `网格 ${cell.x},${cell.y} · 设施已接入本地电网`, 'green');
  toast(`${catalog.name} 已放置`, 'success');
}

function placeBeltBetween(start, end) {
  if (!start || (start.x === end.x && start.y === end.y)) {
    toast('传送带至少需要连接两个网格', 'warning');
    return;
  }
  const horizontal = Math.abs(end.x - start.x) >= Math.abs(end.y - start.y);
  const item = { id: `belt-${Date.now()}`, tool: 'belt', kind: 'belt', orientation: horizontal ? 'horizontal' : 'vertical', x: horizontal ? Math.min(start.x, end.x) : start.x, y: horizontal ? start.y : Math.min(start.y, end.y), length: horizontal ? Math.abs(end.x - start.x) + 1 : Math.abs(end.y - start.y) + 1 };
  state.placedStructures.push(item);
  renderPlacedStructures();
  updateBuildModeUI();
  addActivity('已铺设传送带', `${item.length} 格 · ${item.orientation === 'horizontal' ? '横向' : '纵向'}物流段`, 'cyan');
  toast(`传送带已铺设：${item.length} 格`, 'success');
}

function openCareerDialog() {
  state.pendingCareer = state.selectedCareer;
  renderCareerOptions();
  const dialog = $('#career-dialog');
  if (!dialog.open) dialog.showModal();
}

function closeCareerDialog() {
  $('#career-dialog').close();
}

function toggleSearch(force) {
  state.searchOpen = typeof force === 'boolean' ? force : !state.searchOpen;
  if (state.searchOpen) toggleNotifications(false);
  const drawer = $('#search-drawer');
  drawer.classList.toggle('open', state.searchOpen);
  drawer.setAttribute('aria-hidden', String(!state.searchOpen));
  if (state.searchOpen) setTimeout(() => $('#search-input').focus(), 50);
}

function toggleNotifications(force) {
  state.notificationsOpen = typeof force === 'boolean' ? force : !state.notificationsOpen;
  if (state.notificationsOpen) toggleSearch(false);
  const drawer = $('#notification-drawer');
  drawer.classList.toggle('open', state.notificationsOpen);
  drawer.setAttribute('aria-hidden', String(!state.notificationsOpen));
}

function closeTransientPanels() {
  toggleSearch(false);
  toggleNotifications(false);
}

let toastTimer;
function toast(message, type = 'success') {
  const toastEl = $('#toast');
  $('#toast-message').textContent = message;
  toastEl.className = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2800);
}

function addActivity(message, detail, type = 'cyan') {
  const list = $('#activity-list');
  const item = document.createElement('div');
  item.className = 'activity-item is-new';
  item.innerHTML = `<span class="activity-icon ${type}">${type === 'amber' ? '!' : '↗'}</span><div><strong>${message}</strong><small>${detail}</small></div><b class="activity-tag info-tag">刚刚</b>`;
  list.prepend(item);
  setTimeout(() => item.classList.remove('is-new'), 700);
  while (list.children.length > 4) list.lastElementChild.remove();
}

function updateClock() {
  if (!state.paused) state.simMinutes = (state.simMinutes + 1) % (24 * 60);
  const hours = String(Math.floor(state.simMinutes / 60)).padStart(2, '0');
  const minutes = String(state.simMinutes % 60).padStart(2, '0');
  $('#sim-clock').textContent = `DAY 047 · ${hours}:${minutes}`;
}

function handleAction(action, target) {
  switch (action) {
    case 'open-career': openCareerDialog(); break;
    case 'close-career': closeCareerDialog(); break;
    case 'confirm-career':
      state.selectedCareer = state.pendingCareer;
      updateCareerUI();
      closeCareerDialog();
      addActivity(`职业已切换为「${careers[state.selectedCareer].name}」`, '职业许可同步完成 · 所有已建造设施保留', 'green');
      toast(`已启用 ${careers[state.selectedCareer].name} 职业许可`);
      break;
    case 'toggle-search': toggleSearch(); break;
    case 'toggle-notifications': toggleNotifications(); break;
    case 'toggle-build-mode': state.buildMode ? exitBuildMode() : enterBuildMode('miner'); break;
    case 'exit-build-mode': exitBuildMode(); break;
    case 'toggle-pause':
      state.paused = !state.paused;
      $('#pause-label').textContent = state.paused ? '继续模拟' : '暂停模拟';
      $('.pause-button').classList.toggle('paused', state.paused);
      toast(state.paused ? '模拟已暂停' : '模拟已继续', 'info');
      break;
    case 'quick-build': {
      const buildName = target.dataset.build || '设施';
      enterBuildMode(target.dataset.tool || buildToolFromName(buildName));
      addActivity(`已选择「${buildName}」`, '点击工业地表网格放置，按 R 可旋转', 'cyan');
      break;
    }
    case 'open-build-menu': enterBuildMode('miner'); break;
    case 'copy-settings': toast('配置已复制，可粘贴到同类设施', 'info'); break;
    case 'upgrade-building': toast('升级预览已打开：需要 240 个处理器', 'info'); break;
    case 'deconstruct': enterBuildMode('demolish'); break;
    case 'clear-activity': $('#activity-list').innerHTML = '<div class="empty-activity"><span>⌁</span><b>系统记录已清空</b><small>新的事件会在这里出现</small></div>'; toast('活动记录已清除', 'info'); break;
    case 'create-blueprint': toast('蓝图框选模式已开启', 'info'); break;
    case 'import-blueprint': toast('导入面板已准备（MVP 模拟）', 'info'); break;
    case 'place-blueprint': toast(`「${target.dataset.blueprint}」已加载到光标`, 'info'); break;
    case 'scan-planet': toast('扫描完成：发现 2 处新矿脉', 'success'); break;
    case 'set-planet-focus': toast('晨星-03 已设为当前规划星球', 'success'); break;
    case 'new-route': toast('航线规划模式已开启', 'info'); break;
    case 'center-map': toast('已将赫利俄斯星系置于视野中心', 'info'); break;
    case 'toggle-map-labels': toast('星球标注已切换', 'info'); break;
    case 'show-settings': toast('设置面板将在下个版本开放', 'info'); break;
    default: toast('该操作将在后续版本开放', 'info');
  }
}

document.addEventListener('click', event => {
  const toolButton = event.target.closest('[data-build-tool]');
  if (toolButton) {
    enterBuildMode(toolButton.dataset.buildTool);
    return;
  }
  const placedTarget = event.target.closest('[data-placed-id]');
  if (placedTarget) {
    const item = state.placedStructures.find(entry => entry.id === placedTarget.dataset.placedId);
    if (state.buildMode && state.buildTool === 'demolish' && item) {
      const cell = { x: item.x, y: item.y };
      removePlacedAt(cell);
    } else if (item) {
      toast(`已选择：${buildCatalog[item.tool].name}`, 'info');
    }
    return;
  }
  const viewButton = event.target.closest('[data-view]');
  if (viewButton) {
    event.preventDefault();
    setView(viewButton.dataset.view);
    return;
  }
  const careerButton = event.target.closest('[data-career]');
  if (careerButton) {
    state.pendingCareer = careerButton.dataset.career;
    renderCareerOptions();
    return;
  }
  const buildingButton = event.target.closest('[data-building]');
  if (buildingButton) {
    updateInspector(buildingButton.dataset.building);
    if (state.view !== 'overview' && state.view !== 'production') setView('overview');
    toast(`已定位：${buildings[buildingButton.dataset.building]?.title || '设施'}`, 'info');
    return;
  }
  const resourceButton = event.target.closest('[data-resource]');
  if (resourceButton) {
    updateResourceFocus(resourceButton.dataset.resource);
    return;
  }
  const planetButton = event.target.closest('[data-planet]');
  if (planetButton) {
    $$('.star-node').forEach(node => node.classList.remove('active'));
    planetButton.classList.add('active');
    $('#planet-name').textContent = planetButton.dataset.planet;
    const planetData = { '晨星-03': ['温带行星', '工业化等级 02'], '炽流-07': ['火山行星', '工业化等级 01'], '凛冬-12': ['冰卫星', '工业化等级 00'] }[planetButton.dataset.planet];
    $('#planet-type').textContent = planetData[0];
    $('#planet-type').nextElementSibling.textContent = planetData[1];
    toast(`已选中星球：${planetButton.dataset.planet}`, 'info');
    return;
  }
  const actionTarget = event.target.closest('[data-action]');
  if (actionTarget) handleAction(actionTarget.dataset.action, actionTarget);
  const result = event.target.closest('[data-search-result]');
  if (result) {
    toggleSearch(false);
    toast(`已定位搜索结果：${result.dataset.searchResult}`, 'info');
  }
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    if (state.buildMode) exitBuildMode();
    toggleSearch(false);
    toggleNotifications(false);
    if ($('#career-dialog').open) closeCareerDialog();
  }
  if (state.buildMode && event.key.toLowerCase() === 'r' && document.activeElement.tagName !== 'INPUT') {
    event.preventDefault();
    state.buildRotation = (state.buildRotation + 90) % 360;
    updateBuildPreview(state.hoveredCell);
    toast(`朝向已旋转至 ${state.buildRotation}°`, 'info');
  }
  if (event.key === '/' && document.activeElement.tagName !== 'INPUT') {
    event.preventDefault();
    toggleSearch(true);
  }
  if (event.code === 'Space' && document.activeElement.tagName !== 'INPUT' && !$('#career-dialog').open) {
    event.preventDefault();
    handleAction('toggle-pause', $('.pause-button'));
  }
});

$('#search-input').addEventListener('input', event => {
  const query = event.target.value.trim().toLowerCase();
  $$('#search-results > button').forEach(result => result.hidden = query && !result.textContent.toLowerCase().includes(query));
});

const worldScene = $('#world-scene');
worldScene.addEventListener('pointermove', event => {
  if (!state.buildMode || event.target.closest('.construction-hud')) return;
  updateBuildPreview(getBuildCell(event));
});
worldScene.addEventListener('pointerleave', () => {
  if (!state.dragStart) $('#build-preview').hidden = true;
});
worldScene.addEventListener('pointerdown', event => {
  if (!state.buildMode || event.target.closest('.construction-hud') || event.target.closest('button')) return;
  event.preventDefault();
  const cell = getBuildCell(event);
  state.dragStart = buildCatalog[state.buildTool].kind === 'belt' ? cell : null;
  worldScene.setPointerCapture?.(event.pointerId);
  updateBuildPreview(cell);
});
worldScene.addEventListener('pointerup', event => {
  if (!state.buildMode || event.target.closest('.construction-hud')) return;
  if (event.target.closest('button')) {
    state.dragStart = null;
    return;
  }
  event.preventDefault();
  const cell = getBuildCell(event);
  const catalog = buildCatalog[state.buildTool];
  if (catalog.kind === 'belt') {
    placeBeltBetween(state.dragStart, cell);
  } else {
    placeBuildingAt(cell);
  }
  state.dragStart = null;
  updateBuildPreview(cell);
});

renderCareerOptions();
updateCareerUI();
updateInspector();
renderPlacedStructures();
updateBuildModeUI();
$$('.resource-node, .resource-card').forEach(node => node.classList.toggle('selected', node.dataset.resource === state.selectedResource));
setInterval(updateClock, 60000);
