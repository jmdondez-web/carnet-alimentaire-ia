import { loadWaterHistory, loadHealthConditions, loadAllergies, saveRepas, loadRepas, saveWaterHistory, saveHealthConditions, saveAllergies } from './storage.js';
import { getMeds } from './medications.js';

export function exportJSON(repasList) {
  const exportData = {
    repas: repasList,
    eau: loadWaterHistory(),
    medicaments: getMeds(),
    problemes_sante: loadHealthConditions(),
    allergies: loadAllergies(),
    exportDate: new Date().toISOString()
  };
  const dataStr = JSON.stringify(exportData, null, 2);
  downloadFile(dataStr, `carnet_${new Date().toISOString().slice(0,19)}.json`, 'application/json');
}

// ========== IMPORT (migration entre appareils/origines) ==========
// Fusionne un export JSON dans les données locales : les repas existants
// sont conservés (dédupliqués par date+texte), l'eau par date, les listes
// santé dédupliquées par nom. Rien n'est envoyé au serveur.
export async function importJSON(file) {
  const text = await file.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error('Fichier JSON invalide.');
  }
  if (!data || typeof data !== 'object' || (!data.repas && !data.eau && !data.medicaments && !data.problemes_sante && !data.allergies)) {
    throw new Error('Ce fichier ne semble pas être un export du carnet (clés manquantes).');
  }

  // --- Repas : fusion + dédoublonnage (datetime + text) ---
  const existingRepas = loadRepas();
  const seen = new Set(existingRepas.map(r => `${r.datetime}|${r.text}`));
  const newRepas = Array.isArray(data.repas)
    ? data.repas.filter(r => r && r.datetime && r.text && !seen.has(`${r.datetime}|${r.text}`))
    : [];
  const allRepas = existingRepas.concat(newRepas).sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
  saveRepas(allRepas);

  // --- Eau : fusion par date (l'import ne diminue jamais une valeur) ---
  if (data.eau && typeof data.eau === 'object') {
    const water = loadWaterHistory();
    for (const [date, cl] of Object.entries(data.eau)) {
      if (typeof cl === 'number' && (!water[date] || cl > water[date])) water[date] = cl;
    }
    saveWaterHistory(water);
  }

  // --- Médicaments : fusion + dédoublonnage par name (clé basse) ---
  if (Array.isArray(data.medicaments)) {
    const { loadMeds, saveMeds } = await import('./storage.js');
    const existing = loadMeds();
    const existingNames = new Set(existing.map(m => m.name));
    const newMeds = data.medicaments.filter(m => m && m.name && !existingNames.has(m.name));
    if (newMeds.length) saveMeds(existing.concat(newMeds));
  }

  // --- Problèmes de santé : fusion + dédoublonnage ---
  if (Array.isArray(data.problemes_sante)) {
    const existing = loadHealthConditions();
    const set = new Set(existing);
    const newItems = data.problemes_sante.filter(c => typeof c === 'string' && !set.has(c));
    if (newItems.length) saveHealthConditions(existing.concat(newItems));
  }

  // --- Allergies : fusion + dédoublonnage ---
  if (Array.isArray(data.allergies)) {
    const existing = loadAllergies();
    const set = new Set(existing);
    const newItems = data.allergies.filter(a => typeof a === 'string' && !set.has(a));
    if (newItems.length) saveAllergies(existing.concat(newItems));
  }

  return {
    repas: newRepas.length,
    medicaments: Array.isArray(data.medicaments) ? data.medicaments.length : 0,
    problemes_sante: Array.isArray(data.problemes_sante) ? data.problemes_sante.length : 0,
    allergies: Array.isArray(data.allergies) ? data.allergies.length : 0
  };
}

export function exportReadable(repasList) {
  let content = "CARNET ALIMENTAIRE\n===============\n\n";
  content += `Exporté le : ${new Date().toLocaleString()}\n\n`;

  content += "💊 MÉDICAMENTS :\n";
  getMeds().forEach(m => content += `- ${m.displayName} (${m.condition || '-'})\n`);

  content += "\n🩺 PROBLÈMES DE SANTÉ :\n";
  const conditions = loadHealthConditions();
  if (conditions.length === 0) content += "- Aucun\n";
  conditions.forEach(c => content += `- ${c}\n`);

  content += "\n🥜 ALLERGIES/INTOLÉRANCES :\n";
  const allergies = loadAllergies();
  if (allergies.length === 0) content += "- Aucune\n";
  allergies.forEach(a => content += `- ${a}\n`);

  content += "\n💧 EAU :\n";
  Object.entries(loadWaterHistory()).forEach(([date, cl]) => content += `- ${date} : ${cl} cl\n`);

  content += "\n🍽️ REPAS :\n";
  repasList.forEach((meal, i) => {
    content += `\n${i+1}. ${new Date(meal.datetime).toLocaleString()}\n   ${meal.text}\n`;
    if (meal.interactionDetected) content += `   ⚠️ ${meal.interactionDetected.message}\n`;
  });

  downloadFile(content, `carnet_${new Date().toISOString().slice(0,19)}.txt`, 'text/plain');
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
