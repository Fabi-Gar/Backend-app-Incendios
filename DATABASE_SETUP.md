# Setup de Base de Datos

## 🆕 Nueva Instalación (Baseline V2)

Esta guía te ayudará a configurar la base de datos desde cero con la nueva baseline consolidada.

### ¿Qué cambió?

- ✅ **9 migraciones → 1 migración baseline** limpia y consolidada
- ✅ Sin tabla `reportes` (datos merged en `incendios`)
- ✅ Sistema de cierre dinámico desde el inicio
- ✅ Campo `es_miembro_institucion` en usuarios
- ✅ Campo `extinguido_at` en incendios
- ✅ Tabla `incendio_seguidores` para follows
- ✅ Índice único en `puntos_calor.hash_dedupe`

---

## 📋 Pre-requisitos

1. **PostgreSQL 14+** instalado con extensiones:
   - `uuid-ossp`
   - `postgis`
   - `pgcrypto`

2. **Node.js 18+** y npm

---

## 🚀 Pasos de Instalación

### 1. Eliminar base de datos antigua (si existe)

```bash
# Conectarse a PostgreSQL
psql -U postgres

# Dentro de psql:
DROP DATABASE IF EXISTS incendios_db;
```

### 2. Crear nueva base de datos

```sql
CREATE DATABASE incendios_db
  WITH OWNER = postgres
       ENCODING = 'UTF8'
       LC_COLLATE = 'en_US.UTF-8'
       LC_CTYPE = 'en_US.UTF-8'
       TEMPLATE = template0;

-- Salir de psql
\q
```

### 3. Configurar variables de entorno

Crea o actualiza el archivo `.env`:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=tu_password
DB_DATABASE=incendios_db

# Otros
NODE_ENV=development
PORT=3000
JWT_SECRET=tu_secret_aqui
LOG_LEVEL=info
```

### 4. Instalar dependencias

```bash
npm install
```

### 5. Ejecutar migración baseline

```bash
# Compilar TypeScript
npm run build

# Ejecutar migración
npm run migration:run
```

**Salida esperada:**
```
query: SELECT * FROM "information_schema"."tables" WHERE ...
query: CREATE EXTENSION IF NOT EXISTS "uuid-ossp"
query: CREATE EXTENSION IF NOT EXISTS "postgis"
query: CREATE EXTENSION IF NOT EXISTS "pgcrypto"
query: CREATE TABLE roles ...
...
Migration BaselineV21800000000000 has been executed successfully.
```

### 6. Ejecutar seeds (datos iniciales)

```bash
# Seed principal: roles, estados, catálogos, admin, Huehuetenango
npm run seed

# Seed de plantilla de cierre por defecto
npm run seed:plantilla
```

**Salida esperada del seed principal:**
```
Seed OK ✅ (roles, estados, medios, instituciones, catálogos, Huehuetenango y admin)
```

**Salida esperada del seed de plantilla:**
```
✅ Plantilla creada: [uuid]
✅ 10 secciones creadas
✅ 50+ campos creados
🎉 Seed de plantilla de cierre completado exitosamente!
```

---

## ✅ Verificación

### Verificar tablas creadas

```bash
psql -U postgres -d incendios_db
```

```sql
-- Ver todas las tablas
\dt

-- Debería mostrar:
-- roles, instituciones, usuarios, departamentos, municipios
-- estado_incendio, medios, incendios, incendio_seguidores
-- info_falsa_incendio, incendio_registro_responsable
-- incendio_estado_historial, zonas_afectadas, fotos_reporte
-- puntos_calor, cierre_plantillas, cierre_secciones
-- cierre_campos, cierre_respuestas, cierre_eventos_operativos
-- actualizaciones, notificaciones, user_push_prefs
-- user_push_tokens, auditoria_eventos, job_runs
```

### Verificar usuario admin

```sql
SELECT nombre, apellido, email, is_admin
FROM usuarios
WHERE email = 'admin@demo.local';

-- Debería mostrar:
-- nombre: Admin
-- apellido: Principal
-- email: admin@demo.local
-- is_admin: true
```

**Credenciales del admin:**
- Email: `admin@demo.local`
- Password: `Admin123!`

### Verificar plantilla de cierre

```sql
SELECT p.nombre, p.activa,
       (SELECT COUNT(*) FROM cierre_secciones WHERE plantilla_uuid = p.plantilla_uuid) as secciones,
       (SELECT COUNT(*) FROM cierre_campos c
        INNER JOIN cierre_secciones s ON c.seccion_uuid = s.seccion_uuid
        WHERE s.plantilla_uuid = p.plantilla_uuid) as campos
FROM cierre_plantillas p
WHERE p.eliminado_en IS NULL;

-- Debería mostrar:
-- nombre: Plantilla de Cierre Estándar
-- activa: true
-- secciones: 10
-- campos: 50+
```

---

## 🏃 Iniciar servidor

```bash
# Desarrollo (con hot reload)
npm run dev

# Producción
npm run build
npm start
```

El servidor debería iniciar en `http://localhost:3000` (o el puerto configurado en `.env`).

---

## 📊 Estructura de la Base de Datos

### Tablas principales

| Tabla | Propósito |
|-------|-----------|
| `roles` | Roles de usuario (ADMIN, OPERADOR, etc.) |
| `instituciones` | CONRED, INAB, Bomberos, etc. |
| `usuarios` | Usuarios del sistema con `es_miembro_institucion` |
| `incendios` | Incendios con datos de reporte merged (SIN tabla reportes) |
| `incendio_seguidores` | Usuarios que siguen incendios |
| `cierre_plantillas` | Plantillas de formularios de cierre |
| `cierre_secciones` | Secciones de las plantillas |
| `cierre_campos` | Campos dinámicos con jerarquía |
| `cierre_respuestas` | Respuestas de usuarios a formularios |
| `notificaciones` | Notificaciones in-app |
| `user_push_prefs` | Preferencias de notificaciones push |

### Extensiones habilitadas

- **uuid-ossp**: Generación de UUIDs
- **postgis**: Funciones geoespaciales (geometry, geography)
- **pgcrypto**: Encriptación (bcrypt para passwords)

---

## 🔧 Comandos útiles

### Migraciones

```bash
# Ver estado de migraciones
npm run migration:show

# Revertir última migración
npm run migration:revert

# Crear nueva migración
npm run migration:create src/db/migrations/NombreMigracion
```

### Seeds

```bash
# Ejecutar seed principal (sin compilar)
tsx src/db/seeds/171004_seed_inicial.ts

# Ejecutar seed de plantilla (sin compilar)
tsx src/db/seeds/172000_seed_plantilla_cierre.ts
```

### Base de datos

```bash
# Backup
pg_dump -U postgres incendios_db > backup.sql

# Restore
psql -U postgres incendios_db < backup.sql

# Reset completo
psql -U postgres -c "DROP DATABASE incendios_db;"
psql -U postgres -c "CREATE DATABASE incendios_db;"
npm run migration:run
npm run seed
npm run seed:plantilla
```

---

## 🐛 Troubleshooting

### Error: "relation already exists"

**Solución:** Elimina la BD y vuelve a crearla desde cero.

```bash
psql -U postgres -c "DROP DATABASE incendios_db;"
psql -U postgres -c "CREATE DATABASE incendios_db;"
npm run migration:run
```

### Error: "extension does not exist"

**Solución:** Instala las extensiones de PostgreSQL:

```bash
# Ubuntu/Debian
sudo apt-get install postgresql-14-postgis-3

# macOS
brew install postgis

# Dentro de psql:
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
```

### Error: "password authentication failed"

**Solución:** Verifica las credenciales en `.env` y que el usuario tenga permisos.

```sql
-- Crear usuario si no existe
CREATE USER postgres WITH PASSWORD 'tu_password';
ALTER USER postgres CREATEDB;
```

### Seed falla: "usuario admin no encontrado"

**Solución:** Ejecuta el seed principal primero, luego el seed de plantilla.

```bash
npm run seed          # Primero: crea admin
npm run seed:plantilla # Después: usa admin para crear plantilla
```

---

## 📝 Notas importantes

1. **No hay tabla `reportes`**: Los datos de reportes ahora están en la tabla `incendios` con los campos merged.

2. **Sistema de cierre dinámico**: Ya no hay tablas estáticas de cierre (`cierre_superficie`, `cierre_meteorologia`, etc.). Todo es configurable via plantillas.

3. **Plantilla activa**: Solo puede haber una plantilla activa a la vez. El seed crea una plantilla estándar basada en los campos anteriores.

4. **Permisos de cierre**:
   - Admin puede editar cierre incluso si está extinguido
   - Creador del incendio puede editar cierre si NO está extinguido
   - Miembro de institución puede editar cierre si NO está extinguido

5. **Usuario admin por defecto**:
   - Email: `admin@demo.local`
   - Password: `Admin123!`
   - ⚠️ **CAMBIAR EN PRODUCCIÓN**

---

## 🎯 Próximos pasos

1. ✅ Configurar JWT_SECRET en producción
2. ✅ Cambiar password del admin
3. ✅ Configurar Firebase para notificaciones push
4. ✅ Poblar catálogo de departamentos/municipios completo
5. ✅ Configurar backup automático de BD

---

¿Problemas? Abre un issue en el repositorio.
