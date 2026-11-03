// Impression repas + eau : page autonome, lit localStorage (même origine).
import * as Storage from './storage.js';

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/[&<>]/g, function(m) {
    if (m === "&") return "&amp;";
    if (m === "<") return "&lt;";
    return "&gt;";
  });
}

function fmtDate(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString("fr-BE") + " " + d.toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" });
}

function currentDays() {
  const n = parseInt(new URLSearchParams(location.search).get("days"));
  return [2, 7, 14, 30, 0].includes(n) ? n : 7;
}

function filterMeals(days) {
  const all = Storage.loadRepas().slice();
  all.sort(function(a, b) { return new Date(b.datetime) - new Date(a.datetime); });
  if (!days) return all;
  const limit = Date.now() - days * 86400000;
  return all.filter(function(m) { return new Date(m.datetime).getTime() >= limit; });
}

function waterRows(days) {
  const raw = Storage.loadWaterHistory();
  const rows = [];
  for (const entry of Object.entries(raw)) {
    const date = entry[0];
    const val = entry[1];
    let total = 0;
    if (Array.isArray(val)) total = val.reduce(function(s, e) { return s + (e.cl || 0); }, 0);
    else if (typeof val === "number") total = val;
    rows.push({ date: date, total: total });
  }
  rows.sort(function(a, b) { return b.date.localeCompare(a.date); });
  if (days) {
    const limitDate = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    return rows.filter(function(r) { return r.date >= limitDate; });
  }
  return rows;
}

async function fetchVersion() {
  try {
    const r = await fetch("version.txt", { cache: "no-store" });
    if (r.ok) return (await r.text()).trim();
  } catch (e) {}
  return "";
}

async function render() {
  const days = currentDays();
  const select = document.getElementById("periodSelect");
  if (select) select.value = String(days);

  const meals = filterMeals(days);
  const water = waterRows(days);
  const waterTotal = water.reduce(function(s, r) { return s + r.total; }, 0);
  const version = await fetchVersion();
  const periodLabel = days ? days + " derniers jours" : "historique complet";
  document.getElementById("docMeta").textContent =
    "Période : " + periodLabel +
    " · Édité le " + new Date().toLocaleString("fr-BE") +
    (version ? " · Version " + version : "") +
    " · Document éducatif, sans valeur médicale.";

  let html = "";

  html += "<h2>💧 Hydratation</h2>";
  if (water.length === 0) {
    html += "<p>Aucune donnée d'eau sur la période.</p>";
  } else {
    html += "<table><tr><th>Jour</th><th>Total (cl)</th></tr>";
    for (const r of water) {
      html += "<tr><td>" + escapeHtml(r.date) + "</td><td>" + r.total + "</td></tr>";
    }
    html += "<tr class='total-row'><td>Total période</td><td>" + waterTotal + " cl</td></tr></table>";
  }

  html += "<h2>🍽️ Repas</h2>";
  if (meals.length === 0) {
    html += "<p>Aucun repas enregistré sur la période.</p>";
  } else {
    html += "<table><tr><th>Quand</th><th>Repas</th><th>Alertes détectées</th></tr>";
    for (const m of meals) {
      const alert = m.interactionDetected ? escapeHtml(m.interactionDetected.message) : "";
      html += "<tr><td>" + escapeHtml(fmtDate(m.datetime)) + "</td><td>" + escapeHtml(m.text || "") + "</td><td class='alert-cell'>" + alert + "</td></tr>";
    }
    html += "</table>";
  }

  document.getElementById("docContent").innerHTML = html;
}

document.getElementById("printBtn").onclick = function() { window.print(); };
const sel = document.getElementById("periodSelect");
if (sel) sel.onchange = function() {
  const days = parseInt(sel.value);
  const url = new URL(location.href);
  if (days) url.searchParams.set("days", String(days));
  else url.searchParams.delete("days");
  history.replaceState(null, "", url);
  render();
};
render();
