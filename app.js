/**
 * Apple Air - High Performance Realtime Sync Database Core
 * Structural Matrix Rules: A: code | B: start time | C: status | D: Expirationtime
 */

const BIN_ID = "6a0cacb36877513b279bbe63"; 
const MASTER_KEY = "$2a$10$LS7aJr2QiV2RpptiyeBA9umWLUV9NV8nYaEVHT91YLShcgX1xNPbC"; 

function renderView(viewId) {
    ['view-entry', 'view-dashboard', 'view-loading'].forEach(v => {
        const el = document.getElementById(v);
        if (el) v === viewId ? el.classList.remove('hidden') : el.classList.add('hidden');
    });
}

// Custom split parser handling internal column commas safely
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
        // 1. Fetch Cloud Link from JSONBin configuration
        const cloudResponse = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
            headers: { "X-Master-Key": MASTER_KEY }
        });
        const cloudData = await cloudResponse.json();
        const activeUrl = cloudData.record.url;
        
        // 2. Strict Core Sheet ID Regex Extractor
        const idMatch = activeUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (!idMatch || !idMatch[1]) {
            throw new Error("Stored URL is missing a valid Google Spreadsheet ID.");
        }
        const spreadsheetId = idMatch[1];
        
        // 3. Construct a completely clean export address line
        const exportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&cache_bypass=${Date.now()}`;
        
        // 4. Download Stream payload mapping
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
        
        // Set dynamic master uppercase identifier title block
        document.getElementById('dash-code-display').innerText = (values[0] || userInput).toUpperCase();

        // Extract column strings array indexes safely avoiding layout overflows
        const startTime  = (values[1] && values[1].trim() !== "") ? values[1].trim() : "-";
        const status     = (values[2] && values[2].trim() !== "") ? values[2].trim() : "-";
        const expiration = (values[3] && values[3].trim() !== "") ? values[3].trim() : "-";

        // Dynamic status layout color logic rules
        let statusColors = "bg-[#F5F5F7] text-gray-900";
        if (status.toLowerCase().includes('act') || status.toLowerCase().includes('live')) {
            statusColors = "bg-emerald-50 text-emerald-700 border border-emerald-100/70";
        } else {
            statusColors = "bg-amber-50 text-amber-800 border border-amber-100/70";
        }

        // 6. Paint the dashboard grid view directly
        const container = document.getElementById('festa-data-container');
        if (container) {
            container.innerHTML = `
                <div class="p-4 rounded-2xl flex flex-col justify-center space-y-1 bg-blue-50 text-blue-700 border border-blue-100/70">
                    <span class="text-[10px] font-bold uppercase tracking-wider opacity-60">Start Time</span>
                    <span class="text-base font-bold tracking-tight">${startTime}</span>
                </div>
                
                <div class="p-4 rounded-2xl flex flex-col justify-center space-y-1 ${statusColors}">
                    <span class="text-[10px] font-bold uppercase tracking-wider opacity-60">Status</span>
                    <span class="text-base font-bold tracking-tight">${status}</span>
                </div>
                
                <div class="p-4 rounded-2xl flex flex-col justify-center space-y-1 bg-rose-50 text-rose-700 border border-rose-100/70">
                    <span class="text-[10px] font-bold uppercase tracking-wider opacity-60">Expiration Time</span>
                    <span class="text-base font-bold tracking-tight">${expiration}</span>
                </div>
            `;
        }

        renderView('view-dashboard');

    } catch (err) {
        alert("Sync pipeline error: " + err.message);
        renderView('view-entry');
    }
}

// Bind native click actions cleanly when the DOM content finishes loading
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
