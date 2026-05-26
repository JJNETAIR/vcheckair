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
    // Default sheet URL — always shows even after browser reset
    const DEFAULT_SHEET = 'https://docs.google.com/spreadsheets/d/1F8TUOpY9vudo9MsTWOwHwLlBKi1P6_ayikucdTjyrbg/edit';
    const savedSheet = localStorage.getItem('apple_air_configured_sheet') || DEFAULT_SHEET;
    if (document.getElementById('sheet-url-input')) {
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
        displayToast(`✅ Successfully synced ${parsed.length} vouchers!`);
    } catch (e) {
        console.log('Sync error:', e);
        alert('Failed to push sync to cloud server.

Make sure your Google Sheet is shared publicly:
Share → Anyone with link → Viewer');
    }
}

function parseCsvDataStructure(csvText) {
    // Proper CSV parser handles multiline quoted fields from Google Sheets
    const records = [];
    let row = [], field = '', inQ = false;
    for (let i = 0; i < csvText.length; i++) {
        const ch = csvText[i], nx = csvText[i+1];
        if (inQ) {
            if (ch==='"' && nx==='"') { field+='"'; i++; }
            else if (ch==='"') { inQ=false; }
            else field+=ch;
        } else {
            if (ch==='"') { inQ=true; }
            else if (ch===',') { row.push(field.trim()); field=''; }
            else if (ch==='
'||(ch==='
'&&nx==='
')) {
                row.push(field.trim());
                if (row.some(c=>c!=='')) records.push(row);
                row=[]; field='';
                if(ch==='
') i++;
            } else field+=ch;
        }
    }
    if (field||row.length){ row.push(field.trim()); if(row.some(c=>c!=='')) records.push(row); }
    if (records.length < 2) return [];

    // Sheet layout: A=user, B=code, C=starttime, D=status, E=Expirationtime
    const result = [];
    for (let i = 1; i < records.length; i++) {
        const cols = records[i];
        const code = (cols[1]||'').replace(/Voucher\s*-\s*/i,'').trim();
        if (!code) continue;
        const clean = s => (s||'').replace(/[
]+/g,' ').replace(/"+/g,'').trim();
        result.push({
            user:       clean(cols[0]),
            code:       code.toUpperCase(),
            startTime:  clean(cols[2]),
            status:     clean(cols[3]),
            expiryText: clean(cols[4])
        });
    }
    return result;
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
