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
