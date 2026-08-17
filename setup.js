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
