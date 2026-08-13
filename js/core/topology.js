// Kunden LAN Überblick — Topologie-Graph aus CDP-Nachbarschaften + Port-Channel-Zuordnung
// aller importierten Switches. Liefert Knoten + Kanten in aggregierter und einzelner Form.
KLU.topology = {};

function stripDeviceIdSuffix(deviceId) {
  return deviceId
    .replace(/\([^)]*\)\s*$/, '') // Serial in Klammern (Nexus) entfernen
    .split('.')[0]; // Domain-Suffix entfernen
}

function normalizeDeviceKey(deviceId) {
  return stripDeviceIdSuffix(deviceId).trim().toLowerCase();
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

// Nicht importierte CDP-Nachbarn (Firewall/WLC/AP/...) anhand des (evtl. abgeschnittenen)
// Platform-Strings grob klassifizieren. "unknown" fängt alles ab, was keinem Muster entspricht,
// statt den Nachbarn stillschweigend zu verwerfen.
KLU.topology.inferDeviceType = function (platformStr) {
  const p = (platformStr || '').toLowerCase();
  if (/asa|firepower|fortigate|palo alto|checkpoint|firewall/.test(p)) return 'firewall';
  // Reihenfolge wichtig: C9800 ist ein IOS-XE-WLC (kein AireOS "AIR-CT"), aber "c98" würde sonst
  // vom generischen Switch-Modell-Muster weiter unten fälschlich als Switch erkannt.
  if (/air-ct|c9800|wlc|wireless lan controller/.test(p)) return 'wlc';
  if (/air-ap|meraki mr|access point|^ap\b/.test(p)) return 'ap';
  // Nicht importierter Nachbar, der selbst offensichtlich ein Switch ist (z.B. das
  // CDP-Gegenstück eines Nexus/Catalyst, der nur nicht mit-importiert wurde). Der WLC-Check
  // oben greift bereits vorher, "c9800" landet also nie hier.
  if (/^ws-c|^n[3579]k|^c\d{3,4}|catalyst|nexus/.test(p)) return 'switch';
  return 'unknown';
};

/**
 * @param {Array} switches KLU.state.getSwitches()-Format, benötigt sw.parsed.cdpNeighbors + sw.parsed.portChannels
 * @returns {{ nodes: Array, edgesIndividual: Array, edgesAggregated: Array }}
 */
KLU.topology.buildGraph = function (switches) {
  const hostnameIndex = buildHostnameIndex(switches);
  const poIndexBySwitch = new Map(switches.map(sw => [sw.id, buildPortChannelIndex(sw.parsed?.portChannels)]));

  const externalNodes = new Map(); // normalizedKey -> { id, hostname, deviceType, external: true }
  const seenEdges = new Map(); // edgeKey -> { a, aPort, b, bPort }

  for (const sw of switches) {
    for (const nb of sw.parsed?.cdpNeighbors || []) {
      const normalizedKey = normalizeDeviceKey(nb.neighborDeviceId);
      let neighborId = normalizedKey ? hostnameIndex.get(normalizedKey) : undefined;

      if (!neighborId) {
        // Nicht importierter Nachbar (Firewall/WLC/AP/...) -> als externen Knoten aufnehmen
        // statt ihn zu verwerfen, damit die Topologie ihn sichtbar macht. Ein leerer
        // Device-ID-Key (CDP-Zeile ohne erkannten Namen) darf NICHT über mehrere Switches
        // hinweg zusammengefasst werden, sonst verschmelzen unterschiedliche unbekannte
        // Nachbarn zu einem einzigen Knoten -> Key wird dann pro Switch+Port eindeutig gemacht.
        const dedupeKey = normalizedKey || `blank:${sw.id}:${nb.localPort}`;
        if (!externalNodes.has(dedupeKey)) {
          externalNodes.set(dedupeKey, {
            id: `ext:${dedupeKey}`,
            hostname: stripDeviceIdSuffix(nb.neighborDeviceId) || '(unbekannt)',
            deviceType: KLU.topology.inferDeviceType(nb.neighborPlatform),
            external: true
          });
        }
        neighborId = externalNodes.get(dedupeKey).id;
      }

      if (neighborId === sw.id) continue; // Selbstreferenz
      const edgeKeyStr = edgeKey(sw.id, nb.localPort, neighborId, nb.neighborPort);
      if (!seenEdges.has(edgeKeyStr)) {
        seenEdges.set(edgeKeyStr, { a: sw.id, aPort: nb.localPort, b: neighborId, bPort: nb.neighborPort });
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

  const nodes = switches
    .map(sw => ({ id: sw.id, hostname: sw.hostname, deviceType: 'switch', platform: sw.platform }))
    .concat(Array.from(externalNodes.values()));

  return { nodes, edgesIndividual, edgesAggregated };
};
