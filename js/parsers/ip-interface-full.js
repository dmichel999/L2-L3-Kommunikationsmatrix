// L2-L3 Kommunikationsmatrix — Parser für "show ip interface" (voll, nicht "brief"). Liefert pro
// VLAN-Interface, ob und welche Access-List(s) (eingehend/ausgehend) konfiguriert sind - der
// eigentliche Regelinhalt kommt separat aus "show ip access-lists" (js/parsers/access-lists.js)
// und wird in reachability-model.js anhand des Namens zusammengefuehrt. Catalyst- und
// Nexus-Ausgabe unterscheiden sich im Wortlaut der ACL-Zeile, beide Formate beginnen einen neuen
// Interface-Block aber mit "VlanNN".
KLU.parsers = KLU.parsers || {};

const IP_INTERFACE_BLOCK_START_RE = /^Vlan(\d+)\b/i;
// Nexus: "IP access list ACL_NAME". Catalyst: "Outgoing/Inbound access list is ACL_NAME"
// ("... is not set" wird durch das negative Lookahead ausgeschlossen).
const NEXUS_ACL_NAME_RE = /\bip access(?:-| )list\s+(\S+)/i;
const CATALYST_ACL_NAME_RE = /access list is\s+(?!not set\b)(\S+)/i;

/**
 * @param {string} text Block-Text von "show ip interface"
 * @returns {Array<{ vlanId: number, hasAcl: boolean, acls: string[] }>}
 */
KLU.parsers.parseIpInterfaceFull = function (text) {
  const lines = text.split('\n');
  const result = [];
  let current = null;

  for (const raw of lines) {
    const line = raw.trim();
    const startMatch = IP_INTERFACE_BLOCK_START_RE.exec(line);
    if (startMatch) {
      current = { vlanId: parseInt(startMatch[1], 10), hasAcl: false, acls: [] };
      result.push(current);
      continue;
    }
    if (!current) continue;
    const m = NEXUS_ACL_NAME_RE.exec(line) || CATALYST_ACL_NAME_RE.exec(line);
    if (m) {
      current.hasAcl = true;
      if (!current.acls.includes(m[1])) current.acls.push(m[1]);
    }
  }

  return result;
};
