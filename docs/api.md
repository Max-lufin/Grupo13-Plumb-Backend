# API REST de Plumb

Base: `/api/v1`. Todas las respuestas son JSON y comparten la misma forma:

```json
{ "ok": true,  "data": { }, "meta": { } }
{ "ok": false, "error": { "codigo": "VALIDACION", "mensaje": "Hay datos que faltan…", "detalles": [{ "campo": "rut_cliente", "mensaje": "El dígito verificador no corresponde." }] } }
```

## Códigos de respuesta

| Código | Cuándo | `error.codigo` |
|---|---|---|
| 200 | Lectura o actualización correcta | — |
| 201 | Se creó un recurso o una ejecución del laboratorio | — |
| 400 | Forma inválida: falta un campo, formato o largo (Zod). Trae `detalles` por campo | `VALIDACION`, `JSON_INVALIDO` |
| 404 | El recurso o la ruta no existe | `NO_ENCONTRADO` |
| 409 | Conflicto: borrar algo que está en uso (ON DELETE RESTRICT) | `CONFLICTO` |
| 422 | Regla de negocio o restricción de la base: menor de 18 años, fecha pasada, transición no permitida, correo o RUT repetido | `REGLA_DE_NEGOCIO` |
| 503 | Base de datos sin respuesta (PostgreSQL o MongoDB) | `TIEMPO_AGOTADO`, `SIN_MONGODB` |
| 500 | Error inesperado; el detalle queda solo en el registro del servidor | `ERROR_INTERNO` |

## Recursos

### Estado

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/salud` | Versión y latencia de PostgreSQL y MongoDB, y filas por tabla |

### Catálogo (caso de uso Consulta)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/regiones` | Las 16 regiones |
| GET | `/catalogo?region=6&oficio=1` | Maestros por región y oficio (obligatorios). Opcionales: `tarifaMax`, `calificacionMin`, `disponible`, `experienciaMin`. Consulta 3 |
| GET | `/ranking?limite=6` | Mejor evaluados, con al menos 2 reseñas (máximo 24) |

### Mantenedor 1: maestros

| Método | Ruta | Cuerpo | Descripción |
|---|---|---|---|
| GET | `/maestros` | — | Lista con oficio, región y reputación |
| GET | `/maestros/{rut}` | — | Perfil con reseñas y trabajos terminados |
| GET | `/maestros/{rut}/solicitudes?estado=Pendiente` | — | Bandeja del maestro. Consulta 5 |
| POST | `/maestros` | `rut_maestro, nombre, email, telefono, fecha_nacimiento, id_oficio, id_region, tarifa_hora, experiencia_anios?, disponible?, descripcion?` | Alta. Consulta 9 |
| PUT | `/maestros/{rut}` | igual que POST, sin RUT | Reemplazo completo |
| PATCH | `/maestros/{rut}` | `disponible?, tarifa_hora?` | Cambio parcial. Consulta 7 |
| DELETE | `/maestros/{rut}` | — | 409 si tiene solicitudes |

### Mantenedor 2: oficios

| Método | Ruta | Cuerpo | Descripción |
|---|---|---|---|
| GET | `/oficios` | — | Lista con cantidad de maestros |
| GET | `/oficios/{id}` | — | Un oficio |
| POST | `/oficios` | `nombre, descripcion?` | Alta |
| PUT | `/oficios/{id}` | `nombre, descripcion?` | Edición |
| DELETE | `/oficios/{id}` | — | 409 si tiene maestros (ON DELETE RESTRICT). Consulta 12 |

### Clientes

| Método | Ruta | Cuerpo | Descripción |
|---|---|---|---|
| GET | `/clientes` | — | Lista |
| GET | `/clientes/{rut}` | — | Un cliente |
| POST | `/clientes` | `rut_cliente, nombre, email, telefono?, fecha_nacimiento` | Registro; 422 si es menor de 18. Consulta 8 |

### Solicitudes (caso de uso Transacción)

| Método | Ruta | Cuerpo | Descripción |
|---|---|---|---|
| GET | `/solicitudes?cliente=&maestro=&estado=` | — | Historial con cliente, maestro y nota. Consulta 4 |
| GET | `/solicitudes/{id}` | — | Una solicitud |
| POST | `/solicitudes` | `rut_cliente, rut_maestro, descripcion, direccion, fecha_servicio` | Crea en estado Pendiente; responde 201 con `Location`. Consulta 10 |
| PATCH | `/solicitudes/{id}` | `estado` | Aceptar, rechazar, terminar o cancelar; 422 si la transición no es válida. Consulta 6 |
| DELETE | `/solicitudes/{id}` | — | Moderación; borra su calificación en cascada. Consulta 11 |
| POST | `/solicitudes/{id}/calificacion` | `puntuacion, comentario?` | Solo si está Finalizada; 422 si ya tiene nota |

### Laboratorio SQL (Etapa I)

Cada ejecución corre en una transacción que termina en ROLLBACK.

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/consultas` | Las 13 consultas (SQL, MQL, álgebra y trazabilidad) y las pruebas R1 a R6 |
| GET | `/consultas/{n}` | Una consulta |
| POST | `/consultas/{n}/ejecuciones` | Ejecuta la consulta n con parámetros reales |
| POST | `/pruebas-integridad/{R1..R6}/ejecuciones` | Intenta una operación inválida y devuelve la restricción que la rechazó |

### Laboratorio NoSQL (Etapa II)

Las escrituras corren en una transacción multi-documento que se aborta.

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/nosql` | Estado de MongoDB, decisiones de traspaso, costo de los datos copiados y, por colección: total, documento de ejemplo, índices y validador |
| GET | `/nosql/consultas` | Q1 a Q5 y T1 a T3 con su MQL y su SQL equivalente, y las pruebas N1 a N7 |
| POST | `/nosql/consultas/{Q1..T3}/ejecuciones` | Ejecuta en MongoDB y en PostgreSQL y compara; en lecturas incluye el plan de ejecución |
| POST | `/nosql/pruebas/{N1..N7}/ejecuciones` | Intenta un documento inválido y devuelve el error del validador |

## Ejemplo

```http
POST /api/v1/solicitudes
Content-Type: application/json

{ "rut_cliente": "12588772-4", "rut_maestro": "16178972-0",
  "descripcion": "Se tapó el lavaplatos y el agua no baja.",
  "direccion": "Los Aromos 455, Viña del Mar", "fecha_servicio": "2026-10-22" }
```

```http
HTTP/1.1 201 Created
Location: /api/v1/solicitudes/118

{ "ok": true, "data": { "id_solicitud": 118, "estado": "Pendiente", "fecha_solicitud": "2026-10-20T13:05:11.204Z" } }
```
