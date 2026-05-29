// Firebase Messaging Service Worker
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

// Handle background messages (when app is closed/background)
messaging.onBackgroundMessage(async (payload) => {
    console.log('Background message received:', payload);

    // ── DUPLICATE PREVENTION ──────────────────────────────────
    // If app window is visible/focused → skip showing notification
    // (foreground handler in index.html will handle it instead)
    const clientList = await clients.matchAll({
        type: 'window',
        includeUncontrolled: true
    });
    const isAppOpen = clientList.some(client =>
        client.url.includes('vcheckair.vercel.app') &&
        client.visibilityState === 'visible'
    );
    if (isAppOpen) {
        console.log('App is open — skipping background notification to avoid duplicate');
        return;
    }

    const title = payload.notification?.title || 'Apple Air WiFi 🔔';
    const body  = payload.notification?.body  || 'You have a new notification';
    const url   = payload.data?.url || 'https://vcheckair.vercel.app';

    // Use unique tag per notification type to prevent stacking
    const tag = payload.data?.tag || 'apple-air-' + Date.now();

    await self.registration.showNotification(title, {
        body:              body,
        icon:              '/icons/icon-192.png',
        badge:             '/icons/icon-192.png',
        vibrate:           [200, 100, 200, 100, 200],
        requireInteraction: true,
        tag:               tag,
        renotify:          true,
        data:              { url: url },
        actions: [
            { action: 'open',  title: '📱 Open' },
            { action: 'close', title: '✕ Dismiss' }
        ]
    });
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    if (event.action === 'close') return;

    const url = event.notification.data?.url || 'https://vcheckair.vercel.app';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Focus existing tab if open
            for (const client of clientList) {
                if (client.url.includes('vcheckair.vercel.app') && 'focus' in client) {
                    return client.focus();
                }
            }
            // Otherwise open new tab
            return clients.openWindow(url);
        })
    );
});
