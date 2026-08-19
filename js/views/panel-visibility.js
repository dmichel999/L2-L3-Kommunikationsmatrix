// L2-L3 Kommunikationsmatrix — Panel-Sichtbarkeits-Menü: blendet die rechten Detail-Panels
// (MAC-Adressen/Trunk-Warnungen/STP/Duplicate-Erkennung/Netzwerk-Details) einzeln aus/ein, damit
// bei wachsender Panel-Zahl nur die gewünschten Bereiche sichtbar bleiben. Reine UI-Präferenz
// (kein Kundendatenbezug) -> analog zur Theme-Auswahl bewusst NICHT flüchtig, in localStorage
// gemerkt.
KLU.views = KLU.views || {};

const PANEL_VISIBILITY_STORAGE_KEY = 'klu-hidden-panels';

const TOGGLABLE_PANELS = [
  { key: 'mac', label: 'MAC-Adressen' },
  { key: 'trunk', label: 'Trunk-Warnungen' },
  { key: 'portchannel', label: 'Port-Channels' },
  { key: 'stp', label: 'STP: Root-Bridge & blockierte Ports' },
  { key: 'duplicate', label: 'Duplicate-Erkennung' },
  { key: 'network', label: 'Netzwerk-Details' }
];

function getHiddenPanels() {
  try {
    const stored = JSON.parse(localStorage.getItem(PANEL_VISIBILITY_STORAGE_KEY));
    return new Set(Array.isArray(stored) ? stored : []);
  } catch {
    return new Set();
  }
}

function setHiddenPanels(hidden) {
  localStorage.setItem(PANEL_VISIBILITY_STORAGE_KEY, JSON.stringify(Array.from(hidden)));
}

function applyPanelVisibility(hidden) {
  for (const { key } of TOGGLABLE_PANELS) {
    document.querySelector(`.panel[data-panel-key="${key}"]`)?.classList.toggle('panel-hidden', hidden.has(key));
  }
}

function renderPanelVisibilityMenu(hidden) {
  const list = document.getElementById('panel-visibility-list');
  if (!list) return;
  list.innerHTML = TOGGLABLE_PANELS.map(({ key, label }) => `
    <label class="toggle-switch">
      <input type="checkbox" data-panel-key="${key}"${hidden.has(key) ? '' : ' checked'}>
      ${KLU.dom.escapeHtml(label)}
    </label>
  `).join('');
}

KLU.views.panelVisibility = {
  init() {
    const hidden = getHiddenPanels();
    applyPanelVisibility(hidden);
    renderPanelVisibilityMenu(hidden);

    const toggleBtn = document.getElementById('panel-visibility-toggle');
    const popover = document.getElementById('panel-visibility-popover');
    toggleBtn?.addEventListener('click', e => {
      e.stopPropagation();
      const open = popover.classList.toggle('open');
      toggleBtn.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', e => {
      if (popover?.classList.contains('open') && !e.target.closest('.panel-visibility-menu')) {
        popover.classList.remove('open');
        toggleBtn?.setAttribute('aria-expanded', 'false');
      }
    });

    document.getElementById('panel-visibility-list')?.addEventListener('change', e => {
      const checkbox = e.target.closest('input[type=checkbox]');
      if (!checkbox) return;
      const hiddenNow = getHiddenPanels();
      const key = checkbox.dataset.panelKey;
      if (checkbox.checked) hiddenNow.delete(key);
      else hiddenNow.add(key);
      setHiddenPanels(hiddenNow);
      applyPanelVisibility(hiddenNow);
    });
  }
};
