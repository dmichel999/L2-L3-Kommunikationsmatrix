# Architektur — Kunden LAN Überblick

## 1. Technische Entscheidungen

| Entscheidung | Begründung |
|---|---|
| **Kein Framework, kein Build-System** | Ordner öffnen (`Kunden LAN Überblick.html` via `file://`) → läuft. Kein npm, kein Bundler. |
| **Namespace-Pattern statt ES-Module** | ES-Module brauchen einen HTTP-Server (CORS-Restriktionen bei `file://`), klassische `<script>`-Tags nicht. |
| **Ein globales Objekt `KLU`, alle `<script>`-Tags teilen einen Scope** | Jede Datei erweitert `KLU.*`. Das bedeutet: `const`/`let`-Namen auf Modul-Ebene müssen projektweit eindeutig sein (siehe Abschnitt 4) — es gibt keine echte Modul-Isolation. |
| **Event-Bus (`KLU.on`/`KLU.emit`) statt direkter Kopplung** | Views reagieren auf Zustandsänderungen (`switches:changed`, `vlan:selected`, …), ohne sich gegenseitig zu kennen. Neue Views lassen sich anhängen, ohne bestehende zu ändern. |
| **Reines Client-Side-Parsing, keine KI im Loop** | Kundendaten (Netzwerk-Konfiguration) verlassen den Browser nicht — passend zum sensiblen Charakter der Daten und zum Bechtle-Gitea-only-Hosting dieses Projekts. |
| **jszip.min.js als einzige Dependency** | Nur für `.docx`-Import (ZIP-Entpacken), lokal vendort unter `lib/`, kein CDN. |

## 2. Dateistruktur

```
├── Kunden LAN Überblick.html   Einstiegspunkt, Script-Tags in Ladereihenfolge, HTML-Grundgerüst
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

Eigenes, einfaches Force-Directed-Layout (kein D3) in `js/views/topology.js`, Positionen werden pro Session gecacht (`cachedPositions`) und nur bei geänderter Switch-Menge neu berechnet. Rendering ist ein vollständiger SVG-Rebuild pro Frame (kein Diffing) — bei der Knotenanzahl, für die dieses Tool gedacht ist (Kunden-LAN, typischerweise < 100 Switches), ist das ausreichend performant; ein Rebuild bei jedem `pointermove` während Drag/Zoom/Resize wird über `requestAnimationFrame`-Drosselung (Split-Pane-Resizer) bzw. bewusst in Kauf genommen (Node-Drag/Zoom, siehe `docs/bugs.md`-Historie) gebremst.

Zoom/Pan ist ein reiner Transform auf einer `<g class="zoom-layer">`, die Knoten-"Weltkoordinaten" bleiben davon unberührt — Drag-Interaktionen rechnen Bildschirmkoordinaten über den aktuellen Zoom-Zustand in Weltkoordinaten zurück (`svgPointFromEvent`).

## 7. Wiederverwendbare UI-Bausteine

- **`js/views/split-pane.js`**: generischer horizontaler Resizer (Flexbox, `flexBasis`), genutzt für Topologie/VLAN-Tabelle-Split und (separat instanziiert) für den Sidebar-Resizer.
- **`js/views/collapsible-panel.js`**: generische einklappbare, optional höhenverstellbare Panel-Komponente (`.panel`/`.panel-header`/`.panel-body`/`.panel-resize-handle`), genutzt für die drei rechten Detail-Panels und die Sidebar-Bereiche.
- **`js/core/theme.js`**: Hell/Dunkel/System per `data-theme`-Attribut auf `<html>` + `localStorage`. CSS-Variablen in `css/base.css` sind dreifach definiert (Basis auf `:root`, System-Override unter `@media (prefers-color-scheme: dark) :root:not([data-theme="light"])`, expliziter Override unter `:root[data-theme="dark"]`).

## 8. Test-Strategie (kein Node.js auf der Entwicklungsmaschine)

- **Parser-/Modell-Unit-Tests:** `osascript -l JavaScript` (JXA) als Ersatz-JS-Runtime. Projektdateien werden über `ObjC.import('Foundation')` + `NSString.stringWithContentsOfFileEncodingError` gelesen (zuverlässiger als der Standard-Additions-`read`-Befehl bei Pfaden mit Sonderzeichen wie "Überblick") und per `new Function(code + 'return KLU;')()` ausgeführt.
- **End-to-End:** Safari + AppleScript `do JavaScript`/JXA `Application('Safari').doJavaScript()`, Test-Dateien werden als synthetische `File`-Objekte (`new File([text], name)` + `DataTransfer`) ins echte `<input type="file">` injiziert, um den echten Import-Pfad zu testen statt eine Test-only-Abkürzung zu bauen.
- Tab-Ziel für Safari-Automatisierung immer per URL-Match auflösen, niemals `document 1`/`window 1` (verwechslungsgefährdet, wenn parallel andere Tabs offen sind).
