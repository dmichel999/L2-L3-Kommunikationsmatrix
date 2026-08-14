// Kunden LAN Überblick — STP-Modell: Root-Bridge je VLAN + blockierte Ports (Loop-Präventions-
// punkte). Root-Bridge wird über den Adress-Abgleich bestimmt: der Switch, dessen eigene
// Bridge-Adresse mit der gemeldeten Root-Adresse übereinstimmt, IST die Root-Bridge. Meldet kein
// importierter Switch eine passende Bridge-Adresse, ist die Root-Bridge nicht importiert (wird
// als "unbekannt (extern)" mit der reinen Adresse angezeigt statt sie zu verschweigen).
KLU.stpModel = {};

/**
 * @param {Array} switches KLU.state.getSwitches()-Format, erwartet sw.parsed.spanningTree
 * @returns {Array<{ vlanId: number, rootSwitchId: string|null, rootAddress: string|null,
 *   blockedPorts: Array<{ switchId: string, port: string }> }>}
 */
KLU.stpModel.build = function (switches) {
  const byVlan = new Map();

  for (const sw of switches) {
    for (const entry of sw.parsed?.spanningTree || []) {
      if (!byVlan.has(entry.vlanId)) {
        byVlan.set(entry.vlanId, { vlanId: entry.vlanId, rootAddress: null, bridgeAddresses: [], blockedPorts: [] });
      }
      const v = byVlan.get(entry.vlanId);
      if (!v.rootAddress && entry.rootAddress) v.rootAddress = entry.rootAddress;
      if (entry.bridgeAddress) v.bridgeAddresses.push({ switchId: sw.id, address: entry.bridgeAddress });
      for (const p of entry.ports) {
        if (/^BLK$/i.test(p.status)) v.blockedPorts.push({ switchId: sw.id, port: p.port });
      }
    }
  }

  return Array.from(byVlan.values())
    .sort((a, b) => a.vlanId - b.vlanId)
    .map(v => {
      const rootMatch = v.bridgeAddresses.find(b => b.address === v.rootAddress);
      return {
        vlanId: v.vlanId,
        rootSwitchId: rootMatch ? rootMatch.switchId : null,
        rootAddress: v.rootAddress,
        blockedPorts: v.blockedPorts
      };
    });
};
