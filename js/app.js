// L2-L3 Kommunikationsmatrix — Initialisierung
// thought up by human, coded by ai
document.addEventListener('DOMContentLoaded', () => {
  KLU.views.import.init();
  KLU.views.topology.init();
  KLU.views.vlanTable.init();
  KLU.views.macDetail.init();
  KLU.views.networkDetail.init();
  KLU.views.trunkPanel.init();
  KLU.views.stpPanel.init();
  KLU.views.duplicatePanel.init();
  KLU.views.reachabilityMatrix.init();
  KLU.views.versionOverview.init();
  KLU.views.dashboardStats.init();
  KLU.views.globalSearch.init();
  KLU.views.splitPane.init('.split-pane', '#network-split-resizer');
  KLU.views.sidebarResize.init();
  KLU.views.collapsiblePanels.init('.panel');
  KLU.views.themeToggle.init();
  KLU.views.reportExport.init();
  KLU.views.tabs.init();

  const footerVersion = document.getElementById('app-footer-version');
  if (footerVersion) footerVersion.textContent = `v${KLU.version}`;
});
