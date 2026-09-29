require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/maestros', require('./routes/maestroRoutes'));
app.use('/api/solicitudes', require('./routes/solicitudRoutes'));
app.use('/api/clientes', require('./routes/clienteRoutes'));
app.use('/api/oficios', require('./routes/oficioRoutes'));
app.use('/api/regiones', require('./routes/regionRoutes'));
app.use('/api/calificaciones', require('./routes/calificacionRoutes'));

app.get('/', (req, res) => res.json({ message: 'Plumb API v1.0' }));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));