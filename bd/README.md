# Grupo13-Plumb-BD

Base de datos de Plumb para PostgreSQL 17.

| Archivo | Contenido |
|---|---|
| `Grupo13-Plumb-BD.sql` | Script completo: los tres archivos siguientes en uno |
| `01_esquema.sql` | 6 tablas, restricciones con nombre, 3 índices y la vista `v_reputacion_maestro` |
| `02_datos.sql` | Datos ficticios: 16 regiones, 10 oficios, 16 clientes, 43 maestros, 117 solicitudes, 67 calificaciones |
| `03_consultas.sql` | Las 13 consultas exigidas con su álgebra relacional, dentro de `BEGIN ... ROLLBACK` |

```bash
psql "postgresql://usuario:clave@servidor/base" -f Grupo13-Plumb-BD.sql
```

El script borra y recrea las tablas, así que sirve para dejar la base como recién instalada.
