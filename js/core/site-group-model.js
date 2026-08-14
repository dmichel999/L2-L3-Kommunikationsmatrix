// L2-L3 Kommunikationsmatrix — Multi-Standort-Gruppierung: leitet ein Standort-/Gebäude-Label
// rein aus dem Hostname ab (alles vor dem ersten "-" oder "_"). Bewusst fragile Heuristik (siehe
// features.md) — funktioniert nur, wenn die Kunden-Namenskonvention tatsächlich einen
// Standort-Präfix vor einem Trenner enthält (z.B. "FRA1-CORE1", "MUC-ACC3"). Hostnames ohne
// Trenner werden NICHT künstlich gruppiert (eigene Einzel-Gruppe je Hostname), um keine falschen
// Standort-Zusammenhänge zu erfinden, wo keine Namenskonvention existiert.
KLU.siteGroupModel = {};

const SITE_PREFIX_RE = /^([A-Za-z0-9]+)[-_]/;

/**
 * @param {string} hostname
 * @returns {string} Präfix vor dem ersten "-"/"_", großgeschrieben — oder der volle Hostname,
 *   wenn kein Trenner gefunden wurde (dann de facto eine Einzel-Gruppe).
 */
KLU.siteGroupModel.deriveGroup = function (hostname) {
  const match = SITE_PREFIX_RE.exec(hostname || '');
  return match ? match[1].toUpperCase() : (hostname || '?');
};

/**
 * @param {Array} nodes Topologie-Knoten (benötigt .id, .hostname)
 * @returns {Map<string, string>} nodeId -> Gruppen-Label
 */
KLU.siteGroupModel.buildNodeGroupMap = function (nodes) {
  const map = new Map();
  for (const node of nodes) map.set(node.id, KLU.siteGroupModel.deriveGroup(node.hostname || node.id));
  return map;
};
