import { getIASettings, getAPIConfig } from './ia-settings.js';

// Identifiant pseudonymisé par appareil : UUID aléatoire, aucun lien avec
// l'identité. Sert uniquement au comptage d'utilisation (qui teste ?).
const CLIENT_ID_KEY = 'carnet_client_id';
function getClientId() {
  let id = localStorage.getItem(CLIENT_ID_KEY);
  if (!id) {
    id = (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2));
    localStorage.setItem(CLIENT_ID_KEY, id);
  }
  return id;
}

const SYSTEM_PROMPT = `Tu es un assistant d'éducation alimentaire, PAS un médecin.

RÈGLES :
- Pas de diagnostic, pas de prescription, pas de calories, pas de jugement.
- Pas de suggestions de repas.
- Décris ce que contient le repas.
- Si interaction possible, dis : "⚠️ Attention : [aliment] peut interagir avec [médicament]. Consulte ton médecin."
- Si le repas contient un aliment correspondant à une allergie déclarée, alerte : "⚠️ Ton repas contient [aliment], déclaré comme allergie. Vérifie les étiquettes et consulte ton médecin. En cas de symptômes graves, appelle le 15/112."
- Tiens compte des problèmes de santé déclarés (ex: hypertension → limiter le sel) de façon éducative, sans diagnostic.
- Si aucune interaction : "Aucune interaction connue détectée."
- Réponse courte, en français.`;

function buildMessages(mealText, userMeds, healthConditions, allergies) {
  const medsText = (userMeds || []).map(m => `${m.displayName} (${m.condition || ''})`).join(", ");
  const conditionsText = (healthConditions || []).join(", ");
  const allergiesText = (allergies || []).join(", ");
  return `Repas : ${mealText || "Pas de description texte"}
Médicaments : ${medsText || "Aucun"}
Problèmes de santé : ${conditionsText || "Aucun"}
Allergies/intolérances : ${allergiesText || "Aucune"}`;
}

export async function analyseRepas(mealText, photoBase64, userMeds, healthConditions = [], allergies = []) {
  const settings = getIASettings();
  if (settings.mode !== "external") {
    return { success: false, error: "Mode externe non activé" };
  }

  const config = getAPIConfig();
  const userPrompt = buildMessages(mealText, userMeds, healthConditions, allergies);

  // Deux chemins, mêmes messages :
  // 1. Clé personnelle présente → appel direct à Mistral (utile hors LXC).
  // 2. Sinon → proxy du LXC (/api/analyse) : la clé serveur fait le travail,
  //    l'utilisateur n'a rien à configurer. Aucune donnée persistée côté serveur.
  const useProxy = !settings.apiKey;

  try {
    let body;
    if (photoBase64 && config.visionSupported) {
      body = {
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: [
            { type: "text", text: userPrompt },
            { type: "image_url", image_url: { url: photoBase64 } }
          ]}
        ],
        vision: true,
        clientId: getClientId()
      };
    } else {
      body = {
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt }
        ],
        vision: false,
        clientId: getClientId()
      };
    }

    let data;
    if (useProxy) {
      const response = await fetch("/api/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!response.ok) {
        const errText = await response.text();
        return { success: false, error: `Proxy ${response.status}: ${errText}` };
      }
      data = await response.json();
    } else {
      body.model = config.model;
      body.max_tokens = 400;
      body.temperature = 0.3;
      const response = await fetch(config.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + settings.apiKey
        },
        body: JSON.stringify(body)
      });
      if (!response.ok) {
        return { success: false, error: `API error ${response.status}` };
      }
      data = await response.json();
    }

    const analysis = data.choices?.[0]?.message?.content || "Analyse non disponible";
    return { success: true, analysis };
  } catch(e) {
    return { success: false, error: e.message };
  }
}
