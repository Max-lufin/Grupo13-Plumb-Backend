// Pruebas del laboratorio NoSQL contra un MongoDB real (el de MONGODB_URI).
// Antes de empezar se recrea PostgreSQL y se migra a MongoDB: ambos parten
// iguales, así la comparación SQL ↔ MongoDB tiene que dar idéntico.
// Sin MONGODB_URI estas pruebas se omiten.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { after, before, describe, test } from 'node:test';
import { BSON } from 'mongodb';
import request from 'supertest';

process.env.NODE_ENV = 'test';
const { default: app } = await import('../src/app.js');
const { pool } = await import('../src/config/db.js');
const { env } = await import('../src/config/env.js');
const { cerrarMongo } = await import('../src/config/mongo.js');

const api = request(app);

describe('las 13 consultas en MQL', () => {
  test('cada consulta trae su MQL y nosql/consultas.mongodb.js ejecuta exactamente ese texto', async () => {
    const script = await readFile(new URL('../../nosql/consultas.mongodb.js', import.meta.url), 'utf8');
    const { consultas } = (await api.get('/api/v1/consultas').expect(200)).body.data;
    assert.equal(consultas.length, 13);
    for (const c of consultas) {
      assert.ok(c.mql, `la consulta ${c.numero} no tiene MQL`);
      assert.ok(script.includes(c.mql), `el script no tiene el MQL de la consulta ${c.numero}`);
    }
  });
});

describe('laboratorio NoSQL (MongoDB)', { skip: !env.mongodbUri && 'sin MONGODB_URI' }, () => {
  before(async () => {
    for (const archivo of ['01_esquema.sql', '02_datos.sql']) {
      await pool.query(await readFile(new URL(`../../bd/${archivo}`, import.meta.url), 'utf8'));
    }
    execFileSync(process.execPath, ['scripts/migrar-a-mongo.js', '--sin-ejemplos'], {
      cwd: new URL('..', import.meta.url),
      stdio: 'ignore',
    });
  });

  after(async () => {
    await cerrarMongo();
    await pool.end();
  });

  test('GET /salud informa también MongoDB', async () => {
    const r = await api.get('/api/v1/salud').expect(200);
    assert.equal(r.body.data.mongo.conectada, true);
    assert.match(r.body.data.mongo.motor, /^MongoDB \d/);
  });

  test('GET /nosql: 8 decisiones de traspaso y 6 colecciones con documento, índices y validador', async () => {
    const r = await api.get('/api/v1/nosql').expect(200);
    const { traspaso, colecciones } = r.body.data;
    assert.equal(traspaso.length, 8);
    const total = Object.fromEntries(colecciones.map((c) => [c.nombre, c.total]));
    assert.deepEqual(total, { maestros: 43, solicitudes: 117, clientes: 16, oficios: 10, regiones: 16, contadores: 1 });
    for (const c of colecciones) {
      assert.ok(c.ejemplo, `${c.nombre} sin documento de ejemplo`);
      assert.match(c.validador, /\$jsonSchema/, `${c.nombre} sin validador`);
    }
    const maestros = colecciones.find((c) => c.nombre === 'maestros');
    assert.match(maestros.ejemplo, /ObjectId\('/);
    assert.match(maestros.ejemplo, /ISODate\('/);
  });

  test('Q1 a Q5 devuelven lo mismo que su SQL y usan su índice, sin ordenar en memoria', async () => {
    const { consultas } = (await api.get('/api/v1/nosql/consultas').expect(200)).body.data;
    for (const c of consultas.filter((x) => x.tipo === 'lectura')) {
      const r = (await api.post(`/api/v1/nosql/consultas/${c.codigo}/ejecuciones`).expect(201)).body.data;
      assert.equal(r.comparacion.equivalente, true, `${c.codigo}: ${JSON.stringify(r.comparacion)}`);
      assert.equal(r.comparacion.mismoOrden, true, `${c.codigo} en otro orden`);
      assert.ok(r.comparacion.mongo.length > 0, `${c.codigo} sin resultados`);
      assert.equal(r.mongo.plan.indice, c.indice, `${c.codigo} usó ${r.mongo.plan.indice}`);
      assert.equal(r.mongo.plan.ordenEnMemoria, false, `${c.codigo} ordenó en memoria`);
    }
  });

  test('T1 a T3 dan el mismo efecto que en SQL y se abortan: nada queda guardado', async () => {
    const antes = (await api.get('/api/v1/nosql').expect(200)).body.data.colecciones;
    for (const codigo of ['T1', 'T2', 'T3']) {
      const r = (await api.post(`/api/v1/nosql/consultas/${codigo}/ejecuciones`).expect(201)).body.data;
      assert.equal(r.comparacion.equivalente, true, `${codigo}: ${JSON.stringify(r.comparacion)}`);
      assert.equal(r.mongo.transaccion, 'abortTransaction');
    }
    const despues = (await api.get('/api/v1/nosql').expect(200)).body.data.colecciones;
    assert.deepEqual(despues.map((c) => [c.nombre, c.total, c.ejemplo]), antes.map((c) => [c.nombre, c.total, c.ejemplo]));
  });

  test('N1 a N7: el validador rechaza lo inválido y N7 muestra lo que MongoDB no protege', async () => {
    const { pruebas } = (await api.get('/api/v1/nosql/consultas').expect(200)).body.data;
    assert.equal(pruebas.length, 7);
    for (const p of pruebas) {
      const r = (await api.post(`/api/v1/nosql/pruebas/${p.codigo}/ejecuciones`).expect(201)).body.data;
      assert.equal(r.cumpleLoEsperado, true, `${p.codigo}: ${JSON.stringify(r)}`);
      assert.equal(r.rechazada, p.esperado === 'rechazo', p.codigo);
    }
    const oficios = (await api.get('/api/v1/nosql').expect(200)).body.data.colecciones.find((c) => c.nombre === 'oficios');
    assert.equal(oficios.total, 10, 'N7 se abortó: el oficio sigue existiendo');
  });

  test('cada documento de nosql/ejemplos es Extended JSON válido y lo acepta su validador', async () => {
    const { mongo } = await import('../src/config/mongo.js');
    const { cliente } = await mongo();
    const db = cliente.db('plumb_prueba_ejemplos');
    const { crearColecciones } = createRequire(import.meta.url)('../../nosql/esquema.cjs');
    try {
      await crearColecciones(db, { borrar: true });
      const carpeta = new URL('../../nosql/ejemplos/', import.meta.url);
      const archivos = await readdir(carpeta);
      assert.equal(archivos.length, 6);
      for (const archivo of archivos) {
        const doc = BSON.EJSON.parse(await readFile(new URL(archivo, carpeta), 'utf8'));
        await db.collection(archivo.replace('.json', '')).insertOne(doc);
      }
    } finally {
      await db.dropDatabase();
    }
  });

  test('una consulta que no existe responde 404', async () => {
    const r = await api.post('/api/v1/nosql/consultas/Q9/ejecuciones').expect(404);
    assert.equal(r.body.error.codigo, 'NO_ENCONTRADO');
  });
});
