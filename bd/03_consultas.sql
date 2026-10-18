-- Plumb · Grupo 13 · ICI324
-- 03_consultas.sql — las 13 consultas exigidas en la Etapa I
--   2 ALTER · 3 SELECT (2 con JOIN) · 2 UPDATE · 3 INSERT · 2 DELETE · 1 DROP
--
-- Todo corre dentro de una transacción que termina en ROLLBACK, así el script
-- se puede ejecutar las veces que se quiera sin alterar los datos de ejemplo.
-- Para dejar los cambios aplicados, cambiar el ROLLBACK final por COMMIT.
--
-- Cada consulta también se ejecuta desde la aplicación: la línea "Endpoint"
-- indica qué ruta de la API usa la misma sentencia (con parámetros $1, $2...).
--
-- Notación de álgebra relacional: σ selección · π proyección · ⨝ join natural
-- o theta · ⟕ left outer join · γ agrupación (álgebra extendida) · ∧ y lógico.

BEGIN;


-- 1 · ALTER — registrar cuándo responde el maestro
-- Permite medir el tiempo entre que llega una solicitud y el maestro la
-- acepta o rechaza: es el indicador del objetivo de negocio ("reducir los
-- tiempos de conexión"). Queda nula mientras la solicitud está pendiente.
-- Endpoint: POST /api/v1/consultas/1/ejecuciones (laboratorio)
ALTER TABLE solicitud
    ADD COLUMN fecha_respuesta TIMESTAMPTZ NULL;


-- 2 · ALTER — tope de tarifa por hora
-- Evita errores de digitación del tipo 1.500.000 en vez de 15.000, que
-- arruinarían el filtro de precio del catálogo.
-- Endpoint: POST /api/v1/consultas/2/ejecuciones (laboratorio)
ALTER TABLE maestro
    ADD CONSTRAINT ck_maestro_tarifa_max CHECK (tarifa_hora <= 150000);


-- 3 · SELECT con JOIN — catálogo con filtros (Caso de uso Consulta)
-- Filtros obligatorios: región y oficio. Opcionales: tarifa máxima,
-- calificación mínima, disponibilidad y años de experiencia.
-- Endpoint: GET /api/v1/catalogo?region=6&oficio=1&tarifaMax=25000&calificacionMin=4&disponible=true&experienciaMin=3
-- (en la API los filtros opcionales se escriben ($n IS NULL OR condición): una sola sentencia
-- parametrizada sirve para cualquier combinación de filtros, sin concatenar SQL)
--
-- REP ← γ rut_maestro; AVG(puntuacion)→promedio, COUNT(*)→total_resenas
--         (CALIFICACION ⨝ SOLICITUD)
-- π m.rut_maestro, m.nombre, o.nombre, r.nombre, m.tarifa_hora,
--   m.experiencia_anios, m.disponible, promedio (
--   σ m.id_region=6 ∧ m.id_oficio=1 ∧ m.tarifa_hora≤25000 ∧ promedio≥4
--     ∧ m.disponible=TRUE ∧ m.experiencia_anios≥3 (
--       ((MAESTRO ⨝ OFICIO) ⨝ REGION) ⟕ REP ))
SELECT m.rut_maestro,
       m.nombre,
       o.nombre                   AS oficio,
       r.nombre                   AS region,
       m.tarifa_hora,
       m.experiencia_anios,
       m.disponible,
       COALESCE(v.promedio, 0)      AS promedio,
       COALESCE(v.total_resenas, 0) AS total_resenas
FROM maestro m
JOIN oficio o ON o.id_oficio = m.id_oficio
JOIN region r ON r.id_region = m.id_region
LEFT JOIN v_reputacion_maestro v ON v.rut_maestro = m.rut_maestro
WHERE m.id_region = 6
  AND m.id_oficio = 1
  AND m.tarifa_hora <= 25000
  AND COALESCE(v.promedio, 0) >= 4
  AND m.disponible = TRUE
  AND m.experiencia_anios >= 3
ORDER BY promedio DESC, m.tarifa_hora;


-- 4 · SELECT con JOIN — historial de solicitudes de un cliente (Caso de uso Transacción)
-- Reúne las tres entidades de la transacción: Solicitud, Cliente y Maestro.
-- La calificación entra con LEFT JOIN porque es opcional (relación 1:0..1):
-- una solicitud pendiente todavía no tiene nota y igual debe aparecer.
-- Endpoint: GET /api/v1/solicitudes?cliente=12588772-4
--
-- π id_solicitud, fecha_solicitud, estado, descripcion,
--   cliente, maestro, puntuacion (
--   σ s.rut_cliente='12588772-4' (
--     ((SOLICITUD ⨝ CLIENTE) ⨝ MAESTRO) ⟕ CALIFICACION ))
SELECT s.id_solicitud,
       s.fecha_solicitud,
       s.estado,
       s.descripcion,
       c.nombre AS cliente,
       m.nombre AS maestro,
       k.puntuacion
FROM solicitud s
JOIN cliente c ON c.rut_cliente = s.rut_cliente
JOIN maestro m ON m.rut_maestro = s.rut_maestro
LEFT JOIN calificacion k ON k.id_solicitud = s.id_solicitud
WHERE s.rut_cliente = '12588772-4'
ORDER BY s.fecha_solicitud DESC;


-- 5 · SELECT simple — bandeja de entrada del maestro
-- Solicitudes que el maestro todavía no responde, de la más antigua a la más nueva.
-- Endpoint: GET /api/v1/maestros/7765180-2/solicitudes?estado=Pendiente
--
-- π id_solicitud, descripcion, direccion, fecha_servicio, fecha_solicitud (
--   σ rut_maestro='7765180-2' ∧ estado='Pendiente' (SOLICITUD))
SELECT id_solicitud,
       descripcion,
       direccion,
       fecha_servicio,
       fecha_solicitud
FROM solicitud
WHERE rut_maestro = '7765180-2'
  AND estado = 'Pendiente'
ORDER BY fecha_solicitud;


-- 6 · UPDATE — el maestro acepta una solicitud
-- La condición sobre el estado impide aceptar algo ya rechazado o cancelado.
-- Endpoint: PATCH /api/v1/solicitudes/2   { "estado": "Aceptada" }
UPDATE solicitud
SET estado = 'Aceptada'
WHERE id_solicitud = 2
  AND estado = 'Pendiente'
RETURNING id_solicitud, estado;


-- 7 · UPDATE — el maestro vuelve a estar disponible y ajusta su tarifa (Mantenedor 1)
-- Endpoint: PATCH /api/v1/maestros/7559934-K
UPDATE maestro
SET disponible  = TRUE,
    tarifa_hora = 21000
WHERE rut_maestro = '7559934-K'
RETURNING rut_maestro, nombre, disponible, tarifa_hora;


-- 8 · INSERT — registro de un cliente nuevo
-- La BD rechaza el registro si es menor de 18 años (ck_cliente_mayor_edad).
-- Endpoint: POST /api/v1/clientes
INSERT INTO cliente (rut_cliente, nombre, email, telefono, fecha_nacimiento)
VALUES ('20345678-6', 'Tomás Henríquez Salas', 'tomas.henriquez@ejemplo.cl', '+56987654321', '2001-04-22')
RETURNING rut_cliente, nombre, fecha_registro;


-- 9 · INSERT — alta de un maestro (Mantenedor 1)
-- Endpoint: POST /api/v1/maestros
INSERT INTO maestro (rut_maestro, nombre, email, telefono, fecha_nacimiento,
                     id_oficio, id_region, tarifa_hora, experiencia_anios, disponible, descripcion)
VALUES ('16234567-2', 'Gabriel Morales Iturra', 'gabriel.morales@ejemplo.cl', '+56912345678', '1990-09-03',
        4, 6, 15000, 7, TRUE, 'Pintura de interiores y fachadas en Viña y Valparaíso.')
RETURNING rut_maestro, nombre, id_oficio, id_region;


-- 10 · INSERT — nueva solicitud de servicio (transacción Cliente–Maestro–Solicitud)
-- El estado queda en 'Pendiente' por el valor por defecto de la columna.
-- Endpoint: POST /api/v1/solicitudes
INSERT INTO solicitud (rut_cliente, rut_maestro, descripcion, direccion, fecha_servicio)
VALUES ('13345441-1', '16178972-0',
        'El estanque del WC se queda corriendo y sube la cuenta del agua.',
        'Av. Libertad 1180, Viña del Mar', CURRENT_DATE + 2)
RETURNING id_solicitud, estado, fecha_solicitud;


-- 11 · DELETE — moderación: eliminar una solicitud falsa
-- Por ON DELETE CASCADE, su calificación se borra en la misma operación y
-- el promedio del maestro deja de considerarla.
-- Endpoint: DELETE /api/v1/solicitudes/6
DELETE FROM solicitud
WHERE id_solicitud = 6
RETURNING id_solicitud, rut_maestro, estado;


-- 12 · DELETE — quitar un oficio que nadie ofrece (Mantenedor 2)
-- 'Vidriero' no tiene maestros. Si los tuviera, ON DELETE RESTRICT bloquearía el borrado.
-- Endpoint: DELETE /api/v1/oficios/10
DELETE FROM oficio
WHERE id_oficio = 10
RETURNING id_oficio, nombre;


-- 13 · DROP — eliminar la tabla de carga temporal
-- carga_maestros es un área de paso para importar maestros desde una planilla
-- (CSV). Una vez copiados a MAESTRO ya no se necesita.
-- Endpoint: POST /api/v1/consultas/13/ejecuciones (laboratorio)
CREATE TABLE IF NOT EXISTS carga_maestros (
    rut     VARCHAR(10),
    nombre  VARCHAR(120),
    oficio  VARCHAR(60),
    region  VARCHAR(60)
);
DROP TABLE IF EXISTS carga_maestros;


ROLLBACK;
