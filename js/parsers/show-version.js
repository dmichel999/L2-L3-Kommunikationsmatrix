// Kunden LAN Überblick — Parser für "show version": Plattform + Hostname + Modell
KLU.parsers = KLU.parsers || {};

function detectPlatform(text) {
  if (/\bNX-OS\b/i.test(text) || /\bNexus\b/i.test(text)) return 'nexus';
  if (/\bIOS-XE\b/i.test(text) || /Cisco IOS Software/i.test(text)) return 'catalyst';
  return 'catalyst'; // Fallback-Annahme, falls Header untypisch ist
}

function extractHostname(text, platform) {
  if (platform === 'nexus') {
    const m = /Device name:\s*(\S+)/i.exec(text);
    if (m) return m[1];
  }
  // IOS/IOS-XE: "<hostname> uptime is ..." — funktioniert auch als Nexus-Fallback
  const m2 = /^(\S+)\s+uptime is\b/m.exec(text);
  if (m2) return m2[1];
  return null;
}

function extractModel(text, platform) {
  if (platform === 'nexus') {
    const m = /cisco\s+(.+?)\s+Chassis/i.exec(text);
    if (m) return m[1].trim();
  } else {
    const m = /cisco\s+(\S+)\s*\(/i.exec(text);
    if (m) return m[1];
    const m2 = /Model [Nn]umber\s*:\s*(\S+)/.exec(text);
    if (m2) return m2[1];
  }
  return null;
}

/**
 * @param {string} text Block-Text von "show version"
 * @returns {{ platform: 'catalyst'|'nexus', hostname: string|null, model: string|null }}
 */
KLU.parsers.parseVersion = function (text) {
  const platform = detectPlatform(text);
  return {
    platform,
    hostname: extractHostname(text, platform),
    model: extractModel(text, platform)
  };
};
