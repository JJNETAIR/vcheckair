const CACHE_NAME = 'apple-air-v1-cache';
const ASSETS = [ '/', '/index.html', '/admin.html', '/app.js', '/admin.js', 'https://cdn.tailwindcss.com' ];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((k) => k !== CACHE_NAME && caches.delete(k)))));
  return self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.url.includes('google.com') || e.request.url.includes('format=csv')) return;
  e.respondWith(caches.match(e.request).then((res) => res || fetch(e.request)));
});