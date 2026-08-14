// L2-L3 Kommunikationsmatrix — Parser für "show lldp neighbor" (Catalyst + Nexus, identisches
// Format). Ergänzt CDP um herstellerneutrale Nachbarschaftserkennung — wichtig, wenn CDP
// deaktiviert ist oder Fremdhersteller-Geräte (kein CDP-Support) im Netz hängen. Anders als CDP
// hat die LLDP-Kurztabelle KEINE Platform-Spalte, dafür Capability-Codes nach IEEE 802.1AB
// (R=Router, B=Bridge, T=Telephone, C=DOCSIS, W=WLAN-AP, P=Repeater, S=Station, O=Other) — die
// nutzen wir in topology.js zur groben Geräte-Typ-Erkennung von Nachbarn, die nur per LLDP
// sichtbar sind. Gleiche Spaltenzuverlässigkeits-Einschränkung wie bei CDP: Device-ID/Local-Intf/
// Hold-time/Capability werden per Zeichenposition geschnitten, Port-ID danach tokenbasiert.
KLU.parsers = KLU.parsers || {};

const LLDP_HEADER_RE = /Device ID.*Local Intf/i;
const LLDP_TRAILER_RE = /^Total entries displayed/i;
const LLDP_CAPABILITY_TOKEN_RE = /^[A-Z]+(,[A-Z])*$/;

function findLldpColumnOffsets(headerLine) {
  const localIntf = /Local Intf/i.exec(headerLine);
  const holdTime = /Hold-?time/i.exec(headerLine);
  const capability = /Capability/i.exec(headerLine);
  const portId = /Port ID/i.exec(headerLine);
  if (!localIntf || !holdTime || !capability || !portId) return null; // Format-Sanity-Check
  return { deviceId: 0, localIntf: localIntf.index, holdTime: holdTime.index, capability: capability.index };
}

/**
 * @param {string} text Block-Text von "show lldp neighbor"
 * @returns {Array<{ localPort: string, neighborDeviceId: string, neighborPort: string, neighborCapability: string }>}
 */
KLU.parsers.parseLldpNeighbor = function (text) {
  const lines = text.split('\n');
  const headerIdx = lines.findIndex(l => LLDP_HEADER_RE.test(l));
  if (headerIdx === -1) return [];

  const cols = findLldpColumnOffsets(lines[headerIdx]);
  if (!cols) return [];

  const entries = [];
  let pendingDeviceId = null;
  let lastEntry = null;

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (LLDP_TRAILER_RE.test(trimmed)) continue; // z.B. "Total entries displayed: 2"

    // Device-ID zu lang für ihre Spalte -> steht allein auf der Zeile (gleiches Verhalten wie CDP).
    if (line.replace(/\s+$/, '').length <= cols.capability) {
      pendingDeviceId = trimmed;
      continue;
    }

    const deviceId = KLU.parsers.sliceCol(line, cols.deviceId, cols.localIntf);
    const localIntf = KLU.parsers.sliceCol(line, cols.localIntf, cols.holdTime);

    // Ab Capability tokenweise: ein führendes Capability-Code-Token (z.B. "B,R", "BR", "T")
    // überspringen, Rest = Port-ID (kann selbst Leerzeichen enthalten, z.B. "Port 1").
    const restTokens = line.slice(cols.capability).trim().split(/\s+/).filter(Boolean);
    let idx = 0;
    let capabilityToken = '';
    if (restTokens.length > 1 && LLDP_CAPABILITY_TOKEN_RE.test(restTokens[0])) {
      capabilityToken = restTokens[0];
      idx = 1;
    }
    const portId = restTokens.slice(idx).join(' ');

    // Port-ID zu lang für ihre Spalte -> bricht auf eigene Zeile um (gleiches Verhalten wie CDP).
    if (!deviceId && !localIntf && portId && !capabilityToken && lastEntry && !lastEntry.neighborPort) {
      lastEntry.neighborPort = portId;
      continue;
    }

    lastEntry = {
      localPort: localIntf,
      neighborDeviceId: deviceId || pendingDeviceId || '',
      neighborPort: portId,
      neighborCapability: capabilityToken
    };
    entries.push(lastEntry);
    pendingDeviceId = null;
  }

  return entries;
};
