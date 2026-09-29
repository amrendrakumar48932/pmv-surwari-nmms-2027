const CACHE="pmv-surwari-v5";
const ASSETS=["./","./index.html","./styles.css","./app.js","./config.js","./manifest.json","./assets/logo.png","./assets/hero.png"];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith("pmv-surwari-")&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",e=>{
 if(e.request.method!=="GET")return;
 const u=new URL(e.request.url);
 if(u.hostname.includes("google.com")||u.hostname.includes("googleusercontent.com")){e.respondWith(fetch(e.request));return}
 if(u.origin===self.location.origin&&(u.pathname.endsWith(".js")||u.pathname.endsWith(".css")||u.pathname.endsWith(".html")||u.pathname.endsWith("/"))){
  e.respondWith(fetch(e.request).then(r=>{if(r&&r.ok)caches.open(CACHE).then(c=>c.put(e.request,r.clone()));return r}).catch(()=>caches.match(e.request)));return
 }
 e.respondWith(caches.match(e.request).then(c=>c||fetch(e.request)))
});