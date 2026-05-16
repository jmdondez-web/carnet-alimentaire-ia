// ========== UI SETTINGS MODULE ==========
// Interface utilisateur pour les paramètres IA

import { 
  getIASettings, 
  saveIASettings, 
  updateIASetting, 
  PROVIDERS,
  testAPIConnection,
  hasValidAPIKey,
  hasUserConsented,
  resetUserConsent
} from './ia-settings.js';

// Créer et afficher le panneau des paramètres IA
export function renderIASettingsPanel(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  const settings = getIASettings();
  const consented = hasUserConsented();
  
  container.innerHTML = `
    <div class="settings-panel">
      <h3>🤖 Paramètres IA</h3>
      
      <div class="setting-group">
        <label>Mode d'analyse :</label>
        <div class="radio-group">
          <label class="radio-label">
            <input type="radio" name="iaMode" value="local" ${settings.mode === 'local' ? 'checked' : ''}>
            📱 Local (hors ligne, privé, gratuit)
          </label>
          <label class="radio-label">
            <input type="radio" name="iaMode" value="external" ${settings.mode === 'external' ? 'checked' : ''}>
            🌐 Externe (plus intelligent, nécessite internet)
          </label>
        </div>
        ${!consented && settings.mode !== 'external' ? 
          '<p class="consent-warning">⚠️ Le mode externe nécessite ton consentement (RGPD). Clique dessus pour l\'activer.</p>' : ''}
      </div>
      
      <div id="externalSettings" style="display: ${settings.mode === 'external' ? 'block' : 'none'}">
        <div class="setting-group">
          <label>Fournisseur IA :</label>
          <select id="iaProvider" class="settings-select">
            ${Object.entries(PROVIDERS).map(([key, p]) => `
              <option value="${key}" ${settings.provider === key ? 'selected' : ''}>
                ${p.name} - ${p.description}
              </option>
            `).join('')}
          </select>
        </div>
        
        <div class="setting-group">
          <label>Modèle :</label>
          <select id="iaModel" class="settings-select">
            ${PROVIDERS[settings.provider].models.map(m => `
              <option value="${m}" ${settings.model === m ? 'selected' : ''}>${m}</option>
            `).join('')}
          </select>
        </div>
        
        <div class="setting-group">
          <label>Clé API :</label>
          <input type="password" id="apiKeyInput" class="settings-input" 
                 placeholder="Entrez votre clé API ${PROVIDERS[settings.provider].name}"
                 value="${settings.apiKey || ''}">
          <button id="testApiBtn" class="small-btn">🔌 Tester la connexion</button>
          <div id="apiTestResult" class="api-test-result"></div>
        </div>
        
        <div class="setting-group">
          <label class="checkbox-label">
            <input type="checkbox" id="visionEnabled" ${settings.visionEnabled ? 'checked' : ''}>
            📸 Activer l'analyse photo (vision) - ${PROVIDERS[settings.provider].visionSupported ? 'disponible' : 'non supporté par ce fournisseur'}
          </label>
        </div>
        
        <div class="info-box">
          💡 <strong>Obtention d'une clé API gratuite :</strong><br>
          ${settings.provider === 'mistral' ? 
            '➡️ https://console.mistral.ai → Créer un compte → API Keys → Créer une clé' :
            '➡️ https://console.groq.com → Créer un compte → API Keys → Créer une clé'}
        </div>
        
        <div class="info-box consent-info">
          🔒 <strong>Données et vie privée :</strong><br>
          En activant le mode externe, tes repas et médicaments sont envoyés au fournisseur choisi.<br>
          Aucune donnée n'est stockée. Tu peux révoquer ton consentement en revenant en mode local.
        </div>
      </div>
      
      <div class="setting-actions">
        <button id="saveSettingsBtn" class="save-btn">💾 Sauvegarder</button>
      </div>
    </div>
  `;
  
  // Brancher les événements
  bindSettingsEvents(containerId);
}

function bindSettingsEvents(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  // Mode IA (local/externe)
  const radioLocal = container.querySelector('input[value="local"]');
  const radioExternal = container.querySelector('input[value="external"]');
  const externalDiv = container.querySelector('#externalSettings');
  
  if (radioLocal && radioExternal) {
    radioLocal.addEventListener('change', () => {
      if (radioLocal.checked) externalDiv.style.display = 'none';
    });
    radioExternal.addEventListener('change', () => {
      if (radioExternal.checked) externalDiv.style.display = 'block';
    });
  }
  
  // Changement de fournisseur
  const providerSelect = container.querySelector('#iaProvider');
  const modelSelect = container.querySelector('#iaModel');
  
  if (providerSelect) {
    providerSelect.addEventListener('change', () => {
      const provider = providerSelect.value;
      const models = PROVIDERS[provider].models;
      modelSelect.innerHTML = models.map(m => `<option value="${m}">${m}</option>`).join('');
      
      const apiInput = container.querySelector('#apiKeyInput');
      if (apiInput) apiInput.placeholder = `Entrez votre clé API ${PROVIDERS[provider].name}`;
      
      const infoBox = container.querySelector('.info-box:not(.consent-info)');
      if (infoBox) {
        infoBox.innerHTML = `💡 <strong>Obtention d'une clé API gratuite :</strong><br>
          ${provider === 'mistral' ? 
            '➡️ https://console.mistral.ai → Créer un compte → API Keys → Créer une clé' :
            '➡️ https://console.groq.com → Créer un compte → API Keys → Créer une clé'}`;
      }
      
      const visionCheckbox = container.querySelector('#visionEnabled');
      if (visionCheckbox) {
        visionCheckbox.disabled = !PROVIDERS[provider].visionSupported;
        if (!PROVIDERS[provider].visionSupported) visionCheckbox.checked = false;
      }
    });
  }
  
  // Test API
  const testBtn = container.querySelector('#testApiBtn');
  if (testBtn) {
    testBtn.addEventListener('click', async () => {
      const apiKey = container.querySelector('#apiKeyInput').value;
      const provider = providerSelect?.value || 'mistral';
      
      const tempSettings = getIASettings();
      tempSettings.apiKey = apiKey;
      tempSettings.provider = provider;
      saveIASettings(tempSettings);
      
      const resultDiv = container.querySelector('#apiTestResult');
      resultDiv.innerHTML = "🔄 Test en cours...";
      resultDiv.style.color = "blue";
      
      const result = await testAPIConnection();
      
      if (result.success) {
        resultDiv.innerHTML = `✅ Connexion réussie ! ${result.message}`;
        resultDiv.style.color = "green";
      } else {
        resultDiv.innerHTML = `❌ Échec : ${result.error}`;
        resultDiv.style.color = "red";
      }
    });
  }
  
  // Sauvegarde
  const saveBtn = container.querySelector('#saveSettingsBtn');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const mode = container.querySelector('input[name="iaMode"]:checked')?.value || 'local';
      const provider = providerSelect?.value || 'mistral';
      const model = modelSelect?.value || 'mistral-tiny';
      const apiKey = container.querySelector('#apiKeyInput')?.value || '';
      const visionEnabled = container.querySelector('#visionEnabled')?.checked || false;
      
      const success = updateIASetting('mode', mode);
      if (!success && mode === 'external') {
        alert("⚠️ Tu dois accepter le consentement RGPD pour activer l'IA externe.\n\nClique à nouveau sur 'Externe' et accepte la boîte de dialogue.");
        return;
      }
      
      updateIASetting('provider', provider);
      updateIASetting('model', model);
      updateIASetting('apiKey', apiKey);
      updateIASetting('visionEnabled', visionEnabled);
      
      const confirmMsg = document.createElement('div');
      confirmMsg.innerHTML = "✅ Paramètres sauvegardés !";
      confirmMsg.style.color = "green";
      confirmMsg.style.marginTop = "10px";
      saveBtn.parentNode.appendChild(confirmMsg);
      setTimeout(() => confirmMsg.remove(), 2000);
    });
  }
}

// Afficher un indicateur du mode IA actif
export function showIAModeIndicator(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  const settings = getIASettings();
  const hasKey = hasValidAPIKey();
  const consented = hasUserConsented();
  
  let modeText = "";
  let modeClass = "";
  
  if (settings.mode === "local") {
    modeText = "📱 Mode local (hors ligne, privé, aucune donnée transmise)";
    modeClass = "mode-local";
  } else if (hasKey && consented) {
    modeText = `🌐 Mode externe actif (${PROVIDERS[settings.provider]?.name || settings.provider}) - données envoyées à l'API`;
    modeClass = "mode-external";
  } else if (settings.mode === "external" && !hasKey) {
    modeText = "⚠️ Mode externe sans clé API → fonctionnement local (aucune donnée transmise)";
    modeClass = "mode-warning";
  } else {
    modeText = "⚙️ Mode IA non configuré";
    modeClass = "mode-warning";
  }
  
  container.innerHTML = `<div class="ia-mode-indicator ${modeClass}">${modeText}</div>`;
}