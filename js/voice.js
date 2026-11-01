let recognition = null;
let isListening = false;
let callbacks = {};
// Résultats finaux déjà livrés, par index de résultat. Chrome Android
// re-livre parfois un même index : d'abord un fragment, puis la version
// complète (bug observé : « message message de test »). On déduplique :
// - index nouveau → livré une fois ;
// - même index, même texte → ignoré ;
// - même index, texte différent → correction (remplacement).
let deliveredFinals = new Map();

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
    let newText = "";
    let corrections = [];
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const res = event.results[i];
      if (!res.isFinal) continue;
      const text = (res[0].transcript || "").trim();
      if (!text) continue;
      const prev = deliveredFinals.get(i);
      if (prev === undefined) {
        deliveredFinals.set(i, text);
        newText += (newText ? " " : "") + text;
      } else if (text !== prev) {
        deliveredFinals.set(i, text);
        corrections.push({ from: prev, to: text });
      }
      // même index + même texte → déjà livré, ignoré
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
    deliveredFinals = new Map();
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
