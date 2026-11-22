# 2. Cerebro local y memoria

Un agente sin memoria empieza de cero cada sesión y te hace repetir lo mismo. La solución no es una base de datos sofisticada: son **notas en Markdown en tu disco**, con una estructura fija que el agente sabe leer y mantener. Se abren en Obsidian, en VS Code o en GitHub.

Hay dos piezas distintas:

| | Cerebro | Memoria |
|---|---|---|
| Qué guarda | El estado del trabajo: proyectos, personas, decisiones, traspasos | Cómo trabajar contigo: preferencias, correcciones, reglas aprendidas |
| Dónde vive | Una carpeta `cerebro/` dentro del repo | La carpeta de memoria del agente (en Claude Code, por proyecto) |
| Quién la lee | Tú y el agente | El agente, al empezar cada sesión |
| Cambia | Todos los días | Cuando aprendes algo que vale para siempre |

## El cerebro

```
cerebro/
├── 00 INICIO.md              la portada: qué es, dónde vas, accesos rápidos
├── Esperan tu OK.md          lista ÚNICA de decisiones detenidas
├── Bitácora.md               una entrada por sesión, la más nueva arriba
├── Decisiones.md             los porqués: qué se decidió, cuándo y por qué
├── Traspasos/
│   └── Traspaso AAAA-MM-DD.md   el punto de retome al cerrar el día
└── Mundo/
    ├── 00 Mapa del mundo.md  tabla de proyectos y personas
    ├── <Persona>.md          una ficha por persona
    └── <Proyecto>.md         una ficha por proyecto
```

Plantillas vacías en [`plantillas/cerebro/`](../plantillas/cerebro/). Un cerebro lleno, con datos inventados, en [`ejemplos/cerebro-demo/`](../ejemplos/cerebro-demo/).

### El mundo: fichas de personas y proyectos

Lo que hace útil a un asistente no es que sepa cosas, sino que sepa **tus** cosas: quién es quién, qué proyecto va con quién y qué reglas tiene cada uno.

- **Ficha de persona:** quién es, qué relación tiene contigo, en qué proyectos aparece, cómo prefiere que le hablen y qué no se le manda. **Sin teléfonos ni correos**: los datos de contacto viven en el sistema de cada proyecto, no en el cerebro.
- **Ficha de proyecto:** qué es, estado, prioridad, dónde vive su código, sus reglas propias y el siguiente paso.
- **Mapa del mundo:** una tabla con todas las fichas. Es lo primero que lee el agente cuando no sabe de qué le hablas.

Regla de oro: **los datos de cada proyecto se quedan en su carpeta**. El cerebro tiene el mapa, no la copia.

### Traspaso de sesión

Al cerrar el día (o antes de limpiar el contexto de una sesión larga), el agente escribe un traspaso. Es lo primero que se lee al día siguiente. Tres secciones, nada más:

- **Hecho:** qué quedó, con rutas y commits.
- **Pendiente:** qué falta y qué lo detiene.
- **No tocar sin OK:** lo que está en pausa por decisión tuya.

Un traspaso bueno se lee en dos minutos. Si pasa de una pantalla, lo viejo se mueve a la bitácora.

### "Esperan tu OK": una sola lista

Las decisiones detenidas se pierden si viven regadas en traspasos, chats y notas. Por eso hay **una lista única**:

```markdown
## Proyecto Demo
- [ ] Publicar la página de precios (desde 3-mar)
- [x] Elegir dominio (desde 1-mar) — elegido el 4-mar
```

- El agente agrega lo nuevo y marca `[x]` lo resuelto, con la fecha y cómo se resolvió.
- Cada casilla dice **desde cuándo** espera. Lo viejo se nota solo.
- La ronda de la mañana lee las casillas sin marcar y te las recuerda ([ver rutinas](06-rutinas.md)). El script [`scripts/rutinas/esperan-ok.py`](../scripts/rutinas/esperan-ok.py) hace exactamente eso.

### Bitácora y decisiones

- **Bitácora:** una entrada corta por sesión. Fecha, qué se hizo, qué se probó, qué quedó. La más nueva arriba.
- **Decisiones:** cada decisión con su porqué. Cuando dentro de tres meses alguien pregunte "¿por qué no usamos X?", la respuesta está ahí.

## La memoria

La memoria guarda **cómo trabajar contigo**, no el estado del trabajo. Reglas:

1. **Un hecho por archivo.** Corto, con nombre que diga de qué trata (`no-prometer-tiempos.md`, no `nota-3.md`).
2. **Cada hecho dice por qué y cómo se aplica.** Una regla sin su porqué se aplica mal en el caso que no se previó.
3. **Un índice** (`MEMORY.md`) con una línea por archivo. El agente lee el índice siempre y abre el archivo sólo cuando le toca.
4. **Se corrige, no se acumula.** Si un hecho cambió, se edita el archivo; no se agrega otro que lo contradiga.
5. **Nada secreto.** Ni claves, ni contraseñas, ni datos de terceros. Si hace falta saber dónde vive una clave, se anota la ruta, nunca el valor.

Formato de un hecho:

```markdown
---
name: no-prometer-tiempos
description: No dar horas de entrega que no controlo; avisar riesgos antes
type: feedback
---

No prometer "tarda 40 minutos". Decir un rango honesto o que no sé, y cuál es el riesgo.

**Por qué:** una vez prometí una tanda completa para la mañana y amaneció a medias; se enteró hasta que preguntó.
**Cómo aplicarlo:** antes de un trabajo largo, decir qué puede fallar (sueño de la compu, límite de uso). Reportar el estado real sin esperar a que pregunte.
```

Plantillas en [`plantillas/memoria/`](../plantillas/memoria/) y una memoria de ejemplo en [`ejemplos/memoria-demo/`](../ejemplos/memoria-demo/).

### Qué va a la memoria y qué no

| Sí | No |
|---|---|
| "Prefiere reportes de 5 líneas" | "Hoy terminamos el login" (eso es bitácora) |
| "Nunca publicar sin su OK" | La clave de una API |
| "Los guiones van en tabla" | El teléfono de un cliente |
| "Se equivocó X una vez; ahora se revisa así" | Una lista de pendientes (eso es "Esperan tu OK") |

## Mantenimiento

Cada tanto (una vez por semana basta), pídele al agente una pasada de limpieza:

- Juntar hechos duplicados de la memoria.
- Mover traspasos viejos a la bitácora.
- Marcar en "Esperan tu OK" lo que ya no aplica, bajo una sección "Por confirmar si sigue vigente".
