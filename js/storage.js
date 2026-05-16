export const KEYS = {
  REPAS: "carnet_repas",
  MEDS: "carnet_medicaments",
  WATER: "carnet_eau_historique",
  DARK_MODE: "carnet_dark_mode"
};

export function loadRepas() {
  const stored = localStorage.getItem(KEYS.REPAS);
  return stored ? JSON.parse(stored) : [];
}

export function saveRepas(repas) {
  localStorage.setItem(KEYS.REPAS, JSON.stringify(repas));
}

export function loadMeds() {
  const stored = localStorage.getItem(KEYS.MEDS);
  return stored ? JSON.parse(stored) : [];
}

export function saveMeds(meds) {
  localStorage.setItem(KEYS.MEDS, JSON.stringify(meds));
}

export function loadWaterHistory() {
  const stored = localStorage.getItem(KEYS.WATER);
  return stored ? JSON.parse(stored) : {};
}

export function saveWaterHistory(history) {
  localStorage.setItem(KEYS.WATER, JSON.stringify(history));
}

export function loadDarkMode() {
  return localStorage.getItem(KEYS.DARK_MODE) === "true";
}

export function saveDarkMode(isDark) {
  localStorage.setItem(KEYS.DARK_MODE, isDark);
}