# nosql

Modelo de documentos de Plumb en MongoDB (Etapa II). Las 7 tablas del modelo relacional de la Etapa I pasan a 3 colecciones de datos y 1 técnica, según las consultas que más usa la aplicación.

| Archivo | Qué es |
|---|---|
| `esquema.cjs` | Las 4 colecciones: validador `$jsonSchema` (y `$expr`) e índices de cada una |
| `datos/*.json` | Datos de prueba en Extended JSON; los carga `npm run db:init` |
| `ejemplos/*.json` | Un documento por colección, legible (la contraseña va enmascarada) |

## Cargar la base

```bash
cd backend
docker compose up -d        # MongoDB 8 local como replica set (las transacciones lo necesitan)
cp .env.example .env        # MONGODB_URI local o la URI de Atlas
npm run db:init             # crea colecciones, validadores e índices, e inserta los datos
```

Las 13 consultas de la Etapa I, convertidas a MQL, se ejecutan desde la pantalla **Consultas** (`/consultas`) o con `POST /api/v1/consultas/:numero/ejecuciones`. Su texto está en `backend/src/models/consulta.model.js`.

## 1. Consultas que guían el modelo

| | Consulta | Pantalla | Frecuencia | Índice |
|---|---|---|---|---|
| Q1 | Catálogo por región y oficio, con 4 filtros opcionales | Catálogo | La más usada: cada búsqueda | `ix_catalogo` |
| Q2 | Perfil del maestro con sus reseñas | Perfil | Cada visita a un maestro | `_id` |
| Q3 | Bandeja del maestro (pendientes, de la más antigua) | Mis solicitudes | Varias veces al día por maestro | `ix_bandeja` |
| Q4 | Historial del cliente | Mis solicitudes | Cada visita del cliente | `ix_historial` |
| Q5 | Ranking de los mejor evaluados | Inicio | Cada visita a la portada | `ix_ranking` |
| — | Inicio de sesión por correo | Ingresar | Cada sesión | `uq_usuario_email` |

## 2. Destino de cada tabla

| Tabla | Destino | Decisión | Por qué |
|---|---|---|---|
| `cliente`, `maestro`, `administrador` | `usuarios` | Una colección (patrón polimórfico) con `roles[]` | El inicio de sesión busca por correo sin saber el rol; una persona puede ser cliente y maestro con el mismo RUT |
| `maestro` (datos del oficio) | `usuarios.maestro` | Perfil embebido, 1:0..1 | Solo existe si tiene el rol; catálogo, perfil y ranking lo leen junto con la persona |
| `region` | `usuarios.maestro.region` | Embebida completa | Catálogo fijo de 16 filas que no se edita; ninguna consulta la lee sola. La lista de los filtros es una constante de la API |
| `oficio` | `oficios` y copia en `usuarios.maestro.oficio` | Colección propia y referencia extendida | Tiene mantenedor: se lista completo (también los que nadie ofrece), se crea, renombra y borra |
| `solicitud` | `solicitudes` | Colección propia con referencias extendidas | Crece sin límite: embebida sería un arreglo sin tope |
| `calificacion` | `solicitudes.calificacion` | Embebida | 1:0..1, depende de su solicitud y muere con ella |
| `v_reputacion_maestro` | `usuarios.maestro.reputacion` y `resenas_recientes` | Patrones calculado y subconjunto | Q1 y Q5 filtran y ordenan por promedio con índice; Q2 muestra 5 reseñas |
| SERIAL de solicitud y oficio | `contadores` | Colección técnica | `findOneAndUpdate` con `$inc` es atómico |

## 3. Copias que hay que mantener

| Dato copiado | Dónde | Cuándo cambia | Cómo se mantiene |
|---|---|---|---|
| Nombre del oficio | `usuarios.maestro.oficio.nombre` | Al renombrar un oficio | `updateMany` en la misma transacción |
| Región completa | `usuarios.maestro.region` | Nunca | No requiere mantención |
| Nombre de cliente y maestro | `solicitudes.cliente.nombre`, `solicitudes.maestro.nombre` | Si la persona corrige su nombre | `updateMany` por `_id` en la misma transacción |
| Nombre de pila del cliente | `usuarios.maestro.resenas_recientes[].cliente` | Si el cliente corrige su nombre | Se conserva como estaba al calificar; al moderar se rearman las 5 reseñas desde las solicitudes |
| Reputación | `usuarios.maestro.reputacion` | En cada calificación y al moderar | Transacción con la calificación; al moderar, `$group` la recalcula |
| Reseñas recientes | `usuarios.maestro.resenas_recientes` | En cada calificación | `$slice: 5`; el validador rechaza un sexto elemento |

## 4. Integridad: lo que hacía el modelo relacional y quién lo hace ahora

| Regla en SQL | En MongoDB |
|---|---|
| `CHECK` de formato, rango y estado | `$jsonSchema` (`pattern`, `minimum`, `maximum`, `enum`) |
| `CHECK` de mayoría de edad | `$expr` con `$$NOW` en el validador |
| `UNIQUE (email)` | Índice único `uq_usuario_email` |
| `UNIQUE (id_solicitud)` en calificación | Por construcción: la calificación está dentro de la solicitud |
| `ON DELETE CASCADE` | Por construcción: se borra con su solicitud |
| `FOREIGN KEY` y `ON DELETE RESTRICT` | No existen: la API cuenta antes de borrar (`countDocuments`) |
| Transacción SQL | Transacción multidocumento (replica set; Atlas lo trae) |
