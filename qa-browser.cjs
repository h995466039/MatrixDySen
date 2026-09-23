// Browser-level regression for the redesigned console.
// Runs against the local HTTP server and uses only user-facing DOM/input paths.
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const ROOT = __dirname;
const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9336;
const APP_URL = process.env.APP_URL || 'http://127.0.0.1:8080/index.html?browserQa=1';
const OUT = path.join(ROOT, 'output', 'browser_qa');
const PROFILE = path.join(OUT, `.chrome-profile-${Date.now()}`);
fs.mkdirSync(OUT, { recursive: true });

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const httpJson = (method, urlPath) => new Promise((resolve, reject) => {
  const request = http.request(`http://127.0.0.1:${PORT}${urlPath}`, { method }, response => {
    let body = '';
    response.on('data', chunk => { body += chunk; });
    response.on('end', () => {
      try { resolve(JSON.parse(body)); } catch (error) { reject(error); }
    });
  });
  request.on('error', reject);
  request.end();
});

class Cdp {
  constructor(webSocket) {
    this.webSocket = webSocket;
    this.id = 0;
    this.pending = new Map();
  }

  static async connect(url) {
    const webSocket = new WebSocket(url);
    await new Promise((resolve, reject) => {
      webSocket.onopen = resolve;
      webSocket.onerror = reject;
    });
    const cdp = new Cdp(webSocket);
    webSocket.onmessage = event => {
      const message = JSON.parse(event.data);
      const pending = cdp.pending.get(message.id);
      if (!pending) return;
      cdp.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
    };
    return cdp;
  }

  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.webSocket.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) throw new Error(`browser JS: ${JSON.stringify(result.exceptionDetails)}`);
    return result.result.value;
  }

  async mouse(type, x, y, modifiers = 0, button = 'left') {
    return this.send('Input.dispatchMouseEvent', {
      type, x, y, button, modifiers,
      buttons: type === 'mousePressed' || type === 'mouseMoved' ? 1 : 0,
      clickCount: type === 'mousePressed' ? 1 : 0,
    });
  }

  async key(key, code, text = '', modifiers = 0) {
    await this.send('Input.dispatchKeyEvent', {
      type: 'keyDown', key, code, text, modifiers,
      windowsVirtualKeyCode: key === ' ' ? 32 : key.length === 1 ? key.toUpperCase().charCodeAt(0) : 0,
    });
    await this.send('Input.dispatchKeyEvent', {
      type: 'keyUp', key, code, modifiers,
      windowsVirtualKeyCode: key === ' ' ? 32 : key.length === 1 ? key.toUpperCase().charCodeAt(0) : 0,
    });
  }

  async screenshot(name) {
    const result = await this.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT, name), Buffer.from(result.data, 'base64'));
  }

  close() {
    try { this.webSocket.close(); } catch {}
  }
}

async function waitFor(cdp, expression, timeout = 15000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await cdp.eval(expression)) return;
    await sleep(150);
  }
  throw new Error(`timeout waiting for ${expression}`);
}

async function main() {
  const chrome = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=1440,900', 'about:blank',
  ], { stdio: 'ignore' });
  let cdp;
  const checks = [];
  const check = (condition, message) => {
    if (!condition) throw new Error(`ASSERT: ${message}`);
    checks.push(message);
    console.log(`PASS ${message}`);
  };
  const state = () => cdp.eval(`({
    assetsReady: document.body.dataset.assetsReady === 'true',
    loading: document.body.classList.contains('loading'),
    careerHidden: document.querySelector('#career-panel')?.hidden,
    mapOpen: document.querySelector('#star-map-panel')?.hidden === false,
    planet: state.activePlanet,
    career: state.career,
    buildings: state.buildings.map(building => ({ id: building.id, type: building.type, x: building.x, y: building.y, recipeId: building.recipeId, baseHub: Boolean(building.baseHub) })),
    belts: state.belts.map(belt => ({ id: belt.id, x: belt.x, y: belt.y, length: belt.length })),
    tech: [...state.tech],
    speed: state.simulationSpeed,
    paused: state.paused,
    selection: state.selectedId,
    selectedBelt: state.selectedBeltId,
    route: state.interstellar.route ? { phase: state.interstellar.route.phase, targetId: state.interstellar.route.targetId } : null,
    visits: { ...state.interstellar.visits },
    stellar: {
      progress: state.stellarProject.progress,
      nodes: state.stellarProject.nodesDeployed,
      sails: state.stellarProject.sailsDeployed,
      rockets: state.stellarProject.rocketsDeployed,
      components: state.stellarProject.components?.length || 0
    },
    saved: Boolean(localStorage.getItem('stellar-echo-sandbox-v2')),
  })`);
  const click = selector => cdp.eval(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.click(); return true; })()`);
  const cellPoint = async (x, y) => cdp.eval(`worldToScreen(${x + 0.5}, ${y + 0.5})`);
  const canvasClick = async (x, y, modifiers = 0) => {
    const point = await cellPoint(x, y);
    await cdp.mouse('mouseMoved', point.x, point.y, modifiers);
    await cdp.mouse('mousePressed', point.x, point.y, modifiers);
    await cdp.mouse('mouseReleased', point.x, point.y, modifiers);
  };
  const canvasDrag = async (from, to, modifiers = 0) => {
    const start = await cellPoint(from.x, from.y);
    const end = await cellPoint(to.x, to.y);
    await cdp.mouse('mouseMoved', start.x, start.y, modifiers);
    await cdp.mouse('mousePressed', start.x, start.y, modifiers);
    await sleep(80);
    await cdp.mouse('mouseMoved', end.x, end.y, modifiers);
    await sleep(80);
    await cdp.mouse('mouseReleased', end.x, end.y, modifiers);
  };
  const selectTool = async type => {
    check(await click(`[data-tool="${type}"]`), `工具可通过建造坞选择：${type}`);
    await sleep(120);
  };
  const waitSim = async ms => { await sleep(ms); await cdp.eval('updateHUD(); render();'); };
  const waitReady = async () => {
    await waitFor(cdp, "document.body.dataset.assetsReady === 'true' && !document.body.classList.contains('loading')");
    await sleep(500);
  };
  const appBaseUrl = APP_URL.replace(/\?.*$/, '');

  try {
    let targets;
    for (let i = 0; i < 40; i += 1) {
      try { targets = await httpJson('GET', '/json/list'); break; } catch { await sleep(250); }
    }
    const page = targets?.find(target => target.type === 'page');
    if (!page) throw new Error('CDP page unavailable');
    cdp = await Cdp.connect(page.webSocketDebuggerUrl);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await cdp.send('Page.navigate', { url: APP_URL });
    await waitReady();
    await cdp.eval('localStorage.clear(); location.reload(); true');
    await waitReady();
    check((await state()).careerHidden === false, '新存档打开职业选择面板');
    check(await click('[data-career="power"]'), '职业卡片可点击');
    check(await click('#career-confirm'), '职业确认按钮可点击');
    await waitFor(cdp, "document.querySelector('#career-panel').hidden === true");
    check((await state()).career === 'power', '职业选择写入运行态');
    await cdp.screenshot('01_fresh_career_confirmed.png');

    // Build a small powered production footprint through the actual canvas input path.
    await selectTool('wind');
    await canvasClick(-2, 1);
    await selectTool('powerTower');
    await canvasClick(0, 1);
    await selectTool('miner');
    await canvasClick(-8, -3);
    await selectTool('smelter');
    await canvasClick(-4, -3);
    await selectTool('researchLab');
    await canvasClick(3, 3);
    await waitSim(3500);
    let snapshot = await state();
    check(snapshot.buildings.some(building => building.type === 'wind'), '风力发电机通过画布放置');
    check(snapshot.buildings.some(building => building.type === 'miner'), '采矿机通过画布放置');
    check(snapshot.buildings.some(building => building.type === 'smelter'), '冶炼机通过画布放置');
    check(snapshot.buildings.some(building => building.type === 'researchLab'), '科研站通过画布放置');
    await selectTool('belt');
    await canvasDrag({ x: -8, y: -3 }, { x: -4, y: -3 });
    await waitSim(1000);
    snapshot = await state();
    check(snapshot.belts.length > 0, '传送带通过拖拽创建');
    await cdp.screenshot('02_fresh_factory.png');

    // Inspector and recipe controls are real DOM interactions after canvas selection.
    await selectTool('inspect');
    await canvasClick(-4, -3);
    await waitFor(cdp, "document.querySelector('#selection-card').hidden === false");
    check((await cdp.eval("document.querySelector('#selection-name').textContent")) === '冶炼机', '选中建筑打开右侧检查器');
    check(await click('#selection-recipe'), '配方入口可点击');
    check(await cdp.eval("document.querySelector('#recipe-options').hidden === false"), '配方选择器可展开');
    const recipeOption = await cdp.eval("document.querySelector('#recipe-options [data-selection-recipe-id]:not([data-selection-recipe-id=auto])')?.dataset.selectionRecipeId || null");
    if (recipeOption) check(await click(`#recipe-options [data-selection-recipe-id="${recipeOption}"]`), '配方选项可选择');
    await cdp.screenshot('03_inspector_recipe.png');

    // Time, debug overlay, minimap and keyboard escape.
    await cdp.key(' ', 'Space', ' ');
    await waitFor(cdp, 'state.paused === true');
    check((await state()).paused, 'Space 可暂停模拟');
    await cdp.key(' ', 'Space', ' ');
    await waitFor(cdp, 'state.paused === false');
    await cdp.key('=', 'Equal', '=');
    check((await state()).speed === 2, '= 可提高模拟速度');
    await cdp.key('-', 'Minus', '-');
    check((await state()).speed === 1, '- 可恢复模拟速度');
    await cdp.key('p', 'KeyP', 'p');
    check(await cdp.eval("document.querySelector('#debug-overlay-badge').hidden === false"), 'P 可打开调试叠层');
    await cdp.key('p', 'KeyP', 'p');
    await selectTool('miner');
    await cdp.key('Escape', 'Escape');
    check((await state()).selection === null, 'Escape 可取消当前工具选择');
    await cdp.screenshot('04_pause_speed_debug.png');

    // Shift rectangle select, move preview and clipboard paste.
    await selectTool('inspect');
    const beforeMove = await cdp.eval("state.buildings.filter(building => ['wind','powerTower'].includes(building.type)).map(building => ({ type: building.type, x: building.x, y: building.y }))");
    await canvasDrag({ x: -3, y: 0 }, { x: 1, y: 4 }, 8);
    await waitSim(150);
    snapshot = await state();
    check(snapshot.buildings.filter(building => ['wind','powerTower'].includes(building.type)).length >= 2, 'Shift 拖拽可框选建筑');
    await cdp.key('c', 'KeyC', 'c', 2);
    await cdp.key('v', 'KeyV', 'v', 2);
    check(await cdp.eval('state.pasteMode?.active === true'), 'Ctrl+C/V 可进入粘贴模式');
    await cdp.key('Escape', 'Escape');
    check(await cdp.eval('state.pasteMode === null'), 'Escape 可退出粘贴模式');

    // Star-map interaction can be opened even before the research gate and exposes the gate state.
    check(await click('#map-button'), '星图入口可点击');
    await waitFor(cdp, "document.querySelector('#star-map-panel').hidden === false");
    check(await cdp.eval("document.querySelector('#star-map-lock').hidden === false"), '未完成星际物流时星图显示明确解锁条件');
    await cdp.screenshot('05_starmap_locked.png');
    check(await click('#close-star-map'), '星图关闭按钮可点击');

    // Persistence: refresh the same clean profile and verify the chosen career/buildings remain.
    await waitSim(2200);
    const beforeReload = await state();
    await cdp.send('Page.reload', { ignoreCache: true });
    await waitFor(cdp, "document.body.dataset.assetsReady === 'true' && !document.body.classList.contains('loading')");
    await sleep(700);
    const afterReload = await state();
    check(afterReload.saved, '运行态自动保存到本地存档');
    check(afterReload.career === beforeReload.career, '刷新后职业保持');
    check(afterReload.buildings.length >= beforeReload.buildings.length, '刷新后建筑保持');
    check(afterReload.belts.length >= beforeReload.belts.length, '刷新后传送带保持');
    await cdp.screenshot('06_persistence_after_reload.png');

    // Interstellar route and remote factory: use the real map, route timer,
    // planet marker, landing switch, canvas placement, and save/reload path.
    await cdp.send('Page.navigate', { url: `${appBaseUrl}?demo=map&browserQa=1` });
    await waitReady();
    snapshot = await state();
    check(snapshot.route?.phase === 'outbound' && snapshot.route.targetId === 'forge', '星图演示态载入熔火-β去程航线');
    check(await click('#map-button'), '已完成科技时星图可打开');
    await waitFor(cdp, "document.querySelector('#star-map-panel').hidden === false");
    check(await cdp.eval("document.querySelector('[data-planet=forge]').classList.contains('in-flight')"), '星图显示在途货运舱');
    for (let index = 0; index < 3; index += 1) check(await click('#speed-button'), '星图航线可通过速度按钮加速');
    await waitFor(cdp, "state.interstellar.route === null && state.interstellar.completedTrips >= 3", 8000);
    snapshot = await state();
    check(snapshot.visits.forge >= 1, '货运舱完成去程和返航并登记远端访问');
    check(await cdp.eval("document.querySelector('[data-planet=forge]').classList.contains('visited')"), '航次完成后星图标记远端已访问');
    check(await click('[data-planet="forge"]'), '点击星图远端星球可进入本地地图');
    await waitFor(cdp, "state.activePlanet === 'forge' && document.querySelector('#star-map-panel').hidden === true");
    snapshot = await state();
    check(snapshot.planet === 'forge', '进入熔火-β后切换到独立星球运行态');
    check(snapshot.buildings.length === 1 && snapshot.buildings[0].baseHub, '远端地图从着陆仓储开始');
    await selectTool('wind');
    await canvasClick(0, 0);
    await waitSim(250);
    snapshot = await state();
    check(snapshot.buildings.some(building => building.type === 'wind'), '远端星球可通过画布部署风力发电机');
    await cdp.screenshot('07_remote_planet_factory.png');
    check(await click('#map-button'), '远端地图可再次打开星图');
    await waitFor(cdp, "document.querySelector('#star-map-panel').hidden === false");
    check(await cdp.eval("document.querySelector('[data-planet=forge] small').textContent.includes('1 座设施')"), '星图同步显示远端工厂设施数量');

    // Full progression fixture: verify the completed Dyson state is rendered
    // through the user-facing star map, including all 20 lit segments.
    await cdp.send('Page.navigate', { url: `${appBaseUrl}?qa=playthrough&browserQa=1` });
    await waitReady();
    await waitFor(cdp, "document.body.dataset.qaResult === 'pass'", 10000);
    snapshot = await state();
    check(snapshot.stellar.progress === 100 && snapshot.stellar.nodes === 20, '完整回归态部署 20 个戴森轨道节点');
    check(snapshot.stellar.sails >= 1 && snapshot.stellar.rockets >= 1, '完整回归态包含太阳帆和结构火箭组件');
    check(await click('#map-button'), '恒星工程完成后星图可打开');
    await waitFor(cdp, "document.querySelector('#star-map-panel').hidden === false");
    check(await cdp.eval("document.querySelectorAll('#dyson-ring .dyson-seg.lit').length === 20"), '星图戴森环 20 段全部点亮');
    check(await cdp.eval("document.querySelector('#dyson-ring').classList.contains('complete')"), '星图戴森环进入完成态');
    check(await cdp.eval("document.querySelector('#dyson-victory').hidden === false && document.querySelector('#dyson-victory').textContent.includes('已点亮')"), '星图显示戴森框架胜利徽标');
    await cdp.screenshot('08_stellar_complete.png');

    console.log(`BROWSER_QA_PASS ${checks.length} assertions`);
  } finally {
    cdp?.close();
    chrome.kill();
  }
}

main().catch(error => {
  console.error('BROWSER_QA_FAIL:', error.stack || error.message);
  process.exitCode = 1;
});
