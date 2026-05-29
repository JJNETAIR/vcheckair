/**
 * Apple Air - Complaint Notification API (FCM v1)
 * Called by Apps Script to send FCM notifications for complaints
 * POST /api/complaint-notify
 */

const PROJECT_ID = 'apple-air';

export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Allow GET for testing
    if (req.method === 'GET') {
        return res.status(200).json({ status: 'Apple Air Complaint Notify API ✅' });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    try {
        const { fcmToken, srNumber, type, issueType } = req.body || {};

        console.log('Complaint notify request:', { srNumber, type, hasToken: !!fcmToken });

        if (!fcmToken || !srNumber || !type) {
            return res.status(400).json({ success: false, error: 'fcmToken, srNumber and type are required' });
        }

        let title, body;
        if (type === 'received') {
            title = `Apple Air — ${srNumber} Received 🔧`;
            body  = `Your complaint (${issueType || 'Issue'}) has been received. We're on it!`;
        } else if (type === 'resolved') {
            title = `Apple Air — ${srNumber} Resolved ✅`;
            body  = `Your issue has been resolved! Enjoy your connection. 🚀`;
        } else {
            return res.status(400).json({ success: false, error: 'type must be received or resolved' });
        }

        const accessToken = await getAccessToken();
        await sendFCMv1(accessToken, fcmToken, title, body, type);

        console.log(`✅ Sent: ${srNumber} (${type})`);
        return res.status(200).json({ success: true, srNumber, type });

    } catch (error) {
        console.error('Complaint notify error:', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
}

async function sendFCMv1(accessToken, token, title, body, type) {
    const tag = `apple-air-sr-${srNumber}`;
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
                        headers: { 'Urgency': 'high' },
                        notification: {
                            icon: 'https://vcheckair.vercel.app/icons/icon-192.png',
                            badge: 'https://vcheckair.vercel.app/icons/icon-192.png',
                            requireInteraction: true,
                            vibrate: [200, 100, 200],
                            tag: tag,
                            renotify: true,
                            click_action: 'https://vcheckair.vercel.app'
                        },
                        fcm_options: { link: 'https://vcheckair.vercel.app' }
                    },
                    data: { url: 'https://vcheckair.vercel.app', tag: tag }
                }
            })
        }
    );
    const result = await response.json();
    if (!response.ok) throw new Error(JSON.stringify(result));
    return result;
}

async function getAccessToken() {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    const now = Math.floor(Date.now() / 1000);
    const header  = { alg: 'RS256', typ: 'JWT' };
    const payload = {
        iss: serviceAccount.client_email,
        scope: 'https://www.googleapis.com/auth/firebase.messaging',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now, exp: now + 3600
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

async function createJWT(header, payload, privateKeyPem) {
    const encode = obj => btoa(JSON.stringify(obj)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
    const signingInput = `${encode(header)}.${encode(payload)}`;
    const pemContents = privateKeyPem.replace('-----BEGIN PRIVATE KEY-----','').replace('-----END PRIVATE KEY-----','').replace(/\s/g,'');
    const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
    const cryptoKey = await crypto.subtle.importKey('pkcs8', binaryKey.buffer, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
    const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(signingInput));
    const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
    return `${signingInput}.${sigB64}`;
}
