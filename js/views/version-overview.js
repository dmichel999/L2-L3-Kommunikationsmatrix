// L2-L3 Kommunikationsmatrix — Versionsübersicht (Feature 2 der Erweiterung): Hostname/Plattform/
// Modell/Version je Switch, nutzt ausschließlich bereits vorhandene show-version-Parserdaten.
KLU.views = KLU.views || {};

function renderVersionTable() {
  const wrapper = document.getElementById('version-table-wrapper');
  if (!wrapper) return;
  const switches = KLU.state.getSwitches();

  if (switches.length === 0) {
    wrapper.innerHTML = '<p class="hint">Noch keine Switches importiert.</p>';
    return;
  }

  const rows = switches.map(sw => `
    <tr>
      <td>${KLU.dom.escapeHtml(KLU.anonymize.hostname(sw.hostname))}</td>
      <td><span class="badge badge-${sw.platform === 'nexus' ? 'nexus' : 'catalyst'}">${KLU.dom.escapeHtml(sw.platform)}</span></td>
      <td>${KLU.dom.escapeHtml(sw.model) || '<span class="hint">–</span>'}</td>
      <td>${KLU.dom.escapeHtml(sw.osVersion) || '<span class="hint">–</span>'}</td>
    </tr>
  `).join('');

  wrapper.innerHTML = `
    <table class="vlan-table">
      <thead><tr><th>Hostname</th><th>Plattform</th><th>Modell</th><th>Version</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

KLU.views.versionOverview = {
  init() {
    KLU.on('switches:changed', renderVersionTable);
    KLU.on('view:changed', view => { if (view === 'versions') renderVersionTable(); });
    renderVersionTable();
  }
};
