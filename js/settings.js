// js/settings.js (version finale corrigée)
import * as Storage from './storage.js';
import * as Medications from './medications.js';
import * as Export from './export.js';
import * as UISettings from './ui-settings.js';
import * as IA from './ia.js';
import * as PWA from './pwa.js';
import { revokeConsent, getConsentDate } from './consent.js';

let repasList = [];

// Initialisation après chargement du DOM
document.addEventListener('DOMContentLoaded', async () => {
  // Chargement des données
  repasList = Storage.loadRepas();
  Medications.initMeds();
  await IA.loadKnowledgeBase();

  // Rendu des listes
  Medications.renderMeds('medicationsList');
  renderHealthConditions();
  renderAllergies();
  updateClearMedsVisibility();

  // Interface IA
  UISettings.renderIASettingsPanel('iaSettingsPanel');

  // Mode sombre
  PWA.initDarkMode();

  // Branchement des événements
  bindEvents();
});

// Affichage des problèmes de santé
function renderHealthConditions() {
  const container = document.getElementById('healthList');
  if (!container) return;

  const healthConditions = Storage.loadHealthConditions ? Storage.loadHealthConditions() : [];

  const clearBtn = document.getElementById('clearHealthBtn');
  if (clearBtn) clearBtn.style.display = healthConditions.length > 0 ? 'inline-block' : 'none';

  if (healthConditions.length === 0) {
    container.innerHTML = '<li>Aucun problème de santé enregistré</li>';
    return;
  }

  container.innerHTML = healthConditions.map((condition, index) => `
    <li>
      <span>🩺 ${escapeHtml(condition)}</span>
      <button class="remove-med" data-index="${index}">🗑️</button>
    </li>
  `).join('');

  document.querySelectorAll('.remove-med[data-index]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index);
      const conditions = Storage.loadHealthConditions ? Storage.loadHealthConditions() : [];
      conditions.splice(idx, 1);
      if (Storage.saveHealthConditions) Storage.saveHealthConditions(conditions);
      renderHealthConditio
ns();
    });
  });
}

// Ajout d'un problème de santé
function addHealthCondition(condition) {
  if (!condition.trim()) return;
  let conditions = Storage.loadHealthConditions ? Storage.loadHealthConditions() : [];
  conditions.push(condition.trim());
  if (Storage.saveHealthConditions) Storage.saveHealthConditions(conditions);
  renderHealthConditions();
}

// Affichage des allergies
function renderAllergies() {
  const container = document.getElementById('allergiesList');
  if (!container) return;

  const allergies = Storage.loadAllergies ? Storage.loadAllergies() : [];

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

  document.querySelectorAll('.remove-allergy').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index);
      const allergies = Storage.loadAllergies ? Storage.loadAllergies() : [];
      allergies.splice(idx, 1);
      if (Storage.saveAllergies) Storage.saveAllergies(allergies);
      renderAllergies();
    });
  });
}

// Ajout d'une allergie
function addAllergy(allergie) {
  if (!allergie.trim()) return;
  let allergies = Storage.loadAllergies ? Storage.loadAllergies() : [];
  allergies.push(allergie.trim());
  if (Storage.saveAllergies) Storage.saveAllergies(allergies);
  renderAllergies();
}

// Affiche/masque le bouton d'effacement des traitements selon le contenu
function updateClearMedsVisibility() {
  const clearBtn = document.getElementById('clearMedsBtn');
  if (clearBtn) clearBtn.style.display = Medications.getMeds().length > 0 ? 'inline-block' : 'none';
}

// Ef
facement complet d'une liste de données santé (droit à l'effacement RGPD)
function confirmClearList(label) {
  return confirm(`⚠️ Effacer ${label} ?\nCette action est irréversible.`);
}

function clearMeds() {
  if (!confirmClearList('toute la liste des traitements')) return;
  Storage.saveMeds([]);
  Medications.initMeds();
  Medications.renderMeds('medicationsList');
  updateClearMedsVisibility();
}

function clearHealthConditions() {
  if (!confirmClearList('toute la liste des problèmes de santé')) return;
  if (Storage.saveHealthConditions) Storage.saveHealthConditions([]);
  renderHealthConditions();
}

function clearAllergies() {
  if (!confirmClearList('toute la liste des allergies')) return;
  if (Storage.saveAllergies) Storage.saveAllergies([]);
  renderAllergies();
}

// Effacement de l'historique des repas (les données d'eau restent)
function clearMealsHistory() {
  if (!confirmClearList("tout l'historique des repas")) return;
  Storage.saveRepas([]);
  repasList = [];
  alert('Historique des repas effacé.');
}

// Révocation du consentement IA externe (RGPD : révocable à tout moment)
function revokeExternalConsent() {
  const consentDate = getConsentDate();
  const when = consentDate ? ` (donné le ${new Date(consentDate).toLocaleString()})` : '';
  if (!confirm(`⚠️ Révoquer le consentement IA externe${when} ?\nLe mode IA externe sera désactivé et reviendra au mode local. Aucune donnée ne quitte plus ton téléphone.`)) return;
  revokeConsent();
  import('./ia-settings.js').then(m => {
    m.updateIASetting('mode', 'local');
    UISettings.renderIASettingsPanel('iaSettingsPanel');
    alert('Consentement révoqué. Mode IA externe désactivé.');
  });
}

// Gestion des événements
function bindEvents() {
  // Ajout médicament
  const addMedBtn = document.getElementById('addMedBtn');
  if (addMedBtn) {
    addMedBtn.addEventListener('click', () => {
      const name = document.getElementById('medNameInput').value.trim();
      const condition = document.getElementById('medConditionInput').value.trim();
      if (name) {
        Medications.addMed(name, condition);
        Medications.renderMeds('medicationsList');
        updateClearMedsVisibility();
        document.getElementById('medNameInput').value = '';
        document.getElementById('medConditionInput').value = '';
      }
    });
  }

  // Ajout problème de santé
  const addHealthBtn = document.getElementById('addHealthBtn');
  if (addHealthBtn) {
    addHealthBtn.addEventListener('click', () => {
      const condition = document.getElementById('healthConditionInput').value.trim();
      addHealthCondition(condition);
      document.getElementById('healthConditionInput').value = '';
    });
  }

  // Ajout allergie
  const addAllergyBtn = document.getElementById('addAllergyBtn');
  if (addAllergyBtn) {
    addAllergyBtn.addEventListener('click', () => {
      const allergie = document.
getElementById('allergyInput').value.trim();
      addAllergy(allergie);
      document.getElementById('allergyInput').value = '';
    });
  }

  // Effacement par liste (RGPD : droit à l'effacement ciblé)
  const clearMedsBtn = document.getElementById('clearMedsBtn');
  if (clearMedsBtn) clearMedsBtn.addEventListener('click', clearMeds);
  const clearHealthBtn = document.getElementById('clearHealthBtn');
  if (clearHealthBtn) clearHealthBtn.addEventListener('click', clearHealthConditions);
  const clearAllergiesBtn = document.getElementById('clearAllergiesBtn');
  if (clearAllergiesBtn) clearAllergiesBtn.addEventListener('click', clearAllergies);

  // Historique des repas + consentement IA
  const clearMealsBtn = document.getElementById('clearMealsHistoryBtn');
  if (clearMealsBtn) clearMealsBtn.addEventListener('click', clearMealsHistory);
  const revokeConsentBtn = document.getElementById('revokeConsentBtn');
  if (revokeConsentBtn) revokeConsentBtn.addEventListener('click', revokeExternalConsent);

  // Export
  const exportBtn = document.getElementById('exportAllDataBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      Export.exportJSON(repasList);
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

  // RETOUR VERS ACCUEIL (flèche)
  const backBtn = document.getElementById('backToHomeBtn');
  if (backBtn) {
    backBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = 'index.html';
    });
  }
}

// Échappement HTML
function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/[&<>]/g, function(m) {
    if (m === "&") return "&amp;";
    if (m === "<") return "&lt;";
    if (m === ">") return "&gt;";
    return m;
  });
}
