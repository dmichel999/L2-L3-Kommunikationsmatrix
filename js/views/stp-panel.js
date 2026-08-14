// L2-L3 Kommunikationsmatrix — STP-Panel: Root-Bridge je VLAN + blockierte Ports.
KLU.views = KLU.views || {};

function hostnameOfSwitchForStp(id) {
  return KLU.state.switches.get(id)?.hostname || id;
}

function renderStpPanel() {
  const panel = document.getElementById('stp-panel');
  if (!panel) return;
  const switches = KLU.state.getSwitches();

  if (switches.length === 0) {
    panel.innerHTML = '';
    return;
  }

  const rows = KLU.stpModel.build(switches);
  if (rows.length === 0) {
    panel.innerHTML = '<p class="hint">Keine Spanning-Tree-Daten importiert ("show spanning-tree" fehlt).</p>';
    return;
  }

  const tableRows = rows.map(r => {
    const rootLabel = r.rootSwitchId
      ? KLU.dom.escapeHtml(hostnameOfSwitchForStp(r.rootSwitchId))
      : r.rootAddress
        ? `unbekannt (${KLU.dom.escapeHtml(r.rootAddress)})`
        : '<span class="hint">–</span>';
    const blockedLabel = r.blockedPorts.length
      ? r.blockedPorts.map(b => `${KLU.dom.escapeHtml(hostnameOfSwitchForStp(b.switchId))}: ${KLU.dom.escapeHtml(b.port)}`).join(', ')
      : '<span class="hint">keine</span>';
    return `<tr><td>VLAN ${r.vlanId}</td><td>${rootLabel}</td><td>${blockedLabel}</td></tr>`;
  }).join('');

  panel.innerHTML = `
    <table class="vlan-table">
      <thead><tr><th>VLAN</th><th>Root Bridge</th><th>Blockierte Ports</th></tr></thead>
      <tbody>${tableRows}</tbody>
    </table>
  `;
}

KLU.views.stpPanel = {
  init() {
    KLU.on('switches:changed', renderStpPanel);
    renderStpPanel();
  }
};
