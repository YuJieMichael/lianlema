/* AI 教练「小铁」：用 sample 能力问 Claude；能读训练数据、改今天的计划
   依赖 app.js 等全局：data, save, state, render, EXERCISES, EX_BY_ID, profile, track, streak, levelInfo, talentFx,
   atOffice, OFFICE_OK, wUnit, toU, fmtW, prLabel, dateKey, addDays, mgOf, conflicts, eqOk, escapeHtml, startLesson, toast, mascot */
const CO = { open: false, msgs: [], busy: false, ctl: null, avail: null };

(async function () {
  if (!window.claude?.use) { CO.avail = false; return; }
  const s = await claude.use('sample');
  CO.sample = s; CO.avail = !!s;
  if (state.tab === 'path') render();
})();

/* ---------- 给小铁的工具 ---------- */
const coachTools = () => [
  {
    name: 'get_profile',
    description: '读取用户档案：目标、水平、器材、伤病、当前在公司还是在家、重量单位、等级、连续天数、已点的天赋、今天的推荐计划。',
    execute: () => {
      const p = profile(); const li = levelInfo();
      const plan = todayPlan();
      return {
        goal: p.goal, level: p.level, equip: p.equip, injuries: p.injuries, track: track().name,
        where: atOffice() ? '在公司（只能做站着/扶桌椅的动作）' : '在家或健身房',
        unit: wUnit(), lv: li.lv, streak: streak(), talents: (data.talents || []).map(id => TNODES[id]?.name).filter(Boolean),
        today: dateKey(), weekday: '日一二三四五六'[new Date().getDay()],
        todayPlan: plan.ex.map(id => EX_BY_ID[id]?.name), trainedToday: trained(dateKey()),
      };
    },
  },
  {
    name: 'get_history',
    description: '读取最近 N 天（默认 14，最多 60）的训练记录，每天每个动作的组数、重量（用户单位）和次数，以及个人纪录。',
    inputSchema: { type: 'object', properties: { days: { type: 'number' } } },
    execute: ({ days = 14 } = {}) => {
      days = Math.min(60, Math.max(1, Number(days) || 14));
      const out = [];
      for (let i = 0; i < days; i++) {
        const k = dateKey(addDays(new Date(), -i));
        const log = data.logs[k]; if (!log) continue;
        const items = Object.entries(log).filter(([, e]) => e.done && EX_BY_ID).map(([id, e]) =>
          `${EX_BY_ID[id]?.name || id}: ${e.sets.map(s => Number(s.w) > 0 ? `${toU(s.w)}${wUnit()}×${s.r}` : `${s.r}${EX_BY_ID[id]?.rl || '次'}`).join(', ')}`);
        out.push({ date: k, items });
      }
      const prs = Object.entries(data.pr).filter(([id]) => EX_BY_ID[id]).map(([id, p]) => `${EX_BY_ID[id].name} ${prLabel(id, p)}`);
      const feel = Object.entries(data.feelBy || {}).filter(([id, f]) => EX_BY_ID[id] && f.total)
        .map(([id, f]) => `${EX_BY_ID[id].name} 发力准确 ${Math.round(f.right / f.total * 100)}%`);
      return { days: out, personalRecords: prs, feelAccuracy: feel };
    },
  },
  {
    name: 'list_exercises',
    description: '列出用户现在能做的动作（已按器材、伤病、在公司与否过滤），返回 id、名称、部位。安排计划前先调用，只能用这里的 id。',
    inputSchema: { type: 'object', properties: { part: { type: 'string', description: '可选：胸/背/腿/肩/手臂/核心/有氧/拉伸' } } },
    execute: ({ part } = {}) => EXERCISES
      .filter(e => eqOk(e) && !conflicts(e).length && (!part || e.part === part || mgOf(e) === part))
      .map(e => ({ id: e.id, name: e.name, part: mgOf(e), unit: e.rl || (e.bw ? '次' : '负重×次') })),
  },
  {
    name: 'set_today_plan',
    description: '把今天的训练改成指定动作（2-6 个，按顺序）。会显示在首页「今日推荐」并附上理由，用户自己点开始。',
    inputSchema: {
      type: 'object', required: ['exercise_ids', 'reason'],
      properties: { exercise_ids: { type: 'array', items: { type: 'string' } }, reason: { type: 'string', description: '一句话理由，20 字以内' } },
    },
    execute: ({ exercise_ids, reason }) => {
      const ex = (exercise_ids || []).filter(id => EX_BY_ID[id] && eqOk(EX_BY_ID[id]) && !conflicts(EX_BY_ID[id]).length).slice(0, 6);
      if (ex.length < 1) throw new Error('这些 id 不可用，请先调用 list_exercises');
      data.coachPlan = { d: dateKey(), ex, why: String(reason || '').slice(0, 40) };
      save();
      CO.planSet = true;
      return { ok: true, plan: ex.map(id => EX_BY_ID[id].name) };
    },
  },
];

const COACH_RULES = `你是「练了吗」App 里的健身教练「小铁」，说话简短、具体、像一个靠谱的朋友，用中文。
规则：
- 回答前需要数据就调用工具，不要编造用户的记录。
- 用户要计划或说今天想怎么练时，先 list_exercises，再 set_today_plan，然后用一两句话说明安排和理由。
- 用户在公司时只安排站着、扶桌椅就能做的动作（工具已经过滤）。
- 重量用用户的单位（get_profile 里的 unit）。
- 涉及疼痛、受伤、头晕胸闷等，先建议停下并看医生或物理治疗师，不给诊断。
- 回复控制在 120 字以内，不用 Markdown 标题，可以用短列表。`;

async function coachSend(text) {
  if (!CO.sample || CO.busy || !text.trim()) return;
  CO.msgs.push({ role: 'user', content: text.trim() });
  CO.msgs.push({ role: 'assistant', content: '', pending: true });
  CO.busy = true; CO.planSet = false; paintCoach();
  const hist = CO.msgs.filter(m => !m.pending).slice(-12);
  const input = hist.map((m, i) => ({ role: m.role, content: i === 0 ? `${COACH_RULES}\n\n用户：${m.content}` : m.content }));
  if (input[0].role !== 'user') input.shift();
  const out = CO.msgs[CO.msgs.length - 1];
  CO.ctl = new AbortController();
  try {
    const r = await CO.sample(input, {
      tools: coachTools(), cache: false, signal: CO.ctl.signal,
      onText: ({ text }) => { out.content = text; paintCoach(true); },
    });
    out.content = r.text || out.content;
  } catch (e) {
    out.content = e?.code === 'rate_limited' ? '我有点忙不过来，过一会儿再问我吧。'
      : e?.code === 'not_granted' ? '需要允许这个页面使用 Claude，小铁才能回答。'
      : e?.code === 'cancelled' ? (e.text || '（已停止）') : '刚才没连上，稍后再试一次。';
    if (e?.code === 'not_granted') CO.avail = false;
  }
  out.pending = false; CO.busy = false;
  if (CO.planSet) out.plan = true;
  paintCoach();
  if (CO.planSet) render();
}

/* ---------- 界面 ---------- */
function coachEntry() {
  if (!CO.avail) return '';
  return `<button class="ask-coach" data-act="coach-open">问小铁 · AI 教练</button>`;
}
function md(t) { // 极简：转义 + 换行 + 行首列表
  return escapeHtml(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/^[-•]\s?/gm, '· ').replace(/\n/g, '<br>');
}
function paintCoach(streaming) {
  let el = document.getElementById('coach-sheet');
  if (!CO.open) { el?.remove(); document.body.classList.remove('in-coach'); return; }
  if (!el) { el = document.createElement('div'); el.id = 'coach-sheet'; el.className = 'coach-sheet'; document.body.appendChild(el); el.addEventListener('click', coachClick); el.addEventListener('submit', e => { e.preventDefault(); const i = el.querySelector('input'); const v = i.value; i.value = ''; coachSend(v); }); }
  document.body.classList.add('in-coach');
  const log = CO.msgs.map(m => `
    <div class="cm ${m.role}">${m.role === 'assistant' ? mascot(28) : ''}<div class="cm-b ${m.pending && !m.content ? 'typing' : ''}">${m.content ? md(m.content) : m.pending ? '<i></i><i></i><i></i>' : ''}${m.plan ? '<button class="btn small chunky-s cm-go" data-act="coach-go">按这个计划开练</button>' : ''}</div></div>`).join('');
  const chips = ['今天练什么？', '我在公司只有 5 分钟', '最近哪里进步了？', '膝盖不舒服怎么调整'];
  const keepInput = el.querySelector('input')?.value || '';
  el.innerHTML = `
    <div class="cs-head"><div class="row">${mascot(34)}<div><b>小铁</b><span class="muted">AI 教练 · 能看你的记录、改今天的计划</span></div></div>
      <button class="icon-btn" data-act="coach-close" aria-label="关闭">✕</button></div>
    <div class="cs-log">${log || `<div class="cs-empty muted">问我任何训练问题。我能看到你的记录，也可以直接帮你改今天的计划。</div>`}</div>
    ${CO.msgs.length ? '' : `<div class="cs-chips">${chips.map(c => `<button class="chip" data-act="coach-chip">${c}</button>`).join('')}</div>`}
    <form class="cs-input"><input placeholder="${CO.busy ? '小铁正在想…' : '问小铁…'}" maxlength="300" value="${escapeHtml(keepInput)}">
      ${CO.busy ? '<button type="button" class="btn small" data-act="coach-stop">停止</button>' : '<button class="btn small chunky-s">发送</button>'}</form>`;
  const lg = el.querySelector('.cs-log'); lg.scrollTop = lg.scrollHeight;
  if (!streaming && !CO.busy) el.querySelector('input')?.focus({ preventScroll: true });
}
function coachClick(e) {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const a = b.dataset.act;
  if (a === 'coach-close') { CO.open = false; paintCoach(); }
  else if (a === 'coach-chip') coachSend(b.textContent);
  else if (a === 'coach-stop') CO.ctl?.abort();
  else if (a === 'coach-go') { CO.open = false; paintCoach(); const r = todayPlan(); startLesson(r.id, r.ex, [], null, {}); }
}
function coachAct(act) {
  if (act === 'coach-open') { CO.open = true; paintCoach(); return 'noop'; }
  if (act === 'coach-clear') { delete data.coachPlan; toast('已恢复默认推荐'); return true; }
  return false;
}
// 小铁改过的今日计划
function coachPlanToday() {
  const c = data.coachPlan;
  if (!c || c.d !== dateKey()) return null;
  const ex = c.ex.filter(id => EX_BY_ID[id]);
  if (!ex.length) return null;
  return { id: `coach-${c.d}`, ex, groups: [...new Set(ex.map(id => mgOf(EX_BY_ID[id])))], rec: recovery(), cardio: null, coach: c.why };
}
