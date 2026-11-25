// SIRENA Sub · geometría y cálculo de posiciones (sin acceso al DOM)
// Scripts clásicos (no módulos): comparten el ámbito global y funcionan también abriendo index.html con doble clic.

// ==================== 2. FUNCIONES GEOMÉTRICAS ====================
const DATA_VERSION = 4;
function escapeHtml(v) { return String(v ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
// v4: proyección local en plano tangente; ida y vuelta usan la misma latitud (la del origen)
function geo2local(lat, lon) {
    if(!geoOrigin) return {x:0, y:0};
    const dlat = (lat - geoOrigin.lat) * Math.PI/180;
    const dlon = (lon - geoOrigin.lon) * Math.PI/180;
    const latO = geoOrigin.lat * Math.PI/180;
    return { x: R_EARTH * dlon * Math.cos(latO), y: R_EARTH * dlat };
}
function local2geo(x, y) {
    if(!geoOrigin) return {lat:null, lon:null};
    const latO = geoOrigin.lat * Math.PI/180;
    const lat = geoOrigin.lat + (y / R_EARTH) * 180/Math.PI;
    const lon = geoOrigin.lon + (x / (R_EARTH * Math.cos(latO))) * 180/Math.PI;
    return {lat, lon};
}

// v4: convención única de lado → perp > 0 = DERECHA mirando de A hacia B (normal derecha = (uy, -ux))
function calcPerp(a, b, along, perp) {
    const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx,dy);
    if(L < 1e-7) return null;
    const ux = dx/L, uy = dy/L;
    return { x: a.x + ux*along + uy*perp, y: a.y + uy*along - ux*perp };
}
// Lado efectivo: los puntos Offset/Ties B creados en v3 usaban el lado invertido; se conserva su posición.
function efLado(sp) { return (sp.lado || 1) * (sp.legacySide ? -1 : 1); }

function trilaterate2d(a, da, b, db, side, name) {
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx,dy);
    if(d<0.001) return {success:false, error:"CPs muy cerca"};
    const ex = (da*da - db*db + d*d)/(2*d);
    const h2 = da*da - ex*ex;
    if(h2<0) return {success:false, error:`Las distancias no se cruzan (${name}): revisá las medidas`};
    const h = Math.sqrt(h2)*side;
    const mx = a.x + ex*dx/d, my = a.y + ex*dy/d;
    return {success:true, point:{ x: mx + h*dy/d, y: my - h*dx/d }};
}

// ---- Álgebra lineal propia (v4: sin dependencia de math.js → funciona 100% offline) ----
function solveLinear(A, b) {
    const n = A.length;
    const M = A.map((r,i) => [...r, b[i]]);
    for(let c=0; c<n; c++) {
        let p = c;
        for(let r=c+1; r<n; r++) if(Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
        if(Math.abs(M[p][c]) < 1e-12) return null;
        [M[c], M[p]] = [M[p], M[c]];
        for(let r=c+1; r<n; r++) {
            const f = M[r][c] / M[c][c];
            if(f) for(let k=c; k<=n; k++) M[r][k] -= f * M[c][k];
        }
    }
    const x = new Array(n);
    for(let i=n-1; i>=0; i--) {
        let s = M[i][n];
        for(let j=i+1; j<n; j++) s -= M[i][j] * x[j];
        x[i] = s / M[i][i];
    }
    return x;
}
// Resuelve (JᵀJ + λI)·Δ = Jᵀr  (mínimos cuadrados con amortiguación)
function lsqStep(J, r, lambda) {
    if(!J.length) return null;
    const n = J[0].length;
    const N = Array.from({length:n}, () => new Array(n).fill(0));
    const g = new Array(n).fill(0);
    for(let k=0; k<J.length; k++) {
        const row = J[k];
        for(let i=0; i<n; i++) {
            if(!row[i]) continue;
            g[i] += row[i]*r[k];
            for(let j=0; j<n; j++) N[i][j] += row[i]*row[j];
        }
    }
    for(let i=0; i<n; i++) N[i][i] += lambda;
    return solveLinear(N, g);
}

// ---- Trilateración por mínimos cuadrados (2D o 3D) ----
function linearInit(obs, dims) {
    const o0 = obs[0], A = [], b = [];
    const c0 = [o0.x, o0.y, o0.z];
    for(let i=1; i<obs.length; i++) {
        const o = obs[i];
        const v = [o.x-o0.x, o.y-o0.y, o.z-o0.z].slice(0, dims);
        A.push(v);
        b.push(0.5*(v.reduce((s,t)=>s+t*t,0) + o0.d*o0.d - o.d*o.d));
    }
    const sol = lsqStep(A, b, 1e-9);
    return sol ? sol.map((v,i) => v + c0[i]) : null;
}
function gnPosition(obs, p, dims) {
    for(let it=0; it<30; it++) {
        const J = [], r = [];
        for(const o of obs) {
            const dx = p[0]-o.x, dy = p[1]-o.y, dz = dims===3 ? p[2]-o.z : 0;
            const c = Math.hypot(dx,dy,dz);
            if(c < 1e-9) continue;
            J.push(dims===3 ? [dx/c, dy/c, dz/c] : [dx/c, dy/c]);
            r.push(o.d - c);
        }
        const delta = lsqStep(J, r, 1e-9);
        if(!delta) break;
        for(let i=0; i<dims; i++) p[i] += delta[i];
        if(Math.hypot(...delta) < 1e-7) break;
    }
    const res = obs.map(o => o.d - Math.hypot(p[0]-o.x, p[1]-o.y, dims===3 ? p[2]-o.z : 0));
    return { p, rms: Math.sqrt(res.reduce((s,v)=>s+v*v,0)/res.length) };
}
// obs: [{x,y,z(prof. del CP), d (distancia inclinada), name}] · zKnown: profundidad del punto o null
function trilaterar(obs, zKnown) {
    let warn = '';
    const zs = obs.map(o => o.z);
    const spread = Math.max(...zs) - Math.min(...zs);
    if(zKnown === null) {
        if(spread < 0.5) {
            zKnown = zs.reduce((s,v)=>s+v,0)/zs.length;
            warn = 'Sin profundidad del punto y CPs a profundidad similar: se asumió la profundidad media de los CPs. Cargá la del profundímetro para más precisión.';
        } else if(obs.length < 4) {
            return {error:'Con 3 CPs hay que cargar la profundidad del punto (profundímetro)'};
        }
    }
    if(zKnown !== null) {
        // Distancias inclinadas → horizontales usando el desnivel de cada CP
        const o2 = [];
        for(const o of obs) {
            const dz = zKnown - o.z, h2 = o.d*o.d - dz*dz;
            if(h2 <= 0) return {error:`La distancia a ${o.name} es menor que el desnivel con ese CP`};
            o2.push({x:o.x, y:o.y, z:0, d:Math.sqrt(h2)});
        }
        const init = linearInit(o2, 2);
        if(!init) return {error:'CPs alineados: no se puede resolver'};
        const {p, rms} = gnPosition(o2, init, 2);
        return {x:p[0], y:p[1], z:zKnown, rms, warn};
    }
    const init = linearInit(obs, 3);
    if(!init) return {error:'Geometría de CPs insuficiente'};
    const {p, rms} = gnPosition(obs, init, 3);
    return {x:p[0], y:p[1], z:p[2], rms, warn};
}

// ==================== CÁLCULO DE PUNTOS A PARTIR DE LAS MEDICIONES ====================
function getSeg(segmento) {
    const [aName,bName] = (segmento||'').split('|');
    if(aName === bName) return {error:'El segmento necesita dos CPs distintos'};
    const ra = findCp(aName), rb = findCp(bName);
    if(!ra || !rb) return {error:`Segmento ${aName} → ${bName}: CP no encontrado`};
    return {ra, rb, a:{x:ra.localX, y:ra.localY}, b:{x:rb.localX, y:rb.localY}};
}
// v4: cálculo puro (sin efectos) → se usa al agregar y al recalcular después de un ajuste de red
function computeLocal(method, params) {
    if(method==='radial') {
        const c = findCp(params.centro);
        if(!c) return {error:`CP centro ${params.centro} no encontrado`};
        let dist = params.dist;
        if(params.corregirDesnivel && Number.isFinite(c.depth) && Number.isFinite(params.depth)) {
            const dz = params.depth - c.depth;
            if(Math.abs(dz) >= dist) return {error:'El desnivel es mayor que la distancia medida'};
            dist = Math.sqrt(dist*dist - dz*dz);
        }
        const az = params.bearing + (params.magnetico ? (params.declinacion||0) : 0);
        const rad = az * Math.PI/180;
        return {local:{ x: c.localX + dist*Math.sin(rad), y: c.localY + dist*Math.cos(rad) }, refs:[c.name]};
    }
    if(method==='offset') {
        const sg = getSeg(params.segmento); if(sg.error) return sg;
        const local = calcPerp(sg.a, sg.b, params.along, params.perp*efLado(params));
        if(!local) return {error:'Segmento degenerado (CPs coincidentes)'};
        return {local, refs:[sg.ra.name, sg.rb.name]};
    }
    if(method==='ties') {
        const sg = getSeg(params.segmento); if(sg.error) return sg;
        const res = trilaterate2d(sg.a, params.distA, sg.b, params.distB, params.lado, params.name);
        if(!res.success) return {error:res.error};
        return {local:res.point, refs:[sg.ra.name, sg.rb.name]};
    }
    if(method==='acrux') {
        const sg = getSeg(params.segmento); if(sg.error) return sg;
        const bx = sg.b.x - sg.a.x, by = sg.b.y - sg.a.y, blen = Math.hypot(bx,by);
        if(blen<0.001) return {error:'CPs coincidentes'};
        const ux = bx/blen, uy = by/blen, nx = uy, ny = -ux; // normal DERECHA
        const d = Math.abs(params.along2 - params.along1);
        if(d<0.001) return {error:'Las dos posiciones sobre la base son iguales'};
        const r1 = params.dist1, r2 = params.dist2;
        const a = (r1*r1 - r2*r2 + d*d)/(2*d);
        const h2 = r1*r1 - a*a;
        if(h2<0) return {error:'Las distancias no se cruzan: revisá las medidas'};
        const h = Math.sqrt(h2);
        const sign = params.along2 > params.along1 ? 1 : -1;
        const px = sg.a.x + (params.along1 + sign*a)*ux;
        const py = sg.a.y + (params.along1 + sign*a)*uy;
        const lado = efLado(params);
        return {local:{ x: px + lado*h*nx, y: py + lado*h*ny }, refs:[sg.ra.name, sg.rb.name]};
    }
    if(method==='trilat3d') {
        const obs = [], refs = [];
        for(const it of (params.distancias||[])) {
            const c = findCp(it.cp);
            if(c && Number.isFinite(it.dist) && it.dist>0) {
                obs.push({x:c.localX, y:c.localY, z:Number.isFinite(c.depth)?c.depth:0, d:it.dist, name:c.name});
                refs.push(c.name);
            }
        }
        if(new Set(refs).size < 3) return {error:'Se necesitan al menos 3 CPs distintos con distancia'};
        const sol = trilaterar(obs, Number.isFinite(params.depth) ? params.depth : null);
        if(sol.error) return sol;
        return {local:{x:sol.x, y:sol.y}, refs, depth:sol.z, rms:sol.rms, warn:sol.warn};
    }
    return {error:'Método desconocido'};
}
