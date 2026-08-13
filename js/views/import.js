// Kunden LAN Überblick — Import-View: Mehrfach-Datei-Upload, Parsing, Switch-Liste
KLU.views = KLU.views || {};

const EXPECTED_COMMANDS = ['version', 'cdpNeighbor', 'portChannel', 'vlan', 'macAddressTable', 'ipInterfaceBrief', 'arp', 'ipRoute'];

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
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
  const text = await readFileAsText(file);
  const { commands, unrecognized } = KLU.parsers.splitCommands(text);

  if (!commands.version) {
    return { error: `${file.name}: keine "show version"-Ausgabe gefunden — Datei übersprungen.` };
  }

  const version = KLU.parsers.parseVersion(commands.version);
  const fallbackId = file.name.replace(/\.[^.]+$/, '');
  const baseId = version.hostname || fallbackId;
  const id = uniqueSwitchId(baseId);

  const cdpNeighbors = commands.cdpNeighbor ? KLU.parsers.parseCdpNeighbor(commands.cdpNeighbor) : [];
  const portChannels = commands.portChannel ? KLU.parsers.parsePortChannelSummary(commands.portChannel) : [];
  const vlans = commands.vlan ? KLU.parsers.parseVlan(commands.vlan) : [];
  const ipRouteConnected = commands.ipRoute ? KLU.parsers.parseIpRoute(commands.ipRoute, version.platform) : [];
  const ipInterfaceBrief = commands.ipInterfaceBrief ? KLU.parsers.parseIpInterfaceBrief(commands.ipInterfaceBrief) : [];
  const macTable = commands.macAddressTable ? KLU.parsers.parseMacAddressTable(commands.macAddressTable) : [];
  const missingCommands = EXPECTED_COMMANDS.filter(k => !(k in commands));

  const sw = {
    id,
    hostname: version.hostname || fallbackId,
    platform: version.platform,
    model: version.model,
    fileName: file.name,
    raw: commands,
    parsed: { cdpNeighbors, portChannels, vlans, ipRouteConnected, ipInterfaceBrief, macTable },
    missingCommands,
    unrecognized
  };

  return { switch: sw };
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
      <span class="switch-platform badge badge-${sw.platform === 'nexus' ? 'nexus' : 'catalyst'}">${KLU.dom.escapeHtml(sw.platform)}</span>
      <span class="switch-hostname">${KLU.dom.escapeHtml(sw.hostname)}</span>
      <span class="switch-model">${KLU.dom.escapeHtml(sw.model) || '–'}</span>
      ${sw.missingCommands.length ? `<span class="switch-warning" title="Fehlende Kommandos: ${KLU.dom.escapeHtml(sw.missingCommands.join(', '))}">⚠ ${sw.missingCommands.length} fehlend</span>` : ''}
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

    KLU.on('switches:changed', renderSwitchList);
    renderSwitchList();
  }
};
