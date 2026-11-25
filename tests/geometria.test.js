// Pruebas de los cálculos de posición. Ejecutar con:  node tests/geometria.test.js
// No necesitan navegador ni instalar nada: cargan js/geometria.js tal cual lo usa la app.
const fs = require('fs'), path = require('path'), vm = require('vm');

const ctx = { console, Math, Number, Set, Array, JSON, String };
vm.createContext(ctx);
// Estado mínimo que en la app aportan estado.js y datos.js
vm.runInContext(`
    const R_EARTH = 6371000;
    let geoOrigin = null, cps = [];
    function findCp(n) { return cps.find(c => c.name === n); }
`, ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'geometria.js'), 'utf8'), ctx);
const run = (code) => vm.runInContext(code, ctx);

let fallas = 0, total = 0;
function cerca(nombre, obtenido, esperado, tol = 1e-3) {
    total++;
    const ok = Object.keys(esperado).every(k => Math.abs(obtenido[k] - esperado[k]) <= tol);
    if(!ok) fallas++;
    console.log(`${ok ? '✔' : '✘'} ${nombre}` + (ok ? '' : `\n   esperado ${JSON.stringify(esperado)}\n   obtenido ${JSON.stringify(obtenido)}`));
}
function verdadero(nombre, cond) { total++; if(!cond) fallas++; console.log(`${cond ? '✔' : '✘'} ${nombre}`); }

// CPs de prueba: base A→B hacia el norte, C al este de A
run(`cps = [
    {name:'A', localX:0,  localY:0,  depth:5},
    {name:'B', localX:0,  localY:20, depth:5},
    {name:'C', localX:20, localY:0,  depth:6},
]`);
const calc = (m, p) => run(`computeLocal(${JSON.stringify(m)}, ${JSON.stringify(p)})`);

cerca('Offset, derecha mirando de A a B', calc('offset', {segmento:'A|B', along:10, perp:3, lado:1}).local, {x:3, y:10});
cerca('Offset, izquierda', calc('offset', {segmento:'A|B', along:10, perp:3, lado:-1}).local, {x:-3, y:10});
cerca('Offset de v3 conserva su posición (legacySide)', calc('offset', {segmento:'A|B', along:10, perp:3, lado:1, legacySide:true}).local, {x:-3, y:10});
cerca('Ties, derecha', calc('ties', {segmento:'A|B', distA:Math.hypot(4,6), distB:Math.hypot(4,14), lado:1}).local, {x:4, y:6});
cerca('Ties, izquierda', calc('ties', {segmento:'A|B', distA:Math.hypot(4,6), distB:Math.hypot(4,14), lado:-1}).local, {x:-4, y:6});
cerca('Ties B, derecha sobre base A→C (sur)', calc('acrux', {segmento:'A|C', along1:0, dist1:5, along2:8, dist2:5, lado:1}).local, {x:4, y:-3});
cerca('Radial, rumbo 90° (este)', calc('radial', {centro:'A', dist:10, bearing:90}).local, {x:10, y:0});
cerca('Radial magnético con declinación −10°', calc('radial', {centro:'A', dist:10, bearing:10, magnetico:true, declinacion:-10}).local, {x:0, y:10});
cerca('Radial con corrección de desnivel (inclinada 10 m, Δz 6 m → horizontal 8 m)', calc('radial', {centro:'A', dist:10, bearing:0, depth:11, corregirDesnivel:true}).local, {x:0, y:8});

const objetivo = [4, 7, 8];
const dist = (c) => Math.hypot(objetivo[0]-c[0], objetivo[1]-c[1], objetivo[2]-c[2]);
const t3 = calc('trilat3d', {distancias:[{cp:'A',dist:dist([0,0,5])},{cp:'B',dist:dist([0,20,5])},{cp:'C',dist:dist([20,0,6])}], depth:8});
cerca('Trilateración con profundidad conocida', {x:t3.local.x, y:t3.local.y, z:t3.depth}, {x:4, y:7, z:8});
verdadero('Trilateración con 3 CPs sin profundidad pide el dato',
    !!calc('trilat3d', {distancias:[{cp:'A',dist:5},{cp:'B',dist:15},{cp:'C',dist:16}], depth:null}).error);
run(`cps.push({name:'D', localX:20, localY:20, depth:12})`);
const t4 = calc('trilat3d', {distancias:[['A',[0,0,5]],['B',[0,20,5]],['C',[20,0,6]],['D',[20,20,12]]].map(([n,c])=>({cp:n, dist:dist(c)})), depth:null});
cerca('Trilateración 3D con 4 CPs calcula la profundidad', {x:t4.local.x, y:t4.local.y, z:t4.depth}, {x:4, y:7, z:8}, 1e-2);

verdadero('Segmento con el mismo CP en A y B da error', !!calc('offset', {segmento:'A|A', along:1, perp:1, lado:1}).error);
verdadero('Distancias que no se cruzan dan error', !!calc('ties', {segmento:'A|B', distA:2, distB:2, lado:1}).error);

run(`geoOrigin = {lat:-42.5, lon:-64.3}`);
const ida = run(`local2geo(123.4, -56.7)`), vuelta = run(`geo2local(${ida.lat}, ${ida.lon})`);
cerca('Conversión local ↔ lat/lon ida y vuelta', vuelta, {x:123.4, y:-56.7}, 1e-6);

console.log(`\n${total - fallas}/${total} pruebas correctas`);
process.exit(fallas ? 1 : 0);
