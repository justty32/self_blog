// Browser-controller regression checks using Node built-ins; no npm dependencies.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../assets/js/preferences.js'), 'utf8');
const keys = ['bg', 'surface', 'text', 'muted', 'primary', 'secondary'];
const palettes = Object.fromEntries(['grid', 'paper', 'deep'].map((name, index) => [name,
  Object.fromEntries(['night', 'day'].map((mode, m) => [mode,
    Object.fromEntries(keys.map((key, k) => [key, '#' + (0x102030 + index * 0x202020 + m * 0x101010 + k).toString(16)]))]))]));
class Element {
  constructor(dataset = {}) {
    this.dataset = dataset; this.events = new Map(); this.attributes = {}; this.properties = {};
    this.style = { setProperty: (k, v) => { this.properties[k] = v; }, removeProperty: k => { delete this.properties[k]; }, getPropertyValue: k => this.properties[k] || '', getPropertyPriority: () => '' };
  }
  addEventListener(name, callback) { if (!this.events.has(name)) this.events.set(name, new Set()); this.events.get(name).add(callback); }
  removeEventListener(name, callback) { this.events.get(name)?.delete(callback); if (!this.events.get(name)?.size) this.events.delete(name); }
  setAttribute(name, value) { this.attributes[name] = value; if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value; }
  getAttribute(name) { return this.attributes[name] ?? null; }
  removeAttribute(name) { delete this.attributes[name]; if (name.startsWith('data-')) delete this.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())]; }
  dispatch(name, event = {}) { return Promise.all([...(this.events.get(name) || [])].map(fn => fn(event))); }
}
function setup({ saved, legacy, blocked = false, reduced = false, hasScene = true, loader } = {}) {
  const root = new Element({ style: 'grid', mode: 'night', immersive: 'off', luxury: 'off' });
  const select = new Element(), motion = new Element(), reset = new Element();
  const buttons = [new Element(), new Element()], luxuryButtons = [new Element(), new Element()], modeButtons = [new Element(), new Element()];
  const status = new Element(), colors = keys.map(colorKey => new Element({ colorKey }));
  const panel = new Element({ palettes: JSON.stringify(palettes) }); panel.hidden = true;
  panel.querySelector = query => ({ '[data-style-select]': select, '[data-motion-toggle]': motion,
    '[data-reset-colors]': reset, '[data-appearance-status]': status }[query]);
  panel.querySelectorAll = () => colors;
  const media = new Element(); media.matches = reduced;
  const storage = new Map();
  if (saved) storage.set('self-blog-appearance-v2', JSON.stringify(saved));
  if (legacy) storage.set('self-blog-appearance-v1', JSON.stringify(legacy));
  const document = new Element(); document.documentElement = root; document.baseURI = 'https://example.com/self_blog/';
  document.currentScript = { dataset: { immersiveSrc: '/self_blog/js/immersive.min.js' } };
  document.querySelector = query => query === '[data-appearance-controls]' ? panel : query === '[data-immersive-scene]' && hasScene ? {} : null;
  document.querySelectorAll = query => ({ '[data-immersive-toggle]': buttons, '[data-luxury-toggle]': luxuryButtons, '[data-mode-toggle]': modeButtons }[query] || []);
  document.dispatchEvent = () => {};
  const window = new Element(); window.matchMedia = () => media;
  const loads = [], instances = [];
  const module = { createImmersive(scene, options) {
    const instance = { scene, luxury: options.luxury, destroyed: false,
      setLuxury(value) { this.luxury = value; }, destroy() { this.destroyed = true; } };
    instances.push(instance); return instance;
  } };
  const context = vm.createContext({ document, window, navigator: {}, CustomEvent: class {}, URL,
    loadModule: url => { loads.push(url); return loader ? loader(url, module) : Promise.resolve(module); },
    localStorage: {
      getItem: key => { if (blocked) throw Error('Blocked'); return storage.get(key); },
      setItem: (key, value) => { if (blocked) throw Error('Blocked'); storage.set(key, value); }
    }
  });
  // Inject the module boundary; real browser QA separately exercises native import.
  vm.runInContext(source.replace('import(moduleSource)', 'loadModule(moduleSource)'), context);
  return { root, select, motion, reset, buttons, luxuryButtons, modeButtons, status, colors, panel, media, storage, loads, instances, window };
}
let checks = 0;
async function check(name, callback) { await callback(); checks++; console.log('PASS ' + name); }
const flush = () => new Promise(resolve => setImmediate(resolve));
(async () => {
  await check('safe defaults expose controls without downloading effects', () => {
    const app = setup();
    assert.equal(app.panel.hidden, false); assert.equal(app.root.dataset.style, 'grid');
    assert.equal(app.root.dataset.mode, 'night'); assert.equal(app.loads.length, 0);
    assert.equal(app.root.dataset.immersive, 'off'); assert.equal(app.root.dataset.luxury, 'off');
  });
  await check('v1 migration retains every old color in its original light/dark context', () => {
    const legacy = { style: 'paper', motion: false, colors: { grid: { primary: '#abcdef' }, paper: { bg: '#ffeedd' }, deep: { muted: '#ccddee' } } };
    const app = setup({ legacy });
    const saved = JSON.parse(app.storage.get('self-blog-appearance-v2'));
    assert.equal(saved.mode, 'day'); assert.equal(saved.style, 'paper'); assert.equal(saved.motion, false);
    assert.equal(saved.colors.grid.night.primary, '#abcdef'); assert.equal(saved.colors.paper.day.bg, '#ffeedd');
    assert.equal(saved.colors.deep.night.muted, '#ccddee');
    assert.deepEqual(JSON.parse(app.storage.get('self-blog-appearance-v1')), legacy);
  });
  await check('style and day/night are independent and all six palettes keep their own edits', () => {
    const app = setup();
    app.colors[4].value = '#abcdef'; app.colors[4].dispatch('input');
    app.modeButtons[0].dispatch('click');
    assert.equal(app.root.dataset.mode, 'day'); assert.equal(app.colors[4].value, palettes.grid.day.primary);
    app.colors[4].value = '#123456'; app.colors[4].dispatch('input');
    app.select.value = 'paper'; app.select.dispatch('change'); assert.equal(app.root.dataset.mode, 'day');
    app.select.value = 'grid'; app.select.dispatch('change'); assert.equal(app.colors[4].value, '#123456');
    app.modeButtons[1].dispatch('click'); assert.equal(app.colors[4].value, '#abcdef');
    const restored = setup({ saved: JSON.parse(app.storage.get('self-blog-appearance-v2')) });
    assert.equal(restored.colors[4].value, '#abcdef'); assert.equal(restored.modeButtons[0].textContent, '夜晚');
  });
  await check('reset affects only the current style/mode pair', () => {
    const app = setup({ saved: { style: 'paper', mode: 'day', colors: { paper: { day: { primary: '#123456' }, night: { primary: '#abcdef' } } } } });
    app.reset.dispatch('click'); assert.equal(app.colors[4].value, palettes.paper.day.primary);
    app.modeButtons[0].dispatch('click'); assert.equal(app.colors[4].value, '#abcdef');
  });
  await check('invalid stored colors and unknown style/mode cannot enter CSS', () => {
    const app = setup({ saved: { style: 'missing', mode: 'bad', colors: { grid: { night: { bg: 'url(x)', primary: '#ff' } } } } });
    assert.equal(app.root.dataset.style, 'grid'); assert.equal(app.root.dataset.mode, 'night');
    assert.equal(app.root.properties['--seed-bg'], palettes.grid.night.bg);
    app.colors[0].value = 'red;display:none'; app.colors[0].dispatch('input');
    assert.equal(app.root.properties['--seed-bg'], palettes.grid.night.bg);
  });
  await check('storage denial preserves current-page controls', () => {
    const app = setup({ blocked: true }); app.modeButtons[0].dispatch('click');
    assert.equal(app.root.dataset.mode, 'day'); assert.match(app.status.textContent, /無法保存/);
  });
  await check('luxury implies immersive, downgrade keeps immersive, full stop clears both', async () => {
    const app = setup(); app.luxuryButtons[0].dispatch('click'); await flush();
    assert.equal(app.root.dataset.luxury, 'on'); assert.equal(app.root.dataset.immersive, 'on');
    assert.equal(app.instances[0].luxury, true); assert.equal(app.loads.length, 1);
    app.luxuryButtons[1].dispatch('click');
    assert.equal(app.root.dataset.luxury, 'off'); assert.equal(app.root.dataset.immersive, 'on');
    assert.equal(app.instances[0].luxury, false);
    app.buttons[0].dispatch('click'); assert.equal(app.root.dataset.immersive, 'off'); assert.equal(app.instances[0].destroyed, true);
    assert.equal(app.storage.size, 0, 'effects are not persisted');
  });
  await check('luxury works on article pages without a hero', async () => {
    const app = setup({ hasScene: false }); app.luxuryButtons[0].dispatch('click'); await flush();
    assert.equal(app.root.dataset.luxury, 'on'); assert.equal(app.instances[0].scene, null);
  });
  await check('cancel while module loads does not create late effects', async () => {
    let resolve;
    const app = setup({ loader: (url, module) => new Promise(done => { resolve = () => done(module); }) });
    app.luxuryButtons[0].dispatch('click'); app.buttons[1].dispatch('click'); resolve(); await flush();
    assert.equal(app.instances.length, 0); assert.equal(app.root.dataset.luxury, 'off');
    assert.equal(app.luxuryButtons[0].attributes['aria-pressed'], 'false');
  });
  await check('luxury changes during loading apply the latest requested level', async () => {
    let resolve;
    const app = setup({ loader: (url, module) => new Promise(done => { resolve = () => done(module); }) });
    app.luxuryButtons[0].dispatch('click'); app.luxuryButtons[1].dispatch('click'); resolve(); await flush();
    assert.equal(app.instances[0].luxury, false); assert.equal(app.root.dataset.immersive, 'on');
  });
  await check('failed import retries with a new URL while first request remains stable', async () => {
    let calls = 0;
    const app = setup({ loader: (url, module) => ++calls === 1 ? Promise.reject(Error('Network')) : Promise.resolve(module) });
    app.buttons[0].dispatch('click'); await flush(); assert.equal(app.root.dataset.immersive, 'off');
    app.buttons[0].dispatch('click'); await flush(); assert.equal(app.root.dataset.immersive, 'on');
    assert.equal(app.loads[0], '/self_blog/js/immersive.min.js'); assert.match(app.loads[1], /\?retry=1$/);
  });
  await check('OS and manual reduced motion stop luxury and disable both controls', async () => {
    const app = setup(); app.luxuryButtons[0].dispatch('click'); await flush();
    app.media.matches = true; app.media.dispatch('change');
    assert.equal(app.root.dataset.motion, 'reduced'); assert.equal(app.instances[0].destroyed, true);
    assert.equal(app.root.dataset.luxury, 'off'); assert.equal(app.buttons[0].disabled, true); assert.equal(app.luxuryButtons[0].disabled, true);
    app.media.matches = false; app.media.dispatch('change'); assert.equal(app.root.dataset.motion, 'full');
    app.motion.checked = false; app.motion.dispatch('change'); assert.equal(app.root.dataset.motion, 'reduced');
  });
  console.log(`APPEARANCE PASS — ${checks} behavior checks`);
  await testImmersive();
  testInkFluid();
  testLightField();
})().catch(error => { console.error(error); process.exitCode = 1; });

async function testImmersive() {
  const moduleSource = fs.readFileSync(path.join(__dirname, '../assets/js/immersive.js'), 'utf8');
  const { createImmersive } = await import('data:text/javascript;base64,' + Buffer.from(moduleSource).toString('base64'));
  const changed = ['document', 'window', 'getComputedStyle', 'ResizeObserver', 'IntersectionObserver', 'requestAnimationFrame', 'cancelAnimationFrame'];
  const previous = Object.fromEntries(changed.map(key => [key, global[key]]));
  const document = new Element(); document.hidden = false; document.documentElement = new Element({ style: 'grid', mode: 'night' });
  const heading = new Element(); let geometryReads = 0;
  heading.style.setProperty('--text-x', '9px');
  heading.getBoundingClientRect = () => { geometryReads++; return { left: 100, right: 700, top: 80, bottom: 280, width: 600, height: 200 }; };
  document.querySelectorAll = selector => selector.startsWith('h1,') ? [heading] : [];
  let selection = { isCollapsed: true, rangeCount: 0 };
  document.getSelection = () => selection;
  const children = [];
  document.body = { append: node => children.push(node) };
  const gradient = { addColorStop() {} };
  let activePath = []; const filledPaths = [];
  const context = new Proxy({ createLinearGradient: () => gradient, createRadialGradient: () => gradient,
    beginPath() { activePath = []; }, moveTo(x, y) { activePath.push([x, y]); }, lineTo(x, y) { activePath.push([x, y]); },
    fill() { if (activePath.length > 10) filledPaths.push(activePath.slice()); },
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }) }, { get: (object, key) => object[key] || (() => {}) });
  document.createElement = () => {
    const canvas = new Element(); canvas.getContext = () => context;
    canvas.remove = () => { const index = children.indexOf(canvas); if (index >= 0) children.splice(index, 1); };
    return canvas;
  };
  const media = new Element(); media.matches = false;
  const scene = new Element(); scene.getBoundingClientRect = () => ({ width: 500, height: 420, left: 0, top: 0 });
  scene.querySelector = () => ({ getContext: () => context });
  const frames = new Map(); let frameID = 0;
  const observers = [];
  class Observer {
    constructor(callback) { this.callback = callback; this.disconnected = false; this.targets = []; observers.push(this); }
    observe(node) { this.targets.push(node); } disconnect() { this.disconnected = true; }
  }
  const window = new Element(); Object.assign(window, { matchMedia: () => media, devicePixelRatio: 3, innerWidth: 1280, innerHeight: 800, scrollY: 0 });
  Object.assign(global, { document, window,
    getComputedStyle: () => ({ getPropertyValue: () => '#75d9e6' }), ResizeObserver: Observer, IntersectionObserver: Observer,
    requestAnimationFrame: callback => { frames.set(++frameID, callback); return frameID; }, cancelAnimationFrame: id => frames.delete(id)
  });
  try {
    const basic = createImmersive(null); assert.equal(frames.size, 0, 'ordinary no-hero mode remains event-driven'); basic.destroy();
    const noScene = createImmersive(null, { luxury: true });
    assert.equal(frames.size, 1, 'luxury starts full-page background without a hero'); assert.equal(children.length, 1);
    const [globalID, globalDraw] = frames.entries().next().value; frames.delete(globalID); globalDraw(100);
    assert.equal(frames.size, 1, 'one full-page render loop after a frame');
    const ribbonBefore = filledPaths[0]; filledPaths.length = 0;
    window.dispatch('pointerdown', { clientX: 640, clientY: 400, isPrimary: true });
    assert.notEqual(heading.properties['--text-x'], '0.000px', 'plain text responds to nearby pointer');
    const firstReads = geometryReads;
    const [nextID, nextDraw] = frames.entries().next().value; frames.delete(nextID); nextDraw(116);
    assert.equal(geometryReads, firstReads, 'text layout is cached between ordinary frames');
    const ribbonAfter = filledPaths[0];
    assert.ok(Math.max(...ribbonAfter.map((point, index) => Math.abs(point[1] - ribbonBefore[index][1]))) < 5, 'holding pointer cannot snap the whole light ribbon');
    window.dispatch('pointerup');
    selection = { isCollapsed: false, rangeCount: 1 }; document.dispatch('selectionchange');
    assert.equal(document.documentElement.dataset.textFrozen, 'true');
    const frozenX = heading.properties['--text-x'];
    const [frozenID, frozenDraw] = frames.entries().next().value; frames.delete(frozenID); frozenDraw(132);
    assert.equal(heading.properties['--text-x'], frozenX, 'selected text stops moving');
    selection = { isCollapsed: true, rangeCount: 0 }; document.dispatch('selectionchange');
    document.activeElement = { matches: () => true }; document.dispatch('focusin');
    assert.equal(document.documentElement.dataset.textFrozen, 'true', 'editing forms freezes text and panels');
    document.activeElement = null; document.dispatch('focusout'); await flush();
    assert.equal(document.documentElement.dataset.textFrozen, undefined);
    let time = 150;
    for (const style of ['grid', 'deep', 'paper']) for (const mode of ['day', 'night']) {
      document.documentElement.dataset.style = style; document.documentElement.dataset.mode = mode; document.dispatch('appearancechange');
      const [styleID, styleDraw] = frames.entries().next().value; frames.delete(styleID); styleDraw(time += 16);
      assert.equal(frames.size, 1, 'style/mode changes do not create another loop');
    }
    noScene.setLuxury(false); assert.equal(frames.size, 0); assert.equal(children.length, 0);
    assert.equal(heading.properties['--text-x'], '9px', 'text styles restore when luxury is turned off');
    assert.equal(heading.dataset.luxuryText, undefined);
    noScene.setLuxury(true); assert.equal(frames.size, 1); noScene.destroy(); assert.equal(frames.size, 0); assert.equal(children.length, 0);
    const effect = createImmersive(scene, { luxury: true }); assert.equal(frames.size, 2, 'hero and full-page own separate render loops');
    const heroObserver = observers.filter(observer => observer.targets.includes(scene)).at(-1);
    scene.dispatch('pointerdown', { pointerId: 1, clientX: 50, clientY: 50, button: 0 }); assert.equal(scene.dataset.dragging, 'true');
    scene.dispatch('pointermove', { pointerId: 1, clientX: 150, clientY: 80, pointerType: 'mouse' });
    const [id, callback] = frames.entries().next().value; frames.delete(id); callback(100);
    assert.notEqual(scene.properties['--scene-yaw'], '0.000deg', 'drag rotates scene');
    scene.dispatch('pointerup', { pointerId: 1 }); assert.equal(scene.dataset.dragging, undefined);
    document.hidden = true; document.dispatch('visibilitychange'); assert.equal(frames.size, 0);
    document.hidden = false; document.dispatch('visibilitychange'); assert.equal(frames.size, 2);
    heroObserver.callback([{ isIntersecting: false }]); assert.equal(frames.size, 1, 'global canvas keeps moving when hero leaves viewport');
    heroObserver.callback([{ isIntersecting: true }]); assert.equal(frames.size, 2);
    effect.setLuxury(false); assert.equal(frames.size, 1); assert.equal(children.length, 0);
    media.matches = true; media.dispatch('change'); assert.equal(frames.size, 0);
    effect.destroy(); effect.destroy(); assert.equal(frames.size, 0);
    assert.equal(scene.events.size, 0); assert.equal(document.events.size, 0); assert.equal(media.events.size, 0); assert.equal(window.events.size, 0);
    assert.equal(observers.every(observer => observer.disconnected), true); assert.equal(scene.properties['--scene-yaw'], undefined);
    console.log('IMMERSIVE PASS — global luxury, separate loops, style changes, drag, visibility, reduced motion, and cleanup');
  } finally {
    for (const key of changed) { if (previous[key] === undefined) delete global[key]; else global[key] = previous[key]; }
  }
}


function testInkFluid() {
  const moduleSource = fs.readFileSync(path.join(__dirname, '../assets/js/immersive.js'), 'utf8');
  const createInkFluid = vm.runInNewContext(moduleSource.replace('export function createImmersive', 'function createImmersive') + ';createInkFluid;');
  const create = () => { const ink = createInkFluid({ ambient: false, seed: false, resolution: 64 }); ink.resize(800, 500); return ink; };
  const mass = state => state.dyeA.reduce((a, b) => a + b, 0) + state.dyeB.reduce((a, b) => a + b, 0);
  const centerX = state => {
    let weighted = 0; for (let i = 0; i < state.dyeA.length; i++) weighted += (i % state.width) * (state.dyeA[i] + state.dyeB[i]);
    return weighted / mass(state);
  };
  const flow = create(); flow.inject(400, 250, 22, 0, .6);
  const startX = centerX(flow.snapshot());
  for (let i = 0; i < 60; i++) flow.update(1 / 60);
  assert.ok(centerX(flow.snapshot()) > startX + .03, 'ink advects in the direction of local velocity');
  const fade = create(); fade.inject(400, 250, 0, 0, .6); const originalMass = mass(fade.snapshot());
  for (let i = 0; i < 600; i++) fade.update(1 / 60);
  assert.ok(mass(fade.snapshot()) < originalMass * .2, 'released ink disperses instead of remaining a solid blob');
  const sixty = create(), high = create();
  for (const ink of [sixty, high]) ink.inject(360, 280, 18, -5, .5);
  for (let i = 0; i < 120; i++) sixty.update(1 / 60);
  for (let i = 0; i < 288; i++) high.update(1 / 144);
  const a = sixty.snapshot(), b = high.snapshot(); assert.equal(a.time, b.time);
  for (const key of ['u', 'v', 'dyeA', 'dyeB']) assert.deepEqual(Array.from(a[key]), Array.from(b[key]), '60/144Hz fixed-step fields match');
  const ink = createInkFluid(); ink.resize(1280, 800);
  assert.ok(mass(ink.snapshot()) > 0, 'initial subtle plumes are visible before input');
  for (let i = 0; i < 180; i++) {
    if (i % 5 === 0) ink.inject(100 + (i * 71) % 1080, 80 + (i * 43) % 640, 800, -600, 99);
    ink.update(1 / 60, { x: 640, y: 400, down: true });
  }
  const held = ink.snapshot();
  for (const key of ['u', 'v', 'dyeA', 'dyeB']) assert.ok(held[key].every(Number.isFinite));
  for (let i = 0; i < held.dyeA.length; i++) assert.ok(held.dyeA[i] + held.dyeB[i] <= 2.20001, 'held injection remains bounded');
  ink.resize(800, 1280); assert.ok(mass(ink.snapshot()) > 0, 'resize retains ink');
  ink.destroy(); ink.destroy(); ink.update(1 / 60);
  assert.equal(ink.snapshot().width, 0); assert.equal(ink.snapshot().u, undefined);
  for (const sim of [flow, fade, sixty, high]) sim.destroy();
  console.log('INK PASS — advection, fade, initial plumes, 60/144Hz consistency, bounded hold, resize, cleanup');
}


function testLightField() {
  const moduleSource = fs.readFileSync(path.join(__dirname, '../assets/js/immersive.js'), 'utf8');
  const drawLightField = vm.runInNewContext(moduleSource.replace('export function createImmersive', 'function createImmersive') + ';drawLightField;');
  function render(style, day, primary, secondary) {
    const colors = [], samples = []; let stack = 0;
    const gradient = () => ({ addColorStop: (offset, value) => { assert.ok(Number.isFinite(offset)); colors.push(value); } });
    const context = new Proxy({ canvas: { width: 2560, height: 1600 }, save() { stack++; }, restore() { stack--; assert.ok(stack >= 0); },
      createLinearGradient: gradient, createRadialGradient: gradient,
      drawImage(source, x, y, width, height) {
        assert.ok(x >= 0 && y >= 0 && x + width <= source.width + 1e-6 && y + height <= source.height + 1e-6);
        samples.push([x, y, width, height]);
      } }, {
      get: (target, key) => target[key] || ((...args) => { args.filter(value => typeof value === 'number').forEach(value => assert.ok(Number.isFinite(value))); }),
      set: (target, key, value) => { target[key] = value; if (typeof value === 'string' && value.startsWith('rgba')) colors.push(value); return true; }
    });
    drawLightField(context, { width: 1280, height: 800, time: 2.4, style, day, primary, secondary, text: [240, 246, 250],
      pointer: { x: 220, y: 540, velocityX: 760, velocityY: -210, pressure: .3 }, scrollDepth: 500 });
    assert.equal(stack, 0); assert.ok(colors.length > 20);
    if (style === 'deep' || style === 'paper') assert.ok(samples.length > 0, 'lenses sample and magnify actual canvas pixels');
    return colors;
  }
  for (const style of ['grid', 'deep', 'paper']) for (const day of [true, false]) {
    const before = render(style, day, [130, 237, 250], [164, 198, 255]);
    const after = render(style, day, [245, 105, 71], [187, 120, 223]);
    assert.notDeepEqual(before, after, 'seed color edits recolor derived spectral light');
    assert.ok(after.every(color => !color.includes('NaN')));
  }
  console.log('LIGHT PASS — six style/mode renderers, finite geometry, DPR refraction bounds, seed-derived spectral color');
}
