import { getIASettings, hasValidAPIKey } from './ia-settings.js';
import { analyseRepas as analyseExterne } from './ia-external.js';

let connaissances = null;

export async function loadKnowledgeBase() {
  try {
    const response = await fetch('/connaissances.json');
    connaissances = await response.json();
    console.log("✅ Base IA locale chargée (" + (connaissances.interactions?.length || 0) + " interactions)");
    return true;
  } catch(e) {
    console.error("❌ Erreur IA locale", e);
    connaissances = { interactions: [], pnns_tips: [] };
    return false;
  }
}

// Normalise un texte : minuscules + suppression d'accents pour comparaison fiable
function normalize(str) {
  if (!str) return "";
  return str.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// Détecte les interactions aliment-médicament en croisant :
// - les médicaments de l'utilisateur (nom, DCI, marque),
// - l'indication associée à chaque médicament,
// - les problèmes de santé déclarés (ex: "hypertension" déclenche la règle sel).
export function detectInteractionLocal(mealText, userMeds, healthConditions = []) {
  if (!connaissances || !connaissances.interactions) return null;
  if ((!userMeds || userMeds.length === 0) && (!healthConditions || healthConditions.length === 0)) return null;

  const mealNorm = normalize(mealText);
  const userMedNames = (userMeds || []).map(m => normalize(m.name)).filter(Boolean);
  const userConditions = [
    ...(userMeds || []).map(m => normalize(m.condition)).filter(c => c),
    ...(healthConditions || []).map(normalize).filter(c => c)
  ];

  for (let interaction of connaissances.interactions) {
    // Détection aliment : via synonymes (ou nom d'aliment par défaut)
    const synonymes = interaction.synonymes && interaction.synonymes.length > 0
      ? interaction.synonymes
      : [interaction.aliment];
    const alimentDetected = synonymes.some(s => mealNorm.includes(normalize(s)));
    if (!alimentDetected) continue;

    // Détection médicament : nom du med, DCI, marque ou condition/pathologie
    const medMatch = (interaction.medicaments || []).some(med => {
      const medNorm = normalize(med);
      return userMedNames.some(userMed => userMed.includes(medNorm) || medNorm.includes(userMed)) ||
             userConditions.some(cond => cond.includes(medNorm) || medNorm.includes(cond));
    });

    if (medMatch) {
      return {
        aliment: interaction.aliment,
        gravite: interaction.gravite || "attention",
        message: interaction.message,
        source: "local"
      };
    }
  }
  return null;
}

// Détecte les allergènes déclarés par l'utilisateur dans la description du repas.
// Strictement éducatif : rappel de vérifier les étiquettes et de contacter un médecin.
export function detectAllergensLocal(mealText, allergies = []) {
  if (!allergies || allergies.length === 0) return [];
  const mealNorm = normalize(mealText);

  const alerts = [];
  for (let allergie of allergies) {
    const allergieNorm = normalize(allergie);
    if (!allergieNorm) continue;
    if (mealNorm.includes(allergieNorm)) {
      alerts.push({
        aliment: allergie,
        gravite: "attention",
        message: "⚠️ Ton repas semble contenir « " + allergie + " », que tu as indiqué comme allergie ou intolérance. Vérifie la composition exacte (étiquettes) et, en cas de doute ou de réaction, contacte ton médecin ou pharmacien. En cas de symptômes graves (gonflement, difficulté à respirer), appelle le 15 ou le 112.",
        source: "local"
      });
    }
  }
  return alerts;
}

export function getRandomTip() {
  if (!connaissances || !connaissances.pnns_tips) return "Mange équilibré, bouge chaque jour !";
  const tips = connaissances.pnns_tips;
  return tips[Math.floor(Math.random() * tips.length)];
}

// Message honnête quand aucune interaction n'est trouvée dans la base locale
export function noInteractionMessage() {
  const nb = connaissances?.interactions?.length || 0;
  return "Aucune interaction trouvée dans la base locale (limitée à " + nb + " interactions). " +
         "Cette base ne couvre pas toutes les interactions connues — si tu as un doute, montre ton carnet à ton médecin ou pharmacien.";
}

export async function analyseRepas(mealText, photoBase64, userMeds, healthConditions = [], allergies = []) {
  const settings = getIASettings();

  if (settings.mode === "local" || !hasValidAPIKey()) {
    const interaction = detectInteractionLocal(mealText, userMeds, healthConditions);
    const allergens = detectAllergensLocal(mealText, allergies);

    const messages = [];
    if (interaction) messages.push(interaction.message);
    else messages.push(noInteractionMessage());
    allergens.forEach(a => messages.push(a.message));

    return {
      success: true,
      analysis: messages.join("\n\n"),
      interaction: interaction || (allergens.length > 0 ? allergens[0] : null),
      allergens,
      source: "local"
    };
  }

  try {
    const externalResult = await analyseExterne(mealText, photoBase64, userMeds, healthConditions, allergies);

    if (externalResult.success) {
      const hasInteraction = externalResult.analysis.includes("⚠️") ||
                             externalResult.analysis.includes("interaction") ||
                             externalResult.analysis.includes("allerg") ||
                             externalResult.analysis.includes("Attention");

      return {
        success: true,
        analysis: externalResult.analysis,
        interaction: hasInteraction ? { message: externalResult.analysis, gravite: "attention", source: "external" } : null,
        source: "external",
        provider: settings.provider
      };
    } else {
      const localResult = detectInteractionLocal(mealText, userMeds, healthConditions);
      const allergens = detectAllergensLocal(mealText, allergies);
      const messages = [];
      if (localResult) messages.push(localResult.message);
      else messages.push(noInteractionMessage());
      allergens.forEach(a => messages.push(a.message));

      return {
        success: true,
        analysis: messages.join("\n\n"),
        interaction: localResult || (allergens.length > 0 ? allergens[0] : null),
        allergens,
        source: "local (fallback)",
        fallbackReason: externalResult.error
      };
    }
  } catch(e) {
    console.error("Erreur analyse externe:", e);
    const localResult = detectInteractionLocal(mealText, userMeds, healthConditions);
    const allergens = detectAllergensLocal(mealText, allergies);
    const messages = [];
    if (localResult) messages.push(localResult.message);
    else messages.push(noInteractionMessage());
    allergens.forEach(a => messages.push(a.message));

    return {
      success: true,
      analysis: messages.join("\n\n"),
      interaction: localResult || (allergens.length > 0 ? allergens[0] : null),
      allergens,
      source: "local (erreur API)",
      fallbackReason: e.message
    };
  }
}
