# Backend - Sistema de Incendios Forestales

Backend para el sistema de monitoreo y alerta de incendios forestales en Guatemala.

## 🚀 Inicio Rápido

### Elige tu método de instalación:

**🐳 Con Docker (Recomendado para desarrollo):**

👉 **[DOCKER_SETUP.md](./DOCKER_SETUP.md)** - Guía completa de Docker

```bash
# Inicio rápido con Docker
docker compose -f docker-compose.dev.yml down -v
docker compose -f docker-compose.dev.yml up -d --build
```

**💻 Instalación Local (Sin Docker):**

👉 **[DATABASE_SETUP.md](./DATABASE_SETUP.md)** - Guía completa sin Docker

```bash
# Inicio rápido local
npm install
npm run build
npm run migration:run
npm run seed && npm run seed:plantilla
npm run dev
```

---

## 📁 Estructura del Proyecto

```
backend-final/
├── src/
│   ├── db/
│   │   ├── migrations/       # Migraciones de BD (1 baseline consolidada)
│   │   ├── seeds/            # Datos iniciales
│   │   └── data-source.ts    # Configuración TypeORM
│   ├── modules/
│   │   ├── incendios/        # Gestión de incendios
│   │   ├── cierre/           # Sistema dinámico de cierre
│   │   ├── seguridad/        # Auth, usuarios, roles
│   │   └── notificaciones/   # Push y notificaciones
│   ├── middlewares/          # Middlewares globales
│   ├── utils/                # Utilidades (logger, pagination, errors)
│   └── server.ts             # Entry point
├── DATABASE_SETUP.md         # 📖 Guía de setup de BD
└── openapi-cierre.yaml       # Documentación API de cierre
```

---

## 🛠️ Scripts Disponibles

### Desarrollo

```bash
npm run dev              # Inicia servidor con hot reload
npm run build            # Compila TypeScript
npm start                # Inicia servidor en producción
```

### Base de Datos

```bash
npm run migration:run         # Ejecuta migraciones pendientes
npm run migration:show        # Muestra estado de migraciones
npm run migration:revert      # Revierte última migración
npm run migration:create      # Crea nueva migración

npm run seed                  # Ejecuta seed principal
npm run seed:plantilla        # Ejecuta seed de plantilla de cierre
```

### TypeORM CLI

```bash
npm run typeorm:src -- [comando]   # Ejecuta TypeORM en desarrollo
npm run typeorm:dist -- [comando]  # Ejecuta TypeORM en producción
```

---

## 🔑 Credenciales por Defecto

**Usuario Admin:**
- Email: `admin@demo.local`
- Password: `Admin123!`

⚠️ **Cambiar estas credenciales en producción**

---

## 🏗️ Arquitectura

### Tecnologías Principales

- **Runtime:** Node.js 18+
- **Framework:** Express 5
- **Lenguaje:** TypeScript
- **Base de Datos:** PostgreSQL 14+ con PostGIS
- **ORM:** TypeORM
- **Validación:** Zod
- **Auth:** JWT
- **Logging:** Pino
- **Notificaciones:** Firebase Cloud Messaging

### Características Principales

✅ **Sistema Dinámico de Cierre**
- Plantillas configurables por administrador
- Formularios con jerarquía de campos
- 12 tipos de datos soportados
- Validaciones personalizables

✅ **Gestión de Incendios**
- Aprobación/rechazo por admin
- Estados configurables
- Geolocalización con PostGIS
- Fotos y zonas afectadas

✅ **Notificaciones**
- Push notifications (FCM)
- Notificaciones in-app
- Suscripciones por municipio/departamento

✅ **Auditoría Completa**
- Soft deletes en todas las tablas
- Registro de cambios (before/after)
- Tracking de usuarios

---

## 📚 Documentación API

### OpenAPI

La documentación completa del sistema de cierre está en:

👉 **[openapi-cierre.yaml](./openapi-cierre.yaml)**

Incluye:
- 20 endpoints documentados
- Esquemas de datos completos
- Ejemplos de request/response
- Códigos de error

### Endpoints Principales

#### Incendios
- `GET /incendios` - Listar incendios
- `POST /incendios` - Crear incendio
- `GET /incendios/:uuid` - Obtener detalle
- `PATCH /incendios/:uuid` - Actualizar
- `DELETE /incendios/:uuid` - Eliminar (soft delete)
- `POST /incendios/:uuid/aprobar` - Aprobar (admin)
- `POST /incendios/:uuid/rechazar` - Rechazar (admin)

#### Cierre (Usuarios)
- `GET /cierre/:incendio_uuid` - Obtener formulario
- `POST /cierre/:incendio_uuid/respuestas` - Guardar respuestas
- `PATCH /cierre/:incendio_uuid/respuestas/:campo_uuid` - Actualizar
- `POST /cierre/:incendio_uuid/finalizar` - Extinguir (admin)

#### Plantillas (Admin)
- `GET /cierre-admin/plantillas` - Listar plantillas
- `POST /cierre-admin/plantillas` - Crear plantilla
- `GET /cierre-admin/plantillas/:uuid` - Obtener completa
- `POST /cierre-admin/plantillas/:uuid/activar` - Activar

---

## 🔐 Permisos

### Roles

- **ADMIN:** Acceso total
- **OPERADOR:** Crear y editar incendios
- **ANALISTA:** Solo lectura
- **USUARIO:** Lectura limitada

### Reglas de Cierre

| Acción | Admin | Creador | Miembro Institución |
|--------|-------|---------|-------------------|
| Editar cierre (no extinguido) | ✅ | ✅ | ✅ |
| Editar cierre (extinguido) | ✅ | ❌ | ❌ |
| Finalizar/extinguir | ✅ | ❌ | ❌ |
| Ver cierre | ✅ | ✅ | ✅ |

---

## 🧪 Testing

```bash
# TODO: Agregar tests
npm test
```

---

## 📝 Variables de Entorno

```env
# Base de Datos
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=tu_password
DB_DATABASE=incendios_db

# Servidor
NODE_ENV=development
PORT=3000

# JWT
JWT_SECRET=tu_secret_super_seguro
JWT_EXPIRES_IN=7d

# Logging
LOG_LEVEL=info

# Firebase (Notificaciones)
FIREBASE_PROJECT_ID=tu-proyecto
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@tu-proyecto.iam.gserviceaccount.com
```

---

## 🐛 Troubleshooting

Ver guía completa de troubleshooting en **[DATABASE_SETUP.md](./DATABASE_SETUP.md#-troubleshooting)**

---

## 📦 Deployment

### Build

```bash
npm run build
```

### Producción

```bash
NODE_ENV=production npm start
```

### Docker

```bash
docker build -t incendios-backend .
docker run -p 3000:3000 --env-file .env incendios-backend
```

---

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

---

## 📄 Licencia

Este proyecto es privado y confidencial.

---

## 👥 Equipo

Desarrollado para el sistema de monitoreo de incendios forestales en Guatemala.

---

## 📞 Soporte

Para problemas o preguntas, contacta al equipo de desarrollo.
