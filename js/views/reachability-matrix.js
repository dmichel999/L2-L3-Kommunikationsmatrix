// L2-L3 Kommunikationsmatrix — L3-Kommunikationsmatrix (Feature 1 der Erweiterung): VLAN×VLAN-Tabelle,
// ✓ = gemeinsamer Switch mit beiden SVIs bekannt (routbar), ? = nicht ermittelbar (kein Beweis
// für "blockiert", siehe reachability-model.js). Klick auf eine VLAN-Zeile zeigt bei vorhandener
// ACL deren Regeln an (reiner Text, keine Regelauswertung/keine Aussage, ob eine bestimmte
// Verbindung tatsächlich erlaubt wäre).
KLU.views = KLU.views || {};

function renderAclDetail(rows) {
  const selectedId = KLU.state.selectedVlan;
  if (selectedId == null) return '';
  const row = rows.find(r => r.vlanId === selectedId);
  if (!row || !row.acls.length) return '';

  const blocks = row.acls.map(a => `
    <div class="acl-block">
      <h3><code>${KLU.dom.escapeHtml(a.name)}</code> <span class="hint">(${KLU.dom.escapeHtml(KLU.anonymize.hostname(a.switchId))})</span></h3>
      ${a.rules && a.rules.length
      ? `<pre class="acl-rules">${a.rules.map(r => KLU.dom.escapeHtml(r)).join('\n')}</pre>`
      : '<p class="hint">Regeltext nicht importiert ("show ip access-lists" fehlt für diesen Switch) — nur der Name ist bekannt.</p>'}
    </div>
  `).join('');

  return `
    <div class="acl-detail">
      <h2>ACL-Regeln für VLAN ${selectedId}</h2>
      <p class="hint">Reiner Regeltext zur manuellen Prüfung — keine Auswertung, ob eine bestimmte Verbindung dadurch tatsächlich erlaubt/blockiert wäre.</p>
      ${blocks}
    </div>
  `;
}

function renderReachabilityMatrix() {
  const wrapper = document.getElementById('matrix-wrapper');
  if (!wrapper) return;
  const rows = KLU.reachabilityModel.build(KLU.state.getSwitches());

  if (rows.length === 0) {
    wrapper.innerHTML = '<p class="hint">Noch keine Switches mit bekanntem VLAN-Interface (SVI) importiert.</p>';
    return;
  }

  const header = `<tr><th></th>${rows.map(r => `<th>VLAN ${r.vlanId}</th>`).join('')}</tr>`;
  const body = rows.map(r => `
    <tr>
      <th class="matrix-row-header${r.vlanId === KLU.state.selectedVlan ? ' selected' : ''}" data-vlan-id="${r.vlanId}" title="${r.aclFlag ? 'Anklicken, um die ACL-Regeln zu sehen' : ''}">
        VLAN ${r.vlanId}${r.aclFlag ? ' <span class="switch-warning" title="Auf einer beteiligten SVI ist eine Access-List konfiguriert">⚠ ACL</span>' : ''}
      </th>
      ${rows.map(c => {
    if (c.vlanId === r.vlanId) return '<td class="matrix-cell matrix-cell-self">–</td>';
    const reachable = KLU.reachabilityModel.isReachable(r, c);
    const title = reachable ? 'Gemeinsamer Switch mit beiden SVIs bekannt' : 'Kein gemeinsamer Switch mit beiden SVIs bekannt — Erreichbarkeit nicht ermittelbar';
    return `<td class="matrix-cell ${reachable ? 'matrix-cell-reachable' : 'matrix-cell-unknown'}" title="${KLU.dom.escapeHtml(title)}">${reachable ? '✓' : '?'}</td>`;
  }).join('')}
    </tr>
  `).join('');

  wrapper.innerHTML = `
    <div class="table-wrap"><table class="matrix-table"><thead>${header}</thead><tbody>${body}</tbody></table></div>
    ${renderAclDetail(rows)}
  `;
}

KLU.views.reachabilityMatrix = {
  init() {
    KLU.on('switches:changed', renderReachabilityMatrix);
    KLU.on('view:changed', view => { if (view === 'matrix') renderReachabilityMatrix(); });
    KLU.on('vlan:selected', () => {
      if (document.getElementById('view-matrix')?.classList.contains('active')) renderReachabilityMatrix();
    });
    document.getElementById('matrix-wrapper')?.addEventListener('click', e => {
      const th = e.target.closest('.matrix-row-header');
      if (th) KLU.state.selectVlan(parseInt(th.dataset.vlanId, 10));
    });
    renderReachabilityMatrix();
  }
};
