# Una sesión de trabajo, de punta a punta

Ejemplo inventado con el [cerebro de ejemplo](cerebro-demo/). Muestra cómo se reparten el trabajo el orquestador y los subagentes, y qué ve el dueño.

---

**Dueño:** Termina la página de precios del Proyecto Demo y déjala lista para publicar.

**Orquestador** (lee el último traspaso, "Esperan tu OK" y la memoria; 3 lecturas, lo hace directo):

> Retomo del traspaso del 5-mar. Precios está en `feat/precios` y contacto en `feat/contacto`; falta integrarlas y correr el auditor. Publicar y la migración 0002 esperan tu OK. Voy en 4 pasos.

> Paso 1/4: integro las dos ramas.

Son 3 comandos de git: los hace directo.

> Paso 2/4: el programador resuelve el conflicto en `app/layout.tsx` y deja lint y build en verde.

Encargo al `programador`:

> Meta: `integracion/marzo` con `feat/precios` y `feat/contacto` juntas, lint, typecheck y build en verde. Conflicto en `app/layout.tsx:18-30` (las dos agregan un enlace al menú; deben quedar los dos). No toques migraciones. Commit local sí, push no. Devuelve archivo:línea y qué corriste.

Vuelve:

> `app/layout.tsx:18-34` quedaron los dos enlaces. lint, typecheck y build en verde. Commit `e4f5a6b`. Sin comprobar: el menú en celular.

> Paso 3/4: lo veo en el navegador a 1440 y 390 px.

El orquestador abre la página, lee el texto (sin capturas) y toma **una** captura a 390 px porque ahí estaba el riesgo. El menú se ve completo.

> Paso 4/4: el auditor revisa la rama de integración.

Encargo al `auditor`: alcance `repo:.`, rama `integracion/marzo`, archivos tocados desde `main`.

Vuelve:

> Sin hallazgos altos hoy. Nuevo: AUD-003 (baja, largo del mensaje sin límite). No revisado: dependencias, falta el escáner.

**Orquestador → dueño:**

> **Listo para publicar: precios + contacto** (`integracion/marzo`, `e4f5a6b`)
> - Comprobado: lint, typecheck, build; visto a 1440 y 390 px; auditor sin altos.
> - Sin comprobar: el correo real del formulario; dependencias (falta el escáner).
> - Abierto: AUD-003 (baja). Lo arreglo antes o lo marcas como riesgo aceptado.
> - Para publicar necesito dos OK: el deploy y la migración 0002. Quedan en "Esperan tu OK".

Al cerrar, el orquestador escribe el traspaso y la entrada de la bitácora.

---

## Qué se nota

- El orquestador hizo directo lo chico (leer el traspaso, git) y delegó lo largo.
- Ningún subagente volcó archivos: devolvieron `archivo:línea` y qué corrieron.
- Hubo avisos de vida en cada paso.
- El reporte final separa lo comprobado de lo que no.
- Lo irreversible (deploy, migración) no se hizo: quedó pedido.
