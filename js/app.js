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

let repasList = [];

async function init() {
  // Charger les données
  repasList = Storage.loadRepas();
  UI.setRepasList(repasList);
  Medications.initMeds();
  Water.initWater();
  await IA.loadKnowledgeBase();
  
  // Rendu initial
  UI.renderMeals('mealsList');
  Water.updateWaterUI('waterTotal', 'waterProgress');
  UI.updateTip(IA.getRandomTip(), 'pnnsTip');
  Navigation.updateMedSummary();
  UISettings.showIAModeIndicator('iaModeIndicator');
  
  // PWA + mode sombre
  PWA.registerServiceWorker();
  PWA.initDarkMode();
  
  // Date par défaut
  const now = new Date();
  const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  document.getElementById("mealDatetime").value = localNow;
  
  // Initialiser la voix
  Voice.initVoice(
    (text) => {
      const ta = document.getElementById("mealText");
      let current = ta.value;
      if (current && !current.endsWith(" ")) current += " ";
      ta.value = current + text;
    },
    (error) => document.getElementById("voiceStatus").innerText = `⚠️ ${error}`,
    () => {
      document.getElementById("startVoiceBtn").disabled = false;
      document.getElementById("stopVoiceBtn").disabled = true;
      document.getElementById("voiceStatus").innerText = "Dictée terminée";
    }
  );
  
  bindEvents();
  Navigation.initNavigation();
}

async function saveCurrentMeal() {
  const datetime = document.getElementById("mealDatetime").value || new Date().toISOString().slice(0, 16);
  const text = document.getElementById("mealText").value.trim();
  const photo = Camera.getCurrentPhoto();
  
  if (!text && !photo) {
    alert("Décris ton repas ou prends une photo");
    return;
  }
  
  const userMeds = Medications.getMeds();
  const iaResult = await IA.analyseRepas(text, photo, userMeds);
  
  if (iaResult.success && iaResult.interaction) {
    UI.showAlert(iaResult.analysis, 'alertBanner');
  }
  
  const newMeal = {
    id: Date.now(),
    datetime,
    text: text || "(photo)",
    photo,
    createdAt: new Date().toISOString(),
    interactionDetected: iaResult.interaction,
    iaSource: iaResult.source
  };
  
  repasList.unshift(newMeal);
  Storage.saveRepas(repasList);
  UI.setRepasList(repasList);
  UI.renderMeals('mealsList');
  UI.updateTip(IA.getRandomTip(), 'pnnsTip');
  
  document.getElementById("mealText").value = "";
  Camera.clearCurrentPhoto();
  Camera.hidePreview('photoPreview');
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