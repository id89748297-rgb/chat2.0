// === СЕРВИС-ВОРКЕР: приёмник push-уведомлений ===
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(clients.claim()));

self.addEventListener('push', (event) => {
let data = {};
try { data = event.data.json(); } catch (err) { data = { title: 'Чат команды', body: 'Новое сообщение' }; }
event.waitUntil(self.registration.showNotification(data.title || 'Чат команды', {
body: data.body || 'Новое сообщение',
tag: data.tag || 'clc-chat',
renotify: true,
data: { url: data.url || './' }
}));
});

self.addEventListener('notificationclick', (event) => {
event.notification.close();
event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
for (const c of list) {
if ('focus' in c) { c.navigate(event.notification.data && event.notification.data.url || './').catch(() => {}); return c.focus(); }
}
return clients.openWindow(event.notification.data && event.notification.data.url || './');
}));
});
