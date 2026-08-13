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

function extractOsVersion(text, platform) {
  if (platform === 'nexus') {
    const m = /NXOS:\s*version\s+(\S+)/i.exec(text);
    if (m) return m[1];
  } else {
    const m = /,\s*Version\s+([^\s,]+)/i.exec(text);
    if (m) return m[1];
  }
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
 * @returns {{ platform: 'catalyst'|'nexus', hostname: string|null, model: string|null, osVersion: string|null }}
 */
KLU.parsers.parseVersion = function (text) {
  const platform = detectPlatform(text);
  return {
    platform,
    hostname: extractHostname(text, platform),
    model: extractModel(text, platform),
    osVersion: extractOsVersion(text, platform)
  };
};

/**
 * Plattform-Fallback, wenn "show version" in der Datei fehlt: anhand der tatsächlich
 * verwendeten Kommandonamen ableiten (Catalyst/Nexus benennen einige Kommandos anders).
 * @param {string} rawText Gesamter Dateiinhalt (vor dem Splitten in Kommando-Blöcke)
 * @returns {'catalyst'|'nexus'|null} null, wenn keines der bekannten Muster gefunden wurde
 */
KLU.parsers.inferPlatformFromCommandNames = function (rawText) {
  const promptCmd = /^\S+[#>]\s*(show[^\n]*)$/gim;
  let nexusHint = false;
  let catalystHint = false;
  let m;
  while ((m = promptCmd.exec(rawText)) !== null) {
    const cmd = m[1].trim().toLowerCase();
    if (cmd === 'show ip arp' || cmd === 'show port-channel summary') nexusHint = true;
    if (cmd === 'show arp' || cmd === 'show etherchannel summary') catalystHint = true;
  }
  if (nexusHint && !catalystHint) return 'nexus';
  if (catalystHint && !nexusHint) return 'catalyst';
  return null; // uneindeutig oder keines der unterscheidenden Kommandos vorhanden
};
