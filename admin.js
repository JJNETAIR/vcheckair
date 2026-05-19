const STORAGE_AUTH_KEY = 'apple_air_admin_auth';
const DB_VOUCHERS_KEY = 'apple_air_voucher_database';

document.addEventListener('DOMContentLoaded', () => {
    if (sessionStorage.getItem(STORAGE_AUTH_KEY) === 'true') displayAdminPanel();
});

function processAdminAuthentication() {
    const user = document.getElementById('admin-user').value;
    const pass = document.getElementById('admin-pass').value;
    if (user === 'admin' && pass === 'appleair2026') {
        sessionStorage.setItem(STORAGE_AUTH_KEY, 'true');
        displayAdminPanel();
    } else {
        displayToast('Invalid security verification credentials.');
    }
}

function displayAdminPanel() {
    document.getElementById('admin-auth-gate').classList.add('hidden');
    if(document.getElementById('btn-logout')) document.getElementById('btn-logout').classList.remove('hidden');
    const dashboard = document.getElementById('admin-dashboard');
    dashboard.classList.remove('hidden');
    setTimeout(() => dashboard.classList.remove('opacity-0', 'translate-y-4'), 50);
    const savedSheet = localStorage.getItem('apple_air_configured_sheet');
    if (savedSheet && document.getElementById('sheet-url-input')) {
        document.getElementById('sheet-url-input').value = savedSheet;
    }
}

async function triggerGoogleSheetSync() {
    const urlInput = document.getElementById('sheet-url-input').value.trim();
    if (!urlInput) return displayToast('Please enter a Google Sheet URL.');
    const matches = urlInput.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!matches) return displayToast('Invalid Spreadsheet URL format.');

    const csvEndpoint = `https://docs.google.com/spreadsheets/d/${matches[1]}/export?format=csv`;
    try {
        displayToast('Connecting to directory sheet...');
        const res = await fetch(csvEndpoint);
        if (!res.ok) throw new Error('Data fetch failed.');
        const csvText = await res.text();
        const parsed = parseCsvDataStructure(csvText);

        if (parsed.length === 0) return displayToast('Sync mapping failed: Empty rows.');
        localStorage.setItem(DB_VOUCHERS_KEY, JSON.stringify(parsed));
        localStorage.setItem('apple_air_configured_sheet', urlInput);
        displayToast(`Successfully synced ${parsed.length} items!`);
    } catch (e) {
        displayToast('Sync failed. Check public sharing setup.');
    }
}

function parseCsvDataStructure(csvText) {
    const rows = csvText.split(/?
/);
    if (rows.length <= 1) return [];
    const headers = rows[0].split(',').map(h => h.replace(/^["']|["']$/g, '').trim());
    const records = [];

    for (let i = 1; i < rows.length; i++) {
        if (!rows[i].trim()) continue;
        const cols = rows[i].split(',').map(c => c.replace(/^["']|["']$/g, '').trim());
        const rec = {};
        headers.forEach((h, idx) => rec[h] = cols[idx] || '');
        if (rec.code) {
            records.push({
                code: rec.code.toUpperCase(),
                timeRemaining: rec.timeRemaining || '24 Hours',
                dataAllowance: rec.dataAllowance || 'Unlimited GB',
                speedTier: rec.speedTier || '350 Mbps Profile'
            });
        }
    }
    return records;
}

function processManualProvisioning() {
    const code = document.getElementById('man-code').value.trim().toUpperCase();
    const speed = document.getElementById('man-speed').value;
    const data = document.getElementById('man-data').value;
    const time = document.getElementById('man-time').value;

    if (!code || !data || !time) return displayToast('Complete all fields.');
    const newVoucher = { code, timeRemaining: `${time} Hours`, dataAllowance: `${data} GB / ${data} GB`, speedTier: speed };
    const db = JSON.parse(localStorage.getItem(DB_VOUCHERS_KEY)) || [];
    const updated = db.filter(v => v.code !== code);
    updated.push(newVoucher);
    localStorage.setItem(DB_VOUCHERS_KEY, JSON.stringify(updated));
    displayToast(`Voucher ${code} provisioned manually.`);
    document.getElementById('man-code').value = '';
    document.getElementById('man-data').value = '';
    document.getElementById('man-time').value = '';
}

function executeAdminLogout() { sessionStorage.removeItem(STORAGE_AUTH_KEY); window.location.reload(); }
function displayToast(m) {
    const old = document.getElementById('admin-toast'); if (old) old.remove();
    const el = document.createElement('div'); el.id = 'admin-toast';
    el.className = "fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs px-4 py-2.5 rounded-full shadow-lg z-50 transition-all duration-200 opacity-0 translate-y-1 pointer-events-none";
    el.innerText = m; document.body.appendChild(el);
    setTimeout(() => el.classList.remove('opacity-0', 'translate-y-1'), 30);
    setTimeout(() => { el.classList.add('opacity-0', 'translate-y-1'); setTimeout(() => el.remove(), 200); }, 3000);
}