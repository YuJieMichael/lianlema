/* 动效层：滚动浮现、闯关连线、顶栏收缩、完成时的墨点迸发。只读 DOM，不碰业务数据 */
(function () {
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const NS = 'http://www.w3.org/2000/svg';

  /* 1. 滚动浮现：首屏以下的块，滑到时再淡入上浮 */
  const io = 'IntersectionObserver' in window && !RM ? new IntersectionObserver(es => {
    es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -8% 0px' }) : null;
  function reveal(root) {
    if (!io) return;
    root.querySelectorAll('.card, .unit, .kpi, .section-title, .track-card').forEach(el => {
      if (el.dataset.rv) return;
      el.dataset.rv = 1;
      if (el.getBoundingClientRect().top < innerHeight * .92) return; // 首屏不打扰
      el.classList.add('rv');
      io.observe(el);
    });
  }

  /* 2. 闯关路线：用一条曲线把关卡串起来，已完成段是实线 */
  function link(nodes) {
    const btns = [...nodes.querySelectorAll('.node')];
    if (btns.length < 2) return;
    const box = nodes.getBoundingClientRect();
    const pts = btns.map(b => {
      const r = b.getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2 - box.left), y: Math.round(r.top + r.height / 2 - box.top), done: b.classList.contains('done') || b.classList.contains('current') };
    });
    const sig = JSON.stringify(pts);
    const old = nodes.querySelector(':scope > svg.trail');
    if (old && old.dataset.sig === sig) return; // 没变就不重画，避免自触发
    old?.remove();
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'trail'); svg.dataset.sig = sig;
    svg.setAttribute('width', box.width); svg.setAttribute('height', box.height);
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], my = (a.y + b.y) / 2;
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', `M${a.x} ${a.y} C${a.x} ${my} ${b.x} ${my} ${b.x} ${b.y}`);
      p.setAttribute('class', b.done ? 'on' : '');
      svg.appendChild(p);
    }
    nodes.prepend(svg);
  }
  function linkAll() { document.querySelectorAll('#view .nodes').forEach(link); }

  /* 3. 墨点迸发：关卡完成页出现时 */
  function burst(host) {
    if (RM || host.dataset.burst) return;
    host.dataset.burst = 1;
    const wrap = document.createElement('div');
    wrap.className = 'burst';
    for (let i = 0; i < 26; i++) {
      const s = document.createElement('i');
      const a = (i / 26) * Math.PI * 2 + Math.random() * .3;
      const d = 70 + Math.random() * 70;
      s.style.cssText = `--x:${Math.cos(a) * d}px;--y:${Math.sin(a) * d}px;--r:${a}rad;--d:${Math.random() * .15}s;` +
        (i % 4 === 0 ? 'background:var(--accent)' : '');
      wrap.appendChild(s);
    }
    host.style.position = 'relative';
    host.appendChild(wrap);
    setTimeout(() => wrap.remove(), 1600);
  }

  /* 4. 今日目标环：进入时从 0 画到当前 */
  function rings(root) {
    root.querySelectorAll('.goal-ring .fg:not([data-drawn])').forEach(c => {
      c.dataset.drawn = 1;
      if (RM) return;
      const to = c.getAttribute('stroke-dashoffset');
      c.style.transition = 'none';
      c.setAttribute('stroke-dashoffset', c.style.getPropertyValue('--c'));
      requestAnimationFrame(() => requestAnimationFrame(() => {
        c.style.transition = 'stroke-dashoffset 1.1s cubic-bezier(.2,.7,.2,1)';
        c.setAttribute('stroke-dashoffset', to);
      }));
    });
  }

  let q = false;
  function tick() {
    q = false;
    const v = document.getElementById('view');
    if (v) { reveal(v); rings(v); }
    linkAll();
    document.querySelectorAll('.done-mascot').forEach(burst);
  }
  function boot() {
    new MutationObserver(() => { if (!q) { q = true; requestAnimationFrame(tick); } })
      .observe(document.body, { childList: true, subtree: true });
    tick();
    // 关卡节点有 translateX，等字体与布局稳定后再连一次
    setTimeout(linkAll, 400);
  }
  addEventListener('resize', () => requestAnimationFrame(linkAll));

  /* 5. 顶栏：往下滑时标题收小，出现一道发丝线 */
  addEventListener('scroll', () => document.body.classList.toggle('scrolled', scrollY > 24), { passive: true });

  /* 6. 按下的微反馈：触点处一圈淡墨 */
  if (!RM) addEventListener('pointerdown', e => {
    const b = e.target.closest('.btn, .opt, .track-card, .chip');
    if (!b) return;
    const r = b.getBoundingClientRect();
    const dot = document.createElement('span');
    dot.className = 'ink';
    dot.style.left = e.clientX - r.left + 'px'; dot.style.top = e.clientY - r.top + 'px';
    if (getComputedStyle(b).position === 'static') b.style.position = 'relative';
    b.style.overflow = 'hidden';
    b.appendChild(dot);
    setTimeout(() => dot.remove(), 600);
  }, { passive: true });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
