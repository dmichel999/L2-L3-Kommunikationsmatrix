// L2-L3 Kommunikationsmatrix — Parser für "show cdp neighbor" (Catalyst + Nexus)
// Fixed-width Spaltenparser, da Device-ID bei Überlänge auf eigene Zeile umbricht
// (identisches Verhalten auf IOS und NX-OS).
KLU.parsers = KLU.parsers || {};

const CDP_HEADER_RE = /Device[\s-]?ID.*Local Intrfce/i;

// Nur Device-ID/Local-Intrfce/Hldtme/Capability werden über die Zeichenposition der
// Kopfzeile geschnitten — diese Spalten sind in der Praxis zuverlässig ausgerichtet.
// Platform/Port-ID werden bewusst NICHT positionsbasiert geschnitten, siehe parseCdpNeighbor.
function findColumnOffsets(headerLine) {
  const localIntrfce = /Local Intrfce/i.exec(headerLine);
  const holdtme = /Hldtme|Holdtme/i.exec(headerLine);
  const capability = /Capability/i.exec(headerLine);
  const platform = /Platform/i.exec(headerLine);
  const portId = /Port ID/i.exec(headerLine);
  if (!localIntrfce || !holdtme || !capability || !platform || !portId) return null; // Format-Sanity-Check
  return {
    deviceId: 0,
    localIntrfce: localIntrfce.index,
    holdtme: holdtme.index,
    capability: capability.index
  };
}

const TRAILER_LINE_RE = /^Total\b.*entries/i;

const INTERFACE_TYPE_WORD_RE = /^(gig|gigabitethernet|te|tengig|tengigabitethernet|fa|fastethernet|eth|ethernet|po|port-channel|port|vlan|hu|hundredgig|fo|fortygig|twe|twentyfivegig|twentyfivegige)$/i;
const NUMERIC_PORT_SUFFIX_RE = /^\d+(\/\d+)*$/; // z.B. "1/0/1", "0/0", "1"
const FUSED_INTERFACE_RE = /^[A-Za-z][A-Za-z-]*\d[\d/]*$/; // z.B. "Eth1/3", "GigabitEthernet0/0", "Gi0/0"

// Trennt die Tokens ab der Capability-Spalte in Platform (kann mehrere Wörter enthalten, z.B.
// "Cisco IP Phone 7841" bei einem IP-Telefon als CDP-Nachbar) und Port-ID (kann ebenfalls
// mehrere Wörter enthalten, z.B. "Gig 1/0/1" oder "Port 1"). Reihenfolge: zuerst das häufigste
// Muster (Port-ID als ein verschmolzenes Token wie "Eth1/3"), dann "Typ-Wort + nackte Nummer"
// (Gig 1/0/1, Port 1), zuletzt Fallback (letztes Token = Port-ID, Rest = Platform).
function splitPlatformAndPortId(tokens) {
  if (tokens.length === 0) return { platform: '', portId: '' };
  const last = tokens[tokens.length - 1];

  if (tokens.length >= 2 && NUMERIC_PORT_SUFFIX_RE.test(last) && INTERFACE_TYPE_WORD_RE.test(tokens[tokens.length - 2])) {
    return { platform: tokens.slice(0, -2).join(' '), portId: tokens.slice(-2).join(' ') };
  }
  if (FUSED_INTERFACE_RE.test(last)) {
    return { platform: tokens.slice(0, -1).join(' '), portId: last };
  }
  return { platform: tokens.slice(0, -1).join(' '), portId: last }; // unbekanntes Muster -> alter Fallback
}

/**
 * @param {string} text Block-Text von "show cdp neighbor"
 * @returns {Array<{ localPort: string, neighborDeviceId: string, neighborPort: string, neighborPlatform: string }>}
 */
KLU.parsers.parseCdpNeighbor = function (text) {
  const lines = text.split('\n');
  const headerIdx = lines.findIndex(l => CDP_HEADER_RE.test(l));
  if (headerIdx === -1) return [];

  const cols = findColumnOffsets(lines[headerIdx]);
  if (!cols) return [];

  const entries = [];
  let pendingDeviceId = null;
  let lastEntry = null;

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (TRAILER_LINE_RE.test(trimmed)) continue; // z.B. "Total cdp entries displayed : 2"

    // Device-ID zu lang für ihre Spalte -> steht allein auf der Zeile, Rest folgt in der
    // nächsten Zeile. Erkennung über die Zeilenlänge statt über "andere Spalten leer", weil
    // eine überlange Device-ID (z.B. NX-OS "hostname(serial)") sonst in die Local-Intrfce-
    // Spalte hineinragen und einen Falsch-Treffer als vollständige Zeile erzeugen kann.
    if (line.replace(/\s+$/, '').length <= cols.capability) {
      pendingDeviceId = trimmed;
      continue;
    }

    const deviceId = KLU.parsers.sliceCol(line, cols.deviceId, cols.localIntrfce);
    const localIntrfce = KLU.parsers.sliceCol(line, cols.localIntrfce, cols.holdtme);

    // Ab der Capability-Spalte NICHT mehr spaltenbasiert weiterschneiden: In echten Exporten
    // sitzt die Platform-Spalte nicht immer exakt an der Zeichenposition, die sich aus der
    // Kopfzeile ("Capability" -> "Platform") ergibt (Capability-Codes sind variabel breit,
    // Cisco füllt hier nicht immer bis zur Header-Wortposition auf). Stattdessen: alles ab
    // Capability tokenweise lesen, führende Ein-Buchstaben-Codes (Capability) überspringen,
    // Rest = [Platform, Port ID].
    const restTokens = line.slice(cols.capability).trim().split(/\s+/).filter(Boolean);
    let idx = 0;
    while (idx < restTokens.length && /^[A-Za-z]$/.test(restTokens[idx])) idx++;
    const { platform, portId } = splitPlatformAndPortId(restTokens.slice(idx));

    // Wenn die Port-ID selbst zu lang für ihre Spalte ist (z.B. "TwentyFiveGigE1/0/9"), bricht
    // NUR sie auf eine eigene Zeile um — Device-ID und Local Intrfce sind dann leer, und das
    // einzige Token auf der Zeile ist in Wahrheit die fehlende Port-ID des vorherigen Eintrags
    // (splitPlatformAndPortId erkennt ein einzelnes verschmolzenes Interface-Token als Port-ID,
    // Platform bleibt dann leer).
    if (!deviceId && !localIntrfce && portId && !platform && lastEntry && !lastEntry.neighborPort) {
      lastEntry.neighborPort = portId;
      continue;
    }

    lastEntry = {
      localPort: localIntrfce,
      neighborDeviceId: deviceId || pendingDeviceId || '',
      neighborPort: portId,
      neighborPlatform: platform
    };
    entries.push(lastEntry);
    pendingDeviceId = null;
  }

  return entries;
};
