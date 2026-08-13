// Kunden LAN Überblick — L3-Kommunikationsmatrix (Feature 1 der Erweiterung): VLAN×VLAN-Tabelle,
// ✓ = gemeinsamer Switch mit beiden SVIs bekannt (routbar), ? = nicht ermittelbar (kein Beweis
// für "blockiert", siehe reachability-model.js). ACL-Warnung ist nur ein Hinweis-Flag, keine
// Regelauswertung.
KLU.views = KLU.views || {};

function renderReachabilityMatrix() {
  const wrapper = document.getElementById('matrix-wrapper');
  if (!wrapper) return;
  const rows = KLU.reachabilityModel.build(KLU.state.getSwitches());

  if (rows.length === 0) {
    wrapper.innerHTML = '<p class="hint">Noch keine Switches mit bekanntem VLAN-Interface (SVI) importiert.</p>';
    return;
  }

  const header = `<tr><th></th>${rows.map(r => `<th>VLAN ${r.vlanId}</th>`).join('')}</tr>`;
  const body = rows.map(r => `
    <tr>
      <th>VLAN ${r.vlanId}${r.aclFlag ? ' <span class="switch-warning" title="Auf einer beteiligten SVI ist eine Access-List konfiguriert — Regeln werden nicht ausgewertet, bitte manuell prüfen">⚠ ACL</span>' : ''}</th>
      ${rows.map(c => {
        if (c.vlanId === r.vlanId) return '<td class="matrix-cell matrix-cell-self">–</td>';
        const reachable = KLU.reachabilityModel.isReachable(r, c);
        const title = reachable ? 'Gemeinsamer Switch mit beiden SVIs bekannt' : 'Kein gemeinsamer Switch mit beiden SVIs bekannt — Erreichbarkeit nicht ermittelbar';
        return `<td class="matrix-cell ${reachable ? 'matrix-cell-reachable' : 'matrix-cell-unknown'}" title="${KLU.dom.escapeHtml(title)}">${reachable ? '✓' : '?'}</td>`;
      }).join('')}
    </tr>
  `).join('');

  wrapper.innerHTML = `<table class="matrix-table"><thead>${header}</thead><tbody>${body}</tbody></table>`;
}

KLU.views.reachabilityMatrix = {
  init() {
    KLU.on('switches:changed', renderReachabilityMatrix);
    KLU.on('view:changed', view => { if (view === 'matrix') renderReachabilityMatrix(); });
    renderReachabilityMatrix();
  }
};
