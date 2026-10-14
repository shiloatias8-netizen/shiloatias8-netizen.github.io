// Saves the app on the phone so it works without internet.
// Shows the saved copy right away and quietly fetches a fresh copy in the background,
// so changes you upload reach the phone the next time the app is opened.

const CACHE = 'milon-v1';
const CORE = ['./', 'index.html', 'style.css', 'app.js', 'words.json', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(CORE);
    // Also save every picture listed in words.json
    try {
      const data = await (await fetch('words.json', { cache: 'no-cache' })).json();
      const images = [...new Set(data.words.map(w => w.image).filter(Boolean))];
      await Promise.all(images.map(src => cache.add(src).catch(() => {})));
    } catch (e) { /* the pictures will be saved when they are first shown */ }
    self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, { ignoreSearch: true });
    const fresh = fetch(req, { cache: 'no-cache' })
      .then(res => {
        if (res.ok) cache.put(req, res.clone());
        return res;
      })
      .catch(() => null);

    if (cached) {
      event.waitUntil(fresh);
      return cached;
    }
    return (await fresh) || (req.mode === 'navigate' && await cache.match('index.html')) || Response.error();
  })());
});
