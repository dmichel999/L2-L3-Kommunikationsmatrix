// Kunden LAN Überblick — Parser für "show arp" (Catalyst) / "show ip arp" (Nexus). Statt fester
// Spalten (Layout unterscheidet sich deutlich zwischen den Plattformen) wird jede Zeile
// tokenweise nach einer IPv4-Adresse und einer MAC-Adresse durchsucht — funktioniert für beide
// Formate gleich. Wird für die globale Suche (Feature 5 der Erweiterung) gebraucht: IP eines
// Endgeräts -> MAC -> Switch/Port/VLAN über die MAC-Tabelle.
KLU.parsers = KLU.parsers || {};

const ARP_IPV4_RE = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
const ARP_MAC_RE = /^[0-9a-f]{4}\.[0-9a-f]{4}\.[0-9a-f]{4}$/i;

/**
 * @param {string} text Block-Text von "show arp" / "show ip arp"
 * @returns {Array<{ ipAddress: string, macAddress: string, interface: string }>}
 */
KLU.parsers.parseArp = function (text) {
  const result = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (/^(Protocol\b|Address\b|IP ARP Table|Total number)/i.test(line)) continue; // Header/Meta-Zeilen

    const tokens = line.split(/\s+/);
    const ip = tokens.find(t => ARP_IPV4_RE.test(t));
    const mac = tokens.find(t => ARP_MAC_RE.test(t));
    if (!ip || !mac) continue;

    result.push({ ipAddress: ip, macAddress: mac.toLowerCase(), interface: tokens[tokens.length - 1] });
  }
  return result;
};
