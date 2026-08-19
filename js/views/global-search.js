// L2-L3 Kommunikationsmatrix — Globale Suche (Feature 5 der Erweiterung): MAC/IP/Hostname eingeben ->
// direkt zeigen, auf welchem Switch/Port/VLAN das auftaucht. IP-Suche prüft zuerst die
// VLAN-Interface-IPs (SVIs), danach ARP-Einträge (Endgeräte) und löst deren MAC zusätzlich über
// die MAC-Tabelle zu Switch/Port/VLAN auf.
KLU.views = KLU.views || {};

function normalizeMacForSearch(str) {
  return str.replace(/[^0-9a-fA-F]/g, '').toLowerCase();
}

// nodeId je Treffer = die Topologie-Knoten-ID des SWITCHES, auf dem der Treffer gefunden wurde
// (nicht des ggf. gemeinten Endgeräts/Nachbarn) — reicht, um per Klick in die Topologie zu
// springen und dessen Nachbarschaft zu zeigen (siehe js/views/topology.js, selectSwitchFocus).
function searchByMac(switches, needle) {
  const results = [];
  for (const sw of switches) {
    for (const entry of sw.parsed?.macTable || []) {
      if (normalizeMacForSearch(entry.macAddress).includes(needle)) {
        results.push({ type: 'MAC', hostname: KLU.anonymize.hostname(sw.hostname), nodeId: sw.id, detail: `VLAN ${entry.vlanId}, Port ${entry.port}, ${KLU.anonymize.mac(entry.macAddress)}` });
      }
    }
  }
  return results;
}

function searchByIp(switches, query) {
  const results = [];
  for (const sw of switches) {
    for (const ib of sw.parsed?.ipInterfaceBrief || []) {
      if (ib.ipAddress === query) results.push({ type: 'IP (VLAN-Interface)', hostname: KLU.anonymize.hostname(sw.hostname), nodeId: sw.id, detail: `${ib.interface}, ${KLU.anonymize.ip(ib.ipAddress)}` });
    }
    for (const arp of sw.parsed?.arpEntries || []) {
      if (arp.ipAddress !== query) continue;
      const macEntry = sw.parsed?.macTable?.find(m => m.macAddress === arp.macAddress);
      const anonMac = KLU.anonymize.mac(arp.macAddress);
      results.push({
        type: 'IP (via ARP)',
        hostname: KLU.anonymize.hostname(sw.hostname),
        nodeId: sw.id,
        detail: macEntry ? `${anonMac}, VLAN ${macEntry.vlanId}, Port ${macEntry.port}` : `${anonMac}, Interface ${arp.interface}`
      });
    }
  }
  return results;
}

function searchByHostname(switches, query) {
  const needle = query.toLowerCase();
  const results = [];
  for (const sw of switches) {
    if (sw.hostname.toLowerCase().includes(needle)) results.push({ type: 'Switch', hostname: KLU.anonymize.hostname(sw.hostname), nodeId: sw.id, detail: `${sw.platform}, ${sw.model || '–'}` });
    for (const nb of sw.parsed?.cdpNeighbors || []) {
      if ((nb.neighborDeviceId || '').toLowerCase().includes(needle)) {
        results.push({ type: 'CDP-Nachbar', hostname: KLU.anonymize.hostname(sw.hostname), nodeId: sw.id, detail: `${KLU.anonymize.hostname(nb.neighborDeviceId)} an ${nb.localPort}` });
      }
    }
  }
  return results;
}

function runSearch(query) {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const switches = KLU.state.getSwitches();
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(trimmed)) return searchByIp(switches, trimmed);

  // MAC- und Hostname-Suche zusammen ausführen statt exklusiv zu verzweigen: ein Hostname, der
  // zufällig nur aus Hex-Zeichen besteht (z.B. "CAFE99"), würde sonst fälschlich als reine
  // MAC-Suche behandelt und ergäbe "keine Treffer", obwohl der Switch existiert.
  const macNeedle = normalizeMacForSearch(trimmed);
  const results = [];
  if (macNeedle.length >= 6 && /^[0-9a-f.:-]+$/i.test(trimmed)) results.push(...searchByMac(switches, macNeedle));
  results.push(...searchByHostname(switches, trimmed));
  return results;
}

function renderSearchResults(results, query) {
  const box = document.getElementById('global-search-results');
  if (!box) return;
  if (!query.trim()) { box.innerHTML = ''; box.classList.remove('open'); return; }
  box.classList.add('open');
  box.innerHTML = results.length
    ? results.map(r => `<div class="global-search-result" data-node-id="${KLU.dom.escapeHtml(r.nodeId)}"><span class="badge badge-neutral">${KLU.dom.escapeHtml(r.type)}</span> <strong>${KLU.dom.escapeHtml(r.hostname)}</strong> — ${KLU.dom.escapeHtml(r.detail)}</div>`).join('')
    : '<p class="hint">Keine Treffer.</p>';
}

// Klick auf einen Treffer springt in die Topologie-Ansicht und fokussiert den betroffenen Switch
// (Detail-Panel + Nachbarschafts-Hervorhebung, siehe js/views/topology.js) — Teil der
// dora-the-explorer-Portierung ("Suche uebernehmen").
function focusResultNode(nodeId) {
  if (!nodeId) return;
  document.querySelector('.view-tab[data-view="network"]')?.click();
  KLU.state.selectSwitchFocus(nodeId);
  document.getElementById('global-search-results')?.classList.remove('open');
}

KLU.views.globalSearch = {
  init() {
    const input = document.getElementById('global-search-input');
    input?.addEventListener('input', () => renderSearchResults(runSearch(input.value), input.value));
    // Bereits angezeigte Treffer neu rendern, falls sich z.B. der Anonymisierungs-Status ändert,
    // während ein Suchergebnis offen ist (sonst blieben die alten, unanonymisierten Werte stehen).
    KLU.on('switches:changed', () => {
      if (input?.value.trim()) renderSearchResults(runSearch(input.value), input.value);
    });
    document.getElementById('global-search-results')?.addEventListener('click', e => {
      const row = e.target.closest('.global-search-result');
      if (row) focusResultNode(row.dataset.nodeId);
    });
    document.addEventListener('click', e => {
      if (e.target.closest('.global-search')) return;
      document.getElementById('global-search-results')?.classList.remove('open');
    });
  }
};
