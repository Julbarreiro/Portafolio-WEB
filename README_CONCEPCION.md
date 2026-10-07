# Concepción y mantenimiento del portafolio

## Propósito

Este documento describe cómo está organizada la página, cómo se conecta con el
archivo de Google Sheets **“proyectos hoja de vida”** y dónde hacer cambios
habituales. La intención es servir como referencia antes de extender o
reemplazar cualquiera de esas piezas.

## Estructura del proyecto

- `index.html`: estructura de las vistas, formulario de contacto, visor
  multimedia, dependencias externas y referencias a los recursos estáticos.
- `css/style.css`: diseño adaptable, vistas, estados, transiciones y
  animaciones CSS.
- `js/main.js`: navegación, carrusel del perfil, carga y visualización de
  proyectos, lightbox y envío del formulario de contacto.
- `js/data.js`: URL del endpoint de Google Apps Script y clave de caché de
  proyectos.
- `js/cursor.js`: cursor personalizado y efectos animados con GSAP.
- `resources/`: fotografías, imágenes, audio, video y otros recursos locales.

La página es estática: no hay un servidor propio dentro de este repositorio.
El navegador carga los archivos y se comunica directamente con un endpoint
publicado de Google Apps Script.

## Proyectos y Google Sheets

El archivo de referencia es **“proyectos hoja de vida”**. Según la
configuración actual, la pestaña **“proyectos”** es la fuente de datos que
consume el portafolio. La otra pestaña, **“Contacto”**, recibe los registros
del formulario; no se utiliza para listar proyectos.

### Carga y actualización

1. Al iniciar, `js/main.js` intenta leer de `localStorage` la última lista
   guardada con la clave declarada en `js/data.js`.
2. Si existe, muestra los proyectos almacenados mientras consulta el endpoint.
   Si no existe, muestra un estado de carga.
3. `synchronize()` hace una petición `GET` al endpoint de Apps Script. Espera
   una respuesta JSON con `proyectos` (un arreglo) y `timestamp`; la respuesta
   también puede indicar un error mediante `success: false`.
4. Los registros se normalizan, se descartan los incompletos o marcados como
   eliminados y se agrupan por área. El resultado se guarda en caché y se
   vuelve a renderizar.
5. La consulta tiene un límite de 15 segundos. Se vuelve a intentar cada cinco
   minutos mientras la página está visible. Si falla, se conservan y muestran
   los proyectos en caché cuando están disponibles.

La interfaz espera estos campos en cada proyecto (también reconoce las
variantes en minúsculas/inglés que muestra la tabla):

| Campo en la hoja | Uso |
| --- | --- |
| `ID` | Identificador estable del proyecto. |
| `Proyecto` | Título mostrado en la lista y el visor. |
| `Área` | Categoría del acordeón. |
| `TipoProyecto` | Distintivo o tipo técnico del proyecto. |
| `Descripción` | Texto descriptivo. |
| `Multimedia` | Lista o texto separado por comas con nombres de recursos o enlaces. |
| `TipoMultimedia` | Tipo de contenido, si aplica. |
| `Presentación` | Presentación especial; `hero-image` activa el formato de imagen principal. |
| `deleted` o `deleted_at` | Marca para excluir un proyecto eliminado. |

Los registros multimedia pueden referirse a archivos locales en `resources/`,
enlaces externos o videos de YouTube. Si un recurso local cambia de nombre,
hay que actualizar también el valor en la hoja. La resolución y los tipos de
archivo admitidos se implementan en `resourceCandidates()` y
`renderProjectContent()` de `js/main.js`.

Para imágenes locales, en la columna `Multimedia` se puede indicar el nombre
con o sin extensión. Si se omite, el frontend prueba varias extensiones y
variantes del nombre hasta encontrar un archivo. Se recomienda escribir la
extensión real (por ejemplo, `res_10093_c_236.png`) para evitar solicitudes
fallidas de prueba y hacer explícito qué archivo debe cargarse. El nombre y la
extensión deben coincidir exactamente con el archivo publicado, incluidas las
mayúsculas y minúsculas; no se debe anteponer `resources/`.

### Dónde hacer cambios

- Cambiar el endpoint o la clave de caché: `js/data.js`.
- Cambiar los campos admitidos, su normalización o las reglas de exclusión:
  `normalizeProject()` e `isDeleted()` en `js/main.js`.
- Cambiar la agrupación, el orden o los controles de la lista:
  `renderCategories()` en `js/main.js`.
- Cambiar la galería, la presentación y los formatos multimedia:
  `renderProjectContent()` y `renderMedia()` en `js/main.js`; los estilos
  relacionados están en `css/style.css`.
- Cambiar el contenido de un proyecto: la pestaña **“proyectos”** de Google
  Sheets, no el HTML.

## Formulario de contacto

El botón **“Contactar”** abre el elemento `<dialog>` definido en `index.html`.
El formulario recoge nombre, correo y mensaje. El navegador valida los campos
obligatorios y el formato del correo; existe además un campo honeypot oculto
para descartar envíos automatizados sencillos.

Al enviar, `js/main.js` serializa los datos como JSON y hace una petición `POST`
al endpoint configurado en `js/data.js`. Durante el envío desactiva el botón y
muestra el estado correspondiente. Si la respuesta HTTP y el JSON confirman
`success: true`, reemplaza el formulario por un mensaje de agradecimiento; si
hay un error, lo muestra en el diálogo y lo registra en la consola.

El backend de Apps Script es quien escribe el registro en la pestaña
**“Contacto”** y notifica al correo de Univalle, según la configuración del
proyecto. Ese código y los destinatarios no están en este repositorio. Para
cambiar columnas, reglas de guardado o notificaciones, hay que actualizar y
volver a publicar el Apps Script además de comprobar que su respuesta siga
siendo compatible con el frontend.

### Dónde hacer cambios

- Etiquetas, campos, texto de éxito y estructura del diálogo: `index.html`.
- Validación, petición, estados y tratamiento de errores: el manejador
  `submit` del formulario en `js/main.js`.
- Apariencia del diálogo y sus estados: estilos `.contact-*` en
  `css/style.css`.
- Escritura en Sheets, destinatarios y envío de correo: proyecto externo de
  Google Apps Script vinculado a **“proyectos hoja de vida”**.

## Navegación, multimedia y animaciones

- La navegación entre menú, perfil y portafolio cambia las clases de estado
  (`active-view`). El fundido y la escala de las vistas son transiciones CSS.
- Las ondas de fondo, el anillo de la foto, el carrusel de herramientas, el
  indicador de carga, las barras de audio y varios estados visuales también
  están animados en `css/style.css`. Se desactiva el movimiento del carrusel
  cuando el sistema solicita movimiento reducido.
- El carrusel del perfil se crea en `js/main.js` con imágenes de `resources/`;
  su lista está en `profileImages`.
- El visor multimedia soporta galerías, lightbox con navegación, audio y
  videos de YouTube. La lógica vive en `js/main.js`; la estructura del diálogo
  multimedia está en `index.html`.
- GSAP se carga desde CDN en `index.html` y se usa en `js/cursor.js` para el
  cursor personalizado, el seguimiento del puntero y los efectos al hacer clic.
  No es la biblioteca que mueve el carrusel ni las transiciones principales.
  El cursor personalizado solo se activa con puntero preciso y hover; en
  dispositivos sin esas capacidades se conserva el cursor normal.

Al añadir una animación, primero identifica si corresponde a una transición
de interfaz (CSS) o a un efecto puntual del cursor (GSAP), y respeta
`prefers-reduced-motion`.

## Imágenes, rutas e icono

Las rutas locales del HTML se escriben relativas a `index.html`, por ejemplo
`resources/res_10020_c_235.jpg`. Los recursos referidos por los proyectos y el
carrusel se resuelven desde `resources/` en `js/main.js`. Evita anteponer
`../` cuando `resources/` está junto al archivo HTML: eso apunta fuera de la
carpeta publicada.

El favicon declarado en `index.html` es `resources/favicon.png`, una versión
reducida del logo original `resources/logo_julian.png`. Si se reemplaza el
logo, hay que volver a generar la versión pequeña y mantener actualizada la
ruta del favicon.

## Analítica y servicios externos

`index.html` incluye el contenedor de Google Tag Manager, y Google Analytics
está conectado a través de una etiqueta configurada en ese contenedor. No se
debe insertar además el fragmento de instalación directa de Analytics en
`index.html`, ya que podría duplicar mediciones. Los cambios de la etiqueta de
Analytics se administran en Google Tag Manager y deben publicarse allí.

También se cargan las fuentes desde Google Fonts y GSAP desde CDN. La
disponibilidad de esos servicios depende de la conexión y de sus políticas de
acceso; no son archivos locales del sitio.

## Lista rápida para futuras mejoras

1. Identificar si el cambio afecta el HTML, el CSS, el JavaScript del
   navegador, Google Sheets o el Apps Script.
2. Para cambios de datos, conservar los campos y el formato JSON que espera
   el frontend o actualizar ambas partes a la vez.
3. Para medios locales, confirmar que el archivo se encuentra en `resources/`
   y que el nombre y la extensión coinciden exactamente, incluidas las
   mayúsculas y minúsculas al publicar.
4. Probar el flujo completo afectado: carga inicial y caché para proyectos;
   envío y error para contacto; teclado, cierre y navegación para diálogos y
   lightbox.
5. Verificar la página desplegada además de la copia local: endpoint, Sheets,
   correo y servicios externos se ejecutan fuera del repositorio.
