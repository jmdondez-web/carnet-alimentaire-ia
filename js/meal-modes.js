// ========== MODES DE REPAS (sur le pouce / à table) ==========
import { saveRepasDraft, loadRepasDraft } from './storage.js';
import * as Storage from './storage.js';
import * as UI from './ui.js';

const DEFAULT_QUICK_MEALS = [
  { label: "☕ Petit-déj", text: "Petit-déjeuner : café, pain, beurre, confiture" },
  { label: "🥪 Sandwich bureau", text: "Sandwich au bureau" },
  { label: "🍲 Plat du jour", text: "Plat du jour" },
  { label: "🥗 Salade", text: "Salade composée" },
  { label: "🍝 Pâtes soir", text: "Assiette de pâtes" },
  { label: "🍎 Goûter fruit", text: "Un fruit" }
];

let currentMode = null;

// Initialise les modes. onQuickMeal(mealText) est appelé quand une chip est tapée
// (le reste — enregistrement, analyse — reste géré par app.js, un seul flux).
export function initMealModes(onQuickMeal) {
  currentMode = loadMode();

  // Bascule des modes — le mode détermine la seule section d'encodage visible
  document.querySelectorAll('.mode-switch button').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      setMode(mode);
      saveMode(mode);
    });
  });

  // Mode sur le pouce : chips de repas rapides
  const chipsWrap = document.getElementById('quickChips');
  if (chipsWrap) {
    chipsWrap.innerHTML = getQuickMeals().map((m, i) =>
      `<button class="chip" data-i="${i}">${m.label}</button>`
    ).join('');
    chipsWrap.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const meal = getQuickMeals()[parseInt(chip.dataset.i)];
        onQuickMeal(meal);
      });
    });
  }

  // Mode à table : brouillon texte persistant (survit à la fermeture de l'appli)
  const textArea = document.getElementById('mealText');
  if (textArea) {
    textArea.addEventListener('input', () => {
      const draft = loadRepasDraft();
      draft.text = textArea.value;
      saveRepasDraft(draft);
    });
    const draft = loadRepasDraft();
    if (draft.text) {
      textArea.value = draft.text;
      if (currentMode === 'lent') UI.showToast && UI.showToast('Brouillon restauré 🍽️');
    }
  }

  setMode(currentMode || 'pouce');
}

function loadMode() {
  return localStorage.getItem('carnet_meal_mode') || 'pouce';
}

function saveMode(mode) {
  localStorage.setItem('carnet_meal_mode', mode);
}

function getQuickMeals() {
  const stored = localStorage.getItem('carnet_quick_meals');
  if (stored) {
    try { return JSON.parse(stored); } catch(e) { return DEFAULT_QUICK_MEALS; }
  }
  return DEFAULT_QUICK_MEALS;
}

function setMode(mode) {
  currentMode = mode;
  document.querySelectorAll('.mode-switch button').forEach(b =>
    b.classList.toggle('on', b.dataset.mode === mode)
  );
  // Une seule zone d'encodage visible : chips (pouce) OU formulaire détaillé (à table)
  const quick = document.getElementById('quick-zone');
  const detailed = document.getElementById('detailed-meal-section');
  if (quick) quick.style.display = mode === 'pouce' ? 'block' : 'none';
  if (detailed) detailed.style.display = mode === 'lent' ? 'block' : 'none';
  if (mode === 'lent') {
    const ta = document.getElementById('mealText');
    if (ta) ta.focus();
  }
}

export function getCurrentMode() {
  return currentMode;
}
