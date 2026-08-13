// Kunden LAN Überblick — generischer Split-Pane-Resizer (Feature 7 der Erweiterung): verstellt
// die Breite zwischen dem Element links vom Resizer und dem Rest der Flex-Zeile per Drag.
KLU.views = KLU.views || {};

KLU.views.splitPane = {
  init(containerSelector, resizerSelector) {
    const container = document.querySelector(containerSelector);
    const resizer = document.querySelector(resizerSelector);
    if (!container || !resizer) return;
    const left = resizer.previousElementSibling;
    let dragging = false;
    let resizeRaf = null; // drosselt den 'resize'-Dispatch auf max. 1x pro Frame statt pro pointermove

    resizer.addEventListener('pointerdown', e => {
      dragging = true;
      resizer.setPointerCapture(e.pointerId);
    });

    resizer.addEventListener('pointermove', e => {
      if (!dragging) return;
      const rect = container.getBoundingClientRect();
      if (!rect.width) return;
      const pct = Math.min(80, Math.max(20, ((e.clientX - rect.left) / rect.width) * 100));
      left.style.flexBasis = `${pct}%`;
      // Topologie-SVG-viewBox muss neu berechnet werden, aber ein voller Graph-Rebuild bei JEDEM
      // pointermove verursacht sichtbares Ruckeln — auf max. 1x pro Animationsframe drosseln.
      if (!resizeRaf) {
        resizeRaf = requestAnimationFrame(() => {
          window.dispatchEvent(new Event('resize'));
          resizeRaf = null;
        });
      }
    });

    const stopDrag = () => { dragging = false; };
    resizer.addEventListener('pointerup', stopDrag);
    resizer.addEventListener('pointercancel', stopDrag);
  }
};
