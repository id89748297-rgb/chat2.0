// === WEB PUSH: уведомления без сервера (браузер → браузер) ===
// Ключи VAPID этого приложения. Приватный ключ в коде клиента — осознанный компромисс
// безсерверной схемы: любой, кто имеет код, может отправить push на известную ему подписку.
const PUSH_VAPID_PUBLIC_B64 = 'BIstkaWA-Y4xIGJxu86TPF4VrfCeb2iK9f8BXY1YZDZ1w4c3YWpDxUGz-kBiYNpzSTl5YAL-dYW2DaOM0HlvG6o';
const PUSH_VAPID_K_B64 = 'iy2RpYD5jjEgYnG7zpM8XhWt8J5vaIr1_wFdjVhkNnXDhzdhakPFQbP6QGJg2nNJOXlgAv51hbYNo4zQeW8bqg';
const PUSH_VAPID_PRIVATE_PKCS8_B64 = 'MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQg2PTj7-8GE0mGmYWHZR-MfO9NS93Jf5z3lfATPSvH8HOhRANCAASLLZGlgPmOMSBicbvOkzxeFa3wnm9oivX_AV2NWGQ2dcOHN2FqQ8VBs_pAYmDac0k5eWAC_nWFtg2jjNB5bxuq';

// === вспомогательные ===
function b64UrlToBytes(b64) {
const pad = '='.repeat((4 - b64.length % 4) % 4);
const base64 = (b64 + pad).replace(/-/g, '+').replace(/_/g, '/');
const raw = atob(base64);
const out = new Uint8Array(raw.length);
for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
return out;
}
function bytesToB64Url(bytes) {
let s = '';
for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// === включение/выключение уведомлений ===
async function enablePushNotifications() {
try {
if (!('serviceWorker' in navigator)) { showToast('❌ Браузер не поддерживает уведомления', 'error'); return; }
const permission = await Notification.requestPermission();
if (permission !== 'granted') { showToast('Разрешение на уведомления не выдано', 'error'); return; }
const reg = await navigator.serviceWorker.register('./sw.js');
await navigator.serviceWorker.ready;
const existing = await reg.pushManager.getSubscription();
const sub = existing || await reg.pushManager.subscribe({
userVisibleOnly: true,
applicationServerKey: b64UrlToBytes(PUSH_VAPID_PUBLIC_B64)
});
await db.collection('pushSubs').doc(currentUser.uid).set({
subscription: sub.toJSON(),
updatedAt: Date.now()
});
showToast('🔔 Уведомления включены', 'success');
} catch (err) {
console.error('push enable failed:', err);
showToast('❌ Не удалось включить: ' + (err.message || err), 'error');
}
renderPushButton();
}
async function disablePushNotifications() {
try {
if ('serviceWorker' in navigator) {
const reg = await navigator.serviceWorker.getRegistration();
if (reg) {
const sub = await reg.pushManager.getSubscription();
if (sub) await sub.unsubscribe();
}
}
if (currentUser) await db.collection('pushSubs').doc(currentUser.uid).delete();
showToast('🔕 Уведомления отключены', 'info');
} catch (err) {
console.error('push disable failed:', err);
}
renderPushButton();
}
async function togglePushNotifications() {
if (!currentUser) return;
try {
let sub = null;
if ('serviceWorker' in navigator) {
const reg = await navigator.serviceWorker.getRegistration();
if (reg) sub = await reg.pushManager.getSubscription();
}
if (sub) await disablePushNotifications();
else await enablePushNotifications();
} catch (err) { console.error(err); }
}
async function renderPushButton() {
const btn = document.getElementById('push-toggle-btn');
if (!btn || !currentUser) return;
try {
let sub = null;
if ('serviceWorker' in navigator) {
const reg = await navigator.serviceWorker.getRegistration();
if (reg) sub = await reg.pushManager.getSubscription();
}
btn.innerText = sub ? '🔕 Уведомления включены — нажать, чтобы отключить' : '🔔 Включить уведомления о сообщениях';
} catch (err) { btn.innerText = '🔔 Включить уведомления о сообщениях'; }
}

// === шифрование payload по стандарту Web Push (RFC 8291, схема aes128gcm) ===
async function hkdfExpandOne(prkBytes, infoStr) {
const enc = new TextEncoder();
const infoBase = enc.encode(infoStr);
const info = new Uint8Array(infoBase.length + 1);
info.set(infoBase);
info[info.length - 1] = 1; // счётчик HKDF-Expand = 1
const k = await crypto.subtle.importKey('raw', prkBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
return new Uint8Array(await crypto.subtle.sign('HMAC', k, info));
}
async function webPushEncrypt(subscription, plaintext) {
const enc = new TextEncoder();
const textBytes = enc.encode(plaintext);
const padded = new Uint8Array(textBytes.length + 1);
padded.set(textBytes);
padded[textBytes.length] = 2; // разделитель паддинга (пустой паддинг)
const uaPublic = b64UrlToBytes(subscription.keys.p256dh);
const authSecret = b64UrlToBytes(subscription.keys.auth);
const eph = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
const ephPubRaw = new Uint8Array(await crypto.subtle.exportKey('raw', eph.publicKey));
const receiverPub = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: receiverPub }, eph.privateKey, 256));
// PRK = HMAC(auth_secret, ecdh_secret) — HKDF-Extract
const prkKey = await crypto.subtle.importKey('raw', authSecret, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
const prk = new Uint8Array(await crypto.subtle.sign('HMAC', prkKey, shared));
const cek = (await hkdfExpandOne(prk, 'Content-Encoding: aes128gcm\0')).slice(0, 16);
const nonce = (await hkdfExpandOne(prk, 'Content-Encoding: nonce\0')).slice(0, 12);
const aesKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, padded));
// тело: salt(16) || rs(4096, big-endian) || idlen(65) || эфемерный ключ(65) || шифртекст
const salt = crypto.getRandomValues(new Uint8Array(16));
const out = new Uint8Array(16 + 4 + 1 + 65 + cipher.length);
out.set(salt, 0);
out.set([0, 0, 0x10, 0], 16);
out[20] = 65;
out.set(ephPubRaw, 21);
out.set(cipher, 86);
return out;
}

// === подпись VAPID (RFC 8292): JWT ES256 ===
async function vapidAuthorization(audience) {
const header = { typ: 'JWT', alg: 'ES256' };
// Apple требует реальный домен в sub — берём домен текущего сайта
const sub = 'mailto:admin@' + (location.hostname || 'clcsetup.vercel.app');
const payload = { aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub };
const encPart = (obj) => bytesToB64Url(new TextEncoder().encode(JSON.stringify(obj)));
const unsigned = encPart(header) + '.' + encPart(payload);
const key = await crypto.subtle.importKey('pkcs8', b64UrlToBytes(PUSH_VAPID_PRIVATE_PKCS8_B64), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(unsigned)));
// Apple принимает только 65-байтовый несжатый ключ (PUSH_VAPID_PUBLIC_B64)
return 'vapid t=' + unsigned + '.' + bytesToB64Url(sig) + ', k=' + PUSH_VAPID_PUBLIC_B64;
}

// === рассылка участникам команды (кроме себя) ===
async function sendPushToTeam(teamId, title, body) {
try {
if (!db || !currentUser) return;
const roles = teamRolesCache[teamId] || {};
const uids = Object.keys(roles).filter(uid => uid !== currentUser.uid);
if (!uids.length) return;
const payload = {
title: title || 'Чат команды',
body: (body || '').slice(0, 120),
tag: 'chat-' + teamId,
url: location.href.split('#')[0]
};
const payloadJson = JSON.stringify(payload);
for (const uid of uids) {
const doc = await db.collection('pushSubs').doc(uid).get();
if (!doc.exists) continue;
const sub = doc.data() && doc.data().subscription;
if (!sub || !sub.endpoint || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) continue;
try {
const encrypted = await webPushEncrypt(sub, payloadJson);
const auth = await vapidAuthorization(new URL(sub.endpoint).origin);
const res = await fetch(sub.endpoint, {
method: 'POST',
headers: { 'TTL': '3600', 'Urgency': 'normal', 'Content-Encoding': 'aes128gcm', 'Authorization': auth },
body: encrypted
});
// подписка протухла — убираем, чтобы не слать в пустоту
if (res.status === 404 || res.status === 410) {
db.collection('pushSubs').doc(uid).delete().catch(() => {});
}
} catch (err) {
console.error('push to', uid, 'failed:', err);
}
}
} catch (err) {
console.error('sendPushToTeam failed:', err);
}
}
