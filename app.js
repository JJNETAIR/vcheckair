/**
 * Apple Air - Definitive User Portal Verification Engine
 * Strictly Aligned to Project HTML: dash-code-display, dash-data, dash-time
 * Data Mapping: A: code | B: start time | C: status | D: Expirationtime
 */

const BIN_ID = "6a0cacb36877513b279bbe63"; 
const MASTER_KEY = "$2a$10$LS7aJr2QiV2RpptiyeBA9umWLUV9NV8nYaEVHT91YLShcgX1xNPbC"; 

function renderView(viewId) {
    ['view-entry', 'view-dashboard', 'view-loading'].forEach(v => {
        const el = document.getElementById(v);
        if (el) v === viewId ? el.classList.remove('hidden') : el.classList.add('hidden');
    });
}

// Clean CSV column parser supporting text qualifiers perfectly
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

async function streamLiveVerification() {
    const inputEl = document.getElementById('voucher-input');
    const userInput = inputEl.value.trim().toLowerCase();
    if (!userInput) return alert('Please enter your voucher code.');

    renderView('view-loading');

    try {
        // 1. Fetch Cloud Configurations Link from JSONBin backend database
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
        
        // Slot 1: Title Header display text
        const codeDisplayElement = document.getElementById('dash-code-display');
        if (codeDisplayElement) {
            codeDisplayElement.innerText = voucherCode;
        }

        // Slot 2: Map Status into the 'dash-data' text component field block
        const dataElement = document.getElementById('dash-data');
        if (dataElement) {
            dataElement.innerText = status.toUpperCase();
            // Color code the status text based on active vs inactive profiles
            if (status.toLowerCase().includes('act') || status.toLowerCase().includes('live')) {
                dataElement.className = "text-base font-bold text-emerald-600 tracking-wide";
            } else {
                dataElement.className = "text-base font-bold text-amber-500 tracking-wide";
            }
        }

        // Slot 3: Map Start and Expiration Times into the 'dash-time' block layout text area
        const timeElement = document.getElementById('dash-time');
        if (timeElement) {
            timeElement.innerHTML = `
                <div class="text-left space-y-1 mt-1 text-xs font-medium text-gray-500">
                    <div><span class="font-bold text-gray-800 text-[10px] uppercase tracking-wider block">Started:</span> ${startTime}</div>
                    <div class="pt-1"><span class="font-bold text-rose-600 text-[10px] uppercase tracking-wider block">Expires:</span> ${expiration}</div>
                </div>
            `;
        }

        // Switch panel layout display layers visibility flags tracking
        renderView('view-dashboard');

    } catch (err) {
        alert("Sync pipeline error: " + err.message);
        renderView('view-entry');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    renderView('view-entry');
    
    const checkBtn = document.getElementById('check-btn');
    const backBtn = document.getElementById('back-btn');
    
    if (checkBtn) checkBtn.addEventListener('click', streamLiveVerification);
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            const inputEl = document.getElementById('voucher-input');
            if (inputEl) inputEl.value = '';
            renderView('view-entry');
        });
    }
    
    const inputEl = document.getElementById('voucher-input');
    if (inputEl) {
        inputEl.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') streamLiveVerification();
        });
    }
});
