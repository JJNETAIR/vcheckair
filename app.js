const BIN_ID = "6a0cacb36877513b279bbe63"; 
const MASTER_KEY = "$2a$10$LS7aJr2QiV2RpptiyeBA9umWLUV9NV8nYaEVHT91YLShcgX1xNPbC"; 

function renderView(viewId) {
    ['view-entry', 'view-dashboard', 'view-loading'].forEach(v => {
        const el = document.getElementById(v);
        if (el) v === viewId ? el.classList.remove('hidden') : el.classList.add('hidden');
    });
}

// Smart CSV Row Parser supporting wrapped fields or commas safely
function safeSplitCSV(rowText) {
    let result = [];
    let insideQuotes = false;
    let entry = '';
    for (let i = 0; i < rowText.length; i++) {
        let char = rowText[i];
        if (char === '"') {
            insideQuotes = !insideQuotes;
        } else if (char === ',' && !insideQuotes) {
            result.push(entry.trim());
            entry = '';
        } else {
            entry += char;
        }
    }
    result.push(entry.trim());
    return result.map(val => val.replace(/^["']|["']$/g, '').trim());
}

async function streamLiveVerification() {
    const inputEl = document.getElementById('voucher-input');
    const userInput = inputEl.value.trim().toLowerCase();
    if (!userInput) return alert('Please key in a valid voucher code.');

    renderView('view-loading');

    try {
        // 1. Grab Active Sheet Link via Shared Configuration Cloud Bin
        const cloudResponse = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
            headers: { "X-Master-Key": MASTER_KEY }
        });
        const cloudData = await cloudResponse.json();
        const activeUrl = cloudData.record.url;
        const spreadsheetId = activeUrl.match(/\/d\/([a-zA-Z0-9-_]+)/)[1];
        
        // 2. Stream Fresh Data Drop directly from Source Link
        const response = await fetch(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&cache_bypass=${Date.now()}`);
        const csvText = await response.text();
        const rows = csvText.split(/\r?\n/).filter(r => r.trim() !== "");
        
        if (rows.length < 2) throw new Error("Database content appears empty.");

        // 3. Extract Headers and target active record mapping
        const headers = safeSplitCSV(rows[0]);
        const matchedRow = rows.find(row => {
            const columns = safeSplitCSV(row);
            return columns[0] && columns[0].toLowerCase() === userInput;
        });

        if (!matchedRow) {
            alert("This voucher code was not found or has expired.");
            renderView('view-entry');
            return;
        }

        const values = safeSplitCSV(matchedRow);
        document.getElementById('dash-code-display').innerText = values[0].toUpperCase();

        const container = document.getElementById('festa-data-container');
        container.innerHTML = ''; // Fresh layout clearout

        // 4. Generate dynamic presentation grid using matching headers
        headers.forEach((header, index) => {
            // Skip showing the plain input code again as a separate grid block
            if (index === 0 || !header) return;

            const val = values[index] ? values[index] : "N/A";
            const normalHeader = header.toLowerCase();

            // Set up tailored card design tokens depending on column purpose
            let stylingToken = "bg-[#F5F5F7] text-gray-900";
            if (normalHeader.includes('remain')) {
                stylingToken = "bg-blue-50/60 text-blue-700 border border-blue-100/50";
            } else if (normalHeader.includes('expir')) {
                stylingToken = "bg-rose-50/60 text-rose-700 border border-rose-100/50";
            } else if (normalHeader.includes('used')) {
                stylingToken = "bg-amber-50/40 text-amber-800";
            }

            container.innerHTML += `
                <div class="p-4 rounded-2xl flex flex-col justify-center space-y-1 ${stylingToken}">
                    <span class="text-[10px] font-bold uppercase tracking-wider opacity-60">${header}</span>
                    <span class="text-base font-bold tracking-tight">${val}</span>
                </div>`;
        });

        renderView('view-dashboard');

    } catch (err) {
        alert("System syncing failure: " + err.message);
        renderView('view-entry');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('check-btn').addEventListener('click', streamLiveVerification);
    document.getElementById('back-btn').addEventListener('click', () => {
        document.getElementById('voucher-input').value = '';
        renderView('view-entry');
    });
    document.getElementById('voucher-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') streamLiveVerification();
    });
});
