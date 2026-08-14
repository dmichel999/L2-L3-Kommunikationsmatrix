// L2-L3 Kommunikationsmatrix — UI für die Anonymisierungs-Option im Header.
KLU.views = KLU.views || {};

KLU.views.anonymizeToggle = {
  init() {
    const toggle = document.getElementById('anonymize-toggle');
    toggle?.addEventListener('change', () => {
      KLU.anonymize.setEnabled(toggle.checked);
      KLU.emit('switches:changed', null); // erzwingt Re-Render aller Ansichten mit neuem Status
    });
  }
};
