// Kunden LAN Überblick — Umschalter zwischen den Hauptansichten (Topologie / VLAN-Tabelle)
KLU.views = KLU.views || {};

KLU.views.tabs = {
  init() {
    const tabs = document.querySelectorAll('.view-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));
        document.getElementById(`view-${tab.dataset.view}`)?.classList.add('active');
        KLU.emit('view:changed', tab.dataset.view);
      });
    });
  }
};
