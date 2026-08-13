// Kunden LAN Überblick — Parser für "show ip route": nur directly-connected Routen
// (liefern Netz inkl. Maske je VLAN-Interface). Catalyst und Nexus haben komplett
// unterschiedliche Ausgabeformate.
KLU.parsers = KLU.parsers || {};

function parseIpRouteCatalyst(text) {
  const re = /^C\s+(\S+\/\d+)\s+is directly connected,\s+(\S+)/;
  const result = [];
  for (const line of text.split('\n')) {
    const m = re.exec(line.trim());
    if (m) result.push({ network: m[1], interface: m[2] });
  }
  return result;
}

function parseIpRouteNexus(text) {
  const lines = text.split('\n');
  const result = [];
  for (let i = 0; i < lines.length; i++) {
    const netMatch = /^(\d+\.\d+\.\d+\.\d+\/\d+),.*\battached\b/.exec(lines[i].trim());
    if (!netMatch) continue;
    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j].trim();
      if (!line) continue; // Leerzeile überspringen statt abzubrechen (manche Exporte fügen nach jeder Zeile eine ein)
      if (/^\d+\.\d+\.\d+\.\d+\/\d+,/.test(line)) break; // nächste Route ohne via gefunden -> abbrechen

      const viaMatch = /^\*via\s+\S+,\s*([\w./-]+),/.exec(line);
      if (viaMatch) {
        // Nur "direct" (das eigentliche VLAN-Netz), nicht "local" (die eigene /32-Adresse
        // des Routers auf diesem Interface) oder statische Routen über ein anderes Interface.
        // Kein Zeilenende-Anker: manche NX-OS-Versionen hängen an "direct" noch weitere Felder
        // an (z.B. Redistribution-Tags) — \b verhindert Fehltreffer wie "directive".
        if (/,\s*direct\b/.test(line)) {
          result.push({ network: netMatch[1], interface: viaMatch[1] });
        }
        break;
      }
    }
  }
  return result;
}

/**
 * @param {string} text Block-Text von "show ip route"
 * @param {'catalyst'|'nexus'} platform
 * @returns {Array<{ network: string, interface: string }>} nur directly-connected Einträge
 */
KLU.parsers.parseIpRoute = function (text, platform) {
  return platform === 'nexus' ? parseIpRouteNexus(text) : parseIpRouteCatalyst(text);
};
