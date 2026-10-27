// Browser-controller regression checks using Node built-ins; no npm dependencies.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../assets/js/preferences.js'), 'utf8');
const keys = ['bg', 'surface', 'text', 'muted', 'primary', 'secondary'];
const palettes = Object.fromEntries(['grid', 'paper', 'deep'].map((name, index) => [name,
  Object.fromEntries(keys.map((key, k) => [key, '#' + (0x102030 + index * 0x202020 + k).toString(16)]))]));
class Element {
  constructor(dataset = {}) { this.dataset = dataset; this.events = {}; this.attributes = {}; this.properties = {}; this.style = { setProperty: (k, v) => { this.properties[k] = v; } }; }
  addEventListener(name, callback) { this.events[name] = callback; }
  setAttribute(name, value) { this.attributes[name] = value; }
  removeAttribute(name) { delete this.attributes[name]; }
  dispatch(name) { return this.events[name]?.({}); }
}
function setup({ saved, blocked = false, reduced = false } = {}) {
  const root = new Element();
  const select = new Element();
  const motion = new Element();
  const reset = new Element();
  const buttons = [new Element(), new Element()];
  const status = new Element();
  const colors = keys.map(colorKey => new Element({ colorKey }));
  const panel = new Element({ palettes: JSON.stringify(palettes) });
  panel.hidden = true;
  panel.querySelector = query => ({ '[data-style-select]': select, '[data-motion-toggle]': motion,
    '[data-reset-colors]': reset, '[data-appearance-status]': status }[query]);
  panel.querySelectorAll = () => colors;
  const media = new Element(); media.matches = reduced;
  const storage = new Map(saved ? [['self-blog-appearance-v1', JSON.stringify(saved)]] : []);
  const document = new Element();
  document.documentElement = root;
  document.currentScript = { dataset: { immersiveSrc: '/self_blog/js/immersive.min.js' } };
  document.querySelector = query => query === '[data-appearance-controls]' ? panel : query === '[data-immersive-scene]' ? {} : null;
  document.querySelectorAll = query => query === '[data-immersive-toggle]' ? buttons : [];
  document.dispatchEvent = () => {};
  const window = new Element(); window.matchMedia = () => media;
  const context = vm.createContext({ document, window, navigator: {}, CustomEvent: class {},
    localStorage: {
      getItem: key => { if (blocked) throw Error('Blocked'); return storage.get(key); },
      setItem: (key, value) => { if (blocked) throw Error('Blocked'); storage.set(key, value); }
    }
  });
  vm.runInContext(source, context);
  return { root, select, motion, reset, buttons, status, colors, panel, media, storage };
}
let checks = 0;
function check(name, callback) { callback(); checks++; console.log('PASS ' + name); }
check('safe defaults expose controls without enabling immersive effects', () => {
  const app = setup();
  assert.equal(app.panel.hidden, false);
  assert.equal(app.root.dataset.style, 'grid');
  assert.equal(app.root.dataset.motion, 'full');
  assert.notEqual(app.root.dataset.immersive, 'on');
});
check('saved colors survive reload and stay separate between styles', () => {
  const app = setup();
  app.colors[4].value = '#abcdef'; app.colors[4].dispatch('input');
  app.select.value = 'paper'; app.select.dispatch('change');
  assert.equal(app.root.properties['--seed-primary'], palettes.paper.primary);
  app.select.value = 'grid'; app.select.dispatch('change');
  assert.equal(app.root.properties['--seed-primary'], '#abcdef');
  const restored = setup({ saved: JSON.parse(app.storage.get('self-blog-appearance-v1')) });
  assert.equal(restored.colors[4].value, '#abcdef');
});
check('reset affects only selected style', () => {
  const app = setup({ saved: { style: 'paper', colors: { grid: { primary: '#abcdef' }, paper: { primary: '#123456' } } } });
  app.reset.dispatch('click');
  assert.equal(app.colors[4].value, palettes.paper.primary);
  app.select.value = 'grid'; app.select.dispatch('change');
  assert.equal(app.colors[4].value, '#abcdef');
});
check('invalid storage colors and unknown theme never enter CSS', () => {
  const app = setup({ saved: { style: 'missing', motion: 'yes', colors: { grid: { bg: 'url(x)', primary: '#ff' } } } });
  assert.equal(app.root.dataset.style, 'grid');
  assert.equal(app.root.properties['--seed-bg'], palettes.grid.bg);
  app.colors[0].value = 'red;display:none'; app.colors[0].dispatch('input');
  assert.equal(app.root.properties['--seed-bg'], palettes.grid.bg);
});
check('storage denial preserves functional current-page controls', () => {
  const app = setup({ blocked: true });
  app.select.value = 'deep'; app.select.dispatch('change');
  assert.equal(app.root.dataset.style, 'deep');
  assert.match(app.status.textContent, /無法保存/);
});
check('OS reduced motion wins while preserving saved user preference', () => {
  const app = setup({ reduced: true, saved: { motion: true, immersive: true } });
  assert.equal(app.root.dataset.motion, 'reduced');
  assert.equal(app.motion.disabled, true);
  assert.equal(app.buttons.every(button => button.disabled), true);
  assert.equal(app.root.dataset.immersive, 'off');
  app.media.matches = false; app.media.dispatch('change');
  assert.equal(app.root.dataset.motion, 'full');
  assert.equal(app.motion.checked, true);
});
check('manual reduced motion updates all immersive triggers', () => {
  const app = setup();
  app.motion.checked = false; app.motion.dispatch('change');
  assert.equal(app.root.dataset.motion, 'reduced');
  for (const button of app.buttons) {
    assert.equal(button.attributes['aria-pressed'], 'false');
    assert.equal(button.disabled, true);
  }
});
console.log(`APPEARANCE PASS — ${checks} behavior checks`);

(async () => {
  const moduleSource = fs.readFileSync(path.join(__dirname, '../assets/js/immersive.js'), 'utf8');
  const { createImmersive } = await import('data:text/javascript;base64,' + Buffer.from(moduleSource).toString('base64'));
  const changed = ['document', 'window', 'getComputedStyle', 'ResizeObserver', 'IntersectionObserver', 'requestAnimationFrame', 'cancelAnimationFrame'];
  const previous = Object.fromEntries(changed.map(key => [key, global[key]]));
  class Target {
    constructor() { this.events = new Map(); }
    addEventListener(name, fn) { this.events.set(name, fn); }
    removeEventListener(name, fn) { if (this.events.get(name) === fn) this.events.delete(name); }
  }
  const document = new Target(); document.hidden = false;
  document.documentElement = {}; document.querySelectorAll = () => [];
  const media = new Target(); media.matches = false;
  const scene = new Target(); scene.getBoundingClientRect = () => ({ width: 500, height: 420, left: 0, top: 0 });
  const context = new Proxy({}, { get: (object, key) => object[key] || (() => {}) });
  scene.querySelector = () => ({ getContext: () => context });
  const frames = new Map(); let frameID = 0;
  const observers = [];
  class Observer {
    constructor(callback) { this.callback = callback; this.disconnected = false; observers.push(this); }
    observe() {}
    disconnect() { this.disconnected = true; }
  }
  Object.assign(global, { document, window: { matchMedia: () => media, devicePixelRatio: 3 },
    getComputedStyle: () => ({ getPropertyValue: () => '#75d9e6' }),
    ResizeObserver: Observer, IntersectionObserver: Observer,
    requestAnimationFrame: callback => { frames.set(++frameID, callback); return frameID; },
    cancelAnimationFrame: id => frames.delete(id)
  });
  try {
    const effect = createImmersive(scene);
    assert.equal(frames.size, 1, 'one rendering loop');
    document.hidden = true; document.events.get('visibilitychange')();
    assert.equal(frames.size, 0, 'hidden document cancels frame');
    document.hidden = false; document.events.get('visibilitychange')();
    assert.equal(frames.size, 1, 'visible document resumes once');
    observers[1].callback([{ isIntersecting: false }]);
    assert.equal(frames.size, 0, 'offscreen hero cancels frame');
    observers[1].callback([{ isIntersecting: true }]);
    assert.equal(frames.size, 1);
    media.matches = true; media.events.get('change')();
    assert.equal(frames.size, 0, 'reduced motion cancels frame');
    effect.destroy(); effect.destroy();
    assert.equal(frames.size, 0);
    assert.equal(scene.events.size, 0, 'pointer and touch listeners cleaned up');
    assert.equal(document.events.size, 0, 'document listeners cleaned up');
    assert.equal(media.events.size, 0, 'media listener cleaned up');
    assert.equal(observers.every(observer => observer.disconnected), true);
    console.log('PASS immersive suspends offscreen/hidden/reduced and cleans up idempotently');
  } finally {
    for (const key of changed) {
      if (previous[key] === undefined) delete global[key];
      else global[key] = previous[key];
    }
  }
  console.log('IMMERSIVE PASS — lifecycle and rendering-loop checks');
})().catch(error => { console.error(error); process.exitCode = 1; });
