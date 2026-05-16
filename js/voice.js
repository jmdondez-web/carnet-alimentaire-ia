let recognition = null;
let isListening = false;
let callbacks = {};

export function initVoice(onResult, onError, onEnd) {
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
  
  callbacks = { onResult, onError, onEnd };
  
  recognition.onresult = (event) => {
    let finalText = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      if (event.results[i].isFinal) {
        finalText += event.results[i][0].transcript;
      }
    }
    if (finalText && callbacks.onResult) {
      callbacks.onResult(finalText);
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