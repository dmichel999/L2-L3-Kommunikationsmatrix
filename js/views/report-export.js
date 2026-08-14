// Kunden LAN Überblick — Report-Export (Backlog-Feature "PDF/HTML-Report-Export"): erzeugt einen
// eigenständigen, versandfähigen HTML-Report (keine Abhängigkeit von den App-Dateien, kein
// externes Nachladen) durch Snapshotten der bereits gerenderten DOM-Abschnitte (Versionsübersicht,
// Topologie-SVG, VLAN-Tabelle, Kommunikationsmatrix, Trunk-Warnungen, STP). Bewusst kein
// PDF-Generator-Vendor-Paket — der Kunde/User erzeugt bei Bedarf selbst ein PDF über die
// Browser-Druckfunktion (Cmd/Strg+P → Als PDF sichern), das genügt für Kundenlieferung und
// vermeidet eine schwere zusätzliche Abhängigkeit.
KLU.views = KLU.views || {};

// Statisches Light-Theme-CSS (unabhängig vom aktuell im Browser aktiven Theme) — ein
// ausgedruckter/als PDF gespeicherter Report soll immer auf hellem Hintergrund gut lesbar sein,
// unabhängig davon, ob der User die App gerade im Dark Mode nutzt.
const REPORT_CSS = `
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 14px; color: #1c2126; background: #fff; margin: 2rem; max-width: 1000px; }
  h1 { margin-bottom: 4px; }
  h2 { margin-top: 2rem; border-bottom: 2px solid #005f9e; padding-bottom: 4px; }
  .hint { color: #6b7480; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 8px; }
  th, td { text-align: left; padding: 6px 10px; border-bottom: 1px solid #d8dce2; vertical-align: top; }
  .matrix-table th, .matrix-table td { border: 1px solid #d8dce2; text-align: center; }
  .matrix-table tbody th { text-align: left; white-space: nowrap; }
  th { color: #6b7480; font-weight: 600; font-size: 12px; text-transform: uppercase; }
  .matrix-cell-reachable { color: #2e7d32; font-weight: 600; }
  .matrix-cell-unknown { color: #6b7480; }
  .matrix-cell-self { background: #f5f6f8; color: #6b7480; }
  .badge { font-size: 11px; font-weight: 600; text-transform: uppercase; padding: 2px 6px; border-radius: 4px; color: white; }
  .badge-catalyst { background: #2e7d32; }
  .badge-nexus { background: #6a1b9a; }
  .switch-warning { color: #b4690e; font-size: 12px; }
  .error-line { color: #b3261e; background: #fbe9e8; border-radius: 6px; padding: 6px 10px; font-size: 12px; margin-bottom: 6px; }
  .report-topology { border: 1px solid #d8dce2; border-radius: 8px; padding: 8px; margin-bottom: 8px; }
  .report-topology svg { width: 100%; height: auto; display: block; }
  .topology-link { stroke: #d8dce2; stroke-width: 2; }
  .topology-link.dimmed { opacity: 0.15; }
  .topology-node circle, .topology-node polygon, .topology-node rect { fill: #fff; stroke-width: 2; stroke: #6b7480; }
  .topology-node.dimmed { opacity: 0.25; }
  .topology-node.highlighted circle, .topology-node.highlighted polygon, .topology-node.highlighted rect { stroke-width: 4; }
  .topology-node.platform-catalyst circle { stroke: #2e7d32; }
  .topology-node.platform-nexus circle { stroke: #6a1b9a; }
  .topology-node.type-firewall polygon { stroke: #b3261e; }
  .topology-node.type-wlc polygon { stroke: #005f9e; }
  .topology-node.type-ap polygon { stroke: #b4690e; }
  .topology-node.type-unknown rect { stroke: #6b7480; }
  .topology-node-label { fill: #1c2126; font-size: 12px; text-anchor: middle; }
  .edge-port-label { fill: #6b7480; font-size: 10px; text-anchor: middle; }
  @media print { body { margin: 1cm; } h2 { page-break-after: avoid; } table { page-break-inside: avoid; } }
`;

function domHtml(id, emptyHint) {
  const el = document.getElementById(id);
  const html = el?.innerHTML.trim();
  return html || `<p class="hint">${emptyHint}</p>`;
}

function buildReportHtml() {
  const switches = KLU.state.getSwitches();
  const dateStr = new Date().toLocaleString('de-DE');
  const topologySvg = document.getElementById('topology-canvas')?.outerHTML || '';

  return `<!doctype html>
<html lang="de">
<head>
<meta charset="UTF-8">
<title>Kunden-LAN-Analyse-Report</title>
<style>${REPORT_CSS}</style>
</head>
<body>
  <h1>Kunden-LAN-Analyse-Report</h1>
  <p class="hint">Erstellt am ${KLU.dom.escapeHtml(dateStr)} — ${switches.length} Switches importiert (Kunden LAN Überblick v${KLU.dom.escapeHtml(KLU.version)})</p>

  <h2>Switches</h2>
  ${domHtml('version-table-wrapper', 'Keine Switches importiert.')}

  <h2>Topologie</h2>
  <div class="report-topology">${topologySvg}</div>

  <h2>VLAN-Tabelle</h2>
  ${domHtml('vlan-table-wrapper', 'Keine Switches importiert.')}

  <h2>L3-Kommunikationsmatrix</h2>
  ${domHtml('matrix-wrapper', 'Keine Switches mit bekanntem VLAN-Interface importiert.')}

  <h2>Trunk-Warnungen (Native-VLAN-Mismatch)</h2>
  ${domHtml('trunk-panel', 'Keine Daten.')}

  <h2>STP: Root-Bridge &amp; blockierte Ports</h2>
  ${domHtml('stp-panel', 'Keine Daten.')}
</body>
</html>`;
}

function downloadReport() {
  const blob = new Blob([buildReportHtml()], { type: 'text/html;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `lan-report-${new Date().toISOString().slice(0, 10)}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

KLU.views.reportExport = {
  init() {
    document.getElementById('report-export-btn')?.addEventListener('click', downloadReport);
  }
};
