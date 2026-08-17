// ================= RETIREMENT SIMULATOR MODULE =================
function calculateRetirement(shouldSaveState = false) {
  const sortedMonths = Object.keys(db.records || {}).sort();
  let latestMonth = sortedMonths.length > 0 ? sortedMonths[sortedMonths.length - 1] : null;
  let prevMonth = sortedMonths.length > 1 ? sortedMonths[sortedMonths.length - 2] : null;

  const getMonthTotal = (m) => {
    if (!m || !db.records || !db.records[m]) return 0;
    return (db.funds || []).reduce((sum, f) => sum + (db.records[m][f.id] || 0), 0);
  };

  let latestWealth = getMonthTotal(latestMonth);
  let prevWealth = getMonthTotal(prevMonth);

  // เงินที่สะสมเพิ่มได้จริงในเดือนล่าสุด
  let currentMonthSaved = latestWealth - prevWealth;

  // คำนวณยอดออมจริงเฉลี่ยของปีนี้
  const currentYearStr = latestMonth ? latestMonth.split('-')[0] : new Date().getFullYear().toString();
  const monthsInCurrentYear = sortedMonths.filter(m => m.startsWith(currentYearStr));

  let totalSavingsYTD = 0;
  let savingsCountYTD = 0;

  monthsInCurrentYear.forEach(m => {
    const index = sortedMonths.indexOf(m);
    if (index > 0) {
      const prevM = sortedMonths[index - 1];
      const savedAmount = getMonthTotal(m) - getMonthTotal(prevM);
      totalSavingsYTD += savedAmount;
      savingsCountYTD++;
    }
  });

  let avgSavingsYTD = savingsCountYTD > 0 ? (totalSavingsYTD / savingsCountYTD) : 0;

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
  if (prevSavedEl) prevSavedEl.innerText = '฿' + formatNumber(avgSavingsYTD);
  if (prevLabelEl) prevLabelEl.innerText = `ยอดออมเฉลี่ย (ปี ${currentYearStr})`;

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
      
      // ดึงค่า lifestyle เพื่อเลือก Radio Button ให้อัตโนมัติ (รองรับ 20k, 40k, 50k, 70k)
      if (db.planningSettings.lifestyle) {
        const radio = document.querySelector(`input[name="sim-lifestyle"][value="${db.planningSettings.lifestyle}"]`);
        if (radio) radio.checked = true;
      }
      calculateRetirement(false);
    }, 50);
  }
}
