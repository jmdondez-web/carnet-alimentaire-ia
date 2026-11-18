import { sortMealsByDatetimeDesc } from './storage.js';

let repasList = [];

export function setRepasList(list) {
  repasList = list;
}

// Gestionnaire d'édition : app.js enregistre la fonction qui ouvre le repas
// dans le formulaire (évite une dépendance circulaire ui.js → app.js).
let mealEditHandler = null;
export function setMealEditHandler(fn) {
  mealEditHandler = fn;
}

let mealDeleteHandler = null;
export function setMealDeleteHandler(fn) {
  mealDeleteHandler = fn;
}

// L'alerte rouge (interaction la plus grave) ne s'affiche QUE pour une analyse
// locale : en mode IA externe, interactionDetected.message contient l'analyse
// entière → elle doublonnait le bloc vert. Pur, testé dans tests/run-tests.mjs.
export function showInteractionBadge(meal) {
  return !!meal.interactionDetected && meal.iaSource !== "external";
}

// Premier emoji d'un libellé (chips « sur le pouce ») — l'emoji de la chip
// était perdu à l'enregistrement : seul le texte nu arrivait dans l'historique.
// Pur, testé dans tests/run-tests.mjs. Retourne "" si aucun emoji.
export function leadingEmoji(str) {
  const m = (str || "").match(/\p{Extended_Pictographic}/u);
  return m ? m[0] : "";
}

// Préfixe d'affichage du repas : l'emoji enregistré, SAUF si le texte commence
// déjà par un emoji (les chips créées via le champ d'ajout ont un libellé
// complet, emoji inclus, dans leur texte). Pur, testé dans tests/run-tests.mjs.
export function mealEmojiPrefix(meal) {
  if (!meal || !meal.emoji) return "";
  return leadingEmoji(meal.text || "") ? "" : meal.emoji + " ";
}

// Texte de la colonne « Alertes » du rapport imprimable (print.js) : en mode IA
// externe, interactionDetected.message contient l'analyse ENTIÈRE (choix de
// stockage, pour le compteur des tendances) — l'imprimer la dupliquerait avec la
// colonne « Analyse ». Pur, testé dans tests/run-tests.mjs.
export function mealAlertText(meal) {
  if (!meal || !showInteractionBadge(meal)) return "";
  return meal.interactionDetected.message || "";
}

export function renderMeals(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (repasList.length === 0) {
    container.innerHTML = "<li>Aucun repas enregistré</li>";
    return;
  }

  // Ordre chronologique inverse (repas récent en premier), quelle que soit
  // l'ordre de saisie — un repas encodé en retard apparaît à sa vraie place.
  const sorted = sortMealsByDatetimeDesc(repasList);
  container.innerHTML = sorted.map(meal => `
    <li>
      <div class="meal-date">${new Date(meal.datetime).toLocaleString()}</div>
      <div class="meal-text">${mealEmojiPrefix(meal)}${escapeHtml(meal.text || "")}</div>
      ${showInteractionBadge(meal) ? `<div class="alert-mini">⚠️ ${escapeHtml(meal.interactionDetected.message)}</div>` : ""}
      ${meal.analysis ? `<div class="meal-analysis"><span class="meal-analysis-head">🤖 Analyse — ${meal.iaSource === "external" ? "IA externe" : "règles locales"}</span>${escapeHtml(meal.analysis)}</div>` : ""}
      ${meal.photo ? `<img src="${meal.photo}" class="meal-photo" alt="photo">` : ""}
      <div class="meal-actions">
        <button class="meal-edit-btn" data-id="${meal.id}">✏️ Modifier</button>
        <button class="meal-delete-btn" data-id="${meal.id}" title="Supprimer ce repas">🗑️</button>
      </div>
    </li>
  `).join("");

  container.querySelectorAll(".meal-edit-btn").forEach(btn => {
    btn.onclick = () => {
      if (mealEditHandler) mealEditHandler(Number(btn.dataset.id));
    };
  });
  container.querySelectorAll(".meal-delete-btn").forEach(btn => {
    btn.onclick = () => {
      if (mealDeleteHandler) mealDeleteHandler(Number(btn.dataset.id));
    };
  });
}

export function showAlert(message, containerId) {
  const banner = document.getElementById(containerId);
  const messageElem = document.getElementById("alertMessage");
  if (banner && messageElem) {
    messageElem.innerHTML = message;
    banner.style.display = "flex";
    setTimeout(() => {
      banner.style.display = "none";
    }, 8000);
  }
}

export function updateTip(tip, containerId) {
  const tipElem = document.getElementById(containerId);
  if (tipElem) tipElem.innerText = tip;
}

// Toast discret (remplace les alert() de confirmation)
export function showToast(message) {
  let toast = document.getElementById('uiToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'uiToast';
    toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(80px);background:#1a2b1a;color:#fff;padding:12px 22px;border-radius:24px;font-size:14px;z-index:9999;transition:transform .3s;max-width:85%;text-align:center;';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  requestAnimationFrame(() => { toast.style.transform = 'translateX(-50%) translateY(0)'; });
  setTimeout(() => { toast.style.transform = 'translateX(-50%) translateY(80px)'; }, 2000);
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
