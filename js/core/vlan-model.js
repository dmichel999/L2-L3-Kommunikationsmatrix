// L2-L3 Kommunikationsmatrix — VLAN-Modell: fasst show-vlan/-ip-route/-ip-interface-brief aller
// Switches zu einer globalen VLAN-Tabelle zusammen (VLAN-ID/Name, Switches mit dem VLAN,
// IP-Netz(e) je VLAN-Interface + welche Switches dieses Interface haben).
KLU.vlanModel = {};

function vlanIdFromInterfaceName(name) {
  const m = /^vlan(\d+)$/i.exec(name.trim());
  return m ? parseInt(m[1], 10) : null;
}

/**
 * @param {Array} switches KLU.state.getSwitches()-Format, erwartet sw.parsed.vlans /
 *   sw.parsed.ipRouteConnected / sw.parsed.ipInterfaceBrief
 * @returns {Array<{ vlanId: number, name: string|null, switchesWithVlan: string[],
 *   networks: Array<{ cidr: string, switches: string[], maskKnown: boolean }> }>}
 */
KLU.vlanModel.build = function (switches) {
  const vlans = new Map();

  function getVlan(vlanId) {
    if (!vlans.has(vlanId)) {
      vlans.set(vlanId, { vlanId, name: null, switchesWithVlan: new Set(), networks: new Map() });
    }
    return vlans.get(vlanId);
  }

  for (const sw of switches) {
    for (const v of sw.parsed?.vlans || []) {
      const entry = getVlan(v.vlanId);
      entry.switchesWithVlan.add(sw.id);
      if (!entry.name && v.vlanName) entry.name = v.vlanName;
    }
  }

  for (const sw of switches) {
    const routeByVlanId = new Map();
    for (const r of sw.parsed?.ipRouteConnected || []) {
      const vlanId = vlanIdFromInterfaceName(r.interface);
      if (vlanId == null) continue;
      routeByVlanId.set(vlanId, r.network);
    }
    for (const [vlanId, cidr] of routeByVlanId) {
      const entry = getVlan(vlanId);
      if (!entry.networks.has(cidr)) entry.networks.set(cidr, { switches: new Set(), maskKnown: true });
      entry.networks.get(cidr).switches.add(sw.id);
    }

    // Fallback: IP-Interface ohne passende connected Route (z.B. VRF-Sonderfall) -> Netz ohne
    // gesicherte Maske, aber Switch-Zuordnung bleibt sichtbar.
    for (const ib of sw.parsed?.ipInterfaceBrief || []) {
      const vlanId = vlanIdFromInterfaceName(ib.interface);
      if (vlanId == null || routeByVlanId.has(vlanId)) continue;
      const entry = getVlan(vlanId);
      const cidr = `${ib.ipAddress}/?`;
      if (!entry.networks.has(cidr)) entry.networks.set(cidr, { switches: new Set(), maskKnown: false });
      entry.networks.get(cidr).switches.add(sw.id);
    }
  }

  return Array.from(vlans.values())
    .sort((a, b) => a.vlanId - b.vlanId)
    .map(v => ({
      vlanId: v.vlanId,
      name: v.name,
      switchesWithVlan: Array.from(v.switchesWithVlan),
      networks: Array.from(v.networks.entries()).map(([cidr, data]) => ({
        cidr,
        switches: Array.from(data.switches),
        maskKnown: data.maskKnown
      }))
    }));
};
