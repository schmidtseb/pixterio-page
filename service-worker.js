const CACHE_NAME = 'pixterio-v1';
const urlsToCache = [
  'index.html',
  'manifest.json',
  'favicon.ico',
  'logo192.png',
  'logo512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

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

  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response;
      }
      return fetch(event.request);
    }),
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
