# Cómo aportar

¡Gracias por querer mejorar Jarvis! Es un proyecto chico, así que las reglas también lo son.

1. **¿Una duda?** Primero revisa la [FAQ](docs/faq.md). Si no está ahí, abre un issue.
   <!-- Cuando se active GitHub Discussions, cambiar la línea de arriba por:
   "Si no está ahí, pregunta en [Discussions](https://github.com/botellosantiago-bot/jarvis-ia/discussions)". -->
2. **Abre un issue primero** si es algo grande (un módulo nuevo, cambiar el esquema), para platicarlo antes de que inviertas horas.
3. **Haz un fork y una rama** con un nombre claro: `arreglo/recordatorios-dobles`, `idea/clima-en-el-resumen`.
4. **Antes del pull request**, que pase todo:

   ```bash
   npm run lint
   npm run typecheck
   npm run build
   npm test
   ```

5. **Cambios de base de datos:** agrega un archivo nuevo en `supabase/migrations/` (`0002_lo-que-hace.sql`). No edites `0001_jarvis.sql`: hay gente que ya lo corrió. Toda tabla nueva lleva RLS y su política "solo el dueño".
6. **Nada de llaves ni datos personales** en el código, los commits ni las capturas. Si ves una llave en un PR, avisa y no la copies.
7. **Escribe en español**, con mensajes de commit cortos que digan qué cambia y por qué. Si cambia algo visible, anótalo en [`CHANGELOG.md`](CHANGELOG.md).

¿Encontraste un hueco de seguridad? No abras un issue público: usa el reporte privado de GitHub (pestaña **Security → Report a vulnerability**). Detalle en [`SECURITY.md`](SECURITY.md).

## Documentación y plantillas

- Los ejemplos van con personas y proyectos **inventados y evidentes** ("Ana, clienta ficticia", "Proyecto Demo"). Nada de datos reales tuyos ni de nadie.
- Las plantillas van vacías: estructura y una línea de guía por campo.
- Si agregas un script, que sea chico, sin dependencias raras y con un modo `--prueba` que no toque nada.
- Diagramas en Mermaid.
