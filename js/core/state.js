// Kunden LAN Überblick — App-State
KLU.state = {
  // switches: Map<switchId, { id, hostname, platform, raw: {commandKey: text}, parsed: {...} }>
  switches: new Map(),
  linkMode: 'aggregated', // 'aggregated' | 'individual'
  selectedVlan: null,
  selectedNetwork: null
};

KLU.state.addSwitch = function (sw) {
  KLU.state.switches.set(sw.id, sw);
  KLU.emit('switches:changed', null);
};

KLU.state.removeSwitch = function (id) {
  KLU.state.switches.delete(id);
  KLU.emit('switches:changed', null);
};

KLU.state.getSwitches = function () {
  return Array.from(KLU.state.switches.values());
};

KLU.state.selectVlan = function (vlanId) {
  KLU.state.selectedVlan = KLU.state.selectedVlan === vlanId ? null : vlanId; // erneuter Klick hebt Auswahl auf
  KLU.emit('vlan:selected', KLU.state.selectedVlan);
};

// key = "<vlanId>|<cidr>", eindeutig je IP-Netz-Eintrag in der VLAN-Tabelle
KLU.state.selectNetwork = function (key) {
  KLU.state.selectedNetwork = KLU.state.selectedNetwork === key ? null : key;
  KLU.emit('network:selected', KLU.state.selectedNetwork);
};
