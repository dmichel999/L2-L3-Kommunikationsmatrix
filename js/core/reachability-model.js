// Kunden LAN Überblick — L3-Kommunikationsmatrix: rein Routing-Reachability (kein ACL-Regel-
// Auswertung, bewusste Vereinfachung siehe features.md). Zwei VLAN-Netze gelten als zueinander
// routbar, wenn mindestens ein Switch beide VLAN-Interfaces (SVIs) trägt — dieser Switch kann
// dann direkt zwischen seinen eigenen connected Routes routen. Ohne einen solchen gemeinsamen
// Switch ist Erreichbarkeit über dieses Tool NICHT ermittelbar (könnte z.B. über dynamisches
// Routing zwischen zwei Kern-Switches trotzdem funktionieren) — wird als "unbekannt" markiert,
// nicht als "blockiert".
KLU.reachabilityModel = {};

/**
 * @param {Array} switches KLU.state.getSwitches()-Format, erwartet sw.parsed.ipInterfaceFull
 * @returns {Array<{ vlanId: number, name: string|null, cidr: string, hostSwitches: Set<string>, aclFlag: boolean }>}
 */
KLU.reachabilityModel.build = function (switches) {
  const vlans = KLU.vlanModel.build(switches);

  return vlans
    .filter(v => v.networks.length > 0) // nur VLANs mit bekanntem SVI sind Teil der Matrix
    .map(v => {
      const hostSwitches = new Set(v.networks.flatMap(n => n.switches));
      const aclFlag = switches.some(sw =>
        hostSwitches.has(sw.id) && (sw.parsed?.ipInterfaceFull || []).some(e => e.vlanId === v.vlanId && e.hasAcl)
      );
      return { vlanId: v.vlanId, name: v.name, cidr: v.networks[0].cidr, hostSwitches, aclFlag };
    });
};

/**
 * @param {{ hostSwitches: Set<string> }} rowA
 * @param {{ hostSwitches: Set<string> }} rowB
 * @returns {boolean} true, wenn mindestens ein Switch beide SVIs trägt
 */
KLU.reachabilityModel.isReachable = function (rowA, rowB) {
  for (const id of rowA.hostSwitches) if (rowB.hostSwitches.has(id)) return true;
  return false;
};
