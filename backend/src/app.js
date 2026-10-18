import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { manejarErrores, rutaNoEncontrada } from './middlewares/errores.js';
import { registrarPeticiones } from './middlewares/registro.js';
import rutas from './routes/index.js';

const app = express();

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: env.corsOrigins }));
app.use(express.json({ limit: '20kb' }));
app.use(registrarPeticiones);

app.get('/', (req, res) => res.redirect('/api/v1'));

app.get('/api/v1', (req, res) => {
  res.json({
    ok: true,
    data: {
      nombre: 'Plumb API',
      version: '2.0.0',
      grupo: 'Grupo 13, ICI324, Universidad de Valparaíso',
      recursos: ['/salud', '/regiones', '/oficios', '/catalogo', '/ranking', '/maestros',
        '/clientes', '/solicitudes', '/consultas', '/nosql'].map((ruta) => `/api/v1${ruta}`),
    },
  });
});

app.use('/api/v1', rutas);

app.use(rutaNoEncontrada);
app.use(manejarErrores);

export default app;
