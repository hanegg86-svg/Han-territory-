// ================= PASSIVE INCOME MODULE =================

// ฟังก์ชันดึงยอดซื้อ PF อัตโนมัติจากประวัติการซื้อขายในเดือนนั้นๆ
function getMonthlyPFFromTransactions(targetMonth) {
  if (!db.transactions || !db.funds) return 0;

  const pfFundIds = db.funds
    .filter(f => {
      const name = (f.name || '').toUpperCase();
      const symbol = (f.symbol || '').toUpperCase();
      return name.includes('PF') || symbol.includes('PF') || name.includes('PROVIDENT');
    })
    .map(f => f.id);

  if (pfFundIds.length === 0) return 0;

  let totalPF = 0;
  db.transactions.forEach(t => {
    if (t.date && t.date.startsWith(targetMonth) && pfFundIds.includes(t.fundId)) {
      if (t.type === 'BUY') totalPF += (t.amount || 0);
      if (t.type === 'SELL') totalPF -= (t.amount || 0);
    }
  });

  return Math.max(0, totalPF);
}

// คำนวณ Passive Income สำหรับเดือนที่กำหนด
function getPassiveIncomeForMonth(targetMonth) {
  const sortedMonths = Object.keys(db.records || {}).sort();
  const currentIndex = sortedMonths.indexOf(targetMonth);
  if (currentIndex === -1) return 0;

  const prevMonth = currentIndex > 0 ? sortedMonths[currentIndex - 1] : null;

  const getMonthTotalWealth = (m) => {
    if (!m || !db.records || !db.records[m]) return 0;
    return (db.funds || []).reduce((sum, f) => sum + (db.records[m][f.id] || 0), 0);
  };

  const currentWealth = getMonthTotalWealth(targetMonth);
  const prevWealth = getMonthTotalWealth(prevMonth);
  const wealthDelta = currentWealth - prevWealth;

  const data = (db.passiveIncomeData && db.passiveIncomeData[targetMonth]) || {};
  const activeIncome = data.activeIncome || 0;
  const expenses = data.expenses || 0;
  const autoPF = getMonthlyPFFromTransactions(targetMonth);
  const pfTotal = data.pfTotal !== undefined ? data.pfTotal : autoPF;

  return wealthDelta - activeIncome - pfTotal + expenses;
}

function initPassiveIncomeTab() {
  const monthSelect = document.getElementById('passive-month-select');
  if (!monthSelect) return;

  const sortedMonths = Object.keys(db.records || {}).sort();
  monthSelect.innerHTML = '';

  if (sortedMonths.length === 0) {
    const curr = getCurrentMonth();
    monthSelect.innerHTML = `<option value="${curr}" class="text-slate-900">${curr}</option>`;
    monthSelect.value = curr;
  } else {
    sortedMonths.forEach(m => {
      monthSelect.innerHTML += `<option value="${m}" class="text-slate-900">${m}</option>`;
    });
    monthSelect.value = sortedMonths[sortedMonths.length - 1];
  }

  loadPassiveIncomeInputs();
  calculatePassiveIncome();
}

function onPassiveMonthChange() {
  loadPassiveIncomeInputs();
  calculatePassiveIncome();
}

function loadPassiveIncomeInputs() {
  const monthSelect = document.getElementById('passive-month-select');
  if (!monthSelect) return;
  const month = monthSelect.value;

  if (!db.passiveIncomeData) db.passiveIncomeData = {};
  const data = db.passiveIncomeData[month] || {};

  const autoPF = getMonthlyPFFromTransactions(month);
  const pfTotalValue = data.pfTotal !== undefined ? data.pfTotal : autoPF;

  document.getElementById('pass-active-income').value = data.activeIncome ? formatNumber(data.activeIncome) : '';
  document.getElementById('pass-expenses').value = data.expenses ? formatNumber(data.expenses) : '';
  document.getElementById('pass-pf-total').value = pfTotalValue ? formatNumber(pfTotalValue) : (autoPF ? formatNumber(autoPF) : '');
}

function savePassiveIncomeData() {
  const monthSelect = document.getElementById('passive-month-select');
  if (!monthSelect) return;
  const month = monthSelect.value;

  if (!db.passiveIncomeData) db.passiveIncomeData = {};

  const activeIncome = parseLocalNumber(document.getElementById('pass-active-income').value);
  const expenses = parseLocalNumber(document.getElementById('pass-expenses').value);
  const pfTotal = parseLocalNumber(document.getElementById('pass-pf-total').value);

  db.passiveIncomeData[month] = { activeIncome, expenses, pfTotal };
  saveDB();
}

function calculatePassiveIncome() {
  savePassiveIncomeData();

  const monthSelect = document.getElementById('passive-month-select');
  if (!monthSelect) return;
  const targetMonth = monthSelect.value;

  // 1. หาเดือนก่อนหน้าเพื่อคำนวณ "เงินเก็บที่เพิ่มขึ้น"
  const sortedMonths = Object.keys(db.records || {}).sort();
  const currentIndex = sortedMonths.indexOf(targetMonth);
  const prevMonth = currentIndex > 0 ? sortedMonths[currentIndex - 1] : null;

  const getMonthTotalWealth = (m) => {
    if (!m || !db.records || !db.records[m]) return 0;
    return (db.funds || []).reduce((sum, f) => sum + (db.records[m][f.id] || 0), 0);
  };

  const currentWealth = getMonthTotalWealth(targetMonth);
  const prevWealth = getMonthTotalWealth(prevMonth);
  
  const wealthDelta = currentWealth - prevWealth;

  // 2. ดึงค่าจากการกรอก
  const activeIncome = parseLocalNumber(document.getElementById('pass-active-income').value);
  const expenses = parseLocalNumber(document.getElementById('pass-expenses').value);
  const pfTotal = parseLocalNumber(document.getElementById('pass-pf-total').value);

  // 3. สมการ Passive Income
  const passiveIncome = wealthDelta - activeIncome - pfTotal + expenses;

  // 4. แสดงผลลัพธ์ใน UI
  const deltaEl = document.getElementById('pass-wealth-delta-val');
  if (deltaEl) {
    if (!prevMonth && currentWealth > 0) {
      deltaEl.innerText = '฿' + formatNumber(currentWealth);
    } else {
      deltaEl.innerText = (wealthDelta >= 0 ? '+' : '') + '฿' + formatNumber(wealthDelta);
      deltaEl.className = `text-lg font-bold ${wealthDelta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`;
    }
  }

  const prevMonthTag = document.getElementById('pass-prev-month-tag');
  if (prevMonthTag) {
    prevMonthTag.innerText = prevMonth ? `เทียบกับ ${prevMonth}` : 'ไม่มีข้อมูลเดือนก่อนหน้า';
  }

  const resultEl = document.getElementById('pass-result-val');
  const resultCard = document.getElementById('pass-result-card');
  if (resultEl) {
    resultEl.innerText = (passiveIncome >= 0 ? '+' : '') + '฿' + formatNumber(passiveIncome);
  }

  if (resultCard) {
    if (passiveIncome >= 0) {
      resultCard.className = "p-5 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-lg space-y-1";
    } else {
      resultCard.className = "p-5 rounded-2xl bg-gradient-to-br from-rose-600 to-pink-700 text-white shadow-lg space-y-1";
    }
  }

  const ratioEl = document.getElementById('pass-ratio-val');
  if (ratioEl) {
    if (activeIncome > 0) {
      const ratio = (passiveIncome / activeIncome) * 100;
      ratioEl.innerText = `คิดเป็น ${ratio.toFixed(1)}% ของ Active Income`;
    } else {
      ratioEl.innerText = 'กรุณาระบุ Active Income เพื่อดูสัดส่วน';
    }
  }

  // ✅ อัปเดตกราฟรายเดือนอัตโนมัติ
  renderPassiveIncomeChart();
}

// ✅ ฟังก์ชันวาดกราฟแท่ง Passive Income รายเดือนตามช่วงเวลาที่เลือก พร้อมคำนวณ Net สะสม
function renderPassiveIncomeChart() {
  const canvas = document.getElementById('passiveIncomeChart');
  if (!canvas) return;

  const sortedMonths = Object.keys(db.records || {}).sort();
  if (sortedMonths.length === 0) return;

  const startEl = document.getElementById('pass-chart-start');
  const endEl = document.getElementById('pass-chart-end');

  // ตั้งค่าเริ่มต้นช่วงเวลาหากยังไม่ได้เลือก
  if (startEl && !startEl.value) {
    const defaultStartIdx = Math.max(0, sortedMonths.length - 12);
    startEl.value = sortedMonths[defaultStartIdx];
  }
  if (endEl && !endEl.value) {
    endEl.value = sortedMonths[sortedMonths.length - 1];
  }

  const startMonth = startEl ? startEl.value : sortedMonths[0];
  const endMonth = endEl ? endEl.value : sortedMonths[sortedMonths.length - 1];

  const filteredMonths = sortedMonths.filter(m => m >= startMonth && m <= endMonth);

  const dataValues = filteredMonths.map(m => getPassiveIncomeForMonth(m));
  const backgroundColors = dataValues.map(v => v >= 0 ? 'rgba(16, 185, 129, 0.85)' : 'rgba(239, 68, 68, 0.85)');
  const borderColors = dataValues.map(v => v >= 0 ? '#10b981' : '#ef4444');

  // 🟢 คำนวณยอด Net สุทธิสะสม และค่าเฉลี่ยรายเดือนในช่วงเวลาที่เลือก
  const totalNetPassive = dataValues.reduce((sum, val) => sum + val, 0);
  const monthsCount = filteredMonths.length;
  const avgMonthlyPassive = monthsCount > 0 ? (totalNetPassive / monthsCount) : 0;

  // 🟢 อัปเดต UI กระดานสรุปผลช่วงเวลา
  const rangeTotalEl = document.getElementById('pass-range-total-val');
  const rangeLabelEl = document.getElementById('pass-range-label');
  const rangeCountEl = document.getElementById('pass-range-count-tag');
  const rangeAvgEl = document.getElementById('pass-range-avg-val');

  if (rangeTotalEl) {
    rangeTotalEl.innerText = (totalNetPassive >= 0 ? '+' : '') + '฿' + formatNumber(totalNetPassive);
    rangeTotalEl.className = `text-2xl font-black mt-0.5 ${totalNetPassive >= 0 ? 'text-emerald-400' : 'text-rose-400'}`;
  }
  if (rangeLabelEl) {
    rangeLabelEl.innerText = `ยอด Passive Income สุทธิสะสม (${startMonth} ถึง ${endMonth})`;
  }
  if (rangeCountEl) {
    rangeCountEl.innerText = `รวม ${monthsCount} เดือน`;
  }
  if (rangeAvgEl) {
    rangeAvgEl.innerText = `เฉลี่ย ${avgMonthlyPassive >= 0 ? '+' : ''}฿${formatNumber(avgMonthlyPassive)} / เดือน`;
  }

  if (passiveChart) {
    passiveChart.destroy();
  }

  const ctx = canvas.getContext('2d');
  passiveChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: filteredMonths,
      datasets: [{
        label: 'Passive Income (บาท)',
        data: dataValues,
        backgroundColor: backgroundColors,
        borderColor: borderColors,
        borderWidth: 1.5,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(context) {
              let val = context.raw || 0;
              return ' Passive Income: ' + (val >= 0 ? '+' : '') + formatNumber(val) + ' บาท';
            }
          }
        }
      },
      scales: {
        y: {
          ticks: {
            callback: function(value) { return '฿' + (value / 1000).toFixed(0) + 'k'; }
          },
          grid: { color: 'rgba(226, 232, 240, 0.6)' }
        },
        x: {
          grid: { display: false }
        }
      }
    }
  });
}
