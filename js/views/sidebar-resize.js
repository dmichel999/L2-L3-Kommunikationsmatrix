// L2-L3 Kommunikationsmatrix — Breiten-Resizer zwischen Sidebar (Import) und Hauptbereich.
KLU.views = KLU.views || {};

KLU.views.sidebarResize = {
  init() {
    const handle = document.getElementById('sidebar-resize-handle');
    const app = document.querySelector('.app');
    if (!handle || !app) return;
    let dragging = false;

    handle.addEventListener('pointerdown', e => {
      dragging = true;
      handle.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    handle.addEventListener('pointermove', e => {
      if (!dragging) return;
      // .app füllt den Viewport ab x=0, daher entspricht clientX direkt der gewünschten Breite.
      const width = Math.min(560, Math.max(220, e.clientX));
      app.style.gridTemplateColumns = `${width}px 6px 1fr`;
    });
    const stopDrag = () => { dragging = false; };
    handle.addEventListener('pointerup', stopDrag);
    handle.addEventListener('pointercancel', stopDrag);
  }
};
