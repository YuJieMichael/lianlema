/* 公会：同事组队。共享数据：
   guilds/<code>        公会信息 { name, createdBy, createdAt }
   members/<userId>     每人一份 { guild, lv, title, week, weekXp, prev:{week,xp}, lastDay, streak, at }
   规则：members 人人可读，只能写自己那份（members/{self}）
   依赖：data, save, render, state, toast, levelInfo, heroTitle, weekXp, mondayKey, dateKey, addDays, parseKey, streak, trained, escapeHtml */
const GU = { db: null, user: null, me: null, members: [], info: null, names: {}, unsub: null, ok: false, ui: null, sent: '' };
const GUILD_PER = 250;           // 每位成员每周目标 XP
const GUILD_BONUS = 10;          // 上周达标，本周训练 XP +10%

(async function () {
  if (!window.claude?.use) return;
  const [db, user] = await Promise.all([claude.use('db'), claude.use('user')]);
  if (!db || !user) return;
  const me = await user.id();
  if (!me) return;
  Object.assign(GU, { db, user, me, ok: true });
  watchGuild();
  if ((state.tab === 'guild' || state.tab === 'path')) render();
})();

const lastMonday = () => dateKey(addDays(parseKey(mondayKey()), -7));
function memberWeek(m, week) {
  if (m.week === week) return m.weekXp || 0;
  if (m.prev?.week === week) return m.prev.xp || 0;
  return 0;
}
function guildTotals() {
  const n = Math.max(1, GU.members.length);
  const goal = Math.max(500, GUILD_PER * n);
  const now = GU.members.reduce((a, m) => a + memberWeek(m, mondayKey()), 0);
  const last = GU.members.reduce((a, m) => a + memberWeek(m, lastMonday()), 0);
  return { goal, now, last, lastHit: last >= goal };
}
// talents.js 结算时调用：上周达标就返回加成百分比
function guildBonus() { return data.guild && GU.members.length > 1 && guildTotals().lastHit ? GUILD_BONUS : 0; }

// 云存档恢复后公会码才出现：渲染和保存时检查一下是否需要开始监听
function ensureGuild() { if (GU.ok && (data.guild || null) !== GU.watching) watchGuild(); }
function watchGuild() {
  GU.unsub?.(); GU.unsub = null; GU.members = []; GU.info = null;
  GU.watching = data.guild || null;
  if (!GU.ok || !data.guild) return;
  const code = data.guild;
  GU.db.doc(`guilds/${code}`).get().then(s => { GU.info = s.data() || null; if ((state.tab === 'guild' || state.tab === 'path')) render(); }).catch(() => {});
  GU.unsub = GU.db.collection('members').where('guild', '==', code).onSnapshot(snap => {
    GU.members = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    resolveNames();
    if ((state.tab === 'guild' || state.tab === 'path')) render();
  }, () => {});
  pushMe();
}
async function resolveNames() {
  const ids = GU.members.map(m => m.id).filter(id => !(id in GU.names));
  if (!ids.length) return;
  try {
    const ps = await GU.user.profiles(ids);
    ids.forEach(id => { GU.names[id] = ps[id]?.name || ''; });
    if ((state.tab === 'guild' || state.tab === 'path')) render();
  } catch (e) { /* 名字拿不到就显示「队友」 */ }
}

// 把自己的公开进度写到 members/<me>（只有变化时才写）
let guTimer = null;
function pushMe() {
  if (!GU.ok) return;
  clearTimeout(guTimer);
  guTimer = setTimeout(async () => {
    const li = levelInfo();
    const week = mondayKey();
    const days = Object.keys(data.logs).filter(trained).sort();
    const old = GU.members.find(m => m.id === GU.me);
    const prev = old && old.week && old.week !== week ? { week: old.week, xp: old.weekXp || 0 } : old?.prev || null;
    const doc = { guild: data.guild || null, lv: li.lv, title: heroTitle(li.lv), week, weekXp: weekXp(), prev,
      lastDay: days[days.length - 1] || null, streak: streak() };
    const sig = JSON.stringify(doc);
    if (sig === GU.sent) return;
    try { await GU.db.doc(`members/${GU.me}`).set({ ...doc, at: Date.now() }); GU.sent = sig; } catch (e) { /* 下次保存再试 */ }
  }, 1200);
}
const _cs = window.cloudSaved;
window.cloudSaved = () => { _cs?.(); ensureGuild(); if (data.guild) pushMe(); };

function newCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(6)), b => A[b % A.length]).join('');
}

/* ---------- 界面（放在角色页） ---------- */
function guildSection() {
  setTimeout(ensureGuild, 0);
  if (!GU.ok) return `
    <div class="section-title">公会</div>
    <div class="card muted guild-off">登录 claude.ai 打开这个页面就能和同事组公会：一起冲每周目标，达标全员 XP +${GUILD_BONUS}%。</div>`;
  if (!data.guild) {
    const ui = GU.ui;
    return `
      <div class="section-title">公会</div>
      <div class="card guild-join">
        <p class="muted">和同事组一个公会：大家的 XP 一起算每周目标，达标后下一周每个人训练都多 ${GUILD_BONUS}% XP。还能看到谁今天练了。</p>
        ${ui === 'create' ? `
          <input id="gu-name" class="search" maxlength="12" placeholder="公会名，比如：三楼不久坐">
          <div class="row" style="gap:8px"><button class="btn ghost" data-act="gu-cancel">取消</button><button class="btn chunky-s flex1" data-act="gu-create">创建</button></div>`
        : ui === 'join' ? `
          <input id="gu-code" class="search code-in" maxlength="6" placeholder="输入 6 位公会码" autocapitalize="characters">
          <div class="row" style="gap:8px"><button class="btn ghost" data-act="gu-cancel">取消</button><button class="btn chunky-s flex1" data-act="gu-join">加入</button></div>`
        : `<div class="row" style="gap:8px"><button class="btn flex1" data-act="gu-ui" data-v="join">输入公会码加入</button><button class="btn chunky-s flex1" data-act="gu-ui" data-v="create">创建公会</button></div>`}
      </div>`;
  }
  const t = guildTotals();
  const pct = Math.min(1, t.now / t.goal);
  const ms = [...GU.members].sort((a, b) => memberWeek(b, mondayKey()) - memberWeek(a, mondayKey()));
  const top = Math.max(1, ...ms.map(m => memberWeek(m, mondayKey())));
  const today = dateKey();
  return `
    <div class="row between section-title"><span>公会</span><button class="link muted" data-act="gu-leave">退出</button></div>
    <div class="card guild">
      <div class="row between">
        <div><span class="kicker">公会码 ${escapeHtml(data.guild)}</span><b class="guild-name">${escapeHtml(GU.info?.name || '公会')}</b></div>
        <button class="btn small" data-act="gu-copy">邀请同事</button>
      </div>
      <div class="guild-goal">
        <div class="row between"><span>本周目标</span><b>${t.now} / ${t.goal} XP</b></div>
        <div class="xpbar"><i style="width:${pct * 100}%"></i></div>
        <span class="muted">${t.lastHit && GU.members.length > 1 ? `上周达标了，这周大家训练 XP +${GUILD_BONUS}%` : `达标后下一周全员训练 XP +${GUILD_BONUS}%`}</span>
      </div>
      <div class="guild-list">${ms.map(m => {
        const w = memberWeek(m, mondayKey());
        const done = m.lastDay === today;
        const name = m.id === GU.me ? '你' : (GU.names[m.id] || '队友');
        return `<div class="gm ${m.id === GU.me ? 'me' : ''}">
          <span class="gm-av">${escapeHtml(name.slice(0, 1))}</span>
          <div class="gm-mid"><div class="row between"><b>${escapeHtml(name)}</b><span class="muted">Lv ${m.lv || 1} · ${escapeHtml(m.title || '')}</span></div>
            <div class="gm-bar"><i style="width:${w / top * 100}%"></i></div></div>
          <span class="gm-st ${done ? 'on' : ''}">${done ? '今天已练' : m.streak ? `连续 ${m.streak} 天` : '今天未练'}</span>
          <em class="gm-xp">${w}</em>
        </div>`;
      }).join('') || '<div class="muted">正在加载成员…</div>'}</div>
      ${GU.members.length <= 1 ? '<p class="muted guild-tip">把公会码发给同事。对方需要能打开这个页面（在页面右上角的分享里给他们权限），用 claude.ai 账号登录后在「角色」页输入公会码。</p>' : ''}
    </div>`;
}

function guildAct(act, el) {
  const v = guildActSync(act, el);
  if (v instanceof Promise) { v.catch(() => {}); return 'noop'; }
  return v;
}
function guildActSync(act, el) {
  switch (act) {
    case 'gu-ui': GU.ui = el.dataset.v; return true;
    case 'gu-cancel': GU.ui = null; return true;
    case 'gu-create': return (async () => {
      const name = (document.getElementById('gu-name')?.value || '').trim();
      if (!name) { toast('起个公会名'); return; }
      const code = newCode();
      try {
        await GU.db.doc(`guilds/${code}`).set({ name, createdBy: GU.me, createdAt: Date.now() });
        data.guild = code; GU.ui = null; save(); watchGuild();
        toast(`公会「${name}」已创建，公会码 ${code}`);
        render();
      } catch (e) { toast('创建失败：你可能只有查看权限'); }
    })();
    case 'gu-join': return (async () => {
      const code = (document.getElementById('gu-code')?.value || '').trim().toUpperCase();
      if (!/^[A-Z0-9]{6}$/.test(code)) { toast('公会码是 6 位字母数字'); return; }
      try {
        const s = await GU.db.doc(`guilds/${code}`).get();
        if (!s.exists) { toast('没找到这个公会，检查一下公会码'); return; }
        data.guild = code; GU.ui = null; save(); watchGuild();
        toast(`已加入「${s.data().name}」`);
        render();
      } catch (e) { toast('加入失败，稍后再试'); }
    })();
    case 'gu-leave':
      data.guild = null; save();
      GU.sent = ''; pushMe(); watchGuild();
      toast('已退出公会');
      return true;
    case 'gu-copy': return (async () => {
      const text = `来「练了吗」和我组公会，一起冲每周目标！打开页面 →「角色」→ 输入公会码 ${data.guild}`;
      try { await navigator.clipboard.writeText(text); toast('邀请文字已复制'); } catch (e) { toast(`公会码：${data.guild}`); }
    })();
  }
  return false;
}
