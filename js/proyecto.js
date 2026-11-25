// SIRENA Sub · archivos de proyecto: Nuevo, Abrir, Guardar, Guardar como
// Scripts clásicos (no módulos): comparten el ámbito global y funcionan también abriendo index.html con doble clic.
//
// En Chrome/Edge de computadora se usa la API de acceso a archivos: "Guardar" escribe sobre el mismo archivo.
// En el resto (Android, iPhone/iPad, Firefox, Safari) "Guardar" descarga el archivo y "Abrir" usa el selector de archivos.
// Los datos se siguen guardando solos en el navegador; el archivo es la copia que se lleva, comparte y archiva.

const FORMATO_PROYECTO = 'sirena-sub-proyecto';
const TIPOS_ARCHIVO = [{ description: 'Proyecto SIRENA Sub', accept: { 'application/json': ['.json'] } }];
const accesoArchivos = typeof window.showSaveFilePicker === 'function' && typeof window.showOpenFilePicker === 'function';

let _archivoNombre = null;   // nombre del archivo del proyecto actual (null = nunca guardado)
let _archivoHandle = null;   // acceso directo al archivo (solo Chrome/Edge de computadora)
let _sinGuardar = false;     // hay cambios que todavía no están en el archivo

function hayDatos() {
    return cps.length || pts.length || redMediciones.length || Object.keys(furData).length ||
        document.getElementById('siteName').value || document.getElementById('siteCode').value;
}
function nombreSugerido() {
    const base = document.getElementById('siteName').value || document.getElementById('siteCode').value || 'proyecto';
    return base.trim().replace(/[\\/:*?"<>|]+/g, '_') + '.sirena.json';
}
function actualizarArchivoUI() {
    const el = document.getElementById('archivoActual');
    const nombre = _archivoNombre || 'Sin título';
    el.textContent = nombre + (_sinGuardar && hayDatos() ? ' ●' : '');
    el.title = _sinGuardar && hayDatos()
        ? 'Hay cambios que no están guardados en el archivo (los datos sí están a salvo en este navegador)'
        : (_archivoNombre ? 'Proyecto guardado en el archivo' : 'Proyecto todavía no guardado en un archivo');
    el.classList.toggle('sin-guardar', !!(_sinGuardar && hayDatos()));
    document.title = (_sinGuardar && hayDatos() ? '● ' : '') + nombre + ' · SIRENA Sub';
}
function marcarCambios() { _sinGuardar = true; actualizarArchivoUI(); }
async function persistirArchivo() {
    // Guarda en el navegador qué archivo está abierto, para recordarlo al volver a abrir la app
    // Nunca interrumpe Guardar/Abrir: si el navegador no puede recordar el archivo, solo se pierde ese recuerdo
    try {
        await AppDB.set({ nombre: _archivoNombre, sinGuardar: _sinGuardar }, 'archivo');
        if(accesoArchivos) await AppDB.set(_archivoHandle, 'handle');
    } catch(_) {}
}
async function restaurarArchivo() {
    const a = await AppDB.get('archivo');
    if(a) { _archivoNombre = a.nombre || null; _sinGuardar = !!a.sinGuardar; }
    else _sinGuardar = !!hayDatos();   // datos de una versión anterior que nunca se guardaron en archivo
    if(accesoArchivos) _archivoHandle = (await AppDB.get('handle')) || null;
    actualizarArchivoUI();
}
function confirmarDescartar(accion) {
    if(!_sinGuardar || !hayDatos()) return true;
    return confirm(`Hay cambios sin guardar en «${_archivoNombre || 'Sin título'}».\n¿${accion} de todos modos? Los cambios no guardados se pierden.\n\n(Cancelá y usá 💾 Guardar para conservarlos.)`);
}
function contenidoArchivo() {
    const v = typeof APP_VERSION !== 'undefined' ? APP_VERSION : '';
    return JSON.stringify({ formato: FORMATO_PROYECTO, appVersion: v, guardado: new Date().toISOString(), ...getState() }, null, 2);
}

// ---------- Nuevo ----------
async function nuevoProyecto() {
    if(!confirmarDescartar('Empezar un proyecto nuevo')) return;
    applyState({});
    ['siteName', 'siteCode', 'declinacion'].forEach(id => document.getElementById(id).value = '');
    _archivoNombre = null; _archivoHandle = null; _sinGuardar = false;
    await saveToLocalStorage(true, false); await persistirArchivo();
    actualizarArchivoUI(); resetView();
    setStatus('Proyecto nuevo');
}

// ---------- Abrir ----------
async function abrirProyecto() {
    if(!confirmarDescartar('Abrir otro proyecto')) return;
    if(accesoArchivos) {
        try {
            const [h] = await window.showOpenFilePicker({ types: TIPOS_ARCHIVO, multiple: false });
            const file = await h.getFile();
            await cargarProyecto(await file.text(), file.name, h);
            return;
        } catch(e) {
            if(e.name === 'AbortError') return;          // el usuario cerró el selector
            // Si la API falla (p. ej. abierto desde un archivo local con restricciones), se usa el selector común
        }
    }
    document.getElementById('abrirArchivo').click();
}
document.getElementById('abrirArchivo').onchange = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if(file) await cargarProyecto(await file.text(), file.name, null);
};
async function cargarProyecto(texto, nombre, handle) {
    let d;
    try { d = JSON.parse(texto); } catch(_) { setStatus(`«${nombre}» no es un archivo de proyecto válido`, true); return; }
    // Acepta archivos de proyecto y también los "Respaldo JSON" de versiones anteriores
    if(!d || typeof d !== 'object' || !Array.isArray(d.cps) || !Array.isArray(d.pts)) {
        setStatus(`«${nombre}» no es un proyecto de SIRENA Sub`, true); return;
    }
    const aviso = migrateData(d);
    applyState(d);
    _archivoNombre = nombre; _archivoHandle = handle; _sinGuardar = false;
    await saveToLocalStorage(true, false); await persistirArchivo();
    actualizarArchivoUI(); resetView();
    setStatus(`Proyecto abierto: ${nombre}` + (aviso ? ' · ' + aviso : ''), !!aviso);
}

// ---------- Guardar / Guardar como ----------
async function escribirEn(handle) {
    if(handle.queryPermission && (await handle.queryPermission({ mode: 'readwrite' })) !== 'granted') {
        if((await handle.requestPermission({ mode: 'readwrite' })) !== 'granted') throw new Error('Sin permiso para escribir el archivo');
    }
    const w = await handle.createWritable();
    await w.write(contenidoArchivo());
    await w.close();
}
async function guardarProyecto() {
    if(_archivoHandle) {
        try {
            await escribirEn(_archivoHandle);
            _sinGuardar = false; await persistirArchivo(); actualizarArchivoUI();
            setStatus(`Guardado en ${_archivoNombre}`);
            return;
        } catch(e) {
            // El archivo se movió, se borró o se negó el permiso → pedir dónde guardar
            setStatus('No se pudo escribir el archivo anterior: elegí dónde guardarlo', true);
        }
    }
    await guardarProyectoComo();
}
async function guardarProyectoComo() {
    if(accesoArchivos) {
        try {
            const h = await window.showSaveFilePicker({ suggestedName: _archivoNombre || nombreSugerido(), types: TIPOS_ARCHIVO });
            await escribirEn(h);
            _archivoHandle = h; _archivoNombre = h.name; _sinGuardar = false;
            await persistirArchivo(); actualizarArchivoUI();
            setStatus(`Guardado en ${h.name}`);
            return;
        } catch(e) {
            if(e.name === 'AbortError') return;
            // Si la API falla, se descarga el archivo
        }
    }
    const nombre = _archivoNombre || nombreSugerido();
    download(contenidoArchivo(), nombre, 'application/json');
    _archivoNombre = nombre; _sinGuardar = false;
    await persistirArchivo(); actualizarArchivoUI();
    setStatus(`Proyecto descargado como ${nombre} (carpeta de Descargas)`);
}

document.getElementById('nuevoBtn').onclick = nuevoProyecto;
document.getElementById('abrirBtn').onclick = abrirProyecto;
document.getElementById('guardarBtn').onclick = guardarProyecto;
document.getElementById('guardarComoBtn').onclick = guardarProyectoComo;
document.addEventListener('keydown', (e) => {
    if(!(e.ctrlKey || e.metaKey)) return;
    const k = e.key.toLowerCase();
    if(k === 's') { e.preventDefault(); e.shiftKey ? guardarProyectoComo() : guardarProyecto(); }
    else if(k === 'o') { e.preventDefault(); abrirProyecto(); }
});
