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

  showToast(`กำลังสแกนรูปภาพจำนวน ${files.length} ภาพ ด้วย Gemini 3.5 Flash-Lite AI...`);

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
        Analyze this screenshot. It can be a Portfolio Overview, Mutual Fund list, or Bond/Debenture table.
        Extract investment values and return ONLY valid JSON (no markdown, no code block).

        Expected JSON format:
        {
          "portfolio": {"cash": 0, "stock": 0},
          "items": [{"symbol": "CODE", "nav": 0}]
        }

        Rules:
        1. Portfolio Overview ("รายละเอียดสินทรัพย์"): set "portfolio" with "cash" and "stock" values.
        2. Bond/Debenture/Mutual Fund tables: set "items" array with "symbol" (Code) and "nav" (Market unit price / NAV).
      `;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`, {
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
      if (resData.error) {
        console.error("Gemini Error:", resData.error);
        alert('Gemini Error: ' + resData.error.message);
        continue;
      }

      let rawText = resData.candidates[0].content.parts[0].text.trim();
      
      // ล้าง Markdown Block ออกแบบครอบคลุม
      rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
      const firstBrace = rawText.indexOf('{');
      const lastBrace = rawText.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        rawText = rawText.substring(firstBrace, lastBrace + 1);
      }

      const parsedData = JSON.parse(rawText);

      // 1. สแกนหน้าพอร์ตหุ้น / เงินสด
      if (parsedData.portfolio && (parsedData.portfolio.cash > 0 || parsedData.portfolio.stock > 0)) {
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

      // 2. สแกนหน้ากองทุน / หุ้นกู้ / ตราสารหนี้
      if (Array.isArray(parsedData.items) && parsedData.items.length > 0) {
        parsedData.items.forEach(item => {
          const scannedCode = (item.symbol || '').toUpperCase().trim();
          const navVal = parseFloat(item.nav);

          if (scannedCode && !isNaN(navVal) && navVal > 0) {
            const matchedFund = db.funds.find(f => {
              const fSymbol = (f.symbol || '').toUpperCase().trim();
              const fName = (f.name || '').toUpperCase().trim();
              if (!fSymbol && !fName) return false;

              // เช็กแมตช์รหัสแบบยืดหยุ่น (แมตช์ทั้งกรณี SGP292A และ SGP292A12)
              return fSymbol === scannedCode || 
                     fName === scannedCode || 
                     scannedCode.startsWith(fSymbol) || 
                     fSymbol.startsWith(scannedCode);
            });

            if (matchedFund) {
              const navEl = document.getElementById(`entry-nav-${matchedFund.id}`);
              if (navEl) {
                navEl.value = navVal;
                autoCalcMonthlyFund(matchedFund.id, 'nav');
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
      alert('สแกนสำเร็จแต่ไม่อัปเดตค่า! กรุณาเช็กในแท็บ "ตั้งค่า" ว่าใส่รหัส Symbol ตรงกับในรูปหรือยัง');
    }

  } catch (err) {
    console.error("Parse Error:", err);
    alert('เกิดข้อผิดพลาดในการประมวลผลรูปภาพ: ' + err.message);
  } finally {
    event.target.value = ''; 
  }
}
