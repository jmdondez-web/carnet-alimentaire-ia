let recognition = null;
let isListening = false;
let callbacks = {};
// Dernier fragment final livré. Chrome Android re-livre le même énoncé
// en fragments croissants (« salade », « salade de », « salade de lentilles »),
// à des indices différents selon les événements. On déduplique par contenu :
// - identique → ignoré ; préfixe qui s'allonge → révision ; sinon → ajout.
let lastFinal = "";

// Logique de déduplication dictée — pure, testée dans tests/run-tests.mjs.
// Chrome Android re-livre l'énoncé en fragments croissants à des indices
// différents : identique → ignoré ; prolonge le précédent → révision ; sinon → ajout.
export function classifyFinal(text, lastFinal) {
  if (text === lastFinal) return { action: "ignore" };
  if (lastFinal && text.startsWith(lastFinal)) return { action: "revise", from: lastFinal, to: text };
  return { action: "append", text: text };
}

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
      const verdict = classifyFinal(text, lastFinal);
      if (verdict.action === "append") {
        newText += (newText ? " " : "") + verdict.text;
      } else if (verdict.action === "revise") {
        corrections.push({ from: verdict.from, to: verdict.to });
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
