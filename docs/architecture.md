# Architektur — L2-L3 Kommunikationsmatrix

## 1. Technische Entscheidungen

| Entscheidung | Begründung |
|---|---|
| **Kein Framework, kein Build-System** | Ordner öffnen (`L2-L3 Kommunikationsmatrix.html` via `file://`) → läuft. Kein npm, kein Bundler. |
| **Namespace-Pattern statt ES-Module** | ES-Module brauchen einen HTTP-Server (CORS-Restriktionen bei `file://`), klassische `<script>`-Tags nicht. |
| **Ein globales Objekt `KLU`, alle `<script>`-Tags teilen einen Scope** | Jede Datei erweitert `KLU.*`. Das bedeutet: `const`/`let`-Namen auf Modul-Ebene müssen projektweit eindeutig sein (siehe Abschnitt 4) — es gibt keine echte Modul-Isolation. |
| **Event-Bus (`KLU.on`/`KLU.emit`) statt direkter Kopplung** | Views reagieren auf Zustandsänderungen (`switches:changed`, `vlan:selected`, …), ohne sich gegenseitig zu kennen. Neue Views lassen sich anhängen, ohne bestehende zu ändern. |
| **Reines Client-Side-Parsing, keine KI im Loop** | Kundendaten (Netzwerk-Konfiguration) verlassen den Browser nicht — passend zum sensiblen Charakter der Daten und zum Bechtle-Gitea-only-Hosting dieses Projekts. |
| **jszip.min.js als einzige Dependency** | Nur für `.docx`-Import (ZIP-Entpacken), lokal vendort unter `lib/`, kein CDN. |

## 2. Dateistruktur

```
├── L2-L3 Kommunikationsmatrix.html   Einstiegspunkt, Script-Tags in Ladereihenfolge, HTML-Grundgerüst
├── js/
│   ├── core/                   Datenmodelle + App-weite Infrastruktur (state, theme, topology-graph, ...)
│   ├── parsers/                Ein Parser pro show-Kommando (+ Splitter, Spalten-/Port-Helfer)
│   ├── views/                  Eine Datei pro UI-Feature, rendert in ein festes DOM-Element
│   └── app.js                  Initialisierung: ruft alle `KLU.views.*.init()` auf
├── css/                         base (Farbvariablen/Theme) / layout (Grid/Flex-Struktur) / components
├── lib/                         Vendorte Third-Party-JS (aktuell nur jszip.min.js)
├── assets/                      Lokale Bilder/Icons (Bechtle-AI-Label)
├── sample-data/                 Generierter 10-Switch-Testdatensatz + README
└── docs/                        Diese Dateien (releases/bugs/architecture/features/changes/THIRD_PARTY_LICENSES)
```

## 3. Datenfluss

1. **Import** (`js/views/import.js`): Datei → Text (`.txt`/`.log` direkt, `.docx` über `js/parsers/docx.js`) → `KLU.parsers.splitCommands()` trennt die Datei anhand der Prompt-Zeilen (`switch#show ...`) in benannte Kommando-Blöcke → pro Kommando der passende Parser → `KLU.state.addSwitch()`.
2. **State** (`js/core/state.js`): `switches: Map<id, Switch>` ist die einzige Quelle der Wahrheit. Jede Änderung (`addSwitch`/`removeSwitch`/`selectVlan`/…) emittiert ein Event, jede View re-rendert sich bei Bedarf komplett aus dem aktuellen State (kein Diffing, keine partiellen Updates) — bei den hier üblichen Datenmengen (wenige bis einige Dutzend Switches) ist das performant genug.
3. **Core-Modelle** (`vlan-model.js`, `mac-model.js`, `trunk-model.js`, `reachability-model.js`, `topology.js`) aggregieren die pro-Switch geparsten Rohdaten zu switch-übergreifenden Sichten (z. B. "welche Switches tragen VLAN 10 mit welchem IP-Netz"). Sie sind reine Funktionen (Input: `switches`-Array, Output: Datenstruktur) — keine eigenen State-Mutationen, dadurch einfach isoliert testbar.
4. **Views** lesen State + Core-Modelle und schreiben `innerHTML` (immer über `KLU.dom.escapeHtml()` für alle Werte, die aus Kundendaten stammen).

## 4. Cross-File-Namenskonflikte

Da alle `<script>`-Tags einen gemeinsamen Top-Level-Scope teilen, würde eine doppelte `const`/`function`-Deklaration auf Modul-Ebene einen `SyntaxError` beim Laden auslösen (nicht nur Shadowing). Regeln:
- Gemeinsame Helfer (`KLU.dom.escapeHtml`, `KLU.parsers.normalizePort`, …) werden **immer** direkt aufgerufen, nie lokal alias-iert (`const x = KLU.foo.x` ist verboten).
- Neue Dateien müssen vor dem Anlegen kurz gegen bestehende Top-Level-Namen geprüft werden (`grep -n "^function \|^const "` über alle `js/`-Dateien).
- Ein Test lädt beim Refactoring alle Skript-Dateien in der HTML-Ladereihenfolge zusammen in eine einzige `new Function(...)` — schlägt bei jedem Namenskonflikt sofort fehl (siehe Test-Strategie unten).

## 5. Parser-Strategie: Spalten vs. Tokens

Cisco-`show`-Kommandos sind grundsätzlich Fixed-Width-Tabellen, aber reale Exporte weichen davon ab (siehe `docs/bugs.md`, Abschnitt "reale Cisco-Export-Eigenheiten"). Faustregel in diesem Projekt:
- Spalten, deren Position sich aus der Kopfzeile **zuverlässig** ableiten lässt (z. B. CDP Device-ID/Local-Intrfce/Hldtme/Capability, VLAN-ID/Name/Status/Ports), werden per Zeichenposition geschnitten (`KLU.parsers.sliceCol`).
- Spalten, deren Position in der Praxis **nicht zuverlässig** mit der Kopfzeile übereinstimmt (CDP Platform/Port-ID), werden tokenbasiert mit Formaterkennung geparst (siehe `js/parsers/cdp.js`, `splitPlatformAndPortId()`).
- Wo weder Position noch Tokenanzahl verlässlich sind (MAC-Tabelle: Catalyst/Nexus haben unterschiedlich viele Spalten), wird auf feste Invarianten zurückgegriffen (VLAN ist immer das erste Feld, Port immer das letzte).

## 6. Topologie-Rendering

Seit 0.13.0 (2026-08-19) rendert `js/views/topology.js` über **Cytoscape.js + cytoscape-fcose**
(vendort unter `lib/`, siehe `docs/THIRD_PARTY_LICENSES.md` für die Ladereihenfolge) statt der
vorherigen handgebauten SVG-Kraft-Simulation — portiert aus dem Kollegen-Referenzprojekt
"dora-the-explorer" (Layout-Technik, Detail-Panel, Suche-Integration, Export). `#topology-canvas`
ist dafür ein leeres `<div>`, in das Cytoscape sein eigenes internes `<canvas>` rendert.

**Elemente/Rebuild:** `renderTopology()` baut `graph = KLU.topology.buildGraph(...)` (unverändert)
und vergleicht einen aus Knoten-/Kanten-/Gruppen-IDs abgeleiteten `computeElementsKey()` gegen den
zuletzt gebauten Stand — nur bei tatsächlicher struktureller Änderung (Switches importiert/entfernt,
Aggregiert/Einzeln-Modus, Standort-Gruppierung an/aus) werden Cytoscape-Elemente neu aufgebaut und
neu layoutet; reine Zustandsänderungen (VLAN-Auswahl, Fokus, Ausfall-Simulation, Geräte-Typ-Filter)
laufen ausschließlich über `applyStateClasses()`/`applyTypeVisibility()` (CSS-Klassen auf
bestehenden Elementen), damit Zoom/Pan/manuell verschobene Positionen dabei nicht verworfen werden.

**Layouts:** zwei benannte Layouts, umschaltbar über die Ansichtsoptionen — `tree` (`breadthfirst`,
Standard, deterministisch dank Grid-Vorlauf vor jedem Lauf) und `force` (`fcose`, organische
Alternative mit großzügigem `nodeSeparation`/`nodeRepulsion` gegen Zusammenklumpen bei Hub-and-
Spoke-Topologien). Standort-Gruppierung nutzt echte Cytoscape-Compound-Knoten (`data.parent`)
statt der früheren weichen Anziehungskraft.

**Icons:** Die handgezeichneten Geräte-Symbole (Switch/Firewall/WLC/Access Point) sind SVG-Markup-
Strings (`iconMarkup()`), zu Data-URIs aufgelöst (`ICONS`) und per `background-image: data(icon)`
auf den (unsichtbaren, `background-opacity: 0`) Node-Shape gelegt — Cytoscape kann Icons nur so
einbinden, nicht als DOM-`<g>`-Baum wie zuvor. Farbe bleibt bewusst einheitlich (Typ wird über die
Icon-Form unterschieden, Farbe ausschließlich für Zustände wie Fokus/Ausfall/VLAN-Hervorhebung).
Cytoscapes Stylesheet-DSL versteht kein CSS `var()` — `buildStylesheet(tokens)` löst alle
Bechtle-Design-Tokens einmalig zu echten Farbwerten auf (`resolveToken()`/`liveTokens()`) und wird
bei jedem Theme-Wechsel (`theme:changed`-Event, siehe `js/core/theme.js`) neu aufgerufen.

**Detail-Panel/Suche/Export** (Teil derselben Portierung): Klick auf einen Knoten ruft weiterhin
`KLU.state.selectSwitchFocus(id)` auf (unverändertes State-Feld/Event aus `js/core/state.js`,
jetzt zusätzlich Grundlage für das Detail-Panel statt nur des Nachbarschafts-Fokus-Filters) —
`fillDetail()` befüllt Kopf/Stammdaten/Nachbarliste. Die globale Suche (`js/views/global-search.js`)
ruft bei Klick auf einen Treffer denselben State-Setter auf und wechselt in die Netzwerk-Ansicht.
Export (PNG/CSV/JSON) arbeitet auf `cy.nodes(':visible')`/`cy.edges(':visible')`, respektiert also
aktive Geräte-Typ-Filter. Der Report-Export (`js/views/report-export.js`) nutzt für seinen
Topologie-Abschnitt `KLU.views.topology.snapshotLightPng()` — ein einmaliger PNG-Snapshot mit
fest verdrahteten Light-Theme-Werten (der Report ist immer hell/druckfreundlich), da ein simples
`outerHTML`-Snapshot des Canvas-Containers (anders als früher beim SVG) keine Pixel liefern würde.

## 7. Wiederverwendbare UI-Bausteine

- **`js/views/split-pane.js`**: generischer horizontaler Resizer (Flexbox, `flexBasis`), genutzt für Topologie/VLAN-Tabelle-Split und (separat instanziiert) für den Sidebar-Resizer.
- **`js/views/collapsible-panel.js`**: generische einklappbare, optional höhenverstellbare Panel-Komponente (`.panel`/`.panel-header`/`.panel-body`/`.panel-resize-handle`), genutzt für die drei rechten Detail-Panels und die Sidebar-Bereiche.
- **`js/core/theme.js`**: Hell/Dunkel/System per `data-theme`-Attribut auf `<html>` + `localStorage`. CSS-Variablen in `css/base.css` sind dreifach definiert (Basis auf `:root`, System-Override unter `@media (prefers-color-scheme: dark) :root:not([data-theme="light"])`, expliziter Override unter `:root[data-theme="dark"]`).

## 9. Bechtle Design System Retrofit (2026-08-18)

Dieses Projekt hat eine sehr dichte Oberfläche mit ~30 kleinen, bewusst dezenten Buttons
(Zoom-Steuerung, Panel-Einklappen, Einstellungs-Popover-Trigger, Entfernen-Button pro
importierten Switch, …). Die geteilte `button, .btn {}`-Regel aus `css/design-components.css`
setzt dafür standardmäßig einen 40px hohen, gefüllten Pill-Button — das hätte diese kleinen
Bedienelemente ohne weiteres Zutun aufgebläht. Deshalb wurde jeder Button einzeln klassifiziert:

| Kategorie | Klasse | Beispiele |
|---|---|---|
| Primäre Aktion | keine (Default) | `#report-export-btn` |
| Icon-Only-Trigger | `.icon` | Zoom −/💯/+/⛶, `#topology-settings-toggle`, `#panel-visibility-toggle` |
| Sekundäraktion mit Text | `.outlined` | `#vlan-csv-export`, `.mac-csv-export` |
| Destruktive Aktion | `.danger.outlined` | `.btn-remove` (Switch aus der Import-Liste entfernen) |
| Bereits vollständig eigenständig gestylt | keine Design-System-Klasse | `.panel-collapse-btn` (▾, setzt selbst Hintergrund/Farbe/Padding — braucht nur `min-height: auto`, da die geteilte Regel sonst trotzdem eine Mindesthöhe erzwingt) |

**Wo Icon-Buttons zuvor Text+Symbol waren** (`⚙ Ansicht`, `☰ Panels`), wurde auf reines Icon
(`.icon` + SVG aus dem Sprite) reduziert — beide öffnen ohnehin ein Popover mit den
eigentlichen Optionen, ein beschrifteter 40px-Pill-Button hätte die ohnehin volle Toolbar-Zeile
gesprengt. Tooltip (`title`) bleibt für Zugänglichkeit erhalten.

**Icon-Sprite:** Nur die tatsächlich verwendeten 6 Symbole (`ic-settings`, `ic-menu`,
`ic-light-mode`, `ic-dark-mode`, `ic-auto-mode`, `ic-download`) sind inline im `<body>` eingebettet, nicht
der komplette 24-Symbol-Sprite aus `icons/icon-sprite-inline.html` — bei Bedarf für neue
Icons dort nachschauen und ergänzen (Referenzquelle bleibt `icons/icon-sprite.svg`).

**Header bleibt neutral statt appbar-grün:** Die Design-System-Referenz-Appbar hat einen
satten grünen Hintergrund (`--md-primary-strong`) mit weißen Kontrollen. Dieser Header
beherbergt aber Suchfeld, Dashboard-Stats, Checkbox und Theme-Toggle nebeneinander in einer
dichten Toolbar-Zeile — auf grünem Grund wären diese (für eine helle/neutrale Fläche
ausgelegten) Elemente kaum lesbar gewesen. Der Header behält daher seinen bisherigen
neutralen `var(--surface)`-Hintergrund; Logo, Theme-Toggle und Versions-Badge sind eigene,
auf neutralen Hintergrund abgestimmte Regeln in `css/layout.css` (gleiche Klassennamen wie im
Design System, aber lokal mit anderen Farben überschrieben — funktioniert, weil die
Projekt-CSS-Dateien nach `css/design-components.css` geladen werden).

**Farb-Variablen:** `css/base.css` definiert die bisherigen semantischen Variablen
(`--bg`, `--surface`, `--border`, `--text`, `--text-muted`, `--accent`, `--warning`, `--error`,
…) jetzt als Aliase auf die `--md-*`-Tokens aus `css/design-tokens.css`, statt eigener
Hex-Werte — `css/layout.css`/`css/components.css` mussten dadurch **nicht** angefasst werden,
Farben/Theming laufen jetzt zentral über das Design System. Die sechs Geräte-/Plattform-Farben
(`--catalyst`, `--nexus`, `--firewall`, `--wlc`, `--ap`, `--unknown-device`) sind bewusst
**keine** Aliase, da sie keine Markenfarben sind, sondern eine Kategorie-Palette für die
Topologie-Darstellung (vergleichbar einer Chart-Farbskala) — sie behalten ihre eigenen,
pro Theme angepassten Werte.

## 10. Test-Strategie (kein Node.js auf der Entwicklungsmaschine)

- **Parser-/Modell-Unit-Tests:** `osascript -l JavaScript` (JXA) als Ersatz-JS-Runtime. Projektdateien werden über `ObjC.import('Foundation')` + `NSString.stringWithContentsOfFileEncodingError` gelesen (zuverlässiger als der Standard-Additions-`read`-Befehl bei Pfaden mit Sonderzeichen wie "Überblick") und per `new Function(code + 'return KLU;')()` ausgeführt.
- **End-to-End:** Safari + AppleScript `do JavaScript`/JXA `Application('Safari').doJavaScript()`, Test-Dateien werden als synthetische `File`-Objekte (`new File([text], name)` + `DataTransfer`) ins echte `<input type="file">` injiziert, um den echten Import-Pfad zu testen statt eine Test-only-Abkürzung zu bauen.
- Tab-Ziel für Safari-Automatisierung immer per URL-Match auflösen, niemals `document 1`/`window 1` (verwechslungsgefährdet, wenn parallel andere Tabs offen sind).
