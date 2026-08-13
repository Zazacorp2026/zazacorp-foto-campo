const CACHE = 'zazafoto-v11';
const PRECACHE = ['./index.html', './manifest.json', './icon/icon-192.png', './icon/icon-512.png'];
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', e => {
  const url = e.request.url;
  // Nunca cachear ni interceptar Apps Script/Drive: además de evitar datos
  // viejos, Apps Script SIEMPRE responde con una redirección (302) antes
  // del resultado real. Si el Service Worker reenvía él mismo peticiones
  // POST (como rfGuardarToma, que manda el cuerpo con los datos de la
  // toma) el navegador puede fallar al reenviar el cuerpo a través de esa
  // redirección — la petición falla en silencio aunque haya señal. Al no
  // llamar a respondWith() aquí, se deja que el navegador la maneje
  // directamente, sin pasar por el Service Worker.
  if (url.includes('script.google.com') || url.includes('script.googleusercontent.com') || url.includes('googleapis.com')) {
    return;
  }
  // La navegación principal (abrir/recargar la app) siempre intenta
  // internet primero. Si se sirviera desde caché primero, una versión
  // vieja o corrupta guardada podría mostrarse aunque sí haya conexión.
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request).then(c => c || caches.match('./index.html')))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (!res || res.status !== 200 || res.type === 'opaque') return res;
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      }).catch(() => {
        if (e.request.destination === 'document') return caches.match('./index.html');
      });
    })
  );
});
