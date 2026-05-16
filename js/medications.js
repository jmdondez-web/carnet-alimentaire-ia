import { loadMeds, saveMeds } from './storage.js';

let meds = [];

export function initMeds() {
  meds = loadMeds();
}

export function getMeds() {
  return [...meds];
}

export function addMed(name, condition) {
  const newMed = {
    id: Date.now(),
    name: name.toLowerCase().trim(),
    condition: condition.toLowerCase().trim(),
    displayName: name.trim()
  };
  meds.push(newMed);
  saveMeds(meds);
  return meds;
}

export function removeMed(id) {
  meds = meds.filter(m => m.id !== id);
  saveMeds(meds);
  return meds;
}

export function renderMeds(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  if (meds.length === 0) {
    container.innerHTML = "<li>Aucun traitement enregistré</li>";
    return;
  }
  
  container.innerHTML = meds.map(med => `
    <li>
      <span><strong>${escapeHtml(med.displayName)}</strong> ${med.condition ? `(${escapeHtml(med.condition)})` : ''}</span>
      <button class="remove-med" data-id="${med.id}">🗑️</button>
    </li>
  `).join("");
  
  document.querySelectorAll('.remove-med').forEach(btn => {
    btn.addEventListener('click', () => {
      removeMed(parseInt(btn.dataset.id));
      renderMeds(containerId);
    });
  });
}

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/[&<>]/g, function(m) {
    if (m === "&") return "&amp;";
    if (m === "<") return "&lt;";
    if (m === ">") return "&gt;";
    return m;
  });
}