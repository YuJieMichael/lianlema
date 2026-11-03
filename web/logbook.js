/* 记录体验：自定义动作、训练模板、单个动作的进步曲线
   依赖 app.js / data.js 的全局：data, save, state, EXERCISES, EX_BY_ID, PARTS, toU, fmtW, wUnit, escapeHtml, startLesson, toast */

/* ---------- 自定义动作 ---------- */
function registerCustom() {
  for (const e of data.customEx || []) {
    if (EX_BY_ID[e.id]) { Object.assign(EX_BY_ID[e.id], e); continue; }
    const ex = { ...e, custom: true };
    EXERCISES.push(ex); EX_BY_ID[ex.id] = ex;
  }
}
const LBUI = { form: false };
const EQ_OPTS = [['gym', '健身房器械'], ['db', '哑铃'], ['none', '无器材']];
const KIND_OPTS = [['w', '负重 × 次数'], ['bw', '自重 · 次数'], ['sec', '计时 · 秒']];
function customForm() {
  if (!LBUI.form) return '';
  const opt = (arr, name, sel) => arr.map(([v, l]) => `<button type="button" class="${v === sel ? 'sel' : ''}" data-act="cf-pick" data-k="${name}" data-v="${v}">${l}</button>`).join('');
  const f = LBUI.f ||= { part: '胸', eq: 'gym', kind: 'w' };
  return `
    <div class="card cform">
      <div class="row between"><b>新建动作</b><button class="icon-btn" data-act="cf-close" aria-label="关闭">✕</button></div>
      <input id="cf-name" class="search" placeholder="动作名称，比如：史密斯卧推" maxlength="20" value="${escapeHtml(f.name || '')}">
      <div class="kicker">部位</div>
      <div class="chips wrap">${PARTS.filter(p => p !== '工位').map(p => `<button type="button" class="chip ${p === f.part ? 'sel' : ''}" data-act="cf-pick" data-k="part" data-v="${p}">${p}</button>`).join('')}</div>
      <div class="kicker">怎么记</div>
      <div class="seg three">${opt(KIND_OPTS, 'kind', f.kind)}</div>
      <div class="kicker">器材</div>
      <div class="seg three">${opt(EQ_OPTS, 'eq', f.eq)}</div>
      <input id="cf-tip" class="search" placeholder="动作要点（可选）" maxlength="60" value="${escapeHtml(f.tip || '')}">
      <button class="btn chunky block" data-act="cf-save">保存动作</button>
    </div>`;
}

/* ---------- 模板 ---------- */
function templatesBlock() {
  const ts = data.templates || [];
  if (!ts.length) return '';
  return `
    <div class="kicker" style="margin:4px 0 8px">我的模板</div>
    <div class="tpls">${ts.map(t => `
      <div class="tpl">
        <b>${escapeHtml(t.name)}</b>
        <span class="muted">${t.ex.filter(id => EX_BY_ID[id]).map(id => EX_BY_ID[id].name).join(' · ')}</span>
        <div class="row" style="gap:6px;margin-top:auto">
          <button class="btn small chunky-s" data-act="tpl-start" data-id="${t.id}">开始</button>
          <button class="btn small ghost" data-act="tpl-del" data-id="${t.id}">删除</button>
        </div>
      </div>`).join('')}</div>`;
}

/* ---------- 单个动作的进步曲线 ---------- */
function exSeries(id) {
  const ex = EX_BY_ID[id];
  const pts = [];
  for (const day of Object.keys(data.logs).sort()) {
    const e = data.logs[day][id];
    if (!e?.done) continue;
    const sets = e.sets.filter(s => Number(s.r) > 0);
    if (!sets.length) continue;
    const weighted = !ex.rl && !ex.cardio && sets.some(s => Number(s.w) > 0);
    // 有负重：估算 1RM（Epley）；自重 / 计时：最好一组的次数或秒数
    const v = weighted
      ? Math.max(...sets.map(s => Number(s.w) * (1 + Number(s.r) / 30)))
      : Math.max(...sets.map(s => Number(s.r)));
    pts.push({ day, v, weighted, sets });
  }
  return pts;
}
function exHistory(id) {
  const pts = exSeries(id);
  if (!pts.length) return '<div class="hist-empty muted">还没练过。练过之后这里会画出你的进步曲线。</div>';
  const ex = EX_BY_ID[id];
  const weighted = pts.some(p => p.weighted);
  const val = v => weighted ? toU(v) : Math.round(v);
  const unit = weighted ? wUnit() : (ex.rl || '次');
  const W = 300, H = 110, pad = 18;
  const vs = pts.map(p => val(p.v));
  const lo = Math.min(...vs), hi = Math.max(...vs), span = hi - lo || 1;
  const xy = vs.map((v, i) => [pad + (pts.length === 1 ? (W - pad * 2) / 2 : i * (W - pad * 2) / (pts.length - 1)), H - pad - (v - lo) / span * (H - pad * 2)]);
  const d = xy.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const first = vs[0], last = vs[vs.length - 1];
  const delta = last - first;
  const fmtSet = s => weighted && Number(s.w) > 0 ? `${toU(s.w)}×${s.r}` : `${s.r}${ex.rl || ''}`;
  return `
    <div class="hist">
      <div class="row between">
        <span class="kicker">${weighted ? `估算 1RM（${unit}）` : `最好一组（${unit}）`}</span>
        <span class="hist-delta ${delta > 0 ? 'up' : ''}">${pts.length > 1 ? `${delta > 0 ? '+' : ''}${Math.round(delta * 10) / 10} ${unit} · ${pts.length} 次` : '第 1 次'}</span>
      </div>
      <svg class="hist-chart" viewBox="0 0 ${W} ${H}">
        <line x1="${pad}" x2="${W - pad}" y1="${H - pad}" y2="${H - pad}" class="hc-axis"/>
        <path d="${d}" class="hc-line"/>
        ${xy.map((p, i) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${i === xy.length - 1 ? 4 : 2.5}" class="hc-dot ${i === xy.length - 1 ? 'last' : ''}"/>`).join('')}
        <text x="${pad}" y="12" class="hc-t">${hi}</text>
        <text x="${pad}" y="${H - 4}" class="hc-t">${pts[0].day.slice(5)}</text>
        <text x="${W - pad}" y="${H - 4}" class="hc-t" text-anchor="end">${pts[pts.length - 1].day.slice(5)}</text>
      </svg>
      <div class="hist-rows">${pts.slice(-4).reverse().map(p => `
        <div class="row between"><span class="muted">${fmtDate(p.day)}</span><span>${p.sets.map(fmtSet).join(' · ')}</span></div>`).join('')}
      </div>
      ${ex.custom ? `<button class="btn small ghost" data-act="cf-del" data-id="${id}">删除这个自定义动作</button>` : ''}
    </div>`;
}

/* ---------- 动作分发 ---------- */
function logAct(act, el) {
  switch (act) {
    case 'cf-open': LBUI.form = true; LBUI.f = null; setTimeout(() => document.getElementById('cf-name')?.focus(), 50); return true;
    case 'cf-close': LBUI.form = false; return true;
    case 'cf-pick':
      LBUI.f.name = document.getElementById('cf-name')?.value || '';
      LBUI.f.tip = document.getElementById('cf-tip')?.value || '';
      LBUI.f[el.dataset.k] = el.dataset.v; return true;
    case 'cf-save': {
      const f = LBUI.f;
      const name = (document.getElementById('cf-name')?.value || '').trim();
      if (!name) { toast('先起个名字'); return 'noop'; }
      const tip = (document.getElementById('cf-tip')?.value || '').trim();
      const e = { id: 'c-' + Date.now().toString(36), name, part: f.part, eq: f.kind === 'w' ? f.eq : (f.eq === 'none' ? 'none' : f.eq),
        bw: f.kind !== 'w', target: f.kind === 'sec' ? 30 : f.kind === 'bw' ? 12 : 10, tip: tip || '自定义动作', joints: [] };
      if (f.kind === 'sec') e.rl = '秒';
      if (f.part === '有氧') { e.cardio = true; e.rl = '分钟'; e.target = 20; }
      (data.customEx ??= []).push(e);
      registerCustom();
      LBUI.form = false;
      state.openEx = e.id; state.part = '全部'; state.query = '';
      toast(`已添加「${name}」`);
      return true;
    }
    case 'cf-del': {
      const id = el.dataset.id;
      data.customEx = (data.customEx || []).filter(e => e.id !== id);
      const i = EXERCISES.findIndex(e => e.id === id);
      if (i >= 0) EXERCISES.splice(i, 1);
      delete EX_BY_ID[id];
      data.templates = (data.templates || []).map(t => ({ ...t, ex: t.ex.filter(x => x !== id) })).filter(t => t.ex.length);
      state.openEx = null;
      toast('已删除（练过的记录保留）');
      return true;
    }
    case 'tpl-save': {
      const ex = state.select || [];
      if (!ex.length) return 'noop';
      const name = ex.slice(0, 2).map(id => EX_BY_ID[id].name).join(' + ') + (ex.length > 2 ? ` 等 ${ex.length} 个` : '');
      (data.templates ??= []).unshift({ id: 't-' + Date.now().toString(36), name, ex: [...ex] });
      state.select = null;
      toast('已存为模板，在动作库顶部');
      return true;
    }
    case 'tpl-start': {
      const t = (data.templates || []).find(x => x.id === el.dataset.id);
      const ex = t?.ex.filter(id => EX_BY_ID[id]);
      if (!ex?.length) return 'noop';
      startLesson(`tpl-${t.id}-${Date.now()}`, ex);
      return 'noop';
    }
    case 'tpl-del':
      data.templates = (data.templates || []).filter(x => x.id !== el.dataset.id);
      return true;
  }
  return false;
}
