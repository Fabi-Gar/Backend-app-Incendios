# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Backend system for wildfire monitoring and alert management (Sistema de monitoreo y alerta de incendios) built with Node.js, TypeScript, Express, and TypeORM. The application monitors fire incidents in Guatemala using NASA FIRMS satellite data, manages incident reports, and handles real-time notifications via Firebase push notifications.

## Development Commands

### Local Development
```bash
npm run dev                  # Run with tsx watch (hot reload)
npm run build                # Compile TypeScript to dist/
npm start                    # Run compiled code from dist/
```

### Database Migrations
```bash
npm run migration:generate -- src/db/migrations/MigrationName  # Generate from entities
npm run migration:create -- src/db/migrations/MigrationName    # Create empty migration
npm run migration:run        # Run pending migrations (uses dist/)
npm run migration:revert     # Revert last migration
npm run migration:show       # Show migration status
```

### Seeding
```bash
npm run seed                 # Run seed from src/ (development)
npm run seed:dist            # Run seed from dist/ (production)
```

### Docker Development
```bash
# Full stack rebuild
docker compose -f docker-compose.dev.yml up -d --build

# Rebuild and start only API
docker compose -f docker-compose.dev.yml build api
docker compose -f docker-compose.dev.yml up -d api

# Clean rebuild (no cache)
docker compose -f docker-compose.dev.yml build --no-cache api
docker compose -f docker-compose.dev.yml up -d api

# Run seed after containers are up
docker compose -f docker-compose.dev.yml exec api node dist/db/seeds/171004_seed_inicial.js
```

## Architecture

### Module Structure
The codebase follows a modular architecture under `src/modules/`:

- **auth**: Authentication and login logic
- **seguridad**: Security module with usuarios (users), roles, and instituciones (institutions)
- **incendios**: Core fire incident management (incendios, seguidores, fotos). Incendio entity now includes all initial report data
- **geoespacial**: Geospatial data handling, FIRMS satellite integration, puntos-calor (heat points)
- **notificaciones**: Push notifications via Firebase (FCM) and Expo, notification preferences
- **cierre**: Fire closure workflow with detailed forms (causas, medios, abastos, etc.)
- **catalogos**: Static catalogs (departamentos, municipios, medios, estados-incendio)
- **auditoria**: Audit trail for entity changes
- **eventos**: Event streaming
- **feed**: Activity feed
- **jobs**: Background job definitions
- **responsable**: Incident responsibility assignments

### Database Layer
- **TypeORM** with PostgreSQL + PostGIS extension for geospatial data
- Custom `SnakeNamingStrategy` converts camelCase to snake_case column names
- Entities located at `src/modules/**/entities/**/*.entity.ts`
- Migrations in `src/db/migrations/`
- Data source configured in `src/db/data-source.ts`

### Configuration
- Environment variables validated with **Zod** schema in `src/config/env.ts`
- All config centralized through `env` object exported from `src/config/env.ts`
- Uses `dotenv` + `dotenv-expand` for variable expansion
- `.env` file contains all required configuration (see `.env` for full list)

### Middleware Stack (in order)
1. **helmet**: Security headers (CORS resource policy: cross-origin)
2. **cors**: Configured via `CORS_ALLOWED_ORIGINS` (comma-separated)
3. **pinoHttp**: Request logging
4. **express.json**: Body parsing with configurable size limit
5. **rateLimit**: Rate limiting (window + max requests)
6. **express.static**: `/uploads` directory for media files
7. **contextMiddleware**: Initializes request context with requestId, IP, user agent
8. **authMiddleware**: JWT token validation, injects user into `res.locals.ctx`

### Authentication & Authorization
- JWT tokens with configurable issuer, audience, expiration
- Middleware at `src/middlewares/auth.ts` provides:
  - `authMiddleware`: Validates JWT, loads user, injects into context
  - `guardAuth`: Requires authenticated user
  - `guardAdmin`: Requires admin user (`is_admin` flag)
- Public routes: `/auth/login`, `/auth/register`, `/health/*`
- All other routes require Bearer token in Authorization header
- User context available at `res.locals.ctx.user` with: `usuario_uuid`, `email`, `nombre`, `apellido`, `is_admin`, `rol_uuid`, `institucion_uuid`

### Background Jobs & Queues
- **BullMQ** with **Redis** for job queue management
- Queue builder in `src/queue/bulls.ts`
- Connection config: `maxRetriesPerRequest=null`, `enableReadyCheck=false` (required for BullMQ v5)
- **FIRMS data ingestion** scheduled via cron (configurable with `FIRMS_FETCH_CRON`, default: every 2 hours)
- Queue initialized in `src/modules/geoespacial/firms.queue.ts`
- Worker automatically processes `firms:ingest` jobs calling `runFirmsIngest()`

### FIRMS Satellite Integration
- Fetches fire detection data from NASA FIRMS API
- Configurable products: VIIRS_SNPP_NRT, VIIRS_NOAA20_NRT, MODIS_NRT
- Filters by country (GTM), bounding box, date range, and confidence
- Deduplication using spatial/temporal clustering
- Configurable buffer radius (`FIRMS_BUFFER_KM`) and time window (`FIRMS_TIME_WINDOW_H`)

### Push Notifications
- Firebase Admin SDK initialized in `src/modules/notificaciones/firebasePush.service.ts`
- Service account JSON path: `FIREBASE_SERVICE_ACCOUNT_PATH` (default: `./config/firebase-service-account.json`)
- Users register FCM tokens via `/api/push/register`
- Notification preferences per user stored in `UserPushPrefs`
- Notification services: `incendioNotify.service.ts`, `cierreNotify.service.ts`

### Geospatial Data
- PostgreSQL with PostGIS extension (enabled in migration `1759626803524-EnableExtensions.ts`)
- Geometries stored as `geography(Point, 4326)` for GPS coordinates
- Area calculations in hectares
- Spatial indices on punto_calor and incendio tables

### Error Handling
- Centralized error handlers in `src/app/error.ts`
- `notFound`: 404 handler
- `onError`: Global error handler with request context
- Errors return JSON with `error.code`, `error.message`, and `requestId`

### Logging
- **Pino** logger with configurable log level (`LOG_LEVEL` in .env)
- Request logging via `pino-http` middleware
- Logger instances created with: `pino({ level: env.LOG_LEVEL })`

### Static File Uploads
- Media files served from `/uploads` route (mapped to `MEDIA_DIR` or `./uploads`)
- Base URL configurable via `MEDIA_BASE_URL`
- 7-day cache headers, fallthrough enabled
- `X-Content-Type-Options: nosniff` header set

### Health Checks
- `/health/liveness`: Basic liveness check
- `/health/readiness`: Readiness check (DB, Redis)
- Docker healthcheck configured to poll liveness endpoint every 30s

### OpenAPI Documentation
- Cierre (closure) workflow documented in `openapi-cierre.yaml`
- Endpoints: `/cierre/init`, `/cierre/{incendio_uuid}/catalogos`, `/cierre/{incendio_uuid}/finalizar`

## Key Implementation Notes

### TypeORM Conventions
- All entities use `@Entity()` decorator with snake_case table names (via NamingStrategy)
- Primary keys typically named `{entity}_uuid` (UUID v4)
- Soft delete pattern: `eliminado_en` timestamp column (nullable)
- Audit timestamps: `creado_en`, `actualizado_en` (triggers in migrations)
- Queries should filter soft-deleted records: `{ eliminado_en: IsNull() }`

### Password Hashing
- Configurable algorithm: `argon2id` (default) or `bcrypt`
- Argon2 params: memory, time, parallelism (see `ARGON2_*` env vars)
- Utils in `src/utils/password.ts`

### Request Context Pattern
- Context object at `res.locals.ctx` contains:
  - `requestId`: Unique request identifier (UUID)
  - `ip`: Client IP
  - `ua`: User agent string
  - `user`: Authenticated user object (or null)
- Context initialized in `contextMiddleware`, populated by `authMiddleware`
- Include `requestId` in all API error responses

### Simplified Incendios Architecture

**Important architectural change:** The `reportes` entity has been merged into `incendios`. The initial report data is now part of the Incendio entity itself:

**Merged fields from reportes to incendios:**
- `reportado_por` (Usuario) - who reported the incident
- `reportado_por_nombre` (string) - reporter's name
- `institucion_reporte` (Institucion) - reporting institution
- `telefono` (string) - contact phone
- `reportado_en` (Date) - report date
- `medio` (Medio) - reporting medium (phone, app, radio, etc.)
- `departamento` (Departamento)
- `municipio` (Municipio)
- `lugar_poblado` (string) - town/locality
- `finca` (string) - farm/property name

**Flow:**
1. Creating an incendio (POST /incendios) now includes all initial report data
2. Subsequent updates are handled via the `cierre` (closure) module
3. Photos are associated directly with incendios via `FotoReporte`

**Key endpoints:**
- `POST /incendios` - Create incendio with initial report data (supports multipart for photo upload)
- `POST /incendios/:incendio_uuid/fotos` - Upload additional photos
- `GET /incendios/:incendio_uuid/fotos` - Get photos for an incendio

### Module Route Mounting
Routes are mounted in `src/app.ts` with their base paths:
- `/auth` → auth module
- `/usuarios` → users
- `/incendios` → incidents (includes initial report data and photo uploads)
- `/seguidores` → followers
- `/catalogos` → catalogs
- `/roles` → roles
- `/firms` → FIRMS data
- `/monitor` → monitoring/SSE
- `/departamentos` → departments
- `/cierre` → closure workflow
- `/instituciones` → institutions
- `/puntos-calor` → heat points
- `/api/push/*` → push notification registration
- `/api/notificaciones` → user notifications
- `/api/test-push` → push notification testing (development only)

### Docker Services
- **db**: PostGIS 15-3.4 (port 5432)
- **redis**: Redis 7 Alpine with AOF persistence (port 6379)
- **api**: Node.js app (port 4000)
- All services use `TZ=America/Guatemala` timezone
- Entrypoint script: `/app/docker/entrypoint.sh` (runs migrations, seeds, starts server)

### Timezone Handling
- Application timezone: `America/Guatemala` (configurable via `APP_TIMEZONE`)
- Set in environment: `TZ=America/Guatemala`
- Ensure consistency across DB, Redis, and Node.js containers

## Common Patterns

### Creating a New Module
1. Create directory: `src/modules/{module-name}/`
2. Add entities in `src/modules/{module-name}/entities/`
3. Create service files for business logic
4. Create routes file: `{module-name}.routes.ts`
5. Mount routes in `src/app.ts`
6. Generate migration: `npm run migration:generate -- src/db/migrations/Add{ModuleName}`

### Adding API Endpoint
1. Add route to appropriate `*.routes.ts` file
2. Use middleware guards: `guardAuth`, `guardAdmin` as needed
3. Access user via `res.locals.ctx.user`
4. Return errors with: `res.status(code).json({ error: { code, message }, requestId })`
5. Include `requestId` from context in responses

### Running Migrations After Changes
```bash
npm run build                                                    # Compile changes
npm run migration:generate -- src/db/migrations/DescriptiveName  # Generate migration
npm run migration:run                                            # Apply migration
```

### Adding Background Job
1. Create queue file in appropriate module: `{module}.queue.ts`
2. Import and use `buildQueue`, `buildWorker`, `defaultJobOptions` from `src/queue/bulls.ts`
3. Define job processor function
4. Initialize queue/worker in `src/server.ts` startup sequence
