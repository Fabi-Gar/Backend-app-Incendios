# Guía de Monitoreo

Cómo monitorear y debuggear el sistema en producción.

---

## 📊 1. Métricas Clave a Monitorear

### Performance:
- ⏱️ Tiempo de respuesta de endpoints (p50, p95, p99)
- 🔄 Requests por segundo (RPS)
- 💾 Uso de memoria del contenedor API
- 🗄️ Conexiones a PostgreSQL
- 📈 Tamaño de la base de datos
- 🚀 Uso de CPU

### Negocio:
- 🔥 Incendios creados por día
- ✅ Incendios aprobados vs rechazados
- 📋 Formularios de cierre completados
- 👥 Usuarios activos (DAU, MAU)
- 📱 Notificaciones enviadas

### Errores:
- ❌ Tasa de error (4xx, 5xx)
- 🚨 Errores de BD (deadlocks, timeouts)
- 🔒 Intentos de login fallidos
- 🚫 Accesos no autorizados (403)

---

## 🔍 2. Queries Útiles para Análisis

### Conectarse a la BD:

```bash
# DEV
docker compose -f docker-compose.dev.yml exec db psql -U postgres -d appIncendios2

# PROD
docker compose -f docker-compose.prod.yml exec pg psql -U postgres -d ${DB_NAME}
```

### Estadísticas generales:

```sql
-- Total de incendios por estado
SELECT e.nombre as estado, COUNT(*) as total
FROM incendios i
JOIN estado_incendio e ON i.estado_incendio_uuid = e.estado_incendio_uuid
WHERE i.eliminado_en IS NULL
GROUP BY e.nombre
ORDER BY total DESC;

-- Incendios creados en los últimos 7 días
SELECT DATE(creado_en) as fecha, COUNT(*) as total
FROM incendios
WHERE creado_en >= NOW() - INTERVAL '7 days'
  AND eliminado_en IS NULL
GROUP BY DATE(creado_en)
ORDER BY fecha DESC;

-- Incendios pendientes de aprobación
SELECT COUNT(*) as pendientes
FROM incendios
WHERE aprobado = false
  AND eliminado_en IS NULL
  AND requiere_aprobacion = true;

-- Incendios activos (no extinguidos)
SELECT COUNT(*) as activos
FROM incendios
WHERE extinguido_at IS NULL
  AND eliminado_en IS NULL
  AND aprobado = true;
```

### Estadísticas de cierre:

```sql
-- Incendios con cierre completado
SELECT COUNT(DISTINCT r.incendio_uuid) as con_cierre
FROM cierre_respuestas r
WHERE r.eliminado_en IS NULL;

-- Campos más utilizados en cierres
SELECT c.nombre, COUNT(*) as veces_usado
FROM cierre_respuestas r
JOIN cierre_campos c ON r.campo_uuid = c.campo_uuid
WHERE r.eliminado_en IS NULL
GROUP BY c.nombre
ORDER BY veces_usado DESC
LIMIT 10;

-- Promedio de superficie afectada (si existe el campo)
SELECT AVG(r.valor_numero) as promedio_hectareas
FROM cierre_respuestas r
JOIN cierre_campos c ON r.campo_uuid = c.campo_uuid
WHERE c.nombre ILIKE '%superficie%total%'
  AND r.eliminado_en IS NULL
  AND r.valor_numero IS NOT NULL;
```

### Usuarios y actividad:

```sql
-- Usuarios más activos (creadores de incendios)
SELECT u.nombre, u.apellido, COUNT(i.incendio_uuid) as incendios_creados
FROM usuarios u
JOIN incendios i ON u.usuario_uuid = i.creado_por_uuid
WHERE u.eliminado_en IS NULL
  AND i.eliminado_en IS NULL
GROUP BY u.usuario_uuid, u.nombre, u.apellido
ORDER BY incendios_creados DESC
LIMIT 10;

-- Usuarios por rol
SELECT r.nombre as rol, COUNT(*) as total
FROM usuarios u
JOIN roles r ON u.rol_uuid = r.rol_uuid
WHERE u.eliminado_en IS NULL
GROUP BY r.nombre
ORDER BY total DESC;

-- Últimos logins
SELECT nombre, email, ultimo_login
FROM usuarios
WHERE eliminado_en IS NULL
  AND ultimo_login IS NOT NULL
ORDER BY ultimo_login DESC
LIMIT 10;
```

### Geoespacial:

```sql
-- Incendios por departamento
SELECT d.nombre, COUNT(i.incendio_uuid) as total
FROM departamentos d
LEFT JOIN incendios i ON d.departamento_uuid = i.departamento_uuid
  AND i.eliminado_en IS NULL
GROUP BY d.nombre
ORDER BY total DESC;

-- Superficie total afectada por departamento (si el campo existe)
SELECT d.nombre,
       SUM(r.valor_numero) as total_hectareas
FROM departamentos d
JOIN incendios i ON d.departamento_uuid = i.departamento_uuid
JOIN cierre_respuestas r ON i.incendio_uuid = r.incendio_uuid
JOIN cierre_campos c ON r.campo_uuid = c.campo_uuid
WHERE c.nombre ILIKE '%superficie%total%'
  AND i.eliminado_en IS NULL
  AND r.eliminado_en IS NULL
GROUP BY d.nombre
ORDER BY total_hectareas DESC;
```

### Performance de BD:

```sql
-- Tamaño de tablas
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Queries más lentas (requiere pg_stat_statements)
SELECT
  query,
  calls,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Conexiones activas
SELECT
  datname,
  count(*) as connections
FROM pg_stat_activity
GROUP BY datname;

-- Índices no utilizados
SELECT
  schemaname,
  tablename,
  indexname
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND schemaname = 'public';
```

---

## 📈 3. Logs y Debugging

### Ver logs en tiempo real:

```bash
# API
docker compose -f docker-compose.dev.yml logs -f api

# PostgreSQL
docker compose -f docker-compose.dev.yml logs -f db

# Redis
docker compose -f docker-compose.dev.yml logs -f redis

# Todos
docker compose -f docker-compose.dev.yml logs -f
```

### Filtrar logs:

```bash
# Solo errores
docker compose -f docker-compose.dev.yml logs api | grep -i error

# Solo requests específicos
docker compose -f docker-compose.dev.yml logs api | grep "POST /api/incendios"

# Con timestamp
docker compose -f docker-compose.dev.yml logs -f --timestamps api
```

### Analizar logs con jq:

```bash
# Extraer solo mensajes de nivel error
docker compose -f docker-compose.dev.yml logs api --since 1h \
  | grep '{"level"' \
  | jq 'select(.level == 50)'

# Ver requests más lentos
docker compose -f docker-compose.dev.yml logs api --since 1h \
  | grep '{"level"' \
  | jq 'select(.responseTime > 1000)'

# Contar requests por endpoint
docker compose -f docker-compose.dev.yml logs api --since 1h \
  | grep '{"level"' \
  | jq -r '.req.url' \
  | sort | uniq -c | sort -rn
```

---

## 🚨 4. Alertas Recomendadas

### Críticas (notificar inmediatamente):

- ❌ API caída (healthcheck falla)
- 💾 Base de datos caída
- 🔴 Tasa de error > 5%
- 📊 Uso de disco > 90%
- 🔥 CPU > 90% por más de 5 minutos

### Importantes (revisar en horas):

- ⚠️ Tasa de error > 1%
- 📈 Uso de memoria > 80%
- 🐌 Tiempo de respuesta p95 > 2s
- 🔒 > 10 intentos de login fallidos en 5 minutos
- 📦 Espacio de backup < 20%

### Informativas:

- 📊 Reporte diario de métricas
- 📉 Tendencias semanales
- 🔍 Queries lentas detectadas

---

## 📊 5. Dashboard Recomendado

### Métricas a mostrar:

**Panel Principal:**
```
┌─────────────────────────────────────────────┐
│ Incendios Activos: 25                       │
│ Pendientes Aprobación: 5                    │
│ Extinguidos Hoy: 3                          │
│ Usuarios Conectados: 42                     │
└─────────────────────────────────────────────┘

┌─────────────────┬─────────────────┬─────────────────┐
│ RPS: 45         │ Error Rate: 0.2%│ Latency: 125ms  │
│ ↑ 12%           │ ↓ 0.1%          │ ↓ 15ms          │
└─────────────────┴─────────────────┴─────────────────┘
```

**Gráficas:**
- Incendios creados/día (últimos 30 días)
- Tiempo de respuesta por endpoint (últimas 24h)
- Uso de CPU/memoria (últimas 24h)
- Top departamentos afectados (últimos 7 días)

---

## 🔧 6. Herramientas de Monitoreo

### Opción 1: Stack Prometheus + Grafana (Recomendado)

```yaml
# docker-compose.monitoring.yml
services:
  prometheus:
    image: prom/prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana
    volumes:
      - grafana-data:/var/lib/grafana
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin

  node-exporter:
    image: prom/node-exporter
    ports:
      - "9100:9100"

  postgres-exporter:
    image: prometheuscommunity/postgres-exporter
    environment:
      DATA_SOURCE_NAME: "postgresql://postgres:password@db:5432/appIncendios2?sslmode=disable"
    ports:
      - "9187:9187"
```

### Opción 2: Datadog, New Relic, etc. (SaaS)

Agregar agente al `docker-compose.prod.yml`:

```yaml
datadog:
  image: datadog/agent:latest
  environment:
    - DD_API_KEY=${DATADOG_API_KEY}
    - DD_SITE=datadoghq.com
    - DD_LOGS_ENABLED=true
    - DD_APM_ENABLED=true
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock:ro
    - /proc/:/host/proc/:ro
    - /sys/fs/cgroup/:/host/sys/fs/cgroup:ro
```

### Opción 3: Logging con ELK Stack

```yaml
elasticsearch:
  image: elasticsearch:8.11.0
  environment:
    - discovery.type=single-node

logstash:
  image: logstash:8.11.0
  volumes:
    - ./logstash.conf:/usr/share/logstash/pipeline/logstash.conf

kibana:
  image: kibana:8.11.0
  ports:
    - "5601:5601"
```

---

## 🧪 7. Health Checks Avanzados

### Actualizar healthcheck del API:

```typescript
// src/routes/health.ts
app.get('/health/readiness', async (req, res) => {
  const checks = {
    database: false,
    redis: false,
    disk: false
  }

  try {
    // Check BD
    await AppDataSource.query('SELECT 1')
    checks.database = true

    // Check Redis
    await redisClient.ping()
    checks.redis = true

    // Check disk space
    const diskUsage = await checkDiskSpace('/')
    checks.disk = diskUsage.free > 1024 * 1024 * 1024 // > 1GB free

    const allHealthy = Object.values(checks).every(c => c)

    res.status(allHealthy ? 200 : 503).json({
      status: allHealthy ? 'healthy' : 'degraded',
      checks,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      checks,
      error: error.message
    })
  }
})
```

---

## 📱 8. Notificaciones de Monitoreo

### Telegram Bot (simple):

```typescript
// src/utils/alerting.ts
export async function sendTelegramAlert(message: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID

  if (!token || !chatId) return

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: `🚨 ALERTA\n\n${message}`,
      parse_mode: 'Markdown'
    })
  })
}

// Uso
if (errorRate > 0.05) {
  await sendTelegramAlert(`Error rate: ${errorRate * 100}%`)
}
```

### Email (con nodemailer):

```typescript
import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransporter({
  host: process.env.SMTP_HOST,
  port: 587,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
})

await transporter.sendMail({
  from: 'alerts@garmen.cloud',
  to: 'admin@garmen.cloud',
  subject: '🚨 API Health Alert',
  text: `Database connection failed at ${new Date()}`
})
```

---

## 📊 9. Métricas Personalizadas

### Agregar contador de Prometheus:

```typescript
// src/utils/metrics.ts
import client from 'prom-client'

export const incendiosCreados = new client.Counter({
  name: 'incendios_creados_total',
  help: 'Total de incendios creados'
})

export const cierresCompletados = new client.Counter({
  name: 'cierres_completados_total',
  help: 'Total de cierres completados'
})

// Endpoint de métricas
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType)
  res.end(await client.register.metrics())
})

// Uso en el código
incendiosCreados.inc() // Incrementar contador
```

---

## 🔍 10. Debugging en Producción

### Habilitar debugging temporal:

```bash
# Cambiar LOG_LEVEL temporalmente
docker compose -f docker-compose.prod.yml exec api \
  sh -c "export LOG_LEVEL=debug && npm start"
```

### Inspeccionar contenedor en vivo:

```bash
# Entrar al contenedor
docker compose -f docker-compose.prod.yml exec api sh

# Ver procesos
ps aux

# Ver uso de memoria
free -h

# Ver conexiones de red
netstat -tlnp

# Ver variables de entorno
env | grep DB_
```

### Profiling de Node.js:

```bash
# Generar heap snapshot
docker compose -f docker-compose.prod.yml exec api \
  node -e "require('v8').writeHeapSnapshot()"

# Ver con Chrome DevTools
# chrome://inspect
```

---

## 📝 11. Checklist de Monitoreo

- [ ] Configurar healthchecks completos (DB, Redis, disk)
- [ ] Implementar logging estructurado (ya existe con Pino)
- [ ] Configurar métricas de negocio
- [ ] Configurar alertas críticas
- [ ] Crear dashboard de monitoreo
- [ ] Documentar runbooks para incidentes comunes
- [ ] Configurar backups automáticos (ya existe en PROD)
- [ ] Probar restauración de backups
- [ ] Configurar retención de logs
- [ ] Implementar tracing distribuido (opcional)

---

## 🎯 Quick Commands

```bash
# Ver estado de servicios
docker compose -f docker-compose.dev.yml ps

# Ver uso de recursos
docker stats

# Ver logs de errores en última hora
docker compose logs --since 1h api | grep error

# Ejecutar query en BD
docker compose exec db psql -U postgres -d appIncendios2 -c "SELECT COUNT(*) FROM incendios"

# Reiniciar API sin afectar BD
docker compose restart api

# Ver tamaño de volúmenes
docker system df -v
```

---

¿Necesitas ayuda configurando alguna herramienta específica?
