// L2-L3 Kommunikationsmatrix — Parser für "show interfaces trunk" (Catalyst) / "show interface trunk"
// (Nexus). Beide haben mehrere Tabellen-Abschnitte hintereinander, je mit eigener "Port ..."-
// Kopfzeile. Uns interessieren nur zwei: die Status/Native-VLAN-Tabelle und die "Vlans allowed
// on trunk"-Tabelle — andere Abschnitte (aktiv im Management-Domain, STP-Forwarding) ignorieren
// wir bewusst, die App wertet nur Native-VLAN-Mismatch + zur Anzeige die erlaubten VLANs aus.
KLU.parsers = KLU.parsers || {};

const TRUNK_SECTION_HEADER_RE = /^Port\b/i;
const TRUNK_STATUS_STATUS_TOKEN_RE = /^(trunking|down|not-trunking|err-disabled)$/i;

function getTrunkEntry(byPort, port) {
  if (!byPort.has(port)) byPort.set(port, { port, nativeVlan: null, status: null, allowedVlansRaw: '' });
  return byPort.get(port);
}

function appendAllowedVlans(entry, str) {
  const trimmed = str.trim();
  if (!trimmed || /^none$/i.test(trimmed)) return;
  entry.allowedVlansRaw = entry.allowedVlansRaw ? `${entry.allowedVlansRaw},${trimmed}` : trimmed;
}

/**
 * @param {string} text Block-Text von "show interfaces trunk" / "show interface trunk"
 * @returns {Array<{ port: string, nativeVlan: number|null, status: string|null, allowedVlansRaw: string }>}
 */
KLU.parsers.parseInterfacesTrunk = function (text) {
  const byPort = new Map();
  let section = null; // 'status' | 'allowed' | null (andere Abschnitte werden übersprungen)
  let lastAllowedPort = null;

  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;

    if (TRUNK_SECTION_HEADER_RE.test(line)) {
      if (/Native/i.test(line) && /Status/i.test(line)) section = 'status';
      else if (/Vlans allowed on trunk/i.test(line)) section = 'allowed';
      else section = null;
      lastAllowedPort = null;
      continue;
    }
    if (!section) continue;

    if (section === 'status') {
      // Spaltenreihenfolge unterscheidet sich zwischen den Plattformen: Catalyst hat "... Status
      // Native vlan" (Native-VLAN NACH dem Status-Wort, am Zeilenende), Nexus hat "Port Native
      // Vlan Status Port-Channel" (Native-VLAN VOR dem Status-Wort). Deshalb wird das Native-VLAN
      // relativ zum Status-Token gesucht, nicht per fester Tokenposition.
      const tokens = line.split(/\s+/);
      const statusIdx = tokens.findIndex(t => TRUNK_STATUS_STATUS_TOKEN_RE.test(t));
      if (statusIdx === -1) continue; // z.B. die "Vlan / Channel"-Fortsetzung der Nexus-Kopfzeile
      let nativeVlan = null;
      if (/^\d+$/.test(tokens[statusIdx + 1] || '')) nativeVlan = parseInt(tokens[statusIdx + 1], 10);
      else if (statusIdx > 0 && /^\d+$/.test(tokens[statusIdx - 1] || '')) nativeVlan = parseInt(tokens[statusIdx - 1], 10);
      if (nativeVlan == null) continue;
      const entry = getTrunkEntry(byPort, tokens[0]);
      entry.nativeVlan = nativeVlan;
      entry.status = tokens[statusIdx].toLowerCase();
    } else if (section === 'allowed') {
      const m = /^(\S+)\s+(.+)$/.exec(line);
      if (m && !/^[\d,\s-]+$/.test(m[1])) {
        // Zeile beginnt mit einem Port-Namen -> neuer Eintrag
        lastAllowedPort = m[1];
        appendAllowedVlans(getTrunkEntry(byPort, lastAllowedPort), m[2]);
      } else if (lastAllowedPort) {
        // Fortsetzungszeile einer zu langen VLAN-Liste (kein Port-Präfix)
        appendAllowedVlans(getTrunkEntry(byPort, lastAllowedPort), line);
      }
    }
  }

  return Array.from(byPort.values());
};
