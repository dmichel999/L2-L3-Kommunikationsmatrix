// L2-L3 Kommunikationsmatrix — Splitter: rohe Terminal-Session-Textdatei -> benannte Kommando-Blöcke
KLU.parsers = KLU.parsers || {};

// Reihenfolge egal, mehrere Patterns pro Key falls Catalyst/Nexus-Syntax abweicht.
const COMMAND_MAP = [
  { key: 'version', patterns: [/^show version$/i] },
  { key: 'cdpNeighbor', patterns: [/^show cdp neighbors?( detail)?$/i] },
  { key: 'portChannel', patterns: [/^show etherchannel summary$/i, /^show port-channel summary$/i] },
  { key: 'vlan', patterns: [/^show vlan( brief)?$/i] },
  { key: 'macAddressTable', patterns: [/^show mac address-table$/i, /^show mac-address-table$/i] },
  { key: 'ipInterfaceBrief', patterns: [/^show ip interface brief$/i] },
  { key: 'arp', patterns: [/^show arp$/i, /^show ip arp$/i] },
  { key: 'ipRoute', patterns: [/^show ip route$/i] },
  { key: 'interfacesTrunk', patterns: [/^show interfaces trunk$/i, /^show interface trunk$/i] },
  { key: 'ipInterfaceFull', patterns: [/^show ip interface$/i] },
  { key: 'spanningTree', patterns: [/^show spanning-tree$/i] },
  { key: 'fhrpStatus', patterns: [/^show standby$/i, /^show hsrp$/i, /^show vrrp$/i] }
];

// Prompt + Kommando-Echo, z.B. "SW1#show version" oder "SW1>show ip route".
// Gruppe 1 (Hostname) wird als Fallback genutzt, wenn "show version" in der Datei fehlt.
const PROMPT_LINE = /^(\S+)[#>]\s*(show\s+\S.*)$/i;
const MORE_PROMPT = /--\s*More\s*--/i;

function normalizeCommand(text) {
  return text.replace(/\s+/g, ' ').trim();
}

function matchCommandKey(commandText) {
  const normalized = normalizeCommand(commandText);
  for (const entry of COMMAND_MAP) {
    if (entry.patterns.some(p => p.test(normalized))) return entry.key;
  }
  return null;
}

// Entfernt Pagination-Artefakte ("--More--" + Steuerzeichen) aus einem Block. Rand-Leerzeilen
// werden beim finalen .trim() des zusammengefügten Blocks entfernt, nicht hier.
function cleanBlockLines(lines) {
  return lines.map(l => l.replace(MORE_PROMPT, '').replace(/\x08+/g, ''));
}

/**
 * @param {string} rawText Inhalt einer Switch-Textdatei (mehrere "show"-Kommandos nacheinander)
 * @returns {{ commands: Record<string,string>, unrecognized: string[], promptHostname: string|null }}
 */
KLU.parsers.splitCommands = function (rawText) {
  const lines = rawText.replace(/\r\n?/g, '\n').split('\n');
  const commands = {};
  const unrecognized = [];
  let promptHostname = null;

  let currentKey = null;
  let currentCommandText = null;
  let buffer = [];

  function flush() {
    if (!currentCommandText) return;
    const text = cleanBlockLines(buffer).join('\n').trim();
    if (currentKey) {
      // Falls dasselbe Kommando mehrfach vorkommt, letzten (vollständigsten) Block gewinnen lassen
      commands[currentKey] = text;
    } else {
      unrecognized.push(currentCommandText);
    }
    buffer = [];
  }

  for (const line of lines) {
    const match = PROMPT_LINE.exec(line.trim());
    if (match) {
      flush();
      if (!promptHostname) promptHostname = match[1];
      currentCommandText = match[2];
      currentKey = matchCommandKey(currentCommandText);
      continue;
    }
    if (currentCommandText !== null) buffer.push(line);
  }
  flush();

  return { commands, unrecognized, promptHostname };
};
