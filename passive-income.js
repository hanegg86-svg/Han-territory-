// ================= PASSIVE INCOME MODULE =================

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
    // เลือกเดือนล่าสุดเป็นค่าเริ่มต้นเมื่อเปิดแท็บ
    monthSelect.value = sortedMonths[sortedMonths.length - 1];
  }

  loadPassiveIncomeInputs();
  calculatePassiveIncome();
}

// ✅ เพิ่มฟังก์ชันสำหรับเรียกใช้งานเมื่อเปลี่ยนตัวเลือกเดือน
function onPassiveMonthChange() {
  loadPassiveIncomeInputs();
  calculatePassiveIncome();
}

function loadPassiveIncomeInputs() {
  const monthSelect = document.getElementById('passive-month-select');
  if (!monthSelect) return;
  const month = monthSelect.value;

  if (!db.passiveIncomeData) db.passiveIncomeData = {};
  const data = db.passiveIncomeData[month] || { activeIncome: 0, expenses: 0, pfEmployee: 0, pfEmployer: 0 };

  document.getElementById('pass-active-income').value = data.activeIncome ? formatNumber(data.activeIncome) : '';
  document.getElementById('pass-expenses').value = data.expenses ? formatNumber(data.expenses) : '';
  document.getElementById('pass-pf-employee').value = data.pfEmployee ? formatNumber(data.pfEmployee) : '';
  document.getElementById('pass-pf-employer').value = data.pfEmployer ? formatNumber(data.pfEmployer) : '';
}

function savePassiveIncomeData() {
  const monthSelect = document.getElementById('passive-month-select');
  if (!monthSelect) return;
  const month = monthSelect.value;

  if (!db.passiveIncomeData) db.passiveIncomeData = {};

  const activeIncome = parseLocalNumber(document.getElementById('pass-active-income').value);
  const expenses = parseLocalNumber(document.getElementById('pass-expenses').value);
  const pfEmployee = parseLocalNumber(document.getElementById('pass-pf-employee').value);
  const pfEmployer = parseLocalNumber(document.getElementById('pass-pf-employer').value);

  db.passiveIncomeData[month] = { activeIncome, expenses, pfEmployee, pfEmployer };
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
  
  // เงินเก็บที่เพิ่มขึ้น (Delta Wealth)
  const wealthDelta = currentWealth - prevWealth;

  // 2. ดึงค่าจากการกรอก
  const activeIncome = parseLocalNumber(document.getElementById('pass-active-income').value);
  const expenses = parseLocalNumber(document.getElementById('pass-expenses').value);
  const pfEmployee = parseLocalNumber(document.getElementById('pass-pf-employee').value);
  const pfEmployer = parseLocalNumber(document.getElementById('pass-pf-employer').value);
  const totalPF = pfEmployee + pfEmployer;

  // 3. สมการ: Passive Income = เงินเก็บที่เพิ่มขึ้น - active income - เงินเข้า pf + expense
  const passiveIncome = wealthDelta - activeIncome - totalPF + expenses;

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

  // คำนวณ % Passive Income เทียบกับ Active Income
  const ratioEl = document.getElementById('pass-ratio-val');
  if (ratioEl) {
    if (activeIncome > 0) {
      const ratio = (passiveIncome / activeIncome) * 100;
      ratioEl.innerText = `คิดเป็น ${ratio.toFixed(1)}% ของ Active Income`;
    } else {
      ratioEl.innerText = 'กรุณาระบุ Active Income เพื่อดูสัดส่วน';
    }
  }
}
