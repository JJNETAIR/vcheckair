/**
 * Apple Air - Daily Notification API (FCM v1)
 * Vercel Cron: runs every day at 5:00 AM UTC (8:00 AM Jeddah)
 */

const SHEET_ID = '1F8TUOpY9vudo9MsTWOwHwLlBKi1P6_ayikucdTjyrbg';
const PROJECT_ID = 'apple-air';

export default async function handler(req, res) {
    try {
        console.log('Apple Air Cron Started:', new Date().toISOString());

        // Step 1: Get OAuth2 access token using service account
        const accessToken = await getAccessToken();

        // Step 2: Fetch Tokens sheet from Google Sheets
        const tokensUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Tokens&t=${Date.now()}`;
        const tokensResponse = await fetch(tokensUrl);
        if (!tokensResponse.ok) {
            return res.status(200).json({ success: true, message: 'No Tokens sheet yet', sent: 0 });
        }
        const tokensCsv = await tokensResponse.text();
        const tokenRows = parseCSV(tokensCsv);

        if (tokenRows.length < 2) {
            return res.status(200).json({ success: true, message: 'No subscribers yet', sent: 0 });
        }

        // Step 3: Find tomorrow's date
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toLocaleDateString('en-GB'); // DD/MM/YYYY

        console.log('Looking for expiry date:', tomorrowStr);

        // Step 4: Send notifications to matching vouchers
        let sent = 0, failed = 0;
        for (const row of tokenRows.slice(1)) {
            const voucherCode = (row[0] || '').replace(/"/g,'').trim();
            const fcmToken   = (row[1] || '').replace(/"/g,'').trim();
            const expiryDate = (row[2] || '').replace(/"/g,'').trim();

            if (!fcmToken || !expiryDate) continue;

            // Parse expiry and compare with tomorrow
            const expiryGB = toGB(expiryDate);
            if (expiryGB !== tomorrowStr) continue;

            try {
                await sendFCMv1(accessToken, fcmToken, voucherCode);
                sent++;
                console.log(`Sent to ${voucherCode}`);
            } catch(e) {
                failed++;
                console.log(`Failed for ${voucherCode}:`, e.message);
            }
        }

        return res.status(200).json({ success: true, sent, failed, date: tomorrowStr });

    } catch(error) {
        console.error('Cron error:', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
}

// ── SEND FCM v1 NOTIFICATION ─────────────────────────────────────────
async function sendFCMv1(accessToken, token, voucherCode) {
    const response = await fetch(
        `https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/messages:send`,
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: {
                    token: token,
                    notification: {
                        title: 'Apple Air WiFi 🔔',
                        body: `Your voucher ${voucherCode} expires tomorrow! Renew now to stay connected.`
                    },
                    webpush: {
                        headers: { 'Urgency': 'high' },
                        notification: {
                            icon: 'https://vcheckair.vercel.app/icons/icon-192.png',
                            badge: 'https://vcheckair.vercel.app/icons/icon-192.png',
                            requireInteraction: true,
                            vibrate: [200, 100, 200],
                            tag: `apple-air-expiry-${voucherCode}`,
                            renotify: true,
                            click_action: 'https://vcheckair.vercel.app'
                        },
                        fcm_options: { link: 'https://vcheckair.vercel.app' }
                    },
                    data: {
                        voucher_code: voucherCode,
                        url: 'https://vcheckair.vercel.app',
                        tag: `apple-air-expiry-${voucherCode}`
                    }
                }
            })
        }
    );
    const result = await response.json();
    if (!response.ok) throw new Error(JSON.stringify(result));
    return result;
}

// ── GET OAUTH2 ACCESS TOKEN FROM SERVICE ACCOUNT ─────────────────────
async function getAccessToken() {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT' };
    const payload = {
        iss: serviceAccount.client_email,
        scope: 'https://www.googleapis.com/auth/firebase.messaging',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600
    };

    const jwt = await createJWT(header, payload, serviceAccount.private_key);

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
    });

    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) throw new Error('Failed to get access token: ' + JSON.stringify(tokenData));
    return tokenData.access_token;
}

// ── CREATE JWT FOR SERVICE ACCOUNT ───────────────────────────────────
async function createJWT(header, payload, privateKeyPem) {
    const encode = obj => btoa(JSON.stringify(obj))
        .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

    const signingInput = `${encode(header)}.${encode(payload)}`;

    // Import private key
    const pemContents = privateKeyPem
        .replace('-----BEGIN PRIVATE KEY-----', '')
        .replace('-----END PRIVATE KEY-----', '')
        .replace(/\s/g, '');
    
    const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
    
    const cryptoKey = await crypto.subtle.importKey(
        'pkcs8', binaryKey.buffer,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false, ['sign']
    );

    const signature = await crypto.subtle.sign(
        'RSASSA-PKCS1-v1_5',
        cryptoKey,
        new TextEncoder().encode(signingInput)
    );

    const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
        .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

    return `${signingInput}.${sigB64}`;
}

// ── CSV PARSER ────────────────────────────────────────────────────────
function parseCSV(text) {
    const records = [];
    let row = [], field = '', inQ = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i], nx = text[i+1];
        if (inQ) {
            if (ch==='"'&&nx==='"'){field+='"';i++;}
            else if(ch==='"'){inQ=false;}
            else field+=ch;
        } else {
            if(ch==='"'){inQ=true;}
            else if(ch===','){row.push(field.trim());field='';}
            else if(ch==='\n'||(ch==='\r'&&nx==='\n')){
                row.push(field.trim());
                if(row.some(c=>c!==''))records.push(row);
                row=[];field='';
                if(ch==='\r')i++;
            } else field+=ch;
        }
    }
    if(field||row.length){row.push(field.trim());if(row.some(c=>c!==''))records.push(row);}
    return records;
}

// ── DATE FORMATTER ────────────────────────────────────────────────────
function toGB(dateStr) {
    if (!dateStr) return '';
    const s = dateStr.trim();

    // Already DD/MM/YYYY
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;

    // Handle "May 28, 2026" or "May 28, 2026 16:04:42"
    try {
        const d = new Date(s);
        if (!isNaN(d.getTime())) {
            const dd = String(d.getDate()).padStart(2, '0');
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const yyyy = d.getFullYear();
            return `${dd}/${mm}/${yyyy}`;
        }
    } catch(e) {}

    // Fallback: strip time part and try again
    const datePart = s.split(' ')[0];
    try {
        const d = new Date(datePart);
        if (!isNaN(d.getTime())) {
            const dd = String(d.getDate()).padStart(2, '0');
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const yyyy = d.getFullYear();
            return `${dd}/${mm}/${yyyy}`;
        }
    } catch(e) {}

    return s;
}
