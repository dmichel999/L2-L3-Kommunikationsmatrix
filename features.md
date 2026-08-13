# Kunden LAN Überblick — Feature-Spezifikation

## Zweck

Analyse eines Kunden-LANs (Catalyst + Nexus Switche) anhand von `show`-Kommando-Outputs: physische Topologie, VLAN-Verteilung, IP-Netze pro VLAN, MAC-Adressen pro VLAN/Port.

## Architektur

Rein client-seitig (HTML/JS, kein Build-System, kein npm), analog `Config Anonymizer`/`Meraki Doku Standalone`. Kein Server, keine KI im Loop — Kundendaten verlassen den Browser nicht. Passt zum Bechtle-Gitea-only-Hosting dieses Projekts.

## Input

- **Ein Textfile pro Switch**, Mehrfach-Import (Drag&Drop/File-Picker, mehrere Dateien auf einmal).
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

## Feature 1: Topologie-Grafik

- Knoten = Switches (Hostname aus `show version`), Kanten = physische Verbindungen aus `show cdp neighbor`.
- **Umschaltbare Darstellung der Etherchannel/Port-Channel-Links** (Toggle in der UI):
  - **Aggregiert:** Ein Port-Channel zwischen zwei Switches = eine Linie, Tooltip/Label zeigt Member-Ports (z.B. `Po1: Gi1/0/1, Gi1/0/2`).
  - **Einzeln:** Jedes physische Member-Interface als eigene Linie.
- Zuordnung Port → Port-Channel kommt aus `show etherchannel summary` (Catalyst) bzw. `show port-channel summary` (Nexus).

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

## Entschieden

- **Mehrere SVIs pro Netz (HSRP/VRRP):** Alle beteiligten Switches anzeigen, keine automatische Aktiv/Standby-Erkennung.
- **Persistenz:** Keine — Analyse ist pro Sitzung flüchtig, kein Speichern des Analyse-Stands.
