/* 线性图标：把界面里的 emoji 换成统一的单线图标（不改业务逻辑） */
(function () {
  const P = {
    bolt: '<path d="M13 3 5 13.5h6L10 21l8-10.5h-6z"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".8" fill="currentColor"/>',
    flame: '<path d="M12 21c-3.6 0-6-2.4-6-5.6 0-3.4 2.6-5 3.4-8.4 1.9 1.3 2.8 3 2.8 4.6 1-.6 1.6-1.6 1.8-2.8C16.4 10.6 18 13 18 15.4 18 18.6 15.6 21 12 21z"/>',
    drop: '<path d="M12 3.5s6 6.4 6 10.8a6 6 0 0 1-12 0C6 9.9 12 3.5 12 3.5z"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    checkc: '<circle cx="12" cy="12" r="8.5"/><path d="m8.2 12.2 2.6 2.6 5-5.2"/>',
    swords: '<path d="M4 4l9 9M4 4h4M4 4v4M20 4l-9 9M20 4h-4M20 4v4M7 15l-3 3 2 2 3-3M17 15l3 3-2 2-3-3"/>',
    pulse: '<path d="M3 12h4l2.2-5 3.6 10 2.2-5h6"/>',
    heart: '<path d="M12 19.5s-7.5-4.4-7.5-10A4.2 4.2 0 0 1 12 7a4.2 4.2 0 0 1 7.5 2.5c0 5.6-7.5 10-7.5 10z"/>',
    medal: '<circle cx="12" cy="15" r="5"/><path d="M8.5 11 6 3.5h4L12 9l2-5.5h4L15.5 11"/>',
    alert: '<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4.2M12 17v.1"/>',
    clip: '<rect x="5.5" y="5" width="13" height="16" rx="2"/><path d="M9 5V3.5h6V5M9 11h6M9 15h4"/>',
    cup: '<path d="M6.5 4h11l-1.4 15.2a2 2 0 0 1-2 1.8H9.9a2 2 0 0 1-2-1.8z"/><path d="M7 9h10"/>',
    bottle: '<path d="M10 3h4v3l2 2.5V20a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V8.5L10 6z"/><path d="M8 12h8"/>',
    dumbbell: '<path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/>',
    lock: '<rect x="5.5" y="10.5" width="13" height="9.5" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
    cal: '<rect x="4" y="5.5" width="16" height="14.5" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
    pencil: '<path d="M15.5 4.5l4 4L9 19H5v-4z"/>',
    shield: '<path d="M12 3.5 5 6v5.5c0 4.4 3 7.6 7 9 4-1.4 7-4.6 7-9V6z"/>',
    bulb: '<path d="M9 17.5h6M10 21h4M8.2 14.3A6 6 0 1 1 15.8 14.3c-.8.7-1 1.4-1 2.2H9.2c0-.8-.2-1.5-1-2.2z"/>',
    timer: '<circle cx="12" cy="13.5" r="7"/><path d="M12 13.5V10M10 3h4"/>',
    help: '<circle cx="12" cy="12" r="8.5"/><path d="M9.7 9.5a2.4 2.4 0 1 1 3.3 2.2c-.6.3-1 .8-1 1.5v.4M12 16.6v.1"/>',
    msg: '<path d="M4.5 6.5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H10l-4 3.5v-3.5h.5a2 2 0 0 1-2-2z"/>',
    down: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 20h14"/>',
    up: '<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M5 20h14"/>',
    bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z"/><path d="M10 20.5h4"/>',
    belloff: '<path d="M6 16.5V11a6 6 0 0 1 9.6-4.8M18 11v5.5l1.5 1.5H8M10 20.5h4M4 4l16 16"/>',
    phone: '<rect x="7" y="3" width="10" height="18" rx="2.2"/><path d="M11 18h2"/>',
    alarm: '<circle cx="12" cy="13" r="7"/><path d="M12 9.5V13l2.2 1.6M4.5 5.5l2.5-2M19.5 5.5 17 3.5"/>',
    run: '<circle cx="14.5" cy="4.8" r="1.6"/><path d="M8 20.5l3-5.5 3 2.5v4M6.5 11l3-3 4 .5 2 3.5 3 1M11 15l2-6.5"/>',
    walk: '<circle cx="12.5" cy="4.8" r="1.6"/><path d="M9.5 20.5 11.5 14l2.5 2.5v4M8 12l2.5-4h3l2 4M11.5 14l1-6"/>',
    leaf: '<path d="M5 19c0-8 5.5-13.5 14-14 0 8.5-5.5 14-14 14z"/><path d="M5 19 13 11"/>',
    sprout: '<path d="M12 20v-8M12 12c0-3.5-2.5-6-6.5-6 0 3.5 2.5 6 6.5 6zM12 14c0-3 2-5.5 6-5.5 0 3-2 5.5-6 5.5z"/>',
    tree: '<path d="M12 21v-5M12 3 6 11h3l-4 5h14l-4-5h3z"/>',
    leg: '<path d="M10 3v8l-1.5 9H14M14 3l-.5 8 .5 4"/>',
    mountain: '<path d="M3 19 9.5 8l3.5 6 2-3 6 8z"/>',
    home: '<path d="M4 10.5 12 4l8 6.5V20h-5v-6H9v6H4z"/>',
    building: '<rect x="5" y="3.5" width="14" height="17" rx="1"/><path d="M9 7.5h2M13 7.5h2M9 11h2M13 11h2M9 14.5h2M13 14.5h2M10.5 20.5v-3h3v3"/>',
    chair: '<path d="M7 3.5v9h10M7 12.5V21M17 12.5V21M17 3.5v9"/>',
    brief: '<rect x="3.5" y="7.5" width="17" height="12" rx="2"/><path d="M9 7.5v-2a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5.5v2M3.5 12.5h17"/>',
    wing: '<path d="M3 15c5 0 9-4 18-8-2 6-6 11-12 11-2.5 0-4.5-1-6-3z"/><path d="M9 14.5l4-1.5"/>',
    burst: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/>',
    grid: '<rect x="4" y="5" width="16" height="14" rx="1.5"/><path d="M4 12h16M12 5v7M8 12v7M16 12v7"/>',
    lotus: '<circle cx="12" cy="5.5" r="1.8"/><path d="M12 8.5v5M7 11l5 2.5 5-2.5M4.5 19c2-2.5 4.5-3.2 7.5-3.2s5.5.7 7.5 3.2z"/>',
    user: '<circle cx="12" cy="8" r="3.8"/><path d="M4.5 20.5c.8-4 3.8-6 7.5-6s6.7 2 7.5 6"/>',
    shuffle: '<path d="M4 7h3.5c3 0 4.5 10 8 10H20M4 17h3.5c1.2 0 2-1.4 2.8-3.2M13.7 10.2c.8-1.8 1.6-3.2 2.8-3.2H20M17.5 4.5 20 7l-2.5 2.5M17.5 14.5 20 17l-2.5 2.5"/>',
    auto: '<rect x="5.5" y="7" width="13" height="11" rx="3"/><path d="M12 3.5V7M9.5 12v.1M14.5 12v.1M10 15h4"/>',
    tridown: '<path d="M5 7h14l-7 11z"/>',
    hand: '<path d="M8 12.5V6a1.4 1.4 0 0 1 2.8 0v5M10.8 10.5V4.5a1.4 1.4 0 0 1 2.8 0v6M13.6 10.5v-5a1.4 1.4 0 0 1 2.8 0v6M16.4 11.5v-3a1.4 1.4 0 0 1 2.6 0V14a7 7 0 0 1-7 7c-2.5 0-4-1-5.5-3L5 15a1.5 1.5 0 0 1 2.4-1.8L8 14"/>',
    foot: '<path d="M8 4v9.5c0 1.5-2 2.5-2 4.5a3 3 0 0 0 3 3h7.5a2 2 0 0 0 0-4H13a2 2 0 0 1-2-2V4z"/>',
    ban: '<circle cx="12" cy="12" r="8.5"/><path d="M6 6l12 12"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
  };
  const MAP = {
    '⚡': 'bolt', '🎯': 'target', '🔥': 'flame', '💧': 'drop', '✓': 'check', '✅': 'checkc', '⚔': 'swords',
    '🫀': 'pulse', '❤': 'heart', '🏅': 'medal', '⚠': 'alert', '📋': 'clip', '🥛': 'cup', '🧴': 'bottle',
    '💪': 'dumbbell', '🏋': 'dumbbell', '🔒': 'lock', '🗓': 'cal', '📅': 'cal', '📝': 'pencil', '🛡': 'shield',
    '💡': 'bulb', '⏱': 'timer', '🤔': 'help', '💬': 'msg', '⬇': 'down', '⬆': 'up', '🔔': 'bell', '🔕': 'belloff',
    '📱': 'phone', '⏰': 'alarm', '🏃': 'run', '🚶': 'walk', '🌿': 'leaf', '🌱': 'sprout', '🌳': 'tree',
    '🦵': 'leg', '🏔': 'mountain', '🏠': 'home', '🏢': 'building', '🪑': 'chair', '💼': 'brief', '🦅': 'wing',
    '💥': 'burst', '🧱': 'grid', '🧘': 'lotus', '🧑‍💼': 'user', '🔀': 'shuffle', '🤖': 'auto', '🔻': 'tridown',
    '✋': 'hand', '🦶': 'foot', '🚫': 'ban', '✕': 'x',
  };
  const keys = Object.keys(MAP).sort((a, b) => b.length - a.length).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const RE = new RegExp('(' + keys.join('|') + ')\\uFE0F?\\s?', 'gu');
  const svg = name => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${P[name]}</svg>`;
  window.icon = svg;

  const SKIP = 'textarea,input,select,script,style,[data-ui],.sp-host,.sp-toasts,svg';
  function swap(root) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: n => (RE.test(n.data) && (RE.lastIndex = 0, true) && !n.parentElement?.closest(SKIP))
        ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
    });
    const hits = [];
    while (w.nextNode()) hits.push(w.currentNode);
    for (const n of hits) {
      RE.lastIndex = 0;
      const span = document.createElement('span');
      span.className = 'ic-run';
      span.innerHTML = n.data.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
        .replace(RE, (m, k) => svg(MAP[k]) + (/\s$/.test(m) ? '' : ''));
      n.replaceWith(...span.childNodes);
    }
  }
  let queued = false;
  const run = () => { queued = false; swap(document.body); };
  new MutationObserver(() => { if (!queued) { queued = true; requestAnimationFrame(run); } })
    .observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  document.addEventListener('DOMContentLoaded', run);
  if (document.readyState !== 'loading') run();
})();
