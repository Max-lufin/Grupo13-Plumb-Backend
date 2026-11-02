# API REST de Plumb

## Introducción

La API conecta la aplicación web de Plumb con su base de datos MongoDB. Publica el catálogo y el ranking de maestros, maneja el inicio de sesión, recibe las solicitudes de servicio con su ciclo de estados y su calificación, administra los dos mantenedores (maestros y oficios) y expone el laboratorio donde se ejecutan las 13 consultas de la Etapa I convertidas a MQL. Está hecha con Express 5 sobre Node.js 24 y se publica como función serverless en Vercel, en la misma dirección que el frontend.

| | |
|---|---|
| URL base (producción) | `https://grupo13-plumb.vercel.app/api/v1` |
| URL base (local) | `http://localhost:3000/api/v1` |
| Formato | JSON en UTF-8, en la petición y en la respuesta |
| Versión | `v1` en la ruta; `GET /api/v1` devuelve el índice de recursos |
| Base de datos | MongoDB 8 (Atlas en producción, replica set local en desarrollo) |

Todas las respuestas tienen la misma forma:

```json
{ "ok": true,  "data": { }, "meta": { } }
{ "ok": false, "error": { "codigo": "VALIDACION", "mensaje": "…", "detalles": [ { "campo": "…", "mensaje": "…" } ] } }
```

`meta` es opcional (por ejemplo `total` y `ms` en los listados). `detalles` aparece cuando el error se puede asociar a un campo, para que el frontend lo muestre junto a él.

## Autenticación y autorización

1. El cliente envía `POST /sesiones` con `email` y `contrasena`.
2. La API busca el correo en `usuarios`, compara la contraseña con su hash scrypt (con sal y comparación en tiempo constante) y, si coincide, firma un token JWT HS256 con `sub` (RUT), `nombre` y `roles`. El token vence en 8 horas (`expiraEn: 28800`).
3. Cada petición posterior lleva la cabecera `Authorization: Bearer <token>`. El middleware `leerSesion` verifica firma, algoritmo y vencimiento; un token inválido o vencido responde `401 SESION_INVALIDA`.
4. `exigir()` pide sesión iniciada (`401 SIN_SESION`) y `exigir('rol')` además pide el rol (`403 SIN_PERMISO`).
5. Además del rol, los controladores revisan la propiedad del dato: un cliente solo ve sus solicitudes y su cuenta, y un maestro solo su bandeja. El RUT del cliente que crea una solicitud sale del token, nunca del cuerpo.

| Rol | Puede |
|---|---|
| Visitante (sin token) | Ver estado, regiones, oficios, catálogo, ranking y perfiles; registrarse; usar el laboratorio y el modelo NoSQL |
| Cliente | Lo anterior, más crear solicitudes, ver su historial, cancelar y calificar |
| Maestro | Ver su bandeja, aceptar, rechazar y finalizar sus solicitudes |
| Administrador | Mantenedores de maestros y oficios, listado de clientes y moderación de solicitudes |

Una misma persona puede tener varios roles (por ejemplo, cliente y maestro con el mismo RUT).

## Endpoints

La columna Acceso indica quién puede llamar al endpoint: **Público**, **Sesión** (cualquier rol), o el rol exigido.

### Estado y sesiones

| Método | Ruta | Acceso | Parámetros | Respuesta |
|---|---|---|---|---|
| GET | `/salud` | Público | — | 200: estado de la API, motor, latencia y documentos por tipo |
| POST | `/sesiones` | Público | Cuerpo: `email`, `contrasena` | 201: `token`, `expiraEn`, `usuario` · 400, 401, 429 |
| GET | `/sesiones/actual` | Sesión | — | 200: datos de la cuenta del token · 401, 404 |

### Catálogo y ranking (caso de uso Consulta)

| Método | Ruta | Acceso | Parámetros | Respuesta |
|---|---|---|---|---|
| GET | `/regiones` | Público | — | 200: las 16 regiones (constante de la API) |
| GET | `/catalogo` | Público | Query obligatorios: `region` (1–16), `oficio`. Opcionales: `tarifaMax`, `calificacionMin` (0–5), `disponible` (true/false), `experienciaMin` | 200: maestros ordenados por promedio y tarifa · 400 |
| GET | `/ranking` | Público | Query opcional: `limite` (por defecto 6, máximo 24) | 200: maestros con al menos 2 reseñas, de mejor a peor |

### Mantenedor 1: maestros

| Método | Ruta | Acceso | Parámetros | Respuesta |
|---|---|---|---|---|
| GET | `/maestros` | Administrador | — | 200: todos los maestros con contacto |
| GET | `/maestros/{rut}` | Público | `rut` con dígito verificador | 200: perfil público, trabajos finalizados y 5 reseñas recientes (sin correo ni teléfono) · 400, 404 |
| GET | `/maestros/{rut}/solicitudes` | Maestro dueño o administrador | Query opcional: `estado` (por defecto `Pendiente`) | 200: bandeja ordenada de la más antigua · 403 |
| POST | `/maestros` | Administrador | Cuerpo: `rut_maestro`, `nombre`, `email`, `telefono`, `fecha_nacimiento`, `id_oficio`, `id_region`, `tarifa_hora`, `experiencia_anios`, `disponible`, `descripcion`, `contrasena` | 201 · 400, 409, 422 |
| PUT | `/maestros/{rut}` | Administrador | Cuerpo completo (la `contrasena` es opcional) | 200 · 400, 404, 409, 422 |
| PATCH | `/maestros/{rut}` | Administrador | Cuerpo: `disponible` y/o `tarifa_hora` | 200 · 400, 404 |
| DELETE | `/maestros/{rut}` | Administrador | — | 200 · 404, 409 si tiene solicitudes |

### Mantenedor 2: oficios

| Método | Ruta | Acceso | Parámetros | Respuesta |
|---|---|---|---|---|
| GET | `/oficios` | Público | — | 200: oficios con `total_maestros` |
| GET | `/oficios/{id}` | Público | `id` entero | 200 · 404 |
| POST | `/oficios` | Administrador | Cuerpo: `nombre` (3–60), `descripcion` | 201 · 400, 409 nombre repetido |
| PUT | `/oficios/{id}` | Administrador | Cuerpo: `nombre`, `descripcion` | 200 (actualiza también la copia en cada maestro) · 404, 409 |
| DELETE | `/oficios/{id}` | Administrador | — | 200 · 404, 409 si hay maestros con ese oficio |

### Clientes

| Método | Ruta | Acceso | Parámetros | Respuesta |
|---|---|---|---|---|
| GET | `/clientes` | Administrador | — | 200: clientes con su cantidad de solicitudes |
| GET | `/clientes/{rut}` | El propio cliente o administrador | `rut` | 200 · 403, 404 |
| POST | `/clientes` | Público (registro) | Cuerpo: `rut_cliente`, `nombre`, `email`, `telefono` (opcional), `fecha_nacimiento`, `contrasena` (8+ caracteres, con letra y número) | 201 · 400, 409, 422 menor de edad |

### Solicitudes y calificación (caso de uso Transacción)

| Método | Ruta | Acceso | Parámetros | Respuesta |
|---|---|---|---|---|
| GET | `/solicitudes` | Sesión (solo las propias; el administrador ve todas) | Query: `cliente`, `maestro`, `estado` | 200: historial; `telefono_maestro` solo si está Aceptada o Finalizada · 403 |
| GET | `/solicitudes/{id}` | Cliente o maestro de la solicitud, o administrador | `id` = folio | 200 · 403, 404 |
| POST | `/solicitudes` | Cliente | Cuerpo: `rut_maestro`, `descripcion` (15–1000), `direccion`, `fecha_servicio` (hoy o futura) | 201 + `Location` · 400, 422 |
| PATCH | `/solicitudes/{id}` | Cliente (solo `Cancelada`) o maestro de la solicitud | Cuerpo: `estado` | 200 · 403, 404, 409, 422 transición no permitida |
| DELETE | `/solicitudes/{id}` | Administrador (moderación) | — | 200 (recalcula la reputación del maestro) · 404 |
| POST | `/solicitudes/{id}/calificacion` | Cliente de la solicitud | Cuerpo: `puntuacion` (1–5), `comentario` | 201 · 403, 404, 422 si no está finalizada o ya fue calificada |

Transiciones permitidas: `Pendiente → Aceptada | Rechazada | Cancelada`, `Aceptada → Finalizada | Cancelada`. `Rechazada`, `Finalizada` y `Cancelada` son estados finales.

### Laboratorio de consultas y modelo NoSQL

| Método | Ruta | Acceso | Parámetros | Respuesta |
|---|---|---|---|---|
| GET | `/consultas` | Público | — | 200: las 13 consultas (SQL de la Etapa I, álgebra y MQL) y las pruebas N1–N8 |
| GET | `/consultas/{numero}` | Público | `numero` 1–13 | 200 · 404 |
| POST | `/consultas/{numero}/ejecuciones` | Público | — | 201: respuesta de cada paso, plan de ejecución en lecturas · 403 `SIN_PERMISO_BD` |
| POST | `/pruebas-integridad/{codigo}/ejecuciones` | Público | `codigo` N1–N8 | 201: si MongoDB rechazó la operación y con qué error |
| GET | `/nosql` | Público | — | 200: traspaso tabla → colección, copias a mantener y, por colección, índices, validador y un documento |

Las escrituras del laboratorio corren en una transacción que siempre se aborta, así que repetirlas no cambia los datos.

## Errores

| HTTP | Código | Cuándo |
|---|---|---|
| 400 | `VALIDACION` | Falta un dato o no tiene el formato esperado (Zod); `detalles` indica el campo |
| 400 | `JSON_INVALIDO` | El cuerpo no es JSON |
| 401 | `CREDENCIALES` | Correo o contraseña incorrectos (el mensaje no dice cuál) |
| 401 | `SIN_SESION` / `SESION_INVALIDA` | Falta el token, o está vencido o alterado |
| 403 | `SIN_PERMISO` | El rol no alcanza o el dato es de otra persona |
| 403 | `SIN_PERMISO_BD` | El usuario de la base no puede cambiar validadores (consultas 1 y 2 del laboratorio en Atlas) |
| 404 | `NO_ENCONTRADO` | No existe el recurso o la ruta |
| 409 | `CONFLICTO` | RUT, correo o nombre de oficio repetidos (índice único); borrar algo que tiene datos asociados; la solicitud cambió entre medio |
| 413 | `DEMASIADO_GRANDE` | El cuerpo supera 20 KB |
| 422 | `REGLA_DE_NEGOCIO` | Datos bien formados que rompen una regla: menor de edad, fecha pasada, maestro no disponible, transición inválida, doble calificación; también si el validador de MongoDB rechaza el documento |
| 429 | `DEMASIADOS_INTENTOS` | 10 inicios de sesión fallidos desde la misma IP en 15 minutos |
| 500 | `ERROR_INTERNO` | Error inesperado; el detalle queda en el registro del servidor, no en la respuesta |
| 503 | `BD_NO_DISPONIBLE` | No hay conexión con MongoDB |

## Límites y cuotas

- Cuerpo de la petición: máximo 20 KB.
- Inicio de sesión: 10 intentos fallidos por IP cada 15 minutos; después responde 429.
- Listados: el historial devuelve hasta 200 solicitudes, el ranking hasta 24 maestros y el laboratorio muestra hasta 8 documentos por paso.
- Token: 8 horas de vigencia; luego hay que iniciar sesión de nuevo.
- Infraestructura: rigen las cuotas de los planes gratuitos de Vercel (funciones serverless) y de MongoDB Atlas M0 (512 MB de almacenamiento, 500 conexiones).

## Consideraciones de seguridad

- **Contraseñas:** se guardan como hash scrypt con sal aleatoria (`scrypt$sal$hash`); ninguna respuesta las devuelve, ni siquiera el hash.
- **Tokens:** JWT firmados con HS256 y un secreto aleatorio que vive en la variable `SESION_SECRETO`. La API solo acepta ese algoritmo y compara la firma en tiempo constante.
- **Validación en la entrada:** cada cuerpo, parámetro y filtro pasa por un esquema Zod antes de llegar a la base. Como segunda barrera, cada colección tiene un validador `$jsonSchema` con `additionalProperties: false`.
- **Inyección NoSQL:** los filtros se construyen en el servidor con valores ya tipados; el cliente nunca envía operadores (`$gt`, `$where`) que lleguen a la consulta.
- **Datos personales:** el perfil público no incluye correo ni teléfono; el teléfono del maestro se comparte con el cliente solo cuando acepta el trabajo.
- **Cabeceras y CORS:** Helmet agrega las cabeceras de seguridad y CORS acepta solo los orígenes de `CORS_ORIGINS`.
- **Credenciales de infraestructura:** `MONGODB_URI` y `SESION_SECRETO` están en las variables de entorno de Vercel y en un `.env` local que no se sube al repositorio. El usuario de Atlas tiene solo permiso `readWrite` sobre la base `plumb`.
- **Transporte:** HTTPS hacia el navegador y TLS hacia Atlas.

## Ejemplos

Peticiones y respuestas reales contra la API local con los datos de prueba (cuentas de demostración con contraseña `plumb2026`). Los tokens se acortan y los arreglos largos muestran sus 2 primeros elementos.

### Estado

#### GET /salud

```http
GET /api/v1/salud HTTP/1.1
```

```json
// 200 OK
{
  "ok": true,
  "data": {
    "api": "en línea",
    "bd": {
      "conectada": true,
      "motor": "MongoDB 8.3.13",
      "alojamiento": "MongoDB local",
      "baseDeDatos": "plumb",
      "latenciaMs": 0.5
    },
    "documentos": {
      "clientes": 16,
      "maestros": 43,
      "administradores": 1,
      "oficios": 10,
      "solicitudes": 117
    },
    "hora": "2026-11-02T22:58:55.892Z"
  }
}
```

### Sesiones

#### POST /sesiones: iniciar sesión

```http
POST /api/v1/sesiones HTTP/1.1
Content-Type: application/json

{
  "email": "maria.gonzalez@ejemplo.cl",
  "contrasena": "plumb2026"
}
```

```json
// 201 Created
{
  "ok": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.…",
    "expiraEn": 28800,
    "usuario": {
      "rut": "12588772-4",
      "nombre": "María González Rojas",
      "email": "maria.gonzalez@ejemplo.cl",
      "roles": [
        "cliente"
      ]
    }
  }
}
```

#### GET /sesiones/actual

```http
GET /api/v1/sesiones/actual HTTP/1.1
Authorization: Bearer <token de cliente>
```

```json
// 200 OK
{
  "ok": true,
  "data": {
    "rut": "12588772-4",
    "nombre": "María González Rojas",
    "email": "maria.gonzalez@ejemplo.cl",
    "roles": [
      "cliente"
    ]
  }
}
```

### Catálogos

#### GET /regiones

```http
GET /api/v1/regiones HTTP/1.1
```

```json
// 200 OK
{
  "ok": true,
  "data": [
    {
      "id_region": 1,
      "codigo": "XV",
      "nombre": "Arica y Parinacota"
    },
    {
      "id_region": 2,
      "codigo": "I",
      "nombre": "Tarapacá"
    }
  ]
}
```

_data: 16 elementos, se muestran 2._

#### GET /catalogo

```http
GET /api/v1/catalogo?region=6&oficio=1&tarifaMax=25000&calificacionMin=4 HTTP/1.1
```

```json
// 200 OK
{
  "ok": true,
  "data": [
    {
      "rut_maestro": "7765180-2",
      "nombre": "Pedro González Soto",
      "id_oficio": 1,
      "oficio": "Gasfíter",
      "id_region": 6,
      "region": "Valparaíso",
      "tarifa_hora": 22000,
      "experiencia_anios": 18,
      "disponible": true,
      "descripcion": null,
      "promedio": 5,
      "total_resenas": 3
    },
    {
      "rut_maestro": "16178972-0",
      "nombre": "Claudia Rojas Fuentes",
      "id_oficio": 1,
      "oficio": "Gasfíter",
      "id_region": 6,
      "region": "Valparaíso",
      "tarifa_hora": 19500,
      "experiencia_anios": 9,
      "disponible": true,
      "descripcion": null,
      "promedio": 4.5,
      "total_resenas": 2
    }
  ],
  "meta": {
    "total": 4,
    "ms": 1.2,
    "consulta": 3,
    "filtros": {
      "region": 6,
      "oficio": 1,
      "tarifaMax": 25000,
      "calificacionMin": 4
    }
  }
}
```

_data: 4 elementos, se muestran 2._

#### GET /ranking

```http
GET /api/v1/ranking?limite=3 HTTP/1.1
```

```json
// 200 OK
{
  "ok": true,
  "data": [
    {
      "rut_maestro": "14007716-K",
      "nombre": "Nelson Vergara Fernández",
      "id_oficio": 3,
      "oficio": "Carpintero",
      "id_region": 7,
      "region": "Metropolitana",
      "tarifa_hora": 17500,
      "experiencia_anios": 23,
      "disponible": true,
      "descripcion": "Carpintería de terminaciones: guardapolvos, marcos y repisas.",
      "promedio": 5,
      "total_resenas": 3
    },
    {
      "rut_maestro": "7765180-2",
      "nombre": "Pedro González Soto",
      "id_oficio": 1,
      "oficio": "Gasfíter",
      "id_region": 6,
      "region": "Valparaíso",
      "tarifa_hora": 22000,
      "experiencia_anios": 18,
      "disponible": true,
      "descripcion": "Gasfíter con certificación SEC para gas. Trabajo con boleta y garantía de 3 meses.",
      "promedio": 5,
      "total_resenas": 3
    }
  ]
}
```

_data: 3 elementos, se muestran 2._

### Oficios (mantenedor 2)

#### GET /oficios

```http
GET /api/v1/oficios HTTP/1.1
```

```json
// 200 OK
{
  "ok": true,
  "data": [
    {
      "nombre": "Albañil",
      "descripcion": "Obras menores: radieres, muros, cerámica y estuco.",
      "id_oficio": 6,
      "total_maestros": 2
    },
    {
      "nombre": "Carpintero",
      "descripcion": "Muebles a medida, puertas, closets y reparaciones en madera.",
      "id_oficio": 3,
      "total_maestros": 4
    }
  ]
}
```

_data: 10 elementos, se muestran 2._

#### GET /oficios/{id}

```http
GET /api/v1/oficios/1 HTTP/1.1
```

```json
// 200 OK
{
  "ok": true,
  "data": {
    "id_oficio": 1,
    "nombre": "Gasfíter",
    "descripcion": "Cañerías, grifería, calefont y artefactos sanitarios."
  }
}
```

#### POST /oficios

```http
POST /api/v1/oficios HTTP/1.1
Authorization: Bearer <token de administrador>
Content-Type: application/json

{
  "nombre": "Soldador",
  "descripcion": "Soldadura de rejas y portones."
}
```

```json
// 201 Created
{
  "ok": true,
  "data": {
    "id_oficio": 11,
    "nombre": "Soldador",
    "descripcion": "Soldadura de rejas y portones."
  }
}
```

#### PUT /oficios/{id}

```http
PUT /api/v1/oficios/11 HTTP/1.1
Authorization: Bearer <token de administrador>
Content-Type: application/json

{
  "nombre": "Soldador y herrero",
  "descripcion": "Rejas, portones y estructuras metálicas."
}
```

```json
// 200 OK
{
  "ok": true,
  "data": {
    "id_oficio": 11,
    "nombre": "Soldador y herrero",
    "descripcion": "Rejas, portones y estructuras metálicas."
  }
}
```

#### DELETE /oficios/{id}

```http
DELETE /api/v1/oficios/11 HTTP/1.1
Authorization: Bearer <token de administrador>
```

```json
// 200 OK
{
  "ok": true,
  "data": {
    "id_oficio": 11,
    "nombre": "Soldador y herrero"
  }
}
```

### Maestros (mantenedor 1)

#### GET /maestros

```http
GET /api/v1/maestros HTTP/1.1
Authorization: Bearer <token de administrador>
```

```json
// 200 OK
{
  "ok": true,
  "data": [
    {
      "rut_maestro": "16173195-1",
      "nombre": "Alejandro Reyes Figueroa",
      "id_oficio": 1,
      "oficio": "Gasfíter",
      "id_region": 7,
      "region": "Metropolitana",
      "tarifa_hora": 15500,
      "experiencia_anios": 33,
      "disponible": true,
      "descripcion": "Más de una década instalando grifería y artefactos sanitarios. Presupuesto sin costo.",
      "promedio": 4,
      "total_resenas": 2,
      "email": "alejandro.reyes@ejemplo.cl",
      "telefono": "+56975699798",
      "fecha_nacimiento": "1973-10-24"
    },
    {
      "rut_maestro": "14297438-K",
      "nombre": "Ana Martínez Reyes",
      "id_oficio": 3,
      "oficio": "Carpintero",
      "id_region": 7,
      "region": "Metropolitana",
      "tarifa_hora": 16000,
      "experiencia_anios": 4,
      "disponible": true,
      "descripcion": "Muebles de cocina y closets a medida en melamina y madera nativa.",
      "promedio": 3,
      "total_resenas": 1,
      "email": "ana.martinez@ejemplo.cl",
      "telefono": "+56952344964",
      "fecha_nacimiento": "1972-03-28"
    }
  ],
  "meta": {
    "total": 43
  }
}
```

_data: 43 elementos, se muestran 2._

#### GET /maestros/{rut}

```http
GET /api/v1/maestros/7765180-2 HTTP/1.1
```

```json
// 200 OK
{
  "ok": true,
  "data": {
    "rut_maestro": "7765180-2",
    "nombre": "Pedro González Soto",
    "id_oficio": 1,
    "oficio": "Gasfíter",
    "id_region": 6,
    "region": "Valparaíso",
    "tarifa_hora": 22000,
    "experiencia_anios": 18,
    "disponible": true,
    "descripcion": "Gasfíter con certificación SEC para gas. Trabajo con boleta y garantía de 3 meses.",
    "promedio": 5,
    "total_resenas": 3,
    "fecha_registro": "2026-07-15T17:27:00.000Z",
    "trabajos_finalizados": 3,
    "resenas": [
      {
        "id": "6ab317ac0000000000000066",
        "puntuacion": 5,
        "comentario": "Solucionó en una hora lo que otro no pudo en dos visitas.",
        "fecha": "2026-10-02T23:41:00.000Z",
        "cliente": "Valentina"
      },
      {
        "id": "6a9c218c0000000000000050",
        "puntuacion": 5,
        "comentario": "Muy ordenado, explicó lo que hizo y cobró lo conversado.",
        "fecha": "2026-09-08T17:41:00.000Z",
        "cliente": "Diego"
      }
    ]
  }
}
```

_data.resenas: 3 elementos, se muestran 2._

#### GET /maestros/{rut}/solicitudes

```http
GET /api/v1/maestros/7765180-2/solicitudes?estado=Pendiente HTTP/1.1
Authorization: Bearer <token de maestro>
```

```json
// 200 OK
{
  "ok": true,
  "data": [
    {
      "id_solicitud": 4,
      "descripcion": "Reparación de llave de paso en la cocina, no corta el agua del todo.",
      "direccion": "Errázuriz 2210, Valparaíso",
      "fecha_servicio": "2026-10-13",
      "fecha_solicitud": "2026-10-08T11:41:00.000Z",
      "cliente": "María González Rojas"
    },
    {
      "id_solicitud": 5,
      "descripcion": "El calefont no enciende, es a gas licuado y tiene unos 8 años.",
      "direccion": "Los Carrera 377, Quilpué",
      "fecha_servicio": "2026-10-12",
      "fecha_solicitud": "2026-10-08T18:46:00.000Z",
      "cliente": "Valentina Soto Aravena"
    }
  ],
  "meta": {
    "total": 2,
    "ms": 1.1,
    "consulta": 5
  }
}
```

#### POST /maestros

```http
POST /api/v1/maestros HTTP/1.1
Authorization: Bearer <token de administrador>
Content-Type: application/json

{
  "rut_maestro": "20111222-2",
  "nombre": "Tomás Rivas Lagos",
  "email": "tomas.rivas@ejemplo.cl",
  "telefono": "+56912345678",
  "fecha_nacimiento": "1990-05-14",
  "id_oficio": 2,
  "id_region": 6,
  "tarifa_hora": 18000,
  "experiencia_anios": 6,
  "disponible": true,
  "descripcion": "Instalaciones eléctricas domiciliarias.",
  "contrasena": "clave-inicial-1"
}
```

```json
// 201 Created
{
  "ok": true,
  "data": {
    "rut_maestro": "20111222-2",
    "nombre": "Tomás Rivas Lagos",
    "id_oficio": 2,
    "id_region": 6
  }
}
```

#### PUT /maestros/{rut}

```http
PUT /api/v1/maestros/20111222-2 HTTP/1.1
Authorization: Bearer <token de administrador>
Content-Type: application/json

{
  "nombre": "Tomás Rivas Lagos",
  "email": "tomas.rivas@ejemplo.cl",
  "telefono": "+56912345678",
  "fecha_nacimiento": "1990-05-14",
  "id_oficio": 2,
  "id_region": 5,
  "tarifa_hora": 20000,
  "experiencia_anios": 7,
  "disponible": true,
  "descripcion": "Instalaciones eléctricas y certificación SEC."
}
```

```json
// 200 OK
{
  "ok": true,
  "data": {
    "rut_maestro": "20111222-2",
    "nombre": "Tomás Rivas Lagos"
  }
}
```

#### PATCH /maestros/{rut}

```http
PATCH /api/v1/maestros/20111222-2 HTTP/1.1
Authorization: Bearer <token de administrador>
Content-Type: application/json

{
  "disponible": false
}
```

```json
// 200 OK
{
  "ok": true,
  "data": {
    "rut_maestro": "20111222-2",
    "nombre": "Tomás Rivas Lagos",
    "disponible": false,
    "tarifa_hora": 20000
  }
}
```

#### DELETE /maestros/{rut}

```http
DELETE /api/v1/maestros/20111222-2 HTTP/1.1
Authorization: Bearer <token de administrador>
```

```json
// 200 OK
{
  "ok": true,
  "data": {
    "rut_maestro": "20111222-2",
    "nombre": "Tomás Rivas Lagos"
  }
}
```

### Clientes

#### GET /clientes

```http
GET /api/v1/clientes HTTP/1.1
Authorization: Bearer <token de administrador>
```

```json
// 200 OK
{
  "ok": true,
  "data": [
    {
      "nombre": "Carlos Muñoz Díaz",
      "email": "carlos.munoz@ejemplo.cl",
      "rut_cliente": "20478313-6",
      "total_solicitudes": 5
    },
    {
      "nombre": "Catalina Vidal Moreno",
      "email": "catalina.vidal@ejemplo.cl",
      "rut_cliente": "20769995-0",
      "total_solicitudes": 5
    }
  ]
}
```

_data: 16 elementos, se muestran 2._

#### GET /clientes/{rut}

```http
GET /api/v1/clientes/12588772-4 HTTP/1.1
Authorization: Bearer <token de cliente>
```

```json
// 200 OK
{
  "ok": true,
  "data": {
    "rut_cliente": "12588772-4",
    "nombre": "María González Rojas",
    "email": "maria.gonzalez@ejemplo.cl",
    "telefono": null,
    "fecha_nacimiento": "1980-01-14",
    "fecha_registro": "2026-05-12T13:12:00.000Z"
  }
}
```

#### POST /clientes: registro

```http
POST /api/v1/clientes HTTP/1.1
Content-Type: application/json

{
  "rut_cliente": "19876543-0",
  "nombre": "Josefa Araya Pinto",
  "email": "josefa.araya@ejemplo.cl",
  "telefono": "+56987654321",
  "fecha_nacimiento": "2001-03-22",
  "contrasena": "clave-segura-24"
}
```

```json
// 201 Created
{
  "ok": true,
  "data": {
    "rut_cliente": "19876543-0",
    "nombre": "Josefa Araya Pinto",
    "fecha_registro": "2026-11-02T22:58:56.134Z"
  }
}
```

### Solicitudes y calificación

#### GET /solicitudes

```http
GET /api/v1/solicitudes?cliente=12588772-4 HTTP/1.1
Authorization: Bearer <token de cliente>
```

```json
// 200 OK
{
  "ok": true,
  "data": [
    {
      "id_solicitud": 4,
      "fecha_solicitud": "2026-10-08T11:41:00.000Z",
      "fecha_servicio": "2026-10-13",
      "estado": "Pendiente",
      "descripcion": "Reparación de llave de paso en la cocina, no corta el agua del todo.",
      "direccion": "Errázuriz 2210, Valparaíso",
      "rut_cliente": "12588772-4",
      "cliente": "María González Rojas",
      "rut_maestro": "7765180-2",
      "maestro": "Pedro González Soto",
      "puntuacion": null,
      "telefono_maestro": null
    },
    {
      "id_solicitud": 2,
      "fecha_solicitud": "2026-10-07T23:52:00.000Z",
      "fecha_servicio": "2026-10-14",
      "estado": "Pendiente",
      "descripcion": "Instalación de mueble de cocina a medida, bajo mesón de 1,8 metros.",
      "direccion": "Los Aromos 455, Ñuñoa",
      "rut_cliente": "12588772-4",
      "cliente": "María González Rojas",
      "rut_maestro": "14297438-K",
      "maestro": "Ana Martínez Reyes",
      "puntuacion": null,
      "telefono_maestro": null
    }
  ],
  "meta": {
    "total": 13,
    "ms": 1.6
  }
}
```

_data: 13 elementos, se muestran 2._

#### POST /solicitudes

```http
POST /api/v1/solicitudes HTTP/1.1
Authorization: Bearer <token de cliente>
Content-Type: application/json

{
  "rut_maestro": "7765180-2",
  "descripcion": "Filtración bajo el lavaplatos de la cocina, gotea constante.",
  "direccion": "Calle Valparaíso 455, Viña del Mar",
  "fecha_servicio": "2026-11-05"
}
```

```json
// 201 Created · Location: /api/v1/solicitudes/118
{
  "ok": true,
  "data": {
    "id_solicitud": 118,
    "estado": "Pendiente",
    "fecha_solicitud": "2026-11-02T22:58:56.149Z"
  }
}
```

#### GET /solicitudes/{id}

```http
GET /api/v1/solicitudes/118 HTTP/1.1
Authorization: Bearer <token de cliente>
```

```json
// 200 OK
{
  "ok": true,
  "data": {
    "id_solicitud": 118,
    "fecha_solicitud": "2026-11-02T22:58:56.149Z",
    "fecha_servicio": "2026-11-05",
    "estado": "Pendiente",
    "descripcion": "Filtración bajo el lavaplatos de la cocina, gotea constante.",
    "direccion": "Calle Valparaíso 455, Viña del Mar",
    "rut_cliente": "12588772-4",
    "cliente": "María González Rojas",
    "rut_maestro": "7765180-2",
    "maestro": "Pedro González Soto",
    "puntuacion": null
  }
}
```

#### PATCH /solicitudes/{id}: el maestro acepta

```http
PATCH /api/v1/solicitudes/118 HTTP/1.1
Authorization: Bearer <token de maestro>
Content-Type: application/json

{
  "estado": "Aceptada"
}
```

```json
// 200 OK
{
  "ok": true,
  "data": {
    "id_solicitud": 118,
    "estado": "Aceptada"
  }
}
```

#### POST /solicitudes/{id}/calificacion

```http
POST /api/v1/solicitudes/118/calificacion HTTP/1.1
Authorization: Bearer <token de cliente>
Content-Type: application/json

{
  "puntuacion": 5,
  "comentario": "Llegó a la hora y dejó todo limpio."
}
```

```json
// 201 Created
{
  "ok": true,
  "data": {
    "id_solicitud": 118,
    "puntuacion": 5,
    "comentario": "Llegó a la hora y dejó todo limpio.",
    "fecha": "2026-11-02T22:58:56.192Z"
  }
}
```

#### DELETE /solicitudes/{id}: moderación

```http
DELETE /api/v1/solicitudes/118 HTTP/1.1
Authorization: Bearer <token de administrador>
```

```json
// 200 OK
{
  "ok": true,
  "data": {
    "id_solicitud": 118,
    "rut_maestro": "7765180-2",
    "estado": "Finalizada"
  }
}
```

### Laboratorio de consultas y modelo NoSQL

#### GET /consultas

```http
GET /api/v1/consultas HTTP/1.1
```

```json
// 200 OK
{
  "ok": true,
  "data": {
    "consultas": [
      {
        "numero": 1,
        "tipo": "ALTER",
        "titulo": "Registrar cuándo responde el maestro",
        "descripcion": "Agrega el campo fecha_respuesta a las solicitudes para medir cuánto tarda un maestro en…",
        "trazabilidad": {
          "requisito": "Objetivo de negocio: menos tiempo de conexión",
          "casoDeUso": "CU-02 Gestionar solicitud",
          "colecciones": [
            "solicitudes"
          ]
        },
        "conversion": "ALTER TABLE ADD COLUMN → collMod con el validador ampliado",
        "modo": "estructura",
        "sql": "ALTER TABLE solicitud\n    ADD COLUMN fecha_respuesta TIMESTAMPTZ NULL;",
        "mql": "const v = db.getCollectionInfos({ name: 'solicitudes' })[0].options.validator;\nv.$jsonS…"
      },
      {
        "numero": 2,
        "tipo": "ALTER",
        "titulo": "Tope de tarifa por hora",
        "descripcion": "Agrega la regla de que nadie publique una tarifa sobre $150.000 por hora. En MongoDB la…",
        "trazabilidad": {
          "requisito": "RF-01 Mantenedor de maestros",
          "casoDeUso": "CU-03 Gestionar maestros",
          "colecciones": [
            "usuarios"
          ]
        },
        "conversion": "ALTER TABLE ADD CHECK → collMod con maximum en $jsonSchema",
        "modo": "estructura",
        "sql": "ALTER TABLE maestro\n    ADD CONSTRAINT ck_maestro_tarifa_max CHECK (tarifa_hora <= 1500…",
        "mql": "const v = db.getCollectionInfos({ name: 'usuarios' })[0].options.validator;\nv.$jsonSche…"
      }
    ],
    "pruebas": [
      {
        "codigo": "N1",
        "regla": "$expr con $$NOW",
        "equivalente": "R1 · CHECK mayor de edad",
        "titulo": "Un menor de edad intenta registrarse",
        "esperado": "rechazo"
      },
      {
        "codigo": "N2",
        "regla": "$jsonSchema · maximum",
        "equivalente": "R5 · CHECK puntuación de 1 a 5",
        "titulo": "Puntuación fuera del rango 1 a 5",
        "esperado": "rechazo"
      }
    ]
  }
}
```

_data.consultas: 13 elementos, se muestran 2; data.pruebas: 8 elementos, se muestran 2._

#### GET /consultas/{numero}

```http
GET /api/v1/consultas/4 HTTP/1.1
```

```json
// 200 OK
{
  "ok": true,
  "data": {
    "numero": 4,
    "tipo": "SELECT",
    "conJoin": true,
    "titulo": "Historial de solicitudes de un cliente",
    "descripcion": "Los nombres de cliente y maestro y la nota viajan dentro de la solicitud. Lo único que …",
    "trazabilidad": {
      "requisito": "RF-03 Transacción y RF-09 Historial",
      "casoDeUso": "CU-02 Gestionar solicitud",
      "colecciones": [
        "solicitudes",
        "usuarios"
      ]
    },
    "endpoint": "GET /api/v1/solicitudes?cliente=12588772-4",
    "conversion": "SELECT con JOIN y LEFT JOIN → aggregate con $match, $sort y $lookup",
    "modo": "lectura",
    "algebra": [
      "π id_solicitud, fecha_solicitud, estado, descripcion, cliente, maestro, puntuacion (",
      "  σ rut_cliente='12588772-4' ( ((SOLICITUD ⨝ CLIENTE) ⨝ MAESTRO) ⟕ CALIFICACION ))"
    ],
    "sql": "SELECT s.id_solicitud, s.fecha_solicitud, s.estado, s.descripcion,\n       c.nombre AS c…",
    "mql": "db.solicitudes.aggregate([\n  { $match: { 'cliente._id': '12588772-4' } },\n  { $sort: { …"
  }
}
```

#### POST /consultas/{numero}/ejecuciones

```http
POST /api/v1/consultas/4/ejecuciones HTTP/1.1
```

```json
// 201 Created
{
  "ok": true,
  "data": {
    "numero": 4,
    "tipo": "SELECT",
    "modo": "lectura",
    "pasos": [
      {
        "texto": "db.solicitudes.aggregate([\n  { $match: { 'cliente._id': '12588772-4' } },\n  { $sort: { …",
        "nota": null,
        "resultado": [
          "{\n  _id: ObjectId('6ac7814c0000000000000004'),\n  folio: 4,\n  cliente: { _id: '12588772-…",
          "{\n  _id: ObjectId('6ac6db200000000000000002'),\n  folio: 2,\n  cliente: { _id: '12588772-…"
        ],
        "cantidad": 13
      }
    ],
    "ms": 13.2,
    "plan": {
      "etapas": [
        "LIMIT",
        "FETCH"
      ],
      "indice": "ix_historial",
      "ordenEnMemoria": false,
      "clavesExaminadas": 13,
      "documentosExaminados": 13,
      "devueltos": 13
    },
    "cierre": null
  }
}
```

_data.pasos.0.resultado: 8 elementos, se muestran 2; data.plan.etapas: 3 elementos, se muestran 2._

#### POST /pruebas-integridad/{codigo}/ejecuciones

```http
POST /api/v1/pruebas-integridad/N1/ejecuciones HTTP/1.1
```

```json
// 201 Created
{
  "ok": true,
  "data": {
    "codigo": "N1",
    "rechazada": true,
    "cumpleLoEsperado": true,
    "codigoMongo": 121,
    "nombreError": "DocumentValidationFailure",
    "mensaje": "Document failed validation",
    "motivo": "documento: $expr (mayoría de edad o perfil según rol)",
    "transaccion": "abortTransaction"
  }
}
```

#### GET /nosql

```http
GET /api/v1/nosql HTTP/1.1
```

```json
// 200 OK
{
  "ok": true,
  "data": {
    "estado": {
      "conectada": true,
      "motor": "MongoDB 8.3.13",
      "alojamiento": "MongoDB local",
      "baseDeDatos": "plumb",
      "latenciaMs": 1.6
    },
    "traspaso": [
      {
        "tabla": "cliente, maestro, administrador",
        "destino": "usuarios",
        "decision": "Una colección para las tres (patrón polimórfico)",
        "porque": "El inicio de sesión busca por correo sin saber el rol. Un solo documento por persona pe…",
        "consultas": [
          "Inicio de sesión",
          "Q1"
        ]
      },
      {
        "tabla": "maestro (datos del oficio)",
        "destino": "usuarios.maestro",
        "decision": "Perfil embebido (1:0..1)",
        "porque": "Solo existe si la persona es maestro y se lee siempre junto con ella: catálogo, perfil …",
        "consultas": [
          "Q1",
          "Q2"
        ]
      }
    ],
    "duplicados": [
      {
        "dato": "Nombre del oficio",
        "donde": "usuarios.maestro.oficio.nombre",
        "cambia": "Al renombrar un oficio (casi nunca)",
        "mantiene": "updateMany en la misma transacción que renombra el oficio"
      },
      {
        "dato": "Región completa",
        "donde": "usuarios.maestro.region",
        "cambia": "Nunca: catálogo fijo",
        "mantiene": "No requiere mantención"
      }
    ],
    "colecciones": [
      {
        "nombre": "usuarios",
        "origen": [
          "cliente",
          "maestro"
        ],
        "resuelve": [
          "Inicio de sesión",
          "Q1 Catálogo"
        ],
        "total": 61,
        "ejemplo": "{\n  _id: '7765180-2',\n  nombre: 'Pedro González Soto',\n  email: 'pedro.gonzalez@ejemplo…",
        "indices": [
          {
            "nombre": "_id_",
            "clave": "{ _id: 1 }",
            "unico": false
          },
          {
            "nombre": "uq_usuario_email",
            "clave": "{ email: 1 }",
            "unico": true
          }
        ],
        "validador": "{\n  $jsonSchema: {\n    bsonType: 'object',\n    required: [\n      '_id',\n      'nombre',…"
      },
      {
        "nombre": "solicitudes",
        "origen": [
          "solicitud",
          "calificacion"
        ],
        "resuelve": [
          "Q3 Bandeja",
          "Q4 Historial"
        ],
        "total": 117,
        "ejemplo": "{\n  _id: ObjectId('6a8344640000000000000001'),\n  folio: 1,\n  cliente: { _id: '13345441-…",
        "indices": [
          {
            "nombre": "_id_",
            "clave": "{ _id: 1 }",
            "unico": false
          },
          {
            "nombre": "uq_solicitud_folio",
            "clave": "{ folio: 1 }",
            "unico": true
          }
        ],
        "validador": "{\n  $jsonSchema: {\n    bsonType: 'object',\n    required: [\n      '_id',\n      'folio',\n…"
      }
    ]
  }
}
```

_data.traspaso: 8 elementos, se muestran 2; data.duplicados: 6 elementos, se muestran 2; data.colecciones: 4 elementos, se muestran 2._

### Errores

#### 400 VALIDACION: falta un filtro obligatorio

```http
GET /api/v1/catalogo?region=6 HTTP/1.1
```

```json
// 400 Bad Request
{
  "ok": false,
  "error": {
    "codigo": "VALIDACION",
    "mensaje": "Hay datos que faltan o no tienen el formato esperado.",
    "detalles": [
      {
        "campo": "oficio",
        "mensaje": "Falta el oficio (filtro obligatorio)."
      }
    ]
  }
}
```

#### 401 CREDENCIALES: contraseña incorrecta

```http
POST /api/v1/sesiones HTTP/1.1
Content-Type: application/json

{
  "email": "maria.gonzalez@ejemplo.cl",
  "contrasena": "otra-clave"
}
```

```json
// 401 Unauthorized
{
  "ok": false,
  "error": {
    "codigo": "CREDENCIALES",
    "mensaje": "Correo o contraseña incorrectos."
  }
}
```

#### 401 SIN_SESION: ruta protegida sin token

```http
GET /api/v1/solicitudes HTTP/1.1
```

```json
// 401 Unauthorized
{
  "ok": false,
  "error": {
    "codigo": "SIN_SESION",
    "mensaje": "Inicia sesión para continuar."
  }
}
```

#### 403 SIN_PERMISO: un cliente entra al mantenedor

```http
GET /api/v1/maestros HTTP/1.1
Authorization: Bearer <token de cliente>
```

```json
// 403 Forbidden
{
  "ok": false,
  "error": {
    "codigo": "SIN_PERMISO",
    "mensaje": "Tu cuenta no tiene permiso para esta acción."
  }
}
```

#### 404 NO_ENCONTRADO

```http
GET /api/v1/maestros/9999999-3 HTTP/1.1
```

```json
// 404 Not Found
{
  "ok": false,
  "error": {
    "codigo": "NO_ENCONTRADO",
    "mensaje": "No existe un maestro con RUT 9999999-3."
  }
}
```

#### 409 CONFLICTO: correo ya registrado

```http
POST /api/v1/clientes HTTP/1.1
Content-Type: application/json

{
  "rut_cliente": "18765432-7",
  "nombre": "Otra Persona",
  "email": "maria.gonzalez@ejemplo.cl",
  "fecha_nacimiento": "1995-01-01",
  "contrasena": "una-clave-2026"
}
```

```json
// 409 Conflict
{
  "ok": false,
  "error": {
    "codigo": "CONFLICTO",
    "mensaje": "Ese correo ya está registrado.",
    "detalles": [
      {
        "campo": "email",
        "mensaje": "Ese correo ya está registrado."
      }
    ]
  }
}
```

#### 422 REGLA_DE_NEGOCIO: menor de edad

```http
POST /api/v1/clientes HTTP/1.1
Content-Type: application/json

{
  "rut_cliente": "25123456-6",
  "nombre": "Persona Menor",
  "email": "menor@ejemplo.cl",
  "fecha_nacimiento": "2012-06-01",
  "contrasena": "una-clave-2026"
}
```

```json
// 422 Unprocessable Entity
{
  "ok": false,
  "error": {
    "codigo": "REGLA_DE_NEGOCIO",
    "mensaje": "Para registrarte debes ser mayor de 18 años.",
    "detalles": [
      {
        "campo": "fecha_nacimiento",
        "mensaje": "Debes tener al menos 18 años."
      }
    ]
  }
}
```
