# Beispiel-Netzwerk zum Testen

10 Switches (Kern + Access), zum Import in die App bereit — je eine Textdatei pro Switch.

## Topologie

- **CORE1, CORE2** — Nexus (N9K-C93180YC-EX), redundant über Po1 (2×10G) verbunden
- **ACC1–ACC8** — Catalyst Access-Switches (WS-C3850-24T / WS-C2960X-48TS-L), unterschiedlich angebunden:
  - ACC1, ACC2: einzelner Uplink zu CORE1
  - ACC3, ACC4: 2-Port-EtherChannel zu CORE1 (testet den Aggregiert/Einzeln-Toggle)
  - ACC5, ACC6: je ein Uplink zu CORE1 **und** CORE2 (kein Port-Channel, da zwei unterschiedliche Nachbarn)
  - ACC7, ACC8: einzelner Uplink zu CORE2

## Firewall, WLC, Access Point

FW1, WLC1 und AP-101 sind **keine eigenen Importdateien** — sie tauchen nur als CDP-Nachbarn in den Switch-Dateien auf (FW1 dual-homed an CORE1+CORE2, WLC1 an CORE1, AP-101 an ACC2). Die App zeigt sie als eigene Topologie-Knoten (Raute = Firewall, Sechseck = WLC, Dreieck = Access Point), aber ohne VLAN/MAC/IP-Daten — die App parst nur Catalyst/Nexus-`show`-Kommandos, keine ASA-/WLC-Konfiguration.

## VLANs (zum Testen der VLAN-Tabelle)

| VLAN | Name | Vorkommen | IP-Netz |
|---|---|---|---|
| 1 | default | alle 10 | keins |
| 10 | Users | alle 10 | 10.10.10.0/24, SVI auf **CORE1 + CORE2** (testet Mehrfach-SVI/HSRP-Fall) |
| 20 | Servers | ACC3, ACC4, CORE1, CORE2 | 10.10.20.0/24, SVI nur CORE1 |
| 30 | Voice | alle 10 | 10.10.30.0/24, SVI nur CORE1 |
| 40 | WiFi | alle 10 | 10.10.40.1, **ohne** passende connected Route → testet den "Maske unbekannt"-Fallback |
| 99 | Mgmt | alle 10 | 10.10.99.0/24, SVI auf **allen 10 Switches** |

Jeder Access-Switch hat außerdem eine MAC-Adresse absichtlich auf seinem Uplink-Port platziert (VLAN 10) — die MAC-Klick-Ansicht muss diese herausfiltern (Uplink-Ausschluss).

## Erweiterung (Trunk/ACL-Testdaten)

Nur **CORE1** und **ACC1** enthalten zusätzlich `show interfaces trunk` und `show ip interface`
(voll) — die übrigen 8 Switches bleiben bewusst ohne diese beiden Kommandos, um das
Import-Feedback-Panel (fehlende Kommandos je Switch) realistisch zu testen.

- **Native-VLAN-Mismatch (bewusst eingebaut):** CORE1 Eth1/3 (Native VLAN 1) ↔ ACC1 Gi1/0/1
  (Native VLAN 99) — derselbe physische Link laut CDP, unterschiedliches Native VLAN → muss in
  der Trunk-Warnung auftauchen.
- **ACL-Hinweis-Flag:** CORE1 VLAN 40 (WiFi) hat laut `show ip interface` eine Access-List
  (`ACL_WIFI_GUEST`) — muss in der L3-Kommunikationsmatrix als ⚠ ACL markiert werden.

## Import

App öffnen → alle 10 `.txt`-Dateien aus diesem Ordner per Drag & Drop oder Datei-Auswahl importieren.
