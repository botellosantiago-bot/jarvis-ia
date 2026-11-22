# SECURITY_AUDIT.md (ejemplo)

Registro de ejemplo del auditor sobre el Proyecto Demo, que no existe. Los hallazgos son inventados para mostrar el formato.

## Hallazgos

| ID | Módulo | Archivo:línea | Severidad | Descripción | Arreglo propuesto | Estado |
|---|---|---|---|---|---|---|
| AUD-001 | authz | `app/api/contactos/route.ts:14` | alta | [confirmado] Cualquier sesión iniciada puede leer los contactos de todos los usuarios: la consulta no filtra por dueño | Filtrar por `user_id` de la sesión y agregar política por dueño | verificado (4-mar) |
| AUD-002 | secretos | `lib/correo.ts:3` | media | [confirmado] La clave del servicio de correo tenía un valor por defecto escrito en el código | Quitar el valor por defecto y fallar si falta la variable; rotar la clave | corregido (4-mar) |
| AUD-003 | input | `app/contacto/accion.ts:22` | baja | [probable] El formulario no limita el largo del mensaje; alguien podría llenar la tabla | Límite de 2,000 caracteres con validación en servidor | abierto |
| AUD-004 | config | `app/api/depurar/route.ts:1` | baja | [confirmado] Ruta de depuración sin autenticación | Que sólo exista en desarrollo | riesgo aceptado |
| AUD-005 | dependencias | `package.json` | media | [no verificado] El escáner de dependencias no está instalado en esta compu | Instalarlo (espera OK) y volver a correr | abierto |

## Riesgos aceptados

### AUD-004 · riesgo aceptado
- Fecha: 5-mar-2026
- Quién decidió: el dueño
- Por qué: la ruta sólo se compila en desarrollo; el build de producción la excluye (comprobado en el build del 5-mar)
- Se revisa de nuevo: si cambia la configuración del build, o el 5-jun-2026

## Corridas

### 2026-03-05
- **Alcance:** `repo:.` (rama `integracion/marzo`). Sin pruebas dinámicas: staging no está en `scope.txt`.
- **Herramientas:** escáner de secretos (con valores enmascarados), búsqueda de patrones.
- **Resultado:** 0 altas abiertas, 1 media abierta, 1 baja abierta. Nuevo: AUD-005. Cerrados: AUD-001 verificado.
- **No revisado:** dependencias (falta el escáner); comportamiento en staging.

### Lo que salió al teléfono ese día

> Auditoría terminada · 2 abiertos (0 altos)

Nada más. El detalle se queda en este archivo.
