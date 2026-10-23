// Offline support: keeps a copy of the app on the phone so it opens with no signal.
// When online it always tries the newest files first, so updates show up on the next open.
// Change VERSION when files are added or removed below.
const VERSION = 'v1';
const CACHE = `print-pricer-${VERSION}`;
const FONT_CACHE = 'print-pricer-fonts';
const APP_FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/pricing.js', 'js/store.js', 'js/ui.js',
  'js/screens/quote.js', 'js/screens/breakdown.js', 'js/screens/history.js', 'js/screens/library.js', 'js/screens/settings.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(APP_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('print-pricer-') && k !== CACHE && k !== FONT_CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(fontsFirstFromCache(req));
  } else if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(req));
  }
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const slow = new Promise((_, reject) => setTimeout(() => reject(new Error('slow network')), 4000));
    const res = await Promise.race([fetch(req), slow]);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    const hit = (await cache.match(req, { ignoreSearch: true })) || (req.mode === 'navigate' ? await cache.match('index.html') : null);
    if (hit) return hit;
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

async function fontsFirstFromCache(req) {
  const cache = await caches.open(FONT_CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
    return res;
  } catch {
    return new Response('', { status: 503 });
  }
}
