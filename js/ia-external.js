import { getIASettings, getAPIConfig } from './ia-settings.js';

const SYSTEM_PROMPT = `Tu es un assistant d'éducation alimentaire, PAS un médecin.

RÈGLES :
- Pas de diagnostic, pas de prescription, pas de calories, pas de jugement.
- Pas de suggestions de repas.
- Décris ce que contient le repas.
- Si interaction possible, dis : "⚠️ Attention : [aliment] peut interagir avec [médicament]. Consulte ton médecin."
- Si aucune interaction : "Aucune interaction connue détectée."
- Réponse courte, en français.`;

export async function analyseRepas(mealText, photoBase64, userMeds) {
  const settings = getIASettings();
  if (settings.mode !== "external") {
    return { success: false, error: "Mode externe non activé" };
  }
  
  const config = getAPIConfig();
  const medsText = userMeds.map(m => `${m.displayName} (${m.condition || ''})`).join(", ");
  
  const userPrompt = `Repas : ${mealText || "Pas de description texte"}\nMédicaments : ${medsText || "Aucun"}`;
  
  try {
    let body;
    if (photoBase64 && config.visionSupported) {
      body = {
        model: config.model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: [
            { type: "text", text: userPrompt },
            { type: "image_url", image_url: { url: photoBase64 } }
          ]}
        ],
        max_tokens: 400,
        temperature: 0.3
      };
    } else {
      body = {
        model: config.model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt }
        ],
        max_tokens: 300,
        temperature: 0.3
      };
    }
    
    const response = await fetch(config.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify(body)
    });
    
    if (!response.ok) {
      return { success: false, error: `API error ${response.status}` };
    }
    
    const data = await response.json();
    const analysis = data.choices?.[0]?.message?.content || "Analyse non disponible";
    
    return { success: true, analysis };
  } catch(e) {
    return { success: false, error: e.message };
  }
}