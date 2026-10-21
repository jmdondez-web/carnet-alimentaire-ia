import { loadWaterHistory, saveWaterHistory } from './storage.js';

// history : { "YYYY-MM-DD": [ {cl: 33, time: "2026-10-21T14:32:00"}, ... ] }
// Migration automatique : ancien format { "YYYY-MM-DD": 153 } → [{cl:153, time:"12:00"}] conservé comme total du jour.
let history = {};

function migrateOld(entry) {
  if (Array.isArray(entry)) return entry;
  if (typeof entry === "number") return [{ cl: entry, time: "12:00", migrated: true }];
  return [];
}

export function initWater() {
  const raw = loadWaterHistory();
  history = {};
  let changed = false;
  for (const [date, entry] of Object.entries(raw)) {
    const migrated = migrateOld(entry);
    history[date] = migrated;
    if (migrated !== entry) changed = true;
  }
  if (changed) saveWaterHistory(history);
}

export function getWaterTotal(date = null) {
  const targetDate = date || new Date().toISOString().slice(0, 10);
  const entries = history[targetDate] || [];
  return entries.reduce((sum, e) => sum + (e.cl || 0), 0);
}

export function addWater(cl, date = null, time = null) {
  const targetDate = date || new Date().toISOString().slice(0, 10);
  const targetTime = time || new Date().toTimeString().slice(0, 5);
  if (!Array.isArray(history[targetDate])) history[targetDate] = migrateOld(history[targetDate]);
  history[targetDate].push({ cl, time: targetTime });
  saveWaterHistory(history);
  return getWaterTotal(targetDate);
}

export function resetWater(date = null) {
  const targetDate = date || new Date().toISOString().slice(0, 10);
  history[targetDate] = [];
  saveWaterHistory(history);
  return 0;
}

export function getWaterHistory(lastDays = 7) {
  const sortedDates = Object.keys(history).sort().reverse();
  return sortedDates.slice(0, lastDays).map(date => ({
    date,
    total: (history[date] || []).reduce((s, e) => s + (e.cl || 0), 0)
  }));
}

export function getWaterEntries(date = null) {
  const targetDate = date || new Date().toISOString().slice(0, 10);
  return history[targetDate] || [];
}

export function updateWaterUI(totalElemId, progressElemId, date = null) {
  const total = getWaterTotal(date);
  const totalElem = document.getElementById(totalElemId);
  const progressElem = document.getElementById(progressElemId);

  if (totalElem) totalElem.innerText = total;
  if (progressElem) progressElem.value = Math.min(total, 150);
}

// Histogramme intra-journalier : une barre par prise d'eau, hauteur ∝ cl, heure dessous.
export function renderWaterHistory(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const entries = getWaterEntries();
  const total = entries.reduce((s, e) => s + (e.cl || 0), 0);

  if (entries.length === 0) {
    container.innerHTML = "<p class='water-hist-empty'>Aucune prise d'eau aujourd'hui</p>";
    return;
  }

  const maxCl = Math.max(...entries.map(e => e.cl || 0));
  const bars = entries.map(e => {
    const h = Math.max(8, Math.round((e.cl / maxCl) * 100));
    return `<div class="water-hist-bar" title="${e.cl} cl à ${e.time}">
      <div class="water-hist-col" style="height:${h}%"><span>${e.cl}</span></div>
      <span class="water-hist-time">${e.time}</span>
    </div>`;
  }).join("");

  container.innerHTML =
    `<h3>📊 Prises d'eau du jour <span class="water-hist-total">— ${total} cl au total</span></h3>
     <div class="water-hist">${bars}</div>
     <p class="water-hist-scale">Hauteur ∝ quantité (20 / 33 / 50 cl) · heure de la prise dessous</p>`;
}
