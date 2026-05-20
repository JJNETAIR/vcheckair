async function streamLiveVerification() {
    const inputEl = document.getElementById('voucher-input');
    const userInput = inputEl.value.trim().toLowerCase();
    if (!userInput) return alert('Enter voucher code.');

    renderView('view-loading');

    try {
        // 1. Get the Sheet ID from JSONBin
        const cloudResponse = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, { headers: { "X-Master-Key": MASTER_KEY }});
        const cloudData = await cloudResponse.json();
        const spreadsheetId = cloudData.record.url.match(/\/d\/([a-zA-Z0-9-_]+)/)[1];
        
        // 2. Fetch CSV with cache bypass
        const response = await fetch(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&cache_bypass=${Date.now()}`);
        const csvText = await response.text();
        const rows = csvText.split(/\r?\n/).filter(r => r.trim() !== "");
        
        // 3. Map Headers
        const headers = rows[0].split(',').map(h => h.trim());
        const matchedRow = rows.find(row => row.toLowerCase().includes(userInput));

        if (!matchedRow) {
            alert("Voucher not found.");
            renderView('view-entry');
            return;
        }

        const values = matchedRow.split(',');
        const container = document.getElementById('festa-data-container');
        container.innerHTML = ''; 

        // 4. Dynamic Loop: Display EVERYTHING
        headers.forEach((header, index) => {
            const val = values[index] ? values[index].trim() : "-";
            // Highlight row if it contains "expir" or "date"
            const isHighlight = header.toLowerCase().includes('expir') || header.toLowerCase().includes('date');
            
            container.innerHTML += `
                <div class="flex justify-between items-center px-5 py-4 border-b border-gray-100">
                    <span class="text-xs font-bold text-gray-400 uppercase tracking-widest">${header}</span>
                    <span class="text-base font-bold ${isHighlight ? 'text-rose-600' : 'text-gray-900'}">${val}</span>
                </div>`;
        });

        renderView('view-dashboard');
    } catch (err) {
        alert("Sync error. Check if Sheet is 'Public'.");
        renderView('view-entry');
    }
}
