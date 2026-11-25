# SIRENA Sub · Versión Campo

Aplicación web para relevamientos subacuáticos: ubica hallazgos y puntos de control (CP) a partir de
distancias y ángulos medidos bajo el agua, con un mapa de la planta del sitio, un ajuste de red de CPs,
exportación a CSV / KML / GeoJSON / JPG y la Ficha Única de Registro (ReNYCOA).

**Usar la app:** https://nicolasbattini.github.io/sirena-sub/

Autor original: Guillermo Gutiérrez (IDEAus-CONICET).

## Instalarla en una tablet o celular

1. Abrí el link de arriba con conexión a internet (Chrome en Android, Safari en iPhone/iPad).
2. Android: menú ⋮ → **Instalar app** (o *Agregar a la pantalla principal*).
   iPhone/iPad: botón Compartir → **Agregar a inicio**.
3. Abrila una vez desde el ícono. A partir de ahí funciona **sin conexión**.

Los datos se guardan solos en el navegador de cada dispositivo (no se suben a ningún servidor).

## Proyectos

- **📄 Nuevo**, **📂 Abrir**, **💾 Guardar** y **📑 Guardar como** trabajan con archivos de proyecto (`.sirena.json`)
  que contienen todo: puntos, mediciones de red, declinación y la FUR.
- En **Chrome o Edge de computadora**, *Guardar* escribe sobre el mismo archivo (atajos Ctrl+S / Ctrl+O).
- En **tablets, celulares, Firefox y Safari**, *Guardar* descarga el archivo a la carpeta de Descargas.
- El nombre del proyecto aparece arriba; un **●** naranja indica cambios que todavía no están en el archivo
  (aunque sí están a salvo en el navegador).
- Abre también los archivos "Respaldo JSON" de versiones anteriores.

Cuando se publica una versión nueva, la app lo avisa en la barra de estado: tocando el aviso se actualiza.

## Métodos de medición

| Método | Medidas en campo |
|---|---|
| GPS | Latitud y longitud (en superficie, sobre la boya del punto) |
| Radial | Distancia y rumbo desde un CP. Puede aplicar la declinación magnética y corregir el desnivel |
| Offset | Distancia sobre una cinta base A→B y distancia perpendicular |
| Ties | Distancias desde los dos extremos A y B de la base |
| Ties B | Dos distancias medidas desde dos posiciones sobre la cinta base |
| Trilateración 3D | Distancias desde 3 o más CPs (con profundidad del punto, o 4+ CPs a distintas profundidades) |

**Lado:** "Derecha" e "Izquierda" se refieren siempre a la posición mirando desde el CP A hacia el CP B.

## Estructura del código

```
index.html            estructura de la página
css/estilos.css       estilos
js/estado.js          variables globales (se carga primero)
js/geometria.js       cálculos de posición, trilateración, álgebra lineal (sin DOM)
js/mapa.js            dibujo del mapa, zoom, paneo, selección
js/datos.js           listas, guardado en el navegador, red de CPs, exportaciones, FUR
js/proyecto.js        archivos de proyecto: nuevo, abrir, guardar, guardar como
js/app.js             formularios por método, alta de puntos, inicio
js/instalacion.js     versión y registro del service worker
sw.js                 guarda la app para uso sin conexión
manifest.json         nombre e íconos de la app instalable
tests/                pruebas automáticas de los cálculos
```

Son scripts comunes (no módulos), así que la app también funciona abriendo `index.html` con doble clic,
sin servidor. En ese modo no se instala ni guarda copia sin conexión, pero todo lo demás funciona.

## Pruebas

```
node tests/geometria.test.js
```

GitHub las ejecuta automáticamente con cada cambio (pestaña **Actions**).

## Publicar una versión nueva

1. Hacé los cambios y corré las pruebas.
2. Subí el número de versión en **dos** lugares: `sw.js` (`VERSION`) y `js/instalacion.js` (`APP_VERSION`).
   Si no se cambia, los dispositivos que ya tienen la app instalada no reciben la actualización.
3. Subí los cambios a GitHub (`git commit` + `git push`). En uno o dos minutos queda publicada.
