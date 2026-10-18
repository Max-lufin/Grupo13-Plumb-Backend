-- Plumb · Grupo 13 · ICI324 Bases de Datos y Programación Web (UV)
-- 01_esquema.sql — estructura de la base de datos (PostgreSQL 17)
--
-- Orden de creación: primero las tablas sin claves foráneas (region, oficio,
-- cliente), después las que dependen de ellas (maestro, solicitud, calificacion).

DROP VIEW  IF EXISTS v_reputacion_maestro;
DROP TABLE IF EXISTS calificacion, solicitud, maestro, cliente, oficio, region CASCADE;


-- Catálogo fijo: las 16 regiones de Chile. No tiene mantenedor porque la
-- división político-administrativa no cambia desde la aplicación.
CREATE TABLE region (
    id_region   SMALLINT     PRIMARY KEY,
    codigo      VARCHAR(4)   NOT NULL UNIQUE,
    nombre      VARCHAR(60)  NOT NULL UNIQUE
);


-- Categorías de servicio (Mantenedor 2).
CREATE TABLE oficio (
    id_oficio    INTEGER      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre       VARCHAR(60)  NOT NULL UNIQUE,
    descripcion  VARCHAR(255)
);


CREATE TABLE cliente (
    rut_cliente       VARCHAR(10)   PRIMARY KEY,
    nombre            VARCHAR(120)  NOT NULL,
    email             VARCHAR(120)  NOT NULL UNIQUE,
    telefono          VARCHAR(15),
    fecha_nacimiento  DATE          NOT NULL,
    fecha_registro    TIMESTAMPTZ   NOT NULL DEFAULT now(),

    CONSTRAINT ck_cliente_rut        CHECK (rut_cliente ~ '^[0-9]{7,8}-[0-9K]$'),
    CONSTRAINT ck_cliente_email      CHECK (email ~* '^[^@\s]+@[^@\s]+\.[a-z]{2,}$'),
    CONSTRAINT ck_cliente_mayor_edad CHECK (fecha_nacimiento <= CURRENT_DATE - INTERVAL '18 years')
);


-- Prestadores de servicio (Mantenedor 1). Un maestro ejerce un oficio
-- principal en una región (supuesto S1 del informe).
CREATE TABLE maestro (
    rut_maestro        VARCHAR(10)   PRIMARY KEY,
    nombre             VARCHAR(120)  NOT NULL,
    email              VARCHAR(120)  NOT NULL UNIQUE,
    telefono           VARCHAR(15)   NOT NULL,
    fecha_nacimiento   DATE          NOT NULL,
    id_oficio          INTEGER       NOT NULL,
    id_region          SMALLINT      NOT NULL,
    tarifa_hora        INTEGER       NOT NULL,
    experiencia_anios  SMALLINT      NOT NULL DEFAULT 0,
    disponible         BOOLEAN       NOT NULL DEFAULT TRUE,
    descripcion        VARCHAR(500),
    fecha_registro     TIMESTAMPTZ   NOT NULL DEFAULT now(),

    CONSTRAINT fk_maestro_oficio FOREIGN KEY (id_oficio)
        REFERENCES oficio (id_oficio) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_maestro_region FOREIGN KEY (id_region)
        REFERENCES region (id_region) ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT ck_maestro_rut         CHECK (rut_maestro ~ '^[0-9]{7,8}-[0-9K]$'),
    CONSTRAINT ck_maestro_email       CHECK (email ~* '^[^@\s]+@[^@\s]+\.[a-z]{2,}$'),
    CONSTRAINT ck_maestro_mayor_edad  CHECK (fecha_nacimiento <= CURRENT_DATE - INTERVAL '18 years'),
    CONSTRAINT ck_maestro_tarifa      CHECK (tarifa_hora > 0),
    CONSTRAINT ck_maestro_experiencia CHECK (experiencia_anios BETWEEN 0 AND 60)
);


-- Transacción central: relaciona Cliente, Maestro y la propia Solicitud.
CREATE TABLE solicitud (
    id_solicitud     INTEGER        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    rut_cliente      VARCHAR(10)    NOT NULL,
    rut_maestro      VARCHAR(10)    NOT NULL,
    descripcion      VARCHAR(1000)  NOT NULL,
    direccion        VARCHAR(200)   NOT NULL,
    fecha_servicio   DATE           NOT NULL,
    estado           VARCHAR(12)    NOT NULL DEFAULT 'Pendiente',
    fecha_solicitud  TIMESTAMPTZ    NOT NULL DEFAULT now(),

    CONSTRAINT fk_solicitud_cliente FOREIGN KEY (rut_cliente)
        REFERENCES cliente (rut_cliente) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_solicitud_maestro FOREIGN KEY (rut_maestro)
        REFERENCES maestro (rut_maestro) ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT ck_solicitud_estado CHECK (estado IN ('Pendiente', 'Aceptada', 'Rechazada', 'Finalizada', 'Cancelada')),
    CONSTRAINT ck_solicitud_descripcion CHECK (char_length(btrim(descripcion)) >= 15)
);


-- Una calificación existe solo si existe la solicitud que evalúa (1:1).
-- El UNIQUE sobre id_solicitud impide calificar dos veces el mismo trabajo.
CREATE TABLE calificacion (
    id_calificacion  INTEGER       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_solicitud     INTEGER       NOT NULL,
    puntuacion       SMALLINT      NOT NULL,
    comentario       VARCHAR(500),
    fecha            TIMESTAMPTZ   NOT NULL DEFAULT now(),

    CONSTRAINT uq_calificacion_solicitud UNIQUE (id_solicitud),
    CONSTRAINT fk_calificacion_solicitud FOREIGN KEY (id_solicitud)
        REFERENCES solicitud (id_solicitud) ON DELETE CASCADE,
    CONSTRAINT ck_calificacion_puntuacion CHECK (puntuacion BETWEEN 1 AND 5)
);


-- Índices para las búsquedas frecuentes (RNF-03: respuesta < 1,5 s).
-- Las PK y los UNIQUE ya crean su propio índice.
CREATE INDEX ix_maestro_region_oficio ON maestro (id_region, id_oficio);
CREATE INDEX ix_solicitud_maestro     ON solicitud (rut_maestro, estado);
CREATE INDEX ix_solicitud_cliente     ON solicitud (rut_cliente);


-- Reputación derivada: no se guarda el promedio en maestro (evita datos
-- duplicados que se desincronicen); se calcula desde las calificaciones.
CREATE VIEW v_reputacion_maestro AS
SELECT s.rut_maestro,
       ROUND(AVG(c.puntuacion), 1) AS promedio,
       COUNT(*)                    AS total_resenas
FROM calificacion c
JOIN solicitud s ON s.id_solicitud = c.id_solicitud
GROUP BY s.rut_maestro;
