# Bugs

## Behoben

### Portbezeichnungen im Aggregiert-Modus zeigten "undefined ↔ undefined" (behoben 2026-08-13)
**Symptom:** Wirkte, als wären Portbezeichnungen an Kanten nur im Modus "Einzelne Verbindungen" sichtbar.
**Ursache:** Aggregierte Kanten (`graph.edgesAggregated`) haben kein eigenes `aPort`/`bPort` — nur bei einem echten Port-Channel-Bündel ist `poLabelA`/`poLabelB` gesetzt, sonst liegen die echten Portnamen nur in `members[0]`.
**Fix:** Label-Berechnung fällt jetzt auf `members[0].aPort`/`.bPort` zurück, wenn kein Port-Channel-Label vorhanden ist.

### Drag & Drop-Sortierung der Import-Liste: Off-by-one (behoben 2026-08-13)
**Symptom:** Einen Switch per Ziehgriff auf einen anderen zu verschieben landete ihn einen Slot neben dem eigentlichen Ziel.
**Ursache:** `entries.splice(fromIdx, 1)` verschiebt alle nachfolgenden Indizes um 1 nach vorn, bevor der (nicht angepasste) `toIdx` zum Einfügen genutzt wurde.
**Fix:** Ziel-Index wird um 1 korrigiert, wenn der verschobene Eintrag ursprünglich vor dem Ziel lag.
**Gefunden durch:** `/code-review`-Skill (manuell nachvollzogener Trace), durch gezielten Unit-Test abgesichert.

### CDP-Parser: mehrwortige Platform-Strings falsch zerlegt (behoben 2026-08-13)
**Symptom:** Ein CDP-Nachbar mit mehrwortiger Platform (z. B. IP-Telefon "Cisco IP Phone 7841", Port ID "Port 1") bekam Platform="Cisco" und Port-ID="IP Phone 7841 Port 1" zugewiesen.
**Ursache:** Die tokenbasierte Trennung ab der Capability-Spalte nahm an, Platform sei immer genau ein Token.
**Fix:** Neue Heuristik `splitPlatformAndPortId()` erkennt Port-ID zuerst über bekannte Muster (verschmolzenes Interface-Token wie "Eth1/3", oder "Typ-Wort + nackte Nummer" wie "Gig 1/0/1"/"Port 1") und behandelt den Rest als Platform, statt sich auf eine feste Tokenanzahl zu verlassen.
**Gefunden durch:** `/code-review`-Skill.

### Globale Suche: rein-hexadezimale Hostnamen wurden verworfen (behoben 2026-08-13)
**Symptom:** Ein Hostname, der zufällig nur aus Hex-Zeichen besteht (z. B. "CAFE99"), lieferte "Keine Treffer".
**Ursache:** Die Sucheingabe wurde exklusiv entweder als MAC- oder als Hostname-Suche behandelt; ein hex-artiger String wurde fälschlich der MAC-Suche zugeordnet.
**Fix:** MAC- und Hostname-Suche laufen jetzt immer beide (Ergebnisse werden vereint) statt sich exklusiv auszuschließen.
**Gefunden durch:** `/code-review`-Skill.

### Nexus-Routing-Parser brach bei Zusatzfeldern nach "direct" ab (behoben 2026-08-13)
**Symptom:** Eine NX-OS-Route mit zusätzlichen Feldern nach "direct" (z. B. Redistribution-Tags) wurde nicht als connected Route erkannt — das zugehörige VLAN-Netz fehlte in VLAN-Tabelle und Kommunikationsmatrix.
**Ursache:** Der Regex `/,\s*direct\s*$/` verlangte, dass die Zeile exakt mit "direct" endet.
**Fix:** Zeilenende-Anker entfernt (`/,\s*direct\b/`), `\b` verhindert weiterhin Fehltreffer wie "directive".
**Gefunden durch:** `/code-review`-Skill.

### Reale Cisco-Export-Eigenheiten brachen mehrere Parser (behoben 2026-08-13, anhand eines echten Kundenexports)
**Symptom:** Ein realer Kundenexport (nicht Teil des Repos) ließ sich nicht importieren bzw. lieferte falsche VLAN-/MAC-/Trunk-Daten.
**Ursachen (mehrere, unabhängige Funde):**
- `show version` fehlte komplett in der Datei → App brach hart ab.
- Der Export fügte nach **jeder** Zeile eine Leerzeile ein → VLAN-Tabellen-Parser und Nexus-`show ip route`-Parser werteten das fälschlich als Tabellenende.
- MAC-Tabelle: `+`-Präfix (vPC-Peer-Link-Markierung) wurde nicht wie `*` behandelt und der Eintrag verworfen.
- `/32`-Lokal-Routen wurden fälschlich als eigenständiges VLAN-Netz gezählt.
- CDP: Die "Platform"-Spalte steht in echten Exporten nicht immer exakt an der Zeichenposition, die die Kopfzeile vermuten lässt (Capability-Codes sind variabel breit) — reine Spaltenschnitt-Logik lieferte falsche Platform/Port-ID-Werte, insbesondere bei umbrechenden Port-IDs (z. B. "TwentyFiveGigE1/0/9").
**Fix:** `show version` optional (Fallback über Prompt-Zeile + Kommandonamen-Heuristik), Leerzeilen-Toleranz in VLAN-/Route-Parsern, generalisierte Marker-Erkennung in der MAC-Tabelle, `direct`-Filter für Routen, CDP-Parser von reiner Spaltenposition auf hybrides Spalten+Token-Verfahren umgestellt.
**Hinweis:** Die Kundendatei selbst wurde nie ins Repo, in Sample-Daten oder in Notizen kopiert — nur lokal zum Debuggen gelesen.

### Report-Export hätte nach der Cytoscape-Portierung eine leere Topologie geliefert (gefunden + behoben 2026-08-19, vor dem Release)
**Symptom:** Wäre beim ersten Report-Export nach 0.13.0 aufgefallen — der Topologie-Abschnitt im HTML-Report wäre leer gewesen.
**Ursache:** `js/views/report-export.js` snapshotete bisher `document.getElementById('topology-canvas').outerHTML` — das funktionierte beim alten SVG-Rendering, weil das SVG ein echter DOM-Baum war. Cytoscape rendert stattdessen in ein eigenes internes `<canvas>`; dessen Pixel sind nicht Teil der DOM-Serialisierung, ein `outerHTML`-Snapshot liefert dafür nur ein leeres Grundgerüst.
**Fix:** Neue Funktion `KLU.views.topology.snapshotLightPng()` schaltet kurz auf feste Light-Theme-Werte um (der Report ist immer hell), rendert `cy.png({output:'base64uri', full:true})` und stellt sofort das Live-Theme wieder her (synchron, kein sichtbares Aufblitzen). Der Report bettet das Ergebnis als `<img>` ein.
**Gefunden durch:** Gezielte Safari/JXA-End-to-End-Tests während der Cytoscape-Portierung, vor dem ersten Commit.
