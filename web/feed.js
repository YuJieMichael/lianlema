/* 瀑布流版式：今日 / 发现 / 公会 / 我，加上底部弹层和动作详情
   依赖 app.js 等全局（运行时才用到）：data, state, save, render, toast, EXERCISES, EX_BY_ID, DEMOS, FEEL, OFFICE_OK, ... */

const FD = { tab: 'rec', meTab: 'role' };
const FEED_TABS = [['rec', '推荐'], ['office', '办公室'], ['muscle', '增肌'], ['stretch', '拉伸'], ['fav', '收藏']];
const PART_TONE = { 胸: 'peach', 背: 'sky', 腿: 'mint', 肩: 'lilac', 手臂: 'butter', 核心: 'rose', 有氧: 'sky', 拉伸: 'mint', 工位: 'butter' };
const toneOf = id => { const e = EX_BY_ID[id]; return e ? (PART_TONE[mgOf(e)] || PART_TONE[e.part] || 'peach') : 'peach'; };
const isFav = id => (data.fav || []).includes(id);
const HEART = on => `<svg class="hrt" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z" ${on ? 'class="on"' : ''}/></svg>`;

/* ---------- 封面 ---------- */
function cover(exId, { ratio = '3/4', big = '', tag = '', tone, k = 0.62 } = {}) {
  return `<div class="cover t-${tone || toneOf(exId)}" style="aspect-ratio:${ratio}">
    ${exId && DEMOS[exId] ? `<div class="cover-fig">${illoSvg(exId, k, DEMOS_FRONT[exId] && hashStr(exId) % 2 ? 'front' : 'side')}</div>` : ''}
    ${tag ? `<span class="cover-tag">${tag}</span>` : ''}
    ${big ? `<b class="cover-big">${big}</b>` : ''}
  </div>`;
}
const avatarMascot = () => `<span class="fc-av">${mascot(18)}</span>`;

// 一张瀑布流卡片
function fcard({ act, id = '', cov, title, au = '小铁', av, like, likeAct = '', likeId = '', ratio = 1.33, extra = '' }) {
  return {
    h: ratio + .42,
    html: `<article class="fcard" data-act="${act}" data-id="${id}" tabindex="0">
      ${cov}
      <div class="fc-body">
        <h3 class="fc-title">${title}</h3>
        ${extra}
        <div class="fc-meta">
          <span class="fc-au">${av || avatarMascot()}<span>${au}</span></span>
          ${like != null ? `<button class="fc-like" ${likeAct ? `data-act="${likeAct}" data-id="${likeId}"` : 'tabindex="-1"'} aria-label="收藏">${HEART(likeAct && isFav(likeId))}<span>${like}</span></button>` : ''}
        </div>
      </div>
    </article>`,
  };
}
// 两列瀑布：每张卡放进当前更矮的那一列
function waterfall(cards) {
  const cols = [[], []], h = [0, 0];
  cards.forEach(c => { const i = h[0] <= h[1] ? 0 : 1; cols[i].push(c.html); h[i] += c.h; });
  return `<div class="wf">${cols.map(c => `<div class="wf-col">${c.join('')}</div>`).join('')}</div>`;
}

/* ---------- 卡片素材 ---------- */
function timesDone(id) { let n = 0; for (const log of Object.values(data.logs)) if (log[id]?.done) n++; return n; }
function exCard(id, i = 0) {
  const e = EX_BY_ID[id];
  const ratios = ['3/4', '1/1', '4/5'], rv = [1.33, 1, 1.25];
  const r = i % 3;
  const tag = OFFICE_OK.has(id) ? '办公室可做' : e.eq === 'none' ? '徒手' : e.eq === 'db' ? '哑铃' : '器械';
  const [pri] = musclesOf(id);
  return fcard({
    act: 'ex-open', id, ratio: rv[r],
    cov: cover(id, { ratio: ratios[r], big: e.name }),
    title: `${pri.length ? `练${pri.slice(0, 2).map(m => MUSCLE_NAME[m].split(' ')[0]).join('、')}｜` : ''}${(e.tip || '').split(/[，。]/)[0]}`,
    au: `${mgOf(e)} · ${tag}`, av: `<span class="fc-av dot t-${toneOf(id)}"></span>`,
    like: timesDone(id) || '', likeAct: 'fav', likeId: id,
  });
}
function lessonCards(filter) {
  const list = lessons(), cur = currentLessonIdx(list);
  const pick = list.filter((l, i) => i >= cur && (!filter || l.ex.every(filter))).slice(0, 3);
  return pick.map((l, j) => {
    const u = units()[l.unit];
    const name = u.title.split(' · ')[1] || u.title;
    return fcard({
      act: 'start', id: l.id, ratio: j ? 1 : 1.33,
      cov: cover(l.ex[0], { ratio: j ? '1/1' : '3/4', big: `${name}<br><small>第 ${l.idx + 1} 节</small>`, tag: list.indexOf(l) === cur ? '下一节' : '课程' }),
      title: l.ex.map(id => EX_BY_ID[id]?.name).filter(Boolean).join(' + '),
      au: '小铁课程', like: data.done[l.id] || '',
    });
  });
}
function coachCard() {
  const s = streak(), xp = todayXp(), goal = track().goal;
  const msg = trained(dateKey()) ? (xp >= goal ? '今日目标达成，明天见！' : `再拿 ${goal - xp} XP 就完成今日目标`)
    : s ? `连续 ${s} 天了，今天别断！` : '今天还没练，来一组吧！';
  return fcard({
    act: CO.avail ? 'coach-open' : 'noop', ratio: 1,
    cov: `<div class="cover t-rose" style="aspect-ratio:1/1"><div class="cover-mascot">${mascot(88)}</div><b class="cover-big">小铁说</b></div>`,
    title: msg + (CO.avail ? '　有问题直接问我 →' : ''), au: '小铁',
  });
}
function waterFeedCard() {
  const goal = waterGoalMl(), drunk = waterToday(), pct = Math.min(1, drunk / goal);
  return fcard({
    act: 'water', ratio: .8,
    cov: `<div class="cover t-sky water-cov" style="aspect-ratio:5/4"><i style="height:${pct * 100}%"></i><b class="cover-big">${liters(drunk)} / ${liters(goal)} 升</b><span class="cover-tag">点一下 +${data.waterUnit.ml}ml</span></div>`,
    title: `今天喝水 ${Math.round(pct * 100)}%`, au: '喝水',
    av: '<span class="fc-av dot t-sky"></span>',
  });
}
function talentCard() {
  const free = talentFree(); if (free <= 0) return null;
  const li = levelInfo();
  return fcard({
    act: 'open-tree', ratio: 1,
    cov: `<div class="cover t-lilac" style="aspect-ratio:1/1"><span class="plate big"><span>${li.lv}</span></span><b class="cover-big">${free} 点天赋<br>可以点亮</b></div>`,
    title: '升级了！去天赋树挑一个加成', au: '天赋树', av: '<span class="fc-av dot t-lilac"></span>',
  });
}
function guildCards() {
  if (!data.guild || !GU.members.length) return [];
  const today = dateKey();
  return GU.members.filter(m => m.id !== GU.me).slice(0, 3).map(m => {
    const name = GU.names[m.id] || '队友';
    const done = m.lastDay === today;
    return fcard({
      act: 'go-guild', ratio: .9,
      cov: `<div class="cover t-mint" style="aspect-ratio:10/9"><span class="g-ava">${escapeHtml(name.slice(0, 1))}</span><span class="cover-tag">${done ? '今天已练' : '今天还没练'}</span></div>`,
      title: `${escapeHtml(name)} ${done ? '今天练完了，' : ''}本周 ${memberWeek(m, mondayKey())} XP`,
      au: escapeHtml(GU.info?.name || '公会'), av: `<span class="fc-av dot t-mint"></span>`,
    });
  });
}
function prCards() {
  const week = dateKey(addDays(new Date(), -7));
  return Object.entries(data.pr).filter(([id, p]) => EX_BY_ID[id] && p.date && p.date >= week).slice(0, 2).map(([id, p]) => fcard({
    act: 'ex-open', id, ratio: 1,
    cov: cover(id, { ratio: '1/1', big: `新纪录<br><small>${prLabel(id, p)}</small>`, tag: '个人纪录' }),
    title: `${EX_BY_ID[id].name}破纪录了`, au: '我的纪录', av: '<span class="fc-av dot t-butter"></span>',
  }));
}
function remindFeedCard() {
  if (!sedentary() || data.remind.on) return null;
  return fcard({
    act: 'sheet', id: 'remind', ratio: .9,
    cov: `<div class="cover t-butter" style="aspect-ratio:10/9"><b class="cover-big">坐了一小时<br>起来动 3 分钟</b><span class="cover-tag">久坐提醒</span></div>`,
    title: '打开久坐提醒，工作时间每小时叫你一次', au: '提醒', av: '<span class="fc-av dot t-butter"></span>',
  });
}

/* ---------- 今日 ---------- */
function exPool(tab) {
  const ok = EXERCISES.filter(e => !conflicts(e).length);
  const by = {
    rec: ok.filter(e => eqOk(e)),
    office: ok.filter(e => OFFICE_OK.has(e.id)),
    muscle: ok.filter(e => ['胸', '背', '腿', '肩', '手臂'].includes(mgOf(e)) && (profile().equip === 'gym' || e.eq !== 'gym')),
    stretch: ok.filter(e => mgOf(e) === '拉伸' || mgOf(e) === '核心'),
    fav: ok.filter(e => isFav(e.id)),
  }[tab] || ok;
  return shuffle(by, mulberry32(hashStr(dateKey() + tab)));
}
function todayHero() {
  const r = todayPlan();
  const strength = r.ex.filter(id => !EX_BY_ID[id].cardio);
  const xp = strength.length * setsPerEx() * XP_SET + (r.cardio ? cardioXp(r.cardio.min) : 0) + XP_LESSON;
  const li = levelInfo(), s = streak(), tx = todayXp(), goal = track().goal;
  const now = new Date();
  const first = r.ex.find(id => DEMOS[id]);
  return `
    <section class="today-hero t-${toneOf(first)}">
      <div class="th-top">
        <span class="th-date">${now.getMonth() + 1}月${now.getDate()}日 · 星期${'日一二三四五六'[now.getDay()]}</span>
        <button class="th-where" data-act="where" data-v="${atOffice() ? 'home' : 'office'}">${atOffice() ? '在公司' : '在家 / 健身房'} ⇄</button>
      </div>
      <div class="th-main">
        <div class="th-text">
          <h2>${r.coach ? '小铁的安排' : '今日计划'}</h2>
          <p>${r.coach ? escapeHtml(r.coach) : `练 ${(r.groups || []).join(' + ')}`} · ${r.ex.length} 个动作</p>
          <div class="th-chips">${r.ex.slice(0, 4).map(id => `<span>${EX_BY_ID[id].name}</span>`).join('')}${r.ex.length > 4 ? `<span>+${r.ex.length - 4}</span>` : ''}</div>
        </div>
        <div class="th-fig">${first ? illoSvg(first, .6) : ''}</div>
      </div>
      <div class="th-actions">
        <button class="btn chunky" data-act="start-rec">开始训练 · +${xp} XP</button>
        <button class="btn th-more" data-act="sheet" data-id="plan">调整</button>
      </div>
      <div class="th-stats">
        <span><b>${s}</b>连续天数</span>
        <span><b>${Math.min(tx, goal)}<small>/${goal}</small></b>今日 XP</span>
        <button data-act="go-hero"><span class="lv-badge"><span>${li.lv}</span></span>${talentFree() > 0 ? `<em>${talentFree()}</em>` : ''}</button>
      </div>
    </section>`;
}
function renderFeed() {
  if (!data.profile && !state.quiz) startQuiz();
  if (state.quiz || !data.track || state.picking) { document.body.classList.remove('on-feed'); return renderPath(); }
  document.body.classList.add('on-feed'); document.body.classList.remove('on-me');
  subEl.innerHTML = feedTabs();
  const t = FD.tab;
  const exs = exPool(t);
  let cards = [];
  if (t === 'rec') {
    const postedToday = (data.photos || []).some(p => p.d === dateKey());
    cards = [coachCard(), ...lessonCards(), waterFeedCard(), talentCard(), ...guildCards(), ...prCards(), remindFeedCard(),
      trained(dateKey()) && !postedToday ? photoAddCard() : null, ...photoCards(3), ...exs.slice(0, 12).map((e, i) => exCard(e.id, i))];
  } else if (t === 'office') {
    cards = [...lessonCards(l => OFFICE_OK.has(l)), remindFeedCard(), ...exs.map((e, i) => exCard(e.id, i))];
  } else if (t === 'fav') {
    cards = exs.map((e, i) => exCard(e.id, i));
  } else {
    cards = exs.map((e, i) => exCard(e.id, i));
  }
  cards = cards.filter(Boolean);
  // 推荐流里把小卡错开放，避免同类扎堆
  if (t === 'rec') { const fixed = cards.slice(0, 2); const rest = shuffle(cards.slice(2), mulberry32(hashStr(dateKey()))); cards = [...fixed, ...rest]; }
  return `
    ${t === 'rec' || t === 'office' ? todayHero() : ''}
    ${cards.length ? waterfall(cards) : `<div class="empty-note">${t === 'fav' ? '还没有收藏。在动作卡片上点 ♡ 收藏，常练的动作就会出现在这里。' : '这里暂时没有内容'}</div>`}`;
}
function feedTabs() {
  return `<nav class="ftabs" aria-label="内容分类">${FEED_TABS.map(([k, l]) => `<button data-ftab="${k}" class="${FD.tab === k ? 'on' : ''}">${l}</button>`).join('')}</nav>
    <button class="ftab-search" data-fsearch aria-label="搜索动作"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg></button>`;
}

/* ---------- 发现（动作库） ---------- */
function renderDiscover() {
  document.body.classList.remove('on-feed', 'on-me');
  const q = state.query.trim();
  const sel = state.select;
  const items = EXERCISES.filter(e => (state.part === '全部' || e.part === state.part || mgOf(e) === state.part) && (!q || e.name.includes(q)));
  const chips = ['全部', ...PARTS].map(p => `<button class="chip ${p === state.part ? 'sel' : ''}" data-act="part" data-part="${p}">${p}</button>`).join('');
  const cards = items.map((e, i) => {
    const c = exCard(e.id, i);
    if (sel) {
      const n = sel.indexOf(e.id);
      c.html = c.html.replace('data-act="ex-open"', 'data-act="sel"').replace('<article class="fcard"', `<article class="fcard ${n >= 0 ? 'picked' : ''}"`)
        .replace('<div class="fc-body">', `<span class="pick-badge">${n >= 0 ? n + 1 : '＋'}</span><div class="fc-body">`);
    }
    return c;
  });
  const bar = sel ? `
    <div class="select-bar">
      <button class="btn ghost" data-act="sel-cancel">取消</button>
      <button class="btn chunky" data-act="sel-start" ${sel.length ? '' : 'disabled'}>开始自由训练（${sel.length}）</button>
      ${sel.length ? '<button class="btn small tpl-save" data-act="tpl-save">存为模板</button>' : ''}
    </div>` : '';
  return `
    <div class="disc-top">
      <input id="lib-search" class="search" type="search" placeholder="搜索 ${EXERCISES.length} 个动作" value="${escapeHtml(state.query)}" data-act="search">
      ${sel ? '' : '<button class="btn small" data-act="sel-mode">自由训练</button>'}
    </div>
    <div class="chips">${chips}</div>
    ${sel ? '<div class="muted sel-hint">按顺序点选想练的动作，再点下方开始</div>' : `<div class="lib-actions"><button class="btn small ghost" data-act="cf-open">＋ 自定义动作</button></div>${customForm()}${templatesBlock()}`}
    <div id="lib-list">${cards.length ? waterfall(cards) : '<div class="empty-note">没有找到相关动作</div>'}</div>
    ${bar}`;
}

/* ---------- 公会 ---------- */
function renderGuildPage() {
  document.body.classList.remove('on-feed', 'on-me');
  return `<div class="page-guild">${guildSection()}</div>`;
}

/* ---------- 我 ---------- */
function renderMe() {
  document.body.classList.remove('on-feed');
  document.body.classList.add('on-me');
  const li = levelInfo();
  const { ex, sp } = cardList();
  const got = ex.filter(c => c.n).length + sp.filter(c => c.got).length;
  const tabs = [['role', '角色'], ['photo', '打卡'], ['data', '数据'], ['body', '身体'], ['fav', '收藏']];
  let body = '';
  if (FD.meTab === 'role') body = renderHero();
  else if (FD.meTab === 'photo') body = waterfall([photoAddCard(), ...photoCards()]);
  else if (FD.meTab === 'data') body = renderStats();
  else if (FD.meTab === 'body') body = renderBody();
  else { const f = EXERCISES.filter(e => isFav(e.id)); body = f.length ? waterfall(f.map(e => exCard(e.id))) : '<div class="empty-note">还没有收藏。在动作卡片上点 ♡，常练的动作会出现在这里。</div>'; }
  subEl.textContent = '';
  return `
    <section class="me-head">
      <span class="plate"><span>${li.lv}</span></span>
      <div class="me-id">
        <b>${escapeHtml(data.profile?.name || '我')}</b>
        <span>${heroTitle(li.lv)} · ${track().name}</span>
        <div class="xpbar"><i style="width:${li.pct * 100}%"></i></div>
      </div>
    </section>
    <div class="me-stats">
      <span><b>${streak()}</b>连续天数</span>
      <span><b>${totalXp()}</b>累计 XP</span>
      <span><b>${talentUsed()}/${talentPts()}</b>天赋</span>
      <span><b>${got}</b>图鉴</span>
    </div>
    <nav class="me-tabs">${tabs.map(([k, l]) => `<button class="${FD.meTab === k ? 'on' : ''}" data-act="me-tab" data-v="${k}">${l}</button>`).join('')}</nav>
    <div class="me-body">${body}</div>`;
}

/* ---------- 弹层：今日计划调整 / 开练 / 久坐提醒 / 动作详情 ---------- */
function sheetHtml() {
  if (state.detail && !EX_BY_ID[state.detail]) state.detail = null;
  let out = '';
  if (state.sheet) {
    let inner = '';
    if (state.sheet === 'plan') inner = `<div class="sh-title">调整今日计划</div>${recCard()}`;
    else if (state.sheet === 'remind') inner = `<div class="sh-title">久坐提醒</div>${remindCard()}`;
    else if (state.sheet === 'plus') {
      const ts = data.templates || [];
      inner = `
        <div class="sh-title">开始训练</div>
        <div class="plus-grid">
          <button class="plus-item t-peach" data-act="start-rec"><b>今日计划</b><span>${todayPlan().ex.length} 个动作</span></button>
          <button class="plus-item t-sky" data-act="plus-free"><b>自由训练</b><span>自己挑动作</span></button>
          <button class="plus-item t-lilac" data-photo-add><b>发打卡</b><span>拍一张记录今天</span></button>
          ${CO.avail ? '<button class="plus-item t-rose" data-act="coach-open"><b>让小铁安排</b><span>说说今天的状态</span></button>' : ''}
          ${ts.slice(0, 3).map(t => `<button class="plus-item t-mint" data-act="tpl-start" data-id="${t.id}"><b>${escapeHtml(t.name)}</b><span>我的模板</span></button>`).join('')}
        </div>`;
    }
    out += `<div class="sheet-bg" data-act="sheet-close"><div class="sheet" data-act="noop" role="dialog" aria-modal="true"><i class="sh-grip"></i>${inner}</div></div>`;
  }
  if (state.detail) out += noteDetail(state.detail);
  if (state.photo) out += photoNote(state.photo);
  return out;
}
function noteDetail(id) {
  const e = EX_BY_ID[id];
  const f = FEEL[id];
  const mine = data.feelBy[id];
  const tags = [mgOf(e), EQ_LABEL[e.eq]?.replace(/^\S+\s/, ''), OFFICE_OK.has(id) ? '办公室可做' : '', e.rl ? `计${e.rl}` : ''].filter(Boolean);
  return `
    <div class="note" role="dialog" aria-modal="true" aria-label="${e.name}">
      <div class="note-top">
        <button class="icon-btn" data-act="ex-close" aria-label="返回">←</button>
        <span>动作详情</span>
        <button class="icon-btn" data-act="fav" data-id="${id}" aria-label="收藏">${HEART(isFav(id))}</button>
      </div>
      <div class="note-scroll">
        ${DEMOS[id] ? `<div class="demo-box note-cover t-${toneOf(id)}">
          ${demoTabs(id)}<div class="demo" data-ex="${id}" data-v="side"></div>
          ${traceName(id) ? `<div class="demo-cap"><i class="tr"></i>虚线 = <span class="tn-name">${traceName(id)}</span>的运动轨迹，淡影是起始姿势</div>` : ''}
          ${demoFrames(id)}
        </div>` : `<div class="cover t-${toneOf(id)} note-cover" style="aspect-ratio:16/9"><b class="cover-big">${e.name}</b></div>`}
        <div class="note-body">
          <h2>${e.name}</h2>
          <div class="tags">${tags.map(t => `<span>#${t}</span>`).join('')}</div>
          <p class="note-tip">${e.tip}</p>
          ${muscleMap(id) ? `<div class="mbox">${muscleMap(id)}</div>` : ''}
          ${f ? `<div class="note-feel"><div class="feel-good">应该感觉：${f.good}</div>${f.bad.map(([l, c]) => `<div class="feel-bad">${l}更累 → ${c}</div>`).join('')}</div>` : ''}
          ${mine?.total ? `<div class="feel-mine">你的发力准确率 ${Math.round(mine.right / mine.total * 100)}%（${mine.total} 次自检）</div>` : ''}
          ${data.pr[id] ? `<div class="feel-mine">个人纪录 ${prLabel(id, data.pr[id])}</div>` : ''}
          ${exHistory(id)}
        </div>
      </div>
      <div class="note-bar">
        <button class="btn note-fav ${isFav(id) ? 'on' : ''}" data-act="fav" data-id="${id}">${HEART(isFav(id))}${isFav(id) ? '已收藏' : '收藏'}</button>
        <button class="btn chunky" data-act="ex-start" data-id="${id}">开始练这个</button>
      </div>
    </div>`;
}

/* ---------- 动作分发（app.js 的 view 点击 default 分支调用） ---------- */
function feedAct(act, el) {
  const id = el.dataset.id;
  switch (act) {
    case 'noop': return 'noop';
    case 'fav': {
      data.fav ??= [];
      data.fav = isFav(id) ? data.fav.filter(x => x !== id) : [id, ...data.fav];
      toast(isFav(id) ? '已收藏' : '已取消收藏');
      return true;
    }
    case 'sheet': state.sheet = id; return true;
    case 'sheet-close': state.sheet = null; return true;
    case 'ex-open': state.detail = id; return true;
    case 'ex-close': state.detail = null; return true;
    case 'ex-start': state.detail = null; startLesson(`free-${Date.now()}`, [id]); return 'noop';
    case 'plus-free': state.sheet = null; state.tab = 'library'; state.select = []; window.scrollTo(0, 0); return true;
    case 'go-guild': state.tab = 'guild'; window.scrollTo(0, 0); return true;
    case 'me-tab': FD.meTab = el.dataset.v; return true;
    case 'go-tab': state.tab = id; window.scrollTo(0, 0); return true;
  }
  return false;
}

/* 顶栏的分类标签、搜索，底栏的「＋」 */
document.addEventListener('click', e => {
  const t = e.target.closest('[data-ftab]');
  if (t) { FD.tab = t.dataset.ftab; render(); window.scrollTo(0, 0); return; }
  if (e.target.closest('[data-fsearch]')) { state.tab = 'library'; render(); window.scrollTo(0, 0); setTimeout(() => document.getElementById('lib-search')?.focus(), 50); return; }
  if (e.target.closest('[data-plus]')) { state.sheet = 'plus'; render(); }
  if (e.target.closest('[data-back]')) { state.tab = 'hero'; render(); window.scrollTo(0, 0); }
});
