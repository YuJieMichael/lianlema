'use strict';

// 依赖 data.js（动作、关卡、问卷）和 figure.js（动作演示）

// 发布在 claude.ai 时页面跑在受限框架里：下载走 downloads 能力，没有系统通知和日历文件
const HOSTED = !!(window.claude && window.claude.use);
if (HOSTED) document.documentElement.classList.add('hosted');
// 发布后的地址，用来生成好友挑战链接
const ARTIFACT_URL = 'https://claude.ai/artifact/22zvkRemP6et368RX8PPA8';

const XP_SET = 10, XP_FEEL = 5, XP_LESSON = 20;
const WATER_SIZES = { cup: [200, 250, 300, 400], bottle: [330, 500, 550, 600] };
const WATER_KIND = { cup: { name: '杯', label: '杯子', icon: '🥛' }, bottle: { name: '瓶', label: '瓶装水', icon: '🧴' } };
const SNOOZE_MIN = 10;
const GROUPS = ['胸', '背', '腿', '肩', '手臂', '核心'];
const RECOVERY_HOURS = { 胸: 72, 背: 72, 腿: 72, 肩: 48, 手臂: 48, 核心: 24 };

/* ---------- 存储 ---------- */

const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
const STORE_KEY = 'fitness-app.v1';

function defaults() {
  return {
    logs: {}, body: [], bodyInfo: { sex: null, age: null, height: null }, xp: {}, done: {}, water: {}, waterUnit: { kind: 'cup', ml: 250 }, track: null, profile: null,
    feel: { right: 0, total: 0 }, feelBy: {}, feelOff: false, feelSkip: [], pr: {}, gen: {}, rival: null,
    remind: { on: false, every: 60, start: '09:00', end: '18:00', workdays: true, lastFired: 0 },
    usage: {},
  };
}
function loadData() {
  let d = {};
  try { d = JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (e) { /* 存储不可用时用默认数据 */ }
  const base = defaults();
  const water = Object.fromEntries(Object.entries(d.water || {}).map(([k, v]) =>
    [k, Array.isArray(v) ? v : Array(Math.max(0, Number(v) || 0)).fill(250)]));
  return { ...base, ...d, water, remind: { ...base.remind, ...d.remind } };
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
}
const data = loadData();

/* ---------- 工具 ---------- */

function dateKey(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function midnight(d = new Date()) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function fmtDate(key) { const d = parseKey(key); return `${d.getMonth() + 1}月${d.getDate()}日 周${WEEK[d.getDay()]}`; }
function mondayKey(d = new Date()) { return dateKey(addDays(d, -((d.getDay() + 6) % 7))); }

function dayLog(key) { return data.logs[key] || {}; }
function volumeOf(log) {
  return Object.values(log).reduce((sum, ex) =>
    sum + ex.sets.reduce((s, set) => s + (Number(set.w) || 0) * (Number(set.r) || 0), 0), 0);
}
function trained(key) { return Object.values(dayLog(key)).some(ex => ex.done); }
function todayXp() { return data.xp[dateKey()] || 0; }
function totalXp() { return Object.values(data.xp).reduce((a, b) => a + b, 0); }
function weekXp() {
  const mon = parseKey(mondayKey());
  let sum = 0;
  for (let i = 0; i < 7; i++) sum += data.xp[dateKey(addDays(mon, i))] || 0;
  return sum;
}
// 发力感自检默认一直问，直到用户关掉全部或某个动作；设置页可以重新打开
function feelOn(exId) { return !!FEEL[exId] && !data.feelOff && !data.feelSkip.includes(exId); }

// 试用期统计：只记次数，不记内容
function bump(key) { data.usage[key] = (data.usage[key] || 0) + 1; save(); }

function accuracy() {
  return data.feel.total ? Math.round((data.feel.right / data.feel.total) * 100) : null;
}

// 连续天数：今天还没练不算断，从昨天往前数
function streak() {
  const today = new Date();
  let n = 0;
  let d = trained(dateKey(today)) ? today : addDays(today, -1);
  while (trained(dateKey(d))) { n++; d = addDays(d, -1); }
  return n;
}

// 可复现的随机数：同一天的推荐保持一致
function hashStr(s) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
function mulberry32(a) {
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function shuffle(arr, rnd = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
}

async function saveFile(name, text, type) {
  if (HOSTED) {
    const dl = await window.claude.use('downloads');
    if (!dl) { toast('这里暂时不能保存文件'); return false; }
    try {
      await dl.save({ filename: name, data: text });
      return true;
    } catch (e) {
      if (e?.code !== 'declined') toast('保存失败，请稍后再试');
      return false;
    }
  }
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

// 吉祥物「小铁」：戴头带的哑铃球
function mascot(size = 64, mood = 'happy') {
  const mouth = {
    sad: '<path d="M25 44 q7 -6 14 0" stroke="#12160a" stroke-width="3" fill="none" stroke-linecap="round"/>',
    meh: '<path d="M25 42 h14" stroke="#12160a" stroke-width="3" stroke-linecap="round"/>',
    happy: '<path d="M24 40 q8 8 16 0" stroke="#12160a" stroke-width="3" fill="none" stroke-linecap="round"/>',
  }[mood];
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true">
      <rect x="1" y="26" width="8" height="14" rx="3" fill="#5c6270"/>
      <rect x="55" y="26" width="8" height="14" rx="3" fill="#5c6270"/>
      <circle cx="32" cy="34" r="24" fill="#c6f432"/>
      <rect x="9" y="18" width="46" height="7" rx="3.5" fill="#ff5a5f"/>
      <circle cx="24" cy="32" r="3.5" fill="#12160a"/>
      <circle cx="40" cy="32" r="3.5" fill="#12160a"/>
      ${mouth}
    </svg>`;
}

/* ---------- 个性化 ---------- */

function profile() { return data.profile || { goal: 'health', level: 'mid', equip: 'none', injuries: [], split: 'auto' }; }
function splitN() { return Number(profile().split) || 0; }
// 有氧：按偏好决定加不加、加多少；老用户没答过时按目标推断
function cardioPref() {
  const p = profile();
  return p.cardio || { fat: 'more', muscle: 'none', health: 'some', sit: 'some' }[p.goal] || 'some';
}
function cardioWeek() {
  const mon = parseKey(mondayKey());
  let n = 0, min = 0;
  for (let i = 0; i < 7; i++) {
    const log = dayLog(dateKey(addDays(mon, i)));
    const c = Object.entries(log).filter(([id, ex]) => ex.done && EX_BY_ID[id]?.cardio);
    if (c.length) n++;
    c.forEach(([, ex]) => ex.sets.forEach(st => { min += Number(st.r) || 0; }));
  }
  return { n, min };
}
function cardioMinutes(ex) {
  const base = { new: 10, mid: 15, pro: 20 }[profile().level] + (cardioPref() === 'more' ? 5 : 0);
  return Math.min(ex?.maxMin || 99, base);
}
const cardioXp = min => Math.min(30, XP_SET + Math.round((Number(min) || 0) / 2));
const CARDIO_PACE = {
  fat: '中等强度：微喘，能说短句但唱不了歌',
  muscle: '低强度：能正常说话，别影响力量训练的恢复',
  health: '中等强度：微喘，能说短句但唱不了歌',
  sit: '轻松强度：能边动边聊天，让身体活动开就好',
};

// 今天要不要加有氧、加哪个；groups 是今天练的部位
function cardioPlan(groups, seed, offset = 0) {
  const pref = cardioPref();
  if (pref === 'none') return null;
  let why;
  if (pref === 'more') {
    why = '每次练完加一段有氧';
  } else {
    const wk = cardioWeek();
    if (wk.n >= 3) return null;
    if ((groups || []).includes('腿')) return null; // 腿部训练日不加，留给恢复
    why = `本周有氧 ${wk.n}/3 次`;
  }
  const ok = cardioAdvice(profile()).ok;
  if (!ok.length) return null;
  const pick = byEq(ok, mulberry32(hashStr(`cardio#${seed}`)))[offset % ok.length];
  return { id: pick.id, min: cardioMinutes(pick), why };
}

// 休息提醒只给久坐的人；老用户没答过这题时，按路线和目标推断
function sedentary() {
  const p = profile();
  return p.work ? p.work === 'sit' : (data.track === 'office' || p.goal === 'sit');
}
function track() { return TRACKS[data.track] || TRACKS.office; }
function units() { return track().units; }
function lessons() {
  return units().flatMap((u, ui) => u.lessons.map((ex, li) => ({ id: `${data.track}-${ui}-${li}`, unit: ui, idx: li, ex })));
}
function currentLessonIdx(list = lessons()) {
  const i = list.findIndex(l => !data.done[l.id]);
  return i === -1 ? list.length : i;
}

function setsPerEx() {
  const lv = profile().level;
  return Math.max(2, track().sets + (lv === 'pro' ? 1 : 0) - (lv === 'new' && data.track === 'gym' ? 1 : 0));
}
function repTarget(ex) {
  if (ex.cardio) return cardioMinutes(ex);
  const lv = profile().level;
  if (ex.rl) return Math.round(ex.target * { new: 1, mid: 1.5, pro: 2 }[lv] / 5) * 5;
  if (ex.target) return Math.max(5, Math.round(ex.target * { new: 0.7, mid: 1, pro: 1.3 }[lv]));
  return { muscle: 10, fat: 15, health: 12, sit: 12 }[profile().goal];
}
function restSeconds() {
  const p = profile();
  return { muscle: 90, fat: 30, health: 60, sit: 30 }[p.goal] + (p.level === 'new' ? 15 : 0);
}
function eqOk(ex) {
  const eq = profile().equip;
  return eq === 'gym' || ex.eq === 'none' || (eq === 'db' && ex.eq === 'db');
}
function conflicts(ex) { return (ex.joints || []).filter(j => profile().injuries.includes(j)); }
const jointNames = js => js.map(j => JOINT_NAME[j]).join('、');

// 关卡动作碰到伤病部位时，换成同肌群、更安全的动作
function personalize(list, eqFilter) {
  const out = [], notes = [];
  for (const id of list) {
    const ex = EX_BY_ID[id];
    const hit = conflicts(ex);
    if (!hit.length) { if (!out.includes(id)) out.push(id); continue; }
    // 优先同部位、同器材，工位动作排在最后
    const rank = e => (e.part === ex.part ? 0 : 2) + (e.eq === ex.eq ? 0 : 1) + (e.part === '工位' && ex.part !== '工位' ? 4 : 0);
    const alt = EXERCISES
      .filter(e => mgOf(e) === mgOf(ex) && !conflicts(e).length && !out.includes(e.id) && !list.includes(e.id)
        && (eqFilter ? eqFilter(e) : true))
      .sort((a, b) => rank(a) - rank(b))[0];
    if (alt) {
      out.push(alt.id);
      notes.push(`为保护${jointNames(hit)}，${ex.name}换成了${alt.name}`);
    } else {
      notes.push(`为保护${jointNames(hit)}，跳过了${ex.name}`);
    }
  }
  if (!out.length) out.push('deadbug');
  return { ex: out, notes };
}
function lessonEqFilter() {
  return data.track === 'office' ? e => e.eq === 'none' : e => true;
}

/* ---------- 恢复状态与今日推荐 ---------- */

function recovery() {
  const now = Date.now();
  const last = {};
  for (const [key, log] of Object.entries(data.logs)) {
    for (const [id, ex] of Object.entries(log)) {
      const g = EX_BY_ID[id] && mgOf(EX_BY_ID[id]);
      if (!ex.done || !GROUPS.includes(g)) continue;
      const at = parseKey(key).getTime() + 12 * 36e5; // 只记了日期，按当天中午估算
      if (!last[g] || at > last[g]) last[g] = at;
    }
  }
  return Object.fromEntries(GROUPS.map(g => [g,
    last[g] ? Math.max(0, Math.min(1, (now - last[g]) / (RECOVERY_HOURS[g] * 36e5))) : 1]));
}

function recommend() {
  const day = dateKey();
  const roll = data.gen[day] || 0;
  const rnd = mulberry32(hashStr(`${day}#${roll}`));
  const rec = recovery();
  const pool = EXERCISES.filter(e => eqOk(e) && !conflicts(e).length && GROUPS.includes(mgOf(e))
    && (profile().equip === 'none' || e.part !== '工位'));
  const groups = GROUPS
    .filter(g => pool.some(e => mgOf(e) === g))
    .map(g => ({ g, score: rec[g] + rnd() * 0.2 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 2).map(x => x.g);

  const ex = [];
  for (const g of groups) byEq(pool.filter(e => mgOf(e) === g), rnd).slice(0, 2).forEach(e => ex.push(e.id));
  const extraMg = { sit: '拉伸', health: '拉伸' }[profile().goal];
  if (extraMg) {
    const extra = shuffle(EXERCISES.filter(e => mgOf(e) === extraMg && eqOk(e) && !conflicts(e).length), rnd)[0];
    if (extra) ex.push(extra.id);
  }
  const cardio = cardioPlan(groups, `${day}#${roll}`);
  if (cardio) ex.push(cardio.id);
  return { id: `rec-${day}-${roll}`, ex, groups, rec, cardio };
}

// 器材越全，越优先用器械动作；同一档里仍然随机
function eqRank(e) {
  const eq = profile().equip;
  return eq === 'gym' ? { gym: 0, db: 1, none: 2 }[e.eq] : eq === 'db' ? { db: 0, none: 1, gym: 2 }[e.eq] : 0;
}
const byEq = (pool, rnd) => shuffle(pool, rnd).sort((a, b) => eqRank(a) - eqRank(b));

function poolFor(g) {
  const base = EXERCISES.filter(e => eqOk(e) && !conflicts(e).length && (profile().equip === 'none' || e.part !== '工位'));
  if (g === '三头') return base.filter(e => TRICEPS.includes(e.id));
  if (g === '二头') return base.filter(e => BICEPS.includes(e.id));
  return base.filter(e => mgOf(e) === g);
}

const VARIANT_NAMES = 'ABC';
function variantsN() { return Number(profile().variants) || 3; }
function splitRound() { return data.splitRound || 0; }
function currentVariant() {
  const K = variantsN();
  return ((splitRound() + (data.gen[dateKey()] || 0)) % K + K) % K;
}

// 某一天的第 v 套动作。种子只跟设置有关，所以同一套每次都一样，方便和上次比较
function routineFor(n, idx, v) {
  const p = profile();
  const day = SPLITS[n][idx];
  const K = variantsN();
  const rnd = mulberry32(hashStr(`routine-${n}-${idx}-${p.equip}-${[...p.injuries].sort().join('')}`));
  const counts = { 1: [4], 2: [3, 2], 3: [2, 2, 1] }[day.groups.length];
  const ex = [];
  day.groups.forEach((g, i) => {
    const sorted = byEq(poolFor(g), rnd).filter(e => !ex.includes(e.id));
    // 器材够用时只在顺手的器材里轮换，不够再放进自重动作
    const top = sorted.filter(e => eqRank(e) <= 1);
    const cand = top.length >= counts[i] ? top : sorted;
    const win = cand.slice(0, Math.max(counts[i], Math.min(cand.length, counts[i] * K)));
    // 每套从窗口里错开起点取，主项也跟着换
    const start = Math.round(v * win.length / K);
    for (let j = 0; j < Math.min(counts[i], win.length); j++) {
      const e = win[(start + j) % win.length];
      if (!ex.includes(e.id)) ex.push(e.id);
    }
  });
  // 器材少的时候某些部位动作不够，用核心动作补到至少 3 个
  for (const e of byEq(poolFor('核心'), rnd).slice(v)) {
    if (ex.length >= 3) break;
    if (!ex.includes(e.id)) ex.push(e.id);
  }
  return ex;
}

// 分化训练：按轮到的那一天、这一轮的那一套出动作；进度只在练完时推进，休息几天不会跳过
function splitRec() {
  const n = splitN();
  const idx = (data.splitIdx || 0) % n;
  const v = currentVariant();
  const ex = routineFor(n, idx, v);
  const cardio = cardioPlan(SPLITS[n][idx].groups, `split-${n}`, idx + v * n);
  if (cardio) ex.push(cardio.id);
  return { id: `split-${n}-${idx}-${VARIANT_NAMES[v]}-${dateKey()}`, ex, split: { n, idx, v, day: SPLITS[n][idx] }, cardio };
}

// 推进到下一天；一轮结束时换下一套
function advanceSplit(from) {
  const n = splitN();
  const next = (from + 1) % n;
  if (next === 0) data.splitRound = splitRound() + 1;
  data.splitIdx = next;
  delete data.gen[dateKey()];
}

function todayPlan() { return splitN() ? splitRec() : recommend(); }

// 自动加重：上次全部完成目标次数就加重，否则保持
function suggest(exId, override) {
  const ex = EX_BY_ID[exId];
  if (ex.cardio) {
    return { w: 0, r: override || repTarget(ex), note: `${CARDIO_PACE[profile().goal]}` };
  }
  const target = repTarget(ex);
  const step = ex.bw ? 0 : (ex.part === '腿' || exId === 'deadlift' ? 5 : 2.5);
  const lastKey = Object.keys(data.logs).filter(k => data.logs[k][exId]?.done).sort().pop();
  if (!lastKey) return { w: ex.bw ? 0 : '', r: target, note: ex.bw ? '第一次做，先看演示，感受动作' : `第一次做，选一个能标准完成 ${target} 次的重量` };

  const sets = data.logs[lastKey][exId].sets.filter(s => Number(s.r) > 0);
  if (!sets.length) return { w: ex.bw ? 0 : '', r: target, note: '先看演示，感受动作' };
  const w = Math.max(...sets.map(s => Number(s.w) || 0));
  const minR = Math.min(...sets.map(s => Number(s.r)));
  const lastR = Math.max(...sets.map(s => Number(s.r)));
  const unit = ex.rl || '次';
  if (minR >= target) {
    if (step && w > 0) return { w: w + step, r: target, note: `上次 ${w}kg×${target} 全部完成，今天加到 ${w + step}kg 💪` };
    return { w, r: lastR + (ex.rl ? 5 : 1), note: '上次全部完成，今天每组多做一点' };
  }
  return { w, r: target, note: `上次有组没做满 ${target}${unit}，${w ? `保持 ${w}kg ` : ''}再挑战` };
}

// 个人纪录：有负重按估算 1RM，自重按次数或秒数
function bestSet(exId, sets) {
  const ex = EX_BY_ID[exId];
  let best = null;
  for (const s of sets) {
    const w = Number(s.w) || 0, r = Number(s.r) || 0;
    if (!r) continue;
    const score = w > 0 && !ex.rl ? w * (1 + r / 30) : r + w;
    if (!best || score > best.score) best = { score, w, r };
  }
  return best;
}
function prLabel(exId, p) {
  const ex = EX_BY_ID[exId];
  return p.w > 0 && !ex.rl ? `${p.w}kg × ${p.r}` : `${p.r}${ex.rl || '次'}${p.w > 0 ? `（+${p.w}kg）` : ''}`;
}

/* ---------- 路由 ---------- */

const state = {
  tab: 'path',
  preview: null,     // 路线页弹出的关卡 id
  picking: false,    // 正在切换路线
  quiz: null,        // 问卷进行中 { step, ans }
  lesson: null,      // 进行中的关卡
  part: '全部',
  query: '',
  openEx: null,      // 动作库展开的动作
  select: null,      // 自由训练选中的动作
  reminding: false,
  snoozeUntil: null,
};

const view = document.getElementById('view');
const titleEl = document.getElementById('page-title');
const subEl = document.getElementById('page-sub');
const lessonEl = document.getElementById('lesson');
const modalEl = document.getElementById('remind-modal');

const PAGES = {
  path: { title: '闯关', render: renderPath },
  library: { title: '动作库', render: renderLibrary },
  stats: { title: '训练统计', render: renderStats },
  body: { title: '身体数据', render: renderBody },
  settings: { title: '设置', render: renderSettings },
};

function render() {
  const page = PAGES[state.tab];
  titleEl.textContent = page.title;
  subEl.textContent = '';
  view.innerHTML = page.render();
  document.querySelectorAll('.tabbar button').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === state.tab));
  renderLesson();
}

document.querySelector('.tabbar').addEventListener('click', e => {
  const btn = e.target.closest('button[data-tab]');
  if (!btn) return;
  state.tab = btn.dataset.tab;
  state.preview = null;
  render();
  window.scrollTo(0, 0);
});

// 标题栏里的「切换路线」按钮
document.querySelector('.topbar').addEventListener('click', e => {
  if (e.target.closest('[data-act="settings"]')) {
    state.tab = 'settings';
    state.preview = null;
    render();
    window.scrollTo(0, 0);
    return;
  }
  if (!e.target.closest('[data-act="pick-track"]')) return;
  state.picking = true;
  state.preview = null;
  render();
});

/* ---------- 开场问卷 ---------- */

function renderQuiz() {
  const Q = state.quiz;
  if (Q.step >= QUIZ.length) {
    const p = Q.ans;
    const t = p.equip === 'gym' ? TRACKS.gym : TRACKS.office;
    const tmp = data.profile;
    data.profile = { ...p };
    const lines = [
      `路线：${t.emoji} ${t.name}`,
      `每组目标：${repTarget({})} 次左右，每个动作 ${Math.max(2, t.sets + (p.level === 'pro' ? 1 : 0) - (p.level === 'new' && p.equip === 'gym' ? 1 : 0))} 组`,
      `组间休息：${restSeconds()} 秒`,
      ...(p.work === 'sit' ? ['闯关页有久坐提醒，可以设置每隔多久起来动一下'] : []),
      p.split === 'auto' ? '每天按肌肉恢复情况推荐' : `${p.split} 天一轮：${SPLITS[p.split].map(d => d.name).join(' / ')}`,
      p.cardio === 'none' ? '暂不安排有氧' : `有氧${p.cardio === 'more' ? '每次练完都加' : '每周 3 次'}，优先${cardioAdvice(p).ok.slice(0, 3).map(e => e.name).join('、')}`,
      p.injuries.length ? `会避开对${jointNames(p.injuries)}压力大的动作` : '没有需要避开的动作',
    ];
    data.profile = tmp;
    return `
      <div class="quiz">
        <div class="coach">${mascot(64)}<div class="bubble">好，已经按你的情况定制好了！</div></div>
        <div class="card">${lines.map(l => `<div class="quiz-line">✓ ${l}</div>`).join('')}</div>
        <button class="btn chunky block" data-act="quiz-finish">开始闯关</button>
        <button class="btn block ghost" data-act="quiz-back">返回修改</button>
      </div>`;
  }

  const q = QUIZ[Q.step];
  const cur = Q.ans[q.key];
  const opts = q.opts.map(([val, label, sub]) => {
    const sel = q.multi ? cur.includes(val) : cur === val;
    const recd = q.rec && q.rec(Q.ans) === val ? '<em class="rec-badge">推荐</em>' : '';
    return `<button class="opt ${sel ? 'sel' : ''}" data-act="quiz-pick" data-val="${val}">
      ${label}${recd}${sub ? `<span class="opt-sub">${sub}</span>` : ''}</button>`;
  }).join('');
  return `
    <div class="quiz">
      <div class="quiz-top">
        ${Q.step ? '<button class="icon-btn" data-act="quiz-back" aria-label="上一步">←</button>' : '<span></span>'}
        <div class="bar"><i style="width:${(Q.step / QUIZ.length) * 100}%"></i></div>
        <span class="muted">${Q.step + 1}/${QUIZ.length}</span>
      </div>
      <h2 class="l-title">${q.q}</h2>
      ${q.sub ? `<div class="muted" style="margin:-6px 0 14px">${typeof q.sub === 'function' ? q.sub(Q.ans) : q.sub}</div>` : ''}
      <div class="opts">${opts}</div>
      ${q.multi ? `<button class="btn chunky block" style="margin-top:16px" data-act="quiz-next">${cur.length ? '继续' : '都没有，继续'}</button>` : ''}
    </div>`;
}

function startQuiz() {
  const p = data.profile;
  state.quiz = { step: 0, ans: p ? { split: 'auto', ...p, injuries: [...p.injuries] } : { goal: null, level: null, equip: null, split: null, injuries: [] } };
}

/* ---------- 闯关路线页 ---------- */

const ZIGZAG = [0, 52, 76, 52, 0, -52, -76, -52];

function renderPath() {
  if (!data.profile && !state.quiz) startQuiz();
  if (state.quiz) return renderQuiz();
  if (!data.track || state.picking) return renderTrackPicker();

  const list = lessons();
  const cur = currentLessonIdx(list);
  const goal = track().goal;
  const xp = todayXp();
  const s = streak();
  const doneToday = trained(dateKey());
  subEl.innerHTML = `<button class="track-tag" data-act="pick-track">${track().emoji} ${track().name} ▾</button>`;

  const statBar = `
    <div class="stat-pills">
      <span class="pill ${doneToday ? 'fire' : ''}">🔥 ${s}</span>
      <span class="pill">⚡ ${totalXp()} XP</span>
      <span class="pill">🎯 ${Math.min(xp, goal)}/${goal}</span>
    </div>`;

  const msg = doneToday ? (xp >= goal ? '今日目标达成，明天见！' : `再拿 ${goal - xp} XP 就完成今日目标`)
    : s ? `连续 ${s} 天了，今天别断！` : (data.track === 'office' ? '坐太久了，起来动 3 分钟吧！' : '今天还没练，来一关吧！');

  const water = waterCard();

  let n = 0;
  const html = units().map((u, ui) => {
    const nodes = list.filter(l => l.unit === ui).map(l => {
      const gi = list.indexOf(l);
      const status = data.done[l.id] ? 'done' : gi === cur ? 'current' : 'locked';
      const x = ZIGZAG[n++ % ZIGZAG.length];
      const icon = status === 'done' ? '✓' : status === 'locked' ? '🔒' : PART_EMOJI[EX_BY_ID[l.ex[0]].part];
      return `
        <div class="node-wrap" style="transform:translateX(${x}px)">
          ${status === 'current' ? '<div class="start-tag">开始</div>' : ''}
          <button class="node ${status}" style="--uc:${u.color}" data-act="preview" data-id="${l.id}"
            aria-label="第 ${l.idx + 1} 关">${icon}</button>
          ${state.preview === l.id ? previewPop(l, status, x) : ''}
        </div>`;
    }).join('');
    return `
      <section class="unit">
        <div class="unit-banner" style="--uc:${u.color}">
          <div><b>${u.title}</b><div>${u.desc}</div></div>
        </div>
        <div class="nodes">${nodes}</div>
      </section>`;
  }).join('');

  return `
    ${statBar}
    <div class="coach">${mascot(56, 'happy')}<div class="bubble">${msg}</div></div>
    ${rivalBanner()}
    ${recCard()}
    ${water}
    ${sedentary() || data.remind.on ? remindCard() : ''}
    ${html}`;
}

function recCard() {
  const r = todayPlan();
  const n = splitN();
  const strength = r.ex.filter(id => !EX_BY_ID[id].cardio);
  const names = strength.map(id => EX_BY_ID[id].name).join(' · ');
  const xp = strength.length * setsPerEx() * XP_SET + (r.cardio ? cardioXp(r.cardio.min) : 0) + XP_LESSON;
  const cardioLine = r.cardio
    ? `<div class="cardio-line">🫀 有氧 · ${EX_BY_ID[r.cardio.id].name} ${r.cardio.min} 分钟 <span class="muted">${r.cardio.why}</span></div>`
    : '';
  const seg = [['auto', '自动'], ['3', '3 天'], ['4', '4 天'], ['5', '5 天']].map(([v, label]) =>
    `<button class="${(n ? String(n) : 'auto') === v ? 'sel' : ''}" data-act="split-set" data-n="${v}">${label}</button>`).join('');

  let head, middle;
  if (n) {
    const { idx, day, v } = r.split;
    const K = variantsN();
    head = `<b>🗓️ 第 ${idx + 1} 天 · 练${day.name}</b> <span class="vtag">${VARIANT_NAMES[v]} 套</span> <span class="muted">${day.desc}</span>`;
    middle = `
      <div class="cycle">${SPLITS[n].map((d, i) => `
        <span class="cd ${i < idx ? 'done' : i === idx ? 'now' : ''}"><b>${i < idx ? '✓' : d.name}</b><small>第 ${i + 1} 天</small></span>`).join('')}
      </div>
      <div class="variants">
        <span class="muted">动作套组</span>
        ${Array.from({ length: K }, (_, i) => `<button class="vpill ${i === v ? 'sel' : ''}" data-act="variant" data-v="${i}">${VARIANT_NAMES[i]}</button>`).join('')}
        <span class="vsep"></span>
        ${[2, 3].map(k => `<button class="vk ${k === K ? 'sel' : ''}" data-act="variants-set" data-k="${k}">${k} 套轮换</button>`).join('')}
      </div>
      <div class="muted rec-hint">${n} 天一轮，每轮换一套动作，${K} 套轮流来。练完这天自动进入下一天，中间休息几天也不会跳过。
        <button class="link" data-act="split-skip">换成下一天</button></div>`;
  } else {
    head = `<b>🎯 今日推荐</b> <span class="muted">练 ${r.groups.join(' + ')}</span>`;
    middle = `
      <div class="recovery">${GROUPS.map(g => {
        const p = Math.round(r.rec[g] * 100);
        return `<div class="rc ${r.groups.includes(g) ? 'pick' : ''}"><span>${g}</span><i><b style="width:${p}%" class="${p >= 100 ? 'full' : p < 50 ? 'low' : ''}"></b></i><em>${p}%</em></div>`;
      }).join('')}</div>
      <div class="muted rec-hint">按肌肉恢复程度挑选，恢复满 100% 的部位优先练</div>`;
  }

  return `
    <div class="card rec">
      <div class="row between">
        <div>${head}</div>
        ${n ? '' : '<button class="btn small ghost" data-act="reroll">换一组</button>'}
      </div>
      <div class="seg" role="group" aria-label="训练安排">${seg}</div>
      ${middle}
      <div class="rec-list">${names}</div>
      ${cardioLine}
      <button class="btn chunky block" data-act="start-rec">开始训练 +${xp} XP</button>
    </div>`;
}

function rivalBanner() {
  const r = data.rival;
  if (!r || r.w !== mondayKey()) return '';
  const mine = weekXp();
  const ahead = mine >= r.xp;
  return `
    <div class="card rival ${ahead ? 'ahead' : ''}">
      <div class="row between">
        <b>⚔️ 本周对手 ${escapeHtml(r.n)}</b>
        <span class="muted">${ahead ? '你领先了！' : `还差 ${r.xp - mine} XP`}</span>
      </div>
      <div class="vs"><span>你 ⚡${mine}</span><span>TA ⚡${r.xp}<small>（发链接时）</small></span></div>
    </div>`;
}

function renderTrackPicker() {
  const cards = Object.entries(TRACKS).map(([key, t]) => `
    <button class="track-card ${data.track === key ? 'sel' : ''}" data-act="set-track" data-track="${key}">
      <span class="track-emoji">${t.emoji}</span>
      <span><b>${t.name}</b><span class="muted">${t.desc}</span>
        <span class="muted">每日目标 ${t.goal} XP</span></span>
    </button>`).join('');
  return `
    <div class="coach">${mascot(64)}<div class="bubble">选一条路线，之后随时可以换。</div></div>
    ${cards}
    <button class="btn block" data-act="redo-quiz">📝 重新做开场问卷</button>
    ${data.track ? '<button class="btn block ghost" style="margin-top:8px" data-act="cancel-pick">取消</button>' : ''}`;
}

function previewPop(l, status, x) {
  const u = units()[l.unit];
  const plan = personalize(l.ex, lessonEqFilter());
  const names = plan.ex.map(id => EX_BY_ID[id].name).join(' · ');
  const xp = plan.ex.length * setsPerEx() * XP_SET + XP_LESSON;
  const btn = status === 'locked'
    ? '<button class="btn block" disabled>先完成前面的关卡</button>'
    : `<button class="btn chunky block" data-act="start" data-id="${l.id}">${status === 'done' ? '再练一次' : '开始训练'} +${xp} XP</button>`;
  return `
    <div class="pop" style="--uc:${u.color};--dx:${-x}px">
      <b>第 ${l.idx + 1} 关</b>
      <div class="pop-sub">${names}</div>
      ${plan.notes.map(t => `<div class="pop-note">🛡️ ${t}</div>`).join('')}
      ${btn}
    </div>`;
}

/* ---------- 关卡流程 ---------- */

let restTimer = null;

// 有氧只做一组
function setsOf(L, i) { return EX_BY_ID[L.ex[i]].cardio ? 1 : L.setsPer; }

function startLesson(id, exList, notes = [], split = null, targets = {}) {
  if (!exList) {
    const l = lessons().find(x => x.id === id);
    ({ ex: exList, notes } = personalize(l.ex, lessonEqFilter()));
  }
  state.preview = null;
  state.lesson = {
    id, ex: exList, exIdx: 0, setsPer: setsPerEx(),
    sets: exList.map(() => []),
    targets,
    cur: suggest(exList[0], targets[exList[0]]),
    phase: 'set',
    opts: null, choice: null, result: null,
    xp: 0, right: 0, asked: 0, feelBy: {},
    notes, prs: [], split,
    startedAt: Date.now(),
  };
  if (notes.length) toast(notes[0]);
  render();
}

function lessonTop(L) {
  const total = L.ex.reduce((a, _, i) => a + setsOf(L, i), 0);
  const doneSets = L.sets.reduce((a, s) => a + s.length, 0);
  return `
    <div class="l-top">
      <button class="icon-btn" data-act="quit" aria-label="退出">✕</button>
      <div class="bar"><i style="width:${(doneSets / total) * 100}%"></i></div>
      <span class="l-xp">⚡${L.xp}</span>
    </div>`;
}

function renderLesson() {
  const L = state.lesson;
  document.body.classList.toggle('in-lesson', !!L);
  if (!L) { lessonEl.innerHTML = ''; return; }
  if (L.phase === 'done') { lessonEl.innerHTML = renderDone(); return; }
  if (L.phase === 'rest') { lessonEl.innerHTML = renderRest(); updateRest(); return; }

  const exId = L.ex[L.exIdx];
  const ex = EX_BY_ID[exId];
  const top = lessonTop(L);

  if (L.phase === 'set') {
    const n = L.sets[L.exIdx].length;
    const per = setsOf(L, L.exIdx);
    const dots = Array.from({ length: per }, (_, i) =>
      `<i class="${i < n ? 'on' : i === n ? 'now' : ''}"></i>`).join('');
    lessonEl.innerHTML = `
      ${top}
      <div class="l-body">
        <div class="l-kicker">动作 ${L.exIdx + 1}/${L.ex.length}</div>
        <h2 class="l-title">${ex.name}</h2>
        <div class="set-dots">${dots}<span>第 ${n + 1} 组 / 共 ${per} 组</span></div>
        <div class="demo-box">
          <div class="demo" data-ex="${exId}"></div>
          <div class="demo-cap"><i></i>亮色 = 应该发力的部位${FEEL[exId] ? `：${FEEL[exId].good}` : ''}</div>
        </div>
        <div class="coach small">${mascot(40)}<div class="bubble">${L.cur.note}</div></div>
        ${ex.cardio ? `
        <div class="big-inputs one">
          <label><span>时长</span>
            <input data-act="cur" data-k="r" inputmode="numeric" value="${L.cur.r}" placeholder="0"><em>分钟</em></label>
        </div>` : `
        <div class="big-inputs">
          <label><span>${ex.bw ? '附加重量' : '重量'}</span>
            <input data-act="cur" data-k="w" inputmode="decimal" value="${L.cur.w}" placeholder="0"><em>kg</em></label>
          <label><span>${ex.rl ? '时长' : '次数'}</span>
            <input data-act="cur" data-k="r" inputmode="numeric" value="${L.cur.r}" placeholder="0"><em>${ex.rl || '次'}</em></label>
        </div>`}
        <div class="cue">💡 ${ex.tip}</div>
      </div>
      <div class="l-foot">
        <button class="btn chunky block" data-act="finish-set">完成第 ${n + 1} 组</button>
      </div>`;
    return;
  }

  // phase === 'feel'
  const opts = L.opts.map((o, i) => {
    const cls = [
      L.choice === i && 'sel',
      L.result && o.good && 'right',
      L.result === 'wrong' && L.choice === i && 'wrong',
      o.unsure && 'unsure',
    ].filter(Boolean).join(' ');
    return `<button class="opt ${cls}" data-act="choose" data-i="${i}" ${L.result ? 'disabled' : ''}>${o.label}</button>`;
  }).join('');

  let foot = `<button class="btn chunky block" data-act="check" ${L.choice === null ? 'disabled' : ''}>检查</button>`;
  if (L.result) {
    const picked = L.opts[L.choice];
    const fb = {
      right: { cls: 'ok', mood: 'happy', title: `就是这个感觉！+${XP_FEEL} XP`, body: '<p>目标肌肉练到了，剩下几组保持这个感觉。</p>' },
      wrong: { cls: 'bad', mood: 'sad', title: '发力跑偏了，调整一下', body: `<p>下一组试试：${picked.cue}</p><p class="muted">正确的感觉：${FEEL[exId].good}</p>` },
      unsure: { cls: 'meh', mood: 'meh', title: '没关系，下一组再找找', body: `<p>放慢速度，用另一只手按住目标位置感受一下。</p><p class="muted">应该感觉到：${FEEL[exId].good}</p>` },
    }[L.result];
    foot = `
      <div class="feedback ${fb.cls}">
        <div class="fb-head">${mascot(40, fb.mood)}<b>${fb.title}</b></div>
        ${fb.body}
        <button class="btn chunky block ${fb.cls === 'bad' ? 'red' : ''}" data-act="after-feel">继续</button>
        <div class="feel-off">
          <button class="link" data-act="feel-skip-ex">这个动作我会了，不用再问</button>
          <button class="link" data-act="feel-off">以后都不问了</button>
        </div>
      </div>`;
  }

  lessonEl.innerHTML = `
    ${top}
    <div class="l-body">
      <div class="l-kicker">发力感自检</div>
      <h2 class="l-title">刚才这组，哪里最有感觉？</h2>
      <div class="muted" style="margin-bottom:16px">${ex.name}</div>
      <div class="opts">${opts}</div>
    </div>
    <div class="l-foot">${foot}</div>`;
}

function renderRest() {
  const L = state.lesson;
  const exId = L.ex[L.exIdx];
  const n = L.sets[L.exIdx].length;
  const next = n === 0 ? `下一个动作：${EX_BY_ID[exId].name}` : `下一组：${EX_BY_ID[exId].name} 第 ${n + 1} 组`;
  const C = 2 * Math.PI * 52;
  return `
    ${lessonTop(L)}
    <div class="l-body center">
      <div class="l-kicker">组间休息</div>
      <div class="rest-ring">
        <svg viewBox="0 0 120 120"><circle class="bg" cx="60" cy="60" r="52"/>
          <circle id="rest-fg" class="fg" cx="60" cy="60" r="52" transform="rotate(-90 60 60)" stroke-dasharray="${C}" stroke-dashoffset="0"/></svg>
        <b id="rest-num">${L.restTotal}</b>
      </div>
      <div class="muted">${next}</div>
      <div class="demo small" data-ex="${exId}"></div>
    </div>
    <div class="l-foot rest-foot">
      <button class="btn" data-act="rest-add">+15 秒</button>
      <button class="btn chunky" data-act="rest-skip">跳过休息</button>
    </div>`;
}

function updateRest() {
  const L = state.lesson;
  if (!L || L.phase !== 'rest') { clearInterval(restTimer); restTimer = null; return; }
  const left = Math.max(0, L.restEnd - Date.now());
  const num = document.getElementById('rest-num');
  const fg = document.getElementById('rest-fg');
  if (num) num.textContent = Math.ceil(left / 1000);
  if (fg) fg.style.strokeDashoffset = 2 * Math.PI * 52 * (1 - left / (L.restTotal * 1000));
  if (left <= 0) {
    if (navigator.vibrate) navigator.vibrate([60, 40, 60]);
    endRest();
  }
}
function endRest() {
  clearInterval(restTimer);
  restTimer = null;
  state.lesson.phase = 'set';
  render();
}

// 一组做完（以及自检之后）：要么进入组间休息，要么整关结束
function afterSet() {
  const L = state.lesson;
  const n = L.sets[L.exIdx].length;
  if (n >= setsOf(L, L.exIdx)) {
    if (L.exIdx + 1 >= L.ex.length) { completeLesson(); return; }
    L.exIdx++;
    L.cur = suggest(L.ex[L.exIdx], L.targets?.[L.ex[L.exIdx]]);
  }
  L.phase = 'rest';
  L.restTotal = restSeconds();
  L.restEnd = Date.now() + L.restTotal * 1000;
  clearInterval(restTimer);
  restTimer = setInterval(updateRest, 250);
}

function renderDone() {
  const L = state.lesson;
  const mins = Math.max(1, Math.round((Date.now() - L.startedAt) / 60000));
  const acc = L.asked ? Math.round((L.right / L.asked) * 100) + '%' : '—';
  const prs = L.prs.length ? `
    <div class="card prs">
      ${L.prs.map(p => `<div>🏅 新纪录：${EX_BY_ID[p.id].name} <b>${prLabel(p.id, p)}</b></div>`).join('')}
    </div>` : '';
  return `
    <div class="l-body center">
      <div class="done-mascot">${mascot(110)}</div>
      <h2 class="l-title">训练完成！</h2>
      <div class="muted">连续 ${streak()} 天 🔥</div>
      <div class="done-cards">
        <div class="dc" style="--c:#ffb547"><span>获得 XP</span><b>⚡${L.xp}</b></div>
        <div class="dc" style="--c:#5ad1ff"><span>发力准确</span><b>🎯${acc}</b></div>
        <div class="dc" style="--c:#c6f432"><span>用时</span><b>⏱${mins}分</b></div>
      </div>
      ${prs}
    </div>
    <div class="l-foot"><button class="btn chunky block" data-act="close-lesson">继续</button></div>`;
}

function completeLesson() {
  const L = state.lesson;
  const key = dateKey();
  L.xp += XP_LESSON;
  data.logs[key] ??= {};
  L.ex.forEach((id, i) => {
    if (!L.sets[i].length) return;
    const prev = data.logs[key][id];
    data.logs[key][id] = { done: true, sets: [...(prev?.sets || []), ...L.sets[i]] };
    const best = bestSet(id, L.sets[i]);
    if (!best) return;
    const old = data.pr[id];
    if (!old || best.score > old.score) {
      data.pr[id] = { ...best, date: key };
      if (old) L.prs.push({ id, ...best }); // 第一次做只记录，不算破纪录
    }
  });
  data.xp[key] = (data.xp[key] || 0) + L.xp;
  data.done[L.id] = (data.done[L.id] || 0) + 1;
  if (L.split && L.split.n === splitN()) advanceSplit(L.split.idx);
  data.feel.right += L.right;
  data.feel.total += L.asked;
  for (const [id, f] of Object.entries(L.feelBy)) {
    const cur = data.feelBy[id] || { right: 0, total: 0, unsure: 0 };
    data.feelBy[id] = { right: cur.right + f.right, total: cur.total + f.total, unsure: cur.unsure + f.unsure };
  }
  save();
  L.phase = 'done';
}

lessonEl.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  const L = state.lesson;
  if (!el || !L) return;
  const exId = L.ex[L.exIdx];

  switch (el.dataset.act) {
    case 'quit':
      if (L.phase !== 'done') {
        showModal(`
          <div class="done-mascot">${mascot(72, 'sad')}</div>
          <h2>现在退出吗？</h2>
          <p class="muted">这次训练的记录不会保存。</p>
          <button class="btn chunky block" data-act="close">继续训练</button>
          <button class="btn block ghost" data-act="quit-yes">退出</button>`);
        return;
      }
      state.lesson = null;
      break;
    case 'finish-set': {
      const r = Number(L.cur.r);
      if (!(r > 0)) { toast('先填一下次数'); return; }
      L.sets[L.exIdx].push({ w: String(L.cur.w || 0), r: String(r) });
      L.xp += EX_BY_ID[exId].cardio ? cardioXp(r) : XP_SET;
      if (L.sets[L.exIdx].length === 1 && feelOn(exId)) {
        const f = FEEL[exId];
        L.opts = [
          ...shuffle([{ label: f.good, good: true }, ...f.bad.map(([label, cue]) => ({ label, cue }))]),
          { label: '🤔 说不清 / 没注意', unsure: true },
        ];
        L.choice = null;
        L.result = null;
        L.phase = 'feel';
      } else {
        afterSet();
      }
      break;
    }
    case 'choose':
      L.choice = Number(el.dataset.i);
      break;
    case 'check': {
      const o = L.opts[L.choice];
      L.result = o.good ? 'right' : o.unsure ? 'unsure' : 'wrong';
      const f = L.feelBy[exId] ??= { right: 0, total: 0, unsure: 0 };
      if (o.unsure) {
        f.unsure++; // 说不清不计入准确率
      } else {
        L.asked++;
        f.total++;
        if (o.good) { L.right++; f.right++; L.xp += XP_FEEL; }
      }
      if (navigator.vibrate) navigator.vibrate(o.good ? 30 : [40, 60, 40]);
      break;
    }
    case 'after-feel':
      afterSet();
      break;
    case 'feel-skip-ex':
      if (!data.feelSkip.includes(exId)) data.feelSkip.push(exId);
      save();
      toast(`${EX_BY_ID[exId].name}不再问发力感，可以在设置里打开`);
      afterSet();
      break;
    case 'feel-off':
      data.feelOff = true;
      save();
      toast('已关闭发力感自检，可以在设置里重新打开');
      afterSet();
      break;
    case 'rest-add':
      L.restEnd += 15000;
      L.restTotal += 15;
      updateRest();
      return;
    case 'rest-skip':
      endRest();
      return;
    case 'close-lesson':
      state.lesson = null;
      break;
    default:
      return;
  }
  render();
});

lessonEl.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset.act === 'cur') state.lesson.cur[el.dataset.k] = el.value.replace(/[^\d.]/g, '');
});

/* ---------- 动作库 ---------- */

function renderLibrary() {
  const q = state.query.trim();
  const items = EXERCISES.filter(e =>
    (state.part === '全部' || e.part === state.part) && (!q || e.name.includes(q)));
  const sel = state.select;

  const chips = ['全部', ...PARTS].map(p =>
    `<button class="chip ${p === state.part ? 'sel' : ''}" data-act="part" data-part="${p}">${p}</button>`).join('');

  const list = items.map(e => {
    const open = state.openEx === e.id;
    const f = FEEL[e.id];
    const mine = data.feelBy[e.id];
    const warn = conflicts(e);
    const detail = open ? `
      <div class="demo-box">
        <div class="demo" data-ex="${e.id}"></div>
        <div class="demo-cap"><i></i>亮色 = 应该发力的部位</div>
      </div>
      <div class="tip">${e.tip}</div>
      ${f ? `<div class="feel-good">✅ 应该感觉：${f.good}</div>
        ${f.bad.map(([label, cue]) => `<div class="feel-bad">⚠️ ${label}更累 → ${cue}</div>`).join('')}` : ''}
      ${mine?.total ? `<div class="feel-mine">🎯 你的发力准确率 ${Math.round(mine.right / mine.total * 100)}%（${mine.total} 次自检）</div>` : ''}
      ${data.pr[e.id] ? `<div class="feel-mine">🏅 个人纪录 ${prLabel(e.id, data.pr[e.id])}</div>` : ''}` : '';
    const right = sel
      ? `<button class="check-btn ${sel.includes(e.id) ? 'on' : ''}" data-act="sel" data-id="${e.id}" aria-label="选择">${sel.includes(e.id) ? sel.indexOf(e.id) + 1 : '＋'}</button>`
      : `<span class="chev">${open ? '▴' : '▾'}</span>`;
    return `
      <div class="card ${open ? 'open' : ''}">
        <div class="ex-head" data-act="${sel ? 'sel' : 'open-ex'}" data-id="${e.id}">
          <div class="ex-emoji">${PART_EMOJI[e.part]}</div>
          <div>
            <div class="ex-name">${e.name}</div>
            <div class="muted">${e.part} · ${EQ_LABEL[e.eq]}${warn.length ? ` · <span class="warn">⚠️ 注意${jointNames(warn)}</span>` : ''}</div>
          </div>
          ${right}
        </div>
        ${detail}
      </div>`;
  }).join('');

  const bar = sel ? `
    <div class="select-bar">
      <button class="btn ghost" data-act="sel-cancel">取消</button>
      <button class="btn chunky" data-act="sel-start" ${sel.length ? '' : 'disabled'}>开始自由训练（${sel.length}）</button>
    </div>` : '';

  return `
    <div class="lib-top">
      <input class="search" type="search" placeholder="搜索 ${EXERCISES.length} 个动作" value="${escapeHtml(state.query)}" data-act="search">
      ${sel ? '' : '<button class="btn small" data-act="sel-mode">＋ 自由训练</button>'}
    </div>
    ${sel ? '<div class="muted" style="margin-bottom:10px">按顺序点选想练的动作，再点下方开始</div>' : ''}
    <div class="chips">${chips}</div>
    <div id="lib-list">${list || '<div class="empty">没有找到相关动作</div>'}</div>
    ${bar}`;
}

/* ---------- 设置 ---------- */

function renderSettings() {
  const skipped = data.feelSkip.filter(id => EX_BY_ID[id]);
  const list = skipped.length ? `
    <div class="muted set-sub">这些动作单独关掉了自检：</div>
    ${skipped.map(id => `
      <div class="row between history-item">
        <span>${EX_BY_ID[id].name}</span>
        <button class="btn small" data-act="feel-unskip" data-id="${id}">重新打开</button>
      </div>`).join('')}
    ${skipped.length > 1 ? '<button class="btn small ghost" data-act="feel-unskip-all">全部重新打开</button>' : ''}` : '';
  return `
    <div class="section-title">训练</div>
    <div class="card">
      <div class="row between">
        <div><b>发力感自检</b><div class="muted set-sub">每个动作做完第一组，问你哪里最有感觉，帮你确认练对了</div></div>
        <label class="switch"><input type="checkbox" id="set-feel" data-set="feel" ${data.feelOff ? '' : 'checked'} aria-label="发力感自检"><i></i></label>
      </div>
      ${data.feelOff ? '' : list}
    </div>
    <div class="card">
      <div class="row between">
        <div><b>开场问卷</b><div class="muted set-sub">目标、水平、器材、分化、有氧、伤病</div></div>
        <button class="btn small" data-act="redo-quiz">重新做</button>
      </div>
    </div>
    <div class="muted set-sub" style="padding:4px 2px">数据备份、好友挑战和试用反馈在「统计」页。</div>`;
}

/* ---------- 统计 ---------- */

function renderStats() {
  const today = new Date();
  const total = Object.values(data.logs).reduce((s, log) => s + volumeOf(log), 0);
  const acc = accuracy();
  const goal = track().goal;

  // 最近 7 天 XP 柱状图
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const vals = days.map(x => data.xp[dateKey(x)] || 0);
  const max = Math.max(...vals, goal);
  const W = 320, H = 150, bw = 28, gap = (W - bw * 7) / 8;
  const goalY = 118 - (goal / max) * 100;
  const bars = days.map((x, i) => {
    const h = Math.round((vals[i] / max) * 100);
    const xPos = gap + i * (bw + gap);
    return `
      <rect x="${xPos}" y="${118 - h}" width="${bw}" height="${Math.max(h, 2)}" rx="6"
        fill="${vals[i] >= goal ? 'var(--accent)' : 'var(--card-2)'}"/>
      ${vals[i] ? `<text x="${xPos + bw / 2}" y="${112 - h}" text-anchor="middle">${vals[i]}</text>` : ''}
      <text x="${xPos + bw / 2}" y="138" text-anchor="middle">${i === 6 ? '今天' : '周' + WEEK[x.getDay()]}</text>`;
  }).join('');

  const hard = Object.entries(data.feelBy)
    .filter(([id, f]) => f.total && EX_BY_ID[id])
    .map(([id, f]) => ({ id, pct: Math.round(f.right / f.total * 100), n: f.total }))
    .sort((a, b) => a.pct - b.pct || b.n - a.n)
    .slice(0, 5);
  const hardHtml = hard.length ? hard.map(h => `
    <div class="row between hard-row">
      <span>${EX_BY_ID[h.id].name}</span>
      <span class="meter"><i style="width:${h.pct}%"></i></span>
      <span class="muted">${h.pct}% · ${h.n}次</span>
    </div>`).join('') : '<div class="muted">完成几次发力感自检后，这里会显示你最难找到发力感的动作。</div>';

  const prs = Object.entries(data.pr).filter(([id]) => EX_BY_ID[id])
    .sort((a, b) => b[1].date.localeCompare(a[1].date)).slice(0, 10)
    .map(([id, p]) => `<div class="row between history-item"><span>${EX_BY_ID[id].name}</span><span><b>${prLabel(id, p)}</b> <span class="muted">${p.date.slice(5)}</span></span></div>`).join('');

  const history = Object.keys(data.logs)
    .filter(k => trained(k))
    .sort().reverse().slice(0, 14)
    .map(k => {
      const log = data.logs[k];
      const names = Object.keys(log).map(id => EX_BY_ID[id]?.name).filter(Boolean).join('、');
      return `
        <div class="history-item">
          <div class="row between"><b>${fmtDate(k)}</b><span class="muted">⚡${data.xp[k] || 0} · ${Math.round(volumeOf(log))} kg</span></div>
          <div class="muted">${names}</div>
        </div>`;
    }).join('');

  const r = data.rival && data.rival.w === mondayKey() ? data.rival : null;

  return `
    <div class="kpis" style="grid-template-columns:1fr 1fr">
      <div class="kpi"><b>🔥 ${streak()}</b><span>连续天数</span></div>
      <div class="kpi"><b>⚡ ${totalXp()}</b><span>累计 XP</span></div>
      <div class="kpi"><b>🎯 ${acc === null ? '—' : acc + '%'}</b><span>发力准确率（${data.feel.total} 次自检）</span></div>
      <div class="kpi"><b>${total >= 10000 ? (total / 1000).toFixed(1) + 't' : Math.round(total) + 'kg'}</b><span>累计训练量</span></div>
      <div class="kpi" style="grid-column:1/-1"><b>🫀 ${cardioWeek().min} 分钟</b><span>本周有氧（${cardioWeek().n} 次${cardioPref() === 'some' ? '，目标每周 3 次' : ''}）</span></div>
    </div>
    <div class="card">
      <div class="muted" style="margin-bottom:6px">最近 7 天 XP（每日目标 ${goal}）</div>
      <svg class="chart" viewBox="0 0 ${W} ${H}">
        <line x1="0" x2="${W}" y1="${goalY}" y2="${goalY}" stroke="var(--accent)" stroke-dasharray="4 4" opacity=".5"/>
        ${bars}
      </svg>
    </div>

    <div class="section-title">最难找到发力感的动作</div>
    <div class="card">${hardHtml}</div>

    <div class="section-title">个人纪录</div>
    <div class="card">${prs || '<div class="muted">同一个动作练第二次起，超过之前的成绩就会破纪录。</div>'}</div>

    <div class="section-title">好友挑战</div>
    <div class="card">
      <div class="muted">本周你已拿到 ⚡${weekXp()} XP。把挑战链接发给朋友，看谁这周练得多。</div>
      ${r ? `<div class="vs" style="margin-top:10px"><span>你 ⚡${weekXp()}</span><span>${escapeHtml(r.n)} ⚡${r.xp}<small>（发链接时）</small></span></div>` : ''}
      <div class="row" style="gap:8px;margin-top:12px">
        <button class="btn" style="flex:1" data-act="challenge">⚔️ 发起挑战</button>
        <button class="btn" data-act="vs-enter">输入挑战码</button>
      </div>
    </div>

    <div class="section-title">训练历史</div>
    <div class="card">${history || '<div class="empty">还没有训练记录，去「闯关」打第一关吧</div>'}</div>

    <div class="section-title">试用反馈</div>
    <div class="card" id="feedback-card">
      <div class="muted">在试用「练了吗」？哪里看不懂、觉得烦、或者有 bug，直接留言。</div>
      <div class="row" style="gap:8px;margin-top:12px">
        <button class="btn" style="flex:1" data-act="feedback">💬 留言反馈</button>
        <button class="btn" data-act="usage">📋 复制我的使用数据</button>
      </div>
    </div>

    <div class="section-title">数据</div>
    <div class="card">
      <div class="muted">数据只保存在这台设备的浏览器里。换手机或清理浏览器前，先导出备份。</div>
      <div class="row" style="gap:8px;margin-top:12px">
        <button class="btn small" data-act="export">⬇️ 导出备份</button>
        <button class="btn small" data-act="import">⬆️ 导入备份</button>
        <input type="file" id="import-file" accept="application/json,.json" hidden>
      </div>
    </div>`;
}

/* ---------- 身体数据 ---------- */

/* ---------- 基础代谢：有体脂率就按去脂体重（肌肉）算 ---------- */

// 美国海军围度法估算体脂率（单位 cm）
function navyBodyFat(sex, height, neck, waist, hip) {
  if (sex === 'm' && waist > neck) return 495 / (1.0324 - 0.19077 * Math.log10(waist - neck) + 0.15456 * Math.log10(height)) - 450;
  if (sex === 'f' && waist + hip > neck) return 495 / (1.29579 - 0.35004 * Math.log10(waist + hip - neck) + 0.221 * Math.log10(height)) - 450;
  return null;
}

// 最近 4 周平均每周训练几天
function weeklySessions() {
  let n = 0;
  for (let i = 0; i < 28; i++) if (trained(dateKey(addDays(new Date(), -i)))) n++;
  return n / 4;
}

function metabolism() {
  const bi = data.bodyInfo;
  const list = [...data.body].sort((a, b) => a.date.localeCompare(b.date));
  const w = list.length ? list[list.length - 1].weight : null;
  const fatRec = [...list].reverse().find(p => p.fat);
  const bf = fatRec?.fat ?? null;
  const missing = [!w && '体重', !bi.height && '身高', !bi.age && '年龄', !bi.sex && '性别'].filter(Boolean);

  const mifflin = w && bi.height && bi.age && bi.sex
    ? 10 * w + 6.25 * bi.height - 5 * bi.age + (bi.sex === 'm' ? 5 : -161) : null;
  const lbm = w && bf ? w * (1 - bf / 100) : null;
  const katch = lbm ? 370 + 21.6 * lbm : null;
  const bmr = katch ?? mifflin;
  if (!bmr) return { missing, w, bf };

  const work = profile().work;
  const sessions = weeklySessions();
  const baseFactor = { sit: 1.2, mixed: 1.3, move: 1.45 }[work] ?? (data.track === 'office' ? 1.2 : 1.3);
  const factor = baseFactor + Math.min(0.35, sessions * 0.06);
  const tdee = bmr * factor;
  const goal = profile().goal;
  const target = goal === 'fat' ? Math.max(bmr, tdee * 0.8) : goal === 'muscle' ? tdee * 1.1 : tdee;
  const protein = lbm ? 2.2 * lbm : (goal === 'fat' || goal === 'muscle' ? 1.8 : 1.4) * w;
  return { w, bf, fatDate: fatRec?.date, lbm, mifflin, katch, bmr, factor, baseFactor, sessions, tdee, target, protein, missing };
}

function metaCard() {
  const m = metabolism();
  const bi = data.bodyInfo;
  const r = n => Math.round(n);
  const info = `
    <div class="info-grid">
      <div><label>性别</label><div class="seg two mini">
        <button class="${bi.sex === 'm' ? 'sel' : ''}" data-act="bi-sex" data-v="m">男</button>
        <button class="${bi.sex === 'f' ? 'sel' : ''}" data-act="bi-sex" data-v="f">女</button></div></div>
      <div><label for="bi-age">年龄</label><div class="field"><input id="bi-age" data-bi="age" inputmode="numeric" value="${bi.age ?? ''}" placeholder="28"><span>岁</span></div></div>
      <div><label for="bi-height">身高</label><div class="field"><input id="bi-height" data-bi="height" inputmode="decimal" value="${bi.height ?? ''}" placeholder="170"><span>cm</span></div></div>
    </div>`;

  if (!m.bmr) {
    return `
      <div class="section-title">基础代谢与热量</div>
      <div class="card">${info}
        <div class="muted meta-empty">再填上${m.missing.join('、')}，就能算出你的基础代谢。记录过体脂率的话，会按肌肉量来算，更准。</div>
      </div>`;
  }

  const goalText = { fat: '减脂：比消耗少 20%', muscle: '增肌：比消耗多 10%', health: '保持：和消耗持平', sit: '保持：和消耗持平' }[profile().goal];
  const formula = m.katch
    ? `按去脂体重计算（Katch-McArdle）。你的体脂率 ${m.bf}%，肌肉、骨骼等去脂体重约 ${m.lbm.toFixed(1)} kg。${m.mifflin
      ? `只看身高体重年龄的普通公式会算成 ${r(m.mifflin)} kcal，${m.katch > m.mifflin ? `少算了 ${r(m.katch - m.mifflin)}` : `多算了 ${r(m.mifflin - m.katch)}`} kcal。` : ''}`
    : `按身高、体重、年龄、性别估算（Mifflin-St Jeor），没考虑肌肉量。肌肉多的人会被低估，脂肪多的人会被高估。记录一次体脂率（或用下面的软尺估算），就能按肌肉量算得更准。`;
  return `
    <div class="section-title">基础代谢与热量</div>
    <div class="card">
      ${info}
      <div class="meta-big">
        <div><b>${r(m.bmr)}</b><span>基础代谢 kcal/天</span></div>
        <div><b>${r(m.tdee)}</b><span>每日总消耗 kcal</span></div>
      </div>
      <div class="muted meta-why">${formula}</div>
      <div class="meta-rows">
        <div class="row between"><span>活动系数</span><b>× ${m.factor.toFixed(2)}</b></div>
        <div class="muted meta-sub">工作状态 ${m.baseFactor} + 最近 4 周平均每周练 ${m.sessions.toFixed(1)} 天</div>
        <div class="row between"><span>建议每日摄入</span><b>${r(m.target / 10) * 10} kcal</b></div>
        <div class="muted meta-sub">${goalText}${profile().goal === 'fat' ? '，且不低于基础代谢' : ''}</div>
        <div class="row between"><span>蛋白质</span><b>${r(m.protein)} g / 天</b></div>
        <div class="muted meta-sub">${m.lbm ? '按去脂体重每公斤 2.2 g' : `按体重每公斤 ${profile().goal === 'fat' || profile().goal === 'muscle' ? 1.8 : 1.4} g`}</div>
      </div>
      <div class="muted meta-note">以上是估算值，实际会因人而异。连续 2–3 周按这个吃，再根据体重变化微调。</div>
    </div>`;
}

function tapeHtml() {
  const f = data.bodyInfo.sex === 'f';
  return `
    <div class="tape">
      <div class="muted">用软尺量，单位 cm。脖子量喉结下方，腰围量肚脐高度${f ? '，臀围量最宽处' : ''}。</div>
      <div class="info-grid">
        <div><label for="tape-neck">脖子</label><div class="field"><input id="tape-neck" inputmode="decimal" placeholder="37"></div></div>
        <div><label for="tape-waist">腰围</label><div class="field"><input id="tape-waist" inputmode="decimal" placeholder="82"></div></div>
        ${f ? '<div><label for="tape-hip">臀围</label><div class="field"><input id="tape-hip" inputmode="decimal" placeholder="95"></div></div>' : ''}
      </div>
      <button class="btn small" data-act="tape-calc">估算体脂率</button>
    </div>`;
}

function renderBody() {
  const list = [...data.body].sort((a, b) => a.date.localeCompare(b.date));
  const latest = list[list.length - 1];
  const first = list[0];
  if (latest) subEl.textContent = `当前 ${latest.weight} kg`;

  let chart = '<div class="empty">记录两次以上即可看到体重趋势</div>';
  const pts = list.slice(-30);
  if (pts.length >= 2) {
    const W = 320, H = 150, pad = 24;
    const ws = pts.map(p => p.weight);
    const lo = Math.min(...ws) - 0.5, hi = Math.max(...ws) + 0.5;
    const xy = pts.map((p, i) => [
      pad + (i / (pts.length - 1)) * (W - pad * 2),
      pad + (1 - (p.weight - lo) / (hi - lo)) * (H - pad * 2),
    ]);
    const path = xy.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
    const area = `${path} L${xy[xy.length - 1][0].toFixed(1)},${H - pad} L${xy[0][0].toFixed(1)},${H - pad} Z`;
    chart = `
      <svg class="chart" viewBox="0 0 ${W} ${H}">
        <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="var(--accent)" stop-opacity=".35"/>
          <stop offset="1" stop-color="var(--accent)" stop-opacity="0"/>
        </linearGradient></defs>
        <path d="${area}" fill="url(#g)"/>
        <path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round"/>
        ${xy.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="var(--accent)"/>`).join('')}
        <text x="${pad}" y="${H - 6}">${pts[0].date.slice(5)}</text>
        <text x="${W - pad}" y="${H - 6}" text-anchor="end">${pts[pts.length - 1].date.slice(5)}</text>
        <text x="${pad}" y="14">${hi.toFixed(1)} kg</text>
      </svg>`;
  }

  const diff = latest && first && latest !== first ? (latest.weight - first.weight).toFixed(1) : null;

  const rows = [...list].reverse().map(p => `
    <div class="history-item row between">
      <div><b>${p.weight} kg</b>${p.fat ? `<span class="muted"> · 体脂 ${p.fat}%</span>` : ''}</div>
      <div class="row"><span class="muted">${fmtDate(p.date)}</span>
        <button class="icon-btn" data-act="del-body" data-date="${p.date}" aria-label="删除">✕</button></div>
    </div>`).join('');

  return `
    <div class="card">
      <div class="form-grid">
        <div><label>体重 (kg)</label><div class="field"><input id="in-weight" inputmode="decimal" placeholder="${latest?.weight ?? '65.0'}"></div></div>
        <div><label>体脂率 (%) 选填</label><div class="field"><input id="in-fat" inputmode="decimal" placeholder="${latest?.fat || '18'}"></div></div>
      </div>
      <div class="form-grid">
        <div><label>日期</label><div class="field"><input id="in-date" type="date" value="${dateKey()}" max="${dateKey()}"></div></div>
        <div style="display:flex;align-items:flex-end"><button class="btn primary block" data-act="save-body">保存记录</button></div>
      </div>
      <button class="link" data-act="tape">${state.tape ? '收起软尺估算' : '没有体脂秤？用软尺估算体脂率'}</button>
      ${state.tape ? tapeHtml() : ''}
    </div>
    ${metaCard()}
    ${diff !== null ? `<div class="kpis" style="grid-template-columns:1fr 1fr">
      <div class="kpi"><b>${latest.weight}</b><span>当前体重 kg</span></div>
      <div class="kpi"><b>${diff > 0 ? '+' : ''}${diff}</b><span>较首次记录 kg</span></div>
    </div>` : ''}
    <div class="card">${chart}</div>
    ${rows ? `<div class="section-title">全部记录</div><div class="card">${rows}</div>` : ''}`;
}

/* ---------- 页面交互 ---------- */

/* ---------- 喝水：按杯或按瓶记录，目标按体重换算 ---------- */

function latestWeight() {
  const list = [...data.body].sort((a, b) => a.date.localeCompare(b.date));
  return list.length ? list[list.length - 1].weight : null;
}
// 每公斤体重约 35 ml；当天练过再加 500 ml
function waterGoalMl() {
  const w = latestWeight();
  const base = w ? Math.min(4000, Math.max(1500, Math.round(w * 35 / 50) * 50)) : 2000;
  return base + (trained(dateKey()) ? 500 : 0);
}
const waterXp = ml => Math.max(1, Math.round(ml / 125));
function waterToday() { return (data.water[dateKey()] || []).reduce((a, b) => a + b, 0); }
const liters = ml => (ml / 1000).toFixed(ml % 1000 ? 1 : 0);

function waterCard() {
  const u = data.waterUnit;
  const k = WATER_KIND[u.kind];
  const goal = waterGoalMl();
  const drunk = waterToday();
  const units = Math.ceil(goal / u.ml);
  const filled = drunk / u.ml;
  const w = latestWeight();
  const icons = Array.from({ length: units }, (_, i) => {
    const f = Math.max(0, Math.min(1, filled - i));
    return `<button class="cup ${u.kind} ${f >= 1 ? 'full' : f > 0 ? 'part' : ''}" style="--f:${Math.round(f * 100)}%" data-act="water" aria-label="喝了一${k.name}">${f >= 1 ? k.icon : ''}</button>`;
  }).join('');
  const settings = state.waterSet ? `
    <div class="water-set">
      <div class="seg two">${Object.entries(WATER_KIND).map(([kind, v]) =>
        `<button class="${u.kind === kind ? 'sel' : ''}" data-act="water-kind" data-kind="${kind}">${v.icon} ${v.label}</button>`).join('')}</div>
      <div class="chips">${WATER_SIZES[u.kind].map(ml =>
        `<button class="chip ${u.ml === ml ? 'sel' : ''}" data-act="water-size" data-ml="${ml}">${ml} ml</button>`).join('')}</div>
      <div class="muted water-note">每天目标 ${liters(goal)} 升：${w ? `按体重 ${w} kg × 35 ml` : '还没记录体重，先按 2 升算（在「身体」页记录体重后会自动换算）'}${trained(dateKey()) ? '，今天练过再加 0.5 升' : ''}。</div>
    </div>` : '';
  return `
    <div class="card water">
      <div class="row between">
        <div><b>💧 喝水</b><div class="muted water-sum">${liters(drunk)} / ${liters(goal)} 升 · 约 ${Math.floor(filled * 10) / 10} / ${units} ${k.name}</div></div>
        <div class="row" style="gap:4px">
          ${drunk ? '<button class="btn small ghost" data-act="water-undo">撤销</button>' : ''}
          <button class="btn small ghost" data-act="water-set" aria-label="设置杯子大小">${u.ml} ml ▾</button>
        </div>
      </div>
      <div class="cups" style="--n:${Math.min(units, 10)}">${icons}</div>
      ${settings}
    </div>`;
}

function addWater() {
  const key = dateKey();
  const ml = data.waterUnit.ml;
  const before = waterToday();
  const goal = waterGoalMl();
  (data.water[key] ??= []).push(ml);
  data.xp[key] = (data.xp[key] || 0) + waterXp(ml);
  toast(before < goal && before + ml >= goal ? '今日喝水目标达成 💧' : `+${ml} ml · +${waterXp(ml)} XP`);
  return true;
}

view.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) {
    if (state.preview) { state.preview = null; render(); }
    return;
  }
  const { act, id } = el.dataset;

  switch (act) {
    // 问卷
    case 'quiz-pick': {
      const Q = state.quiz;
      const q = QUIZ[Q.step];
      if (q.multi) {
        const arr = Q.ans[q.key];
        Q.ans[q.key] = arr.includes(el.dataset.val) ? arr.filter(v => v !== el.dataset.val) : [...arr, el.dataset.val];
      } else {
        Q.ans[q.key] = el.dataset.val;
        Q.step++;
      }
      render();
      return;
    }
    case 'quiz-next':
      state.quiz.step++;
      render();
      return;
    case 'quiz-back':
      state.quiz.step = Math.max(0, state.quiz.step - 1);
      render();
      return;
    case 'quiz-finish':
      if ((state.quiz.ans.split || 'auto') !== (profile().split || 'auto')) { data.splitIdx = 0; data.splitRound = 0; }
      data.profile = { ...state.quiz.ans };
      data.usage.firstDay ??= dateKey();
      data.track = data.profile.equip === 'gym' ? 'gym' : 'office';
      state.quiz = null;
      state.picking = false;
      toast('已按你的情况定制好路线');
      break;
    case 'redo-quiz':
      state.tab = 'path';
      startQuiz();
      state.picking = false;
      break;

    // 路线页
    case 'preview':
      state.preview = state.preview === id ? null : id;
      break;
    case 'start':
      startLesson(id);
      return;
    case 'start-rec': {
      const r = todayPlan();
      startLesson(r.id, r.ex, [], r.split || null, r.cardio ? { [r.cardio.id]: r.cardio.min } : {});
      return;
    }
    case 'split-set': {
      const v = el.dataset.n;
      if (v !== (profile().split || 'auto')) { data.splitIdx = 0; data.splitRound = 0; }
      data.profile = { ...profile(), ...data.profile, split: v };
      toast(v === 'auto' ? '已改为按恢复情况自动安排' : `已改为 ${v} 天一轮，从第 1 天开始`);
      break;
    }
    case 'split-skip':
      bump('splitSkip');
      advanceSplit((data.splitIdx || 0) % splitN());
      break;
    case 'variant': {
      // 只换今天用哪一套，不影响之后的轮换
      bump('variantPick');
      const K = variantsN();
      data.gen[dateKey()] = ((Number(el.dataset.v) - splitRound()) % K + K) % K;
      break;
    }
    case 'variants-set':
      data.profile = { ...profile(), ...data.profile, variants: Number(el.dataset.k) };
      delete data.gen[dateKey()];
      toast(`${el.dataset.k} 套动作轮流练`);
      break;
    case 'reroll': {
      const day = dateKey();
      data.gen[day] = (data.gen[day] || 0) + 1;
      break;
    }
    case 'pick-track':
      state.picking = true;
      state.preview = null;
      break;
    case 'cancel-pick':
      state.picking = false;
      break;
    case 'set-track':
      data.track = el.dataset.track;
      state.picking = false;
      toast(`已切换到${track().name}路线`);
      break;
    case 'water':
      if (!addWater()) return;
      break;
    case 'water-undo': {
      const key = dateKey();
      const ml = data.water[key]?.pop();
      if (!ml) return;
      data.xp[key] = Math.max(0, (data.xp[key] || 0) - waterXp(ml));
      break;
    }
    case 'water-set':
      state.waterSet = !state.waterSet;
      break;
    case 'water-kind': {
      const kind = el.dataset.kind;
      data.waterUnit = { kind, ml: kind === 'cup' ? 250 : 550 };
      break;
    }
    case 'water-size':
      data.waterUnit = { ...data.waterUnit, ml: Number(el.dataset.ml) };
      break;
    case 'notify-perm':
      askNotify();
      return;
    case 'ics':
      downloadIcs();
      return;
    case 'remind-test':
      fireRemind();
      return;

    // 动作库
    case 'part':
      state.part = el.dataset.part;
      break;
    case 'open-ex':
      state.openEx = state.openEx === id ? null : id;
      break;
    case 'sel-mode':
      state.select = [];
      state.openEx = null;
      break;
    case 'sel': {
      const s = state.select;
      state.select = s.includes(id) ? s.filter(x => x !== id) : [...s, id];
      break;
    }
    case 'sel-cancel':
      state.select = null;
      break;
    case 'sel-start': {
      const list = state.select;
      state.select = null;
      startLesson(`free-${Date.now()}`, list);
      return;
    }

    // 统计
    case 'challenge':
      shareChallenge();
      return;
    case 'vs-enter':
      enterChallenge();
      return;
    case 'feel-unskip':
      data.feelSkip = data.feelSkip.filter(x => x !== id);
      toast(`${EX_BY_ID[id].name}会重新问发力感`);
      break;
    case 'feel-unskip-all':
      data.feelSkip = [];
      break;
    case 'feedback':
      openFeedback(document.getElementById('feedback-card'));
      return;
    case 'usage':
      showUsage();
      return;
    case 'export':
      saveFile(`练了吗-备份-${dateKey()}.json`, JSON.stringify(data, null, 2), 'application/json')
        .then(ok => { if (ok) toast('备份已导出'); });
      return;
    case 'import':
      document.getElementById('import-file').click();
      return;

    // 身体数据
    case 'bi-sex':
      data.bodyInfo = { ...data.bodyInfo, sex: el.dataset.v };
      break;
    case 'tape':
      state.tape = !state.tape;
      break;
    case 'tape-calc': {
      const bi = data.bodyInfo;
      if (!bi.sex || !bi.height) { toast('先在下面填好性别和身高'); return; }
      const num = id => parseFloat(document.getElementById(id)?.value);
      const bf = navyBodyFat(bi.sex, bi.height, num('tape-neck'), num('tape-waist'), num('tape-hip'));
      if (!(bf > 3 && bf < 60)) { toast('量的数字好像不对，再检查一下'); return; }
      document.getElementById('in-fat').value = bf.toFixed(1);
      toast(`估算体脂率 ${bf.toFixed(1)}%，填好体重后点保存`);
      return;
    }
    case 'save-body': {
      const weight = parseFloat(document.getElementById('in-weight').value);
      const fat = parseFloat(document.getElementById('in-fat').value);
      const date = document.getElementById('in-date').value || dateKey();
      if (!(weight > 20 && weight < 400)) { toast('请输入有效体重'); return; }
      data.body = data.body.filter(p => p.date !== date);
      data.body.push({ date, weight, fat: fat > 0 && fat < 80 ? fat : null });
      toast('已保存');
      break;
    }
    case 'del-body':
      data.body = data.body.filter(p => p.date !== el.dataset.date);
      break;
    default:
      return;
  }
  save();
  render();
});

view.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset.act === 'search') {
    state.query = el.value;
    // 只刷新列表，保留搜索框焦点
    const tmp = document.createElement('div');
    tmp.innerHTML = renderLibrary();
    document.getElementById('lib-list').replaceWith(tmp.querySelector('#lib-list'));
  }
});

view.addEventListener('change', e => {
  if (e.target.id === 'import-file') { importBackup(e.target.files[0]); return; }
  if (e.target.dataset.set === 'feel') {
    data.feelOff = !e.target.checked;
    toast(data.feelOff ? '已关闭发力感自检' : '已打开发力感自检');
    save();
    render();
    return;
  }
  if (e.target.dataset.bi) {
    const v = parseFloat(e.target.value);
    const ok = e.target.dataset.bi === 'age' ? v >= 10 && v <= 100 : v >= 100 && v <= 250;
    data.bodyInfo = { ...data.bodyInfo, [e.target.dataset.bi]: ok ? v : null };
    if (!ok && e.target.value) toast(e.target.dataset.bi === 'age' ? '年龄填 10–100' : '身高填 100–250 cm');
    save();
    render();
    return;
  }
  const k = e.target.dataset.r;
  if (!k) return;
  const r = data.remind;
  if (k === 'on' || k === 'workdays') r[k] = e.target.checked;
  else if (k === 'every') r.every = Number(e.target.value);
  else if (e.target.value) r[k] = e.target.value;
  if (toMin(r.end) <= toMin(r.start)) toast('下班时间要晚于上班时间');
  // 打开或改时间后，之前已经过去的时刻不再补提醒
  r.lastFired = Date.now();
  if (k === 'on' && r.on && 'Notification' in window && Notification.permission === 'default') askNotify();
  save();
  render();
});

/* ---------- 试用反馈 ---------- */

function usageSummary() {
  const u = data.usage, p = profile();
  const first = u.firstDay || Object.keys(data.logs).sort()[0] || dateKey();
  const days = Math.round((midnight() - parseKey(first)) / 864e5) + 1;
  let trainedDays = 0, best = 0, run = 0, waterDays = 0;
  const w = latestWeight();
  const waterBase = w ? Math.min(4000, Math.max(1500, Math.round(w * 35 / 50) * 50)) : 2000;
  for (let i = 0; i < days; i++) {
    const k = dateKey(addDays(parseKey(first), i));
    if (trained(k)) { trainedDays++; run++; best = Math.max(best, run); } else run = 0;
    if ((data.water[k] || []).reduce((a, b) => a + b, 0) >= waterBase) waterDays++;
  }
  const unsure = Object.values(data.feelBy).reduce((a, f) => a + (f.unsure || 0), 0);
  const asked = data.feel.total + unsure;
  const pct = (a, b) => (b ? Math.round(a / b * 100) + '%' : '—');
  const n = splitN();
  const plan = n ? `${n} 天一轮（${variantsN()} 套轮换）` : '自动安排';
  const work = { sit: '久坐', move: '经常走动', mixed: '时坐时动' }[p.work] || '未答';
  return [
    `练了吗 · 使用数据（试用第 ${days} 天）`,
    `路线：${track().name}｜安排：${plan}｜有氧：${{ more: '多一点', some: '适量', none: '不加' }[cardioPref()]}｜工作：${work}｜水平：${{ new: '新手', mid: '有基础', pro: '老手' }[p.level]}`,
    `训练天数：${trainedDays} / ${days} 天｜最长连续：${best} 天｜中途退出：${u.quits || 0} 次`,
    `发力感自检（${data.feelOff ? '已全部关闭' : `开，单独关了 ${data.feelSkip.length} 个动作`}）：${asked} 次｜准确率：${accuracy() === null ? '—' : accuracy() + '%'}｜说不清：${unsure} 次（${pct(unsure, asked)}）`,
    `休息提醒：${data.remind.on ? '开' : '关'}｜弹出 ${u.remindFired || 0} 次 → 做小关 ${u.remindLesson || 0}、喝水 ${u.remindWater || 0}、稍后 ${u.remindSnooze || 0}、关掉 ${u.remindDismiss || 0}`,
    `分化：换成下一天 ${u.splitSkip || 0} 次｜手动换套组 ${u.variantPick || 0} 次`,
    `喝水达标：${waterDays} 天`,
  ].join('\n');
}

function showUsage() {
  showModal(`
    <h2>📋 我的使用数据</h2>
    <p class="muted">只有次数和百分比，没有体重之类的个人数据。复制后发给邀请你试用的人。</p>
    <textarea id="share-text" class="share-text tall" readonly>${escapeHtml(usageSummary())}</textarea>
    <button class="btn chunky block" data-act="copy-share">复制</button>
    <button class="btn block ghost" data-act="close">完成</button>`);
}

async function openFeedback(el) {
  const c = HOSTED ? await window.claude.use('comments') : null;
  if (!c) { toast('留言反馈要在发布后的页面里用'); return; }
  try {
    const r = await c.openComposer({ element: el });
    if (!r.opened) toast('先点一下页面，再点「留言反馈」');
  } catch (e) {
    toast('现在打不开留言框，可以直接在页面上用评论功能');
  }
}

/* ---------- 备份 ---------- */

async function importBackup(file) {
  if (!file) return;
  let d;
  try { d = JSON.parse(await file.text()); } catch (e) { toast('文件读取失败，不是有效的备份'); return; }
  if (!d || typeof d.logs !== 'object' || typeof d.xp !== 'object') { toast('这不是「练了吗」的备份文件'); return; }
  pendingImport = d;
  showModal(`
    <h2>导入备份？</h2>
    <p class="muted">备份里有 ${Object.keys(d.logs).length} 天的训练记录。导入会覆盖现在的数据。</p>
    <button class="btn chunky block" data-act="import-yes">覆盖并导入</button>
    <button class="btn block ghost" data-act="close">取消</button>`);
}
let pendingImport = null;
function applyImport() {
  const base = defaults();
  Object.keys(data).forEach(k => delete data[k]);
  Object.assign(data, base, pendingImport, { remind: { ...base.remind, ...pendingImport.remind } });
  pendingImport = null;
  save();
  toast('备份已导入');
}

/* ---------- 弹窗（提醒 / 挑战） ---------- */

function showModal(html) {
  modalEl.innerHTML = `<div class="remind-sheet" role="dialog">${html}</div>`;
  modalEl.classList.add('show');
}
function closeModal() {
  state.reminding = false;
  modalEl.classList.remove('show');
}

modalEl.addEventListener('click', e => {
  if (e.target === modalEl) {
    if (state.reminding) bump('remindDismiss');
    closeModal();
    return;
  }
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'r-water') {
    bump('remindWater');
    addWater();
    save();
    closeModal();
    render();
  } else if (act === 'r-snooze') {
    bump('remindSnooze');
    closeModal();
    state.snoozeUntil = Date.now() + SNOOZE_MIN * 60000;
    toast(`${SNOOZE_MIN} 分钟后再叫你`);
  } else if (act === 'r-lesson') {
    bump('remindLesson');
    closeModal();
    const list = lessons();
    state.tab = 'path';
    startLesson(list[Math.min(currentLessonIdx(list), list.length - 1)].id);
  } else if (act === 'vs-accept') {
    data.rival = pendingRival;
    save();
    closeModal();
    state.tab = 'path';
    render();
    toast('挑战已接受，这周比一比！');
  } else if (act === 'vs-share') {
    closeModal();
    shareChallenge();
  } else if (act === 'quit-yes') {
    bump('quits');
    closeModal();
    clearInterval(restTimer);
    state.lesson = null;
    render();
  } else if (act === 'import-yes') {
    applyImport();
    closeModal();
    render();
  } else if (act === 'nick-ok') {
    const name = document.getElementById('nick').value.trim().slice(0, 12);
    if (!name) { toast('先填一个昵称'); return; }
    data.profile = { ...profile(), ...data.profile, name };
    save();
    showShare();
  } else if (act === 'copy-share') {
    copyShare();
  } else if (act === 'vs-enter-ok') {
    const raw = document.getElementById('vs-code').value.trim();
    const code = (raw.match(/vs-([\w-]+)/) || [null, raw])[1];
    if (!openChallenge(code)) toast('没认出这个挑战码，检查一下是否复制完整');
  } else if (act === 'close') {
    closeModal();
  }
});

/* ---------- 好友挑战（不需要服务器：成绩编码在链接里） ---------- */

let pendingRival = null;

function b64encode(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let bin = '';
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64decode(s) {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0))));
}

function shareChallenge() {
  if (data.profile?.name) { showShare(); return; }
  showModal(`
    <h2>起个昵称</h2>
    <p class="muted">朋友会在挑战里看到这个名字。</p>
    <input id="nick" class="search" maxlength="12" placeholder="比如：小李" autocomplete="nickname">
    <button class="btn chunky block" data-act="nick-ok">下一步</button>
    <button class="btn block ghost" data-act="close">取消</button>`);
  setTimeout(() => document.getElementById('nick')?.focus(), 50);
}

function shareText() {
  const payload = { n: data.profile.name, w: mondayKey(), xp: weekXp(), s: streak(), a: accuracy() };
  const code = 'vs-' + b64encode(payload);
  const base = HOSTED ? ARTIFACT_URL : `${location.origin}${location.pathname}`;
  const head = `我这周在「练了吗」拿了 ${payload.xp} XP，连续 ${payload.s} 天🔥 敢来比吗？`;
  return base ? `${head}\n${base}#${code}` : `${head}\n挑战码：${code}`;
}

function showShare() {
  const text = shareText();
  if (!HOSTED && navigator.share) {
    closeModal();
    navigator.share({ title: '练了吗 · 好友挑战', text }).catch(() => {});
    return;
  }
  showModal(`
    <h2>⚔️ 发给朋友</h2>
    <p class="muted">朋友打开链接，或在「统计 → 好友挑战」里粘贴挑战码，就能接受挑战。</p>
    <textarea id="share-text" class="share-text" readonly>${escapeHtml(text)}</textarea>
    <button class="btn chunky block" data-act="copy-share">复制</button>
    <button class="btn block ghost" data-act="close">完成</button>`);
}

function copyShare() {
  const ta = document.getElementById('share-text');
  navigator.clipboard.writeText(ta.value)
    .then(() => toast('已复制，发给朋友吧'))
    .catch(() => { ta.focus(); ta.select(); toast('已选中，长按或按 ⌘C 复制'); });
}

function enterChallenge() {
  showModal(`
    <h2>输入挑战码</h2>
    <p class="muted">把朋友发来的整段文字或挑战码粘贴到这里。</p>
    <textarea id="vs-code" class="share-text" placeholder="vs-..."></textarea>
    <button class="btn chunky block" data-act="vs-enter-ok">查看挑战</button>
    <button class="btn block ghost" data-act="close">取消</button>`);
}

function openChallenge(code) {
  let r;
  try { r = b64decode(code); } catch (e) { return false; }
  if (!r || typeof r.n !== 'string' || typeof r.xp !== 'number') return false;
  pendingRival = { n: r.n.slice(0, 12), w: String(r.w), xp: r.xp, s: Number(r.s) || 0, a: r.a ?? null };
  const sameWeek = pendingRival.w === mondayKey();
  showModal(`
    <div class="done-mascot">${mascot(72)}</div>
    <h2>${escapeHtml(pendingRival.n)} 向你发起挑战！</h2>
    <div class="vs big"><span>TA 本周 ⚡${pendingRival.xp}<small>连续 ${pendingRival.s} 天</small></span><span>你本周 ⚡${weekXp()}<small>连续 ${streak()} 天</small></span></div>
    ${sameWeek ? '<button class="btn chunky block" data-act="vs-accept">接受挑战</button>'
      : '<p class="muted">这是之前某一周的挑战，已经过期了。</p>'}
    <button class="btn block" data-act="vs-share">回敬一个挑战</button>
    <button class="btn block ghost" data-act="close">关闭</button>`);
  return true;
}

function checkChallengeLink() {
  const m = location.hash.match(/^#vs-([\w-]+)$/);
  if (!m) return;
  try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* 受限框架里可能不允许 */ }
  openChallenge(m[1]);
}

/* ---------- 休息提醒 ---------- */

const pad2 = n => String(n).padStart(2, '0');
const hhmm = d => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
function toMin(t) { const [h, m] = t.split(':').map(Number); return h * 60 + m; }

// 某一天的所有提醒时刻：上班后每隔 every 分钟一次，到下班为止
function slotsOn(day) {
  const r = data.remind;
  if (r.workdays && (day.getDay() === 0 || day.getDay() === 6)) return [];
  const out = [];
  for (let m = toMin(r.start) + r.every; m <= toMin(r.end); m += r.every) {
    const d = new Date(day);
    d.setHours(0, m, 0, 0);
    out.push(d);
  }
  return out;
}

function nextSlot(now = new Date()) {
  for (let i = 0; i < 8; i++) {
    const hit = slotsOn(addDays(midnight(now), i)).find(d => d > now);
    if (hit) return hit;
  }
  return null;
}

function remindCard() {
  const r = data.remind;
  let status = '已关闭';
  if (r.on) {
    const next = nextSlot();
    if (!next) status = '时间段设置有误';
    else if (dateKey(next) === dateKey()) status = `下次 ${hhmm(next)}`;
    else status = `下次 ${dateKey(next) === dateKey(addDays(new Date(), 1)) ? '明天' : '周' + WEEK[next.getDay()]} ${hhmm(next)}`;
  }

  const supported = 'Notification' in window;
  const perm = supported ? Notification.permission : 'unsupported';
  const permBtn = {
    granted: '<button class="btn small" disabled>✅ 通知已开启</button>',
    denied: '<button class="btn small" data-act="notify-perm">🔕 通知被拒绝</button>',
    default: '<button class="btn small" data-act="notify-perm">🔔 允许通知</button>',
    unsupported: '<button class="btn small" data-act="notify-perm">📱 开启通知</button>',
  }[perm];

  const opts = [30, 45, 60, 90, 120].map(m =>
    `<option value="${m}" ${m === r.every ? 'selected' : ''}>${m < 60 ? m + ' 分钟' : m / 60 + ' 小时'}</option>`).join('');

  return `
    <div class="card remind">
      <div class="row between">
        <div><b>⏰ 休息提醒</b> <span class="muted">${status}</span></div>
        <label class="switch"><input type="checkbox" data-r="on" ${r.on ? 'checked' : ''} aria-label="开启休息提醒"><i></i></label>
      </div>
      ${r.on ? `
        <div class="remind-grid">
          <label><span>每隔</span><select data-r="every">${opts}</select></label>
          <label><span>上班</span><input type="time" data-r="start" value="${r.start}"></label>
          <label><span>下班</span><input type="time" data-r="end" value="${r.end}"></label>
        </div>
        <label class="row check-row"><input type="checkbox" data-r="workdays" ${r.workdays ? 'checked' : ''}> 只在工作日（周一到周五）</label>
        <div class="remind-actions">
          ${HOSTED ? '' : permBtn}
          ${HOSTED ? '' : '<button class="btn small" data-act="ics">📅 加到手机日历</button>'}
          <button class="btn small ghost" data-act="remind-test">试一下</button>
        </div>
        <div class="muted remind-note">${HOSTED
          ? '页面开着时会准时提醒。网页版收不到锁屏通知，想要锁屏也能提醒，可以在手机日历里建一个工作日每小时重复的事件。'
          : 'App 开着时会准时提醒。想在锁屏或关掉 App 时也收到，点「加到手机日历」，交给系统日历提醒。'}</div>` : ''}
    </div>`;
}

async function askNotify() {
  if (!('Notification' in window)) {
    toast('iPhone 需先用 Safari「分享 → 添加到主屏幕」，再从主屏幕打开');
    return;
  }
  if (Notification.permission === 'denied') {
    toast('通知被拒绝了，可以在浏览器或系统设置里重新打开');
    return;
  }
  await Notification.requestPermission();
  render();
}

async function notify(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const opts = { body, tag: 'remind', renotify: true, icon: 'icon.svg' };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) { await reg.showNotification(title, opts); return; }
  } catch (e) { /* 退回普通通知 */ }
  try { new Notification(title, opts); } catch (e) { /* ignore */ }
}

function fireRemind() {
  state.reminding = true;
  bump('remindFired');
  state.snoozeUntil = null;
  const mins = data.remind.every;
  const title = `已经坐了 ${mins < 60 ? mins + ' 分钟' : mins / 60 + ' 小时'}啦`;
  notify(`练了吗 · ${title}`, '起来动一动，顺便喝杯水 💧');
  if (navigator.vibrate) navigator.vibrate([80, 60, 80]);
  showModal(`
    <div class="done-mascot">${mascot(84)}</div>
    <h2>${title}</h2>
    <p class="muted">起来动一动，顺便喝杯水 💧</p>
    ${data.track === 'office' ? '<button class="btn chunky block" data-act="r-lesson">做一个 3 分钟小关</button>' : ''}
    <button class="btn block" data-act="r-water">${WATER_KIND[data.waterUnit.kind].icon} 喝了一${WATER_KIND[data.waterUnit.kind].name}水（${data.waterUnit.ml} ml）</button>
    <button class="btn block ghost" data-act="r-snooze">${SNOOZE_MIN} 分钟后再提醒</button>`);
}

function tickRemind() {
  const r = data.remind;
  if (!r.on || state.reminding || state.lesson) return;
  const now = new Date();
  if (state.snoozeUntil && now >= state.snoozeUntil) { fireRemind(); return; }
  const due = slotsOn(midnight(now)).filter(d => d <= now).pop();
  if (!due || due.getTime() <= r.lastFired) return;
  r.lastFired = now.getTime();
  save();
  if (now - due > 15 * 60000) return; // 错过太久（比如 App 一直没打开）就不补提醒
  fireRemind();
  if (state.tab === 'path') render(); // 刷新「下次提醒」时间
}

// 导出成系统日历的重复事件，锁屏和 App 关闭时也能提醒
function downloadIcs() {
  const r = data.remind;
  let day = midnight();
  while (r.workdays && (day.getDay() === 0 || day.getDay() === 6)) day = addDays(day, 1);
  const slots = slotsOn(day);
  if (!slots.length) { toast('先把上下班时间设置好'); return; }

  const fmt = d => `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}T${pad2(d.getHours())}${pad2(d.getMinutes())}00`;
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const rule = r.workdays ? 'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR' : 'RRULE:FREQ=DAILY';
  const events = slots.map((d, i) => [
    'BEGIN:VEVENT',
    `UID:lianlema-remind-${i}-${stamp}@lianlema.app`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${fmt(d)}`,
    'DURATION:PT5M',
    rule,
    'SUMMARY:🏃 起来动一下 + 喝杯水',
    'DESCRIPTION:打开「练了吗」做一个 3 分钟小关，顺便喝一杯水。',
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:起来动一下 + 喝杯水', 'TRIGGER:PT0S', 'END:VALARM',
    'END:VEVENT',
  ].join('\r\n'));
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//lianlema//remind//CN', 'CALSCALE:GREGORIAN',
    ...events, 'END:VCALENDAR'].join('\r\n');
  saveFile('练了吗-休息提醒.ics', ics, 'text/calendar;charset=utf-8');
  toast(`已生成 ${slots.length} 个每日提醒，打开文件即可加入日历`);
}

/* ---------- 启动 ---------- */

if (!HOSTED && 'serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => { /* 不影响主功能 */ });
}
setInterval(tickRemind, 20000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) tickRemind(); });
window.addEventListener('hashchange', checkChallengeLink);

render();
checkChallengeLink();
tickRemind();
