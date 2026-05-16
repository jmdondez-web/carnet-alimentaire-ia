// ========== IA SETTINGS MODULE ==========
// Stockage local des préférences IA (mode, fournisseur, clé API, modèle)
// Avec consentement explicite RGPD pour le mode externe

const STORAGE_KEY = "carnet_ia_settings";
const CONSENT_KEY = "carnet_ia_consent";

export const PROVIDERS = {
  mistral: {
    name: "Mistral AI",
    description: "🇫🇷 Modèle français, bonnes performances, offre gratuite (1M tokens)",
    apiUrl: "https://api.mistral.ai/v1/chat/completions",
    models: ["mistral-tiny", "mistral-small", "mistral-medium"],
    visionSupported: true,
    visionModel: "pixtral-12b-2409",
    freeTrial: true
  },
  groq: {
    name: "Groq",
    description: "⚡ Ultra-rapide, modèle Llama 3, gratuit (limité)",
    apiUrl: "https://api.groq.com/openai/v1/chat/completions",
    models: ["llama3-8b-8192", "llama3-70b-8192"],
    visionSupported: false,
    visionModel: null,
    freeTrial: true
  }
};

// Configuration par défaut
const DEFAULT_SETTINGS = {
  mode: "local",        // "local" ou "external"
  provider: "mistral",  // "mistral" ou "groq"
  apiKey: "",
  model: "mistral-tiny",
  visionEnabled: true
};

// Gestion du consentement RGPD
export function hasUserConsented() {
  return localStorage.getItem(CONSENT_KEY) === "true";
}

export function setUserConsent(consent) {
  localStorage.setItem(CONSENT_KEY, consent);
}

export function resetUserConsent() {
  localStorage.removeItem(CONSENT_KEY);
}

// Charger les paramètres
export function getIASettings() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return { ...DEFAULT_SETTINGS };
  }
  try {
    const parsed = JSON.parse(stored);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch(e) {
    return { ...DEFAULT_SETTINGS };
  }
}

// Sauvegarder les paramètres
export function saveIASettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

// Mettre à jour un champ spécifique (AVEC CONSENTEMENT POUR MODE EXTERNE)
export function updateIASetting(key, value) {
  const settings = getIASettings();
  
  // Si on essaie de passer en mode externe, demander le consentement
  if (key === "mode" && value === "external" && !hasUserConsented()) {
    const consentGiven = confirm(
      "⚠️ ACTIVATION DE L'IA EXTERNE\n\n" +
      "Tes repas, photos et médicaments seront envoyés à un fournisseur IA externe.\n\n" +
      "Ces données transitent via leurs serveurs et ne sont pas stockées par l'application.\n\n" +
      "Elles peuvent être temporairement traitées par Mistral AI ou Groq selon ton choix.\n\n" +
      "Aucune donnée n'est conservée par ces services après l'analyse.\n\n" +
      "Acceptes-tu cette activation ?\n\n" +
      "(Tu peux revenir en mode local à tout moment)"
    );
    if (!consentGiven) {
      return false; // Ne pas changer le mode
    }
    setUserConsent(true);
  }
  
  settings[key] = value;
  saveIASettings(settings);
  return true;
}

// Vérifier si une clé API est présente (pour mode externe)
export function hasValidAPIKey() {
  const settings = getIASettings();
  return settings.mode === "external" && settings.apiKey && settings.apiKey.length > 10;
}

// Obtenir la configuration complète pour l'appel API
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

// Tester la connexion à l'API
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
        "Authorization": `Bearer ${settings.apiKey}`
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
      return { success: false, error: `HTTP ${response.status}: ${error}` };
    }
    
    const data = await response.json();
    return { success: true, message: data.choices?.[0]?.message?.content || "Connexion OK" };
  } catch(e) {
    return { success: false, error: e.message };
  }
}