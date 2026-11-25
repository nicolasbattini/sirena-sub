// SIRENA Sub · dibujo del mapa, zoom, paneo y selección
// Scripts clásicos (no módulos): comparten el ámbito global y funcionan también abriendo index.html con doble clic.

// ==================== TRANSFORMACIONES DE PANTALLA ====================
function screen2local(sx, sy) { return { x: (sx - offX)/(scaleVal/100), y: -(sy - offY)/(scaleVal/100) }; }
function local2screen(lx, ly) { return { x: lx*(scaleVal/100)+offX, y: -ly*(scaleVal/100)+offY }; }

// ==================== 3. DIBUJO DEL MAPA ====================
function pickGridStep() {
    const mpp = 100/scaleVal;
    const raw = canvas.width * mpp / 4;
    let exp = Math.pow(10, Math.floor(Math.log10(Math.max(raw,0.001))));
    for(let c of [1,2,5,10,20,50,100,200,500,1000]) if(c*exp >= raw) return c*exp;
    return 100;
}
function formatDistance(m) { return Math.abs(m)>=1000 ? (m/1000).toFixed(0)+'km' : Math.round(m)+'m'; }

function drawGrid() {
    const step = pickGridStep();
    const tl = screen2local(0,0), br = screen2local(canvas.width,canvas.height);
    const x0 = Math.floor(tl.x/step)*step, x1 = Math.ceil(br.x/step)*step;
    const y0 = Math.floor(br.y/step)*step, y1 = Math.ceil(tl.y/step)*step;
    ctx.fillStyle = '#f8f9fa'; ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.strokeStyle = 'rgba(44,62,80,0.18)'; ctx.lineWidth = 0.5;
    for(let x=x0; x<=x1; x+=step) {
        const s = local2screen(x,0);
        if(s.x>=0 && s.x<=canvas.width) {
            ctx.beginPath(); ctx.moveTo(s.x,0); ctx.lineTo(s.x,canvas.height); ctx.stroke();
            ctx.fillStyle = 'rgba(44,62,80,0.75)'; ctx.font = 'bold 12px monospace';
            ctx.fillText(formatDistance(x), s.x+2, canvas.height-4);
        }
    }
    for(let y=y0; y<=y1; y+=step) {
        const s = local2screen(0,y);
        if(s.y>=0 && s.y<=canvas.height) {
            ctx.beginPath(); ctx.moveTo(0,s.y); ctx.lineTo(canvas.width,s.y); ctx.stroke();
            ctx.fillStyle = 'rgba(44,62,80,0.75)';
            ctx.fillText(formatDistance(y), 2, s.y-2);
        }
    }
}

// P5 + P6: líneas de referencia
function drawReferenceLines() {
    if(!showLines) return;
    ctx.save();
    // Base CP-CP punteada (todas las técnicas, como estaba)
    ctx.strokeStyle='#a0c4ff'; ctx.lineWidth=1.2; ctx.setLineDash([6,6]);
    for(let i=0;i<cps.length-1;i++) {
        const a = local2screen(cps[i].localX, cps[i].localY);
        const b = local2screen(cps[i+1].localX, cps[i+1].localY);
        ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
    }
    ctx.setLineDash([]);

    const cpMap = new Map(cps.map(c=>[c.name.trim(), c]));
    // v4: líneas de base de segmentos no consecutivos usados por Offset / Ties / Ties B
    const consecutivos = new Set(cps.slice(0,-1).map((c,i)=>`${c.name}|${cps[i+1].name}`));
    const segsUsados = new Set();
    for(const pt of [...cps, ...pts]) {
        const sg = pt.surveyParams && pt.surveyParams.segmento;
        if(sg && ['offset','ties','acrux'].includes(pt.method)) {
            const [a,b] = sg.split('|');
            if(!consecutivos.has(sg) && !consecutivos.has(`${b}|${a}`)) segsUsados.add(sg);
        }
    }
    ctx.strokeStyle='#a0c4ff'; ctx.lineWidth=1.2; ctx.setLineDash([2,4]);
    for(const sg of segsUsados) {
        const [aName,bName] = sg.split('|');
        const ra = cpMap.get(aName), rb = cpMap.get(bName);
        if(!ra || !rb) continue;
        const a = local2screen(ra.localX, ra.localY), b = local2screen(rb.localX, rb.localY);
        ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
    }
    ctx.setLineDash([]);
    for(let pt of pts) {
        const sp = pt.surveyParams || {};
        const ps = local2screen(pt.localX, pt.localY);

        if(pt.method === 'offset' && sp.segmento) {
            const [aName,bName] = sp.segmento.split('|');
            const ra = cpMap.get(aName), rb = cpMap.get(bName);
            if(ra && rb && sp.along!=null) {
                const bx = rb.localX - ra.localX, by = rb.localY - ra.localY;
                const blen = Math.hypot(bx,by);
                if(blen>0.001) {
                    const ux = bx/blen, uy = by/blen;
                    const footX = ra.localX + sp.along*ux;
                    const footY = ra.localY + sp.along*uy;
                    const foot = local2screen(footX,footY);
                    // P5: SOLO perpendicular hallazgo→pie (punteada fina)
                    ctx.strokeStyle = '#27ae60'; ctx.lineWidth = 1.3; ctx.setLineDash([4,3]);
                    ctx.beginPath(); ctx.moveTo(ps.x,ps.y); ctx.lineTo(foot.x,foot.y); ctx.stroke();
                    ctx.setLineDash([]);
                    // Marca del pie (tick)
                    ctx.fillStyle = '#27ae60';
                    ctx.beginPath(); ctx.arc(foot.x, foot.y, 2.8, 0, 2*Math.PI); ctx.fill();
                }
            }
        } else if(pt.method === 'ties' && sp.segmento) {
            const [aName,bName] = sp.segmento.split('|');
            const ra = cpMap.get(aName), rb = cpMap.get(bName);
            if(ra && rb) {
                const ras = local2screen(ra.localX,ra.localY);
                const rbs = local2screen(rb.localX,rb.localY);
                ctx.strokeStyle = '#a0c4ff'; ctx.lineWidth = 1.2; ctx.setLineDash([6,6]);
                ctx.beginPath(); ctx.moveTo(ras.x,ras.y); ctx.lineTo(ps.x,ps.y); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(rbs.x,rbs.y); ctx.lineTo(ps.x,ps.y); ctx.stroke();
                ctx.setLineDash([]);
            }
        } else if(pt.method === 'acrux' && sp.segmento && sp.along1!=null) {
            const [aName,bName] = sp.segmento.split('|');
            const ra = cpMap.get(aName), rb = cpMap.get(bName);
            if(ra && rb) {
                const bx = rb.localX - ra.localX, by = rb.localY - ra.localY;
                const blen = Math.hypot(bx,by);
                if(blen>0.001) {
                    const ux = bx/blen, uy = by/blen;
                    const f1 = local2screen(ra.localX + sp.along1*ux, ra.localY + sp.along1*uy);
                    const f2 = local2screen(ra.localX + sp.along2*ux, ra.localY + sp.along2*uy);
                    ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 1.2; ctx.setLineDash([6,6]);
                    ctx.beginPath(); ctx.moveTo(f1.x,f1.y); ctx.lineTo(ps.x,ps.y); ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(f2.x,f2.y); ctx.lineTo(ps.x,ps.y); ctx.stroke();
                    ctx.setLineDash([]);
                }
            }
        } else if(pt.method === 'radial' && pt.refs && pt.refs[0]) {
            const ra = cpMap.get(pt.refs[0]);
            if(ra) {
                const r = local2screen(ra.localX,ra.localY);
                // Línea recta CP→punto
                ctx.strokeStyle = '#e67e22'; ctx.lineWidth = 1.2; ctx.setLineDash([6,6]);
                ctx.beginPath(); ctx.moveTo(r.x,r.y); ctx.lineTo(ps.x,ps.y); ctx.stroke();
                ctx.setLineDash([]);
                // P6: circunferencia punteada a escala real, baja opacidad; resaltar si es el seleccionado
                const isSel = _selectedPoint && _selectedPoint.type === 'P' && _selectedPoint.data === pt;
                const radiusPx = (sp.dist || 0) * (scaleVal/100);
                if(radiusPx > 0.5) {
                    ctx.beginPath();
                    ctx.arc(r.x, r.y, radiusPx, 0, 2*Math.PI);
                    ctx.strokeStyle = isSel ? 'rgba(230,126,34,0.9)' : 'rgba(230,126,34,0.28)';
                    ctx.lineWidth = isSel ? 2 : 1.2;
                    ctx.setLineDash(isSel ? [6,4] : [3,5]);
                    ctx.stroke();
                    ctx.setLineDash([]);
                }
            }
        } else if(pt.method === 'trilat3d') {
            for(let ref of (pt.refs||[])) {
                const ra = cpMap.get(ref);
                if(ra) {
                    const r = local2screen(ra.localX,ra.localY);
                    ctx.strokeStyle = '#8e44ad'; ctx.lineWidth = 1.2; ctx.setLineDash([6,6]);
                    ctx.beginPath(); ctx.moveTo(r.x,r.y); ctx.lineTo(ps.x,ps.y); ctx.stroke();
                    ctx.setLineDash([]);
                }
            }
        }
    }
    ctx.restore();
}

function drawCps() {
    const labelSize = Math.max(10, Math.min(14, Math.round(scaleVal/20)));
    for(let i=0;i<cps.length;i++) {
        const cp = cps[i];
        const s = local2screen(cp.localX, cp.localY);
        const col = CP_COLORS[i % CP_COLORS.length];
        ctx.fillStyle = col; ctx.strokeStyle = 'white'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(s.x, s.y-9); ctx.lineTo(s.x+7, s.y); ctx.lineTo(s.x, s.y+9); ctx.lineTo(s.x-7, s.y); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.font = `bold ${labelSize}px system-ui`;
        ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 3;
        ctx.strokeText(cp.name, s.x+9, s.y+4);
        ctx.fillStyle = '#1e293b'; ctx.fillText(cp.name, s.x+9, s.y+4);
    }
}

function drawPoints() {
    const labelSize = Math.max(9, Math.min(13, Math.round(scaleVal/22)));
    for(let pt of pts) {
        const s = local2screen(pt.localX, pt.localY);
        const col = METHOD_COLORS[pt.method] || '#888';
        ctx.fillStyle = col; ctx.strokeStyle = 'white'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(s.x, s.y, 5, 0, 2*Math.PI); ctx.fill(); ctx.stroke();
        ctx.font = `${labelSize}px system-ui`;
        ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2.5;
        ctx.strokeText(pt.name, s.x+7, s.y+4);
        ctx.fillStyle = '#222'; ctx.fillText(pt.name, s.x+7, s.y+4);
    }
}

let _raf = false;
function draw() {
    if(_raf) return;
    _raf = true;
    requestAnimationFrame(() => {
        _raf = false;
        if(!canvas) return;
        const newW = wrap.clientWidth, newH = wrap.clientHeight;
        if(canvas.width !== newW) canvas.width = newW;
        if(canvas.height !== newH) canvas.height = newH;
        drawGrid();
        drawReferenceLines();
        drawCps();
        drawPoints();
        const step = pickGridStep();
        const mpp = (100/scaleVal);
        let zoomLabel;
        if(mpp < 0.001) zoomLabel = (mpp*100).toFixed(2)+'cm/px';
        else if(mpp < 1) zoomLabel = (mpp*100).toFixed(1)+'cm/px';
        else zoomLabel = mpp.toFixed(1)+'m/px';
        document.getElementById('scaleBar').innerHTML = `📏 ${step>=1000?step/1000+' km':step+' m'} | 🔍 ${zoomLabel} | ${geoOrigin?'🌐 georref.':'⚠️ sin GPS'}`;
    });
}

function resetView() {
    let all = [...cps.map(c=>({x:c.localX,y:c.localY})), ...pts.map(p=>({x:p.localX,y:p.localY}))];
    if(all.length===0){ offX=canvas.width/2; offY=canvas.height/2; scaleVal=200; draw(); return; }
    let xs=all.map(p=>p.x), ys=all.map(p=>p.y);
    let minX=Math.min(...xs), maxX=Math.max(...xs), minY=Math.min(...ys), maxY=Math.max(...ys);
    let w=maxX-minX||10, h=maxY-minY||10, margin=0.15;
    let sx=(canvas.width*(1-margin))/w, sy=(canvas.height*(1-margin))/h;
    scaleVal = Math.max(1, Math.min(sx,sy)*100);
    offX = canvas.width/2 - (minX+maxX)/2*(scaleVal/100);
    offY = canvas.height/2 + (minY+maxY)/2*(scaleVal/100);
    draw();
}

// ==================== 11. INTERACCIONES DEL MAPA ====================
document.getElementById('searchBtn').onclick = () => {
    const name = document.getElementById('searchName').value.trim().toLowerCase();
    if(!name) return;
    let found = [...cps, ...pts].find(p => p.name.toLowerCase() === name);
    if(found) { centerOnPoint(found.localX, found.localY); setStatus(`Encontrado: ${found.name}`); }
    else setStatus(`No encontrado: ${name}`, true);
};
function centerOnPoint(lx, ly) {
    offX = canvas.width/2 - lx*(scaleVal/100);
    offY = canvas.height/2 + ly*(scaleVal/100);
    draw();
}
// v4: paneo y zoom con mouse, lápiz o dedos (pointer events; pellizco con dos dedos)
const _pointers = new Map(); let _pinch = null;
function clampScale(v) { return Math.min(Math.max(v, 1), 500000); }
canvas.addEventListener('pointerdown', (e) => {
    if(e.pointerType === 'mouse' && e.button !== 0) return;
    try { canvas.setPointerCapture(e.pointerId); } catch(_) {}
    _pointers.set(e.pointerId, {x:e.clientX, y:e.clientY});
    if(_pointers.size === 1) {
        isPanning = true; _didDrag = false;
        panStart = {x:e.clientX, y:e.clientY}; dragOrig = {x:offX, y:offY};
    } else if(_pointers.size === 2) {
        isPanning = false; _didDrag = true;
        const [p1,p2] = [..._pointers.values()];
        _pinch = { dist: Math.hypot(p1.x-p2.x, p1.y-p2.y) || 1, scale: scaleVal, offX, offY, cx:(p1.x+p2.x)/2, cy:(p1.y+p2.y)/2 };
    }
    e.preventDefault();
});
canvas.addEventListener('pointermove', (e) => {
    if(!_pointers.has(e.pointerId)) return;
    _pointers.set(e.pointerId, {x:e.clientX, y:e.clientY});
    if(_pointers.size >= 2 && _pinch) {
        const [p1,p2] = [..._pointers.values()];
        const rect = canvas.getBoundingClientRect();
        const newScale = clampScale(_pinch.scale * Math.hypot(p1.x-p2.x, p1.y-p2.y) / _pinch.dist);
        const f = newScale / _pinch.scale;
        const cx = (p1.x+p2.x)/2 - rect.left, cy = (p1.y+p2.y)/2 - rect.top;
        const c0x = _pinch.cx - rect.left, c0y = _pinch.cy - rect.top;
        offX = cx - (c0x - _pinch.offX)*f; offY = cy - (c0y - _pinch.offY)*f;
        scaleVal = newScale; draw();
    } else if(isPanning) {
        const dx = e.clientX - panStart.x, dy = e.clientY - panStart.y;
        if(Math.hypot(dx,dy) > 4) _didDrag = true;
        offX = dragOrig.x + dx; offY = dragOrig.y + dy; draw();
    }
});
function _endPointer(e) {
    _pointers.delete(e.pointerId);
    if(_pointers.size < 2) _pinch = null;
    if(_pointers.size === 1) {
        const p = [..._pointers.values()][0];
        isPanning = true; panStart = {x:p.x, y:p.y}; dragOrig = {x:offX, y:offY};
    } else if(_pointers.size === 0) {
        isPanning = false;
        setTimeout(() => { _didDrag = false; }, 50);
    }
}
canvas.addEventListener('pointerup', _endPointer);
canvas.addEventListener('pointercancel', _endPointer);
// Zoom
canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    _didDrag = false; // E3
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvas.width/rect.width);
    const my = (e.clientY - rect.top) * (canvas.height/rect.height);
    const factor = e.deltaY < 0 ? 1.12 : 1/1.12;
    const newScale = clampScale(scaleVal * factor);
    offX = mx - (mx - offX) * (newScale/scaleVal);
    offY = my - (my - offY) * (newScale/scaleVal);
    scaleVal = newScale;
    draw();
}, {passive: false});
// Popup al hacer clic
canvas.addEventListener('click', (e) => {
    if(_didDrag) { _didDrag = false; return; }
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width/rect.width, scaleY = canvas.height/rect.height;
    const mx = (e.clientX - rect.left)*scaleX, my = (e.clientY - rect.top)*scaleY;
    let bestDist = 14, bestPoint = null;
    for(let cp of cps) {
        const s = local2screen(cp.localX, cp.localY);
        const d = Math.hypot(s.x - mx, s.y - my);
        if(d < bestDist) { bestDist = d; bestPoint = { type:'CP', data:cp }; }
    }
    for(let pt of pts) {
        const s = local2screen(pt.localX, pt.localY);
        const d = Math.hypot(s.x - mx, s.y - my);
        if(d < bestDist) { bestDist = d; bestPoint = { type:'P', data:pt }; }
    }
    const popup = document.getElementById('pointPopup');
    if(bestPoint) {
        const d = bestPoint.data;
        document.getElementById('ppTitle').textContent = bestPoint.type === 'CP' ? `CP: ${d.name}` : `Hallazgo: ${d.name}`;
        const rows = bestPoint.type === 'CP' ? [
            ['Coord', d.lat!==null ? `${d.lat.toFixed(5)}, ${d.lon.toFixed(5)}` : `X:${d.localX.toFixed(1)} Y:${d.localY.toFixed(1)}`],
            ['Prof.', `${d.depth} m`], ['Método', getMethodLabel(d)], ['Desc.', d.desc||'—']
        ] : [
            ['Coord', d.lat!==null ? `${d.lat.toFixed(5)}, ${d.lon.toFixed(5)}` : `X:${d.localX.toFixed(1)} Y:${d.localY.toFixed(1)}`],
            ['Prof.', `${d.depth} m`], ['Método', getMethodLabel(d)], ['Tipo', d.findType||'—'], ['Material', d.material||'—'], ['Desc.', d.desc||'—']
        ];
        const sp = d.surveyParams || {};
        if(d.refs && d.refs.length) rows.splice(3, 0, ['Desde', d.refs.join(', ')]);
        if(sp.legacySide) rows.push(['Lado', 'convención v3 (posición conservada)']);
        if(bestPoint.type === 'CP') rows.push(['Ajuste red', isFixed(d) ? 'fijo 📌' : 'libre']);
        document.getElementById('ppBody').innerHTML = rows.map(([k,v])=>`<div class="pp-row"><span class="pp-key">${k}</span><span>${escapeHtml(v)}</span></div>`).join('');
        const mapAreaRect = document.querySelector('.map-area').getBoundingClientRect();
        let px = e.clientX - mapAreaRect.left + 12;
        let py = e.clientY - mapAreaRect.top + 12;
        popup.style.display = 'block';
        if(px + 240 > mapAreaRect.width) px = e.clientX - mapAreaRect.left - 250;
        if(py + popup.offsetHeight > mapAreaRect.height) py = e.clientY - mapAreaRect.top - popup.offsetHeight - 8;
        popup.style.left = px + 'px'; popup.style.top = py + 'px';
        // P6: seleccionar punto para resaltar circunferencia
        _selectedPoint = bestPoint;
        draw();
    } else {
        popup.style.display = 'none';
        _selectedPoint = null;
        draw();
    }
});
