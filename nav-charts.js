// ================= NAV TREND CHARTS & AI ANALYZER MODULE =================
let navTrendChart = null;

// ดึงค่า NAV ของกองทุนในเดือนที่กำหนด (ดึงจาก db.navRecords หรือคำนวณจาก Total / Units)
function getFundNavForMonth(fundId, monthStr) {
  if (!fundId || !monthStr) return null;

  // 1. ตรวจสอบใน db.navRecords ที่บันทึกไว้โดยตรง
  if (db.navRecords && db.navRecords[monthStr] && db.navRecords[monthStr][fundId] !== undefined) {
    const val = parseFloat(db.navRecords[monthStr][fundId]);
    if (!isNaN(val) && val > 0) return val;
  }

  // 2. Fallback: คำนวณจาก มูลค่ารวม (Market Value) / จำนวนหน่วย (Units)
  const fund = (db.funds || []).find(f => f.id === fundId);
  const units = fund ? parseFloat(fund.units) || 0 : 0;
  const monthRecord = (db.records && db.records[monthStr]) ? db.records[monthStr] : null;
  const totalVal = monthRecord ? parseFloat(monthRecord[fundId]) || 0 : 0;

  if (units > 0 && totalVal > 0) {
    const calculated = totalVal / units;
    return parseFloat(calculated.toFixed(4));
  }

  return null;
}

// คัดกรองรายชื่อกองทุนที่มีค่า NAV
function getFundsWithNav() {
  const funds = db.funds || [];
  if (funds.length === 0) return [];

  // กองทุนที่มี NAV คือ:
  // 1. ไม่อยู่ในกลุ่ม high (เงินฝาก/สภาพคล่องสูง) และ ins (ประกัน)
  // 2. หรือ มีการบันทึก units > 0
  // 3. หรือ มีข้อมูลใน db.navRecords
  let filtered = funds.filter(f => {
    const isEligibleCat = (f.catId !== 'high' && f.catId !== 'ins');
    const hasUnits = (parseFloat(f.units) || 0) > 0;
    
    let hasSavedNav = false;
    if (db.navRecords) {
      hasSavedNav = Object.keys(db.navRecords).some(m => (db.navRecords[m][f.id] || 0) > 0);
    }

    return isEligibleCat || hasUnits || hasSavedNav;
  });

  // ✅ Fallback: หากกรองแล้วไม่มีกองทุนที่เข้าเกณฑ์เลย ให้คืนค่ากองทุนทั้งหมดที่ผู้ใช้มีในระบบ เพื่อให้มีตัวเลือกแสดงเสมอ
  if (filtered.length === 0) {
    return funds;
  }

  return filtered;
}

// เริ่มต้นแท็บกราฟ NAV (โหลดรายชื่อกองทุนและวันที่)
function initNavChartTab() {
  const select = document.getElementById('nav-chart-fund-select');
  if (!select) return;
  select.innerHTML = '';

  const eligibleFunds = getFundsWithNav();

  if (eligibleFunds.length === 0) {
    select.innerHTML = `<option value="">⚠️ ยังไม่มีรายชื่อกองทุนในระบบ (กรุณาเพิ่มที่แท็บตั้งค่า)</option>`;
  } else {
    eligibleFunds.forEach(f => {
      const catName = db.categories[f.catId] ? db.categories[f.catId].name : 'ทั่วไป';
      const symbolText = f.symbol ? ` [${escapeHtml(f.symbol)}]` : '';
      select.innerHTML += `<option value="${f.id}">กองทุน: ${escapeHtml(f.name)}${symbolText} (${catName})</option>`;
    });
  }

  // ตั้งค่าช่วงเดือนเริ่มต้น-สิ้นสุด
  const months = Object.keys(db.records || {}).sort();
  const startEl = document.getElementById('nav-chart-start');
  const endEl = document.getElementById('nav-chart-end');

  if (startEl && endEl) {
    if (months.length > 0) {
      const startIndex = Math.max(0, months.length - 12);
      startEl.value = months[startIndex];
      endEl.value = months[months.length - 1];
    } else {
      const current = getCurrentMonth();
      startEl.value = current;
      endEl.value = current;
    }
  }

  renderNavTrendChart();
}

// วาดกราฟแนวโน้ม NAV และอัปเดตสถิติ
function renderNavTrendChart() {
  const select = document.getElementById('nav-chart-fund-select');
  const startEl = document.getElementById('nav-chart-start');
  const endEl = document.getElementById('nav-chart-end');
  const summaryContainer = document.getElementById('nav-latest-summary');
  const canvas = document.getElementById('navTrendChart');

  if (!select || !startEl || !endEl || !canvas) return;
  const fundId = select.value;
  const startM = startEl.value;
  const endM = endEl.value;

  if (summaryContainer) summaryContainer.innerHTML = '';

  if (!fundId) {
    if (navTrendChart) navTrendChart.destroy();
    renderNavHistoryTable([], []);
    return;
  }

  const allMonths = Object.keys(db.records || {}).sort();
  // รวบรวมเดือนทั้งหมดที่มีข้อมูลในช่วงเวลา
  const filteredMonths = allMonths.filter(m => m >= startM && m <= endM);

  let navData = [];
  let validMonths = [];
  let validNavValues = [];

  filteredMonths.forEach(m => {
    const navVal = getFundNavForMonth(fundId, m);
    navData.push(navVal);
    if (navVal !== null && navVal > 0) {
      validMonths.push(m);
      validNavValues.push(navVal);
    }
  });

  // คำนวณสถิติ
  const hasData = validNavValues.length > 0;
  const latestNAV = hasData ? validNavValues[validNavValues.length - 1] : 0;
  const startNAV = hasData ? validNavValues[0] : 0;
  const maxNAV = hasData ? Math.max(...validNavValues) : 0;
  const minNAV = hasData ? Math.min(...validNavValues) : 0;

  const maxMonthIdx = validNavValues.indexOf(maxNAV);
  const minMonthIdx = validNavValues.indexOf(minNAV);
  const maxMonth = maxMonthIdx !== -1 ? validMonths[maxMonthIdx] : '-';
  const minMonth = minMonthIdx !== -1 ? validMonths[minMonthIdx] : '-';

  const navDiff = latestNAV - startNAV;
  const navDiffPct = startNAV > 0 ? (navDiff / startNAV) * 100 : 0;
  const isPos = navDiff >= 0;

  // Drawdown จากจุดสูงสุด
  const drawdownPct = maxNAV > 0 ? ((latestNAV - maxNAV) / maxNAV) * 100 : 0;

  if (summaryContainer) {
    if (!hasData) {
      summaryContainer.innerHTML = `
        <div class="col-span-full bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl text-center font-bold text-xs">
          ⚠️ ยังไม่มีข้อมูลค่า NAV หรือจำนวนหน่วยของกองทุนนี้ในช่วงเดือนที่เลือก กรุณากรอก NAV หรือ Units ในแท็บบันทึกยอดครับ
        </div>
      `;
    } else {
      summaryContainer.innerHTML = `
        <div class="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm text-center">
          <p class="text-xs font-bold text-blue-600 mb-1">NAV ล่าสุด (${validMonths[validMonths.length - 1]})</p>
          <h4 class="text-xl font-black text-slate-800">฿${latestNAV.toFixed(4)}</h4>
          <p class="text-[10px] text-slate-400 mt-0.5">บาท / หน่วย</p>
        </div>
        <div class="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm text-center">
          <p class="text-xs font-bold text-slate-500 mb-1">การเปลี่ยนแปลงช่วงเวลา</p>
          <h4 class="text-xl font-black ${isPos ? 'text-emerald-600' : 'text-rose-600'}">${isPos ? '+' : ''}${navDiff.toFixed(4)}</h4>
          <p class="text-[10px] font-bold ${isPos ? 'text-emerald-600' : 'text-rose-600'} mt-0.5">${isPos ? '+' : ''}${navDiffPct.toFixed(2)}%</p>
        </div>
        <div class="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm text-center">
          <p class="text-xs font-bold text-emerald-600 mb-1"><i class="fa-solid fa-arrow-trend-up mr-1"></i>จุดสูงสุด (High)</p>
          <h4 class="text-xl font-black text-slate-800">฿${maxNAV.toFixed(4)}</h4>
          <p class="text-[10px] text-slate-400 mt-0.5">ณ เดือน ${maxMonth}</p>
        </div>
        <div class="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm text-center">
          <p class="text-xs font-bold text-rose-600 mb-1"><i class="fa-solid fa-arrow-trend-down mr-1"></i>จุดต่ำสุด (Low)</p>
          <h4 class="text-xl font-black text-slate-800">฿${minNAV.toFixed(4)}</h4>
          <p class="text-[10px] text-slate-400 mt-0.5">ณ เดือน ${minMonth}</p>
        </div>
        <div class="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm text-center">
          <p class="text-xs font-bold text-purple-600 mb-1">เทียบจุดสูงสุด (Peak)</p>
          <h4 class="text-xl font-black ${drawdownPct >= 0 ? 'text-emerald-600' : 'text-purple-700'}">${drawdownPct >= 0 ? 'จุดสูงสุดใหม่!' : drawdownPct.toFixed(2) + '%'}</h4>
          <p class="text-[10px] text-slate-400 mt-0.5">Drawdown จากยอดดอย</p>
        </div>
      `;
    }
  }

  // วาดกราฟ Chart.js
  const ctx = canvas.getContext('2d');
  if (navTrendChart) navTrendChart.destroy();

  // สร้าง Gradient สวยงาม
  const gradient = ctx.createLinearGradient(0, 0, 0, 350);
  gradient.addColorStop(0, 'rgba(59, 130, 246, 0.25)');
  gradient.addColorStop(1, 'rgba(59, 130, 246, 0.00)');

  navTrendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: filteredMonths,
      datasets: [
        {
          label: 'มูลค่า NAV (บาท/หน่วย)',
          data: navData,
          borderColor: '#2563eb',
          backgroundColor: gradient,
          borderWidth: 2.8,
          pointRadius: 4,
          pointBackgroundColor: '#ffffff',
          pointBorderColor: '#2563eb',
          pointBorderWidth: 2,
          pointHoverRadius: 6,
          fill: true,
          tension: 0.2,
          spanGaps: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: { usePointStyle: true, boxWidth: 8, font: { weight: 'bold', size: 11 } }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const val = context.raw;
              if (val === null || val === undefined) return ' ไม่มีข้อมูล';
              return ` NAV: ฿${parseFloat(val).toFixed(4)} บาท/หน่วย`;
            }
          }
        }
      },
      scales: {
        y: {
          ticks: {
            callback: function(value) {
              return '฿' + parseFloat(value).toFixed(2);
            },
            font: { family: 'monospace', size: 11 }
          },
          grid: { color: 'rgba(226, 232, 240, 0.7)' }
        },
        x: {
          grid: { display: false },
          ticks: { font: { weight: 'bold', size: 11 } }
        }
      }
    }
  });

  // แสดงผลตารางประวัติค่า NAV
  renderNavHistoryTable(filteredMonths, navData, maxNAV);
}

// ตารางประวัติค่า NAV รายเดือน
function renderNavHistoryTable(months, navValues, maxNAV) {
  const tbody = document.getElementById('nav-history-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!months || months.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-slate-400">ไม่มีข้อมูลในช่วงเวลาที่เลือก</td></tr>`;
    return;
  }

  // เรียงลำดับจากเดือนล่าสุดลงไปเดือนเก่าสุด
  let prevNav = null;
  let rows = [];

  for (let i = 0; i < months.length; i++) {
    const m = months[i];
    const nav = navValues[i];
    let diff = null;
    let diffPct = null;

    if (nav !== null && prevNav !== null && prevNav > 0) {
      diff = nav - prevNav;
      diffPct = (diff / prevNav) * 100;
    }

    let diffFromHigh = null;
    if (nav !== null && maxNAV > 0) {
      diffFromHigh = ((nav - maxNAV) / maxNAV) * 100;
    }

    rows.push({ month: m, nav, diff, diffPct, diffFromHigh });
    if (nav !== null) prevNav = nav;
  }

  // กลับลำดับให้เดือนล่าสุดอยู่บนสุด
  rows.reverse();

  rows.forEach(r => {
    const hasNav = r.nav !== null && r.nav > 0;
    const navText = hasNav ? `฿${r.nav.toFixed(4)}` : '<span class="text-slate-300 italic">ไม่มีข้อมูล</span>';

    let diffHtml = '<span class="text-slate-400">-</span>';
    if (r.diff !== null) {
      const isUp = r.diff > 0;
      if (Math.abs(r.diff) < 0.0001) {
        diffHtml = `<span class="text-slate-500 font-bold font-mono">0.0000 (0.00%)</span>`;
      } else if (isUp) {
        diffHtml = `<span class="text-emerald-600 font-bold font-mono">+${r.diff.toFixed(4)} (+${r.diffPct.toFixed(2)}%)</span>`;
      } else {
        diffHtml = `<span class="text-rose-600 font-bold font-mono">${r.diff.toFixed(4)} (${r.diffPct.toFixed(2)}%)</span>`;
      }
    }

    let highHtml = '<span class="text-slate-400">-</span>';
    if (r.diffFromHigh !== null) {
      if (Math.abs(r.diffFromHigh) < 0.01) {
        highHtml = `<span class="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[10px] font-bold">⭐ All-Time High</span>`;
      } else {
        highHtml = `<span class="text-slate-600 font-mono">${r.diffFromHigh.toFixed(2)}%</span>`;
      }
    }

    tbody.innerHTML += `
      <tr class="border-b border-slate-100 hover:bg-slate-50/70 transition-colors">
        <td class="p-3 font-bold text-slate-900">${r.month}</td>
        <td class="p-3 text-right font-mono font-bold text-blue-700">${navText}</td>
        <td class="p-3 text-right font-mono">${diffHtml}</td>
        <td class="p-3 text-right font-mono">${highHtml}</td>
      </tr>
    `;
  });
}

// ================= AI NAV DIRECTION ANALYZER TRIGGER =================
async function triggerAINavAnalysis() {
  if (!navTrendChart) return alert('กรุณารอให้กราฟแสดงผลก่อนทำการวิเคราะห์ครับ');

  const select = document.getElementById('nav-chart-fund-select');
  const startEl = document.getElementById('nav-chart-start');
  const endEl = document.getElementById('nav-chart-end');

  const fundName = select ? select.options[select.selectedIndex].text : '';
  const fundId = select ? select.value : '';
  const startM = startEl ? startEl.value : '';
  const endM = endEl ? endEl.value : '';

  const resultBox = document.getElementById('nav-ai-result-box');
  const loadingEl = document.getElementById('nav-ai-loading');
  const contentEl = document.getElementById('nav-ai-content');
  const btn = document.getElementById('btn-nav-ai');

  if (resultBox) resultBox.classList.remove('hidden');
  if (loadingEl) loadingEl.classList.remove('hidden');
  if (contentEl) contentEl.innerHTML = '';
  if (btn) btn.disabled = true;

  try {
    // 1. ดึงภาพ Base64 ของกราฟ NAV ปัจจุบัน
    const chartBase64Url = navTrendChart.toBase64Image('image/png', 1);
    const base64Data = chartBase64Url.split(',')[1];

    // 2. รวบรวมสถิติเชิงลึกประกอบการวิเคราะห์
    const allMonths = Object.keys(db.records || {}).sort();
    const filteredMonths = allMonths.filter(m => m >= startM && m <= endM);

    let navList = [];
    filteredMonths.forEach(m => {
      const v = getFundNavForMonth(fundId, m);
      if (v !== null && v > 0) {
        navList.push({ month: m, nav: v });
      }
    });

    if (navList.length === 0) {
      alert('ไม่พบข้อมูลค่า NAV ในช่วงเวลาที่เลือกเพื่อนำไปวิเคราะห์');
      return;
    }

    const startItem = navList[0];
    const latestItem = navList[navList.length - 1];
    const navValues = navList.map(item => item.nav);
    const maxVal = Math.max(...navValues);
    const minVal = Math.min(...navValues);

    const diff = latestItem.nav - startItem.nav;
    const diffPct = startItem.nav > 0 ? ((diff / startItem.nav) * 100).toFixed(2) : '0';
    const drawdownPct = maxVal > 0 ? (((latestItem.nav - maxVal) / maxVal) * 100).toFixed(2) : '0';

    // ดึงประวัติ 3 เดือนล่าสุด
    const recentHistory = navList.slice(-4).map(item => `- เดือน ${item.month}: NAV ฿${item.nav.toFixed(4)}`).join('\n');

    const statsText = `
- กองทุนที่วิเคราะห์: ${fundName}
- ช่วงเวลาที่วิเคราะห์: ${startM} ถึง ${endM} (รวม ${navList.length} รอบเดือนที่มีข้อมูล)
- ค่า NAV ปัจจุบัน (${latestItem.month}): ฿${latestItem.nav.toFixed(4)} บาท
- ค่า NAV เริ่มต้นช่วงเวลา (${startItem.month}): ฿${startItem.nav.toFixed(4)} บาท
- การเปลี่ยนแปลงตลอดช่วงเวลา: ${diff >= 0 ? '+' : ''}${diff.toFixed(4)} บาท (${diff >= 0 ? '+' : ''}${diffPct}%)
- ค่า NAV สูงสุด (Period High): ฿${maxVal.toFixed(4)} บาท
- ค่า NAV ต่ำสุด (Period Low): ฿${minVal.toFixed(4)} บาท
- ระยะห่างจากจุดสูงสุด (Drawdown): ${drawdownPct}%
- ประวัติ NAV รอบเดือนล่าสุด:
${recentHistory}
    `;

    // 3. ส่งวิเคราะห์ผ่าน Gemini API (ใช้ gemini-3.5-flash-lite)
    const analysisResult = await analyzeNavTrendWithGemini(base64Data, statsText);

    if (analysisResult && contentEl) {
      let formattedHtml = analysisResult
        .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
        .replace(/### (.*?)\n/g, '<h4 class="font-bold text-slate-800 text-sm mt-3 mb-1">$1</h4>')
        .replace(/## (.*?)\n/g, '<h3 class="font-bold text-blue-700 text-base mt-4 mb-2 pb-1 border-b border-slate-100">$1</h3>')
        .replace(/\n/g, '<br>');
      contentEl.innerHTML = formattedHtml;
      showToast('วิเคราะห์ทิศทาง NAV สำเร็จ!');
    }
  } catch (err) {
    console.error("AI NAV Analysis Trigger Error:", err);
    alert('เกิดข้อผิดพลาดในการวิเคราะห์กราฟ NAV: ' + err.message);
  } finally {
    if (loadingEl) loadingEl.classList.add('hidden');
    if (btn) btn.disabled = false;
  }
}

// ✅ เริ่มต้นดึงข้อมูลทันทีเมื่อโหลดสคริปต์เสร็จ
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => { if (typeof initNavChartTab === 'function') initNavChartTab(); }, 250);
    });
  } else {
    setTimeout(() => { if (typeof initNavChartTab === 'function') initNavChartTab(); }, 250);
  }
}