// ========== NAVIGATION MODULE ==========
// Gère la navigation depuis la page d'accueil (les autres pages ont leur
// propre bouton de retour, branché dans leur module dédié).

export function initNavigation() {
  // Navigation vers page paramètres
  const settingsBtn = document.getElementById('settingsNavBtn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      window.location.href = 'settings.html';
    });
  }
}