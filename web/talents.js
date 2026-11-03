/* 天赋树：练 → XP → 等级 → 天赋点 → 点亮节点拿加成（类 PoE 被动天赋盘）
   依赖 app.js 里的全局：data, save, streak, trained, dateKey, EX_BY_ID, XP_SET */

/* ---------- 等级 ---------- */
// 从 n 级升到 n+1 级需要的 XP：前期快，后期慢
const lvNeed = n => 60 + 20 * (n - 1);
function levelInfo(xp = totalXp()) {
  let lv = 1, left = xp;
  while (left >= lvNeed(lv)) { left -= lvNeed(lv); lv++; }
  return { lv, into: left, need: lvNeed(lv), pct: left / lvNeed(lv) };
}
function talentPts() { return levelInfo().lv; }               // 1 级就有 1 点
function talentUsed() { return (data.talents || []).length; }
function talentFree() { return talentPts() - talentUsed(); }

/* ---------- 六个区域 ---------- */
const BRANCHES = [
  { key: 'push', name: '推', full: '力量 · 推', parts: ['胸', '肩'], ang: -90 },
  { key: 'pull', name: '拉', full: '力量 · 拉', parts: ['背', '手臂'], ang: -30 },
  { key: 'core', name: '核', full: '核心', parts: ['核心'], ang: 30 },
  { key: 'endu', name: '耐', full: '耐力', parts: ['有氧'], ang: 90 },
  { key: 'disc', name: '律', full: '自律', parts: [], ang: 150 },
  { key: 'legs', name: '腿', full: '下肢', parts: ['腿'], ang: 210 },
];

/* 每个区域一样的骨架：
   s1 → (s2, s3) → N1 → s4 → (T 试炼, s6) → s7 → K 基石；相邻区域的 N1 之间有桥 */
const SHAPE = [
  { id: 's1', r: 92, d: 0, from: ['root'] },
  { id: 's2', r: 152, d: -.13, from: ['s1'] },
  { id: 's3', r: 152, d: .13, from: ['s1'] },
  { id: 'n1', r: 218, d: 0, from: ['s2', 's3'], type: 'notable' },
  { id: 's4', r: 284, d: 0, from: ['n1'] },
  { id: 't1', r: 350, d: -.14, from: ['s4'], type: 'trial' },
  { id: 's6', r: 350, d: .14, from: ['s4'] },
  { id: 's7', r: 416, d: 0, from: ['t1', 's6'] },
  { id: 'k', r: 496, d: 0, from: ['s7'], type: 'key' },
];

// 文案 + 效果。fx 字段见 talentBonus()
const T = {
  push: {
    s1: ['推力 I', '胸、肩每组 +1 XP', { perSet: 1 }],
    s2: ['稳定肩胛', '胸、肩每组 +1 XP', { perSet: 1 }],
    s3: ['日课', '每天首次训练 +1 XP', { daily: 1 }],
    n1: ['爆发推', '包含胸或肩的训练 XP +10%', { pct: 10 }],
    s4: ['推力 II', '胸、肩每组 +2 XP', { perSet: 2 }],
    t1: ['试炼 · 标准俯卧撑', '包含胸或肩的训练 XP +15%', { pct: 15 }, { any: [{ pr: 'pushup', r: 12 }, { pr: 'bench', w: 40 }, { pr: 'db-bench', w: 16 }], text: () => `一组 12 个标准俯卧撑，或卧推 ${reqW(40)} / 哑铃卧推 ${reqW(16)}` }],
    s6: ['肩部养护', '每次训练 +3 XP', { lesson: 3 }],
    s7: ['推力 III', '胸、肩每组 +2 XP', { perSet: 2 }],
    k: ['千锤', '基石：所有组每组 +4 XP，但不再获得「完成训练」的 20 XP', { keyHammer: 1 }],
  },
  pull: {
    s1: ['拉力 I', '背、手臂每组 +1 XP', { perSet: 1 }],
    s2: ['握力', '背、手臂每组 +1 XP', { perSet: 1 }],
    s3: ['日课', '每天首次训练 +1 XP', { daily: 1 }],
    n1: ['背阔觉醒', '包含背或手臂的训练 XP +10%', { pct: 10 }],
    s4: ['拉力 II', '背、手臂每组 +2 XP', { perSet: 2 }],
    t1: ['试炼 · 引体向上', '每破一项个人纪录 +15 XP', { pr: 15 }, { any: [{ pr: 'pullup', r: 5 }, { pr: 'row', w: 40 }, { pr: 'db-row', w: 20 }, { pr: 'superman', r: 20 }], text: () => `一组 5 个引体向上，或划船 ${reqW(40)} / 单臂划船 ${reqW(20)} / 超人式 20 个` }],
    s6: ['后链', '背、手臂每组 +1 XP', { perSet: 1 }],
    s7: ['拉力 III', '背、手臂每组 +2 XP', { perSet: 2 }],
    k: ['逆流', '基石：每破一项纪录额外 +40 XP；没破纪录的训练 XP −15%', { keyPr: 1 }],
  },
  core: {
    s1: ['躯干 I', '核心每组 +1 XP', { perSet: 1 }],
    s2: ['呼吸', '发力自检答对 +2 XP', { feel: 2 }],
    s3: ['日课', '每天首次训练 +1 XP', { daily: 1 }],
    n1: ['本体感', '发力自检答对 +5 XP', { feel: 5 }],
    s4: ['躯干 II', '核心每组 +2 XP', { perSet: 2 }],
    t1: ['试炼 · 平板支撑', '包含核心的训练 XP +15%', { pct: 15 }, { any: [{ pr: 'plank', r: 60 }, { pr: 'side-plank', r: 45 }, { pr: 'legraise', r: 10 }], text: '平板支撑 60 秒，或侧平板 45 秒 / 悬垂举腿 10 个' }],
    s6: ['专注', '发力自检答对 +3 XP', { feel: 3 }],
    s7: ['躯干 III', '核心每组 +2 XP', { perSet: 2 }],
    k: ['中枢', '基石：自检答对的 XP ×3；答错 −5 XP', { keyFeel: 1 }],
  },
  endu: {
    s1: ['心肺 I', '每段有氧 +3 XP', { cardio: 3 }],
    s2: ['节奏', '每段有氧 +2 XP', { cardio: 2 }],
    s3: ['日课', '每天首次训练 +1 XP', { daily: 1 }],
    n1: ['第二口气', '包含有氧的训练 XP +10%', { pct: 10 }],
    s4: ['心肺 II', '每段有氧 +5 XP', { cardio: 5 }],
    t1: ['试炼 · 30 分钟', '包含有氧的训练 XP +15%', { pct: 15 }, { any: [{ pr: 'run', r: 30 }, { pr: 'bike', r: 30 }, { pr: 'rower', r: 20 }, { pr: 'walk', r: 45 }, { pr: 'rope', r: 15 }], text: '一次跑步 / 单车 30 分钟，或划船机 20 / 快走 45 / 跳绳 15 分钟' }],
    s6: ['恢复', '每次训练 +3 XP', { lesson: 3 }],
    s7: ['心肺 III', '每段有氧 +5 XP', { cardio: 5 }],
    k: ['长征', '基石：有氧 XP ×2；但力量组每组 −3 XP', { keyCardio: 1 }],
  },
  disc: {
    s1: ['日课', '每天首次训练 +1 XP', { daily: 1 }],
    s2: ['补水', '喝水 XP +50%', { water: 50 }],
    s3: ['日课', '每天首次训练 +1 XP', { daily: 1 }],
    n1: ['惯性', '连续天数每多 1 天，训练 +1 XP（最多 +15）', { streakXp: 1, cap: 15 }],
    s4: ['周末不歇', '周六、周日训练 +8 XP', { weekend: 8 }],
    t1: ['试炼 · 七日', '护身符：每连续 7 天，可以有 1 天没练而不断签', { shield: 1 }, { any: [{ streak: 7 }], text: '连续训练 7 天' }],
    s6: ['日课', '每天首次训练 +2 XP', { daily: 2 }],
    s7: ['早起', '9 点前完成训练 +6 XP', { early: 6 }],
    k: ['苦行', '基石：每天首次训练 +20 XP，再加连续天数 ×2（最多 +40）；但喝水不再给 XP', { keyMonk: 1 }],
  },
  legs: {
    s1: ['下肢 I', '腿部每组 +1 XP', { perSet: 1 }],
    s2: ['臀肌唤醒', '腿部每组 +1 XP', { perSet: 1 }],
    s3: ['日课', '每天首次训练 +1 XP', { daily: 1 }],
    n1: ['发动机', '包含腿部的训练 XP +10%', { pct: 10 }],
    s4: ['下肢 II', '腿部每组 +2 XP', { perSet: 2 }],
    t1: ['试炼 · 深蹲', '包含腿部的训练 XP +15%', { pct: 15 }, { any: [{ pr: 'bw-squat', r: 30 }, { pr: 'squat', w: 60 }, { pr: 'goblet-squat', w: 20 }, { pr: 'wallsit', r: 90 }], text: () => `一组 30 个徒手深蹲，或深蹲 ${reqW(60)} / 高脚杯 ${reqW(20)} / 靠墙静蹲 90 秒` }],
    s6: ['单腿', '腿部每组 +1 XP', { perSet: 1 }],
    s7: ['下肢 III', '腿部每组 +2 XP', { perSet: 2 }],
    k: ['根基', '基石：包含腿部的训练 XP +40%；不含腿部的 −20%', { keyLegs: 1 }],
  },
};
const BRIDGE = ['承接', '每次训练 +2 XP', { lesson: 2 }];

/* ---------- 组装节点 ---------- */
const TNODES = {}; const TEDGES = [];
(function build() {
  TNODES.root = { id: 'root', x: 0, y: 0, type: 'root', name: '起点', desc: '从这里开始，点亮相邻的节点。' };
  BRANCHES.forEach(b => {
    const a0 = b.ang * Math.PI / 180;
    SHAPE.forEach(s => {
      const [name, desc, fx, req] = T[b.key][s.id];
      const a = a0 + s.d;
      const id = `${b.key}-${s.id}`;
      TNODES[id] = { id, x: Math.cos(a) * s.r, y: Math.sin(a) * s.r, type: s.type || 'small', name, desc, fx, req, branch: b.key };
      s.from.forEach(f => TEDGES.push([f === 'root' ? 'root' : `${b.key}-${f}`, id]));
    });
  });
  BRANCHES.forEach((b, i) => {
    const nb = BRANCHES[(i + 1) % BRANCHES.length];
    const a = (b.ang + 30) * Math.PI / 180;
    const id = `bridge-${b.key}`;
    TNODES[id] = { id, x: Math.cos(a) * 250, y: Math.sin(a) * 250, type: 'small', name: BRIDGE[0], desc: BRIDGE[1], fx: BRIDGE[2], branch: null };
    TEDGES.push([`${b.key}-n1`, id], [id, `${nb.key}-n1`]);
  });
})();
const TADJ = {};
TEDGES.forEach(([a, b]) => { (TADJ[a] ??= []).push(b); (TADJ[b] ??= []).push(a); });

/* ---------- 状态 ---------- */
function talentSet() { return new Set(['root', ...(data.talents || [])]); }
function reqMet(req) {
  if (!req) return true;
  return req.any.some(c => {
    if (c.streak) return streak() >= c.streak;
    const p = data.pr?.[c.pr];
    if (!p) return false;
    return (c.r == null || p.r >= c.r) && (c.w == null || p.w >= c.w);
  });
}
function nodeState(id, set = talentSet()) {
  if (set.has(id)) return 'on';
  const near = (TADJ[id] || []).some(n => set.has(n));
  if (!near) return 'far';
  if (!reqMet(TNODES[id].req)) return 'sealed';
  return talentFree() > 0 ? 'open' : 'near';
}
// 取消一个节点后，剩下的是否仍然都连着起点
function canRefund(id) {
  const set = talentSet(); set.delete(id);
  const seen = new Set(['root']); const q = ['root'];
  while (q.length) for (const n of TADJ[q.shift()] || []) if (set.has(n) && !seen.has(n)) { seen.add(n); q.push(n); }
  return seen.size === set.size;
}
function allocTalent(id) {
  if (nodeState(id) !== 'open') return false;
  (data.talents ??= []).push(id); save(); return true;
}
function refundTalent(id) {
  if (!talentSet().has(id) || id === 'root' || !canRefund(id)) return false;
  data.talents = data.talents.filter(x => x !== id); save(); return true;
}

/* ---------- 加成汇总 ---------- */
function talentFx() {
  const fx = { daily: 0, lesson: 0, feel: 0, cardio: 0, pr: 0, water: 0, weekend: 0, early: 0, streakXp: 0, cap: 0, shield: 0,
    perSet: {}, pct: {}, keys: new Set() };
  for (const id of data.talents || []) {
    const n = TNODES[id]; if (!n) continue;
    for (const [k, v] of Object.entries(n.fx)) {
      if (k.startsWith('key')) fx.keys.add(k);
      else if (k === 'perSet' || k === 'pct') fx[k][n.branch] = (fx[k][n.branch] || 0) + v;
      else if (k === 'cap') fx.cap = Math.max(fx.cap, v);
      else fx[k] += v;
    }
  }
  return fx;
}
const partOf = id => { const e = EX_BY_ID[id]; return e.part === '工位' ? (e.mg === '胸' ? '胸' : e.mg === '腿' ? '腿' : e.mg) : e.part; };
const branchOfPart = p => BRANCHES.find(b => b.parts.includes(p))?.key;

/* 一次训练结束时：返回 [{ name, xp }]，由 completeLesson 加到当天 XP 上 */
function talentBonus(L) {
  const fx = talentFx();
  const out = []; const add = (name, xp) => { xp = Math.round(xp); if (xp) out.push({ name, xp }); };
  const gb = typeof guildBonus === 'function' ? guildBonus() : 0;
  if (gb) add(`公会加成 +${gb}%`, L.xp * gb / 100);
  if (!(data.talents || []).length) return out;
  const key = dateKey();
  const firstToday = !trained(key);
  const sets = {}; let strengthSets = 0, cardioN = 0;
  L.ex.forEach((id, i) => {
    const n = L.sets[i].length; if (!n) return;
    if (EX_BY_ID[id].cardio) { cardioN++; return; }
    const b = branchOfPart(partOf(id));
    if (b) sets[b] = (sets[b] || 0) + n;
    strengthSets += n;
  });
  const hit = new Set(Object.keys(sets)); if (cardioN) hit.add('endu');
  const base = L.xp;

  for (const [b, v] of Object.entries(fx.perSet)) if (sets[b]) add(`${BRANCHES.find(x => x.key === b).full} · 每组`, v * sets[b]);
  for (const [b, v] of Object.entries(fx.pct)) if (hit.has(b)) add(`${BRANCHES.find(x => x.key === b).full} · +${v}%`, base * v / 100);
  if (fx.cardio && cardioN) add('有氧加成', fx.cardio * cardioN);
  if (fx.lesson) add('训练加成', fx.lesson);
  if (fx.daily && firstToday) add('日课', fx.daily);
  if (fx.feel && L.right) add('发力自检', fx.feel * L.right);
  if (fx.pr && L.prs.length) add('破纪录', fx.pr * L.prs.length);
  const dow = new Date().getDay();
  if (fx.weekend && (dow === 0 || dow === 6)) add('周末不歇', fx.weekend);
  if (fx.early && new Date().getHours() < 9) add('早起', fx.early);
  if (fx.streakXp) add('惯性', Math.min(fx.cap || 15, streak() * fx.streakXp));

  const K = fx.keys;
  if (K.has('keyHammer')) { add('千锤', 4 * strengthSets); add('千锤 · 代价', -20); }
  if (K.has('keyPr')) L.prs.length ? add('逆流', 40 * L.prs.length) : add('逆流 · 代价', -base * .15);
  if (K.has('keyFeel')) { const wrong = L.asked - L.right - (L.unsure || 0); add('中枢', XP_FEEL * 2 * L.right); if (wrong > 0) add('中枢 · 代价', -5 * wrong); }
  if (K.has('keyCardio')) { if (cardioN) add('长征', base * .5 * (cardioN / Math.max(1, cardioN + Object.keys(sets).length))); if (strengthSets) add('长征 · 代价', -3 * strengthSets); }
  if (K.has('keyLegs')) hit.has('legs') ? add('根基', base * .4) : add('根基 · 代价', -base * .2);
  if (K.has('keyMonk') && firstToday) add('苦行', 20 + Math.min(40, streak() * 2));
  // 加成之后当次不低于 0
  const sum = out.reduce((a, b) => a + b.xp, 0);
  if (base + sum < 0) out.push({ name: '保底', xp: -(base + sum) });
  return out;
}
function waterMul() {
  const fx = talentFx();
  if (fx.keys.has('keyMonk')) return 0;
  return 1 + fx.water / 100;
}
function hasShield() { return talentFx().shield > 0; }
// 试炼门槛的显示：磅数向上取到 5 的倍数，做到显示的数就一定达标
const reqW = kg => isLb() ? `${Math.ceil(kg * LB / 5) * 5}lb` : `${kg}kg`;
