/**
 * Apple Air - Master Service Worker (Caching + Background Sync Engine)
 */

const CACHE_NAME = 'apple-air-v1-cache';
const ASSETS = [
  '/',
  '/index.html',
  '/admin.html',
  '/app.js',
  '/admin.js',
  'https://cdn.tailwindcss.com'
];

// ==========================================
// 📦 LIFECYCLE & CACHING MANAGEMENT
// ==========================================

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((c) => c.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((keys) => 
        Promise.all(keys.map((k) => k !== CACHE_NAME && caches.delete(k)))
      ),
      // Claim clients immediately
      self.clients.claim(),
      // Pre-check any alerts immediately on activation backup
      scanAndTriggerVoucherNotifications()
    ])
  );
});

self.addEventListener('fetch', (e) => {
  // Bypass cache completely for real-time validation data streaming
  if (e.request.url.includes('google.com') || e.request.url.includes('format=csv') || e.request.url.includes('jsonbin.io')) {
    return;
  }
  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request))
  );
});

// ==========================================
// 🔔 DATABASE & BACKGROUND NOTIFICATION ENGINE
// ==========================================

// Native helper to read a value from IndexedDB inside a Service Worker cleanly
function getIndexedDBValue(key) {
  return new Promise((resolve) => {
    const request = indexedDB.open('AppleAirDB', 1);
    
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('alerts')) {
        db.createObjectStore('alerts');
      }
    };

    request.onsuccess = (e) => {
      const db = e.target.result;
      try {
        const transaction = db.transaction('alerts', 'readonly');
        const store = transaction.objectStore('alerts');
        const getReq = store.get(key);
        getReq.onsuccess = () => resolve(getReq.result || null);
        getReq.onerror = () => resolve(null);
      } catch (err) {
        resolve(null);
      }
    };

    request.onerror = () => resolve(null);
  });
}

// Native helper to write/update a value in IndexedDB
function setIndexedDBValue(key, value) {
  return new Promise((resolve) => {
    const request = indexedDB.open('AppleAirDB', 1);
    request.onsuccess = (e) => {
      const db = e.target.result;
      try {
        const transaction = db.transaction('alerts', 'readwrite');
        const store = transaction.objectStore('alerts');
        store.put(value, key);
        transaction.oncomplete = () => resolve(true);
      } catch (err) {
        resolve(false);
      }
    };
    request.onerror = () => resolve(false);
  });
}

// Background Date Checker for Expiry Reminders via Periodic Sync
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-voucher-expiry') {
    event.waitUntil(scanAndTriggerVoucherNotifications());
  }
});

async function scanAndTriggerVoucherNotifications() {
  const request = indexedDB.open('AppleAirDB', 1);
  
  return new Promise((resolve) => {
    request.onsuccess = (e) => {
      const db = e.target.result;
      try {
        const transaction = db.transaction('alerts', 'readwrite');
        const store = transaction.objectStore('alerts');
        const cursorRequest = store.openCursor();
        
        const todayString = new Date().toLocaleDateString('en-GB'); // DD/MM/YYYY

        cursorRequest.onsuccess = async (event) => {
          const cursor = event.target.result;
          if (cursor) {
            const key = cursor.key; // e.g., "alert_date_123456"
            const dataValue = cursor.value;

            // Identify if the key is a date reminder tracking point
            if (key.startsWith('alert_date_') && dataValue === todayString) {
              const voucherCode = key.replace('alert_date_', '').toUpperCase();
              const statusKey = `alert_status_${voucherCode.toLowerCase()}`;
              
              // Check the status block using our DB reader helper
              const currentStatus = await getIndexedDBValue(statusKey);

              if (currentStatus === 'pending') {
                // Instantly flip status flag to prevent infinite loops/duplicate alerts
                await setIndexedDBValue(statusKey, 'triggered');
                
                // Fire the native OS notification alert banner!
                await self.registration.showNotification('Apple Air Wi-Fi 🔔', {
                  body: `Your internet voucher (${voucherCode}) expires tomorrow! Top up soon to avoid disconnection.`,
                  icon: '/icons/icon-192.png',
                  badge: '/icons/icon-192.png',
                  vibrate: [200, 100, 200],
                  data: { url: '/' }
                });
              }
            }
            cursor.continue();
          } else {
            resolve();
          }
        };
        cursorRequest.onerror = () => resolve();
      } catch (err) {
        resolve();
      }
    };
    request.onerror = () => resolve();
  });
}

// Push click handler to open interface layout automatically when clicked
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        return clientList[0].focus();
      }
      return clients.openWindow(event.notification.data.url || '/');
    })
  );
});
