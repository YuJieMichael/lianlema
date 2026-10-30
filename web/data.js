'use strict';

/* ---------- 动作数据 ---------- */

const PARTS = ['工位', '胸', '背', '腿', '肩', '手臂', '核心', '有氧'];
const PART_EMOJI = { 工位: '💼', 胸: '💪', 背: '🦅', 腿: '🦵', 肩: '🏔️', 手臂: '💥', 核心: '🧱', 有氧: '🏃', 拉伸: '🧘' };
const JOINT_NAME = { 膝: '膝盖', 腰: '腰', 肩: '肩膀', 腕: '手腕', 踝: '脚踝' };
const EQ_LABEL = { none: '🏠 无器材', db: '🏋️ 哑铃', gym: '🏢 健身房' };

// mg: 主要肌群（不填同 part）；eq: 需要的器材；joints: 压力大的关节（用于避开伤病）
// bw: 自重动作（重量填附加负重）；rl: 次数单位；target: 默认目标次数/秒数
const EXERCISES = [
  { id: 'wallsit', name: '靠墙静蹲', part: '工位', mg: '腿', eq: 'none', bw: true, rl: '秒', target: 30, joints: ['膝'], tip: '背贴墙往下滑，膝盖约 90°，膝盖不超过脚尖。' },
  { id: 'desk-pushup', name: '桌边俯卧撑', part: '工位', mg: '胸', eq: 'none', bw: true, target: 12, joints: ['腕'], tip: '双手撑稳桌沿，身体一条直线，胸口靠近桌边再推起。' },
  { id: 'chair-squat', name: '椅子深蹲', part: '工位', mg: '腿', eq: 'none', bw: true, target: 15, joints: ['膝'], tip: '屁股往后坐，轻碰椅面马上站起，不要真的坐下。' },
  { id: 'calf-raise', name: '站姿提踵', part: '工位', mg: '腿', eq: 'none', bw: true, target: 20, joints: ['踝'], tip: '扶着桌子，脚跟抬到最高停 1 秒再慢慢放下。' },
  { id: 'neck-stretch', name: '颈肩拉伸', part: '工位', mg: '拉伸', eq: 'none', bw: true, rl: '秒', target: 30, tip: '一只手把头轻轻拉向一侧，另一侧肩膀往下沉。' },
  { id: 'chest-open', name: '靠门扩胸拉伸', part: '工位', mg: '拉伸', eq: 'none', bw: true, rl: '秒', target: 30, joints: ['肩'], tip: '小臂贴门框，身体慢慢往前走，打开含了一天的胸。' },
  { id: 'hip-flexor', name: '跪姿髋屈肌拉伸', part: '工位', mg: '拉伸', eq: 'none', bw: true, rl: '秒', target: 30, tip: '后膝跪地，收紧臀部把骨盆往前推，坐久了的大腿前侧会被拉开。' },

  { id: 'bench', name: '杠铃卧推', part: '胸', eq: 'gym', joints: ['肩', '腕'], tip: '肩胛后收下沉，杠铃下放到乳头连线，脚踩实地面。' },
  { id: 'db-bench', name: '哑铃卧推', part: '胸', eq: 'db', joints: ['肩'], tip: '肩胛贴紧凳面，哑铃下放到胸口两侧，推起时往中间靠。' },
  { id: 'incline-db', name: '上斜哑铃卧推', part: '胸', eq: 'gym', joints: ['肩'], tip: '凳子 30°左右，下放时手肘约 45° 夹角。' },
  { id: 'pushup', name: '俯卧撑', part: '胸', eq: 'none', bw: true, joints: ['腕'], tip: '身体成一条直线，胸口接近地面再推起。' },
  { id: 'knee-pushup', name: '跪姿俯卧撑', part: '胸', eq: 'none', bw: true, target: 10, joints: ['腕'], tip: '膝盖着地，从膝盖到头保持一条直线，适合新手入门。' },
  { id: 'fly', name: '龙门架夹胸', part: '胸', eq: 'gym', joints: ['肩'], tip: '微屈肘固定角度，想象抱一棵大树。' },

  { id: 'pullup', name: '引体向上', part: '背', eq: 'gym', bw: true, joints: ['肩'], tip: '先沉肩再拉，下巴过杠，下放控制速度。' },
  { id: 'row', name: '杠铃划船', part: '背', eq: 'gym', joints: ['腰'], tip: '俯身约 45°，杠铃拉向小腹，背部保持平直。' },
  { id: 'db-row', name: '单臂哑铃划船', part: '背', eq: 'db', tip: '一手一膝撑凳，背部放平，哑铃拉向髋部。' },
  { id: 'pulldown', name: '高位下拉', part: '背', eq: 'gym', tip: '拉到锁骨位置，用背发力而不是手臂。' },
  { id: 'seated-row', name: '坐姿绳索划船', part: '背', eq: 'gym', tip: '挺胸坐直，先夹肩胛再拉手肘，身体不前后晃。' },
  { id: 'deadlift', name: '硬拉', part: '背', eq: 'gym', joints: ['腰'], tip: '杠铃贴腿，髋部发力起身，全程背部中立。' },
  { id: 'superman', name: '超人式', part: '背', eq: 'none', bw: true, target: 12, joints: ['腰'], tip: '趴在地上，同时抬起手臂和腿，顶端停 2 秒。' },

  { id: 'squat', name: '杠铃深蹲', part: '腿', eq: 'gym', joints: ['膝', '腰'], tip: '膝盖与脚尖同向，蹲至大腿平行地面或更低。' },
  { id: 'bw-squat', name: '徒手深蹲', part: '腿', eq: 'none', bw: true, target: 15, joints: ['膝'], tip: '双臂前伸保持平衡，屁股往后坐，大腿蹲到平行地面。' },
  { id: 'goblet-squat', name: '高脚杯深蹲', part: '腿', eq: 'db', joints: ['膝'], tip: '双手捧哑铃贴在胸前，挺胸往下蹲。' },
  { id: 'rdl', name: '罗马尼亚硬拉', part: '腿', eq: 'gym', joints: ['腰'], tip: '微屈膝，臀部后推，感受腘绳肌拉伸。' },
  { id: 'lunge', name: '哑铃箭步蹲', part: '腿', eq: 'db', joints: ['膝'], tip: '前后脚都约 90°，躯干保持直立。' },
  { id: 'step-up', name: '踏凳上台阶', part: '腿', eq: 'none', bw: true, target: 12, joints: ['膝'], tip: '前脚整只踩稳台阶或椅子，用前腿把身体蹬上去。' },
  { id: 'glute-bridge', name: '臀桥', part: '腿', eq: 'none', bw: true, target: 15, tip: '仰卧屈膝，脚跟发力把髋顶起，顶端夹紧臀部。' },
  { id: 'hip-thrust', name: '杠铃臀推', part: '腿', eq: 'gym', tip: '上背靠凳，杠铃放在髋部，顶到身体与地面平行。' },
  { id: 'legpress', name: '腿举', part: '腿', eq: 'gym', joints: ['膝'], tip: '下放时腰部不离开靠垫，膝盖不要锁死。' },
  { id: 'leg-curl', name: '俯卧腿弯举', part: '腿', eq: 'gym', tip: '腹部贴垫，勾脚尖把小腿弯起，下放用 2 秒。' },

  { id: 'ohp', name: '站姿推举', part: '肩', eq: 'gym', joints: ['肩', '腰'], tip: '收紧核心与臀部，杠铃从面前垂直推过头顶。' },
  { id: 'db-press', name: '坐姿哑铃推举', part: '肩', eq: 'db', joints: ['肩'], tip: '背靠凳坐直，哑铃从耳朵高度推到头顶。' },
  { id: 'pike-pushup', name: '屈体俯卧撑', part: '肩', eq: 'none', bw: true, target: 8, joints: ['肩', '腕'], tip: '屁股抬高成倒 V，头往双手前方落下再推起。' },
  { id: 'lateral', name: '哑铃侧平举', part: '肩', eq: 'db', joints: ['肩'], tip: '小重量，手肘略高于手腕，抬到与肩同高。' },
  { id: 'facepull', name: '绳索面拉', part: '肩', eq: 'gym', tip: '拉向额头，同时外旋双手，锻炼后束。' },

  { id: 'curl', name: '哑铃弯举', part: '手臂', eq: 'db', tip: '大臂贴住身体不动，顶峰稍作停顿。' },
  { id: 'hammer', name: '锤式弯举', part: '手臂', eq: 'db', tip: '掌心相对，练肱桡肌和肱肌。' },
  { id: 'pushdown', name: '绳索下压', part: '手臂', eq: 'gym', tip: '大臂固定，底部把绳子向两侧分开。' },
  { id: 'db-ext', name: '哑铃颈后臂屈伸', part: '手臂', eq: 'db', joints: ['肩'], tip: '双手托住一只哑铃，大臂贴耳朵不动，只动小臂。' },
  { id: 'dips', name: '双杠臂屈伸', part: '手臂', eq: 'gym', bw: true, joints: ['肩', '腕'], tip: '身体直立偏重三头，前倾偏重胸。' },
  { id: 'chair-dip', name: '椅子臂屈伸', part: '手臂', eq: 'none', bw: true, target: 10, joints: ['肩', '腕'], tip: '双手撑在身后的椅子边缘，屈肘下放到大臂水平。' },

  { id: 'plank', name: '平板支撑', part: '核心', eq: 'none', bw: true, rl: '秒', target: 30, tip: '身体成一条直线，臀部不塌不翘。' },
  { id: 'side-plank', name: '侧平板支撑', part: '核心', eq: 'none', bw: true, rl: '秒', target: 20, tip: '侧躺，手肘在肩膀正下方，把髋部撑起成一条直线。' },
  { id: 'crunch', name: '卷腹', part: '核心', eq: 'none', bw: true, target: 15, tip: '下背贴地，用腹部把肩胛卷离地面。' },
  { id: 'deadbug', name: '死虫', part: '核心', eq: 'none', bw: true, target: 10, tip: '仰卧，腰贴紧地面，对侧手脚慢慢伸直再收回。' },
  { id: 'bird-dog', name: '鸟狗式', part: '核心', eq: 'none', bw: true, target: 10, tip: '跪撑，对侧手脚同时伸直，背上像放了一杯水。' },
  { id: 'legraise', name: '悬垂举腿', part: '核心', eq: 'gym', bw: true, joints: ['腰'], tip: '避免借力摆动，骨盆后倾把腿抬起。' },

  // cardio: 有氧，按分钟记录、只做一组；maxMin: 高冲击动作单次最长分钟数
  { id: 'walk', name: '快走', part: '有氧', eq: 'none', cardio: true, rl: '分钟', tip: '步子迈大，手臂自然前后摆，微微有点喘最好。' },
  { id: 'run', name: '跑步', part: '有氧', eq: 'none', cardio: true, rl: '分钟', joints: ['膝', '踝'], tip: '前脚掌或全脚掌轻落地，步频快一点、步子小一点更护膝。' },
  { id: 'bike', name: '固定单车', part: '有氧', eq: 'gym', cardio: true, rl: '分钟', tip: '座椅调到腿蹬到底时膝盖微弯，保持稳定的踏频。' },
  { id: 'elliptical', name: '椭圆机', part: '有氧', eq: 'gym', cardio: true, rl: '分钟', tip: '脚踩稳踏板，手推拉扶手带动全身，对膝盖冲击小。' },
  { id: 'rower', name: '划船机', part: '有氧', eq: 'gym', cardio: true, rl: '分钟', joints: ['腰'], tip: '先蹬腿、再后仰、最后拉手；回去时顺序反过来。' },
  { id: 'shadowbox', name: '空击拳', part: '有氧', eq: 'none', cardio: true, rl: '分钟', maxMin: 15, tip: '双手护住下巴，出拳后马上收回，脚下保持小碎步。' },
  { id: 'rope', name: '跳绳', part: '有氧', eq: 'none', cardio: true, rl: '分钟', maxMin: 12, joints: ['膝', '踝'], tip: '前脚掌着地，手腕发力摇绳，跳 1 分钟歇 30 秒也可以。' },
  { id: 'jumping-jack', name: '开合跳', part: '有氧', eq: 'none', cardio: true, rl: '分钟', maxMin: 8, joints: ['膝', '踝'], tip: '跳开时双手在头顶击掌，落地时膝盖微屈缓冲。' },
  { id: 'high-knee', name: '原地高抬腿', part: '有氧', eq: 'none', cardio: true, rl: '分钟', maxMin: 8, joints: ['膝', '踝'], tip: '大腿抬到水平，手臂配合摆动，前脚掌落地。' },
];
const EX_BY_ID = Object.fromEntries(EXERCISES.map(e => [e.id, e]));
function mgOf(ex) { return ex.mg || ex.part; }

// 发力感：good 是目标肌肉的感觉，bad 是常见代偿 [部位, 纠正提示]
const FEEL = {
  wallsit: { good: '大腿前侧发酸发抖', bad: [['膝盖', '往上滑一点，膝盖角度大于 90°，脚往前放'], ['下背', '后背和腰整个贴住墙面']] },
  'desk-pushup': { good: '胸口和大臂后侧', bad: [['手腕', '手掌压实桌面，手腕在肩膀正下方'], ['腰部', '收紧肚子和屁股，别塌腰']] },
  'chair-squat': { good: '臀部和大腿前侧', bad: [['膝盖', '先把屁股往后送，膝盖跟着脚尖方向'], ['下背', '挺胸，眼睛看前方，别弯腰']] },
  'calf-raise': { good: '小腿后侧发酸', bad: [['脚踝', '动作放慢，顶端停 1 秒'], ['没什么感觉', '站到台阶边缘，加大下放幅度']] },
  'neck-stretch': { good: '脖子侧面到肩膀被拉长', bad: [['脖子后面发紧', '头往侧面倒，不是往前低'], ['没什么感觉', '另一侧的手往下够，肩膀用力沉']] },
  'chest-open': { good: '胸口和肩膀前侧被拉开', bad: [['肩膀里面刺痛', '手肘放低到肩膀以下，幅度减小'], ['没什么感觉', '身体再往前走一步，挺胸']] },
  'hip-flexor': { good: '后腿大腿前侧被拉长', bad: [['下背', '收紧臀部，骨盆往前推，别塌腰'], ['膝盖', '膝盖下垫个软垫或叠起的衣服']] },
  bench: { good: '胸口被撑开、往中间挤', bad: [['肩膀前侧', '肩胛后收下沉，像把肩膀塞进后裤兜'], ['手肘或手腕', '手肘别外展到 90°，收到 45°–60°']] },
  'db-bench': { good: '胸口被撑开', bad: [['肩膀前侧', '肩胛收紧贴凳，手肘收到 45°'], ['手腕', '手腕立直，哑铃在小臂正上方']] },
  'incline-db': { good: '上胸靠近锁骨的位置', bad: [['肩膀前侧', '凳子角度降到 30°，肩胛贴紧凳面'], ['手臂后侧', '下放更深一点，推起时想着两只手往中间靠']] },
  pushup: { good: '胸口中间和两侧', bad: [['手腕', '手掌撑在肩膀正下方，五指张开压实地面'], ['腰部', '收紧腹部和臀部，身体保持一条直线']] },
  'knee-pushup': { good: '胸口和大臂后侧', bad: [['膝盖', '膝盖下垫个软垫或衣服'], ['腰部', '收紧肚子，从膝盖到头一条直线']] },
  fly: { good: '胸中间被挤紧', bad: [['肩膀前侧', '微屈肘并固定角度，动作幅度别过大'], ['手臂', '想象用大臂抱一棵树，而不是用手去推']] },
  pullup: { good: '腋下两侧的背阔肌', bad: [['手臂前侧', '先沉肩再拉，想着用手肘往口袋方向拉'], ['小臂', '用空心握或助力带，手只当挂钩']] },
  row: { good: '背中间被夹紧', bad: [['下背', '背部保持平直，重量减轻一点'], ['手臂', '手肘往后口袋方向拉，顶端夹住肩胛停 1 秒']] },
  'db-row': { good: '背部一侧被夹紧', bad: [['手臂', '想着把手肘拉向后口袋，手只当挂钩'], ['下背', '另一只手撑稳凳子，背保持平']] },
  pulldown: { good: '腋下两侧被拉长再收紧', bad: [['手臂前侧', '手只当挂钩，想象用手肘往下拉'], ['脖子和肩膀上方', '先把肩膀往下沉，再开始拉']] },
  'seated-row': { good: '背中间被夹紧', bad: [['手臂', '先挺胸夹肩胛，再拉手肘'], ['下背', '别前后摇身体借力']] },
  deadlift: { good: '臀部和大腿后侧发力，背部绷紧', bad: [['下背', '起身前先吸气收紧核心，杠铃贴着腿走'], ['手臂', '手臂只是挂着，靠髋部往前顶起身']] },
  superman: { good: '下背和臀部', bad: [['脖子', '眼睛看地面，别抬头'], ['腰部刺痛', '幅度减小，只抬离地面一点点']] },
  squat: { good: '大腿前侧和臀部', bad: [['膝盖前面', '先坐髋再屈膝，膝盖对着脚尖方向'], ['下背', '蹲之前吸气撑住肚子，重量先减轻']] },
  'bw-squat': { good: '大腿前侧和臀部', bad: [['膝盖', '先坐髋再屈膝，膝盖对着脚尖方向'], ['下背', '挺胸，眼睛看前方']] },
  'goblet-squat': { good: '大腿前侧和臀部', bad: [['下背', '哑铃贴着胸口，挺胸往下蹲'], ['膝盖', '膝盖对着脚尖方向打开']] },
  rdl: { good: '大腿后侧被拉长', bad: [['下背', '屁股往后推「关门」，背保持平直'], ['没什么感觉', '膝盖微屈固定，下到大腿后侧拉满就停']] },
  lunge: { good: '前腿的臀部和大腿', bad: [['膝盖', '步子迈大一点，前膝不超过脚尖太多'], ['后腿大腿前侧', '重心放在前脚跟，躯干稍微前倾']] },
  'step-up': { good: '前腿的臀部', bad: [['后腿', '后脚只轻点地，全靠前腿蹬上去'], ['膝盖', '前脚整只踩上台阶，别只踩脚尖']] },
  'glute-bridge': { good: '臀部收紧', bad: [['下背', '顶起时收紧臀部，肋骨往下收'], ['大腿后侧抽筋', '脚往屁股方向挪近一点']] },
  'hip-thrust': { good: '臀部用力夹紧', bad: [['下背', '顶端收紧臀部，下巴微收'], ['大腿前侧', '脚往前放一点，让小腿垂直地面']] },
  legpress: { good: '大腿前侧和臀部', bad: [['膝盖', '推起时膝盖不要锁死，留一点弯曲'], ['下背', '下放深度减小，腰别离开靠垫']] },
  'leg-curl': { good: '大腿后侧', bad: [['下背', '腹部贴紧垫子，别撅屁股'], ['小腿', '勾起脚尖，放慢速度']] },
  ohp: { good: '肩膀发热', bad: [['下背', '收紧臀部和腹部，肋骨别外翻'], ['脖子', '推起时头往前钻，肩膀别耸']] },
  'db-press': { good: '肩膀发热', bad: [['下背', '靠背坐直，收紧腹部'], ['手臂后侧', '下放到耳朵高度，别只推一半']] },
  'pike-pushup': { good: '肩膀', bad: [['手腕', '手指张开压实地面'], ['胸', '屁股再抬高一点，头往双手前方落']] },
  lateral: { good: '肩膀外侧火辣辣地酸', bad: [['脖子两侧', '换轻重量，沉肩，想着手肘往两侧推远'], ['手臂', '微屈肘固定，手肘带动，不是手腕带动']] },
  facepull: { good: '肩膀后侧和上背', bad: [['手臂', '拉到额头时双手往外转，像展示肌肉'], ['下背', '站稳别后仰，重量减轻']] },
  curl: { good: '大臂前侧鼓起挤紧', bad: [['肩膀前侧', '大臂贴住身体不动，别往前甩'], ['下背', '别借腰甩重量，下放用 2–3 秒']] },
  hammer: { good: '大臂前外侧和小臂上方', bad: [['肩膀', '大臂固定在身体两侧'], ['手腕', '手腕保持中立，别往里勾']] },
  pushdown: { good: '大臂后侧，底端最酸', bad: [['肩膀和胸', '大臂锁在身体两侧，只动小臂'], ['手腕', '底部把绳子往两边分开，手腕伸直']] },
  'db-ext': { good: '大臂后侧被拉长', bad: [['肩膀', '大臂贴着耳朵不动'], ['手肘疼', '减轻重量，下放慢一点']] },
  dips: { good: '大臂后侧或下胸', bad: [['肩膀前侧', '别下得太深，到大臂与地面平行就停'], ['手腕', '手腕在手肘正下方，握实双杠']] },
  'chair-dip': { good: '大臂后侧', bad: [['肩膀前侧', '下放到大臂与地面平行就停'], ['手腕', '手指朝前握住椅子边缘']] },
  plank: { good: '肚子整体在发抖', bad: [['下背', '收紧臀部，骨盆微微后倾'], ['肩膀', '手肘在肩膀正下方，用力把地面推开']] },
  'side-plank': { good: '腰的侧面', bad: [['肩膀', '手肘在肩膀正下方，用力撑开地面'], ['屁股往下掉', '收紧臀部，身体保持一条直线']] },
  crunch: { good: '肚子中间被拧紧', bad: [['脖子', '手轻放耳边别抱头，眼睛看斜上方'], ['大腿前侧', '脚别勾住东西，只把肩胛卷离地面']] },
  deadbug: { good: '肚子绷紧', bad: [['下背', '腰紧贴地面，伸展的幅度减小'], ['脖子', '头放松贴地']] },
  'bird-dog': { good: '腹部和下背一起稳住', bad: [['腰部扭动', '动作放慢，想象背上放了一杯水'], ['肩膀', '支撑手用力推地，别塌肩']] },
  legraise: { good: '下腹部', bad: [['大腿前侧', '抬腿时把骨盆往上卷，不只是抬腿'], ['手和小臂', '先练屈膝举腿，减少晃动']] },
};

/* ---------- 闯关路线 ---------- */

const OFFICE_UNITS = [
  { title: '第 1 单元 · 离开工位', desc: '每坐 1 小时，起来 3 分钟', color: '#ff5a1f', lessons: [
    ['neck-stretch', 'chest-open'], ['chair-squat', 'calf-raise'], ['wallsit', 'neck-stretch'], ['desk-pushup', 'chair-squat'] ] },
  { title: '第 2 单元 · 午休小练', desc: '不出汗也能练到', color: '#2f6feb', lessons: [
    ['wallsit', 'plank'], ['desk-pushup', 'calf-raise'], ['chair-squat', 'wallsit', 'hip-flexor'], ['desk-pushup', 'plank', 'neck-stretch'] ] },
  { title: '第 3 单元 · 下班前加练', desc: '把一天的久坐还回去', color: '#1f9d55', lessons: [
    ['wallsit', 'chair-squat', 'plank'], ['desk-pushup', 'glute-bridge', 'calf-raise'], ['plank', 'crunch', 'chest-open'], ['chair-squat', 'desk-pushup', 'wallsit', 'plank'] ] },
  { title: '第 4 单元 · 在家也能练', desc: '一块地垫就够', color: '#d63e7a', lessons: [
    ['bw-squat', 'knee-pushup'], ['glute-bridge', 'superman', 'deadbug'], ['step-up', 'chair-dip', 'side-plank'], ['bw-squat', 'pushup', 'bird-dog', 'hip-flexor'] ] },
];

const GYM_UNITS = [
  { title: '第 1 单元 · 推起来', desc: '找到胸部发力感', color: '#ff5a1f', lessons: [
    ['pushup', 'plank'], ['bench', 'pushup'], ['bench', 'incline-db'], ['bench', 'incline-db', 'fly'] ] },
  { title: '第 2 单元 · 拉得动', desc: '用背拉，而不是用手', color: '#2f6feb', lessons: [
    ['pulldown', 'row'], ['pulldown', 'facepull'], ['row', 'pullup'], ['deadlift', 'seated-row', 'pulldown'] ] },
  { title: '第 3 单元 · 站得稳', desc: '臀腿才是发动机', color: '#1f9d55', lessons: [
    ['squat', 'lunge'], ['squat', 'rdl'], ['legpress', 'hip-thrust'], ['squat', 'rdl', 'leg-curl'] ] },
  { title: '第 4 单元 · 肩与手臂', desc: '小肌群，轻重量找感觉', color: '#d63e7a', lessons: [
    ['ohp', 'lateral'], ['curl', 'pushdown'], ['ohp', 'lateral', 'facepull'], ['curl', 'hammer', 'dips'] ] },
  { title: '第 5 单元 · 铁核心', desc: '稳住躯干，动作才能做对', color: '#6e56cf', lessons: [
    ['plank', 'crunch'], ['legraise', 'deadbug'], ['plank', 'side-plank', 'legraise'] ] },
];

const TRACKS = {
  office: { name: '上班族', emoji: '🧑‍💼', desc: '工位碎片时间，每次 3–5 分钟，不用器材', units: OFFICE_UNITS, sets: 2, goal: 30 },
  gym: { name: '健身房', emoji: '🏋️', desc: '每天去健身房，系统练全身，自动加重', units: GYM_UNITS, sets: 3, goal: 50 },
};

/* ---------- 分化训练：几天一轮 ----------
 * groups 里的「三头」「二头」是手臂里的细分，其余是主要肌群 */

const TRICEPS = ['pushdown', 'db-ext', 'dips', 'chair-dip'];
const BICEPS = ['curl', 'hammer'];
const SPLITS = {
  3: [
    { name: '推', desc: '胸 · 肩 · 三头', groups: ['胸', '肩', '三头'] },
    { name: '拉', desc: '背 · 二头', groups: ['背', '二头'] },
    { name: '腿', desc: '腿 · 核心', groups: ['腿', '核心'] },
  ],
  4: [
    { name: '胸', desc: '胸 · 三头', groups: ['胸', '三头'] },
    { name: '背', desc: '背 · 二头', groups: ['背', '二头'] },
    { name: '腿', desc: '腿', groups: ['腿'] },
    { name: '肩', desc: '肩 · 核心', groups: ['肩', '核心'] },
  ],
  5: [
    { name: '胸', desc: '胸', groups: ['胸'] },
    { name: '背', desc: '背', groups: ['背'] },
    { name: '腿', desc: '腿', groups: ['腿'] },
    { name: '肩', desc: '肩', groups: ['肩'] },
    { name: '臂', desc: '二头 · 三头 · 核心', groups: ['二头', '三头', '核心'] },
  ],
};

/* ---------- 开场问卷 ---------- */

// 按器材和伤病挑出适合的有氧，问卷和今日训练都用它
function cardioAdvice(ans) {
  const inj = ans.injuries || [];
  const eqFits = e => ans.equip === 'gym' || e.eq === 'none' || (ans.equip === 'db' && e.eq === 'db');
  const all = EXERCISES.filter(e => e.cardio && eqFits(e));
  const ok = all.filter(e => !(e.joints || []).some(j => inj.includes(j)));
  const avoid = all.filter(e => !ok.includes(e));
  const hurt = [...new Set(avoid.flatMap(e => e.joints.filter(j => inj.includes(j))))].map(j => JOINT_NAME[j]);
  const names = list => list.map(e => e.name).join('、');
  const text = avoid.length
    ? `为保护${hurt.join('、')}，避开${names(avoid)}；适合你的：${names(ok)}`
    : `适合你的有氧：${names(ok)}`;
  return { ok, avoid, text };
}

const QUIZ = [
  { key: 'goal', q: '你最想达成什么？', opts: [
    ['muscle', '💪 增肌塑形', '练出线条和力量'], ['fat', '🔥 减脂', '多消耗、少休息'],
    ['health', '🌿 保持健康', '规律运动，不求极限'], ['sit', '🪑 缓解久坐', '肩颈腰背不再僵'] ] },
  { key: 'work', q: '你平时的工作状态？', sub: '久坐的人会有休息提醒，提醒你起来动一动、喝杯水', opts: [
    ['sit', '🪑 久坐办公', '每天坐着超过 6 小时'], ['move', '🚶 经常走动', '站着工作或跑来跑去'], ['mixed', '🔀 时坐时动', '说不准，看情况'] ] },
  { key: 'level', q: '你现在的训练水平？', opts: [
    ['new', '🌱 新手', '几乎没系统练过'], ['mid', '🌿 有基础', '断断续续练过几个月'], ['pro', '🌳 老手', '规律训练 1 年以上'] ] },
  { key: 'equip', q: '你平时能用什么器材？', opts: [
    ['none', '🏠 什么都没有', '只用自重'], ['db', '🏋️ 家里有哑铃', '一对哑铃加一张凳子'], ['gym', '🏢 能去健身房', '器械、杠铃都能用'] ] },
  { key: 'split', q: '你想怎么安排训练？', sub: '分化训练：每天练不同部位，练完一轮再从头开始', opts: [
    ['auto', '🤖 自动安排', '按肌肉恢复情况，每天推荐该练的部位'], ['3', '🗓️ 3 天一轮', '推 / 拉 / 腿'],
    ['4', '🗓️ 4 天一轮', '胸 / 背 / 腿 / 肩'], ['5', '🗓️ 5 天一轮', '胸 / 背 / 腿 / 肩 / 手臂'] ] },
  { key: 'injuries', multi: true, q: '有没有需要保护的部位？', sub: '可以多选，我们会避开压力大的动作', opts: [
    ['膝', '🦵 膝盖'], ['腰', '🔻 腰'], ['肩', '🏔️ 肩膀'], ['腕', '✋ 手腕'], ['踝', '🦶 脚踝'] ] },
  { key: 'cardio', q: '有氧怎么安排？', sub: ans => cardioAdvice(ans).text,
    rec: ans => ({ fat: 'more', muscle: 'none', health: 'some', sit: 'some' }[ans.goal]), opts: [
    ['more', '🔥 多一点', '每次练完都加一段有氧'], ['some', '🌿 适量', '每周 3 次，腿部训练日不加'], ['none', '🚫 先不加', '专心练力量'] ] },
];
