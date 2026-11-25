// SIRENA Sub · versión y funcionamiento sin conexión (service worker)
// Cambiá APP_VERSION en cada publicación: también figura en sw.js.

const APP_VERSION = '4.0.0';
document.getElementById('appVersion').textContent = 'v' + APP_VERSION;

// El service worker solo funciona servido por http(s) (GitHub Pages); al abrir el archivo con doble clic se omite.
if('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').then(reg => {
            reg.addEventListener('updatefound', () => {
                const nuevo = reg.installing;
                if(!nuevo) return;
                nuevo.addEventListener('statechange', () => {
                    // Hay una versión nueva descargada y otra en uso → ofrecer actualizar
                    if(nuevo.state === 'installed' && navigator.serviceWorker.controller) {
                        const el = document.getElementById('statusMsg');
                        setStatus('Nueva versión disponible · tocá aquí para actualizar');
                        el.style.cursor = 'pointer';
                        el.onclick = () => { nuevo.postMessage('activar'); };
                    }
                });
            });
        }).catch(() => {});
        let recargando = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if(recargando) return; recargando = true; location.reload();
        });
    });
}
