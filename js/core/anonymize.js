// L2-L3 Kommunikationsmatrix — Anonymisierungs-Option: globaler Toggle, ersetzt Hostnamen/IPs/
// MAC-Adressen in der Anzeige durch konsistente Platzhalter (gleicher Wert -> immer derselbe
// Platzhalter, innerhalb einer Sitzung), analog zum Platzhalterformat des bestehenden
// "Config Anonymizer"-Tools (*TYP_NNN*). Nur für den Fall gedacht, dass eine Analyse mit Dritten
// geteilt wird (Screenshot, Bildschirmfreigabe, Report-Export) — der Analyse-Stand selbst bleibt
// unverändert im Speicher, nur die ANZEIGE wird umgeschrieben. Deckt die sichtbaren Haupt-
// Oberflächen ab (Topologie, Tabellen, Panels, Suche, Report-Export, da der Report die bereits
// anonymisiert gerenderten DOM-Abschnitte snapshotet) — nicht jede interne Modell-Rohdatenstelle.
KLU.anonymize = {};

let enabled = false;
const maps = { hostname: new Map(), ip: new Map(), mac: new Map() };
const counters = { hostname: 0, ip: 0, mac: 0 };

function placeholder(type, realValue) {
  if (!maps[type].has(realValue)) {
    counters[type]++;
    maps[type].set(realValue, `*${type.toUpperCase()}_${String(counters[type]).padStart(3, '0')}*`);
  }
  return maps[type].get(realValue);
}

KLU.anonymize.isEnabled = function () {
  return enabled;
};

KLU.anonymize.setEnabled = function (value) {
  enabled = value;
  KLU.emit('anonymize:changed', value);
};

KLU.anonymize.hostname = function (value) {
  return (enabled && value) ? placeholder('hostname', value) : value;
};

KLU.anonymize.ip = function (value) {
  return (enabled && value) ? placeholder('ip', value) : value;
};

KLU.anonymize.mac = function (value) {
  return (enabled && value) ? placeholder('mac', value) : value;
};
