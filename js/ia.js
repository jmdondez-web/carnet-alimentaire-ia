import { getIASettings, hasValidAPIKey } from './ia-settings.js';
import { analyseRepas as analyseExterne } from './ia-external.js';

let connaissances = null;

export async function loadKnowledgeBase() {
  try {
    const response = await fetch('/connaissances.json');
    connaissances = await response.json();
    console.log("✅ Base IA locale chargée");
    return true;
  } catch(e) {
    console.error("❌ Erreur IA locale", e);
    connaissances = { interactions: [], pnns_tips: [] };
    return false;
  }
}

export function detectInteractionLocal(mealText, userMeds) {
  if (!connaissances || !connaissances.interactions) return null;
  if (!userMeds || userMeds.length === 0) return null;
  
  const mealLower = mealText.toLowerCase();
  const userMedNames = userMeds.map(m => m.name);
  const userConditions = userMeds.map(m => m.condition).filter(c => c);
  
  for (let interaction of connaissances.interactions) {
    const alimentDetected = mealLower.includes(interaction.aliment.toLowerCase());
    if (!alimentDetected) continue;
    
    const medMatch = interaction.medicaments.some(med => 
      userMedNames.some(userMed => userMed.includes(med.toLowerCase())) ||
      userConditions.some(cond => cond.includes(med.toLowerCase()))
    );
    
    if (medMatch) {
      return {
        aliment: interaction.aliment,
        message: interaction.message,
        source: "local"
      };
    }
  }
  return null;
}

export function getRandomTip() {
  if (!connaissances || !connaissances.pnns_tips) return "Mange équilibré, bouge chaque jour !";
  const tips = connaissances.pnns_tips;
  return tips[Math.floor(Math.random() * tips.length)];
}

export async function analyseRepas(mealText, photoBase64, userMeds) {
  const settings = getIASettings();
  
  if (settings.mode === "local" || !hasValidAPIKey()) {
    const result = detectInteractionLocal(mealText, userMeds);
    return {
      success: true,
      analysis: result ? result.message : "Aucune interaction connue détectée.",
      interaction: result,
      source: "local"
    };
  }
  
  try {
    const externalResult = await analyseExterne(mealText, photoBase64, userMeds);
    
    if (externalResult.success) {
      const hasInteraction = externalResult.analysis.includes("⚠️") || 
                             externalResult.analysis.includes("interaction") ||
                             externalResult.analysis.includes("Attention");
      
      return {
        success: true,
        analysis: externalResult.analysis,
        interaction: hasInteraction ? { message: externalResult.analysis, source: "external" } : null,
        source: "external",
        provider: settings.provider
      };
    } else {
      const localResult = detectInteractionLocal(mealText, userMeds);
      return {
        success: true,
        analysis: localResult ? localResult.message : "Aucune interaction connue détectée.",
        interaction: localResult,
        source: "local (fallback)",
        fallbackReason: externalResult.error
      };
    }
  } catch(e) {
    console.error("Erreur analyse externe:", e);
    const localResult = detectInteractionLocal(mealText, userMeds);
    return {
      success: true,
      analysis: localResult ? localResult.message : "Aucune interaction connue détectée.",
      interaction: localResult,
      source: "local (erreur API)",
      fallbackReason: e.message
    };
  }
}