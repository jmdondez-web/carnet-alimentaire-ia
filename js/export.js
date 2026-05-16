import { loadWaterHistory } from './storage.js';
import { getMeds } from './medications.js';

export function exportJSON(repasList) {
  const exportData = {
    repas: repasList,
    eau: loadWaterHistory(),
    medicaments: getMeds(),
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