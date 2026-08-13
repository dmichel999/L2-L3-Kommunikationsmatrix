// Kunden LAN Überblick — Trunk-Panel (Feature 6 der Erweiterung): Native-VLAN-Mismatch-Warnungen
// zwischen bekannten Trunk-Links, Erweiterung der VLAN-Tabellen-Ansicht.
KLU.views = KLU.views || {};

function hostnameOfSwitch(id) {
  return KLU.state.switches.get(id)?.hostname || id;
}

function renderTrunkPanel() {
  const panel = document.getElementById('trunk-panel');
  if (!panel) return;
  const switches = KLU.state.getSwitches();

  if (switches.length === 0) {
    panel.innerHTML = '';
    return;
  }

  const graph = KLU.topology.buildGraph(switches);
  const { mismatches } = KLU.trunkModel.build(switches, graph);

  if (mismatches.length === 0) {
    panel.innerHTML = '<p class="hint">Keine Native-VLAN-Mismatches zwischen bekannten Trunk-Links gefunden.</p>';
    return;
  }

  panel.innerHTML = mismatches.map(m => `
    <div class="error-line">
      <strong>${KLU.dom.escapeHtml(hostnameOfSwitch(m.aSwitch))}</strong> (${KLU.dom.escapeHtml(m.aPort)}, Native VLAN ${m.aNative})
      ↔ <strong>${KLU.dom.escapeHtml(hostnameOfSwitch(m.bSwitch))}</strong> (${KLU.dom.escapeHtml(m.bPort)}, Native VLAN ${m.bNative})
    </div>
  `).join('');
}

KLU.views.trunkPanel = {
  init() {
    KLU.on('switches:changed', renderTrunkPanel);
    renderTrunkPanel();
  }
};
