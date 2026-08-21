# Beispiel-Netzwerk zum Testen

15 Switches, zum Import in die App bereit — je eine Textdatei pro Switch. Datensatz "Musterkunde-Campus" (erstellt 2026-08-18 für die Cisco-TechChamps-Präsentation) — löst den bisherigen 10-Switch-Datensatz als Standard-Demo ab.

## Topologie

Dreistufige Campus-Struktur über zwei Standorte:

- **MUC-CORE1, MUC-CORE2** — Nexus (N9K-C93180YC-EX), Core-Layer München
- **MUC-DIST1, MUC-DIST2, MUC-DIST3** — Nexus (N9K-C92160YC-X), Distribution-Layer, je redundant an beide Core-Switches angebunden
- **MUC-ACC1–ACC7** — Catalyst Access-Switches (C9300-24T/48P), verteilt auf MUC-DIST1 (ACC1–3), MUC-DIST2 (ACC4–5), MUC-DIST3 (ACC6–7)
- **FRA-ACC8, FRA-ACC9, FRA-ACC10** — Catalyst Access-Switches (C9300-24T) am Standort Frankfurt, alle über MUC-DIST3 an den Münchner Campus angebunden (Standort-übergreifender Link)

## Access Points, Kameras

Jeder Access-Switch hat mindestens einen CDP-Nachbarn ohne eigene Importdatei (AP-1xx als WLAN-AP, an FRA-ACC8 zusätzlich eine AXIS-IP-Kamera) — tauchen als eigene Topologie-Knoten ohne VLAN/MAC/IP-Daten auf.

## VLANs

| VLAN | Name |
|---|---|
| 1 | default |
| 10 | Users |
| 20 | Servers |
| 30 | Voice |
| 40 | WiFi |
| 50 | Guest |
| 99 | Mgmt |

## Import

App öffnen → alle 15 `.txt`-Dateien aus diesem Ordner per Drag & Drop oder Datei-Auswahl importieren.

## Hinweis zum bisherigen Datensatz

Der bisherige 10-Switch-Datensatz (ACC1–8, CORE1–2) war gezielt auf einzelne App-Features zugeschnitten (Native-VLAN-Mismatch, HSRP, STP-Loop, doppelte MAC/IP, LLDP-Fremdhersteller-AP — siehe Git-Historie dieser Datei). Für gezielte Feature-Regressionstests bei künftigen Änderungen ggf. wieder aus dem Git-Verlauf holen (`git log -- sample-data/`); für die TechChamps-Präsentation wurde bewusst der eindrucksvollere Zwei-Standorte-Campus gewählt.
