// L2-L3 Kommunikationsmatrix — Parser für "show ip access-lists" (Catalyst/Nexus, identisches
// Format: "<Extended >IP access list NAME" gefolgt von nummerierten Regelzeilen). Liefert die
// Regelzeilen unveraendert als Text - bewusst KEINE Auswertung von Protokoll/Quelle/Ziel, die
// L3-Kommunikationsmatrix zeigt die ACL nur zur manuellen Pruefung an (siehe reachability-model.js).
KLU.parsers = KLU.parsers || {};

const ACL_HEADER_RE = /^(?:Extended |Standard )?(?:IP|IPv6)?\s*access[- ]list\s+(\S+)/i;

/**
 * @param {string} text Block-Text von "show ip access-lists" / "show access-lists"
 * @returns {Array<{ name: string, rules: string[] }>}
 */
KLU.parsers.parseAccessLists = function (text) {
  const acls = [];
  let current = null;

  for (const raw of text.split('\n')) {
    const line = raw.replace(/\r$/, '');
    if (!line.trim()) continue;
    const headerMatch = ACL_HEADER_RE.exec(line.trim());
    if (headerMatch) {
      current = { name: headerMatch[1], rules: [] };
      acls.push(current);
      continue;
    }
    if (current) current.rules.push(line.trim());
  }

  return acls;
};
