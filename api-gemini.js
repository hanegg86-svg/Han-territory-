// ================= GEMINI API KEY MANAGEMENT =================
function getStoredApiKey() { return localStorage.getItem('GEMINI_API_KEY') || ''; }

function saveApiKey() {
  const input = document.getElementById('gemini-api-key-input');
  if(!input) return;
  const key = input.value.trim();
  if(!key) return alert('กรุณากรอก API Key ก่อนบันทึก');
  localStorage.setItem('GEMINI_API_KEY', key);
  updateApiKeyStatusBadge();
  showToast('บันทึก Gemini API Key เรียบร้อยแล้ว');
}

function clearApiKey() {
  if(confirm('ยืนยันลบ Gemini API Key ในเครื่องหรือไม่?')) {
    localStorage.removeItem('GEMINI_API_KEY');
    const input = document.getElementById('gemini-api-key-input');
    if(input) input.value = '';
    updateApiKeyStatusBadge();
    showToast('ลบ API Key เรียบร้อยแล้ว');
  }
}

function toggleApiKeyVisibility() {
  const input = document.getElementById('gemini-api-key-input');
  const icon = document.getElementById('toggle-key-icon');
  if(!input || !icon) return;
  if (input.type === 'password') {
    input.type = 'text';
    icon.classList.replace('fa-eye', 'fa-eye-slash');
  } else {
    input.type = 'password';
    icon.classList.replace('fa-eye-slash', 'fa-eye');
  }
}

function updateApiKeyStatusBadge() {
  const badge = document.getElementById('api-key-status-badge');
  const input = document.getElementById('gemini-api-key-input');
  const key = getStoredApiKey();

  if(input && key) input.value = key;

  if(badge) {
    if(key) {
      badge.className = "inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30";
      badge.innerHTML = `<i class="fa-solid fa-circle-check mr-1.5"></i> พร้อมใช้งาน Gemini API Key`;
    } else {
      badge.className = "inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30";
      badge.innerHTML = `<i class="fa-solid fa-triangle-exclamation mr-1.5"></i> ยังไม่ได้บันทึก API Key`;
    }
  }
}

// ================= GEMINI AI OCR SCAN =================
async function processImageWithGemini(event) {
  const files = event.target.files;
  if (!files || files.length === 0) return;

  const apiKey = getStoredApiKey();
  if (!apiKey) {
    alert('กรุณากรอกและบันทึก Gemini API Key ในแท็บ "ตั้งค่า" ก่อนเปิดใช้งานสแกนภาพครับ');
    switchTab('tab-setup');
    return;
  }

  showToast(`กำลังสแกนรูปภาพจำนวน ${files.length} ภาพ ด้วย Gemini 3.1 Flash-Lite AI...`);

  const readFileAsBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({
        base64Data: reader.result.split(',')[1],
        mimeType: file.type || 'image/jpeg'
      });
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  try {
    let matchedCount = 0;

    for (let file of files) {
      const { base64Data, mimeType } = await readFileAsBase64(file);

      const promptText = `
        Analyze this screenshot. It could be a Portfolio Overview, Mutual Fund list, or Bond/Debenture table.
        
        Return ONLY a clean JSON object with two fields:
        1. "portfolio": If it is a Portfolio Overview showing "รายละเอียดสินทรัพย์", extract cash and stock amounts (e.g. {"cash": 86173.00, "stock": 158240.00}). Set to null if not present.
        2. "items": Array of fund/stock/debenture items with unit prices/NAV (e.g. [{"symbol": "GULF300A", "nav": 1010.46}, {"symbol": "K-SF-SSF", "nav": 11.9896}]).
           - Map the price value (whether it is NAV, Market unit price, or unit price) directly to "nav".

        Return strictly valid JSON syntax without markdown blocks:
        {"portfolio": null, "items": []}
      `;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: promptText },
              { inline_data: { mime_type: mimeType, data: base64Data } }
            ]
          }]
        })
      });

      const resData = await response.json();
      if (resData.error) continue;

      const rawText = resData.candidates[0].content.parts[0].text.trim();
      const jsonStr = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsedData = JSON.parse(jsonStr);

      // กรณีที่ 1: หน้าสรุปพอร์ตหุ้น + เงินสด (อัปเดตลงช่องมูลค่ารวมโดยตรง)
      if (parsedData.portfolio) {
        const cashVal = parseFloat(parsedData.portfolio.cash) || 0;
        const stockVal = parseFloat(parsedData.portfolio.stock) || 0;
        const totalStockPlusCash = cashVal + stockVal;

        if (totalStockPlusCash > 0) {
          const matchedStockFund = db.funds.find(f => {
            const fSymbol = (f.symbol || '').toUpperCase().trim();
            const fName = (f.name || '').toUpperCase().trim();
            return fSymbol === 'หุ้น' || fName === 'หุ้น' || fSymbol === 'STOCK' || fName.includes('หุ้น');
          });

          if (matchedStockFund) {
            const totalInput = document.getElementById(`entry-${matchedStockFund.id}`);
            if (totalInput) {
              totalInput.value = formatNumber(totalStockPlusCash);
              autoCalcMonthlyFund(matchedStockFund.id, 'total');
              matchedCount++;
            }
          }
        }
      }

      // กรณีที่ 2: หน้าตารางกองทุนรวม / หุ้นกู้ / ตราสารหนี้ (อัปเดตลงช่อง NAV)
      if (Array.isArray(parsedData.items) && parsedData.items.length > 0) {
        parsedData.items.forEach(item => {
          const scannedCode = (item.symbol || '').toUpperCase().trim();
          const navVal = parseFloat(item.nav);

          if (scannedCode && !isNaN(navVal) && navVal > 0) {
            const matchedFund = db.funds.find(f => {
              const fSymbol = (f.symbol || '').toUpperCase().trim();
              const fName = (f.name || '').toUpperCase().trim();
              return fSymbol === scannedCode || fName === scannedCode || scannedCode.includes(fSymbol) || fSymbol.includes(scannedCode);
            });

            if (matchedFund) {
              const navEl = document.getElementById(`entry-nav-${matchedFund.id}`);
              if (navEl) {
                navEl.value = navVal; // วางราคา NAV/Market (เช่น 1010.46 หรือ 11.9896)
                autoCalcMonthlyFund(matchedFund.id, 'nav'); // ระบบคูณจำนวนหน่วยแล้วคำนวณยอดรวมให้อัตโนมัติ
                matchedCount++;
              }
            }
          }
        });
      }
    }

    if (matchedCount > 0) {
      showToast(`อัปเดตข้อมูลสำเร็จรวม ${matchedCount} รายการ!`);
    } else {
      alert('สแกนสำเร็จแต่ไม่พบรายการที่ตรงกับ Symbol ในระบบ กรุณาตรวจสอบแท็บตั้งค่า');
    }

  } catch (err) {
    console.error(err);
    alert('เกิดข้อผิดพลาดในการประมวลผล Gemini AI: ' + err.message);
  } finally {
    event.target.value = ''; 
  }
}
