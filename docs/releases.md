# Releases

Format basiert auf [Keep a Changelog](https://keepachangelog.com/), Versionierung nach [SemVer](https://semver.org/).

> Versionshistorie beginnt bei `0.1.0`, passend zum bereits im Code vorhandenen `KLU.version` (`js/core/namespace.js`) — dieses Dokument wurde nachträglich für ein bereits laufendes Projekt angelegt.

## [0.15.0] - 2026-08-21

### Changed
- `sample-data/` ersetzt: bisheriger 10-Switch-Datensatz (ACC1–8, CORE1–2) durch den 15-Switch-Zwei-Standorte-Campus "Musterkunde-Campus" (MUC Core/Dist/Access + FRA-Access) ausgetauscht — Standard-Demodatensatz für die Cisco-TechChamps-Präsentation. Bisheriger Datensatz bleibt über die Git-Historie dieses Ordners verfügbar (gezielt auf einzelne Feature-Tests zugeschnitten, siehe `sample-data/README.md`).

## [0.14.0] - 2026-08-19

### Fixed
- MAC-Adressen-Ansicht (Feature 3) und Duplicate-Erkennung (Feature 21) zeigten über einen
  Port-Channel-Uplink gelernte MAC-Adressen fälschlich als lokal an — `show mac address-table`
  weist eine solche Adresse der Port-Channel-Schnittstelle selbst zu (z.B. `Po1`), nicht einem
  einzelnen physischen Member-Port, wodurch der bisherige Uplink-Abgleich sie nie erfasste.
  `computeUplinkPortsBySwitch()` nimmt jetzt zusätzlich die Port-Channel-ID selbst in die
  Uplink-Menge auf. Voraussetzung bleibt, dass `show etherchannel summary`/`show port-channel
  summary` für den betroffenen Switch importiert ist — der Warn-Hover bei fehlenden Kommandos
  (Feature 15) weist jetzt zusätzlich auf diese Auswirkung hin.

### Added
- Neues Panel "Port-Channels" (rechte Spalte, Netzwerk-Ansicht): Übersicht je Switch, welche
  Port-Channels konfiguriert sind, aus welchen Member-Ports sie bestehen und ob sie laut CDP/LLDP
  als Uplink zu einem anderen Switch erkannt werden (inkl. Mehrfach-Nachbarn bei vPC/MC-LAG-
  Redundanzpaaren) — hilft nachzuvollziehen, warum eine MAC-Adresse in der MAC-Ansicht (nicht)
  ausgeschlossen wird.
- Topologie-Baum-Layout startet jetzt immer bei der Firewall (Redundanzpaar landet gleichberechtigt
  auf Ebene 0), statt beim Knoten mit dem höchsten Verbindungsgrad — die Firewall steht im
  Kundennetz fachlich über den Core-Switches. Ohne (sichtbare) Firewall wählt das Layout wie
  bisher automatisch geeignete Wurzeln.

## [0.13.0] - 2026-08-19

### Changed
- Topologie-Rendering komplett auf Cytoscape.js + cytoscape-fcose umgestellt (portiert aus dem
  Kollegen-Referenzprojekt "dora-the-explorer"), statt der bisherigen handgebauten SVG-Kraft-
  Simulation. Löst die verbliebenen Layout-Probleme (Ring-Bildung, Überlappung, Resize) durch eine
  ausgereifte, zweckgebaute Bibliothek statt weiterer Physik-Feintunings. Zwei wählbare Layouts:
  "Baum" (`breadthfirst`, Standard) und "Kräfte" (`fcose`).
- Standort-Gruppierung nutzt jetzt echte Cytoscape-Compound-Knoten (sichtbare gestrichelte Gruppen-
  Box mit Label) statt einer weichen Anziehungskraft + Text-Suffix am Knoten-Label.
- Geräte-Icons bleiben die bisherigen handgezeichneten Symbole (Switch/Firewall/WLC/Access Point),
  jetzt als aufgelöste SVG-Data-URIs im Cytoscape-Stylesheet statt als DOM-`<g>`-Elemente.
- Report-Export (`js/views/report-export.js`): Topologie-Abschnitt ist jetzt ein PNG-Snapshot
  (`KLU.views.topology.snapshotLightPng()`) statt eines DOM-Outerhtml-Snapshots — Cytoscape
  rendert in ein internes `<canvas>`, dessen Pixel nicht Teil der DOM-Serialisierung sind.

### Added
- Detail-Panel: Klick auf einen Knoten zeigt Icon/Typ/Hostname, bei importierten Switches Plattform/
  Modell/OS-Version, sowie die vollständige Nachbarliste mit Portbezeichnungen je Verbindung (Klick
  auf einen Nachbarn springt direkt dorthin).
- Export-Menü in der Topologie-Toolbar: PNG-Bild, CSV (Geräteliste) und JSON (Graph) der aktuell
  sichtbaren Topologie.
- Globale Suche springt bei Klick auf einen Treffer jetzt in die Netzwerk-Ansicht und fokussiert
  den betroffenen Switch (Detail-Panel + Nachbarschafts-Hervorhebung).

## [0.12.1] - 2026-08-19

### Fixed
- Topologie-Layout: Geräte auf derselben Ebene konnten sich trotz des geschichteten Layouts
  überlappen, weil die Kraft-Simulation innerhalb einer Ebene keinen garantierten Mindestabstand
  einhielt. Jede Ebene wird jetzt zusätzlich mit einem Mindestabstand (deckt Icon + typische
  Beschriftung ab) durchgesetzt — sowohl direkt nach der Layout-Berechnung als auch nach einer
  Fenstergrößenänderung (das reine proportionale Skalieren dabei konnte denselben Mindestabstand
  wieder unterschreiten).
- Neue Ansicht zoomt jetzt automatisch so weit heraus, dass alle Geräte auf Anhieb sichtbar sind,
  falls der erzwungene Mindestabstand die Ebene breiter macht als der sichtbare Ausschnitt.
- Geschütztes Rand-Clamping bei sehr kleinem Topologie-Panel (z. B. sehr schmales Fenster): vorher
  konnten invertierte Grenzen dazu führen, dass alle Ebenen auf eine Position kollabierten.

## [0.12.0] - 2026-08-18

### Fixed
- Topologie-Beschriftung war fett und schlecht lesbar: die Icon-Umstellung (0.11.0) hatte fill/stroke
  auf die Knoten-Gruppe verschoben, wodurch der Text die 2px-Icon-Kontur erbte. Text bekommt jetzt
  explizit `stroke: none`.
- Ausfall-Simulation aktivieren hebt jetzt eine noch laufende Fokus-Auswahl auf (verhinderte bisher,
  dass isolierte/ausgefallene Geräte klar erkennbar waren, weil beide Hervorhebungen gleichzeitig
  griffen).
- Topologie-Layout: reine Anziehung/Abstoßung drängte bei vielen schwach verbundenen Randgeräten
  (Access Points, unbekannte Geräte) trotz Zentrierung zu einem hohlen Ring statt einer gefüllten
  Fläche. Umgestellt auf ein geschichtetes Layout (Tiefe per BFS ab dem bestvernetzten Knoten),
  Kern oben, Endgeräte unten, jede Ebene nutzt die volle Breite.

### Changed
- Geräte-Farbe im Topologie-Graph ist jetzt einheitlich (neutrales Grau) — der Typ wird bereits über
  die Icon-Form unterschieden, Farbe ist damit ausschließlich Zuständen (fokussiert/ausgefallen/
  isoliert) vorbehalten.
- L3-Kommunikationsmatrix: Klick auf eine VLAN-Zeile mit ACL zeigt jetzt die tatsächlichen ACL-Regeln
  an (neuer Parser für "show ip access-lists", `js/parsers/access-lists.js`), nicht mehr nur ein
  Warn-Icon. `show ip interface`-Parser erfasst jetzt auch den ACL-Namen statt nur eines Flags.
- Beispieldatensatz TechChamps: neues VLAN 50 (Guest, nur SVI auf MUC-CORE2) für echte "nicht
  ermittelbar"-Zellen in der Matrix statt durchgehend "erreichbar", plus Regelinhalt für beide
  ACL-Beispiele (ACL_WIFI_GUEST, ACL_GUEST_ISOLATION).

## [0.11.0] - 2026-08-18

### Changed
- Topologie-Icons: Switch/Firewall/WLC/Access Point bekommen einfache, sofort lesbare
  Systemsymbole (Gehaeuse mit Ports, Backstein-Mauer, Gehaeuse mit Antenne, Funksymbol) statt
  generischer Formen (Kreis/Polygon) — angelehnt an uebliche draw.io/Visio-Netzwerksymbolik.
  "Unbekannte Geraete" bleiben bewusst das schlichte Rechteck.
- Kraft-basiertes Topologie-Layout: ideale Kantenlaenge skaliert jetzt mit Knotenzahl und
  Canvas-Flaeche statt eines festen Werts, zusaetzliche Zentrierung verhindert, dass bei vielen
  Knoten (grosse Kundennetze) fast alles an den Rand gedrueckt wird.
- Fenster-/Panel-Grössenänderungen berechnen die Positionen jetzt proportional neu (bisher
  blieben Knoten auf die zuletzt berechnete, ggf. deutlich kleinere Flaeche begrenzt).
- Der per Klick fokussierte Switch bekommt eine eigene, deutlich sichtbare Markierung
  (Akzentfarbe + Schatten) statt nur "nicht abgedunkelt wie der Rest" zu sein.

## [0.10.1] - 2026-08-18

### Fixed
- Topologie-Geräteerkennung (`KLU.topology.inferDeviceType`): aktuelle Catalyst-Access-Points
  (Wi-Fi 6/6E/7, Modellnamen `C91xx`/`CW9xxx`, z. B. `C9130AXI`) wurden fälschlich als Switch statt
  als Access Point erkannt, da sie ins generische `c\d{3,4}`-Switch-Muster fielen. Neues Muster
  greift vor dem Switch-Fallback.

## [0.10.0] - 2026-08-18

### Changed
- Bechtle Design System Retrofit: Farb-Tokens (`css/design-tokens.css`) und die geteilte Button-/Tab-/Icon-Komponente (`css/design-components.css`) übernommen, Bechtle-Logo im Header, Theme-Toggle (Hell/Automatisch/Dunkel) ersetzt das bisherige Dropdown, KI-Label folgt jetzt korrekt dem Theme (Datei-Umbenennung `ai-label-{light,dark}.svg`). Details/Begründung siehe `docs/architecture.md` Abschnitt 9.

## [0.9.0] - 2026-08-14

### Added
- Anonymisierungs-Option: Toggle "🕶 Anonymisieren" im Header ersetzt Hostnamen/IPs/MAC-Adressen sitzungsweit konsistent durch Platzhalter (`*HOSTNAME_001*` etc.) in allen Ansichten (Topologie, VLAN-Tabelle, MAC-/Trunk-/STP-/Duplicate-Panel, Versionsübersicht, Import-Liste, globale Suche) sowie in den CSV-Exports von VLAN-Tabelle und MAC-Detail-Ansicht; reine Anzeige-Transformation, Analyse-Stand und interne Lookup-Keys bleiben unverändert. Der PDF/HTML-Report-Export ist bewusst nicht abgedeckt (dokumentierte Einschränkung).

## [0.8.0] - 2026-08-14

### Added
- Multi-Standort-Gruppierung: optionaler Toggle gruppiert Topologie-Knoten nach Hostname-Präfix (vor erstem "-"/"_"), visuell per Layout-Clusterung + Label-Suffix — funktioniert nur bei entsprechender Namenskonvention (dokumentierte Einschränkung)

## [0.7.0] - 2026-08-14

### Added
- Redundanz-/Ausfall-Simulation: Klick auf Switch/Link bei aktivem "🔌 Ausfall-Simulation"-Toggle zeigt, welche Geräte dadurch isoliert würden (reine Graph-Erreichbarkeitsanalyse)

## [0.6.0] - 2026-08-14

### Added
- LLDP-Nachbarn zusätzlich zu CDP (`show lldp neighbor`), ergänzt Topologie-Erkennung bei deaktiviertem CDP oder Fremdherstellern; CDP hat je Port Vorrang
- VLAN-Tabelle höhenverstellbar (Ziehgriff, analog zu den rechten Detail-Panels)

## [0.5.0] - 2026-08-14

### Added
- Panel-Sichtbarkeits-Menü ("☰ Panels"): rechte Detail-Panels einzeln ein-/ausblendbar, Präferenz in `localStorage` gemerkt
- `index.html`-Weiterleitung für GitHub-Pages-Hosting (Repo-Wurzel-URL funktioniert jetzt ohne Umbenennung der Haupt-HTML-Datei)

## [0.4.0] - 2026-08-14

### Added
- Duplicate-IP/MAC-Erkennung (neues Panel, nutzt bereits vorhandene MAC-Tabellen/ARP-Daten, kein neuer Parser)

### Changed
- Projekt umbenannt von "Kunden LAN Überblick" zu "L2-L3 Kommunikationsmatrix" (Ordner, Haupt-HTML-Datei, alle Code-/Doku-Referenzen)
- Repo-Hosting auf Dual-Remote umgestellt: GitHub (`dmichel999/L2-L3-Kommunikationsmatrix`, neu) zusätzlich zu Bechtle Gitea (bisher Gitea-only)

## [0.3.0] - 2026-08-14

### Added
- STP Root-Bridge- und blockierte-Ports-Erkennung (`show spanning-tree`, neues Panel)
- HSRP/VRRP Active/Standby-Rolle je SVI (`show standby`/`show hsrp`/`show vrrp`, erweitert die Netzwerk-Details-Ansicht)
- PDF/HTML-Report-Export (eigenständige HTML-Datei, druckbar zu PDF, kein PDF-Generator-Vendor-Paket)

### Changed
- Rechte Panel-Reihenfolge: VLAN-Tabelle → MAC-Adressen → Trunk-Warnungen → STP → Netzwerk-Details
- VLAN-Tabelle und die drei Detail-Panels haben jetzt eine begrenzte bzw. gleiche Standardhöhe (vorher: VLAN-Tabelle wuchs unbegrenzt und verdrängte die Panels)

### Fixed
- Netzwerk-Details/Trunk-Warnungen/MAC-Adressen konnten bei vielen VLANs auf 0px zusammengedrückt werden (`.split-pane-right` war fälschlich ein Flex-Container, `.panel` hatte durch `overflow:hidden` keine Mindesthöhe mehr)

## [0.2.0] - 2026-08-13

### Added
- L3-Kommunikationsmatrix (VLAN×VLAN-Routing-Reachability + ACL-Hinweis-Flag), Versionsübersicht, CSV-Export (VLAN-Tabelle + MAC-Ansicht), Dashboard-Kennzahlen, globale Suche (MAC/IP/Hostname)
- Neue Parser: `show interfaces trunk` (Native-VLAN-Mismatch-Erkennung), `show ip interface` (voll, ACL-Flag), `show arp`/`show ip arp`
- Topologie: Zoom (Mausrad + Buttons), Geräte-Typ-Filter in der Legende, Switch-Fokus-Filter, VLAN-Highlight, Portbezeichnungen an Kanten, Vollbild-Modus
- Split-Pane-Layout (Topologie/VLAN-Tabelle nebeneinander, breitenverstellbar)
- Kollabierbare, unabhängig höhenverstellbare Detail-Panels (Netzwerk-Details/Trunk-Warnungen/MAC-Adressen); Sidebar ebenfalls breitenverstellbar mit einklappbaren Bereichen
- Sortierbare Import-Liste (Drag & Drop); Import-Feedback-Panel (Plattform-Korrektur per Dropdown, Hover-Popup mit Feature-Auswirkung fehlender Kommandos je Switch)
- Dark Mode (Hell/Dunkel/System, `localStorage`-gemerkt)
- Bechtle-AI-Label + Text-Hinweis im Footer (KI-Kennzeichnungspflicht, siehe `MASTERPROMPT.md`); Projektstruktur an Masterprompt angeglichen (`docs/`, `.editorconfig`, `LICENSE`, Content-Security-Policy)

### Fixed
- Portbezeichnungen an Kanten zeigten im Standard-Modus "Aggregiert" für Verbindungen ohne Port-Channel-Bündelung "undefined ↔ undefined" statt der echten Portnamen
- Drag & Drop-Sortierung der Import-Liste hatte einen Off-by-one-Fehler (Eintrag landete einen Slot neben dem Ziel)
- CDP-Parser zerlegte mehrwortige Platform-Strings (z. B. "Cisco IP Phone 7841" bei IP-Telefonen als CDP-Nachbar) falsch
- Globale Suche verwarf rein-hexadezimale Hostnamen (z. B. "CAFE99") fälschlich als reine MAC-Suche
- Nexus-Routing-Parser (`show ip route`) brach bei Zusatzfeldern nach "direct" ab und verwarf dadurch gültige connected Routes
- CDP-/VLAN-/`show ip route`-Parser robuster gegen reale Export-Eigenheiten gemacht (optionales `show version`, Leerzeilen-Padding, `+`-MAC-Marker, Spaltenversatz bei Platform/Port-ID) — anhand eines echten Kundenexports gefunden

## [0.1.0] - 2026-08-13

### Added
- Grundgerüst: Topologie-Grafik aus `show cdp neighbor` (inkl. Port-Channel-Aggregation, Geräte-Typ-Icons, Drag & Drop), VLAN-Tabelle mit IP-Netz-Ermittlung, MAC-Adressen-Ansicht je VLAN, SVI-Switch-Ansicht je IP-Netz
- `.docx`-Import-Unterstützung (JSZip-basiert)
- 10-Switch-Beispieldatensatz unter `sample-data/`
