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
| `/solicitudes` | Historial del cliente y bandeja del maestro |
| `/registro` | Registro de clientes, solo mayores de 18 |
| `/admin` | Mantenedores de maestros y oficios, y moderación |
| `/consultas` | Laboratorio con las 13 consultas y las pruebas de integridad |

En producción la API se sirve en el mismo dominio (`/api/v1`), por eso `VITE_API_URL` queda vacía.
