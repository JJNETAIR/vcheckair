const BIN_ID = "6a0cacb36877513b279bbe63"; 
const MASTER_KEY = "$2a$10$LS7aJr2QiV2RpptiyeBA9umWLUV9NV8nYaEVHT91YLShcgX1xNPbC"; 

function renderView(viewId) {
    const views = ['view-entry', 'view-dashboard', 'view-loading'];
    views.forEach(v => {
        const el = document.getElementById(v);
        if (el) {
            v === viewId ? el.classList.remove('hidden') : el.classList.add('hidden');
        }
    });
}

async function streamLiveVerification() {
    const inputEl = document.getElementById('voucher-input');
    const userInput = inputEl.value.trim().toLowerCase();
    if (!userInput) return alert('Please enter a voucher code.');

    renderView('view-loading');

    try {
        // 1. Get Google Sheet URL from Cloud
        const cloudResponse = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
            headers: { "X-Master-Key": MASTER_KEY }
        });
        const cloudData = await cloudResponse.json();
        const activeUrl = cloudData.record.url;
        const spreadsheetId = activeUrl.match(/\/d\/([a-zA-Z0-9-_]+)/)[1];
        
        // 2. Fetch CSV Data
        const response = await fetch(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&cache_bypass=${Date.now()}`);
        const csvText = await response.text();
        const rows = csvText.split(/\r?\n/);
        
        // 3. Extract Headers and Find Row
        const headers = rows[0].split(',').map(h => h.trim());
        const matchedRow = rows.find(row => row.toLowerCase().includes(userInput));

        if (!matchedRow) {
            alert("Voucher not found!");
            renderView('view-entry');
            return;
        }

        const values = matchedRow.split(',');
        const container = document.getElementById('festa-data-container');
        container.innerHTML = ''; // Clear previous

        // 4. Dynamically loop through ALL columns found
        headers.forEach((header, index) => {
            if (values[index]) {
                container.innerHTML += `
                    <div class="flex justify-between items-center px-5 py-4">
                        <span class="text-sm font-medium text-[#86868B]">${header}</span>
                        <span class="text-base font-semibold text-gray-900">${values[index].trim()}</span>
                    </div>`;
            }
        });

        renderView('view-dashboard');

    } catch (err) {
        alert("Error connecting to database: " + err.message);
        renderView('view-entry');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('check-btn').addEventListener('click', streamLiveVerification);
    document.getElementById('back-btn').addEventListener('click', () => renderView('view-entry'));
});
