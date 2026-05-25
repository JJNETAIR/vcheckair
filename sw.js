/**
 * Apple Air - Service Worker
 * Handles caching + Firebase FCM push notifications
 */

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Firebase config
firebase.initializeApp({
    apiKey: "AIzaSyCJV-VOwwMqW5tCBROotu0U_Uju0PKyy8Q",
    authDomain: "apple-air.firebaseapp.com",
    projectId: "apple-air",
    storageBucket: "apple-air.firebasestorage.app",
    messagingSenderId: "714071308022",
    appId: "1:714071308022:web:c7d61d4df7f1693f3f5ed7"
});

const messaging = firebase.messaging();

// Handle background push messages
messaging.onBackgroundMessage((payload) => {
    console.log('Background message received:', payload);
    const { title, body, icon } = payload.notification || {};
    self.registration.showNotification(title || 'Apple Air Wi-Fi 🔔', {
        body: body || 'You have a new notification from Apple Air',
        icon: icon || '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        vibrate: [200, 100, 200],
        data: { url: payload.data?.url || '/' }
    });
});

// ── CACHING ──────────────────────────────────────────────────────────
const CACHE_NAME = 'apple-air-v2-cache';
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
