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
          const sName = (sub.name || '').trim();
          if (selectedSubCatsForCompare.includes(sName) || selectedSubCatsForCompare.includes(sub.name)) {
            if(!currentSubTotals[sName]) currentSubTotals[sName] = 0;
            const portion = fundVal * (sub.weight / 100);
            currentSubTotals[sName] += portion;
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
    const cVal = currentSubTotals[subName.trim()] || currentSubTotals[subName] || 0;
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
    const actualData = selectedSubCatsForCompare.map(sub => totalWealthInGroup > 0 ? (((currentSubTotals[sub.trim()] || currentSubTotals[sub]) || 0) / totalWealthInGroup) * 100 : 0);
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
  renderHistoricalAllocationTable();
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
          const match = f.subCategories.find(s => s.name.trim() === subName.trim());
          if(match) monthVal += val * (match.weight / 100);
        } else if (subName.trim() === 'ยังไม่ได้ระบุประเภทย่อย') {
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

function renderHistoricalAllocationTable() {
  const tbody = document.getElementById('alloc-history-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3];

  years.forEach((y, idx) => {
    const headEl = document.getElementById(`alloc-head-year-${idx}`);
    if (headEl) {
      headEl.innerText = idx === 0 ? `ปีปัจจุบัน (${y})` : `ย้อนหลัง ${idx} ปี (${y})`;
    }
  });

  let yearTotals = {};
  let yearSubTotals = {};

  years.forEach(y => {
    yearTotals[y] = 0;
    yearSubTotals[y] = {};

    const monthsInYear = Object.keys(db.records || {}).filter(m => m.startsWith(y.toString())).sort();
    if (monthsInYear.length > 0) {
      const lastMonth = monthsInYear[monthsInYear.length - 1];
      const monthData = db.records[lastMonth] || {};

      (db.funds || []).forEach(f => {
        const val = monthData[f.id] || 0;
        if (val > 0) {
          if (f.subCategories && f.subCategories.length > 0) {
            f.subCategories.forEach(s => {
              const sName = (s.name || '').trim();
              const portion = val * ((s.weight || 0) / 100);
              yearSubTotals[y][sName] = (yearSubTotals[y][sName] || 0) + portion;
              yearTotals[y] += portion;
            });
          } else {
            const defaultSub = 'ยังไม่ได้ระบุประเภทย่อย';
            yearSubTotals[y][defaultSub] = (yearSubTotals[y][defaultSub] || 0) + val;
            yearTotals[y] += val;
          }
        }
      });
    }
  });

  const inputs = document.querySelectorAll('.subcat-target-input');
  let targets = {};
  inputs.forEach(input => {
    const subName = input.getAttribute('data-subname');
    if (subName) targets[subName.trim()] = parseFloat(input.value) || 0;
  });

  let subCatsToDisplay = selectedSubCatsForCompare && selectedSubCatsForCompare.length > 0 
    ? selectedSubCatsForCompare 
    : getAllUniqueSubCategories();

  subCatsToDisplay.forEach(subNameRaw => {
    const subName = subNameRaw.trim();
    const safeSub = escapeHtml(subName);
    const targetPct = targets[subName] !== undefined ? targets[subName] : ((db.allocationSettings || {})[subName] || 0);

    let rowHtml = `
      <tr class="border-b border-slate-100 hover:bg-slate-50">
        <td class="p-3 font-bold text-slate-800">${safeSub}</td>
        <td class="p-3 text-right font-mono text-blue-600 font-bold">${targetPct}%</td>
    `;

    let pcts = [];
    years.forEach((y, idx) => {
      const total = yearTotals[y] || 0;
      const subVal = (yearSubTotals[y] && yearSubTotals[y][subName]) || 0;
      const pct = total > 0 ? (subVal / total) * 100 : null;
      pcts.push(pct);

      const cellBg = idx === 0 ? 'bg-blue-50/40 font-bold text-slate-900' : '';
      const textDisplay = pct !== null ? `${pct.toFixed(1)}%` : '<span class="text-slate-300 italic">N/A</span>';

      rowHtml += `<td class="p-3 text-right font-mono ${cellBg}">${textDisplay}</td>`;
    });

    const currPct = pcts[0];
    const prevPct = pcts.slice(1).find(p => p !== null);

    let trendBadge = `<span class="text-slate-300">-</span>`;
    if (currPct !== null && prevPct !== undefined && prevPct !== null) {
      const diff = currPct - prevPct;
      if (Math.abs(diff) < 0.5) {
        trendBadge = `<span class="text-slate-500 bg-slate-100 px-2 py-0.5 rounded text-[10px] font-bold"><i class="fa-solid fa-minus mr-1"></i>คงที่</span>`;
      } else if (diff > 0) {
        trendBadge = `<span class="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded text-[10px] font-bold"><i class="fa-solid fa-arrow-up mr-1"></i>+${diff.toFixed(1)}%</span>`;
      } else {
        trendBadge = `<span class="text-rose-700 bg-rose-100 px-2 py-0.5 rounded text-[10px] font-bold"><i class="fa-solid fa-arrow-down mr-1"></i>${diff.toFixed(1)}%</span>`;
      }
    }

    rowHtml += `<td class="p-3 text-center">${trendBadge}</td></tr>`;
    tbody.innerHTML += rowHtml;
  });
}
