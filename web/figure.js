'use strict';

/* ---------- 火柴人动作演示 ----------
 * 侧视图（面朝右）：
 *   hip: 髋部坐标；t: 躯干前倾角（0 = 直立，90 = 头朝右水平，-90 = 头朝左水平）；n: 低头角度
 *   四肢角度用「从正下方转向 +x」的度数：0 = 竖直向下，90 = 水平向前，180 = 竖直向上
 *   arm: { s: 大臂角, e: 肘部弯曲, rel: 是否相对躯干 } 或 { at: [x, y] 手的位置, b: 弯曲方向 }
 *   leg: { h: 大腿角, k: 膝盖弯曲, f: 脚尖下压 } 或 { at: [x, y] 脚踝位置, b, f }
 *   arm2 / leg2 是另一侧肢体（颜色更暗）
 * 正视图：hip, tt 侧倾, n 歪头, aL/eL/aR/eR 双臂外展与屈肘, l 双腿张开角
 */

const FIG = { torso: 30, neck: 4, head: 7, ua: 17, fa: 16, th: 21, shin: 21, foot: 8 };
const GROUND = 108;

const rad = d => d * Math.PI / 180;
const dirDown = a => [Math.sin(rad(a)), Math.cos(rad(a))];
const vadd = (p, v, k = 1) => [p[0] + v[0] * k, p[1] + v[1] * k];
function vrot(v, deg) {
  const c = Math.cos(rad(deg)), s = Math.sin(rad(deg));
  return [v[0] * c - v[1] * s, v[0] * s + v[1] * c];
}

// 两段式 IK：从 base 伸向 target，bend 选择关节往哪边弯
function ik(base, target, a, b, bend) {
  const dx = target[0] - base[0], dy = target[1] - base[1];
  const d = Math.min(a + b - 0.01, Math.max(Math.abs(a - b) + 0.01, Math.hypot(dx, dy)));
  const alpha = Math.acos((a * a + d * d - b * b) / (2 * a * d));
  const ang = Math.atan2(dy, dx) + bend * alpha;
  const joint = [base[0] + a * Math.cos(ang), base[1] + a * Math.sin(ang)];
  const vx = target[0] - joint[0], vy = target[1] - joint[1];
  const vl = Math.hypot(vx, vy) || 1;
  return [joint, [joint[0] + vx / vl * b, joint[1] + vy / vl * b]];
}

function limb(base, spec, a, b, defBend, t) {
  if (spec.at) return ik(base, spec.at, a, b, spec.b ?? defBend);
  const s = (spec.s ?? spec.h ?? 0) - (spec.rel ? t : 0);
  const joint = vadd(base, dirDown(s), a);
  return [joint, vadd(joint, dirDown(s + (spec.e ?? 0) - (spec.k ?? 0)), b)];
}

function solveSide(p) {
  const t = p.t || 0;
  const up = [Math.sin(rad(t)), -Math.cos(rad(t))];
  const hip = p.hip;
  const sho = vadd(hip, up, FIG.torso);
  const neck = vadd(sho, up, FIG.neck);
  const headDir = [Math.sin(rad(t + (p.n || 0))), -Math.cos(rad(t + (p.n || 0)))];
  const out = { hip, sho, neck, head: vadd(neck, headDir, FIG.head), arms: [], legs: [] };

  [['leg2', true], ['leg', false]].forEach(([k, far]) => {
    if (!p[k]) return;
    const [knee, ankle] = limb(hip, p[k], FIG.th, FIG.shin, -1, t);
    const sv = [ankle[0] - knee[0], ankle[1] - knee[1]];
    const sl = Math.hypot(...sv) || 1;
    const foot = vrot([sv[1] / sl, -sv[0] / sl], p[k].f || 0);
    out.legs.push({ far, key: k, knee, ankle, toe: vadd(ankle, foot, FIG.foot) });
  });
  [['arm2', true], ['arm', false]].forEach(([k, far]) => {
    if (!p[k]) return;
    const [elbow, hand] = limb(sho, p[k], FIG.ua, FIG.fa, 1, t);
    out.arms.push({ far, key: k, elbow, hand });
  });
  return out;
}

function solveFront(p) {
  const c = p.hip;
  const up = vrot([0, -1], p.tt || 0);
  const shoC = vadd(c, up, FIG.torso);
  const head = vadd(shoC, vrot([0, -1], (p.tt || 0) + (p.n || 0)), FIG.neck + FIG.head);
  const arms = [-1, 1].map(side => {
    const a = side < 0 ? p.aL : p.aR, e = side < 0 ? p.eL : p.eR;
    const sho = [shoC[0] + side * 9, shoC[1]];
    const d1 = dirDown(a || 0), d2 = dirDown((a || 0) + (e || 0));
    const elbow = vadd(sho, [d1[0] * side, d1[1]], FIG.ua);
    return { sho, elbow, hand: vadd(elbow, [d2[0] * side, d2[1]], FIG.fa) };
  });
  const legs = [-1, 1].map(side => {
    const hip = [c[0] + side * 6, c[1]];
    const d = dirDown(p.l || 0);
    const knee = vadd(hip, [d[0] * side, d[1]], FIG.th);
    const ankle = vadd(knee, [d[0] * side, d[1]], FIG.shin);
    return { hip, knee, ankle, toe: vadd(ankle, [side * 6, 0]) };
  });
  return { shoC, head, arms, legs };
}

/* ---------- 绘制 ---------- */

const f1 = n => n.toFixed(1);
function seg(p, q, cls) {
  return `<line x1="${f1(p[0])}" y1="${f1(p[1])}" x2="${f1(q[0])}" y2="${f1(q[1])}" class="${cls}"/>`;
}
function segHl(p, q, base, on) {
  return on ? seg(p, q, 'glow') + seg(p, q, base + ' hl') : seg(p, q, base);
}

function propAt(kind, hand, front) {
  const [x, y] = hand;
  if (kind === 'bar') return front ? '' : `<circle cx="${f1(x)}" cy="${f1(y)}" r="7" class="prop-plate"/>`;
  if (kind === 'db') return `<rect x="${f1(x - 6)}" y="${f1(y - 2.5)}" width="12" height="5" rx="2" class="prop-solid"/>`;
  if (kind === 'handle') return seg([x - 6, y], [x + 6, y], 'prop');
  return '';
}

function sceneSvg(items = []) {
  return items.map(([kind, ...v]) => kind === 'rect'
    ? `<rect x="${v[0]}" y="${v[1]}" width="${v[2]}" height="${v[3]}" rx="2" class="scene-fill"/>`
    : `<line x1="${v[0]}" y1="${v[1]}" x2="${v[2]}" y2="${v[3]}" class="scene" style="stroke-width:${v[4] || 3}"/>`).join('');
}

function drawSide(d, pose) {
  const s = solveSide(pose);
  const hl = new Set(d.hl || []);
  let svg = '';
  const legSvg = l => {
    const b = l.far ? 'lim far' : 'lim';
    return segHl(s.hip, l.knee, b, hl.has(l.key === 'leg2' ? 'th2' : 'th'))
      + segHl(l.knee, l.ankle, b, !l.far && hl.has('shin'))
      + seg(l.ankle, l.toe, b + ' thin');
  };
  const armSvg = a => {
    const b = a.far ? 'lim far' : 'lim';
    let out = segHl(s.sho, a.elbow, b, !a.far && hl.has('ua')) + segHl(a.elbow, a.hand, b, !a.far && hl.has('fa'));
    if (d.cable && !a.far) out = seg(a.hand, d.cable, 'cable') + out;
    if (d.prop && !a.far) out += propAt(d.prop, a.hand);
    return out;
  };
  s.legs.filter(l => l.far).forEach(l => { svg += legSvg(l); });
  s.arms.filter(a => a.far).forEach(a => { svg += armSvg(a); });
  svg += segHl(s.hip, s.sho, 'lim torso', hl.has('torso'));
  svg += segHl(s.sho, s.neck, 'lim', hl.has('neck'));
  svg += `<circle cx="${f1(s.head[0])}" cy="${f1(s.head[1])}" r="${FIG.head}" class="headc"/>`;
  s.legs.filter(l => !l.far).forEach(l => { svg += legSvg(l); });
  s.arms.filter(a => !a.far).forEach(a => { svg += armSvg(a); });
  return svg;
}

function drawFront(d, pose) {
  const s = solveFront(pose);
  const hl = new Set(d.hl || []);
  let svg = '';
  s.legs.forEach(l => {
    svg += segHl(l.hip, l.knee, 'lim', hl.has('th')) + seg(l.knee, l.ankle, 'lim') + seg(l.ankle, l.toe, 'lim thin');
  });
  svg += segHl(pose.hip, s.shoC, 'lim torso', hl.has('torso'));
  svg += seg(s.legs[0].hip, s.legs[1].hip, 'lim') + seg(s.arms[0].sho, s.arms[1].sho, 'lim');
  svg += segHl(s.shoC, vadd(s.shoC, vrot([0, -1], pose.tt || 0), FIG.neck), 'lim', hl.has('neck'));
  svg += `<circle cx="${f1(s.head[0])}" cy="${f1(s.head[1])}" r="${FIG.head}" class="headc"/>`;
  s.arms.forEach((a, i) => {
    if (d.cable) svg += seg(a.hand, d.cable[i], 'cable');
    svg += segHl(a.sho, a.elbow, 'lim', hl.has('ua')) + segHl(a.elbow, a.hand, 'lim', hl.has('fa'));
    if (d.prop) svg += propAt(d.prop, a.hand, true);
  });
  return svg;
}

function lerpPose(a, b, k) {
  if (typeof a === 'number' && typeof b === 'number') return a + (b - a) * k;
  if (Array.isArray(a)) return a.map((v, i) => lerpPose(v, b?.[i] ?? v, k));
  if (a && typeof a === 'object') {
    const o = {};
    for (const key of new Set([...Object.keys(a), ...Object.keys(b || {})])) {
      o[key] = key in a ? lerpPose(a[key], b?.[key] ?? a[key], k) : b[key];
    }
    return o;
  }
  return a;
}

function demoSvg(id, k) {
  const d = DEMOS[id];
  if (!d) return '';
  const pose = lerpPose(d.A, d.B || d.A, k);
  const body = d.v === 'front' ? drawFront(d, pose) : drawSide(d, pose);
  return `<svg viewBox="0 -14 160 126" class="fig" aria-hidden="true">
    <line x1="4" y1="${GROUND}" x2="156" y2="${GROUND}" class="ground"/>
    ${sceneSvg(d.scene)}${body}</svg>`;
}

/* ---------- 动画循环：只画页面上看得见的 .demo ---------- */

const DEMO_PERIOD = 2800;
const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
function demoPhase(ms) {
  const x = (ms % DEMO_PERIOD) / DEMO_PERIOD;
  const k = x < 0.15 ? 0 : x < 0.5 ? (x - 0.15) / 0.35 : x < 0.65 ? 1 : 1 - (x - 0.65) / 0.35;
  return (1 - Math.cos(Math.PI * k)) / 2;
}
let lastDemoFrame = 0;
function tickDemos(ms) {
  if (ms - lastDemoFrame > 33) {
    lastDemoFrame = ms;
    const k = reduceMotion ? 1 : demoPhase(ms);
    document.querySelectorAll('.demo[data-ex]').forEach(el => {
      if (reduceMotion && el.dataset.drawn) return;
      el.innerHTML = demoSvg(el.dataset.ex, k);
      el.dataset.drawn = '1';
    });
  }
  requestAnimationFrame(tickDemos);
}
requestAnimationFrame(tickDemos);

/* ---------- 每个动作的起止姿势 ---------- */

const STAND_LEG = { at: [70, 106] };
const BENCH = [['rect', 28, 92, 64, 5], ['line', 36, 97, 36, 108], ['line', 84, 97, 84, 108]];
const PULL_BAR = [['line', 40, -4, 104, -4, 3]];

const DEMOS = {
  // 工位
  wallsit: { hl: ['th'], scene: [['line', 47, -12, 47, 108, 3]],
    A: { hip: [54, 84], t: 0, leg: { at: [76, 106] }, arm: { s: 8, e: 30 } },
    B: { hip: [54, 85], t: 0, leg: { at: [76, 106] }, arm: { s: 8, e: 30 } } },
  'desk-pushup': { hl: ['torso'], scene: [['rect', 100, 74, 44, 4], ['line', 140, 78, 140, 108]],
    A: { hip: [65.2, 70.8], t: 44, leg: { h: -44, k: 0 }, arm: { at: [104, 74] } },
    B: { hip: [70.8, 77.5], t: 56, leg: { h: -56, k: 0 }, arm: { at: [104, 74] } } },
  'chair-squat': { hl: ['th'], scene: [['rect', 32, 86, 26, 4], ['line', 34, 90, 34, 108], ['line', 56, 90, 56, 108], ['line', 33, 86, 33, 58]],
    A: { hip: [72, 64], t: 2, leg: { at: [76, 106] }, arm: { s: 10, e: 0 } },
    B: { hip: [58, 82], t: 36, leg: { at: [76, 106] }, arm: { s: 88, e: 0 } } },
  'calf-raise': { hl: ['shin'], scene: [['rect', 96, 62, 44, 4], ['line', 136, 66, 136, 108]],
    A: { hip: [70, 64], t: 0, leg: { at: [70, 106], f: 0 }, arm: { at: [98, 62] } },
    B: { hip: [70, 57], t: 0, leg: { at: [70, 99], f: 42 }, arm: { at: [98, 62] } } },
  'neck-stretch': { v: 'front', hl: ['neck'],
    A: { hip: [80, 64], aL: 150, eL: 80, aR: 4, eR: 0, l: 4, n: 0 },
    B: { hip: [80, 64], aL: 150, eL: 80, aR: 4, eR: 0, l: 4, n: -28 } },
  'chest-open': { hl: ['torso'], scene: [['line', 92, -12, 92, 108, 4]],
    A: { hip: [70, 64], t: 0, leg: { at: [70, 106] }, arm: { at: [88, 18], b: 1 } },
    B: { hip: [76, 64], t: 12, leg: { at: [70, 106] }, arm: { at: [88, 18], b: 1 } } },
  'hip-flexor': { hl: ['th2'],
    A: { hip: [62, 86], t: -4, leg: { at: [92, 106] }, leg2: { h: -25, k: 65, f: 90 }, arm: { s: 40, e: 20 } },
    B: { hip: [70, 88], t: -10, leg: { at: [92, 106] }, leg2: { h: -42, k: 48, f: 90 }, arm: { s: 40, e: 20 } } },

  // 胸
  bench: { hl: ['torso'], prop: 'bar', scene: BENCH,
    A: { hip: [84, 88], t: -90, leg: { at: [106, 106] }, arm: { at: [54, 55] } },
    B: { hip: [84, 88], t: -90, leg: { at: [106, 106] }, arm: { at: [57, 76] } } },
  'db-bench': { hl: ['torso'], prop: 'db', scene: BENCH,
    A: { hip: [84, 88], t: -90, leg: { at: [106, 106] }, arm: { at: [54, 55] } },
    B: { hip: [84, 88], t: -90, leg: { at: [106, 106] }, arm: { at: [57, 76] } } },
  'incline-db': { hl: ['torso'], prop: 'db', scene: [['line', 90, 95, 50, 60, 6], ['line', 82, 95, 82, 108]],
    A: { hip: [82, 88], t: -50, leg: { at: [104, 106] }, arm: { at: [60, 34] } },
    B: { hip: [82, 88], t: -50, leg: { at: [104, 106] }, arm: { at: [63, 58] } } },
  pushup: { hl: ['torso'],
    A: { hip: [72.7, 84.6], t: 67, leg: { h: -67, k: 0 }, arm: { at: [103, 106] } },
    B: { hip: [75.8, 96.6], t: 84, leg: { h: -84, k: 0 }, arm: { at: [103, 106] } } },
  'knee-pushup': { hl: ['torso'],
    A: { hip: [79.3, 92.1], t: 55.5, leg: { h: -55.5, k: 34.5, f: 90 }, arm: { at: [106, 106] } },
    B: { hip: [82.7, 100.4], t: 80, leg: { h: -80, k: 10, f: 90 }, arm: { at: [106, 106] } } },
  fly: { v: 'front', hl: ['torso'], prop: 'handle', cable: [[6, -10], [154, -10]],
    A: { hip: [80, 64], aL: 82, eL: 18, aR: 82, eR: 18, l: 6 },
    B: { hip: [80, 64], aL: 32, eL: 64, aR: 32, eR: 64, l: 6 } },

  // 背
  pullup: { hl: ['torso', 'ua'], scene: PULL_BAR,
    A: { hip: [72, 61], t: 0, leg: { h: -12, k: 50 }, arm: { at: [72, -3] } },
    B: { hip: [69, 37], t: 6, leg: { h: -12, k: 50 }, arm: { at: [72, -3] } } },
  row: { hl: ['torso'], prop: 'bar',
    A: { hip: [58, 66], t: 70, leg: { at: [70, 106] }, arm: { at: [86, 90] } },
    B: { hip: [58, 66], t: 70, leg: { at: [70, 106] }, arm: { at: [76, 72] } } },
  'db-row': { hl: ['torso'], prop: 'db', scene: [['rect', 84, 80, 48, 6], ['line', 88, 86, 88, 108], ['line', 128, 86, 128, 108]],
    A: { hip: [56, 66], t: 78, leg: { at: [62, 106] }, arm: { at: [84, 98] }, arm2: { at: [106, 80] } },
    B: { hip: [56, 66], t: 78, leg: { at: [62, 106] }, arm: { at: [70, 76] }, arm2: { at: [106, 80] } } },
  pulldown: { hl: ['torso', 'ua'], prop: 'handle', cable: [70, -14], scene: [['rect', 44, 90, 34, 4], ['line', 60, 94, 60, 108]],
    A: { hip: [62, 86], t: -8, leg: { at: [86, 106] }, arm: { at: [66, 24] } },
    B: { hip: [62, 86], t: -8, leg: { at: [86, 106] }, arm: { at: [64, 50] } } },
  'seated-row': { hl: ['torso'], prop: 'handle', cable: [150, 94], scene: [['rect', 30, 96, 44, 6], ['line', 102, 84, 102, 108, 4]],
    A: { hip: [54, 92], t: 4, leg: { at: [98, 98] }, arm: { at: [90, 70] } },
    B: { hip: [54, 92], t: -6, leg: { at: [98, 98] }, arm: { at: [68, 78] } } },
  deadlift: { hl: ['th', 'torso'], prop: 'bar',
    A: { hip: [54, 74], t: 60, leg: { at: [72, 106] }, arm: { s: 0, e: 0 } },
    B: { hip: [66, 64], t: 0, leg: { at: [72, 106] }, arm: { s: 0, e: 0 } } },
  superman: { hl: ['torso'],
    A: { hip: [72, 99], t: 90, leg: { h: -90, k: 0, f: 90 }, arm: { s: 90, e: 0 } },
    B: { hip: [72, 99], t: 74, leg: { h: -106, k: 0, f: 90 }, arm: { s: 72, e: 0 } } },

  // 腿
  squat: { hl: ['th'], prop: 'bar',
    A: { hip: [68, 64], t: 4, leg: { at: [72, 106] }, arm: { s: -70, e: -140, rel: 1 } },
    B: { hip: [52, 86], t: 42, leg: { at: [72, 106] }, arm: { s: -70, e: -140, rel: 1 } } },
  'bw-squat': { hl: ['th'],
    A: { hip: [68, 64], t: 2, leg: { at: [72, 106] }, arm: { s: 10, e: 0 } },
    B: { hip: [52, 86], t: 38, leg: { at: [72, 106] }, arm: { s: 90, e: 0 } } },
  'goblet-squat': { hl: ['th'], prop: 'db',
    A: { hip: [68, 64], t: 2, leg: { at: [72, 106] }, arm: { s: 15, e: 135, rel: 1 } },
    B: { hip: [54, 86], t: 30, leg: { at: [72, 106] }, arm: { s: 15, e: 135, rel: 1 } } },
  rdl: { hl: ['th'], prop: 'bar',
    A: { hip: [66, 64], t: 0, leg: { at: [72, 106] }, arm: { s: 0, e: 0 } },
    B: { hip: [56, 66], t: 76, leg: { at: [72, 106] }, arm: { s: 0, e: 0 } } },
  lunge: { hl: ['th'], prop: 'db',
    A: { hip: [66, 66], t: 0, leg: { at: [88, 106] }, leg2: { at: [44, 104], f: -30 }, arm: { s: 0, e: 0 } },
    B: { hip: [66, 84], t: 0, leg: { at: [88, 106] }, leg2: { at: [44, 104], f: -30 }, arm: { s: 0, e: 0 } } },
  'step-up': { hl: ['th'], scene: [['rect', 80, 90, 34, 18]],
    A: { hip: [62, 66], t: 12, leg: { at: [88, 88] }, leg2: { at: [56, 106] }, arm: { s: 0, e: 20 } },
    B: { hip: [86, 46], t: 2, leg: { at: [88, 88] }, leg2: { at: [100, 66] }, arm: { s: 0, e: 20 } } },
  'glute-bridge': { hl: ['th'],
    A: { hip: [72, 100], t: -90, leg: { at: [96, 104] }, arm: { at: [62, 106] } },
    B: { hip: [72, 84], t: -118, leg: { at: [96, 104] }, arm: { at: [62, 106] } } },
  'hip-thrust': { hl: ['th'], prop: 'bar', scene: [['rect', 18, 90, 28, 18]],
    A: { hip: [70, 100], t: -67, leg: { at: [94, 104] }, arm: { at: [70, 93] } },
    B: { hip: [71, 86], t: -92, leg: { at: [94, 104] }, arm: { at: [71, 79] } } },
  legpress: { hl: ['th'], scene: [['line', 30, 50, 62, 92, 7]],
    A: { hip: [62, 84], t: -48, leg: { at: [76, 66] }, arm: { s: 30, e: 0 } },
    B: { hip: [62, 84], t: -48, leg: { at: [90, 52] }, arm: { s: 30, e: 0 } } },
  'leg-curl': { hl: ['th'], scene: [['rect', 30, 94, 84, 6], ['line', 40, 100, 40, 108], ['line', 104, 100, 104, 108]],
    A: { hip: [64, 90], t: 90, leg: { h: -90, k: 0 }, arm: { s: 60, e: 40 } },
    B: { hip: [64, 90], t: 90, leg: { h: -90, k: 120 }, arm: { s: 60, e: 40 } } },

  // 肩
  ohp: { hl: ['ua'], prop: 'bar',
    A: { hip: [70, 64], t: -3, leg: STAND_LEG, arm: { at: [78, 34] } },
    B: { hip: [70, 64], t: -3, leg: STAND_LEG, arm: { at: [71, 2] } } },
  'db-press': { hl: ['ua'], prop: 'db', scene: [['rect', 52, 90, 32, 4], ['line', 56, 94, 56, 108], ['line', 80, 94, 80, 108]],
    A: { hip: [66, 86], t: 0, leg: { at: [92, 106] }, arm: { at: [74, 56] } },
    B: { hip: [66, 86], t: 0, leg: { at: [92, 106] }, arm: { at: [67, 22] } } },
  'pike-pushup': { hl: ['ua'],
    A: { hip: [62, 64], t: 115, leg: { at: [44, 101] }, arm: { at: [94, 106] } },
    B: { hip: [62, 64], t: 150, leg: { at: [44, 101] }, arm: { at: [94, 106] } } },
  lateral: { v: 'front', hl: ['ua'], prop: 'db',
    A: { hip: [80, 64], aL: 6, eL: 8, aR: 6, eR: 8, l: 4 },
    B: { hip: [80, 64], aL: 86, eL: 8, aR: 86, eR: 8, l: 4 } },
  facepull: { hl: ['ua'], prop: 'handle', cable: [150, 24],
    A: { hip: [66, 64], t: -6, leg: { at: [66, 106] }, arm: { at: [98, 30], b: -1 } },
    B: { hip: [66, 64], t: -6, leg: { at: [66, 106] }, arm: { at: [80, 24], b: -1 } } },

  // 手臂
  curl: { hl: ['ua'], prop: 'db',
    A: { hip: [70, 64], t: 0, leg: STAND_LEG, arm: { s: 2, e: 4 } },
    B: { hip: [70, 64], t: 0, leg: STAND_LEG, arm: { s: 8, e: 135 } } },
  hammer: { hl: ['ua', 'fa'], prop: 'db',
    A: { hip: [70, 64], t: 0, leg: STAND_LEG, arm: { s: 2, e: 4 } },
    B: { hip: [70, 64], t: 0, leg: STAND_LEG, arm: { s: 8, e: 135 } } },
  pushdown: { hl: ['ua'], prop: 'handle', cable: [84, -14],
    A: { hip: [68, 64], t: 8, leg: { at: [66, 106] }, arm: { s: 0, e: 110 } },
    B: { hip: [68, 64], t: 8, leg: { at: [66, 106] }, arm: { s: 0, e: 4 } } },
  'db-ext': { hl: ['ua'], prop: 'db',
    A: { hip: [70, 64], t: 0, leg: STAND_LEG, arm: { s: 172, e: 150 } },
    B: { hip: [70, 64], t: 0, leg: STAND_LEG, arm: { s: 172, e: 8 } } },
  dips: { hl: ['ua'], scene: [['line', 48, 49, 96, 49, 3], ['line', 92, 49, 92, 108, 3]],
    A: { hip: [70, 46], t: 6, leg: { h: -25, k: 70 }, arm: { at: [72, 48] } },
    B: { hip: [64, 64], t: 16, leg: { h: -25, k: 70 }, arm: { at: [72, 48] } } },
  'chair-dip': { hl: ['ua'], scene: [['rect', 22, 74, 32, 4], ['line', 24, 78, 24, 108], ['line', 52, 78, 52, 108]],
    A: { hip: [58, 74], t: 0, leg: { at: [84, 106] }, arm: { at: [52, 74] } },
    B: { hip: [57, 92], t: 4, leg: { at: [84, 106] }, arm: { at: [52, 74] } } },

  // 核心
  plank: { hl: ['torso'],
    A: { hip: [64, 92.2], t: 82, leg: { h: -82, k: 0 }, arm: { s: 0, e: 90 } },
    B: { hip: [64, 93], t: 82, leg: { h: -82, k: 0 }, arm: { s: 0, e: 90 } } },
  'side-plank': { hl: ['torso'],
    A: { hip: [64, 95.3], t: 76, leg: { h: -76, k: 0 }, arm: { s: 0, e: 90 }, arm2: { s: 170, e: 0 } },
    B: { hip: [64, 94.3], t: 76, leg: { h: -76, k: 0 }, arm: { s: 0, e: 90 }, arm2: { s: 170, e: 0 } } },
  crunch: { hl: ['torso'],
    A: { hip: [74, 100], t: -90, leg: { at: [96, 104] }, arm: { s: 160, e: 40, rel: 1 } },
    B: { hip: [74, 100], t: -62, leg: { at: [96, 104] }, arm: { s: 160, e: 40, rel: 1 } } },
  deadbug: { hl: ['torso'],
    A: { hip: [72, 100], t: -90, leg: { h: 180, k: 90 }, leg2: { h: 180, k: 90 }, arm: { s: 180, e: 0 }, arm2: { s: 180, e: 0 } },
    B: { hip: [72, 100], t: -90, leg: { h: 100, k: 0 }, leg2: { h: 180, k: 90 }, arm: { s: 270, e: 0 }, arm2: { s: 180, e: 0 } } },
  'bird-dog': { hl: ['torso'],
    A: { hip: [56, 84], t: 66, leg: { h: 0, k: 90, f: 90 }, leg2: { h: 0, k: 90, f: 90 }, arm: { s: 0, e: 0 }, arm2: { s: 0, e: 0 } },
    B: { hip: [56, 84], t: 66, leg: { h: -100, k: 0, f: 0 }, leg2: { h: 0, k: 90, f: 90 }, arm: { s: 110, e: 0 }, arm2: { s: 0, e: 0 } } },
  legraise: { hl: ['torso'], scene: PULL_BAR,
    A: { hip: [72, 61], t: 0, leg: { h: 0, k: 0 }, arm: { at: [72, -3] } },
    B: { hip: [72, 61], t: -8, leg: { h: 85, k: 10 }, arm: { at: [72, -3] } } },

  // 有氧
  walk: { hl: ['th'],
    A: { hip: [70, 65], t: 3, leg: { h: 20, k: 8 }, leg2: { h: -18, k: 14 }, arm: { s: -22, e: 25 }, arm2: { s: 22, e: 25 } },
    B: { hip: [70, 64], t: 3, leg: { h: -18, k: 14 }, leg2: { h: 20, k: 8 }, arm: { s: 22, e: 25 }, arm2: { s: -22, e: 25 } } },
  bike: { hl: ['th'], scene: [['line', 52, 64, 70, 64, 4], ['line', 61, 64, 76, 104, 3], ['line', 56, 106, 108, 106, 3], ['line', 98, 46, 88, 106, 3], ['line', 92, 46, 104, 46, 3]],
    A: { hip: [62, 60], t: 32, leg: { at: [86, 98] }, leg2: { at: [80, 82] }, arm: { at: [98, 46] } },
    B: { hip: [62, 60], t: 32, leg: { at: [80, 82] }, leg2: { at: [86, 98] }, arm: { at: [98, 46] } } },
  elliptical: { hl: ['th'], scene: [['line', 46, 104, 110, 104, 4]],
    A: { hip: [72, 58], t: 4, leg: { at: [84, 96] }, leg2: { at: [64, 100] }, arm: { at: [92, 46] }, arm2: { at: [82, 56] } },
    B: { hip: [72, 58], t: 4, leg: { at: [64, 100] }, leg2: { at: [84, 96] }, arm: { at: [82, 56] }, arm2: { at: [92, 46] } } },
  rower: { hl: ['th', 'torso'], prop: 'handle', cable: [146, 92], scene: [['rect', 30, 100, 110, 4], ['line', 104, 82, 104, 104, 4]],
    A: { hip: [70, 96], t: 22, leg: { at: [100, 96] }, arm: { at: [104, 84] } },
    B: { hip: [52, 96], t: -18, leg: { at: [100, 96] }, arm: { at: [64, 78] } } },
  shadowbox: { hl: ['ua'],
    A: { hip: [70, 64], t: 6, leg: { at: [82, 106] }, leg2: { at: [60, 106] }, arm: { at: [86, 36] }, arm2: { at: [82, 40] } },
    B: { hip: [72, 64], t: 10, leg: { at: [82, 106] }, leg2: { at: [60, 106] }, arm: { at: [110, 34] }, arm2: { at: [82, 40] } } },
  run: { hl: ['th'],
    A: { hip: [70, 62], t: 10, leg: { h: 45, k: 85 }, leg2: { h: -25, k: 25 }, arm: { s: -40, e: 80 }, arm2: { s: 35, e: 80 } },
    B: { hip: [70, 60], t: 10, leg: { h: -25, k: 25 }, leg2: { h: 45, k: 85 }, arm: { s: 35, e: 80 }, arm2: { s: -40, e: 80 } } },
  rope: { hl: ['shin'],
    A: { hip: [70, 64], t: 0, leg: { h: 0, k: 0, f: 0 }, arm: { s: 25, e: 30 } },
    B: { hip: [70, 56], t: 0, leg: { h: 8, k: 16, f: 25 }, arm: { s: 25, e: 30 } } },
  'jumping-jack': { v: 'front', hl: ['th'],
    A: { hip: [80, 64], aL: 12, eL: 0, aR: 12, eR: 0, l: 3 },
    B: { hip: [80, 66], aL: 165, eL: 0, aR: 165, eR: 0, l: 18 } },
  'high-knee': { hl: ['th'],
    A: { hip: [70, 64], t: 0, leg: { h: 90, k: 95 }, leg2: { h: 0, k: 0 }, arm: { s: -30, e: 80 }, arm2: { s: 40, e: 80 } },
    B: { hip: [70, 64], t: 0, leg: { h: 0, k: 0 }, leg2: { h: 90, k: 95 }, arm: { s: 40, e: 80 }, arm2: { s: -30, e: 80 } } },
};
