# Plumb - Backend API (Etapa I)

Marketplace de oficios independientes. Este repositorio contiene el código fuente del backend (API REST) y el script de la base de datos oficial para el proyecto Plumb (Grupo 13).

## 📌 Requisitos Previos
- **Node.js**: v18 o superior.
- **MySQL**: v8.0 o superior.
- **Git**

## 🚀 Guía de Instalación y Replicación

### 1. Clonar el repositorio
\`\`\`bash
git clone <URL_DEL_REPOSITORIO>
cd Grupo13-Plumb-Backend
\`\`\`

### 2. Configuración de la Base de Datos
El proyecto requiere una base de datos MySQL. El script oficial con las tablas, relaciones (Integridad Referencial) y datos semilla se encuentra en la carpeta `database`.

1. Abre tu cliente de MySQL (ej. MySQL Workbench o terminal).
2. Ejecuta el script completo ubicado en:
   \`database/Grupo13-Plumb-BD.sql\`
   *(Este script creará la base de datos `PlumbDB` y poblará las tablas automáticamente).*

### 3. Configuración del Entorno (.env)
En la raíz del proyecto, copia el archivo de ejemplo y renómbralo a `.env`:
\`\`\`bash
cp .env.example .env
\`\`\`
Abre el archivo `.env` y configura tus credenciales locales de MySQL:
\`\`\`ini
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=tu_contraseña_aqui
DB_NAME=PlumbDB
PORT=3000
\`\`\`

### 4. Instalación de Dependencias
Ejecuta el siguiente comando para instalar las librerías necesarias (Express, mysql2, dotenv, cors):
\`\`\`bash
npm install
\`\`\`

### 5. Iniciar el Servidor
Para iniciar el servidor en modo desarrollo (con recarga automática):
\`\`\`bash
npm run dev
\`\`\`
*(El servidor se ejecutará en http://localhost:3000)*



## 📡 Endpoints Principales (13 Consultas de la Rúbrica)

La API implementa todas las operaciones transaccionales solicitadas en la Etapa I:

### Catálogo y Filtros (JOINs)
- \`GET /api/maestros\` → Lista todos los maestros disponibles.
- \`GET /api/maestros/buscar?region=1&especialidad=1\` → Busca maestros aplicando filtros (con JOIN a Regiones y Oficios).

### Transacciones (Solicitudes)
- \`POST /api/solicitudes\` → Crea una nueva solicitud de trabajo (Vincula Cliente y Maestro).
- \`GET /api/solicitudes\` → Lista el historial de solicitudes (con JOIN a Cliente y Maestro).
- \`PUT /api/solicitudes/:id/estado\` → Actualiza el estado de una solicitud (Pendiente, Aceptada, Finalizado).
- \`DELETE /api/solicitudes/:id\` → Elimina una solicitud pendiente.

### Mantenedores CRUD
- \`POST /api/maestros\` → Registra un nuevo maestro.
- \`PUT /api/maestros/:rut\` → Actualiza datos de un maestro (ej. Disponibilidad).
- \`POST /api/clientes\` → Registra un nuevo cliente.
- \`DELETE /api/clientes/:rut\` → Elimina un cliente.

---
**Desarrollado por el Grupo 13**  
Vicente Fernández · Maximiliano Sepúlveda · Vicente Cid  
*ICI324 - Bases de Datos y Programación Web (Universidad de Valparaíso)*
