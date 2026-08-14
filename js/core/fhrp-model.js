// L2-L3 Kommunikationsmatrix — FHRP-Modell: fasst HSRP/VRRP-Status aller Switches je VLAN zusammen,
// damit die Netzwerk-Details-Ansicht (Feature 4) bei Mehrfach-SVI-Netzen (HSRP/VRRP) zusätzlich
// zeigen kann, welcher Switch gerade aktiv ist.
KLU.fhrpModel = {};

/**
 * @param {Array} switches KLU.state.getSwitches()-Format, erwartet sw.parsed.fhrpStatus
 * @returns {Array<{ vlanId: number, entries: Array<{ switchId: string, group: number, state: string|null }> }>}
 */
KLU.fhrpModel.build = function (switches) {
  const byVlan = new Map();

  for (const sw of switches) {
    for (const entry of sw.parsed?.fhrpStatus || []) {
      if (!byVlan.has(entry.vlanId)) byVlan.set(entry.vlanId, []);
      byVlan.get(entry.vlanId).push({ switchId: sw.id, group: entry.group, state: entry.state });
    }
  }

  return Array.from(byVlan.entries())
    .map(([vlanId, entries]) => ({ vlanId, entries }))
    .sort((a, b) => a.vlanId - b.vlanId);
};
