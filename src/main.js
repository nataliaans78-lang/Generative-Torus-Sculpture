import './styles/main.css';
import { createApp } from './app/createApp.js';
import { createLanding } from './ui/index.js';
import { LANDING_SEEN_STORAGE_KEY } from './config/index.js';

let appStarted = false;

function startApp() {
  if (appStarted) return;
  appStarted = true;
  const app = createApp();
  void app;
}

function shouldShowLanding() {
  const urlParams = new URLSearchParams(window.location.search);
  const landingParam = urlParams.get('landing');
  const force = landingParam === '1';
  const reset = landingParam === 'reset';
  let seen = false;
  try {
    if (reset) {
      window.localStorage.removeItem(LANDING_SEEN_STORAGE_KEY);
    }
    seen = window.localStorage.getItem(LANDING_SEEN_STORAGE_KEY) === '1';
  } catch {
    seen = false;
  }
  return force || reset || !seen;
}

if (shouldShowLanding()) {
  createLanding({
    onEnter: () => {
      try {
        window.localStorage.setItem(LANDING_SEEN_STORAGE_KEY, '1');
      } catch {
        // ignore storage errors
      }
      startApp();
    },
  });
} else {
  startApp();
}
