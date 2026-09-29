-- =============================================================================
-- GRUPO 13 - PLUMB
-- Base de Datos: PlumbDB (MySQL)
-- Integrantes: Vicente Fernández, Maximiliano Sepúlveda, Vicente Cid
-- Asignatura: ICI324 Bases de Datos y Programación Web
-- Universidad de Valparaíso
-- =============================================================================

-- =============================================
-- SECCIÓN 1: CREACIÓN DE LA BASE DE DATOS
-- =============================================
CREATE DATABASE IF NOT EXISTS PlumbDB;
USE PlumbDB;

-- =============================================
-- SECCIÓN 2: DEFINICIÓN DE TABLAS (DDL)
-- Orden de creación respeta las dependencias FK
-- =============================================

-- Tabla REGION: Almacena las regiones geográficas donde operan los maestros
CREATE TABLE IF NOT EXISTS REGION (
    Id_region    INT          AUTO_INCREMENT NOT NULL,
    Nombre       VARCHAR(100) NOT NULL,
    PRIMARY KEY (Id_region)
);

-- Tabla OFICIO: Catálogo de especialidades/oficios disponibles
CREATE TABLE IF NOT EXISTS OFICIO (
    Id_oficio    INT          AUTO_INCREMENT NOT NULL,
    Nombre       VARCHAR(100) NOT NULL,
    Descripcion  VARCHAR(255) NULL,
    PRIMARY KEY (Id_oficio)
);

-- Tabla CLIENTE: Usuarios que solicitan servicios
CREATE TABLE IF NOT EXISTS CLIENTE (
    Rut              VARCHAR(12)  NOT NULL,
    Nombre           VARCHAR(200) NOT NULL,
    fecha_nacimiento DATE         NULL,
    PRIMARY KEY (Rut)
);

-- Tabla MAESTRO: Prestadores de servicios de oficios
-- FK a REGION y OFICIO con ON DELETE RESTRICT (protege el catálogo)
CREATE TABLE IF NOT EXISTS MAESTRO (
    Rut              VARCHAR(12)  NOT NULL,
    Nombre           VARCHAR(200) NOT NULL,
    Disponibilidad   BOOLEAN      NOT NULL DEFAULT TRUE,
    Id_region        INT          NOT NULL,
    Id_oficio        INT          NOT NULL,
    PRIMARY KEY (Rut),
    FOREIGN KEY (Id_region) REFERENCES REGION(Id_region) ON DELETE RESTRICT,
    FOREIGN KEY (Id_oficio) REFERENCES OFICIO(Id_oficio) ON DELETE RESTRICT
);

-- Tabla SOLICITUD: Transacción que vincula Cliente-Maestro-Solicitud
-- FK a CLIENTE y MAESTRO con ON DELETE RESTRICT (protege historial)
CREATE TABLE IF NOT EXISTS SOLICITUD (
    Id_solicitud INT            AUTO_INCREMENT NOT NULL,
    Descripcion  TEXT           NOT NULL,
    Estado       VARCHAR(50)    NOT NULL DEFAULT 'Pendiente',
    Fecha        DATE           NOT NULL,
    Rut_cliente  VARCHAR(12)    NOT NULL,
    Rut_maestro  VARCHAR(12)    NOT NULL,
    PRIMARY KEY (Id_solicitud),
    FOREIGN KEY (Rut_cliente) REFERENCES CLIENTE(Rut) ON DELETE RESTRICT,
    FOREIGN KEY (Rut_maestro) REFERENCES MAESTRO(Rut) ON DELETE RESTRICT
);

-- Tabla CALIFICACION: Evaluación del servicio (relación 1:1 con Solicitud)
-- FK a SOLICITUD con ON DELETE CASCADE (limpieza automática de calificaciones)
-- UNIQUE en Id_solicitud para garantizar relación 1:1
CREATE TABLE IF NOT EXISTS CALIFICACION (
    Id_calificacion INT          AUTO_INCREMENT NOT NULL,
    puntuacion      INT          NOT NULL,
    Fecha           DATE         NOT NULL,
    Comentario      TEXT         NULL,
    Id_solicitud    INT          NOT NULL,
    Rut_cliente     VARCHAR(12)  NOT NULL,
    Rut_maestro     VARCHAR(12)  NOT NULL,
    PRIMARY KEY (Id_calificacion),
    UNIQUE (Id_solicitud),
    CHECK (puntuacion BETWEEN 1 AND 5),
    FOREIGN KEY (Id_solicitud) REFERENCES SOLICITUD(Id_solicitud) ON DELETE CASCADE,
    FOREIGN KEY (Rut_cliente)  REFERENCES CLIENTE(Rut)             ON DELETE CASCADE,
    FOREIGN KEY (Rut_maestro)  REFERENCES MAESTRO(Rut)             ON DELETE CASCADE
);

-- Tabla temporal para demostrar el DROP (se creará y luego se eliminará)
CREATE TABLE IF NOT EXISTS LOGS_TEMPORALES (
    Id_log   INT          AUTO_INCREMENT PRIMARY KEY,
    mensaje  VARCHAR(255),
    fecha    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);


-- =============================================================================
-- SECCIÓN 3: DATOS SEMILLA (Población inicial para demostraciones)
-- =============================================================================

-- Regiones
INSERT INTO REGION (Nombre) VALUES 
    ('Valparaíso'),
    ('Metropolitana'),
    ('Biobío'),
    ('O''Higgins');

-- Oficios
INSERT INTO OFICIO (Nombre, Descripcion) VALUES 
    ('Gasfíter',     'Especialista en instalaciones de gas y cañerías'),
    ('Carpintero',   'Especialista en fabricación y reparación de muebles de madera'),
    ('Electricista', 'Especialista en instalaciones y reparaciones eléctricas'),
    ('Pintor',       'Especialista en pintura de interiores y exteriores');

-- Clientes
INSERT INTO CLIENTE (Rut, Nombre, fecha_nacimiento) VALUES 
    ('12345678-9', 'Juan Pérez López',     '1990-05-15'),
    ('11222333-4', 'María González Rojas',  '1985-11-20'),
    ('15678901-2', 'Carlos Muñoz Díaz',     '1992-03-08');

-- Maestros
INSERT INTO MAESTRO (Rut, Nombre, Disponibilidad, Id_region, Id_oficio) VALUES 
    ('98765432-1', 'Pedro González Soto',   TRUE,  1, 1),
    ('87654321-0', 'Ana Martínez Reyes',    TRUE,  2, 2),
    ('76543210-9', 'Roberto Silva Campos',  FALSE, 1, 3),
    ('65432109-8', 'Francisco López Vera',  TRUE,  3, 1);

-- Solicitudes
INSERT INTO SOLICITUD (Descripcion, Estado, Fecha, Rut_cliente, Rut_maestro) VALUES 
    ('Reparación de cañería rota en baño principal',         'Finalizado', '2024-10-15', '12345678-9', '98765432-1'),
    ('Instalación de mueble de cocina a medida',             'Pendiente',  '2024-10-18', '11222333-4', '87654321-0'),
    ('Revisión de instalación eléctrica en departamento',    'Aceptada',   '2024-10-20', '15678901-2', '76543210-9'),
    ('Reparación de llave de paso en cocina',                'Pendiente',  '2024-10-22', '11222333-4', '98765432-1');

-- Calificaciones
INSERT INTO CALIFICACION (puntuacion, Fecha, Comentario, Id_solicitud, Rut_cliente, Rut_maestro) VALUES 
    (5, '2024-10-16', 'Excelente trabajo, muy puntual y profesional.', 1, '12345678-9', '98765432-1');

-- Log temporal de prueba (para la consulta DROP)
INSERT INTO LOGS_TEMPORALES (mensaje) VALUES ('Registro de prueba para demostración de DROP');


-- =============================================================================
-- SECCIÓN 4: LAS 13 CONSULTAS CRUD OBLIGATORIAS
-- =============================================================================

-- ─────────────────────────────────────────────
-- CONSULTA 1 (DROP): Eliminar tabla temporal
-- ─────────────────────────────────────────────
DROP TABLE IF EXISTS LOGS_TEMPORALES;


-- ─────────────────────────────────────────────
-- CONSULTA 2 (ALTER 1 de 2): Agregar columna Telefono a la tabla CLIENTE
-- Justificación: Necesario para el contacto directo entre cliente y maestro
-- ─────────────────────────────────────────────
ALTER TABLE CLIENTE ADD COLUMN Telefono VARCHAR(15) NULL;


-- ─────────────────────────────────────────────
-- CONSULTA 3 (ALTER 2 de 2): Modificar longitud de Estado en SOLICITUD
-- Justificación: Permitir estados más descriptivos
-- ─────────────────────────────────────────────
ALTER TABLE SOLICITUD MODIFY COLUMN Estado VARCHAR(100) NOT NULL DEFAULT 'Pendiente';


-- ─────────────────────────────────────────────
-- CONSULTA 4 (INSERT 1 de 3): Insertar un nuevo cliente
-- ─────────────────────────────────────────────
INSERT INTO CLIENTE (Rut, Nombre, fecha_nacimiento, Telefono) 
VALUES ('20345678-5', 'Daniela Reyes Urbina', '1998-07-12', '+56987654321');


-- ─────────────────────────────────────────────
-- CONSULTA 5 (INSERT 2 de 3): Insertar un nuevo maestro
-- ─────────────────────────────────────────────
INSERT INTO MAESTRO (Rut, Nombre, Disponibilidad, Id_region, Id_oficio) 
VALUES ('54321098-7', 'Miguel Ángel Torres', TRUE, 2, 4);


-- ─────────────────────────────────────────────
-- CONSULTA 6 (INSERT 3 de 3): Insertar una nueva solicitud (Transacción)
-- Relaciona 3 entidades: Cliente + Maestro + Solicitud
-- ─────────────────────────────────────────────
INSERT INTO SOLICITUD (Descripcion, Estado, Fecha, Rut_cliente, Rut_maestro) 
VALUES ('Pintura completa del living y comedor', 'Pendiente', '2024-11-01', '20345678-5', '54321098-7');


-- ─────────────────────────────────────────────
-- CONSULTA 7 (UPDATE 1 de 2): Actualizar disponibilidad de un maestro
-- ─────────────────────────────────────────────
UPDATE MAESTRO 
SET Disponibilidad = FALSE 
WHERE Rut = '98765432-1';


-- ─────────────────────────────────────────────
-- CONSULTA 8 (UPDATE 2 de 2): Cambiar el estado de una solicitud
-- ─────────────────────────────────────────────
UPDATE SOLICITUD 
SET Estado = 'Aceptada' 
WHERE Id_solicitud = 2;


-- ─────────────────────────────────────────────
-- CONSULTA 9 (DELETE 1 de 2): Eliminar una solicitud pendiente
-- ─────────────────────────────────────────────
DELETE FROM SOLICITUD 
WHERE Id_solicitud = 5;


-- ─────────────────────────────────────────────
-- CONSULTA 10 (DELETE 2 de 2): Eliminar un cliente sin historial
-- ─────────────────────────────────────────────
DELETE FROM CLIENTE 
WHERE Rut = '20345678-5';


-- ─────────────────────────────────────────────
-- CONSULTA 11 (SELECT simple 1 de 3): Maestros disponibles
-- ─────────────────────────────────────────────
-- Álgebra Relacional:
--   σ_{Disponibilidad = TRUE}(MAESTRO)
-- ─────────────────────────────────────────────
SELECT Rut, Nombre, Disponibilidad 
FROM MAESTRO 
WHERE Disponibilidad = TRUE;


-- ─────────────────────────────────────────────
-- CONSULTA 12 (SELECT con JOIN 2 de 3): Catálogo de maestros con oficio y región
-- Consulta principal del Caso de Uso "Consulta con Filtros"
-- ─────────────────────────────────────────────
-- Álgebra Relacional:
--   π_{M.Rut, M.Nombre, O.Nombre, R.Nombre, M.Disponibilidad}(
--     MAESTRO ⨝_{M.Id_oficio = O.Id_oficio} OFICIO 
--     ⨝_{M.Id_region = R.Id_region} REGION
--   )
-- ─────────────────────────────────────────────
SELECT 
    M.Rut, 
    M.Nombre       AS Maestro, 
    O.Nombre       AS Oficio, 
    R.Nombre       AS Region, 
    M.Disponibilidad
FROM MAESTRO M
INNER JOIN OFICIO O ON M.Id_oficio = O.Id_oficio
INNER JOIN REGION R ON M.Id_region = R.Id_region;


-- ─────────────────────────────────────────────
-- CONSULTA 13 (SELECT con JOIN 3 de 3): Solicitudes con nombres de cliente y maestro
-- Consulta principal del Caso de Uso "Transacción"
-- ─────────────────────────────────────────────
-- Álgebra Relacional:
--   π_{S.Id_solicitud, S.Descripcion, S.Estado, S.Fecha, C.Nombre, M.Nombre}(
--     SOLICITUD ⨝_{S.Rut_cliente = C.Rut} CLIENTE 
--     ⨝_{S.Rut_maestro = M.Rut} MAESTRO
--   )
-- ─────────────────────────────────────────────
SELECT 
    S.Id_solicitud,
    S.Descripcion,
    S.Estado, 
    S.Fecha,
    C.Nombre       AS Cliente, 
    M.Nombre       AS Maestro
FROM SOLICITUD S
INNER JOIN CLIENTE C ON S.Rut_cliente = C.Rut
INNER JOIN MAESTRO M ON S.Rut_maestro = M.Rut;
