// L2-L3 Kommunikationsmatrix — App-State
KLU.state = {
  // switches: Map<switchId, { id, hostname, platform, raw: {commandKey: text}, parsed: {...} }>
  switches: new Map(),
  linkMode: 'aggregated', // 'aggregated' | 'individual'
  selectedVlan: null,
  selectedNetwork: null,
  showPortLabels: false,
  selectedSwitchFocus: null,
  hiddenDeviceTypes: new Set(),
  failureSimActive: false,
  failureSimTarget: null // { type: 'node'|'edge', id: string } | null
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

KLU.state.setShowPortLabels = function (value) {
  KLU.state.showPortLabels = value;
  KLU.emit('portLabels:changed', value);
};

// nodeId = Topologie-Knoten-ID (Switch- oder externer Geräte-Knoten); erneuter Klick hebt Fokus auf
KLU.state.selectSwitchFocus = function (nodeId) {
  KLU.state.selectedSwitchFocus = KLU.state.selectedSwitchFocus === nodeId ? null : nodeId;
  KLU.emit('switchFocus:selected', KLU.state.selectedSwitchFocus);
};

KLU.state.toggleDeviceTypeVisibility = function (deviceType) {
  if (KLU.state.hiddenDeviceTypes.has(deviceType)) KLU.state.hiddenDeviceTypes.delete(deviceType);
  else KLU.state.hiddenDeviceTypes.add(deviceType);
  KLU.emit('deviceTypeVisibility:changed', deviceType);
};

KLU.state.setFailureSimActive = function (value) {
  KLU.state.failureSimActive = value;
  KLU.state.failureSimTarget = null; // Moduswechsel hebt eine laufende Simulation auf
  KLU.emit('failureSim:changed', null);
};

// target = { type: 'node'|'edge', id } | null. Erneutes Klicken desselben Ziels hebt es auf.
KLU.state.setFailureSimTarget = function (target) {
  const current = KLU.state.failureSimTarget;
  const same = current && target && current.type === target.type && current.id === target.id;
  KLU.state.failureSimTarget = same ? null : target;
  KLU.emit('failureSim:changed', KLU.state.failureSimTarget);
};

// Verschiebt draggedId an die Position von targetId in der Import-Liste (Drag & Drop-Sortierung).
// Map-Iterationsreihenfolge = Insertion-Reihenfolge, daher reicht ein Neuaufbau der Map.
KLU.state.reorderSwitches = function (draggedId, targetId) {
  if (draggedId === targetId) return;
  const entries = Array.from(KLU.state.switches.entries());
  const fromIdx = entries.findIndex(([id]) => id === draggedId);
  const toIdx = entries.findIndex(([id]) => id === targetId);
  if (fromIdx === -1 || toIdx === -1) return;
  const [moved] = entries.splice(fromIdx, 1);
  // Entfernen verschiebt alle nachfolgenden Indizes um 1 nach vorn — lag draggedId VOR targetId,
  // muss der Ziel-Index deshalb um 1 korrigiert werden, sonst landet der Eintrag einen Slot zu weit.
  const insertIdx = fromIdx < toIdx ? toIdx - 1 : toIdx;
  entries.splice(insertIdx, 0, moved);
  KLU.state.switches = new Map(entries);
  KLU.emit('switches:changed', null);
};
