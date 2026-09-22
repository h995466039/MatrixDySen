// Headless QA harness for the Dyson Sphere web game (jsdom + stubbed canvas 2D).
// Usage: node qa-harness.mjs            -> runs ?qa=playthrough
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const root = __dirname;
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const mode = process.argv[2] || 'playthrough';
const url = `http://localhost/${mode === 'playthrough' || mode === 'normal' ? '?qa=' + mode : '?demo=' + mode}`;

const dom = new JSDOM(html, {
  url,
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  beforeParse(window) {
    // ---- stub Image: every image errors (fallback path) on next tick ----
    window.Image = function () {
      const el = window.document.createElement('img');
      el._complete = false;
      window.setTimeout(() => el.dispatchEvent(new window.Event('error')), 0);
      return el;
    };
    // ---- stub canvas 2D context ----
    const makeCtx = () =>
      new Proxy(
        {},
        {
          get(target, prop) {
            if (prop in target) return target[prop];
            if (prop === 'measureText') return () => ({ width: 0 });
            if (prop === 'createLinearGradient' || prop === 'createRadialGradient' || prop === 'createPattern')
              return () => ({ addColorStop() {} });
            if (prop === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
            return () => {};
          },
          set(target, prop, value) {
            target[prop] = value;
            return true;
          },
        }
      );
    window.HTMLCanvasElement.prototype.getContext = function () {
      if (!this.__ctx) this.__ctx = makeCtx();
      return this.__ctx;
    };
    if (!window.matchMedia)
      window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
    window.devicePixelRatio = 1;
    // give the world canvas a real viewport so screenToCell/preview don't divide by zero
    window.HTMLElement.prototype.getBoundingClientRect = function () {
      const isCanvas = this.tagName === 'CANVAS';
      return { x: 0, y: 0, top: 0, left: 0, width: isCanvas ? 1280 : 300, height: isCanvas ? 720 : 40, right: isCanvas ? 1280 : 300, bottom: isCanvas ? 720 : 40 };
    };
  },
});

const { window } = dom;
const { document } = window;

// eval the 6 modules in dependency order as ONE program so const/let
// bindings (shared across scripts in the browser) are preserved.
const modules = ['game.core.js', 'game.world.js', 'game.sim.js', 'game.ui.js', 'game.tools.js', 'game.main.js'];
let bootError = null;
const combined = modules.map((file) => `\n// --- ${file} ---\n` + fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
try {
  window.eval(combined);
} catch (e) {
  console.error('[harness] eval failed:', e.message);
  bootError = e.message;
}

// HTML-parsed <img> elements never load in jsdom; force the fallback path.
try {
  Array.from(document.images).forEach((img) => img.dispatchEvent(new window.Event('error')));
} catch (e) { /* ignore */ }

// bootGame() runs async (awaits preloadGameAssets). Wait for it to settle.
setTimeout(() => {
  const result = document.body.dataset.qaResult;
  const reportNode = document.querySelector('.qa-report');
  const failures = document.body.dataset.assetFailures;
  if (bootError) {
    console.log('BOOT_ERROR:', bootError);
    process.exit(2);
  }
  if (!result) {
    // maybe still booting or a non-qa mode; dump some signal
    console.log('NO_QA_RESULT. assetsReady=', document.body.dataset.assetsReady, 'assetFailures=', failures, 'qaResult=', result);
    const errEl = document.querySelector('.qa-report');
    if (errEl) console.log('report:', errEl.textContent);
    process.exit(3);
  }
  console.log('QA_RESULT:', result);
  console.log('report:', reportNode ? reportNode.textContent : '(none)');
  console.log('assetFailures:', failures);
  process.exit(result === 'pass' ? 0 : 1);
}, 4000);
