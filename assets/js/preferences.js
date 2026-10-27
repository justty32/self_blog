/* Small, optional controller. Reading and navigation do not depend on JavaScript. */
(() => {
  'use strict';
  const root = document.documentElement;
  const panel = document.querySelector('[data-appearance-controls]');
  if (!panel) return;
  const script = document.currentScript;
  const storageKey = 'self-blog-appearance-v1';
  const keys = ['bg', 'surface', 'text', 'muted', 'primary', 'secondary'];
  const hex = value => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
  let palettes;
  try { palettes = JSON.parse(panel.dataset.palettes); } catch { return; }
  const styles = ['grid', 'paper', 'deep'].filter(name =>
    palettes[name] && keys.every(key => hex(palettes[name][key])));
  if (!styles.length) return;
  const select = panel.querySelector('[data-style-select]');
  const colors = [...panel.querySelectorAll('[data-color-key]')];
  const motion = panel.querySelector('[data-motion-toggle]');
  const immersiveButtons = [...document.querySelectorAll('[data-immersive-toggle]')];
  const status = panel.querySelector('[data-appearance-status]');
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  const sceneCaption = document.querySelector('.reactor-caption.caption-bottom');
  const originalCaption = sceneCaption?.textContent;
  let state = { style: styles.includes(root.dataset.style) ? root.dataset.style : styles[0], motion: true, colors: {} };
  let immersive = null;
  let desiredImmersive = false;
  let generation = 0;
  let storageAvailable = true;
  let modulePromise;
  let importFailures = 0;

  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (saved && typeof saved === 'object') {
      if (styles.includes(saved.style)) state.style = saved.style;
      if (typeof saved.motion === 'boolean') state.motion = saved.motion;
      if (saved.colors && typeof saved.colors === 'object') {
        for (const style of styles) {
          if (!saved.colors[style] || typeof saved.colors[style] !== 'object') continue;
          state.colors[style] = {};
          for (const key of keys) if (hex(saved.colors[style][key])) {
            state.colors[style][key] = saved.colors[style][key];
          }
        }
      }
    }
  } catch { storageAvailable = false; }

  function announce(message) { if (status) status.textContent = message; }
  function save() {
    try { localStorage.setItem(storageKey, JSON.stringify(state)); }
    catch { storageAvailable = false; }
    if (!storageAvailable) announce('已套用；此瀏覽器無法保存設定，換頁後可能重設。');
  }
  function stopImmersive() {
    desiredImmersive = false;
    generation++;
    if (immersive) immersive.destroy();
    immersive = null;
    root.dataset.immersive = 'off';
    if (sceneCaption) sceneCaption.textContent = originalCaption;
    for (const immersiveButton of immersiveButtons) {
      immersiveButton.setAttribute('aria-pressed', 'false');
      immersiveButton.textContent = '開啟沉浸互動';
      immersiveButton.removeAttribute('aria-busy');
    }
  }
  function render() {
    root.dataset.style = state.style;
    root.dataset.motion = state.motion && !media.matches ? 'full' : 'reduced';
    select.value = state.style;
    for (const key of keys) {
      root.style.setProperty(`--seed-${key}`, state.colors[state.style]?.[key] || palettes[state.style][key]);
    }
    for (const input of colors) {
      input.value = state.colors[state.style]?.[input.dataset.colorKey] || palettes[state.style][input.dataset.colorKey];
    }
    if (motion) {
      motion.checked = state.motion && !media.matches;
      motion.disabled = media.matches;
    }
    if (root.dataset.motion === 'reduced') stopImmersive();
    for (const immersiveButton of immersiveButtons) {
      immersiveButton.hidden = false;
      immersiveButton.disabled = root.dataset.motion === 'reduced' || !document.querySelector('[data-immersive-scene]');
    }
    document.dispatchEvent(new CustomEvent('appearancechange'));
  }

  select.addEventListener('change', () => {
    if (!styles.includes(select.value)) return;
    state.style = select.value;
    render(); save();
  });
  for (const input of colors) input.addEventListener('input', () => {
    const key = input.dataset.colorKey;
    if (!keys.includes(key) || !hex(input.value)) return;
    state.colors[state.style] ||= {};
    state.colors[state.style][key] = input.value;
    render(); save();
  });
  panel.querySelector('[data-reset-colors]')?.addEventListener('click', () => {
    delete state.colors[state.style];
    render(); announce('已還原目前風格的標準配色。'); save();
  });
  motion?.addEventListener('change', () => {
    state.motion = motion.checked;
    render(); save();
  });
  for (const toggle of immersiveButtons) toggle.addEventListener('click', async () => {
    if (desiredImmersive) {
      stopImmersive(); announce('已關閉沉浸模式。'); return;
    }
    if (root.dataset.motion === 'reduced') return;
    const scene = document.querySelector('[data-immersive-scene]');
    const source = script?.dataset.immersiveSrc;
    if (!scene || !source) return;
    desiredImmersive = true;
    const request = ++generation;
    for (const button of immersiveButtons) {
      button.setAttribute('aria-pressed', 'true');
      button.setAttribute('aria-busy', 'true');
      button.textContent = '取消載入';
    }
    announce('正在開啟沉浸模式…');
    try {
      if (!modulePromise) {
        // Browsers cache failed module fetches by URL. A retry needs a fresh key.
        let moduleSource = source;
        if (importFailures) {
          const retryURL = new URL(source, document.baseURI);
          retryURL.searchParams.set('retry', String(importFailures));
          moduleSource = retryURL.href;
        }
        modulePromise = import(moduleSource).catch(error => {
          importFailures++;
          modulePromise = null;
          throw error;
        });
      }
      const module = await modulePromise;
      if (!desiredImmersive || request !== generation || root.dataset.motion === 'reduced') return;
      immersive = module.createImmersive(scene);
      root.dataset.immersive = 'on';
      if (sceneCaption) sceneCaption.textContent = window.matchMedia('(pointer: coarse)').matches
        ? '輕觸光場，留下漣漪' : '移動游標探索光場 · 輕點留下漣漪';
      for (const button of immersiveButtons) {
        button.removeAttribute('aria-busy');
        button.textContent = '關閉沉浸互動';
      }
      announce('沉浸模式已開啟；只在此頁生效。');
    } catch {
      if (request !== generation) return;
      stopImmersive(); announce('沉浸模式暫時無法載入，仍可正常閱讀。');
    }
  });
  media.addEventListener('change', () => {
    render();
    announce(media.matches ? '依裝置偏好減少動畫。' : '已恢復你的動畫設定。');
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && panel.open) {
      panel.open = false;
      panel.querySelector('summary')?.focus();
    }
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
  if (media.matches) announce('依裝置偏好減少動畫。');
})();
