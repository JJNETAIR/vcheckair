/**
 * Apple Air - High-Performance Realtime Sync Database Core
 * Mapping Layout: A: code | B: start time | C: status | D: Expirationtime
 */

const BIN_ID = "6a0cacb36877513b279bbe63"; 
const MASTER_KEY = "$2a$10$LS7aJr2QiV2RpptiyeBA9umWLUV9NV8nYaEVHT91YLShcgX1xNPbC"; 

function renderView(viewId) {
    ['view-entry', 'view-dashboard', 'view-loading'].forEach(v => {
        const el = document.getElementById(v);
        if (el) v === viewId ? el.classList.remove('hidden') : el.classList.add('hidden');
    });
}

// Clean text data line format parsing utility
function parseCSVLine(text, delimiter) {
    if (!text) return [];
    let columns = [];
    let insideQuotes = false;
    let currentColumn = '';
    
    for (let i = 0; i < text.length; i++) {
        let char = text[i];
        if (char === '\"') {
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

window.streamLiveVerification = async function() {
    const inputEl = document.getElementById('voucher-input');
    const userInput = inputEl.value.trim().toLowerCase();
    if (!userInput) return alert('Please enter your voucher code.');

    renderView('view-loading');

    try {
        // 1. Fetch Cloud Link from JSONBin configuration
        const cloudResponse = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
            headers: { "X-Master-Key": MASTER_KEY }
        });
        const cloudData = await cloudResponse.json();
        const activeUrl = cloudData.record.url;
        
        // 2. Extract Core Sheet ID cleanly using a precise matching template
        const idMatch = activeUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (!idMatch || !idMatch[1]) {
            throw new Error("Stored URL is missing a valid Google Spreadsheet ID.");
        }
        const spreadsheetId = idMatch[1];
        
        // 3. Build perfect download link query string structure directly
        const exportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&cache_bypass=${Date.now()}`;
        
        // 4. Download file data records array matrix payload
        const response = await fetch(exportUrl);
        if (!response.ok) throw new Error(`Google rejected data sync request: ${response.status}`);
        
        const csvText = await response.text();
        const rows = csvText.split(/\r?\n/).filter(r => r.trim() !== "");
        
        if (rows.length === 0) throw new Error("Spreadsheet rows appear completely empty.");

        // Automatically determine if the sheet uses comma or semicolon delimiters
        const delimiter = rows[0].includes(';') ? ';' : ',';

        // 5. Match input value string against Key Column A
        const matchedRow = rows.find(row => {
            const cols = parseCSVLine(row, delimiter);
            return cols[0] && cols[0].toLowerCase() === userInput;
        });

        if (!matchedRow) {
            alert("Voucher code not found or has expired.");
            renderView('view-entry');
            return;
        }

        const values = parseCSVLine(matchedRow, delimiter);
        
        // 6. Extract Column Values precisely based on your current A, B, C, D setup
        const voucherCode = (values[0] || userInput).toUpperCase();
        const startTime   = (values[1] && values[1].trim() !== "") ? values[1].trim() : "-";
        const status      = (values[2] && values[2].trim() !== "") ? values[2].trim() : "-";
        const expiration  = (values[3] && values[3].trim() !== "") ? values[3].trim() : "-";

        // 7. Inject values directly into your exact HTML components elements slots
        
        // Header Code Display text slot
        const codeDisplay = document.getElementById('dash-code-display');
        if (codeDisplay) codeDisplay.innerText = voucherCode;

        // Status field mapped directly into the data display block
        const dataDisplay = document.getElementById('dash-data');
        if (dataDisplay) {
            dataDisplay.innerText = status.toUpperCase();
            if (status.toLowerCase().includes('act') || status.toLowerCase().includes('live')) {
                dataDisplay.className = "text-base font-semibold text-emerald-600 uppercase";
            } else {
                dataDisplay.className = "text-base font-semibold text-amber-500 uppercase";
            }
        }

        // Expiration/Start values mapped directly into the duration block
        const timeDisplay = document.getElementById('dash-time');
        if (timeDisplay) {
            timeDisplay.innerHTML = `
                <div class="flex flex-col text-sm space-y-0.5">
                    <span class="text-gray-900 font-medium">Start: ${startTime}</span>
                    <span class="text-rose-600 font-semibold text-xs">Expires: ${expiration}</span>
                </div>
            `;
            timeDisplay.className = "mt-1";
        }

        // Speed badge fallback value
        const speedBadge = document.getElementById('dash-speed');
        if (speedBadge) {
            speedBadge.innerText = "HIGH";
            speedBadge.className = "text-sm font-medium bg-blue-50 text-blue-600 px-3 py-1 rounded-md uppercase";
        }

        renderView('view-dashboard');

    } catch (err) {
        alert("Sync pipeline error: " + err.message);
        renderView('view-entry');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    renderView('view-entry');
    
    // Setup clean event fallback hooks directly on inputs
    const inputEl = document.getElementById('voucher-input');
    if (inputEl) {
        inputEl.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') window.streamLiveVerification();
        });
    }
});
