// L2-L3 Kommunikationsmatrix — CSV-Export-Helfer, von VLAN-Tabelle und MAC-Ansicht aus aufrufbar.
// Semikolon als Trennzeichen (Excel-DE-Konvention), UTF-8 BOM, damit Excel Umlaute korrekt zeigt.
KLU.csvExport = {};

function escapeCsvField(value) {
  const str = String(value ?? '');
  return /[";\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

/**
 * @param {string[]} headers
 * @param {Array<Array<string|number>>} rows
 * @returns {string}
 */
KLU.csvExport.toCsv = function (headers, rows) {
  return [headers, ...rows].map(row => row.map(escapeCsvField).join(';')).join('\r\n');
};

/**
 * @param {string} filename
 * @param {string} csvContent
 */
KLU.csvExport.download = function (filename, csvContent) {
  const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
