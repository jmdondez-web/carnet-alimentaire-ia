import { loadDarkMode, saveDarkMode } from './storage.js';

export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log("✅ SW enregistré"))
      .catch(err => console.error("❌ SW failed", err));
  }
}

export function initDarkMode() {
  if (loadDarkMode()) document.body.classList.add('dark');
  
  const toggleBtn = document.getElementById('darkModeToggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      document.body.classList.toggle('dark');
      saveDarkMode(document.body.classList.contains('dark'));
    });
  }
}