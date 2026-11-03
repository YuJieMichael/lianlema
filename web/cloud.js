/* 云存档：每个人的数据存在自己私有的 data/users/<id>/ 下（别人包括页面主人都看不到）
   core = 除训练记录外的一切；log-YYYY-MM = 每月的训练记录（单个文档上限 256 KiB，按月切开）
   依赖 app.js 的全局：data, STORE_KEY, render, toast */
const Cloud = { state: 'local', at: 0, msg: '' }; // local | loading | synced | saving | error | offline
(function () {
  let db = null, base = null, ready = false, timer = null;
  const sent = {};

  const split = d => {
    const { logs, ...core } = d;
    const out = { core: JSON.stringify(core) };
    for (const [k, v] of Object.entries(logs || {})) {
      const m = 'log-' + k.slice(0, 7);
      (out[m] ??= {})[k] = v;
    }
    for (const k of Object.keys(out)) if (k !== 'core') out[k] = JSON.stringify(out[k]);
    // 每张打卡照片单独一个文档
    for (const p of d.photos || []) { const img = typeof PHOTOS !== 'undefined' && PHOTOS.get(p.id); if (img) out['photo-' + p.id] = img; }
    return out;
  };

  // 两份数据合并：记录类取并集 / 较大值，设置类以最近修改的那份为准
  function merge(local, cloud) {
    const newer = (cloud.updatedAt || 0) > (local.updatedAt || 0) ? cloud : local;
    const older = newer === cloud ? local : cloud;
    const m = { ...older, ...newer };
    const logs = { ...(older.logs || {}) };
    for (const [day, log] of Object.entries(newer.logs || {})) {
      const o = logs[day] || {};
      const merged = { ...o };
      for (const [ex, e] of Object.entries(log)) if (!merged[ex] || (e.sets?.length || 0) >= (merged[ex].sets?.length || 0)) merged[ex] = e;
      logs[day] = merged;
    }
    m.logs = logs;
    const maxMap = (a = {}, b = {}) => { const r = { ...a }; for (const [k, v] of Object.entries(b)) r[k] = Math.max(r[k] || 0, v || 0); return r; };
    m.xp = maxMap(local.xp, cloud.xp);
    m.done = maxMap(local.done, cloud.done);
    const water = { ...(older.water || {}) };
    for (const [k, v] of Object.entries(newer.water || {})) if (!water[k] || v.length >= water[k].length) water[k] = v;
    m.water = water;
    const pr = { ...(older.pr || {}) };
    for (const [k, v] of Object.entries(newer.pr || {})) if (!pr[k] || (v.score || 0) >= (pr[k].score || 0)) pr[k] = v;
    m.pr = pr;
    const body = new Map((older.body || []).map(p => [p.date, p]));
    (newer.body || []).forEach(p => body.set(p.date, p));
    m.body = [...body.values()].sort((a, b) => a.date.localeCompare(b.date));
    const cust = new Map([...(older.customEx || []), ...(newer.customEx || [])].map(e => [e.id, e]));
    m.customEx = [...cust.values()];
    const del = new Set([...(local.photoDel || []), ...(cloud.photoDel || [])]);
    m.photoDel = [...del];
    const ph = new Map([...(older.photos || []), ...(newer.photos || [])].map(p => [p.id, p]));
    m.photos = [...ph.values()].filter(p => !del.has(p.id)).sort((a, b) => b.id.localeCompare(a.id));
    m.updatedAt = Math.max(local.updatedAt || 0, cloud.updatedAt || 0);
    return m;
  }

  async function push() {
    timer = null;
    if (!ready || !db) return;
    const parts = split(data);
    const changed = Object.entries(parts).filter(([k, v]) => sent[k] !== v);
    if (!changed.length) { Cloud.state = 'synced'; return; }
    Cloud.state = 'saving'; paint();
    try {
      // 一次只写一个文档，按顺序来
      for (const [k, v] of changed) {
        if (v.length > 250000) throw { code: 'too_big', message: k };
        await db.doc(`${base}/${k}`).set({ json: v, updatedAt: Date.now() });
        sent[k] = v;
      }
      Cloud.state = 'synced'; Cloud.at = Date.now();
    } catch (e) {
      Cloud.state = e?.code === 'unavailable' || !navigator.onLine ? 'offline' : 'error';
      Cloud.msg = e?.code || '';
      setTimeout(schedule, 15000); // 稍后再试一次
    }
    paint();
  }
  function schedule() { if (ready && !timer) timer = setTimeout(push, 1500); }
  window.cloudSaved = schedule;
  window.cloudDelete = async name => { delete sent[name]; try { if (db) await db.doc(`${base}/${name}`).delete(); } catch (e) { /* 下次再说 */ } };
  window.addEventListener('online', schedule);

  function paint() {
    document.querySelectorAll('[data-cloud]').forEach(el => { el.innerHTML = cloudLabel(); el.className = 'cloud-st ' + Cloud.state; });
  }
  window.cloudPaint = paint;

  async function boot() {
    if (!window.claude?.use) return; // 本地打开、不在 claude.ai 里
    Cloud.state = 'loading';
    const [d, u] = await Promise.all([claude.use('db'), claude.use('user')]);
    if (!d || !u) { Cloud.state = 'local'; paint(); return; }
    const id = await u.id();
    if (!id) { Cloud.state = 'local'; paint(); return; }
    db = d; base = `data/users/${id}`;
    window.cloudUserId = id;
    try {
      const snap = await db.collection(base).get();
      const docs = {};
      snap.docs.forEach(s => { const v = s.data(); if (v?.json) docs[s.id] = v.json; });
      if (docs.core) {
        const cloud = JSON.parse(docs.core);
        cloud.logs = {};
        for (const [k, v] of Object.entries(docs)) if (k.startsWith('log-')) Object.assign(cloud.logs, JSON.parse(v));
        for (const [k, v] of Object.entries(docs)) if (k.startsWith('photo-') && typeof PHOTOS !== 'undefined') PHOTOS.set(k.slice(6), v);
        const hadLocal = Object.keys(data.logs).length || data.profile;
        const merged = merge(data, cloud);
        for (const k of Object.keys(data)) if (!(k in merged)) delete data[k];
        Object.assign(data, merged);
        registerCustom();
        if (typeof photoSaveLocal === 'function') photoSaveLocal();
        try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
        Object.assign(sent, docs);
        if (!hadLocal && Object.keys(data.logs).length) toast('已从云端恢复你的存档');
        if (typeof state !== 'undefined' && data.profile) state.quiz = null;
        render();
      }
      ready = true; Cloud.state = 'synced'; Cloud.at = Date.now();
      push();
    } catch (e) {
      Cloud.state = 'error'; Cloud.msg = e?.code || '';
    }
    paint();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();

function cloudLabel() {
  const ago = Cloud.at ? Math.round((Date.now() - Cloud.at) / 60000) : null;
  return {
    local: '仅保存在这台设备（登录 claude.ai 打开即可云同步）',
    loading: '正在连接云存档…',
    synced: `已云同步${ago === null ? '' : ago < 1 ? ' · 刚刚' : ` · ${ago} 分钟前`}`,
    saving: '正在同步…',
    offline: '离线中，联网后自动同步',
    error: `同步出错${Cloud.msg ? `（${Cloud.msg}）` : ''}，稍后自动重试`,
  }[Cloud.state];
}
