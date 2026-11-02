import { Router } from 'express';
import * as clientes from '../controllers/clientes.controller.js';
import * as consultas from '../controllers/consultas.controller.js';
import * as maestros from '../controllers/maestros.controller.js';
import * as nosql from '../controllers/nosql.controller.js';
import * as oficios from '../controllers/oficios.controller.js';
import * as regiones from '../controllers/regiones.controller.js';
import * as salud from '../controllers/salud.controller.js';
import * as sesiones from '../controllers/sesiones.controller.js';
import * as solicitudes from '../controllers/solicitudes.controller.js';
import { exigir } from '../middlewares/sesion.js';

// Mapa completo de la API v1. Las URL nombran recursos (sustantivos en
// plural) y el método HTTP indica la acción. exigir() pide sesión iniciada;
// exigir('rol') además pide ese rol. Lo demás es público (visitante).
const r = Router();
const admin = exigir('administrador');

r.get('/salud', salud.estado);

// Inicio de sesión
r.post('/sesiones', sesiones.iniciar);
r.get('/sesiones/actual', exigir(), sesiones.actual);

r.get('/regiones', regiones.listar);

// Mantenedor 2 · oficios
r.get('/oficios', oficios.listar);
r.get('/oficios/:id', oficios.detalle);
r.post('/oficios', admin, oficios.crear);
r.put('/oficios/:id', admin, oficios.reemplazar);
r.delete('/oficios/:id', admin, oficios.eliminar);

// Caso de uso Consulta: catálogo con filtros obligatorios y opcionales
r.get('/catalogo', maestros.catalogo);
r.get('/ranking', maestros.ranking);

// Mantenedor 1 · maestros
r.get('/maestros', admin, maestros.listar);
r.get('/maestros/:rut', maestros.detalle);
r.get('/maestros/:rut/solicitudes', exigir('maestro', 'administrador'), maestros.bandeja);
r.post('/maestros', admin, maestros.crear);
r.put('/maestros/:rut', admin, maestros.reemplazar);
r.patch('/maestros/:rut', admin, maestros.modificar);
r.delete('/maestros/:rut', admin, maestros.eliminar);

// Clientes: el registro es público
r.get('/clientes', admin, clientes.listar);
r.get('/clientes/:rut', exigir(), clientes.detalle);
r.post('/clientes', clientes.crear);

// Caso de uso Transacción: Cliente + Maestro + Solicitud
r.get('/solicitudes', exigir(), solicitudes.listar);
r.get('/solicitudes/:id', exigir(), solicitudes.detalle);
r.post('/solicitudes', exigir('cliente'), solicitudes.crear);
r.patch('/solicitudes/:id', exigir(), solicitudes.cambiarEstado);
r.delete('/solicitudes/:id', admin, solicitudes.eliminar);
r.post('/solicitudes/:id/calificacion', exigir('cliente'), solicitudes.calificar);

// Laboratorio: las 13 consultas de la Etapa I en MQL y las pruebas de integridad
r.get('/consultas', consultas.listar);
r.get('/consultas/:numero', consultas.detalle);
r.post('/consultas/:numero/ejecuciones', consultas.ejecutar);
r.post('/pruebas-integridad/:codigo/ejecuciones', consultas.probarIntegridad);

// Modelo de documentos: traspaso, colecciones, índices y validadores
r.get('/nosql', nosql.resumen);

export default r;
