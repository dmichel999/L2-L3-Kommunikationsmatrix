// Kunden LAN Überblick — Interface-Namen normalisieren für Vergleiche über verschiedene
// show-Kommandos hinweg. Cisco verwendet je Kommando unterschiedliche Abkürzungsstile für
// dieselbe Schnittstelle, z.B. "show cdp neighbor" -> "Gig 1/0/1" (mit Leerzeichen),
// "show etherchannel summary" -> "Gi1/0/1" (ohne Leerzeichen) — ein reiner String-Vergleich
// zwischen beiden Kommandos schlägt sonst fehl.
KLU.parsers = KLU.parsers || {};

const PORT_PREFIX_MAP = [
  [/^gigabitethernet|^gig|^gi/, 'gi'],
  [/^tengigabitethernet|^tengig|^ten|^te/, 'te'],
  [/^twentyfivegig|^twe/, 'twe'],
  [/^fortygig|^fo/, 'fo'],
  [/^hundredgig|^hu/, 'hu'],
  [/^fastethernet|^fas|^fa/, 'fa'],
  [/^ethernet|^eth/, 'eth'],
  [/^port-?channel|^po/, 'po']
];

/**
 * @param {string} name Interface-Bezeichnung wie sie in irgendeinem show-Output auftaucht
 * @returns {string} Kanonische Form (z.B. "gi1/0/1"), zum Vergleichen über Kommandos hinweg
 */
KLU.parsers.normalizePort = function (name) {
  if (!name) return '';
  const compact = name.replace(/\s+/g, '').toLowerCase();
  const match = /^([a-z-]+)(\d.*)$/.exec(compact);
  if (!match) return compact;
  const [, prefix, rest] = match;
  for (const [re, canonical] of PORT_PREFIX_MAP) {
    if (re.test(prefix)) return canonical + rest;
  }
  return compact;
};
