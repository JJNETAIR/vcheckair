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

// Handle background messages
messaging.onBackgroundMessage((payload) => {
    console.log('Background message:', payload);
    self.registration.showNotification(
        payload.notification?.title || 'Apple Air WiFi 🔔',
        {
            body: payload.notification?.body || 'You have a notification',
            icon: '/icons/icon-192.png',
            badge: '/icons/icon-192.png',
            vibrate: [200, 100, 200],
            data: { url: '/' }
        }
    );
});
