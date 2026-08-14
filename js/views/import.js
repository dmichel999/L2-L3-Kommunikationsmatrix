// L2-L3 Kommunikationsmatrix — Import-View: Mehrfach-Datei-Upload, Parsing, Switch-Liste
KLU.views = KLU.views || {};

const EXPECTED_COMMANDS = ['version', 'cdpNeighbor', 'portChannel', 'vlan', 'macAddressTable', 'ipInterfaceBrief', 'arp', 'ipRoute', 'interfacesTrunk', 'ipInterfaceFull', 'spanningTree', 'fhrpStatus'];

// Für den Hover-Popup bei fehlenden Kommandos (Feature 11 der Erweiterung, siehe features.md):
// welches Feature/welche Ansicht ist ohne dieses Kommando für diesen Switch eingeschränkt.
const COMMAND_FEATURE_IMPACT = {
  version: 'Plattform-/Hostname-Erkennung unsicher (Fallback über Prompt-Zeile + Kommandonamen aktiv)',
  cdpNeighbor: 'Topologie: Verbindungen dieses Switches fehlen komplett',
  portChannel: 'Topologie: Port-Channel-Bündelung für diesen Switch nicht erkennbar, Links erscheinen einzeln',
  vlan: 'VLAN-Tabelle: VLANs dieses Switches fehlen komplett',
  macAddressTable: 'MAC-Ansicht: gelernte MAC-Adressen dieses Switches fehlen',
  ipInterfaceBrief: 'VLAN-Tabelle: SVI-Fallback-Zuordnung ohne Maske für diesen Switch nicht möglich',
  arp: 'Globale Suche: IP-Suche über ARP für diesen Switch liefert keine Treffer',
  ipRoute: 'VLAN-Tabelle/Matrix: IP-Netz+Maske für SVIs dieses Switches nicht ermittelbar',
  interfacesTrunk: 'Trunk-Ansicht: Native-VLAN-Mismatch-Prüfung für Links dieses Switches nicht möglich',
  ipInterfaceFull: 'Kommunikationsmatrix: ACL-Hinweis-Flag für SVIs dieses Switches nicht verfügbar',
  spanningTree: 'STP-Ansicht: Root-Bridge-Erkennung und blockierte Ports für diesen Switch nicht verfügbar',
  fhrpStatus: 'Netzwerk-Details: Active/Standby-Rolle dieses Switches bei mehreren SVIs (HSRP/VRRP) nicht verfügbar'
};

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

function isDocx(file) {
  return /\.docx$/i.test(file.name) || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
}

async function extractFileText(file) {
  if (isDocx(file)) {
    const buffer = await readFileAsArrayBuffer(file);
    return KLU.parsers.extractDocxText(buffer);
  }
  return readFileAsText(file);
}

function uniqueSwitchId(baseId) {
  let id = baseId;
  let n = 2;
  while (KLU.state.switches.has(id)) {
    id = `${baseId}-${n}`;
    n++;
  }
  return id;
}

async function processFile(file) {
  const text = await extractFileText(file);
  const { commands, unrecognized, promptHostname } = KLU.parsers.splitCommands(text);

  if (Object.keys(commands).length === 0) {
    return { error: `${file.name}: keine erkennbaren show-Kommandos gefunden — Datei übersprungen.` };
  }

  const fallbackId = file.name.replace(/\.[^.]+$/, '');
  let version;
  let platformGuessed = false;

  if (commands.version) {
    version = KLU.parsers.parseVersion(commands.version);
  } else {
    // "show version" fehlt in der Datei -> Hostname aus der Prompt-Zeile, Plattform aus den
    // vorhandenen Kommandonamen ableiten (z.B. "show ip arp" ist nexus-spezifisch).
    platformGuessed = true;
    version = {
      hostname: promptHostname,
      platform: KLU.parsers.inferPlatformFromCommandNames(text) || 'catalyst',
      model: null
    };
  }

  const baseId = version.hostname || fallbackId;
  const id = uniqueSwitchId(baseId);

  const cdpNeighbors = commands.cdpNeighbor ? KLU.parsers.parseCdpNeighbor(commands.cdpNeighbor) : [];
  const portChannels = commands.portChannel ? KLU.parsers.parsePortChannelSummary(commands.portChannel) : [];
  const vlans = commands.vlan ? KLU.parsers.parseVlan(commands.vlan) : [];
  const ipRouteConnected = commands.ipRoute ? KLU.parsers.parseIpRoute(commands.ipRoute, version.platform) : [];
  const ipInterfaceBrief = commands.ipInterfaceBrief ? KLU.parsers.parseIpInterfaceBrief(commands.ipInterfaceBrief) : [];
  const macTable = commands.macAddressTable ? KLU.parsers.parseMacAddressTable(commands.macAddressTable) : [];
  const trunks = commands.interfacesTrunk ? KLU.parsers.parseInterfacesTrunk(commands.interfacesTrunk) : [];
  const ipInterfaceFull = commands.ipInterfaceFull ? KLU.parsers.parseIpInterfaceFull(commands.ipInterfaceFull) : [];
  const arpEntries = commands.arp ? KLU.parsers.parseArp(commands.arp) : [];
  const spanningTree = commands.spanningTree ? KLU.parsers.parseSpanningTree(commands.spanningTree) : [];
  const fhrpStatus = commands.fhrpStatus ? KLU.parsers.parseFhrpStatus(commands.fhrpStatus) : [];
  // lldpNeighbor bewusst NICHT in EXPECTED_COMMANDS: reiner CDP-Fallback (Fremdhersteller/CDP
  // deaktiviert), auf einem normalen All-Cisco-Netz mit aktivem CDP fehlt es praktisch immer und
  // wäre dort nur irreführendes Rauschen im Import-Feedback-Panel.
  const lldpNeighbors = commands.lldpNeighbor ? KLU.parsers.parseLldpNeighbor(commands.lldpNeighbor) : [];
  const missingCommands = EXPECTED_COMMANDS.filter(k => !(k in commands));

  const sw = {
    id,
    hostname: version.hostname || fallbackId,
    platform: version.platform,
    platformGuessed,
    model: version.model,
    osVersion: version.osVersion,
    fileName: file.name,
    raw: commands,
    parsed: { cdpNeighbors, portChannels, vlans, ipRouteConnected, ipInterfaceBrief, macTable, trunks, ipInterfaceFull, arpEntries, spanningTree, fhrpStatus, lldpNeighbors },
    missingCommands,
    unrecognized
  };

  return { switch: sw };
}

// Plattform-Korrektur durch den User (Feature 11): betrifft nur "show ip route", da dessen
// Parser-Variante (Catalyst/Nexus) vom Feld abhängt — alle anderen Parser sind formatgleich.
function setSwitchPlatform(id, platform) {
  const sw = KLU.state.switches.get(id);
  if (!sw || sw.platform === platform) return;
  sw.platform = platform;
  sw.platformGuessed = false;
  sw.parsed.ipRouteConnected = sw.raw.ipRoute ? KLU.parsers.parseIpRoute(sw.raw.ipRoute, platform) : [];
  KLU.emit('switches:changed', null);
}

function renderMissingCommandsPopup(sw) {
  if (!sw.missingCommands.length) return '';
  const rows = sw.missingCommands.map(k => `
    <div class="feature-impact-row"><code>${KLU.dom.escapeHtml(k)}</code><span>${KLU.dom.escapeHtml(COMMAND_FEATURE_IMPACT[k] || '')}</span></div>
  `).join('');
  return `
    <span class="switch-warning switch-warning-hover">⚠ ${sw.missingCommands.length} fehlend
      <div class="feature-impact-popup">
        <strong>Fehlende Kommandos für ${KLU.dom.escapeHtml(sw.hostname)}:</strong>
        ${rows}
      </div>
    </span>
  `;
}

function renderSwitchList() {
  const list = document.getElementById('import-switch-list');
  if (!list) return;
  const switches = KLU.state.getSwitches();

  if (switches.length === 0) {
    list.innerHTML = '<p class="hint">Noch keine Switches importiert.</p>';
    return;
  }

  list.innerHTML = switches.map(sw => `
    <div class="switch-row" data-id="${KLU.dom.escapeHtml(sw.id)}">
      <span class="switch-row-handle" draggable="true" title="Ziehen zum Umsortieren">⠿</span>
      <select class="switch-platform-select badge-${sw.platform === 'nexus' ? 'nexus' : 'catalyst'}" data-id="${KLU.dom.escapeHtml(sw.id)}" title="Erkannte Plattform bestätigen oder korrigieren">
        <option value="catalyst"${sw.platform === 'catalyst' ? ' selected' : ''}>Catalyst</option>
        <option value="nexus"${sw.platform === 'nexus' ? ' selected' : ''}>Nexus</option>
      </select>
      <span class="switch-hostname">${KLU.dom.escapeHtml(sw.hostname)}</span>
      <span class="switch-model">${KLU.dom.escapeHtml(sw.model) || '–'}</span>
      ${sw.platformGuessed ? '<span class="switch-warning" title="Kein \'show version\' in der Datei — Plattform anhand der verwendeten Kommandonamen vermutet, bitte prüfen">⚠ Plattform vermutet</span>' : ''}
      ${renderMissingCommandsPopup(sw)}
      <button class="btn-remove" data-id="${KLU.dom.escapeHtml(sw.id)}">Entfernen</button>
    </div>
  `).join('');
}

function renderErrors(errors) {
  const box = document.getElementById('import-errors');
  if (!box) return;
  if (!errors.length) { box.innerHTML = ''; return; }
  box.innerHTML = errors.map(e => `<div class="error-line">${KLU.dom.escapeHtml(e)}</div>`).join('');
}

async function handleFiles(fileList) {
  const errors = [];
  for (const file of Array.from(fileList)) {
    try {
      const result = await processFile(file);
      if (result.error) errors.push(result.error);
      else KLU.state.addSwitch(result.switch);
    } catch (e) {
      errors.push(`${file.name}: Fehler beim Verarbeiten (${e.message})`);
    }
  }
  renderErrors(errors);
  renderSwitchList();
}

KLU.views.import = {
  init() {
    const dropzone = document.getElementById('import-dropzone');
    const fileInput = document.getElementById('import-file-input');
    const list = document.getElementById('import-switch-list');

    fileInput?.addEventListener('change', e => handleFiles(e.target.files));

    dropzone?.addEventListener('click', () => fileInput?.click());
    dropzone?.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('dragover'); });
    dropzone?.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone?.addEventListener('drop', e => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      handleFiles(e.dataTransfer.files);
    });

    list?.addEventListener('click', e => {
      const btn = e.target.closest('.btn-remove');
      if (btn) KLU.state.removeSwitch(btn.dataset.id);
    });

    list?.addEventListener('change', e => {
      const select = e.target.closest('.switch-platform-select');
      if (select) setSwitchPlatform(select.dataset.id, select.value);
    });

    // Sortierung der Import-Liste per Drag & Drop, Ziehgriff statt der ganzen Zeile, damit
    // Klicks auf Plattform-Dropdown/Entfernen-Button nicht mit dem Drag-Start kollidieren.
    list?.addEventListener('dragstart', e => {
      const row = e.target.closest('.switch-row');
      if (!row) return;
      e.dataTransfer.setData('text/plain', row.dataset.id);
      e.dataTransfer.effectAllowed = 'move';
    });
    list?.addEventListener('dragover', e => {
      const row = e.target.closest('.switch-row');
      if (!row) return;
      e.preventDefault();
      row.classList.add('drag-over');
    });
    list?.addEventListener('dragleave', e => {
      e.target.closest('.switch-row')?.classList.remove('drag-over');
    });
    list?.addEventListener('drop', e => {
      const row = e.target.closest('.switch-row');
      if (!row) return;
      e.preventDefault();
      row.classList.remove('drag-over');
      const draggedId = e.dataTransfer.getData('text/plain');
      KLU.state.reorderSwitches(draggedId, row.dataset.id);
    });

    KLU.on('switches:changed', renderSwitchList);
    renderSwitchList();
  }
};
