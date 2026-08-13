// Kunden LAN Überblick — Text-Extraktion aus .docx (Word-Dokument = ZIP-Archiv mit XML).
// Erlaubt Import, wenn Kunden ihre show-Kommando-Mitschriften in Word statt reinem Text
// abgelegt haben. Nutzt lib/jszip.min.js zum Entpacken, kein Server/CDN nötig.
KLU.parsers = KLU.parsers || {};

const WORD_TEXT_TAG = 'w:t';
const WORD_BREAK_TAGS = new Set(['w:br', 'w:cr']);
const WORD_TAB_TAG = 'w:tab';
const WORD_PARAGRAPH_TAG = 'w:p';

function collectRunText(node, out) {
  if (node.nodeType !== 1) return; // nur Element-Knoten
  const tag = node.tagName;
  if (tag === WORD_TEXT_TAG) {
    out.push(node.textContent);
  } else if (WORD_BREAK_TAGS.has(tag)) {
    out.push('\n');
  } else if (tag === WORD_TAB_TAG) {
    out.push('\t');
  } else {
    for (const child of node.childNodes) collectRunText(child, out);
  }
}

/**
 * @param {ArrayBuffer} arrayBuffer Inhalt einer .docx-Datei
 * @returns {Promise<string>} Reiner Text, ein Absatz aus dem Word-Dokument pro Zeile
 */
KLU.parsers.extractDocxText = async function (arrayBuffer) {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const xmlFile = zip.file('word/document.xml');
  if (!xmlFile) {
    throw new Error('word/document.xml nicht gefunden — ist das eine gültige .docx-Datei?');
  }
  const xmlText = await xmlFile.async('string');
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('word/document.xml konnte nicht als XML gelesen werden — ist die Datei beschädigt?');
  }

  const paragraphs = doc.getElementsByTagName(WORD_PARAGRAPH_TAG);
  const lines = [];
  for (const p of paragraphs) {
    const chunks = [];
    for (const child of p.childNodes) collectRunText(child, chunks);
    lines.push(chunks.join(''));
  }
  return lines.join('\n');
};
