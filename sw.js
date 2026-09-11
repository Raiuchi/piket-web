const CACHE_VERSION = 'piket-web-v2.0.17';
const APP_SHELL = [
  './',
  './index.html',
  './assets/piket-core.js?v=2.0.17',
  './assets/piket-schedules.js?v=2.0.17',
  './manifest.json',
  './assets/fonts/manrope-cyrillic.woff2',
  './assets/fonts/manrope-latin.woff2',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/piket-signal.gif'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_VERSION).then(async cache => {
    const responses = await Promise.all(APP_SHELL.map(path => fetch(new Request(path, {cache:'reload'}))));
    await Promise.all(responses.map((response, index) => {
      if (!response.ok) throw new Error('Unable to refresh '+APP_SHELL[index]);
      return cache.put(APP_SHELL[index], response);
    }));
  }));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key.startsWith('piket-web-') && key !== CACHE_VERSION)
        .map(key => caches.delete(key))
    )).then(() => self.clients.claim()).then(() => self.clients.matchAll({type:'window'})).then(clients =>
      Promise.all(clients.map(client => client.navigate(client.url)))
    )
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin === self.location.origin) {
    if (event.request.mode === 'navigate' || url.pathname.endsWith('/index.html')) {
      event.respondWith(fetch(new Request(event.request, {cache:'no-store'})).then(response => {
        if (response.ok) caches.open(CACHE_VERSION).then(cache => cache.put('./index.html', response.clone()));
        return response;
      }).catch(() => caches.match('./index.html').then(cached => cached || caches.match('./'))));
      return;
    }
    event.respondWith(
      caches.match(event.request).then(cached => {
        const fresh = fetch(event.request).then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(event.request, copy));
        }
        return response;
        });
        return cached || fresh;
      })
    );
    return;
  }

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
        const copy = response.clone();
        caches.open(CACHE_VERSION).then(cache => cache.put(event.request, copy));
        return response;
      }))
    );
  }
});
