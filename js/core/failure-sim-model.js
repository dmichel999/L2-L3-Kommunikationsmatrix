// L2-L3 Kommunikationsmatrix — Redundanz-/Ausfall-Simulation: reine Graph-Konnektivitätsanalyse
// auf dem bestehenden Topologie-Graph (CDP/LLDP + Port-Channel). Beantwortet "welche Geräte
// wären vom Rest des Netzes getrennt, wenn Switch/Link X ausfällt" — ohne Kenntnis von
// dynamischem Routing, STP-Konvergenzzeiten oder tatsächlicher Bandbreite. Bewusste
// Vereinfachung (siehe features.md): reine Erreichbarkeits-Simulation, keine Vorhersage von
// Performance-Einbußen oder Failover-Dauer.
KLU.failureSimModel = {};

function buildAdjacency(nodeIds, edges) {
  const adjacency = new Map(nodeIds.map(id => [id, new Set()]));
  for (const e of edges) {
    adjacency.get(e.a)?.add(e.b);
    adjacency.get(e.b)?.add(e.a);
  }
  return adjacency;
}

function connectedComponents(nodeIds, adjacency) {
  const visited = new Set();
  const components = [];
  for (const start of nodeIds) {
    if (visited.has(start)) continue;
    const component = new Set();
    const stack = [start];
    while (stack.length > 0) {
      const current = stack.pop();
      if (component.has(current)) continue;
      component.add(current);
      visited.add(current);
      for (const neighbor of adjacency.get(current) || []) {
        if (!component.has(neighbor)) stack.push(neighbor);
      }
    }
    components.push(component);
  }
  return components;
}

// Größte verbleibende Komponente gilt als "Rest-Netz", alle anderen als isoliert -- das ist eine
// Konvention, keine Aussage darüber, welche Seite "wichtiger" ist (bei einer echten Netz-Teilung
// in zwei etwa gleich große Hälften ist die Zuordnung willkürlich, aber die Gesamtzahl
// betroffener Geräte bleibt korrekt).
function isolatedFromComponents(components) {
  if (components.length <= 1) return new Set();
  const sorted = [...components].sort((a, b) => b.size - a.size);
  const isolated = new Set();
  for (let i = 1; i < sorted.length; i++) for (const id of sorted[i]) isolated.add(id);
  return isolated;
}

// Nutzt bewusst dieselbe Kanten-Liste, die aktuell auch angezeigt wird (aggregiert ODER
// einzeln, siehe KLU.state.linkMode) statt immer edgesAggregated: im Einzeln-Modus simuliert der
// Ausfall EINES angeklickten physischen Kabels korrekt nur dieses eine Kabel (bei einem
// redundanten Bündel bleibt das Netz dann zusammenhängend), im Aggregiert-Modus simuliert ein
// Klick auf ein Bündel den selteneren "das ganze Bündel fällt gleichzeitig aus"-Fall.

/**
 * @param {Array} nodes graph.nodes
 * @param {Array} edges die aktuell angezeigte Kantenliste (graph.edgesIndividual oder .edgesAggregated)
 * @param {string} failedNodeId
 * @returns {{ isolatedNodeIds: Set<string>, splitIntoParts: number }}
 */
KLU.failureSimModel.simulateNodeFailure = function (nodes, edges, failedNodeId) {
  const remainingNodes = nodes.filter(n => n.id !== failedNodeId);
  const remainingIds = remainingNodes.map(n => n.id);
  const remainingEdges = edges.filter(e => e.a !== failedNodeId && e.b !== failedNodeId);
  const components = connectedComponents(remainingIds, buildAdjacency(remainingIds, remainingEdges));
  return { isolatedNodeIds: isolatedFromComponents(components), splitIntoParts: components.length };
};

/**
 * @param {Array} nodes graph.nodes
 * @param {Array} edges die aktuell angezeigte Kantenliste (graph.edgesIndividual oder .edgesAggregated)
 * @param {string} failedEdgeId
 * @returns {{ isolatedNodeIds: Set<string>, splitIntoParts: number }}
 */
KLU.failureSimModel.simulateEdgeFailure = function (nodes, edges, failedEdgeId) {
  const nodeIds = nodes.map(n => n.id);
  const remainingEdges = edges.filter(e => e.id !== failedEdgeId);
  const components = connectedComponents(nodeIds, buildAdjacency(nodeIds, remainingEdges));
  return { isolatedNodeIds: isolatedFromComponents(components), splitIntoParts: components.length };
};
