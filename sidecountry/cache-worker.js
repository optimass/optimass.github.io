const CACHE = 'sidecountry-physics-2';
const FILES = [
  './', './index.html', './styles.css?v=2', './game.js?v=2', './engine.js?v=2',
  './physics.js?v=2', './world.js?v=2', './riders.js?v=2', './audio.js?v=2',
  './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png',
  './lib/three.module.js', './lib/rapier.es.js', './lib/THREE-LICENSE.txt', './lib/RAPIER-LICENSE.txt',
  './lib/fonts/dm-sans-normal.woff2', './lib/fonts/dm-serif-display-italic.woff2',
  './lib/fonts/dm-serif-display-normal.woff2', './lib/fonts/dmsans-OFL.txt', './lib/fonts/dmserifdisplay-OFL.txt',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES.map(path => new Request(new URL(path, self.location), { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('sidecountry-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then(async response => {
      if (response.ok) { const cache = await caches.open(CACHE); await cache.put(event.request, response.clone()); }
      return response;
    }).catch(async () => (await caches.match(event.request)) || caches.match(new URL('./index.html', self.location))));
  } else event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});
