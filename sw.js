// SIRENA Sub · service worker
// Guarda la app en el dispositivo para que funcione sin conexión.
// IMPORTANTE: al publicar cambios, subí el número de versión (y el de js/instalacion.js).
const VERSION = '4.0.0';
const CACHE = 'sirena-sub-' + VERSION;
const ARCHIVOS = [
    './',
    './index.html',
    './manifest.json',
    './css/estilos.css',
    './js/estado.js',
    './js/geometria.js',
    './js/mapa.js',
    './js/datos.js',
    './js/app.js',
    './js/instalacion.js',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/icon-maskable-512.png',
    './icons/apple-touch-icon.png',
    './icons/favicon-32.png'
];

self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)));
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => k.startsWith('sirena-sub-') && k !== CACHE).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

// El usuario aceptó actualizar desde la app
self.addEventListener('message', (e) => { if(e.data === 'activar') self.skipWaiting(); });

// Primero la copia guardada (rápido y sin conexión); si no está, la red.
self.addEventListener('fetch', (e) => {
    if(e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
    e.respondWith(
        caches.match(e.request, {ignoreSearch: true}).then(r => r || fetch(e.request))
    );
});
