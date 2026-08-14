// L2-L3 Kommunikationsmatrix — Gemeinsamer Helfer für Fixed-Width-Spaltenparser (CDP, VLAN, ...)
KLU.parsers = KLU.parsers || {};

KLU.parsers.sliceCol = function (line, start, end) {
  return (end != null ? line.slice(start, end) : line.slice(start)).trim();
};
