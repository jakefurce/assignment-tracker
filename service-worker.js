// Assignment Tracker — Service Worker

const CACHE_NAME = 'assignment-tracker-v2';
const CACHED_FILES = [
  './',
  './index.html',
  './style.css',
  './app.js',
];

// Install event: pre-cache app shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CACHED_FILES))
      .then(() => self.skipWaiting())
  );
});

// Activate event: delete old caches and claim clients
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(cacheName => cacheName !== CACHE_NAME)
            .map(cacheName => caches.delete(cacheName))
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event: network-first for same-origin requests, cache fallback on failure
self.addEventListener('fetch', event => {
  const { request } = event;

  // Don't intercept Canvas API calls — always go to network
  if (request.url.includes('/api/v1/')) {
    return; // Let browser handle it normally
  }

  // For same-origin requests: try network, fall back to cache
  if (request.url.startsWith(self.location.origin)) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Cache successful GET responses
          if (request.method === 'GET' && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
  }
});

// Push event: display notifications
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Assignment Tracker';
  const options = {
    body: data.body || '',
    icon: './icon.png',
    badge: './icon.png',
    tag: data.tag || 'assignment-tracker',
    requireInteraction: false,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click event: focus or open window
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // Focus existing window if open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow('./');
      }
    })
  );
});
