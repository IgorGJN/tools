const CACHE_VERSION = "v2.2.0";
const STATIC_CACHE = `tasks-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `tasks-runtime-${CACHE_VERSION}`;

const APP_SHELL_URLS = [
  "./",
  "./index.html",
  "./manifest.json",

  "./css/tasks.css",
  "./css/popup.css",
  "./css/load.css",

  "./js/tasks-data.js",
  "./js/tasks-ui.js",
  "./js/tasks-sync.js",
  "./js/task-notifications.js",
  "./js/tasks-app.js",
  "./js/tasks-calendar.js",
  "./js/popup.js",

  "./popup.html",

  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon.svg"
];

self.addEventListener("install", function (event) {
  self.skipWaiting();

  event.waitUntil(
    caches.open(STATIC_CACHE).then(function (cache) {
      return cache.addAll(APP_SHELL_URLS);
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then(function (keys) {
        return Promise.all(
          keys.map(function (key) {
            if (key !== STATIC_CACHE && key !== RUNTIME_CACHE) {
              return caches.delete(key);
            }
            return Promise.resolve();
          })
        );
      })
    ])
  );
});

function isGoogleScriptRequest(requestUrl) {
  return requestUrl.includes("script.google.com");
}

function isNavigationRequest(request) {
  return request.mode === "navigate";
}

function isStaticAsset(requestUrl) {
  return APP_SHELL_URLS.some(function (asset) {
    return requestUrl.endsWith(asset.replace("./", "/")) || requestUrl.endsWith(asset.replace("./", ""));
  });
}

async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);

  try {
    const networkResponse = await fetch(request);

    if (networkResponse && networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }

    throw error;
  }
}

async function staleWhileRevalidate(request) {
  const cacheName = isStaticAsset(request.url) ? STATIC_CACHE : RUNTIME_CACHE;
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const networkPromise = fetch(request)
    .then(function (networkResponse) {
      if (networkResponse && networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch(function () {
      return null;
    });

  if (cached) {
    return cached;
  }

  const networkResponse = await networkPromise;
  if (networkResponse) {
    return networkResponse;
  }

  return fetch(request);
}

self.addEventListener("fetch", function (event) {
  const request = event.request;
  const url = request.url;

  if (request.method !== "GET") {
    return;
  }

  if (isGoogleScriptRequest(url)) {
    return;
  }

  if (isNavigationRequest(request)) {
    event.respondWith(
      caches.match("./index.html").then(function (cachedShell) {
        return (
          cachedShell ||
          fetch(request).catch(function () {
            return caches.match("./index.html");
          })
        );
      })
    );
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});

self.addEventListener("message", function (event) {
  if (!event.data) {
    return;
  }

  if (event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  event.waitUntil(
    self.clients
      .matchAll({
        type: "window",
        includeUncontrolled: true
      })
      .then(function (clientList) {
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