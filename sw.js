/* Leraar service worker: stale-while-revalidate for everything same-origin.
 * Bump VERSION whenever content or code changes, so old caches get cleaned up. */
const VERSION = 'leraar-v3';

const SHELL = [
  './',
  'index.html',
  'css/styles.css',
  'js/fsrs.js',
  'js/storage.js',
  'js/sync.js',
  'js/app.js',
  'manifest.webmanifest',
  'icons/icon.svg',
  'data/decks/index.json',
  'data/decks/cognates.json',
  'data/decks/a2-core.json',
  'data/decks/phrases.json',
  'data/decks/grammar-w1-4.json',
  'data/decks/mistakes.json',
  'data/lessons/index.json',
  'data/lessons/week01.json',
  'data/lessons/week02.json',
  'data/lessons/week03.json',
  'data/lessons/week04.json',
  'data/lessons/week05.json',
  'data/lessons/week07.json',
  'data/lessons/week08.json',
  'data/lessons/week10.json',
  'data/lessons/week11.json',
  'data/lessons/week12.json',
  'data/lessons/week13.json',
  'data/lessons/week14.json',
  'data/lessons/week15.json',
  'data/lessons/week16.json',
  'data/lessons/week17.json',
  'data/lessons/week19.json',
  'data/lessons/week20.json'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    caches.open(VERSION).then(cache =>
      cache.match(e.request).then(cached => {
        const fresh = fetch(e.request).then(resp => {
          if (resp.ok) cache.put(e.request, resp.clone());
          return resp;
        }).catch(() => cached);
        return cached || fresh;
      })
    )
  );
});
