// Kunden LAN Überblick — Topologie-View: Kraft-basiertes Layout + SVG-Rendering
KLU.views = KLU.views || {};

const SVG_NS = 'http://www.w3.org/2000/svg';
let cachedPositions = null;
let cachedNodeIds = null;

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

  const edgeLayer = svgEl('g', { class: 'edge-layer' });
  const nodeLayer = svgEl('g', { class: 'node-layer' });

  for (const [, group] of edgesByPair) {
    group.forEach((e, idx) => {
      const a = positions.get(e.a), b = positions.get(e.b);
      if (!a || !b) return;
      const offset = (idx - (group.length - 1) / 2) * 10;
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const perpX = (-dy / len) * offset, perpY = (dx / len) * offset;

      const line = svgEl('line', {
        x1: a.x + perpX, y1: a.y + perpY, x2: b.x + perpX, y2: b.y + perpY,
        class: 'topology-link'
      });
      const label = e.poLabelA || e.poLabelB
        ? `${e.poLabelA || e.aPort} ↔ ${e.poLabelB || e.bPort}`
        : `${e.aPort} ↔ ${e.bPort}`;
      const title = svgEl('title', {});
      title.textContent = e.members ? `${label} (${e.members.length} Member)` : label;
      line.appendChild(title);
      edgeLayer.appendChild(line);
    });
  }

  for (const node of graph.nodes) {
    const pos = positions.get(node.id);
    if (!pos) continue;
    const g = svgEl('g', { class: `topology-node platform-${node.platform === 'nexus' ? 'nexus' : 'catalyst'}`, transform: `translate(${pos.x},${pos.y})` });
    g.appendChild(svgEl('circle', { r: 22 }));
    const label = svgEl('text', { y: 36, 'text-anchor': 'middle', class: 'topology-node-label' });
    label.textContent = node.hostname || node.id;
    g.appendChild(label);
    const title = svgEl('title', {});
    title.textContent = `${node.hostname || node.id} (${node.platform})`;
    g.appendChild(title);
    nodeLayer.appendChild(g);
  }

  svg.appendChild(edgeLayer);
  svg.appendChild(nodeLayer);
}

KLU.views.topology = {
  init() {
    const toggle = document.getElementById('link-mode-toggle');
    toggle?.addEventListener('change', () => {
      KLU.state.linkMode = toggle.checked ? 'individual' : 'aggregated';
      renderTopology();
    });

    KLU.on('switches:changed', () => {
      cachedPositions = null; // Layout bei geänderter Switch-Menge neu berechnen
      renderTopology();
    });

    window.addEventListener('resize', renderTopology);
    renderTopology();
  }
};
