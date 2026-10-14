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
  // En-cas par défaut
  { label: "🍎 Fruit", text: "Un fruit (en-cas)" },
  { label: "🍬 Bonbons/sucres", text: "Bonbons, sucreries (en-cas)" },
  { label: "🥔 Chips", text: "Chips (en-cas)" }
];

const QUICK_MEALS_KEY = 'carnet_quick_meals';

let currentMode = null;
let chipsEditing = false;
let onQuickMealCallback = null;

// Initialise les modes. onQuickMeal(mealText) est appelé quand une chip est tapée
// (le reste — enregistrement, analyse — reste géré par app.js, un seul flux).
export function initMealModes(onQuickMeal) {
  currentMode = loadMode();
  onQuickMealCallback = onQuickMeal;

  // Bascule des modes — le mode détermine la seule section d'encodage visible
  document.querySelectorAll('.mode-switch button').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      setMode(mode);
      saveMode(mode);
    });
  });

  // Mode sur le pouce : chips personnalisables
  renderChips();

  const editBtn = document.getElementById('editChipsBtn');
  if (editBtn) editBtn.addEventListener('click', toggleChipsEditing);

  const addBtn = document.getElementById('addChipBtn');
  if (addBtn) addBtn.addEventListener('click', addChipFromInput);

  const newChipInput = document.getElementById('newChipInput');
  if (newChipInput) {
    newChipInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addChipFromInput();
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

// ---------- Chips sur le pouce (personnalisables) ----------

function getQuickMeals() {
  const stored = localStorage.getItem(QUICK_MEALS_KEY);
  if (stored) {
    try { return JSON.parse(stored); } catch(e) { return DEFAULT_QUICK_MEALS.slice(); }
  }
  return DEFAULT_QUICK_MEALS.slice();
}

function saveQuickMeals(meals) {
  localStorage.setItem(QUICK_MEALS_KEY, JSON.stringify(meals));
}

function renderChips() {
  const chipsWrap = document.getElementById('quickChips');
  if (!chipsWrap) return;
  const meals = getQuickMeals();
  chipsWrap.innerHTML = meals.map((m, i) =>
    chipsEditing
      ? `<span class="chip chip-edit"><button class="chip-label" data-i="${i}">${m.label}</button><button class="chip-del" data-i="${i}" aria-label="Supprimer">✖️</button></span>`
      : `<button class="chip" data-i="${i}">${m.label}</button>`
  ).join('');

  chipsWrap.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const meal = getQuickMeals()[parseInt(chip.dataset.i)];
      onQuickMealCallback(meal);
    });
  });

  if (chipsEditing) {
    chipsWrap.querySelectorAll('.chip-label').forEach(lbl => {
      lbl.addEventListener('click', () => {
        const i = parseInt(lbl.dataset.i);
        const meals = getQuickMeals();
        const newLabel = prompt('Renommer (garde un emoji au début) :', meals[i].label);
        if (newLabel && newLabel.trim()) {
          meals[i].label = newLabel.trim().slice(0, 30);
          meals[i].text = meals[i].text || newLabel.trim();
          saveQuickMeals(meals);
          renderChips();
        }
      });
    });
    chipsWrap.querySelectorAll('.chip-del').forEach(del => {
      del.addEventListener('click', () => {
        const meals = getQuickMeals();
        meals.splice(parseInt(del.dataset.i), 1);
        saveQuickMeals(meals);
        renderChips();
      });
    });
  }
}

function toggleChipsEditing() {
  chipsEditing = !chipsEditing;
  const editBtn = document.getElementById('editChipsBtn');
  const editRow = document.getElementById('chipsEditRow');
  if (editBtn) editBtn.textContent = chipsEditing ? '✓ Terminé' : '✏️ Modifier';
  if (editRow) editRow.style.display = chipsEditing ? 'flex' : 'none';
  if (!chipsEditing) {
    const input = document.getElementById('newChipInput');
    if (input) input.value = '';
  }
  renderChips();
}

function addChipFromInput() {
  const input = document.getElementById('newChipInput');
  if (!input || !input.value.trim()) return;
  const label = input.value.trim().slice(0, 30);
  const meals = getQuickMeals();
  meals.push({ label, text: label });
  saveQuickMeals(meals);
  input.value = '';
  renderChips();
  UI.showToast && UI.showToast('Raccourci ajouté ✓');
}

// ---------- Modes ----------

function loadMode() {
  return localStorage.getItem('carnet_meal_mode') || 'pouce';
}

function saveMode(mode) {
  localStorage.setItem('carnet_meal_mode', mode);
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
