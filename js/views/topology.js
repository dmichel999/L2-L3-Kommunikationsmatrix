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

// BFS-Tiefe je Knoten ab dem bestvernetzten Knoten (meist ein Kern-Switch) - liefert fuer JEDE
// Topologie eine sinnvolle "von oben nach unten"-Schichtung (Kern -> Distribution -> Access ->
// Endgeraete), statt sie einem rein physikalischen Kraft-Gleichgewicht zu ueberlassen. Reine
// Abstossung+Anziehung neigt bei vielen schwach verbundenen Randknoten (die meisten Access
// Points/unbekannten Geraete haben nur eine einzige Kante) zu einem hohlen Ring statt einer
// gefuellten Flaeche, weil der Rand fuer jeden einzelnen Knoten den groessten Abstand zu allen
// anderen bietet.
function computeLevels(nodes, edges) {
  const adjacency = new Map(nodes.map(n => [n.id, []]));
  for (const e of edges) {
    adjacency.get(e.a)?.push(e.b);
    adjacency.get(e.b)?.push(e.a);
  }
  let root = nodes[0]?.id;
  let maxDeg = -1;
  for (const n of nodes) {
    const deg = (adjacency.get(n.id) || []).length;
    if (deg > maxDeg) { maxDeg = deg; root = n.id; }
  }
  const levels = new Map();
  if (root != null) {
    levels.set(root, 0);
    const queue = [root];
    while (queue.length) {
      const cur = queue.shift();
      const curLevel = levels.get(cur);
      for (const nb of adjacency.get(cur) || []) {
        if (!levels.has(nb)) { levels.set(nb, curLevel + 1); queue.push(nb); }
      }
    }
  }
  let maxLevel = 0;
  for (const l of levels.values()) maxLevel = Math.max(maxLevel, l);
  for (const n of nodes) if (!levels.has(n.id)) levels.set(n.id, maxLevel + 1); // getrennte Komponente
  return levels;
}

// groupMap (nodeId -> Gruppen-Label) ist optional: wenn gesetzt, werden Knoten derselben Gruppe
// leicht zueinander gezogen und Knoten unterschiedlicher Gruppen leicht auseinandergedrückt, statt
// eines komplett eigenen Cluster-Layout-Algorithmus (Multi-Standort-Gruppierung, siehe features.md).
function computeLayout(nodes, edges, width, height, groupMap) {
  const levels = computeLevels(nodes, edges);
  let maxLevel = 0;
  for (const l of levels.values()) maxLevel = Math.max(maxLevel, l);
  const topMargin = 50, bottomMargin = 50;
  const levelHeight = maxLevel > 0 ? (height - topMargin - bottomMargin) / maxLevel : 0;
  const targetY = id => topMargin + levels.get(id) * levelHeight;

  const positions = new Map(nodes.map(n => [n.id, {
    x: width / 2 + (Math.random() - 0.5) * 200,
    y: targetY(n.id) + (Math.random() - 0.5) * 40
  }]));
  // Ideale Kantenlaenge an Knotenzahl UND Canvas-Flaeche anpassen (Fruchterman-Reingold-
  // Faustformel k = sqrt(Flaeche/Knotenzahl)) statt eines festen Werts - bei groesseren
  // Kundennetzen (viele Knoten) liess ein fester Wert fast alles gegen den Rand laufen, weil die
  // Abstossung nicht zur verfuegbaren Flaeche passte.
  const k = Math.max(50, Math.sqrt((width * height) / nodes.length) * 0.9);
  const centerX = width / 2;

  for (let iter = 0; iter < 300; iter++) {
    // Nur die X-Komponente wird als Kraft akkumuliert (Abstossung/Anziehung bestimmen die
    // Verteilung NEBENEINANDER innerhalb einer Ebene). Die Y-Komponente wird bewusst NICHT Teil
    // dieser Kraft-Summe: eine mittlere Ebene wird von potenziell Dutzenden Knoten in
    // Nachbar-Ebenen gleichzeitig abgestossen, wodurch eine Y-Kraft regelmaessig von der
    // kumulierten Abstossung ueberstimmt wurde und Knoten trotzdem an den Rand drueckte (siehe
    // Bugfix-Notiz weiter unten bei der Y-Aktualisierung).
    const forcesX = new Map(nodes.map(n => [n.id, 0]));

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = positions.get(nodes[i].id), b = positions.get(nodes[j].id);
        const dx = a.x - b.x, dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        let force = (k * k) / dist;
        if (groupMap) {
          const sameGroup = groupMap.get(nodes[i].id) === groupMap.get(nodes[j].id);
          force *= sameGroup ? 0.3 : 1.6; // gleiche Gruppe näher zusammen, andere weiter auseinander
        }
        const fx = (dx / dist) * force;
        forcesX.set(nodes[i].id, forcesX.get(nodes[i].id) + fx);
        forcesX.set(nodes[j].id, forcesX.get(nodes[j].id) - fx);
      }
    }

    for (const e of edges) {
      const a = positions.get(e.a), b = positions.get(e.b);
      if (!a || !b) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const force = ((dist * dist) / k) * 0.05;
      const fx = (dx / dist) * force;
      forcesX.set(e.a, forcesX.get(e.a) + fx);
      forcesX.set(e.b, forcesX.get(e.b) - fx);
    }

    for (const n of nodes) {
      const p = positions.get(n.id);
      // X: Kraft-Summe (Abstossung/Anziehung/Gruppierung) plus milde Zentrierung.
      let fx = forcesX.get(n.id) + (centerX - p.x) * 0.01;
      p.x += Math.max(-10, Math.min(10, fx * 0.01));
      p.x = Math.max(40, Math.min(width - 40, p.x));
      // Y: direkte Annaeherung an die per BFS-Tiefe vorgegebene Ebene statt einer Kraft, die
      // gegen die X-Abstossung haette konkurrieren muessen (siehe Kommentar oben) - garantiert
      // Konvergenz zur richtigen Ebene unabhaengig von Knotenzahl/Abstossungsstaerke.
      p.y += (targetY(n.id) - p.y) * 0.08;
      p.y = Math.max(40, Math.min(height - 40, p.y));
    }
  }

  // Nur den X-Schwerpunkt nachtraeglich zentrieren - Y ist bereits durch die Ebenen-Ankerkraft
  // kontrolliert; ein zusaetzlicher Y-Shift wuerde einzelne Ebenen ggf. aus dem sichtbaren
  // Bereich schieben.
  let meanX = 0;
  for (const p of positions.values()) meanX += p.x;
  meanX /= nodes.length;
  const shiftX = centerX - meanX;
  for (const p of positions.values()) {
    p.x = Math.max(40, Math.min(width - 40, p.x + shiftX));
  }

  return positions;
}

let cachedWidth = null;
let cachedHeight = null;

function getPositions(nodes, edgesForLayout, width, height, groupMap) {
  const nodeIdsKey = nodes.map(n => n.id).sort().join(',') + (groupMap ? '|grouped' : '');
  if (cachedPositions && cachedNodeIds === nodeIdsKey) {
    // Canvas-Groesse hat sich geaendert (z.B. Fenster vergroessert/Vollbild): bestehende,
    // eventuell manuell per Drag verschobene Positionen proportional auf die neue Flaeche
    // umrechnen, statt das teure Layout komplett neu zu simulieren und Drags zu verwerfen.
    if (cachedWidth && cachedHeight && (cachedWidth !== width || cachedHeight !== height)) {
      const scaleX = width / cachedWidth, scaleY = height / cachedHeight;
      for (const p of cachedPositions.values()) {
        p.x = Math.max(40, Math.min(width - 40, p.x * scaleX));
        p.y = Math.max(40, Math.min(height - 40, p.y * scaleY));
      }
      cachedWidth = width;
      cachedHeight = height;
    }
    return cachedPositions;
  }
  cachedPositions = computeLayout(nodes, edgesForLayout, width, height, groupMap);
  cachedNodeIds = nodeIdsKey;
  cachedWidth = width;
  cachedHeight = height;
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

// Geometrie je Gerätetyp — einfache, auf den ersten Blick lesbare Systemsymbole (angelehnt an
// die uebliche draw.io/Visio-Netzwerk-Symbolik: Switch = Gehaeuse mit Ports, Firewall =
// Backstein-Mauer, WLC = Gehaeuse mit Antenne, Access Point = Funksymbol), statt generischer
// Formen ohne Wiedererkennungswert. Nur "unbekannt" bleibt bewusst das schlichte Rechteck.
// Alle Icons sind um den Ursprung zentriert (Elternknoten uebernimmt translate) und bestehen aus
// mehreren Grundformen in einer Gruppe - fill/stroke kommen dabei von der .topology-node-Gruppe
// (siehe css/components.css), rein dekorative Linien/Pfade setzen bewusst fill="none", damit
// aus offenen Pfaden (Ports, Signalboegen, Fugen) keine gefuellten Flaechen werden.
function nodeShapeElement(deviceType) {
  const g = svgEl('g', {});
  const deco = (tag, attrs) => g.appendChild(svgEl(tag, { fill: 'none', ...attrs }));

  switch (deviceType) {
    case 'firewall': {
      // Backstein-Mauer in einem Rahmen (3 versetzte Reihen), wie das klassische draw.io-Symbol.
      g.appendChild(svgEl('rect', { x: -20, y: -20, width: 40, height: 40, rx: 2 }));
      deco('line', { x1: -20, y1: -7, x2: 20, y2: -7 });
      deco('line', { x1: -20, y1: 6, x2: 20, y2: 6 });
      deco('line', { x1: 0, y1: -20, x2: 0, y2: -7 });
      deco('line', { x1: -10, y1: -7, x2: -10, y2: 6 });
      deco('line', { x1: 10, y1: -7, x2: 10, y2: 6 });
      deco('line', { x1: 0, y1: 6, x2: 0, y2: 20 });
      return g;
    }
    case 'wlc': {
      // Controller-Gehaeuse mit Antenne + zwei Signalboegen darueber ("Box, die Funk steuert").
      g.appendChild(svgEl('rect', { x: -14, y: 4, width: 28, height: 14, rx: 2 }));
      deco('line', { x1: 0, y1: 4, x2: 0, y2: -2 });
      deco('path', { d: 'M -6,-2 Q 0,-10 6,-2' });
      deco('path', { d: 'M -12,-2 Q 0,-18 12,-2' });
      return g;
    }
    case 'ap': {
      // Klassisches Funk-/WLAN-Symbol: Geraet (Punkt) + konzentrische Signalboegen darueber.
      g.appendChild(svgEl('circle', { cx: 0, cy: 10, r: 4 }));
      deco('path', { d: 'M -5,6 Q 0,-2 5,6' });
      deco('path', { d: 'M -10,6 Q 0,-8 10,6' });
      deco('path', { d: 'M -15,6 Q 0,-14 15,6' });
      return g;
    }
    case 'unknown':
      return svgEl('rect', { x: -19, y: -19, width: 38, height: 38, rx: 4 });
    default: {
      // Switch: Gehaeuse mit einer Reihe Port-Markierungen.
      g.appendChild(svgEl('rect', { x: -22, y: -12, width: 44, height: 24, rx: 3 }));
      for (const x of [-16, -8, 0, 8, 16]) deco('line', { x1: x, y1: 2, x2: x, y2: 8 });
      return g;
    }
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
  svg.classList.toggle('failure-sim-active', KLU.state.failureSimActive);

  if (graph.nodes.length === 0) {
    const text = svgEl('text', { x: width / 2, y: height / 2, 'text-anchor': 'middle', class: 'topology-empty-hint' });
    text.textContent = 'Noch keine Switches importiert.';
    svg.appendChild(text);
    return;
  }

  const groupMap = KLU.state.siteGroupingActive ? KLU.siteGroupModel.buildNodeGroupMap(graph.nodes) : null;
  const positions = getPositions(graph.nodes, graph.edgesAggregated, width, height, groupMap);
  const activeEdges = KLU.state.linkMode === 'individual' ? graph.edgesIndividual : graph.edgesAggregated;
  const edgesByPair = groupEdgesByPair(activeEdges);

  const highlightSet = vlanHighlightSwitchIds(KLU.state.getSwitches());
  const focusId = KLU.state.selectedSwitchFocus;
  const focusNeighbors = focusId ? neighborsOfFocus(activeEdges, focusId) : null;
  // Über die Legende ausgeblendete Gerätetypen: Knoten UND ihre Kanten verstecken.
  const visibleIds = new Set(graph.nodes.filter(n => !KLU.state.hiddenDeviceTypes.has(n.deviceType)).map(n => n.id));

  const failureTarget = KLU.state.failureSimTarget;
  let failureResult = null;
  if (failureTarget?.type === 'node') failureResult = KLU.failureSimModel.simulateNodeFailure(graph.nodes, activeEdges, failureTarget.id);
  else if (failureTarget?.type === 'edge') failureResult = KLU.failureSimModel.simulateEdgeFailure(graph.nodes, activeEdges, failureTarget.id);
  renderFailureSimResult(failureResult, failureTarget, graph.nodes);

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
      const edgeFailed = failureTarget?.type === 'edge' && failureTarget.id === e.id;
      const line = svgEl('line', {
        x1, y1, x2, y2,
        class: `topology-link${edgeDimmed ? ' dimmed' : ''}${edgeFailed ? ' failed' : ''}`,
        'data-edge-id': e.id
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
    let classes = nodeClasses(node, dimSet, hlSet);
    if (focusId && node.id === focusId) classes += ' focused'; // Feature 10: welches Geraet ist fokussiert
    if (failureTarget?.type === 'node' && failureTarget.id === node.id) classes += ' failed';
    if (failureResult?.isolatedNodeIds.has(node.id)) classes += ' isolated';
    const g = svgEl('g', { class: classes, transform: `translate(${pos.x},${pos.y})`, 'data-node-id': node.id });
    g.appendChild(nodeShapeElement(node.deviceType));
    const label = svgEl('text', { y: 36, 'text-anchor': 'middle', class: 'topology-node-label' });
    const groupSuffix = groupMap ? ` · ${groupMap.get(node.id)}` : '';
    const displayName = KLU.anonymize.hostname(node.hostname || node.id);
    label.textContent = displayName + groupSuffix;
    g.appendChild(label);
    const title = svgEl('title', {});
    title.textContent = `${displayName} (${DEVICE_TYPE_LABELS[node.deviceType] || node.deviceType})`;
    g.appendChild(title);
    nodeLayer.appendChild(g);
  }

  zoomLayer.appendChild(edgeLayer);
  zoomLayer.appendChild(nodeLayer);
  svg.appendChild(zoomLayer);
}

function hostnameOfNode(nodeId, nodes) {
  return KLU.anonymize.hostname(nodes.find(n => n.id === nodeId)?.hostname || nodeId);
}

// Ergebnis-Overlay der Ausfall-Simulation (Feature "Redundanz-/Ausfall-Simulation") — reine
// Erreichbarkeits-Analyse auf dem Graphen, keine Aussage über Konvergenzzeit/Performance.
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
    if (!drag || drag.moved) return; // war ein Drag, kein Klick
    if (KLU.state.failureSimActive) KLU.state.setFailureSimTarget({ type: 'node', id: drag.nodeId });
    else KLU.state.selectSwitchFocus(drag.nodeId); // Fokus-Filter (Feature 10)
  });
  svg.addEventListener('pointercancel', e => activeDrags.delete(e.pointerId));

  // Klick auf eine Kante wählt sie nur während aktiver Ausfall-Simulation als Ziel aus (sonst
  // keine Wirkung) — Kanten sind nicht draggable, daher reicht ein einfacher Klick-Listener.
  svg.addEventListener('click', e => {
    if (!KLU.state.failureSimActive) return;
    const line = e.target.closest('.topology-link');
    if (!line) return;
    const edgeId = line.dataset.edgeId;
    if (edgeId) KLU.state.setFailureSimTarget({ type: 'edge', id: edgeId });
  });
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

    const failureSimToggle = document.getElementById('failure-sim-toggle');
    failureSimToggle?.addEventListener('change', () => KLU.state.setFailureSimActive(failureSimToggle.checked));

    const siteGroupingToggle = document.getElementById('site-grouping-toggle');
    siteGroupingToggle?.addEventListener('change', () => KLU.state.setSiteGroupingActive(siteGroupingToggle.checked));

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
    KLU.on('failureSim:changed', renderTopology); // Redundanz-/Ausfall-Simulation
    KLU.on('siteGrouping:changed', renderTopology); // Multi-Standort-Gruppierung

    window.addEventListener('resize', renderTopology);
    if (svg) { initDrag(svg); initZoom(svg); }
    renderLegend();
    renderTopology();
  }
};
