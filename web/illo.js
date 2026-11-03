/* 封面插画：用演示的同一套姿势，画成有肤色、背心、短裤、球鞋的扁平小人
   依赖 figure.js：DEMOS, DEMOS_FRONT, lerpPose, solveSide, solveFront, sceneSvg, propAt, f1, GROUND */

const lerpPt = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const ln = (p, q, cls, w) => `<line x1="${f1(p[0])}" y1="${f1(p[1])}" x2="${f1(q[0])}" y2="${f1(q[1])}" class="${cls}"${w ? ` stroke-width="${w}"` : ''}/>`;

function illoSide(s, d) {
  let out = '';
  const leg = (l, far) => {
    const mid = lerpPt(s.hip, l.knee, .62);
    const c = far ? ' far' : '';
    return ln(s.hip, mid, 'il-shorts' + c, 10) + ln(mid, l.knee, 'il-skin' + c, 7.5) + ln(l.knee, l.ankle, 'il-skin' + c, 6.5)
      + ln(l.ankle, l.toe, 'il-shoe' + c, 6) + ln(l.ankle, l.toe, 'il-sole' + c, 1.6);
  };
  const arm = (a, far) => {
    const c = far ? ' far' : '';
    let o = ln(s.sho, a.elbow, 'il-skin' + c, 6.5) + ln(a.elbow, a.hand, 'il-skin' + c, 5.5);
    if (d.prop && !far) o += propAt(d.prop, a.hand);
    return o;
  };
  s.legs.filter(l => l.far).forEach(l => { out += leg(l, true); });
  s.arms.filter(a => a.far).forEach(a => { out += arm(a, true); });
  // 躯干：背心 + 短裤腰
  out += ln(s.hip, lerpPt(s.hip, s.sho, .22), 'il-shorts', 12.5);
  out += ln(lerpPt(s.hip, s.sho, .18), s.sho, 'il-top', 13);
  out += ln(s.sho, s.neck, 'il-skin', 5);
  out += `<circle cx="${f1(s.head[0])}" cy="${f1(s.head[1])}" r="7.6" class="il-skin-f"/>` + hairCap(s.head, s.neck);
  s.legs.filter(l => !l.far).forEach(l => { out += leg(l, false); });
  s.arms.filter(a => !a.far).forEach(a => { out += arm(a, false); });
  return out;
}
function illoFront(s, d, pose) {
  let out = '';
  s.legs.forEach(l => {
    const mid = lerpPt(l.hip, l.knee, .62);
    out += ln(l.hip, mid, 'il-shorts', 10) + ln(mid, l.knee, 'il-skin', 7.5) + ln(l.knee, l.ankle, 'il-skin', 6.5) + ln(l.ankle, l.toe, 'il-shoe', 6);
  });
  out += ln(pose.hip, lerpPt(pose.hip, s.shoC, .25), 'il-shorts', 17);
  out += ln(lerpPt(pose.hip, s.shoC, .2), s.shoC, 'il-top', 17);
  if (d.prop === 'bar') {
    const [l, r] = [s.arms[0].hand, s.arms[1].hand];
    out += ln([l[0] - 16, l[1]], [r[0] + 16, r[1]], 'prop') +
      `<rect x="${f1(l[0] - 19)}" y="${f1(l[1] - 8)}" width="4" height="16" rx="1.5" class="il-plate"/><rect x="${f1(r[0] + 15)}" y="${f1(r[1] - 8)}" width="4" height="16" rx="1.5" class="il-plate"/>`;
  }
  s.arms.forEach(a => {
    if (d.cable) out += ln(a.hand, d.cable[s.arms.indexOf(a)], 'cable');
    out += ln(a.sho, a.elbow, 'il-skin', 6.5) + ln(a.elbow, a.hand, 'il-skin', 5.5);
    if (d.prop && d.prop !== 'bar') out += propAt(d.prop, a.hand, true);
  });
  out += `<circle cx="${f1(s.head[0])}" cy="${f1(s.head[1])}" r="7.6" class="il-skin-f"/>`;
  out += hairCap(s.head, [s.head[0], s.head[1] + 10]);
  return out;
}
// 头发：沿「头顶方向」取半圆，略偏后脑
function hairCap(head, neck) {
  const L = Math.hypot(head[0] - neck[0], head[1] - neck[1]) || 1;
  const u = [(head[0] - neck[0]) / L, (head[1] - neck[1]) / L], p = [-u[1], u[0]];
  const pts = [];
  for (let i = 0; i <= 10; i++) {
    const t = Math.PI * i / 10 - .25;
    pts.push([head[0] + (p[0] * Math.cos(t) + u[0] * Math.sin(t)) * 8, head[1] + (p[1] * Math.cos(t) + u[1] * Math.sin(t)) * 8]);
  }
  return `<polygon points="${pts.map(q => f1(q[0]) + ',' + f1(q[1])).join(' ')}" class="il-hair"/>`;
}
// 封面插画：背景圆 + 地面 + 小人
function illoSvg(id, k = .62, view) {
  const d = view === 'front' && DEMOS_FRONT[id] ? DEMOS_FRONT[id] : DEMOS[id];
  if (!d) return '';
  const pose = lerpPose(d.A, d.B || d.A, k);
  const s = d.v === 'front' ? solveFront(pose) : solveSide(pose);
  const body = d.v === 'front' ? illoFront(s, d, pose) : illoSide(s, d);
  // 取景：把小人（和器械）框进来再留白，小图里也能放大
  const pts = [s.head, ...(s.arms || []).flatMap(a => [a.hand, a.elbow]), ...(s.legs || []).flatMap(l => [l.toe, l.ankle, l.knee])];
  if (pose.hip) pts.push(pose.hip);
  (d.scene || []).forEach(([kind, ...v]) => { if (kind === 'rect') pts.push([v[0], v[1]], [v[0] + v[2], v[1] + v[3]]); else pts.push([v[0], v[1]], [v[2], v[3]]); });
  let x0 = Math.min(...pts.map(p => p[0])) - 12, x1 = Math.max(...pts.map(p => p[0])) + 12;
  let y0 = Math.min(...pts.map(p => p[1])) - 14, y1 = GROUND + 6;
  if (d.prop === 'bar') { x0 -= 10; x1 += 10; }
  const w = Math.max(x1 - x0, 64), h = Math.max(y1 - y0, 64), cx = (x0 + x1) / 2;
  x0 = cx - w / 2;
  const r = Math.max(w, h) * .42;
  return `<svg viewBox="${f1(x0)} ${f1(y0)} ${f1(w)} ${f1(h)}" preserveAspectRatio="xMidYMax meet" class="illo" aria-hidden="true">
    <circle cx="${f1(cx)}" cy="${f1(y0 + h * .45)}" r="${f1(r)}" class="il-sun"/>
    <rect x="${f1(x0 - 20)}" y="${GROUND}" width="${f1(w + 40)}" height="30" class="il-floor"/>
    <ellipse cx="${f1((pose.hip?.[0] ?? cx) + 4)}" cy="${GROUND + 1}" rx="${f1(Math.min(30, w * .35))}" ry="3" class="il-shadow"/>
    ${sceneSvg(d.scene)}${body}</svg>`;
}
