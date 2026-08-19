// L2-L3 Kommunikationsmatrix — Topologie-View: Cytoscape.js + cytoscape-fcose (siehe
// lib/, docs/THIRD_PARTY_LICENSES.md) statt handgezeichnetem SVG/eigener Kraft-Simulation —
// portiert aus dem Kollegen-Referenzprojekt "dora-the-explorer" (Layout-Technik, Detail-Panel,
// Suche-Integration, Export). Geräte-Icons bleiben die bereits eingeführten, handgezeichneten
// Symbole (Switch/Firewall/WLC/Access Point), jetzt als aufgelöste SVG-Data-URIs im Cytoscape-
// Stylesheet statt als DOM-<g>-Elemente.
KLU.views = KLU.views || {};

const PORT_LABEL_MIN_ZOOM = 1.5; // unter dieser Zoomstufe clustern Portlabels bei vielen Verbindungen zu dicht -> ausblenden statt unlesbar überlappen zu lassen

const DEVICE_TYPE_LABELS = {
  switch: 'Switch',
  firewall: 'Firewall',
  wlc: 'WLC',
  ap: 'Access Point',
  unknown: 'Unbekanntes Gerät'
};

const NODE_SIZE = { switch: 50, firewall: 46, wlc: 44, ap: 38, unknown: 40 };

let cy = null;
let fcoseRegistered = false;
let currentLayout = 'tree';
let currentGraph = { nodes: [], edgesAggregated: [], edgesIndividual: [] };
let currentActiveEdges = [];
let currentElementsKey = null;
let ICONS = {};

const LAYOUTS = {
  // Baum — Standard-Layout: schichtet Kern/Distribution/Access-Ebenen top-down, deterministisch.
  tree: {
    name: 'breadthfirst',
    animate: true,
    animationDuration: 500,
    fit: true,
    padding: 50,
    directed: false,
    spacingFactor: 1.3,
    avoidOverlap: true,
    nodeDimensionsIncludeLabels: true,
    grid: true,
    circle: false,
    maximal: false
  },
  // Kräfte — organische Alternative (fcose statt der früheren handgebauten Kraft-Simulation);
  // grosszügiger nodeSeparation/nodeRepulsion, damit dichte Hub-and-Spoke-Standorte (ein Kern-
  // Switch -> viele Access-Switches/APs) nicht wieder um den Hub herum zusammenklumpen.
  force: {
    name: 'fcose',
    quality: 'proof',
    randomize: true,
    animate: true,
    animationDuration: 600,
    fit: true,
    padding: 50,
    nodeSeparation: 140,
    nodeRepulsion: 12000,
    idealEdgeLength: 110,
    edgeElasticity: 0.45,
    gravity: 0.25,
    gravityRange: 3,
    numIter: 2500,
    tile: true,
    tilingPaddingVertical: 20,
    tilingPaddingHorizontal: 20,
    nodeDimensionsIncludeLabels: true,
    packComponents: true
  }
};

function resolveToken(varName) {
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
}

// Geometrie je Gerätetyp — dieselben handgezeichneten Systemsymbole wie zuvor (Switch = Gehäuse
// mit Ports, Firewall = Backstein-Mauer, WLC = Gehäuse mit Antenne, Access Point = Funksymbol,
// "unbekannt" bleibt das schlichte Rechteck), jetzt als SVG-Markup-String statt DOM-Elemente,
// da Cytoscape Icons nur über "background-image" (Data-URI) einbinden kann.
function iconMarkup(deviceType, fill, stroke) {
  const deco = `fill="none" stroke="${stroke}" stroke-width="2"`;
  switch (deviceType) {
    case 'firewall':
      return `
        <rect x="-20" y="-20" width="40" height="40" rx="2" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
        <line x1="-20" y1="-7" x2="20" y2="-7" ${deco}/>
        <line x1="-20" y1="6" x2="20" y2="6" ${deco}/>
        <line x1="0" y1="-20" x2="0" y2="-7" ${deco}/>
        <line x1="-10" y1="-7" x2="-10" y2="6" ${deco}/>
        <line x1="10" y1="-7" x2="10" y2="6" ${deco}/>
        <line x1="0" y1="6" x2="0" y2="20" ${deco}/>`;
    case 'wlc':
      return `
        <rect x="-14" y="4" width="28" height="14" rx="2" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
        <line x1="0" y1="4" x2="0" y2="-2" ${deco}/>
        <path d="M -6,-2 Q 0,-10 6,-2" ${deco}/>
        <path d="M -12,-2 Q 0,-18 12,-2" ${deco}/>`;
    case 'ap':
      return `
        <circle cx="0" cy="10" r="4" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
        <path d="M -5,6 Q 0,-2 5,6" ${deco}/>
        <path d="M -10,6 Q 0,-8 10,6" ${deco}/>
        <path d="M -15,6 Q 0,-14 15,6" ${deco}/>`;
    case 'unknown':
      return `<rect x="-19" y="-19" width="38" height="38" rx="4" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
    default: // switch
      return `
        <rect x="-22" y="-12" width="44" height="24" rx="3" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
        ${[-16, -8, 0, 8, 16].map(x => `<line x1="${x}" y1="2" x2="${x}" y2="8" ${deco}/>`).join('')}`;
  }
}

function iconDataUri(deviceType, fill, stroke) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-24 -24 48 48">${iconMarkup(deviceType, fill, stroke)}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// Geräte-Farbe bewusst einheitlich (var(--unknown-device) als neutraler Grundton für alle Typen,
// wie schon vor der Cytoscape-Portierung) — der Typ wird über die Icon-Form unterschieden, Farbe
// bleibt ausschliesslich Zuständen vorbehalten (fokussiert/hervorgehoben/ausgefallen/isoliert).
function rebuildIcons() {
  const fill = resolveToken('--surface');
  const stroke = resolveToken('--unknown-device');
  ICONS = {};
  for (const type of Object.keys(DEVICE_TYPE_LABELS)) ICONS[type] = iconDataUri(type, fill, stroke);
}

function liveTokens() {
  return {
    text: resolveToken('--text'),
    textMuted: resolveToken('--text-muted'),
    surface: resolveToken('--surface'),
    border: resolveToken('--border'),
    accent: resolveToken('--accent'),
    error: resolveToken('--error'),
    unknownDevice: resolveToken('--unknown-device')
  };
}

// Feste Light-Theme-Werte (identisch zu den Light-Tokens in css/base.css) für den PNG-Export im
// Report (js/views/report-export.js) — der Report ist immer hell/druckfreundlich, unabhängig vom
// gerade im Browser aktiven Theme (siehe REPORT_CSS dort).
function lightTokens() {
  return { text: '#1c2126', textMuted: '#6b7480', surface: '#ffffff', border: '#d8dce2', accent: '#005f9e', error: '#b3261e', unknownDevice: '#6b7480' };
}

function buildStylesheet(tokens) {
  const { text, textMuted, surface, border, accent, error, unknownDevice } = tokens || liveTokens();

  const sheet = [
    { selector: 'node', style: {
        'background-opacity': 0,
        'background-image': 'data(icon)',
        'background-fit': 'contain',
        width: 44,
        height: 44,
        shape: 'ellipse',
        'border-width': 0,
        label: 'data(label)',
        'font-size': 11,
        'font-weight': 400,
        color: text,
        'text-valign': 'bottom',
        'text-margin-y': 6,
        'text-background-color': surface,
        'text-background-opacity': 0.85,
        'text-background-padding': 2,
        'text-background-shape': 'roundrectangle',
        'text-max-width': 140,
        'transition-property': 'opacity, border-width, border-color',
        'transition-duration': '120ms'
      } },
    { selector: 'node[?isGroup]', style: {
        'background-opacity': 0.05,
        'background-color': accent,
        'background-image': 'none',
        shape: 'round-rectangle',
        'border-width': 1,
        'border-style': 'dashed',
        'border-color': border,
        label: 'data(label)',
        'font-size': 11,
        'font-weight': 600,
        color: textMuted,
        'text-valign': 'top',
        'text-halign': 'center',
        'text-margin-y': -8,
        padding: '24px'
      } },
    { selector: 'edge', style: {
        width: 1.6,
        'line-color': border,
        'curve-style': 'bezier',
        'control-point-step-size': 24,
        opacity: 0.9,
        label: 'data(label)',
        'font-size': 9,
        color: textMuted,
        'text-background-color': surface,
        'text-background-opacity': 0.85,
        'text-background-padding': 2,
        'text-rotation': 'autorotate',
        'text-opacity': 0,
        'transition-property': 'opacity, line-color, width',
        'transition-duration': '120ms'
      } },
    { selector: 'edge.show-port-label', style: { 'text-opacity': 1 } },

    { selector: '.dimmed', style: { opacity: 0.15 } },
    { selector: 'node.dimmed', style: { opacity: 0.3 } },

    // VLAN-Hervorhebung (Feature 8): nur dickerer Rand, keine Farbänderung — Farbe bleibt
    // Zuständen wie Fokus/Ausfall vorbehalten (s.o.).
    { selector: 'node.vlan-hi', style: { 'border-width': 4, 'border-color': unknownDevice } },

    { selector: 'node.nbr-hi', style: { 'border-width': 3, 'border-color': accent } },
    { selector: 'edge.edge-hi', style: { 'line-color': accent, width: 2.6, opacity: 1 } },

    // Klar sichtbare Markierung des aktuell per Klick fokussierten/ausgewählten Geräts.
    { selector: 'node.sel', style: {
        'border-width': 4,
        'border-color': accent,
        'overlay-color': accent,
        'overlay-opacity': 0.22,
        'overlay-padding': 6,
        'z-index': 99
      } },

    // Redundanz-/Ausfall-Simulation: simuliertes Ziel + dadurch isolierte Geräte klar hervorheben.
    { selector: 'node.failed', style: {
        'border-width': 4,
        'border-color': error,
        'border-style': 'dashed',
        'overlay-color': error,
        'overlay-opacity': 0.2,
        'overlay-padding': 6,
        'z-index': 98
      } },
    { selector: 'edge.failed', style: { 'line-color': error, 'line-style': 'dashed', width: 3, opacity: 1 } },
    { selector: 'node.isolated', style: {
        'border-width': 3,
        'border-color': error,
        'overlay-color': error,
        'overlay-opacity': 0.28,
        'overlay-padding': 6
      } }
  ];

  for (const [type, size] of Object.entries(NODE_SIZE)) {
    sheet.splice(1, 0, { selector: `node[type="${type}"]`, style: { width: size, height: size } });
  }
  return sheet;
}

function hostnameOfNode(nodeId, nodes) {
  return KLU.anonymize.hostname(nodes.find(n => n.id === nodeId)?.hostname || nodeId);
}

// Switch-Knoten, auf denen das aktuell ausgewählte VLAN existiert (Feature 8) — null, wenn kein
// VLAN ausgewählt ist (dann keine Hervorhebung).
function vlanHighlightSwitchIds(switches) {
  if (KLU.state.selectedVlan == null) return null;
  const vlan = KLU.vlanModel.build(switches).find(v => v.vlanId === KLU.state.selectedVlan);
  return new Set(vlan?.switchesWithVlan || []);
}

// Ergebnis-Overlay der Ausfall-Simulation — reine Erreichbarkeits-Analyse auf dem Graphen, keine
// Aussage über Konvergenzzeit/Performance.
function renderFailureSimResult(result, target, nodes) {
  const box = document.getElementById('failure-sim-result');
  if (!box) return;
  if (!KLU.state.failureSimActive) {
    box.classList.remove('open');
    box.innerHTML = '';
    return;
  }
  box.classList.add('open');
  if (!target) {
    box.innerHTML = '<p class="hint">Klicke auf einen Switch-Knoten oder eine Verbindung, um deren Ausfall zu simulieren.</p>';
    return;
  }
  const targetLabel = target.type === 'node' ? hostnameOfNode(target.id, nodes) : 'dieser Verbindung';
  if (!result || result.isolatedNodeIds.size === 0) {
    box.innerHTML = `<p><strong>Ausfall von ${KLU.dom.escapeHtml(targetLabel)}:</strong> Netz bleibt zusammenhängend, keine Geräte isoliert.</p>`;
    return;
  }
  const names = Array.from(result.isolatedNodeIds).map(id => hostnameOfNode(id, nodes)).map(KLU.dom.escapeHtml).join(', ');
  box.innerHTML = `<p><strong>Ausfall von ${KLU.dom.escapeHtml(targetLabel)}:</strong> ${result.isolatedNodeIds.size} Gerät(e) wären isoliert: ${names}</p>`;
}

// Legende ist zugleich Geräte-Typ-Filter: Checkbox pro Typ blendet dessen Knoten/Kanten aus.
function renderLegend() {
  const legend = document.getElementById('topology-legend');
  if (!legend) return;
  legend.innerHTML = '';
  for (const [type, label] of Object.entries(DEVICE_TYPE_LABELS)) {
    const item = document.createElement('label');
    item.className = 'topology-legend-item';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = !KLU.state.hiddenDeviceTypes.has(type);
    checkbox.dataset.deviceType = type;
    item.appendChild(checkbox);
    const icon = document.createElement('img');
    icon.className = 'topology-legend-icon';
    icon.src = ICONS[type];
    icon.alt = '';
    item.appendChild(icon);
    item.appendChild(document.createTextNode(label));
    legend.appendChild(item);
  }
}

function showEmptyHint(show) {
  document.getElementById('topology-empty-hint')?.classList.toggle('open', show);
}

function openDetailPanel() {
  document.getElementById('topology-detail-panel')?.classList.add('open');
}

function closeDetailPanel() {
  document.getElementById('topology-detail-panel')?.classList.remove('open');
}

function detailCell(k, v, full) {
  if (v == null || v === '') return '';
  return `<div class="topology-detail-cell${full ? ' full' : ''}"><div class="k">${KLU.dom.escapeHtml(k)}</div><div class="v">${KLU.dom.escapeHtml(v)}</div></div>`;
}

// Detail-Panel (aus dora-the-explorer übernommen): Kopf (Icon/Typ/Hostname), Geräte-Stammdaten
// (nur für importierte Switches bekannt — ein per CDP/LLDP erkannter, aber nicht importierter
// Nachbar hat kein Modell/keine Version), Nachbarliste mit Portbezeichnungen je Verbindung.
function fillDetail(node) {
  const d = node.data();
  const iconEl = document.getElementById('topology-detail-icon');
  if (iconEl) { iconEl.src = d.icon; iconEl.alt = DEVICE_TYPE_LABELS[d.type] || d.type; }
  const typeEl = document.getElementById('topology-detail-type');
  if (typeEl) typeEl.textContent = DEVICE_TYPE_LABELS[d.type] || d.type;
  const nameEl = document.getElementById('topology-detail-name');
  if (nameEl) nameEl.textContent = d.label;

  const sw = KLU.state.getSwitches().find(s => s.id === node.id());
  const body = document.getElementById('topology-detail-body');
  if (body) {
    body.innerHTML = sw
      ? detailCell('Plattform', sw.platform === 'nexus' ? 'Nexus' : 'Catalyst')
        + detailCell('Modell', sw.model)
        + detailCell('OS-Version', sw.osVersion, true)
      : '<div class="topology-detail-cell full"><div class="v hint">Nicht importierter CDP-/LLDP-Nachbar — keine weiteren Details bekannt.</div></div>';
  }

  const rows = [];
  node.connectedEdges().forEach(e => {
    const ed = e.data();
    const otherId = ed.source === node.id() ? ed.target : ed.source;
    const myPort = ed.source === node.id() ? ed.sourcePort : ed.targetPort;
    const theirPort = ed.source === node.id() ? ed.targetPort : ed.sourcePort;
    const other = cy.getElementById(otherId);
    if (other.empty()) return;
    rows.push({ id: otherId, label: other.data('label'), icon: other.data('icon'), myPort, theirPort });
  });
  rows.sort((a, b) => a.label.localeCompare(b.label));

  const countEl = document.getElementById('topology-detail-neighbor-count');
  if (countEl) countEl.textContent = `${rows.length} Verbindung${rows.length === 1 ? '' : 'en'}`;
  const list = document.getElementById('topology-detail-neighbor-list');
  if (!list) return;
  list.innerHTML = rows.map(r => `
    <div class="topology-detail-neighbor-row" data-go="${KLU.dom.escapeHtml(r.id)}">
      <img src="${r.icon}" alt="">
      <div class="topology-detail-neighbor-main">
        <div class="topology-detail-neighbor-name">${KLU.dom.escapeHtml(r.label)}</div>
        <div class="topology-detail-neighbor-path">${KLU.dom.escapeHtml(r.myPort || '?')} ↔ ${KLU.dom.escapeHtml(r.theirPort || '?')}</div>
      </div>
    </div>`).join('') || '<p class="hint">Keine Verbindungen.</p>';
  list.querySelectorAll('.topology-detail-neighbor-row').forEach(el => {
    el.addEventListener('click', () => KLU.state.selectSwitchFocus(el.dataset.go));
  });
}

function recenterOnNode(node) {
  const container = document.getElementById('topology-canvas');
  if (!container) return;
  const nhood = node.closedNeighborhood().filter(':visible');
  const w = container.clientWidth || 800, h = container.clientHeight || 500;
  const bb = nhood.boundingBox({ includeLabels: false });
  if (bb.w === 0) bb.w = 1;
  if (bb.h === 0) bb.h = 1;
  const pad = 70;
  let zoom = Math.min((w - pad * 2) / bb.w, (h - pad * 2) / bb.h, 2);
  zoom = Math.max(zoom, cy.minZoom());
  const panX = w / 2 - zoom * (bb.x1 + bb.w / 2);
  const panY = h / 2 - zoom * (bb.y1 + bb.h / 2);
  cy.animate({ zoom, pan: { x: panX, y: panY } }, { duration: 300, easing: 'ease-out-cubic' });
}

function updatePortLabelVisibility() {
  if (!cy) return;
  const show = KLU.state.showPortLabels && cy.zoom() >= PORT_LABEL_MIN_ZOOM;
  cy.edges().toggleClass('show-port-label', show);
}

// Über die Legende ausgeblendete Gerätetypen: Knoten UND ihre Kanten verstecken (Gruppen-Knoten
// selbst sind kein Gerätetyp und daher nie über die Legende ausblendbar).
function applyTypeVisibility() {
  if (!cy) return;
  cy.batch(() => {
    cy.nodes().forEach(n => {
      if (n.data('isGroup')) return;
      const hidden = KLU.state.hiddenDeviceTypes.has(n.data('type'));
      n.style('display', hidden ? 'none' : 'element');
    });
    cy.edges().forEach(e => {
      const hidden = e.source().style('display') === 'none' || e.target().style('display') === 'none';
      e.style('display', hidden ? 'none' : 'element');
    });
  });
}

// Fasst alle rein zustandsabhängigen Klassen zusammen (VLAN-Hervorhebung, Fokus/Auswahl +
// Nachbarschafts-Dimmung, Ausfall-Simulation) — läuft NIE über einen Element-Neuaufbau, damit
// Klicks/Toggles nicht bei jedem Aufruf Zoom/Pan/manuell verschobene Positionen verwerfen.
function applyStateClasses() {
  if (!cy) return;
  cy.batch(() => {
    cy.elements().removeClass('dimmed nbr-hi sel edge-hi failed isolated vlan-hi');

    const highlightSet = vlanHighlightSwitchIds(KLU.state.getSwitches());
    if (highlightSet) {
      cy.nodes().forEach(n => { if (highlightSet.has(n.id())) n.addClass('vlan-hi'); });
    }

    const focusId = KLU.state.selectedSwitchFocus;
    const focusNode = focusId ? cy.getElementById(focusId) : null;
    if (focusNode && focusNode.length && !focusNode.empty()) {
      const nhood = focusNode.closedNeighborhood();
      cy.elements().not(nhood).addClass('dimmed');
      focusNode.neighborhood('node').addClass('nbr-hi');
      focusNode.connectedEdges().addClass('edge-hi');
      focusNode.addClass('sel');
    }

    let failureResult = null;
    const target = KLU.state.failureSimActive ? KLU.state.failureSimTarget : null;
    if (target?.type === 'node') {
      cy.getElementById(target.id).addClass('failed');
      failureResult = KLU.failureSimModel.simulateNodeFailure(currentGraph.nodes, currentActiveEdges, target.id);
    } else if (target?.type === 'edge') {
      cy.getElementById(target.id).addClass('failed');
      failureResult = KLU.failureSimModel.simulateEdgeFailure(currentGraph.nodes, currentActiveEdges, target.id);
    }
    if (failureResult) {
      for (const id of failureResult.isolatedNodeIds) cy.getElementById(id).addClass('isolated');
    }
    renderFailureSimResult(KLU.state.failureSimActive ? failureResult : null, target, currentGraph.nodes);
  });
}

function refreshLabels() {
  if (!cy) return;
  const byId = new Map(currentGraph.nodes.map(n => [n.id, n]));
  cy.nodes().forEach(n => {
    if (n.data('isGroup')) return;
    const orig = byId.get(n.id());
    if (orig) n.data('label', KLU.anonymize.hostname(orig.hostname || orig.id));
  });
}

function buildElements(graph, activeEdges, groupMap) {
  const elements = [];
  if (groupMap) {
    for (const group of new Set(groupMap.values())) {
      elements.push({ group: 'nodes', data: { id: `group:${group}`, label: group, isGroup: true } });
    }
  }
  for (const node of graph.nodes) {
    const data = {
      id: node.id,
      label: KLU.anonymize.hostname(node.hostname || node.id),
      type: node.deviceType,
      icon: ICONS[node.deviceType] || ICONS.unknown
    };
    if (groupMap) data.parent = `group:${groupMap.get(node.id)}`;
    elements.push({ group: 'nodes', data });
  }
  for (const e of activeEdges) {
    const firstMember = e.members?.[0];
    const sourcePort = e.poLabelA || firstMember?.aPort || e.aPort;
    const targetPort = e.poLabelB || firstMember?.bPort || e.bPort;
    const memberCount = e.members?.length || 1;
    const label = memberCount > 1 ? `${sourcePort} ↔ ${targetPort} (${memberCount} Member)` : `${sourcePort} ↔ ${targetPort}`;
    elements.push({ group: 'edges', data: { id: e.id, source: e.a, target: e.b, sourcePort, targetPort, label } });
  }
  return elements;
}

function computeElementsKey(graph, activeEdges, groupMap) {
  const n = graph.nodes.map(x => x.id).sort().join(',');
  const e = activeEdges.map(x => x.id).sort().join(',');
  const g = groupMap ? Array.from(groupMap.entries()).sort().join(',') : '';
  return `${n}|${e}|${g}`;
}

// Baum-Layout soll immer bei der Firewall starten (Wurzel = Ebene 0, ganz oben) statt beim
// Knoten mit dem höchsten Verbindungsgrad — im Kundennetz ist die Firewall der eigentliche
// Netzübergang und steht fachlich "über" den Core-Switches, auch wenn ein Core-Switch rein nach
// Kantenzahl höher vernetzt sein kann. Mehrere Firewalls (Redundanz-Paar) werden gleichberechtigt
// beide als Wurzel übergeben und landen dadurch nebeneinander auf Ebene 0. Ohne (sichtbare)
// Firewall im Graphen wählt breadthfirst automatisch geeignete Wurzeln (bisheriges Verhalten).
function pickTreeRoots(eles) {
  const firewalls = eles.nodes('[type="firewall"]');
  return firewalls.length ? firewalls : null;
}

function runLayout(name, animate) {
  if (!cy) return;
  if (!LAYOUTS[name]) name = 'tree';
  currentLayout = name;
  const visible = cy.elements(':visible');
  const eles = visible.length ? visible : cy.elements();
  // breadthfirst haengt vom aktuellen Ausgangspositionen ab — nach einer Legendenfilter-Aenderung
  // waere die Anordnung sonst verzerrt (siehe dora-the-explorer). Grid-Vorlauf normalisiert.
  if (name === 'tree') eles.layout({ name: 'grid', animate: false }).run();
  const opts = Object.assign({}, LAYOUTS[name], { eles, animate: animate !== false });
  if (name === 'tree') {
    const roots = pickTreeRoots(eles);
    if (roots) opts.roots = roots;
  }
  cy.layout(opts).run();
}

function renderTopology() {
  if (!cy) return;
  const switches = KLU.state.getSwitches();
  const graph = KLU.topology.buildGraph(switches);
  const activeEdges = KLU.state.linkMode === 'individual' ? graph.edgesIndividual : graph.edgesAggregated;
  const groupMap = KLU.state.siteGroupingActive ? KLU.siteGroupModel.buildNodeGroupMap(graph.nodes) : null;

  currentGraph = graph;
  currentActiveEdges = activeEdges;

  showEmptyHint(graph.nodes.length === 0);
  if (graph.nodes.length === 0) {
    cy.elements().remove();
    currentElementsKey = null;
    if (KLU.state.selectedSwitchFocus) KLU.state.selectSwitchFocus(KLU.state.selectedSwitchFocus); // löscht stale Fokus, schließt Detail-Panel
    return;
  }

  const key = computeElementsKey(graph, activeEdges, groupMap);
  if (key !== currentElementsKey) {
    const hadElements = cy.elements().length > 0;
    cy.elements().remove();
    cy.add(buildElements(graph, activeEdges, groupMap));
    currentElementsKey = key;
    applyTypeVisibility();
    runLayout(currentLayout, hadElements);
    // Fokus auf einen mittlerweile entfernten Knoten (z.B. Switch entfernt) räumen, statt ein
    // veraltetes Detail-Panel offen zu lassen.
    if (KLU.state.selectedSwitchFocus && cy.getElementById(KLU.state.selectedSwitchFocus).empty()) {
      KLU.state.selectSwitchFocus(KLU.state.selectedSwitchFocus);
    }
  }

  refreshLabels();
  applyStateClasses();
  updatePortLabelVisibility();
}

function exportFilenameTag() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function exportPNG() {
  const blob = cy.png({ output: 'blob', bg: resolveToken('--surface'), full: true, scale: 2 });
  downloadBlob(blob, `topologie-${exportFilenameTag()}.png`);
}

function exportCSV() {
  const rows = cy.nodes(':visible').filter(n => !n.data('isGroup')).map(n => {
    const d = n.data();
    const sw = KLU.state.getSwitches().find(s => s.id === n.id());
    return [d.label, DEVICE_TYPE_LABELS[d.type] || d.type, sw ? (sw.platform === 'nexus' ? 'Nexus' : 'Catalyst') : '', sw?.model || '', sw?.osVersion || ''];
  });
  const csv = KLU.csvExport.toCsv(['Hostname', 'Typ', 'Plattform', 'Modell', 'OS-Version'], rows);
  KLU.csvExport.download(`topologie-${exportFilenameTag()}.csv`, csv);
}

function exportJSON() {
  const nodes = cy.nodes(':visible').filter(n => !n.data('isGroup')).map(n => {
    const d = n.data();
    const sw = KLU.state.getSwitches().find(s => s.id === n.id());
    return { id: n.id(), hostname: d.label, type: d.type, platform: sw?.platform || null, model: sw?.model || null, osVersion: sw?.osVersion || null, external: !sw };
  });
  const edges = cy.edges(':visible').map(e => {
    const d = e.data();
    return { source: d.source, target: d.target, sourcePort: d.sourcePort, targetPort: d.targetPort };
  });
  const blob = new Blob([JSON.stringify({ nodes, edges }, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `topologie-${exportFilenameTag()}.json`);
}

// Für den Report-Export (js/views/report-export.js): Cytoscape rendert in ein eigenes internes
// <canvas> statt eines DOM-Baums — ein simples outerHTML-Snapshot wie früher beim SVG liefert
// hier keine Pixel (Canvas-Inhalt ist nicht Teil des DOM-Serialisierung). Stattdessen kurz auf
// die festen Light-Theme-Werte umschalten (der Report ist immer hell, siehe REPORT_CSS), PNG
// rendern und sofort das Live-Theme wiederherstellen — synchron, daher kein sichtbares Aufblitzen.
function snapshotLightPng() {
  if (!cy) return null;
  const tokens = lightTokens();
  const currentIcons = ICONS;
  const savedStyleJson = cy.style().json();

  const lightIcons = {};
  for (const type of Object.keys(DEVICE_TYPE_LABELS)) lightIcons[type] = iconDataUri(type, tokens.surface, tokens.unknownDevice);
  cy.nodes().forEach(n => { if (!n.data('isGroup')) n.data('icon', lightIcons[n.data('type')] || lightIcons.unknown); });
  cy.style(buildStylesheet(tokens));

  const dataUrl = cy.png({ output: 'base64uri', full: true, scale: 2, bg: tokens.surface });

  cy.style().fromJson(savedStyleJson).update();
  cy.nodes().forEach(n => { if (!n.data('isGroup')) n.data('icon', currentIcons[n.data('type')] || currentIcons.unknown); });

  return dataUrl;
}

function initCytoscape(container) {
  if (!fcoseRegistered && typeof cytoscape !== 'undefined' && typeof cytoscapeFcose !== 'undefined') {
    cytoscape.use(cytoscapeFcose);
    fcoseRegistered = true;
  }
  cy = cytoscape({ container, minZoom: 0.15, maxZoom: 4, wheelSensitivity: 0.6, style: buildStylesheet() });

  cy.on('zoom', updatePortLabelVisibility);

  cy.on('tap', 'node', evt => {
    if (evt.target.data('isGroup')) return;
    const id = evt.target.id();
    if (KLU.state.failureSimActive) { KLU.state.setFailureSimTarget({ type: 'node', id }); return; }
    KLU.state.selectSwitchFocus(id);
  });
  cy.on('tap', 'edge', evt => {
    if (!KLU.state.failureSimActive) return;
    KLU.state.setFailureSimTarget({ type: 'edge', id: evt.target.id() });
  });
  cy.on('tap', evt => {
    if (evt.target !== cy) return;
    if (KLU.state.selectedSwitchFocus) KLU.state.selectSwitchFocus(KLU.state.selectedSwitchFocus); // Klick auf leere Fläche hebt Auswahl auf
  });

  cy.on('mouseover', 'node', () => { document.body.style.cursor = 'pointer'; });
  cy.on('mouseover', 'edge', () => { if (KLU.state.failureSimActive) document.body.style.cursor = 'pointer'; });
  cy.on('mouseout', 'node, edge', () => { document.body.style.cursor = 'default'; });
}

KLU.views.topology = {
  init() {
    const container = document.getElementById('topology-canvas');
    if (container && typeof cytoscape !== 'undefined') {
      rebuildIcons();
      initCytoscape(container);
    }

    const linkModeToggle = document.getElementById('link-mode-toggle');
    linkModeToggle?.addEventListener('change', () => {
      KLU.state.linkMode = linkModeToggle.checked ? 'individual' : 'aggregated';
      renderTopology();
    });

    const portLabelToggle = document.getElementById('port-label-toggle');
    portLabelToggle?.addEventListener('change', () => KLU.state.setShowPortLabels(portLabelToggle.checked));

    const failureSimToggle = document.getElementById('failure-sim-toggle');
    failureSimToggle?.addEventListener('change', () => KLU.state.setFailureSimActive(failureSimToggle.checked));

    const siteGroupingToggle = document.getElementById('site-grouping-toggle');
    siteGroupingToggle?.addEventListener('change', () => KLU.state.setSiteGroupingActive(siteGroupingToggle.checked));

    // Ansichtsoptionen in ein Popover ausgelagert statt permanent Toolbar-Höhe zu belegen.
    const settingsToggle = document.getElementById('topology-settings-toggle');
    const settingsPopover = document.getElementById('topology-settings-popover');
    settingsToggle?.addEventListener('click', e => {
      e.stopPropagation();
      const open = settingsPopover.classList.toggle('open');
      settingsToggle.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', e => {
      if (settingsPopover?.classList.contains('open') && !e.target.closest('.topology-settings')) {
        settingsPopover.classList.remove('open');
        settingsToggle?.setAttribute('aria-expanded', 'false');
      }
    });

    document.getElementById('topology-layout-toggle')?.addEventListener('click', e => {
      const btn = e.target.closest('button[data-layout]');
      if (!btn) return;
      document.querySelectorAll('#topology-layout-toggle button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      runLayout(btn.dataset.layout, true);
    });

    document.getElementById('topology-zoom-in')?.addEventListener('click', () => {
      cy?.animate({ zoom: cy.zoom() * 1.3, center: { eles: cy.nodes(':visible') } }, { duration: 150 });
    });
    document.getElementById('topology-zoom-out')?.addEventListener('click', () => {
      cy?.animate({ zoom: cy.zoom() / 1.3, center: { eles: cy.nodes(':visible') } }, { duration: 150 });
    });
    document.getElementById('topology-zoom-reset')?.addEventListener('click', () => {
      cy?.animate({ fit: { eles: cy.nodes(':visible'), padding: 50 } }, { duration: 250 });
    });

    document.getElementById('topology-fullscreen-toggle')?.addEventListener('click', () => {
      const panel = document.getElementById('topology-panel');
      if (!panel) return;
      if (document.fullscreenElement) document.exitFullscreen();
      else panel.requestFullscreen();
    });
    document.addEventListener('fullscreenchange', () => cy?.resize());

    document.getElementById('topology-legend')?.addEventListener('change', e => {
      const checkbox = e.target.closest('input[type=checkbox]');
      if (checkbox) KLU.state.toggleDeviceTypeVisibility(checkbox.dataset.deviceType);
    });

    document.getElementById('topology-detail-close')?.addEventListener('click', () => {
      if (KLU.state.selectedSwitchFocus) KLU.state.selectSwitchFocus(KLU.state.selectedSwitchFocus);
    });

    const exportToggle = document.getElementById('topology-export-toggle');
    const exportMenu = document.getElementById('topology-export-menu');
    exportToggle?.addEventListener('click', e => {
      e.stopPropagation();
      const open = exportMenu.classList.toggle('open');
      exportToggle.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', e => {
      if (exportMenu?.classList.contains('open') && !e.target.closest('.topology-export')) {
        exportMenu.classList.remove('open');
        exportToggle?.setAttribute('aria-expanded', 'false');
      }
    });
    exportMenu?.addEventListener('click', e => {
      const btn = e.target.closest('button[data-export]');
      if (!btn || !cy) return;
      exportMenu.classList.remove('open');
      exportToggle?.setAttribute('aria-expanded', 'false');
      if (btn.dataset.export === 'png') exportPNG();
      else if (btn.dataset.export === 'csv') exportCSV();
      else exportJSON();
    });

    KLU.on('switches:changed', renderTopology);
    KLU.on('vlan:selected', applyStateClasses);
    KLU.on('switchFocus:selected', id => {
      applyStateClasses();
      if (!cy) return;
      if (id) {
        const node = cy.getElementById(id);
        if (!node.empty()) { fillDetail(node); openDetailPanel(); recenterOnNode(node); }
      } else {
        closeDetailPanel();
      }
    });
    KLU.on('portLabels:changed', updatePortLabelVisibility);
    KLU.on('deviceTypeVisibility:changed', applyTypeVisibility);
    KLU.on('failureSim:changed', applyStateClasses);
    KLU.on('siteGrouping:changed', renderTopology);
    KLU.on('anonymize:changed', refreshLabels);
    KLU.on('theme:changed', () => {
      if (!cy) return;
      rebuildIcons();
      cy.nodes().forEach(n => { if (!n.data('isGroup')) n.data('icon', ICONS[n.data('type')] || ICONS.unknown); });
      cy.style(buildStylesheet());
      renderLegend();
      if (KLU.state.selectedSwitchFocus) {
        const node = cy.getElementById(KLU.state.selectedSwitchFocus);
        if (!node.empty()) fillDetail(node);
      }
    });

    window.addEventListener('resize', () => cy?.resize());

    renderLegend();
    renderTopology();
  },

  // Für js/views/report-export.js — Data-URI eines Light-Theme-PNG-Snapshots der aktuellen
  // Topologie, oder null, wenn (noch) keine Cytoscape-Instanz existiert (z.B. lib/ fehlgeschlagen
  // geladen).
  snapshotLightPng
};
