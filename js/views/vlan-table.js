// Kunden LAN Überblick — VLAN-Tabelle: VLAN-ID/Name, IP-Netz(e) je SVI-Switch, Switches mit VLAN
KLU.views = KLU.views || {};

function hostnameOf(switchId) {
  return KLU.state.switches.get(switchId)?.hostname || switchId;
}

function renderNetworkCell(vlanId, networks) {
  if (!networks.length) return '<span class="hint">–</span>';
  return networks.map(n => {
    const key = `${vlanId}|${n.cidr}`;
    const selected = KLU.state.selectedNetwork === key;
    const maskHint = n.maskKnown ? '' : ' <span class="hint" title="Keine connected Route gefunden, Maske unbekannt">(Maske?)</span>';
    return `<div class="vlan-network${selected ? ' selected' : ''}" data-network-key="${KLU.dom.escapeHtml(key)}"><code>${KLU.dom.escapeHtml(n.cidr)}</code>${maskHint}</div>`;
  }).join('');
}

function renderVlanTable() {
  const wrapper = document.getElementById('vlan-table-wrapper');
  if (!wrapper) return;

  const vlans = KLU.vlanModel.build(KLU.state.getSwitches());

  if (vlans.length === 0) {
    wrapper.innerHTML = '<p class="hint">Noch keine Switches importiert.</p>';
    return;
  }

  const rows = vlans.map(v => `
    <tr class="vlan-row${KLU.state.selectedVlan === v.vlanId ? ' selected' : ''}" data-vlan-id="${v.vlanId}">
      <td>${v.vlanId}</td>
      <td>${KLU.dom.escapeHtml(v.name) || '<span class="hint">–</span>'}</td>
      <td>${renderNetworkCell(v.vlanId, v.networks)}</td>
      <td>${v.switchesWithVlan.map(hostnameOf).map(KLU.dom.escapeHtml).join(', ')}</td>
    </tr>
  `).join('');

  wrapper.innerHTML = `
    <table class="vlan-table">
      <thead>
        <tr><th>VLAN</th><th>Name</th><th>IP-Netz</th><th>Switches mit VLAN</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

KLU.views.vlanTable = {
  init() {
    const wrapper = document.getElementById('vlan-table-wrapper');
    wrapper?.addEventListener('click', e => {
      const networkEl = e.target.closest('.vlan-network');
      if (networkEl) {
        e.stopPropagation(); // eigenständiger Klick-Ziel, soll die VLAN-Zeilen-Auswahl nicht mit umschalten
        KLU.state.selectNetwork(networkEl.dataset.networkKey);
        return;
      }
      const row = e.target.closest('.vlan-row');
      if (row) KLU.state.selectVlan(parseInt(row.dataset.vlanId, 10));
    });

    KLU.on('switches:changed', renderVlanTable);
    KLU.on('view:changed', view => { if (view === 'vlans') renderVlanTable(); });
    KLU.on('vlan:selected', renderVlanTable);
    KLU.on('network:selected', renderVlanTable);
    renderVlanTable();
  }
};
