# Kunden LAN Überblick — Feature-Spezifikation

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

## Feature 1: Topologie-Grafik

- Knoten = Switches (Hostname aus `show version`), Kanten = physische Verbindungen aus `show cdp neighbor`.
- **Umschaltbare Darstellung der Etherchannel/Port-Channel-Links** (Toggle in der UI):
  - **Aggregiert:** Ein Port-Channel zwischen zwei Switches = eine Linie, Tooltip/Label zeigt Member-Ports (z.B. `Po1: Gi1/0/1, Gi1/0/2`).
  - **Einzeln:** Jedes physische Member-Interface als eigene Linie.
- Zuordnung Port → Port-Channel kommt aus `show etherchannel summary` (Catalyst) bzw. `show port-channel summary` (Nexus).
- **Nicht importierte CDP-Nachbarn** (Firewall, WLC, Access Point, sonstige Geräte) werden ebenfalls als Knoten angezeigt, sobald ein importierter Switch sie als CDP-Nachbar meldet — auch wenn für sie keine eigene Datei importiert wurde (kein VLAN/MAC/IP-Wissen über sie, nur Verbindungspunkt). Typ wird aus dem (ggf. abgeschnittenen) CDP-Platform-String erkannt: `KLU.topology.inferDeviceType()`.
- **Icons je Gerätetyp:** Kreis = Switch, Raute = Firewall, Sechseck = WLC, Dreieck = Access Point, Quadrat = unbekanntes Gerät. Legende in der Toolbar.
- **Knoten sind per Drag & Drop verschiebbar** (Layout wird pro Session gemerkt, nicht persistiert).

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

Zeigt, auf welchem Switch (und ggf. mehreren bei HSRP/VRRP) das VLAN-Interface für dieses Netz konfiguriert ist — abgeleitet aus derselben Quelle wie Feature 2.

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

Eingabefeld im Header: MAC-Adresse, IP-Adresse oder Hostname eingeben → direkte Treffer-Liste (Switch/Port/VLAN bzw. Switch/Modell). IP-Suche prüft zuerst SVI-IPs (`show ip interface brief`), danach ARP-Einträge (neuer Parser `arp.js`, deckt sowohl `show arp` als auch `show ip arp` ab) — ein Treffer über ARP wird zusätzlich mit der MAC-Tabelle verknüpft, um Switch/Port/VLAN des Endgeräts zu zeigen.

## Feature 10: Trunk-VLANs + Native-VLAN-Mismatch

Neuer Parser `interfaces-trunk.js` für `show interfaces trunk` (Catalyst) / `show interface trunk` (Nexus). Neues Trunk-Panel unterhalb der VLAN-Tabelle: Warnung, wenn zwei über CDP/Port-Channel verbundene Switches auf dem jeweiligen Trunk-Port unterschiedliche Native-VLANs konfiguriert haben (Link-Zuordnung analog zur bestehenden Uplink-Erkennung in Feature 3). Erlaubte VLANs je Port werden als Roh-String übernommen (keine Bereichs-Expansion von z.B. "1-4094"), reine Anzeige.

## Feature 11: Layout — Topologie neben VLAN-Tabelle (Split-Pane)

Topologie und VLAN-Tabelle liegen im Tab "Netzwerk" nebeneinander (Split-Pane mit ziehbarem Resizer statt getrennter Tabs), Breite pro Sitzung merkbar (nicht persistiert). Generischer `split-pane.js`-Helfer, wiederverwendbar für künftige Splits.

## Feature 12: Topologie-Interaktionen (Highlight, Port-Labels, Fokus-Filter)

- **VLAN-Highlight:** Sobald eine VLAN-Zeile ausgewählt ist (Feature 3), werden die Switch-Knoten mit diesem VLAN im Graph hervorgehoben (dickerer Rahmen), alle anderen Knoten abgedunkelt (Opazität reduziert).
- **Portbezeichnungen:** Toggle in der Toolbar (Default aus) zeigt die Interface-Bezeichnung an jeder Kante — erst ab Zoomstufe ≥150% (`PORT_LABEL_MIN_ZOOM`), da die Kanten-Mittelpunkte bei vielen kurzen Verbindungen zu einem Hub-Switch in Normalansicht zu dicht beieinander liegen und sich sonst unlesbar überlappen. Beim Hineinzoomen rücken sie räumlich auseinander.
- **Switch-Fokus-Filter:** Klick auf einen Knoten (Bewegung < 5px, sonst gilt es als Drag) filtert auf dessen eigene Verbindungen — alle anderen Kanten/Knoten werden abgedunkelt. Erneuter Klick hebt den Fokus auf.

## Feature 13: Topologie — Zoom + Geräte-Typ-Filter

- **Zoom:** Mausrad zoomt zentriert auf die Cursor-Position (Zoom-Layer-Transform um die Knoten-Layer, Knoten-Weltkoordinaten bleiben unverändert); zusätzlich +/−/100%-Buttons in der Toolbar für Nicht-Maus-Bedienung. Zoom-Stand ist pro Sitzung gemerkt, nicht persistiert.
- **Geräte-Typ-Filter:** Die Legende ist zugleich Filter — jede Checkbox blendet Knoten (und deren Kanten) dieses Gerätetyps aus, ohne das Kraft-Layout neu zu berechnen (Positionen bleiben stabil, nur Sichtbarkeit ändert sich).

## Feature 14: Switch-Import-Liste sortierbar

Jede Zeile in der Import-Liste hat einen Ziehgriff (⠿), mit dem sich importierte Switches per Drag & Drop neu anordnen lassen (z.B. um zusammengehörige Switches gruppiert zu sehen). Reine Anzeige-Reihenfolge, hat keinen Effekt auf Topologie/VLAN-Tabelle/Matrix (deren Sortierung ist unabhängig). Nicht persistiert.

## Feature 15: Import-Feedback-Panel

Pro importiertem Switch in der Sidebar-Liste: Plattform-Badge ist jetzt ein Dropdown (Catalyst/Nexus), mit dem der User die automatische Erkennung korrigieren kann — ändert `sw.platform` und parst `show ip route` (einzige plattformabhängige Parser-Variante der bereits erfassten Kommandos) neu. Die Warnung "N fehlend" ist jetzt ein Hover-Popup statt reinem Browser-Tooltip: pro fehlendem Kommando wird angezeigt, welches Feature/welche Ansicht dadurch für diesen Switch eingeschränkt ist.

## Feature 16: UI-Layout-Verbesserungen (Nutzer-Feedback nach Erweiterung)

- **VLAN-Tabelle:** Spalte "Switches mit VLAN" entfernt (Platzgrund) — bleibt im CSV-Export enthalten, ist über Klick auf ein IP-Netz weiterhin abrufbar (Feature 4).
- **Kollabierbare Panels:** Netzwerk-Details/Trunk-Warnungen/MAC-Adressen sind jetzt drei permanent gleichzeitig sichtbare, aber unabhängig einklappbare und in der Höhe verstellbare Panels (Ziehgriff unten) statt reiner Auf/Zu-Logik über den Auswahlzustand. Gleiche Panel-Komponente (`js/views/collapsible-panel.js`) auch für die zwei Sidebar-Bereiche (Import-Dropzone, Switch-Liste) — dort ohne Höhen-Resize, nur einklappbar.
- **Sidebar breitenverstellbar:** Resizer zwischen Sidebar und Hauptbereich (analog zum bestehenden Split-Pane-Resizer der Netzwerk-Ansicht).
- **Topologie-Vollbild:** Button in der Toolbar nutzt die native Fullscreen-API auf den gesamten Topologie-Bereich (inkl. Toolbar, nicht nur die SVG-Fläche).
- **Dark Mode:** Auswahl Hell/Dunkel/System im Header (`localStorage`-gemerkt, bewusst NICHT flüchtig wie der Analyse-Stand, da reine UI-Präferenz ohne Kundendatenbezug). "System" nutzt weiterhin `prefers-color-scheme`.

**Bugfix (im selben Zug behoben):** Portbezeichnungen an Kanten (Feature 13) zeigten im Standard-Modus "Aggregiert" für Verbindungen ohne Port-Channel-Bündelung "undefined ↔ undefined", da aggregierte Kanten kein eigenes `aPort`/`bPort` besitzen (nur `members[]`) — wirkte wie "Label nur im Modus 'Einzelne Verbindungen' sichtbar". Fällt jetzt korrekt auf den Member-Port zurück.

## Feature 17: Kompakte Topologie-Toolbar + KI-Kennzeichnung

- **Toolbar-Redesign:** Aggregiert/Einzeln-Toggle, Portbezeichnungen-Toggle und die Geräte-Typ-Legende/-Filter waren permanent sichtbar und nahmen bei schmaleren Fenstern 2–3 Zeilen Höhe ein. Jetzt in einem Popover ("⚙ Ansicht", Klick öffnet/schließt, Klick außerhalb schließt) — die sichtbare Toolbar ist auf Titel + Zoom-Controls + Vollbild + den Popover-Button reduziert (eine Zeile, unabhängig von Fenstergröße).
- **KI-Kennzeichnung (Pflicht laut `MASTERPROMPT.md` für alle `Cisco/`-Projekte):** Footer zeigt den Text-Hinweis "thought up by human, coded by ai" sowie das offizielle Bechtle-AI-Label als Icon (`assets/Bechtle_AI_Generated_Label_{light,dark}_EN.svg`, lokal vendort, keine externe Nachladung). Icon folgt automatisch dem aktuell dargestellten Theme (inkl. Live-Wechsel bei OS-Theme-Änderung im "System"-Modus). Gleicher Text-Kommentar zusätzlich in der Haupt-HTML-Datei und `js/app.js`.

## Entschieden

- **Mehrere SVIs pro Netz (HSRP/VRRP):** Alle beteiligten Switches anzeigen, keine automatische Aktiv/Standby-Erkennung.
- **Persistenz:** Keine — Analyse ist pro Sitzung flüchtig, kein Speichern des Analyse-Stands.
- **L3-Matrix-Tiefe:** Nur Routing-Reachability über gemeinsame Switches, ACL nur als Flag. Volle Regelauswertung (`show ip interface` + `show access-lists` + Matching gegen Subnetze) ist deutlich aufwändiger und explizit nicht Teil dieses Feature-Pakets.
- **Trunk-erlaubte-VLANs:** Als Roh-String übernommen statt Bereiche wie "1-4094" zu 4094 Einzelwerten zu expandieren — reine Anzeige, für die Mismatch-Prüfung wird nur das Native-VLAN ausgewertet.

## Backlog / Später

Bewusst zurückgestellt (nicht umgesetzt), für einen späteren Auftrag:

- **STP Root-Bridge/blockierte Ports** (`show spanning-tree`) — wertvoll, aber eigener Parser + eigenes Konzept nötig, kein Nebeneffekt der aktuellen Features.
- **HSRP/VRRP Active/Standby-Rolle je SVI** (`show standby`/`show vrrp`) — bestehende Lösung (alle beteiligten Switches anzeigen) funktioniert schon korrekt, es fehlt nur die Detailtiefe (wer ist aktiv).
- **Freie/ungenutzte Ports** — Kapazitätsplanung ist ein anderer Anwendungsfall als "Kommunikationsmatrix".
- **Interface-Fehler/Duplex-Mismatch** (`show interfaces`) — deckt sich mit dem vorhandenen Skill `network-interface-health`, eher dort lösen statt im Tool nachbauen.
- **PDF/HTML-Report-Export** — nice-to-have für Kundenlieferung, aber nicht analysekritisch.
- **LLDP zusätzlich zu CDP** (`show lldp neighbor`) — nur relevant bei Fremdherstellern im Netz oder wenn CDP deaktiviert ist; Mehraufwand erst investieren, wenn ein konkreter Kundenfall das braucht.
- **Duplicate-IP/MAC-Erkennung** über mehrere ARP-Tabellen/Switches hinweg — Diagnose-Zusatz, nicht Kernfunktion der Matrix.
- **Redundanz-/Ausfall-Simulation** ("was passiert bei Ausfall von Switch/Link X") — hoher Aufwand (Graphalgorithmus auf Topologie+Port-Channel-Daten), klar eine spätere Ausbaustufe.
- **Security-Hygiene-Checks** (ungenutzte Ports ohne Port-Security, VLAN 1 als Default in Nutzung, unautorisierte Trunks) — Scope-Überschneidung mit Skill `network-config-validation`, eher dort lösen statt im Tool nachbauen.
- **Multi-Standort-Gruppierung** (Topologie nach Gebäude/Etage clustern) — fragile Heuristik, da Hostnamen-/CDP-Location-Konventionen je Kunde unterschiedlich sind.
- **Anonymisierungs-Option** (analog Config Anonymizer) — nur nötig, falls eine Analyse mit Dritten geteilt wird; noch kein konkreter Bedarf.
