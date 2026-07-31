const CACHE_NAME = 'nekorin-quest-v3';
const APP_FILES = [
  './',
  './index.html',
  './styles.css?v=3',
  './polish.css?v=3',
  './app.js?v=3',
  './polish.js?v=3',
  './manifest.webmanifest',
  './assets/nekorin-avatar.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const isNavigation = event.request.mode === 'navigate';
  event.respondWith((async () => {
    try {
      const fresh = await fetch(event.request, { cache: 'no-store' });
      const cache = await caches.open(CACHE_NAME);
      cache.put(event.request, fresh.clone());
      return fresh;
    } catch {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      if (isNavigation) return caches.match('./index.html');
      throw new Error('Offline resource unavailable');
    }
  })());
});