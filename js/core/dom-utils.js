// L2-L3 Kommunikationsmatrix — geteilte DOM-Helfer
KLU.dom = {
  escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
};
