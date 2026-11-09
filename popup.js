const api = globalThis.browser ?? globalThis.chrome;

const pad = (n) => String(n).padStart(2, "0");
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

let days = {};
let offset = 0; // 0 = today, 1 = yesterday, ...

const $ = (id) => document.getElementById(id);

function fmt(seconds) {
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

const dateFor = (off) => {
  const d = new Date();
  d.setDate(d.getDate() - off);
  return d;
};
const totalFor = (key) => Object.values(days[key] || {}).reduce((a, b) => a + b, 0);

function render() {
  const date = dateFor(offset);
  const data = days[dayKey(date)] || {};
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, v]) => sum + v, 0);

  $("dayLabel").textContent =
    offset === 0 ? "Today" : offset === 1 ? "Yesterday" : date.toLocaleDateString(undefined, { weekday: "long" });
  $("dayDate").textContent = date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  $("totalValue").textContent = fmt(total);
  $("next").disabled = offset === 0;
  $("prev").disabled = offset >= 89;

  // 7-day chart (ending today)
  const week = [];
  for (let i = 6; i >= 0; i--) week.push({ off: i, d: dateFor(i), secs: totalFor(dayKey(dateFor(i))) });
  const max = Math.max(...week.map((w) => w.secs), 1);
  $("week").innerHTML = "";
  for (const w of week) {
    const btn = document.createElement("button");
    btn.className = "col" + (w.off === offset ? " selected" : "");
    btn.title = `${w.d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}: ${fmt(w.secs)}`;
    btn.setAttribute("aria-label", btn.title);
    const bar = document.createElement("div");
    bar.className = "bar";
    bar.style.height = `${Math.max((w.secs / max) * 100, 2)}%`;
    const label = document.createElement("span");
    label.className = "d";
    label.textContent = w.d.toLocaleDateString(undefined, { weekday: "narrow" });
    btn.append(bar, label);
    btn.addEventListener("click", () => { offset = w.off; render(); });
    $("week").append(btn);
  }

  // Site list
  const list = $("sites");
  list.innerHTML = "";
  $("empty").hidden = entries.length > 0;
  const top = entries[0] ? entries[0][1] : 1;
  for (const [domain, secs] of entries.slice(0, 30)) {
    const li = document.createElement("li");
    const row = document.createElement("div");
    row.className = "row";
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = domain;
    const time = document.createElement("span");
    time.className = "time";
    time.textContent = fmt(secs);
    row.append(name, time);
    const track = document.createElement("div");
    track.className = "track";
    const fill = document.createElement("div");
    fill.className = "fill";
    fill.style.width = `${(secs / top) * 100}%`;
    track.append(fill);
    li.append(row, track);
    list.append(li);
  }
}

async function load() {
  try { await api.runtime.sendMessage({ type: "flush" }); } catch { /* background may be waking up */ }
  ({ days = {} } = await api.storage.local.get("days"));
  render();
}

$("prev").addEventListener("click", () => { offset++; render(); });
$("next").addEventListener("click", () => { if (offset > 0) { offset--; render(); } });
$("clear").addEventListener("click", async () => {
  if (confirm("Delete all tracked time? This can't be undone.")) {
    await api.storage.local.set({ days: {}, current: null });
    days = {};
    render();
  }
});

load();
