// ========== IA SETTINGS MODULE ==========
// Stockage local des préférences IA (mode, fournisseur, clé API, modèle)
// Le consentement RGPD est recueilli via l'écran dédié (consent.js), plus de confirm() natif
//
// Politique fournisseur : UNIQUEMENT Mistral AI (entreprise française, hébergement européen,
// offre gratuite sans carte bancaire, RGPD). Aucun fournisseur extra-européen.

const STORAGE_KEY = "carnet_ia_settings";
const CONSENT_KEY = "carnet_ia_consent";

export const PROVIDERS = {
  mistral: {
    name: "Mistral AI (France)",
    description: "🇪🇺 Fournisseur européen (France), RGPD, offre gratuite sans carte bancaire. Vérification par SMS requise.",
    apiUrl: "https://api.mistral.ai/v1/chat/completions",
    models: ["mistral-small-latest", "open-mistral-nemo"],
    visionSupported: true,
    visionModel: "pixtral-12b-latest",
    freeTier: true
  }
};

const DEFAULT_SETTINGS = {
  mode: "local",
  provider: "mistral",
  apiKey: "",
  model: "mistral-small-latest",
  visionEnabled: true
};

// Migration douce : si un ancien réglage référence un modèle ou fournisseur disparu
// (mistral-tiny, mistral-medium, pixtral-12b-2409, groq…), on repasse aux valeurs par défaut.
export function getIASettings() {
  const stored = localStorage.getItem(STORAGE_KEY);
  const base = { ...DEFAULT_SETTINGS };
  if (!stored) return base;
  try {
    const parsed = JSON.parse(stored);
    const merged = { ...base, ...parsed };
    if (!PROVIDERS[merged.provider]) {
      merged.provider = "mistral";
      merged.model = DEFAULT_SETTINGS.model;
    }
    const provider = PROVIDERS[merged.provider];
    if (merged.model && !provider.models.includes(merged.model)) {
      merged.model = DEFAULT_SETTINGS.model;
    }
    return merged;
  } catch(e) {
    return base;
  }
}

export function hasUserConsented() {
  return localStorage.getItem(CONSENT_KEY) === "true";
}

export function setUserConsent(consent) {
  localStorage.setItem(CONSENT_KEY, consent);
}

export function resetUserConsent() {
  localStorage.removeItem(CONSENT_KEY);
}

export function saveIASettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

// Mettre à jour un champ spécifique.
// NOTE : le passage en mode "external" exige un consentement DÉJÀ recueilli
// via l'écran dédié (consent.js). Sinon retourne false.
export function updateIASetting(key, value) {
  const settings = getIASettings();

  if (key === "mode" && value === "external" && !hasUserConsented()) {
    return false;
  }

  settings[key] = value;
  saveIASettings(settings);
  return true;
}

export function hasValidAPIKey() {
  const settings = getIASettings();
  // Clé personnelle OU proxy du serveur : le mode externe est valide sans clé
  // personnelle dès que l'appli est servie par le LXC (les appels sans clé
  // passent par /api/analyse, clé serveur). En cas d'échec du proxy, l'analyse
  // retombe automatiquement sur le mode local (ia.js).
  return settings.mode === "external" && (!settings.apiKey || settings.apiKey.length > 10);
}

export function getAPIConfig() {
  const settings = getIASettings();
  const provider = PROVIDERS[settings.provider];
  return {
    url: provider.apiUrl,
    model: settings.visionEnabled && provider.visionSupported && settings.mode === "external"
           ? provider.visionModel
           : settings.model,
    apiKey: settings.apiKey,
    provider: settings.provider,
    visionSupported: provider.visionSupported && settings.visionEnabled
  };
}

export async function testAPIConnection() {
  const settings = getIASettings();
  if (!settings.apiKey) {
    return { success: false, error: "Clé API manquante" };
  }

  const config = getAPIConfig();

  try {
    const response = await fetch(config.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + settings.apiKey
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "user", content: "Dis 'connexion réussie' en une phrase" }
        ],
        max_tokens: 20
      })
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: "HTTP " + response.status + ": " + error };
    }

    const data = await response.json();
    return { success: true, message: data.choices?.[0]?.message?.content || "Connexion OK" };
  } catch(e) {
    return { success: false, error: e.message };
  }
}
