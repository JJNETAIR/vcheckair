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
        
        renderView('view-dashboard');
    }, MOCK_API_DELAY);
}

function disconnectActiveVoucherSession() {
    localStorage.removeItem(STORAGE_KEY);
    currentState.activeVoucher = null;
    currentState.dashboardData = null;
    document.getElementById('voucher-input').value = '';
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