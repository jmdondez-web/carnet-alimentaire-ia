// js/settings.js — réécrit proprement (corruption réparée) + fiabilisation des champs
import * as Storage from './storage.js';
import * as Medications from './medications.js';
import * as Export from './export.js';
import * as UISettings from './ui-settings.js';
import * as IA from './ia.js';
import * as PWA from './pwa.js';
import { revokeConsent, getConsentDate } from './consent.js';

let repasList = [];

document.addEventListener('DOMContentLoaded', async () => {
  repasList = Storage.loadRepas();
  Medications.initMeds();
  await IA.loadKnowledgeBase();

  Medications.renderMeds('medicationsList');
  renderHealthConditions();
  renderAllergies();
  updateClearMedsVisibility();

  UISettings.renderIASettingsPanel('iaSettingsPanel');
  PWA.initDarkMode();

  bindEvents();
});

// --- Confirmation visuelle (toast) ---
function toast(msg) {
  let t = document.getElementById('settingsToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'settingsToast';
    t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(80px);background:#1a2b1a;color:#fff;padding:12px 22px;border-radius:24px;font-size:14px;z-index:9999;transition:transform .3s;max-width:85%;text-align:center;';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  requestAnimationFrame(() => { t.style.transform = 'translateX(-50%) translateY(0)'; });
  setTimeout(() => { t.style.transform = 'translateX(-50%) translateY(80px)'; }, 2000);
}

// --- Problèmes de santé ---
function renderHealthConditions() {
  const container = document.getElementById('healthList');
  if (!container) return;

  const conditions = Storage.loadHealthConditions();
  const clearBtn = document.getElementById('clearHealthBtn');
  if (clearBtn) clearBtn.style.display = conditions.length > 0 ? 'inline-block' : 'none';

  if (conditions.length === 0) {
    container.innerHTML = '<li>Aucun problème de santé enregistré</li>';
    return;
  }

  container.innerHTML = conditions.map((condition, index) => `
    <li>
      <span>🩺 ${escapeHtml(condition)}</span>
      <button class="remove-med" data-index="${index}">🗑️</button>
    </li>
  `).join('');

  container.querySelectorAll('.remove-med').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index);
      const conditions = Storage.loadHealthConditions();
      conditions.splice(idx, 1);
      Storage.saveHealthConditions(conditions);
      renderHealthConditions();
      toast('Problème de santé supprimé');
    });
  });
}

function addHealthCondition(condition) {
  const clean = condition.trim();
  if (!clean) { toast('Saisis un problème de santé'); return false; }
  const conditions = Storage.loadHealthConditions();
  if (conditions.some(c => c.toLowerCase() === clean.toLowerCase())) {
    toast('Déjà dans la liste');
    return false;
  }
  conditions.push(clean);
  Storage.saveHealthConditions(conditions);
  renderHealthConditions();
  toast('Problème de santé ajouté ✓');
  return true;
}

// --- Allergies ---
function renderAllergies() {
  const container = document.getElementById('allergiesList');
  if (!container) return;

  const allergies = Storage.loadAllergies();
  const clearBtn = document.getElementById('clearAllergiesBtn');
  if (clearBtn) clearBtn.style.display = allergies.length > 0 ? 'inline-block' : 'none';

  if (allergies.length === 0) {
    container.innerHTML = '<li>Aucune allergie enregistrée</li>';
    return;
  }

  container.innerHTML = allergies.map((allergie, index) => `
    <li>
      <span>🥜 ${escapeHtml(allergie)}</span>
      <button class="remove-allergy" data-index="${index}">🗑️</button>
    </li>
  `).join('');

  container.querySelectorAll('.remove-allergy').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index);
      const allergies = Storage.loadAllergies();
      allergies.splice(idx, 1);
      Storage.saveAllergies(allergies);
      renderAllergies();
      toast('Allergie supprimée');
    });
  });
}

function addAllergy(allergie) {
  const clean = allergie.trim();
  if (!clean) { toast('Saisis une allergie'); return false; }
  const allergies = Storage.loadAllergies();
  if (allergies.some(a => a.toLowerCase() === clean.toLowerCase())) {
    toast('Déjà dans la liste');
    return false;
  }
  allergies.push(clean);
  Storage.saveAllergies(allergies);
  renderAllergies();
  toast('Allergie ajoutée ✓');
  return true;
}

// --- Visibilité du bouton d'effacement des traitements ---
function updateClearMedsVisibility() {
  const clearBtn = document.getElementById('clearMedsBtn');
  if (clearBtn) clearBtn.style.display = Medications.getMeds().length > 0 ? 'inline-block' : 'none';
}

// --- Effacements ciblés (RGPD : droit à l'effacement) ---
function confirmClearList(label) {
  return confirm('⚠️ Effacer ' + label + ' ?\nCette action est irréversible.');
}

function clearMeds() {
  if (!confirmClearList('toute la liste des traitements')) return;
  Storage.saveMeds([]);
  Medications.initMeds();
  Medications.renderMeds('medicationsList');
  updateClearMedsVisibility();
  toast('Traitements effacés');
}

function clearHealthConditions() {
  if (!confirmClearList('toute la liste des problèmes de santé')) return;
  Storage.saveHealthConditions([]);
  renderHealthConditions();
  toast('Problèmes de santé effacés');
}

function clearAllergies() {
  if (!confirmClearList('toute la liste des allergies')) return;
  Storage.saveAllergies([]);
  renderAllergies();
  toast('Allergies effacées');
}

function clearMealsHistory() {
  if (!confirmClearList("tout l'historique des repas")) return;
  Storage.saveRepas([]);
  repasList = [];
  toast('Historique des repas effacé');
}

function revokeExternalConsent() {
  const consentDate = getConsentDate();
  const when = consentDate ? ' (donné le ' + new Date(consentDate).toLocaleString() + ')' : '';
  if (!confirm('⚠️ Révoquer le consentement IA externe' + when + ' ?\nLe mode IA externe sera désactivé et reviendra au mode local. Aucune donnée ne quitte plus ton téléphone.')) return;
  revokeConsent();
  import('./ia-settings.js').then(m => {
    m.updateIASetting('mode', 'local');
    UISettings.renderIASettingsPanel('iaSettingsPanel');
    toast('Consentement révoqué — mode local');
  });
}

// --- Événements ---
function bindEvents() {
  // Ajout médicament : validation, confirmation, remise à blanc
  const addMed = () => {
    const nameInput = document.getElementById('medNameInput');
    const condInput = document.getElementById('medConditionInput');
    const name = nameInput.value.trim();
    if (!name) { toast('Saisis le nom du médicament'); return; }
    Medications.addMed(name, condInput.value.trim());
    Medications.renderMeds('medicationsList');
    updateClearMedsVisibility();
    nameInput.value = '';
    condInput.value = '';
    toast('Traitement ajouté ✓');
  };
  const addMedBtn = document.getElementById('addMedBtn');
  if (addMedBtn) addMedBtn.addEventListener('click', addMed);
  const medNameInput = document.getElementById('medNameInput');
  const medCondInput = document.getElementById('medConditionInput');
  if (medNameInput) medNameInput.addEventListener('keydown', e => { if (e.key === 'Enter') addMed(); });
  if (medCondInput) medCondInput.addEventListener('keydown', e => { if (e.key === 'Enter') addMed(); });

  // Ajout problème de santé
  const addHealth = () => {
    const input = document.getElementById('healthConditionInput');
    if (addHealthCondition(input.value)) input.value = '';
  };
  const addHealthBtn = document.getElementById('addHealthBtn');
  if (addHealthBtn) addHealthBtn.addEventListener('click', addHealth);
  const healthInput = document.getElementById('healthConditionInput');
  if (healthInput) healthInput.addEventListener('keydown', e => { if (e.key === 'Enter') addHealth(); });

  // Ajout allergie
  const addAllergy = () => {
    const input = document.getElementById('allergyInput');
    if (addAllergy(input.value)) input.value = '';
  };
  const addAllergyBtn = document.getElementById('addAllergyBtn');
  if (addAllergyBtn) addAllergyBtn.addEventListener('click', addAllergy);
  const allergyInput = document.getElementById('allergyInput');
  if (allergyInput) allergyInput.addEventListener('keydown', e => { if (e.key === 'Enter') addAllergy(); });

  // Effacements ciblés
  const clearMedsBtn = document.getElementById('clearMedsBtn');
  if (clearMedsBtn) clearMedsBtn.addEventListener('click', clearMeds);
  const clearHealthBtn = document.getElementById('clearHealthBtn');
  if (clearHealthBtn) clearHealthBtn.addEventListener('click', clearHealthConditions);
  const clearAllergiesBtn = document.getElementById('clearAllergiesBtn');
  if (clearAllergiesBtn) clearAllergiesBtn.addEventListener('click', clearAllergies);
  const clearMealsBtn = document.getElementById('clearMealsHistoryBtn');
  if (clearMealsBtn) clearMealsBtn.addEventListener('click', clearMealsHistory);
  const revokeConsentBtn = document.getElementById('revokeConsentBtn');
  if (revokeConsentBtn) revokeConsentBtn.addEventListener('click', revokeExternalConsent);

  // Export
  const exportBtn = document.getElementById('exportAllDataBtn');
  if (exportBtn) exportBtn.addEventListener('click', () => Export.exportJSON(repasList));

  // Import (fusion)
  const importBtn = document.getElementById('importDataBtn');
  const importInput = document.getElementById('importFileInput');
  if (importBtn && importInput) {
    importBtn.addEventListener('click', () => importInput.click());
    importInput.addEventListener('change', async () => {
      const file = importInput.files && importInput.files[0];
      if (!file) return;
      if (!confirm('Importer ce fichier ?\nLes données seront fusionnées avec les données actuelles (aucune donnée existante ne sera écrasée).')) {
        importInput.value = '';
        return;
      }
      try {
        const res = await Export.importJSON(file);
        repasList = Storage.loadRepas();
        Medications.initMeds();
        Medications.renderMeds('medicationsList');
        renderHealthConditions();
        renderAllergies();
        updateClearMedsVisibility();
        toast('Import terminé ✓ (' + res.repas + ' repas)');
      } catch (e) {
        toast('❌ Import échoué : ' + e.message);
      }
      importInput.value = '';
    });
  }

  // Effacer tout
  const clearBtn = document.getElementById('clearAllDataBtn');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (confirm('⚠️ Effacer TOUTES les données ? (repas, eau, médicaments, problèmes de santé, allergies)\nCette action est irréversible.')) {
        localStorage.clear();
        alert('Toutes les données ont été effacées. L\'application va redémarrer.');
        window.location.href = 'index.html';
      }
    });
  }

  // Retour accueil
  const backBtn = document.getElementById('backToHomeBtn');
  if (backBtn) {
    backBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = 'index.html';
    });
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/[&<>]/g, function(m) {
    if (m === "&") return "&amp;";
    if (m === "<") return "&lt;";
    if (m === ">") return "&gt;";
    return m;
  });
}
