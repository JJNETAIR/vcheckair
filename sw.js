/**
 * Apple Air - Service Worker
 * Handles caching + Firebase FCM push notifications
 */

// Apple Air Service Worker - handles caching + background notifications

// ── CACHING ──────────────────────────────────────────────────────────
const CACHE_NAME = 'apple-air-v5-cache'; // bumped to force fresh install
const ASSETS = ['/', '/index.html', '/admin.html'];

self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(ASSETS).catch(() => {})));
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.map((k) => k !== CACHE_NAME && caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (e) => {
    if (e.request.url.includes('google.com') ||
        e.request.url.includes('format=csv') ||
        e.request.url.includes('firebaseio.com') ||
        e.request.url.includes('googleapis.com')) return;
    e.respondWith(
        caches.match(e.request).then((res) => res || fetch(e.request))
    );
});

// ── NOTIFICATION CLICK ───────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
            if (list.length > 0) return list[0].focus();
            return clients.openWindow(event.notification.data?.url || '/');
        })
    );
});
