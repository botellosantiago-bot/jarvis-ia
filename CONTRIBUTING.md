# Cómo aportar

¡Gracias por querer mejorar Jarvis! Es un proyecto chico, así que las reglas también lo son.

1. **Abre un issue primero** si es algo grande (un módulo nuevo, cambiar el esquema), para platicarlo antes de que inviertas horas.
2. **Haz un fork y una rama** con un nombre claro: `arreglo/recordatorios-dobles`, `idea/clima-en-el-resumen`.
3. **Antes del pull request**, que pase todo:

   ```bash
   npm run lint
   npm run typecheck
   npm run build
   npm test
   ```

4. **Cambios de base de datos:** agrega un archivo nuevo en `supabase/migrations/` (`0002_lo-que-hace.sql`). No edites `0001_jarvis.sql`: hay gente que ya lo corrió. Toda tabla nueva lleva RLS y su política "solo el dueño".
5. **Nada de llaves ni datos personales** en el código, los commits ni las capturas. Si ves una llave en un PR, avisa y no la copies.
6. **Escribe en español**, con mensajes de commit cortos que digan qué cambia y por qué.

¿Encontraste un hueco de seguridad? No abras un issue público: usa el reporte privado de GitHub (pestaña **Security → Report a vulnerability**).

## Documentación y plantillas

- Los ejemplos van con personas y proyectos **inventados y evidentes** ("Ana, clienta ficticia", "Proyecto Demo"). Nada de datos reales tuyos ni de nadie.
- Las plantillas van vacías: estructura y una línea de guía por campo.
- Si agregas un script, que sea chico, sin dependencias raras y con un modo `--prueba` que no toque nada.
- Diagramas en Mermaid.
