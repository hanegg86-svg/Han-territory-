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
