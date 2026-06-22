const CACHE_NAME = 'raidighi-ccc-v6';
const ASSETS = ['index.html', 'manifest.json', 'offline.html'];

const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="bn">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Offline — Raidighi CCC</title>
<style>
  body { margin:0; background:#1a1a2e; display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; font-family:sans-serif; text-align:center; padding:24px; box-sizing:border-box; }
  .icon  { font-size:72px; margin-bottom:20px; animation:pulse 2s ease-in-out infinite; }
  h1     { color:#fff; font-size:24px; margin-bottom:10px; }
  p      { color:rgba(255,255,255,0.6); font-size:14px; line-height:1.7; margin-bottom:32px; }
  button { padding:14px 36px; border-radius:50px; background:linear-gradient(90deg,#ff6b6b,#ffd93d); color:#fff; font-size:15px; font-weight:700; border:none; cursor:pointer; }
  @keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.08)} }
</style>
</head>
<body>
  <div class="icon">📡</div>
  <h1>ইন্টারনেট নেই!</h1>
  <p>আপনার নেটওয়ার্ক সংযোগ পাওয়া যাচ্ছে না।<br>WiFi বা Mobile Data চালু করে চেষ্টা করুন।</p>
  <button onclick="location.reload()">🔄 আবার চেষ্টা করুন</button>
</body>
</html>`;

self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE_NAME).then(async cache => {
            const offlineBlob = new Blob([OFFLINE_HTML], { type: 'text/html' });
            const offlineResp = new Response(offlineBlob, { headers: { 'Content-Type': 'text/html' } });
            await cache.put('offline.html', offlineResp);
            try { await cache.addAll(['index.html', 'manifest.json']); } catch(e) {}
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', e => {
    if (e.request.method !== 'GET') return;
    const url = new URL(e.request.url);

    // notices.json — সবসময় নেটওয়ার্ক থেকে আনো (cache-busting সহ)
    // যাতে admin আপডেট করলে ইউজাররা তাৎক্ষণিক পায়
    if (url.pathname.endsWith('notices.json')) {
        e.respondWith(
            fetch(e.request)
                .then(resp => {
                    const clone = resp.clone();
                    caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
                    return resp;
                })
                .catch(() => caches.match('notices.json'))
        );
        return;
    }

    if (url.origin === self.location.origin) {
        e.respondWith(
            caches.match(e.request)
                .then(cached => cached || fetch(e.request)
                    .then(resp => {
                        const clone = resp.clone();
                        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
                        return resp;
                    })
                    .catch(() => caches.match('offline.html'))
                )
        );
    } else {
        e.respondWith(
            fetch(e.request).catch(() => caches.match('offline.html'))
        );
    }
});

/* ── PUSH NOTIFICATIONS ── */
self.addEventListener('push', e => {
    const data = e.data ? e.data.json() : {};
    const title   = data.title   || 'Raidighi CCC';
    const options = {
        body:    data.body    || 'নতুন আপডেট এসেছে!',
        icon:    data.icon    || 'https://cdn.aptoide.com/imgs/4/d/8/4d8c88cd950685bd2cf5aa33484f16a8_icon.png',
        badge:   data.badge   || 'https://cdn.aptoide.com/imgs/4/d/8/4d8c88cd950685bd2cf5aa33484f16a8_icon.png',
        vibrate: [200, 100, 200],
        data:    { url: data.url || '/' }
    };
    e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', e => {
    e.notification.close();
    const target = e.notification.data && e.notification.data.url ? e.notification.data.url : '/';
    e.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
            for (const client of list) {
                if (client.url === target && 'focus' in client) return client.focus();
            }
            if (clients.openWindow) return clients.openWindow(target);
        })
    );
});
