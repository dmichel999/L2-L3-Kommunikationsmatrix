# Third-Party Licenses

Dieses Projekt lädt keine externen Bibliotheken zur Laufzeit nach. Die folgende Bibliothek liegt lokal vendort unter `lib/` und wird direkt aus dem Projekt geladen.

## JSZip

- **Datei:** `lib/jszip.min.js`
- **Version:** 3.10.1
- **Zweck:** Entpacken von `.docx`-Dateien (Word-Dokumente sind ZIP-Archive) beim Import
- **Lizenz:** MIT oder GPLv3 (dual-lizenziert), siehe https://raw.github.com/Stuk/jszip/main/LICENSE.markdown
- **Enthält:** [pako](https://github.com/nodeca/pako) (MIT-lizenziert)

## Cytoscape.js + cytoscape-fcose

- **Dateien:** `lib/cytoscape.min.js`, `lib/cytoscape-fcose.js`, `lib/cose-base.js`, `lib/layout-base.js`
- **Versionen:** cytoscape 3.30.4, cytoscape-fcose 2.2.0, cose-base 2.2.0, layout-base 2.0.1
- **Zweck:** Graph-Rendering + Layout der Topologie-Ansicht (`js/views/topology.js`) — Baum-Layout
  (`breadthfirst`, Standard) und Kraft-Layout (`fcose`, Alternative) statt einer selbstgebauten
  SVG-Kraft-Simulation
- **Lizenz:** MIT (alle vier Pakete)
- **Ladereihenfolge wichtig:** `layout-base.js` → `cose-base.js` → `cytoscape.min.js` →
  `cytoscape-fcose.js` (cose-base liest `window.layoutBase`, cytoscape-fcose liest
  `window.coseBase` — beide UMD-Bundles erwarten das jeweils vorherige Skript bereits geladen,
  keine eigenständigen Browser-Bundles)
