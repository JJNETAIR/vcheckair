/**
 * Apple Air - User Portal Interface Engine (FIXED)
 */

const STORAGE_KEY = 'apple_air_active_voucher';
const DB_VOUCHERS_KEY = 'apple_air_voucher_database';
const MOCK_API_DELAY = 800;

let currentState = { activeVoucher: null, isOnline: navigator.onLine, dashboardData: null };

document.addEventListener('DOMContentLoaded', () => {
    initializeNetworkListeners();
    checkExistingVoucherSession();
});

function initializeNetworkListeners() {
    window.addEventListener('online', () => handleConnectivityChange(true));
    window.addEventListener('offline', () => handleConnectivityChange(false));
}

function handleConnectivityChange(status) {
    currentState.isOnline = status;
    const speedBadge = document.getElementById('dash-speed');
    if (!speedBadge) return;
    if (!status) {
        speedBadge.innerText = "Offline Mode";
        speedBadge.className = "text-sm font-medium bg-amber-50 text-amber-600 px-3 py-1 rounded-md apple-transition";
    } else if (currentState.dashboardData) {
        speedBadge.innerText = currentState.dashboardData.speedTier;
        speedBadge.className = "text-sm font-medium bg-blue-50 text-blue-600 px-3 py-1 rounded-md apple-transition";
    }
}

function checkExistingVoucherSession() {
    const savedVoucher = localStorage.getItem(STORAGE_KEY);
    if (savedVoucher) {
        currentState.activeVoucher = savedVoucher;
        document.getElementById('voucher-input').value = savedVoucher;
        fetchVoucherStatusFromServer(savedVoucher);
    } else {
        renderView('view-entry');
    }
}

function renderView(viewId) {
    const views = ['view-entry', 'view-dashboard', 'view-loading'];
    views.forEach(v => {
        const el = document.getElementById(v);
        if (!el) return;
        if (v === viewId) {
            el.classList.remove('hidden');
            setTimeout(() => el.classList.remove('opacity-0', 'translate-y-4'), 30);
        } else {
            el.classList.add('hidden', 'opacity-0', 'translate-y-4');
        }
    });
}

function processVoucherVerification() {
    const code = document.getElementById('voucher-input').value.trim().toUpperCase();
    if (!code) return displaySystemToast('Please enter a voucher code.');
    fetchVoucherStatusFromServer(code);
}

function fetchVoucherStatusFromServer(voucherCode) {
    renderView('view-loading');
    
    setTimeout(() => {
        // Read the local memory database saved by the admin page
        const database = JSON.parse(localStorage.getItem(DB_VOUCHERS_KEY)) || [];
        
        console.log("Searching database for code:", voucherCode); // Debug helper
        console.log("Current Database Content:", database);

        // Flexible search matching numbers or text strings smoothly
        const matchedVoucher = database.find(v => String(v.code).trim().toUpperCase() === String(voucherCode).trim().toUpperCase());

        if (!matchedVoucher) {
            displaySystemToast('Voucher not found. Please verify your entry.');
            renderView('view-entry');
            return;
        }

        // Commit active session details
        localStorage.setItem(STORAGE_KEY, voucherCode);
        currentState.activeVoucher = voucherCode;
        currentState.dashboardData = matchedVoucher;

        // Map live properties directly onto UI design elements
        document.getElementById('dash-code-display').innerText = matchedVoucher.code;
        document.getElementById('dash-time').innerText = matchedVoucher.timeRemaining;
        document.getElementById('dash-data').innerText = matchedVoucher.dataAllowance;
        document.getElementById('dash-speed').innerText = matchedVoucher.speedTier;
        
        // Fire notification control setup dynamically
        setupNotification(matchedVoucher.timeRemaining, matchedVoucher.code);
        
        renderView('view-dashboard');
    }, MOCK_API_DELAY);
}

// 🔔 PERSISTENT DEVICE NOTIFICATION CONTROLLER (SCOPED BY VOUCHER)
function setupNotification(expiryDateString, voucherCode) {
    const notifySection = document.getElementById('notification-section');
    const notifyBtn = document.getElementById('notify-me-btn');
    const notifyStatus = document.getElementById('notify-status');
    
    if (!notifySection || !notifyBtn || !notifyStatus) return;

    // Create unique keys tied explicitly to this individual voucher code
    const storageKeyDate = `alert_date_${voucherCode.toLowerCase()}`;
    const storageKeyStatus = `alert_status_${voucherCode.toLowerCase()}`;

    // Show the wrapper panel layout
    notifySection.classList.remove('hidden');

    // STATE CHECK: If this exact voucher already possesses a saved reminder, render success state immediately
    if (localStorage.getItem(storageKeyDate)) {
        const existingAlertString = localStorage.getItem(storageKeyDate);
        notifyBtn.innerHTML = '<span>Reminder Scheduled!</span> <span>✅</span>';
        notifyBtn.className = "w-full py-3 px-4 rounded-xl bg-green-50/80 border border-green-200 text-green-600 font-medium flex items-center justify-center space-x-2 pointer-events-none";
        
        notifyStatus.innerText = `We will alert you on ${existingAlertString}`;
        notifyStatus.classList.remove('hidden');
        return; 
    }

    // Reset button layouts to regular blue accent state if it's a completely un-armed voucher
    notifyBtn.innerHTML = '<span>Notify Me 1 Day Before Expiry</span> <span>🔔</span>';
    notifyBtn.className = "w-full py-3 px-4 rounded-xl bg-blue-50/80 border border-blue-200 text-blue-600 font-medium flex items-center justify-center space-x-2 active:scale-95 transition-transform";
    notifyStatus.classList.add('hidden');

    notifyBtn.onclick = async () => {
        if (!('Notification' in window)) {
            alert('This device or browser profile does not support web pushes.');
            return;
        }

        const permission = await Notification.requestPermission();
        
        if (permission === 'granted') {
            // Parse expiry date (Assuming DD/MM/YYYY format out of Google Sheets extraction)
            const parts = expiryDateString.split('/');
            let expiryDate;
            
            if (parts.length === 3) {
                expiryDate = new Date(parts[2], parts[1] - 1, parts[0]);
            } else {
                expiryDate = new Date(expiryDateString);
            }

            if (isNaN(expiryDate.getTime())) {
                notifySection.classList.add('hidden');
                return;
            }
            
            // Subtract 1 day to find the target alert date execution window
            const alertDate = new Date(expiryDate);
            alertDate.setDate(alertDate.getDate() - 1);
            
            const alertString = alertDate.toLocaleDateString('en-GB'); // DD/MM/YYYY
            
            // Save settings locally to device storage
            localStorage.setItem(storageKeyDate, alertString);
            localStorage.setItem(storageKeyStatus, 'pending');

            // ── Save FCM token to Subscribers sheet for broadcast ──
            try {
                if (typeof firebase !== 'undefined' && window.fcmMessaging) {
                    const VAPID_KEY = "BGeRhehk4k_iL9OfCIlKLEzT7RDxYcmkE-Pe1f8xXrAUE95Zhljn1WUsbq3y48lEB3K47yOzizNhXsTZK6oOrDo";
                    const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxRx3bHJiY_AmBBQWuTSBnEtiFi8K1rPUZp18LKpQbg1Xi3q_xYWNSrvrcFHUkeic85/exec';
                    const fcmToken = await window.fcmMessaging.getToken({ vapidKey: VAPID_KEY });
                    if (fcmToken) {
                        await fetch(APPS_SCRIPT_URL, {
                            method: 'POST',
                            mode: 'no-cors',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                type: 'subscriber',
                                fcmToken: fcmToken,
                                voucherCode: voucherCode,
                                subscribedAt: new Date().toLocaleDateString('en-GB')
                            })
                        });
                        console.log('✅ Subscriber token saved to Subscribers sheet');
                    }
                }
            } catch(e) { console.log('Subscriber save (non-critical):', e.message); }
            
            // Visual dynamic structural transformation
            notifyBtn.innerHTML = '<span>Reminder Scheduled!</span> <span>✅</span>';
            notifyBtn.className = "w-full py-3 px-4 rounded-xl bg-green-50/80 border border-green-200 text-green-600 font-medium flex items-center justify-center space-x-2 pointer-events-none";
            
            notifyStatus.innerText = `We will alert you on ${alertString}`;
            notifyStatus.classList.remove('hidden');
        } else {
            alert("Please enable notification permissions in your browser settings to use this feature.");
        }
    };
}

function disconnectActiveVoucherSession() {
    localStorage.removeItem(STORAGE_KEY);
    currentState.activeVoucher = null;
    currentState.dashboardData = null;
    document.getElementById('voucher-input').value = '';
    
    // Hide notification section on dashboard log out
    const notifySection = document.getElementById('notification-section');
    if (notifySection) notifySection.classList.add('hidden');

    renderView('view-entry');
}

function displaySystemToast(message) {
    const old = document.getElementById('apple-toast');
    if (old) old.remove();
    const toast = document.createElement('div');
    toast.id = 'apple-toast';
    toast.className = "fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-[#1D1D1F]/90 text-white text-xs font-medium px-5 py-3 rounded-full backdrop-blur-md shadow-2xl transition-all duration-300 opacity-0 translate-y-2 z-50 pointer-events-none tracking-wide text-center min-w-[260px]";
    toast.innerText = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.remove('opacity-0', 'translate-y-2'), 50);
    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}
