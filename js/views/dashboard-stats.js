// Kunden LAN Überblick — Dashboard-Kennzahlen (Feature 4 der Erweiterung): kompakte Übersicht,
// aggregiert ausschließlich bereits vorhandene Modelle, kein neuer Parser.
KLU.views = KLU.views || {};

function computeDashboardStats() {
  const switches = KLU.state.getSwitches();
  const vlans = KLU.vlanModel.build(switches);
  const vlansWithoutSvi = vlans.filter(v => v.networks.length === 0).length;
  const macEntries = switches.reduce((sum, sw) => sum + (sw.parsed?.macTable?.length || 0), 0);
  return { switchCount: switches.length, vlanCount: vlans.length, vlansWithoutSvi, macEntries };
}

function renderDashboardStats() {
  const el = document.getElementById('dashboard-stats');
  if (!el) return;
  const stats = computeDashboardStats();
  el.innerHTML = `
    <span class="dashboard-stat"><strong>${stats.switchCount}</strong> Switches</span>
    <span class="dashboard-stat"><strong>${stats.vlanCount}</strong> VLANs</span>
    <span class="dashboard-stat"><strong>${stats.vlansWithoutSvi}</strong> ohne SVI</span>
    <span class="dashboard-stat"><strong>${stats.macEntries}</strong> gelernte MAC-Einträge</span>
  `;
}

KLU.views.dashboardStats = {
  init() {
    KLU.on('switches:changed', renderDashboardStats);
    renderDashboardStats();
  }
};
