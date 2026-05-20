/**
 * Apple Air - Fixed Voucher Portal Engine
 * Aligned strictly to: A: code | B: start time | C: status | D: Expirationtime
 */

const BIN_ID = "6a0cacb36877513b279bbe63"; 
const MASTER_KEY = "$2a$10$LS7aJr2QiV2RpptiyeBA9umWLUV9NV8nYaEVHT91YLShcgX1xNPbC"; 

function renderView(viewId) {
    ['view-entry', 'view-dashboard', 'view-loading'].forEach(v => {
        const el = document.getElementById(v);
        if (el) v === viewId ? el.classList.remove('hidden') : el.classList.add('hidden');
    });
}

// Safe CSV Parser line splitter
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
        // 1. Fetch Cloud Config
        const cloudResponse = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
            headers: { "X-Master-Key": MASTER_KEY }
        });
        const cloudData = await cloudResponse.json();
        const activeUrl = cloudData.record.url;
        const spreadsheetId = activeUrl.match(/\/d\/([a-zA-Z0-9-_]+)/)[1];
        
        // 2. Fetch Spreadsheet Data with aggressive Cache Buster
        const response = await fetch(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&cache_bypass=${Date.now()}`);
        const csvText = await response.text();
        const rows = csvText.split(/\r?\n/).filter(r => r.trim() !== "");
        
        if (rows.length === 0) throw new Error("Spreadsheet database is empty.");

        // Detect comma vs semicolon splitting rules
        const delimiter = rows[0].includes(';') ? ';' : ',';

        // 3. Match user row targeting Column A (Voucher Code)
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
        
        // Set up the voucher display at the top header
        document.getElementById('dash-code-display').innerText = (values[0] || userInput).toUpperCase();

        // 4. Fallback values if sheet rows are truncated/short
        const startTime  = (values[1] && values[1].trim() !== "") ? values[1].trim() : "-";
        const status     = (values[2] && values[2].trim() !== "") ? values[2].trim() : "-";
        const expiration = (values[3] && values[3].trim() !== "") ? values[3].trim() : "-";

        // Dynamic status layout styling color variables
        let statusColors = "bg-[#F5F5F7] text-gray-900";
        if (status.toLowerCase().includes('act') || status.toLowerCase().includes('live')) {
            statusColors = "bg-emerald-50 text-emerald-700 border border-emerald-100/70";
        } else {
            statusColors = "bg-amber-50 text-amber-800 border border-amber-100/70";
        }

        // 5. Explicit structural card UI build out injection
        const container = document.getElementById('festa-data-container');
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

        renderView('view-dashboard');

    } catch (err) {
        alert("Sync connection issue: " + err.message);
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
