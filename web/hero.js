/* 角色页（人物 + 属性 + 图鉴）与天赋树页。依赖 app.js 与 talents.js 的全局 */

const TITLES = [[1, '新手'], [3, '学徒'], [6, '练习生'], [10, '行者'], [15, '铁人'], [22, '宗师'], [30, '传说']];
const heroTitle = lv => TITLES.filter(t => lv >= t[0]).pop()[1];

/* ---------- 属性：天赋点 + 实际练过的组数 ---------- */
function heroStats() {
  const sets = {}; let days = 0, water = 0;
  for (const log of Object.values(data.logs)) {
    let any = false;
    for (const [id, ex] of Object.entries(log)) {
      if (!ex.done || !EX_BY_ID[id]) continue;
      any = true;
      const b = EX_BY_ID[id].cardio ? 'endu' : branchOfPart(partOf(id));
      if (b) sets[b] = (sets[b] || 0) + ex.sets.length;
    }
    if (any) days++;
  }
  for (const v of Object.values(data.water || {})) water += v.length;
  const pts = {};
  for (const id of data.talents || []) { const b = TNODES[id]?.branch; if (b) pts[b] = (pts[b] || 0) + (TNODES[id].type === 'small' ? 1 : 3); }
  return BRANCHES.map(b => {
    const train = b.key === 'disc' ? days * 2 + Math.floor(water / 8) + streak() * 2 : (sets[b.key] || 0);
    const v = Math.round(Math.sqrt(train) * 3 + (pts[b.key] || 0) * 2);
    return { ...b, v };
  });
}

/* ---------- 人物：随属性变壮，随等级加装备（单线画） ---------- */
function heroFigure(stats, lv) {
  const g = k => Math.min(1, (stats.find(s => s.key === k)?.v || 0) / 60);
  const sh = 21 + g('push') * 13;          // 肩宽：练推
  const arm = 7 + g('pull') * 6;           // 手臂：练拉
  const leg = 10 + g('legs') * 7;          // 腿：练腿
  const waist = 15 - g('core') * 3;        // 腰：练核心更紧
  const L = 100 - sh, R = 100 + sh;
  const eqBack = lv >= 15 ? `<path d="M${L + 4} 64 Q${L - 22} 130 ${L - 10} 176 L${R + 10} 176 Q${R + 22} 130 ${R - 4} 64 Z" fill="var(--accent-soft)"/>` : '';
  const eq = [];
  if (lv >= 3) eq.push('<path d="M86 31 q14 -5 28 0" stroke="var(--accent)" stroke-width="4"/>');
  if (lv >= 6) eq.push(`<path d="M${L - 9} 112 l8 1 M${R + 9} 112 l-8 1" stroke="var(--accent)" stroke-width="${arm + 1}" stroke-linecap="butt"/>`);
  if (lv >= 10) eq.push(`<rect x="${100 - waist - 3}" y="106" width="${waist * 2 + 6}" height="8" rx="2" fill="var(--card-2)"/><rect x="96" y="106" width="8" height="8" rx="1.5" fill="var(--accent)"/>`);
  if (lv >= 22) eq.push('<path d="M87 21 l4 -10 l9 7 l9 -7 l4 10 z" fill="var(--accent)"/>');
  return `
    <svg class="hero-fig" viewBox="0 0 200 210" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <ellipse cx="100" cy="196" rx="${46 + sh / 3}" ry="5" fill="var(--text)" opacity=".1"/>
      ${eqBack}
      <g stroke="var(--text)">
        <path d="M${100 - waist + 5} 128 L${100 - 15} 160 L${100 - 16} 190" stroke-width="${leg}"/>
        <path d="M${100 + waist - 5} 128 L${100 + 15} 160 L${100 + 16} 190" stroke-width="${leg}"/>
        <path d="M${L} 68 L${L - 8} 96 L${L - 4} 122" stroke-width="${arm}"/>
        <path d="M${R} 68 L${R + 8} 96 L${R + 4} 122" stroke-width="${arm}"/>
      </g>
      <path d="M${100 - 22} 194 h12 M${100 + 10} 194 h12" stroke="var(--text)" stroke-width="5"/>
      <path d="M${100 - waist - 1} 110 L${100 - waist - 7} 138 L98 138 L100 128 L102 138 L${100 + waist + 7} 138 L${100 + waist + 1} 110 Z" fill="var(--text)"/>
      <path d="M${L} 64 Q100 55 ${R} 64 Q${R - 2} 88 ${100 + waist} 112 L${100 - waist} 112 Q${L + 2} 88 ${L} 64 Z" fill="var(--accent)"/>
      <path d="M${L + 7} 63 Q100 82 ${R - 7} 63" fill="var(--card)" opacity=".9"/>
      <rect x="95" y="48" width="10" height="12" rx="4" fill="var(--text)"/>
      <circle cx="100" cy="36" r="15" fill="var(--text)"/>
      <circle cx="94.5" cy="37" r="1.6" fill="var(--bg)"/><circle cx="105.5" cy="37" r="1.6" fill="var(--bg)"/>
      <path d="M95.5 43 q4.5 3 9 0" stroke="var(--bg)" stroke-width="1.6"/>
      ${eq.join('')}
    </svg>`;
}

/* ---------- 六边形属性图 ---------- */
function radar(stats) {
  const R = 74, max = Math.max(40, ...stats.map(s => s.v));
  const pt = (i, r) => { const a = (BRANCHES[i].ang) * Math.PI / 180; return [Math.cos(a) * r, Math.sin(a) * r]; };
  const ring = f => stats.map((_, i) => pt(i, R * f).join(',')).join(' ');
  const poly = stats.map((s, i) => pt(i, R * Math.max(.06, s.v / max)).join(',')).join(' ');
  return `
    <svg class="radar" viewBox="-120 -110 240 220">
      ${[.33, .66, 1].map(f => `<polygon points="${ring(f)}" class="rg"/>`).join('')}
      ${stats.map((_, i) => `<line x1="0" y1="0" x2="${pt(i, R)[0]}" y2="${pt(i, R)[1]}" class="rg"/>`).join('')}
      <polygon points="${poly}" class="rv-poly"/>
      ${stats.map((s, i) => { const [x, y] = pt(i, R + 20); return `<text x="${x}" y="${y}" class="rl">${s.name}<tspan class="rn" x="${x}" dy="13">${s.v}</tspan></text>`; }).join('')}
    </svg>`;
}

/* ---------- 图鉴：动作卡按练过的次数升级，试炼和基石是特殊卡 ---------- */
const RARITY = [[40, 'leg', '传说'], [15, 'epic', '史诗'], [5, 'rare', '稀有'], [1, 'com', '普通']];
function cardList() {
  const cnt = {};
  for (const log of Object.values(data.logs)) for (const [id, ex] of Object.entries(log)) if (ex.done) cnt[id] = (cnt[id] || 0) + 1;
  const ex = EXERCISES.map(e => {
    const n = cnt[e.id] || 0;
    const r = RARITY.find(x => n >= x[0]);
    return { kind: 'ex', id: e.id, name: e.name, part: e.part === '工位' ? '工位' : e.part, n, rar: r?.[1], rarName: r?.[2],
      next: RARITY.slice().reverse().find(x => x[0] > n), pr: data.pr[e.id] };
  });
  const sp = Object.values(TNODES).filter(t => t.type === 'trial' || t.type === 'key').map(t => ({
    kind: t.type, id: t.id, name: t.name.replace('试炼 · ', ''), part: t.type === 'key' ? '基石' : '试炼',
    got: (data.talents || []).includes(t.id), rar: t.type === 'key' ? 'leg' : 'epic',
  }));
  return { ex, sp };
}
function cardHtml(c) {
  const got = c.kind === 'ex' ? c.n > 0 : c.got;
  if (!got) return `<div class="tcard locked"><span class="tc-part">${c.part}</span><b>？</b><span class="tc-sub">${c.kind === 'ex' ? '练一次解锁' : c.kind === 'key' ? '点亮基石' : '通过试炼'}</span></div>`;
  const sub = c.kind === 'ex'
    ? (c.pr ? prLabel(c.id, c.pr) : `${c.n} 次`) : (c.kind === 'key' ? '基石' : '试炼通过');
  const bar = c.kind === 'ex' && c.next ? `<i class="tc-bar"><i style="width:${Math.min(100, c.n / c.next[0] * 100)}%"></i></i>` : '';
  return `<div class="tcard ${c.rar}"><span class="tc-part">${c.part}<em>${c.rarName || ''}</em></span><b>${c.name}</b><span class="tc-sub">${sub}</span>${bar}</div>`;
}

/* ---------- 角色页 ---------- */
const heroUI = { filter: 'all' };
function renderHero() {
  const li = levelInfo();
  const stats = heroStats();
  const free = talentFree();
  const { ex, sp } = cardList();
  const gotN = ex.filter(c => c.n).length + sp.filter(c => c.got).length;
  const parts = ['all', ...new Set(ex.map(c => c.part))];
  const shown = (heroUI.filter === 'all' ? ex : ex.filter(c => c.part === heroUI.filter)).slice().sort((a, b) => b.n - a.n);
  const spSorted = sp.slice().sort((a, b) => b.got - a.got);
  return `
    <section class="hero-card card">
      <div class="hero-top">
        <div>
          <span class="kicker">${heroTitle(li.lv)}</span>
          <b class="hero-name">${escapeHtml(data.profile?.name || '你')}</b>
          <div class="xpbar"><i style="width:${li.pct * 100}%"></i></div>
          <span class="muted">${li.into} / ${li.need} XP 升到 Lv ${li.lv + 1}</span>
        </div>
        <span class="plate" aria-label="等级 ${li.lv}"><span>${li.lv}</span></span>
      </div>
      <div class="hero-body">
        ${heroFigure(stats, li.lv)}
        ${radar(stats)}
      </div>
      <div class="muted cloud-line"><span data-cloud class="cloud-st ${Cloud.state}">${cloudLabel()}</span></div>
      <button class="btn chunky block" data-act="open-tree">天赋树${free > 0 ? ` · <span class="pts">${free}</span> 点可用` : ''}</button>
      <div class="gear-row">${[[3, '头带'], [6, '护腕'], [10, '腰带'], [15, '披风'], [22, '冠']].map(([l, n]) =>
        `<span class="${li.lv >= l ? 'got' : ''}">${n}<small>Lv ${l}</small></span>`).join('')}</div>
    </section>

    ${heroLinks()}
    <div class="row between section-title"><span>图鉴</span><span class="muted">${gotN} / ${ex.length + sp.length}</span></div>
    <div class="chips">${parts.map(p => `<button class="chip ${heroUI.filter === p ? 'sel' : ''}" data-act="card-filter" data-p="${p}">${p === 'all' ? '全部' : p}</button>`).join('')}</div>
    <div class="tcards">${shown.map(cardHtml).join('')}</div>
    <div class="kicker" style="margin:22px 0 10px">试炼与基石</div>
    <div class="tcards special">${spSorted.map(cardHtml).join('')}</div>
    <p class="muted rar-note">同一个动作练 1 / 5 / 15 / 40 次，卡片升为 普通 / 稀有 / 史诗 / 传说。</p>`;
}

/* ---------- 天赋树页 ---------- */
const TV = { x: 0, y: 0, k: null, sel: null };
function renderTree() {
  const set = talentSet();
  const st = Object.fromEntries(Object.keys(TNODES).map(id => [id, nodeState(id, set)]));
  const li = levelInfo();
  const edges = TEDGES.map(([a, b]) => {
    const A = TNODES[a], B = TNODES[b];
    const cls = set.has(a) && set.has(b) ? 'on' : (set.has(a) || set.has(b)) ? 'near' : '';
    return `<line x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}" class="te ${cls}"/>`;
  }).join('');
  const R = { root: 20, small: 9, notable: 16, trial: 16, key: 24 };
  const nodes = Object.values(TNODES).map(n => {
    const r = R[n.type];
    const shape = n.type === 'key'
      ? `<polygon points="${[0, 1, 2, 3, 4, 5, 6, 7].map(i => { const a = i * Math.PI / 4 + Math.PI / 8; return `${Math.cos(a) * r},${Math.sin(a) * r}`; }).join(' ')}" class="tn-s"/>`
      : `<circle r="${r}" class="tn-s"/>${n.type !== 'small' && n.type !== 'root' ? `<circle r="${r - 5}" class="tn-in"/>` : ''}`;
    const label = n.type !== 'small' ? `<text y="${r + 15}" class="tn-l">${n.type === 'root' ? '' : n.name.replace('试炼 · ', '')}</text>` : '';
    const icon = st[n.id] === 'sealed' ? `<path d="M-4 0 h8 v6 h-8z M-2.5 0 v-2.5 a2.5 2.5 0 0 1 5 0 V0" class="tn-lock"/>` : '';
    return `<g class="tn ${n.type} ${st[n.id]} ${TV.sel === n.id ? 'sel' : ''}" transform="translate(${n.x.toFixed(1)} ${n.y.toFixed(1)})" data-act="tnode" data-id="${n.id}">
      <circle r="${r + 10}" class="tn-hit"/>${shape}${icon}${label}</g>`;
  }).join('');
  const zones = BRANCHES.map(b => { const a = b.ang * Math.PI / 180; return `<text x="${Math.cos(a) * 590}" y="${Math.sin(a) * 590}" class="tz">${b.full}</text>`; }).join('');
  return `
    <div class="tree-head">
      <button class="icon-btn" data-act="tree-back" aria-label="返回">←</button>
      <div><span class="kicker">Lv ${li.lv} · 已点 ${talentUsed()} / ${talentPts()}</span><b>${talentFree()} 点可用</b></div>
      <button class="btn small" data-act="tree-fit">复位</button>
    </div>
    <div class="tree-wrap" id="tree-wrap">
      <svg id="tree-svg" class="tree-svg"><g id="tree-g">
        <circle r="560" class="tz-ring"/><circle r="350" class="tz-ring"/>
        ${zones}${edges}${nodes}
      </g></svg>
      <div class="tree-legend"><span><i class="lg on"></i>已点亮</span><span><i class="lg open"></i>可点亮</span><span><i class="lg sealed"></i>需试炼</span></div>
    </div>
    ${TV.sel ? treeSheet(TV.sel, st[TV.sel]) : ''}`;
}
function treeSheet(id, s) {
  const n = TNODES[id];
  const typeName = { root: '起点', small: '小天赋', notable: '核心天赋', trial: '试炼天赋', key: '基石' }[n.type];
  const req = n.req ? `<div class="ts-req ${reqMet(n.req) ? 'ok' : ''}">${reqMet(n.req) ? '✓ 试炼已通过' : '试炼'}：${typeof n.req.text === 'function' ? n.req.text() : n.req.text}</div>` : '';
  let btn = '';
  if (s === 'on' && id !== 'root') btn = canRefund(id) ? '<button class="btn block" data-act="trefund">取消点亮（返还 1 点）</button>' : '<div class="muted">外圈还连着别的已点节点，先取消外面的。</div>';
  else if (s === 'open') btn = '<button class="btn chunky block" data-act="talloc">点亮 · 花 1 点</button>';
  else if (s === 'near') btn = '<div class="muted">天赋点不够。练一练升级就有了。</div>';
  else if (s === 'sealed') btn = '<div class="muted">先完成上面的试炼，在训练里真的做到就会自动解锁。</div>';
  else if (s === 'far') btn = '<div class="muted">要先点亮和它相连的节点。</div>';
  return `
    <div class="tree-sheet">
      <div class="row between"><span class="kicker">${typeName}</span><button class="icon-btn" data-act="tsheet-close" aria-label="关闭">✕</button></div>
      <b class="ts-name">${n.name}</b>
      <p class="ts-desc">${n.desc}</p>
      ${req}
      ${btn}
    </div>`;
}

/* 平移 / 缩放：拖动、滚轮、双指 */
function treeApply() {
  const g = document.getElementById('tree-g'); if (!g) return;
  g.setAttribute('transform', `translate(${TV.x} ${TV.y}) scale(${TV.k})`);
}
function treeFit(force) {
  const w = document.getElementById('tree-wrap'); if (!w) return;
  const W = w.clientWidth, H = w.clientHeight;
  if (force || TV.k == null) { TV.k = Math.min(W, H) / 600; TV.x = W / 2; TV.y = H / 2; }
  treeApply();
}
let treeDrag = null, treeMoved = false;
function treeMount() {
  const w = document.getElementById('tree-wrap'); if (!w || w.dataset.m) return;
  w.dataset.m = 1;
  treeFit();
  const pts = new Map();
  w.addEventListener('pointerdown', e => {
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    treeMoved = false;
    treeDrag = { x: TV.x, y: TV.y, k: TV.k, sx: e.clientX, sy: e.clientY, d: null };
    if (pts.size === 2) { const [a, b] = [...pts.values()]; treeDrag.d = Math.hypot(a.x - b.x, a.y - b.y); treeDrag.cx = (a.x + b.x) / 2; treeDrag.cy = (a.y + b.y) / 2; }
  });
  w.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId) || !treeDrag) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2 && treeDrag.d) {
      const [a, b] = [...pts.values()];
      const k = Math.max(.25, Math.min(3, treeDrag.k * Math.hypot(a.x - b.x, a.y - b.y) / treeDrag.d));
      const r = w.getBoundingClientRect(), cx = treeDrag.cx - r.left, cy = treeDrag.cy - r.top;
      TV.x = cx - (cx - treeDrag.x) * k / treeDrag.k; TV.y = cy - (cy - treeDrag.y) * k / treeDrag.k; TV.k = k;
      treeMoved = true;
    } else {
      const dx = e.clientX - treeDrag.sx, dy = e.clientY - treeDrag.sy;
      if (Math.abs(dx) + Math.abs(dy) > 6) { treeMoved = true; w.setPointerCapture?.(e.pointerId); }
      if (treeMoved) { TV.x = treeDrag.x + dx; TV.y = treeDrag.y + dy; }
    }
    treeApply();
  });
  const up = e => { pts.delete(e.pointerId); if (!pts.size) treeDrag = null; else { const [p] = [...pts.values()]; treeDrag = { x: TV.x, y: TV.y, k: TV.k, sx: p.x, sy: p.y }; } };
  w.addEventListener('pointerup', up); w.addEventListener('pointercancel', up);
  // 拖动结束时不要触发点节点
  w.addEventListener('click', e => { if (treeMoved) { e.stopPropagation(); e.preventDefault(); treeMoved = false; } }, true);
  w.addEventListener('wheel', e => {
    e.preventDefault();
    const r = w.getBoundingClientRect(), cx = e.clientX - r.left, cy = e.clientY - r.top;
    const k = Math.max(.25, Math.min(3, TV.k * Math.exp(-e.deltaY * .0015)));
    TV.x = cx - (cx - TV.x) * k / TV.k; TV.y = cy - (cy - TV.y) * k / TV.k; TV.k = k;
    treeApply();
  }, { passive: false });
}
// 把选中的节点平滑移到可见区域
function treeFocus(id) {
  const w = document.getElementById('tree-wrap'); const n = TNODES[id]; if (!w || !n) return;
  const tx = w.clientWidth / 2 - n.x * TV.k, ty = w.clientHeight * .38 - n.y * TV.k;
  const sx = TV.x, sy = TV.y, t0 = performance.now();
  const step = t => { const p = Math.min(1, (t - t0) / 320), e = 1 - Math.pow(1 - p, 3);
    TV.x = sx + (tx - sx) * e; TV.y = sy + (ty - sy) * e; treeApply(); if (p < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
function treeBurst(id) {
  const g = document.querySelector(`.tn[data-id="${id}"]`); if (!g) return;
  const NS = 'http://www.w3.org/2000/svg';
  for (let i = 0; i < 2; i++) {
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('r', 10); c.setAttribute('class', 'tn-wave'); c.style.animationDelay = i * .15 + 's';
    g.appendChild(c); setTimeout(() => c.remove(), 1100);
  }
}

/* 动作分发：app.js 的 view 点击 switch 落到 default 时调这里，返回 true 表示已处理 */
function heroAct(act, el) {
  switch (act) {
    case 'open-tree': state.tab = 'tree'; TV.sel = null; return true;
    case 'tree-back': state.tab = 'hero'; return true;
    case 'tree-fit': treeFit(true); return 'noop';
    case 'tnode': TV.sel = el.dataset.id; setTimeout(() => treeFocus(TV.sel), 0); return true;
    case 'tsheet-close': TV.sel = null; return true;
    case 'talloc': {
      const id = TV.sel;
      if (allocTalent(id)) { toast(`点亮「${TNODES[id].name}」`); setTimeout(() => treeBurst(id), 30); }
      return true;
    }
    case 'trefund': if (refundTalent(TV.sel)) toast('已返还 1 点'); return true;
    case 'card-filter': heroUI.filter = el.dataset.p; return true;
  }
  return false;
}

/* 「我」页：打卡相册 + 统计 / 身体 / 设置入口 */
function heroLinks() {
  const ps = (data.photos || []);
  const tiles = ps.slice(0, 5).map(p => {
    const url = typeof PHOTOS !== 'undefined' && PHOTOS.get(p.id);
    return `<button class="ph-tile" data-act="photo-open" data-id="${p.id}" aria-label="打卡 ${p.d}">${url ? `<img src="${url}" alt="">` : ''}<span>${p.d.slice(5).replace('-', '/')}</span></button>`;
  }).join('');
  const rows = [['stats', '训练统计', `累计 ${totalXp()} XP · 连续 ${streak()} 天`], ['body', '身体数据', '体重、体脂、基础代谢'], ['settings', '设置', '云存档、重量单位、发力感自检']];
  return `
    <div class="row between section-title"><span>我的打卡</span><span class="muted">${ps.length} 条</span></div>
    <div class="ph-grid">
      <button class="ph-tile add" data-photo-add aria-label="发打卡"><span>＋</span><b>拍一张</b></button>
      ${tiles}
    </div>
    <div class="me-links">${rows.map(([t, n, sub]) => `
      <button class="me-link" data-act="go-tab" data-id="${t}"><b>${n}</b><span>${sub}</span><i>›</i></button>`).join('')}
    </div>`;
}
