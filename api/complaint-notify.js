/**
 * Apple Air - Complaint Notification API (FCM v1)
 * Called by Apps Script to send FCM notifications for complaints
 * POST /api/complaint-notify
 * Body: { fcmToken, srNumber, type: 'received' | 'resolved', issueType }
 */

const PROJECT_ID = 'apple-air';

export default async function handler(req, res) {
    // Allow POST only
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    // Allow Apps Script CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    try {
        const { fcmToken, srNumber, type, issueType } = req.body || {};

        if (!fcmToken || !srNumber || !type) {
            return res.status(400).json({ success: false, error: 'fcmToken, srNumber and type are required' });
        }

        // Build notification content based on type
        let title, body;
        if (type === 'received') {
            title = `Apple Air — SR#${srNumber} Received 🔧`;
            body = `Your complaint (${issueType || 'Issue'}) has been received. We're on it!`;
        } else if (type === 'resolved') {
            title = `Apple Air — SR#${srNumber} Resolved ✅`;
            body = `Your issue has been resolved! Enjoy your connection. 🚀`;
        } else {
            return res.status(400).json({ success: false, error: 'type must be received or resolved' });
        }

        // Get Firebase access token
        const accessToken = await getAccessToken();

        // Send FCM notification
        await sendFCMv1(accessToken, fcmToken, title, body);

        console.log(`✅ Complaint notification sent: SR#${srNumber} (${type})`);
        return res.status(200).json({ success: true, srNumber, type });

    } catch (error) {
        console.error('Complaint notify error:', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
}

// ── HANDLE OPTIONS (CORS preflight) ──────────────────────────────────
export const config = { api: { bodyParser: true } };

// ── SEND FCM v1 NOTIFICATION ─────────────────────────────────────────
async function sendFCMv1(accessToken, token, title, body) {
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
                    token,
                    notification: { title, body },
                    webpush: {
                        notification: {
                            icon: 'https://vcheckair.vercel.app/icons/icon-192.png',
                            click_action: 'https://vcheckair.vercel.app'
                        }
                    },
                    data: { url: 'https://vcheckair.vercel.app' }
                }
            })
        }
    );
    const result = await response.json();
    if (!response.ok) throw new Error(JSON.stringify(result));
    return result;
}

// ── GET OAUTH2 ACCESS TOKEN ───────────────────────────────────────────
async function getAccessToken() {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    const now = Math.floor(Date.now() / 1000);
    const header  = { alg: 'RS256', typ: 'JWT' };
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
    if (!tokenData.access_token) throw new Error('Failed to get access token');
    return tokenData.access_token;
}

// ── CREATE JWT ────────────────────────────────────────────────────────
async function createJWT(header, payload, privateKeyPem) {
    const encode = obj => btoa(JSON.stringify(obj))
        .replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
    const signingInput = `${encode(header)}.${encode(payload)}`;
    const pemContents = privateKeyPem
        .replace('-----BEGIN PRIVATE KEY-----','')
        .replace('-----END PRIVATE KEY-----','')
        .replace(/\s/g,'');
    const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
    const cryptoKey = await crypto.subtle.importKey(
        'pkcs8', binaryKey.buffer,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false, ['sign']
    );
    const signature = await crypto.subtle.sign(
        'RSASSA-PKCS1-v1_5', cryptoKey,
        new TextEncoder().encode(signingInput)
    );
    const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
        .replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
    return `${signingInput}.${sigB64}`;
}
