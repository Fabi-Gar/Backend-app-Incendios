# Checklist de Seguridad

Lista de verificación antes de ir a producción.

---

## 🔐 1. Credenciales y Secrets

### ❌ Problemas Actuales en DEV:

```yaml
# docker-compose.dev.yml (líneas 5-6)
POSTGRES_DB: appIncendios2
POSTGRES_PASSWORD: 58905326  # ⚠️ HARDCODED
```

### ✅ Solución para PROD:

```yaml
# docker-compose.prod.yml ya lo hace bien:
POSTGRES_DB: ${DB_NAME}
POSTGRES_PASSWORD: ${DB_PASSWORD}
```

### 📝 TODO:

- [ ] Cambiar password de PostgreSQL en producción
- [ ] Cambiar password del admin (`Admin123!`)
- [ ] Generar `JWT_SECRET` seguro (mínimo 32 caracteres aleatorios)
- [ ] No commitear `.env` al repositorio (verificar `.gitignore`)

```bash
# Generar JWT_SECRET seguro
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 🔑 2. Usuario Admin por Defecto

**Problema:** El seed crea un admin con credenciales conocidas.

### ✅ Cambiar password inmediatamente:

**Opción 1: Desde la BD**
```sql
-- Conectarse a la BD
docker compose -f docker-compose.dev.yml exec db psql -U postgres -d appIncendios2

-- Cambiar password (usa bcrypt)
UPDATE usuarios
SET password_hash = crypt('NuevoPasswordSeguro123!', gen_salt('bf'))
WHERE email = 'admin@demo.local';
```

**Opción 2: Desde el API**
```bash
# POST /api/auth/change-password (si existe el endpoint)
curl -X POST http://localhost:4000/api/auth/change-password \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "oldPassword": "Admin123!",
    "newPassword": "NuevoPasswordSeguro123!"
  }'
```

### 📝 TODO:

- [ ] Cambiar password del admin en producción
- [ ] Considerar eliminar el seed de admin en PROD
- [ ] Crear admin manualmente con password seguro

---

## 🚪 3. Endpoints sin Autenticación

Revisar qué endpoints están públicos:

```bash
# Listar rutas sin middleware de auth
grep -r "router\." src/modules/ | grep -v "authenticateToken"
```

### Verificar:

- [ ] `/health/*` - ✅ Público (correcto)
- [ ] `/api/auth/login` - ✅ Público (correcto)
- [ ] `/api/auth/register` - ⚠️ Verificar si debe ser público
- [ ] Todos los demás endpoints requieren auth

---

## 🔒 4. Validación de Inputs

### Zonas críticas a revisar:

**UUID Validation:**
```typescript
// ✅ BIEN: Usando middleware
router.patch('/:rol_uuid', validateUuidParams('rol_uuid'), async (req, res) => {})

// ❌ MAL: Sin validación
router.patch('/:rol_uuid', async (req, res) => {
  const { rol_uuid } = req.params // ⚠️ Puede ser cualquier cosa
})
```

**SQL Injection:**
```typescript
// ✅ BIEN: Parámetros preparados
await AppDataSource.query('SELECT * FROM usuarios WHERE email = $1', [email])

// ❌ MAL: Concatenación directa
await AppDataSource.query(`SELECT * FROM usuarios WHERE email = '${email}'`)
```

### 📝 TODO:

- [ ] Verificar que todos los endpoints usen parámetros preparados
- [ ] Validar UUIDs en todos los endpoints que los reciban
- [ ] Usar Zod para validar bodies de requests
- [ ] Sanitizar inputs de texto libre

---

## 🔐 5. Permisos y Autorización

### Verificar matriz de permisos:

| Acción | Admin | Creador | Miembro Inst. | Usuario |
|--------|-------|---------|---------------|---------|
| Crear incendio | ✅ | ✅ | ✅ | ✅ |
| Aprobar incendio | ✅ | ❌ | ❌ | ❌ |
| Editar cierre (activo) | ✅ | ✅ | ✅ | ❌ |
| Editar cierre (extinguido) | ✅ | ❌ | ❌ | ❌ |
| Finalizar incendio | ✅ | ❌ | ❌ | ❌ |
| Crear plantilla | ✅ | ❌ | ❌ | ❌ |

### 📝 TODO:

- [ ] Probar cada combinación de permisos
- [ ] Verificar que todos los endpoints de admin tienen `requireAdmin()`
- [ ] Verificar que cierre usa `canEditCierre()`
- [ ] Agregar tests automatizados de permisos

---

## 📊 6. Rate Limiting

Verificar configuración actual:

```typescript
// src/app.ts o server.ts
app.use(rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 60 // 60 requests por minuto
}))
```

### Recomendaciones:

- [ ] Rate limit más estricto en `/api/auth/login` (ej: 5 intentos/minuto)
- [ ] Rate limit más relajado en endpoints de lectura
- [ ] Rate limit muy estricto en endpoints de admin
- [ ] Considerar usar Redis para rate limiting distribuido

```typescript
// Ejemplo con Redis
import { RedisStore } from 'rate-limit-redis'

app.use('/api/auth', rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 intentos
  store: new RedisStore({
    client: redisClient
  })
}))
```

---

## 🌐 7. CORS Configuration

Verificar configuración de CORS:

```typescript
// src/app.ts
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*', // ⚠️ '*' es peligroso
  credentials: true
}))
```

### 📝 TODO:

- [ ] En PROD, especificar origins exactos (no usar `*`)
- [ ] Configurar `ALLOWED_ORIGINS` en `.env`:
  ```env
  ALLOWED_ORIGINS=https://app.garmen.cloud,https://admin.garmen.cloud
  ```

---

## 📝 8. Logging y Auditoría

### Verificar que se loguean:

- [x] Autenticaciones exitosas
- [x] Autenticaciones fallidas
- [x] Cambios en datos críticos (ya existe tabla `auditoria_eventos`)
- [ ] Accesos no autorizados (403)
- [ ] Errores del servidor (500)

### Ejemplo de log de auditoría:

```typescript
// Después de actualizar un incendio
await AppDataSource.query(
  `INSERT INTO auditoria_eventos (tabla, registro_id, accion, antes, despues, usuario_uuid, ip)
   VALUES ($1, $2, $3, $4, $5, $6, $7)`,
  ['incendios', incendio_uuid, 'UPDATE', antesJSON, despuesJSON, user_uuid, req.ip]
)
```

### 📝 TODO:

- [ ] Implementar auditoría en endpoints críticos
- [ ] Loguear intentos de acceso no autorizado
- [ ] Configurar alertas para actividad sospechosa

---

## 🔒 9. Headers de Seguridad

Verificar que Helmet está configurado:

```typescript
// src/app.ts
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"]
    }
  }
}))
```

### Headers importantes:

- [x] `X-Frame-Options: DENY`
- [x] `X-Content-Type-Options: nosniff`
- [x] `Strict-Transport-Security` (solo con HTTPS)
- [x] `Content-Security-Policy`

---

## 🗄️ 10. Base de Datos

### Backups:

**PROD tiene backup automático:**
```yaml
pg-backup:
  environment:
    SCHEDULE: "30 2 * * *"  # Diario 2:30 AM
    BACKUP_KEEP_DAYS: 7
```

### 📝 TODO:

- [ ] Probar restauración de backup
- [ ] Configurar backup adicional off-site
- [ ] Documentar procedimiento de disaster recovery

### Encriptación:

- [x] Passwords: bcrypt ✅
- [ ] Datos sensibles en BD: considerar pgcrypto para campos específicos
- [ ] Conexión SSL en producción (si la BD está en servidor separado)

---

## 🚫 11. Soft Deletes

Verificar que se usa correctamente:

```typescript
// ✅ BIEN: Soft delete
UPDATE usuarios SET eliminado_en = NOW() WHERE usuario_uuid = $1

// ❌ MAL: Hard delete
DELETE FROM usuarios WHERE usuario_uuid = $1
```

### Verificar en queries:

```sql
-- Siempre filtrar por eliminado_en IS NULL
SELECT * FROM usuarios WHERE eliminado_en IS NULL

-- En TypeORM
where: { eliminado_en: IsNull() }
```

---

## 🔍 12. Información Sensible en Logs

### ❌ NO loguear:

- Passwords (en texto plano o hash)
- Tokens JWT completos
- Datos personales (emails, teléfonos) en logs de producción
- API keys de servicios externos

### ✅ Loguear:

- IDs de usuarios (UUIDs)
- Timestamps de acciones
- IPs (con GDPR considerations)
- Errores (sin stack traces en producción)

```typescript
// ✅ BIEN
logger.info({ usuario_uuid, action: 'login' }, 'Usuario autenticado')

// ❌ MAL
logger.info({ usuario_uuid, password, email }, 'Intento de login')
```

---

## 📱 13. Firebase / Push Notifications

### 📝 TODO:

- [ ] Configurar Firebase service account
- [ ] Crear `/config/firebase-service-account.json`
- [ ] NO commitear el archivo JSON al repositorio
- [ ] En PROD, montar como secret o variable de entorno
- [ ] Validar tokens de push antes de almacenar

---

## 🌍 14. Geoespacial (PostGIS)

### Validación de coordenadas:

```typescript
// Validar que las coordenadas sean válidas
const [lon, lat] = coordinates

if (lon < -180 || lon > 180 || lat < -90 || lat > 90) {
  throw new Error('Coordenadas inválidas')
}

// Validar que el punto esté en Guatemala (aproximadamente)
// Guatemala: lon: -92.3 a -88.2, lat: 13.7 a 17.8
```

---

## 🧪 15. Testing de Seguridad

### Pruebas manuales:

```bash
# 1. Intentar SQL injection
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@demo.local OR 1=1--", "password": "x"}'

# 2. Intentar XSS en campos de texto
curl -X POST http://localhost:4000/api/incendios \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"titulo": "<script>alert(1)</script>"}'

# 3. Intentar acceso sin token
curl http://localhost:4000/api/incendios

# 4. Intentar acceso con token inválido
curl -H "Authorization: Bearer token-falso" \
  http://localhost:4000/api/incendios

# 5. Intentar acceso a endpoint de admin sin ser admin
curl -X POST http://localhost:4000/api/cierre-admin/plantillas \
  -H "Authorization: Bearer $TOKEN_USUARIO_NORMAL"
```

### Herramientas automatizadas:

```bash
# npm audit
npm audit

# Escaneo de vulnerabilidades con Snyk
npx snyk test

# OWASP ZAP (si tienes instalado)
zap-cli quick-scan http://localhost:4000
```

---

## ✅ Checklist Final Pre-Producción

- [ ] Cambiar todas las credenciales por defecto
- [ ] Configurar CORS con origins específicos
- [ ] Configurar rate limiting adecuado
- [ ] Verificar que todos los endpoints críticos requieren auth
- [ ] Probar matriz completa de permisos
- [ ] Configurar backups automáticos y probar restauración
- [ ] Configurar logging y alertas
- [ ] Revisar y sanitizar todos los inputs
- [ ] Configurar HTTPS en producción (Caddy)
- [ ] Ejecutar npm audit y resolver vulnerabilidades
- [ ] Documentar procedimientos de seguridad
- [ ] Configurar monitoreo (Prometheus, Grafana, etc.)

---

## 📞 Contacto en Caso de Incidente

- Documentar plan de respuesta a incidentes
- Definir contactos de emergencia
- Tener procedimiento de rollback documentado

---

**Última revisión:** Antes de cada deployment
