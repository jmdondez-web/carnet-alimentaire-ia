// js/settings.js (version finale corrigée)
import * as Storage from './storage.js';
import * as Medications from './medications.js';
import * as Export from './export.js';
import * as UISettings from './ui-settings.js';
import * as IA from './ia.js';
import * as PWA from './pwa.js';

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
      renderHealthConditions();
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
      if (confirm('⚠️ Effacer TOUTES les données ? (repas, eau, médicaments)\nCette action est irréversible.')) {
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