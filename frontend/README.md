# frontend

Interfaz web de Plumb (React 19 + Vite 7). Grupo 13, ICI324, Universidad de Valparaíso.

```bash
npm install
npm run dev      # http://localhost:5173 (las llamadas a /api van a localhost:3000)
npm run build    # genera dist/
```

| Ruta | Pantalla |
|---|---|
| `/` | Portada: "¿Conoces a un buen ... en ...?" y maestros destacados |
| `/catalogo` | Caso de uso Consulta: 2 filtros obligatorios y 4 opcionales |
| `/maestros/:rut` | Perfil, reseñas y orden de trabajo (caso de uso Transacción) |
| `/ingresar` | Inicio de sesión (cliente, maestro o administrador) |
| `/solicitudes` | Historial del cliente (cancelar y calificar) y bandeja del maestro (aceptar, rechazar, finalizar) |
| `/registro` | Registro de clientes, solo mayores de 18, con contraseña |
| `/admin` | Solo administrador: mantenedores de maestros y oficios, y moderación |
| `/consultas` | Las 13 consultas de la Etapa I convertidas a MQL y ejecutadas en MongoDB, y las pruebas de integridad |
| `/nosql` | Modelo de documentos: traspaso, copias a mantener y un documento real por colección |

La sesión (token) se guarda en `localStorage` y se envía en la cabecera `Authorization`. En producción la API se sirve en el mismo dominio (`/api/v1`), por eso `VITE_API_URL` queda vacía.
