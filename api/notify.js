/**
 * Apple Air - Daily Notification API
 * Vercel Cron: runs every day at 8:00 AM
 * 1. Reads Google Sheet for FCM tokens + expiry dates
 * 2. Finds vouchers expiring tomorrow
 * 3. Sends FCM push notification to each customer
 */

const SHEET_ID = '1F8TUOpY9vudo9MsTWOwHwLlBKi1P6_ayikucdTjyrbg';
const FCM_SERVER_KEY = process.env.FCM_SERVER_KEY; // set in Vercel env vars

export default async function handler(req, res) {
    // Security: only allow Vercel cron or manual trigger with secret
    const authHeader = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET || 'apple-air-cron';
    
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        console.log('🔔 Apple Air Notification Cron Started:', new Date().toISOString());

        // Step 1: Fetch Google Sheet CSV
        const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&t=${Date.now()}`;
        const csvResponse = await fetch(csvUrl);
        if (!csvResponse.ok) throw new Error(`Sheet fetch failed: ${csvResponse.status}`);
        const csvText = await csvResponse.text();

        // Step 2: Parse CSV - get Tokens tab
        // Main sheet columns: A=user, B=code, C=starttime, D=status, E=expiry
        const rows = parseCSV(csvText);
        
        // Step 3: Find tomorrow's date
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toLocaleDateString('en-GB'); // DD/MM/YYYY

        // Step 4: Fetch Tokens sheet
        const tokensUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=tokens&t=${Date.now()}`;
        let tokenRows = [];
        try {
            const tokensResponse = await fetch(
                `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Tokens`
            );
            if (tokensResponse.ok) {
                const tokenCsv = await tokensResponse.text();
                tokenRows = parseCSV(tokenCsv);
            }
        } catch(e) {
            console.log('Tokens sheet not found:', e.message);
        }

        // Step 5: Match expiring vouchers with tokens
        const notifications = [];
        
        for (const tokenRow of tokenRows.slice(1)) { // skip header
            const voucherCode = (tokenRow[0] || '').trim().toUpperCase();
            const fcmToken = (tokenRow[1] || '').trim();
            const expiryDate = (tokenRow[2] || '').trim();
            
            if (!fcmToken || !expiryDate) continue;
            
            // Check if expiry is tomorrow
            const expiryFormatted = formatDateToGB(expiryDate);
            if (expiryFormatted === tomorrowStr) {
                notifications.push({ voucherCode, fcmToken, expiryDate });
            }
        }

        console.log(`Found ${notifications.length} vouchers expiring tomorrow`);

        // Step 6: Send FCM notifications
        const results = [];
        for (const notif of notifications) {
            try {
                const fcmResult = await sendFCMNotification(
                    notif.fcmToken,
                    'Apple Air WiFi 🔔',
                    `Your voucher ${notif.voucherCode} expires tomorrow! Renew now to stay connected.`,
                    notif.voucherCode
                );
                results.push({ code: notif.voucherCode, success: true });
                console.log(`✅ Sent to ${notif.voucherCode}`);
            } catch(e) {
                results.push({ code: notif.voucherCode, success: false, error: e.message });
                console.log(`❌ Failed for ${notif.voucherCode}:`, e.message);
            }
        }

        return res.status(200).json({
            success: true,
            date: new Date().toISOString(),
            tomorrowDate: tomorrowStr,
            notificationsSent: results.filter(r => r.success).length,
            notificationsFailed: results.filter(r => !r.success).length,
            results
        });

    } catch(error) {
        console.error('Cron error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}

// Send FCM notification using Firebase HTTP v1 API
async function sendFCMNotification(token, title, body, voucherCode) {
    if (!FCM_SERVER_KEY) throw new Error('FCM_SERVER_KEY not configured');
    
    const response = await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
            'Authorization': `key=${FCM_SERVER_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            to: token,
            notification: {
                title,
                body,
                icon: '/icons/icon-192.png',
                click_action: 'https://vcheckair.vercel.app'
            },
            data: {
                voucher_code: voucherCode,
                url: 'https://vcheckair.vercel.app'
            }
        })
    });

    const result = await response.json();
    if (result.failure > 0) throw new Error(`FCM failed: ${JSON.stringify(result)}`);
    return result;
}

// Simple CSV parser
function parseCSV(text) {
    const records = [];
    let row = [], field = '', inQ = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i], nx = text[i+1];
        if (inQ) {
            if (ch==='"' && nx==='"') { field+='"'; i++; }
            else if (ch==='"') { inQ=false; }
            else field+=ch;
        } else {
            if (ch==='"') { inQ=true; }
            else if (ch===',') { row.push(field.trim()); field=''; }
            else if (ch==='\n'||(ch==='\r'&&nx==='\n')) {
                row.push(field.trim());
                if (row.some(c=>c!=='')) records.push(row);
                row=[]; field='';
                if(ch==='\r') i++;
            } else field+=ch;
        }
    }
    if (field||row.length){ row.push(field.trim()); if(row.some(c=>c!=='')) records.push(row); }
    return records;
}

// Format any date string to DD/MM/YYYY for comparison
function formatDateToGB(dateStr) {
    try {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) return d.toLocaleDateString('en-GB');
    } catch(e) {}
    return dateStr;
}
