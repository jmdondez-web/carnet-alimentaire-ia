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
      <div class="meal-text">${escapeHtml(meal.text || "")}</div>
      ${meal.interactionDetected ? `<div class="alert-mini">⚠️ ${escapeHtml(meal.interactionDetected.message)}</div>` : ""}
      ${meal.photo ? `<img src="${meal.photo}" class="meal-photo" alt="photo">` : ""}
      <div class="meal-actions">
        <button class="meal-edit-btn" data-id="${meal.id}">✏️ Modifier</button>
      </div>
    </li>
  `).join("");

  container.querySelectorAll(".meal-edit-btn").forEach(btn => {
    btn.onclick = () => {
      if (mealEditHandler) mealEditHandler(Number(btn.dataset.id));
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
