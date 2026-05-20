const BIN_ID = "6a0cacb36877513b279bbe63"; 
const MASTER_KEY = "$2a$10$LS7aJr2QiV2RpptiyeBA9umWLUV9NV8nYaEVHT91YLShcgX1xNPbC"; 

function renderView(viewId) {
    const views = ['view-entry', 'view-dashboard', 'view-loading'];
    views.forEach(v => {
        const el = document.getElementById(v);
        if (el) {
            if (v === viewId) el.classList.remove('hidden');
            else el.classList.add('hidden');
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

function createDisplayRow(label, value, isHighlight = false) {
    let valueColorClass = isHighlight ? "text-emerald-600 font-semibold" : "text-gray-900 font-semibold";
    return `
        <div class="flex justify-between items-center px-5 py-4">
            <span class="text-sm font-medium text-[#86868B]">${label}</span>
            <span class="text-base text-right max-w-[220px] leading-tight ${valueColorClass}">${value}</span>
        </div>
    `;
}

async function streamLiveVerification() {
    const inputEl = document.getElementById('voucher-input');
    if (!inputEl) return;
    
    const userInput = inputEl.value.trim().toLowerCase();
    if (!userInput) return alert('Please type a voucher code.');

    renderView('view-loading');

    try {
        const cloudResponse = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
            headers: { "X-Master-Key": MASTER_KEY }
        });
        const cloudData = await cloudResponse.json();
        const activeUrl = cloudData.record.url;

        if (!activeUrl) throw new Error("JSONBin mapping target empty.");

        const match = activeUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (!match) throw new Error("Google Spreadsheet key missing.");
        
        const spreadsheetId = match[1];
        const csvEndpoint = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&cache_bypass=${Date.now()}`;

        const response = await fetch(csvEndpoint);
        if (!response.ok) throw new Error(`Google error: ${response.status}`);
        
        const csvText = await response.text();
        const rows = csvText.split(/\r?\n/);
        if (rows.length < 2) throw new Error("Sheet is empty.");

        let delimiter = rows[0].includes(';') ? ';' : ',';

        // Direct Index Locks (A=0, B=1, C=2, D=3)
        let codeIdx = 0;
        let startTimeIdx = 1;
        let durationIdx = 2;
        let expirationIdx = 3;

        let matchedRowFields = null;

        for (let i = 1; i < rows.length; i++) {
            if (!rows[i].trim()) continue;
            
            const columns = parseCSVLine(rows[i], delimiter);
            if (columns[codeIdx]) {
                let sheetCodeClean = columns[codeIdx].trim().replace(/[^0-9a-zA-Z]/g, '').toLowerCase();
                let userCodeClean = userInput.replace(/[^0-9a-zA-Z]/g, '').toLowerCase();

                if (sheetCodeClean === userCodeClean && userCodeClean.length > 0) {
                    matchedRowFields = columns;
                    break;
                }
            }
        }

        if (!matchedRowFields) {
            alert("Voucher mismatch or not found in active database sheet! ⚠️");
            renderView('view-entry');
            return;
        }

        const gridContainer = document.getElementById('festa-data-container');
        gridContainer.innerHTML = ''; 

        let voucherCodeDisplay = (matchedRowFields[codeIdx] || userInput).toUpperCase();
        let startTimeVal = matchedRowFields[startTimeIdx] || 'Not Activated Yet';
        let durationVal = matchedRowFields[durationIdx] || '--';
        let expirationVal = matchedRowFields[expirationIdx] || 'No Limit';

        voucherCodeDisplay = voucherCodeDisplay.replace(/[\r\n]+/g, ' ').trim();
        startTimeVal = startTimeVal.replace(/[\r\n]+/g, ' ').trim();
        durationVal = durationVal.replace(/[\r\n]+/g, ' ').trim();
        expirationVal = expirationVal.replace(/[\r\n]+/g, ' ').trim();

        let isExpired = false;
        let validityBadgeText = expirationVal;
        
        const expiryDate = parseSheetDateString(expirationVal);
        if (expiryDate && !isNaN(expiryDate.getTime())) {
            const today = new Date();
            if (expiryDate.getTime() < today.getTime()) {
                isExpired = true;
            } else {
                const diffDays = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                if (diffDays > 1) validityBadgeText = `${expirationVal} (${diffDays} Days Left)`;
                else if (diffDays === 1) validityBadgeText = `${expirationVal} (1 Day Left)`;
                else validityBadgeText = `${expirationVal} (Expires Today)`;
            }
        }

        // Inject fields dynamically into the newly updated HTML grid layout!
        gridContainer.innerHTML += createDisplayRow("Voucher Code", voucherCodeDisplay, false);
        gridContainer.innerHTML += createDisplayRow("Start Time", startTimeVal, false);
        gridContainer.innerHTML += createDisplayRow("Plan Duration", durationVal, false);
        gridContainer.innerHTML += createDisplayRow("Expiration Time", isExpired ? "Expired" : validityBadgeText, !isExpired);

        document.getElementById('dash-code-display').innerText = voucherCodeDisplay;

        if (isExpired) {
            document.getElementById('status-icon-active').classList.add('hidden');
            document.getElementById('status-icon-expired').classList.remove('hidden');
            document.getElementById('dash-status-title').innerText = "Voucher Expired";
            document.getElementById('dash-status-title').className = "text-xl font-semibold tracking-tight text-rose-600";
        } else {
            document.getElementById('status-icon-expired').classList.add('hidden');
            document.getElementById('status-icon-active').classList.remove('hidden');
            document.getElementById('dash-status-title').innerText = "Voucher Active";
            document.getElementById('dash-status-title').className = "text-xl font-semibold tracking-tight text-emerald-600";
        }

        renderView('view-dashboard');

    } catch (err) {
        alert(`Festa cloud reading error: ${err.message}`);
        renderView('view-entry');
    }
}

function backToEntryView() { 
    const inputEl = document.getElementById('voucher-input');
    if(inputEl) inputEl.value = ''; 
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
