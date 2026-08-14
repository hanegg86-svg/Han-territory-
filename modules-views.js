// Register Chart.js Custom Value Labels Plugin
const chartValueLabelsPlugin = {
  id: 'chartValueLabelsPlugin',
  afterDatasetsDraw(chart) {
    if(chart.config.type !== 'line') return;
    const ctx = chart.ctx;
    const labelCount = chart.data.labels.length;
    const showAll = labelCount <= 12; 
    
    ctx.save();
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    chart.data.datasets.forEach((dataset, datasetIndex) => {
      const meta = chart.getDatasetMeta(datasetIndex);
      if (meta.hidden) return;
      meta.data.forEach((point, index) => {
        if (!showAll && index !== labelCount - 1 && index % Math.ceil(labelCount / 6) !== 0) return;
        const value = dataset.data[index];
        if (value > 0) {
          const displayVal = value >= 1000000 ? (value / 1000000).toFixed(1) + 'M' 
                           : value >= 1000 ? (value / 1000).toFixed(0) + 'k' : value;
          ctx.fillStyle = dataset.borderColor;
          ctx.fillText(displayVal, point.x, point.y - 8);
        }
      });
    });
    ctx.restore();
  }
};
Chart.register(chartValueLabelsPlugin);

// ================= SETUP MODULE =================
function renderSetupTab() {
  const container = document.getElementById('setup-list-container');
  if(!container) return;
  container.innerHTML = '';

  Object.values(db.categories || {}).forEach(cat => {
    const catFunds = (db.funds || []).filter(f => f.catId === cat.id);
    let html = `<div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <h3 class="font-bold text-${cat.color}-600 mb-3 border-b border-slate-100 pb-2">${escapeHtml(cat.name)}</h3>
        <div class="space-y-4">`;
    if (catFunds.length === 0) html += `<p class="text-xs text-slate-400">ยังไม่มีข้อมูลในหมวดนี้</p>`;
    
    catFunds.forEach(f => {
      const safeName = escapeHtml(f.name || '');
      const safeSymbol = escapeHtml(f.symbol || '');

      html += `
        <div class="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-3">
          <div class="flex justify-between items-center gap-2">
            <div class="flex-1 space-y-1">
              <input type="text" value="${safeName}" onchange="updateFundName('${f.id}', this.value)" placeholder="ชื่อเรียกกองทุน" class="bg-transparent border-b border-slate-300 focus:border-blue-500 outline-none text-sm font-bold text-slate-800 w-full">
              <div class="flex items-center space-x-1.5">
                <span class="text-[10px] font-bold text-slate-400">รหัส:</span>
                <input type="text" value="${safeSymbol}" onchange="updateFundSymbol('${f.id}', this.value)" placeholder="รหัสสแกน AI (เช่น K-SF-SSF)" class="bg-white border border-slate-300 focus:border-blue-500 rounded px-1.5 py-0.5 text-xs font-mono font-bold text-blue-800 uppercase outline-none">
              </div>
            </div>
            <button onclick="deleteFund('${f.id}')" class="text-rose-400 hover:text-rose-600 p-1.5"><i class="fa-solid fa-trash-can text-md"></i></button>
          </div>

          <div class="pt-1 border-t border-slate-200/60">
            <div class="flex flex-wrap gap-1.5 items-center">
              ${(f.subCategories || []).map(sub => `
                <span class="inline-flex items-center px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded">
                  ${escapeHtml(sub.name)} (${sub.weight}%)
                  <button onclick="deleteSubCategory('${f.id}', '${sub.id}')" class="ml-1 text-blue-400 hover:text-blue-600"><i class="fa-solid fa-xmark"></i></button>
                </span>
              `).join('')}
              ${(!f.subCategories || f.subCategories.length < 4) ? `
                <button onclick="addSubCategory('${f.id}')" class="text-[10px] text-blue-600 hover:underline font-bold bg-white px-2 py-0.5 border border-blue-200 rounded">
                  <i class="fa-solid fa-plus mr-0.5"></i>เพิ่มประเภทย่อย
                </button>
              ` : ''}
            </div>
          </div>
        </div>`;
    });
    html += `</div></div>`;
    container.innerHTML += html;
  });

  if (typeof updateStorageSizeDisplay === 'function') updateStorageSizeDisplay();
}

function addNewFund() {
  const nameInput = document.getElementById('new-fund-name');
  const symbolInput = document.getElementById('new-fund-symbol');
  const catInput = document.getElementById('new-fund-cat');

  if (!nameInput || nameInput.value.trim() === '') return alert('กรุณากรอกชื่อกองทุน/บัญชี');

  const nameVal = nameInput.value.trim();
  const symbolVal = symbolInput && symbolInput.value.trim() !== '' ? symbolInput.value.trim().toUpperCase() : nameVal.toUpperCase();

  if (!db.funds) db.funds = [];
  db.funds.push({
    id: generateId(),
    name: nameVal,
    symbol: symbolVal,
    catId: catInput ? catInput.value : 'high',
    units: 0,
    subCategories: []
  });

  nameInput.value = '';
  if(symbolInput) symbolInput.value = '';
  saveDB();
  renderSetupTab();
  showToast('เพิ่มกองทุนเรียบร้อย');
}

function updateFundSymbol(id, newSymbol) {
  const fund = (db.funds || []).find(f => f.id === id);
  if (fund) { 
    fund.symbol = newSymbol.trim().toUpperCase(); 
    saveDB(); 
    showToast('อัปเดตรหัสกองทุนเรียบร้อย');
  }
}

function updateFundName(id, newName) {
  const fund = (db.funds || []).find(f => f.id === id);
  if (fund && newName.trim() !== '') { fund.name = newName.trim(); saveDB(); }
}

function addSubCategory(fundId) {
  const fund = (db.funds || []).find(f => f.id === fundId);
  if (!fund) return;
  if (!fund.subCategories) fund.subCategories = [];
  if (fund.subCategories.length >= 4) return alert('จำกัดสูงสุด 4 ประเภทต่อกองทุนผสมครับ');
  
  const name = prompt('กรอกชื่อประเภทย่อย (เช่น ทอง, หุ้นต่างประเทศ, เงินสด):');
  if (!name || name.trim() === '') return;
  const weight = prompt('กรอกสัดส่วนเปอร์เซ็นต์ (%) (เช่น 25):');
  if (!weight || isNaN(parseFloat(weight))) return alert('กรุณากรอกตัวเลขสัดส่วนที่ถูกต้อง');

  fund.subCategories.push({
    id: 'sub_' + Math.random().toString(36).substr(2, 5),
    name: name.trim(),
    weight: parseFloat(weight)
  });
  saveDB();
  renderSetupTab();
}

function deleteSubCategory(fundId, subId) {
  const fund = (db.funds || []).find(f => f.id === fundId);
  if (fund && fund.subCategories) {
    fund.subCategories = fund.subCategories.filter(s => s.id !== subId);
    saveDB();
    renderSetupTab();
  }
}

function deleteFund(id) {
  if (confirm('หากลบกองทุนนี้ ประวัติย้อนหลังจะถูกลบด้วย ยืนยันหรือไม่?')) {
    db.funds = (db.funds || []).filter(f => f.id !== id);
    if (db.records) {
      Object.keys(db.records).forEach(month => { if (db.records[month] && db.records[month][id] !== undefined) delete db.records[month][id]; });
    }
    if (db.transactions) {
      db.transactions = db.transactions.filter(t => t.fundId !== id); 
    }
    saveDB(); renderSetupTab();
  }
}

// ================= ENTRY FORM MODULE =================
function initEntryTab() {
  const mInput = document.getElementById('entry-month');
  if(mInput) {
    if (!mInput.value) mInput.value = getCurrentMonth();
    activeEntryMonth = mInput.value;
  }
  entryDirty = false;
  renderUsingCarryForward = false;
  renderEntryForm();
}

function changeEntryMonth() {
  if (entryDirty) {
    clearTimeout(autoSaveTimer);
    saveEntryMonth(activeEntryMonth, { showToastFlag: false });
  }
  const mInput = document.getElementById('entry-month');
  if(mInput) activeEntryMonth = mInput.value;
  entryDirty = false;
  renderUsingCarryForward = false;
  renderEntryForm();
}

function getDisplayDataForMonth(month) {
  if (!db.records) db.records = {};
  if (db.records[month]) { renderUsingCarryForward = false; return db.records[month]; }
  const prevMonths = Object.keys(db.records).filter(m => m < month).sort();
  if (prevMonths.length > 0) {
    renderUsingCarryForward = true;
    return db.records[prevMonths[prevMonths.length - 1]] || {};
  }
  return {};
}

function autoCalcMonthlyFund(fundId, changedField) {
  const navEl = document.getElementById(`entry-nav-${fundId}`);
  const unitsEl = document.getElementById(`entry-units-${fundId}`);
  const totalEl = document.getElementById(`entry-${fundId}`);

  if (!totalEl) return;

  let nav = navEl ? parseFloat(navEl.value) || 0 : 0;
  let units = unitsEl ? parseFloat(unitsEl.value) || 0 : 0;
  let total = parseLocalNumber(totalEl.value) || 0;

  if (changedField === 'nav' || changedField === 'units') {
    if (nav > 0 && units > 0) {
      totalEl.value = formatNumber(nav * units);
    }
  } else if (changedField === 'total') {
    if (navEl && total > 0 && units > 0) {
      navEl.value = (total / units).toFixed(4);
    }
  }

  const fund = (db.funds || []).find(f => f.id === fundId);
  if (fund && units > 0) {
    fund.units = units;
    saveDB();
  }

  scheduleAutoSave(fundId, totalEl.value);
}

function renderEntryForm() {
  const mInput = document.getElementById('entry-month');
  if(!mInput) return;
  const month = mInput.value;
  const container = document.getElementById('entry-form-container');
  const warning = document.getElementById('entry-carry-forward-warning');
  const summaryPanel = document.getElementById('entry-summary-panel');
  if(!container) return;
  container.innerHTML = '';
  
  if (!db.funds || db.funds.length === 0) {
    if(warning) warning.classList.add('hidden');
    if(summaryPanel) summaryPanel.classList.add('hidden');
    container.innerHTML = `<div class="text-center py-10 text-slate-400 bg-white rounded-2xl border border-slate-200">กรุณาเพิ่มชื่อบัญชี/กองทุนในแท็บตั้งค่าก่อน</div>`;
    return;
  }
  if(summaryPanel) summaryPanel.classList.remove('hidden');

  const currentData = getDisplayDataForMonth(month);
  
  const sortedMonths = Object.keys(db.records || {}).filter(m => m < month).sort();
  let prevMonthData = {};
  if (sortedMonths.length > 0) {
    prevMonthData = db.records[sortedMonths[sortedMonths.length - 1]] || {};
  }

  if(warning) {
    if (renderUsingCarryForward) warning.classList.remove('hidden');
    else warning.classList.add('hidden');
  }

  Object.values(db.categories || {}).forEach(cat => {
    const catFunds = (db.funds || []).filter(f => f.catId === cat.id);
    if (catFunds.length === 0) return;
    let html = `
      <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <h3 class="font-bold text-${cat.color}-600 mb-4 uppercase tracking-wide">${escapeHtml(cat.name)}</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">`;
    
    catFunds.forEach(f => {
      let val = currentData[f.id] !== undefined ? currentData[f.id] : '';
      const displayVal = val !== '' ? formatNumber(val) : '';
      
      const currentAmount = parseLocalNumber(val);
      const prevAmount = prevMonthData[f.id] !== undefined ? prevMonthData[f.id] : 0;
      const fundDiff = currentAmount - prevAmount;
      const fundPct = prevAmount !== 0 ? (fundDiff / prevAmount) * 100 : 0;
      
      let diffHtml = '';
      if (sortedMonths.length === 0 && prevAmount === 0 && currentAmount === 0) {
        diffHtml = `<span class="text-slate-400">เทียบเดือนก่อน: 0.00 บ.</span>`;
      } else {
        const isPos = fundDiff >= 0;
        const sign = isPos ? '+' : '';
        const colorClass = isPos ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold';
        diffHtml = `เทียบเดือนก่อน: <span class="${colorClass}">${sign}${formatNumber(fundDiff)} บ. (${sign}${fundPct.toFixed(2)}%)</span>`;
      }

      const unitsVal = f.units || 0;
      const calculatedNav = (unitsVal > 0 && currentAmount > 0) ? (currentAmount / unitsVal).toFixed(4) : '';
      
      const showNavAndUnits = (cat.id !== 'high' && cat.id !== 'ins');

      const safeFundName = escapeHtml(f.name);
      const safeFundSymbol = escapeHtml(f.symbol || f.name);

      html += `
        <div class="bg-slate-50 p-3.5 rounded-lg border border-slate-200 relative space-y-2">
          <div class="flex justify-between items-center">
            <label class="block text-xs font-bold text-slate-800 truncate">${safeFundName}</label>
            <span class="text-[10px] font-mono font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">${safeFundSymbol}</span>
          </div>
          
          ${showNavAndUnits ? `
          <div class="grid grid-cols-2 gap-2 bg-white p-2 rounded border border-slate-200">
            <div>
              <label class="block text-[10px] font-bold text-slate-500">NAV (บาท)</label>
              <input type="number" step="0.0001" id="entry-nav-${f.id}" value="${calculatedNav}" placeholder="0.0000"
                     oninput="autoCalcMonthlyFund('${f.id}', 'nav')"
                     class="w-full border border-slate-200 rounded p-1 text-xs font-mono font-semibold text-slate-700 outline-none">
            </div>
            <div>
              <label class="block text-[10px] font-bold text-slate-500">จำนวนหน่วย</label>
              <input type="number" step="0.0001" id="entry-units-${f.id}" value="${unitsVal || ''}" placeholder="0.0000"
                     oninput="autoCalcMonthlyFund('${f.id}', 'units')"
                     class="w-full border border-slate-200 rounded p-1 text-xs font-mono font-semibold text-slate-700 outline-none">
            </div>
          </div>
          ` : ''}

          <div>
            <label class="block text-[10px] font-bold text-blue-700">รวมมูลค่าทั้งหมด (บาท)</label>
            <input type="text" inputmode="decimal" id="entry-${f.id}" value="${displayVal}" placeholder="0.00" 
                   oninput="autoCalcMonthlyFund('${f.id}', 'total')"
                   onblur="this.value = formatNumber(parseLocalNumber(this.value))"
                   onfocus="this.select()"
                   class="w-full p-2 border border-blue-300 bg-blue-50/50 rounded outline-none focus:border-blue-500 text-sm font-mono font-bold text-blue-900 text-right transition-all">
          </div>

          <div class="text-[11px] mt-1 font-mono flex justify-between items-center text-slate-500" id="fund-diff-${f.id}">
            ${diffHtml}
          </div>

          <div id="save-indicator-${f.id}" class="absolute top-1 right-2 text-emerald-500 text-xs opacity-0 transition-opacity duration-300">
            <i class="fa-solid fa-check-circle"></i>
          </div>
        </div>`;
    });
    html += `</div></div>`;
    container.innerHTML += html;
  });

  updateEntryTotals();
  setEntryStatus(renderUsingCarryForward ? `<i class="fa-solid fa-info-circle mr-1"></i> โหมดแก้ไข (ข้อมูลยังไม่ถูกบันทึก)` : `<i class="fa-solid fa-check mr-1"></i> ข้อมูลในระบบล่าสุด`);
}

function updateEntryTotals() {
  let total = 0;
  const catTotals = { high: 0, med: 0, low: 0, ins: 0 };
  (db.funds || []).forEach(f => {
    const el = document.getElementById(`entry-${f.id}`);
    const val = el ? parseLocalNumber(el.value) : 0;
    if (catTotals[f.catId] !== undefined) catTotals[f.catId] += val;
    total += val;
  });

  const totalEl = document.getElementById('entry-month-total');
  if(totalEl) totalEl.innerText = '฿' + formatNumber(total);
  Object.keys(catTotals).forEach(cat => {
    const e = document.getElementById(`entry-cat-total-${cat}`);
    if(e) e.innerText = '฿' + formatNumber(catTotals[cat]);
  });

  const currentMonth = activeEntryMonth || getCurrentMonth();
  const sortedMonths = Object.keys(db.records || {}).filter(m => m < currentMonth).sort();
  let prevTotal = 0;
  let prevData = {};
  
  if (sortedMonths.length > 0) {
    const prevMonth = sortedMonths[sortedMonths.length - 1];
    prevData = db.records[prevMonth] || {};
    (db.funds || []).forEach(f => {
      prevTotal += (prevData[f.id] || 0);
    });
  }

  const diffEl = document.getElementById('entry-month-diff');
  if (diffEl) {
    if (prevTotal === 0 && sortedMonths.length === 0) {
      diffEl.innerHTML = `<span class="text-slate-300">เทียบเดือนก่อน: ไม่มีข้อมูล</span>`;
    } else {
      const diff = total - prevTotal;
      const pct = prevTotal !== 0 ? (diff / prevTotal) * 100 : 0;
      const isPos = diff >= 0;
      const sign = isPos ? '+' : '';
      const colorClass = isPos ? 'text-emerald-300 font-bold' : 'text-rose-300 font-bold';
      diffEl.innerHTML = `เทียบเดือนก่อน: <span class="${colorClass}">${sign}${formatNumber(diff)} บาท (${sign}${pct.toFixed(2)}%)</span>`;
    }
  }

  (db.funds || []).forEach(f => {
    const el = document.getElementById(`entry-${f.id}`);
    const currentAmount = el ? parseLocalNumber(el.value) : 0;
    const prevAmount = prevData[f.id] !== undefined ? prevData[f.id] : 0;
    const fundDiff = currentAmount - prevAmount;
    const fundPct = prevAmount !== 0 ? (fundDiff / prevAmount) * 100 : 0;
    const diffContainer = document.getElementById(`fund-diff-${f.id}`);

    if (diffContainer) {
      if (sortedMonths.length === 0 && prevAmount === 0 && currentAmount === 0) {
        diffContainer.innerHTML = `<span class="text-slate-400">เทียบเดือนก่อน: 0.00 บ.</span>`;
      } else {
        const isPos = fundDiff >= 0;
        const sign = isPos ? '+' : '';
        const colorClass = isPos ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold';
        diffContainer.innerHTML = `เทียบเดือนก่อน: <span class="${colorClass}">${sign}${formatNumber(fundDiff)} บ. (${sign}${fundPct.toFixed(2)}%)</span>`;
      }
    }
  });
}

function setEntryStatus(html) {
  const statusEl = document.getElementById('entry-status-text');
  if(statusEl) statusEl.innerHTML = html;
}

function scheduleAutoSave(fundId, valStr) {
  entryDirty = true;
  setEntryStatus(`<i class="fa-solid fa-pen mr-1"></i> กำลังพิมพ์...`);
  updateEntryTotals();
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    saveEntryMonth(activeEntryMonth, { showToastFlag: true });
    const indicator = document.getElementById(`save-indicator-${fundId}`);
    if (indicator) {
      indicator.classList.remove('opacity-0');
      setTimeout(() => indicator.classList.add('opacity-0'), 1500);
    }
  }, 800);
}

function saveEntryMonth(month, { showToastFlag = true, silent = false } = {}) {
  if (!month || !db.funds || db.funds.length === 0) return false;
  if (!db.records) db.records = {};
  if (!db.records[month]) db.records[month] = {};
  
  db.funds.forEach(f => {
    const input = document.getElementById(`entry-${f.id}`);
    if (input) db.records[month][f.id] = parseLocalNumber(input.value);
  });
  saveDB();

  if (month === activeEntryMonth) {
    entryDirty = false;
    renderUsingCarryForward = false;
    const warning = document.getElementById('entry-carry-forward-warning');
    if (warning) warning.classList.add('hidden');
  }

  if (!silent) {
    updateEntryTotals();
    setEntryStatus(`สถานะ: บันทึกล่าสุด ${new Date().toLocaleTimeString('th-TH')}`);
    if (showToastFlag) showToast('บันทึกอัตโนมัติแล้ว');
  }
  return true;
}

function saveMonthlyData(ev) {
  const mInput = document.getElementById('entry-month');
  const month = activeEntryMonth || (mInput ? mInput.value : getCurrentMonth());
  const ok = saveEntryMonth(month, { showToastFlag: false });
  if (!ok) return;
  entryDirty = false;
  showToast('บันทึกข้อมูลแล้ว');

  const btn = ev?.currentTarget;
  if (!btn) return;
  const originalText = btn.innerHTML;
  btn.innerHTML = `<i class="fa-solid fa-check mr-2"></i> บันทึกสำเร็จ!`;
  btn.classList.replace('bg-blue-600', 'bg-emerald-500');
  setTimeout(() => {
    btn.innerHTML = originalText;
    btn.classList.replace('bg-emerald-500', 'bg-blue-600');
  }, 2000);
}

// ================= COMPARE MODULE =================
function getAvailableYears() {
  const years = new Set(Object.keys(db.records || {}).map(m => m.split('-')[0]));
  return Array.from(years).sort().reverse();
}

function getLatestMonthDataForYear(year) {
  const monthsInYear = Object.keys(db.records || {}).filter(m => m.startsWith(year)).sort();
  if (monthsInYear.length === 0) return null;
  const latestMonth = monthsInYear[monthsInYear.length - 1];
  return { month: latestMonth, data: db.records[latestMonth] };
}

function calculateCategoryTotal(dataObj, catId) {
  if (!dataObj) return 0;
  const fundsInCat = (db.funds || []).filter(f => f.catId === catId).map(f => f.id);
  return fundsInCat.reduce((sum, fId) => sum + (dataObj[fId] || 0), 0);
}

function initCompareTab() {
  const years = getAvailableYears();
  const y1Select = document.getElementById('comp-year1');
  const y2Select = document.getElementById('comp-year2');
  if(!y1Select || !y2Select) return;
  
  y1Select.innerHTML = ''; y2Select.innerHTML = '';
  if (years.length === 0) {
    y1Select.innerHTML = '<option value="">ไม่มีข้อมูล</option>';
    y2Select.innerHTML = '<option value="">ไม่มีข้อมูล</option>';
  } else {
    years.forEach(y => {
      y1Select.innerHTML += `<option value="${y}">${y}</option>`;
      y2Select.innerHTML += `<option value="${y}">${y}</option>`;
    });
    if (years.length > 1) { y1Select.value = years[1]; y2Select.value = years[0]; } 
    else { y1Select.value = years[0]; y2Select.value = years[0]; }
  }
  renderCompareDashboard();

  const allMonths = Object.keys(db.records || {}).sort();
  const m1Input = document.getElementById('mcomp-month1');
  const m2Input = document.getElementById('mcomp-month2');
  
  if(m1Input && m2Input) {
    if (allMonths.length >= 2) {
      m1Input.value = allMonths[allMonths.length - 2];
      m2Input.value = allMonths[allMonths.length - 1];
    } else if (allMonths.length === 1) {
      m1Input.value = allMonths[0];
      m2Input.value = allMonths[0];
    } else {
      m1Input.value = getCurrentMonth();
      m2Input.value = getCurrentMonth();
    }
  }
  renderMonthCompareDashboard();
}

function renderCompareDashboard() {
  const y1El = document.getElementById('comp-year1');
  const y2El = document.getElementById('comp-year2');
  if(!y1El || !y2El) return;
  const y1 = y1El.value;
  const y2 = y2El.value;
  if (!y1 || !y2) return;
  
  const data1 = getLatestMonthDataForYear(y1);
  const data2 = getLatestMonthDataForYear(y2);
  let total1 = 0, total2 = 0;
  const catTotals = { high: [0, 0], med: [0, 0], low: [0, 0], ins: [0, 0] };

  Object.keys(db.categories || {}).forEach(catId => {
    const val1 = calculateCategoryTotal(data1 ? data1.data : null, catId);
    const val2 = calculateCategoryTotal(data2 ? data2.data : null, catId);
    catTotals[catId] = [val1, val2];
    total1 += val1; total2 += val2;
  });

  const totalValEl = document.getElementById('comp-total-val');
  if(totalValEl) totalValEl.innerText = '฿' + formatNumber(total2);
  
  updateDiffElement('comp-total-diff', 'comp-total-pct', total2, total1, true);
  const monthText1 = data1 ? data1.month : 'ไม่มีข้อมูล';
  const monthText2 = data2 ? data2.month : 'ไม่มีข้อมูล';
  
  const summaryTextEl = document.getElementById('comp-summary-text');
  if(summaryTextEl) summaryTextEl.innerText = `เทียบข้อมูล ณ ${monthText2} กับ ${monthText1}`;

  Object.keys(db.categories || {}).forEach(catId => {
    const catTextEl = document.getElementById(`comp-cat-${catId}`);
    if(catTextEl) catTextEl.innerText = '฿' + formatNumber(catTotals[catId][1]);
    
    const diff = catTotals[catId][1] - catTotals[catId][0];
    const pct = catTotals[catId][0] !== 0 ? (diff / catTotals[catId][0]) * 100 : 0;
    const isPos = diff >= 0;
    const el = document.getElementById(`comp-diff-${catId}`);
    if(el) {
      el.innerText = `${isPos ? '+' : ''}${formatNumber(diff)} บาท (${pct.toFixed(2)}%)`;
      el.className = `text-xs mt-1 font-bold ${isPos ? 'text-emerald-500' : 'text-rose-500'}`;
    }
  });
}

function renderMonthCompareDashboard() {
  const m1El = document.getElementById('mcomp-month1');
  const m2El = document.getElementById('mcomp-month2');
  if(!m1El || !m2El) return;
  const m1 = m1El.value;
  const m2 = m2El.value;
  if (!m1 || !m2) return;
  
  const data1 = (db.records && db.records[m1]) ? { month: m1, data: db.records[m1] } : null;
  const data2 = (db.records && db.records[m2]) ? { month: m2, data: db.records[m2] } : null;

  let total1 = 0, total2 = 0;
  const catTotals = { high: [0, 0], med: [0, 0], low: [0, 0], ins: [0, 0] };

  Object.keys(db.categories || {}).forEach(catId => {
    const val1 = calculateCategoryTotal(data1 ? data1.data : null, catId);
    const val2 = calculateCategoryTotal(data2 ? data2.data : null, catId);
    catTotals[catId] = [val1, val2];
    total1 += val1; total2 += val2;
  });

  const totalValEl = document.getElementById('mcomp-total-val');
  if(totalValEl) totalValEl.innerText = '฿' + formatNumber(total2);
  
  updateDiffElement('mcomp-total-diff', 'mcomp-total-pct', total2, total1, true);
  const monthText1 = data1 ? data1.month : 'ไม่มีข้อมูล';
  const monthText2 = data2 ? data2.month : 'ไม่มีข้อมูล';
  
  const summaryTextEl = document.getElementById('mcomp-summary-text');
  if(summaryTextEl) summaryTextEl.innerText = `เทียบข้อมูล ณ ${monthText2} กับ ${monthText1}`;

  Object.keys(db.categories || {}).forEach(catId => {
    const catTextEl = document.getElementById(`mcomp-cat-${catId}`);
    if(catTextEl) catTextEl.innerText = '฿' + formatNumber(catTotals[catId][1]);
    
    const diff = catTotals[catId][1] - catTotals[catId][0];
    const pct = catTotals[catId][0] !== 0 ? (diff / catTotals[catId][0]) * 100 : 0;
    const isPos = diff >= 0;
    const el = document.getElementById(`mcomp-diff-${catId}`);
    if(el) {
      el.innerText = `${isPos ? '+' : ''}${formatNumber(diff)} บาท (${pct.toFixed(2)}%)`;
      el.className = `text-xs mt-1 font-bold ${isPos ? 'text-emerald-500' : 'text-rose-500'}`;
    }
  });
}

function updateDiffElement(diffId, pctId, current, base, styleForDarkBg = false) {
  const diff = current - base;
  const pct = base !== 0 ? (diff / base) * 100 : 0;
  const isPos = diff >= 0;
  const diffEl = document.getElementById(diffId);
  const pctEl = document.getElementById(pctId);
  if(!diffEl || !pctEl) return;
  
  diffEl.innerText = `${isPos ? '+' : ''}${formatNumber(diff)} บาท`;
  pctEl.innerText = `${isPos ? '+' : ''}${pct.toFixed(2)}%`;
  if (styleForDarkBg) {
    const bgClass = isPos ? 'bg-white/20' : 'bg-rose-500/20'; 
    const textClass = isPos ? 'text-white' : 'text-rose-200';
    diffEl.className = `px-3 py-1.5 rounded-lg text-sm font-bold ${bgClass} ${textClass}`;
    pctEl.className = `px-3 py-1.5 rounded-lg text-sm font-bold ${bgClass} ${textClass}`;
  }
}

// ================= CHARTS MODULE =================
function getAllUniqueSubCategories() {
  let subs = new Set();
  (db.funds || []).forEach(f => {
    if(f.subCategories && f.subCategories.length > 0) {
      f.subCategories.forEach(s => subs.add(s.name.trim()));
    }
  });
  return Array.from(subs).sort();
}

function isAutoCostSavingsFund(fund) {
  if (!fund) return false;
  const name = (fund.name || '').toLowerCase();
  const symbol = (fund.symbol || '').toLowerCase();

  if (name.includes('esaving') || name.includes('e-saving') || name.includes('youtrip') ||
      symbol.includes('esaving') || symbol.includes('e-saving') || symbol.includes('youtrip')) {
    return false;
  }

  return name.includes('ออมทรัพย์') || name.includes('เผื่อเรียก') || 
         symbol.includes('ออมทรัพย์') || symbol.includes('เผื่อเรียก');
}

function calculateCumulativeCost(fundId, targetMonth) {
  const fund = (db.funds || []).find(f => f.id === fundId);
  
  if (fund && isAutoCostSavingsFund(fund)) {
    return (db.records && db.records[targetMonth]) ? (db.records[targetMonth][fundId] || 0) : 0;
  }

  let cumulativeCost = 0;
  (db.transactions || []).forEach(t => {
    if (!t.date) return;
    const txMonth = t.date.substring(0, 7); 
    if (t.fundId === fundId && txMonth <= targetMonth) {
      if (t.type === 'BUY') cumulativeCost += (t.amount || 0);
      if (t.type === 'SELL') cumulativeCost -= (t.amount || 0);
    }
  });
  return Math.max(0, cumulativeCost);
}

function initChartsTab() {
  const select = document.getElementById('chart-fund-select');
  if(!select) return;
  select.innerHTML = '';
  
  select.innerHTML += `<option value="ALL_PORTFOLIO">🌟 [พอร์ตสินทรัพย์รวมทั้งหมด]</option>`;
  select.innerHTML += `<option value="CAT_high">💧 [กลุ่มสินทรัพย์สภาพคล่องสูง]</option>`;
  select.innerHTML += `<option value="CAT_med">🔶 [กลุ่มสินทรัพย์สภาพคล่องปานกลาง]</option>`;
  select.innerHTML += `<option value="CAT_low">🔒 [กลุ่มสินทรัพย์สภาพคล่องต่ำ]</option>`;
  select.innerHTML += `<option value="CAT_ins">🛡️ [กลุ่มมูลค่าสะสมประกัน]</option>`;
  
  const uniqueSubs = getAllUniqueSubCategories();
  if(uniqueSubs.length > 0) {
    uniqueSubs.forEach(subName => {
      select.innerHTML += `<option value="SUBCAT_${escapeHtml(subName)}">📈 [แนวโน้มตามกลุ่มประเภทย่อย: ${escapeHtml(subName)}]</option>`;
    });
  }

  (db.funds || []).forEach(f => {
    select.innerHTML += `<option value="${f.id}">กองทุน: ${escapeHtml(f.name)} (${escapeHtml(f.symbol || '')})</option>`;
  });

  const months = Object.keys(db.records || {}).sort();
  const startEl = document.getElementById('chart-start');
  const endEl = document.getElementById('chart-end');
  if(startEl && endEl) {
    if (months.length > 0) {
      const startIndex = Math.max(0, months.length - 12);
      startEl.value = months[startIndex];
      endEl.value = months[months.length - 1];
    } else {
      startEl.value = getCurrentMonth();
      endEl.value = getCurrentMonth();
    }
  }
  renderIndividualChart();
}

function getMarketValueByFilter(filterVal, monthStr) {
  if (!db.records || !db.records[monthStr]) return 0;
  const record = db.records[monthStr];
  
  if (filterVal === 'ALL_PORTFOLIO') {
    return (db.funds || []).reduce((sum, f) => sum + (record[f.id] || 0), 0);
  } else if (filterVal.startsWith('CAT_')) {
    const catId = filterVal.replace('CAT_', '');
    const targetFunds = (db.funds || []).filter(f => f.catId === catId);
    return targetFunds.reduce((sum, f) => sum + (record[f.id] || 0), 0);
  } else if (filterVal.startsWith('SUBCAT_')) {
    const subName = filterVal.replace('SUBCAT_', '');
    let totalSubVal = 0;
    (db.funds || []).forEach(f => {
      const fundVal = record[f.id] || 0;
      if (f.subCategories && f.subCategories.length > 0) {
        const subMatch = f.subCategories.find(s => s.name.trim() === subName);
        if (subMatch) totalSubVal += fundVal * (subMatch.weight / 100);
      } else if (subName === 'ยังไม่ได้ระบุประเภทย่อย') {
        totalSubVal += fundVal;
      }
    });
    return totalSubVal;
  } else {
    return record[filterVal] || 0;
  }
}

function getCostBasisByFilter(filterVal, monthStr) {
  if (filterVal === 'ALL_PORTFOLIO') {
    return (db.funds || []).reduce((sum, f) => sum + calculateCumulativeCost(f.id, monthStr), 0);
  } else if (filterVal.startsWith('CAT_')) {
    const catId = filterVal.replace('CAT_', '');
    const targetFunds = (db.funds || []).filter(f => f.catId === catId);
    return targetFunds.reduce((sum, f) => sum + calculateCumulativeCost(f.id, monthStr), 0);
  } else if (filterVal.startsWith('SUBCAT_')) {
    const subName = filterVal.replace('SUBCAT_', '');
    let totalSubCost = 0;
    (db.funds || []).forEach(f => {
      const fundCost = calculateCumulativeCost(f.id, monthStr);
      if (f.subCategories && f.subCategories.length > 0) {
        const subMatch = f.subCategories.find(s => s.name.trim() === subName);
        if (subMatch) totalSubCost += fundCost * (subMatch.weight / 100);
      } else if (subName === 'ยังไม่ได้ระบุประเภทย่อย') {
        totalSubCost += fundCost;
      }
    });
    return totalSubCost;
  } else {
    return calculateCumulativeCost(filterVal, monthStr);
  }
}

function monthToTotalMonths(monthStr) {
  if (!monthStr || !monthStr.includes('-')) return 0;
  const [year, month] = monthStr.split('-').map(Number);
  return (year || 0) * 12 + (month || 0);
}

function calculatePeriodReturns(filterId, endMonthStr) {
  const allMonths = Object.keys(db.records || {}).sort();
  if (!allMonths.includes(endMonthStr)) return null;

  const [endYear, endMonth] = endMonthStr.split('-').map(Number);
  
  const endMV = getMarketValueByFilter(filterId, endMonthStr) || 0;
  const endCost = getCostBasisByFilter(filterId, endMonthStr) || 0;
  const endProfit = endMV - endCost;

  const inceptionMonth = allMonths.find(m => {
    return getMarketValueByFilter(filterId, m) > 0 || getCostBasisByFilter(filterId, m) > 0;
  });

  if (!inceptionMonth) return null;

  const periods = [
    { key: '6m', name: 'ย้อนหลัง 6 เดือน', monthsBack: 6, isAnnualized: false },
    { key: '1y', name: 'ย้อนหลัง 1 ปี', monthsBack: 12, isAnnualized: false },
    { key: '2y', name: 'ย้อนหลัง 2 ปี', monthsBack: 24, isAnnualized: true },
    { key: '5y', name: 'ย้อนหลัง 5 ปี', monthsBack: 60, isAnnualized: true }
  ];

  const results = {};

  periods.forEach(p => {
    const targetTotalMonths = ((endYear || 0) * 12 + (endMonth || 0)) - p.monthsBack;
    const targetYear = Math.floor((targetTotalMonths - 1) / 12);
    const targetM = targetTotalMonths - (targetYear * 12);
    const targetMonthStr = `${targetYear}-${String(targetM).padStart(2, '0')}`;

    if (targetMonthStr < inceptionMonth) {
      results[p.key] = { returnPct: null, matchedMonth: null, isAnnualized: p.isAnnualized, label: p.name };
      return;
    }

    let startMonthToUse = allMonths.filter(m => m <= targetMonthStr).pop() || inceptionMonth;
    
    const startMV = getMarketValueByFilter(filterId, startMonthToUse) || 0;
    const startCost = getCostBasisByFilter(filterId, startMonthToUse) || 0;
    const startProfit = startMV - startCost;

    const profitDiff = endProfit - startProfit;
    const avgCost = (startCost + endCost) / 2;

    if (avgCost <= 0 || isNaN(avgCost)) {
      results[p.key] = { returnPct: null, matchedMonth: startMonthToUse, isAnnualized: p.isAnnualized, label: p.name };
      return;
    }

    let returnPct = (profitDiff / avgCost) * 100;

    const actualMonthsDiff = monthToTotalMonths(endMonthStr) - monthToTotalMonths(startMonthToUse);
    const yearsDiff = actualMonthsDiff / 12;

    if (p.isAnnualized && yearsDiff > 1) {
      returnPct = returnPct / yearsDiff;
    }

    if (isNaN(returnPct) || !isFinite(returnPct)) {
      returnPct = null;
    }

    results[p.key] = {
      returnPct: returnPct,
      matchedMonth: startMonthToUse,
      isAnnualized: p.isAnnualized,
      label: p.name
    };
  });

  return results;
}

function renderIndividualChart() {
  const fundSelect = document.getElementById('chart-fund-select');
  const startEl = document.getElementById('chart-start');
  const endEl = document.getElementById('chart-end');
  if(!fundSelect || !startEl || !endEl) return;
  
  const filterId = fundSelect.value;
  const startM = startEl.value;
  const endM = endEl.value;
  const summaryContainer = document.getElementById('chart-latest-summary');
  const periodContainer = document.getElementById('chart-period-returns');
  
  if(summaryContainer) summaryContainer.innerHTML = '';
  if(periodContainer) periodContainer.innerHTML = '';
  if (!filterId || !startM || !endM) return;

  const allMonths = Object.keys(db.records || {}).sort();
  const filteredMonths = allMonths.filter(m => m >= startM && m <= endM);
  
  const labels = filteredMonths;
  const marketValues = [];
  const costValues = [];

  filteredMonths.forEach(m => {
    marketValues.push(getMarketValueByFilter(filterId, m));
    costValues.push(getCostBasisByFilter(filterId, m));
  });

  const startMV = marketValues[0] || 0;
  const latestMV = marketValues[marketValues.length - 1] || 0;
  const latestCost = costValues[costValues.length - 1] || 0;
  
  const periodDiff = latestMV - startMV;
  const periodDiffPct = startMV > 0 ? (periodDiff / startMV) * 100 : 0;
  const isPeriodPos = periodDiff >= 0;

  const latestProfit = latestMV - latestCost;
  
  let latestProfitPct = 0;
  if (latestCost > 0) {
    latestProfitPct = (latestProfit / latestCost) * 100;
  }
  if (isNaN(latestProfitPct) || !isFinite(latestProfitPct)) latestProfitPct = 0;

  if(summaryContainer) {
    summaryContainer.innerHTML = `
      <div class="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm text-center">
        <p class="text-xs font-bold text-slate-500 mb-1">การเปลี่ยนแปลงช่วงเวลา</p>
        <h4 class="text-lg font-black ${isPeriodPos ? 'text-emerald-600' : 'text-rose-600'}">${isPeriodPos ? '+' : ''}${formatNumber(periodDiff)}</h4>
        <p class="text-[10px] font-bold ${isPeriodPos ? 'text-emerald-600' : 'text-rose-600'} mt-0.5">${isPeriodPos ? '+' : ''}${periodDiffPct.toFixed(2)}%</p>
      </div>
      <div class="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm text-center">
        <p class="text-xs font-bold text-blue-600 mb-1">มูลค่าปัจจุบัน (${endM})</p>
        <h4 class="text-lg font-black text-slate-800">฿${formatNumber(latestMV)}</h4>
      </div>
      <div class="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm text-center">
        <p class="text-xs font-bold text-slate-500 mb-1">เงินลงทุนสะสม (ต้นทุน)</p>
        <h4 class="text-lg font-black text-slate-800">฿${formatNumber(latestCost)}</h4>
      </div>
      <div class="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm text-center">
        <p class="text-xs font-bold text-slate-600 mb-1">ผลกำไรรวม (บาท)</p>
        <h4 class="text-lg font-black ${latestProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}">${latestProfit >= 0 ? '+' : ''}${formatNumber(latestProfit)}</h4>
      </div>
      <div class="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm text-center">
        <p class="text-xs font-bold text-slate-600 mb-1">คิดเป็นเปอร์เซ็นต์</p>
        <h4 class="text-lg font-black ${latestProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}">${latestProfit >= 0 ? '+' : ''}${latestProfitPct.toFixed(2)}%</h4>
      </div>
    `;
  }

  if (periodContainer && endM) {
    const periodData = calculatePeriodReturns(filterId, endM);

    if (periodData) {
      ['6m', '1y', '2y', '5y'].forEach(key => {
        const item = periodData[key];
        let valText = 'N/A';
        let colorClass = 'text-slate-400';
        let noteText = 'ไม่มีข้อมูลในระยะเวลา';

        if (item && item.returnPct !== null && !isNaN(item.returnPct) && isFinite(item.returnPct)) {
          const isPos = item.returnPct >= 0;
          valText = `${isPos ? '+' : ''}${item.returnPct.toFixed(2)}%`;
          colorClass = isPos ? 'text-emerald-600' : 'text-rose-600';
          noteText = `เทียบข้อมูล ณ ${item.matchedMonth}`;
        }

        periodContainer.innerHTML += `
          <div class="bg-slate-50/80 p-3 rounded-xl border border-slate-200 shadow-sm text-center">
            <p class="text-[11px] font-bold text-slate-600 mb-0.5">${item ? item.label : ''} ${item && item.isAnnualized ? '<span class="text-[9px] text-blue-600 font-normal">(ต่อปี)</span>' : ''}</p>
            <h4 class="text-base font-black ${colorClass}">${valText}</h4>
            <p class="text-[9px] text-slate-400 mt-0.5 truncate">${noteText}</p>
          </div>
        `;
      });
    }
  }

  const canvas = document.getElementById('individualChart');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  if (myChart) myChart.destroy();

  myChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'มูลค่าปัจจุบัน (Current Market Value)',
          data: marketValues,
          borderColor: CHART_COLORS[0].border,
          backgroundColor: 'transparent',
          borderWidth: 3,
          pointRadius: 4,
          pointBackgroundColor: '#fff',
          fill: false,
          tension: 0.15
        },
        {
          label: 'เงินลงทุนสะสม (Cost Basis)',
          data: costValues,
          borderColor: CHART_COLORS[1].border,
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderDash: [5, 5],
          pointRadius: 4,
          pointBackgroundColor: '#fff',
          fill: false,
          tension: 0.15
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 20 } },
      plugins: { legend: { position: 'top', labels: { usePointStyle: true, boxWidth: 6 } } },
      scales: {
        y: { ticks: { callback: function (value) { if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M'; if (value >= 1000) return (value / 1000).toFixed(0) + 'k'; return value; } } }
      }
    }
  });

  renderAnnualPerformanceTable(filterId);
}

function renderAnnualPerformanceTable(filterId) {
  const tbody = document.getElementById('chart-annual-returns-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  const currentYear = new Date().getFullYear();

  for (let i = 0; i < 5; i++) {
    const year = currentYear - i;
    const monthsInYear = Object.keys(db.records || {}).filter(m => m.startsWith(year.toString())).sort();
    
    if (monthsInYear.length === 0) {
      tbody.innerHTML += `
        <tr class="border-b border-slate-100 bg-slate-50/30 text-slate-400">
          <td class="p-3 font-bold">${year}</td>
          <td colspan="4" class="p-3 text-center italic text-slate-300">ไม่มีข้อมูลบันทึกในปีนี้</td>
        </tr>`;
      continue;
    }

    const targetMonth = monthsInYear[monthsInYear.length - 1]; 
    const mv = getMarketValueByFilter(filterId, targetMonth) || 0;
    const cost = getCostBasisByFilter(filterId, targetMonth) || 0;
    const profit = mv - cost;
    
    let profitPct = 0;
    if (cost > 0) {
      profitPct = (profit / cost) * 100;
    }
    if (isNaN(profitPct) || !isFinite(profitPct)) profitPct = 0;

    const isPos = profit >= 0;
    const colorClass = isPos ? 'text-emerald-600' : 'text-rose-600';

    tbody.innerHTML += `
      <tr class="border-b border-slate-100 hover:bg-slate-50/50">
        <td class="p-3 font-bold text-slate-900">${year} <span class="text-[10px] font-normal text-slate-400">(${targetMonth})</span></td>
        <td class="p-3 text-right font-mono">฿${formatNumber(mv)}</td>
        <td class="p-3 text-right font-mono text-slate-500">฿${formatNumber(cost)}</td>
        <td class="p-3 text-right font-mono font-bold ${colorClass}">${isPos ? '+' : ''}${formatNumber(profit)}</td>
        <td class="p-3 text-right font-mono font-bold ${colorClass}">${isPos ? '+' : ''}${profitPct.toFixed(2)}%</td>
      </tr>`;
  }
}

// ================= ALLOCATION MODULE =================
function initAllocationTab() {
  const sortedMonths = Object.keys(db.records || {}).sort();
  const monthSelect = document.getElementById('alloc-month-select');
  if(monthSelect) {
    monthSelect.innerHTML = '';
    if (sortedMonths.length === 0) {
      monthSelect.innerHTML = `<option value="${getCurrentMonth()}">${getCurrentMonth()}</option>`;
    } else {
      sortedMonths.forEach(m => {
        monthSelect.innerHTML += `<option value="${m}">${m}</option>`;
      });
      monthSelect.value = sortedMonths[sortedMonths.length - 1];
    }
  }
  
  let uniqueSubs = getAllUniqueSubCategories();
  if((db.funds || []).some(f => !f.subCategories || f.subCategories.length === 0)) {
    uniqueSubs.push('ยังไม่ได้ระบุประเภทย่อย');
  }

  if (selectedSubCatsForCompare.length === 0) {
    selectedSubCatsForCompare = [...uniqueSubs];
  } else {
    selectedSubCatsForCompare = selectedSubCatsForCompare.filter(s => uniqueSubs.includes(s));
    if(selectedSubCatsForCompare.length === 0) selectedSubCatsForCompare = [...uniqueSubs];
  }

  renderSubCatCheckboxes(uniqueSubs);
  renderAllocationTargetInputs();
  calculateAllocation(false);
}

function renderSubCatCheckboxes(uniqueSubs) {
  const container = document.getElementById('alloc-subcat-checkboxes');
  if(!container) return;
  container.innerHTML = '';

  if (uniqueSubs.length === 0) {
    container.innerHTML = `<span class="text-xs text-slate-400 italic">ไม่มีข้อมูลประเภทย่อยในระบบ</span>`;
    return;
  }

  uniqueSubs.forEach(sub => {
    const isChecked = selectedSubCatsForCompare.includes(sub);
    const safeSub = escapeHtml(sub);
    container.innerHTML += `
      <label class="flex items-center space-x-1.5 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-sm cursor-pointer hover:bg-slate-50 text-xs font-bold">
        <input type="checkbox" value="${safeSub}" ${isChecked ? 'checked' : ''} onchange="onSubCatFilterChange(this)" class="rounded text-blue-600 focus:ring-blue-500">
        <span class="text-slate-700">${safeSub}</span>
      </label>
    `;
  });
}

function onSubCatFilterChange(cb) {
  const val = cb.value;
  if(cb.checked) {
    if(!selectedSubCatsForCompare.includes(val)) selectedSubCatsForCompare.push(val);
  } else {
    selectedSubCatsForCompare = selectedSubCatsForCompare.filter(s => s !== val);
  }
  renderAllocationTargetInputs();
  calculateAllocation(false);
}

function toggleSelectAllSubCats(isSelectAll) {
  let uniqueSubs = getAllUniqueSubCategories();
  if((db.funds || []).some(f => !f.subCategories || f.subCategories.length === 0)) uniqueSubs.push('ยังไม่ได้ระบุประเภทย่อย');
  
  selectedSubCatsForCompare = isSelectAll ? [...uniqueSubs] : [];
  renderSubCatCheckboxes(uniqueSubs);
  renderAllocationTargetInputs();
  calculateAllocation(false);
}

function renderAllocationTargetInputs() {
  const container = document.getElementById('alloc-target-inputs-container');
  if(!container) return;
  container.innerHTML = '';

  if(selectedSubCatsForCompare.length === 0) {
    container.innerHTML = `<p class="text-xs text-rose-500 font-bold italic">⚠️ กรุณาเลือกประเภทย่อยอย่างน้อย 1 รายการที่ตัวกรองด้านบนเพื่อเปรียบเทียบ</p>`;
    return;
  }

  selectedSubCatsForCompare.forEach((subName, index) => {
    let savedWeight = (db.allocationSettings || {})[subName];
    if (savedWeight === undefined) {
      savedWeight = index === 0 ? 100 : 0; 
    }
    const safeSubName = escapeHtml(subName);

    container.innerHTML += `
      <div>
        <label class="block text-xs font-bold text-slate-700 mb-1">${safeSubName} (%)</label>
        <input type="number" id="alloc-target-${safeSubName}" data-subname="${safeSubName}" value="${savedWeight}" min="0" max="100" 
               oninput="calculateAllocation(true)" class="w-full p-2 border border-slate-300 rounded-lg text-sm font-bold outline-none subcat-target-input">
      </div>
    `;
  });
}

function addNewSubCatTargetPrompt() {
  const name = prompt('ป้อนชื่อประเภทย่อยใหม่ที่ต้องการกำหนดเป้าหมายล่วงหน้า:');
  if(!name || name.trim() === '') return;
  const subName = name.trim();
  if (!db.allocationSettings) db.allocationSettings = {};
  db.allocationSettings[subName] = 0;
  if(!selectedSubCatsForCompare.includes(subName)) selectedSubCatsForCompare.push(subName);
  saveDB();
  
  let uniqueSubs = getAllUniqueSubCategories();
  if((db.funds || []).some(f => !f.subCategories || f.subCategories.length === 0)) uniqueSubs.push('ยังไม่ได้ระบุประเภทย่อย');
  if(!uniqueSubs.includes(subName)) uniqueSubs.push(subName);

  renderSubCatCheckboxes(uniqueSubs);
  renderAllocationTargetInputs();
  calculateAllocation(true);
}

function calculateAllocation(shouldSaveState = false) {
  const inputs = document.querySelectorAll('.subcat-target-input');
  let targets = {};
  let sumTargets = 0;

  inputs.forEach(input => {
    const subName = input.getAttribute('data-subname');
    const weight = parseFloat(input.value) || 0;
    targets[subName] = weight;
    sumTargets += weight;
  });

  if (shouldSaveState) {
    if (!db.allocationSettings) db.allocationSettings = {};
    inputs.forEach(input => {
      const subName = input.getAttribute('data-subname');
      db.allocationSettings[subName] = parseFloat(input.value) || 0;
    });
    saveDB();
  }

  const badge = document.getElementById('alloc-sum-badge');
  const errorMsg = document.getElementById('alloc-error-msg');
  if(badge) badge.innerText = sumTargets + '%';
  
  if(badge && errorMsg) {
    if (sumTargets !== 100 && inputs.length > 0) {
      badge.className = "px-2.5 py-1 text-xs font-extrabold rounded-lg bg-rose-500 text-white";
      errorMsg.classList.remove('hidden');
    } else {
      badge.className = "px-2.5 py-1 text-xs font-extrabold rounded-lg bg-emerald-500 text-white";
      errorMsg.classList.add('hidden');
    }
  }

  const monthSelect = document.getElementById('alloc-month-select');
  const targetMonth = monthSelect ? monthSelect.value : getCurrentMonth();

  let totalWealthInGroup = 0;
  let currentSubTotals = {};

  if (db.records && db.records[targetMonth]) {
    (db.funds || []).forEach(f => {
      const fundVal = db.records[targetMonth][f.id] || 0;

      if(f.subCategories && f.subCategories.length > 0) {
        f.subCategories.forEach(sub => {
          if (selectedSubCatsForCompare.includes(sub.name)) {
            if(!currentSubTotals[sub.name]) currentSubTotals[sub.name] = 0;
            const portion = fundVal * (sub.weight / 100);
            currentSubTotals[sub.name] += portion;
            totalWealthInGroup += portion;
          }
        });
      } else {
        if (selectedSubCatsForCompare.includes('ยังไม่ได้ระบุประเภทย่อย')) {
          if(!currentSubTotals['ยังไม่ได้ระบุประเภทย่อย']) currentSubTotals['ยังไม่ได้ระบุประเภทย่อย'] = 0;
          currentSubTotals['ยังไม่ได้ระบุประเภทย่อย'] += fundVal;
          totalWealthInGroup += fundVal;
        }
      }
    });
  }

  const tableBody = document.getElementById('alloc-table-body');
  if(tableBody) tableBody.innerHTML = '';
  const adviceBox = document.getElementById('alloc-advice-box');
  if(adviceBox) adviceBox.innerHTML = '';

  let overweightAdvice = [];
  let underweightAdvice = [];

  selectedSubCatsForCompare.forEach(subName => {
    const cVal = currentSubTotals[subName] || 0;
    const targetPct = targets[subName] || 0;
    const currentPct = totalWealthInGroup > 0 ? (cVal / totalWealthInGroup) * 100 : 0;
    
    const diffPct = currentPct - targetPct;
    const idealValue = totalWealthInGroup * (targetPct / 100);
    const diffCash = cVal - idealValue;

    const isOver = diffPct > 0;
    const formattedDiffPct = (diffPct >= 0 ? '+' : '') + diffPct.toFixed(1) + '%';
    const formattedDiffCash = (diffCash >= 0 ? '+' : '') + formatNumber(diffCash) + ' บ.';
    const safeSubName = escapeHtml(subName);

    if(tableBody) {
      tableBody.innerHTML += `
        <tr class="border-b border-slate-100 hover:bg-slate-50">
          <td class="p-3 font-bold text-slate-800">${safeSubName}</td>
          <td class="p-3 text-right font-mono">${targetPct}%</td>
          <td class="p-3 text-right font-mono text-slate-900">฿${formatNumber(cVal)}</td>
          <td class="p-3 text-right font-mono">${currentPct.toFixed(1)}%</td>
          <td class="p-3 text-right font-mono font-bold ${Math.abs(diffPct) < 1.5 ? 'text-slate-500' : isOver ? 'text-amber-500' : 'text-rose-500'}">${formattedDiffPct}</td>
          <td class="p-3 text-right font-mono font-bold ${Math.abs(diffCash) < 10 ? 'text-slate-500' : isOver ? 'text-amber-500' : 'text-rose-500'}">${formattedDiffCash}</td>
        </tr>
      `;
    }

    if (totalWealthInGroup > 0 && Math.abs(diffPct) >= 1.0) {
      if (isOver) {
        overweightAdvice.push(`🔴 <b>${safeSubName}</b> มีสัดส่วนล้นในกลุ่มเปรียบเทียบอยู่ <b>${diffPct.toFixed(1)}%</b> (คิดเป็นเงินเกินประมาณ <b>${formatNumber(Math.abs(diffCash))} บาท</b>)`);
      } else {
        underweightAdvice.push(`🟢 <b>${safeSubName}</b> มีสัดส่วนขาดเป้าในกลุ่มอยู่ <b>${Math.abs(diffPct).toFixed(1)}%</b> (ควรเติมเงินเพิ่มประมาณ <b>${formatNumber(Math.abs(diffCash))} บาท</b>)`);
      }
    }
  });

  if(adviceBox) {
    if (selectedSubCatsForCompare.length === 0) {
      adviceBox.innerHTML = `<li>⚠️ กรุณาเลือกเปิดใช้ตัวกรองประเภทย่อยด้านบนเพื่อเปรียบเทียบพอร์ตการลงทุน</li>`;
    } else if (totalWealthInGroup === 0) {
      adviceBox.innerHTML = `<li>⚠️ ไม่พบข้อมูลยอดเงินของกลุ่มประเภทย่อยที่เลือกในรอบเดือน <b>${targetMonth}</b></li>`;
    } else if (overweightAdvice.length === 0 && underweightAdvice.length === 0) {
      adviceBox.innerHTML = `<li>🎉 สมดุลดีเยี่ยม! กลุ่มประเภทย่อยที่คุณเลือกเปรียบเทียบกระจายสัดส่วนได้ตรงเป้าเป๊ะ 100% ครบถ้วนแล้วครับ</li>`;
    } else {
      overweightAdvice.forEach(adv => adviceBox.innerHTML += `<li>${adv}</li>`);
      underweightAdvice.forEach(adv => adviceBox.innerHTML += `<li>${adv}</li>`);
    }
  }

  const donutCanvas = document.getElementById('allocationChart');
  if(donutCanvas) {
    const ctxDonut = donutCanvas.getContext('2d');
    if (allocChart) allocChart.destroy();
    
    const donutLabels = selectedSubCatsForCompare;
    const actualData = selectedSubCatsForCompare.map(sub => totalWealthInGroup > 0 ? ((currentSubTotals[sub] || 0) / totalWealthInGroup) * 100 : 0);
    const targetData = selectedSubCatsForCompare.map(sub => targets[sub] || 0);

    allocChart = new Chart(ctxDonut, {
      type: 'doughnut',
      data: {
        labels: donutLabels,
        datasets: [
          {
            label: 'สัดส่วนจริงในกลุ่ม (%)',
            data: actualData,
            backgroundColor: SUB_COLORS,
            borderColor: '#ffffff',
            borderWidth: 2,
            weight: 1.5
          },
          {
            label: 'เป้าหมายในกลุ่ม (%)',
            data: targetData,
            backgroundColor: SUB_COLORS.map(c => c + '33'), 
            borderColor: SUB_COLORS,
            borderWidth: 1,
            weight: 0.8
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: { boxWidth: 12, font: { weight: 'bold', size: 11 } }
          }
        },
        cutout: '50%'
      }
    });
  }

  const sortedMonths = Object.keys(db.records || {}).sort();
  renderPortfolioTrendChart(sortedMonths);
}

function renderPortfolioTrendChart(monthsArray) {
  const lineCanvas = document.getElementById('portfolioTrendChart');
  if(!lineCanvas) return;
  const ctxLine = lineCanvas.getContext('2d');
  if (trendChart) trendChart.destroy();

  let datasets = [];
  
  selectedSubCatsForCompare.forEach((subName, index) => {
    let subDataTrend = [];
    monthsArray.forEach(m => {
      let monthVal = 0;
      (db.funds || []).forEach(f => {
        const val = (db.records && db.records[m]) ? db.records[m][f.id] || 0 : 0;
        if (f.subCategories && f.subCategories.length > 0) {
          const match = f.subCategories.find(s => s.name.trim() === subName);
          if(match) monthVal += val * (match.weight / 100);
        } else if (subName === 'ยังไม่ได้ระบุประเภทย่อย') {
          monthVal += val;
        }
      });
      subDataTrend.push(monthVal);
    });

    datasets.push({
      label: subName,
      data: subDataTrend,
      borderColor: SUB_COLORS[index % SUB_COLORS.length],
      borderWidth: 2.5,
      pointRadius: 2,
      backgroundColor: 'transparent',
      fill: false,
      tension: 0.1
    });
  });

  trendChart = new Chart(ctxLine, {
    type: 'line',
    data: {
      labels: monthsArray,
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'top', labels: { usePointStyle: true, boxWidth: 6, font: { weight: 'bold', size: 11 } } } },
      scales: { y: { ticks: { callback: function(value) { if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M'; if (value >= 1000) return (value / 1000).toFixed(0) + 'k'; return value; } } } }
    }
  });
}

// ================= RETIREMENT SIMULATOR MODULE =================
function calculateRetirement(shouldSaveState = false) {
  const sortedMonths = Object.keys(db.records || {}).sort();
  
  // ลำดับเดือน: ล่าสุด (latest), ก่อนหน้า (prev), ก่อนหน้าของก่อนหน้า (prevPrev)
  let latestMonth = sortedMonths.length > 0 ? sortedMonths[sortedMonths.length - 1] : null;
  let prevMonth = sortedMonths.length > 1 ? sortedMonths[sortedMonths.length - 2] : null;
  let prevPrevMonth = sortedMonths.length > 2 ? sortedMonths[sortedMonths.length - 3] : null;

  const getMonthTotal = (m) => {
    if (!m || !db.records || !db.records[m]) return 0;
    return (db.funds || []).reduce((sum, f) => sum + (db.records[m][f.id] || 0), 0);
  };

  let latestWealth = getMonthTotal(latestMonth);
  let prevWealth = getMonthTotal(prevMonth);
  let prevPrevWealth = getMonthTotal(prevPrevMonth);

  // คำนวณยอดเงินที่สะสมเพิ่มได้จริง
  let currentMonthSaved = latestWealth - prevWealth;
  let prevMonthSaved = prevWealth - prevPrevWealth;
  
  const currentAgeEl = document.getElementById('sim-current-age');
  const retireAgeEl = document.getElementById('sim-retire-age');
  const lifeExpectancyEl = document.getElementById('sim-life-expectancy');
  const inflationEl = document.getElementById('sim-inflation');
  if(!currentAgeEl || !retireAgeEl || !lifeExpectancyEl || !inflationEl) return;

  const currentAge = parseInt(currentAgeEl.value) || 0;
  const retireAge = parseInt(retireAgeEl.value) || 60;
  const lifeExpectancyYears = parseInt(lifeExpectancyEl.value) || 20;
  const inflationRate = parseFloat(inflationEl.value) || 0;
  
  const selectedRadio = document.querySelector('input[name="sim-lifestyle"]:checked');
  const baseExpensesPerMonth = selectedRadio ? parseFloat(selectedRadio.value) : 40000;

  if (shouldSaveState) {
    db.planningSettings = { currentAge: currentAge, retireAge: retireAge, lifeExpectancy: lifeExpectancyYears, inflation: inflationRate, lifestyle: selectedRadio ? selectedRadio.value : '40000' };
    saveDB();
  }

  const curWealthText = document.getElementById('sim-current-wealth');
  const asOfDateText = document.getElementById('sim-as-of-date');
  if(curWealthText) curWealthText.innerText = '฿' + formatNumber(latestWealth);
  if(asOfDateText) asOfDateText.innerText = `ข้อมูลล่าสุด ณ เดือน ${latestMonth || 'ไม่มีข้อมูล'}`;
  
  const yearsToRetire = Math.max(0, retireAge - currentAge);
  const inflationFactor = Math.pow(1 + (inflationRate / 100), yearsToRetire);
  const realValueAtRetire = latestWealth / (inflationFactor || 1);

  const futureWealthText = document.getElementById('sim-future-wealth');
  const inflationText = document.getElementById('sim-inflation-text');
  if(futureWealthText) futureWealthText.innerText = '฿' + formatNumber(realValueAtRetire);
  if(inflationText) inflationText.innerText = `หักผลกระทบเงินเฟ้อสะสมในอีก ${yearsToRetire} ปี`;

  let targetRetireWealthNeeded = 0;
  let runningYearlyExpense = baseExpensesPerMonth * 12 * inflationFactor; 
  
  for (let i = 0; i < lifeExpectancyYears; i++) {
    targetRetireWealthNeeded += runningYearlyExpense;
    runningYearlyExpense *= (1 + (inflationRate / 100)); 
  }
  
  const targetNeededText = document.getElementById('sim-target-needed');
  const targetDescText = document.getElementById('sim-target-desc');
  if(targetNeededText) targetNeededText.innerText = '฿' + formatNumber(targetRetireWealthNeeded);
  if(targetDescText) targetDescText.innerText = `สำหรับใช้ชีวิตครอบคลุม ${lifeExpectancyYears} ปีหลังเกษียณ`;

  // เป้าหมายที่ต้องออมต่อเดือนเดิม (คำนวณตั้งแต่วันนี้จากฐานยอดยังไม่รวมเดือนล่าสุด)
  let totalMonthsToRetire = yearsToRetire * 12;
  let monthlySavingRequired = 0;
  if (totalMonthsToRetire > 0) {
    let gapBase = Math.max(0, targetRetireWealthNeeded - prevWealth);
    monthlySavingRequired = gapBase / totalMonthsToRetire;
  }
  
  const monthlySavingText = document.getElementById('sim-monthly-saving-needed');
  const savingDescText = document.getElementById('sim-saving-desc');
  
  if(monthlySavingText && savingDescText) {
    if (latestWealth >= targetRetireWealthNeeded) {
      monthlySavingText.innerText = "฿0.00 / เดือน";
      savingDescText.innerText = "🎉 เงินออมสะสมทะลุเป้าหมายเกษียณเรียบร้อยแล้ว!";
      monthlySavingText.className = "text-2xl font-black text-emerald-600";
    } else if (totalMonthsToRetire === 0) {
      monthlySavingText.innerText = "฿0.00 / เดือน";
      savingDescText.innerText = "ถึงกำหนดอายุเกษียณที่ตั้งไว้แล้ว";
      monthlySavingText.className = "text-2xl font-black text-slate-500";
    } else {
      monthlySavingText.innerText = '฿' + formatNumber(monthlySavingRequired) + ' / เดือน';
      savingDescText.innerText = `ออมสม่ำเสมอเป็นเวลาอีก ${totalMonthsToRetire} เดือนต่อจากนี้`;
      monthlySavingText.className = "text-2xl font-black text-blue-600";
    }
  }

  // คำนวณเป้าหมาย "หลังจากเดือนนี้ ต้องเก็บอีกเดือนละเท่าไหร่"
  let remainingMonths = Math.max(1, totalMonthsToRetire - 1);
  let nextMonthlySavingRequired = 0;
  if (totalMonthsToRetire > 0) {
    let remainingGap = Math.max(0, targetRetireWealthNeeded - latestWealth);
    nextMonthlySavingRequired = remainingGap / remainingMonths;
  }

  // --- Render UI การเปรียบเทียบเป้าหมายการออม ---
  const monthTag = document.getElementById('sim-comp-month-tag');
  if (monthTag) monthTag.innerText = `ข้อมูลล่าสุด: ${latestMonth || '-'}`;

  const targetMonthlyEl = document.getElementById('sim-target-monthly-val');
  if (targetMonthlyEl) targetMonthlyEl.innerText = '฿' + formatNumber(monthlySavingRequired);

  const prevSavedEl = document.getElementById('sim-prev-month-saved');
  const prevLabelEl = document.getElementById('sim-prev-month-label');
  if (prevSavedEl) prevSavedEl.innerText = '฿' + formatNumber(prevMonthSaved);
  if (prevLabelEl && prevMonth) prevLabelEl.innerText = `ยอดออมจริง (${prevMonth})`;

  const currSavedEl = document.getElementById('sim-curr-month-saved');
  const currLabelEl = document.getElementById('sim-curr-month-label');
  if (currSavedEl) currSavedEl.innerText = '฿' + formatNumber(currentMonthSaved);
  if (currLabelEl && latestMonth) currLabelEl.innerText = `เงินที่สะสมเพิ่มได้จริง (${latestMonth})`;

  const nextNeededEl = document.getElementById('sim-next-monthly-needed');
  const nextDiffEl = document.getElementById('sim-next-monthly-diff');

  if (nextNeededEl) nextNeededEl.innerText = '฿' + formatNumber(nextMonthlySavingRequired);

  if (nextDiffEl) {
    let diffNeeded = nextMonthlySavingRequired - monthlySavingRequired;
    if (Math.abs(diffNeeded) < 1) {
      nextDiffEl.innerText = "(เท่ากับเป้าหมายเดิม)";
      nextDiffEl.className = "text-[10px] font-bold mt-0.5 text-slate-500";
    } else if (diffNeeded < 0) {
      nextDiffEl.innerText = `(ลดลง ฿${formatNumber(Math.abs(diffNeeded))} / เดือน 🎉)`;
      nextDiffEl.className = "text-[10px] font-bold mt-0.5 text-emerald-600";
    } else {
      nextDiffEl.innerText = `(ต้องเก็บเพิ่มอีก ฿${formatNumber(diffNeeded)} / เดือน ⚠️)`;
      nextDiffEl.className = "text-[10px] font-bold mt-0.5 text-rose-600";
    }
  }

  const compStatusBadge = document.getElementById('sim-comp-status-badge');
  const compStatusText = document.getElementById('sim-comp-status-text');
  
  if (compStatusBadge && compStatusText) {
    let diffTarget = currentMonthSaved - monthlySavingRequired;
    if (diffTarget >= 0) {
      compStatusBadge.className = "p-3 rounded-xl text-xs font-bold flex items-center space-x-2 bg-emerald-100 text-emerald-800";
      compStatusBadge.querySelector('i').className = "fa-solid fa-circle-check text-emerald-600";
      compStatusText.innerText = `เดือนล่าสุดออมได้เกินเป้าหมาย +฿${formatNumber(diffTarget)}`;
    } else {
      compStatusBadge.className = "p-3 rounded-xl text-xs font-bold flex items-center space-x-2 bg-amber-100 text-amber-800";
      compStatusBadge.querySelector('i').className = "fa-solid fa-triangle-exclamation text-amber-600";
      compStatusText.innerText = `เดือนล่าสุดออมขาดเป้าหมายไป -฿${formatNumber(Math.abs(diffTarget))}`;
    }
  }

  // คำนวณระยะเวลาเงินที่มีอยู่ (ปี/เดือน)
  let yearlyExpenseAtRetire = baseExpensesPerMonth * 12 * inflationFactor;
  let remainingWealth = latestWealth; 
  let yearsCount = 0;
  let monthsCount = 0;

  if (latestWealth > 0 && currentAge < retireAge) {
    while (remainingWealth >= yearlyExpenseAtRetire && yearsCount < 50) {
      remainingWealth -= yearlyExpenseAtRetire;
      yearlyExpenseAtRetire *= (1 + (inflationRate / 100)); 
      yearsCount++;
    }
    if (remainingWealth > 0 && yearlyExpenseAtRetire > 0) {
      monthsCount = Math.floor((remainingWealth / yearlyExpenseAtRetire) * 12);
    }
  }

  const resYearsText = document.getElementById('sim-result-years');
  if(resYearsText) {
    if (latestWealth === 0) {
      resYearsText.innerText = "0 ปี 0 เดือน";
      updateSimProgressBar(0, "กรุณาบันทึกยอดเงินในระบบก่อนทำการจำลอง");
    } else if (currentAge >= retireAge) {
      resYearsText.innerText = "ถึงวัยเกษียณแล้ว";
      updateSimProgressBar(100, "คุณเข้าสู่วัยเกษียณตามเกณฑ์แล้ว");
    } else {
      resYearsText.innerText = `${yearsCount} ปี ${monthsCount} เดือน`;
      const progressPct = targetRetireWealthNeeded > 0 ? Math.min(100, (latestWealth / targetRetireWealthNeeded) * 100) : 0;
      let statusMsg = "";
      if (progressPct < 25) statusMsg = "⚠️ เงินออมปัจจุบันยังน้อย แนะนำวางแผนออมเพิ่มด่วนครับ";
      else if (progressPct < 50) statusMsg = "ฐานเงินเริ่มตั้งตัวได้ดี แนะนำจัดพอร์ตให้เติบโตเพื่อสู้เงินเฟ้อ";
      else if (progressPct < 75) statusMsg = "👍 ยอดเยี่ยม! มีเงินรองรับเป้าหมายเกินครึ่งทางแล้ว";
      else if (progressPct < 100) statusMsg = "🚀 ใกล้ความจริงแล้ว! สินทรัพย์เข้าใกล้เป้าหมายอย่างมาก";
      else statusMsg = "🎉 ยอดเยี่ยมที่สุด! สินทรัพย์ปัจจุบันเพียงพอรองรับวัยเกษียณแล้ว";
      updateSimProgressBar(progressPct, statusMsg);
    }
  }
}

function updateSimProgressBar(pct, msg) {
  const bar = document.getElementById('sim-progress-bar');
  const txt = document.getElementById('sim-status-message');
  if(!bar || !txt) return;
  bar.style.width = pct + '%';
  txt.innerText = msg;
  if (pct < 30) bar.className = "bg-rose-500 h-full transition-all duration-500";
  else if (pct < 70) bar.className = "bg-amber-500 h-full transition-all duration-500";
  else bar.className = "bg-emerald-500 h-full transition-all duration-500";
}

function loadPlanningSettings() {
  if (db.planningSettings && Object.keys(db.planningSettings).length > 0) {
    setTimeout(() => {
      if(document.getElementById('sim-current-age')) document.getElementById('sim-current-age').value = db.planningSettings.currentAge || 41;
      if(document.getElementById('sim-retire-age')) document.getElementById('sim-retire-age').value = db.planningSettings.retireAge || 60;
      if(document.getElementById('sim-life-expectancy')) document.getElementById('sim-life-expectancy').value = db.planningSettings.lifeExpectancy || 20;
      if(document.getElementById('sim-inflation')) document.getElementById('sim-inflation').value = db.planningSettings.inflation || 2.5;
      if (db.planningSettings.lifestyle) {
        const radio = document.querySelector(`input[name="sim-lifestyle"][value="${db.planningSettings.lifestyle}"]`);
        if (radio) radio.checked = true;
      }
      calculateRetirement(false);
    }, 50);
  }
}

// ================= TRANSACTIONS MODULE =================
function initTransactionsTab() {
  const select = document.getElementById('tx-fund');
  if(!select) return;
  select.innerHTML = '';
  if (!db.funds || db.funds.length === 0) {
    select.innerHTML = '<option value="">-- ยังไม่มีรายชื่อกองทุน --</option>';
  } else {
    db.funds.forEach(f => { select.innerHTML += `<option value="${f.id}">${escapeHtml(f.name)} (${escapeHtml(f.symbol || '')})</option>`; });
  }

  const filterSelect = document.getElementById('tx-filter-select');
  if(!filterSelect) return;
  filterSelect.innerHTML = '<option value="ALL">-- แสดงทั้งหมด --</option>';
  (db.funds || []).forEach(f => { filterSelect.innerHTML += `<option value="${f.id}">${escapeHtml(f.name)} (${escapeHtml(f.symbol || '')})</option>`; });

  const today = new Date().toISOString().split('T')[0];
  const dateInput = document.getElementById('tx-date');
  const amountInput = document.getElementById('tx-amount');
  if(dateInput) dateInput.value = today;
  if(amountInput) amountInput.value = '';
  renderTransactionsTable();
}

function addTransaction() {
  const dateEl = document.getElementById('tx-date');
  const fundIdEl = document.getElementById('tx-fund');
  const typeEl = document.getElementById('tx-type');
  const amountEl = document.getElementById('tx-amount');
  if(!dateEl || !fundIdEl || !typeEl || !amountEl) return;

  const dateVal = dateEl.value;
  const fundIdVal = fundIdEl.value;
  const typeVal = typeEl.value;
  const amountVal = parseFloat(amountEl.value);

  if (!dateVal) return alert('กรุณาเลือกวันที่ทำรายการ');
  if (!fundIdVal) return alert('กรุณาเลือกกองทุน/บัญชี');
  if (isNaN(amountVal) || amountVal <= 0) return alert('กรุณาระบุจำนวนเงินที่มากกว่า 0 บาท');

  if (!db.transactions) db.transactions = [];
  db.transactions.push({ id: 'tx_' + generateId(), date: dateVal, fundId: fundIdVal, type: typeVal, amount: amountVal });
  saveDB();
  amountEl.value = '';
  renderTransactionsTable();
  showToast('เพิ่มประวัติธุรกรรมสำเร็จ');
}

function deleteTransaction(txId) {
  if (confirm('ยืนยันที่จะลบรายการบันทึกประวัตินี้หรือไม่?')) {
    db.transactions = (db.transactions || []).filter(t => t.id !== txId);
    saveDB();
    renderTransactionsTable();
    showToast('ลบรายการสำเร็จแล้ว');
  }
}

function renderTransactionsTable() {
  const tbody = document.getElementById('tx-table-body');
  if(!tbody) return;
  const filterSelect = document.getElementById('tx-filter-select');
  const filterValue = (filterSelect ? filterSelect.value : 'ALL') || 'ALL';
  tbody.innerHTML = '';

  let filteredTx = db.transactions || [];
  if (filterValue !== 'ALL') { filteredTx = (db.transactions || []).filter(t => t.fundId === filterValue); }
  const sortedTx = [...filteredTx].sort((a, b) => new Date(b.date) - new Date(a.date));

  if (sortedTx.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-slate-400">ไม่พบประวัติการซื้อขายที่ตรงกับตัวกรอง</td></tr>`;
    return;
  }

  sortedTx.forEach(t => {
    const fund = (db.funds || []).find(f => f.id === t.fundId);
    const fundName = fund ? `${escapeHtml(fund.name)} (${escapeHtml(fund.symbol || '')})` : 'ไม่พบข้อมูลกองทุน';
    let typeBadge = '';
    if (t.type === 'BUY') typeBadge = '<span class="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded font-bold">ซื้อ</span>';
    if (t.type === 'SELL') typeBadge = '<span class="px-2 py-0.5 bg-rose-100 text-rose-700 text-xs rounded font-bold">ขาย</span>';

    tbody.innerHTML += `
      <tr class="border-b border-slate-100 hover:bg-slate-50/50 align-middle">
        <td class="p-3 font-mono text-xs text-slate-500">${t.date}</td>
        <td class="p-3 font-semibold">${fundName}</td>
        <td class="p-3">${typeBadge}</td>
        <td class="p-3 text-right font-mono text-slate-900">฿${formatNumber(t.amount)}</td>
        <td class="p-3 text-center">
          <button onclick="deleteTransaction('${t.id}')" class="px-2 py-1 bg-rose-50 hover:bg-rose-500 text-rose-500 hover:text-white border border-rose-200 hover:border-transparent rounded-lg text-xs font-bold transition-all">
            <i class="fa-solid fa-trash-can mr-1"></i> ลบ
          </button>
        </td>
      </tr>`;
  });
}
