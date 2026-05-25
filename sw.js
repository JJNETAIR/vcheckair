/**
 * Apple Air - Service Worker
 * Handles caching + OneSignal push notifications + background voucher alerts
 */

const CACHE_NAME = 'apple-air-v2-cache';
const ASSETS = ['/', '/index.html', '/admin.html', '/app.js', '/admin.js'];

// ── LIFECYCLE ────────────────────────────────────────────────────────
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(keys.map((k) => k !== CACHE_NAME && caches.delete(k)))
      ),
      self.clients.claim(),
      scanAndTriggerVoucherNotifications()
    ])
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.url.includes('google.com') ||
      e.request.url.includes('format=csv') ||
      e.request.url.includes('onesignal.com')) {
    return; // Don't cache OneSignal or Google Sheet requests
  }
  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request))
  );
});

// ── ONESIGNAL PUSH HANDLER ───────────────────────────────────────────
self.addEventListener('push', (e) => {
  if (!e.data) return;
  let data = {};
  try { data = e.data.json(); } catch(err) { data = { title: 'Apple Air', body: e.data.text() }; }

  e.waitUntil(
    self.registration.showNotification(data.title || 'Apple Air Wi-Fi 🔔', {
      body: data.body || 'You have a new notification',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      vibrate: [200, 100, 200],
      data: { url: data.url || '/' }
    })
  );
});

// ── NOTIFICATION CLICK ───────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) return clientList[0].focus();
      return clients.openWindow(event.notification.data?.url || '/');
    })
  );
});

// ── BACKGROUND VOUCHER EXPIRY CHECK ──────────────────────────────────
function getIndexedDBValue(key) {
  return new Promise((resolve) => {
    const request = indexedDB.open('AppleAirDB', 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('alerts')) db.createObjectStore('alerts');
    };
    request.onsuccess = (e) => {
      const db = e.target.result;
      try {
        const tx = db.transaction('alerts', 'readonly');
        const req = tx.objectStore('alerts').get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      } catch(err) { resolve(null); }
    };
    request.onerror = () => resolve(null);
  });
}

function setIndexedDBValue(key, value) {
  return new Promise((resolve) => {
    const request = indexedDB.open('AppleAirDB', 1);
    request.onsuccess = (e) => {
      const db = e.target.result;
      try {
        const tx = db.transaction('alerts', 'readwrite');
        tx.objectStore('alerts').put(value, key);
        tx.oncomplete = () => resolve(true);
      } catch(err) { resolve(false); }
    };
    request.onerror = () => resolve(false);
  });
}

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-voucher-expiry') {
    event.waitUntil(scanAndTriggerVoucherNotifications());
  }
});

async function scanAndTriggerVoucherNotifications() {
  return new Promise((resolve) => {
    const request = indexedDB.open('AppleAirDB', 1);
    request.onsuccess = (e) => {
      const db = e.target.result;
      try {
        const tx = db.transaction('alerts', 'readwrite');
        const store = tx.objectStore('alerts');
        const cursorReq = store.openCursor();
        const todayStr = new Date().toLocaleDateString('en-GB');

        cursorReq.onsuccess = async (event) => {
          const cursor = event.target.result;
          if (cursor) {
            const key = cursor.key;
            if (key.startsWith('alert_date_') && cursor.value === todayStr) {
              const code = key.replace('alert_date_', '').toUpperCase();
              const statusKey = `alert_status_${code.toLowerCase()}`;
              const status = await getIndexedDBValue(statusKey);
              if (status === 'pending') {
                await setIndexedDBValue(statusKey, 'triggered');
                await self.registration.showNotification('Apple Air Wi-Fi 🔔', {
                  body: `Your internet voucher (${code}) expires tomorrow! Top up soon.`,
                  icon: '/icons/icon-192.png',
                  badge: '/icons/icon-192.png',
                  vibrate: [200, 100, 200],
                  data: { url: '/' }
                });
              }
            }
            cursor.continue();
          } else { resolve(); }
        };
        cursorReq.onerror = () => resolve();
      } catch(err) { resolve(); }
    };
    request.onerror = () => resolve();
  });
}
