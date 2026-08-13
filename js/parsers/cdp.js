// Kunden LAN Überblick — Parser für "show cdp neighbor" (Catalyst + Nexus)
// Fixed-width Spaltenparser, da Device-ID bei Überlänge auf eigene Zeile umbricht
// (identisches Verhalten auf IOS und NX-OS).
KLU.parsers = KLU.parsers || {};

const CDP_HEADER_RE = /Device[\s-]?ID.*Local Intrfce/i;

function findColumnOffsets(headerLine) {
  const localIntrfce = /Local Intrfce/i.exec(headerLine);
  const holdtme = /Hldtme|Holdtme/i.exec(headerLine);
  const capability = /Capability/i.exec(headerLine);
  const platform = /Platform/i.exec(headerLine);
  const portId = /Port ID/i.exec(headerLine);
  if (!localIntrfce || !holdtme || !capability || !platform || !portId) return null;
  return {
    deviceId: 0,
    localIntrfce: localIntrfce.index,
    holdtme: holdtme.index,
    capability: capability.index,
    platform: platform.index,
    portId: portId.index
  };
}

const TRAILER_LINE_RE = /^Total\b.*entries/i;

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
    const platform = KLU.parsers.sliceCol(line, cols.platform, cols.portId);
    const portId = KLU.parsers.sliceCol(line, cols.portId);

    entries.push({
      localPort: localIntrfce,
      neighborDeviceId: deviceId || pendingDeviceId || '',
      neighborPort: portId,
      neighborPlatform: platform
    });
    pendingDeviceId = null;
  }

  return entries;
};
