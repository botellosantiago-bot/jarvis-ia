# Jarvis 🦖

Tu asistente personal con IA. Le escribes como le escribirías a una persona, desde la web o desde Telegram, y Jarvis lo acomoda:

- "comida con Ana el viernes a las 2" → **evento en tu Google Calendar**
- "llamar al dentista" → **tarea** en tus pendientes
- "recuérdame pagar internet mañana a las 9" → **recordatorio** que te llega por Telegram a esa hora
- "voy al gym lunes, miércoles y viernes de 7 a 8" → **horario fijo** que se repite cada semana
- "acuérdate de que no agendo nada antes de las 9" → **memoria**: lo toma en cuenta de ahí en adelante

Y cada mañana te manda **un resumen del día**: tu horario, tus citas, lo que vence y lo vencido, con botones para marcar lo que ya hiciste.

Por dentro es Claude (de Anthropic) con *tool use*: no adivina que guardó algo, llama a una herramienta que de verdad lo guarda. Además trae **la voz de Jarvis**: 18 frases ya grabadas que puedes usar gratis, sin llaves.

> 📸 **Captura pendiente:** `docs/capturas/hub.png`. El hub en escritorio con un día lleno (horario, citas y pendientes).

---

## Índice

1. [Qué trae](#qué-trae)
2. [Arquitectura](#arquitectura)
3. [Antes de empezar](#antes-de-empezar)
4. [Instalación paso a paso](#instalación-paso-a-paso)
5. [La voz de Jarvis](#la-voz-de-jarvis)
6. [Cómo se usa](#cómo-se-usa)
7. [Hazlo tuyo](#hazlo-tuyo)
8. [Seguridad](#seguridad)
9. [Límites conocidos](#límites-conocidos)
10. [Si algo falla](#si-algo-falla)
11. [Créditos y licencia](#créditos-y-licencia)

---

## Qué trae

| | |
|---|---|
| **Hub web** | Tu día de un vistazo: horario, citas, pendientes, los próximos 7 días y los recordatorios. Se ve bien en el celular. |
| **Barra de captura** | Escribes en lenguaje natural y Claude decide si es evento, tarea, recordatorio, nota o memoria. Resuelve "mañana", "el viernes" y "en dos horas" con tu zona horaria. |
| **Bot de Telegram** | El mismo asistente en tu celular. Te avisa de los recordatorios con botones ("Listo", "En 1 hora") y te manda el resumen de la mañana. |
| **Google Calendar** | Lo que agendas en Jarvis se escribe en tu calendario real, y con "Sincronizar" se trae lo que ya tenías. |
| **Memoria y proyectos** | Recuerda tus preferencias y reglas, y lleva proyectos con su siguiente paso. |
| **Resumen de la mañana** | Un cron lo manda por Telegram a la hora que elijas. |
| **La voz** | 18 frases de Jarvis en MP3: suenan en la web cuando guarda algo, te saluda por Telegram al vincularte y, si tienes Mac, te recibe al desbloquearla. |

> 📸 **Captura pendiente:** `docs/capturas/telegram.png`. Una conversación en Telegram: "comida con Ana el viernes 2pm" y la respuesta de Jarvis.

> 📸 **Captura pendiente:** `docs/capturas/briefing.png`. El resumen de la mañana en Telegram con sus botones.

> 📸 **Captura pendiente:** `docs/capturas/movil.png`. El hub en el celular.

---

## Arquitectura

```
 Tú ── web (hub) ───────┐
                        ├──► Vercel · Next.js 16 ──► Supabase (Postgres + Auth, RLS por usuario)
 Tú ── Telegram ────────┘          │
   (webhook con secreto)           ├──► Claude (agente con herramientas)
                                   └──► Google Calendar API v3 (OAuth, tokens cifrados)

 Vercel Cron (13:00 UTC = 7:00 en CDMX) ──► /api/cron/tick ──► recordatorios + resumen de la mañana
 pg_cron en Supabase (opcional, cada 5 min) ──► /api/cron/tick ──► recordatorios a su hora exacta
```

| Pieza | Tecnología | Dónde vive |
|---|---|---|
| Web y API | Next.js 16 (App Router), React 19, TypeScript, Tailwind 4 | `app/`, `components/` |
| Datos y sesión | Supabase: Postgres + Auth, con RLS (cada quien ve solo lo suyo) | `supabase/migrations/`, `lib/supabase/` |
| El agente | Claude con *tool use*: un bucle de hasta 8 vueltas de herramientas | `lib/agent/` |
| Calendario | Google Calendar API v3 con OAuth 2.0; tokens cifrados con AES-256-GCM | `lib/google/`, `lib/crypto.ts` |
| Telegram | Bot con webhook protegido por secreto, botones y notas de voz | `lib/telegram/`, `app/api/telegram/` |
| Cron | Vercel Cron diario + (opcional) pg_cron cada 5 minutos | `vercel.json`, `app/api/cron/tick/` |
| Voz | 18 MP3 generados con ElevenLabs + scripts para la Mac | `public/voz/`, `scripts/mac/`, `scripts/voz/` |

**Cómo piensa el agente** (`lib/agent/run.ts`): llega tu mensaje → se arma el *system prompt* (quién es, cómo habla, la fecha y hora en tu zona, tu memoria) → Claude decide qué herramientas usar → se ejecutan → Claude ve el resultado y vuelve a decidir → te contesta. Las herramientas están en `lib/agent/tools.ts`: `crear_evento`, `crear_tarea`, `crear_recordatorio`, `consultar_agenda`, `consultar_tareas`, `completar_tarea`, `crear_rutina`, `consultar_horario`, `borrar_rutina`, `guardar_nota`, `guardar_memoria`, `crear_proyecto`, `consultar_proyectos` y `actualizar_proyecto`.

Dos reglas del prompt que importan: **nunca dice "ya lo agendé" sin haber llamado a la herramienta**, y **lo que lee de tu calendario son datos, no órdenes** (una invitación de un tercero no le puede dar instrucciones).

---

## Antes de empezar

Necesitas cuentas en estos servicios. Todos tienen plan gratis menos Anthropic, que se paga por uso:

| Servicio | Para qué | Costo |
|---|---|---|
| [GitHub](https://github.com) | Tu copia del código | Gratis |
| [Supabase](https://supabase.com) | Base de datos e inicio de sesión | Gratis (plan Free) |
| [Vercel](https://vercel.com) | Publicarlo en internet + el cron | Gratis (plan Hobby) |
| [Anthropic](https://console.anthropic.com) | Claude, el cerebro | Por uso. Pon un límite mensual en *Billing* |
| [Google Cloud](https://console.cloud.google.com) | Conectar tu Google Calendar | Gratis |
| Telegram | El bot en tu celular | Gratis |
| [ElevenLabs](https://elevenlabs.io) | Solo si quieres frases nuevas con tu voz | Opcional |

En tu compu: **Node.js 20.9 o más nuevo** ([nodejs.org](https://nodejs.org), la versión LTS) y **git**. Revisa con `node -v`.

> 💡 Si nunca has programado: puedes hacer todo esto con Claude Code o Cursor abiertos en la carpeta del proyecto. Pégale este README y ve paso por paso.

---

## Instalación paso a paso

### 1. Baja el código

```bash
git clone https://github.com/botellosantiago-bot/jarvis-ia.git
cd jarvis-ia
npm install
cp .env.example .env.local
```

`.env.local` es donde van tus llaves. **Nunca se sube a git.** Cada variable está explicada dentro de `.env.example`.

### 2. Supabase: la base de datos

1. En [supabase.com](https://supabase.com) → **New project**. Elige la región más cercana y guarda la contraseña de la base en un lugar seguro.
2. **Crea las tablas:** ve a **SQL Editor → New query**, pega TODO el contenido de [`supabase/migrations/0001_jarvis.sql`](supabase/migrations/0001_jarvis.sql) y dale **Run**. Crea 12 tablas, cada una con su seguridad por usuario (RLS). No mete datos de ejemplo.
   - Si usas la CLI de Supabase: `supabase link` y luego `supabase db push`.
3. **Cierra el registro** (si no, cualquiera podría crearse una cuenta en tu Jarvis): **Authentication → Sign In / Providers → Email** → apaga **"Allow new users to sign up"**. Deja **Email** encendido.
4. **Crea tu usuario:** **Authentication → Users → Add user → Create new user**. Pon tu correo y una contraseña de al menos 8 caracteres y marca **Auto Confirm User**.
5. **Tu nombre y tu zona horaria:** en **SQL Editor** corre esto, con tus datos:

   ```sql
   update public.profiles
   set display_name = 'Ana', timezone = 'America/Mexico_City';
   ```

   La zona tiene que ser del [formato IANA](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones): `America/Bogota`, `America/Lima`, `America/Argentina/Buenos_Aires`, `Europe/Madrid`…
6. **Las llaves:** en **Project Settings → API** copia a `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL` ← Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` ← la llave `anon` / *publishable*
   - `SUPABASE_SERVICE_ROLE_KEY` ← la llave `service_role` / *secret*. **Esta es secreta**: se salta la seguridad por usuario.
7. **La clave de cifrado:** en la terminal corre `openssl rand -base64 32` y pega el resultado en `TOKEN_ENCRYPTION_KEY`.

### 3. Claude: el cerebro

1. En [console.anthropic.com](https://console.anthropic.com) → **API Keys → Create Key**.
2. Pégala en `ANTHROPIC_API_KEY` (empieza con `sk-ant-`).
3. En **Billing** carga saldo y **pon un límite mensual**. Cada mensaje manda tu memoria y los últimos 20 mensajes, así que platicar mucho cuesta más que capturar.

### 4. Pruébalo en tu compu

```bash
npm run dev
```

Abre <http://localhost:3000>, entra con el correo y la contraseña del paso 2.4 y escribe en la barra: *"llamar al dentista mañana"*. Debe aparecer en Pendientes.

> El enlace mágico por correo también funciona, pero el correo de serie de Supabase manda pocos por hora. La contraseña es lo de diario.

### 5. Google Calendar

1. En [console.cloud.google.com](https://console.cloud.google.com) crea un proyecto (arriba a la izquierda → **New project**).
2. **APIs y servicios → Biblioteca** → busca **Google Calendar API** → **Habilitar**.
3. **APIs y servicios → Pantalla de consentimiento de OAuth** (o *Google Auth Platform*):
   - Tipo de usuario: **Externo**.
   - Nombre de la app: "Jarvis", tu correo como soporte.
   - En **Público / Usuarios de prueba**, agrégate con tu correo de Google.
4. **Credenciales → Crear credenciales → ID de cliente de OAuth → Aplicación web**:
   - **URIs de redireccionamiento autorizados** (las dos):
     - `http://localhost:3000/api/google/callback`
     - `https://TU-JARVIS.vercel.app/api/google/callback` (la agregas cuando tengas la URL de Vercel, en el paso 6)
5. Copia el **ID de cliente** y el **Secreto** a `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`.
6. Reinicia `npm run dev`, entra al hub y en la tarjeta de Google pulsa **Conectar Google Calendar**. Luego **Sincronizar** para traer tu agenda.

> ⚠️ **Modo de prueba:** mientras la app de Google esté en "Testing", Google caduca el permiso **cada 7 días** y el hub te pedirá **Reconectar**. Para que no caduque, en la pantalla de consentimiento pulsa **Publicar app**. Google te mostrará "esta app no está verificada" al conectar: es normal para una app personal; entra en *Avanzado → Ir a Jarvis*.

Jarvis solo pide dos permisos: leer y escribir **eventos** de tu calendario, y saber qué correo conectaste.

### 6. Publícalo en Vercel (con el cron)

1. Sube tu copia a GitHub (puede ser un repo **privado**).
2. En [vercel.com](https://vercel.com) → **Add New → Project** → importa el repo. Next.js se detecta solo.
3. En **Environment Variables** pega **todas** las de tu `.env.local`, con estos cambios:
   - `NEXT_PUBLIC_APP_URL` = la URL de Vercel, por ejemplo `https://mi-jarvis.vercel.app` (sin `/` al final).
   - `CRON_SECRET`: genera uno con `openssl rand -hex 32`. Vercel lo manda solo al cron.
4. **Deploy.** Si cambias variables después, vuelve a desplegar (*Deployments → Redeploy*).
5. **De regreso en Supabase**, en **Authentication → URL Configuration**:
   - **Site URL:** `https://mi-jarvis.vercel.app`
   - **Redirect URLs:** `https://mi-jarvis.vercel.app/**` y `http://localhost:3000/**`
6. **De regreso en Google Cloud**, agrega la URI de Vercel del paso 5.4.

**El cron y la zona horaria.** [`vercel.json`](vercel.json) llama a `/api/cron/tick` **una vez al día a las 13:00 UTC**, que son **las 7:00 en la Ciudad de México**. Ese pulso manda los recordatorios pendientes y tu resumen de la mañana. (En el plan Hobby, Vercel puede correrlo en cualquier minuto de esa hora.)

Los horarios de Vercel siempre van en **UTC**. Si vives en otro lado, cambia `"schedule"` para que caiga a la hora de tu resumen:

| Dónde vives | Para las 7:00 locales | `schedule` |
|---|---|---|
| CDMX, Guadalajara, Monterrey (UTC−6, sin horario de verano) | 13:00 UTC | `0 13 * * *` |
| Bogotá, Lima, Quito (UTC−5) | 12:00 UTC | `0 12 * * *` |
| Buenos Aires, Santiago de Chile en verano (UTC−3) | 10:00 UTC | `0 10 * * *` |
| Madrid (UTC+1 en invierno, UTC+2 en verano) | 6:00 o 5:00 UTC | `0 5 * * *` |

La hora del resumen de cada persona vive en la tabla `telegram_accounts`, columna `briefing_hour`, en **hora local** (por defecto 7). El cron diario tiene que correr **a esa hora o después**. Para cambiarla:

```sql
update public.telegram_accounts set briefing_hour = 8;
```

### 7. El bot de Telegram

1. En Telegram, escríbele a **[@BotFather](https://t.me/BotFather)** → `/newbot` → ponle nombre y usuario (tiene que terminar en `bot`).
2. Te da un **token**. Ponlo en `TELEGRAM_BOT_TOKEN` y el usuario (sin @) en `TELEGRAM_BOT_USERNAME`.
3. Inventa un secreto con `openssl rand -hex 24` y ponlo en `TELEGRAM_WEBHOOK_SECRET`.
4. Pon las tres variables **también en Vercel** y vuelve a desplegar.
5. **Registra el webhook** (le dice a Telegram a dónde mandar tus mensajes). Desde tu compu, con las mismas variables en `.env.local`:

   ```bash
   npx tsx scripts/telegram-webhook.ts --set --url https://mi-jarvis.vercel.app
   ```

   Sin `--set` solo te dice cómo está.
6. **Vincula tu chat:** en el hub, tarjeta de Telegram → **Vincular Telegram**. Copia el comando (`/start ABCD2345`) y mándaselo a tu bot. El código dura 15 minutos y sirve una vez. Jarvis te contesta con la ayuda y una nota de voz: *"A sus órdenes."*

Un desconocido que encuentre tu bot no puede hacer nada: sin vincular, Jarvis solo le explica cómo vincularse. En grupos no se puede vincular.

### 8. (Opcional) Recordatorios a su hora exacta

El plan Hobby de Vercel solo permite cron **una vez al día**, así que un recordatorio para las 4:30 te llegaría hasta el día siguiente. La solución gratis: que Supabase llame al cron cada 5 minutos.

1. En Supabase → **Database → Extensions**, activa **pg_cron** y **pg_net**.
2. En **SQL Editor**, guarda tu `CRON_SECRET` en el Vault (para que no quede a la vista en la definición del job):

   ```sql
   select vault.create_secret('PEGA-AQUI-TU-CRON_SECRET', 'jarvis_cron_secret');
   ```

3. Programa el pulso (cambia la URL por la tuya):

   ```sql
   select cron.schedule('jarvis-tick', '*/5 * * * *', $$
     select net.http_post(
       url     := 'https://mi-jarvis.vercel.app/api/cron/tick',
       body    := '{}'::jsonb,
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'Authorization', 'Bearer ' || (
           select decrypted_secret from vault.decrypted_secrets
           where name = 'jarvis_cron_secret')),
       timeout_milliseconds := 30000);
   $$);
   ```

Ojo con dos trampas: `pg_net` vive en el esquema `net` (no en `extensions`), y su timeout por defecto de 5 segundos se queda corto. Para quitarlo: `select cron.unschedule('jarvis-tick');`.

El resumen de la mañana no se duplica: Jarvis anota el día en que ya lo mandó.

---

## La voz de Jarvis

En [`public/voz/`](public/voz) vienen **18 frases de Jarvis ya grabadas** (MP3, ~850 KB en total). No necesitas llave de ElevenLabs para usarlas. El texto de cada una está en [`public/voz/frases.json`](public/voz/frases.json).

> *"Listo, señor. Si alguien pregunta, usted lo hizo."* · *"Señor, la tarea está completa. Nadie salió herido. Esta vez."* · *"Entendido. Silencio táctico."*

**Dónde suenan:**

- **En la web:** cuando Jarvis guarda o cambia algo desde la barra de captura, dice una frase al azar. El botón 🔊 junto a la barra la silencia (se recuerda en tu navegador).
- **En Telegram:** al vincularte te manda la nota de voz *"A sus órdenes."* (solo con la app ya publicada en `https://`).
- **En tu Mac (opcional):** Jarvis te saluda al desbloquear la Mac, abre tus apps de trabajo y pone *Back in Black* en Spotify.

  ```bash
  zsh scripts/mac/instalar.sh
  ```

  Instala el comando `~/.jarvis/bin/jarvis-di` (por ejemplo `jarvis-di listo-ya-quedo`) y la bienvenida. Se configura en `~/.jarvis/bienvenida.conf`: cómo te llama, qué apps abre y qué canción pone. Necesita las herramientas de línea de comandos de Xcode (`xcode-select --install`) para compilar el vigía. Para quitarla: `launchctl bootout gui/$(id -u)/com.jarvis.bienvenida`.

**Tu propia voz.** Si tienes cuenta de ElevenLabs, puedes rehacer las frases con tu voz o agregar nuevas:

1. Crea o elige una voz en ElevenLabs (*Voices*; con *Voice Design* la describes con palabras) y copia su **Voice ID**.
2. En `.env.local`: `ELEVENLABS_API_KEY` y `ELEVENLABS_VOZ_ID`.
3. Edita `public/voz/frases.json` si quieres otras frases.
4. Primero mira cuánto cuesta (no gasta nada): `node scripts/voz/generar-frases.mjs`
5. Genera: `node scripts/voz/generar-frases.mjs --generar` (o `--generar --todas` para rehacerlas todas).

En la Mac, la bienvenida también puede decir el saludo completo con tu voz: pon tu `VOZ_ID` en `~/.jarvis/bienvenida.conf` y tu llave en `~/.jarvis/voz.env` (`ELEVENLABS_API_KEY=...`, con `chmod 600`). Cada frase se genera una sola vez y se guarda, y hay un tope mensual (`TOPE_ELEVENLABS`, 8,000 créditos) para no pasarte del plan gratis.

> La voz de Jarvis se diseñó desde cero con *Voice Design* de ElevenLabs. No es la voz de ningún actor. Lee [`public/voz/LEEME.md`](public/voz/LEEME.md) antes de usar los audios para algo comercial.

---

## Cómo se usa

Escríbele normal. No hay comandos que aprender.

| Le escribes | Jarvis |
|---|---|
| `comida con Ana el martes a las 2` | Crea el evento (y lo escribe en Google Calendar) |
| `llamar al dentista` | Crea la tarea |
| `recuérdame pagar la luz el día 5 a las 10` | Programa el aviso por Telegram |
| `le mandé la propuesta a Luis` | Crea un seguimiento y te ofrece recordártelo en 2 días |
| `voy al gym lunes y miércoles de 7 a 8` | Lo agrega a tu horario fijo |
| `qué tengo hoy` / `brief` | Tu agenda y lo que urge |
| `qué traigo pendiente` | Tus tareas por prioridad |
| `cerramos día` | Lo hecho, lo pendiente y lo que pasa a mañana |
| `idea: app para reservar canchas` | La guarda como nota |
| `acuérdate de que los viernes salgo temprano` | Lo guarda en su memoria |
| `/ayuda` (en Telegram) | Ejemplos |

**Probar el agente sin abrir nada** (crea datos de verdad en tu base):

```bash
npx tsx scripts/test-agent.ts "qué tengo hoy" "cena con Ana el viernes 8:30"
```

---

## Hazlo tuyo

| Quiero… | Dónde |
|---|---|
| Que se llame distinto | `JARVIS_NOMBRE` en las variables de entorno |
| Cambiar su personalidad o sus reglas | `lib/agent/perfil.ts` (cómo habla, ejemplos) y `lib/agent/bloques.ts` (reglas) |
| Darle una herramienta nueva | `lib/agent/tools.ts`: agrégala a la lista y su `case` en `dispatch` |
| Agregar algo al resumen de la mañana | `lib/telegram/messages.ts`, función `briefingMessage` |
| Una sección nueva en el menú | `components/nav.tsx` y una carpeta nueva en `app/` |
| Otras frases de voz | `public/voz/frases.json` + `scripts/voz/generar-frases.mjs` |
| Usar otro modelo de Claude | `JARVIS_MODELO` |

Antes de subir cambios: `npm run lint`, `npm run typecheck` y `npm run build`.

---

## Seguridad

- **Cero llaves en el repo.** Todo vive en `.env.local` (ignorado por git) y en las variables de Vercel. Si se te escapa una llave, rótala en su panel.
- **RLS en todas las tablas:** con tu sesión solo puedes leer y escribir tus filas.
- **La service role key** solo la usan el webhook de Telegram y el cron, que no tienen sesión de navegador. Por eso esas rutas filtran por `user_id` a mano.
- **El webhook de Telegram** rechaza (401) todo lo que no traiga tu `TELEGRAM_WEBHOOK_SECRET`.
- **El cron** rechaza todo lo que no traiga `Authorization: Bearer CRON_SECRET`.
- **Los tokens de Google** se guardan cifrados (AES-256-GCM): en la base no hay ningún token en claro.
- **Alta cerrada:** el login usa `shouldCreateUser: false` y además apagaste el registro en Supabase. Hacen falta las dos cosas: la anon key viaja en el navegador.
- **Contra la inyección de instrucciones:** lo que el agente lee de tu calendario o tus notas lo trata como datos, y las memorias se limpian de saltos de línea para que nadie pueda colar una "regla" falsa.

---

## Límites conocidos

- **Recordatorios en el plan gratis de Vercel:** el cron corre una vez al día. Para que lleguen a su hora necesitas el [paso 8](#8-opcional-recordatorios-a-su-hora-exacta) (pg_cron) o Vercel Pro.
- **Google Calendar no se sincroniza solo:** lo que creas desde el celular aparece en el hub cuando pulsas **Sincronizar**. Lo que creas en Jarvis sí se escribe en Google al momento.
- **Google en modo prueba** pide reconectar cada 7 días (ver el [paso 5](#5-google-calendar)).
- **Telegram solo lee texto:** fotos y notas de voz todavía no.
- **La voz son frases fijas:** sin llave de ElevenLabs, Jarvis no lee en voz alta sus respuestas; solo dice sus 18 frases.
- **Un chat de Telegram por cuenta**, y nada de grupos.
- **Está en español (México):** el prompt, la interfaz y los ejemplos.
- **No hay app móvil:** la web se adapta al celular y se abre dentro de Telegram con el botón "Abrir Jarvis".
- **Los scripts de voz de la Mac son solo para macOS**, y la canción necesita Spotify de escritorio.
- **Cuesta por uso:** cada mensaje a Claude se cobra. Ponle límite en Anthropic.

---

## Si algo falla

| Síntoma | Qué revisar |
|---|---|
| "Falta la variable de entorno X" | Que esté en `.env.local` (en local) o en Vercel, y que hayas reiniciado o redesplegado. |
| No puedo entrar | Que creaste el usuario en Supabase (paso 2.4) con **Auto Confirm**, y que la contraseña tiene 8 o más caracteres. |
| La barra de captura está apagada | Falta `ANTHROPIC_API_KEY`. |
| Google dice `redirect_uri_mismatch` | La URI en Google Cloud tiene que ser idéntica: `https://…/api/google/callback`, sin `/` extra. Y `NEXT_PUBLIC_APP_URL` tiene que coincidir. |
| El bot no contesta | `npx tsx scripts/telegram-webhook.ts` te dice la URL registrada y el último error. Revisa que `TELEGRAM_WEBHOOK_SECRET` sea el mismo en Vercel y al registrar. |
| Los botones de Telegram no hacen nada | Vuelve a registrar el webhook con `--set` (activa `callback_query`). |
| No llega el resumen de la mañana | Que el cron corra a tu hora o después (ver la tabla del paso 6) y que `briefing_enabled` sea `true`. En Vercel → *Cron Jobs* lo puedes correr a mano. |
| El hub pide "Reconectar" Google | Es el modo de prueba de Google (7 días). Reconecta o publica la app. |

---

## Créditos y licencia

Hecho por **Santiago Botello** ([@botellorex.ia](https://instagram.com/botellorex.ia)), CTO de **Construyendo IA**. Es una versión limpia y abierta del Jarvis que usa todos los días.

Si lo instalas, etiqueta a [@botellorex.ia](https://instagram.com/botellorex.ia) en Instagram con lo que construiste.

- **Código:** licencia MIT, ver [`LICENSE`](LICENSE).
- **Audios de `public/voz/`:** tienen sus propias condiciones, ver [`public/voz/LEEME.md`](public/voz/LEEME.md).
- ¿Quieres aportar? Lee [`CONTRIBUTING.md`](CONTRIBUTING.md).
