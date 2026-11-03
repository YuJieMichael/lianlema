/* 打卡照片：练完拍一张，配一句话，发成自己的打卡笔记
   照片压缩成 JPEG 存在本机，并作为单独文档同步到自己私有的云存档（只有自己能看到）
   依赖：data, save, render, toast, state, EX_BY_ID, dateKey, fmtDate, escapeHtml */
const PHOTOS = new Map();
const PH_LS = 'lianlema.photos.v1';
const PH = { draft: null, confirm: null };
try { Object.entries(JSON.parse(localStorage.getItem(PH_LS) || '{}')).forEach(([k, v]) => PHOTOS.set(k, v)); } catch (e) { /* 本机存不了就只放内存和云端 */ }
function photoSaveLocal() {
  try {
    const keep = Object.fromEntries((data.photos || []).slice(0, 30).filter(p => PHOTOS.has(p.id)).map(p => [p.id, PHOTOS.get(p.id)]));
    localStorage.setItem(PH_LS, JSON.stringify(keep));
  } catch (e) { /* 本机空间满了：云端仍然有 */ }
}

// 压缩：最长边 900px，控制在 ~220KB 以内（云端单个文档上限 256KB）
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let side = 900, q = .78, out = '';
      for (let i = 0; i < 6; i++) {
        const k = Math.min(1, side / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        out = c.toDataURL('image/jpeg', q);
        if (out.length < 220000) return resolve({ img: out, w: c.width, h: c.height });
        q -= .1; side -= 120;
      }
      resolve({ img: out, w: img.width, h: img.height });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('图片打不开')); };
    img.src = url;
  });
}

const phInput = document.createElement('input');
phInput.type = 'file'; phInput.accept = 'image/*'; phInput.hidden = true; phInput.id = 'ph-input';
document.addEventListener('DOMContentLoaded', () => document.body.appendChild(phInput));
let phCtxEx = [];
phInput.addEventListener('change', async () => {
  const f = phInput.files?.[0];
  phInput.value = '';
  if (!f) return;
  try {
    const r = await compressImage(f);
    const ex = phCtxEx.length ? phCtxEx : Object.keys(data.logs[dateKey()] || {}).filter(id => EX_BY_ID[id]);
    PH.draft = { id: 'p' + Date.now().toString(36), d: dateKey(), ex, ...r };
    paintCompose();
  } catch (e) { toast('这张图片打不开，换一张试试'); }
});
document.addEventListener('click', e => {
  const b = e.target.closest('[data-photo-add]');
  if (!b) return;
  e.stopPropagation();
  phCtxEx = (b.dataset.ex || '').split(',').filter(Boolean);
  phInput.click(); // 先在点击的同一时刻打开选图，再关掉弹层
  if (state.sheet) { state.sheet = null; render(); }
}, true);

function paintCompose() {
  let el = document.getElementById('ph-compose');
  if (!PH.draft) { el?.remove(); document.body.classList.remove('has-sheet'); return; }
  const d = PH.draft;
  const names = d.ex.map(id => EX_BY_ID[id]?.name).filter(Boolean);
  if (!el) { el = document.createElement('div'); el.id = 'ph-compose'; el.className = 'note'; document.body.appendChild(el); }
  document.body.classList.add('has-sheet');
  el.innerHTML = `
    <div class="note-top"><button class="icon-btn" data-ph="cancel" aria-label="取消">✕</button><span>发打卡</span><span></span></div>
    <div class="note-scroll">
      <div class="ph-img"><img src="${d.img}" alt="打卡照片"></div>
      <div class="note-body">
        <label class="ph-label" for="ph-text">说点什么</label>
        <textarea id="ph-text" class="share-text" maxlength="200" placeholder="${names.length ? `今天练了${names.slice(0, 3).join('、')}` : '今天练得怎么样？'}"></textarea>
        ${names.length ? `<div class="tags">${names.map(n => `<span>#${n}</span>`).join('')}</div>` : ''}
        <p class="muted ph-note">照片只存在你自己的存档里，别人看不到。</p>
      </div>
    </div>
    <div class="note-bar"><button class="btn" data-ph="cancel">取消</button><button class="btn chunky" data-ph="post">发布打卡</button></div>`;
  el.onclick = ev => {
    const a = ev.target.closest('[data-ph]')?.dataset.ph;
    if (a === 'cancel') { PH.draft = null; paintCompose(); }
    if (a === 'post') {
      const text = el.querySelector('#ph-text').value.trim();
      PHOTOS.set(d.id, d.img);
      (data.photos ??= []).unshift({ id: d.id, d: d.d, ex: d.ex, text: text || (names.length ? `今天练了${names.slice(0, 3).join('、')}` : '打卡'), w: d.w, h: d.h });
      PH.draft = null; paintCompose();
      save(); photoSaveLocal();
      toast('打卡已发布');
      render();
    }
  };
}

/* ---------- 展示 ---------- */
function photoCover(p) {
  const url = PHOTOS.get(p.id);
  const ratio = Math.max(.75, Math.min(1.33, (p.w || 3) / (p.h || 4)));
  return { ratio: 1 / ratio, html: `<div class="cover ph-cover" style="aspect-ratio:${ratio.toFixed(3)}">${url ? `<img src="${url}" alt="" loading="lazy">` : '<span class="ph-missing">照片同步中…</span>'}</div>` };
}
function photoCards(limit = 99) {
  return (data.photos || []).slice(0, limit).map(p => {
    const c = photoCover(p);
    return fcard({ act: 'photo-open', id: p.id, ratio: c.ratio, cov: c.html, title: escapeHtml(p.text), au: `我的打卡 · ${p.d.slice(5).replace('-', '/')}`, av: '<span class="fc-av dot t-rose"></span>' });
  });
}
function photoAddCard() {
  return fcard({
    act: 'noop', ratio: .8,
    cov: `<button class="cover t-rose ph-add" style="aspect-ratio:5/4" data-photo-add><span>＋</span><b>拍一张打卡</b></button>`,
    title: '练完拍一张，记录自己的变化', au: '打卡', av: '<span class="fc-av dot t-rose"></span>',
  });
}
function photoNote(id) {
  const p = (data.photos || []).find(x => x.id === id);
  if (!p) { state.photo = null; return ''; }
  const url = PHOTOS.get(id);
  const names = (p.ex || []).map(x => EX_BY_ID[x]?.name).filter(Boolean);
  return `
    <div class="note" role="dialog" aria-modal="true" aria-label="打卡">
      <div class="note-top"><button class="icon-btn" data-act="photo-close" aria-label="返回">←</button><span>我的打卡</span><span></span></div>
      <div class="note-scroll">
        <div class="ph-img">${url ? `<img src="${url}" alt="打卡照片">` : '<span class="ph-missing">照片同步中…</span>'}</div>
        <div class="note-body">
          <p class="note-tip">${escapeHtml(p.text)}</p>
          ${names.length ? `<div class="tags">${names.map(n => `<span>#${n}</span>`).join('')}</div>` : ''}
          <span class="muted">${fmtDate(p.d)}</span>
        </div>
      </div>
      <div class="note-bar one"><button class="btn ${PH.confirm === id ? 'danger' : ''}" data-act="photo-del" data-id="${id}">${PH.confirm === id ? '确认删除这条打卡' : '删除'}</button></div>
    </div>`;
}
function photoAct(act, el) {
  const id = el.dataset.id;
  if (act === 'photo-open') { state.photo = id; PH.confirm = null; return true; }
  if (act === 'photo-close') { state.photo = null; PH.confirm = null; return true; }
  if (act === 'photo-del') {
    if (PH.confirm !== id) { PH.confirm = id; return true; }
    data.photos = (data.photos || []).filter(p => p.id !== id);
    (data.photoDel ??= []).push(id);
    PHOTOS.delete(id); photoSaveLocal();
    window.cloudDelete?.('photo-' + id);
    state.photo = null; PH.confirm = null;
    toast('已删除');
    return true;
  }
  return false;
}
