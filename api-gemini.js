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

  // อัปเดตข้อความแจ้งเตือนผู้ใช้เป็นโมเดล Gemini 3.5 Flash-Lite
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

      // รายชื่อ Model โดยตั้งค่า gemini-3.5-flash-lite เป็นตัวหลัก
      const modelsToTry = [
        'gemini-3.5-flash-lite',
        'gemini-2.5-flash-lite',
        'gemini-1.5-flash'
      ];

      let resData = null;
      let lastError = null;

      // Loop ยิง API ด้วยโมเดลหลัก หากมีปัญหาจะเปลี่ยนโมเดลสำรองอัตโนมัติ
      for (const model of modelsToTry) {
        try {
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
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

          const data = await response.json();
          if (!data.error) {
            resData = data;
            break; // ยิงสำเร็จ ให้ลูปจบการทำงาน
          } else {
            lastError = data.error;
            console.warn(`Model ${model} failed, trying next fallback...`, data.error);
          }
        } catch (fetchErr) {
          lastError = fetchErr;
        }
      }

      if (!resData) {
        console.error("Gemini All Models Error:", lastError);
        alert('Gemini Error: ' + (lastError?.message || 'ไม่สามารถเชื่อมต่อ Gemini API ได้'));
        continue;
      }

      if (!resData.candidates || resData.candidates.length === 0 || !resData.candidates[0].content) {
        alert('ไม่พบผลลัพธ์การสแกนจาก Gemini AI');
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

      let parsedData;
      try {
        parsedData = JSON.parse(rawText);
      } catch (e) {
        console.error("JSON Parsing Error:", e, rawText);
        alert("ไม่สามารถแปลงข้อมูลที่ AI อ่านได้เป็น JSON รูปแบบถูกต้อง");
        continue;
      }

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

              const cleanScanned = scannedCode.replace(/[^A-Z0-9]/g, '');
              const cleanSymbol = fSymbol.replace(/[^A-Z0-9]/g, '');
              const cleanName = fName.replace(/[^A-Z0-9]/g, '');

              if (cleanSymbol === cleanScanned || cleanName === cleanScanned) return true;

              if (cleanSymbol.length >= 4 && cleanScanned.length >= 4) {
                if (cleanSymbol === cleanScanned) return true;
                if (cleanScanned.startsWith(cleanSymbol) && (cleanScanned.length - cleanSymbol.length <= 4)) return true;
                if (cleanSymbol.startsWith(cleanScanned) && (cleanSymbol.length - cleanScanned.length <= 4)) return true;
              }
              return false;
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
