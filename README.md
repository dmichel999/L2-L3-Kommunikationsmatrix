# Kunden LAN Überblick

Browser-basiertes Tool zur Analyse eines Kunden-LANs (Catalyst/Nexus-Switche) anhand von `show`-Kommando-Textmitschriften: physische Topologie, VLAN-Verteilung, IP-Netze, MAC-Adressen, L3-Erreichbarkeit.

**Keine Installation, kein Server, keine Cloud** — Ordner öffnen, `Kunden LAN Überblick.html` im Browser öffnen, fertig. Alle Daten bleiben lokal im Browser, es findet kein Versand an Dritte (auch keine KI) statt.

---

## Schnellstart

1. Repository klonen oder als ZIP herunterladen
2. `Kunden LAN Überblick.html` im Browser öffnen (Chrome, Safari, Firefox, Edge)
3. Pro Switch eine Textdatei (oder `.docx`) mit allen `show`-Kommando-Outputs hintereinander importieren (Drag & Drop oder Datei-Auswahl)
4. Topologie/VLAN-Tabelle/Kommunikationsmatrix/Versionsübersicht durchklicken

```bash
git clone https://shdefbgsweb01.bechtle.net/git/denis.michel/Kunden-LAN--berblick.git
cd "Kunden-LAN--berblick"
open "Kunden LAN Überblick.html"
```

Zum Ausprobieren ohne eigene Daten: alle `.txt`-Dateien aus `sample-data/` importieren (Details siehe `sample-data/README.md`).

## Unterstützte Kommandos

Siehe `docs/features.md` für die vollständige Liste je Plattform (Catalyst/Nexus) und was bei fehlenden Kommandos eingeschränkt ist (Import-Feedback-Panel zeigt das pro importiertem Switch an).

## Dokumentation

| Datei | Inhalt |
|---|---|
| `docs/features.md` | Feature-Spezifikation, Entschieden-/Backlog-Abschnitte |
| `docs/architecture.md` | Technische Entscheidungen, Datenfluss, Parser-Strategie |
| `docs/releases.md` | Änderungshistorie (Keep a Changelog + SemVer) |
| `docs/bugs.md` | Gefundene und behobene Bugs |
| `docs/changes.md` | Offene Änderungswünsche (Eingangskorb) |
| `docs/THIRD_PARTY_LICENSES.md` | Lizenzhinweise vendorter Bibliotheken |

## Datenschutz

Reine Client-Side-Anwendung ohne Server-Backend. Importierte Konfigurationsdaten verbleiben ausschließlich im Arbeitsspeicher des Browsers (kein `localStorage`/`IndexedDB` für Analyse-Daten — der Analyse-Stand ist bewusst flüchtig, siehe `docs/features.md`). Einzige Ausnahme: die Theme-Präferenz (Hell/Dunkel/System) wird als reine UI-Einstellung ohne Kundendatenbezug in `localStorage` gespeichert.
