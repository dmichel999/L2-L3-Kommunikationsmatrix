// Kunden LAN Überblick — Parser für "show mac address-table". Catalyst und Nexus haben
// unterschiedlich viele Spalten (Nexus: zusätzlich age/Secure/NTFY, führendes "*" für
// primary entry) — ein fixer Spaltenparser wäre pro Plattform anders. Stattdessen nutzen wir
// zwei feste Invarianten: VLAN ist immer das erste Feld, Ports immer das letzte.
KLU.parsers = KLU.parsers || {};

const MAC_RE = /^[0-9a-f]{4}\.[0-9a-f]{4}\.[0-9a-f]{4}$|^[0-9a-f]{2}(:[0-9a-f]{2}){5}$/i;

/**
 * @param {string} text Block-Text von "show mac address-table"
 * @returns {Array<{ vlanId: number, macAddress: string, type: string, port: string }>}
 */
KLU.parsers.parseMacAddressTable = function (text) {
  const result = [];

  for (const rawLine of text.split('\n')) {
    let line = rawLine.trim();
    if (!line) continue;
    if (/^-+$|^-+\+/.test(line)) continue; // Trennzeile
    if (/^(Vlan\b|Legend|Mac Address Table|VLAN\s)/i.test(line)) continue;

    line = line.replace(/^\*\s*/, ''); // Nexus "primary entry"-Markierung

    const tokens = line.split(/\s+/);
    if (tokens.length < 4) continue;

    const vlanId = parseInt(tokens[0], 10);
    if (Number.isNaN(vlanId)) continue;

    const mac = tokens[1];
    if (!MAC_RE.test(mac)) continue;

    result.push({
      vlanId,
      macAddress: mac.toLowerCase(),
      type: tokens[2],
      port: tokens[tokens.length - 1]
    });
  }

  return result;
};
