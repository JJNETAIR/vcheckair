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

// Generates Apple design style rows dynamically for whatever data fields exist
// Converts system terms into friendly terms (e.g., "Duration" to "Validity")
function createDisplayRow(label, value, isHighlight = false) {
    let valueColorClass = isHighlight ? "text-emerald-600 font-semibold" : "text-gray-900 font-semibold";
    
    // Auto translate technical terms for cleaner design display
    let finalLabel = label.trim();
    if (/vouch|code/i.test(finalLabel)) finalLabel = "Voucher Code";
    if (/profile|rate|tier|pkg/i.test(finalLabel)) finalLabel = "Speed Profile";
    if (/durat|time|expir|valid/i.test(finalLabel)) finalLabel = "Duration Limit";
    if (/byte|data|allow|volum/i.test(finalLabel)) finalLabel = "Data Allowance";

    return `
        <div class="flex justify-between items-center px-5 py-4">
            <span class="text-sm font-medium text-[#86868B]">${finalLabel}</span>
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

        if (!activeUrl) throw new Error("JSONBin link configuration string target mapping table is empty.");

        const match = activeUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (!match) throw new Error("Google spreadsheet unique URL tracking ID could not be parsed.");
        
        const spreadsheetId = match[1];
        const csvEndpoint = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&cache_bypass=${Date.now()}`;

        const response = await fetch(csvEndpoint);
        if (!response.ok) throw new Error(`Google engine rejected synchronization: ${response.status}`);
        
        const csvText = await response.text();
        const rows = csvText.split(/\r?\n/);
        if (rows.length < 2) throw new Error("Database contains empty rows.");

        let delimiter = rows[0].includes(';') ? ';' : ',';
        const rawHeaders = parseCSVLine(rows[0], delimiter);
        const headersCleaned = rawHeaders.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, '').trim());
        
        // Advanced Festa matching logic - handles columns in any positional order automatically
        let codeIdx = headersCleaned.findIndex(h => h.includes('vouch') || h.includes('code') || h.includes('auth'));
        let timeIdx = headersCleaned.findIndex(h => h.includes('durat') || h.includes('time') || h.includes('expir') || h.includes('valid'));
        
        if (codeIdx === -1) codeIdx = 0; // Safe defaults if indexes aren't resolved cleanly

        let matchedRowIndex = -1;
        let foundRowFields = [];

        for (let i = 1; i < rows.length; i++) {
            if (!rows[i].trim()) continue;
            
            const columns = parseCSVLine(rows[i], delimiter);
            if (columns[codeIdx]) {
                let sheetCodeClean = columns[codeIdx].trim().replace(/[^0-9a-zA-Z]/g, '').toLowerCase();
                let userCodeClean = userInput.replace(/[^0-9a-zA-Z]/g, '').toLowerCase();

                if (sheetCodeClean === userCodeClean && userCodeClean.length > 0) {
                    matchedRowIndex = i;
                    foundRowFields = columns;
                    break;
                }
            }
        }

        if (matchedRowIndex === -1) {
            alert("Voucher mismatch or not found in active database sheet! ⚠️");
            renderView('view-entry');
            return;
        }

        // Build the dashboard dynamically based on whatever column structure is present inside the CSV table
        const gridContainer = document.getElementById('festa-data-container');
        gridContainer.innerHTML = ''; 

        let voucherCodeDisplay = foundRowFields[codeIdx].toUpperCase();
        let expiryString = timeIdx !== -1 ? foundRowFields[timeIdx] : '';
        let isExpired = false;

        // Process expiration time checks safely
        if (expiryString) {
            const expiryDate = parseSheetDateString(expiryString);
            if (expiryDate && !isNaN(expiryDate.getTime())) {
                const today = new Date();
                if (expiryDate.getTime() < today.getTime()) {
                    isExpired = true;
                } else {
                    const diffDays = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    if (diffDays > 1) expiryString += ` (${diffDays} Days Left)`;
                    else if (diffDays === 1) expiryString += ` (1 Day Left)`;
                    else expiryString += ` (Expires Today)`;
                }
            }
        }

        // Generate card layout
        rawHeaders.forEach((headerTitle, index) => {
            let fieldVal = foundRowFields[index] || '--';
            
            // Clean display value up if it has system line breaks
            fieldVal = fieldVal.replace(/[\r\n]+/g, ' ').trim();

            if (index === timeIdx) {
                gridContainer.innerHTML += createDisplayRow(headerTitle, isExpired ? "Expired" : expiryString, !isExpired);
            } else {
                gridContainer.innerHTML += createDisplayRow(headerTitle, fieldVal, false);
            }
        });

        document.getElementById('dash-code-display').innerText = voucherCodeDisplay;

        // Display states
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
