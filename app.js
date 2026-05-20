const BIN_ID = "6a0cacb36877513b279bbe63"; 
const MASTER_KEY = "$2a$10$LS7aJr2QiV2RpptiyeBA9umWLUV9NV8nYaEVHT91YLShcgX1xNPbC"; 

function renderView(viewId) {
    ['view-entry', 'view-dashboard', 'view-loading'].forEach(v => {
        const el = document.getElementById(v);
        if (el) v === viewId ? el.classList.remove('hidden') : el.classList.add('hidden');
    });
}

// Fixed line parser that auto-detects comma vs semicolon
function parseCSVLine(text, delimiter) {
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
        // 1. Get Google Sheet ID from JSONBin cloud configuration
        const cloudResponse = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
            headers: { "X-Master-Key": MASTER_KEY }
        });
        const cloudData = await cloudResponse.json();
        const activeUrl = cloudData.record.url;
        const spreadsheetId = activeUrl.match(/\/d\/([a-zA-Z0-9-_]+)/)[1];
        
        // 2. Fetch data directly from CSV Export link
        const response = await fetch(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&cache_bypass=${Date.now()}`);
        const csvText = await response.text();
        const rows = csvText.split(/\r?\n/).filter(r => r.trim() !== "");
        
        if (rows.length === 0) throw new Error("Spreadsheet data is completely empty.");

        // 🎯 Auto-Detect correct delimiter (comma vs semicolon)
        const firstRow = rows[0];
        const delimiter = firstRow.includes(';') ? ';' : ',';

        // 3. Extract Headers & Match User Input row
        const headers = parseCSVLine(rows[0], delimiter);
        
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
        
        // Update header block title code text
        document.getElementById('dash-code-display').innerText = values[0].toUpperCase();

        const container = document.getElementById('festa-data-container');
        container.innerHTML = ''; // Clear out the placeholder cards

        // 4. Construct dynamic grid lists using matching headers layout
        headers.forEach((header, index) => {
            if (index === 0 || !header) return; // Skip displaying voucher column twice

            const val = values[index] ? values[index] : "0";
            const cleanHeader = header.toLowerCase();

            // Distinctive color-badge configurations for each cell condition
            let cardColors = "bg-[#F5F5F7] text-gray-900";
            if (cleanHeader.includes('remain')) {
                cardColors = "bg-blue-50 text-blue-700 border border-blue-100";
            } else if (cleanHeader.includes('expir')) {
                cardColors = "bg-rose-50 text-rose-700 border border-rose-100";
            } else if (cleanHeader.includes('used')) {
                cardColors = "bg-amber-50 text-amber-800";
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
    document.getElementById('check-btn').addEventListener('click', streamLiveVerification);
    document.getElementById('back-btn').addEventListener('click', () => {
        document.getElementById('voucher-input').value = '';
        renderView('view-entry');
    });
});
