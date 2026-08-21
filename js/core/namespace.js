// L2-L3 Kommunikationsmatrix — Global Namespace + Event Bus
const KLU = {
  version: '0.15.0',
  _events: {},

  on(event, fn) {
    (this._events[event] ||= []).push(fn);
  },

  off(event, fn) {
    if (!this._events[event]) return;
    this._events[event] = this._events[event].filter(f => f !== fn);
  },

  emit(event, data) {
    (this._events[event] || []).forEach(fn => {
      try { fn(data); } catch (e) { console.error(`Event "${event}" handler error:`, e); }
    });
  }
};
