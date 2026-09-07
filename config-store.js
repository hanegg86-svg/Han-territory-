// ================= CONFIG & STATE =================
let db = {
  categories: {
    high: { id: 'high', name: 'สภาพคล่องสูง', color: 'emerald' },
    med: { id: 'med', name: 'สภาพคล่องปานกลาง', color: 'amber' },
    low: { id: 'low', name: 'สภาพคล่องต่ำ', color: 'purple' },
    ins: { id: 'ins', name: 'มูลค่าสะสมประกัน', color: 'rose' }
  },
  funds: [],
  records: {},
  transactions: [], 
  planningSettings: {},
  allocationSettings: {},
  passiveIncomeData: {}
};

let myChart = null;
let allocChart = null; 
let trendChart = null; 
let passiveChart = null; // ✅ เพิ่มตัวแปรสำหรับกราฟ Passive Income
let autoSaveTimer = null;
let activeEntryMonth = '';
let entryDirty = false;
let currentTab = 'tab-compare'; 
let renderUsingCarryForward = false;
let selectedSubCatsForCompare = [];

const CHART_COLORS = [
  { border: '#2563eb', bg: 'rgba(37, 99, 235, 0.08)' },
  { border: '#10b981', bg: 'rgba(16, 185, 129, 0.08)' }
];

const SUB_COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#64748b', '#06b6d4'];

// ================= UTILS & SANITIZATION =================
function generateId() { return 'f_' + Math.random().toString(36).substr(2, 9); }
function getCurrentMonth() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
function formatNumber(num) { return (num || 0).toLocaleString('th-TH', {minimumFractionDigits: 2, maximumFractionDigits: 2}); }
function parseLocalNumber(str) { if(!str) return 0; const v = parseFloat(String(str).replace(/[^0-9.-]+/g, '')); return isNaN(v) ? 0 : v; }

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showToast(msg) {
  const toast = document.getElementById('global-toast');
  if(!toast) return;
  document.getElementById('toast-message').innerText = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

function checkEmptyState() {
  const warn = document.getElementById('empty-state-warning');
  if (!warn) return;
  if (db.funds.length === 0) warn.classList.remove('hidden');
  else warn.classList.add('hidden');
}

// ================= INDEXEDDB ENGINE =================
const IDB_NAME = 'ProWealthDB';
const IDB_VERSION = 1;
const IDB_STORE_NAME = 'app_state';
const IDB_KEY = 'state_v2';

function openIDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, IDB_VERSION);
    request.onupgradeneeded = (event) => {
      const dbInstance = event.target.result;
      if (!dbInstance.objectStoreNames.contains(IDB_STORE_NAME)) {
        dbInstance.createObjectStore(IDB_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getIDB(key) {
  const idb = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE_NAME, 'readonly');
    const store = tx.objectStore(IDB_STORE_NAME);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function setIDB(key, val) {
  const idb = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE_NAME, 'readwrite');
    const store = tx.objectStore(IDB_STORE_NAME);
    const request = store.put(val, key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function clearIDB() {
  const idb = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE_NAME, 'readwrite');
    const store = tx.objectStore(IDB_STORE_NAME);
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// ================= DATABASE & STORAGE DISPLAY =================
async function updateStorageSizeDisplay() {
  const textEl = document.getElementById('db-storage-text');
  const barEl = document.getElementById('db-storage-bar');
  if (!textEl && !barEl) return;

  if (navigator.storage && navigator.storage.estimate) {
    try {
      const { usage, quota } = await navigator.storage.estimate();
      const usageMB = (usage / (1024 * 1024)).toFixed(2);
      const quotaMB = (quota / (1024 * 1024)).toFixed(0);
      const pct = Math.min(100, (usage / quota) * 100);

      if (textEl) {
        textEl.innerText = `${usageMB} MB / ${quotaMB} MB (${pct.toFixed(2)}% ของพื้นที่เบราว์เซอร์)`;
      }
      if (barEl) {
        barEl.style.width = `${pct}%`;
        if (pct > 90) barEl.className = 'bg-rose-500 h-full transition-all duration-300';
        else if (pct > 70) barEl.className = 'bg-amber-500 h-full transition-all duration-300';
        else barEl.className = 'bg-blue-600 h-full transition-all duration-300';
      }
      return;
    } catch (e) {
      console.warn('Storage estimate failed:', e);
    }
  }

  // Fallback คำนวณจากขนาด Object String
  const bytes = new Blob([JSON.stringify(db)]).size;
  const sizeKB = (bytes / 1024).toFixed(2);
  if (textEl) textEl.innerText = `${sizeKB} KB (IndexedDB Engine)`;
  if (barEl) barEl.style.width = '1%';
}

async function loadDB() {
  let saved = null;
  try {
    saved = await getIDB(IDB_KEY);
  } catch (err) {
    console.warn('Could not read from IndexedDB, trying localStorage fallback:', err);
  }

  // ระบบ Auto-Migration: ย้ายข้อมูลเดิมจาก LocalStorage สู่ IndexedDB อัตโนมัติ
  if (!saved) {
    const localData = localStorage.getItem('ProWealthDB_v2');
    if (localData) {
      try {
        saved = JSON.parse(localData);
        await setIDB(IDB_KEY, saved);
        localStorage.removeItem('ProWealthDB_v2');
        console.log('Successfully migrated data from LocalStorage to IndexedDB');
      } catch (migrationErr) {
        console.error('Migration failed:', migrationErr);
      }
    }
  }

  if (saved) {
    db = saved;
    if(!db.transactions) db.transactions = [];
    if(!db.planningSettings) db.planningSettings = {};
    if(!db.allocationSettings) db.allocationSettings = {};
    if(!db.passiveIncomeData) db.passiveIncomeData = {};
    
    if (db.funds && db.funds.length > 0) {
      db.funds = db.funds.map(f => {
        if (!f.subCategories) { f.subCategories = []; }
        if (f.units === undefined) f.units = 0;
        if (f.symbol === undefined) f.symbol = f.name || '';
        return f;
      });
    }
  }
  checkEmptyState();
  if (typeof loadPlanningSettings === 'function') {
    loadPlanningSettings();
  }
  updateStorageSizeDisplay();
}

function saveDB() {
  setIDB(IDB_KEY, db).catch(err => console.error('Save to IndexedDB failed:', err));
  checkEmptyState();
  updateStorageSizeDisplay();
}

async function factoryReset() {
  if (confirm('⚠️ ล้างข้อมูลทั้งหมดอย่างถาวร ยืนยันหรือไม่?')) {
    try {
      await clearIDB();
    } catch (e) {
      console.error(e);
    }
    localStorage.removeItem('ProWealthDB_v2');
    localStorage.removeItem('GEMINI_API_KEY');
    location.reload();
  }
}

// ================= BACKUP / RESTORE / EXPORT =================
function backupToJson() {
  const payload = { app: 'Pro Wealth Tracker PWA', version: 'v3.5.0', exportedAt: new Date().toISOString(), data: db };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `WealthTracker_Backup_${getCurrentMonth()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function restoreFromJson() {
  const input = document.getElementById('json-restore-input');
  if(!input) return;
  const file = input.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const parsed = JSON.parse(e.target.result);
      const restoreData = parsed.data || parsed;
      if (!restoreData || !restoreData.categories || !restoreData.funds || !restoreData.records) {
        alert('ไฟล์ JSON ไม่อยู่ในรูปแบบที่รองรับ');
        input.value = '';
        return;
      }
      if (!confirm('ต้องการ Restore ข้อมูลจาก JSON ใช่หรือไม่? ข้อมูลปัจจุบันจะถูกแทนที่ทั้งหมด')) {
        input.value = '';
        return;
      }
      db = restoreData;
      if(!db.transactions) db.transactions = [];
      if(!db.planningSettings) db.planningSettings = {};
      if(!db.allocationSettings) db.allocationSettings = {};
      if(!db.passiveIncomeData) db.passiveIncomeData = {};
      
      if (db.funds && db.funds.length > 0) {
        db.funds = db.funds.map(f => {
          if (!f.subCategories) { f.subCategories = []; }
          if (f.units === undefined) f.units = 0;
          if (f.symbol === undefined) f.symbol = f.name || '';
          return f;
        });
      }

      saveDB();
      input.value = '';
      if (typeof loadPlanningSettings === 'function') loadPlanningSettings();
      if (typeof refreshCurrentTab === 'function') refreshCurrentTab();
      showToast('Restore สำเร็จ');
    } catch (err) {
      alert('ไม่สามารถอ่านไฟล์ JSON ได้');
      input.value = '';
    }
  };
  reader.readAsText(file);
}

function exportToExcel() {
  if (db.funds.length === 0 || Object.keys(db.records).length === 0) {
    alert('ยังไม่มีข้อมูลสำหรับ Export ครับ');
    return;
  }
  let summaryData = [["เดือน/ปี", "สภาพคล่องสูง", "สภาพคล่องปานกลาง", "สภาพคล่องต่ำ", "ประกัน/อื่นๆ", "ยอดรวมทั้งหมด"]];
  const sortedMonths = Object.keys(db.records).sort();
  sortedMonths.forEach(month => {
    let totals = { high: 0, med: 0, low: 0, ins: 0, all: 0 };
    db.funds.forEach(fund => {
      const val = db.records[month][fund.id] || 0;
      if (totals[fund.catId] !== undefined) totals[fund.catId] += val;
      totals.all += val;
    });
    summaryData.push([month, totals.high, totals.med, totals.low, totals.ins, totals.all]);
  });

  let fundsData = [["เดือน/ปี", "หมวดหมู่", "ชื่อบัญชี/กองทุน", "รหัสกองทุน", "ยอดเงิน (บาท)"]];
  sortedMonths.forEach(month => {
    db.funds.forEach(fund => {
      const val = db.records[month][fund.id] || 0;
      const catName = db.categories[fund.catId] ? db.categories[fund.catId].name : 'อื่นๆ';
      fundsData.push([month, catName, fund.name, fund.symbol || '', val]);
    });
  });

  let txData = [["วันที่ทำรายการ", "ชื่อบัญชี/กองทุน", "ประเภทรายการ", "จำนวนเงิน (บาท)"]];
  const sortedTx = [...db.transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
  
  sortedTx.forEach(t => {
    const fund = db.funds.find(f => f.id === t.fundId);
    const fundName = fund ? `${fund.name} (${fund.symbol || ''})` : 'ไม่ทราบชื่อกองทุน';
    let typeStr = t.type === 'BUY' ? 'ซื้อ' : 'ขาย';
    txData.push([t.date, fundName, typeStr, t.amount]);
  });

  let passData = [["เดือน/ปี", "Active Income", "Expenses", "เงินเข้า PF รวม"]];
  Object.keys(db.passiveIncomeData || {}).sort().forEach(m => {
    const item = db.passiveIncomeData[m];
    passData.push([m, item.activeIncome || 0, item.expenses || 0, item.pfTotal || 0]);
  });

  const wb = XLSX.utils.book_new();
  const ws1_data = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, ws1_data, "สรุปยอดรายเดือน");
  const ws2 = XLSX.utils.aoa_to_sheet(fundsData);
  XLSX.utils.book_append_sheet(wb, ws2, "ข้อมูลรายกองทุน");
  const ws3 = XLSX.utils.aoa_to_sheet(txData);
  XLSX.utils.book_append_sheet(wb, ws3, "ประวัติการซื้อขาย");
  const ws4 = XLSX.utils.aoa_to_sheet(passData);
  XLSX.utils.book_append_sheet(wb, ws4, "Passive Income");
  
  XLSX.writeFile(wb, "WealthTracker_Export_" + getCurrentMonth() + ".xlsx");
  showToast("Export Excel สำเร็จ!");
}
