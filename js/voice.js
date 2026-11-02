let recognition = null;
let isListening = false;
let callbacks = {};
// Dernier fragment final livré. Chrome Android re-livre le même énoncé
// en fragments croissants (« salade », « salade de », « salade de lentilles »),
// à des indices différents selon les événements. On déduplique par contenu :
// - identique → ignoré ; préfixe qui s'allonge → révision ; sinon → ajout.
let lastFinal = "";

export function initVoice(onResult, onError, onEnd, onCorrection) {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    console.error("Dictée non supportée");
    return false;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.lang = "fr-FR";
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  callbacks = { onResult, onError, onEnd, onCorrection };

  recognition.onresult = (event) => {
    // Suivi par CONTENU (le suivi par index a échoué sur Chrome Android :
    // les fragments re-livrés arrivent à des indices différents à chaque fois).
    // Règles : identique au précédent → ignoré ; prolonge le précédent
    // (préfixe) → révision (remplacement) ; sinon → nouvel ajout.
    let newText = "";
    let corrections = [];
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const res = event.results[i];
      if (!res.isFinal) continue;
      const text = (res[0].transcript || "").trim();
      if (!text) continue;
      if (text === lastFinal) continue;                 // répétition exacte
      if (lastFinal && text.startsWith(lastFinal)) {    // révision : le fragment s'allonge
        corrections.push({ from: lastFinal, to: text });
      } else {
        newText += (newText ? " " : "") + text;          // nouvel énoncé
      }
      lastFinal = text;
    }
    if (newText && callbacks.onResult) {
      callbacks.onResult(newText);
    }
    if (corrections.length && callbacks.onCorrection) {
      callbacks.onCorrection(corrections);
    }
  };

  recognition.onerror = (event) => {
    if (callbacks.onError) callbacks.onError(event.error);
    stopVoice();
  };

  recognition.onend = () => {
    stopVoice();
    if (callbacks.onEnd) callbacks.onEnd();
  };

  return true;
}

export function startVoice() {
  if (!recognition || isListening) return false;
  try {
    lastFinal = "";
    recognition.start();
    isListening = true;
    return true;
  } catch(e) {
    console.error("Erreur démarrage", e);
    return false;
  }
}

export function stopVoice() {
  if (recognition && isListening) {
    try {
      recognition.stop();
    } catch(e) {}
  }
  isListening = false;
}

export function isVoiceActive() {
  return isListening;
}
