// L2-L3 Kommunikationsmatrix — Duplicate-Panel: doppelte MAC-Adressen + IP-Konflikte.
KLU.views = KLU.views || {};

function hostnameOfSwitchForDup(id) {
  return KLU.anonymize.hostname(KLU.state.switches.get(id)?.hostname || id);
}

function renderDuplicatePanel() {
  const panel = document.getElementById('duplicate-panel');
  if (!panel) return;
  const switches = KLU.state.getSwitches();

  if (switches.length === 0) {
    panel.innerHTML = '';
    return;
  }

  const graph = KLU.topology.buildGraph(switches);
  const { duplicateMacs, duplicateIps } = KLU.duplicateModel.build(switches, graph);

  if (duplicateMacs.length === 0 && duplicateIps.length === 0) {
    panel.innerHTML = '<p class="hint">Keine doppelten MAC-Adressen oder IP-Konflikte gefunden.</p>';
    return;
  }

  const macRows = duplicateMacs.map(d => `
    <div class="error-line">
      VLAN ${d.vlanId}, <code>${KLU.dom.escapeHtml(KLU.anonymize.mac(d.macAddress))}</code> gleichzeitig auf:
      ${d.occurrences.map(o => `${KLU.dom.escapeHtml(hostnameOfSwitchForDup(o.switchId))}/${KLU.dom.escapeHtml(o.port)}`).join(', ')}
    </div>
  `).join('');

  const ipRows = duplicateIps.map(d => `
    <div class="error-line">
      IP <code>${KLU.dom.escapeHtml(KLU.anonymize.ip(d.ipAddress))}</code> mit unterschiedlichen MAC-Adressen:
      ${d.macAddresses.map(m => `${KLU.dom.escapeHtml(KLU.anonymize.mac(m.mac))} (${m.switchIds.map(hostnameOfSwitchForDup).map(KLU.dom.escapeHtml).join(', ')})`).join(' | ')}
    </div>
  `).join('');

  panel.innerHTML = `${macRows}${ipRows}`;
}

KLU.views.duplicatePanel = {
  init() {
    KLU.on('switches:changed', renderDuplicatePanel);
    renderDuplicatePanel();
  }
};
