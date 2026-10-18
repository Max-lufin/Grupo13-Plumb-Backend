import app from './app.js';
import { env } from './config/env.js';

// Arranque local. En Vercel no se usa: allí la app se exporta desde api/index.js.
app.listen(env.port, '0.0.0.0', () => {
  console.log(`Plumb API escuchando en http://localhost:${env.port}/api/v1`);
});
