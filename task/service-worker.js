const CACHE_NAME = "tasks-app-v1.5.0";

const urlsToCache = [
  "./",
  "./index.html",
  "./manifest.json",

  "./css/tasks.css",
  "./css/popup.css",
  "./css/load.css",

  "./js/tasks-data.js",
  "./js/tasks-ui.js",
  "./js/tasks-sync.js",
  "./js/tasks-app.js",
  "./js/tasks-calendar.js",
  "./js/popup.js",

  "./popup.html",

  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

// INSTALAÇÃO
self.addEventListener("install", (event) => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
});

// ATIVAÇÃO
self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) => {
        return Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
          })
        );
      })
    ])
  );
});

// FETCH
self.addEventListener("fetch", (event) => {
  if (event.request.url.includes("script.google.com")) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      return (
        response ||
        fetch(event.request).then((networkResponse) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        })
      );
    })
  );
});

// CLIQUE NA NOTIFICAÇÃO
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({
      type: "window",
      includeUncontrolled: true
    }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow("./");
      }
    })
  );
});