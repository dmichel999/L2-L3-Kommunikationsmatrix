// L2-L3 Kommunikationsmatrix — Topologie-View: Kraft-basiertes Layout + SVG-Rendering,
// Geräte-Icons je Typ (Switch/Firewall/WLC/Access Point/unbekannt), Knoten per Drag verschiebbar.
KLU.views = KLU.views || {};

const SVG_NS = 'http://www.w3.org/2000/svg';
let cachedPositions = null;
let cachedNodeIds = null;
const activeDrags = new Map(); // pointerId -> { nodeId, startX, startY, moved }, Multi-Touch-sicher
const CLICK_MOVE_THRESHOLD = 5; // px, unterscheidet "Klick" (Switch-Fokus-Filter) von "Drag" (Verschieben)
const ZOOM_MIN = 0.3;
const ZOOM_MAX = 4;
const PORT_LABEL_MIN_ZOOM = 1.5; // unter dieser Zoomstufe clustern die Label bei vielen Verbindungen zu dicht -> ausblenden statt unlesbar überlappen zu lassen
const zoomState = { scale: 1, tx: 0, ty: 0 }; // Pan/Zoom-Transform der Zoom-Layer, pro Sitzung gemerkt

const DEVICE_TYPE_LABELS = {
  switch: 'Switch',
  firewall: 'Firewall',
  wlc: 'WLC',
  ap: 'Access Point',
  unknown: 'Unbekanntes Gerät'
};

function computeLayout(nodes, edges, width, height) {
  const positions = new Map(nodes.map(n => [n.id, { x: width / 2 + (Math.random() - 0.5) * 200, y: height / 2 + (Math.random() - 0.5) * 200 }]));
  const k = 110;

  for (let iter = 0; iter < 300; iter++) {
    const forces = new Map(nodes.map(n => [n.id, { x: 0, y: 0 }]));

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = positions.get(nodes[i].id), b = positions.get(nodes[j].id);
        const dx = a.x - b.x, dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const force = (k * k) / dist;
        const fx = (dx / dist) * force, fy = (dy / dist) * force;
        forces.get(nodes[i].id).x += fx; forces.get(nodes[i].id).y += fy;
        forces.get(nodes[j].id).x -= fx; forces.get(nodes[j].id).y -= fy;
      }
    }

    for (const e of edges) {
      const a = positions.get(e.a), b = positions.get(e.b);
      if (!a || !b) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const force = ((dist * dist) / k) * 0.05;
      const fx = (dx / dist) * force, fy = (dy / dist) * force;
      forces.get(e.a).x += fx; forces.get(e.a).y += fy;
      forces.get(e.b).x -= fx; forces.get(e.b).y -= fy;
    }

    for (const n of nodes) {
      const f = forces.get(n.id), p = positions.get(n.id);
      p.x += Math.max(-10, Math.min(10, f.x * 0.01));
      p.y += Math.max(-10, Math.min(10, f.y * 0.01));
      p.x = Math.max(40, Math.min(width - 40, p.x));
      p.y = Math.max(40, Math.min(height - 40, p.y));
    }
  }

  return positions;
}

function getPositions(nodes, edgesForLayout, width, height) {
  const nodeIdsKey = nodes.map(n => n.id).sort().join(',');
  if (cachedPositions && cachedNodeIds === nodeIdsKey) return cachedPositions;
  cachedPositions = computeLayout(nodes, edgesForLayout, width, height);
  cachedNodeIds = nodeIdsKey;
  return cachedPositions;
}

function svgEl(tag, attrs) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v);
  return el;
}

function groupEdgesByPair(edges) {
  const byPair = new Map();
  for (const e of edges) {
    const key = [e.a, e.b].sort().join('|');
    if (!byPair.has(key)) byPair.set(key, []);
    byPair.get(key).push(e);
  }
  return byPair;
}

// Geometrie je Gerätetyp — eigene Form statt nur Farbe, damit der Typ auch ohne Farbsehen
// erkennbar ist. Alle Formen sind um den Ursprung zentriert (Elternknoten übernimmt translate).
function nodeShapeElement(deviceType) {
  switch (deviceType) {
    case 'firewall':
      return svgEl('polygon', { points: '0,-24 24,0 0,24 -24,0' });
    case 'wlc':
      return svgEl('polygon', { points: '22,0 11,19 -11,19 -22,0 -11,-19 11,-19' });
    case 'ap':
      return svgEl('polygon', { points: '0,-24 21,13 -21,13' });
    case 'unknown':
      return svgEl('rect', { x: -19, y: -19, width: 38, height: 38, rx: 4 });
    default: // switch
      return svgEl('circle', { r: 22 });
  }
}

function nodeClasses(node, dimSet, highlightSet) {
  const classes = ['topology-node', `type-${node.deviceType}`];
  // node.platform ist nur bei importierten Switches gesetzt — ein per CDP erkannter, aber
  // nicht importierter Switch-Nachbar bekommt bewusst KEINE Catalyst/Nexus-Farbe (unbekannt).
  if (node.deviceType === 'switch' && node.platform) classes.push(`platform-${node.platform === 'nexus' ? 'nexus' : 'catalyst'}`);
  if (highlightSet?.has(node.id)) classes.push('highlighted');
  if (dimSet?.has(node.id)) classes.push('dimmed');
  return classes.join(' ');
}

// Switch-Knoten, auf denen das aktuell ausgewählte VLAN existiert (Feature 8 der Erweiterung) —
// null, wenn kein VLAN ausgewählt ist (dann findet keine Hervorhebung/Abdunklung statt.
function vlanHighlightSwitchIds(switches) {
  if (KLU.state.selectedVlan == null) return null;
  const vlan = KLU.vlanModel.build(switches).find(v => v.vlanId === KLU.state.selectedVlan);
  return new Set(vlan?.switchesWithVlan || []);
}

// Knoten, die über mind. eine Kante mit dem fokussierten Switch verbunden sind (Feature 10).
function neighborsOfFocus(edges, focusId) {
  const set = new Set([focusId]);
  for (const e of edges) {
    if (e.a === focusId) set.add(e.b);
    if (e.b === focusId) set.add(e.a);
  }
  return set;
}

// Liefert einen Bildschirmpunkt in Roh-viewBox-Koordinaten (VOR Anwendung des Zoom-Layer-Transforms).
function viewBoxPointFromEvent(e, svg) {
  const rect = svg.getBoundingClientRect();
  const viewBox = svg.viewBox.baseVal;
  // Falls das SVG gerade unsichtbar/kollabiert ist (z.B. Tab-Wechsel während des Drags),
  // rect.width/height wäre 0 -> Division durch 0 (Infinity/NaN) vermeiden, Skalierung 1 annehmen.
  const scaleX = rect.width ? viewBox.width / rect.width : 1;
  const scaleY = rect.height ? viewBox.height / rect.height : 1;
  return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
}

// Liefert die Position eines Bildschirmpunkts in der unveränderten "Welt"-Koordinate der
// Knoten-Positionen (also mit dem Zoom-Layer-Transform herausgerechnet) — wird für Drag & Drop
// gebraucht, damit ein Knoten unter dem Mauszeiger bleibt, egal wie weit gerade gezoomt ist.
function svgPointFromEvent(e, svg) {
  const p = viewBoxPointFromEvent(e, svg);
  return { x: (p.x - zoomState.tx) / zoomState.scale, y: (p.y - zoomState.ty) / zoomState.scale };
}

function setZoom(newScale, centerX, centerY) {
  const clamped = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, newScale));
  // Weltpunkt unter (centerX, centerY) soll nach dem Zoom an derselben Bildschirmstelle bleiben.
  zoomState.tx = centerX - ((centerX - zoomState.tx) / zoomState.scale) * clamped;
  zoomState.ty = centerY - ((centerY - zoomState.ty) / zoomState.scale) * clamped;
  zoomState.scale = clamped;
  renderTopology();
}

function resetZoom() {
  zoomState.scale = 1;
  zoomState.tx = 0;
  zoomState.ty = 0;
  renderTopology();
}

function renderTopology() {
  const svg = document.getElementById('topology-canvas');
  if (!svg) return;
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const graph = KLU.topology.buildGraph(KLU.state.getSwitches());
  const width = svg.clientWidth || 800;
  const height = svg.clientHeight || 500;
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

  if (graph.nodes.length === 0) {
    const text = svgEl('text', { x: width / 2, y: height / 2, 'text-anchor': 'middle', class: 'topology-empty-hint' });
    text.textContent = 'Noch keine Switches importiert.';
    svg.appendChild(text);
    return;
  }

  const positions = getPositions(graph.nodes, graph.edgesAggregated, width, height);
  const activeEdges = KLU.state.linkMode === 'individual' ? graph.edgesIndividual : graph.edgesAggregated;
  const edgesByPair = groupEdgesByPair(activeEdges);

  const highlightSet = vlanHighlightSwitchIds(KLU.state.getSwitches());
  const focusId = KLU.state.selectedSwitchFocus;
  const focusNeighbors = focusId ? neighborsOfFocus(activeEdges, focusId) : null;
  // Über die Legende ausgeblendete Gerätetypen: Knoten UND ihre Kanten verstecken.
  const visibleIds = new Set(graph.nodes.filter(n => !KLU.state.hiddenDeviceTypes.has(n.deviceType)).map(n => n.id));

  const zoomLayer = svgEl('g', { class: 'zoom-layer', transform: `translate(${zoomState.tx},${zoomState.ty}) scale(${zoomState.scale})` });
  const edgeLayer = svgEl('g', { class: 'edge-layer' });
  const nodeLayer = svgEl('g', { class: 'node-layer' });

  for (const [, group] of edgesByPair) {
    group.forEach((e, idx) => {
      if (!visibleIds.has(e.a) || !visibleIds.has(e.b)) return;
      const a = positions.get(e.a), b = positions.get(e.b);
      if (!a || !b) return;
      const offset = (idx - (group.length - 1) / 2) * 10;
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const perpX = (-dy / len) * offset, perpY = (dx / len) * offset;
      const x1 = a.x + perpX, y1 = a.y + perpY, x2 = b.x + perpX, y2 = b.y + perpY;

      const edgeDimmed = focusNeighbors && !(focusNeighbors.has(e.a) && focusNeighbors.has(e.b));
      const line = svgEl('line', {
        x1, y1, x2, y2,
        class: `topology-link${edgeDimmed ? ' dimmed' : ''}`
      });
      // Aggregierte Kanten (e.members) haben KEIN eigenes aPort/bPort — nur bei einem echten
      // Port-Channel-Bündel ist poLabelA/poLabelB gesetzt; eine aggregierte Einzelverbindung
      // (kein Bündel) muss auf den Port des einzigen Members zurückfallen, sonst zeigt das Label
      // "undefined ↔ undefined" und wirkt, als würde gar kein Label angezeigt.
      const firstMember = e.members?.[0];
      const aPortLabel = e.poLabelA || firstMember?.aPort || e.aPort;
      const bPortLabel = e.poLabelB || firstMember?.bPort || e.bPort;
      const label = `${aPortLabel} ↔ ${bPortLabel}`;
      const title = svgEl('title', {});
      title.textContent = e.members && e.members.length > 1 ? `${label} (${e.members.length} Member)` : label;
      line.appendChild(title);
      edgeLayer.appendChild(line);

      if (KLU.state.showPortLabels && !edgeDimmed && zoomState.scale >= PORT_LABEL_MIN_ZOOM) {
        const portLabel = svgEl('text', { x: (x1 + x2) / 2, y: (y1 + y2) / 2, class: 'edge-port-label', 'text-anchor': 'middle' });
        portLabel.textContent = label;
        edgeLayer.appendChild(portLabel);
      }
    });
  }

  for (const node of graph.nodes) {
    if (!visibleIds.has(node.id)) continue;
    const pos = positions.get(node.id);
    if (!pos) continue;
    const nodeDimmed = (highlightSet && !highlightSet.has(node.id)) || (focusNeighbors && !focusNeighbors.has(node.id));
    const dimSet = nodeDimmed ? new Set([node.id]) : null;
    const hlSet = highlightSet?.has(node.id) ? new Set([node.id]) : null;
    const g = svgEl('g', { class: nodeClasses(node, dimSet, hlSet), transform: `translate(${pos.x},${pos.y})`, 'data-node-id': node.id });
    g.appendChild(nodeShapeElement(node.deviceType));
    const label = svgEl('text', { y: 36, 'text-anchor': 'middle', class: 'topology-node-label' });
    label.textContent = node.hostname || node.id;
    g.appendChild(label);
    const title = svgEl('title', {});
    title.textContent = `${node.hostname || node.id} (${DEVICE_TYPE_LABELS[node.deviceType] || node.deviceType})`;
    g.appendChild(title);
    nodeLayer.appendChild(g);
  }

  zoomLayer.appendChild(edgeLayer);
  zoomLayer.appendChild(nodeLayer);
  svg.appendChild(zoomLayer);
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
    const icon = svgEl('svg', { viewBox: '-24 -24 48 48', class: `topology-legend-icon type-${type}` });
    icon.appendChild(nodeShapeElement(type));
    item.appendChild(icon);
    item.appendChild(document.createTextNode(label));
    legend.appendChild(item);
  }
}

function initDrag(svg) {
  svg.addEventListener('pointerdown', e => {
    const nodeGroup = e.target.closest('.topology-node');
    if (!nodeGroup) return;
    activeDrags.set(e.pointerId, { nodeId: nodeGroup.dataset.nodeId, startX: e.clientX, startY: e.clientY, moved: false });
    svg.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  svg.addEventListener('pointermove', e => {
    const drag = activeDrags.get(e.pointerId);
    if (!drag) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > CLICK_MOVE_THRESHOLD) drag.moved = true;
    if (!drag.moved) return; // unter der Schwelle -> könnte noch ein Klick werden, nicht schon verschieben
    const pos = cachedPositions?.get(drag.nodeId);
    if (!pos) return;
    const pt = svgPointFromEvent(e, svg);
    pos.x = pt.x;
    pos.y = pt.y;
    renderTopology();
  });

  svg.addEventListener('pointerup', e => {
    const drag = activeDrags.get(e.pointerId);
    activeDrags.delete(e.pointerId);
    if (drag && !drag.moved) KLU.state.selectSwitchFocus(drag.nodeId); // Klick ohne nennenswerte Bewegung -> Fokus-Filter (Feature 10)
  });
  svg.addEventListener('pointercancel', e => activeDrags.delete(e.pointerId));
}

function initZoom(svg) {
  svg.addEventListener('wheel', e => {
    e.preventDefault();
    const p = viewBoxPointFromEvent(e, svg);
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    setZoom(zoomState.scale * factor, p.x, p.y);
  }, { passive: false });
}

KLU.views.topology = {
  init() {
    const svg = document.getElementById('topology-canvas');
    const toggle = document.getElementById('link-mode-toggle');
    toggle?.addEventListener('change', () => {
      KLU.state.linkMode = toggle.checked ? 'individual' : 'aggregated';
      renderTopology();
    });

    const portLabelToggle = document.getElementById('port-label-toggle');
    portLabelToggle?.addEventListener('change', () => KLU.state.setShowPortLabels(portLabelToggle.checked));

    // Ansichtsoptionen (Aggregiert/Einzeln, Portbezeichnungen, Geräte-Typ-Legende/-Filter) in ein
    // Popover ausgelagert, statt permanent 2-3 Zeilen Toolbar-Höhe zu belegen (Nutzer-Feedback).
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

    document.getElementById('topology-zoom-in')?.addEventListener('click', () => {
      const canvas = document.getElementById('topology-canvas');
      setZoom(zoomState.scale * 1.3, (canvas?.clientWidth || 800) / 2, (canvas?.clientHeight || 500) / 2);
    });
    document.getElementById('topology-zoom-out')?.addEventListener('click', () => {
      const canvas = document.getElementById('topology-canvas');
      setZoom(zoomState.scale / 1.3, (canvas?.clientWidth || 800) / 2, (canvas?.clientHeight || 500) / 2);
    });
    document.getElementById('topology-zoom-reset')?.addEventListener('click', resetZoom);

    document.getElementById('topology-fullscreen-toggle')?.addEventListener('click', () => {
      const panel = document.getElementById('topology-panel');
      if (!panel) return;
      if (document.fullscreenElement) document.exitFullscreen();
      else panel.requestFullscreen();
    });
    document.addEventListener('fullscreenchange', renderTopology); // SVG-Viewport hat sich geändert

    document.getElementById('topology-legend')?.addEventListener('change', e => {
      const checkbox = e.target.closest('input[type=checkbox]');
      if (checkbox) KLU.state.toggleDeviceTypeVisibility(checkbox.dataset.deviceType);
    });

    KLU.on('switches:changed', () => {
      cachedPositions = null; // Layout bei geänderter Switch-Menge neu berechnen
      renderTopology();
    });
    KLU.on('vlan:selected', renderTopology); // Feature 8: Highlight der Switches mit dem VLAN
    KLU.on('switchFocus:selected', renderTopology); // Feature 10: Fokus-Filter auf einen Switch
    KLU.on('portLabels:changed', renderTopology); // Feature 9: Portbezeichnungen an Kanten
    KLU.on('deviceTypeVisibility:changed', renderTopology); // Geräte-Typ-Filter in der Legende

    window.addEventListener('resize', renderTopology);
    if (svg) { initDrag(svg); initZoom(svg); }
    renderLegend();
    renderTopology();
  }
};
