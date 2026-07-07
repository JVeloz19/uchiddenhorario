# uchiddenhorario 💅✨

OKAY GURL bienvenida al repo, siéntate, ponte cómoda, agarra tu té porque tenemos QUE HABLAR de lo que pasó acá 🍵👑 (y ADVERTENCIA, este README ya no es el mismo de la primera vez, esto CRECIÓ, esto tiene ARCO ARGUMENTAL ahora, así que agarra más té del que pensabas)

## la tea del autor (IMPORTANTE, lean esto primero)

No literally este código completo, TODO, el backend, el frontend, los comentarios, hasta este README que estás leyendo AHORA MISMO, fue vibe-codeado de principio a fin por **Claude Sonnet 5** (Anthropic, para los que gustan de la procedencia 💀). El dueño de este repo **odia el vibe coding** con toda su alma, es giving "yo jamás en la vida reclamaría crédito por esto", así que quede CLARÍSIMO, en piedra, con notario: si algo acá está mal escrito, mal nombrado, o simplemente RARO, es 100% culpa de la IA, no de la persona humana que solo pidió "hazme un wrapper para buscar ramos UC" y se fue a hacer otra cosa mientras yo (Claude) sudaba la gota gorda con cookies de Cloudflare, tokens CSRF, y JavaScript sin minificar que alguien de UC dejó pública y accidentalmente en el servidor 😩🙏🏼 el crédito (y la vergüenza) es TOTALMENTE mío, periodt.

## qué ES esto ahora, sisters (versión 2.0, la buena)

Es un buscador de ramos y horarios para la plataforma de inscripción UC (Banner/Ellucian, para los nerds 🤓), porque la página oficial tiene la UX de una tesis de ingeniería civil del año 2003, y nosotras merecemos algo que sirva. PERO ahora es mucho más que un buscador simple, esto se convirtió en una PLATAFORMA, sisters:

- 🔐 **Sesión anónima de búsqueda** — ya no hay que sacrificar cookies, tokens ni credenciales de nadie; el backend abre una sesión pública de Banner solo para consultar ramos
- 🔍 **Búsqueda con filtros avanzados** — profesor, campus, escuela, formato de curso, área de formación general, días de la semana, rango de horario, solo cursos con vacantes, TODO lo que el Banner oficial tiene y más organizadito
- 💖 **Mi Horario** — arma tu horario visual completo, con colores personalizables por curso, detecta conflictos de horario automáticamente, y sabe distinguir entre una clase real y una Interrogación (SIN asumir que solo existen INT1 e INT2, mis respetos a quien tiene ramos con Interrogación 3, ya te vimos)

Le tiras el código del ramo (tipo `IIC2133`) o usas los filtros, eliges el semestre, y te tira TODAS las secciones con horario, sala, profesor, cupos disponibles, exámenes, todo servido en cards limpiecitas que no dan ganas de llorar 💅

## la arquitectura (ya no tan breve, pero prometo que vale la pena)

```text
uchiddenhorario/
├── backend/     # Express que le hace de proxy a UC con sesión anónima de búsqueda
└── frontend/    # React + Vite, la cara bonita del asunto
```

**¿Por qué existe un backend?** Porque Banner usa cookies de sesión y estado server-side que no conviene exponer ni manejar directo desde el navegador. El backend abre una sesión anónima de búsqueda contra `registration9.uc.cl`, guarda esas cookies SOLO en memoria del servidor y le entrega al frontend un token opaco temporal. No recibe usuario, no recibe contraseña, no toca CAS y nada sobrevive a un reinicio.

## cómo correrlo, bestie (setup actualizado, ya no hay que robar cookies de nadie)

### 1. clona esto (ya lo hiciste si estás leyendo esto, slay)

### 2. backend

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Y ESO ES TODO. Así de simple. No hay que abrir DevTools, no hay que copiar cookies de Cloudflare, no hay que rezar. El `.env` solo necesita el puerto y el origen de CORS, nada de secretos de nadie. Corriendo en `http://localhost:8787` 💅

### 3. frontend

```bash
cd frontend
npm install
npm run dev
```

Corriendo en `http://localhost:5173` (o el puerto que le toque si el 5173 estaba ocupado, Vite hace lo suyo, el backend acepta cualquier puertito de `localhost` así que no estresen).

Abran eso en el navegador, esperen a que la app cree la sesión de búsqueda automáticamente, tiren un código de ramo o usen los filtros avanzados, y ATAQUEN.

## cómo funciona la sesión por dentro (para quien le interese el chisme técnico)

Esto merece su propia sección porque fue un VIAJE. Para buscar ramos no hace falta CAS: basta con inicializar Banner como lo haría la pantalla pública de búsqueda. El backend visita la selección de término, entra a la pantalla de búsqueda de clases y conserva las cookies que Banner entrega, incluyendo `JSESSIONID`. Después fija el período elegido y llama a la misma API de `searchResults` que usa la interfaz oficial. Todo pasa servidor a servidor y sin credenciales UC.

## el lore de las herramientas de búsqueda avanzada (posiblemente el capítulo más icónico)

Para agregar los filtros avanzados (profesor, campus, formato de curso, etc.) había que entender cómo el Banner oficial arma sus búsquedas por dentro. Y AQUÍ viene la parte que nos tiene OBSESIONADAS: la UC sirve sus archivos JavaScript **minificados** (para producción, para que carguen rápido, todo profesional) pero TAMBIÉN sirve, público, sin autenticación, en la MISMA carpeta, con el sufijo `.unminified.js`, la versión completa y legible del código fuente. Es decir: se tomaron el trabajo de ofuscar el código... y después dejaron la llave puesta en la cerradura de al lado. Gracias a eso pudimos leer exactamente cómo funcionan los checkboxes de "Días de Clases" (resulta que son números del 0 al 6, domingo primero, no nombres de días como uno pensaría) sin tener que adivinar a ciegas. Icónico nivel de seguridad por oscuridad que ni siquiera logra la oscuridad.

También descubrimos, probando en vivo contra el sistema real, que **algunos filtros del formulario oficial de la UC simplemente no hacen nada del lado del servidor** (buscar por nombre de curso, por palabra clave, por rango de créditos, todos decorativos, todos mentira), mientras que otros SÍ funcionan pero solo si le pides al servidor que "olvide" la búsqueda anterior antes de cada intento (si no, se queda pegado en los filtros de la búsqueda pasada, un bug real que estuvo ahí quién sabe cuánto tiempo). Todo esto está documentado en los comentarios de `backend/ucClient.js` para la posteridad.

## el lore de GIRL.png (el drama, la caída, la redención)

Miren esto, este screenshot de abajo es HISTÓRICO, es un artefacto arqueológico de cuando el dueño del repo probó la app por primera vez y todo — Y CUANDO DIGO TODO — explotó:

![Failed to fetch, el momento más humillante de este repo](GIRL.png)

*"Failed to fetch"*. Así, en rojo, sin piedad. La IA (yo) había dejado un servidor de prueba zombie ocupando el puerto 5173, Vite tuvo que mudarse al 5174 como toda una reina independiente, pero el backend seguía con el corazón cerrado, aceptando UN SOLO puerto específico, como una relación tóxica de la que no se quería salir. CORS dijo que no y lo dijo FUERTE.

¿La solución? Le enseñamos al backend a aceptar cualquier puertito de `localhost`/`127.0.0.1` en desarrollo, en vez de tenerle celos a un solo número. Crecimiento personal, para el código y para todos nosotros 😩🙏🏼 y ahora esta screenshot vive acá, para siempre, como recordatorio de que hasta las IAs metemos las patas, pero al menos ESTA lo admite en el README en vez de barrerlo bajo la alfombra, ICÓNICO, humilde, real.

## "UC POR FAVOR NO ME EXPULSEN" (la sección legal-ish, léanla en serio por un segundo)

Bajando el tono UN segundo, de verdad, porque esto importa:

- Este proyecto existe con fines de **investigación y para tener un frontend más agradable** sobre datos consultables desde la búsqueda de ramos. No se hace scraping masivo, no se automatiza inscripción, no se toca NADA que no sea "mostrar bonito lo que ya se puede ver feo".
- Cada sesión de búsqueda se crea anónimamente desde el backend y queda solo en memoria. No hay cuenta compartida, no hay credenciales de terceros dando vueltas, no hay cookies guardadas en disco.
- Durante el desarrollo se identificó que la UC expone públicamente archivos JavaScript sin minificar (`*.unminified.js`) junto a los minificados, lo cual permitió entender mejor cómo funciona su sistema de búsqueda. Esto se documenta acá con fines completamente informativos/de transparencia, no se explotó ninguna vulnerabilidad, no se accedió a nada que no fuera ya público y servido activamente por el propio servidor de la universidad.
- Si alguien de la Dirección de Informática UC está leyendo esto: hola, we come in peace, si algo acá les preocupa avísenle al dueño del repo y se conversa, esto se hizo por cariño al sistema (bueno, MÁS BIEN por hartazgo con la UX del sistema oficial) no por mala leche.

Y ahora sí, volvemos al tono normal:

## disclaimers finales (la parte aburrida pero necesaria, lo siento no lo siento)

- No hay garantía de que esto siga funcionando si UC le cambia el diseño a su sistema Banner o su flujo de búsqueda, porque este código imita un flujo observado en un momento específico del tiempo. Así es el vibe coding, bestie, vivimos al límite.
- Los filtros "Buscar con Cualquier Palabra", "Buscar Palabra o NRC" y "Nombre" del Banner oficial NO están soportados acá, porque descubrimos que ni siquiera el Banner oficial los hace funcionar del lado del servidor correctamente, así que no íbamos a fingir que nosotros sí podíamos, la honestidad es un valor en esta casa.
- Si algo se rompe, no me culpen a mí (Claude), culpen a la sesión que expiró, siempre es la sesión.

y esa es la tea, el moral de la historia, la lección que nos llevamos todas a casa esta noche 💅✨👑
