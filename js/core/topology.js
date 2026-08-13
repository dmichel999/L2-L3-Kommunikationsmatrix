// Kunden LAN Überblick — Topologie-Graph aus CDP-Nachbarschaften + Port-Channel-Zuordnung
// aller importierten Switches. Liefert Knoten + Kanten in aggregierter und einzelner Form.
KLU.topology = {};

function normalizeDeviceKey(deviceId) {
  return deviceId
    .replace(/\([^)]*\)\s*$/, '') // Serial in Klammern (Nexus) entfernen
    .split('.')[0] // Domain-Suffix entfernen
    .trim()
    .toLowerCase();
}

function buildHostnameIndex(switches) {
  const index = new Map();
  for (const sw of switches) {
    if (sw.hostname) index.set(normalizeDeviceKey(sw.hostname), sw.id);
  }
  return index;
}

// Port -> Port-Channel-ID für einen Switch, aus den geparsten Port-Channel-Summaries.
// Key normalisiert, da CDP ("Gig 1/0/1") und Etherchannel-Summary ("Gi1/0/1") für dieselbe
// Schnittstelle unterschiedliche Abkürzungsstile verwenden.
function buildPortChannelIndex(portChannels) {
  const index = new Map();
  for (const pc of portChannels || []) {
    for (const port of pc.members) index.set(KLU.parsers.normalizePort(port), pc.portChannelId);
  }
  return index;
}

function edgeKey(aId, aPort, bId, bPort) {
  return [`${aId}:${aPort}`, `${bId}:${bPort}`].sort().join('|');
}

/**
 * @param {Array} switches KLU.state.getSwitches()-Format, benötigt sw.parsed.cdpNeighbors + sw.parsed.portChannels
 * @returns {{ nodes: Array, edgesIndividual: Array, edgesAggregated: Array }}
 */
KLU.topology.buildGraph = function (switches) {
  const hostnameIndex = buildHostnameIndex(switches);
  const poIndexBySwitch = new Map(switches.map(sw => [sw.id, buildPortChannelIndex(sw.parsed?.portChannels)]));

  const seenEdges = new Map(); // edgeKey -> { a, aPort, b, bPort }
  for (const sw of switches) {
    for (const nb of sw.parsed?.cdpNeighbors || []) {
      const neighborId = hostnameIndex.get(normalizeDeviceKey(nb.neighborDeviceId));
      if (!neighborId || neighborId === sw.id) continue; // unbekannter Nachbar oder Selbstreferenz
      const key = edgeKey(sw.id, nb.localPort, neighborId, nb.neighborPort);
      if (!seenEdges.has(key)) {
        seenEdges.set(key, { a: sw.id, aPort: nb.localPort, b: neighborId, bPort: nb.neighborPort });
      }
    }
  }

  const edgesIndividual = Array.from(seenEdges.values()).map((e, i) => ({ id: `e${i}`, ...e }));

  // Aggregation: Kanten gruppieren, deren beide Enden zum selben Switch-Paar + (falls vorhanden)
  // derselben Port-Channel-ID auf beiden Seiten gehören.
  const groups = new Map();
  for (const e of edgesIndividual) {
    const poA = poIndexBySwitch.get(e.a)?.get(KLU.parsers.normalizePort(e.aPort)) || e.aPort;
    const poB = poIndexBySwitch.get(e.b)?.get(KLU.parsers.normalizePort(e.bPort)) || e.bPort;
    const groupKey = [`${e.a}:${poA}`, `${e.b}:${poB}`].sort().join('|');
    if (!groups.has(groupKey)) {
      const poLabelA = poA !== e.aPort ? poA : null;
      const poLabelB = poB !== e.bPort ? poB : null;
      groups.set(groupKey, { a: e.a, b: e.b, poLabelA, poLabelB, members: [] });
    }
    groups.get(groupKey).members.push({ aPort: e.aPort, bPort: e.bPort });
  }
  const edgesAggregated = Array.from(groups.values()).map((g, i) => ({ id: `agg${i}`, ...g }));

  const nodes = switches.map(sw => ({ id: sw.id, hostname: sw.hostname, platform: sw.platform }));

  return { nodes, edgesIndividual, edgesAggregated };
};
