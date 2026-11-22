# 5. Seguridad: el auditor defensivo

El agente que construye no debería ser el mismo que revisa. Por eso hay un tercer rol: un **auditor de seguridad defensivo** que busca huecos antes de que alguien más los encuentre, propone el parche y lleva el registro.

Definición lista para copiar: [`plantillas/claude/agents/auditor.md`](../plantillas/claude/agents/auditor.md).

## Reglas del auditor

1. **Alcance escrito.** Sólo prueba lo que está en `security/scope.txt`. Lo que no está, no se toca. Plantilla: [`plantillas/seguridad/scope.txt`](../plantillas/seguridad/scope.txt).
2. **Pruebas dinámicas sólo contra local o staging.** Nunca contra producción ni datos reales. Si no puede confirmar que un entorno es de prueba, lo trata como producción.
3. **Sólo lectura por defecto.** Propone los arreglos como diff; los aplica con tu aprobación. Sólo escribe libremente en su propio registro.
4. **Herramientas estándar** (escáneres de secretos, de dependencias, de patrones). Nada de exploits ni código ofensivo propio.
5. **Secretos enmascarados** en todo lo que escribe. Nunca hace `cat` de un `.env` real.
6. **Todo queda registrado** en `SECURITY_AUDIT.md`.

## Hallazgos con ID, severidad y estado

Cada hallazgo es una fila con ID estable. Así se puede hablar de "el AUD-007" durante semanas sin confundirse.

| ID | Módulo | Archivo:línea | Severidad | Descripción | Arreglo propuesto | Estado |
|---|---|---|---|---|---|---|
| AUD-001 | authz | `app/api/ejemplo/route.ts:12` | media | [confirmado] Cualquier sesión puede leer… | Filtrar por dueño | corregido (3-mar) |

- **Severidad:** el impacto *si* la falla es real (alta, media, baja).
- **Certeza:** va en la descripción, no en la severidad: `[confirmado]`, `[probable]`, `[no verificado]`.
- **Estado:** `abierto` → `corregido` (se aplicó el parche) → `verificado` (se volvió a revisar y ya no está). O `riesgo aceptado`.

"Corregido" y "verificado" no son lo mismo. El auditor no marca verificado algo que no volvió a revisar.

Plantilla del registro: [`plantillas/seguridad/SECURITY_AUDIT.md`](../plantillas/seguridad/SECURITY_AUDIT.md). Un registro de ejemplo con hallazgos inventados: [`ejemplos/auditoria-demo/SECURITY_AUDIT.md`](../ejemplos/auditoria-demo/SECURITY_AUDIT.md).

## Riesgo aceptado, con bitácora

A veces un hallazgo es real pero arreglarlo no vale la pena hoy. Eso está bien si queda escrito:

```markdown
### AUD-004 · riesgo aceptado
- Fecha: 5-mar
- Quién decidió: el dueño
- Por qué: la ruta de depuración sólo existe en el entorno local y nunca se despliega
- Se revisa de nuevo: si la ruta llega a desplegarse, o el 5-jun
```

El riesgo aceptado no desaparece: se sale del conteo de abiertos pero sigue en el registro, con fecha para revisarlo.

## Al teléfono y a la nube: evento y conteo, nunca detalle

Si tu agente manda avisos a una app, a Telegram o a cualquier servicio en la nube, la regla es:

| Se manda | No se manda |
|---|---|
| "Auditoría terminada" | La descripción del hueco |
| "3 hallazgos abiertos, 1 alto" | El archivo y la línea |
| La fecha | Cómo se explota |

El detalle vive en tu compu, en el repo. Si alguien ve tu teléfono o se filtra el canal de avisos, no se lleva un mapa para atacarte.

## Nunca decir "seguro"

No encontrar una falla no prueba que no exista. El auditor (y el orquestador al reportarlo) dice:

- Sí: "Sin hallazgos hoy en los archivos revisados: `lib/auth`, `app/api/*`."
- No: "Es seguro."

Y siempre dice **qué no revisó**: "no probé contra staging porque no está en el alcance", "no tengo el escáner X instalado".

## Cuándo correrlo

- **Antes de publicar** cualquier rama que toque autenticación, permisos, base de datos o rutas públicas.
- **Después de agregar una dependencia.**
- **Una vez por semana** sobre la rama principal, como rutina.

## Higiene básica que no necesita auditor

- `.env*` en `.gitignore`, con un `.env.example` sin valores.
- Toda tabla con políticas por dueño (RLS o equivalente).
- Secretos comparados en tiempo constante.
- Webhooks y crones con su secreto propio.
- Lo que el modelo lee de terceros se trata como dato, nunca como instrucción.
- Si una clave se filtra: rotarla primero, investigar después.
