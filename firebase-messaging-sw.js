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

// Track last shown notification to prevent duplicates (works on both iOS & Android)
let lastNotifTag = null;
let lastNotifTime = 0;

messaging.onBackgroundMessage((payload) => {
    console.log('Background message:', payload);

    const title = payload.notification?.title || 'Apple Air WiFi 🔔';
    const body  = payload.notification?.body  || 'You have a new notification';
    const url   = payload.data?.url || 'https://vcheckair.vercel.app';
    const tag   = payload.data?.tag || 'apple-air-general';

    // Prevent duplicate: same tag within 5 seconds = skip
    const now = Date.now();
    if (tag === lastNotifTag && (now - lastNotifTime) < 5000) {
        console.log('Duplicate notification blocked:', tag);
        return;
    }
    lastNotifTag = tag;
    lastNotifTime = now;

    return self.registration.showNotification(title, {
        body:               body,
        icon:               '/icons/icon-192.png',
        badge:              '/icons/icon-192.png',
        vibrate:            [200, 100, 200, 100, 200],
        requireInteraction: true,
        tag:                tag,
        renotify:           false,
        data:               { url: url }
    });
});

// Handle notification click — open or focus app
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
