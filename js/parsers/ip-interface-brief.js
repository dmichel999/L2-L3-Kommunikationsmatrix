// Kunden LAN Überblick — Parser für "show ip interface brief". Catalyst und Nexus haben
// unterschiedliche Spaltenlayouts, aber in beiden stehen Interface und IP-Adresse als die
// ersten beiden whitespace-getrennten Felder — das reicht uns, den Rest (Status) ignorieren wir.
KLU.parsers = KLU.parsers || {};

const IPV4_RE = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;

/**
 * @param {string} text Block-Text von "show ip interface brief"
 * @returns {Array<{ interface: string, ipAddress: string }>}
 */
KLU.parsers.parseIpInterfaceBrief = function (text) {
  const result = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^Interface\b/i.test(trimmed)) continue; // Header (Catalyst)
    if (/^IP Interface Status/i.test(trimmed)) continue; // Header-Zeile (Nexus, VRF-Angabe)

    const m = /^(\S+)\s+(\S+)/.exec(trimmed);
    if (!m) continue;
    const [, iface, ip] = m;
    if (!IPV4_RE.test(ip)) continue; // "unassigned" oder unerwartetes Format überspringen

    result.push({ interface: iface, ipAddress: ip });
  }
  return result;
};
