import { Router } from 'express';
import * as clientes from '../controllers/clientes.controller.js';
import * as consultas from '../controllers/consultas.controller.js';
import * as maestros from '../controllers/maestros.controller.js';
import * as nosql from '../controllers/nosql.controller.js';
import * as oficios from '../controllers/oficios.controller.js';
import * as regiones from '../controllers/regiones.controller.js';
import * as salud from '../controllers/salud.controller.js';
import * as solicitudes from '../controllers/solicitudes.controller.js';

// Mapa completo de la API v1. Las URL nombran recursos (sustantivos en
// plural) y el método HTTP indica la acción.
const r = Router();

r.get('/salud', salud.estado);

r.get('/regiones', regiones.listar);

// Mantenedor 2 · oficios
r.get('/oficios', oficios.listar);
r.get('/oficios/:id', oficios.detalle);
r.post('/oficios', oficios.crear);
r.put('/oficios/:id', oficios.reemplazar);
r.delete('/oficios/:id', oficios.eliminar);

// Caso de uso Consulta: catálogo con filtros obligatorios y opcionales
r.get('/catalogo', maestros.catalogo);
r.get('/ranking', maestros.ranking);

// Mantenedor 1 · maestros
r.get('/maestros', maestros.listar);
r.get('/maestros/:rut', maestros.detalle);
r.get('/maestros/:rut/solicitudes', maestros.bandeja);
r.post('/maestros', maestros.crear);
r.put('/maestros/:rut', maestros.reemplazar);
r.patch('/maestros/:rut', maestros.modificar);
r.delete('/maestros/:rut', maestros.eliminar);

r.get('/clientes', clientes.listar);
r.get('/clientes/:rut', clientes.detalle);
r.post('/clientes', clientes.crear);

// Caso de uso Transacción: Cliente + Maestro + Solicitud
r.get('/solicitudes', solicitudes.listar);
r.get('/solicitudes/:id', solicitudes.detalle);
r.post('/solicitudes', solicitudes.crear);
r.patch('/solicitudes/:id', solicitudes.cambiarEstado);
r.delete('/solicitudes/:id', solicitudes.eliminar);
r.post('/solicitudes/:id/calificacion', solicitudes.calificar);

// Laboratorio: las 13 consultas de la Etapa I y las pruebas de integridad
r.get('/consultas', consultas.listar);
r.get('/consultas/:numero', consultas.detalle);
r.post('/consultas/:numero/ejecuciones', consultas.ejecutar);
r.post('/pruebas-integridad/:codigo/ejecuciones', consultas.probarIntegridad);

// Laboratorio NoSQL: el mismo modelo en MongoDB, comparado contra PostgreSQL
r.get('/nosql', nosql.resumen);
r.get('/nosql/consultas', nosql.consultas);
r.post('/nosql/consultas/:codigo/ejecuciones', nosql.ejecutar);
r.post('/nosql/pruebas/:codigo/ejecuciones', nosql.probar);

export default r;
