// ================= SERVICE WORKER WITH AUTOMATIC CACHE CLEARING =================
const CACHE_VERSION = 'v3.6.0';
const CACHE_NAME = `prowealth-cache-${CACHE_VERSION}`;

// รายการไฟล์ Core App ที่ต้องบันทึกลงแคชเพื่อใช้งานแบบ Offline
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './config-store.js',
  './api-gemini.js',
  './setup.js',
  './entry.js',
  './compare.js',
  './charts.js',
  './nav-charts.js',
  './allocation.js',
  './planning.js',
  './passive-income.js',
  './transactions.js',
  './app.js'
];

// 1. INSTALL: ติดตั้ง Service Worker และดึงไฟล์เข้าแคช
self.addEventListener('install', (event) => {
  console.log(`[SW] Installing Service Worker ${CACHE_VERSION}...`);
  // บังคับให้ Service Worker ใหม่เริ่มทำงานทันทีโดยไม่ต้องรอแท็บเก่าปิด (skipWaiting)
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching offline assets...');
      return Promise.allSettled(
        STATIC_ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn(`[SW] Could not cache asset: ${url}`, err);
          })
        )
      );
    })
  );
});

// 2. ACTIVATE: ล้างแคชเวอร์ชันเก่าทั้งหมดทิ้งอัตโนมัติ
self.addEventListener('activate', (event) => {
  console.log(`[SW] Activating Service Worker ${CACHE_VERSION}...`);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((existingCache) => {
          // หากชื่อแคชไม่ตรงกับแคชเวอร์ชันปัจจุบัน ให้ทำการลบทิ้งทันที
          if (existingCache !== CACHE_NAME) {
            console.log(`[SW] Deleting old cache: ${existingCache}`);
            return caches.delete(existingCache);
          }
        })
      );
    }).then(() => {
      // ควบคุมหน้าเว็บทั้งหมดทันที
      return self.clients.claim();
    })
  );
});

// 3. FETCH: กลยุทธ์ Network-First with Cache Fallback
// ดึงข้อมูลสดจาก Network ก่อนเสมอ เพื่อให้ได้โค้ดเวอร์ชันล่าสุดเสมอ หาก Offline จึงดึงจากแคช
self.addEventListener('fetch', (event) => {
  // รองรับเฉพาะ GET request
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // ข้ามการแคชสำหรับ Gemini API
  if (url.hostname.includes('googleapis.com')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // หากดึงผ่าน Network สำเร็จ ให้นำไปอัปเดตลงแคช
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // หากไม่มีอินเทอร์เน็ต (Offline) ให้ดึงจากแคชที่มีอยู่
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // หากขอไฟล์ html แล้วไม่พบ ให้ fallback ไปที่ index.html
          if (event.request.headers.get('accept')?.includes('text/html')) {
            return caches.match('./index.html');
          }
        });
      })
  );
});

// 4. MESSAGE: รับคำสั่งล้างแคชหรือข้ามการรอจากหน้าเว็บ
self.addEventListener('message', (event) => {
  if (event.data) {
    if (event.data.action === 'skipWaiting') {
      self.skipWaiting();
    }
    if (event.data.action === 'clearCache') {
      caches.keys().then((names) => {
        return Promise.all(names.map((name) => caches.delete(name)));
      }).then(() => {
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({ success: true });
        }
      });
    }
  }
});