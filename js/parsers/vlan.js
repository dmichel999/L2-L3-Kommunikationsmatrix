// Kunden LAN Überblick — Parser für "show vlan" (erste Tabelle: VLAN/Name/Status/Ports).
// Format ist auf Catalyst und Nexus identisch. Port-Listen können auf Folgezeilen umbrechen;
// nach der ersten Leerzeile endet die Tabelle (danach folgt bei Catalyst/Nexus je eine
// zweite Tabelle mit anderen Spalten, die uns hier nicht interessiert).
KLU.parsers = KLU.parsers || {};

const VLAN_HEADER_RE = /^VLAN\s+Name\s+Status\s+Ports/i;
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
  let started = false;

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^-+\s+-+/.test(line.trim())) continue; // Trennzeile "---- ---- ..."

    if (!line.trim()) {
      if (started) break; // Leerzeile nach Tabellenstart -> Ende der ersten Tabelle
      continue;
    }

    if (VLAN_ROW_RE.test(line)) {
      started = true;
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
