// Kunden LAN Überblick — UI für die Theme-Auswahl (Hell/Dunkel/System) im Header.
KLU.views = KLU.views || {};

KLU.views.themeToggle = {
  init() {
    const select = document.getElementById('theme-select');
    if (!select) return;
    select.value = KLU.theme.get();
    select.addEventListener('change', () => KLU.theme.set(select.value));
  }
};
