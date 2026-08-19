// L2-L3 Kommunikationsmatrix — Port-Channel-Panel: Übersicht, auf welchem Switch/Port ein
// Port-Channel konfiguriert ist und ob er als Uplink zu einem anderen Switch erkannt wird.
KLU.views = KLU.views || {};

function hostnameOfSwitchForPortChannel(id) {
  return KLU.anonymize.hostname(KLU.state.switches.get(id)?.hostname || id);
}

function renderPortChannelPanel() {
  const panel = document.getElementById('portchannel-panel');
  if (!panel) return;
  const switches = KLU.state.getSwitches();

  if (switches.length === 0) {
    panel.innerHTML = '';
    return;
  }

  const graph = KLU.topology.buildGraph(switches);
  const rows = KLU.portChannelModel.build(switches, graph);

  if (rows.length === 0) {
    panel.innerHTML = '<p class="hint">Keine Port-Channels in den importierten Switches gefunden.</p>';
    return;
  }

  const tableRows = rows.map(r => `
    <tr>
      <td>${KLU.dom.escapeHtml(hostnameOfSwitchForPortChannel(r.switchId))}</td>
      <td>${KLU.dom.escapeHtml(r.portChannelId)}</td>
      <td>${r.members.map(m => KLU.dom.escapeHtml(m)).join(', ') || '<span class="hint">–</span>'}</td>
      <td>${r.isUplink
        ? `✓ zu ${r.neighborHostnames.map(h => KLU.dom.escapeHtml(KLU.anonymize.hostname(h))).join(', ')}`
        : '<span class="hint">–</span>'}</td>
    </tr>
  `).join('');

  panel.innerHTML = `
    <p class="hint">"Uplink zu" = laut CDP/LLDP führt mind. ein Member-Port zu einem anderen importierten Switch (dann von MAC-Ansicht/Duplicate-Erkennung ausgeschlossen).</p>
    <table class="vlan-table">
      <thead><tr><th>Switch</th><th>Port-Channel</th><th>Mitglieds-Ports</th><th>Uplink</th></tr></thead>
      <tbody>${tableRows}</tbody>
    </table>
  `;
}

KLU.views.portChannelPanel = {
  init() {
    KLU.on('switches:changed', renderPortChannelPanel);
    renderPortChannelPanel();
  }
};
