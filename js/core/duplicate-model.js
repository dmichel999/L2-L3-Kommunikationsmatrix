// L2-L3 Kommunikationsmatrix — Duplicate-Erkennung: doppelte MAC-Adressen (dieselbe MAC im
// selben VLAN gleichzeitig auf mehr als einem Nicht-Uplink-Port gelernt — Hinweis auf Loop,
// MAC-Cloning oder ein Gerät mit zwei aktiven Anschlüssen) und doppelte IPs (dieselbe IP laut
// ARP mit unterschiedlichen MAC-Adressen — klassisches IP-Konflikt-Symptom). Reine Diagnose,
// keine automatische Bewertung, welcher der beiden Einträge "der richtige" ist. Nutzt
// ausschließlich bereits vorhandene macTable/arpEntries-Daten, kein neuer Parser nötig.
KLU.duplicateModel = {};

const DUP_SVI_OR_CPU_PORT_RE = /^(cpu|router|vlan\d*|sup-eth\d*|mgmt\d*)$/i;

/**
 * @param {Array} switches KLU.state.getSwitches()-Format, erwartet sw.parsed.macTable/arpEntries
 * @param {{ nodes: Array, edgesIndividual: Array }} graph KLU.topology.buildGraph(switches)
 * @returns {{ duplicateMacs: Array<{ vlanId: number, macAddress: string, occurrences: Array<{ switchId: string, port: string }> }>,
 *   duplicateIps: Array<{ ipAddress: string, macAddresses: Array<{ mac: string, switchIds: string[] }> }> }}
 */
KLU.duplicateModel.build = function (switches, graph) {
  const uplinksBySwitch = KLU.macModel.computeUplinkPortsBySwitch(switches, graph);

  const macOccurrences = new Map(); // "vlan|mac" -> [{ switchId, port }]
  for (const sw of switches) {
    const uplinkSet = uplinksBySwitch.get(sw.id) || new Set();
    for (const entry of sw.parsed?.macTable || []) {
      if (DUP_SVI_OR_CPU_PORT_RE.test(entry.port)) continue;
      if (uplinkSet.has(KLU.parsers.normalizePort(entry.port))) continue;
      const key = `${entry.vlanId}|${entry.macAddress}`;
      if (!macOccurrences.has(key)) macOccurrences.set(key, []);
      macOccurrences.get(key).push({ switchId: sw.id, port: entry.port });
    }
  }

  const duplicateMacs = Array.from(macOccurrences.entries())
    .filter(([, occ]) => new Set(occ.map(o => `${o.switchId}:${KLU.parsers.normalizePort(o.port)}`)).size > 1)
    .map(([key, occurrences]) => {
      const [vlanIdStr, macAddress] = key.split('|');
      return { vlanId: parseInt(vlanIdStr, 10), macAddress, occurrences };
    })
    .sort((a, b) => a.vlanId - b.vlanId);

  const ipToMacToSwitches = new Map(); // ip -> Map(mac -> Set(switchId))
  for (const sw of switches) {
    for (const entry of sw.parsed?.arpEntries || []) {
      if (!ipToMacToSwitches.has(entry.ipAddress)) ipToMacToSwitches.set(entry.ipAddress, new Map());
      const macs = ipToMacToSwitches.get(entry.ipAddress);
      if (!macs.has(entry.macAddress)) macs.set(entry.macAddress, new Set());
      macs.get(entry.macAddress).add(sw.id);
    }
  }

  const duplicateIps = Array.from(ipToMacToSwitches.entries())
    .filter(([, macs]) => macs.size > 1)
    .map(([ipAddress, macs]) => ({
      ipAddress,
      macAddresses: Array.from(macs.entries()).map(([mac, switchIds]) => ({ mac, switchIds: Array.from(switchIds) }))
    }));

  return { duplicateMacs, duplicateIps };
};
