// L2-L3 Kommunikationsmatrix — Port-Channel-Übersicht je Switch: zeigt, auf welchem Switch/Port
// ein Port-Channel konfiguriert ist und ob er laut CDP/LLDP zu einem anderen bekannten Switch
// führt (= als Uplink von MAC-Ansicht/Duplicate-Erkennung ausgeschlossen wird, siehe
// js/core/mac-model.js) — hilft nachzuvollziehen, warum eine über einen Port-Channel gelernte
// MAC-Adresse (fälschlich) als lokales Endgerät erscheint, wenn z.B. das Kommando für den
// betroffenen Switch fehlt (siehe Feature 15, Warn-Hover).
KLU.portChannelModel = {};

/**
 * @param {Array} switches KLU.state.getSwitches()-Format, erwartet sw.parsed.portChannels
 * @param {{ nodes: Array, edgesIndividual: Array }} graph KLU.topology.buildGraph(switches)
 * @returns {Array<{ switchId: string, hostname: string, portChannelId: string, members: string[],
 *   isUplink: boolean, neighborHostnames: string[] }>}
 */
KLU.portChannelModel.build = function (switches, graph) {
  const switchIds = new Set(graph.nodes.filter(n => n.deviceType === 'switch').map(n => n.id));
  const hostnameById = new Map(graph.nodes.map(n => [n.id, n.hostname]));

  // normalizedPort -> Nachbar-Switch-ID, je Switch (nur physische Switch-zu-Switch-Links aus CDP/LLDP)
  const neighborByPort = new Map(switches.map(sw => [sw.id, new Map()]));
  for (const e of graph.edgesIndividual) {
    if (!switchIds.has(e.a) || !switchIds.has(e.b)) continue;
    neighborByPort.get(e.a)?.set(KLU.parsers.normalizePort(e.aPort), e.b);
    neighborByPort.get(e.b)?.set(KLU.parsers.normalizePort(e.bPort), e.a);
  }

  const rows = [];
  for (const sw of switches) {
    const portMap = neighborByPort.get(sw.id) || new Map();
    for (const pc of sw.parsed?.portChannels || []) {
      // Ein Bündel kann auf MEHRERE unterschiedliche Nachbarn zeigen (z.B. vPC/MC-LAG: ein
      // logischer Port-Channel, dessen physische Member an zwei redundante Switches gehen, die
      // sich dem Partner gegenüber als ein logisches Gerät verhalten) — das ist kein
      // Dateninkonsistenz-Fall, sondern ein legitimes, verbreitetes Redundanz-Design. Jeder
      // gefundene Nachbar zählt daher gleichwertig als Uplink.
      const neighborIds = new Set(pc.members.map(m => portMap.get(KLU.parsers.normalizePort(m))).filter(Boolean));
      rows.push({
        switchId: sw.id,
        hostname: sw.hostname,
        portChannelId: pc.portChannelId,
        members: pc.members,
        isUplink: neighborIds.size > 0,
        neighborHostnames: Array.from(neighborIds).map(id => hostnameById.get(id))
      });
    }
  }

  return rows;
};
