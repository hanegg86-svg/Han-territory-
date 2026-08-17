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
