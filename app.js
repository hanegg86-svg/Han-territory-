// ================= SERVICE WORKER & PWA INSTALL =================
let deferredPrompt;
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => {
        console.log('Service Worker Registered Successfully!');
        // ตรวจจับการอัปเดต Service Worker ใหม่
        reg.onupdatefound = () => {
          const installingWorker = reg.installing;
          if (!installingWorker) return;
          installingWorker.onstatechange = () => {
            if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('New content available; please refresh.');
              if (confirm('มีเวอร์ชันใหม่ของแอปพร้อมใช้งาน! ต้องการรีโหลดเพื่ออัปเดตทันทีหรือไม่?')) {
                installingWorker.postMessage({ action: 'skipWaiting' });
                window.location.reload();
              }
            }
          };
        };
      })
      .catch(err => console.error('Service Worker Registration Failed:', err));
  });

  // เมื่อ Service Worker ตัวใหม่เข้าควบคุม ให้รีโหลดหน้าอัตโนมัติหากมีการสั่ง skipWaiting
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });
}

// ฟังก์ชันล้างแคช Service Worker และรีโหลดแอปใหม่ทั้งหมด (คงข้อมูล IndexedDB เดิมไว้)
async function clearAppCacheAndReload() {
  if (confirm('ต้องการล้างแคช Service Worker และโหลดไฟล์แอปเวอร์ชันล่าสุดใช่หรือไม่?\n\n(ข้อมูลพอร์ตและประวัติการซื้อขายที่บันทึกไว้จะไม่สูญหาย)')) {
    showToast('กำลังล้างแคชและอัปเดตแอป...');

    try {
      // 1. ลบไฟล์ทั้งหมดใน Cache Storage
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }

      // 2. ยกเลิกการลงทะเบียน Service Worker ตัวเดิม
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (let registration of registrations) {
          await registration.unregister();
        }
      }

      // 3. หน่วงเวลาเล็กน้อยแล้วสั่ง Hard Reload
      setTimeout(() => {
        window.location.href = window.location.pathname + '?reload=' + Date.now();
      }, 600);
    } catch (err) {
      console.error('Clear Cache Error:', err);
      window.location.reload();
    }
  }
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
  if (typeof currentTab !== 'undefined' && currentTab === 'tab-entry' && tabId !== 'tab-entry' && entryDirty) {
    clearTimeout(autoSaveTimer);
    saveEntryMonth(activeEntryMonth, { silent: true });
  }
  if (typeof currentTab !== 'undefined') currentTab = tabId;
  
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
  if (tabId === 'tab-nav') initNavChartTab();
  if (tabId === 'tab-planning') initPlanningTab();
  if (tabId === 'tab-transactions') initTransactionsTab();
  if (tabId === 'tab-allocation') initAllocationTab();
  if (tabId === 'tab-passive') initPassiveIncomeTab(); // ✅ เพิ่มบรรทัดนี้
}

function refreshCurrentTab() {
  checkEmptyState();
  if (typeof currentTab !== 'undefined') {
    if (currentTab === 'tab-setup') { renderSetupTab(); updateApiKeyStatusBadge(); }
    if (currentTab === 'tab-entry') initEntryTab();
    if (currentTab === 'tab-compare') initCompareTab();
    if (currentTab === 'tab-charts') initChartsTab();
    if (currentTab === 'tab-nav') initNavChartTab();
    if (currentTab === 'tab-planning') initPlanningTab();
    if (currentTab === 'tab-transactions') initTransactionsTab();
    if (currentTab === 'tab-allocation') initAllocationTab();
    if (currentTab === 'tab-passive') initPassiveIncomeTab(); // ✅ เพิ่มบรรทัดนี้
  }
}

// ================= APP INITIALIZATION =================
document.addEventListener('DOMContentLoaded', async () => {
  await loadDB();
  switchTab('tab-compare');
});
