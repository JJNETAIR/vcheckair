importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyCJV-VOwwMqW5tCBROotu0U_Uju0PKyy8Q",
    authDomain: "apple-air.firebaseapp.com",
    projectId: "apple-air",
    storageBucket: "apple-air.firebasestorage.app",
    messagingSenderId: "714071308022",
    appId: "1:714071308022:web:c7d61d4df7f1693f3f5ed7"
});

const messaging = firebase.messaging();
const NOTIF_CACHE = 'apple-air-notif-cache';
const DEDUP_WINDOW_MS = 10000; // 10 seconds

messaging.onBackgroundMessage(async (payload) => {
    console.log('[SW] Background message received');

    const title = payload.notification?.title || payload.data?.title || 'Apple Air WiFi 🔔';
    const body  = payload.notification?.body  || payload.data?.body  || 'You have a new notification';
    const url   = payload.data?.url || 'https://vcheckair.vercel.app';
    const tag   = payload.data?.tag || payload.notification?.title || ('apple-air-' + Date.now());

    // ── DEDUPLICATION using Cache API ─────────────────────────
    // Prevents 2 SW registrations from both showing same notification
    try {
        const cache = await caches.open(NOTIF_CACHE);
        const cacheKey = new Request('https://apple-air-dedup/' + tag);
        const cached = await cache.match(cacheKey);

        if (cached) {
            const cachedTime = parseInt(await cached.text());
            if (Date.now() - cachedTime < DEDUP_WINDOW_MS) {
                console.log('[SW] Duplicate blocked:', tag);
                return; // Skip — already shown by other SW instance
            }
        }

        // Mark as shown
        await cache.put(cacheKey, new Response(String(Date.now())));

        // Clean up old cache entries after 30 seconds
        setTimeout(async () => {
            try { await cache.delete(cacheKey); } catch(e) {}
        }, 30000);

    } catch(e) {
        console.log('[SW] Cache dedup error (non-critical):', e.message);
    }
    // ──────────────────────────────────────────────────────────

    return self.registration.showNotification(title, {
        body,
        icon:               '/icons/icon-192.png',
        badge:              '/icons/icon-192.png',
        vibrate:            [200, 100, 200],
        requireInteraction: true,
        tag,
        renotify:           true,
        data:               { url }
    });
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = event.notification.data?.url || 'https://vcheckair.vercel.app';
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                for (const client of clientList) {
                    if (client.url.includes('vcheckair.vercel.app') && 'focus' in client) {
                        return client.focus();
                    }
                }
                return clients.openWindow(url);
            })
            .catch(() => clients.openWindow(url))
    );
});
