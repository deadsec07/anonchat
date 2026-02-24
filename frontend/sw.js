const CACHE_NAME = 'anonchat-v5';
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll([
    './', './index.html', './app.js', './styles.css'
  ])));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
});

self.addEventListener('push', (event) => {
  try {
    const data = event.data ? event.data.json() : {};
    const title = data.title || 'Anon Chat';
    const options = {
      body: data.body || '',
      icon: data.icon || './icons/icon-192.png',
      badge: data.badge || './icons/icon-192.png',
      data: data.url || '/',
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } catch (_) {}
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification && event.notification.data || '/';
  event.waitUntil(clients.openWindow(url));
});
