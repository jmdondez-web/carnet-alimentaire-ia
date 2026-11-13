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
import { getIASettings } from './ia-settings.js';

let repasList = [];

function refreshHome() {
  repasList = Storage.loadRepas();
  UI.setRepasList(repasList);
  UI.renderMeals('mealsList');
  Dashboard.renderDashboard('pnnsDashboard', repasList);
  UI.updateTip(IA.getRandomTip(), 'pnnsTip');
}

// Version déployée — version.txt (date + commit, généré par update.sh) prioritaire,
// manifest.json en repli. Distingue plusieurs déploiements le même jour.
// Réessayable : un échec initial (téléphone hors ligne au lancement) ne doit plus
// laisser le badge vide en permanence — on retente sur retour de connectivité
// et à chaque retour de l'appli au premier plan.
async function refreshVersionBadge() {
  const el = document.getElementById("appVersion");
  if (!el) return;
  let label = "";
  try {
    const r = await fetch("version.txt", { cache: "no-store" });
    if (r.ok) label = (await r.text()).trim();
  } catch (e) {}
  if (!label) {
    try {
      const manifest = await fetch("manifest.json", { cache: "no-store" }).then(r => r.json());
      if (manifest.version) label = "v" + manifest.version;
    } catch (e) {}
  }
  // Honnêteté : un échec réseau s'affiche comme tel au lieu d'un badge vide muet.
  el.textContent = label || "⚠️ hors ligne";
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
  const persistDraft = () => {
    const ta = document.getElementById("mealText");
    const draft = Storage.loadRepasDraft ? Storage.loadRepasDraft() : {};
    draft.text = ta.value;
    if (Storage.saveRepasDraft) Storage.saveRepasDraft(draft);
  };
  const voiceReady = Voice.initVoice(
    (text) => {
      const ta = document.getElementById("mealText");
      let current = ta.value;
      if (current && !current.endsWith(" ")) current += " ";
      ta.value = current + text;
      persistDraft();
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
    },
    (corrections) => {
      // Chrome Android re-livre l'énoncé en fragments croissants :
      // remplacer la DERNIÈRE occurrence du fragment par la version complète
      // (le fragment peut aussi exister plus tôt, saisi manuellement).
      const ta = document.getElementById("mealText");
      const replaceLast = (str, from, to) => {
        const i = str.lastIndexOf(from);
        return i === -1 ? str : str.slice(0, i) + to + str.slice(i + from.length);
      };
      for (const c of corrections) {
        ta.value = replaceLast(ta.value, c.from, c.to);
      }
      persistDraft();
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

  // Badge de version : tentative immédiate + re-tentative au retour du réseau / du premier plan
  refreshVersionBadge();
  window.addEventListener("online", refreshVersionBadge);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refreshVersionBadge();
  });

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

  // Modification d'un repas existant (bouton ✏️ de l'historique)
  if (editingMealId != null) {
    const list = Storage.loadRepas();
    const old = list.find(m => m.id === editingMealId);
    if (old) {
      const updated = {
        ...old,
        datetime,
        text: text || "(photo)",
        photo: photo || null,
        editedAt: new Date().toISOString()
      };
      // Contenu changé → l'analyse enregistrée est potentiellement périmée :
      // on la retire et on relance l'analyse (jamais d'analyse obsolète affichée).
      const contentChanged =
        updated.text !== old.text ||
        !!updated.photo !== !!old.photo ||
        (updated.photo && updated.photo !== old.photo);
      if (contentChanged) {
        delete updated.interactionDetected;
        delete updated.analysis; // jamais d'analyse obsolète affichée
        updated.iaSource = 'local';
      }
      const newList = Storage.updateMealInList(list, updated);
      Storage.saveRepas(newList);
      repasList = newList;
      UI.setRepasList(newList);
      UI.renderMeals('mealsList');
      Dashboard.renderDashboard('pnnsDashboard', newList);
      UI.showToast(contentChanged ? "Repas modifié ✓ — analyse relancée" : "Repas modifié ✓");

      document.getElementById("mealText").value = "";
      document.getElementById("mealDatetime").value = "";
      Storage.clearRepasDraft();
      Camera.clearCurrentPhoto();
      Camera.hidePreview('photoPreview');
      const note = document.getElementById("photoModeNote");
      if (note) note.style.display = "none";
      hidePreAnalysis();
      resetEditUI();
      if (contentChanged) analyseInBackground(updated);
    } else {
      // Repas introuvable (données changées entre-temps) : retour en mode création
      resetEditUI();
      UI.showToast("Repas introuvable — enregistre-le à nouveau");
    }
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
  hidePreAnalysis(); // la pré-analyse a fait son office : le résultat suit le repas

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

// Fenêtre flottante : photo non ou partiellement reconnue (mode IA externe).
// Honnêteté du produit : l'incertitude est AFFICHÉE, jamais masquée ni inventée.
function showPhotoNotice(verdict) {
  let el = document.getElementById("photoNotice");
  if (!el) {
    el = document.createElement("div");
    el.id = "photoNotice";
    el.className = "photo-notice";
    document.body.appendChild(el);
  }
  const msg = verdict === "impossible"
    ? "📷 Photo non exploitable : le plat n'a pas pu être reconnu. Aucune invention — décris ton repas en texte, ou reprends la photo de plus près."
    : "🔍 Photo : certains aliments n'ont pas pu être identifiés avec certitude. Aucune invention — complète la description pour une analyse fiable.";
  el.innerHTML = "<span>" + msg + "</span><button aria-label='Fermer'>✖️</button>";
  el.querySelector("button").onclick = () => { el.style.display = "none"; };
  el.style.display = "flex";
  clearTimeout(showPhotoNotice._t);
  showPhotoNotice._t = setTimeout(() => { el.style.display = "none"; }, 12000);
}

async function analyseInBackground(meal) {
  const userMeds = Medications.getMeds();
  const healthConditions = Storage.loadHealthConditions ? Storage.loadHealthConditions() : [];
  const allergies = Storage.loadAllergies ? Storage.loadAllergies() : [];

  try {
    const iaResult = await IA.analyseRepas(meal.text, meal.photo, userMeds, healthConditions, allergies);
    if (iaResult.success && meal.photo && iaResult.photoVerdict && iaResult.photoVerdict !== "ok") {
      showPhotoNotice(iaResult.photoVerdict);
    }
    // Le résultat va jusqu'au bout : stocké sur le repas, visible dans l'historique.
    // (Avant : seul un résultat avec interaction était conservé — les analyses sans
    // interaction, la majorité, s'exécutaient puis étaient jetées, sans trace.)
    if (iaResult.success && iaResult.analysis) {
      meal.analysis = iaResult.analysis;
      meal.iaSource = iaResult.source;
      if (iaResult.interaction) meal.interactionDetected = iaResult.interaction;
      const list = Storage.loadRepas();
      const idx = list.findIndex(m => m.id === meal.id);
      if (idx !== -1) {
        list[idx] = meal;
        Storage.saveRepas(list);
      }
      UI.setRepasList(list);
      UI.renderMeals('mealsList');
      if (iaResult.interaction) UI.showAlert(iaResult.analysis, 'alertBanner');
    }
  } catch(e) {
    console.error("Analyse arrière-plan:", e);
  }
}

// Photo — note honnête en mode local : la photo n'est PAS analysée
function updatePhotoModeNote() {
  const note = document.getElementById("photoModeNote");
  if (!note) return;
  const settings = getIASettings();
  if (settings.mode !== "external") {
    note.textContent = "📷 Votre photo n'est pas analysée en mode local (analyse par texte uniquement).";
    note.style.display = "block";
  } else {
    note.style.display = "none";
  }
}

function escapeHtmlApp(str) {
  if (!str) return "";
  return String(str).replace(/[&<>]/g, function(m) {
    if (m === "&") return "&amp;";
    if (m === "<") return "&lt;";
    return "&gt;";
  });
}

// ===== ÉDITION D'UN REPAS DE L'HISTORIQUE =====
// Le formulaire sert à la fois à la création et à la modification : le bouton
// ✏️ de l'historique y charge le repas (texte, date/heure, photo).
let editingMealId = null;

function resetEditUI() {
  editingMealId = null;
  const btn = document.getElementById("saveMealBtn");
  if (btn) btn.innerHTML = "<span class=\"btn-emoji\">💾</span> Enregistrer";
  const cancel = document.getElementById("cancelEditBtn");
  if (cancel) cancel.style.display = "none";
}

function startEditMeal(id) {
  const meal = repasList.find(m => m.id === id);
  if (!meal) return;
  editingMealId = id;
  document.getElementById("mealText").value = meal.text === "(photo)" ? "" : (meal.text || "");
  document.getElementById("mealDatetime").value = meal.datetime || "";
  if (meal.photo) {
    Camera.setCurrentPhoto(meal.photo);
    Camera.showPreview("photoPreview", "previewImg", meal.photo);
  } else {
    Camera.clearCurrentPhoto();
    Camera.hidePreview("photoPreview");
  }
  updatePhotoModeNote();
  const btn = document.getElementById("saveMealBtn");
  if (btn) btn.innerHTML = "<span class=\"btn-emoji\">💾</span> Mettre à jour";
  const cancel = document.getElementById("cancelEditBtn");
  if (cancel) cancel.style.display = "block";
  document.getElementById("mealText").scrollIntoView({ behavior: "smooth", block: "center" });
  UI.showToast("Modification du repas — corrige puis mets à jour");
}

function cancelEdit() {
  document.getElementById("mealText").value = "";
  document.getElementById("mealDatetime").value = "";
  Camera.clearCurrentPhoto();
  Camera.hidePreview("photoPreview");
  const note = document.getElementById("photoModeNote");
  if (note) note.style.display = "none";
  hidePreAnalysis();
  resetEditUI();
}

// ===== PRÉ-ANALYSE DE LA PHOTO (dès la prise, AVANT enregistrement) =====
// L'utilisateur voit ce que l'IA reconnaît et peut corriger la description
// avant de sauver. Un résultat obsolète est ignoré si la photo change
// entre-temps (jeton). Mode local : aucune pré-analyse — la photo n'y est
// jamais analysée (honnêteté).
let preAnalysisToken = 0;

function hidePreAnalysis() {
  preAnalysisToken++;
  const box = document.getElementById("photoPreAnalysis");
  if (box) box.style.display = "none";
}

async function preAnalysePhoto(base64) {
  const box = document.getElementById("photoPreAnalysis");
  if (!box) return;
  const settings = getIASettings();
  if (settings.mode !== "external") { box.style.display = "none"; return; }
  const token = ++preAnalysisToken;
  box.style.display = "block";
  box.innerHTML = "<div class='pre-analysis-head'>🤖 Analyse de la photo en cours…</div>";
  try {
    const iaResult = await IA.analyseRepas("(photo)", base64, Medications.getMeds(), Storage.loadHealthConditions(), Storage.loadAllergies());
    if (token !== preAnalysisToken) return; // photo changée ou retirée entre-temps
    if (!iaResult.success) {
      box.innerHTML = "<div class='pre-analysis-head'>⚠️ Analyse indisponible (" + escapeHtmlApp(iaResult.error || "erreur") + ") — décris ton repas en texte.</div>";
      return;
    }
    const badge = iaResult.source === "external" ? "🤖 IA externe — Mistral" : "🔍 Analyse locale";
    box.innerHTML = "<div class='pre-analysis-head'>" + badge + " — corrige la description si besoin, puis enregistre :</div>" +
      "<div class='pre-analysis-text'>" + escapeHtmlApp(iaResult.analysis) + "</div>";
    if (iaResult.photoVerdict && iaResult.photoVerdict !== "ok") showPhotoNotice(iaResult.photoVerdict);
  } catch(e) {
    if (token === preAnalysisToken) {
      box.innerHTML = "<div class='pre-analysis-head'>⚠️ Analyse indisponible — décris ton repas en texte.</div>";
    }
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
  // Édition d'un repas de l'historique (bouton ✏️)
  UI.setMealEditHandler(startEditMeal);
  document.getElementById("cancelEditBtn").onclick = cancelEdit;

  // Export
  document.getElementById("exportBtn").onclick = () => Export.exportJSON(repasList);
  document.getElementById("exportReadableBtn").onclick = () => Export.exportReadable(repasList);
  // Impression (PDF ou imprimante) + page tendances
  document.getElementById("printNavBtn").onclick = () => { window.location.href = "print.html"; };
  document.getElementById("trendsNavBtn").onclick = () => { window.location.href = "tendances.html"; };

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

  // Photo — note honnête en mode local : la photo n'est PAS analysée
  document.getElementById("takePhotoBtn").onclick = async () => {
    const base64 = await Camera.takePhoto();
    if (base64) { Camera.showPreview('photoPreview', 'previewImg', base64); updatePhotoModeNote(); preAnalysePhoto(base64); }
  };
  document.getElementById("uploadPhotoBtn").onclick = async () => {
    const base64 = await Camera.uploadPhoto();
    if (base64) { Camera.showPreview('photoPreview', 'previewImg', base64); updatePhotoModeNote(); preAnalysePhoto(base64); }
  };
  document.getElementById("removePhotoBtn").onclick = () => {
    Camera.clearCurrentPhoto();
    Camera.hidePreview('photoPreview');
    const note = document.getElementById("photoModeNote");
    if (note) note.style.display = "none";
    hidePreAnalysis();
  };

  // Fermeture alerte
  document.getElementById("closeAlertBtn").onclick = () => {
    document.getElementById("alertBanner").style.display = "none";
  };
}

init();
