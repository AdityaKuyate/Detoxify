// background.js — Detoxify v2 Service Worker

const DEFAULT_API_KEY = 'AIzaSyCTWd_OCu-rIyKJjilBtKxhKEBWs07iRV4';
const SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';
const DEFAULT_PRESETS = ['Machine Learning', 'Rust Programming', 'Lo-fi Beats', 'Photography', 'Web Design'];

let session = {
  running: false,
  stopRequested: false,
  currentTabId: null,
  progress: 0,
  label: '',
  logs: [],
  topic: '',
  videoCount: 0
};

// ── Storage helpers ──────────────────────────────────────
async function getStorage(keys) {
  return new Promise(r => chrome.storage.local.get(keys, r));
}
async function setStorage(obj) {
  return new Promise(r => chrome.storage.local.set(obj, r));
}

async function getApiKey() {
  const d = await getStorage(['apiKey']);
  return d.apiKey || DEFAULT_API_KEY;
}

async function getStats() {
  const d = await getStorage(['stats']);
  return d.stats || { sessions: 0, videos: 0, totalSec: 0 };
}

async function getHistory() {
  const d = await getStorage(['history']);
  return d.history || [];
}

async function getPresets() {
  const d = await getStorage(['presets']);
  return d.presets || DEFAULT_PRESETS;
}

async function saveSessionResult(topic, videosWatched, durationSec, completed) {
  const [stats, history] = await Promise.all([getStats(), getHistory()]);

  stats.sessions += 1;
  stats.videos   += videosWatched;
  stats.totalSec += durationSec;
  // Score: increases ~8% per completed session, caps at 97
  stats.score = Math.min(97, (stats.score || 0) + (completed ? 8 + Math.random() * 4 : 2));

  const entry = {
    id: Date.now(),
    topic,
    videos: videosWatched,
    durationSec,
    completed,
    date: new Date().toISOString()
  };
  history.unshift(entry);
  if (history.length > 60) history.pop();

  await setStorage({ stats, history });
}

// ── Messaging helpers ────────────────────────────────────
function broadcast(type, payload) {
  chrome.runtime.sendMessage({ type, payload }).catch(() => {});
}
function pushLog(msg, type = 'default') {
  const now = new Date().toLocaleTimeString('en-GB');
  session.logs.unshift({ time: now, msg, type });
  if (session.logs.length > 40) session.logs.pop();
  broadcast('LOG', { time: now, msg, type });
}
function pushProgress(pct, label) {
  session.progress = pct;
  session.label = label;
  broadcast('PROGRESS', { pct, label });
}
function pushStatus(status) {
  session.running = status === 'running';
  broadcast('STATUS', { status });
}

// ── YouTube API ──────────────────────────────────────────
async function fetchVideoIds(topic, count, retries = 2) {
  const apiKey = await getApiKey();
  const params = new URLSearchParams({
    key: apiKey, part: 'snippet',
    q: topic + ' tutorial', type: 'video',
    maxResults: Math.min(count + 5, 25),
    videoDuration: 'long', relevanceLanguage: 'en',
    safeSearch: 'moderate'
  });
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${SEARCH_URL}?${params}`);
      if (!res.ok) {
        const err = await res.json();
        const msg = err.error?.message || 'API error';
        if (err.error?.code === 403) throw new Error('API quota exceeded. Add your own key in Settings.');
        if (attempt < retries) { await sleep(1500 * (attempt + 1)); continue; }
        throw new Error(msg);
      }
      const data = await res.json();
      return (data.items || []).filter(i => i.id?.videoId).map(i => i.id.videoId).slice(0, count);
    } catch (e) {
      if (attempt === retries) throw e;
      await sleep(1500 * (attempt + 1));
    }
  }
}

// ── Notification ─────────────────────────────────────────
function sendNotification(title, message) {
  chrome.notifications.create(`detoxify-${Date.now()}`, {
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title,
    message
  });
}

// ── Tab helpers ──────────────────────────────────────────
function openTab(videoId) {
  return new Promise(r => chrome.tabs.create({ url: `https://www.youtube.com/watch?v=${videoId}`, active: false }, t => r(t.id)));
}
function closeTab(id) { return chrome.tabs.remove(id).catch(() => {}); }
function sleep(ms)    { return new Promise(r => setTimeout(r, ms)); }

// ── Keep-alive ───────────────────────────────────────────
function keepAlive()  { chrome.alarms.create('dtx-alive', { periodInMinutes: 0.4 }); }
function stopAlive()  { chrome.alarms.clear('dtx-alive'); }
chrome.alarms.onAlarm.addListener(a => { if (a.name === 'dtx-alive') {} });

// ── Core session ─────────────────────────────────────────
async function runSession(topic, videoCount, watchPerVidSec) {
  const watchMs = watchPerVidSec * 1000;
  session.stopRequested = false;
  session.logs = [];
  session.topic = topic;
  session.videoCount = videoCount;
  keepAlive();
  pushStatus('running');
  pushLog(`Session: ${videoCount} videos × ${watchPerVidSec}s each`, 'info');
  pushProgress(2, 'Searching YouTube…');

  let videosWatched = 0;
  let totalSec = 0;
  let completed = false;

  try {
    pushLog(`Searching for "${topic}" videos…`, 'info');
    const ids = await fetchVideoIds(topic, videoCount);
    if (!ids.length) throw new Error('No videos found. Try a different topic.');
    pushLog(`Found ${ids.length} videos — starting session`, 'success');

    for (let i = 0; i < ids.length; i++) {
      if (session.stopRequested) break;
      const label = `Video ${i + 1} / ${ids.length}`;
      pushLog(`▶ ${label} — watching for ${watchPerVidSec}s`, 'default');
      pushProgress((i / ids.length) * 100, label);

      const tabId = await openTab(ids[i]);
      session.currentTabId = tabId;

      let elapsed = 0;
      while (elapsed < watchMs && !session.stopRequested) {
        await sleep(500);
        elapsed += 500;
        const inner = ((i + elapsed / watchMs) / ids.length) * 100;
        pushProgress(inner, `${label} — ${Math.round(elapsed / 1000)}s / ${watchPerVidSec}s`);
      }

      await closeTab(tabId);
      session.currentTabId = null;
      videosWatched++;
      totalSec += watchPerVidSec;
      pushLog(`✓ ${label} complete`, 'success');
    }

    if (!session.stopRequested) {
      completed = true;
      pushLog(`All ${ids.length} videos watched — algorithm updated!`, 'success');
      pushProgress(100, `Done — ${ids.length} videos watched`);
      sendNotification('Detoxify — Session Complete ✓', `Watched ${ids.length} videos on "${topic}". Your algorithm is shifting!`);
    } else {
      pushLog('Session stopped by user', 'warn');
      pushProgress(session.progress, 'Stopped');
    }
  } catch (err) {
    pushLog(`Error: ${err.message}`, 'error');
    pushProgress(0, 'Session failed');
    sendNotification('Detoxify — Session Failed', err.message);
  } finally {
    if (videosWatched > 0) await saveSessionResult(topic, videosWatched, totalSec, completed);
    stopAlive();
    pushStatus('idle');
  }
}

// ── Message router ───────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  (async () => {
    switch (msg.type) {
      case 'START':
        if (!session.running) runSession(msg.payload.topic, msg.payload.videoCount, msg.payload.watchPerVidSec);
        reply({ ok: true }); break;

      case 'STOP':
        session.stopRequested = true;
        if (session.currentTabId) { closeTab(session.currentTabId); session.currentTabId = null; }
        reply({ ok: true }); break;

      case 'GET_STATE':
        reply({ state: session }); break;

      case 'GET_STATS':
        reply({ stats: await getStats() }); break;

      case 'GET_HISTORY':
        reply({ history: await getHistory() }); break;

      case 'GET_PRESETS':
        reply({ presets: await getPresets() }); break;

      case 'SAVE_PRESET':
        const presets = await getPresets();
        if (!presets.includes(msg.payload)) { presets.push(msg.payload); await setStorage({ presets }); }
        reply({ presets }); break;

      case 'DELETE_PRESET':
        const p2 = (await getPresets()).filter(p => p !== msg.payload);
        await setStorage({ presets: p2 });
        reply({ presets: p2 }); break;

      case 'GET_API_KEY':
        const d = await getStorage(['apiKey']);
        reply({ apiKey: d.apiKey || '', isCustom: !!d.apiKey }); break;

      case 'SAVE_API_KEY':
        if (msg.payload) await setStorage({ apiKey: msg.payload });
        else await chrome.storage.local.remove('apiKey');
        reply({ ok: true }); break;

      case 'CLEAR_DATA':
        await chrome.storage.local.remove(['stats', 'history']);
        reply({ ok: true }); break;
    }
  })();
  return true;
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('[Detoxify v2] Installed');
  setStorage({ presets: DEFAULT_PRESETS });
});
