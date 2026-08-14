// L2-L3 Kommunikationsmatrix — VLAN-Tabelle: VLAN-ID/Name, IP-Netz(e) je SVI-Switch. "Switches mit
// VLAN" ist nicht als eigene Spalte sichtbar (bewusst entfernt, Platzgrund) — bleibt aber im
// CSV-Export enthalten und ist über Klick auf ein IP-Netz weiterhin abrufbar (Feature 4).
KLU.views = KLU.views || {};

function hostnameOf(switchId) {
  const hostname = KLU.state.switches.get(switchId)?.hostname || switchId;
  return KLU.anonymize.hostname(hostname);
}

function renderNetworkCell(vlanId, networks) {
  if (!networks.length) return '<span class="hint">–</span>';
  return networks.map(n => {
    // Klick-Key bleibt der ECHTE CIDR-Wert (State-Lookup/network-detail.js parst ihn zurück),
    // nur die sichtbare Textdarstellung wird anonymisiert.
    const key = `${vlanId}|${n.cidr}`;
    const selected = KLU.state.selectedNetwork === key;
    const maskHint = n.maskKnown ? '' : ' <span class="hint" title="Keine connected Route gefunden, Maske unbekannt">(Maske?)</span>';
    return `<div class="vlan-network${selected ? ' selected' : ''}" data-network-key="${KLU.dom.escapeHtml(key)}"><code>${KLU.dom.escapeHtml(KLU.anonymize.ip(n.cidr))}</code>${maskHint}</div>`;
  }).join('');
}

function buildVlanCsvRows(vlans) {
  const rows = [];
  for (const v of vlans) {
    const switchNames = v.switchesWithVlan.map(hostnameOf).join(', ');
    if (v.networks.length === 0) {
      rows.push([v.vlanId, v.name || '', '', '', switchNames]);
      continue;
    }
    for (const n of v.networks) rows.push([v.vlanId, v.name || '', KLU.anonymize.ip(n.cidr), n.maskKnown ? 'ja' : 'nein', switchNames]);
  }
  return rows;
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
    </tr>
  `).join('');

  wrapper.innerHTML = `
    <table class="vlan-table">
      <thead>
        <tr><th>VLAN</th><th>Name</th><th>IP-Netz</th></tr>
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

    document.getElementById('vlan-csv-export')?.addEventListener('click', () => {
      const vlans = KLU.vlanModel.build(KLU.state.getSwitches());
      const csv = KLU.csvExport.toCsv(['VLAN', 'Name', 'IP-Netz', 'Maske bekannt', 'Switches'], buildVlanCsvRows(vlans));
      KLU.csvExport.download('vlan-tabelle.csv', csv);
    });

    KLU.on('switches:changed', renderVlanTable);
    KLU.on('view:changed', view => { if (view === 'network') renderVlanTable(); });
    KLU.on('vlan:selected', renderVlanTable);
    KLU.on('network:selected', renderVlanTable);
    renderVlanTable();
  }
};
