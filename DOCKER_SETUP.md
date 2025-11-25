# Setup con Docker

Guía completa para configurar el proyecto usando Docker con base de datos limpia.

---

## ⚠️ IMPORTANTE: Empezar con BD Limpia

Docker usa un **volumen persistente** para la base de datos (`db_data`). Esto significa que **la BD NO se vacía automáticamente** al reconstruir los contenedores.

### Para empezar completamente limpio:

```bash
# 1. Detener y eliminar contenedores + volúmenes
docker compose -f docker-compose.dev.yml down -v

# Explicación de flags:
# -v : Elimina los volúmenes (¡ESTO BORRA LA BD!)
```

**⚠️ El flag `-v` eliminará todos los datos de la base de datos.**

---

## 🚀 Iniciar desde Cero (Primera Vez)

### 1. Eliminar contenedores y volúmenes anteriores

```bash
docker compose -f docker-compose.dev.yml down -v
```

### 2. Construir imágenes

```bash
docker compose -f docker-compose.dev.yml build --no-cache
```

### 3. Iniciar servicios

```bash
docker compose -f docker-compose.dev.yml up -d
```

### 4. Ver logs para verificar

```bash
docker compose -f docker-compose.dev.yml logs -f api
```

**Salida esperada:**

```
api  | 🌎 NODE_ENV=production
api  | 🕒 TZ=America/Guatemala
api  | 📦 MEDIA_DIR=/app/uploads
api  | ⏳ Esperando DB en db:5432…
api  | ✅ DB lista
api  | ⏳ Esperando Redis en redis:6379…
api  | ✅ Redis listo
api  | 📁 Asegurando carpeta de uploads: /app/uploads
api  | 🔎 Verificando build (dist)…
api  | 📦 Ejecutando migraciones (dist)…
api  | query: CREATE EXTENSION IF NOT EXISTS "uuid-ossp"
api  | query: CREATE EXTENSION IF NOT EXISTS "postgis"
api  | query: CREATE EXTENSION IF NOT EXISTS "pgcrypto"
api  | query: CREATE TABLE roles ...
api  | Migration BaselineV21800000000000 has been executed successfully.
api  | 🌱 Ejecutando seed principal (dist, idempotente)…
api  | Seed OK ✅ (roles, estados, medios, instituciones, catálogos, Huehuetenango y admin)
api  | 🌱 Ejecutando seed de plantilla de cierre (dist, idempotente)…
api  | ✅ Plantilla creada: [uuid]
api  | ✅ 10 secciones creadas
api  | ✅ 50+ campos creados
api  | 🎉 Seed de plantilla de cierre completado exitosamente!
api  | 🩺 Healthcheck path: /health/liveness
api  | 🚀 Iniciando API…
```

---

## 🔄 Comandos Comunes

### Ver logs en tiempo real

```bash
docker compose -f docker-compose.dev.yml logs -f api
```

### Reiniciar solo la API (sin borrar BD)

```bash
docker compose -f docker-compose.dev.yml restart api
```

### Reconstruir solo la API

```bash
# Si cambiaste código TypeScript
docker compose -f docker-compose.dev.yml build api
docker compose -f docker-compose.dev.yml up -d api
```

### Detener todos los servicios

```bash
docker compose -f docker-compose.dev.yml down
```

### Detener y ELIMINAR volúmenes (BD limpia)

```bash
docker compose -f docker-compose.dev.yml down -v
```

### Entrar al contenedor de la API

```bash
docker compose -f docker-compose.dev.yml exec api sh
```

### Entrar a PostgreSQL

```bash
docker compose -f docker-compose.dev.yml exec db psql -U postgres -d appIncendios2
```

### Ver estado de contenedores

```bash
docker compose -f docker-compose.dev.yml ps
```

---

## 🗄️ Ejecutar Comandos Manualmente en el Contenedor

### Ejecutar migraciones manualmente

```bash
docker compose -f docker-compose.dev.yml exec api npm run migration:run:dist
```

### Ejecutar seed principal

```bash
docker compose -f docker-compose.dev.yml exec api npm run seed:dist
```

### Ejecutar seed de plantilla

```bash
docker compose -f docker-compose.dev.yml exec api npm run seed:plantilla:dist
```

### Ver estado de migraciones

```bash
docker compose -f docker-compose.dev.yml exec api npm run migration:show
```

---

## 🔧 Variables de Entorno

El archivo `docker-compose.dev.yml` tiene las siguientes configuraciones:

### Base de Datos (líneas 4-9)
```yaml
POSTGRES_DB: appIncendios2
POSTGRES_USER: postgres
POSTGRES_PASSWORD: 58905326
TZ: America/Guatemala
```

### API (líneas 38-46)
```yaml
DB_HOST: db
DB_PORT: 5432
DB_USER: postgres
DB_PASSWORD: 58905326
DB_NAME: appIncendios2
DB_SSL: "false"
REDIS_URL: redis://redis:6379
TZ: America/Guatemala
```

**Nota:** También carga variables desde `.env` (línea 36-37).

---

## 🐛 Troubleshooting

### Error: "relation already exists"

**Causa:** La BD tiene datos antiguos de migraciones anteriores.

**Solución:**
```bash
# Eliminar volumen de BD
docker compose -f docker-compose.dev.yml down -v

# Reconstruir
docker compose -f docker-compose.dev.yml up -d --build
```

### Error: "migration has already been run"

**Causa:** TypeORM detectó que una migración vieja ya fue ejecutada.

**Solución:**
```bash
# Opción 1: Limpiar completamente
docker compose -f docker-compose.dev.yml down -v
docker compose -f docker-compose.dev.yml up -d --build

# Opción 2: Limpiar tabla de migraciones manualmente
docker compose -f docker-compose.dev.yml exec db psql -U postgres -d appIncendios2 -c "DROP TABLE IF EXISTS migrations CASCADE;"
docker compose -f docker-compose.dev.yml restart api
```

### Error: "Seeds retornaron error"

**Causa:** Los seeds son idempotentes y pueden fallar si ya existen los datos.

**Acción:** Es normal, el contenedor continuará y la API iniciará correctamente.

### La API no inicia

**Verificar logs:**
```bash
docker compose -f docker-compose.dev.yml logs -f api
```

**Verificar que la BD esté lista:**
```bash
docker compose -f docker-compose.dev.yml ps
```

Debe mostrar `healthy` para `db`.

### Cambios en código no se reflejan

**Causa:** El Dockerfile no tiene volúmenes montados para hot-reload.

**Solución:**
```bash
# Reconstruir imagen
docker compose -f docker-compose.dev.yml build api
docker compose -f docker-compose.dev.yml up -d api
```

### Puerto 5432 ya está en uso

**Causa:** Ya tienes PostgreSQL corriendo localmente.

**Solución:**
```bash
# Opción 1: Detener PostgreSQL local
# Windows (como admin):
net stop postgresql-x64-14

# Opción 2: Cambiar puerto en docker-compose.dev.yml
ports:
  - "5433:5432"  # Cambiar 5432 por 5433
```

---

## 🎯 Workflow Recomendado

### Desarrollo diario (sin cambios en BD)

```bash
# Iniciar servicios
docker compose -f docker-compose.dev.yml up -d

# Ver logs
docker compose -f docker-compose.dev.yml logs -f api
```

### Cambios en código TypeScript

```bash
# Reconstruir API
docker compose -f docker-compose.dev.yml build api
docker compose -f docker-compose.dev.yml up -d api

# Ver logs
docker compose -f docker-compose.dev.yml logs -f api
```

### Cambios en migraciones/esquema de BD

```bash
# Limpiar TODO (BD incluida)
docker compose -f docker-compose.dev.yml down -v

# Reconstruir desde cero
docker compose -f docker-compose.dev.yml up -d --build

# Ver logs
docker compose -f docker-compose.dev.yml logs -f api
```

---

## 📊 Verificación de Instalación

### 1. Verificar que los contenedores están corriendo

```bash
docker compose -f docker-compose.dev.yml ps
```

**Salida esperada:**
```
NAME                STATUS              PORTS
backend-final-db-1    running (healthy)   0.0.0.0:5432->5432/tcp
backend-final-redis-1 running (healthy)   0.0.0.0:6379->6379/tcp
backend-final-api-1   running (healthy)   0.0.0.0:4000->4000/tcp
```

### 2. Verificar tablas en la BD

```bash
docker compose -f docker-compose.dev.yml exec db psql -U postgres -d appIncendios2 -c "\dt"
```

Deberías ver ~25 tablas incluyendo:
- roles, instituciones, usuarios
- incendios, incendio_seguidores
- cierre_plantillas, cierre_secciones, cierre_campos, cierre_respuestas
- notificaciones, user_push_prefs
- etc.

### 3. Verificar usuario admin

```bash
docker compose -f docker-compose.dev.yml exec db psql -U postgres -d appIncendios2 -c "SELECT nombre, email, is_admin FROM usuarios WHERE email = 'admin@demo.local';"
```

**Salida esperada:**
```
 nombre |      email       | is_admin
--------+------------------+----------
 Admin  | admin@demo.local | t
```

### 4. Verificar plantilla de cierre

```bash
docker compose -f docker-compose.dev.yml exec db psql -U postgres -d appIncendios2 -c "SELECT nombre, activa FROM cierre_plantillas WHERE eliminado_en IS NULL;"
```

**Salida esperada:**
```
            nombre             | activa
-------------------------------+--------
 Plantilla de Cierre Estándar | t
```

### 5. Probar API

```bash
curl http://localhost:4000/health/liveness
```

**Salida esperada:**
```json
{"status":"ok"}
```

---

## 📝 Estructura de Volúmenes

```
volumes:
  db_data:  # Datos de PostgreSQL (PERSISTENTE)
```

**IMPORTANTE:** El volumen `db_data` persiste entre reinicios del contenedor. Para eliminarlo, usa el flag `-v`:

```bash
docker compose -f docker-compose.dev.yml down -v
```

---

## 🔐 Credenciales

### Usuario Admin de la Aplicación
- Email: `admin@demo.local`
- Password: `Admin123!`

### PostgreSQL
- Host: `localhost` (o `db` desde dentro del contenedor)
- Puerto: `5432`
- Usuario: `postgres`
- Password: `58905326`
- Base de datos: `appIncendios2`

### Redis
- Host: `localhost` (o `redis` desde dentro del contenedor)
- Puerto: `6379`
- Sin password

---

## 🎉 Todo Listo!

Una vez que veas estos logs, la API estará lista:

```
api  | 🎉 Seed de plantilla de cierre completado exitosamente!
api  | 🚀 Iniciando API…
```

**La API estará disponible en:** `http://localhost:4000`

---

## 📚 Ver También

- [DATABASE_SETUP.md](./DATABASE_SETUP.md) - Setup sin Docker
- [README.md](./README.md) - Documentación general
- [openapi-cierre.yaml](./openapi-cierre.yaml) - API docs
