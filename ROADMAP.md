# Hoja de ruta

Hacia dónde va esta repo abierta: la forma de trabajar y la app web + bot. Sin fechas: se avanza cuando se puede. Si quieres tomar algo, abre un issue para platicarlo antes.

## Ahora

- **Capturas que faltan:** la conversación en Telegram y el resumen de la mañana con sus botones (ver [`docs/capturas/LEEME.md`](docs/capturas/LEEME.md)).
- **Pulir la documentación** con lo que pregunte la gente que lo instala: cada trampa nueva va a la [FAQ](docs/faq.md).
- **CI en verde siempre:** lint, tipos, pruebas, build y los scripts de rutina en cada cambio.

## Después

- **Modo demo:** abrir la app con datos inventados y sin claves, para probarla antes de crear cuentas.
- **Más pruebas** del agente y de las rutas de la API.
- **Plantillas de rutinas para Linux** (`systemd` y `cron`), además de la de `launchd`.
- **Sincronizar Google Calendar solo**, sin tener que pulsar **Sincronizar**.
- **Telegram con notas de voz y fotos:** hoy sólo lee texto.

## Ideas

Cosas que estaría bien tener, sin compromiso:

- La documentación y la interfaz en inglés.
- Más de un chat de Telegram por cuenta.
- Otros calendarios además de Google.
- Más ejemplos inventados en `ejemplos/`, con otro tipo de proyecto.

## Lo que no va a entrar

- Claves, datos o proyectos reales de nadie.
- Piezas del Jarvis privado del autor que no están en esta repo. La galería del README las muestra como referencia, no como promesa.
