const CACHE_NAME = "maur-strassendienst-v4";

const APP_FILES = [
    "./",
    "./index.html",
    "./style.css",
    "./app.js",
    "./manifest.json"
];


/* =========================
   INSTALL
========================= */

self.addEventListener("install", event => {

    event.waitUntil(

        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(APP_FILES))
            .then(() => self.skipWaiting())

    );

});


/* =========================
   ACTIVATE
========================= */

self.addEventListener("activate", event => {

    event.waitUntil(

        caches.keys()
            .then(keys => {

                return Promise.all(

                    keys
                        .filter(key =>
                            key !== CACHE_NAME
                        )
                        .map(key =>
                            caches.delete(key)
                        )

                );

            })
            .then(() =>
                self.clients.claim()
            )

    );

});


/* =========================
   FETCH
========================= */

self.addEventListener("fetch", event => {

    if (event.request.method !== "GET") {
        return;
    }


    const url =
        new URL(event.request.url);


    /*
       Externe Inhalte nicht cachen.
    */

    if (
        url.origin !==
        self.location.origin
    ) {

        event.respondWith(
            fetch(event.request)
        );

        return;

    }


    /*
       Eigene Dateien:
       zuerst aktuelle Version
       aus dem Internet laden.

       Falls offline:
       Cache verwenden.
    */

    event.respondWith(

        fetch(event.request)

            .then(response => {

                const copy =
                    response.clone();


                caches.open(CACHE_NAME)
                    .then(cache => {

                        cache.put(
                            event.request,
                            copy
                        );

                    });


                return response;

            })

            .catch(() => {

                return caches.match(
                    event.request
                );

            })

    );

});