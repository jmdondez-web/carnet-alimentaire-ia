// ========== MODES DE REPAS (sur le pouce / à table) ==========
import { saveRepasDraft, loadRepasDraft, clearRepasDraft } from './storage.js';
import * as Storage from './storage.js';
import * as Medications from './medications.js';
import * as IA from './ia.js';
import * as UI from './ui.js';
import * as Dashboard from './dashboard.js';

const DEFAULT_QUICK_MEALS = [
  { label: "☕ Petit-déj", text: "Petit-déjeuner : café, pain, beurre, confiture" },
  { label: "🥪 Sandwich bureau", text: "Sandwich au bureau" },
  { label: "🍲 Plat du jour", text: "Plat du jour" },
  { label: "🥗 Salade", text: "Salade composée" },
  { label: "🍝 Pâtes soir", text: "Assiette de pâtes" },
  { label: "🍎 Goûter fruit", text: "Un fruit" }
];

let currentMode = null;
let onMealSaved = null; // callback pour rafraîchir l'accueil

export function initMealModes(callback) {
  onMealSaved = callback;
  currentMode = loadMode();

  // Bascule des modes
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
        saveQuickMeal(meal);
      });
    });
  }

  // Bouton décrire mon repas → écran ajout existant
  const describeBtn = document.getElementById('describeMealBtn');
  if (describeBtn) describeBtn.addEventListener('click', () => {
    document.getElementById('mealText').focus();
    document.getElementById('mealText').scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  // Mode à table : ajout plat par plat
  const addItemBtn = document.getElementById('tableAddItemBtn');
  if (addItemBtn) addItemBtn.addEventListener('click', addTableItem);
  const itemInput = document.getElementById('tableItemInput');
  if (itemInput) itemInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); addTableItem(); }
  });

  // Terminer le repas (mode à table)
  const finishBtn = document.getElementById('finishTableMealBtn');
  if (finishBtn) finishBtn.addEventListener('click', finishTableMeal);

  // Restauration d'un brouillon éventuel
  restoreDraft();
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
  const quick = document.getElementById('quick-zone');
  const table = document.getElementById('table-zone');
  if (quick) quick.style.display = mode === 'pouce' ? 'block' : 'none';
  if (table) table.style.display = mode === 'lent' ? 'block' : 'none';
}

// ---- Mode sur le pouce : repas chip → enregistrement immédiat, analyse différée ----
function saveQuickMeal(meal) {
  const datetime = new Date().toISOString().slice(0, 16);
  const newMeal = {
    id: Date.now(),
    datetime,
    text: meal.text,
    photo: null,
    createdAt: new Date().toISOString(),
    iaSource: 'local'
  };
  persistAndAnalyse(newMeal);
  UI.showToast && UI.showToast(`Repas ajouté ✓ ${meal.label}`);
}

// ---- Mode à table : plat par plat, brouillon persistant ----
function addTableItem() {
  const input = document.getElementById('tableItemInput');
  if (!input) return;
  const v = input.value.trim();
  if (!v) return;
  const draft = loadRepasDraft();
  draft.items = draft.items || [];
  draft.items.push(v);
  saveRepasDraft(draft);
  input.value = '';
  renderTableItems();
  UI.showToast && UI.showToast(`Ajouté : ${v}`);
}

function removeTableItem(index) {
  const draft = loadRepasDraft();
  draft.items = (draft.items || []);
  draft.items.splice(index, 1);
  saveRepasDraft(draft);
  renderTableItems();
}

function renderTableItems() {
  const ul = document.getElementById('tableItems');
  if (!ul) return;
  const draft = loadRepasDraft();
  const items = draft.items || [];
  ul.innerHTML = items.length === 0
    ? '<li style="color:var(--muted)">Aucun plat pour l\'instant</li>'
    : items.map((it, i) => `<li><span>🍽️ ${escapeHtml(it)}</span><button data-i="${i}">✕</button></li>`).join('');
  ul.querySelectorAll('button').forEach(btn =>
    btn.addEventListener('click', () => removeTableItem(parseInt(btn.dataset.i)))
  );
}

function restoreDraft() {
  renderTableItems();
  const draft = loadRepasDraft();
  if (draft.items && draft.items.length > 0) {
    UI.showToast && UI.showToast('Repas en cours restauré 🍽️');
  }
}

function finishTableMeal() {
  const draft = loadRepasDraft();
  const items = draft.items || [];
  if (items.length === 0) {
    UI.showToast && UI.showToast('Ajoute au moins un plat');
    return;
  }
  const newMeal = {
    id: Date.now(),
    datetime: new Date().toISOString().slice(0, 16),
    text: items.join(', '),
    photo: null,
    createdAt: new Date().toISOString(),
    iaSource: 'local'
  };
  clearRepasDraft();
  renderTableItems();
  persistAndAnalyse(newMeal);
  UI.showToast && UI.showToast('Repas ajouté ✓');
}

// ---- Enregistrement immédiat + analyse en arrière-plan (les deux modes) ----
async function persistAndAnalyse(newMeal) {
  // 1. Enregistrer tout de suite
  const repasList = Storage.loadRepas();
  repasList.unshift(newMeal);
  Storage.saveRepas(repasList);

  // Rafraîchir l'UI sans attendre l'analyse
  if (onMealSaved) onMealSaved(newMeal);

  // 2. Lancer l'analyse en arrière-plan
  const userMeds = Medications.getMeds();
  const healthConditions = Storage.loadHealthConditions ? Storage.loadHealthConditions() : [];
  const allergies = Storage.loadAllergies ? Storage.loadAllergies() : [];

  try {
    const result = await IA.analyseRepas(newMeal.text, newMeal.photo, userMeds, healthConditions, allergies);
    if (result.success && result.interaction) {
      newMeal.interactionDetected = result.interaction;
      newMeal.iaSource = result.source;
      // Re-sauvegarder avec le résultat
      const list = Storage.loadRepas();
      const idx = list.findIndex(m => m.id === newMeal.id);
      if (idx !== -1) {
        list[idx] = newMeal;
        Storage.saveRepas(list);
      }
      UI.showAlert(result.analysis, 'alertBanner');
      if (onMealSaved) onMealSaved(newMeal);
    }
  } catch(e) {
    console.error('Analyse arrière-plan:', e);
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/[&<>]/g, function(m) {
    if (m === "&") return "&amp;";
    if (m === "<") return "&lt;";
    if (m === ">") return "&gt;";
    return m;
  });
}
