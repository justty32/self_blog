/* This optional visual layer is requested only by an explicit visitor action. */
export function createImmersive(scene) {
  const canvas = scene.querySelector('[data-immersive-canvas]');
  const context = canvas?.getContext('2d');
  if (!context) throw new Error('Canvas is unavailable');
  const root = document.documentElement;
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  let width = 1, height = 1, frame = 0, last = 0, elapsed = 0;
  let visible = true, disposed = false;
  let primary = '', secondary = '';
  const pointer = { x: 0, y: 0, targetX: 0, targetY: 0, localX: -1000, localY: -1000 };
  const ripples = [];
  // Deterministic positions keep the scene quiet across resize and reactivation.
  const stars = Array.from({ length: 54 }, (_, index) => ({
    x: ((index * 73 + 19) % 271) / 271,
    y: ((index * 109 + 41) % 263) / 263,
    depth: index % 3 + 1,
    phase: index * 2.399963
  }));
  const dots = Array.from({ length: 18 }, (_, index) => ({
    angle: index * 2.399963, radius: .17 + (index % 6) * .041,
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
    const ratio = Math.min(window.devicePixelRatio || 1, 1.75);
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }
  function draw(now) {
    frame = 0;
    if (disposed || document.hidden || !visible || media.matches) return;
    if (last && now - last < 32) { frame = requestAnimationFrame(draw); return; }
    const delta = last ? Math.min((now - last) / 1000, .06) : 0;
    elapsed += delta; last = now;
    context.clearRect(0, 0, width, height);
    pointer.x += (pointer.targetX - pointer.x) * .045;
    pointer.y += (pointer.targetY - pointer.y) * .045;
    const scale = Math.min(width, height);
    const compact = width < 400;
    const points = [];
    // Three depths: distant dust, middle constellations, and nearby pin lights.
    for (const star of stars.slice(0, compact ? 33 : stars.length)) {
      let x = width * (.06 + star.x * .88) + pointer.x * star.depth * .45;
      let y = height * (.08 + star.y * .8) + pointer.y * star.depth * .45;
      x += Math.sin(elapsed * .055 + star.phase) * star.depth * 1.5;
      y += Math.cos(elapsed * .04 + star.phase) * star.depth;
      const dx = pointer.localX - x, dy = pointer.localY - y;
      const distance = Math.hypot(dx, dy);
      if (distance < 110) {
        const attraction = (1 - distance / 110) * .085 * star.depth;
        x += dx * attraction; y += dy * attraction;
      }
      context.fillStyle = star.depth === 2 ? secondary : primary;
      context.globalAlpha = .08 + star.depth * .06 + Math.sin(elapsed * .5 + star.phase) * .025;
      context.beginPath(); context.arc(x, y, .35 + star.depth * .22, 0, Math.PI * 2); context.fill();
      if (star.depth === 2) points.push({ x, y });
    }
    // Thin connections appear only near the pointer, revealing another layer.
    context.strokeStyle = primary; context.lineWidth = .45;
    for (let index = 0; index < points.length; index++) {
      const point = points[index];
      const proximity = Math.hypot(point.x - pointer.localX, point.y - pointer.localY);
      if (proximity > 140) continue;
      for (const other of points.slice(index + 1)) {
        const distance = Math.hypot(point.x - other.x, point.y - other.y);
        if (distance > 85) continue;
        context.globalAlpha = (1 - proximity / 140) * (1 - distance / 85) * .2;
        context.beginPath(); context.moveTo(point.x, point.y); context.lineTo(other.x, other.y); context.stroke();
      }
    }
    // Orbital trails have distinct speeds and planes; the typography stays still.
    for (const [index, dot] of dots.slice(0, compact ? 12 : dots.length).entries()) {
      const angle = dot.angle + elapsed * dot.speed;
      const flatten = index % 2 ? .52 : .76;
      const x = width * .5 + Math.cos(angle) * scale * dot.radius + pointer.x;
      const y = height * .48 + Math.sin(angle) * scale * dot.radius * flatten + pointer.y;
      context.strokeStyle = index % 3 ? primary : secondary;
      context.lineWidth = .55; context.globalAlpha = .14;
      context.beginPath();
      context.ellipse(width * .5 + pointer.x, height * .48 + pointer.y,
        scale * dot.radius, scale * dot.radius * flatten, 0, angle - .18, angle);
      context.stroke();
      context.globalAlpha = .28 + Math.sin(elapsed * .4 + index) * .08;
      context.fillStyle = context.strokeStyle;
      context.beginPath(); context.arc(x, y, dot.size, 0, Math.PI * 2); context.fill();
    }
    // Pointer/touch sends two soft, expanding rings through the local scene.
    for (let index = ripples.length - 1; index >= 0; index--) {
      const ripple = ripples[index]; ripple.age += delta;
      if (ripple.age > 2.3) { ripples.splice(index, 1); continue; }
      const fade = Math.pow(1 - ripple.age / 2.3, 2);
      for (const delay of [0, .22]) {
        const age = ripple.age - delay;
        if (age < 0) continue;
        context.strokeStyle = delay ? secondary : primary;
        context.lineWidth = delay ? .5 : .75;
        context.globalAlpha = fade * .24;
        context.beginPath(); context.arc(ripple.x, ripple.y, 8 + age * 65, 0, Math.PI * 2); context.stroke();
      }
    }
    context.globalAlpha = 1;
    frame = requestAnimationFrame(draw);
  }
  function suspend() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0; last = 0;
  }
  function resume() {
    if (!disposed && !document.hidden && visible && !media.matches && !frame) frame = requestAnimationFrame(draw);
    else if (document.hidden || !visible || media.matches) suspend();
  }
  function move(event) {
    if (event.pointerType === 'touch') return;
    const rect = scene.getBoundingClientRect();
    pointer.localX = event.clientX - rect.left; pointer.localY = event.clientY - rect.top;
    pointer.targetX = (pointer.localX / width - .5) * 9;
    pointer.targetY = (pointer.localY / height - .5) * 7;
  }
  function leave() {
    pointer.targetX = 0; pointer.targetY = 0;
    pointer.localX = -1000; pointer.localY = -1000;
  }
  function ripple(event) {
    if (media.matches || document.hidden) return;
    const rect = scene.getBoundingClientRect();
    if (ripples.length >= 5) ripples.shift();
    ripples.push({ x: event.clientX - rect.left, y: event.clientY - rect.top, age: 0 });
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(scene);
  const visibilityObserver = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting; resume();
  });
  visibilityObserver.observe(scene);
  scene.addEventListener('pointermove', move, { passive: true });
  scene.addEventListener('pointerleave', leave);
  scene.addEventListener('pointerdown', ripple, { passive: true });
  document.addEventListener('visibilitychange', resume);
  document.addEventListener('appearancechange', updateColors);
  media.addEventListener('change', resume);
  const cardCleanups = [];
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    for (const card of document.querySelectorAll('.post-card')) {
      const trace = event => {
        if (media.matches || document.hidden) return;
        const rect = card.getBoundingClientRect();
        card.style.setProperty('--card-pointer-x', `${(event.clientX - rect.left) / rect.width * 100}%`);
        card.style.setProperty('--card-pointer-y', `${(event.clientY - rect.top) / rect.height * 100}%`);
        card.dataset.tracing = 'true';
      };
      const clear = () => {
        delete card.dataset.tracing;
        card.style.removeProperty('--card-pointer-x'); card.style.removeProperty('--card-pointer-y');
      };
      card.addEventListener('pointermove', trace, { passive: true });
      card.addEventListener('pointerleave', clear);
      cardCleanups.push(() => {
        card.removeEventListener('pointermove', trace); card.removeEventListener('pointerleave', clear); clear();
      });
    }
  }
  updateColors(); resize(); resume();
  return {
    destroy() {
      if (disposed) return;
      disposed = true; suspend();
      for (const cleanup of cardCleanups) cleanup();
      resizeObserver.disconnect(); visibilityObserver.disconnect();
      scene.removeEventListener('pointermove', move); scene.removeEventListener('pointerleave', leave);
      scene.removeEventListener('pointerdown', ripple);
      document.removeEventListener('visibilitychange', resume);
      document.removeEventListener('appearancechange', updateColors);
      media.removeEventListener('change', resume);
      context.clearRect(0, 0, width, height);
    }
  };
}
