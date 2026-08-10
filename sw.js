const CACHE_NAME = 'wealth-tracker-v3.6.0';

// รายการไฟล์ทั้งหมดที่ต้องการให้ Service Worker ทำการ Caching ไว้สำหรับ Offline Mode
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon.png',
  // JS Modules ทั้ง 4 ไฟล์
  './config-store.js',
  './api-gemini.js',
  './modules-views.js',
  './app.js',
  // External Libraries
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js'
];

// 1. Install Event: ทำการดาวน์โหลดและเก็บบันทึกไฟล์ลง Cache Storage
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching all static assets');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// 2. Activate Event: ลบ Cache เวอร์ชั่นเก่าทิ้งทันทีที่มีการอัปเดตเวอร์ชัน
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Fetch Event: ดึงข้อมูลจาก Cache ก่อน หากไม่มีค่อยดึงจาก Network
self.addEventListener('fetch', (event) => {
  // ข้ามการทำ Caching สำหรับการเรียก Gemini API
  if (event.request.url.includes('generativelanguage.googleapis.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // คืนค่าไฟล์จาก Cache และทำ Background Refresh
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
          }
        }).catch(() => {/* Ignore network errors when offline */});
        
        return cachedResponse;
      }
      
      return fetch(event.request);
    })
  );
});
