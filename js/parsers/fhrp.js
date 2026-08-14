// L2-L3 Kommunikationsmatrix — Parser für FHRP-Status: "show standby" (Catalyst HSRP), "show hsrp"
// (Nexus HSRP) und "show vrrp" (beide Plattformen). Alle drei teilen dasselbe Grundmuster
// ("VlanNN - Group G" gefolgt von einer Zeile mit "state is <Wort>" irgendwo im Block), daher
// genügt ein gemeinsamer Parser statt einer Variante pro Kommando/Protokoll.
KLU.parsers = KLU.parsers || {};

const FHRP_GROUP_HEADER_RE = /^Vlan(\d+)\s*-\s*Group\s*(\d+)/i;
const FHRP_STATE_RE = /state is (\w+)/i;

/**
 * @param {string} text Block-Text von "show standby" / "show hsrp" / "show vrrp"
 * @returns {Array<{ vlanId: number, group: number, state: string|null }>}
 */
KLU.parsers.parseFhrpStatus = function (text) {
  const result = [];
  let current = null;

  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;

    const groupMatch = FHRP_GROUP_HEADER_RE.exec(line);
    if (groupMatch) {
      current = { vlanId: parseInt(groupMatch[1], 10), group: parseInt(groupMatch[2], 10), state: null };
      result.push(current);
      continue;
    }
    if (!current) continue;

    if (!current.state) {
      const stateMatch = FHRP_STATE_RE.exec(line);
      if (stateMatch) current.state = stateMatch[1];
    }
  }

  return result;
};
