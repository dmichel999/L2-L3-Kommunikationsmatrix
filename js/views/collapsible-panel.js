// L2-L3 Kommunikationsmatrix — generische Panel-Komponente: einklappbar per Klick auf den Header,
// optional per Ziehgriff unabhängig in der Höhe verstellbar. Wird auf die drei rechten
// Detail-Panels (Netzwerk-Details/Trunk-Warnungen/MAC-Adressen) und die Sidebar-Bereiche
// angewandt — jedes Panel behält seinen Auf/Zu-Zustand unabhängig von den anderen.
KLU.views = KLU.views || {};

const PANEL_MIN_HEIGHT = 80; // px

function initPanel(panelEl) {
  const header = panelEl.querySelector('.panel-header');
  const toggleIcon = panelEl.querySelector('.panel-collapse-btn');
  const body = panelEl.querySelector('.panel-body');
  const handle = panelEl.querySelector('.panel-resize-handle');

  header?.addEventListener('click', () => {
    panelEl.classList.toggle('collapsed');
    toggleIcon?.setAttribute('aria-expanded', String(!panelEl.classList.contains('collapsed')));
  });

  if (!handle || !body) return;
  let dragging = false;
  let startY = 0;
  let startHeight = 0;

  handle.addEventListener('pointerdown', e => {
    dragging = true;
    startY = e.clientY;
    startHeight = body.getBoundingClientRect().height;
    handle.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  handle.addEventListener('pointermove', e => {
    if (!dragging) return;
    body.style.height = `${Math.max(PANEL_MIN_HEIGHT, startHeight + (e.clientY - startY))}px`;
  });
  const stopDrag = () => { dragging = false; };
  handle.addEventListener('pointerup', stopDrag);
  handle.addEventListener('pointercancel', stopDrag);
}

KLU.views.collapsiblePanels = {
  init(selector) {
    document.querySelectorAll(selector).forEach(initPanel);
  }
};
