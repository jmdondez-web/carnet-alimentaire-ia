import { loadWaterHistory, saveWaterHistory } from './storage.js';

let history = {};

export function initWater() {
  history = loadWaterHistory();
}

export function getWaterTotal(date = null) {
  const targetDate = date || new Date().toISOString().slice(0, 10);
  return history[targetDate] || 0;
}

export function addWater(cl, date = null) {
  const targetDate = date || new Date().toISOString().slice(0, 10);
  history[targetDate] = (history[targetDate] || 0) + cl;
  saveWaterHistory(history);
  return history[targetDate];
}

export function resetWater(date = null) {
  const targetDate = date || new Date().toISOString().slice(0, 10);
  history[targetDate] = 0;
  saveWaterHistory(history);
  return 0;
}

export function getWaterHistory(lastDays = 7) {
  const sortedDates = Object.keys(history).sort().reverse();
  return sortedDates.slice(0, lastDays).map(date => ({
    date,
    total: history[date]
  }));
}

export function updateWaterUI(totalElemId, progressElemId, date = null) {
  const total = getWaterTotal(date);
  const totalElem = document.getElementById(totalElemId);
  const progressElem = document.getElementById(progressElemId);
  
  if (totalElem) totalElem.innerText = total;
  if (progressElem) progressElem.value = Math.min(total, 150);
}

export function renderWaterHistory(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  const historyData = getWaterHistory(7);
  if (historyData.length === 0) {
    container.innerHTML = "<p>Aucune donnée d'eau</p>";
    return;
  }
  
  let html = "<h3>📊 Historique (7 derniers jours)</h3><ul>";
  for (let item of historyData) {
    html += `<li>${item.date} : ${item.total} cl</li>`;
  }
  html += "</ul>";
  container.innerHTML = html;
}