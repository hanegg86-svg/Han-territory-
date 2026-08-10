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
  allocationSettings: {} 
};

let myChart = null;
let allocChart = null; 
let trendChart = null; 
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

// ================= UTILS =================
function generateId() { return 'f_' + Math.random().toString(36).substr(2, 9); }
function getCurrentMonth() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
function formatNumber(num) { return (num || 0).toLocaleString('th-TH', {minimumFractionDigits: 2, maximumFractionDigits: 2}); }
function parseLocalNumber(str) { if(!str) return 0; const v = parseFloat(String(str).replace(/[^0-9.-]+/g, '')); return isNaN(v) ? 0 : v; }

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

// ================= LOCALSTORAGE & DATABASE =================
function updateStorageSizeDisplay() {
  const dbData = localStorage.getItem('ProWealthDB_v2') || '';
  const bytes = new Blob([dbData]).size;
  const maxBytes = 5 * 1024 * 1024; 
  const pct = Math.min(100, (bytes / maxBytes) * 100);

  let formattedSize = '';
  if (bytes >= 1024 * 1024) {
    formattedSize = (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  } else if (bytes >= 1024) {
    formattedSize = (bytes / 1024).toFixed(2) + ' KB';
  } else {
    formattedSize = bytes + ' Bytes';
  }

  const textEl = document.getElementById('db-storage-text');
  const barEl = document.getElementById('db-storage-bar');

  if (textEl) {
    textEl.innerText = `${formattedSize} / 5.00 MB (${pct.toFixed(2)}%)`;
  }
  if (barEl) {
    barEl.style.width = `${pct}%`;
    if (pct > 90) {
      barEl.className = 'bg-rose-500 h-full transition-all duration-300';
    } else if (pct > 70) {
      barEl.className = 'bg-amber-500 h-full transition-all duration-300';
    } else {
      barEl.className = 'bg-blue-600 h-full transition-all duration-300';
    }
  }
}

function loadDB() {
  const saved = localStorage.getItem('ProWealthDB_v2');
  if (saved) {
    db = JSON.parse(saved);
    if(!db.transactions) db.transactions = [];
    if(!db.planningSettings) db.planningSettings = {};
    if(!db.allocationSettings) db.allocationSettings = {};
    
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
  localStorage.setItem('ProWealthDB_v2', JSON.stringify(db));
  checkEmptyState();
  updateStorageSizeDisplay();
}

function factoryReset() {
  if (confirm('⚠️ ล้างข้อมูลทั้งหมดอย่างถาวร ยืนยันหรือไม่?')) {
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
  const sortedTx = [...db.transactions].sort((a, b) => new Date(a.date) - new Date(a.date));
  sortedTx.forEach(t => {
    const fund = db.funds.find(f => f.id === t.fundId);
    const fundName = fund ? `${fund.name} (${fund.symbol || ''})` : 'ไม่ทราบชื่อกองทุน';
    let typeStr = t.type === 'BUY' ? 'ซื้อ' : 'ขาย';
    txData.push([t.date, fundName, typeStr, t.amount]);
  });

  const wb = XLSX.utils.book_new();
  const ws1_data = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, ws1_data, "สรุปยอดรายเดือน");
  const ws2 = XLSX.utils.aoa_to_sheet(fundsData);
  XLSX.utils.book_append_sheet(wb, ws2, "ข้อมูลรายกองทุน");
  const ws3 = XLSX.utils.aoa_to_sheet(txData);
  XLSX.utils.book_append_sheet(wb, ws3, "ประวัติการซื้อขาย");
  
  XLSX.writeFile(wb, "WealthTracker_Export_" + getCurrentMonth() + ".xlsx");
  showToast("Export Excel สำเร็จ!");
}
