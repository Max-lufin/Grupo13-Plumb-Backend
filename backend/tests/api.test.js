// Pruebas de la API contra un MongoDB real (el de MONGODB_URI), en una base
// aparte (plumb_prueba). Antes de empezar se recrean las colecciones y se cargan
// los datos de ejemplo. Ejecutar con: npm test   (requiere: docker compose up -d)
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import request from 'supertest';

process.env.NODE_ENV = 'test';
process.env.MONGODB_DB = 'plumb_prueba';
const { default: app } = await import('../src/app.js');
const { mongo, cerrarMongo } = await import('../src/config/mongo.js');
const { cargarDatos } = await import('../scripts/db-init.js');
const { verificarToken } = await import('../src/utils/credenciales.js');
const { env } = await import('../src/config/env.js');

const api = request(app);
const PEDRO = '7765180-2';
const MARIA = '12588772-4';
const CLAVE = 'plumb2026';
const token = {};

const conSesion = (metodo, ruta, quien) => api[metodo](ruta).set('Authorization', `Bearer ${token[quien]}`);

before(async () => {
  const { db } = await mongo();
  await cargarDatos(db);
  for (const [quien, email] of [['cliente', 'maria.gonzalez@ejemplo.cl'], ['maestro', 'pedro.gonzalez@ejemplo.cl'], ['admin', 'admin@plumb.cl']]) {
    token[quien] = (await api.post('/api/v1/sesiones').send({ email, contrasena: CLAVE }).expect(201)).body.data.token;
  }
});

after(cerrarMongo);

describe('conexión a la base de datos', () => {
  test('GET /salud informa motor, latencia y documentos por tipo', async () => {
    const r = await api.get('/api/v1/salud').expect(200);
    assert.equal(r.body.data.bd.conectada, true);
    assert.match(r.body.data.bd.motor, /^MongoDB \d/);
    assert.deepEqual(r.body.data.documentos, { clientes: 16, maestros: 43, administradores: 1, oficios: 10, solicitudes: 117 });
  });
});

describe('inicio de sesión y permisos', () => {
  test('con credenciales correctas entrega un token firmado con el rut y los roles', async () => {
    const r = await api.post('/api/v1/sesiones').send({ email: 'maria.gonzalez@ejemplo.cl', contrasena: CLAVE }).expect(201);
    assert.deepEqual(r.body.data.usuario.roles, ['cliente']);
    const datos = verificarToken(r.body.data.token, env.sesionSecreto);
    assert.equal(datos.sub, MARIA);
    assert.ok(datos.exp > Date.now() / 1000);
  });

  test('con contraseña incorrecta responde 401 sin decir qué dato falló', async () => {
    const r = await api.post('/api/v1/sesiones').send({ email: 'maria.gonzalez@ejemplo.cl', contrasena: 'otra1234' }).expect(401);
    assert.equal(r.body.error.mensaje, 'Correo o contraseña incorrectos.');
    const r2 = await api.post('/api/v1/sesiones').send({ email: 'nadie@ejemplo.cl', contrasena: 'otra1234' }).expect(401);
    assert.equal(r2.body.error.mensaje, r.body.error.mensaje);
  });

  test('un token alterado o vencido responde 401', async () => {
    const [cabecera, , firma] = token.cliente.split('.');
    const falso = Buffer.from(JSON.stringify({ sub: PEDRO, roles: ['administrador'], exp: 9999999999 })).toString('base64url');
    await api.get('/api/v1/maestros').set('Authorization', `Bearer ${cabecera}.${falso}.${firma}`).expect(401);
  });

  test('sin sesión, las rutas protegidas responden 401; con otro rol, 403', async () => {
    await api.get('/api/v1/maestros').expect(401);
    await conSesion('get', '/api/v1/maestros', 'cliente').expect(403);
    await conSesion('get', '/api/v1/maestros', 'admin').expect(200);
  });

  test('cada persona solo ve sus propias solicitudes', async () => {
    await conSesion('get', `/api/v1/solicitudes?cliente=${MARIA}`, 'cliente').expect(200);
    await conSesion('get', '/api/v1/solicitudes?cliente=13345441-1', 'cliente').expect(403);
    await conSesion('get', '/api/v1/maestros/16178972-0/solicitudes', 'maestro').expect(403);
  });

  test('ninguna respuesta incluye el hash de la contraseña', async () => {
    const r = await conSesion('get', '/api/v1/maestros', 'admin').expect(200);
    assert.ok(!JSON.stringify(r.body).includes('scrypt$'));
    const n = await api.get('/api/v1/nosql').expect(200);
    assert.ok(!/scrypt\$[A-Za-z0-9+/]/.test(JSON.stringify(n.body)));
  });
});

describe('CU-01 · catálogo con filtros', () => {
  test('sin filtros obligatorios responde 400 y explica qué falta', async () => {
    const r = await api.get('/api/v1/catalogo').expect(400);
    const campos = r.body.error.detalles.map((d) => d.campo);
    assert.ok(campos.includes('region') && campos.includes('oficio'));
  });

  test('con los 2 obligatorios y los 4 opcionales devuelve los maestros que cumplen', async () => {
    const r = await api.get('/api/v1/catalogo')
      .query({ region: 6, oficio: 1, tarifaMax: 25000, calificacionMin: 4, disponible: true, experienciaMin: 3 }).expect(200);
    assert.ok(r.body.data.length > 0);
    for (const m of r.body.data) {
      assert.equal(m.id_region, 6);
      assert.equal(m.id_oficio, 1);
      assert.ok(m.tarifa_hora <= 25000 && m.promedio >= 4 && m.disponible && m.experiencia_anios >= 3);
    }
  });

  test('un oficio sin maestros devuelve lista vacía (no error)', async () => {
    const r = await api.get('/api/v1/catalogo').query({ region: 6, oficio: 10 }).expect(200);
    assert.deepEqual(r.body.data, []);
  });

  test('ranking ordenado por calificación promedio descendente', async () => {
    const r = await api.get('/api/v1/ranking').expect(200);
    const notas = r.body.data.map((m) => m.promedio);
    assert.deepEqual(notas, [...notas].sort((a, b) => b - a));
  });

  test('el perfil público no muestra el teléfono ni el correo del maestro', async () => {
    const r = await api.get(`/api/v1/maestros/${PEDRO}`).expect(200);
    assert.equal(r.body.data.telefono, undefined);
    assert.equal(r.body.data.email, undefined);
    assert.ok(r.body.data.resenas.length <= 5);
  });
});

describe('CU-02 · transacción Cliente–Maestro–Solicitud', () => {
  let id;
  let promedioAntes;

  test('un visitante no puede pedir un servicio (401)', async () => {
    await api.post('/api/v1/solicitudes').send({}).expect(401);
  });

  test('el cliente crea una solicitud pendiente (201) con el folio siguiente', async () => {
    promedioAntes = (await api.get(`/api/v1/maestros/${PEDRO}`)).body.data.total_resenas;
    const r = await conSesion('post', '/api/v1/solicitudes', 'cliente').send({
      rut_maestro: PEDRO, descripcion: 'Gotea la llave del baño incluso cerrada.', direccion: 'Calle Uno 123, Valparaíso', fecha_servicio: '2099-01-15',
    }).expect(201);
    assert.equal(r.body.data.estado, 'Pendiente');
    assert.equal(r.body.data.id_solicitud, 118);
    id = r.body.data.id_solicitud;
  });

  test('aparece en la bandeja del maestro, con el nombre del cliente copiado', async () => {
    const r = await conSesion('get', `/api/v1/maestros/${PEDRO}/solicitudes?estado=Pendiente`, 'maestro').expect(200);
    const s = r.body.data.find((x) => x.id_solicitud === id);
    assert.equal(s.cliente, 'María González Rojas');
  });

  test('el cliente no puede aceptar su propia solicitud (403)', async () => {
    await conSesion('patch', `/api/v1/solicitudes/${id}`, 'cliente').send({ estado: 'Aceptada' }).expect(403);
  });

  test('el maestro la acepta y el cliente ya ve su teléfono', async () => {
    await conSesion('patch', `/api/v1/solicitudes/${id}`, 'maestro').send({ estado: 'Aceptada' }).expect(200);
    const r = await conSesion('get', `/api/v1/solicitudes?cliente=${MARIA}`, 'cliente').expect(200);
    assert.match(r.body.data.find((x) => x.id_solicitud === id).telefono_maestro, /^\+569/);
  });

  test('el maestro la finaliza; no puede volver a pendiente (422)', async () => {
    await conSesion('patch', `/api/v1/solicitudes/${id}`, 'maestro').send({ estado: 'Finalizada' }).expect(200);
    await conSesion('patch', `/api/v1/solicitudes/${id}`, 'maestro').send({ estado: 'Pendiente' }).expect(422);
  });

  test('el cliente la califica una sola vez y la reputación del maestro se actualiza', async () => {
    await conSesion('post', `/api/v1/solicitudes/${id}/calificacion`, 'cliente').send({ puntuacion: 4, comentario: 'Rápido.' }).expect(201);
    await conSesion('post', `/api/v1/solicitudes/${id}/calificacion`, 'cliente').send({ puntuacion: 5 }).expect(422);
    const perfil = (await api.get(`/api/v1/maestros/${PEDRO}`)).body.data;
    assert.equal(perfil.total_resenas, promedioAntes + 1);
    assert.equal(perfil.resenas[0].comentario, 'Rápido.');
  });

  test('la moderación borra la solicitud y recalcula la reputación', async () => {
    await conSesion('delete', `/api/v1/solicitudes/${id}`, 'maestro').expect(403);
    await conSesion('delete', `/api/v1/solicitudes/${id}`, 'admin').expect(200);
    const perfil = (await api.get(`/api/v1/maestros/${PEDRO}`)).body.data;
    assert.equal(perfil.total_resenas, promedioAntes);
    assert.ok(perfil.resenas.every((r) => r.comentario !== 'Rápido.'));
  });

  test('no se puede pedir un servicio para una fecha pasada', async () => {
    const r = await conSesion('post', '/api/v1/solicitudes', 'cliente').send({
      rut_maestro: PEDRO, descripcion: 'Trabajo para una fecha que ya pasó.', direccion: 'Calle Dos 456', fecha_servicio: '2020-01-01',
    }).expect(422);
    assert.equal(r.body.error.detalles[0].campo, 'fecha_servicio');
  });
});

describe('RF-05 · registro solo para mayores de 18', () => {
  const persona = { rut_cliente: '20.345.678-6', nombre: 'Tomás Henríquez Salas', email: 'tomas.prueba@ejemplo.cl', fecha_nacimiento: '2001-04-22', contrasena: 'segura2026' };

  test('rechaza a un menor con 422', async () => {
    const hoy = new Date();
    const r = await api.post('/api/v1/clientes').send({ ...persona, fecha_nacimiento: `${hoy.getFullYear() - 15}-01-01` }).expect(422);
    assert.equal(r.body.error.detalles[0].campo, 'fecha_nacimiento');
  });

  test('rechaza un RUT con dígito verificador incorrecto y una contraseña débil (400)', async () => {
    const r = await api.post('/api/v1/clientes').send({ ...persona, rut_cliente: '12345678-0', contrasena: 'corta' }).expect(400);
    const campos = r.body.error.detalles.map((d) => d.campo);
    assert.ok(campos.includes('rut_cliente') && campos.includes('contrasena'));
  });

  test('acepta a un adulto, normaliza el RUT y puede iniciar sesión', async () => {
    const r = await api.post('/api/v1/clientes').send(persona).expect(201);
    assert.equal(r.body.data.rut_cliente, '20345678-6');
    await api.post('/api/v1/sesiones').send({ email: persona.email, contrasena: persona.contrasena }).expect(201);
  });

  test('el mismo RUT o el mismo correo no se registran dos veces (409)', async () => {
    await api.post('/api/v1/clientes').send(persona).expect(409);
    const r = await api.post('/api/v1/clientes').send({ ...persona, rut_cliente: '21111111-9', email: persona.email }).expect(409);
    assert.equal(r.body.error.mensaje, 'Ese correo ya está registrado.');
  });
});

describe('mantenedores (solo administrador)', () => {
  test('CRUD completo de un oficio; renombrar actualiza la copia en los maestros', async () => {
    await conSesion('post', '/api/v1/oficios', 'cliente').send({ nombre: 'Soldador' }).expect(403);
    const creado = await conSesion('post', '/api/v1/oficios', 'admin').send({ nombre: 'Soldador', descripcion: 'Rejas y estructuras.' }).expect(201);
    const id = creado.body.data.id_oficio;
    assert.equal(id, 11);
    await api.get(`/api/v1/oficios/${id}`).expect(200);
    await conSesion('put', `/api/v1/oficios/${id}`, 'admin').send({ nombre: 'Soldador al arco', descripcion: null }).expect(200);
    await conSesion('delete', `/api/v1/oficios/${id}`, 'admin').expect(200);

    await conSesion('put', '/api/v1/oficios/1', 'admin').send({ nombre: 'Gasfíter y sanitario' }).expect(200);
    const r = await api.get('/api/v1/catalogo').query({ region: 6, oficio: 1 }).expect(200);
    assert.ok(r.body.data.every((m) => m.oficio === 'Gasfíter y sanitario'));
    await conSesion('put', '/api/v1/oficios/1', 'admin').send({ nombre: 'Gasfíter', descripcion: 'Cañerías, grifería, calefont y artefactos sanitarios.' }).expect(200);
  });

  test('un oficio con el nombre de otro responde 409', async () => {
    await conSesion('post', '/api/v1/oficios', 'admin').send({ nombre: 'gasfíter' }).expect(409);
  });

  test('borrar un oficio con maestros responde 409 (la regla RESTRICT vive en la API)', async () => {
    const r = await conSesion('delete', '/api/v1/oficios/1', 'admin').expect(409);
    assert.match(r.body.error.mensaje, /maestros/);
  });

  test('CRUD completo de un maestro', async () => {
    const maestro = {
      rut_maestro: '16234567-2', nombre: 'Gabriel Morales Iturra', email: 'gabriel.prueba@ejemplo.cl', telefono: '+56912345678',
      fecha_nacimiento: '1990-09-03', id_oficio: 4, id_region: 6, tarifa_hora: 15000, experiencia_anios: 7, contrasena: 'pintor2026',
    };
    await conSesion('post', '/api/v1/maestros', 'admin').send(maestro).expect(201);
    await conSesion('put', `/api/v1/maestros/${maestro.rut_maestro}`, 'admin').send({ ...maestro, tarifa_hora: 16000, contrasena: undefined }).expect(200);
    const r = await conSesion('patch', `/api/v1/maestros/${maestro.rut_maestro}`, 'admin').send({ disponible: false }).expect(200);
    assert.equal(r.body.data.disponible, false);
    const perfil = (await api.get(`/api/v1/maestros/${maestro.rut_maestro}`)).body.data;
    assert.equal(perfil.region, 'Valparaíso');
    assert.equal(perfil.tarifa_hora, 16000);
    await conSesion('delete', `/api/v1/maestros/${maestro.rut_maestro}`, 'admin').expect(200);
  });

  test('un maestro con historial no se puede borrar (409)', async () => {
    await conSesion('delete', `/api/v1/maestros/${PEDRO}`, 'admin').expect(409);
  });
});

describe('laboratorio · las 13 consultas en MQL', () => {
  test('lista 13 consultas: 2 ALTER, 3 SELECT, 2 UPDATE, 3 INSERT, 2 DELETE, 1 DROP, cada una con su SQL y su MQL', async () => {
    const r = await api.get('/api/v1/consultas').expect(200);
    const conteo = {};
    for (const c of r.body.data.consultas) {
      conteo[c.tipo] = (conteo[c.tipo] ?? 0) + 1;
      assert.ok(c.sql && c.mql, `la consulta ${c.numero} no trae SQL y MQL`);
    }
    assert.deepEqual(conteo, { ALTER: 2, SELECT: 3, UPDATE: 2, INSERT: 3, DELETE: 2, DROP: 1 });
    const mql = r.body.data.consultas.map((c) => c.mql).join('\n');
    assert.ok(mql.includes('$lookup') && mql.includes('$group') && mql.includes('$lte'), 'faltan JOIN, GROUP BY u operadores');
  });

  for (let n = 1; n <= 13; n += 1) {
    test(`la consulta ${n} se ejecuta en MongoDB y la base queda igual`, async () => {
      const antes = (await api.get('/api/v1/salud')).body.data.documentos;
      const r = await api.post(`/api/v1/consultas/${n}/ejecuciones`).expect(201);
      assert.ok(r.body.data.pasos.length > 0);
      if (r.body.data.modo === 'lectura') {
        assert.ok(r.body.data.plan.indice, `la consulta ${n} no usó índice`);
        assert.equal(r.body.data.plan.ordenEnMemoria, false);
      }
      const despues = (await api.get('/api/v1/salud')).body.data.documentos;
      assert.deepEqual(despues, antes);
    });
  }

  for (const codigo of ['N1', 'N2', 'N3', 'N4', 'N5', 'N6', 'N7', 'N8']) {
    test(`la prueba de integridad ${codigo} se comporta como se espera`, async () => {
      const r = await api.post(`/api/v1/pruebas-integridad/${codigo}/ejecuciones`).expect(201);
      assert.equal(r.body.data.cumpleLoEsperado, true, JSON.stringify(r.body.data));
    });
  }

  test('las pruebas no dejan cambios: el oficio 1 sigue existiendo', async () => {
    await api.get('/api/v1/oficios/1').expect(200);
  });
});

describe('forma de las respuestas', () => {
  test('una ruta inexistente responde 404 con la misma estructura de error', async () => {
    const r = await api.get('/api/v1/no-existe').expect(404);
    assert.deepEqual(Object.keys(r.body), ['ok', 'error']);
    assert.equal(r.body.error.codigo, 'NO_ENCONTRADO');
  });

  test('JSON mal formado responde 400', async () => {
    await api.post('/api/v1/sesiones').set('Content-Type', 'application/json').send('{"email":').expect(400);
  });

  test('GET /nosql: 8 decisiones de traspaso y 4 colecciones con documento, índices y validador', async () => {
    const r = await api.get('/api/v1/nosql').expect(200);
    assert.equal(r.body.data.traspaso.length, 8);
    for (const c of r.body.data.colecciones) {
      assert.ok(c.ejemplo && c.indices.length);
      assert.match(c.validador, /\$jsonSchema/);
    }
  });
});
