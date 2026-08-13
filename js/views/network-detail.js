// Kunden LAN Überblick — IP-Netz-Ansicht für das ausgewählte Netz (Feature 4):
// zeigt, auf welchem/welchen Switch(es) das VLAN-Interface für dieses Netz konfiguriert ist.
KLU.views = KLU.views || {};

function renderNetworkDetail() {
  const panel = document.getElementById('network-detail-panel');
  if (!panel) return;

  const key = KLU.state.selectedNetwork;
  if (!key) {
    panel.innerHTML = '<p class="hint">Klicke auf ein IP-Netz, um zu sehen, auf welchem Switch das VLAN-Interface liegt.</p>';
    return;
  }

  const [vlanIdStr, cidr] = key.split('|');
  const vlanId = parseInt(vlanIdStr, 10);
  const vlans = KLU.vlanModel.build(KLU.state.getSwitches());
  const vlan = vlans.find(v => v.vlanId === vlanId);
  const network = vlan?.networks.find(n => n.cidr === cidr);

  if (!vlan || !network) {
    panel.innerHTML = '<p class="hint">Dieses Netz ist nicht mehr vorhanden.</p>';
    return;
  }

  const switchNames = network.switches
    .map(id => KLU.state.switches.get(id)?.hostname || id)
    .map(KLU.dom.escapeHtml)
    .join(', ');
  const maskHint = network.maskKnown
    ? ''
    : ' <span class="hint">(Maske nicht gesichert — keine passende connected Route gefunden, nur aus "show ip interface brief")</span>';

  panel.innerHTML = `
    <h3>VLAN-Interface für ${KLU.dom.escapeHtml(cidr)}</h3>
    <p class="hint">VLAN ${vlan.vlanId} (${KLU.dom.escapeHtml(vlan.name) || '–'})</p>
    <p>SVI auf: <strong>${switchNames}</strong>${maskHint}</p>
  `;
}

KLU.views.networkDetail = {
  init() {
    KLU.on('network:selected', renderNetworkDetail);
    KLU.on('switches:changed', renderNetworkDetail);
    renderNetworkDetail();
  }
};
