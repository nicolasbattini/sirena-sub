// SIRENA Sub · listas, guardado, red de CPs, exportaciones y FUR
// Scripts clásicos (no módulos): comparten el ámbito global y funcionan también abriendo index.html con doble clic.

function setStatus(msg, err=false) {
    const el = document.getElementById('statusMsg');
    if(el) {
        el.innerText = msg;
        el.style.background = err ? 'rgba(192,57,43,0.13)' : 'rgba(44,62,80,0.08)';
        el.style.color = err ? '#c0392b' : '#2c3e50';
    }
}

// ==================== 4. MANEJO DE DATOS ====================
function getMethodLabel(cp) {
    if(!cp) return 'Local';
    if(cp.method && METHOD_LABELS[cp.method]) return METHOD_LABELS[cp.method];
    return 'Local';
}
function findCp(name) { return cps.find(c => c.name === name); }
function isFixed(cp) { return cp.fixed !== undefined ? !!cp.fixed : cp.method === 'gps'; }
function coordText(p) {
    return (p.lat!==null && p.lat!==undefined) ? p.lat.toFixed(5)+', '+p.lon.toFixed(5) : 'X:'+p.localX.toFixed(1)+' Y:'+p.localY.toFixed(1);
}
function cpOptionsHtml(selected) {
    return cps.map(c => `<option value="${escapeHtml(c.name)}" ${c.name===selected?'selected':''}>${escapeHtml(c.name)}</option>`).join('');
}
// v4: actualiza los desplegables de CPs sin borrar lo que el usuario ya escribió
function refreshCpSelects() {
    document.querySelectorAll('select.cpSel').forEach(sel => {
        const prev = sel.value;
        sel.innerHTML = cpOptionsHtml(prev);
        if(findCp(prev)) sel.value = prev;
    });
}
function renderAll() { renderCpList(); renderPtList(); renderRedTable(); refreshCpSelects(); draw(); }

function renderCpList() {
    const container = document.getElementById('cpList');
    container.innerHTML = '';
    cps.forEach((cp,i) => {
        const col = CP_COLORS[i%CP_COLORS.length];
        const div = document.createElement('div');
        div.className = 'list-item';
        div.dataset.idx = i; div.dataset.type = 'cp';
        const fijo = isFixed(cp);
        div.innerHTML = `<div class="diamond" style="background:${col}"></div>
            <span style="flex:1"><b>${escapeHtml(cp.name)}</b> <span class="badge">${getMethodLabel(cp)}</span><br><span style="font-size:0.63rem">${coordText(cp)}</span></span>
            <button class="delete-btn pin-btn" title="${fijo?'Fijo en el ajuste de red (clic para liberar)':'Libre en el ajuste de red (clic para fijar)'}" style="opacity:${fijo?1:0.25}">📌</button>
            <button class="delete-btn del-btn">✕</button>`;
        container.appendChild(div);
    });
}
function renderPtList() {
    const container = document.getElementById('ptList');
    document.getElementById('ptCount').innerText = pts.length;
    container.innerHTML = '';
    pts.forEach((pt,i) => {
        const col = METHOD_COLORS[pt.method] || '#888';
        const div = document.createElement('div');
        div.className = 'list-item';
        div.dataset.idx = i; div.dataset.type = 'pt';
        div.innerHTML = `<div class="point-dot" style="background:${col}"></div>
            <span style="flex:1"><b>${escapeHtml(pt.name)}</b> <span class="badge">${getMethodLabel(pt)}</span><br><span style="font-size:0.63rem">${coordText(pt)}</span></span>
            <button class="delete-btn del-btn">✕</button>`;
        container.appendChild(div);
    });
}

document.getElementById('cpList').addEventListener('click', (e) => {
    const item = e.target.closest('.list-item');
    if(!item) return;
    const idx = parseInt(item.dataset.idx);
    if(e.target.closest('.pin-btn')) {
        cps[idx].fixed = !isFixed(cps[idx]);
        renderCpList(); saveToLocalStorage();
    } else if(e.target.closest('.del-btn')) removeCp(idx);
    else { centerOnPoint(cps[idx].localX, cps[idx].localY); }
});
document.getElementById('ptList').addEventListener('click', (e) => {
    const item = e.target.closest('.list-item');
    if(!item) return;
    const idx = parseInt(item.dataset.idx);
    if(e.target.closest('.del-btn')) removePt(idx);
    else { centerOnPoint(pts[idx].localX, pts[idx].localY); }
});

function removeCp(idx) {
    const cp = cps[idx];
    const dependientes = [...cps, ...pts].filter(p => p !== cp && (p.refs||[]).includes(cp.name)).length;
    if(!confirm(`¿Eliminar el CP ${cp.name}?` + (dependientes ? `\n${dependientes} punto(s) fueron medidos desde él: conservan su posición, pero ya no se podrán recalcular en un ajuste de red.` : ''))) return;
    cps.splice(idx,1);
    if(cps.length===0) {
        const firstGpsPt = pts.find(p=>p.lat!==null && p.lat!==undefined);
        geoOrigin = firstGpsPt ? {lat:firstGpsPt.lat, lon:firstGpsPt.lon} : null;
    } else {
        const firstGeoCP = cps.find(c=>c.lat!==null && c.lat!==undefined);
        geoOrigin = firstGeoCP ? {lat:firstGeoCP.lat, lon:firstGeoCP.lon} : geoOrigin;
    }
    _selectedPoint = null;
    recalcLocal(); renderAll(); saveToLocalStorage();
}
function removePt(idx) {
    if(!confirm(`¿Eliminar el hallazgo ${pts[idx].name}?`)) return;
    pts.splice(idx,1); _selectedPoint = null;
    saveToLocalStorage(); renderPtList(); draw();
}
function recalcLocal() {
    cps.forEach(c => { if(c.lat!==null && c.lat!==undefined) { const l = geo2local(c.lat,c.lon); c.localX=l.x; c.localY=l.y; } });
    pts.forEach(p => { if(p.lat!==null && p.lat!==undefined) { const l = geo2local(p.lat,p.lon); p.localX=l.x; p.localY=l.y; } });
    draw();
}

// ==================== 5. PERSISTENCIA ====================
const AppDB = (function(){
    const DB_NAME='AcruxSubData', DB_VERSION=1, STORE='state', KEY='main';
    let _db=null;
    function open(){ return new Promise((res,rej)=>{ if(_db) return res(_db); const req=indexedDB.open(DB_NAME,DB_VERSION); req.onupgradeneeded=e=>{ if(!e.target.result.objectStoreNames.contains(STORE)) e.target.result.createObjectStore(STORE,{keyPath:'id'}); }; req.onsuccess=e=>{ _db=e.target.result; res(_db); }; req.onerror=e=>rej(e.target.error); }); }
    async function get(){ try{ const db=await open(); return new Promise((res)=>{ const tx=db.transaction(STORE,'readonly'); tx.objectStore(STORE).get(KEY).onsuccess=e=>res(e.target.result?.data); }); }catch(e){ return null; } }
    async function set(data){ try{ const db=await open(); return new Promise((res)=>{ const tx=db.transaction(STORE,'readwrite'); tx.objectStore(STORE).put({id:KEY,data}).onsuccess=()=>res(true); }); }catch(e){ return false; } }
    return {get,set};
})();

function getDeclinacion() { const v = parseFloat(document.getElementById('declinacion').value); return Number.isFinite(v) ? v : 0; }
function getState() {
    return { dataVersion: DATA_VERSION, cps, pts, geoOrigin, showLines,
        siteName: document.getElementById('siteName').value, siteCode: document.getElementById('siteCode').value,
        declinacion: document.getElementById('declinacion').value, furData, redMediciones };
}
async function saveToLocalStorage(silent=false) {
    await AppDB.set(getState());
    if(!silent) setStatus('Guardado automático');
}
// v4: migración de datos de versiones anteriores. Devuelve un aviso o ''.
function migrateData(d) {
    const v = d.dataVersion || 3;
    let nLado = 0;
    if(v < 4) {
        [...(d.cps||[]), ...(d.pts||[])].forEach(p => {
            const sp = p.surveyParams;
            if(!sp) return;
            if(p.method==='offset' || p.method==='acrux') { sp.legacySide = true; nLado++; }
            // En v3 la profundidad vacía se guardaba como 0: para trilateración se toma como "desconocida"
            if(p.method==='trilat3d' && !sp.depth) sp.depth = null;
        });
    }
    d.dataVersion = DATA_VERSION;
    return nLado ? `Datos de v3: ${nLado} punto(s) Offset/Ties B conservan la posición calculada con la convención de lado anterior (marcados en su ficha).` : '';
}
function applyState(d) {
    cps = d.cps || []; pts = d.pts || []; geoOrigin = d.geoOrigin || null; showLines = d.showLines!==undefined?d.showLines:true;
    document.getElementById('siteName').value = d.siteName || ''; document.getElementById('siteCode').value = d.siteCode || '';
    document.getElementById('declinacion').value = d.declinacion ?? '';
    furData = d.furData || {}; redMediciones = Array.isArray(d.redMediciones) ? d.redMediciones : [];
    if(!geoOrigin) {
        const first = [...cps, ...pts].find(p => p.lat !== null && p.lat !== undefined);
        if(first) geoOrigin = {lat: first.lat, lon: first.lon};
    }
    _selectedPoint = null; _preAjuste = null;
    document.getElementById('deshacerAjusteBtn').style.display = 'none';
    const resDiv = document.getElementById('residuosDiv'); resDiv.innerHTML=''; resDiv.style.display='none';
    recalcLocal(); renderAll();
}
async function loadFromLocalStorage() {
    let d = await AppDB.get();
    if(!d) { const legacy = localStorage.getItem('acruxsub'); if(legacy) try{ d=JSON.parse(legacy); localStorage.removeItem('acruxsub'); }catch(e){} }
    if(!d) return;
    const aviso = migrateData(d);
    applyState(d);
    if(aviso) { await saveToLocalStorage(true); setStatus(aviso, true); }
}
['siteName','siteCode','declinacion'].forEach(id => document.getElementById(id).addEventListener('change', () => saveToLocalStorage()));

// ==================== 8. RED DE CPS ====================
let _preAjuste = null;
function renderRedTable() {
    const container = document.getElementById('redTableContainer');
    if(!container) return;
    if(cps.length<2) { container.innerHTML = '<p style="font-size:0.7rem;">Se necesitan al menos 2 CPs.</p>'; return; }
    let html = `<div class="red-table-wrap"><table class="red-table"><thead><tr><th>Origen</th><th>Destino</th><th>Distancia (m)</th><th></th></tr></thead><tbody>`;
    redMediciones.forEach((m,idx) => {
        const falta = !findCp(m.origen) || !findCp(m.destino);
        html += `<tr ${falta?'style="background:#fdecea" title="CP inexistente: la medición se ignora"':''}>
                    <td><select data-idx="${idx}" class="red-origen">${cpOptionsHtml(m.origen)}</select></td>
                    <td><select data-idx="${idx}" class="red-destino">${cpOptionsHtml(m.destino)}</select></td>
                    <td><input type="number" step="0.01" data-idx="${idx}" class="red-dist" value="${Number.isFinite(m.distancia)?m.distancia:''}"></td>
                    <td><button class="delete-medicion" data-idx="${idx}">✕</button></td>
                 </tr>`;
    });
    html += `</tbody></table></div>`;
    container.innerHTML = html;
    container.querySelectorAll('.red-origen, .red-destino, .red-dist').forEach(el => {
        el.addEventListener('change', () => {
            const idx = parseInt(el.dataset.idx);
            if(el.classList.contains('red-origen')) redMediciones[idx].origen = el.value;
            else if(el.classList.contains('red-destino')) redMediciones[idx].destino = el.value;
            else redMediciones[idx].distancia = parseFloat(el.value);
            if(redMediciones[idx].origen === redMediciones[idx].destino) setStatus('Origen y destino no pueden ser el mismo CP', true);
            saveToLocalStorage(true);
        });
    });
    container.querySelectorAll('.delete-medicion').forEach(btn => {
        btn.addEventListener('click', () => {
            redMediciones.splice(parseInt(btn.dataset.idx),1);
            renderRedTable(); saveToLocalStorage();
        });
    });
}
document.getElementById('addMedicionBtn').onclick = () => {
    if(cps.length<2){ setStatus('Se necesitan al menos 2 CPs',true); return; }
    redMediciones.push({ origen: cps[0].name, destino: cps[1].name, distancia: NaN });
    renderRedTable(); saveToLocalStorage(true);
};

// Recalcula CPs derivados (no incluidos en la red) y hallazgos a partir de sus mediciones originales
function recomputeDependents(skipNames) {
    let n = 0; const fallidos = [];
    const redo = (p) => {
        if(p.method==='gps' || !p.surveyParams) return;
        const r = computeLocal(p.method, p.surveyParams);
        if(r.error) { fallidos.push(p.name); return; }
        p.localX = r.local.x; p.localY = r.local.y;
        if(p.method==='trilat3d') { p.depth = r.depth; p.localZ = r.depth; }
        const g = local2geo(p.localX, p.localY); p.lat = g.lat; p.lon = g.lon;
        n++;
    };
    cps.forEach(c => { if(!skipNames.has(c.name)) redo(c); });
    pts.forEach(redo);
    return {n, fallidos};
}

function ajustarRed() {
    const meds = redMediciones.filter(m => m.origen!==m.destino && Number.isFinite(m.distancia) && m.distancia>0 && findCp(m.origen) && findCp(m.destino));
    if(!meds.length){ setStatus('No hay mediciones válidas',true); return; }
    const ignoradas = redMediciones.length - meds.length;
    const names = new Set(); meds.forEach(m => { names.add(m.origen); names.add(m.destino); });
    const list = cps.filter(c => names.has(c.name));
    const fixedSet = new Set(list.filter(isFixed).map(c => c.name));
    const notas = [];
    if(fixedSet.size === 0) { fixedSet.add(list[0].name); notas.push(`Ningún CP fijo en la red: se mantuvo ${list[0].name} fijo.`); }
    if(fixedSet.size === 1) notas.push('Con un solo CP fijo, la orientación de la red se conserva lo más parecida posible a la actual.');
    const free = list.filter(c => !fixedSet.has(c.name));
    if(!free.length){ setStatus('Todos los CPs de la red están fijos: nada que ajustar',true); return; }
    const incognitas = 2*free.length - (fixedSet.size===1 ? 1 : 0);
    if(meds.length < incognitas) notas.push(`⚠ Pocas mediciones (${meds.length}) para ${incognitas} incógnitas: la red no queda completamente determinada.`);
    if(ignoradas) notas.push(`${ignoradas} medición(es) ignorada(s) por estar incompletas o con CPs inexistentes.`);

    const idx = {}; free.forEach((c,i) => idx[c.name] = i);
    const pos = {}; list.forEach(c => pos[c.name] = {x:c.localX, y:c.localY});
    const snapshot = JSON.stringify({cps, pts});
    for(let it=0; it<50; it++) {
        const J = [], r = [];
        for(const m of meds) {
            const a = pos[m.origen], b = pos[m.destino];
            const dx = a.x-b.x, dy = a.y-b.y, d = Math.hypot(dx,dy);
            if(d < 1e-9) continue;
            const row = new Array(2*free.length).fill(0);
            if(m.origen in idx) { row[2*idx[m.origen]] = dx/d; row[2*idx[m.origen]+1] = dy/d; }
            if(m.destino in idx) { row[2*idx[m.destino]] = -dx/d; row[2*idx[m.destino]+1] = -dy/d; }
            J.push(row); r.push(m.distancia - d);
        }
        const delta = lsqStep(J, r, 1e-5);
        if(!delta){ setStatus('Error en el ajuste: sistema singular',true); return; }
        free.forEach((c,i) => { pos[c.name].x += delta[2*i]; pos[c.name].y += delta[2*i+1]; });
        if(Math.max(...delta.map(Math.abs)) < 1e-6) break;
    }
    _preAjuste = snapshot;
    for(const c of free) {
        c.localX = pos[c.name].x; c.localY = pos[c.name].y;
        const g = local2geo(c.localX, c.localY); c.lat = g.lat; c.lon = g.lon;
    }
    const rec = recomputeDependents(new Set(list.map(c => c.name)));

    let sum2 = 0;
    let residuosHtml = '<strong>Residuos:</strong><ul>';
    for(const m of meds) {
        const a = pos[m.origen], b = pos[m.destino];
        const dcalc = Math.hypot(a.x-b.x, a.y-b.y), res = m.distancia - dcalc;
        sum2 += res*res;
        residuosHtml += `<li>${escapeHtml(m.origen)} ↔ ${escapeHtml(m.destino)}: medida ${m.distancia.toFixed(2)} m, calculada ${dcalc.toFixed(2)} m, residuo ${res.toFixed(3)} m</li>`;
    }
    residuosHtml += `</ul><div>RMS: ${Math.sqrt(sum2/meds.length).toFixed(3)} m · Fijos: ${[...fixedSet].map(escapeHtml).join(', ')}</div>`;
    residuosHtml += `<div>Recalculados: ${rec.n} punto(s)${rec.fallidos.length ? ` · ⚠ no se pudieron recalcular: ${rec.fallidos.map(escapeHtml).join(', ')}` : ''}</div>`;
    if(notas.length) residuosHtml += `<div style="margin-top:4px">${notas.map(escapeHtml).join('<br>')}</div>`;
    const divRes = document.getElementById('residuosDiv');
    divRes.innerHTML = residuosHtml; divRes.style.display = 'block';
    document.getElementById('deshacerAjusteBtn').style.display = 'block';
    renderAll(); saveToLocalStorage(true);
    setStatus(`Red ajustada · ${rec.n} punto(s) recalculados`, rec.fallidos.length>0);
}
function deshacerAjuste() {
    if(!_preAjuste) return;
    const d = JSON.parse(_preAjuste);
    cps = d.cps; pts = d.pts; _preAjuste = null; _selectedPoint = null;
    document.getElementById('deshacerAjusteBtn').style.display = 'none';
    const divRes = document.getElementById('residuosDiv'); divRes.innerHTML=''; divRes.style.display='none';
    renderAll(); saveToLocalStorage(true);
    setStatus('Ajuste deshecho');
}
document.getElementById('ajustarRedBtn').onclick = ajustarRed;
document.getElementById('deshacerAjusteBtn').onclick = deshacerAjuste;

// ==================== 9. EXPORTACIONES ====================
function download(content, filename, mime) {
    const a = document.createElement('a');
    const blob = new Blob([content], {type: mime});
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
}
function escapeCSV(val) { if(val===null||val===undefined) return '""'; const s = String(val).replace(/\r?\n/g,' ').replace(/"/g,'""'); return `"${s}"`; }
function exportCSV() {
    let rows = ['nombre,tipo,metodo,latitud,longitud,x_local_m,y_local_m,profundidad_m,descripcion,tipo_hallazgo,material,dimensiones'];
    const fila = (p, tipo) => {
        const geo = p.lat!==null && p.lat!==undefined;
        return [escapeCSV(p.name), tipo, escapeCSV(getMethodLabel(p)), geo ? p.lat.toFixed(8) : '', geo ? p.lon.toFixed(8) : '',
            p.localX.toFixed(3), p.localY.toFixed(3), p.depth||0, escapeCSV(p.desc||''),
            escapeCSV(p.findType||''), escapeCSV(p.material||''), escapeCSV(p.dimensions||'')].join(',');
    };
    cps.forEach(cp => rows.push(fila(cp, 'cp')));
    pts.forEach(pt => rows.push(fila(pt, 'hallazgo')));
    download('\ufeff' + rows.join('\n'), `${document.getElementById('siteName').value||'relevamiento'}.csv`, 'text/csv');
    setStatus('CSV exportado');
}

// P4: description enriquecido
function buildKmlDescription(p, type) {
    const parts = [];
    parts.push(`Tipo: ${type === 'cp' ? 'Punto de Control' : 'Hallazgo'}`);
    parts.push(`Método: ${getMethodLabel(p)}`);
    if(p.depth != null && p.depth !== '') parts.push(`Profundidad: ${p.depth} m`);
    if(type === 'hallazgo') {
        if(p.findType) parts.push(`Tipo hallazgo: ${p.findType}`);
        if(p.material) parts.push(`Material: ${p.material}`);
        if(p.dimensions) parts.push(`Dimensiones: ${p.dimensions}`);
    }
    if(p.desc) parts.push(`Descripción: ${p.desc}`);
    const sp = p.surveyParams || {};
    if(p.method === 'radial' && sp.centro) {
        parts.push(`CP centro: ${sp.centro}`);
        parts.push(`Distancia: ${sp.dist} m`);
        parts.push(`Rumbo: ${sp.bearing}°${sp.magnetico ? ` magnético (declinación ${sp.declinacion||0}°)` : ''}`);
    } else if(p.method === 'offset' && sp.segmento) {
        parts.push(`Segmento: ${sp.segmento}`);
        parts.push(`Along: ${sp.along} m`);
        parts.push(`Perp: ${sp.perp} m (lado ${efLado(sp)>0?'derecha':'izquierda'} mirando de A a B)`);
    } else if(p.method === 'ties' && sp.segmento) {
        parts.push(`Segmento: ${sp.segmento}`);
        parts.push(`Dist A: ${sp.distA} m, Dist B: ${sp.distB} m`);
    } else if(p.method === 'trilat3d' && sp.distancias) {
        parts.push(`Distancias: ${sp.distancias.map(d=>`${d.cp}=${d.dist}m`).join(', ')}`);
    } else if(p.method === 'acrux' && sp.segmento) {
        parts.push(`Segmento: ${sp.segmento}`);
        parts.push(`Par 1: along ${sp.along1} m, dist ${sp.dist1} m`);
        parts.push(`Par 2: along ${sp.along2} m, dist ${sp.dist2} m`);
    }
    return parts.join(' | ');
}

function exportKML() {
    // P4: si no hay geoOrigin, no exportar (KML inválido)
    if(!geoOrigin) {
        setStatus('Sin georreferencia: cargá al menos un punto GPS o un CP con lat/lon', true);
        return;
    }
    const hasGeo = p => p.lat!==null && p.lat!==undefined && p.lon!==null && p.lon!==undefined;
    let kml = '<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document>';
    let exported = 0;
    cps.forEach(cp => {
        if(!hasGeo(cp)) return;
        const desc = buildKmlDescription(cp, 'cp').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        kml += `<Placemark><name>${escapeHtml(cp.name)}</name><description>${desc}</description><Point><coordinates>${cp.lon},${cp.lat},${-(cp.depth||0)}</coordinates></Point></Placemark>`;
        exported++;
    });
    pts.forEach(pt => {
        if(!hasGeo(pt)) return;
        const desc = buildKmlDescription(pt, 'hallazgo').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        kml += `<Placemark><name>${escapeHtml(pt.name)}</name><description>${desc}</description><Point><coordinates>${pt.lon},${pt.lat},${-(pt.depth||0)}</coordinates></Point></Placemark>`;
        exported++;
    });
    kml += '</Document></kml>';
    download(kml, `${document.getElementById('siteName').value||'relevamiento'}.kml`, 'application/vnd.google-earth.kml+xml');
    setStatus(`KML exportado (${exported} puntos)`);
}
function exportGeoJSON() {
    const features = [];
    const hasGeo = p => p.lat!==null && p.lat!==undefined && p.lon!==null && p.lon!==undefined;
    cps.forEach(cp => { if(hasGeo(cp)) features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [cp.lon, cp.lat, -(cp.depth||0)] }, properties: { name: cp.name, type: 'cp', method: cp.method, depth_m: cp.depth, desc: cp.desc||'' } }); });
    pts.forEach(pt => { if(hasGeo(pt)) features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [pt.lon, pt.lat, -(pt.depth||0)] }, properties: { name: pt.name, type: 'hallazgo', method: pt.method, depth_m: pt.depth, desc: pt.desc||'', find_type: pt.findType||'', material: pt.material||'', dimensions: pt.dimensions||'' } }); });
    const geojson = { type: 'FeatureCollection', features };
    download(JSON.stringify(geojson, null, 2), `${document.getElementById('siteName').value||'relevamiento'}.geojson`, 'application/json');
    setStatus('GeoJSON exportado');
}

// P3: exportar JPG con pie de metadatos + barra de escala
function exportJPG() {
    const siteName = document.getElementById('siteName').value || 'sitio';
    const siteCode = document.getElementById('siteCode').value || '';
    const d = new Date();
    const fecha = d.toISOString().slice(0,10);
    const scaleFactor = 2;
    const footerH = 70 * scaleFactor;
    const w = canvas.width * scaleFactor;
    const h = canvas.height * scaleFactor + footerH;
    const aux = document.createElement('canvas');
    aux.width = w; aux.height = h;
    const actx = aux.getContext('2d');
    // Fondo
    actx.fillStyle = '#ffffff'; actx.fillRect(0,0,w,h);
    // Dibujo del mapa escalado
    actx.drawImage(canvas, 0, 0, w, canvas.height * scaleFactor);
    // Pie de metadatos
    const footerY = canvas.height * scaleFactor;
    actx.fillStyle = '#f0f2f5'; actx.fillRect(0, footerY, w, footerH);
    actx.strokeStyle = '#ccc'; actx.lineWidth = 1; actx.beginPath(); actx.moveTo(0, footerY); actx.lineTo(w, footerY); actx.stroke();
    const pad = 16 * scaleFactor;
    actx.fillStyle = '#2c3e50'; actx.font = `bold ${11*scaleFactor}px system-ui`;
    actx.fillText(`SIRENA Sub — ${siteName}${siteCode ? ' ('+siteCode+')' : ''}`, pad, footerY + 22*scaleFactor);
    actx.font = `${9*scaleFactor}px system-ui`; actx.fillStyle = '#495057';
    actx.fillText(`Fecha: ${fecha}  |  Escala: ${scaleVal.toFixed(0)} (${(100/scaleVal).toFixed(2)} m/px)  |  ${geoOrigin ? 'Georreferenciado' : 'Sin georreferencia'}`, pad, footerY + 40*scaleFactor);
    // Barra de escala dibujada
    const step = pickGridStep();
    const barPx = step * (scaleVal/100) * scaleFactor;
    const barX = pad; const barY = footerY + 54*scaleFactor;
    actx.strokeStyle = '#2c3e50'; actx.lineWidth = 2*scaleFactor;
    actx.beginPath(); actx.moveTo(barX, barY); actx.lineTo(barX + barPx, barY); actx.stroke();
    actx.beginPath(); actx.moveTo(barX, barY - 4*scaleFactor); actx.lineTo(barX, barY + 4*scaleFactor); actx.stroke();
    actx.beginPath(); actx.moveTo(barX + barPx, barY - 4*scaleFactor); actx.lineTo(barX + barPx, barY + 4*scaleFactor); actx.stroke();
    actx.fillStyle = '#2c3e50'; actx.font = `${8*scaleFactor}px monospace`;
    actx.fillText(step>=1000 ? (step/1000)+' km' : step+' m', barX + barPx + 6*scaleFactor, barY + 3*scaleFactor);
    // Descargar
    const dataUrl = aux.toDataURL('image/jpeg', 0.92);
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${siteName.replace(/[^\w\-]+/g,'_')}_${fecha}.jpg`;
    a.click();
    setStatus('JPG exportado');
}

function exportBackup() {
    const sitio = (document.getElementById('siteName').value || 'sitio').replace(/[^\w\-]+/g,'_');
    download(JSON.stringify(getState(), null, 2), `respaldo_sirenasub_${sitio}_${new Date().toISOString().slice(0,10)}.json`, 'application/json');
    setStatus('Respaldo JSON exportado');
}
function importBackup(file) {
    const reader = new FileReader();
    reader.onload = e => {
        try {
            const d = JSON.parse(e.target.result);
            // E9: validación de estructura
            if(!d || typeof d !== 'object' || !Array.isArray(d.cps) || !Array.isArray(d.pts)) {
                setStatus('Respaldo inválido: estructura incorrecta', true);
                return;
            }
            if(!confirm('¿Reemplazar los datos actuales por los del respaldo?')) return;
            const aviso = migrateData(d);
            applyState(d);
            saveToLocalStorage(true);
            if(aviso) { setStatus('Respaldo importado · ' + aviso, true); return; }
            setStatus('Respaldo importado');
        } catch(ex) { setStatus('Error al importar: '+ex.message, true); }
    };
    reader.readAsText(file);
}
function clearAll() {
    if(confirm('¿Eliminar TODOS los datos?')) {
        cps = []; pts = []; geoOrigin = null; redMediciones = []; furData = {}; _preAjuste = null;
        document.getElementById('deshacerAjusteBtn').style.display = 'none';
        const resDiv = document.getElementById('residuosDiv');
        if(resDiv) { resDiv.innerHTML = ''; resDiv.style.display = 'none'; }
        _selectedPoint = null;
        renderAll(); saveToLocalStorage(true);
        setStatus('Datos eliminados');
    }
}

// ==================== 10. FUR ====================
const furModal = document.getElementById('furModal');
document.getElementById('openFurBtn').onclick = () => { furModal.style.display = 'flex'; cargarFurEnFormulario(); };
document.getElementById('closeFurBtn').onclick = () => furModal.style.display = 'none';
document.getElementById('saveFurBtn').onclick = () => { guardarFurDesdeFormulario(); furModal.style.display = 'none'; setStatus('Ficha guardada'); };
const funcionesList = ['Habitacional','Funeraria','Agrícola','Vial','Almacenaje','Taller','Campamento Base','Cantera','Parapeto','Ritual','Embarcación','Otros'];
const materialesList = ['Cerámica','Lítico','Óseo Animal','Resto Humano','Carbón','Loza','Metal','Textil','Vidrio','Molienda','Otros'];
const tareasList = ['Relevamiento','Recolección','Excavaciones','Sondeos','Puesta en Valor','Reconstrucción','Protección','Otros'];
function initFurCheckboxes() {
    // E12: limpiar antes
    const tipoDiv = document.getElementById('furTipoSitio');
    const funcDiv = document.getElementById('furFuncion');
    const matDiv = document.getElementById('furMateriales');
    const rupDiv = document.getElementById('furRupestre');
    const tarDiv = document.getElementById('furTareas');
    tipoDiv.innerHTML = '';
    funcDiv.innerHTML = '';
    matDiv.innerHTML = '';
    rupDiv.innerHTML = '';
    tarDiv.innerHTML = '';

    tipoDiv.innerHTML = `<label><input type="checkbox" value="cieloAbierto"> Cielo abierto</label><label><input type="checkbox" value="abrigoRocoso"> Abrigo rocoso</label><label><input type="checkbox" value="subacuatico"> Subacuático</label>`;
    funcionesList.forEach(f => { funcDiv.innerHTML += `<label><input type="checkbox" value="${f}"> ${f}</label>`; });
    materialesList.forEach(m => { matDiv.innerHTML += `<label><input type="checkbox" value="${m}"> ${m}</label>`; });
    // E13: id explícito en "otros"
    rupDiv.innerHTML = `<label><input type="checkbox" value="pintura"> Pintura</label><label><input type="checkbox" value="grabado"> Grabado</label><label><input type="checkbox" value="geoglifo"> Geoglifo</label><label><input type="checkbox" value="otros" id="furRupestreOtrosCb"> Otros</label><input type="text" id="furRupestreOtros" placeholder="especificar" style="width:100px">`;
    tareasList.forEach(t => { tarDiv.innerHTML += `<label><input type="checkbox" value="${t}"> ${t}</label>`; });
}
function cargarFurEnFormulario() {
    document.getElementById('furDenominacion').value = furData.denominacion||''; document.getElementById('furSigla').value = furData.sigla||'';
    document.getElementById('furProvincia').value = furData.provincia||''; document.getElementById('furLocalidad').value = furData.localidad||'';
    document.getElementById('furParaje').value = furData.paraje||''; document.getElementById('furDepartamento').value = furData.departamento||'';
    document.getElementById('furLat').value = furData.lat||''; document.getElementById('furLon').value = furData.lon||'';
    document.getElementById('furDatum').value = furData.datum||'WGS84'; document.getElementById('furAltitud').value = furData.altitud||'';
    document.getElementById('furCartaIgm').value = furData.cartaIgm||''; document.getElementById('furPlanoCatastral').value = furData.planoCatastral||'';
    document.getElementById('furSuperficie').value = furData.superficie||''; document.getElementById('furAdscripcion').value = furData.adscripcion||'';
    document.getElementById('furIntervenciones').value = furData.intervenciones||''; document.getElementById('furDaniosAnt').value = furData.daniosAnt||'Bajo';
    document.getElementById('furDaniosNat').value = furData.daniosNat||'Bajo'; document.getElementById('furRiesgoCult').value = furData.riesgoCult||'Bajo';
    document.getElementById('furRiesgoAmb').value = furData.riesgoAmb||'Bajo'; document.getElementById('furObservaciones').value = furData.observaciones||'';
    document.getElementById('furRegNombre').value = furData.regNombre||''; document.getElementById('furRegDni').value = furData.regDni||'';
    document.getElementById('furRegFecha').value = furData.regFecha||''; document.getElementById('furRegObs').value = furData.regObs||'';
    if(furData.tipoSitio) furData.tipoSitio.forEach(v => { let cb = document.querySelector(`#furTipoSitio input[value="${v}"]`); if(cb) cb.checked = true; });
    if(furData.funcion) furData.funcion.forEach(v => { let cb = document.querySelector(`#furFuncion input[value="${v}"]`); if(cb) cb.checked = true; });
    if(furData.materiales) furData.materiales.forEach(v => { let cb = document.querySelector(`#furMateriales input[value="${v}"]`); if(cb) cb.checked = true; });
    if(furData.rupestre) furData.rupestre.forEach(v => { if(v!=='otros'){ let cb = document.querySelector(`#furRupestre input[value="${v}"]`); if(cb) cb.checked=true; } else { document.getElementById('furRupestreOtrosCb').checked = true; document.getElementById('furRupestreOtros').value = furData.rupestreOtros||''; } });
    if(furData.tareas) furData.tareas.forEach(v => { let cb = document.querySelector(`#furTareas input[value="${v}"]`); if(cb) cb.checked=true; });
}
function guardarFurDesdeFormulario() {
    furData.denominacion = document.getElementById('furDenominacion').value; furData.sigla = document.getElementById('furSigla').value;
    furData.provincia = document.getElementById('furProvincia').value; furData.localidad = document.getElementById('furLocalidad').value;
    furData.paraje = document.getElementById('furParaje').value; furData.departamento = document.getElementById('furDepartamento').value;
    furData.lat = document.getElementById('furLat').value; furData.lon = document.getElementById('furLon').value; furData.datum = document.getElementById('furDatum').value;
    furData.altitud = document.getElementById('furAltitud').value; furData.cartaIgm = document.getElementById('furCartaIgm').value;
    furData.planoCatastral = document.getElementById('furPlanoCatastral').value; furData.superficie = document.getElementById('furSuperficie').value;
    furData.adscripcion = document.getElementById('furAdscripcion').value; furData.intervenciones = document.getElementById('furIntervenciones').value;
    furData.daniosAnt = document.getElementById('furDaniosAnt').value; furData.daniosNat = document.getElementById('furDaniosNat').value;
    furData.riesgoCult = document.getElementById('furRiesgoCult').value; furData.riesgoAmb = document.getElementById('furRiesgoAmb').value;
    furData.observaciones = document.getElementById('furObservaciones').value; furData.regNombre = document.getElementById('furRegNombre').value;
    furData.regDni = document.getElementById('furRegDni').value; furData.regFecha = document.getElementById('furRegFecha').value;
    furData.regObs = document.getElementById('furRegObs').value;
    furData.tipoSitio = Array.from(document.querySelectorAll('#furTipoSitio input:checked')).map(cb=>cb.value);
    furData.funcion = Array.from(document.querySelectorAll('#furFuncion input:checked')).map(cb=>cb.value);
    furData.materiales = Array.from(document.querySelectorAll('#furMateriales input:checked')).map(cb=>cb.value);
    furData.rupestre = Array.from(document.querySelectorAll('#furRupestre input:checked')).map(cb=>cb.value);
    if(furData.rupestre.includes('otros')) furData.rupestreOtros = document.getElementById('furRupestreOtros').value;
    furData.tareas = Array.from(document.querySelectorAll('#furTareas input:checked')).map(cb=>cb.value);
    saveToLocalStorage();
}
// v4: FUR imprimible (desde el diálogo de impresión se puede guardar como PDF)
function imprimirFur() {
    guardarFurDesdeFormulario();
    const f = furData, e = escapeHtml;
    const v = (x) => Array.isArray(x) ? (x.length ? x.join(', ') : '—') : (x || '—');
    const row = (k, x) => `<tr><th>${k}</th><td>${e(v(x))}</td></tr>`;
    const tipos = {cieloAbierto:'Cielo abierto', abrigoRocoso:'Abrigo rocoso', subacuatico:'Subacuático'};
    const rup = (f.rupestre||[]).map(r => r==='otros' ? `Otros${f.rupestreOtros ? ': '+f.rupestreOtros : ''}` : r);
    const sitio = document.getElementById('siteName').value, codigo = document.getElementById('siteCode').value;
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>FUR ${e(f.sigla||sitio)}</title>
<style>body{font-family:system-ui,sans-serif;font-size:12px;margin:24px;color:#222}h1{font-size:16px;margin:0 0 4px}h2{font-size:13px;border-bottom:1px solid #999;margin:16px 0 4px;padding-bottom:2px}
table{width:100%;border-collapse:collapse}th{text-align:left;width:35%;color:#444;font-weight:600;vertical-align:top}th,td{padding:3px 6px;border-bottom:1px solid #eee}.sub{color:#666;font-size:11px}</style></head><body>
<h1>Ficha Única de Registro (ReNYCOA)</h1><div class="sub">SIRENA Sub · ${e(sitio)}${codigo?' ('+e(codigo)+')':''} · ${cps.length} CP · ${pts.length} hallazgos</div>
<h2>I. Identificación</h2><table>${row('Denominación',f.denominacion)}${row('Sigla',f.sigla)}</table>
<h2>II. Localización</h2><table>${row('Provincia',f.provincia)}${row('Localidad',f.localidad)}${row('Paraje/lugar',f.paraje)}${row('Departamento',f.departamento)}${row('Latitud',f.lat)}${row('Longitud',f.lon)}${row('Datum',f.datum)}${row('Altitud (m)',f.altitud)}${row('Carta IGM',f.cartaIgm)}${row('Plano catastral',f.planoCatastral)}</table>
<h2>III. Información técnica</h2><table>${row('Tipo de sitio',(f.tipoSitio||[]).map(t=>tipos[t]||t))}${row('Función inferida',f.funcion)}${row('Superficie (m²)',f.superficie)}${row('Adscripción cultural/temporal',f.adscripcion)}${row('Materiales',f.materiales)}${row('Representaciones rupestres',rup)}</table>
<h2>IV. Tareas realizadas</h2><table>${row('Tareas',f.tareas)}</table>
<h2>V. Impacto y conservación</h2><table>${row('Intervenciones',f.intervenciones)}${row('Daños antrópicos',f.daniosAnt)}${row('Daños naturales',f.daniosNat)}${row('Riesgo impacto cultural',f.riesgoCult)}${row('Riesgo impacto ambiental',f.riesgoAmb)}</table>
<h2>VI. Observaciones</h2><table>${row('Observaciones',f.observaciones)}</table>
<h2>VII. Registro</h2><table>${row('Nombres y apellido',f.regNombre)}${row('DNI',f.regDni)}${row('Fecha',f.regFecha)}${row('Observaciones',f.regObs)}</table>
<script>window.onload=()=>window.print();<\/script></body></html>`;
    const w = window.open('', '_blank');
    if(!w) { download(html, `FUR_${(f.sigla||sitio||'sitio').replace(/[^\w\-]+/g,'_')}.html`, 'text/html'); setStatus('Ventana bloqueada: se descargó la FUR como HTML para imprimir'); return; }
    w.document.write(html); w.document.close();
}
document.getElementById('printFurBtn').onclick = imprimirFur;
initFurCheckboxes();
