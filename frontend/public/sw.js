/* Service Worker Carto-facileSN
   Strategie: Network First sur index.html, Cache First sur assets statiques
   A chaque nouveau deploy, le SW est mis a jour et declenche une banniere
*/

const CACHE_NAME = 'carto-facilesn-v' + (self.CACHE_VERSION || Date.now());
const STATIC_CACHE = 'carto-static-v1';

// Assets a mettre en cache (les JS/CSS ont un hash donc changent a chaque build)
const ALWAYS_NETWORK = [
  '/',
  '/index.html',
];

self.addEventListener('install', event => {
  // Prendre le controle immediatement
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== STATIC_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // API calls: toujours reseau
  if (url.hostname !== self.location.hostname) {
    return;
  }

  // index.html: toujours reseau (jamais cache)
  if (ALWAYS_NETWORK.includes(url.pathname) || url.pathname === '/') {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Assets statiques /static/**: cache first (immutable)
  if (url.pathname.startsWith('/static/')) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(cache =>
        cache.match(event.request).then(cached => {
          if (cached) return cached;
          return fetch(event.request).then(response => {
            if (response.ok) cache.put(event.request, response.clone());
            return response;
          });
        })
      )
    );
    return;
  }

  // Reste: network first
  event.respondWith(
    fetch(event.request, { cache: 'no-cache' })
      .catch(() => caches.match(event.request))
  );
});

// Message depuis l'app pour forcer la mise a jour
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
