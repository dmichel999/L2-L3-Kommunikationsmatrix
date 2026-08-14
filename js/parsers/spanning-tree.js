// Kunden LAN Überblick — Parser für "show spanning-tree" (Catalyst + Nexus, identisches Format
// für die klassische PVST+/Rapid-PVST-Ausgabe). Liefert pro VLAN-Block: Root-Bridge-Adresse,
// eigene Bridge-Adresse (zum späteren Abgleich, welcher importierte Switch die Root-Bridge IST)
// und die Rolle/Status jedes Ports (für blockierte Ports = Loop-Präventionspunkte).
KLU.parsers = KLU.parsers || {};

const STP_VLAN_BLOCK_RE = /^VLAN(\d+)$/;
const STP_PORT_TABLE_HEADER_RE = /^Interface\s+Role\s+Sts/i;
const STP_ADDRESS_RE = /Address\s+([0-9a-fA-F.:]{4,})/;

/**
 * @param {string} text Block-Text von "show spanning-tree"
 * @returns {Array<{ vlanId: number, rootAddress: string|null, bridgeAddress: string|null,
 *   ports: Array<{ port: string, role: string, status: string }> }>}
 */
KLU.parsers.parseSpanningTree = function (text) {
  const result = [];
  let current = null;
  let pendingField = null; // 'root' | 'bridge' | null
  let inPortTable = false;

  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;

    const vlanMatch = STP_VLAN_BLOCK_RE.exec(line);
    if (vlanMatch) {
      current = { vlanId: parseInt(vlanMatch[1], 10), rootAddress: null, bridgeAddress: null, ports: [] };
      result.push(current);
      pendingField = null;
      inPortTable = false;
      continue;
    }
    if (!current) continue;

    if (/^Root ID/i.test(line)) { pendingField = 'root'; continue; }
    if (/^Bridge ID/i.test(line)) { pendingField = 'bridge'; continue; }

    if (pendingField) {
      const addrMatch = STP_ADDRESS_RE.exec(line);
      if (addrMatch) {
        if (pendingField === 'root') current.rootAddress = addrMatch[1].toLowerCase();
        else current.bridgeAddress = addrMatch[1].toLowerCase();
        pendingField = null;
      }
      continue;
    }

    if (STP_PORT_TABLE_HEADER_RE.test(line)) { inPortTable = true; continue; }
    if (/^-+\s+-+/.test(line)) continue; // Trennzeile

    if (inPortTable) {
      const tokens = line.split(/\s+/);
      if (tokens.length < 3) continue;
      current.ports.push({ port: tokens[0], role: tokens[1], status: tokens[2] });
    }
  }

  return result;
};
