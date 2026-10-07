import { loadWaterHistory, loadHealthConditions, loadAllergies } from './storage.js';
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
