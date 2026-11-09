// Works in Firefox (event page) and Brave/Chrome (service worker).
const api = globalThis.browser ?? globalThis.chrome;

const ALARM = "tick";
const MAX_GAP_MS = 5 * 60 * 1000; // ignore gaps longer than this (sleep, crashes)
const KEEP_DAYS = 90;

const pad = (n) => String(n).padStart(2, "0");
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Run storage updates one at a time so events can't overwrite each other.
let queue = Promise.resolve();
const enqueue = (fn) => (queue = queue.then(fn).catch((e) => console.error(e)));

// Returns the hostname you're actively looking at, or null if not tracking.
async function getActiveDomain() {
  const idleState = await api.idle.queryState(60);
  if (idleState !== "active") return null;

  const win = await api.windows.getLastFocused();
  if (!win || !win.focused || win.incognito) return null;

  const [tab] = await api.tabs.query({ active: true, windowId: win.id });
  if (!tab || !tab.url || tab.incognito) return null;

  try {
    const url = new URL(tab.url);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function addSeconds(days, domain, ms, date) {
  if (ms <= 0) return;
  const key = dayKey(date);
  days[key] = days[key] || {};
  days[key][domain] = (days[key][domain] || 0) + ms / 1000;
}

// Save time spent since the last tick, then start timing whatever is active now.
async function tick() {
  const now = Date.now();
  const { current, days = {} } = await api.storage.local.get(["current", "days"]);

  if (current && current.domain) {
    const elapsed = Math.min(now - current.start, MAX_GAP_MS);
    const start = new Date(now - elapsed);
    const end = new Date(now);

    if (dayKey(start) === dayKey(end)) {
      addSeconds(days, current.domain, elapsed, end);
    } else {
      // Crossed midnight: split between the two days.
      const midnight = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
      addSeconds(days, current.domain, midnight - start.getTime(), start);
      addSeconds(days, current.domain, now - midnight, end);
    }
  }

  // Drop data older than KEEP_DAYS.
  const cutoff = dayKey(new Date(now - KEEP_DAYS * 86400000));
  for (const key of Object.keys(days)) {
    if (key < cutoff) delete days[key];
  }

  const domain = await getActiveDomain();
  await api.storage.local.set({
    days,
    current: domain ? { domain, start: now } : null,
  });
}

const onChange = () => enqueue(tick);

api.tabs.onActivated.addListener(onChange);
api.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url || changeInfo.status === "complete") onChange();
});
api.windows.onFocusChanged.addListener(onChange);
api.idle.setDetectionInterval(60);
api.idle.onStateChanged.addListener(onChange);
api.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM) onChange();
});
api.runtime.onStartup.addListener(onChange);
api.runtime.onInstalled.addListener(onChange);

// Lets the popup ask for an up-to-date save before drawing the chart.
api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "flush") {
    enqueue(tick).then(() => sendResponse({ ok: true }));
    return true; // keep the channel open for the async response
  }
});

// Make sure the once-a-minute alarm exists (it survives restarts, but check anyway).
api.alarms.get(ALARM).then((alarm) => {
  if (!alarm) api.alarms.create(ALARM, { periodInMinutes: 1 });
});
