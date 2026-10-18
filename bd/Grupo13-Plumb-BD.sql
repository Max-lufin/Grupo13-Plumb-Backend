-- Plumb · Grupo 13 · ICI324 Bases de Datos y Programación Web (Universidad de Valparaíso)
-- Grupo13-Plumb-BD.sql — script completo: esquema, datos de ejemplo y las 13 consultas.
-- Integrantes: Vicente Fernández, Maximiliano Sepúlveda, Vicente Cid


-- ======================================================================
-- 01_esquema.sql
-- ======================================================================
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

-- ======================================================================
-- 02_datos.sql
-- ======================================================================
-- Plumb · Grupo 13 · ICI324
-- 02_datos.sql — datos de ejemplo (ficticios). Ejecutar después de 01_esquema.sql.

INSERT INTO region (id_region, codigo, nombre) VALUES
    (1, 'XV', 'Arica y Parinacota'),
    (2, 'I', 'Tarapacá'),
    (3, 'II', 'Antofagasta'),
    (4, 'III', 'Atacama'),
    (5, 'IV', 'Coquimbo'),
    (6, 'V', 'Valparaíso'),
    (7, 'RM', 'Metropolitana'),
    (8, 'VI', 'O''Higgins'),
    (9, 'VII', 'Maule'),
    (10, 'XVI', 'Ñuble'),
    (11, 'VIII', 'Biobío'),
    (12, 'IX', 'La Araucanía'),
    (13, 'XIV', 'Los Ríos'),
    (14, 'X', 'Los Lagos'),
    (15, 'XI', 'Aysén'),
    (16, 'XII', 'Magallanes');

INSERT INTO oficio (nombre, descripcion) VALUES
    ('Gasfíter', 'Cañerías, grifería, calefont y artefactos sanitarios.'),
    ('Electricista', 'Instalaciones domiciliarias, tableros y certificación SEC.'),
    ('Carpintero', 'Muebles a medida, puertas, closets y reparaciones en madera.'),
    ('Pintor', 'Pintura interior y exterior, empaste y preparación de superficies.'),
    ('Cerrajero', 'Apertura de puertas, cambio de chapas y copias de llaves.'),
    ('Albañil', 'Obras menores: radieres, muros, cerámica y estuco.'),
    ('Técnico línea blanca', 'Reparación de lavadoras, refrigeradores, hornos y secadoras.'),
    ('Jardinero', 'Mantención de jardines, poda y sistemas de riego.'),
    ('Techador', 'Techumbres, canaletas y filtraciones.'),
    ('Vidriero', 'Cambio de vidrios, ventanas y espejos.');

INSERT INTO cliente (rut_cliente, nombre, email, telefono, fecha_nacimiento) VALUES
    ('13345441-1', 'Juan Pérez López', 'juan.perez@ejemplo.cl', '+56923232218', '1980-11-22'),
    ('12588772-4', 'María González Rojas', 'maria.gonzalez@ejemplo.cl', NULL, '1980-01-14'),
    ('20478313-6', 'Carlos Muñoz Díaz', 'carlos.munoz@ejemplo.cl', '+56914762453', '2000-01-09'),
    ('17166905-7', 'Daniela Reyes Urbina', 'daniela.reyes@ejemplo.cl', '+56965159478', '1997-10-14'),
    ('19254047-K', 'Valentina Soto Aravena', 'valentina.soto@ejemplo.cl', '+56982432854', '1970-08-22'),
    ('15226236-1', 'Diego Fuentes Salgado', 'diego.fuentes@ejemplo.cl', '+56929783933', '1991-05-20'),
    ('20769995-0', 'Catalina Vidal Moreno', 'catalina.vidal@ejemplo.cl', '+56976060327', '1985-03-03'),
    ('20712687-K', 'José Miguel Rivas', 'jose.miguel@ejemplo.cl', '+56964535829', '1990-11-09'),
    ('12987259-4', 'Francisca Herrera Lobos', 'francisca.herrera@ejemplo.cl', '+56999059952', '1993-04-28'),
    ('13954732-2', 'Nicolás Castillo Peña', 'nicolas.castillo@ejemplo.cl', '+56913216988', '1974-03-26'),
    ('20662808-1', 'Paula Navarro Godoy', 'paula.navarro@ejemplo.cl', '+56918024164', '1964-08-27'),
    ('13512136-3', 'Cristóbal Araya Cortés', 'cristobal.araya@ejemplo.cl', NULL, '1998-10-23'),
    ('16883454-3', 'Javiera Palma Rebolledo', 'javiera.palma@ejemplo.cl', '+56905527888', '1995-06-28'),
    ('16956130-3', 'Martín Tapia Sanhueza', 'martin.tapia@ejemplo.cl', '+56906822463', '1976-11-07'),
    ('13337707-7', 'Constanza Flores Vega', 'constanza.flores@ejemplo.cl', '+56939463560', '1989-10-08'),
    ('14317270-8', 'Felipe Campos Urrutia', 'felipe.campos@ejemplo.cl', NULL, '1987-08-03');

INSERT INTO maestro (rut_maestro, nombre, email, telefono, fecha_nacimiento, id_oficio, id_region,
                     tarifa_hora, experiencia_anios, disponible, descripcion) VALUES
    ('7765180-2', 'Pedro González Soto', 'pedro.gonzalez@ejemplo.cl', '+56977865048', '1964-11-25', 1, 6, 22000, 18, TRUE, 'Gasfíter con certificación SEC para gas. Trabajo con boleta y garantía de 3 meses.'),
    ('14297438-K', 'Ana Martínez Reyes', 'ana.martinez@ejemplo.cl', '+56952344964', '1972-03-28', 3, 7, 16000, 4, TRUE, 'Muebles de cocina y closets a medida en melamina y madera nativa.'),
    ('7559934-K', 'Roberto Silva Campos', 'roberto.silva@ejemplo.cl', '+56979960584', '1986-03-04', 2, 6, 24000, 12, FALSE, 'Electricista autorizado SEC clase D. Tableros, enchufes y certificados TE1.'),
    ('9170232-0', 'Francisco López Vera', 'francisco.lopez@ejemplo.cl', '+56920321751', '1967-06-06', 1, 11, 27000, 35, TRUE, 'Destapes, fugas y cambio de calefont. Atiendo urgencias los fines de semana.'),
    ('12787682-7', 'Luis Muñoz Tapia', 'luis.munoz@ejemplo.cl', '+56938739690', '1980-04-02', 1, 6, 16000, 4, TRUE, 'Más de una década instalando grifería y artefactos sanitarios. Presupuesto sin costo.'),
    ('16178972-0', 'Claudia Rojas Fuentes', 'claudia.rojas@ejemplo.cl', '+56958642844', '1967-02-20', 1, 6, 19500, 9, TRUE, 'Reparaciones rápidas de cañerías de cobre y PPR. Llevo mis propios materiales.'),
    ('8457682-4', 'Jorge Contreras Sepúlveda', 'jorge.contreras@ejemplo.cl', '+56901841562', '1987-01-01', 1, 6, 18000, 12, FALSE, 'Instalación de termos eléctricos y calefont. Trabajo limpio y ordenado.'),
    ('17437647-6', 'Patricio Morales Araya', 'patricio.morales@ejemplo.cl', '+56966764227', '1982-01-04', 1, 6, 27000, 25, TRUE, 'Gasfíter con certificación SEC para gas. Trabajo con boleta y garantía de 3 meses.'),
    ('12048663-2', 'Marcela Díaz Espinoza', 'marcela.diaz@ejemplo.cl', '+56945335627', '1964-09-01', 2, 6, 20000, 35, TRUE, 'Instalaciones nuevas y regularización de casas antiguas. Visita técnica gratuita en la comuna.'),
    ('13864956-3', 'Héctor Pizarro Valenzuela', 'hector.pizarro@ejemplo.cl', '+56973673090', '1980-03-15', 2, 6, 25000, 19, TRUE, 'Iluminación LED, automáticos y diferenciales. Respondo el mismo día.'),
    ('15085508-K', 'Cristián Herrera Castillo', 'cristian.herrera@ejemplo.cl', '+56992417980', '1996-03-05', 4, 6, 10000, 2, TRUE, 'Pintura de interiores con empaste incluido. Protejo muebles y pisos.'),
    ('10595367-4', 'Rodrigo Núñez Carrasco', 'rodrigo.nunez@ejemplo.cl', '+56924920864', '1991-01-18', 3, 6, 25000, 1, TRUE, 'Reparo puertas que no cierran, cajones y bisagras. Trabajos chicos también.'),
    ('10786894-1', 'Sergio Castro Olivares', 'sergio.castro@ejemplo.cl', '+56958809753', '1995-01-20', 5, 6, 22000, 2, TRUE, 'Aperturas sin daño a la puerta, 24 horas. Cambio de chapas de seguridad.'),
    ('17202688-5', 'Manuel Soto Bravo', 'manuel.soto@ejemplo.cl', '+56980152752', '1967-09-23', 9, 6, 16000, 28, TRUE, 'Goteras, canaletas y cambio de planchas. Reviso el techo antes del invierno.'),
    ('18431243-3', 'Daniela Gutiérrez Cortés', 'daniela.gutierrez@ejemplo.cl', '+56914222910', '1986-12-08', 1, 7, 24500, 10, TRUE, 'Destapes, fugas y cambio de calefont. Atiendo urgencias los fines de semana.'),
    ('16173195-1', 'Alejandro Reyes Figueroa', 'alejandro.reyes@ejemplo.cl', '+56975699798', '1973-10-24', 1, 7, 15500, 33, TRUE, 'Más de una década instalando grifería y artefactos sanitarios. Presupuesto sin costo.'),
    ('13943581-8', 'Mauricio Jara Navarro', 'mauricio.jara@ejemplo.cl', '+56961356917', '1968-08-17', 1, 7, 20500, 18, FALSE, 'Reparaciones rápidas de cañerías de cobre y PPR. Llevo mis propios materiales.'),
    ('13950768-1', 'Felipe Torres Salinas', 'felipe.torres@ejemplo.cl', '+56967901430', '1983-01-23', 2, 7, 22500, 15, TRUE, 'Reviso cortes de luz y sobrecargas. Explico todo antes de cobrar.'),
    ('9446075-1', 'Óscar Álvarez Riquelme', 'oscar.alvarez@ejemplo.cl', '+56984031121', '1998-06-10', 2, 7, 23000, 4, TRUE, 'Electricista autorizado SEC clase D. Tableros, enchufes y certificados TE1.'),
    ('16304074-3', 'Víctor Cárdenas Molina', 'victor.cardenas@ejemplo.cl', '+56902200369', '1988-11-07', 2, 7, 18500, 11, TRUE, 'Instalaciones nuevas y regularización de casas antiguas. Visita técnica gratuita en la comuna.'),
    ('9989484-9', 'Raúl Hernández Peña', 'raul.hernandez@ejemplo.cl', '+56982105908', '1990-12-03', 4, 7, 17000, 16, TRUE, 'Fachadas y rejas. Trabajo con látex y esmalte al agua.'),
    ('15740588-8', 'Eduardo Sandoval Aguilera', 'eduardo.sandoval@ejemplo.cl', '+56946434498', '1975-02-23', 4, 7, 13500, 25, FALSE, 'Tratamiento de humedad y hongos antes de pintar.'),
    ('14007716-K', 'Nelson Vergara Fernández', 'nelson.vergara@ejemplo.cl', '+56911201423', '1982-05-24', 3, 7, 17500, 23, TRUE, 'Carpintería de terminaciones: guardapolvos, marcos y repisas.'),
    ('17478277-6', 'Camila Ortiz Leiva', 'camila.ortiz@ejemplo.cl', '+56991098627', '1983-02-04', 7, 7, 22000, 16, TRUE, 'Reparo lavadoras y secadoras de todas las marcas. Repuestos originales.'),
    ('10914881-4', 'Ignacio Parra Saavedra', 'ignacio.parra@ejemplo.cl', '+56907114706', '1994-06-27', 5, 7, 20000, 6, TRUE, 'Cerrajería de autos y casas. Llego en menos de una hora dentro de la ciudad.'),
    ('9335714-0', 'Hugo Gallardo Zúñiga', 'hugo.gallardo@ejemplo.cl', '+56952660555', '1964-11-17', 6, 7, 14000, 9, TRUE, 'Cerámica de baños y cocinas, radieres y estucos.'),
    ('12854868-8', 'Carlos Mendoza Ríos', 'carlos.mendoza@ejemplo.cl', '+56992609617', '1976-02-05', 8, 7, 9500, 24, TRUE, 'Mantención mensual de jardines, poda y corte de pasto.'),
    ('13882887-5', 'Andrés Pino Toro', 'andres.pino@ejemplo.cl', '+56960665664', '1999-04-27', 9, 7, 19000, 2, TRUE, 'Techumbres de zinc y teja asfáltica. Trabajo en altura con equipo de seguridad.'),
    ('8348655-4', 'Gonzalo Alarcón Vidal', 'gonzalo.alarcon@ejemplo.cl', '+56998077188', '1999-04-13', 2, 11, 29500, 2, TRUE, 'Iluminación LED, automáticos y diferenciales. Respondo el mismo día.'),
    ('14589009-8', 'Fernanda Vera Escobar', 'fernanda.vera@ejemplo.cl', '+56936074605', '1973-09-02', 4, 11, 10000, 13, TRUE, 'Pintura de interiores con empaste incluido. Protejo muebles y pisos.'),
    ('10199068-0', 'Iván Bustos Cáceres', 'ivan.bustos@ejemplo.cl', '+56973696066', '1993-07-28', 3, 11, 16500, 10, TRUE, 'Diseño el mueble con el cliente y entrego en dos semanas.'),
    ('10720380-K', 'Ricardo Fuentes Medina', 'ricardo.fuentes@ejemplo.cl', '+56900789668', '1976-10-14', 1, 11, 15500, 7, FALSE, 'Instalación de termos eléctricos y calefont. Trabajo limpio y ordenado.'),
    ('9216829-8', 'Javier Guzmán Paredes', 'javier.guzman@ejemplo.cl', '+56971888007', '1993-02-16', 6, 11, 17000, 8, TRUE, 'Obras menores y ampliaciones. Trabajo con ayudante.'),
    ('17724100-8', 'Esteban Lagos Moya', 'esteban.lagos@ejemplo.cl', '+56968377060', '1975-04-24', 1, 5, 15500, 4, TRUE, 'Gasfíter con certificación SEC para gas. Trabajo con boleta y garantía de 3 meses.'),
    ('10391408-6', 'Tomás Retamal Ibarra', 'tomas.retamal@ejemplo.cl', '+56922202914', '1981-12-26', 2, 5, 24500, 16, TRUE, 'Reviso cortes de luz y sobrecargas. Explico todo antes de cobrar.'),
    ('9833408-4', 'Pablo Yáñez Garrido', 'pablo.yanez@ejemplo.cl', '+56993171191', '1994-04-22', 8, 5, 8000, 8, TRUE, 'Instalo riego automático y diseño jardines de bajo consumo de agua.'),
    ('13504312-5', 'Miguel Ángel Torres Díaz', 'miguel.torres@ejemplo.cl', '+56900693752', '1997-12-06', 4, 8, 14500, 4, TRUE, 'Fachadas y rejas. Trabajo con látex y esmalte al agua.'),
    ('14518283-2', 'Bastián Henríquez Orellana', 'bastian.henriquez@ejemplo.cl', '+56989186826', '1975-03-27', 1, 8, 24500, 8, TRUE, 'Destapes, fugas y cambio de calefont. Atiendo urgencias los fines de semana.'),
    ('17372448-9', 'Rosa Espinoza Valdés', 'rosa.espinoza@ejemplo.cl', '+56970177324', '1990-04-25', 7, 9, 19500, 10, TRUE, 'Refrigeradores no frost y hornos eléctricos. Diagnóstico en domicilio.'),
    ('7341423-7', 'Luis Alberto Carrasco Pinto', 'luis.carrasco@ejemplo.cl', '+56989092653', '1993-04-18', 1, 9, 25000, 5, TRUE, 'Más de una década instalando grifería y artefactos sanitarios. Presupuesto sin costo.'),
    ('14395600-8', 'Benjamín Salazar Ponce', 'benjamin.salazar@ejemplo.cl', '+56920570111', '1965-12-13', 1, 14, 16500, 18, TRUE, 'Reparaciones rápidas de cañerías de cobre y PPR. Llevo mis propios materiales.'),
    ('13121234-8', 'Matías Quiroz Lillo', 'matias.quiroz@ejemplo.cl', '+56997979078', '1969-10-25', 2, 12, 28000, 12, TRUE, 'Electricista autorizado SEC clase D. Tableros, enchufes y certificados TE1.'),
    ('7303073-0', 'Sebastián Muñoz Ahumada', 'sebastian.munoz@ejemplo.cl', '+56966193521', '1985-09-24', 1, 3, 16500, 12, TRUE, 'Instalación de termos eléctricos y calefont. Trabajo limpio y ordenado.');

-- Las cinco primeras solicitudes son casos fijos que usa el laboratorio de consultas:
--   1 finalizada y calificada · 2 pendiente (se acepta en la consulta U1)
--   3 aceptada · 4 pendiente (se cancela en la consulta D1) · 5 pendiente
INSERT INTO solicitud (rut_cliente, rut_maestro, descripcion, direccion, fecha_servicio, estado, fecha_solicitud) VALUES
    ('13345441-1', '7765180-2', 'Reparación de cañería rota en el baño principal, se filtra hacia el pasillo.', 'Av. Libertad 1180, Viña del Mar', '2026-08-18', 'Finalizada', '2026-08-17 14:27:00-03'),
    ('12588772-4', '14297438-K', 'Instalación de mueble de cocina a medida, bajo mesón de 1,8 metros.', 'Los Aromos 455, Ñuñoa', '2026-10-14', 'Pendiente', '2026-10-07 20:52:00-03'),
    ('20478313-6', '7559934-K', 'Revisión de la instalación eléctrica del departamento, saltan los automáticos.', 'Calle Valparaíso 820, Viña del Mar', '2026-10-10', 'Aceptada', '2026-10-03 17:46:00-03'),
    ('12588772-4', '7765180-2', 'Reparación de llave de paso en la cocina, no corta el agua del todo.', 'Errázuriz 2210, Valparaíso', '2026-10-13', 'Pendiente', '2026-10-08 08:41:00-03'),
    ('19254047-K', '7765180-2', 'El calefont no enciende, es a gas licuado y tiene unos 8 años.', 'Los Carrera 377, Quilpué', '2026-10-12', 'Pendiente', '2026-10-08 15:46:00-03'),
    ('12588772-4', '16173195-1', 'Instalar grifería nueva en el baño principal (ya la compré).', 'Pasaje Los Maitenes 197, Ñuñoa', '2026-06-29', 'Finalizada', '2026-06-20 10:12:00-03'),
    ('12588772-4', '18431243-3', 'Instalar grifería nueva en el baño principal (ya la compré).', 'Av. Grecia 853, Ñuñoa', '2026-06-29', 'Finalizada', '2026-06-21 16:33:00-03'),
    ('14317270-8', '17437647-6', 'Fuga de agua bajo el lavaplatos, gotea toda la noche.', 'Blanco Encalada 2963, Concón', '2026-06-27', 'Cancelada', '2026-06-25 16:41:00-03'),
    ('13337707-7', '15740588-8', 'Pintar living y comedor, aproximadamente 40 m2, colores claros.', 'Av. Pedro Montt 2481, Santiago', '2026-07-03', 'Finalizada', '2026-06-25 21:41:00-03'),
    ('12588772-4', '13943581-8', 'Fuga de agua bajo el lavaplatos, gotea toda la noche.', 'Pasaje Los Olmos 2627, Santiago', '2026-07-03', 'Finalizada', '2026-06-26 19:18:00-03'),
    ('13512136-3', '17202688-5', 'Gotera en el dormitorio cuando llueve fuerte.', 'El Roble 1563, Villa Alemana', '2026-07-05', 'Rechazada', '2026-06-28 13:33:00-03'),
    ('12588772-4', '9216829-8', 'Reparar muro de ladrillo con grietas en el patio.', 'Av. Matta 1611, Chiguayante', '2026-07-03', 'Finalizada', '2026-06-29 10:05:00-03'),
    ('19254047-K', '10720380-K', 'El estanque del WC se queda corriendo y sube la cuenta del agua.', 'Av. España 690, Chiguayante', '2026-07-03', 'Rechazada', '2026-06-29 16:27:00-03'),
    ('13337707-7', '13864956-3', 'El automático del tablero salta varias veces al día.', 'Freire 2864, Valparaíso', '2026-07-09', 'Finalizada', '2026-06-30 18:46:00-03'),
    ('13512136-3', '9170232-0', 'Reparación de la llave de paso de la cocina, no cierra del todo.', 'Errázuriz 1659, Los Ángeles', '2026-07-09', 'Finalizada', '2026-07-01 10:12:00-03'),
    ('13345441-1', '17202688-5', 'Gotera en el dormitorio cuando llueve fuerte.', 'Freire 1252, Viña del Mar', '2026-07-08', 'Cancelada', '2026-07-02 13:52:00-03'),
    ('17166905-7', '16304074-3', 'Necesito el certificado TE1 para regularizar la casa.', 'Av. Pedro Montt 1744, La Florida', '2026-07-07', 'Finalizada', '2026-07-03 10:33:00-03'),
    ('20769995-0', '12787682-7', 'Destapar el desagüe de la ducha, el agua tarda mucho en bajar.', 'O''Higgins 2526, Viña del Mar', '2026-07-10', 'Finalizada', '2026-07-04 18:33:00-03'),
    ('20662808-1', '9216829-8', 'Radier para estacionamiento de un auto.', 'Caupolicán 1732, Chiguayante', '2026-07-07', 'Finalizada', '2026-07-05 19:18:00-03'),
    ('20769995-0', '7341423-7', 'El estanque del WC se queda corriendo y sube la cuenta del agua.', 'El Roble 2948, Curicó', '2026-07-12', 'Finalizada', '2026-07-05 14:05:00-03'),
    ('13954732-2', '13950768-1', 'Instalar cuatro enchufes nuevos en el living y cambiar interruptores.', 'Baquedano 410, Providencia', '2026-07-15', 'Finalizada', '2026-07-08 10:18:00-03'),
    ('19254047-K', '9833408-4', 'Mantención de jardín: corte de pasto, poda de rosas y limpieza.', 'Colón 1305, Ovalle', '2026-07-13', 'Finalizada', '2026-07-08 20:05:00-03'),
    ('13345441-1', '13943581-8', 'Instalar grifería nueva en el baño principal (ya la compré).', 'Av. Matta 946, Providencia', '2026-07-19', 'Cancelada', '2026-07-10 14:46:00-03'),
    ('19254047-K', '16178972-0', 'Reparación de la llave de paso de la cocina, no cierra del todo.', 'Colón 1248, Quilpué', '2026-07-18', 'Finalizada', '2026-07-10 09:41:00-03'),
    ('13337707-7', '9446075-1', 'Necesito el certificado TE1 para regularizar la casa.', 'El Roble 2261, La Florida', '2026-07-17', 'Finalizada', '2026-07-11 12:33:00-03'),
    ('16883454-3', '14589009-8', 'Pintar reja y portón metálico, necesita anticorrosivo.', 'Pasaje Los Maitenes 2606, Talcahuano', '2026-07-15', 'Finalizada', '2026-07-11 21:18:00-03'),
    ('20662808-1', '13864956-3', 'Instalar lámparas LED en la cocina y el pasillo.', 'Pasaje Los Olmos 1959, Viña del Mar', '2026-07-21', 'Finalizada', '2026-07-12 20:41:00-03'),
    ('20712687-K', '14007716-K', 'Mueble bajo mesón para la cocina, con puertas y dos cajones.', 'Los Aromos 643, Ñuñoa', '2026-07-21', 'Finalizada', '2026-07-16 10:46:00-03'),
    ('13954732-2', '17724100-8', 'Instalar grifería nueva en el baño principal (ya la compré).', 'Av. España 1558, La Serena', '2026-07-24', 'Finalizada', '2026-07-16 09:12:00-03'),
    ('16883454-3', '12048663-2', 'Necesito el certificado TE1 para regularizar la casa.', 'Errázuriz 2145, Concón', '2026-07-20', 'Finalizada', '2026-07-17 12:12:00-03'),
    ('19254047-K', '17724100-8', 'Fuga de agua bajo el lavaplatos, gotea toda la noche.', 'Los Aromos 1000, Coquimbo', '2026-07-22', 'Finalizada', '2026-07-18 13:41:00-03'),
    ('17166905-7', '10720380-K', 'Destapar el desagüe de la ducha, el agua tarda mucho en bajar.', 'Blanco Encalada 1235, Chiguayante', '2026-07-20', 'Finalizada', '2026-07-19 18:41:00-03'),
    ('13954732-2', '13504312-5', 'Pintar reja y portón metálico, necesita anticorrosivo.', 'El Roble 250, Rancagua', '2026-07-26', 'Rechazada', '2026-07-22 20:18:00-03'),
    ('17166905-7', '16304074-3', 'El automático del tablero salta varias veces al día.', 'Prat 3300, Ñuñoa', '2026-07-23', 'Finalizada', '2026-07-22 14:41:00-03'),
    ('20662808-1', '10786894-1', 'Me quedé afuera de la casa, la llave quedó adentro.', 'Baquedano 1121, Viña del Mar', '2026-07-31', 'Finalizada', '2026-07-23 16:18:00-03'),
    ('20662808-1', '13943581-8', 'Cañería rota en el patio, hay una poza que no se seca hace días.', 'Los Carrera 3933, Ñuñoa', '2026-07-26', 'Finalizada', '2026-07-23 11:46:00-03'),
    ('13337707-7', '8457682-4', 'El estanque del WC se queda corriendo y sube la cuenta del agua.', 'Prat 3434, Valparaíso', '2026-08-03', 'Finalizada', '2026-07-26 11:12:00-03'),
    ('17166905-7', '17372448-9', 'El horno eléctrico prende pero no calienta.', 'Av. Pedro Montt 1082, Talca', '2026-08-03', 'Finalizada', '2026-07-26 09:41:00-03'),
    ('16883454-3', '13864956-3', 'Necesito el certificado TE1 para regularizar la casa.', 'Los Carrera 311, Quillota', '2026-08-05', 'Finalizada', '2026-07-27 17:33:00-03'),
    ('13345441-1', '9989484-9', 'Pintar living y comedor, aproximadamente 40 m2, colores claros.', 'Av. Grecia 2899, San Miguel', '2026-08-05', 'Finalizada', '2026-07-28 11:33:00-03'),
    ('12588772-4', '13864956-3', 'El automático del tablero salta varias veces al día.', 'Blanco Encalada 3752, Valparaíso', '2026-08-03', 'Cancelada', '2026-07-31 12:52:00-03'),
    ('12987259-4', '8457682-4', 'El estanque del WC se queda corriendo y sube la cuenta del agua.', 'Los Boldos 3152, Viña del Mar', '2026-08-04', 'Finalizada', '2026-07-31 15:33:00-03'),
    ('13337707-7', '17372448-9', 'El horno eléctrico prende pero no calienta.', 'Caupolicán 730, Curicó', '2026-08-11', 'Finalizada', '2026-08-02 08:27:00-03'),
    ('17166905-7', '14297438-K', 'Reparar los cajones de la cocina que se salieron del riel.', 'Pasaje Los Olmos 1120, Santiago', '2026-08-06', 'Finalizada', '2026-08-02 18:33:00-03'),
    ('20662808-1', '17372448-9', 'El horno eléctrico prende pero no calienta.', 'Prat 994, Curicó', '2026-08-11', 'Finalizada', '2026-08-02 20:18:00-03'),
    ('16883454-3', '15085508-K', 'Pintar reja y portón metálico, necesita anticorrosivo.', 'Prat 1722, Villa Alemana', '2026-08-05', 'Finalizada', '2026-08-03 15:27:00-03'),
    ('19254047-K', '18431243-3', 'El calefont no enciende, es a gas licuado y tiene unos 8 años.', 'Colón 3157, Maipú', '2026-08-11', 'Finalizada', '2026-08-03 11:18:00-03'),
    ('13954732-2', '9170232-0', 'Instalar grifería nueva en el baño principal (ya la compré).', 'Av. Grecia 3725, Concepción', '2026-08-08', 'Finalizada', '2026-08-04 15:05:00-03'),
    ('20478313-6', '9216829-8', 'Radier para estacionamiento de un auto.', 'Av. Pedro Montt 551, San Pedro de la Paz', '2026-08-08', 'Cancelada', '2026-08-04 08:52:00-03'),
    ('17166905-7', '16304074-3', 'Se corta la luz cuando prendo el horno y el hervidor al mismo tiempo.', 'O''Higgins 3417, Ñuñoa', '2026-08-09', 'Rechazada', '2026-08-04 16:05:00-03'),
    ('13345441-1', '8348655-4', 'Instalar lámparas LED en la cocina y el pasillo.', 'Los Carrera 1634, San Pedro de la Paz', '2026-08-09', 'Rechazada', '2026-08-05 18:41:00-03'),
    ('13345441-1', '18431243-3', 'El calefont no enciende, es a gas licuado y tiene unos 8 años.', 'Errázuriz 570, Maipú', '2026-08-14', 'Cancelada', '2026-08-05 19:46:00-03'),
    ('12588772-4', '13882887-5', 'Gotera en el dormitorio cuando llueve fuerte.', 'Errázuriz 2066, La Florida', '2026-08-09', 'Finalizada', '2026-08-06 18:46:00-03'),
    ('20769995-0', '9216829-8', 'Cambio de cerámica del baño, son más o menos 6 m2.', 'Lautaro 2118, Chiguayante', '2026-08-11', 'Finalizada', '2026-08-08 18:18:00-03'),
    ('16956130-3', '13950768-1', 'Instalar cuatro enchufes nuevos en el living y cambiar interruptores.', 'O''Higgins 2502, Providencia', '2026-08-11', 'Finalizada', '2026-08-08 16:46:00-03'),
    ('12588772-4', '16304074-3', 'Se corta la luz cuando prendo el horno y el hervidor al mismo tiempo.', 'Los Boldos 3962, San Miguel', '2026-08-18', 'Rechazada', '2026-08-12 15:52:00-03'),
    ('17166905-7', '14007716-K', 'Reparar los cajones de la cocina que se salieron del riel.', 'Prat 1077, Providencia', '2026-08-22', 'Finalizada', '2026-08-13 15:33:00-03'),
    ('13512136-3', '9170232-0', 'Destapar el desagüe de la ducha, el agua tarda mucho en bajar.', 'Av. Libertad 1324, Concepción', '2026-08-20', 'Finalizada', '2026-08-14 18:46:00-03'),
    ('14317270-8', '12854868-8', 'Mantención de jardín: corte de pasto, poda de rosas y limpieza.', 'Las Acacias 829, Ñuñoa', '2026-08-17', 'Cancelada', '2026-08-15 16:05:00-03'),
    ('13337707-7', '9989484-9', 'Empaste y pintura de un dormitorio con manchas de humedad.', 'Caupolicán 823, Puente Alto', '2026-08-20', 'Finalizada', '2026-08-16 09:52:00-03'),
    ('19254047-K', '14297438-K', 'Closet a medida para dormitorio, el muro mide 2,5 metros.', 'Pasaje Los Olmos 3789, Santiago', '2026-08-26', 'Cancelada', '2026-08-18 17:27:00-03'),
    ('20662808-1', '15740588-8', 'Pintar reja y portón metálico, necesita anticorrosivo.', 'Caupolicán 2418, Puente Alto', '2026-08-19', 'Rechazada', '2026-08-18 15:18:00-03'),
    ('12987259-4', '14007716-K', 'Mueble bajo mesón para la cocina, con puertas y dos cajones.', 'Lautaro 1814, La Florida', '2026-08-20', 'Finalizada', '2026-08-19 17:52:00-03'),
    ('15226236-1', '8457682-4', 'El estanque del WC se queda corriendo y sube la cuenta del agua.', 'Las Acacias 827, Valparaíso', '2026-08-25', 'Finalizada', '2026-08-19 17:18:00-03'),
    ('14317270-8', '10720380-K', 'Fuga de agua bajo el lavaplatos, gotea toda la noche.', 'Los Aromos 391, San Pedro de la Paz', '2026-08-25', 'Rechazada', '2026-08-20 10:33:00-03'),
    ('12588772-4', '13950768-1', 'El automático del tablero salta varias veces al día.', 'Los Carrera 183, San Miguel', '2026-08-26', 'Finalizada', '2026-08-20 11:12:00-03'),
    ('15226236-1', '17478277-6', 'El refrigerador no enfría la parte de abajo.', 'Lautaro 214, Providencia', '2026-08-24', 'Rechazada', '2026-08-21 16:05:00-03'),
    ('12588772-4', '10595367-4', 'Mueble bajo mesón para la cocina, con puertas y dos cajones.', 'Av. Pedro Montt 1693, Valparaíso', '2026-08-26', 'Finalizada', '2026-08-23 11:12:00-03'),
    ('13337707-7', '8457682-4', 'Cañería rota en el patio, hay una poza que no se seca hace días.', 'Colón 2556, Viña del Mar', '2026-09-01', 'Finalizada', '2026-08-23 11:52:00-03'),
    ('20712687-K', '13950768-1', 'Se corta la luz cuando prendo el horno y el hervidor al mismo tiempo.', 'Av. Grecia 1689, Maipú', '2026-08-31', 'Finalizada', '2026-08-27 18:46:00-03'),
    ('16883454-3', '17372448-9', 'El horno eléctrico prende pero no calienta.', 'Las Acacias 3618, Curicó', '2026-08-31', 'Finalizada', '2026-08-27 14:12:00-03'),
    ('20478313-6', '13943581-8', 'Instalar grifería nueva en el baño principal (ya la compré).', 'Las Acacias 2937, La Florida', '2026-09-02', 'Finalizada', '2026-08-29 21:18:00-03'),
    ('13512136-3', '12787682-7', 'Fuga de agua bajo el lavaplatos, gotea toda la noche.', 'Av. Grecia 3825, Concón', '2026-09-07', 'Finalizada', '2026-08-31 16:18:00-03'),
    ('16883454-3', '17202688-5', 'Cambiar tres planchas de zinc que se soltaron con el viento.', 'Colón 3672, Quilpué', '2026-09-01', 'Finalizada', '2026-08-31 14:41:00-03'),
    ('15226236-1', '16178972-0', 'Fuga de agua bajo el lavaplatos, gotea toda la noche.', 'Colón 825, Valparaíso', '2026-09-08', 'Finalizada', '2026-09-01 19:46:00-03'),
    ('20662808-1', '10914881-4', 'Cambiar la chapa de la puerta principal por una de seguridad.', 'Los Carrera 2332, San Miguel', '2026-09-05', 'Rechazada', '2026-09-01 17:52:00-03'),
    ('13337707-7', '9170232-0', 'El calefont no enciende, es a gas licuado y tiene unos 8 años.', 'Los Aromos 2072, San Pedro de la Paz', '2026-09-10', 'Finalizada', '2026-09-02 14:41:00-03'),
    ('13345441-1', '18431243-3', 'El calefont no enciende, es a gas licuado y tiene unos 8 años.', 'Lautaro 2814, Maipú', '2026-09-09', 'Finalizada', '2026-09-03 09:52:00-03'),
    ('12987259-4', '17437647-6', 'Fuga de agua bajo el lavaplatos, gotea toda la noche.', 'Av. Matta 3554, Concón', '2026-09-14', 'Finalizada', '2026-09-05 20:27:00-03'),
    ('15226236-1', '7765180-2', 'Fuga de agua bajo el lavaplatos, gotea toda la noche.', 'Los Aromos 1721, Viña del Mar', '2026-09-07', 'Finalizada', '2026-09-05 11:05:00-03'),
    ('12987259-4', '17202688-5', 'Gotera en el dormitorio cuando llueve fuerte.', 'Av. Matta 1372, Viña del Mar', '2026-09-11', 'Finalizada', '2026-09-05 18:33:00-03'),
    ('20478313-6', '16304074-3', 'Instalar cuatro enchufes nuevos en el living y cambiar interruptores.', 'Blanco Encalada 1901, Providencia', '2026-09-14', 'Finalizada', '2026-09-07 08:52:00-03'),
    ('12588772-4', '16178972-0', 'Fuga de agua bajo el lavaplatos, gotea toda la noche.', 'Pasaje Los Maitenes 3794, Villa Alemana', '2026-09-09', 'Finalizada', '2026-09-07 16:41:00-03'),
    ('13337707-7', '9170232-0', 'Reparación de la llave de paso de la cocina, no cierra del todo.', 'O''Higgins 2714, Concepción', '2026-09-14', 'Finalizada', '2026-09-10 08:05:00-03'),
    ('13954732-2', '13882887-5', 'Gotera en el dormitorio cuando llueve fuerte.', 'Freire 531, Macul', '2026-09-15', 'Rechazada', '2026-09-11 15:46:00-03'),
    ('13512136-3', '12787682-7', 'Cañería rota en el patio, hay una poza que no se seca hace días.', 'Caupolicán 3969, Concón', '2026-09-12', 'Finalizada', '2026-09-11 18:52:00-03'),
    ('17166905-7', '15085508-K', 'Pintar reja y portón metálico, necesita anticorrosivo.', 'Errázuriz 525, Quillota', '2026-09-15', 'Cancelada', '2026-09-11 15:33:00-03'),
    ('17166905-7', '8348655-4', 'Instalar lámparas LED en la cocina y el pasillo.', 'Av. Grecia 1492, San Pedro de la Paz', '2026-09-13', 'Finalizada', '2026-09-11 10:52:00-03'),
    ('12987259-4', '7341423-7', 'Instalar grifería nueva en el baño principal (ya la compré).', 'Av. Grecia 3368, Curicó', '2026-09-16', 'Finalizada', '2026-09-11 19:52:00-03'),
    ('13337707-7', '13504312-5', 'Pintar living y comedor, aproximadamente 40 m2, colores claros.', 'Caupolicán 1710, Rancagua', '2026-09-18', 'Finalizada', '2026-09-12 10:18:00-03'),
    ('20712687-K', '9335714-0', 'Cambio de cerámica del baño, son más o menos 6 m2.', 'El Roble 1128, Providencia', '2026-09-20', 'Finalizada', '2026-09-12 20:05:00-03'),
    ('13345441-1', '8457682-4', 'Cañería rota en el patio, hay una poza que no se seca hace días.', 'Prat 1671, Quillota', '2026-09-19', 'Finalizada', '2026-09-13 14:33:00-03'),
    ('20769995-0', '10391408-6', 'Instalar lámparas LED en la cocina y el pasillo.', 'Colón 284, Ovalle', '2026-09-21', 'Cancelada', '2026-09-13 12:41:00-03'),
    ('15226236-1', '10199068-0', 'Mueble bajo mesón para la cocina, con puertas y dos cajones.', 'Los Boldos 2466, Talcahuano', '2026-09-17', 'Rechazada', '2026-09-14 10:18:00-03'),
    ('20769995-0', '13943581-8', 'Cañería rota en el patio, hay una poza que no se seca hace días.', 'El Roble 1243, Maipú', '2026-09-25', 'Finalizada', '2026-09-16 20:05:00-03'),
    ('13954732-2', '10391408-6', 'Necesito el certificado TE1 para regularizar la casa.', 'Los Carrera 2513, Coquimbo', '2026-09-23', 'Cancelada', '2026-09-17 13:41:00-03'),
    ('13337707-7', '9170232-0', 'Cañería rota en el patio, hay una poza que no se seca hace días.', 'Av. España 2359, Chiguayante', '2026-09-20', 'Finalizada', '2026-09-17 17:52:00-03'),
    ('15226236-1', '14589009-8', 'Pintar living y comedor, aproximadamente 40 m2, colores claros.', 'Av. Pedro Montt 359, Chiguayante', '2026-09-24', 'Finalizada', '2026-09-18 10:33:00-03'),
    ('13337707-7', '10199068-0', 'Reparar los cajones de la cocina que se salieron del riel.', 'Lautaro 2512, Los Ángeles', '2026-09-23', 'Finalizada', '2026-09-18 13:18:00-03'),
    ('16883454-3', '13882887-5', 'Cambiar tres planchas de zinc que se soltaron con el viento.', 'Av. Libertad 2367, Puente Alto', '2026-09-23', 'Finalizada', '2026-09-19 17:05:00-03'),
    ('13954732-2', '13504312-5', 'Pintar reja y portón metálico, necesita anticorrosivo.', 'Blanco Encalada 3819, Rancagua', '2026-09-27', 'Cancelada', '2026-09-20 10:33:00-03'),
    ('19254047-K', '7765180-2', 'El estanque del WC se queda corriendo y sube la cuenta del agua.', 'Freire 3511, Viña del Mar', '2026-09-29', 'Finalizada', '2026-09-22 21:05:00-03'),
    ('20712687-K', '13864956-3', 'Necesito el certificado TE1 para regularizar la casa.', 'Av. Libertad 2057, Quilpué', '2026-09-29', 'Rechazada', '2026-09-24 08:41:00-03'),
    ('19254047-K', '9216829-8', 'Reparar muro de ladrillo con grietas en el patio.', 'Lautaro 2292, Concepción', '2026-10-01', 'Finalizada', '2026-09-25 15:18:00-03'),
    ('13512136-3', '16173195-1', 'Cañería rota en el patio, hay una poza que no se seca hace días.', 'Lautaro 1840, Providencia', '2026-09-28', 'Finalizada', '2026-09-25 11:52:00-03'),
    ('16956130-3', '17202688-5', 'Limpiar y reparar canaletas antes de las lluvias.', 'Los Boldos 2617, Quilpué', '2026-10-11', 'Aceptada', '2026-10-02 08:41:00-03'),
    ('12588772-4', '10595367-4', 'Closet a medida para dormitorio, el muro mide 2,5 metros.', 'Las Acacias 3051, Concón', '2026-10-10', 'Pendiente', '2026-10-02 20:27:00-03'),
    ('20662808-1', '13504312-5', 'Pintar reja y portón metálico, necesita anticorrosivo.', 'El Roble 1135, Rancagua', '2026-10-12', 'Rechazada', '2026-10-04 11:12:00-03'),
    ('15226236-1', '7341423-7', 'El calefont no enciende, es a gas licuado y tiene unos 8 años.', 'Colón 1749, Talca', '2026-10-07', 'Aceptada', '2026-10-04 16:46:00-03'),
    ('16883454-3', '14007716-K', 'Closet a medida para dormitorio, el muro mide 2,5 metros.', 'O''Higgins 3195, Santiago', '2026-10-14', 'Aceptada', '2026-10-05 18:52:00-03'),
    ('13512136-3', '7559934-K', 'Necesito el certificado TE1 para regularizar la casa.', 'Los Carrera 2202, Quilpué', '2026-10-14', 'Pendiente', '2026-10-05 11:05:00-03'),
    ('20478313-6', '16173195-1', 'Destapar el desagüe de la ducha, el agua tarda mucho en bajar.', 'Los Carrera 933, Maipú', '2026-10-07', 'Pendiente', '2026-10-06 17:46:00-03'),
    ('20662808-1', '12854868-8', 'Podar un árbol grande que está topando los cables.', 'Las Acacias 2107, Santiago', '2026-10-12', 'Pendiente', '2026-10-07 21:12:00-03'),
    ('13345441-1', '17437647-6', 'Reparación de la llave de paso de la cocina, no cierra del todo.', 'Pasaje Los Maitenes 266, Villa Alemana', '2026-10-16', 'Rechazada', '2026-10-07 09:12:00-03'),
    ('16883454-3', '17372448-9', 'El horno eléctrico prende pero no calienta.', 'Caupolicán 1850, Curicó', '2026-10-09', 'Pendiente', '2026-10-07 11:27:00-03'),
    ('20712687-K', '10786894-1', 'Cambiar la chapa de la puerta principal por una de seguridad.', 'Los Aromos 121, Concón', '2026-10-08', 'Pendiente', '2026-10-07 20:18:00-03'),
    ('20662808-1', '9446075-1', 'Se corta la luz cuando prendo el horno y el hervidor al mismo tiempo.', 'Las Acacias 3208, Puente Alto', '2026-10-13', 'Aceptada', '2026-10-08 17:52:00-03');

INSERT INTO calificacion (id_solicitud, puntuacion, comentario, fecha) VALUES
    (1, 5, 'Excelente trabajo, muy puntual y profesional.', '2026-08-20 12:41:00-03'),
    (6, 5, 'Solucionó en una hora lo que otro no pudo en dos visitas.', '2026-07-02 18:12:00-03'),
    (7, 3, 'Correcto, nada especial. Costó coordinar el horario.', '2026-07-02 13:41:00-03'),
    (9, 5, 'Muy ordenado, explicó lo que hizo y cobró lo conversado.', '2026-07-04 09:18:00-03'),
    (10, 4, 'Quedó bien. El precio fue algo más alto de lo que esperaba.', '2026-07-04 10:18:00-03'),
    (12, 4, 'Quedó bien. El precio fue algo más alto de lo que esperaba.', '2026-07-05 13:33:00-03'),
    (14, 4, 'Cumplió, aunque tuvo que volver al día siguiente por un repuesto.', '2026-07-12 16:18:00-03'),
    (15, 4, 'Recomendable. Le faltó limpiar un poco al final.', '2026-07-10 14:33:00-03'),
    (17, 4, 'Quedó bien. El precio fue algo más alto de lo que esperaba.', '2026-07-10 10:27:00-03'),
    (18, 5, 'Súper amable, trajo todos los materiales.', '2026-07-10 19:05:00-03'),
    (20, 5, 'Muy ordenado, explicó lo que hizo y cobró lo conversado.', '2026-07-12 12:41:00-03'),
    (21, 4, 'Cumplió, aunque tuvo que volver al día siguiente por un repuesto.', '2026-07-17 14:27:00-03'),
    (22, 4, NULL, '2026-07-16 08:18:00-03'),
    (24, 5, 'Rápido y honesto con el precio.', '2026-07-21 14:27:00-03'),
    (25, 4, 'Quedó bien. El precio fue algo más alto de lo que esperaba.', '2026-07-18 08:12:00-03'),
    (26, 3, 'El trabajo está bien pero se demoró el doble de lo que dijo.', '2026-07-15 19:33:00-03'),
    (27, 4, 'Recomendable. Le faltó limpiar un poco al final.', '2026-07-24 18:33:00-03'),
    (28, 5, 'Muy ordenado, explicó lo que hizo y cobró lo conversado.', '2026-07-24 11:27:00-03'),
    (29, 5, 'Trabajo prolijo, hasta me dio consejos para que no vuelva a pasar.', '2026-07-24 14:33:00-03'),
    (30, 4, NULL, '2026-07-22 13:52:00-03'),
    (32, 3, 'El trabajo está bien pero se demoró el doble de lo que dijo.', '2026-07-21 21:41:00-03'),
    (34, 4, NULL, '2026-07-24 21:52:00-03'),
    (35, 4, 'Cumplió, aunque tuvo que volver al día siguiente por un repuesto.', '2026-08-02 20:05:00-03'),
    (36, 4, 'Quedó bien. El precio fue algo más alto de lo que esperaba.', '2026-07-26 11:05:00-03'),
    (37, 5, 'Rápido y honesto con el precio.', '2026-08-03 14:46:00-03'),
    (38, 2, 'No dejó boleta y el cobro final subió.', '2026-08-06 16:18:00-03'),
    (39, 4, 'Cumplió, aunque tuvo que volver al día siguiente por un repuesto.', '2026-08-07 14:05:00-03'),
    (40, 3, 'Correcto, nada especial. Costó coordinar el horario.', '2026-08-07 19:12:00-03'),
    (42, 5, 'Llegó a la hora y dejó todo limpio. Lo vuelvo a llamar sin dudarlo.', '2026-08-07 20:05:00-03'),
    (43, 4, 'Recomendable. Le faltó limpiar un poco al final.', '2026-08-11 15:33:00-03'),
    (44, 3, 'El trabajo está bien pero se demoró el doble de lo que dijo.', '2026-08-09 14:27:00-03'),
    (45, 4, 'Buen trabajo, solo se atrasó un poco en llegar.', '2026-08-12 20:33:00-03'),
    (46, 3, 'Correcto, nada especial. Costó coordinar el horario.', '2026-08-06 10:52:00-03'),
    (47, 4, NULL, '2026-08-12 13:27:00-03'),
    (53, 5, 'Impecable. Avisó cuando venía en camino.', '2026-08-12 17:41:00-03'),
    (54, 5, NULL, '2026-08-12 16:05:00-03'),
    (57, 5, 'Rápido y honesto con el precio.', '2026-08-22 09:46:00-03'),
    (58, 4, 'Quedó bien. El precio fue algo más alto de lo que esperaba.', '2026-08-20 14:27:00-03'),
    (60, 5, 'Trabajo prolijo, hasta me dio consejos para que no vuelva a pasar.', '2026-08-21 16:52:00-03'),
    (63, 5, 'Trabajo prolijo, hasta me dio consejos para que no vuelva a pasar.', '2026-08-20 12:52:00-03'),
    (66, 4, NULL, '2026-08-27 11:05:00-03'),
    (68, 3, 'Correcto, nada especial. Costó coordinar el horario.', '2026-08-27 19:52:00-03'),
    (69, 3, 'Correcto, nada especial. Costó coordinar el horario.', '2026-09-03 20:27:00-03'),
    (70, 5, 'Solucionó en una hora lo que otro no pudo en dos visitas.', '2026-08-31 19:41:00-03'),
    (72, 3, 'Correcto, nada especial. Costó coordinar el horario.', '2026-09-05 17:41:00-03'),
    (73, 4, NULL, '2026-09-10 19:52:00-03'),
    (74, 4, 'Buen trabajo, solo se atrasó un poco en llegar.', '2026-09-02 14:41:00-03'),
    (75, 4, 'Recomendable. Le faltó limpiar un poco al final.', '2026-09-11 11:52:00-03'),
    (77, 4, 'Buen trabajo, solo se atrasó un poco en llegar.', '2026-09-13 17:41:00-03'),
    (78, 5, NULL, '2026-09-10 16:05:00-03'),
    (80, 5, 'Muy ordenado, explicó lo que hizo y cobró lo conversado.', '2026-09-08 14:41:00-03'),
    (81, 4, NULL, '2026-09-14 15:12:00-03'),
    (82, 3, 'El trabajo está bien pero se demoró el doble de lo que dijo.', '2026-09-16 13:46:00-03'),
    (84, 5, NULL, '2026-09-15 18:12:00-03'),
    (86, 3, 'Correcto, nada especial. Costó coordinar el horario.', '2026-09-12 18:41:00-03'),
    (88, 4, 'Recomendable. Le faltó limpiar un poco al final.', '2026-09-15 20:05:00-03'),
    (89, 5, NULL, '2026-09-18 15:27:00-03'),
    (91, 4, 'Quedó bien. El precio fue algo más alto de lo que esperaba.', '2026-09-22 20:52:00-03'),
    (92, 3, 'Correcto, nada especial. Costó coordinar el horario.', '2026-09-19 20:33:00-03'),
    (95, 5, NULL, '2026-09-27 19:18:00-03'),
    (97, 4, 'Recomendable. Le faltó limpiar un poco al final.', '2026-09-22 15:12:00-03'),
    (98, 3, 'Correcto, nada especial. Costó coordinar el horario.', '2026-09-25 16:33:00-03'),
    (99, 5, 'Solucionó en una hora lo que otro no pudo en dos visitas.', '2026-09-26 14:05:00-03'),
    (100, 5, 'Muy ordenado, explicó lo que hizo y cobró lo conversado.', '2026-09-23 11:33:00-03'),
    (102, 5, 'Solucionó en una hora lo que otro no pudo en dos visitas.', '2026-10-02 20:41:00-03'),
    (104, 4, 'Recomendable. Le faltó limpiar un poco al final.', '2026-10-01 21:05:00-03'),
    (105, 3, 'Correcto, nada especial. Costó coordinar el horario.', '2026-09-28 08:05:00-03');

-- ======================================================================
-- 03_consultas.sql
-- ======================================================================
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
