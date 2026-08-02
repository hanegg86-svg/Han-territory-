// 1. เพิ่มชื่อเวอร์ชันแคชไว้ด้านบนสุด (เปลี่ยนเลข v1 เป็น v2 เมื่อมีรูปหรือโค้ดใหม่)
const CACHE_NAME = 'wealth-tracker-v2';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon.png', // <-- รูปไอคอนใหม่ที่เราอัปโหลดทับ[span_1](start_span)[span_1](end_span)
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js'
];

// 2. ตอน Install ให้สั่งจำแคชตามชื่อ CACHE_NAME
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// 3. ตอน Activate ให้สั่งลบ Cache เวอร์ชันเก่าทิ้งทันที
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});
