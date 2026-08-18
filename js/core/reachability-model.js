// L2-L3 Kommunikationsmatrix — L3-Kommunikationsmatrix: rein Routing-Reachability (kein ACL-Regel-
// Auswertung, bewusste Vereinfachung siehe features.md). Zwei VLAN-Netze gelten als zueinander
// routbar, wenn mindestens ein Switch beide VLAN-Interfaces (SVIs) trägt — dieser Switch kann
// dann direkt zwischen seinen eigenen connected Routes routen. Ohne einen solchen gemeinsamen
// Switch ist Erreichbarkeit über dieses Tool NICHT ermittelbar (könnte z.B. über dynamisches
// Routing zwischen zwei Kern-Switches trotzdem funktionieren) — wird als "unbekannt" markiert,
// nicht als "blockiert".
KLU.reachabilityModel = {};

/**
 * @param {Array} switches KLU.state.getSwitches()-Format, erwartet sw.parsed.ipInterfaceFull
 * @returns {Array<{ vlanId: number, name: string|null, cidr: string, hostSwitches: Set<string>,
 *   aclFlag: boolean, acls: Array<{ switchId: string, name: string, rules: string[]|null }> }>}
 */
KLU.reachabilityModel.build = function (switches) {
  const vlans = KLU.vlanModel.build(switches);

  return vlans
    .filter(v => v.networks.length > 0) // nur VLANs mit bekanntem SVI sind Teil der Matrix
    .map(v => {
      const hostSwitches = new Set(v.networks.flatMap(n => n.switches));
      const acls = [];
      for (const sw of switches) {
        if (!hostSwitches.has(sw.id)) continue;
        const entry = (sw.parsed?.ipInterfaceFull || []).find(e => e.vlanId === v.vlanId);
        if (!entry?.hasAcl) continue;
        for (const name of entry.acls) {
          // Regelinhalt kommt aus "show ip access-lists" auf demselben Switch - fehlt dieses
          // Kommando (siehe EXPECTED_COMMANDS in import.js), bleibt rules null statt eines
          // Fehlers, die Ansicht zeigt dann nur den Namen.
          const definition = (sw.parsed?.accessLists || []).find(a => a.name === name);
          acls.push({ switchId: sw.id, name, rules: definition ? definition.rules : null });
        }
      }
      return { vlanId: v.vlanId, name: v.name, cidr: v.networks[0].cidr, hostSwitches, aclFlag: acls.length > 0, acls };
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
