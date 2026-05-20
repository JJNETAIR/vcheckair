const BIN_ID = "6a0cacb36877513b279bbe63"; 
const MASTER_KEY = "$2a$10$LS7aJr2QiV2RpptiyeBA9umWLUV9NV8nYaEVHT91YLShcgX1xNPbC"; 

function renderView(viewId) {
    ['view-entry', 'view-dashboard', 'view-loading'].forEach(v => {
        const el = document.getElementById(v);
        if (el) v === viewId ? el.classList.remove('hidden') : el.classList.add('hidden');
    });
}

async function streamLiveVerification() {
    const inputEl = document.getElementById('voucher-input');
    const userInput = inputEl.value.trim().toLowerCase();
    if (!userInput) return alert('Please enter a voucher code.');

    renderView('view-loading');

    try {
        const cloudResponse = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, { headers: { "X-Master-Key": MASTER_KEY }});
        const cloudData = await cloudResponse.json();
        const spreadsheetId = cloudData.record.url.match(/\/d\/([a-zA-Z0-9-_]+)/)[1];
        
        const response = await fetch(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&cache_bypass=${Date.now()}`);
        const csvText = await response.text();
        const rows = csvText.split(/\r?\n/).filter(r => r.trim() !== "");
        
        // Split by comma (if your sheet uses semicolons, change the split to ';')
        const headers = rows[0].split(',').map(h => h.trim().toLowerCase());
        const matchedRow = rows.find(row => row.toLowerCase().includes(userInput));

        if (!matchedRow) {
            alert("Voucher not found.");
            renderView('view-entry');
            return;
        }

        const values = matchedRow.split(',');
        const container = document.getElementById('festa-data-container');
        container.innerHTML = ''; 

        // Build list dynamically
        headers.forEach((header, index) => {
            const val = values[index] ? values[index].trim() : "-";
            const isExp = header.includes('exp');
            
            container.innerHTML += `
                <div class="flex justify-between items-center px-5 py-4 border-b border-gray-100">
                    <span class="text-xs font-bold text-gray-400 uppercase tracking-widest">${header}</span>
                    <span class="text-base font-bold ${isExp ? 'text-rose-600' : 'text-gray-900'}">${val}</span>
                </div>`;
        });

        renderView('view-dashboard');
    } catch (err) {
        alert("Sync error: " + err.message);
        renderView('view-entry');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('check-btn').addEventListener('click', streamLiveVerification);
    document.getElementById('back-btn').addEventListener('click', () => renderView('view-entry'));
});
