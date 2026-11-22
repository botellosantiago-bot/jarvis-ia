# Seguridad

## Cómo reportar un hueco

**No abras un issue público.** Usa el reporte privado de GitHub: pestaña **Security → Report a vulnerability** de esta repo. Sólo lo ve quien mantiene el proyecto.

Incluye, si puedes:

- Qué parte se ve afectada (archivo, ruta de la API, plantilla).
- Cómo reproducirlo, paso a paso.
- Qué podría hacer alguien con eso.

Nada de claves, tokens ni datos personales reales en el reporte, ni siquiera tuyos. Si encontraste una clave expuesta, dilo sin copiarla.

## Qué cubre

El código y las plantillas de esta repo. Tu despliegue (tu Supabase, tu Vercel, tus claves) es tuyo: si sospechas que se filtró una clave, rótala de inmediato en el panel donde la sacaste.

## Versiones

Sólo se corrige la versión más reciente de la rama `main`.
