// Kunden LAN Überblick — Trunk-Modell: erlaubte VLANs je Trunk-Port + Native-VLAN-Mismatch
// zwischen zwei Switches über denselben physischen Link (Link-Zuordnung wie beim bestehenden
// Uplink-Ausschluss im MAC-Modell: über den CDP-Topologie-Graph, nur Switch-zu-Switch-Kanten).
KLU.trunkModel = {};

function buildTrunkIndex(switches) {
  const index = new Map(); // switchId -> Map(normalizedPort -> trunkEntry)
  for (const sw of switches) {
    const m = new Map();
    for (const t of sw.parsed?.trunks || []) m.set(KLU.parsers.normalizePort(t.port), t);
    index.set(sw.id, m);
  }
  return index;
}

/**
 * @param {Array} switches KLU.state.getSwitches()-Format, erwartet sw.parsed.trunks
 * @param {{ nodes: Array, edgesIndividual: Array }} graph KLU.topology.buildGraph(switches)
 * @returns {{ trunkIndex: Map, mismatches: Array<{ aSwitch: string, aPort: string, aNative: number,
 *   bSwitch: string, bPort: string, bNative: number }> }}
 */
KLU.trunkModel.build = function (switches, graph) {
  const trunkIndex = buildTrunkIndex(switches);
  const switchIds = new Set(switches.map(sw => sw.id));
  const mismatches = [];

  for (const e of graph.edgesIndividual) {
    if (!switchIds.has(e.a) || !switchIds.has(e.b)) continue; // nur Switch-zu-Switch-Links

    const aTrunk = trunkIndex.get(e.a)?.get(KLU.parsers.normalizePort(e.aPort));
    const bTrunk = trunkIndex.get(e.b)?.get(KLU.parsers.normalizePort(e.bPort));
    if (!aTrunk || !bTrunk) continue; // kein Trunk-Wissen für einen der beiden Ports
    if (aTrunk.nativeVlan == null || bTrunk.nativeVlan == null) continue;
    if (aTrunk.nativeVlan === bTrunk.nativeVlan) continue;

    mismatches.push({
      aSwitch: e.a, aPort: e.aPort, aNative: aTrunk.nativeVlan,
      bSwitch: e.b, bPort: e.bPort, bNative: bTrunk.nativeVlan
    });
  }

  return { trunkIndex, mismatches };
};
