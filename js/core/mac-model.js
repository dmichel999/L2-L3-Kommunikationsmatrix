// Kunden LAN Überblick — MAC-Modell: MAC-Adressen je VLAN, ohne Uplinks zwischen Switches
// und ohne die MAC-Adresse der VLAN-Interfaces (SVI) selbst.
KLU.macModel = {};

const SVI_OR_CPU_PORT_RE = /^(cpu|router|vlan\d*|sup-eth\d*|mgmt\d*)$/i;

// Ports, die laut Topologie-Graph zu einem anderen bekannten Switch führen — inkl. aller
// Port-Channel-Mitglieder, falls auch nur einer davon als Uplink erkannt wurde.
function computeUplinkPortsBySwitch(switches, graph) {
  const uplinks = new Map(switches.map(sw => [sw.id, new Set()]));

  for (const e of graph.edgesIndividual) {
    uplinks.get(e.a)?.add(KLU.parsers.normalizePort(e.aPort));
    uplinks.get(e.b)?.add(KLU.parsers.normalizePort(e.bPort));
  }

  for (const sw of switches) {
    const set = uplinks.get(sw.id);
    for (const pc of sw.parsed?.portChannels || []) {
      const normalized = pc.members.map(KLU.parsers.normalizePort);
      if (normalized.some(p => set.has(p))) normalized.forEach(p => set.add(p));
    }
  }

  return uplinks;
}

/**
 * @param {Array} switches KLU.state.getSwitches()-Format, erwartet sw.parsed.macTable
 * @param {number} vlanId
 * @param {{ edgesIndividual: Array }} graph KLU.topology.buildGraph(switches)
 * @returns {Array<{ switchId: string, hostname: string, port: string, macAddress: string }>}
 */
KLU.macModel.getEntriesForVlan = function (switches, vlanId, graph) {
  const uplinksBySwitch = computeUplinkPortsBySwitch(switches, graph);
  const result = [];

  for (const sw of switches) {
    const uplinkSet = uplinksBySwitch.get(sw.id) || new Set();
    for (const entry of sw.parsed?.macTable || []) {
      if (entry.vlanId !== vlanId) continue;
      if (SVI_OR_CPU_PORT_RE.test(entry.port)) continue;
      if (uplinkSet.has(KLU.parsers.normalizePort(entry.port))) continue;
      result.push({ switchId: sw.id, hostname: sw.hostname, port: entry.port, macAddress: entry.macAddress });
    }
  }

  return result;
};
