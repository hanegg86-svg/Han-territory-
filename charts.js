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
