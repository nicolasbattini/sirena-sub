// SIRENA Sub · estado global de la aplicación (se carga primero)
// Scripts clásicos (no módulos): comparten el ámbito global y funcionan también abriendo index.html con doble clic.

let cps = [], pts = [], showLines = true, geoOrigin = null;
let furData = {}, redMediciones = [];
const R_EARTH = 6371000;
let scaleVal = 200, offX = 0, offY = 0;
let isPanning = false, dragOrig = {x:0, y:0}, panStart = {x:0, y:0};
let _didDrag = false;
let _selectedPoint = null; // P6: punto con popup abierto
const canvas = document.getElementById('mapCanvas');
const ctx = canvas.getContext('2d');
const wrap = document.querySelector('.map-area');
const CP_COLORS = ['#e74c3c','#e67e22','#8e44ad','#16a085','#2980b9'];
const METHOD_COLORS = { offset:'#27ae60', ties:'#2980b9', radial:'#e67e22', trilat3d:'#8e44ad', acrux:'#c0392b', gps:'#2c3e50' };
const METHOD_LABELS = { gps:'GPS', radial:'Radial', offset:'Offset', ties:'Ties', trilat3d:'Trilateración 3D', acrux:'Ties B' };
