/**
 * Apple Air - Master Service Worker (V2 - Auto Cache Buster Engine)
 */

const CACHE_NAME = 'apple-air-v2-cache'; // ⚡ Flipped to V2 to force kill old stuck code!
const ASSETS = [
  './',
  './index.html',
  './admin.html',
  './app.js',
  './admin.js',
  'https://cdn.tailwindcss.com'
];

// ==========================================\n// 📦 LIFECYCLE & CACHING MANAGEMENT\n// ==========================================

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((c) => c.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((k) => {
          if (k !== CACHE_NAME) {
            console.log('Removing old stuck cache core:', k);
            return caches.delete(k);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  // Completely ignore live data feeds so they never stick or buffer old data
  if (e.request.url.includes('google.com') || e.request.url.includes('format=csv') || e.request.url.includes('jsonbin.io')) {
    return fetch(e.request);
  }
  
  e.respondWith(
    caches.match(e.request).then((res) => {
      return res || fetch(e.request).then((networkRes) => {
        return caches.open(CACHE_NAME).then((cache) => {
          // Cache static assets dynamically safely
          if (e.request.method === 'GET' && !e.request.url.includes('chrome-extension')) {
            cache.put(e.request, networkRes.clone());
          }
          return networkRes;
        });
      });
    }).catch(() => caches.match('./index.html'))
  );
});
