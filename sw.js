const CACHE="pmv-surwari-v4";
const ASSETS=[
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./config.js",
  "./manifest.json",
  "./assets/logo.png",
  "./assets/hero.png"
];

self.addEventListener("install",event=>{
  event.waitUntil(
    caches.open(CACHE)
      .then(cache=>cache.addAll(ASSETS))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener("activate",event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(
        keys.filter(key=>key.startsWith("pmv-surwari-") && key!==CACHE)
            .map(key=>caches.delete(key))
      ))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET") return;

  const url=new URL(event.request.url);

  /* Never cache Google Apps Script/API responses. */
  if(url.hostname.includes("google.com") || url.hostname.includes("googleusercontent.com")){
    event.respondWith(fetch(event.request));
    return;
  }

  /* For our JS/CSS/HTML files, try the network first so updates appear immediately.
     If offline, fall back to the cached copy. */
  if(url.origin===self.location.origin &&
     (url.pathname.endsWith(".js") ||
      url.pathname.endsWith(".css") ||
      url.pathname.endsWith(".html") ||
      url.pathname.endsWith("/"))){
    event.respondWith(
      fetch(event.request)
        .then(response=>{
          if(response && response.ok){
            const copy=response.clone();
            caches.open(CACHE).then(cache=>cache.put(event.request,copy));
          }
          return response;
        })
        .catch(()=>caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached=>cached||fetch(event.request))
  );
});
