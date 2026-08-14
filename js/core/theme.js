// L2-L3 Kommunikationsmatrix — Theme-Verwaltung: Hell/Dunkel/System, in localStorage gemerkt (reine
// UI-Präferenz, keine Kundendaten — anders als der Analyse-Stand bewusst NICHT flüchtig).
KLU.theme = {};

const THEME_STORAGE_KEY = 'klu-theme';

KLU.theme.get = function () {
  return localStorage.getItem(THEME_STORAGE_KEY) || 'system';
};

function effectiveIsDark() {
  const explicit = document.documentElement.getAttribute('data-theme');
  if (explicit === 'dark') return true;
  if (explicit === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches; // "system"
}

// Bechtle-AI-Label (Pflicht-Kennzeichnung KI-generierter Inhalte, siehe MASTERPROMPT.md) liegt
// als helle/dunkle SVG-Variante vor -> muss dem tatsächlich dargestellten Theme folgen, auch bei
// "System" und bei einem OS-Theme-Wechsel während die Seite offen ist.
function updateAiLabelIcon() {
  const icon = document.getElementById('ai-label-icon');
  if (!icon) return;
  icon.src = `assets/Bechtle_AI_Generated_Label_${effectiveIsDark() ? 'dark' : 'light'}_EN.svg`;
}

// 'system' entfernt das Attribut wieder -> @media (prefers-color-scheme) in base.css greift.
KLU.theme.apply = function (value) {
  if (value === 'dark' || value === 'light') document.documentElement.setAttribute('data-theme', value);
  else document.documentElement.removeAttribute('data-theme');
  updateAiLabelIcon();
};

KLU.theme.set = function (value) {
  localStorage.setItem(THEME_STORAGE_KEY, value);
  KLU.theme.apply(value);
};

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', updateAiLabelIcon);

// Sofort beim Laden anwenden (nicht erst bei DOMContentLoaded), damit kein helles Aufblitzen
// entsteht, bevor das gespeicherte Dunkel-Theme greift.
KLU.theme.apply(KLU.theme.get());
