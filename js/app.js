// SIRENA Sub · alta de puntos, formularios por método e inicio
// Scripts clásicos (no módulos): comparten el ámbito global y funcionan también abriendo index.html con doble clic.

// ==================== ALTA DE PUNTOS ====================
function addPoint(method, params, type) {
    let local, lat=null, lon=null, refs=[], depth = Number.isFinite(params.depth) ? params.depth : 0, extra = '';
    if(method==='gps') {
        if(!geoOrigin) geoOrigin = {lat:params.lat, lon:params.lon};
        local = geo2local(params.lat,params.lon); lat=params.lat; lon=params.lon;
    } else {
        const r = computeLocal(method, params);
        if(r.error) { setStatus(r.error, true); return; }
        local = r.local; refs = r.refs;
        if(method==='trilat3d') {
            depth = r.depth;
            extra = ` · RMS ${r.rms.toFixed(2)} m · prof. ${r.depth.toFixed(2)} m` + (r.warn ? ' · ⚠ '+r.warn : '');
        }
        const geo = local2geo(local.x, local.y); lat = geo.lat; lon = geo.lon;
    }
    const newPoint = {
        name: params.name, method, localX: local.x, localY: local.y, localZ: depth, depth,
        desc: params.desc||'', findType: params.findType||'', material: params.material||'', dimensions: params.dimensions||'',
        refs, surveyParams: params, lat, lon
    };
    if(type==='cp') cps.push({...newPoint, seabed: params.seabed||''});
    else pts.push(newPoint);
    renderAll(); saveToLocalStorage(true);
    const etiqueta = type==='cp' ? 'CP' : 'Punto';
    if(lat === null || lon === null) setStatus(`${etiqueta} ${params.name} agregado (sin georreferencia: falta GPS o CP con lat/lon)${extra}`, true);
    else setStatus(`${etiqueta} ${params.name} agregado${extra}`, !!(extra && extra.includes('⚠')));
    document.getElementById('newName').value = '';
    resetView();
}

// ==================== 7. INTERFAZ DINÁMICA DE MÉTODOS ====================
const methodSelect = document.getElementById('methodSelect');
const methodFieldsDiv = document.getElementById('methodFields');
function segFieldsHtml(prefix) {
    const a = cps[0]?.name, b = cps[1]?.name;
    return `<div class="row-2"><div><label>CP A (inicio de base)</label><select id="${prefix}A" class="cpSel">${cpOptionsHtml(a)}</select></div>
            <div><label>CP B (fin de base)</label><select id="${prefix}B" class="cpSel">${cpOptionsHtml(b)}</select></div></div>`;
}
const LADO_HTML = (id) => `<div><label>Lado (mirando de A hacia B)</label><select id="${id}"><option value="1">Derecha</option><option value="-1">Izquierda</option></select></div>`;
function addTrilatRow() {
    const container = document.getElementById('trilatPairs');
    const div = document.createElement('div'); div.className = 'row-2';
    const usados = [...container.querySelectorAll('.trilatCpSelect')].map(s=>s.value);
    const sugerido = (cps.find(c => !usados.includes(c.name)) || cps[0])?.name;
    div.innerHTML = `<select class="trilatCpSelect cpSel">${cpOptionsHtml(sugerido)}</select><input type="number" step="0.01" class="trilatDist" placeholder="Dist. (m)">`;
    container.appendChild(div);
}
function updateMethodFields() {
    const method = methodSelect.value;
    let html = '';
    if(method === 'gps') {
        html = `<div class="row-2"><div><label>Latitud</label><input type="number" step="0.000001" id="gpsLat"></div><div><label>Longitud</label><input type="number" step="0.000001" id="gpsLon"></div></div><div><label>Profundidad (m)</label><input type="number" step="0.01" id="gpsDepth"></div>`;
    } else if(method === 'radial') {
        html = `<div><label>Centro (CP)</label><select id="radCp" class="cpSel">${cpOptionsHtml(cps[0]?.name)}</select></div><div class="row-2"><div><label>Distancia (m)</label><input type="number" step="0.01" id="radDist"></div><div><label>Rumbo (°)</label><input type="number" step="0.1" id="radBearing"></div></div><div><label>Profundidad punto (m)</label><input type="number" step="0.01" id="radDepth"></div>
            <div><label style="display:inline"><input type="checkbox" id="radMagnetico" checked style="width:auto"> Rumbo de brújula (aplicar declinación del proyecto)</label></div>
            <div><label style="display:inline"><input type="checkbox" id="radCorrectSlope" style="width:auto"> Corregir desnivel (distancia inclinada → horizontal)</label></div>`;
    } else if(method === 'offset') {
        html = segFieldsHtml('off') + `<div class="row-2"><div><label>Dist. sobre base desde A (m)</label><input type="number" step="0.01" id="offAlong"></div><div><label>Dist. perpendicular (m)</label><input type="number" step="0.01" id="offPerp"></div></div><div class="row-2">${LADO_HTML('offSide')}<div><label>Profundidad (m)</label><input type="number" step="0.01" id="offDepth"></div></div>`;
    } else if(method === 'ties') {
        html = segFieldsHtml('ties') + `<div class="row-2"><div><label>Dist. desde A (m)</label><input type="number" step="0.01" id="tiesDistA"></div><div><label>Dist. desde B (m)</label><input type="number" step="0.01" id="tiesDistB"></div></div><div class="row-2">${LADO_HTML('tiesSide')}<div><label>Profundidad (m)</label><input type="number" step="0.01" id="tiesDepth"></div></div>`;
    } else if(method === 'trilat3d') {
        html = `<div id="trilatPairs"></div><button id="addTrilatPair" type="button" class="btn-sm" style="margin-bottom:6px">+ Agregar CP</button><div><label>Profundidad del punto (m) — recomendada</label><input type="number" step="0.01" id="t3dDepth"></div>`;
    } else if(method === 'acrux') {
        html = segFieldsHtml('acrux') + `
                <fieldset style="border:1px solid #ced4da; border-radius:6px; padding:6px; margin-bottom:6px;"><legend>Par 1</legend>
                <div class="row-2"><div><label>Sobre base desde A (m)</label><input type="number" step="0.01" id="acruxAlong1"></div><div><label>Dist 1 (m)</label><input type="number" step="0.01" id="acruxDist1"></div></div></fieldset>
                <fieldset style="border:1px solid #ced4da; border-radius:6px; padding:6px; margin-bottom:6px;"><legend>Par 2</legend>
                <div class="row-2"><div><label>Sobre base desde A (m)</label><input type="number" step="0.01" id="acruxAlong2"></div><div><label>Dist 2 (m)</label><input type="number" step="0.01" id="acruxDist2"></div></div></fieldset>
                <div class="row-2">${LADO_HTML('acruxSide')}<div><label>Profundidad (m)</label><input type="number" step="0.01" id="acruxDepth"></div></div>`;
    }
    html += `<div><label>Descripción</label><input type="text" id="pointDesc"></div>
            <div class="row-2"><div><label>Tipo hallazgo</label><input type="text" id="findType"></div><div><label>Material</label><input type="text" id="material"></div></div>
            <div class="row-2"><div><label>Dimensiones</label><input type="text" id="dimensions"></div><div></div></div>`;
    methodFieldsDiv.innerHTML = html;
    if(method === 'trilat3d') {
        document.getElementById('addTrilatPair').onclick = addTrilatRow;
        for(let i=0; i<Math.min(3, cps.length); i++) addTrilatRow();
    }
}
function num(id) { const el = document.getElementById(id); return el ? parseFloat(el.value) : NaN; }
function val(id) { return document.getElementById(id)?.value; }
function segFrom(prefix) {
    const a = val(prefix+'A'), b = val(prefix+'B');
    if(!a || !b) return {error:'Faltan CPs para el segmento'};
    if(a === b) return {error:'CP A y CP B deben ser distintos'};
    return {segmento:`${a}|${b}`};
}
function nombreLibre() {
    const usados = new Set([...cps, ...pts].map(p => p.name));
    let i = pts.length + cps.length + 1;
    while(usados.has(`P${String(i).padStart(2,'0')}`)) i++;
    return `P${String(i).padStart(2,'0')}`;
}
document.getElementById('addPointBtn').onclick = () => {
    const name = document.getElementById('newName').value.trim() || nombreLibre();
    if([...cps, ...pts].some(p => p.name === name)) { setStatus(`Ya existe un punto llamado "${name}"`, true); return; }
    const pointType = document.getElementById('pointType').value;
    const method = methodSelect.value;
    let params = { name, desc: val('pointDesc')||'', findType: val('findType')||'', material: val('material')||'', dimensions: val('dimensions')||'' };
    const depthOr0 = (id) => { const v = num(id); return Number.isFinite(v) ? v : 0; };
    const incompletos = () => setStatus('Datos incompletos', true);
    if(method === 'gps') {
        const lat = num('gpsLat'), lon = num('gpsLon');
        if(isNaN(lat)||isNaN(lon)){ setStatus('GPS requiere lat/lon',true); return; }
        if(Math.abs(lat)>90 || Math.abs(lon)>180){ setStatus('Lat/lon fuera de rango',true); return; }
        params = {...params, lat, lon, depth: depthOr0('gpsDepth')};
    } else if(method === 'radial') {
        const centro = val('radCp'), dist = num('radDist'), bearing = num('radBearing');
        if(!centro||isNaN(dist)||isNaN(bearing)){ incompletos(); return; }
        const magnetico = !!document.getElementById('radMagnetico')?.checked;
        params = {...params, centro, dist, bearing, depth: depthOr0('radDepth'),
            corregirDesnivel: !!document.getElementById('radCorrectSlope')?.checked,
            magnetico, declinacion: magnetico ? getDeclinacion() : 0};
    } else if(method === 'offset') {
        const sg = segFrom('off'); if(sg.error){ setStatus(sg.error,true); return; }
        const along = num('offAlong'), perp = num('offPerp');
        if(isNaN(along)||isNaN(perp)){ incompletos(); return; }
        params = {...params, segmento: sg.segmento, along, perp, lado: parseInt(val('offSide')), depth: depthOr0('offDepth')};
    } else if(method === 'ties') {
        const sg = segFrom('ties'); if(sg.error){ setStatus(sg.error,true); return; }
        const distA = num('tiesDistA'), distB = num('tiesDistB');
        if(isNaN(distA)||isNaN(distB)){ incompletos(); return; }
        params = {...params, segmento: sg.segmento, distA, distB, lado: parseInt(val('tiesSide')), depth: depthOr0('tiesDepth')};
    } else if(method === 'trilat3d') {
        const distancias = [];
        document.querySelectorAll('#trilatPairs .row-2').forEach(row => {
            const cp = row.querySelector('.trilatCpSelect')?.value;
            const dist = parseFloat(row.querySelector('.trilatDist')?.value);
            if(cp && !isNaN(dist)) distancias.push({cp, dist});
        });
        if(distancias.length<3){ setStatus('Al menos 3 CPs con distancia',true); return; }
        const d = num('t3dDepth');
        params = {...params, distancias, depth: Number.isFinite(d) ? d : null};
    } else if(method === 'acrux') {
        const sg = segFrom('acrux'); if(sg.error){ setStatus(sg.error,true); return; }
        const along1 = num('acruxAlong1'), dist1 = num('acruxDist1'), along2 = num('acruxAlong2'), dist2 = num('acruxDist2');
        if([along1,dist1,along2,dist2].some(isNaN)){ incompletos(); return; }
        params = {...params, segmento: sg.segmento, along1, dist1, along2, dist2, lado: parseInt(val('acruxSide')), depth: depthOr0('acruxDepth')};
    }
    addPoint(method, params, pointType);
};
methodSelect.addEventListener('change', updateMethodFields);
updateMethodFields();

// ==================== 12. BOTONES Y INICIO ====================
document.addEventListener('keydown', (e) => {
    if(e.key === 'Escape') {
        document.getElementById('pointPopup').style.display = 'none';
        document.getElementById('furModal').style.display = 'none';
        _selectedPoint = null;
        draw();
    }
});
document.getElementById('furModal').addEventListener('click', (e) => {
    if(e.target === document.getElementById('furModal')) document.getElementById('furModal').style.display = 'none';
});
function zoomCentro(f) {
    const cx = canvas.width/2, cy = canvas.height/2, ns = clampScale(scaleVal*f);
    offX = cx - (cx - offX)*(ns/scaleVal); offY = cy - (cy - offY)*(ns/scaleVal); scaleVal = ns; draw();
}
document.getElementById('zoomInBtn').onclick = () => zoomCentro(1.2);
document.getElementById('zoomOutBtn').onclick = () => zoomCentro(1/1.2);
document.getElementById('resetViewBtn').onclick = resetView;
document.getElementById('toggleLinesBtn').onclick = () => { showLines = !showLines; draw(); saveToLocalStorage(true); setStatus(showLines ? 'Líneas de construcción visibles' : 'Líneas de construcción ocultas'); };
document.getElementById('exportCsvBtn').onclick = exportCSV;
document.getElementById('exportKmlBtn').onclick = exportKML;
document.getElementById('exportGeoJsonBtn').onclick = exportGeoJSON;
document.getElementById('exportJpgBtn').onclick = exportJPG;
document.getElementById('exportBackupBtn').onclick = exportBackup;
document.getElementById('importBackupBtn').onclick = () => { document.getElementById('backupFile').click(); };
document.getElementById('backupFile').onchange = (e) => { if(e.target.files.length) importBackup(e.target.files[0]); e.target.value = ''; };
document.getElementById('clearAllBtn').onclick = clearAll;
window.addEventListener('resize', () => draw());

function toggleCard(id) { document.getElementById(id)?.classList.toggle('collapsed'); }
// E14: solo JS, sin inline
document.getElementById('sidebarToggle').onclick = () => document.getElementById('mainSidebar').classList.toggle('open');

loadFromLocalStorage().then(() => { draw(); resetView(); });
