---
name: donde-viven-las-claves
description: Las claves viven en archivos .env fuera de git; en memoria sólo la ruta, nunca el valor
type: referencia
---

Las claves de servicios externos viven en `~/.agente/*.env` con permisos 600. La memoria sólo guarda qué archivo tiene qué clave.

**Por qué:** la memoria la lee el modelo en cada sesión y puede terminar citada en un reporte o en un commit.
**Cómo aplicarlo:** si un script necesita una clave, la lee del archivo en tiempo de ejecución. Nunca se imprime, nunca se pega en el chat; si hace falta una clave nueva, el dueño la pega cuando la terminal la pide.
