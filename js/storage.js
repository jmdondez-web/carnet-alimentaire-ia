// Problèmes de santé
const HEALTH_KEY = "carnet_health_conditions";

export function loadHealthConditions() {
  const stored = localStorage.getItem(HEALTH_KEY);
  return stored ? JSON.parse(stored) : [];
}

export function saveHealthConditions(conditions) {
  localStorage.setItem(HEALTH_KEY, JSON.stringify(conditions));
}