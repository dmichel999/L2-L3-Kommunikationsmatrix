// L2-L3 Kommunikationsmatrix — Parser für "show etherchannel summary" (Catalyst) und
// "show port-channel summary" (Nexus). Beide Formate: Gruppe + Po-ID(Flags) + Protokoll/Typ
// + Liste "Port(Flag)". Mitglieder können auf Folgezeilen umbrechen (ohne Gruppen-Präfix).
KLU.parsers = KLU.parsers || {};

const PO_GROUP_RE = /^\s*\d+\s+(Po\d+)\([A-Za-z]+\)\s*(.*)$/;
const MEMBER_PORT_RE = /(\S+)\((\w)\)/g;
const HAS_MEMBER_PORT_RE = /\S+\(\w\)/; // non-global Test-Variante, um lastIndex-Seiteneffekte zu vermeiden

function extractMemberPorts(segment) {
  const ports = [];
  let m;
  MEMBER_PORT_RE.lastIndex = 0;
  while ((m = MEMBER_PORT_RE.exec(segment)) !== null) {
    ports.push(m[1]);
  }
  return ports;
}

/**
 * @param {string} text Block-Text von "show etherchannel summary" / "show port-channel summary"
 * @returns {Array<{ portChannelId: string, members: string[] }>}
 */
KLU.parsers.parsePortChannelSummary = function (text) {
  const lines = text.split('\n');
  const result = [];
  const byId = new Map();
  let currentId = null;

  for (const line of lines) {
    const groupMatch = PO_GROUP_RE.exec(line);
    if (groupMatch) {
      currentId = groupMatch[1];
      const entry = { portChannelId: currentId, members: extractMemberPorts(groupMatch[2]) };
      byId.set(currentId, entry);
      result.push(entry);
      continue;
    }
    if (currentId && HAS_MEMBER_PORT_RE.test(line)) {
      byId.get(currentId).members.push(...extractMemberPorts(line));
    }
  }

  return result;
};
