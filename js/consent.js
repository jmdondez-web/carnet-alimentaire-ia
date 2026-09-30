// ========== ÉCRAN DE CONSENTEMENT RGPD ==========
// Remplace le confirm() natif par un vrai écran de consentement (RGPD Art. 9)
import { setUserConsent, resetUserConsent } from './ia-settings.js';

let modalInstance = null;

export function showConsentModal() {
  return new Promise((resolve) => {
    if (modalInstance) { modalInstance.remove(); }

    modalInstance = document.createElement('div');
    modalInstance.className = 'consent-overlay';
    modalInstance.innerHTML = `
      <div class="consent-modal" role="dialog" aria-modal="true" aria-labelledby="consentTitle">
        <h3 id="consentTitle">🔒 Consentement IA externe (RGPD)</h3>
        <p class="consent-intro">Pour activer l'analyse par une IA externe, tu dois accepter explicitement le traitement décrit ci-dessous :</p>
        <ul class="consent-list">
          <li>📤 Tes <strong>repas</strong> (texte et photo) et tes <strong>médicaments/problèmes de santé</strong> seront envoyés au fournisseur IA choisi (Mistral AI ou Groq) <strong>uniquement le temps de l'analyse</strong>.</li>
          <li>🗄️ Ces fournisseurs <strong>ne stockent pas</strong> ces données après le traitement.</li>
          <li>📱 Tes données restent sinon <strong>sur ton téléphone</strong> ; rien n'est conservé sur nos serveurs.</li>
          <li>↩️ Tu peux <strong>révoquer ce consentement à tout moment</strong> en revenant au mode local.</li>
          <li>🩺 Cette application est <strong>éducative</strong> et ne remplace pas un avis médical.</li>
        </ul>
        <label class="consent-check">
          <input type="checkbox" id="consentCheckbox">
          <span>J'ai lu et j'accepte que mes données de repas et de santé soient transmises au fournisseur IA pour l'analyse.</span>
        </label>
        <div class="consent-actions">
          <button id="consentRefuse" class="btn btn-outline">❌ Refuser</button>
          <button id="consentAccept" class="btn btn-primary" disabled>✅ Accepter</button>
        </div>
        <p id="consentHint" class="consent-hint"></p>
      </div>
    `;
    document.body.appendChild(modalInstance);

    const checkbox = modalInstance.querySelector('#consentCheckbox');
    const acceptBtn = modalInstance.querySelector('#consentAccept');
    const refuseBtn = modalInstance.querySelector('#consentRefuse');
    const hint = modalInstance.querySelector('#consentHint');

    checkbox.addEventListener('change', () => {
      acceptBtn.disabled = !checkbox.checked;
      hint.textContent = checkbox.checked ? '' : '⚠️ Coche la case pour pouvoir accepter.';
    });

    const close = (accepted) => {
      if (accepted) {
        setUserConsent(true);
        localStorage.setItem('carnet_ia_consent_date', new Date().toISOString());
      }
      modalInstance.remove();
      modalInstance = null;
      resolve(accepted);
    };

    acceptBtn.addEventListener('click', () => close(true));
    refuseBtn.addEventListener('click', () => {
      resetUserConsent();
      close(false);
    });
  });
}

export function getConsentDate() {
  return localStorage.getItem('carnet_ia_consent_date');
}

export function revokeConsent() {
  resetUserConsent();
  localStorage.removeItem('carnet_ia_consent_date');
}
