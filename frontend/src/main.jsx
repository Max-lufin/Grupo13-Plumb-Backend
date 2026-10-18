import '@fontsource-variable/archivo/wdth.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/600.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/componentes.css';
import './styles/paginas.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { ProveedorAvisos } from './components/Avisos.jsx';
import Marco from './components/Marco.jsx';
import { ProveedorSesion } from './hooks/sesionDemo.jsx';
import Admin from './pages/Admin.jsx';
import Catalogo from './pages/Catalogo.jsx';
import Consultas from './pages/Consultas.jsx';
import Inicio from './pages/Inicio.jsx';
import MisSolicitudes from './pages/MisSolicitudes.jsx';
import NoEncontrada from './pages/NoEncontrada.jsx';
import Nosql from './pages/Nosql.jsx';
import PerfilMaestro from './pages/PerfilMaestro.jsx';
import Registro from './pages/Registro.jsx';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Marco />,
    children: [
      { index: true, element: <Inicio /> },
      { path: 'catalogo', element: <Catalogo /> },
      { path: 'maestros/:rut', element: <PerfilMaestro /> },
      { path: 'solicitudes', element: <MisSolicitudes /> },
      { path: 'registro', element: <Registro /> },
      { path: 'admin', element: <Admin /> },
      { path: 'consultas', element: <Consultas /> },
      { path: 'nosql', element: <Nosql /> },
      { path: '*', element: <NoEncontrada /> },
    ],
  },
]);

createRoot(document.getElementById('raiz')).render(
  <StrictMode>
    <ProveedorAvisos>
      <ProveedorSesion>
        <RouterProvider router={router} />
      </ProveedorSesion>
    </ProveedorAvisos>
  </StrictMode>,
);
