// ========== NAVIGATION MODULE ==========
// Gère la navigation entre les pages et l'indicateur de médicaments

export function initNavigation() {
  // Navigation vers page paramètres
  const settingsBtn = document.getElementById('settingsNavBtn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      window.location.href = 'settings.html';
    });
  }
  
  // Navigation vers accueil (depuis settings)
  const backBtn = document.getElementById('backToHomeBtn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      window.location.href = 'index.html';
    });
  }
  
  // Bouton "Gérer" depuis la carte résumé
  const gotoSettingsBtn = document.getElementById('gotoSettingsBtn');
  if (gotoSettingsBtn) {
    gotoSettingsBtn.addEventListener('click', () => {
      window.location.href = 'settings.html';
    });
  }
}

export function updateMedSummary() {
  import('./medications.js').then(module => {
    const meds = module.getMeds();
    const badge = document.getElementById('medCountBadge');
    const previewList = document.getElementById('medPreviewList');
    
    if (badge) {
      badge.innerText = meds.length === 0 ? '0 traitement' : 
                        meds.length === 1 ? '1 traitement' : `${meds.length} traitements`;
    }
    
    if (previewList) {
      if (meds.length === 0) {
        previewList.innerHTML = '<span class="info-note">Aucun traitement enregistré</span>';
      } else {
        previewList.innerHTML = meds.slice(0, 3).map(med => 
          `<span>💊 ${escapeHtml(med.displayName)}</span>`
        ).join('');
        if (meds.length > 3) {
          previewList.innerHTML += `<span>+${meds.length - 3}</span>`;
        }
      }
    }
  });
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