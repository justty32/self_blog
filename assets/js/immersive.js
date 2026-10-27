/* Opt-in effects: ordinary hero interaction, or full-page luxury atmosphere. */
export function createImmersive(scene, options = {}) {
  const root = document.documentElement;
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  let luxury = Boolean(options.luxury), disposed = false;
  let atmosphere = null;
  const surfaces = createSurfaces(() => luxury, () => !disposed && !media.matches && !document.hidden && root.dataset.textFrozen !== 'true');
  function syncAtmosphere() {
    if (luxury && !disposed) atmosphere ||= createLuxuryAtmosphere();
    else { atmosphere?.destroy(); atmosphere = null; }
  }
  const canvas = scene?.querySelector('[data-immersive-canvas]');
  const context = canvas?.getContext('2d');
  if (scene && !context) { surfaces.destroy(); throw new Error('Canvas is unavailable'); }
  if (!scene) {
    syncAtmosphere();
    return {
      setLuxury(value) { luxury = Boolean(value); surfaces.update(); syncAtmosphere(); },
      destroy() { if (disposed) return; disposed = true; surfaces.destroy(); syncAtmosphere(); }
    };
  }
  let width = 1, height = 1, frame = 0, last = 0, elapsed = 0, visible = true;
  let primary = '', secondary = '';
  const pointer = { x: 0, y: 0, targetX: 0, targetY: 0, localX: -1000, localY: -1000 };
  const rotation = { yaw: 0, pitch: 0, depth: 0, targetYaw: 0, targetPitch: 0, targetDepth: 0 };
  let drag = null;
  const ripples = [], trails = [];
  const stars = Array.from({ length: 108 }, (_, index) => ({
    x: ((index * 73 + 19) % 271) / 271, y: ((index * 109 + 41) % 263) / 263,
    depth: index % 3 + 1, phase: index * 2.399963
  }));
  const dots = Array.from({ length: 36 }, (_, index) => ({
    angle: index * 2.399963, radius: .17 + (index % 8) * .032,
    speed: .018 + (index % 5) * .004, size: index % 4 === 0 ? 1.1 : .65
  }));
  const updateColors = () => {
    const style = getComputedStyle(root);
    primary = style.getPropertyValue('--seed-primary').trim();
    secondary = style.getPropertyValue('--seed-secondary').trim();
  };
  function resize() {
    const rect = scene.getBoundingClientRect();
    width = Math.max(1, rect.width); height = Math.max(1, rect.height);
    const ratio = Math.min(window.devicePixelRatio || 1, luxury ? 2.5 : 1.75);
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }
  function draw(now) {
    frame = 0;
    if (disposed || document.hidden || !visible || media.matches) return;
    if (!luxury && last && now - last < 33) { frame = requestAnimationFrame(draw); return; }
    const delta = last ? Math.min((now - last) / 1000, .06) : 1 / 60;
    elapsed += delta; last = now;
    context.clearRect(0, 0, width, height);
    const follow = 1 - Math.exp(-delta * 3), spring = 1 - Math.exp(-delta * 4.5);
    pointer.x += (pointer.targetX - pointer.x) * follow;
    pointer.y += (pointer.targetY - pointer.y) * follow;
    rotation.yaw += (rotation.targetYaw - rotation.yaw) * spring;
    rotation.pitch += (rotation.targetPitch - rotation.pitch) * spring;
    rotation.depth += (rotation.targetDepth - rotation.depth) * spring;
    scene.style.setProperty('--scene-yaw', `${rotation.yaw.toFixed(3)}deg`);
    scene.style.setProperty('--scene-pitch', `${rotation.pitch.toFixed(3)}deg`);
    scene.style.setProperty('--scene-depth', `${rotation.depth.toFixed(3)}px`);
    const scale = Math.min(width, height), compact = width < 400;
    const starCount = luxury ? (compact ? 66 : 108) : (compact ? 33 : 54);
    const points = [];
    for (const star of stars.slice(0, starCount)) {
      let x = width * (.06 + star.x * .88) + pointer.x * star.depth * .45 + rotation.yaw * star.depth * .5;
      let y = height * (.08 + star.y * .8) + pointer.y * star.depth * .45 + rotation.pitch * star.depth * .5;
      x += Math.sin(elapsed * .055 + star.phase) * star.depth * 1.5;
      y += Math.cos(elapsed * .04 + star.phase) * star.depth;
      const dx = pointer.localX - x, dy = pointer.localY - y, distance = Math.hypot(dx, dy);
      if (distance < 110) {
        const attraction = (1 - distance / 110) * (luxury ? .14 : .085) * star.depth;
        x += dx * attraction; y += dy * attraction;
      }
      context.fillStyle = star.depth === 2 ? secondary : primary;
      context.globalAlpha = (luxury ? .2 : .08) + star.depth * .06 + Math.sin(elapsed * .5 + star.phase) * .025;
      context.shadowColor = context.fillStyle; context.shadowBlur = luxury && star.depth === 3 ? 7 : 0;
      context.beginPath(); context.arc(x, y, .35 + star.depth * (luxury ? .31 : .22), 0, Math.PI * 2); context.fill();
      if (star.depth === 2) points.push({ x, y });
    }
    context.shadowBlur = 0; context.strokeStyle = primary; context.lineWidth = .45;
    for (let index = 0; index < points.length; index++) {
      const point = points[index], proximity = Math.hypot(point.x - pointer.localX, point.y - pointer.localY);
      const range = luxury ? 200 : 140;
      if (proximity > range) continue;
      for (const other of points.slice(index + 1)) {
        const distance = Math.hypot(point.x - other.x, point.y - other.y);
        if (distance > 85) continue;
        context.globalAlpha = (1 - proximity / range) * (1 - distance / 85) * (luxury ? .5 : .2);
        context.beginPath(); context.moveTo(point.x, point.y); context.lineTo(other.x, other.y); context.stroke();
      }
    }
    const count = luxury ? (compact ? 24 : 36) : (compact ? 12 : 18);
    for (const [index, dot] of dots.slice(0, count).entries()) {
      const angle = dot.angle + elapsed * dot.speed + rotation.yaw * .016;
      const flatten = Math.max(.25, (index % 2 ? .52 : .76) + rotation.pitch * .009);
      const x = width * .5 + Math.cos(angle) * scale * dot.radius + pointer.x;
      const y = height * .48 + Math.sin(angle) * scale * dot.radius * flatten + pointer.y;
      context.strokeStyle = index % 3 ? primary : secondary;
      context.lineWidth = luxury ? .8 : .55; context.globalAlpha = luxury ? .32 : .14;
      context.beginPath();
      context.ellipse(width * .5 + pointer.x, height * .48 + pointer.y,
        scale * dot.radius, scale * dot.radius * flatten, 0, angle - (luxury ? .45 : .18), angle);
      context.stroke();
      context.globalAlpha = (luxury ? .55 : .28) + Math.sin(elapsed * .4 + index) * .08;
      context.fillStyle = context.strokeStyle;
      context.beginPath(); context.arc(x, y, dot.size, 0, Math.PI * 2); context.fill();
    }
    for (let index = ripples.length - 1; index >= 0; index--) {
      const ripple = ripples[index]; ripple.age += delta;
      if (ripple.age > 2.3) { ripples.splice(index, 1); continue; }
      const fade = Math.pow(1 - ripple.age / 2.3, 2);
      for (const delay of luxury ? [0, .2, .4] : [0, .22]) {
        const age = ripple.age - delay;
        if (age < 0) continue;
        context.strokeStyle = delay ? secondary : primary;
        context.lineWidth = delay ? .5 : .75; context.globalAlpha = fade * (luxury ? .5 : .24);
        context.beginPath(); context.arc(ripple.x, ripple.y, 8 + age * 65, 0, Math.PI * 2); context.stroke();
      }
    }
    for (const point of trails) point.age += delta;
    while (trails.length && trails[0].age > .85) trails.shift();
    if (luxury && trails.length > 1) {
      for (const offset of [-3, 3]) {
        context.strokeStyle = offset < 0 ? primary : secondary;
        context.shadowColor = context.strokeStyle; context.shadowBlur = 8; context.lineWidth = 1.2;
        for (let index = 1; index < trails.length; index++) {
          context.globalAlpha = Math.max(0, 1 - trails[index].age / .85) * .65;
          context.beginPath(); context.moveTo(trails[index - 1].x, trails[index - 1].y + offset);
          context.lineTo(trails[index].x, trails[index].y + offset); context.stroke();
        }
      }
    }
    context.shadowBlur = 0; context.globalAlpha = 1;
    frame = requestAnimationFrame(draw);
  }
  function releaseDrag() {
    const released = drag; drag = null;
    if (released && scene.hasPointerCapture?.(released.id)) scene.releasePointerCapture(released.id);
    delete scene.dataset.dragging;
    rotation.targetYaw = 0; rotation.targetPitch = 0; rotation.targetDepth = 0;
  }
  function suspend() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0; last = 0; releaseDrag();
  }
  function resume() {
    if (!disposed && !document.hidden && visible && !media.matches && !frame) frame = requestAnimationFrame(draw);
    else if (document.hidden || !visible || media.matches) suspend();
  }
  function move(event) {
    if (event.pointerType === 'touch' && !drag) return;
    const rect = scene.getBoundingClientRect();
    pointer.localX = event.clientX - rect.left; pointer.localY = event.clientY - rect.top;
    pointer.targetX = (pointer.localX / width - .5) * 9; pointer.targetY = (pointer.localY / height - .5) * 7;
    if (drag && event.pointerId === drag.id) {
      const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
      rotation.targetYaw = Math.max(-18, Math.min(18, dx * .14));
      rotation.targetPitch = Math.max(-12, Math.min(12, -dy * .11));
      rotation.targetDepth = Math.min(30, Math.hypot(dx, dy) * .12);
      if (luxury) {
        trails.push({ x: pointer.localX, y: pointer.localY, age: 0 });
        if (trails.length > 30) trails.shift();
      }
    }
  }
  function leave() {
    if (drag) return;
    pointer.targetX = 0; pointer.targetY = 0; pointer.localX = -1000; pointer.localY = -1000;
  }
  function down(event) {
    if (media.matches || document.hidden || (event.button !== undefined && event.button !== 0) || drag) return;
    const rect = scene.getBoundingClientRect();
    if (ripples.length >= 5) ripples.shift();
    ripples.push({ x: event.clientX - rect.left, y: event.clientY - rect.top, age: 0 });
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    scene.dataset.dragging = 'true';
    scene.setPointerCapture?.(event.pointerId);
  }
  function up(event) { if (drag && drag.id === event.pointerId) { releaseDrag(); leave(); } }
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(scene);
  const visibilityObserver = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; resume(); });
  visibilityObserver.observe(scene);
  scene.addEventListener('pointermove', move, { passive: true }); scene.addEventListener('pointerleave', leave);
  scene.addEventListener('pointerdown', down, { passive: true }); scene.addEventListener('pointerup', up);
  scene.addEventListener('pointercancel', up); scene.addEventListener('lostpointercapture', up);
  document.addEventListener('visibilitychange', resume); document.addEventListener('appearancechange', updateColors);
  media.addEventListener('change', resume);
  updateColors(); resize(); resume(); syncAtmosphere();
  return {
    setLuxury(value) { luxury = Boolean(value); if (!luxury) trails.length = 0; surfaces.update(); resize(); syncAtmosphere(); },
    destroy() {
      if (disposed) return;
      disposed = true; suspend(); surfaces.destroy(); syncAtmosphere();
      resizeObserver.disconnect(); visibilityObserver.disconnect();
      scene.removeEventListener('pointermove', move); scene.removeEventListener('pointerleave', leave);
      scene.removeEventListener('pointerdown', down); scene.removeEventListener('pointerup', up);
      scene.removeEventListener('pointercancel', up); scene.removeEventListener('lostpointercapture', up);
      document.removeEventListener('visibilitychange', resume); document.removeEventListener('appearancechange', updateColors);
      media.removeEventListener('change', resume);
      for (const key of ['--scene-yaw', '--scene-pitch', '--scene-depth']) scene.style.removeProperty(key);
      context.clearRect(0, 0, width, height);
    }
  };
}

function createSurfaces(isLuxury, canRun) {
  const selector = '.post-card, .button, .text-button, .nav-links a, .tag, .term-grid a, #TableOfContents a, .setting-row, .mode-toggle, .appearance-trigger, .signal-item, .appearance-popover, .signal-strip, .article-toc, .prose pre';
  const nodes = [...document.querySelectorAll(selector)];
  const cleanups = [], pending = new Map();
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  function clear(node) {
    delete node.dataset.tracing;
    for (const key of ['--pointer-x', '--pointer-y', '--tilt-x', '--tilt-y', '--card-pointer-x', '--card-pointer-y']) node.style.removeProperty(key);
  }
  for (const node of nodes) {
    const trace = event => {
      if (!canRun() || !fine || event.pointerType === 'touch') return;
      const rect = node.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width, y = (event.clientY - rect.top) / rect.height;
      if (isLuxury()) {
        node.style.setProperty('--pointer-x', `${x * 100}%`); node.style.setProperty('--pointer-y', `${y * 100}%`);
        node.style.setProperty('--tilt-x', `${(y - .5) * -3}deg`); node.style.setProperty('--tilt-y', `${(x - .5) * 3}deg`);
      }
      if (node.matches('.post-card')) {
        node.style.setProperty('--card-pointer-x', `${x * 100}%`); node.style.setProperty('--card-pointer-y', `${y * 100}%`);
        node.dataset.tracing = 'true';
      }
    };
    const leave = () => clear(node);
    const pulse = event => {
      if (!isLuxury() || !canRun() || event.target.closest(selector) !== node) return;
      const rect = node.getBoundingClientRect(), ripple = document.createElement('span');
      ripple.className = 'luxury-ripple'; ripple.setAttribute('aria-hidden', 'true');
      ripple.style.left = `${event.detail ? event.clientX - rect.left : rect.width / 2}px`;
      ripple.style.top = `${event.detail ? event.clientY - rect.top : rect.height / 2}px`;
      node.append(ripple);
      const timer = window.setTimeout(() => { ripple.remove(); pending.delete(ripple); }, 800);
      pending.set(ripple, timer);
    };
    node.addEventListener('pointermove', trace, { passive: true }); node.addEventListener('pointerleave', leave);
    node.addEventListener('click', pulse);
    cleanups.push(() => {
      node.removeEventListener('pointermove', trace); node.removeEventListener('pointerleave', leave); node.removeEventListener('click', pulse);
      clear(node); delete node.dataset.luxurySurface;
    });
  }
  function clearPulses() {
    for (const [ripple, timer] of pending) { window.clearTimeout(timer); ripple.remove(); }
    pending.clear();
  }
  const update = () => {
    for (const node of nodes) {
      if (isLuxury()) node.dataset.luxurySurface = 'true'; else { delete node.dataset.luxurySurface; clear(node); }
    }
    if (!isLuxury()) clearPulses();
  };
  update();
  return { update, destroy() { cleanups.forEach(cleanup => cleanup()); clearPulses(); } };
}

/* Full-page luxury layer. Native refresh rate; nothing intercepts native input. */
function createLuxuryAtmosphere() {
  const root = document.documentElement;
  const canvas = document.createElement('canvas');
  canvas.className = 'luxury-atmosphere'; canvas.setAttribute('aria-hidden', 'true');
  document.body.append(canvas);
  const context = canvas.getContext('2d');
  if (!context) { canvas.remove(); return { destroy() {} }; }
  const text = createLuxuryText();
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  const pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2, targetX: window.innerWidth / 2, targetY: window.innerHeight / 2, down: false };
  let width = 1, height = 1, frame = 0, previous = 0, time = 0, disposed = false;
  let scrollDepth = 0, scrollTarget = window.scrollY || 0, primary = [], secondary = [], day = false, styleName = 'grid';
  const trails = [], waves = [];
  const stars = Array.from({ length: 320 }, (_, index) => ({
    x: ((index * 161 + 27) % 617) / 617 * 2 - 1,
    y: ((index * 233 + 53) % 607) / 607 * 2 - 1,
    z: ((index * 157 + 7) % 593) / 593,
    phase: index * 2.399963, size: .5 + index % 5 * .26
  }));
  function rgb(value) {
    const match = /^#([0-9a-f]{6})$/i.exec(value.trim());
    return match ? [0, 2, 4].map(index => parseInt(match[1].slice(index, index + 2), 16)) : [128, 128, 128];
  }
  const color = (channels, alpha) => `rgba(${channels.join(',')},${Math.max(0, Math.min(1, alpha))})`;
  function updateColors() {
    const style = getComputedStyle(root);
    primary = rgb(style.getPropertyValue('--seed-primary')); secondary = rgb(style.getPropertyValue('--seed-secondary'));
    day = root.dataset.mode === 'day'; styleName = root.dataset.style || 'grid';
  }
  function resize() {
    width = Math.max(1, window.innerWidth); height = Math.max(1, window.innerHeight);
    const ratio = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }
  function curveY(x, band) {
    const base = height * (.12 + band * .16);
    const flow = Math.sin(x / width * 5.5 + time * .22 + band * 1.3) * height * .075;
    const second = Math.cos(x / width * 10 - time * .13 + band) * height * .023;
    const distance = Math.abs(x - pointer.x) / Math.max(1, width * .3);
    const pull = Math.exp(-distance * distance * 2) * (pointer.y - base) * (pointer.down ? .24 : .09);
    return base + flow + second + pull + Math.sin(scrollDepth * .0007 + band) * 20;
  }
  function draw(now) {
    frame = 0;
    if (disposed || document.hidden || media.matches) return;
    const delta = previous ? Math.min((now - previous) / 1000, .05) : 1 / 60;
    previous = now; time += delta;
    const ease = 1 - Math.exp(-delta * 6);
    pointer.x += (pointer.targetX - pointer.x) * ease; pointer.y += (pointer.targetY - pointer.y) * ease;
    scrollDepth += (scrollTarget - scrollDepth) * ease;
    context.clearRect(0, 0, width, height);
    // Six translucent ribbons bend into the pointer and respond to page depth.
    for (let band = 0; band < (styleName === 'grid' ? 2 : 6); band++) {
      const gradient = context.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, color(primary, 0)); gradient.addColorStop(.24, color(primary, day ? .065 : .1));
      gradient.addColorStop(.72, color(secondary, day ? .08 : .14)); gradient.addColorStop(1, color(secondary, 0));
      const thickness = height * (.035 + (band % 3) * .012);
      context.fillStyle = gradient; context.beginPath();
      for (let step = 0; step <= 40; step++) {
        const x = width * step / 40, y = curveY(x, band);
        if (!step) context.moveTo(x, y); else context.lineTo(x, y);
      }
      for (let step = 40; step >= 0; step--) {
        const x = width * step / 40; context.lineTo(x, curveY(x, band) + thickness);
      }
      context.closePath(); context.fill();
      context.strokeStyle = color(band % 2 ? primary : secondary, day ? .28 : .38); context.lineWidth = .8;
      context.beginPath();
      for (let step = 0; step <= 40; step++) {
        const x = width * step / 40, y = curveY(x, band);
        if (!step) context.moveTo(x, y); else context.lineTo(x, y);
      }
      context.stroke();
    }
    // Perspective mesh: nearer rows spread out, with a traveling wave distortion.
    context.lineWidth = .55;
    const horizon = height * .57 + (pointer.y / height - .5) * 18;
    for (let row = 0; row < (styleName === 'grid' ? 14 : 0); row++) {
      const z = ((row / 14 + time * .018) % 1), spread = z * z;
      const y = horizon + spread * height * .65;
      context.strokeStyle = color(primary, (day ? .11 : .17) * z);
      context.beginPath();
      for (let step = 0; step <= 30; step++) {
        const x = width * step / 30;
        const warp = Math.sin(step * .45 + time * .7 + row) * 7 * z + (pointer.down ? Math.sin((x - pointer.x) * .02 + time * 3) * 15 * z : 0);
        if (!step) context.moveTo(x, y + warp); else context.lineTo(x, y + warp);
      }
      context.stroke();
    }
    for (let column = -12; styleName === 'grid' && column <= 12; column++) {
      context.strokeStyle = color(secondary, day ? .07 : .12); context.beginPath();
      context.moveTo(width / 2 + column * width * .018, horizon);
      context.lineTo(width / 2 + column * width * .11 + (pointer.x / width - .5) * 40, height * 1.1); context.stroke();
    }
    // Project a real depth coordinate into screen space, retaining near/far motion.
    const cx = width / 2, cy = height / 2;
    for (const star of styleName === 'paper' ? [] : stars) {
      const z = .12 + ((star.z + time * .018 + scrollDepth * .000025) % 1) * .88;
      const perspective = 1 / (1.6 - z);
      let x = cx + star.x * width * .72 * perspective + (pointer.x - cx) * z * .045;
      let y = cy + star.y * height * .76 * perspective + (pointer.y - cy) * z * .045;
      const dx = pointer.x - x, dy = pointer.y - y, distance = Math.hypot(dx, dy);
      if (distance < 180) {
        const influence = (1 - distance / 180) * (pointer.down ? .3 : .09) * z;
        x += dx * influence; y += dy * influence;
      }
      if (x < -5 || x > width + 5 || y < -5 || y > height + 5) continue;
      const alpha = .15 + z * .48 + Math.sin(time * .8 + star.phase) * .07;
      context.fillStyle = color(star.phase % 3 > 1 ? primary : secondary, alpha);
      context.shadowColor = color(primary, .6); context.shadowBlur = z > .8 ? 6 : 0;
      context.beginPath(); context.arc(x, y, star.size * perspective, 0, Math.PI * 2); context.fill();
      if (z > .84) {
        context.strokeStyle = color(secondary, .14); context.lineWidth = .5;
        context.beginPath(); context.moveTo(x, y - 4); context.lineTo(x, y + 4); context.moveTo(x - 4, y); context.lineTo(x + 4, y); context.stroke();
      }
    }
    context.shadowBlur = 0;
    for (const point of trails) point.age += delta;
    while (trails.length && trails[0].age > .9) trails.shift();
    if (trails.length > 1) {
      for (const offset of [-4, 0, 4]) {
        context.shadowColor = color(offset ? secondary : primary, .7); context.shadowBlur = 9;
        context.lineWidth = offset ? 1.1 : 2.1;
        for (let index = 1; index < trails.length; index++) {
          const fade = Math.pow(Math.max(0, 1 - trails[index].age / .9), 1.5);
          context.strokeStyle = color(offset ? secondary : primary, fade * .65);
          context.beginPath(); context.moveTo(trails[index - 1].x, trails[index - 1].y + offset);
          context.lineTo(trails[index].x, trails[index].y + offset); context.stroke();
        }
      }
    }
    context.shadowBlur = 0;
    for (let index = waves.length - 1; index >= 0; index--) {
      const wave = waves[index]; wave.age += delta;
      if (wave.age > 2.4) { waves.splice(index, 1); continue; }
      for (let ring = 0; ring < 3; ring++) {
        const age = wave.age - ring * .14; if (age < 0) continue;
        context.strokeStyle = color(ring % 2 ? secondary : primary, Math.pow(1 - wave.age / 2.4, 2) * .55);
        context.lineWidth = 1.1 - ring * .2;
        context.beginPath(); context.ellipse(wave.x, wave.y, 10 + age * 150, 10 + age * 120, 0, 0, Math.PI * 2); context.stroke();
      }
    }
    drawLuxurySignature(context, { style: styleName, day, width, height, time, pointer, primary, secondary, scrollDepth });
    text.update({ x: pointer.x, y: pointer.y }, delta);
    frame = requestAnimationFrame(draw);
  }
  function move(event) {
    pointer.targetX = event.clientX; pointer.targetY = event.clientY;
    trails.push({ x: event.clientX, y: event.clientY, age: 0 });
    if (trails.length > 90) trails.shift();
  }
  function down(event) {
    if (event.isPrimary === false) return;
    pointer.down = true; move(event);
    waves.push({ x: event.clientX, y: event.clientY, age: 0 });
    if (waves.length > 8) waves.shift();
  }
  function up() { pointer.down = false; }
  function scroll() { scrollTarget = window.scrollY || 0; }
  function stop() { if (frame) cancelAnimationFrame(frame); frame = 0; previous = 0; pointer.down = false; }
  function resume() {
    if (document.hidden || media.matches || disposed) stop();
    else if (!frame) frame = requestAnimationFrame(draw);
  }
  window.addEventListener('pointermove', move, { passive: true }); window.addEventListener('pointerdown', down, { passive: true });
  window.addEventListener('pointerup', up, { passive: true }); window.addEventListener('pointercancel', up, { passive: true });
  window.addEventListener('scroll', scroll, { passive: true }); window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', resume); document.addEventListener('appearancechange', updateColors);
  media.addEventListener('change', resume);
  updateColors(); resize(); resume();
  return {
    destroy() {
      if (disposed) return; disposed = true; stop(); text.destroy();
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
      window.removeEventListener('scroll', scroll); window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', resume); document.removeEventListener('appearancechange', updateColors);
      media.removeEventListener('change', resume); canvas.remove();
    }
  };
}
/*
 * Called by the opt-in atmosphere's existing frame loop (no private RAF).
 * pointer: viewport CSS-pixel coordinates { x, y }; null eases everything home.
 * DOM contract: data-luxury-text="true", --text-x/--text-y/--text-depth (px),
 * --text-phase (s). Root data-text-frozen="true" freezes CSS motion while selecting
 * text or editing a form. Original DOM, attributes and inline values are restored.
 */
function createLuxuryText() {
  const root = document.documentElement;
  const selector = 'h1, h2, h3, .prose p, .prose li, .hero-copy, .post-card p, .page-description';
  const variables = ['--text-x', '--text-y', '--text-depth', '--text-phase'];
  const originalFrozen = root.getAttribute('data-text-frozen');
  let disposed = false, dirty = true, frozen = false;
  let viewportWidth = window.innerWidth, viewportHeight = window.innerHeight;
  const entries = [...document.querySelectorAll(selector)].map((node, index) => {
    const entry = {
      node, originalAttribute: node.getAttribute('data-luxury-text'),
      originalStyles: variables.map(name => ({ name, value: node.style.getPropertyValue(name), priority: node.style.getPropertyPriority(name) })),
      x: 0, y: 0, depth: 0, rect: null,
      // Nested paragraphs inherit the parent block's motion instead of doubling it.
      nested: Boolean(node.parentElement?.closest(selector)),
      phase: -(index % 11) * .43
    };
    node.setAttribute('data-luxury-text', 'true');
    node.style.setProperty('--text-phase', `${entry.phase}s`);
    node.style.setProperty('--text-x', '0px');
    node.style.setProperty('--text-y', '0px');
    node.style.setProperty('--text-depth', '0px');
    return entry;
  });
  function editing(node) {
    return Boolean(node?.matches?.('input, select, textarea') || node?.isContentEditable ||
      node?.closest?.('[contenteditable]:not([contenteditable="false"])'));
  }
  function syncFrozen() {
    if (disposed) return;
    const selection = document.getSelection?.();
    const next = Boolean(selection && !selection.isCollapsed && selection.rangeCount) || editing(document.activeElement);
    if (next !== frozen) dirty = true;
    frozen = next;
    if (frozen) root.setAttribute('data-text-frozen', 'true');
    else if (originalFrozen === null) root.removeAttribute('data-text-frozen');
    else root.setAttribute('data-text-frozen', originalFrozen);
  }
  function markDirty() { dirty = true; }
  function refreshGeometry() {
    viewportWidth = window.innerWidth; viewportHeight = window.innerHeight;
    // Batch all reads before writing any animation values.
    for (const entry of entries) {
      const rect = entry.node.getBoundingClientRect();
      entry.rect = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2,
        left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
    }
    dirty = false;
  }
  function afterFocus() {
    // focusout fires before document.activeElement always reflects its successor.
    Promise.resolve().then(() => { if (!disposed) syncFrozen(); });
  }
  document.addEventListener('selectionchange', syncFrozen);
  document.addEventListener('focusin', syncFrozen);
  document.addEventListener('focusout', afterFocus);
  window.addEventListener('scroll', markDirty, { passive: true, capture: true });
  window.addEventListener('resize', markDirty, { passive: true });
  document.addEventListener('appearancechange', markDirty);
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(markDirty) : null;
  if (observer) for (const entry of entries) observer.observe(entry.node);
  document.fonts?.ready?.then(() => { if (!disposed) dirty = true; });
  syncFrozen();
  return {
    update(pointer, delta = 1 / 60) {
      if (disposed || frozen) return;
      if (dirty) refreshGeometry();
      const active = Number.isFinite(pointer?.x) && Number.isFinite(pointer?.y) &&
        pointer.x >= 0 && pointer.x <= viewportWidth && pointer.y >= 0 && pointer.y <= viewportHeight;
      const radius = Math.min(480, Math.max(260, viewportWidth * .42));
      const follow = 1 - Math.exp(-delta * 8), depthFollow = 1 - Math.exp(-delta * 7);
      for (const entry of entries) {
        const rect = entry.rect;
        if (!rect || rect.bottom < -40 || rect.top > viewportHeight + 40) continue;
        let targetX = 0, targetY = 0, targetDepth = 0;
        if (active && !entry.nested) {
          // Distance to the block edge keeps long paragraphs responsive at either end.
          const nearestX = Math.max(rect.left, Math.min(pointer.x, rect.right));
          const nearestY = Math.max(rect.top, Math.min(pointer.y, rect.bottom));
          const distance = Math.hypot(pointer.x - nearestX, pointer.y - nearestY);
          const influence = Math.pow(Math.max(0, 1 - distance / radius), 2);
          targetX = Math.max(-10, Math.min(10, (pointer.x - rect.x) / radius * 10)) * influence;
          targetY = Math.max(-8, Math.min(8, (pointer.y - rect.y) / radius * 8)) * influence;
          targetDepth = influence * 24;
        }
        entry.x += (targetX - entry.x) * follow;
        entry.y += (targetY - entry.y) * follow;
        entry.depth += (targetDepth - entry.depth) * depthFollow;
        entry.node.style.setProperty('--text-x', `${entry.x.toFixed(3)}px`);
        entry.node.style.setProperty('--text-y', `${entry.y.toFixed(3)}px`);
        entry.node.style.setProperty('--text-depth', `${entry.depth.toFixed(3)}px`);
      }
    },
    destroy() {
      if (disposed) return;
      disposed = true;
      document.removeEventListener('selectionchange', syncFrozen);
      document.removeEventListener('focusin', syncFrozen);
      document.removeEventListener('focusout', afterFocus);
      window.removeEventListener('scroll', markDirty, true);
      window.removeEventListener('resize', markDirty);
      document.removeEventListener('appearancechange', markDirty);
      observer?.disconnect();
      for (const entry of entries) {
        if (entry.originalAttribute === null) entry.node.removeAttribute('data-luxury-text');
        else entry.node.setAttribute('data-luxury-text', entry.originalAttribute);
        for (const property of entry.originalStyles) {
          if (property.value) entry.node.style.setProperty(property.name, property.value, property.priority);
          else entry.node.style.removeProperty(property.name);
        }
      }
      if (originalFrozen === null) root.removeAttribute('data-text-frozen');
      else root.setAttribute('data-text-frozen', originalFrozen);
    }
  };
}
/* Large, distinct signatures layered by the opt-in atmosphere. time is seconds. */
function drawLuxurySignature(context, state) {
  const { width, height, primary, secondary } = state;
  if (!(width > 0 && height > 0)) return;
  const time = Number.isFinite(state.time) ? state.time : 0;
  const depth = Number.isFinite(state.scrollDepth) ? state.scrollDepth / 1000 : 0;
  const pointer = state.pointer || {};
  const px = Number.isFinite(pointer.x) ? Math.max(-1, Math.min(1, pointer.x / width * 2 - 1)) : 0;
  const py = Number.isFinite(pointer.y) ? Math.max(-1, Math.min(1, pointer.y / height * 2 - 1)) : 0;
  const ink = (color, alpha) => `rgba(${color[0]},${color[1]},${color[2]},${alpha})`;
  const scale = Math.min(width, height);
  const day = Boolean(state.day);
  context.save();
  context.globalCompositeOperation = 'source-over';
  context.globalAlpha = 1;
  context.lineCap = 'round';
  context.lineJoin = 'round';

  if (state.style === 'grid') {
    // A cut-corner transit tunnel, expanding from one shared vanishing point.
    const cx = width * (.5 + px * .045), cy = height * (.43 + py * .035);
    const octagon = [[-.68, -1], [.68, -1], [1, -.68], [1, .68], [.68, 1], [-.68, 1], [-1, .68], [-1, -.68]];
    const pathFrame = (rx, ry) => {
      context.beginPath();
      octagon.forEach(([x, y], index) => {
        if (index) context.lineTo(cx + x * rx, cy + y * ry);
        else context.moveTo(cx + x * rx, cy + y * ry);
      });
      context.closePath();
    };
    for (let index = 0; index < 11; index++) {
      const advance = ((index / 11 + time * .038 + depth * .025) % 1 + 1) % 1;
      const perspective = .06 + advance * advance * 1.38;
      const rx = width * .64 * perspective, ry = height * .65 * perspective;
      const fade = Math.sin(advance * Math.PI) * (day ? .42 : .5);
      const stroke = context.createLinearGradient(cx - rx, cy - ry, cx + rx, cy + ry);
      stroke.addColorStop(0, ink(primary, fade));
      stroke.addColorStop(.5, ink(secondary, fade * .45));
      stroke.addColorStop(1, ink(primary, fade * .85));
      context.strokeStyle = stroke;
      context.lineWidth = .7 + perspective * 1.5;
      pathFrame(rx, ry); context.stroke();
      if (index % 3 === 0) {
        context.strokeStyle = ink(secondary, fade * .65);
        context.lineWidth = .65;
        pathFrame(rx + 5, ry + 5); context.stroke();
      }
    }
    for (const [x, y] of octagon) {
      const ray = context.createLinearGradient(cx, cy, cx + x * width, cy + y * height);
      ray.addColorStop(0, ink(primary, .02));
      ray.addColorStop(.35, ink(secondary, day ? .2 : .27));
      ray.addColorStop(1, ink(primary, 0));
      context.strokeStyle = ray; context.lineWidth = 1;
      context.beginPath(); context.moveTo(cx + x * 20, cy + y * 20);
      context.lineTo(cx + x * width, cy + y * height); context.stroke();
    }
    const scanY = height * ((time * .07 + depth * .04) % 1);
    const scan = context.createLinearGradient(0, scanY - 26, 0, scanY + 26);
    scan.addColorStop(0, ink(primary, 0));
    scan.addColorStop(.5, ink(primary, day ? .11 : .16));
    scan.addColorStop(1, ink(primary, 0));
    context.fillStyle = scan; context.fillRect(0, scanY - 26, width, 52);
    context.strokeStyle = ink(primary, day ? .35 : .5); context.lineWidth = .7;
    context.beginPath(); context.moveTo(width * .06, scanY); context.lineTo(width * .94, scanY); context.stroke();
  } else if (state.style === 'deep') {
    // Overlapping nebulae make the far field broad; tilted orbits define its depth.
    for (let index = 0; index < 3; index++) {
      const x = width * (.2 + index * .3) + Math.sin(time * .12 + index * 2) * width * .08 + px * 22;
      const y = height * (.35 + Math.sin(time * .09 + index * 2.2) * .2) + py * 16;
      const radius = scale * (.47 + index * .08);
      const cloud = context.createRadialGradient(x, y, 0, x, y, radius);
      const color = index % 2 ? primary : secondary;
      cloud.addColorStop(0, ink(color, day ? .12 : .2));
      cloud.addColorStop(.38, ink(color, day ? .07 : .1));
      cloud.addColorStop(1, ink(color, 0));
      context.fillStyle = cloud; context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
    const cx = width * (.52 + px * .025), cy = height * (.46 + py * .03);
    context.translate(cx, cy);
    for (let index = 0; index < 9; index++) {
      context.save();
      const radius = scale * (.14 + index * .067);
      const tilt = index % 2 ? -.45 : .35;
      context.rotate(tilt + Math.sin(time * .04 + index) * .14 + px * .09);
      const flatten = .26 + (index % 3) * .13;
      const phase = time * (.055 + index * .009) * (index % 2 ? -1 : 1) + index * .81 + depth * .12;
      context.strokeStyle = ink(index % 2 ? secondary : primary, day ? .24 : .34);
      context.lineWidth = index % 3 === 0 ? 1.4 : .7;
      context.beginPath(); context.ellipse(0, 0, radius, radius * flatten, 0, phase, phase + Math.PI * 1.5); context.stroke();
      const x = Math.cos(phase) * radius, y = Math.sin(phase) * radius * flatten;
      context.fillStyle = ink(index % 2 ? primary : secondary, day ? .7 : .85);
      context.beginPath(); context.arc(x, y, index % 3 === 0 ? 3.1 : 1.9, 0, Math.PI * 2); context.fill();
      context.restore();
    }
    const halo = context.createRadialGradient(0, 0, scale * .04, 0, 0, scale * .22);
    halo.addColorStop(0, ink(primary, 0));
    halo.addColorStop(.32, ink(primary, day ? .08 : .14));
    halo.addColorStop(.7, ink(secondary, day ? .05 : .1));
    halo.addColorStop(1, ink(secondary, 0));
    context.fillStyle = halo; context.fillRect(-scale * .22, -scale * .22, scale * .44, scale * .44);
  } else {
    // Translucent sheets drift at different depths through five long ink currents.
    for (let index = 0; index < 5; index++) {
      const y = height * (.14 + index * .18) + Math.sin(time * .14 + index) * 30;
      const bend = Math.sin(time * .18 + index * .9) * scale * .13 + py * 40;
      context.strokeStyle = ink(index % 2 ? secondary : primary, day ? .2 : .25);
      context.lineWidth = index % 2 ? 1.4 : 2.2;
      context.beginPath(); context.moveTo(-30, y);
      context.bezierCurveTo(width * .3, y + bend, width * .65, y - bend + px * 25, width + 30, y + Math.sin(time * .12) * 30);
      context.stroke();
      context.strokeStyle = ink(primary, day ? .08 : .12); context.lineWidth = 7;
      context.stroke();
    }
    for (let index = 0; index < 8; index++) {
      const phase = index * 2.399963;
      const x = width * (.08 + ((index * 37) % 89) / 100) + Math.sin(time * .09 + phase) * 25 + px * (index % 3 + 1) * 6;
      const y = height * (.1 + ((index * 29) % 79) / 100) + Math.cos(time * .12 + phase) * 26 - depth * (index % 3 + 1) * 5;
      const sheetWidth = Math.min(160, Math.max(62, scale * (.11 + (index % 3) * .035)));
      const sheetHeight = sheetWidth * 1.3;
      context.save(); context.translate(x, y);
      context.rotate(Math.sin(time * .07 + phase) * .19 + (index % 2 ? .12 : -.12));
      const wash = context.createLinearGradient(-sheetWidth / 2, -sheetHeight / 2, sheetWidth / 2, sheetHeight / 2);
      wash.addColorStop(0, ink(primary, day ? .1 : .13));
      wash.addColorStop(.6, ink(secondary, day ? .035 : .06));
      wash.addColorStop(1, ink(primary, 0));
      context.fillStyle = wash; context.strokeStyle = ink(primary, day ? .28 : .32); context.lineWidth = .8;
      context.beginPath(); context.moveTo(-sheetWidth / 2, -sheetHeight / 2);
      context.lineTo(sheetWidth / 2 - 13, -sheetHeight / 2);
      context.lineTo(sheetWidth / 2, -sheetHeight / 2 + 13);
      context.lineTo(sheetWidth / 2, sheetHeight / 2);
      context.lineTo(-sheetWidth / 2, sheetHeight / 2); context.closePath(); context.fill(); context.stroke();
      context.beginPath(); context.moveTo(sheetWidth / 2 - 13, -sheetHeight / 2);
      context.lineTo(sheetWidth / 2 - 13, -sheetHeight / 2 + 13);
      context.lineTo(sheetWidth / 2, -sheetHeight / 2 + 13); context.stroke();
      context.strokeStyle = ink(secondary, day ? .18 : .23); context.lineWidth = .65;
      for (let line = 0; line < 4; line++) {
        const lineY = -sheetHeight * .2 + line * sheetHeight * .13;
        context.beginPath(); context.moveTo(-sheetWidth * .3, lineY);
        context.lineTo(sheetWidth * (line % 2 ? .12 : .3), lineY); context.stroke();
      }
      context.restore();
    }
  }
  context.restore();
}
