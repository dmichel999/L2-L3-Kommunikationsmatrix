// L2-L3 Kommunikationsmatrix — Parser für "show vlan" (erste Tabelle: VLAN/Name/Status/Ports).
// Format ist auf Catalyst und Nexus identisch. Port-Listen können auf Folgezeilen umbrechen.
// Manche Exporte (z.B. Copy/Paste aus bestimmten Terminal-Tools) fügen nach JEDER Zeile eine
// Leerzeile ein — Leerzeilen dürfen daher NICHT als Tabellenende gewertet werden. Das echte
// Ende der ersten Tabelle ist die zweite Tabelle ("VLAN Type SAID ...", andere Spalten).
KLU.parsers = KLU.parsers || {};

const VLAN_HEADER_RE = /^VLAN\s+Name\s+Status\s+Ports/i;
const VLAN_SECOND_TABLE_RE = /^VLAN\s+Type\b/i;
const VLAN_ROW_RE = /^(\d+)\s/;

function findVlanColumnOffsets(headerLine) {
  const name = /Name/i.exec(headerLine);
  const status = /Status/i.exec(headerLine);
  const ports = /Ports/i.exec(headerLine);
  if (!name || !status || !ports) return null;
  return { vlanId: 0, name: name.index, status: status.index, ports: ports.index };
}

function parsePortsList(str) {
  return str.split(',').map(p => p.trim()).filter(Boolean);
}

/**
 * @param {string} text Block-Text von "show vlan"
 * @returns {Array<{ vlanId: number, vlanName: string, status: string, ports: string[] }>}
 */
KLU.parsers.parseVlan = function (text) {
  const lines = text.split('\n');
  const headerIdx = lines.findIndex(l => VLAN_HEADER_RE.test(l.trim()));
  if (headerIdx === -1) return [];

  const cols = findVlanColumnOffsets(lines[headerIdx]);
  if (!cols) return [];

  const entries = [];
  let current = null;

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) continue; // Leerzeile ignorieren, kein Tabellenende-Signal
    if (/^-+\s+-+/.test(trimmed)) continue; // Trennzeile "---- ---- ..."
    if (VLAN_SECOND_TABLE_RE.test(trimmed)) break; // zweite Tabelle beginnt -> Ende

    if (VLAN_ROW_RE.test(line)) {
      current = {
        vlanId: parseInt(KLU.parsers.sliceCol(line, cols.vlanId, cols.name), 10),
        vlanName: KLU.parsers.sliceCol(line, cols.name, cols.status),
        status: KLU.parsers.sliceCol(line, cols.status, cols.ports),
        ports: parsePortsList(KLU.parsers.sliceCol(line, cols.ports))
      };
      entries.push(current);
    } else if (current) {
      // Fortsetzung der Port-Liste der vorherigen VLAN-Zeile
      current.ports.push(...parsePortsList(line.trim()));
    }
  }

  return entries;
};
