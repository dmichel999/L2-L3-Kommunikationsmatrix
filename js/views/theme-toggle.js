// L2-L3 Kommunikationsmatrix — UI für die Theme-Auswahl (Hell/Dunkel/System) im Header.
KLU.views = KLU.views || {};

KLU.views.themeToggle = {
  init() {
    const group = document.getElementById('theme-toggle-group');
    if (!group) return;
    const current = KLU.theme.get();
    group.querySelectorAll('[data-theme]').forEach(btn => {
      btn.setAttribute('aria-pressed', String(btn.dataset.theme === current));
    });
    group.addEventListener('click', e => {
      const btn = e.target.closest('[data-theme]');
      if (!btn) return;
      group.querySelectorAll('[data-theme]').forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
      KLU.theme.set(btn.dataset.theme);
    });
  }
};
