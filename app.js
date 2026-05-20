/**
 * Apple Air - User Portal Interface Engine (Fixed Sync Engine)
 */

const BIN_ID = "6a0cacb36877513b279bbe63"; 
const MASTER_KEY = "$2a$10$LS7aJr2QiV2RpptiyeBA9umWLUV9NV8nYaEVHT91YLShcgX1xNPbC"; 

function renderView(viewId) {
    ['view-entry', 'view-dashboard', 'view-loading'].forEach(v => {
        const el = document.getElementById(v);
        if (el) v === viewId ? el.classList.remove('hidden') : el.classList.add('hidden');
    });
}

// Robust CSV Line Parser
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
        // 1. Fetch Google Sheet ID from JSONBin cloud configuration
        const cloudResponse = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
            headers: { "X-Master-Key": MASTER_KEY }
        });
        const cloudData = await cloudResponse.json();
        const activeUrl = cloudData.record.url;
        const spreadsheetId = activeUrl.match(/\/d\/([a-zA-Z0-9-_]+)/)[1];
        
        // 2. Fetch data directly from CSV Export link with cache buster
        const response = await fetch(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&cache_bypass=${Date.now()}`);
        const csvText = await response.text();
        const rows = csvText.split(/\r?\n/).filter(r => r.trim() !== "");
        
        if (rows.length === 0) throw new Error("Spreadsheet data is completely empty.");

        // Auto-Detect delimiter (comma vs semicolon)
        const delimiter = rows[0].includes(';') ? ';' : ',';

        // 3. Extract Headers
        const headers = parseCSVLine(rows[0], delimiter);
        
        // Find the matched row safely
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
        
        // Safely show voucher code at top header
        document.getElementById('dash-code-display').innerText = (values[0] || userInput).toUpperCase();

        const container = document.getElementById('festa-data-container');
        container.innerHTML = ''; 

        // 4. Construct dynamic grid metrics safely
        headers.forEach((header, index) => {
            if (index === 0 || !header) return; // Skip voucher code card row

            // Fallback to "-" safely if values[index] is missing or undefined
            const val = (values[index] !== undefined && values[index] !== "") ? values[index] : "-";
            const cleanHeader = header.toLowerCase();

            // Premium premium color accents matching data purpose
            let cardColors = "bg-[#F5F5F7] text-gray-900";
            if (cleanHeader.includes('remain')) {
                cardColors = "bg-blue-50 text-blue-700 border border-blue-100/70";
            } else if (cleanHeader.includes('expir')) {
                cardColors = "bg-rose-50 text-rose-700 border border-rose-100/70";
            } else if (cleanHeader.includes('used')) {
                cardColors = "bg-amber-50/70 text-amber-800";
            }

            container.innerHTML += `
                <div class="p-4 rounded-2xl flex flex-col justify-center space-y-1 ${cardColors}">
                    <span class="text-[10px] font-bold uppercase tracking-wider opacity-60">${header}</span>
                    <span class="text-base font-bold tracking-tight">${val}</span>
                </div>`;
        });

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
