// Pruebas de la API contra una base PostgreSQL real (la de DATABASE_URL).
// Antes de empezar se recrea el esquema y se cargan los datos de ejemplo.
// Ejecutar con: npm test   (requiere la BD local: docker compose up -d)
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, before, describe, test } from 'node:test';
import request from 'supertest';

process.env.NODE_ENV = 'test';
const { default: app } = await import('../src/app.js');
const { pool } = await import('../src/config/db.js');
const { cerrarMongo } = await import('../src/config/mongo.js');

const api = request(app);
const PEDRO = '7765180-2';
const MARIA = '12588772-4';

before(async () => {
  for (const archivo of ['01_esquema.sql', '02_datos.sql']) {
    await pool.query(await readFile(new URL(`../../bd/${archivo}`, import.meta.url), 'utf8'));
  }
});

// /salud también abre MongoDB: hay que cerrarlo para que el proceso termine.
after(async () => {
  await cerrarMongo();
  await pool.end();
});

describe('conexión a la base de datos', () => {
  test('GET /salud informa motor, latencia y filas por tabla', async () => {
    const r = await api.get('/api/v1/salud').expect(200);
    assert.equal(r.body.ok, true);
    assert.equal(r.body.data.bd.conectada, true);
    assert.match(r.body.data.bd.motor, /^PostgreSQL 1\d/);
    assert.equal(r.body.data.tablas.region, 16);
    assert.equal(r.body.data.tablas.maestro, 43);
    assert.equal(r.body.data.tablas.solicitud, 117);
  });
});

describe('CU-01 · catálogo con filtros', () => {
  test('sin filtros obligatorios responde 400 y explica qué falta', async () => {
    const r = await api.get('/api/v1/catalogo').expect(400);
    assert.equal(r.body.ok, false);
    assert.deepEqual(r.body.error.detalles.map((d) => d.campo), ['region', 'oficio']);
  });

  test('con los 2 obligatorios y los 4 opcionales devuelve los maestros que cumplen', async () => {
    const r = await api.get('/api/v1/catalogo')
      .query({ region: 6, oficio: 1, tarifaMax: 25000, calificacionMin: 4, disponible: true, experienciaMin: 3 })
      .expect(200);
    assert.deepEqual(r.body.data.map((m) => m.nombre),
      ['Pedro González Soto', 'Claudia Rojas Fuentes', 'Luis Muñoz Tapia']);
    assert.equal(r.body.meta.consulta, 3);
    assert.ok(r.body.meta.ms < 1500, 'RNF-03: la consulta responde en menos de 1,5 s');
  });

  test('un oficio sin maestros devuelve lista vacía (no error)', async () => {
    const r = await api.get('/api/v1/catalogo').query({ region: 6, oficio: 10 }).expect(200);
    assert.deepEqual(r.body.data, []);
  });

  test('ranking ordenado por calificación promedio descendente', async () => {
    const r = await api.get('/api/v1/ranking').expect(200);
    const promedios = r.body.data.map((m) => m.promedio);
    assert.deepEqual(promedios, [...promedios].sort((a, b) => b - a));
    assert.ok(r.body.data.every((m) => m.total_resenas >= 2));
  });
});

describe('CU-02 · transacción Cliente–Maestro–Solicitud', () => {
  let id;

  test('crea una solicitud pendiente (201)', async () => {
    const r = await api.post('/api/v1/solicitudes').send({
      rut_cliente: MARIA,
      rut_maestro: PEDRO,
      descripcion: 'Cambiar el flexible del lavamanos, está goteando.',
      direccion: 'Errázuriz 2210, Valparaíso',
      fecha_servicio: '2099-01-15',
    }).expect(201);
    id = r.body.data.id_solicitud;
    assert.equal(r.body.data.estado, 'Pendiente');
  });

  test('aparece en la bandeja del maestro (consulta 5)', async () => {
    const r = await api.get(`/api/v1/maestros/${PEDRO}/solicitudes`).query({ estado: 'Pendiente' }).expect(200);
    assert.ok(r.body.data.some((s) => s.id_solicitud === id));
  });

  test('el maestro la acepta y luego la finaliza', async () => {
    await api.patch(`/api/v1/solicitudes/${id}`).send({ estado: 'Aceptada' }).expect(200);
    await api.patch(`/api/v1/solicitudes/${id}`).send({ estado: 'Finalizada' }).expect(200);
  });

  test('una solicitud finalizada no puede volver a pendiente (422)', async () => {
    const r = await api.patch(`/api/v1/solicitudes/${id}`).send({ estado: 'Pendiente' }).expect(422);
    assert.equal(r.body.error.codigo, 'REGLA_DE_NEGOCIO');
  });

  test('el cliente la califica una sola vez', async () => {
    await api.post(`/api/v1/solicitudes/${id}/calificacion`).send({ puntuacion: 5, comentario: 'Rápido.' }).expect(201);
    const r = await api.post(`/api/v1/solicitudes/${id}/calificacion`).send({ puntuacion: 4 }).expect(422);
    assert.equal(r.body.error.mensaje, 'Esta solicitud ya fue calificada.');
  });

  test('no se puede pedir un servicio para una fecha pasada', async () => {
    await api.post('/api/v1/solicitudes').send({
      rut_cliente: MARIA, rut_maestro: PEDRO, descripcion: 'Trabajo con fecha en el pasado.',
      direccion: 'Calle 123', fecha_servicio: '2020-01-01',
    }).expect(422);
  });

  test('el historial del cliente une las tres entidades (consulta 4)', async () => {
    const r = await api.get('/api/v1/solicitudes').query({ cliente: MARIA }).expect(200);
    assert.ok(r.body.data.length > 0);
    assert.ok(r.body.data.every((s) => s.cliente === 'María González Rojas' && s.maestro));
  });
});

describe('RF-05 · registro solo para mayores de 18', () => {
  test('rechaza a un menor con 422', async () => {
    const r = await api.post('/api/v1/clientes').send({
      rut_cliente: '21456789-K', nombre: 'Menor de Edad', email: 'menor@ejemplo.cl', fecha_nacimiento: '2015-03-01',
    }).expect(422);
    assert.equal(r.body.error.detalles[0].campo, 'fecha_nacimiento');
  });

  test('rechaza un RUT con dígito verificador incorrecto (400)', async () => {
    await api.post('/api/v1/clientes').send({
      rut_cliente: '20345678-1', nombre: 'RUT Malo', email: 'rut@ejemplo.cl', fecha_nacimiento: '1990-01-01',
    }).expect(400);
  });

  test('acepta a un adulto y normaliza el RUT con puntos', async () => {
    const r = await api.post('/api/v1/clientes').send({
      rut_cliente: '20.345.678-6', nombre: 'Tomás Henríquez Salas', email: 'tomas@ejemplo.cl',
      telefono: '9 8765 4321', fecha_nacimiento: '2001-04-22',
    }).expect(201);
    assert.equal(r.body.data.rut_cliente, '20345678-6');
  });

  test('el mismo correo no se puede registrar dos veces', async () => {
    await api.post('/api/v1/clientes').send({
      rut_cliente: '19876543-0', nombre: 'Otra Persona', email: 'tomas@ejemplo.cl', fecha_nacimiento: '1995-01-01',
    }).expect(422);
  });
});

describe('mantenedores', () => {
  test('CRUD completo de un oficio', async () => {
    const creado = await api.post('/api/v1/oficios').send({ nombre: 'Soldador', descripcion: 'Rejas y estructuras.' }).expect(201);
    const id = creado.body.data.id_oficio;
    await api.get(`/api/v1/oficios/${id}`).expect(200);
    await api.put(`/api/v1/oficios/${id}`).send({ nombre: 'Soldador al arco', descripcion: null }).expect(200);
    await api.delete(`/api/v1/oficios/${id}`).expect(200);
    await api.get(`/api/v1/oficios/${id}`).expect(404);
  });

  test('borrar un oficio con maestros responde 409 (ON DELETE RESTRICT)', async () => {
    const r = await api.delete('/api/v1/oficios/1').expect(409);
    assert.match(r.body.error.mensaje, /hay maestros/);
  });

  test('CRUD completo de un maestro', async () => {
    const maestro = {
      rut_maestro: '16234567-2', nombre: 'Gabriel Morales Iturra', email: 'gabriel@ejemplo.cl',
      telefono: '+56912345678', fecha_nacimiento: '1990-09-03', id_oficio: 4, id_region: 6,
      tarifa_hora: 15000, experiencia_anios: 7,
    };
    await api.post('/api/v1/maestros').send(maestro).expect(201);
    await api.put(`/api/v1/maestros/${maestro.rut_maestro}`).send({ ...maestro, tarifa_hora: 16000 }).expect(200);
    const r = await api.patch(`/api/v1/maestros/${maestro.rut_maestro}`).send({ disponible: false }).expect(200);
    assert.equal(r.body.data.disponible, false);
    assert.equal(r.body.data.tarifa_hora, 16000);
    await api.delete(`/api/v1/maestros/${maestro.rut_maestro}`).expect(200);
    await api.get(`/api/v1/maestros/${maestro.rut_maestro}`).expect(404);
  });

  test('un maestro con historial no se puede borrar (409)', async () => {
    await api.delete(`/api/v1/maestros/${PEDRO}`).expect(409);
  });
});

describe('laboratorio · las 13 consultas', () => {
  test('lista 13 consultas: 2 ALTER, 3 SELECT, 2 UPDATE, 3 INSERT, 2 DELETE, 1 DROP', async () => {
    const r = await api.get('/api/v1/consultas').expect(200);
    const conteo = {};
    for (const c of r.body.data.consultas) conteo[c.tipo] = (conteo[c.tipo] ?? 0) + 1;
    assert.deepEqual(conteo, { ALTER: 2, SELECT: 3, UPDATE: 2, INSERT: 3, DELETE: 2, DROP: 1 });
    const conJoin = r.body.data.consultas.filter((c) => c.conJoin).length;
    assert.equal(conJoin, 2);
  });

  for (let n = 1; n <= 13; n += 1) {
    test(`la consulta ${n} se ejecuta y la BD queda igual (ROLLBACK)`, async () => {
      const antes = (await api.get('/api/v1/salud')).body.data.tablas;
      const r = await api.post(`/api/v1/consultas/${n}/ejecuciones`).expect(201);
      assert.equal(r.body.data.transaccion, 'ROLLBACK');
      if (['UPDATE', 'INSERT', 'DELETE'].includes(r.body.data.tipo)) assert.equal(r.body.data.filasAfectadas, 1);
      if (r.body.data.tipo === 'SELECT') assert.ok(r.body.data.filas.length > 0);
      if (r.body.data.verificacion) assert.ok(r.body.data.verificacion.filas.length > 0);
      const despues = (await api.get('/api/v1/salud')).body.data.tablas;
      assert.deepEqual(despues, antes);
    });
  }

  for (const codigo of ['R1', 'R2', 'R3', 'R4', 'R5', 'R6']) {
    test(`la prueba de integridad ${codigo} es rechazada por la restricción esperada`, async () => {
      const r = await api.post(`/api/v1/pruebas-integridad/${codigo}/ejecuciones`).expect(201);
      assert.equal(r.body.data.rechazada, true);
      assert.equal(r.body.data.cumpleLoEsperado, true, `restricción obtenida: ${r.body.data.restriccion}`);
    });
  }
});

describe('forma de las respuestas', () => {
  test('una ruta inexistente responde 404 con la misma estructura de error', async () => {
    const r = await api.get('/api/v1/no-existe').expect(404);
    assert.deepEqual(Object.keys(r.body), ['ok', 'error']);
  });

  test('JSON mal formado responde 400', async () => {
    await api.post('/api/v1/oficios').set('Content-Type', 'application/json').send('{"nombre":').expect(400);
  });
});
