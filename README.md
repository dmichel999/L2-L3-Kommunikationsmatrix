# L2-L3 Kommunikationsmatrix

Browser-basiertes Tool zur Analyse eines Kunden-LANs (Catalyst/Nexus-Switche) anhand von `show`-Kommando-Textmitschriften: physische Topologie, VLAN-Verteilung, IP-Netze, MAC-Adressen, L3-Erreichbarkeit.

**Keine Installation, kein Server, keine Cloud** — Ordner öffnen, `L2-L3 Kommunikationsmatrix.html` im Browser öffnen, fertig. Alle Daten bleiben lokal im Browser, es findet kein Versand an Dritte (auch keine KI) statt.

---

## Schnellstart

1. Repository klonen oder als ZIP herunterladen
2. `L2-L3 Kommunikationsmatrix.html` im Browser öffnen (Chrome, Safari, Firefox, Edge)
3. Pro Switch eine Textdatei (oder `.docx`) mit allen `show`-Kommando-Outputs hintereinander importieren (Drag & Drop oder Datei-Auswahl)
4. Topologie/VLAN-Tabelle/Kommunikationsmatrix/Versionsübersicht durchklicken

```bash
git clone git@github.com:dmichel999/L2-L3-Kommunikationsmatrix.git
cd "L2-L3-Kommunikationsmatrix"
open "L2-L3 Kommunikationsmatrix.html"
```

Bechtle-intern gibt es zusätzlich ein Gitea-Mirror-Repo (siehe `CLAUDE.md`).

## Live-Version (GitHub Pages)

Kein Klonen nötig: **https://dmichel999.github.io/L2-L3-Kommunikationsmatrix/** (sobald in den Repo-Einstellungen aktiviert, siehe unten) öffnet die App direkt im Browser — funktioniert wie die lokale Datei, es findet weiterhin kein Server-Roundtrip statt, jede Analyse läuft rein im Browser des Nutzers.

**Einmalig aktivieren:** GitHub-Repo → Settings → Pages → "Deploy from a branch" → Branch `main`, Ordner `/ (root)` → Save. Das Repo ist öffentlich, die Seite ist danach für jeden mit dem Link erreichbar (wie das Repo selbst bereits ist) — es werden dabei nur die App-Dateien ausgeliefert, keine importierten/hochgeladenen Kundendaten.

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
