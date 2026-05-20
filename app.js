const BIN_ID = "6a0cacb36877513b279bbe63"; 
const MASTER_KEY = "$2a$10$LS7aJr2QiV2RpptiyeBA9umWLUV9NV8nYaEVHT91YLShcgX1xNPbC"; 

function renderView(viewId) {
    const views = ['view-entry', 'view-dashboard', 'view-loading'];
    views.forEach(v => {
        const el = document.getElementById(v);
        if (el) {
            if (v === viewId) {
                el.classList.remove('hidden');
            } else { 
                el.classList.add('hidden'); 
            }
        }
    });
}

function parseCSVLine(text, delimiter) {
    let columns = [];
    let insideQuotes = false;
    let currentColumn = '';
    
    for (let i = 0; i < text.length; i++) {
        let char = text[i];
        if (char === '"') {
            insideQuotes = !insideQuotes;
        } else if (char === delimiter && !insideQuotes) {
            columns.push(currentColumn.trim());
            currentColumn = '';
        } else {
            currentColumn += char;
        }
    }
    columns.push(currentColumn.trim());
    return columns.map(col => col.replace(/^["']|["']$/g, '').trim());
}

function parseSheetDateString(str) {
    if (!str) return null;
    let sanitized = str.replace(/[\r\n]+/g, ' ').trim();
    let clean = sanitized.replace(/[^a-zA-Z0-9\s:]/g, ' ').replace(/\s+/g, ' ').trim();
    let segments = clean.split(' ');
    
    if (segments.length < 3) return null;

    const months = {
        jan:0, feb:1, mar:2, apr:3, may:4, jun:5,
        jul:6, aug:7, sep:8, oct:9, nov:10, dec:11
    };

    let monthStr = segments[0].toLowerCase().substring(0, 3);
    let month = months[monthStr];
    let day = parseInt(segments[1], 10);
    let year = parseInt(segments[2], 10);

    if (isNaN(month) || isNaN(day) || isNaN(year)) {
        const backupParts = sanitized.split('/');
        if (backupParts.length === 3) {
            return new Date(parseInt(backupParts[2],10), parseInt(backupParts[1],10)-1, parseInt(backupParts[0],10));
        }
        return null;
    }

    let hours = 0, minutes = 0, seconds = 0;
    let timeMatch = clean.match(/(\d{2}):(\d{2}):(\d{2})/);
    
    if (timeMatch) {
        hours = parseInt(timeMatch[1], 10);
        minutes = parseInt(timeMatch[2], 10);
        seconds = parseInt(timeMatch[3], 10);
    }

    if (/pm/i.test(sanitized) && hours < 12) hours += 12;
    if (/am/i.test(sanitized) && hours === 12) hours = 0;

    return new Date(year, month, day, hours, minutes, seconds);
}

function setupNotification(expiryDateString, voucherCode) {
    const notifySection = document.getElementById('notification-section');
    const notifyBtn = document.getElementById('notify-me-btn');
    const notifyStatus = document.getElementById('notify-status');
    
    if (!notifySection || !notifyBtn || !notifyStatus) return;

    const storageKeyDate = `alert_date_${voucherCode.toLowerCase()}`;
    notifySection.classList.remove('hidden');

    try {
        const dbRequest = indexedDB.open('AppleAirDB', 1);
        dbRequest.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('alerts')) db.createObjectStore('alerts');
        };

        dbRequest.onsuccess = (e) => {
            const db = e.target.result;
            const transaction = db.transaction('alerts', 'readonly');
            const store = transaction.objectStore('alerts');
            const getReq = store.get(storageKeyDate);

            getReq.onsuccess = () => {
                if (getReq.result) {
                    notifyBtn.innerHTML = '<span>Reminder Scheduled!</span> <span>✅</span>';
                    notifyBtn.className = "w-full py-3 px-4 rounded-xl bg-green-50/80 border border-green-200 text-green-600 font-medium flex items-center justify-center space-x-2 pointer-events-none";
                    notifyStatus.innerText = `We will alert you on ${getReq.result}`;
                    notifyStatus.classList.remove('hidden');
                } else {
                    notifyBtn.innerHTML = '<span>Notify Me 1 Day Before Expiry</span> <span>🔔</span>';
                    notifyBtn.className = "w-full py-3 px-4 rounded-xl bg-blue-50/80 border border-blue-200 text-blue-600 font-medium flex items-center justify-center space-x-2 active:scale-95 transition-transform";
                    notifyStatus.classList.add('hidden');
                }
            };
        };

        notifyBtn.onclick = async () => {
            if (!('Notification' in window)) {
                alert('Notifications are not supported on this device ecosystem.');
                return;
            }
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                const expiryDate = parseSheetDateString(expiryDateString);
                if (!expiryDate) return alert('Date format syntax mismatch.');

                const alertDate = new Date(expiryDate);
                alertDate.setDate(alertDate.getDate() - 1);
                const alertString = alertDate.toLocaleDateString('en-GB'); 

                const dbReq = indexedDB.open('AppleAirDB', 1);
                dbReq.onsuccess = (event) => {
                    const db = event.target.result;
                    const tx = db.transaction('alerts', 'readwrite');
                    const store = tx.objectStore('alerts');
                    store.put(alertString, storageKeyDate);

                    tx.oncomplete = () => {
                        notifyBtn.innerHTML = '<span>Reminder Scheduled!</span> <span>✅</span>';
                        notifyBtn.className = "w-full py-3 px-4 rounded-xl bg-green-50/80 border border-green-200 text-green-600 font-medium flex items-center justify-center space-x-2 pointer-events-none";
                        notifyStatus.innerText = `We will alert you on ${alertString}`;
                        notifyStatus.classList.remove('hidden');
                    };
                };
            }
        };
    } catch(e) { console.log("IndexedDB container error bypassed."); }
}

async function streamLiveVerification() {
    const inputEl = document.getElementById('voucher-input');
    if (!inputEl) return;
    
    const userInput = inputEl.value.trim().toLowerCase();
    if (!userInput) return alert('Please enter a voucher code.');

    renderView('view-loading');

    try {
        const cloudResponse = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
            headers: { "X-Master-Key": MASTER_KEY }
        });
        const cloudData = await cloudResponse.json();
        const activeUrl = cloudData.record.url;

        if (!activeUrl) throw new Error("Target mapping link inside JSON Bin database is empty.");

        const match = activeUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (!match) throw new Error("Spreadsheet target hash could not be parsed.");
        
        const spreadsheetId = match[1];
        const csvEndpoint = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&cache_bypass=${Date.now()}`;

        const response = await fetch(csvEndpoint);
        if (!response.ok) throw new Error(`Google Sheets rejected stream: ${response.status}`);
        
        const csvText = await response.text();
        const rows = csvText.split(/\r?\n/);
        
        if (rows.length < 2) throw new Error("Spreadsheet contains zero data rows.");

        let delimiter = rows[0].includes(';') ? ';' : ',';
        const headers = parseCSVLine(rows[0], delimiter).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, '').trim());
        
        let codeColumnIndex = headers.findIndex(h => h.includes('code') || h.includes('auth') || h.includes('vouch'));
        let timeColumnIndex = headers.findIndex(h => h.includes('time') || h.includes('expir') || h.includes('end'));
        let speedColumnIndex = headers.findIndex(h => h.includes('speed') || h.includes('tier') || h.includes('prof'));

        if (codeColumnIndex === -1) codeColumnIndex = 0;
        if (timeColumnIndex === -1) timeColumnIndex = 3; 
        if (speedColumnIndex === -1) speedColumnIndex = 4;

        let foundVoucher = null;

        for (let i = 1; i < rows.length; i++) {
            if (!rows[i].trim()) continue;
            
            const columns = parseCSVLine(rows[i], delimiter);
            if (columns[codeColumnIndex]) {
                let sheetRawCode = columns[codeColumnIndex].trim();
                let sheetCleanedNumbers = sheetRawCode.replace(/[^0-9]/g, '');
                let userCleanedNumbers = userInput.replace(/[^0-9]/g, '');

                if (sheetCleanedNumbers === userCleanedNumbers && userCleanedNumbers.length > 0) {
                    foundVoucher = {
                        code: sheetRawCode.replace(/Voucher\s*-\s*/i, '').toUpperCase(),
                        expiryText: columns[timeColumnIndex] || '',
                        speedTier: columns[speedColumnIndex] || 'HIGH'
                    };
                    break;
                }
            }
        }

        if (!foundVoucher) {
            alert("Voucher not found in active database sheet! ⚠️");
            renderView('view-entry');
            return;
        }

        const today = new Date();
        const expiryDate = parseSheetDateString(foundVoucher.expiryText);
        
        let finalExpiryDisplay = foundVoucher.expiryText.replace(/[\r\n]+/g, ' ').trim();
        let combinedDisplayString = finalExpiryDisplay; 
        let isExpired = false;

        if (expiryDate && !isNaN(expiryDate.getTime())) {
            const timeDiff = expiryDate.getTime() - today.getTime();
            const diffInDays = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

            if (diffInDays > 1) {
                combinedDisplayString = `${finalExpiryDisplay} (${diffInDays} Days Remaining)`;
            } else if (diffInDays === 1) {
                combinedDisplayString = `${finalExpiryDisplay} (1 Day Remaining)`;
            } else if (diffInDays === 0 || (timeDiff > 0 && diffInDays <= 0)) {
                combinedDisplayString = `${finalExpiryDisplay} (Expires Today)`;
            } else {
                isExpired = true;
            }
        }

        if (isExpired) {
            alert("Voucher has expired! ⚠️");
            if(document.getElementById('notification-section')) document.getElementById('notification-section').classList.add('hidden');
            if(document.getElementById('status-icon-active')) document.getElementById('status-icon-active').classList.add('hidden');
            if(document.getElementById('status-icon-expired')) document.getElementById('status-icon-expired').classList.remove('hidden');
            
            const titleText = document.getElementById('dash-status-title');
            if(titleText) {
                titleText.innerText = "Voucher Inactive";
                titleText.className = "text-xl font-semibold tracking-tight text-rose-600";
            }
            
            if(document.getElementById('dash-data')) {
                document.getElementById('dash-data').innerText = "Inactive";
                document.getElementById('dash-data').className = "text-base font-semibold text-rose-600";
            }
            if(document.getElementById('dash-time')) {
                document.getElementById('dash-time').innerText = "Expired";
                document.getElementById('dash-time').className = "text-base font-semibold text-rose-600";
            }
            
            const speedBadge = document.getElementById('dash-speed');
            if(speedBadge) {
                speedBadge.innerText = foundVoucher.speedTier;
                speedBadge.className = "text-sm font-medium bg-gray-100 text-gray-400 px-3 py-1 rounded-md uppercase";
            }
            
            if(document.getElementById('dash-code-display')) document.getElementById('dash-code-display').innerText = foundVoucher.code;
            renderView('view-dashboard');
            return;
        }

        if(document.getElementById('status-icon-expired')) document.getElementById('status-icon-expired').classList.add('hidden');
        if(document.getElementById('status-icon-active')) document.getElementById('status-icon-active').classList.remove('hidden');
        
        const titleText = document.getElementById('dash-status-title');
        if(titleText) {
            titleText.innerText = "Voucher Active";
            titleText.className = "text-xl font-semibold tracking-tight text-emerald-600";
        }
        
        if(document.getElementById('dash-data')) {
            document.getElementById('dash-data').innerText = "Unlimited Data";
            document.getElementById('dash-data').className = "text-base font-semibold text-gray-900";
        }
        
        if(document.getElementById('dash-time')) {
            document.getElementById('dash-time').innerText = combinedDisplayString;
            document.getElementById('dash-time').className = "text-base font-semibold text-emerald-600";
        }
        
        const speedBadge = document.getElementById('dash-speed');
        if(speedBadge) {
            speedBadge.innerText = foundVoucher.speedTier ? foundVoucher.speedTier : 'HIGH';
            speedBadge.className = "text-sm font-medium bg-blue-50 text-blue-600 px-3 py-1 rounded-md uppercase";
        }
        
        if(document.getElementById('dash-code-display')) document.getElementById('dash-code-display').innerText = foundVoucher.code;
        
        setupNotification(foundVoucher.expiryText, foundVoucher.code);
        renderView('view-dashboard');

    } catch (err) {
        alert(`Network Sync Interrupted: ${err.message}`);
        renderView('view-entry');
    }
}

function backToEntryView() { 
    const inputEl = document.getElementById('voucher-input');
    if(inputEl) inputEl.value = ''; 
    const notifySection = document.getElementById('notification-section');
    if (notifySection) notifySection.classList.add('hidden');
    renderView('view-entry'); 
}

document.addEventListener('DOMContentLoaded', () => {
    renderView('view-entry');
    
    const checkBtn = document.getElementById('check-btn');
    const backBtn = document.getElementById('back-btn');
    const inputEl = document.getElementById('voucher-input');

    if(checkBtn) checkBtn.addEventListener('click', streamLiveVerification);
    if(backBtn) backBtn.addEventListener('click', backToEntryView);
    if(inputEl) {
        inputEl.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') streamLiveVerification();
        });
    }
});
