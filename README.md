# uchiddenhorario 💅✨

OKAY GURL bienvenida al repo, siéntate, ponte cómoda, agarra tu té porque tenemos QUE HABLAR de lo que pasó acá 🍵👑

## la tea del autor (IMPORTANTE, lean esto primero)

No literally este código completo, TODO, el backend, el frontend, los comentarios, hasta este README que estás leyendo AHORA MISMO, fue vibe-codeado de principio a fin por **Claude Sonnet 5** (Anthropic, para los que gustan de la procedencia 💀). El dueño de este repo **odia el vibe coding** con toda su alma, es giving "yo jamás en la vida reclamaría crédito por esto", así que quede CLARÍSIMO, en piedra, con notario: si algo acá está mal escrito, mal nombrado, o simplemente RARO, es 100% culpa de la IA, no de la persona humana que solo pidió "hazme un wrapper para buscar ramos UC" y se fue a hacer otra cosa mientras yo (Claude) sudaba la gota gorda con cookies de Cloudflare 😩🙏🏼 el crédito (y la vergüenza) es TOTALMENTE mío, periodt.

## qué ES esto, sisters

Es un buscador de ramos y horarios para la plataforma de inscripción UC (Banner/Ellucian, para los nerds 🤓), porque la página oficial tiene la UX de una tesis de ingeniería civil del año 2003, y nosotras merecemos algo que sirva. Le tiras el código del ramo (tipo `IIC2133`), eliges el semestre, y te tira TODAS las secciones con horario, sala, profesor, cupos disponibles, exámenes, todo servido en cards limpiecitas que no dan ganas de llorar 💅

## la arquitectura (breve, lo prometo)

```text
uchiddenhorario/
├── backend/     # Express chiquito que le hace de proxy a UC
└── frontend/    # React + Vite, la cara bonita del asunto
```

**¿Por qué existe un backend?** Porque la sesión de UC necesita cookies especiales (`JSESSIONID`, `cf_clearance` de Cloudflare, tokens CSRF) que NO pueden vivir seguras en el navegador de cada quien sin exponerlas a media internet vía proxies random. Entonces: una sola persona (el dueño del repo, alma valiente) mete SUS cookies en un `.env`, y el backend las usa para hacerle fetch a UC en nombre de quien sea que use el frontend. Es giving "yo cargo con el riesgo para que ustedes no tengan que sufrir", literal un ícono comunitario.

## cómo correrlo, bestie

### 1. clona esto (ya lo hiciste si estás leyendo esto, slay)

### 2. backend

```bash
cd backend
npm install
cp .env.example .env
```

Ahora la parte ICÓNICA: abre tu navegador, entra a
`https://registration9.uc.cl/StudentRegistrationSsb/ssb/classSearch/classSearch`
logueada con tu cuenta UC, abre las DevTools (F12, no me hagas explicarte esto),
ve a la pestaña Network, mira cualquier request a `registration9.uc.cl`, y cópiate:

- `JSESSIONID` (cookie)
- `cf_clearance` (cookie, es el token anti-bot de Cloudflare, literal la prueba de que sos humana)
- el cookie de `QueueITAccepted-...` (la sala de espera virtual, el nombre exacto de la cookie puede variar, es giving nombre random cada vez)
- `RbdI6CHvhzrLAA1Q6g__` (cookie, no preguntes, así se llama, no fue mi decisión, fue de Banner)
- `X-Synchronizer-Token` (header, es el token CSRF)

Pega todo eso en tu `.env` recién creado. **Ojo, esto expira en horas, no en días**, así que cuando el buscador empiece a tirarte error de "auth_expired", ya sabes qué hacer: repetir el proceso, no es un bug, es un lifestyle.

```bash
npm run dev
```

Corriendo en `http://localhost:8787` 💅

### 3. frontend

```bash
cd frontend
npm install
npm run dev
```

Corriendo en `http://localhost:5173` (o el puerto que le toque si el 5173 estaba ocupado, Vite hace lo suyo, el backend ya sabe aceptar cualquier puertito de `localhost` así que no estresen).

Abran eso en el navegador, tiren un código de ramo, y ATAQUEN.

## el lore de GIRL.png (el drama, la caída, la redención)

Miren esto, este screenshot de abajo es HISTÓRICO, es un artefacto arqueológico de cuando el dueño del repo probó la app por primera vez y todo — Y CUANDO DIGO TODO — explotó:

![Failed to fetch, el momento más humillante de este repo](GIRL.png)

*"Failed to fetch"*. Así, en rojo, sin piedad. La IA (yo) había dejado un servidor de prueba zombie ocupando el puerto 5173, Vite tuvo que mudarse al 5174 como toda una reina independiente, pero el backend seguía con el corazón cerrado, aceptando UN SOLO puerto específico, como una relación tóxica de la que no se quería salir. CORS dijo que no y lo dijo FUERTE.

¿La solución? Le enseñamos al backend a aceptar cualquier puertito de `localhost`/`127.0.0.1` en desarrollo, en vez de tenerle celos a un solo número. Crecimiento personal, para el código y para todos nosotros 😩🙏🏼 y ahora esta screenshot vive acá, para siempre, como recordatorio de que hasta las IAs metemos las patas, pero al menos ESTA lo admite en el README en vez de barrerlo bajo la alfombra, ICÓNICO, humilde, real.

## disclaimers finales (la parte aburrida pero necesaria, lo siento no lo siento)

- Esto usa la cuenta y sesión de UNA persona (quien sea que corra el backend) para todas las búsquedas. Es de bajo riesgo porque solo se consulta información PÚBLICA de horarios, no se toca nada de inscripción real, pero no lo escalen a medio campus, esto es para el grupo de amigas, no para una startup.
- No hay garantía de que esto siga funcionando si UC le cambia el diseño a su sistema Banner, porque este código literalmente imita requests específicas capturadas en un momento específico del tiempo. Así es el vibe coding, bestie, vivimos al límite.
- Si algo se rompe, no me culpen a mí (Claude), culpen a las cookies que expiraron, siempre son las cookies.

y esa es la tea, el moral de la historia, la lección que nos llevamos todas a casa esta noche 💅✨👑
