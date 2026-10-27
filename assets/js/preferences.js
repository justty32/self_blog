/* Small, optional controller. Reading and navigation do not depend on JavaScript. */
(() => {
  'use strict';
  const root = document.documentElement;
  const panel = document.querySelector('[data-appearance-controls]');
  if (!panel) return;
  const script = document.currentScript;
  const storageKey = 'self-blog-appearance-v2';
  const legacyKey = 'self-blog-appearance-v1';
  const keys = ['bg', 'surface', 'text', 'muted', 'primary', 'secondary'];
  const modes = ['night', 'day'];
  const hex = value => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
  let palettes;
  try { palettes = JSON.parse(panel.dataset.palettes); } catch { return; }
  const styles = ['grid', 'paper', 'deep'].filter(name => palettes[name] &&
    modes.every(mode => palettes[name][mode] && keys.every(key => hex(palettes[name][mode][key]))));
  if (!styles.length) return;
  const select = panel.querySelector('[data-style-select]');
  const colors = [...panel.querySelectorAll('[data-color-key]')];
  const motion = panel.querySelector('[data-motion-toggle]');
  const modeButtons = [...document.querySelectorAll('[data-mode-toggle]')];
  const immersiveButtons = [...document.querySelectorAll('[data-immersive-toggle]')];
  const luxuryButtons = [...document.querySelectorAll('[data-luxury-toggle]')];
  const status = panel.querySelector('[data-appearance-status]');
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  const scene = document.querySelector('[data-immersive-scene]');
  const sceneCaption = document.querySelector('.reactor-caption.caption-bottom');
  const originalCaption = sceneCaption?.textContent;
  const state = {
    style: styles.includes(root.dataset.style) ? root.dataset.style : styles[0],
    mode: modes.includes(root.dataset.mode) ? root.dataset.mode : 'night',
    motion: true, colors: {}
  };
  let immersive = null, desiredImmersive = false, desiredLuxury = false;
  let generation = 0, storageAvailable = true, modulePromise, importFailures = 0;
  let migrated = false;
  function sanitizeColors(values) {
    const clean = {};
    if (values && typeof values === 'object') {
      for (const key of keys) if (hex(values[key])) clean[key] = values[key];
    }
    return clean;
  }
  try {
    const current = localStorage.getItem(storageKey);
    const saved = JSON.parse(current || localStorage.getItem(legacyKey) || 'null');
    if (saved && typeof saved === 'object') {
      migrated = !current;
      if (styles.includes(saved.style)) state.style = saved.style;
      if (typeof saved.motion === 'boolean') state.motion = saved.motion;
      if (migrated) state.mode = state.style === 'paper' ? 'day' : 'night';
      else if (modes.includes(saved.mode)) state.mode = saved.mode;
      for (const style of styles) {
        state.colors[style] = {};
        if (migrated) state.colors[style][style === 'paper' ? 'day' : 'night'] = sanitizeColors(saved.colors?.[style]);
        else for (const mode of modes) state.colors[style][mode] = sanitizeColors(saved.colors?.[style]?.[mode]);
      }
    }
  } catch { storageAvailable = false; }
  function announce(message) { if (status) status.textContent = message; }
  function save() {
    try { localStorage.setItem(storageKey, JSON.stringify(state)); }
    catch { storageAvailable = false; }
    if (!storageAvailable) announce('已套用；此瀏覽器無法保存設定，換頁後可能重設。');
  }
  function syncEffects() {
    const loading = desiredImmersive && !immersive;
    const disabled = root.dataset.motion === 'reduced';
    root.dataset.immersive = immersive ? 'on' : 'off';
    root.dataset.luxury = immersive && desiredLuxury ? 'on' : 'off';
    for (const button of immersiveButtons) {
      button.hidden = false; button.disabled = disabled;
      button.setAttribute('aria-pressed', String(desiredImmersive));
      button.textContent = loading ? '取消載入' : desiredImmersive ? '關閉沉浸互動' : '開啟沉浸互動';
      if (loading) button.setAttribute('aria-busy', 'true'); else button.removeAttribute('aria-busy');
    }
    for (const button of luxuryButtons) {
      button.hidden = false; button.disabled = disabled;
      button.setAttribute('aria-pressed', String(desiredLuxury));
      button.textContent = desiredLuxury ? '關閉奢華特效' : '開啟奢華特效';
      if (loading && desiredLuxury) button.setAttribute('aria-busy', 'true'); else button.removeAttribute('aria-busy');
    }
    if (sceneCaption) sceneCaption.textContent = immersive
      ? (desiredLuxury ? '拖曳旋轉光場 · 全層星軌與尾流' : '拖曳探索光場 · 輕點留下漣漪') : originalCaption;
  }
  function stopImmersive() {
    desiredImmersive = false; desiredLuxury = false; generation++;
    immersive?.destroy(); immersive = null;
    syncEffects();
  }
  function render() {
    root.dataset.style = state.style; root.dataset.mode = state.mode;
    root.dataset.motion = state.motion && !media.matches ? 'full' : 'reduced';
    select.value = state.style;
    const palette = palettes[state.style][state.mode];
    const custom = state.colors[state.style]?.[state.mode] || {};
    for (const key of keys) root.style.setProperty(`--seed-${key}`, custom[key] || palette[key]);
    for (const input of colors) input.value = custom[input.dataset.colorKey] || palette[input.dataset.colorKey];
    for (const button of modeButtons) {
      button.hidden = false;
      button.textContent = state.mode === 'night' ? '夜晚' : '白天';
      button.setAttribute('aria-pressed', String(state.mode === 'day'));
      button.setAttribute('aria-label', state.mode === 'night' ? '目前夜晚模式，切換白天' : '目前白天模式，切換夜晚');
    }
    if (motion) { motion.checked = state.motion && !media.matches; motion.disabled = media.matches; }
    if (root.dataset.motion === 'reduced') stopImmersive(); else syncEffects();
    document.dispatchEvent(new CustomEvent('appearancechange'));
  }
  select.addEventListener('change', () => {
    if (!styles.includes(select.value)) return;
    state.style = select.value; render(); save();
  });
  for (const button of modeButtons) button.addEventListener('click', () => {
    state.mode = state.mode === 'night' ? 'day' : 'night'; render(); save();
  });
  for (const input of colors) input.addEventListener('input', () => {
    const key = input.dataset.colorKey;
    if (!keys.includes(key) || !hex(input.value)) return;
    state.colors[state.style] ||= {}; state.colors[state.style][state.mode] ||= {};
    state.colors[state.style][state.mode][key] = input.value;
    render(); save();
  });
  panel.querySelector('[data-reset-colors]')?.addEventListener('click', () => {
    if (state.colors[state.style]) delete state.colors[state.style][state.mode];
    render(); announce('已還原目前風格與日夜模式的配色。'); save();
  });
  motion?.addEventListener('change', () => { state.motion = motion.checked; render(); save(); });
  async function startImmersive() {
    if (desiredImmersive || root.dataset.motion === 'reduced' || !script?.dataset.immersiveSrc) return;
    desiredImmersive = true;
    const request = ++generation;
    syncEffects(); announce('正在開啟互動光場…');
    try {
      if (!modulePromise) {
        let moduleSource = script.dataset.immersiveSrc;
        // A browser caches failed module loads by URL; retries need a fresh key.
        if (importFailures) {
          const retryURL = new URL(moduleSource, document.baseURI);
          retryURL.searchParams.set('retry', String(importFailures)); moduleSource = retryURL.href;
        }
        modulePromise = import(moduleSource).catch(error => { importFailures++; modulePromise = null; throw error; });
      }
      const module = await modulePromise;
      if (!desiredImmersive || request !== generation || root.dataset.motion === 'reduced') return;
      immersive = module.createImmersive(scene, { luxury: desiredLuxury });
      syncEffects();
      announce(scene
        ? (desiredLuxury ? '奢華特效已全開；拖曳光場探索景深。' : '沉浸互動已開啟；可拖曳光場。')
        : (desiredLuxury ? '全站奢華部件光效已開啟。' : '細緻部件互動已開啟。'));
    } catch {
      if (request !== generation) return;
      stopImmersive(); announce('互動光場暫時無法載入，請再試一次。');
    }
  }
  for (const button of immersiveButtons) button.addEventListener('click', () => {
    if (desiredImmersive) { stopImmersive(); announce('已關閉沉浸與奢華特效。'); }
    else startImmersive();
  });
  for (const button of luxuryButtons) button.addEventListener('click', () => {
    if (root.dataset.motion === 'reduced') return;
    desiredLuxury = !desiredLuxury;
    if (!desiredImmersive) startImmersive();
    else { immersive?.setLuxury(desiredLuxury); syncEffects(); }
    if (immersive) announce(desiredLuxury ? '奢華特效已全開。' : '已回到一般沉浸互動。');
  });
  media.addEventListener('change', () => {
    render(); announce(media.matches ? '依裝置偏好減少動畫。' : '已恢復你的動畫設定。');
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && panel.open) { panel.open = false; panel.querySelector('summary')?.focus(); }
  });
  window.addEventListener('pagehide', stopImmersive);
  // Small reading utilities are independent of the opt-in visual effects.
  for (const block of document.querySelectorAll('.prose pre')) {
    if (!navigator.clipboard?.writeText) continue;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'code-copy';
    button.textContent = '複製';
    button.setAttribute('aria-label', '複製程式碼');
    button.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(block.querySelector('code')?.textContent || '');
        button.textContent = '已複製';
        announce('已複製程式碼。');
      } catch { button.textContent = '複製失敗'; }
      window.setTimeout(() => { button.textContent = '複製'; }, 1800);
    });
    block.append(button);
  }
  const progress = document.querySelector('[data-reading-progress]');
  const article = document.querySelector('.prose');
  if (progress && article) {
    let progressFrame = 0;
    const update = () => {
      progressFrame = 0;
      const rect = article.getBoundingClientRect();
      const fraction = Math.min(1, Math.max(0, (window.innerHeight - rect.top) / Math.max(1, rect.height)));
      progress.style.transform = `scaleX(${fraction})`;
    };
    const schedule = () => { if (!progressFrame) progressFrame = requestAnimationFrame(update); };
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    window.addEventListener('pagehide', () => { cancelAnimationFrame(progressFrame); progressFrame = 0; });
    window.addEventListener('pageshow', schedule);
    update();
  }
  const headings = [...document.querySelectorAll('.prose h2[id], .prose h3[id]')];
  const tocLinks = [...document.querySelectorAll('#TableOfContents a[href^="#"]')];
  if (headings.length && tocLinks.length && 'IntersectionObserver' in window) {
    const mark = id => {
      for (const link of tocLinks) {
        let target;
        try { target = decodeURIComponent(link.hash.slice(1)); } catch { target = ''; }
        if (target === id) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      }
    };
    const markPageEnd = () => {
      if (window.scrollY + window.innerHeight < document.documentElement.scrollHeight - 3) return false;
      const visible = headings.filter(heading => heading.getBoundingClientRect().top < window.innerHeight);
      if (!visible.length) return false;
      mark(visible[visible.length - 1].id);
      return true;
    };
    for (const link of tocLinks) link.addEventListener('click', () => {
      try { mark(decodeURIComponent(link.hash.slice(1))); } catch { /* Invalid fragment: browser handles it. */ }
    });
    const observer = new IntersectionObserver(entries => {
      // A short final section may never reach the observer's upper reading band.
      if (markPageEnd()) return;
      const entering = entries.filter(entry => entry.isIntersecting);
      if (entering.length) mark(entering[0].target.id);
    }, { rootMargin: '-10% 0px -65% 0px' });
    window.addEventListener('scroll', markPageEnd, { passive: true });
    headings.forEach(heading => observer.observe(heading));
    window.addEventListener('pagehide', () => observer.disconnect());
    window.addEventListener('pageshow', () => headings.forEach(heading => observer.observe(heading)));
  }
  render();
  panel.hidden = false;
  if (migrated) save();
  if (media.matches) announce('依裝置偏好減少動畫。');
})();
