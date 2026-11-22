# Preguntas frecuentes y trampas de instalación

Las trampas de abajo salen del código y de la [guía de instalación](instalar-la-app.md). Cada una con lo que ves, por qué pasa y cómo se arregla. Si tu problema no está aquí, revisa también [Si algo falla](instalar-la-app.md#si-algo-falla).

## Índice

- [Inicio de sesión](#inicio-de-sesión)
- [Tiempos y funciones de Vercel](#tiempos-y-funciones-de-vercel)
- [Telegram](#telegram)
- [Cron y recordatorios](#cron-y-recordatorios)
- [Google Calendar](#google-calendar)
- [Variables de entorno](#variables-de-entorno)
- [Preguntas generales](#preguntas-generales)

---

## Inicio de sesión

### El enlace del correo abre `localhost` o te regresa al login sin decir nada

- **Síntoma:** pides el enlace mágico desde tu Jarvis publicado, lo abres y te manda a `http://localhost:3000`, o vuelves a `/login` como si nada.
- **Causa:** en Supabase, **Authentication → URL Configuration**, la *Site URL* sigue en `localhost` o tu dominio no está en *Redirect URLs*. El login pide volver a `/auth/callback` de tu dominio; si esa dirección no está permitida, Supabase usa la *Site URL*. Si además la *Site URL* es otro dominio, el código del enlace llega a un lugar donde no sirve.
- **Arreglo:** *Site URL* = `https://tu-jarvis.vercel.app` y en *Redirect URLs* agrega `https://tu-jarvis.vercel.app/**` y `http://localhost:3000/**` ([paso 6.5](instalar-la-app.md#6-publícalo-en-vercel-con-el-cron)). Si el código cae en la raíz de tu dominio, el proxy ya lo reenvía a `/auth/callback` (`lib/supabase/middleware.ts`).

### "No puedo entrar" con la contraseña correcta

- **Síntoma:** el login dice que las credenciales no valen.
- **Causa:** el usuario no está confirmado o la contraseña tiene menos de 8 caracteres.
- **Arreglo:** créalo en **Authentication → Users → Add user** con **Auto Confirm User** ([paso 2.4](instalar-la-app.md#2-supabase-la-base-de-datos)).

### El enlace mágico deja de llegar

- **Síntoma:** pides el enlace y no llega nada, o el login avisa del límite.
- **Causa:** el correo de serie de Supabase manda pocos correos por hora.
- **Arreglo:** entra con contraseña, que es lo de diario. En el hub, tarjeta **Contraseña → Definir o cambiar**.

### Cualquiera puede crearse una cuenta

- **Causa:** el registro sigue abierto en Supabase. La *anon key* viaja en el navegador, así que no basta con que el login no ofrezca registrarse.
- **Arreglo:** **Authentication → Sign In / Providers → Email** → apaga **Allow new users to sign up** ([paso 2.3](instalar-la-app.md#2-supabase-la-base-de-datos)).

---

## Tiempos y funciones de Vercel

### La barra de captura se queda pensando y luego falla

- **Síntoma:** escribes algo largo ("organízame la semana con…"), la barra gira un buen rato y regresa un error.
- **Causa:** `/api/capture` espera a que el agente termine. El agente puede encadenar hasta 8 vueltas de herramientas (`lib/agent/run.ts`), y la función tiene `maxDuration = 60` segundos (`app/api/capture/route.ts`). Si tu plan de Vercel permite menos tiempo, o el pedido necesita más, Vercel corta la función.
- **Arreglo:** revisa en Vercel → *Logs* si fue un corte por tiempo. Parte el pedido en dos. No subas `maxDuration` por encima de lo que permite tu plan.

### Telegram no contesta mensajes largos, o contesta dos veces

- **Síntoma:** el bot recibe tu mensaje (aparece "escribiendo…") pero no llega respuesta, o llega repetida.
- **Causa:** Telegram espera una respuesta rápida del webhook y reintenta si no la recibe. Por eso `app/api/telegram/webhook/route.ts` contesta `200` de inmediato y hace el trabajo después con `after()`. Ese trabajo sigue dentro del mismo límite de `maxDuration = 60`.
- **Arreglo:** si modificas el webhook, no esperes al agente antes de responder a Telegram: deja el trabajo dentro de `after()`. Para ver el último error que Telegram registró: `npx tsx scripts/telegram-webhook.ts`.

### El cron tarda o se corta

- **Causa:** `/api/cron/tick` también tiene `maxDuration = 60`. Manda los recordatorios pendientes y el resumen de la mañana en la misma pasada.
- **Arreglo:** revisa sus logs en Vercel → *Cron Jobs*. Ahí mismo lo puedes correr a mano.

---

## Telegram

### El bot no contesta nada

- **Síntoma:** le escribes y no pasa nada.
- **Causa:** el webhook no está registrado, apunta a otra URL, o `TELEGRAM_WEBHOOK_SECRET` no es el mismo en Vercel que el que usaste al registrar. Sin ese secreto, el webhook contesta `401` y descarta el mensaje.
- **Arreglo:** pon las tres variables de Telegram en Vercel, redespliega y vuelve a registrar: `npx tsx scripts/telegram-webhook.ts --set --url https://tu-jarvis.vercel.app` ([paso 7](instalar-la-app.md#7-el-bot-de-telegram)).

### Los botones no hacen nada

- **Causa:** el webhook se registró sin `callback_query`.
- **Arreglo:** vuelve a registrarlo con `--set`.

### "Por ahora solo leo texto"

No es un error: fotos, notas de voz y documentos todavía no se leen. Escríbelo.

---

## Cron y recordatorios

### Un recordatorio para hoy llega hasta mañana

- **Causa:** en el plan Hobby, el cron de [`vercel.json`](../vercel.json) corre una vez al día (13:00 UTC).
- **Arreglo:** el [paso 8](instalar-la-app.md#8-opcional-recordatorios-a-su-hora-exacta): que `pg_cron` de Supabase llame a `/api/cron/tick` cada 5 minutos.

### Con `pg_cron` los recordatorios siguen sin llegar

- **Causa:** el timeout por defecto de `pg_net` es de 5 segundos y se queda corto. Otra trampa: `pg_net` vive en el esquema `net`, no en `extensions`.
- **Arreglo:** usa `net.http_post(...)` con `timeout_milliseconds := 30000`, como en el paso 8.

### El resumen de la mañana llega a otra hora

- **Causa:** los horarios de Vercel van en UTC. `briefing_hour` (en `telegram_accounts`) va en tu hora local, y el cron tiene que correr a esa hora o después.
- **Arreglo:** ajusta `"schedule"` con la tabla del [paso 6](instalar-la-app.md#6-publícalo-en-vercel-con-el-cron).

---

## Google Calendar

### `redirect_uri_mismatch`

- **Causa:** la URI en Google Cloud no es idéntica a `NEXT_PUBLIC_APP_URL` + `/api/google/callback`.
- **Arreglo:** registra las dos URIs (local y Vercel), sin `/` extra al final, y revisa que `NEXT_PUBLIC_APP_URL` no termine en `/`.

### Cada semana pide "Reconectar"

- **Causa:** la app de Google sigue en modo de prueba; Google caduca el permiso cada 7 días.
- **Arreglo:** reconecta, o pulsa **Publicar app** en la pantalla de consentimiento.

### Lo que agendo en el celular no aparece en el hub

- **Causa:** Google no se sincroniza solo hacia Jarvis.
- **Arreglo:** pulsa **Sincronizar** en la tarjeta de Google. Lo que creas en Jarvis sí se escribe en Google al momento.

---

## Variables de entorno

### Cambié una variable en Vercel y no pasa nada

- **Causa:** Vercel aplica las variables en el siguiente despliegue. Las `NEXT_PUBLIC_*` además se escriben dentro del código del navegador al compilar.
- **Arreglo:** *Deployments → Redeploy* después de cambiar cualquier variable.

### "Falta la variable de entorno X"

- **Causa:** la variable no está en `.env.local` (en tu compu) o en Vercel.
- **Arreglo:** agrégala y reinicia `npm run dev` o redespliega. `.env.example` explica cada una.

### La barra de captura dice "Añade ANTHROPIC_API_KEY"

- **Causa:** sin esa llave el hub abre, pero el asistente queda apagado.
- **Arreglo:** pon `ANTHROPIC_API_KEY` y ponle un límite mensual en la consola de Anthropic.

---

## Preguntas generales

**¿Necesito la app para usar la forma de trabajar?** No. La documentación, las plantillas y los scripts funcionan solos con Claude Code.

**¿Funciona fuera de macOS?** Los documentos, las plantillas y los scripts de rutina piden Python 3, `bash` y `jq`. Lo único de macOS es la plantilla de `launchd` y lo que está en `scripts/mac/`; en Linux usa `cron` o `systemd`.

**¿Cuánto cuesta?** La repo es gratis (MIT). Supabase, Vercel, Google Cloud y Telegram tienen plan gratis. Claude se paga por uso.

**¿Puedo usar otro modelo?** Otro modelo de Claude, sí: `JARVIS_MODELO`. La app usa el SDK de Anthropic.
