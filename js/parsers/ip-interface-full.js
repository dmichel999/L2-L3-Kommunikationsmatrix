// L2-L3 Kommunikationsmatrix — Parser für "show ip interface" (voll, nicht "brief"). Liefert pro
// VLAN-Interface NUR ein Flag, ob überhaupt eine Access-List (eingehend oder ausgehend)
// konfiguriert ist — bewusst keine Auswertung der ACL-Regeln selbst (Scope-Entscheidung für die
// L3-Kommunikationsmatrix, siehe features.md). Catalyst- und Nexus-Ausgabe unterscheiden sich im
// Wortlaut der ACL-Zeile, beide Formate beginnen einen neuen Interface-Block aber mit "VlanNN".
KLU.parsers = KLU.parsers || {};

const IP_INTERFACE_BLOCK_START_RE = /^Vlan(\d+)\b/i;
const IP_INTERFACE_ACL_PRESENT_RE = /access list is\s+(?!not set\b)\S/i;
const IP_INTERFACE_ACL_NAME_RE = /\bip access(?:-| )list\s+(\S+)/i;

/**
 * @param {string} text Block-Text von "show ip interface"
 * @returns {Array<{ vlanId: number, hasAcl: boolean }>}
 */
KLU.parsers.parseIpInterfaceFull = function (text) {
  const lines = text.split('\n');
  const result = [];
  let current = null;

  for (const raw of lines) {
    const line = raw.trim();
    const startMatch = IP_INTERFACE_BLOCK_START_RE.exec(line);
    if (startMatch) {
      current = { vlanId: parseInt(startMatch[1], 10), hasAcl: false };
      result.push(current);
      continue;
    }
    if (!current) continue;
    if (IP_INTERFACE_ACL_PRESENT_RE.test(line) || IP_INTERFACE_ACL_NAME_RE.test(line)) current.hasAcl = true;
  }

  return result;
};
