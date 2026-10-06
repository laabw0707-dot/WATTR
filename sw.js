// VERSION: v1.0.0
const VERSION = 'v1.0.0';
const CACHE = 'watar-' + VERSION;
const FONT_CACHE = 'watar-fonts';
const CORE = [
  './', './index.html', './manifest.webmanifest', './storage.js', './check.html',
  './icon-192.png', './icon-512.png', './maskable-192.png', './maskable-512.png',
  './apple-touch-icon.png', './favicon-32.png'
];
const FONT_CSS = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600;700&display=swap';

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(CORE.map(u => new Request(u, { cache: 'reload' })));
    try { // الخط: محاولة مسبقة، لا تُفشل التثبيت
      const fc = await caches.open(FONT_CACHE);
      const r = await fetch(FONT_CSS, { mode: 'cors' });
      if (r.ok) {
        await fc.put(FONT_CSS, r.clone());
        const css = await r.text();
        const urls = [...css.matchAll(/url\((https:[^)]+)\)/g)].map(m => m[1]);
        await Promise.all(urls.map(u => fetch(u, { mode: 'cors' }).then(x => x.ok && fc.put(u, x)).catch(() => {})));
      }
    } catch (_) {}
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('watar-') && k !== CACHE && k !== FONT_CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // الخطوط: كاش أولًا ثم الشبكة مع تحديث
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith((async () => {
      const fc = await caches.open(FONT_CACHE);
      const hit = await fc.match(req);
      const net = fetch(req).then(r => { if (r && (r.ok || r.type === 'opaque')) fc.put(req, r.clone()); return r; }).catch(() => null);
      return hit || (await net) || new Response('', { status: 504 });
    })());
    return;
  }

  if (url.origin !== location.origin) return;

  // التنقّل: الشبكة أولًا ثم الكاش، وبديل index.html بدون إنترنت
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const r = await fetch(req);
        if (r.ok) { const c = await caches.open(CACHE); c.put(req, r.clone()); }
        return r;
      } catch (_) {
        const c = await caches.open(CACHE);
        return (await c.match(req, { ignoreSearch: true })) || (await c.match('./index.html')) || Response.error();
      }
    })());
    return;
  }

  // باقي الملفات: كاش أولًا مع تحديث بالخلفية
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const hit = await c.match(req, { ignoreSearch: true });
    const net = fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => null);
    return hit || (await net) || Response.error();
  })());
});
