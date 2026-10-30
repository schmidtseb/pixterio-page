// Bump CACHE_NAME whenever the precache list or caching strategy changes.
const CACHE_NAME = 'pixterio-v2';

// Caches that must survive activation cleanup (they hold user data, not build output).
const PERSISTENT_CACHES = ['shared-files'];

const urlsToCache = [
  'index.html',
  'manifest.json',
  'favicon.ico',
  'logo192.png',
  'logo512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      // A single missing asset must not abort the whole install.
      .catch(err => console.warn('Precache incomplete:', err))
      .then(() => self.skipWaiting())
  );
});

function isNavigationRequest(request) {
  return request.mode === 'navigate' || request.destination === 'document';
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (event.request.method === 'POST' && url.pathname === '/share-target') {
    event.respondWith(
      (async () => {
        try {
          const formData = await event.request.formData();
          const mediaFile = formData.get('media');

          if (mediaFile && mediaFile instanceof File) {
            const cache = await caches.open('shared-files');
            await cache.put(
              new Request('/shared-file'),
              new Response(mediaFile, {
                headers: {
                  'Content-Type': mediaFile.type,
                  'X-File-Name': encodeURIComponent(mediaFile.name),
                },
              }),
            );
            return Response.redirect('/?shared-file=true', 303);
          }
        } catch (err) {
          console.error('Share target processing failed:', err);
        }
        return Response.redirect('/', 303);
      })(),
    );
    return;
  }

  // Only same-origin GETs are cached; everything else goes straight to the network.
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // The app shell is a single inlined index.html, so serving it cache-first would
  // pin every installed client to the build it first saw. Go to the network first
  // and fall back to the cache only when offline.
  if (isNavigationRequest(event.request)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('index.html', copy));
          }
          return response;
        })
        .catch(() => caches.match('index.html').then((r) => r || caches.match(event.request))),
    );
    return;
  }

  // Static assets (icons, wasm, audio) are content-stable: cache-first is fine.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response && response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      });
    }),
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(cacheNames =>
        Promise.all(
          cacheNames
            .filter(name => name !== CACHE_NAME && !PERSISTENT_CACHES.includes(name))
            .map(name => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
