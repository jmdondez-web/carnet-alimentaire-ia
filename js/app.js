import * as Storage from './storage.js';
import * as Medications from './medications.js';
import * as Water from './water.js';
import * as IA from './ia.js';
import * as Voice from './voice.js';
import * as Camera from './camera.js';
import * as UI from './ui.js';
import * as Export from './export.js';
import * as PWA from './pwa.js';
import * as Navigation from './navigation.js';
import * as UISettings from './ui-settings.js';
import * as Dashboard from './dashboard.js';
import * as MealModes from './meal-modes.js';

let repasList = [];

function refreshHome() {
  repasList = Storage.loadRepas();
  UI.setRepasList(repasList);
  UI.renderMeals('mealsList');
  Dashboard.renderDashboard('pnnsDashboard', repasList);
  UI.updateTip(IA.getRandomTip(), 'pnnsTip');
}

async function init() {
  // Charger les données
  repasList = Storage.loadRepas();
  UI.setRepasList(repasList);
  Medications.initMeds();
  Water.initWater();
  await IA.loadKnowledgeBase();

  // Rendu initial
  UI.renderMeals('mealsList');
  Dashboard.renderDashboard('pnnsDashboard', repasList);
  Water.updateWaterUI('waterTotal', 'waterProgress');
  UI.updateTip(IA.getRandomTip(), 'pnnsTip');
  UISettings.showIAModeIndicator('iaModeIndicator');

  // Modes de repas : chips (sur le pouce) → même flux d'enregistrement que le formulaire
  MealModes.initMealModes((quickMeal) => saveQuickMeal(quickMeal));

  // PWA + mode sombre
  PWA.registerServiceWorker();
  PWA.initDarkMode();

  // Date par défaut (champ replié dans « Date & heure »)
  const now = new Date();
  const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const dtInput = document.getElementById("mealDatetime");
  if (dtInput) dtInput.value = localNow;

  // Raccourcis PWA (appui long sur l'icône) : ?action=add / ?action=water
  const action = new URLSearchParams(window.location.search).get('action');
  if (action === 'add') {
    setTimeout(() => document.getElementById('detailed-meal-section').scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
  } else if (action === 'water') {
    Water.addWater(33);
    Water.updateWaterUI('waterTotal', 'waterProgress');
    UI.showToast('33 cl ajoutés 💧');
  }

  // Initialiser la voix (dictée native du navigateur — Chrome/Edge Android, Safari iOS 14.1+)
  const voiceReady = Voice.initVoice(
    (text) => {
      const ta = document.getElementById("mealText");
      let current = ta.value;
      if (current && !current.endsWith(" ")) current += " ";
      ta.value = current + text;
      // Le brouillon à table suit la dictée (persistant)
      const draft = Storage.loadRepasDraft ? Storage.loadRepasDraft() : {};
      draft.text = ta.value;
      if (Storage.saveRepasDraft) Storage.saveRepasDraft(draft);
    },
    (error) => {
      const status = document.getElementById("voiceStatus");
      if (status) status.innerText = error === "not-allowed"
        ? "⚠️ Micro refusé — autorise le micro dans ton navigateur"
        : "⚠️ " + error;
    },
    () => {
      const startBtn = document.getElementById("startVoiceBtn");
      const stopBtn = document.getElementById("stopVoiceBtn");
      const status = document.getElementById("voiceStatus");
      if (startBtn) startBtn.disabled = false;
      if (stopBtn) stopBtn.disabled = true;
      if (status) status.innerText = "Dictée terminée";
    }
  );
  if (!voiceReady) {
    const startBtn = document.getElementById("startVoiceBtn");
    const stopBtn = document.getElementById("stopVoiceBtn");
    const status = document.getElementById("voiceStatus");
    if (startBtn) startBtn.disabled = true;
    if (stopBtn) stopBtn.disabled = true;
    if (status) status.innerText = "Dictée non supportée par ce navigateur (essaie Chrome)";
  }

  bindEvents();
  Navigation.initNavigation();
}

async function saveCurrentMeal() {
  const datetime = document.getElementById("mealDatetime").value || new Date().toISOString().slice(0, 16);
  const text = document.getElementById("mealText").value.trim();
  const photo = Camera.getCurrentPhoto();

  if (!text && !photo) {
    UI.showToast("Décris ton repas ou prends une photo");
    return;
  }

  // 1. Enregistrer immédiatement — l'utilisateur n'attend pas l'analyse
  const newMeal = {
    id: Date.now(),
    datetime,
    text: text || "(photo)",
    photo,
    createdAt: new Date().toISOString(),
    iaSource: 'local'
  };

  repasList.unshift(newMeal);
  Storage.saveRepas(repasList);
  UI.setRepasList(repasList);
  UI.renderMeals('mealsList');
  Dashboard.renderDashboard('pnnsDashboard', repasList);
  UI.showToast('Repas ajouté ✓');
  UI.updateTip(IA.getRandomTip(), 'pnnsTip');

  document.getElementById("mealText").value = "";
  Storage.clearRepasDraft(); // le brouillon à table est consommé
  Camera.clearCurrentPhoto();
  Camera.hidePreview('photoPreview');

  // 2. Analyser en arrière-plan — l'alerte s'affiche quand elle arrive
  analyseInBackground(newMeal);
}

// Chip « sur le pouce » : même flux, sans photo ni formulaire
function saveQuickMeal(meal) {
  const newMeal = {
    id: Date.now(),
    datetime: new Date().toISOString().slice(0, 16),
    text: meal.text,
    photo: null,
    createdAt: new Date().toISOString(),
    iaSource: 'local'
  };
  repasList.unshift(newMeal);
  Storage.saveRepas(repasList);
  UI.setRepasList(repasList);
  UI.renderMeals('mealsList');
  Dashboard.renderDashboard('pnnsDashboard', repasList);
  UI.showToast(`Repas ajouté ✓ ${meal.label}`);
  UI.updateTip(IA.getRandomTip(), 'pnnsTip');
  analyseInBackground(newMeal);
}

async function analyseInBackground(meal) {
  const userMeds = Medications.getMeds();
  const healthConditions = Storage.loadHealthConditions ? Storage.loadHealthConditions() : [];
  const allergies = Storage.loadAllergies ? Storage.loadAllergies() : [];

  try {
    const iaResult = await IA.analyseRepas(meal.text, meal.photo, userMeds, healthConditions, allergies);
    if (iaResult.success && iaResult.interaction) {
      meal.interactionDetected = iaResult.interaction;
      meal.iaSource = iaResult.source;
      const list = Storage.loadRepas();
      const idx = list.findIndex(m => m.id === meal.id);
      if (idx !== -1) {
        list[idx] = meal;
        Storage.saveRepas(list);
      }
      UI.setRepasList(list);
      UI.renderMeals('mealsList');
      UI.showAlert(iaResult.analysis, 'alertBanner');
    }
  } catch(e) {
    console.error("Analyse arrière-plan:", e);
  }
}

function bindEvents() {
  // Voix
  document.getElementById("startVoiceBtn").onclick = () => {
    if (Voice.startVoice()) {
      document.getElementById("startVoiceBtn").disabled = true;
      document.getElementById("stopVoiceBtn").disabled = false;
      document.getElementById("voiceStatus").innerText = "🎤 Écoute...";
    }
  };
  document.getElementById("stopVoiceBtn").onclick = () => {
    Voice.stopVoice();
    document.getElementById("startVoiceBtn").disabled = false;
    document.getElementById("stopVoiceBtn").disabled = true;
  };

  // Sauvegarde repas
  document.getElementById("saveMealBtn").onclick = saveCurrentMeal;

  // Export
  document.getElementById("exportBtn").onclick = () => Export.exportJSON(repasList);
  document.getElementById("exportReadableBtn").onclick = () => Export.exportReadable(repasList);

  // Effacer tout
  document.getElementById("clearAllBtn").onclick = () => {
    if (confirm("Effacer tout l'historique des repas ?")) {
      repasList = [];
      Storage.saveRepas(repasList);
      UI.setRepasList(repasList);
      UI.renderMeals('mealsList');
      Dashboard.renderDashboard('pnnsDashboard', repasList);
    }
  };

  // Eau
  document.querySelectorAll(".water-btn").forEach(btn => {
    btn.onclick = () => {
      Water.addWater(parseInt(btn.dataset.cl));

      Water.updateWaterUI('waterTotal', 'waterProgress');
    };
  });
  document.getElementById("resetWaterBtn").onclick = () => {
    Water.resetWater();
    Water.updateWaterUI('waterTotal', 'waterProgress');
  };
  document.getElementById("waterHistoryBtn").onclick = () => {
    const panel = document.getElementById("waterHistoryPanel");
    if (panel.style.display === "none") {
      Water.renderWaterHistory('waterHistoryPanel');
      panel.style.display = "block";
    } else {
      panel.style.display = "none";
    }
  };

  // Photo
  document.getElementById("takePhotoBtn").onclick = async () => {
    const base64 = await Camera.takePhoto();
    if (base64) Camera.showPreview('photoPreview', 'previewImg', base64);
  };
  document.getElementById("uploadPhotoBtn").onclick = async () => {
    const base64 = await Camera.uploadPhoto();
    if (base64) Camera.showPreview('photoPreview', 'previewImg', base64);
  };
  document.getElementById("removePhotoBtn").onclick = () => {
    Camera.clearCurrentPhoto();
    Camera.hidePreview('photoPreview');
  };

  // Fermeture alerte
  document.getElementById("closeAlertBtn").onclick = () => {
    document.getElementById("alertBanner").style.display = "none";
  };
}

init();
