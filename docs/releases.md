# Releases

Format basiert auf [Keep a Changelog](https://keepachangelog.com/), Versionierung nach [SemVer](https://semver.org/).

> Versionshistorie beginnt bei `0.1.0`, passend zum bereits im Code vorhandenen `KLU.version` (`js/core/namespace.js`) — dieses Dokument wurde nachträglich für ein bereits laufendes Projekt angelegt.

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
