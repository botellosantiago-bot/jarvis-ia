# Cambios

Lo que cambia en cada versión. El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y las versiones, [SemVer](https://semver.org/lang/es/).

## [1.0.0]

La primera versión abierta: la forma de trabajar del agente y la app web + bot.

### La forma de trabajar

- Seis documentos en `docs/`: orquestación y reparto de modelos, cerebro y memoria, forma de operar, flujo de construcción, seguridad y rutinas, con diagramas en Mermaid.
- Plantillas en `plantillas/`: `CLAUDE.md` global, cuatro subagentes (`programador`, `obrero`, `mensajero`, `auditor`), el hook `solo-orquesta.sh`, el cerebro vacío, la memoria, el registro de seguridad, la lista "listo para publicar" y el `launchd` del latido.
- Ejemplos con datos inventados en `ejemplos/`: un cerebro lleno, hechos de memoria, un registro de auditoría y una sesión de trabajo de punta a punta.
- Scripts de rutina en `scripts/rutinas/`: `esperan-ok.py` y `latido.py`, sólo con la biblioteca estándar de Python y con modo `--prueba`.

### La app web + bot

- Hub web en Next.js 16 con Supabase (RLS por usuario): horario del día, citas, pendientes, próximos 7 días y recordatorios.
- Barra de captura en lenguaje natural con Claude y *tool use*: eventos, tareas, recordatorios, horario fijo, notas, memoria y proyectos.
- Bot de Telegram con webhook protegido por secreto, botones y resumen de la mañana.
- Google Calendar con OAuth y tokens cifrados con AES-256-GCM.
- Cron diario en Vercel y, opcional, `pg_cron` cada 5 minutos.
- 18 frases de voz en `public/voz/`.

### El proyecto

- Licencia MIT, `CONTRIBUTING.md` y `.env.example` sin valores.
- README con banner, galería, diagramas e inicio rápido.
- [FAQ con las trampas de instalación](docs/faq.md) y el tutorial [Tu primer día con Jarvis](docs/tu-primer-dia-con-jarvis.md).
- Capturas reales de la app con datos inventados en `docs/capturas/`.
- CI en GitHub Actions: lint, tipos, pruebas, build sin secretos y los scripts de rutina.
- Plantillas de issue y de pull request, `SECURITY.md` y `ROADMAP.md`.

[1.0.0]: https://github.com/botellosantiago-bot/jarvis-ia/releases/tag/v1.0.0
