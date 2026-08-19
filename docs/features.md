# L2-L3 Kommunikationsmatrix — Feature-Spezifikation

## Zweck

Analyse eines Kunden-LANs (Catalyst + Nexus Switche) anhand von `show`-Kommando-Outputs: physische Topologie, VLAN-Verteilung, IP-Netze pro VLAN, MAC-Adressen pro VLAN/Port.

## Architektur

Rein client-seitig (HTML/JS, kein Build-System, kein npm), analog `Config Anonymizer`/`Meraki Doku Standalone`. Kein Server, keine KI im Loop — Kundendaten verlassen den Browser nicht. Passt zum Bechtle-Gitea-only-Hosting dieses Projekts.

## Input

- **Ein File pro Switch**, Mehrfach-Import (Drag&Drop/File-Picker, mehrere Dateien auf einmal).
- Unterstützte Formate: **Textfiles** (`.txt`/`.log`) und **Word-Dokumente** (`.docx`) — falls Kunden ihre show-Kommando-Mitschriften in Word statt reinem Text abgelegt haben. `.docx` wird lokal per `lib/jszip.min.js` entpackt und `word/document.xml` in Text zurückverwandelt (ein Word-Absatz = eine Zeile), bevor derselbe Parser wie bei `.txt` läuft.
- Jede Datei enthält die Outputs aller Kommandos eines Switches nacheinander (z.B. per `terminal length 0` + Copy/Paste einer ganzen Session). Parser muss Kommando-Blöcke anhand der Prompt-Zeile (`switch#show ...`) oder der Kommando-Marker erkennen und trennen.
- Plattform-Erkennung pro Datei über `show version`-Output (Catalyst = IOS/IOS-XE, Nexus = NX-OS) — steuert, welche Parser-Variante (z.B. `show etherchannel summary` vs. `show port-channel summary`, `show arp` vs. `show ip arp`) angewendet wird.

### Erwartete Kommandos je Plattform

| Zweck | Catalyst (IOS/IOS-XE) | Nexus (NX-OS) |
|---|---|---|
| Hostname/Plattform | `show version` | `show version` |
| Nachbarn (Topologie) | `show cdp neighbor` | `show cdp neighbor` |
| Port-Channel/Etherchannel | `show etherchannel summary` | `show port-channel summary` |
| VLANs | `show vlan` | `show vlan` |
| MAC-Tabelle | `show mac address-table` | `show mac address-table` |
| Interface-Status/IP | `show ip interface brief` | `show ip interface brief` |
| ARP | `show arp` | `show ip arp` |
| Routing (für Netz+Maske) | `show ip route` | `show ip route` |
| Trunk/Native-VLAN | `show interfaces trunk` | `show interface trunk` |
| ACL-Vorhandensein je SVI | `show ip interface` (voll, nicht `brief`) | `show ip interface` (voll, nicht `brief`) |
| STP Root-Bridge/blockierte Ports | `show spanning-tree` | `show spanning-tree` |
| FHRP-Rolle (Active/Standby) je SVI | `show standby` (HSRP) / `show vrrp` | `show hsrp` / `show vrrp` |

## Feature 1: Topologie-Grafik

- Knoten = Switches (Hostname aus `show version`), Kanten = physische Verbindungen aus `show cdp neighbor`.
- **Umschaltbare Darstellung der Etherchannel/Port-Channel-Links** (Toggle in der UI):
  - **Aggregiert:** Ein Port-Channel zwischen zwei Switches = eine Linie, Label zeigt Member-Ports (z.B. `Po1: Gi1/0/1, Gi1/0/2`).
  - **Einzeln:** Jedes physische Member-Interface als eigene Linie.
- Zuordnung Port → Port-Channel kommt aus `show etherchannel summary` (Catalyst) bzw. `show port-channel summary` (Nexus).
- **Nicht importierte CDP-Nachbarn** (Firewall, WLC, Access Point, sonstige Geräte) werden ebenfalls als Knoten angezeigt, sobald ein importierter Switch sie als CDP-Nachbar meldet — auch wenn für sie keine eigene Datei importiert wurde (kein VLAN/MAC/IP-Wissen über sie, nur Verbindungspunkt). Typ wird aus dem (ggf. abgeschnittenen) CDP-Platform-String erkannt: `KLU.topology.inferDeviceType()`.
- **Handgezeichnete Icons je Gerätetyp:** Gehäuse mit Ports = Switch, Backstein-Mauer = Firewall, Gehäuse mit Antenne = WLC, Funksymbol = Access Point, Quadrat = unbekanntes Gerät. Farbe ist bewusst einheitlich (neutraler Grauton) — Typ wird über die Icon-Form unterschieden, Farbe bleibt ausschließlich Zuständen (Fokus/VLAN-Hervorhebung/Ausfall-Simulation) vorbehalten. Legende in der Toolbar (zugleich Geräte-Typ-Filter, siehe Feature 13).
- **Zwei Layouts umschaltbar:** "Baum" (Standard, hierarchisch top-down) und "Kräfte" (organisch) — Rendering seit 0.13.0 über Cytoscape.js + cytoscape-fcose statt einer selbstgebauten SVG-Kraft-Simulation (siehe `docs/architecture.md` §6).
- **Knoten sind per Drag & Drop verschiebbar** (Layout wird pro Session gemerkt, nicht persistiert).
- **Klick auf einen Knoten** öffnet ein Detail-Panel (Icon/Typ/Hostname, bei importierten Switches Plattform/Modell/OS-Version, vollständige Nachbarliste mit Portbezeichnungen — Klick auf einen Nachbarn springt direkt dorthin) und filtert gleichzeitig auf dessen Verbindungen wie bisher (siehe Feature 12).
- **Export-Menü** in der Toolbar: PNG-Bild, CSV (Geräteliste) oder JSON (Graph) der aktuell sichtbaren Topologie.

## Feature 2: VLAN-Tabelle

Spalten: VLAN-ID, VLAN-Name, zugeordnetes IP-Netz (falls vorhanden), Liste der Switches, auf denen das VLAN existiert (aus `show vlan` je Switch).

### IP-Netz-Ermittlung (beide Quellen kombiniert)

- **Primär:** `show ip route` → connected Routes liefern Netz **inkl. Maske** für das VLAN-Interface.
- **Ergänzend:** `show ip interface brief` → liefert die konkrete IP-Adresse des SVI und auf welchem Switch/Interface-Status (up/down) — zum Cross-Check und für Fälle, in denen die Route (z. B. bei VRF-Besonderheiten) nicht eindeutig ist.
- Wenn beide Quellen für dasselbe VLAN unterschiedliche Switches als Interface-Träger zeigen (z.B. bei HSRP/VRRP mit mehreren SVIs), werden alle beteiligten Switches aufgeführt.

## Feature 3: Klick auf VLAN → MAC-Adressen-Ansicht

Zeigt: Switch + Switchport für jede gelernte MAC-Adresse in diesem VLAN (aus `show mac address-table`, gefiltert auf die VLAN-ID).

**Ausschlüsse:**
- **Uplinks zwischen Switches:** Ports, die laut `show cdp neighbor` oder Port-Channel-Membership (`show etherchannel/port-channel summary`) zu einem anderen bekannten Switch führen.
- **MAC-Adressen der VLAN-Interfaces (SVI) selbst:** Einträge mit Type `static`/`self` bzw. Port-Bezeichnung `CPU`/`Router`/`Vlan*` statt eines physischen Interfaces.

## Feature 4: Klick auf IP-Netz → SVI-Switch-Ansicht

Zeigt, auf welchem Switch (und ggf. mehreren bei HSRP/VRRP) das VLAN-Interface für dieses Netz konfiguriert ist — abgeleitet aus derselben Quelle wie Feature 2. Sind für das VLAN zusätzlich `show standby`/`show hsrp`/`show vrrp`-Daten vorhanden, wird pro Switch die FHRP-Rolle ergänzt (z.B. "CORE1 (Active), CORE2 (Standby)") statt nur die reine Switch-Liste zu zeigen (siehe Feature 19).

## Feature 5: L3-Kommunikationsmatrix

Neue Ansicht (Tab "Kommunikationsmatrix"): Matrix VLAN×VLAN, zeigt pro Paar, ob laut `show ip route` (connected Routes der SVIs) mindestens ein Switch **beide** VLAN-Interfaces trägt — dieser Switch kann direkt zwischen seinen eigenen connected Netzen routen. ✓ = routbar über einen bekannten gemeinsamen Switch, **?** = nicht ermittelbar (kein Beweis für "blockiert", könnte z.B. über dynamisches Routing zwischen zwei Kern-Switches trotzdem funktionieren).

**ACL-Hinweis-Flag:** Falls auf einer beteiligten SVI laut `show ip interface` (voll) eine Access-List (eingehend oder ausgehend) konfiguriert ist, wird die VLAN-Zeile mit ⚠ ACL markiert. **Keine Auswertung der ACL-Regeln** — bewusste Vereinfachung, siehe "Entschieden" unten.

## Feature 6: Versionsübersicht

Neue Ansicht (Tab "Versionen"): Hostname, Plattform, Modell, IOS/NX-OS-Version je Switch — nutzt ausschließlich die bereits vorhandenen `show-version`-Parserdaten (inkl. neu extrahiertem `osVersion`-Feld).

## Feature 7: CSV-Export

Button "CSV exportieren" an der VLAN-Tabelle (alle VLANs/Netze/Switches) und an der MAC-Detail-Ansicht (alle MAC-Einträge des ausgewählten VLANs). Semikolon-getrennt mit UTF-8-BOM (Excel-DE-Konvention).

## Feature 8: Dashboard-Kennzahlen

Kompakte Kennzahlen-Leiste im Header: Anzahl Switches, Anzahl VLANs, Anzahl VLANs ohne SVI, Gesamtzahl gelernter MAC-Tabellen-Einträge. Rein aggregiert aus vorhandenen Modellen, kein neuer Parser.

## Feature 9: Globale Suche

Eingabefeld im Header: MAC-Adresse, IP-Adresse oder Hostname eingeben → direkte Treffer-Liste (Switch/Port/VLAN bzw. Switch/Modell). IP-Suche prüft zuerst SVI-IPs (`show ip interface brief`), danach ARP-Einträge (neuer Parser `arp.js`, deckt sowohl `show arp` als auch `show ip arp` ab) — ein Treffer über ARP wird zusätzlich mit der MAC-Tabelle verknüpft, um Switch/Port/VLAN des Endgeräts zu zeigen. Klick auf einen Treffer wechselt in die Netzwerk-Ansicht und fokussiert den betroffenen Switch in der Topologie (Detail-Panel + Nachbarschafts-Hervorhebung, siehe Feature 12) — bei einem MAC-/IP-/CDP-Nachbar-Treffer immer der Switch, auf dem der Eintrag gefunden wurde, nicht das ggf. gemeinte Endgerät selbst.

## Feature 10: Trunk-VLANs + Native-VLAN-Mismatch

Neuer Parser `interfaces-trunk.js` für `show interfaces trunk` (Catalyst) / `show interface trunk` (Nexus). Neues Trunk-Panel unterhalb der VLAN-Tabelle: Warnung, wenn zwei über CDP/Port-Channel verbundene Switches auf dem jeweiligen Trunk-Port unterschiedliche Native-VLANs konfiguriert haben (Link-Zuordnung analog zur bestehenden Uplink-Erkennung in Feature 3). Erlaubte VLANs je Port werden als Roh-String übernommen (keine Bereichs-Expansion von z.B. "1-4094"), reine Anzeige.

## Feature 11: Layout — Topologie neben VLAN-Tabelle (Split-Pane)

Topologie und VLAN-Tabelle liegen im Tab "Netzwerk" nebeneinander (Split-Pane mit ziehbarem Resizer statt getrennter Tabs), Breite pro Sitzung merkbar (nicht persistiert). Generischer `split-pane.js`-Helfer, wiederverwendbar für künftige Splits.

## Feature 12: Topologie-Interaktionen (Highlight, Port-Labels, Fokus-Filter)

- **VLAN-Highlight:** Sobald eine VLAN-Zeile ausgewählt ist (Feature 3), werden die Switch-Knoten mit diesem VLAN im Graph hervorgehoben (dickerer Rahmen), alle anderen Knoten abgedunkelt (Opazität reduziert).
- **Portbezeichnungen:** Toggle in der Toolbar (Default aus) zeigt die Interface-Bezeichnung an jeder Kante — erst ab Zoomstufe ≥150% (`PORT_LABEL_MIN_ZOOM`), da die Kanten-Mittelpunkte bei vielen kurzen Verbindungen zu einem Hub-Switch in Normalansicht zu dicht beieinander liegen und sich sonst unlesbar überlappen. Beim Hineinzoomen rücken sie räumlich auseinander.
- **Switch-Fokus-Filter + Detail-Panel:** Klick auf einen Knoten filtert auf dessen eigene Verbindungen (alle anderen Kanten/Knoten werden abgedunkelt) und öffnet gleichzeitig das Detail-Panel (siehe Feature 1). Klick auf die leere Fläche oder erneuter Klick auf denselben Knoten hebt Fokus + Panel wieder auf. Ein Treffer in der globalen Suche (Feature 9) springt ebenfalls hierher.

## Feature 13: Topologie — Zoom + Geräte-Typ-Filter

- **Zoom:** Mausrad zoomt zentriert auf die Cursor-Position; zusätzlich +/−/Einpassen-Buttons in der Toolbar für Nicht-Maus-Bedienung. Zoom-Stand ist pro Sitzung gemerkt, nicht persistiert.
- **Geräte-Typ-Filter:** Die Legende ist zugleich Filter — jede Checkbox blendet Knoten (und deren Kanten) dieses Gerätetyps aus, ohne das Layout neu zu berechnen (Positionen bleiben stabil, nur Sichtbarkeit ändert sich).

## Feature 14: Switch-Import-Liste sortierbar

Jede Zeile in der Import-Liste hat einen Ziehgriff (⠿), mit dem sich importierte Switches per Drag & Drop neu anordnen lassen (z.B. um zusammengehörige Switches gruppiert zu sehen). Reine Anzeige-Reihenfolge, hat keinen Effekt auf Topologie/VLAN-Tabelle/Matrix (deren Sortierung ist unabhängig). Nicht persistiert.

## Feature 15: Import-Feedback-Panel

Pro importiertem Switch in der Sidebar-Liste: Plattform-Badge ist jetzt ein Dropdown (Catalyst/Nexus), mit dem der User die automatische Erkennung korrigieren kann — ändert `sw.platform` und parst `show ip route` (einzige plattformabhängige Parser-Variante der bereits erfassten Kommandos) neu. Die Warnung "N fehlend" ist jetzt ein Hover-Popup statt reinem Browser-Tooltip: pro fehlendem Kommando wird angezeigt, welches Feature/welche Ansicht dadurch für diesen Switch eingeschränkt ist.

## Feature 16: UI-Layout-Verbesserungen (Nutzer-Feedback nach Erweiterung)

- **VLAN-Tabelle:** Spalte "Switches mit VLAN" entfernt (Platzgrund) — bleibt im CSV-Export enthalten, ist über Klick auf ein IP-Netz weiterhin abrufbar (Feature 4).
- **Kollabierbare Panels:** Netzwerk-Details/Trunk-Warnungen/MAC-Adressen sind jetzt drei permanent gleichzeitig sichtbare, aber unabhängig einklappbare und in der Höhe verstellbare Panels (Ziehgriff unten) statt reiner Auf/Zu-Logik über den Auswahlzustand. Gleiche Panel-Komponente (`js/views/collapsible-panel.js`) auch für die zwei Sidebar-Bereiche (Import-Dropzone, Switch-Liste) — dort ohne Höhen-Resize, nur einklappbar.
- **Sidebar breitenverstellbar:** Resizer zwischen Sidebar und Hauptbereich (analog zum bestehenden Split-Pane-Resizer der Netzwerk-Ansicht).
- **Topologie-Vollbild:** Button in der Toolbar nutzt die native Fullscreen-API auf den gesamten Topologie-Bereich (inkl. Toolbar, nicht nur die Canvas-Fläche).
- **Dark Mode:** Auswahl Hell/Dunkel/System im Header (`localStorage`-gemerkt, bewusst NICHT flüchtig wie der Analyse-Stand, da reine UI-Präferenz ohne Kundendatenbezug). "System" nutzt weiterhin `prefers-color-scheme`.

**Bugfix (im selben Zug behoben):** Portbezeichnungen an Kanten (Feature 13) zeigten im Standard-Modus "Aggregiert" für Verbindungen ohne Port-Channel-Bündelung "undefined ↔ undefined", da aggregierte Kanten kein eigenes `aPort`/`bPort` besitzen (nur `members[]`) — wirkte wie "Label nur im Modus 'Einzelne Verbindungen' sichtbar". Fällt jetzt korrekt auf den Member-Port zurück.

## Feature 17: Kompakte Topologie-Toolbar + KI-Kennzeichnung

- **Toolbar-Redesign:** Aggregiert/Einzeln-Toggle, Portbezeichnungen-Toggle und die Geräte-Typ-Legende/-Filter waren permanent sichtbar und nahmen bei schmaleren Fenstern 2–3 Zeilen Höhe ein. Jetzt in einem Popover ("⚙ Ansicht", Klick öffnet/schließt, Klick außerhalb schließt) — die sichtbare Toolbar ist auf Titel + Zoom-Controls + Vollbild + den Popover-Button reduziert (eine Zeile, unabhängig von Fenstergröße).
- **KI-Kennzeichnung (Pflicht laut `MASTERPROMPT.md` für alle `Cisco/`-Projekte):** Footer zeigt den Text-Hinweis "thought up by human, coded by ai" sowie das offizielle Bechtle-AI-Label als Icon (`assets/Bechtle_AI_Generated_Label_{light,dark}_EN.svg`, lokal vendort, keine externe Nachladung). Icon folgt automatisch dem aktuell dargestellten Theme (inkl. Live-Wechsel bei OS-Theme-Änderung im "System"-Modus). Gleicher Text-Kommentar zusätzlich in der Haupt-HTML-Datei und `js/app.js`.

## Feature 18: STP Root-Bridge + blockierte Ports

Neuer Parser `spanning-tree.js` für `show spanning-tree` (Catalyst + Nexus, identisches Format). Neues Panel "STP: Root-Bridge & blockierte Ports" (rechte Seite, unterhalb Trunk-Warnungen): pro VLAN, welcher importierte Switch die Root-Bridge ist (Abgleich über die Bridge-MAC-Adresse — meldet kein importierter Switch eine passende Adresse, wird "unbekannt (Adresse)" angezeigt statt es zu verschweigen) sowie eine Liste aller Ports mit STP-Status `BLK` (blockiert, typischer Loop-Präventionspunkt bei redundanten Links). Reine Anzeige, keine Bewertung, ob die Root-Bridge-Wahl "sinnvoll" ist (das erfordert Netzwerk-Kontextwissen, das die App nicht hat).

## Feature 19: HSRP/VRRP Active/Standby-Rolle je SVI

Neuer Parser `fhrp.js` für `show standby` (Catalyst HSRP), `show hsrp` (Nexus HSRP) und `show vrrp` (beide Plattformen) — alle drei teilen dasselbe Grundmuster ("VlanNN - Group G" + "state is <Wort>"), ein Parser genügt. Erweitert die bestehende Netzwerk-Details-Ansicht (Feature 4): bei mehreren SVIs für dasselbe Netz wird jetzt zusätzlich die gemeldete Rolle je Switch angezeigt (z.B. "CORE1 (Active), CORE2 (Standby)") statt nur die reine Switch-Liste. Bewusst kein neues Panel — die Detailtiefe ergänzt die bereits vorhandene "alle beteiligten Switches"-Anzeige direkt.

## Feature 20: PDF/HTML-Report-Export

Button "📄 Report exportieren" im Header. Erzeugt eine eigenständige HTML-Datei (`js/views/report-export.js`) durch Snapshotten der bereits gerenderten DOM-Abschnitte (Versionsübersicht, VLAN-Tabelle, L3-Kommunikationsmatrix, Trunk-Warnungen, STP) mit vollständig inline eingebettetem, statischem Light-Theme-CSS — kein Server, keine externe Nachladung, keine PDF-Generator-Bibliothek nötig. Für ein PDF nutzt der User die Browser-Druckfunktion (Cmd/Strg+P → Als PDF sichern) auf der exportierten Datei — deckt den Kundenlieferungs-Anwendungsfall ab, ohne eine schwere zusätzliche Abhängigkeit zu vendorn. Reiner Snapshot des aktuellen Zustands (inkl. z.B. gerade aktivem VLAN-Highlight/Geräte-Typ-Filter in der Topologie); Netzwerk-Details/MAC-Adressen (Drill-down-Panels, nicht Übersichts-Ebene) sind bewusst nicht Teil des Reports.

Die Topologie selbst ist seit 0.13.0 ein PNG-Snapshot (`KLU.views.topology.snapshotLightPng()`, siehe `docs/architecture.md` §6) statt eines DOM-Abschnitts — Cytoscape rendert in ein `<canvas>`, dessen Pixel sich nicht per DOM-Snapshot einbetten lassen. Der Snapshot zeigt immer den gesamten Graphen (unabhängig vom gerade eingestellten Zoom/Pan-Ausschnitt), respektiert aber den aktiven Geräte-Typ-Filter sowie eine gerade aktive VLAN-Hervorhebung.

## Feature 21: Duplicate-IP/MAC-Erkennung

Neues Panel "Duplicate-Erkennung" (rechte Seite, unterhalb STP): nutzt ausschließlich bereits vorhandene `macTable`/`arpEntries`-Daten, kein neuer Parser. Zwei Diagnose-Checks:
- **Doppelte MAC-Adressen:** dieselbe MAC im selben VLAN gleichzeitig auf mehr als einem Nicht-Uplink-Port gelernt (Hinweis auf Loop, MAC-Cloning oder ein Gerät mit zwei aktiven Anschlüssen) — nutzt dieselbe Uplink-Ausschlussliste wie Feature 3 (`KLU.macModel.computeUplinkPortsBySwitch`, dafür exportiert).
- **Doppelte IPs:** dieselbe IP laut ARP-Tabelle mit unterschiedlichen MAC-Adressen (klassisches IP-Konflikt-Symptom).

Reine Diagnose-Anzeige, keine automatische Bewertung, welcher der beiden Einträge "der richtige" ist.

## Feature 22: Panel-Sichtbarkeits-Menü

Button "☰ Panels" in der VLAN-Tabellen-Toolbar öffnet ein Popover mit einer Checkbox je rechtem Detail-Panel (MAC-Adressen/Trunk-Warnungen/STP/Duplicate-Erkennung/Netzwerk-Details) — bei wachsender Panel-Zahl sonst zu viel permanenter Platzverbrauch. Deaktivierte Panels werden komplett ausgeblendet (nicht nur eingeklappt wie beim bestehenden Collapse-Button). Reine UI-Präferenz ohne Kundendatenbezug → wie die Theme-Auswahl bewusst NICHT flüchtig, in `localStorage` gemerkt.

## Feature 23: LLDP zusätzlich zu CDP

Neuer Parser `lldp.js` für `show lldp neighbor` (Catalyst + Nexus, identisches Format). Ergänzt CDP für Fälle, in denen CDP deaktiviert ist oder Fremdhersteller-Geräte (kein CDP-Support) im Netz hängen — CDP hat je lokalem Port Vorrang, LLDP füllt nur Lücken, damit derselbe physische Link nicht doppelt als zwei Kanten gezeichnet wird (`KLU.topology.buildGraph`). Da die LLDP-Kurztabelle keine Platform-Spalte hat, wird der Gerätetyp nicht importierter Nachbarn stattdessen aus den IEEE-802.1AB-Capability-Codes abgeleitet (`KLU.topology.inferDeviceTypeFromLldpCapability`: `W` → Access Point, `B` → Switch, sonst unbekannt). `lldpNeighbor` ist bewusst NICHT in den erwarteten Kommandos gelistet — auf einem normalen All-Cisco-Netz mit aktivem CDP fehlt es praktisch immer und wäre dort nur irreführendes Rauschen im Import-Feedback-Panel.

## Feature 24: VLAN-Tabelle höhenverstellbar

Ziehgriff unterhalb der VLAN-Tabelle (analog zu den rechten Detail-Panels) — Startgröße 280px, per Drag verstellbar. Nutzt denselben Ziehgriff-Mechanismus wie `collapsible-panel.js` (dafür als `KLU.views.collapsiblePanels.initHeightResizeHandle()` verallgemeinert), aber eigenständig ohne die volle `.panel`-Struktur, da die VLAN-Tabelle keinen einklappbaren Header hat.

## Feature 25: Redundanz-/Ausfall-Simulation

Toggle "🔌 Ausfall-Simulation" in den Topologie-Ansichtsoptionen. Solange aktiv, simuliert ein Klick auf einen Switch-Knoten oder eine Verbindung deren Ausfall: `js/core/failure-sim-model.js` entfernt den geklickten Knoten (inkl. aller seiner Kanten) bzw. die geklickte Kante aus dem Graphen und berechnet die Zusammenhangskomponenten (Connected Components) des Rests. Alle Geräte außerhalb der größten verbleibenden Komponente gelten als isoliert und werden rot hervorgehoben; ein Overlay über der Topologie nennt sie namentlich.

Nutzt bewusst dieselbe Kantenliste, die gerade angezeigt wird (`KLU.state.linkMode`): im Einzeln-Modus simuliert ein Klick nur das eine angeklickte physische Kabel (bei einem redundanten Bündel bleibt das Netz dann korrekt zusammenhängend), im Aggregiert-Modus den selteneren Fall "das ganze Bündel fällt gleichzeitig aus".

**Bewusste Vereinfachung:** reine Graph-Erreichbarkeit, keine Kenntnis von dynamischem Routing, STP-Konvergenzzeit oder tatsächlicher Bandbreite/Performance — die Frage ist ausschließlich "wer wäre danach noch über den bekannten Layer-2/Port-Channel-Pfad erreichbar", nicht "wie lange dauert der Failover" oder "welche Performance-Einbußen gäbe es".

## Feature 26: Multi-Standort-Gruppierung

Toggle "🏢 Standort-Gruppierung" in den Topologie-Ansichtsoptionen. `js/core/site-group-model.js` leitet je Knoten ein Gruppen-Label rein aus dem Hostname ab (alles vor dem ersten `-`/`_`, z.B. "FRA1-CORE1" → Gruppe "FRA1"); ist im Hostname kein Trenner vorhanden, wird **keine** Gruppierung erfunden — der Knoten bildet eine Einzel-Gruppe mit sich selbst. Aktiv zeigt jede Gruppe eine eigene, sichtbar umrandete Box mit Gruppen-Label (Cytoscape-Compound-Knoten, siehe `docs/architecture.md` §6) statt der früheren weichen Anziehungskraft + Label-Suffix.

**Bewusst fragile Heuristik (wie im Backlog vermerkt):** funktioniert nur, wenn die tatsächliche Kunden-Namenskonvention einen Standort-/Gebäude-Präfix vor einem Trenner enthält — bei Hostnamen ohne dieses Muster (wie im mitgelieferten `sample-data/`-Testdatensatz, der bewusst keine Standort-Präfixe nutzt) zeigt das Feature korrekterweise keine sichtbare Clusterung, das ist kein Bug. Keine Auswertung von CDP-Location-Daten (dafür wäre `show cdp neighbor detail`/`show cdp entry` nötig, ein anderes, aktuell nicht geparstes Kommando).

## Feature 27: Anonymisierungs-Option

Toggle "🕶 Anonymisieren" im Header (analog Config Anonymizer). `js/core/anonymize.js` ersetzt Hostnamen/IPs/MAC-Adressen ab dem ersten Auftreten durch fortlaufende Platzhalter (`*HOSTNAME_001*`, `*IP_001*`, `*MAC_001*`) — derselbe Wert bekommt sitzungsweit immer denselben Platzhalter, konsistent über alle Ansichten hinweg (Topologie-Labels, VLAN-Tabelle, MAC-/Trunk-/STP-/Duplicate-Panel, Versionsübersicht, Import-Liste, globale Suche). Beim Deaktivieren erscheinen sofort wieder die Klartext-Werte.

**Bewusst reine Anzeige-Transformation, keine Datenschicht-Änderung:** `KLU.anonymize.*` wird ausschließlich an der Stelle aufgerufen, wo ein Wert als Text ins DOM geschrieben wird — interne Lookup-Keys wie `data-network-key` oder `data-id` (Switch-Auswahl, Drag&Drop, VLAN-Filter) bleiben immer im Klartext, sonst würden Klicks/Filter nach dem Umschalten fehlschlagen. Der Analyse-Stand selbst (importierte Rohdaten, `KLU.state`) bleibt unverändert.

Die CSV-Exports der VLAN-Tabelle und der MAC-Detail-Ansicht respektieren den Anonymisieren-Status ebenfalls. **Nicht abgedeckt:** der PDF/HTML-Report-Export (Feature 20) — der exportiert weiterhin die Klartext-Werte, unabhängig vom Toggle-Status. Wer eine Analyse anonymisiert mit Dritten teilen will, muss aktuell die CSV-Exporte nutzen, nicht den Report-Export.

## Entschieden

- **Mehrere SVIs pro Netz (HSRP/VRRP):** Alle beteiligten Switches anzeigen, seit Feature 19 zusätzlich mit Active/Standby-Rolle sofern `show standby`/`show hsrp`/`show vrrp` importiert wurde.
- **Persistenz:** Keine — Analyse ist pro Sitzung flüchtig, kein Speichern des Analyse-Stands.
- **L3-Matrix-Tiefe:** Nur Routing-Reachability über gemeinsame Switches, ACL nur als Flag. Volle Regelauswertung (`show ip interface` + `show access-lists` + Matching gegen Subnetze) ist deutlich aufwändiger und explizit nicht Teil dieses Feature-Pakets.
- **Trunk-erlaubte-VLANs:** Als Roh-String übernommen statt Bereiche wie "1-4094" zu 4094 Einzelwerten zu expandieren — reine Anzeige, für die Mismatch-Prüfung wird nur das Native-VLAN ausgewertet.

## Backlog / Später

Bewusst zurückgestellt (nicht umgesetzt), für einen späteren Auftrag:

- **Freie/ungenutzte Ports** — Kapazitätsplanung ist ein anderer Anwendungsfall als "Kommunikationsmatrix".
- **Interface-Fehler/Duplex-Mismatch** (`show interfaces`) — deckt sich mit dem vorhandenen Skill `network-interface-health`, eher dort lösen statt im Tool nachbauen.
- **Security-Hygiene-Checks** (ungenutzte Ports ohne Port-Security, VLAN 1 als Default in Nutzung, unautorisierte Trunks) — Scope-Überschneidung mit Skill `network-config-validation`, eher dort lösen statt im Tool nachbauen.
