// L2-L3 Kommunikationsmatrix — MAC-Adressen-Ansicht für das ausgewählte VLAN (Feature 3):
// Switch/Port je MAC-Adresse, ohne Uplinks zwischen Switches und ohne SVI-eigene MACs.
KLU.views = KLU.views || {};

function renderMacDetail() {
  const panel = document.getElementById('mac-detail-panel');
  if (!panel) return;

  const vlanId = KLU.state.selectedVlan;
  if (vlanId == null) {
    panel.innerHTML = '<p class="hint">Klicke auf eine VLAN-Zeile, um die gelernten MAC-Adressen zu sehen.</p>';
    return;
  }

  const switches = KLU.state.getSwitches();
  const graph = KLU.topology.buildGraph(switches);
  const entries = KLU.macModel.getEntriesForVlan(switches, vlanId, graph);

  const rows = entries.map(e => `
    <tr>
      <td>${KLU.dom.escapeHtml(e.hostname)}</td>
      <td>${KLU.dom.escapeHtml(e.port)}</td>
      <td><code>${KLU.dom.escapeHtml(e.macAddress)}</code></td>
    </tr>
  `).join('');

  panel.innerHTML = `
    <div class="panel-body-toolbar"><strong>VLAN ${vlanId}</strong><button class="mac-csv-export">CSV exportieren</button></div>
    <p class="hint">Uplinks zwischen Switches und VLAN-Interface-eigene MACs sind ausgeblendet.</p>
    ${entries.length
      ? `<table class="vlan-table"><thead><tr><th>Switch</th><th>Port</th><th>MAC-Adresse</th></tr></thead><tbody>${rows}</tbody></table>`
      : '<p class="hint">Keine passenden MAC-Adressen gefunden.</p>'}
  `;
}

KLU.views.macDetail = {
  init() {
    KLU.on('vlan:selected', renderMacDetail);
    KLU.on('switches:changed', renderMacDetail);

    document.getElementById('mac-detail-panel')?.addEventListener('click', e => {
      if (!e.target.closest('.mac-csv-export')) return;
      const vlanId = KLU.state.selectedVlan;
      if (vlanId == null) return;
      const switches = KLU.state.getSwitches();
      const graph = KLU.topology.buildGraph(switches);
      const entries = KLU.macModel.getEntriesForVlan(switches, vlanId, graph);
      const csv = KLU.csvExport.toCsv(['Switch', 'Port', 'MAC-Adresse'], entries.map(en => [en.hostname, en.port, en.macAddress]));
      KLU.csvExport.download(`mac-vlan-${vlanId}.csv`, csv);
    });

    renderMacDetail();
  }
};
