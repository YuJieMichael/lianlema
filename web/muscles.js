/* 肌肉示意图：正面 + 背面，主要发力深色、辅助发力浅色
   坐标系：每个视图 100 × 200，人体中线 x = 50；左右对称的肌肉只写左半边，自动镜像 */

const MUSCLE_NAME = {
  neck: '颈部', traps: '斜方肌', frontDelt: '三角肌前束', sideDelt: '三角肌中束', rearDelt: '三角肌后束',
  chest: '胸大肌', biceps: '肱二头肌', triceps: '肱三头肌', forearms: '前臂',
  abs: '腹直肌', obliques: '腹斜肌', hipflex: '髂腰肌', lats: '背阔肌', midback: '菱形肌 · 中背',
  lowback: '竖脊肌 · 下背', glutes: '臀大肌', quads: '股四头肌', hamstrings: '腘绳肌', calves: '小腿',
};

// [肌肉, 视图, 多边形点(左半边)]；mirror:false 的是居中的一整块
const MUSCLE_SHAPES = [
  // ---- 正面 ----
  ['neck', 'f', [[46, 23], [44, 30], [48, 31]]],
  ['traps', 'f', [[44, 27], [35, 32], [44, 32]]],
  ['frontDelt', 'f', [[36, 32], [29, 33], [26, 41], [29, 46], [35, 41]]],
  ['sideDelt', 'f', [[29, 33], [24, 37], [23, 44], [26, 46], [26, 41]]],
  ['chest', 'f', [[49, 33], [37, 33], [34, 42], [37, 50], [49, 51]]],
  ['biceps', 'f', [[27, 47], [33, 44], [32, 62], [26, 63]]],
  ['forearms', 'f', [[26, 65], [32, 64], [29, 86], [22, 85]]],
  ['abs', 'f', [[44, 53], [56, 53], [56, 84], [50, 88], [44, 84]], false],
  ['obliques', 'f', [[37, 53], [43, 54], [43, 84], [39, 82], [36, 67]]],
  ['hipflex', 'f', [[40, 86], [47, 90], [44, 96], [38, 92]]],
  ['quads', 'f', [[37, 94], [44, 98], [48, 92], [48, 126], [41, 130], [36, 112]]],
  ['calves', 'f', [[39, 136], [46, 136], [45, 168], [41, 168]]],
  // ---- 背面 ----
  ['traps', 'b', [[50, 22], [45, 26], [36, 32], [44, 36], [50, 48]], true],
  ['rearDelt', 'b', [[36, 32], [29, 33], [26, 40], [30, 44], [35, 39]]],
  ['sideDelt', 'b', [[29, 33], [24, 37], [23, 44], [26, 46], [26, 40]]],
  ['midback', 'b', [[44, 37], [50, 48], [50, 54], [44, 52], [41, 44]]],
  ['lats', 'b', [[36, 40], [41, 45], [44, 53], [49, 58], [47, 68], [40, 72], [35, 56]]],
  ['triceps', 'b', [[26, 46], [33, 44], [32, 62], [26, 63]]],
  ['forearms', 'b', [[26, 65], [32, 64], [29, 86], [22, 85]]],
  ['lowback', 'b', [[44, 60], [49, 60], [49, 84], [43, 82]]],
  ['glutes', 'b', [[37, 84], [49, 86], [49, 102], [41, 104], [36, 97]]],
  ['hamstrings', 'b', [[37, 104], [48, 106], [47, 128], [41, 130], [37, 118]]],
  ['calves', 'b', [[38, 134], [47, 134], [46, 158], [42, 166], [38, 152]]],
];

// 人体轮廓（左半边，镜像成整体）
const BODY_OUTLINE = [[50, 4], [56, 6], [58, 13], [56, 21], [54, 25], [62, 29], [72, 32], [76, 38], [77, 46], [75, 62], [77, 86], [79, 96], [75, 98],
  [71, 88], [69, 66], [67, 52], [64, 64], [65, 84], [64, 94], [63, 128], [62, 136], [61, 168], [63, 176], [55, 177], [55, 168], [54, 136],
  [52, 104], [50, 100]];

const mirrorPts = pts => pts.map(([x, y]) => [100 - x, y]);
const ptsStr = pts => pts.map(p => p.join(',')).join(' ');

// 每个动作：主要 / 辅助
const EX_MUSCLES = {
  wallsit: [['quads'], ['glutes']], 'desk-pushup': [['chest'], ['triceps', 'frontDelt']], 'chair-squat': [['quads', 'glutes'], ['hamstrings']],
  'calf-raise': [['calves'], []], 'neck-stretch': [['neck', 'traps'], []], 'chest-open': [['chest', 'frontDelt'], []], 'hip-flexor': [['hipflex'], ['quads']],
  'wall-angel': [['midback', 'traps', 'rearDelt'], ['sideDelt']], 'door-row': [['lats', 'midback'], ['biceps', 'rearDelt']],
  'standing-knee': [['abs', 'hipflex'], ['obliques']], 'desk-plank': [['abs'], ['obliques', 'frontDelt']],
  bench: [['chest'], ['triceps', 'frontDelt']], 'db-bench': [['chest'], ['triceps', 'frontDelt']], 'incline-db': [['chest', 'frontDelt'], ['triceps']],
  pushup: [['chest'], ['triceps', 'frontDelt', 'abs']], 'knee-pushup': [['chest'], ['triceps', 'frontDelt']], fly: [['chest'], ['frontDelt']],
  pullup: [['lats'], ['biceps', 'midback', 'forearms']], row: [['midback', 'lats'], ['rearDelt', 'biceps', 'lowback']],
  'db-row': [['lats', 'midback'], ['biceps', 'rearDelt']], pulldown: [['lats'], ['biceps', 'midback']], 'seated-row': [['midback', 'lats'], ['biceps', 'rearDelt']],
  deadlift: [['glutes', 'hamstrings', 'lowback'], ['traps', 'quads', 'forearms']], superman: [['lowback', 'glutes'], ['midback']],
  squat: [['quads', 'glutes'], ['hamstrings', 'lowback']], 'bw-squat': [['quads', 'glutes'], ['hamstrings']], 'goblet-squat': [['quads', 'glutes'], ['abs', 'hamstrings']],
  rdl: [['hamstrings', 'glutes'], ['lowback']], lunge: [['quads', 'glutes'], ['hamstrings', 'calves']], 'step-up': [['quads', 'glutes'], ['calves']],
  'glute-bridge': [['glutes'], ['hamstrings']], 'hip-thrust': [['glutes'], ['hamstrings', 'quads']], legpress: [['quads'], ['glutes']], 'leg-curl': [['hamstrings'], ['calves']],
  ohp: [['frontDelt', 'sideDelt'], ['triceps', 'traps', 'abs']], 'db-press': [['frontDelt', 'sideDelt'], ['triceps']], 'pike-pushup': [['frontDelt'], ['triceps', 'traps']],
  lateral: [['sideDelt'], ['traps']], facepull: [['rearDelt', 'midback'], ['traps']],
  curl: [['biceps'], ['forearms']], hammer: [['biceps', 'forearms'], []], pushdown: [['triceps'], []], 'db-ext': [['triceps'], []],
  dips: [['triceps', 'chest'], ['frontDelt']], 'chair-dip': [['triceps'], ['frontDelt']],
  plank: [['abs'], ['obliques', 'frontDelt', 'glutes']], 'side-plank': [['obliques'], ['abs', 'sideDelt']], crunch: [['abs'], []],
  deadbug: [['abs'], ['obliques', 'hipflex']], 'bird-dog': [['lowback', 'glutes'], ['abs']], legraise: [['abs', 'hipflex'], ['forearms']],
  walk: [['quads', 'calves'], ['glutes']], run: [['quads', 'hamstrings', 'calves'], ['glutes']], bike: [['quads'], ['calves', 'glutes']],
  elliptical: [['quads', 'glutes'], ['hamstrings']], rower: [['lats', 'quads'], ['biceps', 'glutes']], shadowbox: [['frontDelt'], ['obliques', 'triceps']],
  rope: [['calves'], ['forearms']], 'jumping-jack': [['calves', 'sideDelt'], ['quads']], 'high-knee': [['hipflex', 'quads'], ['calves', 'abs']],
};
const PART_MUSCLES = { 胸: [['chest'], ['triceps']], 背: [['lats', 'midback'], ['biceps']], 腿: [['quads', 'glutes'], ['hamstrings']],
  肩: [['frontDelt', 'sideDelt'], ['triceps']], 手臂: [['biceps', 'triceps'], ['forearms']], 核心: [['abs'], ['obliques']], 有氧: [['quads'], ['calves']] };
function musclesOf(id) {
  const e = EX_BY_ID[id];
  return EX_MUSCLES[id] || PART_MUSCLES[e?.mg || e?.part] || [[], []];
}

function bodyView(view, pri, sec) {
  const shapes = MUSCLE_SHAPES.filter(s => s[1] === view).map(([m, , pts, mirror = true]) => {
    const cls = pri.includes(m) ? 'mp' : sec.includes(m) ? 'ms' : 'mn';
    const polys = [pts, ...(mirror ? [mirrorPts(pts)] : [])];
    return polys.map(p => `<polygon points="${ptsStr(p)}" class="${cls}"/>`).join('');
  }).join('');
  const outline = [...BODY_OUTLINE.map(([x, y]) => [100 - x, y]), ...BODY_OUTLINE.slice().reverse().map(([x, y]) => [x, y])];
  return `
    <svg class="mmap" viewBox="16 0 68 188" aria-hidden="true">
      <polygon points="${ptsStr(outline)}" class="mbody"/>
      <circle cx="50" cy="13" r="8.5" class="mhead"/>
      ${shapes}
      <text x="50" y="181" class="mlabel">${view === 'f' ? '正面' : '背面'}</text>
    </svg>`;
}

// 演示框里用：正面 + 背面 + 名称
function muscleMap(id) {
  const [pri, sec] = musclesOf(id);
  if (!pri.length) return '';
  const showF = MUSCLE_SHAPES.some(s => s[1] === 'f' && (pri.includes(s[0]) || sec.includes(s[0])));
  const showB = MUSCLE_SHAPES.some(s => s[1] === 'b' && (pri.includes(s[0]) || sec.includes(s[0])));
  return `
    <div class="mrow">
      <div class="mfigs">${bodyView('f', pri, sec)}${bodyView('b', pri, sec)}</div>
      <div class="mtext">
        <div><i class="mk mp"></i><span>主要</span><b>${pri.map(m => MUSCLE_NAME[m]).join('、')}</b></div>
        ${sec.length ? `<div><i class="mk ms"></i><span>辅助</span><b>${sec.map(m => MUSCLE_NAME[m]).join('、')}</b></div>` : ''}
        ${!showF || !showB ? `<small class="muted">${showF ? '集中在身体正面' : '集中在身体背面'}</small>` : ''}
      </div>
    </div>`;
}
