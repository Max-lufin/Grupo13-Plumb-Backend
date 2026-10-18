# nosql

Modelo de documentos de Plumb en MongoDB (Etapa II). Las mismas 6 tablas de `bd/`, pasadas a colecciones según las consultas que más usa la aplicación.

| Archivo | Qué es |
|---|---|
| `esquema.cjs` | Las 6 colecciones: validador `$jsonSchema` e índices de cada una |
| `ejemplos/*.json` | Un documento real por colección, en Extended JSON (sirve para `mongoimport`) |
| `consultas.mongodb.js` | Las 13 consultas de la Etapa I en MQL; se ejecuta con mongosh y no deja cambios |

## Ejecutar

```bash
# MongoDB local (replica set de un nodo: las transacciones lo necesitan)
docker run -d --name plumb-mongo -p 27019:27017 mongo:8 --replSet rs0 --bind_ip_all
docker exec plumb-mongo mongosh --quiet --eval "rs.initiate({_id:'rs0',members:[{_id:0,host:'localhost:27017'}]})"

cd backend
# en .env: MONGODB_URI=mongodb://localhost:27019/?directConnection=true (o la URI de Atlas)
npm run mongo:migrar        # lee PostgreSQL, crea las colecciones y exporta ejemplos/
mongosh "$MONGODB_URI" --file ../nosql/consultas.mongodb.js
```

En la aplicación, la pantalla **Modelo NoSQL** (`/nosql`) muestra los documentos y ejecuta cada consulta en los dos motores.

## 1. Consultas que guían el modelo

| | Consulta | Pantalla | Frecuencia | Índice |
|---|---|---|---|---|
| Q1 | Catálogo por región y oficio, con 4 filtros opcionales | Catálogo | La más usada: cada búsqueda | `ix_catalogo` |
| Q2 | Perfil del maestro con sus reseñas | Perfil | Cada visita a un maestro | `_id` |
| Q3 | Bandeja del maestro (pendientes, de la más antigua) | Mis solicitudes | Varias veces al día por maestro | `ix_bandeja` |
| Q4 | Historial del cliente | Mis solicitudes | Cada visita del cliente | `ix_historial` |
| Q5 | Ranking de los mejor evaluados | Inicio | Cada visita a la portada | `ix_ranking` |

## 2. Destino de cada tabla

| Tabla (PostgreSQL) | Destino (MongoDB) | Decisión | Por qué |
|---|---|---|---|
| `region` | `regiones` y copia en `maestros.region` | Referencia extendida | Catálogo fijo de 16 filas; copiar el nombre evita un `$lookup` en Q1 |
| `oficio` | `oficios` y copia en `maestros.oficio` | Referencia extendida | Tiene mantenedor; se copia solo el nombre, que casi nunca cambia |
| `cliente` | `clientes` | Colección propia | Se registra y consulta por separado; su nombre se copia en cada solicitud |
| `maestro` | `maestros` | Colección propia (patrones calculado y subconjunto) | Lo más leído: guarda su reputación y sus 5 reseñas recientes |
| `solicitud` | `solicitudes` | Colección propia con referencias extendidas | Crece sin límite: embebida sería un arreglo sin tope |
| `calificacion` | `solicitudes.calificacion` | Embebida | 1:0..1, se lee con su solicitud y muere con ella |
| `v_reputacion_maestro` | `maestros.reputacion` | Patrón calculado | Q1 y Q5 filtran y ordenan por promedio: así usan índice |
| SERIAL de `id_solicitud` | `contadores` | Colección técnica | Folio correlativo con `findOneAndUpdate` + `$inc` |

## 3. Embeber o referenciar, relación por relación

| Relación | Cardinalidad | Decisión | La consulta que lo decide |
|---|---|---|---|
| Maestro → Oficio | N:1 | Referencia extendida `{ _id, nombre }` | Q1 filtra por oficio y muestra su nombre |
| Maestro → Región | N:1 | Referencia extendida `{ _id, nombre }` | Q1 filtra por región y la muestra |
| Solicitud → Cliente | N:1 | Referencia extendida `{ _id, nombre }` | Q3 y Q4 muestran el nombre sin JOIN |
| Solicitud → Maestro | N:1 | Referencia extendida `{ _id, nombre }` | Q4 muestra el maestro de cada trabajo |
| Solicitud → Calificación | 1:0..1 | Embebida | Q4 muestra la nota de cada solicitud |
| Maestro → Calificaciones | 1:N, sin tope | Subconjunto: solo las 5 últimas en el maestro | Q2 pinta el perfil con una lectura |

## 4. El costo de copiar datos

| Dato copiado | Dónde | Cuándo cambia | Cómo se mantiene |
|---|---|---|---|
| Nombre de la región | `maestros.region.nombre` | Nunca | — |
| Nombre del oficio | `maestros.oficio.nombre` | Al renombrar un oficio | `updateMany` en la misma transacción |
| Nombre de cliente y maestro | `solicitudes.cliente.nombre`, `solicitudes.maestro.nombre` | Si corrigen su nombre | `updateMany` por `_id` |
| Reputación | `maestros.reputacion` | En cada calificación | Transacción junto con la calificación |
| Reseñas recientes | `maestros.resenas_recientes` | En cada calificación | `$slice: 5`; el validador rechaza un sexto elemento |

## 5. Integridad: lo que hacía PostgreSQL y quién lo hace ahora

| Regla en SQL | En MongoDB |
|---|---|
| `CHECK` de formato, rango y estado | `$jsonSchema` (`pattern`, `minimum`, `maximum`, `enum`) |
| `CHECK` de mayoría de edad | `$expr` con `$$NOW` en el validador |
| `UNIQUE (email)` | Índice único |
| `UNIQUE (id_solicitud)` en calificación | Por construcción: la calificación está dentro de la solicitud |
| `ON DELETE CASCADE` | Por construcción: se borra con su solicitud |
| `FOREIGN KEY` y `ON DELETE RESTRICT` | No existen: la API cuenta antes de borrar (`countDocuments`) |
| Transacción SQL | Transacción multi-documento (necesita replica set; Atlas lo trae) |
