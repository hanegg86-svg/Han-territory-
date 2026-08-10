// ================= SERVICE WORKER & PWA INSTALL =================
let deferredPrompt;
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('Service Worker Registered Successfully!'))
      .catch(err => console.error('Service Worker Registration Failed:', err));
  });
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const installBanner = document.getElementById('pwa-install-banner');
  if (installBanner) installBanner.classList.remove('hidden');
});

function installPWA() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        const installBanner = document.getElementById('pwa-install-banner');
        if (installBanner) installBanner.classList.add('hidden');
      }
      deferredPrompt = null;
    });
  }
}

// ================= TAB ROUTING & CONTROLLER =================
function switchTab(tabId) {
  if (currentTab === 'tab-entry' && tabId !== 'tab-entry' && entryDirty) {
    clearTimeout(autoSaveTimer);
    saveEntryMonth(activeEntryMonth, { silent: true });
  }
  currentTab = tabId;
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('[id^="btn-tab-"]').forEach(btn => {
    btn.classList.remove('bg-white', 'shadow-sm', 'text-blue-700');
    btn.classList.add('text-slate-600');
  });
  
  const activeContent = document.getElementById(tabId);
  if(activeContent) activeContent.classList.remove('hidden');
  
  const activeBtn = document.getElementById('btn-' + tabId);
  if(activeBtn) {
    activeBtn.classList.add('bg-white', 'shadow-sm', 'text-blue-700');
    activeBtn.classList.remove('text-slate-600');
  }

  if (tabId === 'tab-setup') { renderSetupTab(); updateApiKeyStatusBadge(); }
  if (tabId === 'tab-entry') initEntryTab();
  if (tabId === 'tab-compare') initCompareTab();
  if (tabId === 'tab-charts') initChartsTab();
  if (tabId === 'tab-planning') initPlanningTab();
  if (tabId === 'tab-transactions') initTransactionsTab();
  if (tabId === 'tab-allocation') initAllocationTab();
}

function refreshCurrentTab() {
  checkEmptyState();
  if (currentTab === 'tab-setup') { renderSetupTab(); updateApiKeyStatusBadge(); }
  if (currentTab === 'tab-entry') initEntryTab();
  if (currentTab === 'tab-compare') initCompareTab();
  if (currentTab === 'tab-charts') initChartsTab();
  if (currentTab === 'tab-planning') initPlanningTab();
  if (currentTab === 'tab-transactions') initTransactionsTab();
  if (currentTab === 'tab-allocation') initAllocationTab();
}

// ================= APP INITIALIZATION =================
loadDB();
switchTab('tab-compare');
