// popup.js — Detoxify v2

// ── DOM refs ─────────────────────────────────────────────
const detoxBtn       = document.getElementById('detoxBtn');
const runBtnText     = document.getElementById('runBtnText');
const stopBtn        = document.getElementById('stopBtn');
const topicInput     = document.getElementById('topicInput');
const videoCountEl   = document.getElementById('videoCount');
const watchDurEl     = document.getElementById('watchDuration');
const totalCalcEl    = document.getElementById('totalCalc');
const logBox         = document.getElementById('logBox');
const ytBadge        = document.getElementById('ytBadge');
const badgeText      = document.getElementById('badgeText');
const progressWrap   = document.getElementById('progressWrap');
const progressFill   = document.getElementById('progressFill');
const progressLbl    = document.getElementById('progressLabel');
const progressPct    = document.getElementById('progressPct');
const presetChips    = document.getElementById('presetChips');
const navInd         = document.getElementById('navInd');

// ── Tab navigation ────────────────────────────────────────
let activeTabIdx = 0;
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab  = btn.dataset.tab;
    const idx  = parseInt(btn.dataset.idx);
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + tab).classList.add('active');
    navInd.style.transform = `translateX(${idx * 100}%)`;
    activeTabIdx = idx;
    if (tab === 'stats')    loadStats();
    if (tab === 'history')  loadHistory();
    if (tab === 'settings') loadSettings();
  });
});

// ── Session calculator ────────────────────────────────────
function updateCalc() {
  const c = parseInt(videoCountEl.value) || 0;
  const d = parseInt(watchDurEl.value)   || 0;
  const t = c * d;
  const m = Math.floor(t / 60), s = t % 60;
  totalCalcEl.textContent = '→ Total session: ~' + (m > 0 ? `${m}m ${s > 0 ? s + 's' : ''}` : `${t}s`);
}

// Custom steppers
function makeStep(minusId, plusId, inputId, min, max, step = 1) {
  const input = document.getElementById(inputId);
  document.getElementById(minusId).addEventListener('click', () => {
    const v = parseInt(input.value) || min;
    input.value = Math.max(min, v - step);
    updateCalc();
  });
  document.getElementById(plusId).addEventListener('click', () => {
    const v = parseInt(input.value) || min;
    input.value = Math.min(max, v + step);
    updateCalc();
  });
}
makeStep('vcMinus', 'vcPlus', 'videoCount', 1, 20, 1);
makeStep('wdMinus', 'wdPlus', 'watchDuration', 5, 300, 5);
updateCalc();

// ── Log renderer ──────────────────────────────────────────
function addLog(time, msg, type = 'default') {
  const prev = logBox.querySelector('.lcursor');
  if (prev) prev.remove();
  const line = document.createElement('div');
  line.className = 'll';
  line.innerHTML = `<span class="lt">${time}</span><span class="lm ${type}">${msg}<span class="lcursor"></span></span>`;
  logBox.prepend(line);
  while (logBox.children.length > 30) logBox.removeChild(logBox.lastChild);
}

// ── Progress ──────────────────────────────────────────────
function setProgress(pct, label) {
  progressFill.style.width = pct + '%';
  progressPct.textContent  = Math.round(pct) + '%';
  progressLbl.textContent  = label;
}

// ── Run button state ──────────────────────────────────────
function setRunning(running) {
  detoxBtn.disabled = running;
  detoxBtn.classList.toggle('running', running);
  const existRing = detoxBtn.querySelector('.ring-spin');
  const existSvg  = detoxBtn.querySelector('svg');
  if (running) {
    if (!existRing) {
      if (existSvg) existSvg.remove();
      const r = document.createElement('div'); r.className = 'ring-spin';
      detoxBtn.prepend(r);
    }
    runBtnText.textContent = 'Running Session…';
  } else {
    if (existRing) {
      existRing.remove();
      if (!detoxBtn.querySelector('svg')) {
        const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'currentColor');
        const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        p.setAttribute('d', 'M6 4.75a.75.75 0 0 0-1.2.6v13.3a.75.75 0 0 0 1.2.6l10.4-6.65a.75.75 0 0 0 0-1.2L6 4.75z');
        s.appendChild(p); detoxBtn.prepend(s);
      }
    }
    runBtnText.textContent = 'Start Detox Session';
  }
  stopBtn.classList.toggle('show', running);
  progressWrap.classList.toggle('show', running);
}

// ── Sync full state from background ──────────────────────
function syncState(state) {
  setRunning(state.running);
  if (state.progress > 0 || state.running) {
    progressWrap.classList.add('show');
    setProgress(state.progress || 0, state.label || '');
  }
  logBox.innerHTML = '';
  const logs = (state.logs || []).slice();
  logs.reverse().forEach(l => addLog(l.time, l.msg, l.type));
  if (!logs.length) addLog('--:--:--', 'System ready. Awaiting command…', 'default');
}

// ── YouTube session check ─────────────────────────────────
async function checkYT() {
  try {
    const cookie = await chrome.cookies.get({ url: 'https://www.youtube.com', name: 'SID' });
    const ytS = document.getElementById('ytStatusBadge');
    const ytT = document.getElementById('ytStatusText');
    if (cookie?.value) {
      ytBadge.className     = 'spill ok';
      badgeText.textContent = 'Connected';
      if (ytS) { ytS.className = 'spill ok'; ytS.innerHTML = '<div class="sdot"></div><span>Active</span>'; }
      if (ytT) ytT.textContent = 'Logged into YouTube';
    } else {
      ytBadge.className     = 'spill err';
      badgeText.textContent = 'Not logged in';
      if (ytS) { ytS.className = 'spill err'; ytS.innerHTML = '<div class="sdot"></div><span>Offline</span>'; }
      if (ytT) ytT.textContent = 'Please log into YouTube first';
      detoxBtn.disabled = true;
    }
  } catch {
    ytBadge.className     = 'spill err';
    badgeText.textContent = 'Auth error';
    detoxBtn.disabled = true;
  }
}

// ── Presets ───────────────────────────────────────────────
let presetsCache = [];

function renderPresets(list) {
  presetsCache = list;
  presetChips.innerHTML = '';
  list.forEach(p => {
    const ch = document.createElement('button');
    ch.className = 'chip' + (topicInput.value === p ? ' active' : '');
    ch.textContent = p;
    ch.addEventListener('click', () => {
      topicInput.value = p;
      document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      ch.classList.add('active');
    });
    presetChips.appendChild(ch);
  });
  // Add "+" chip
  const add = document.createElement('button');
  add.className = 'chip-add';
  add.textContent = '＋ Save';
  add.title = 'Save current topic as preset';
  add.addEventListener('click', () => {
    const t = topicInput.value.trim();
    if (!t) return;
    chrome.runtime.sendMessage({ type: 'SAVE_PRESET', payload: t }, r => {
      if (r?.presets) renderPresets(r.presets);
    });
  });
  presetChips.appendChild(add);
}

function loadPresets() {
  chrome.runtime.sendMessage({ type: 'GET_PRESETS' }, r => {
    renderPresets(r?.presets || []);
  });
}

// Keep active chip in sync with input typing
topicInput.addEventListener('input', () => {
  document.querySelectorAll('.chip').forEach(c => {
    c.classList.toggle('active', c.textContent === topicInput.value);
  });
});

// ── STATS TAB ─────────────────────────────────────────────
function formatTime(sec) {
  if (sec < 60) return sec + 's';
  if (sec < 3600) return Math.round(sec / 60) + 'm';
  return (sec / 3600).toFixed(1) + 'h';
}

function animateNum(el, target, suffix = '', duration = 800) {
  const start = Date.now();
  const tick = () => {
    const prog = Math.min((Date.now() - start) / duration, 1);
    const ease = 1 - Math.pow(1 - prog, 3);
    el.textContent = Math.round(target * ease) + suffix;
    if (prog < 1) requestAnimationFrame(tick);
  };
  tick();
}

function loadStats() {
  chrome.runtime.sendMessage({ type: 'GET_STATS' }, r => {
    const s = r?.stats || { sessions: 0, videos: 0, totalSec: 0, score: 0 };
    const score = Math.round(s.score || 0);

    // Ring
    const circ = 351.86;
    const offset = circ * (1 - score / 100);
    document.getElementById('scoreRing').style.strokeDashoffset = offset;
    animateNum(document.getElementById('scoreNum'), score, '%');

    // Tagline
    const tl = document.getElementById('scoreTagline');
    if (s.sessions === 0) tl.textContent = 'Run your first session to start tracking';
    else if (score < 30) tl.innerHTML = 'Algorithm is <span>' + score + '%</span> shifted — keep going!';
    else if (score < 70) tl.innerHTML = 'Algorithm is <span>' + score + '%</span> shifted — good progress!';
    else tl.innerHTML = 'Algorithm is <span>' + score + '%</span> shifted — almost there!';

    // Tiles
    animateNum(document.getElementById('statSessions'), s.sessions);
    animateNum(document.getElementById('statVideos'), s.videos);
    document.getElementById('statTime').textContent = formatTime(s.totalSec || 0);

    // Recent topics from history
    chrome.runtime.sendMessage({ type: 'GET_HISTORY' }, hr => {
      const hist = hr?.history || [];
      const rt = document.getElementById('recentTopics');
      if (!hist.length) {
        rt.innerHTML = `<div class="empty-state">
          <div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg></div>
          <div class="empty-t">No sessions yet</div>
          <div class="empty-s">Run your first detox session to see stats here</div>
        </div>`;
        return;
      }
      const topics = [...new Map(hist.map(h => [h.topic, h])).values()].slice(0, 5);
      rt.innerHTML = topics.map(h => {
        const d = new Date(h.date);
        const ago = relTime(d);
        return `<div class="topic-pill">
          <span class="topic-pill-name">${escHtml(h.topic)}</span>
          <span class="topic-pill-meta">${h.videos} videos · ${ago}</span>
        </div>`;
      }).join('');
    });
  });
}

// ── HISTORY TAB ───────────────────────────────────────────
function loadHistory() {
  chrome.runtime.sendMessage({ type: 'GET_HISTORY' }, r => {
    const hist = r?.history || [];
    const hl = document.getElementById('histList');
    if (!hist.length) {
      hl.innerHTML = `<div class="empty-state">
        <div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
        <div class="empty-t">No history yet</div>
        <div class="empty-s">Completed sessions will appear here</div>
      </div>`;
      return;
    }
    hl.innerHTML = hist.slice(0, 40).map(h => {
      const st = h.completed ? 'done' : (h.videos > 0 ? 'part' : 'fail');
      const lb = h.completed ? 'Done' : (h.videos > 0 ? 'Partial' : 'Failed');
      const dur = formatTime(h.durationSec || 0);
      return `<div class="hist-item">
        <div class="hist-dot ${st}"></div>
        <div class="hist-body">
          <div class="hist-topic">${escHtml(h.topic)}</div>
          <div class="hist-sub">${h.videos} videos · ${dur} · ${relTime(new Date(h.date))}</div>
        </div>
        <div class="hist-badge ${st}">${lb}</div>
      </div>`;
    }).join('');
  });
}

// ── SETTINGS TAB ──────────────────────────────────────────
function loadSettings() {
  // API key
  chrome.runtime.sendMessage({ type: 'GET_API_KEY' }, r => {
    if (r?.isCustom) document.getElementById('apiKeyInput').value = r.apiKey;
  });

  // Presets list
  chrome.runtime.sendMessage({ type: 'GET_PRESETS' }, r => {
    renderPresetList(r?.presets || []);
  });

  // YT status (re-check)
  checkYT();
}

function renderPresetList(list) {
  const pl = document.getElementById('presetList');
  if (!list.length) { pl.innerHTML = '<span style="font-size:0.7em;color:var(--tx3)">No presets saved yet</span>'; return; }
  pl.innerHTML = list.map(p =>
    `<div class="preset-item">
      <span>${escHtml(p)}</span>
      <button class="preset-del" data-preset="${escHtml(p)}" title="Remove">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>`
  ).join('');
  pl.querySelectorAll('.preset-del').forEach(btn => {
    btn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'DELETE_PRESET', payload: btn.dataset.preset }, r => {
        renderPresetList(r?.presets || []);
        loadPresets(); // refresh session tab chips
      });
    });
  });
}

// Save API key
document.getElementById('saveApiKey').addEventListener('click', () => {
  const key = document.getElementById('apiKeyInput').value.trim();
  const fb  = document.getElementById('apiKeyFeedback');
  chrome.runtime.sendMessage({ type: 'SAVE_API_KEY', payload: key }, () => {
    fb.className = 'sset-feedback ok'; fb.textContent = key ? '✓ Custom key saved' : '✓ Reverted to default key';
    setTimeout(() => { fb.textContent = ''; }, 3000);
  });
});

// Add preset from settings
document.getElementById('addPresetBtn').addEventListener('click', () => {
  const inp = document.getElementById('newPresetInput');
  const v = inp.value.trim();
  if (!v) return;
  chrome.runtime.sendMessage({ type: 'SAVE_PRESET', payload: v }, r => {
    renderPresetList(r?.presets || []);
    loadPresets();
    inp.value = '';
  });
});
document.getElementById('newPresetInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('addPresetBtn').click();
});

// Clear data
document.getElementById('clearDataBtn').addEventListener('click', () => {
  if (!confirm('Clear all session history and stats?')) return;
  chrome.runtime.sendMessage({ type: 'CLEAR_DATA' }, () => {
    if (activeTabIdx === 1) loadStats();
    if (activeTabIdx === 2) loadHistory();
  });
});

// ── Background message listener ───────────────────────────
chrome.runtime.onMessage.addListener(msg => {
  if (msg.type === 'LOG')      { addLog(msg.payload.time, msg.payload.msg, msg.payload.type); }
  if (msg.type === 'PROGRESS') { setProgress(msg.payload.pct, msg.payload.label); progressWrap.classList.add('show'); }
  if (msg.type === 'STATUS')   { setRunning(msg.payload.status === 'running'); }
});

// ── Main action buttons ───────────────────────────────────
detoxBtn.addEventListener('click', () => {
  const topic = topicInput.value.trim();
  const vc    = Math.max(1, Math.min(20, parseInt(videoCountEl.value) || 5));
  const wd    = Math.max(5, Math.min(300, parseInt(watchDurEl.value) || 30));
  if (!topic) { addLog(new Date().toLocaleTimeString('en-GB'), 'Please enter a topic first.', 'warn'); return; }
  chrome.runtime.sendMessage({ type: 'START', payload: { topic, videoCount: vc, watchPerVidSec: wd } });
});

stopBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'STOP' });
  stopBtn.disabled = true;
  stopBtn.textContent = 'Stopping…';
  setTimeout(() => { stopBtn.disabled = false; stopBtn.textContent = 'Stop Session'; }, 2000);
});

// ── Utility ───────────────────────────────────────────────
function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function relTime(d) {
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  return Math.floor(hrs / 24) + 'd ago';
}

// ── Init ─────────────────────────────────────────────────
chrome.runtime.sendMessage({ type: 'GET_STATE' }, r => {
  if (r?.state) syncState(r.state);
});
checkYT();
loadPresets();
