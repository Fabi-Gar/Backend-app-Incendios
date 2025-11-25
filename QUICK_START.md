# 🚀 Quick Start - Primeros Pasos

Ya tienes todo funcionando! Ahora sigue estos pasos para familiarizarte con el sistema.

---

## ✅ Estado Actual del Sistema

```
✅ PostgreSQL 15 con PostGIS - Funcionando
✅ Redis 7 - Funcionando
✅ API Node.js - Funcionando en http://localhost:4000
✅ 1 usuario admin creado
✅ 1 plantilla de cierre con 10 secciones y 44 campos
✅ 0 incendios (base de datos limpia)
```

---

## 🎯 Tutorial de 10 Minutos

### Paso 1: Obtener Token de Autenticación

```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@demo.local",
    "password": "Admin123!"
  }'
```

**💾 Guarda el token:**
```bash
# Copiar el token de la respuesta
export TOKEN="eyJhbGci..."
```

---

### Paso 2: Ver Catálogos Disponibles

```bash
# Departamentos
curl http://localhost:4000/api/catalogos/departamentos

# Municipios de Huehuetenango
curl http://localhost:4000/api/catalogos/municipios?departamento_nombre=Huehuetenango

# Medios de reporte
curl http://localhost:4000/api/catalogos/medios

# Estados de incendio
curl http://localhost:4000/api/catalogos/estados
```

**Copia los UUIDs** que necesitarás para el siguiente paso.

---

### Paso 3: Crear tu Primer Incendio

```bash
curl -X POST http://localhost:4000/api/incendios \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "titulo": "Incendio forestal en Chiantla",
    "descripcion": "Incendio reportado en zona boscosa",
    "reportado_por_nombre": "Juan Pérez",
    "telefono": "12345678",
    "reportado_en": "2025-11-25T10:00:00Z",
    "medio_uuid": "UUID_DEL_MEDIO",
    "departamento_uuid": "UUID_HUEHUETENANGO",
    "municipio_uuid": "UUID_CHIANTLA",
    "centroide": {
      "type": "Point",
      "coordinates": [-91.4714, 15.3197]
    }
  }'
```

**💾 Guarda el incendio_uuid** de la respuesta.

---

### Paso 4: Aprobar el Incendio

```bash
curl -X POST http://localhost:4000/api/incendios/INCENDIO_UUID/aprobar \
  -H "Authorization: Bearer $TOKEN"
```

---

### Paso 5: Ver Formulario de Cierre Dinámico

```bash
curl http://localhost:4000/api/cierre/INCENDIO_UUID \
  -H "Authorization: Bearer $TOKEN" \
  | jq  # Opcional: formatea el JSON
```

**Verás 10 secciones:**
1. Datos Generales
2. Superficie Afectada
3. Composición y Tipo
4. Propiedad
5. Topografía
6. Meteorología
7. Causas
8. Recursos Utilizados
9. Técnicas de Extinción
10. Abastos

---

### Paso 6: Llenar Datos de Cierre

```bash
curl -X POST http://localhost:4000/api/cierre/INCENDIO_UUID/respuestas \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "respuestas": [
      {
        "campo_uuid": "CAMPO_SUPERFICIE_TOTAL",
        "valor": 150.5
      },
      {
        "campo_uuid": "CAMPO_FECHA_INICIO",
        "valor": "2025-11-25T08:00:00Z"
      },
      {
        "campo_uuid": "CAMPO_TIPO_INCENDIO",
        "valor": ["rastrero", "copas"]
      }
    ]
  }'
```

---

### Paso 7: Finalizar el Incendio

```bash
curl -X POST http://localhost:4000/api/cierre/INCENDIO_UUID/finalizar \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "extinguido_at": "2025-11-25T18:00:00Z",
    "observaciones": "Incendio completamente controlado"
  }'
```

---

### Paso 8: Verificar el Resultado

```bash
# Ver el incendio completado
curl http://localhost:4000/api/incendios/INCENDIO_UUID \
  -H "Authorization: Bearer $TOKEN" \
  | jq

# Ver en la BD
docker compose -f docker-compose.dev.yml exec db psql -U postgres -d appIncendios2 \
  -c "SELECT titulo, aprobado, extinguido_at FROM incendios;"
```

---

## 🔧 Scripts Útiles

### Ver estado del sistema:

```bash
bash scripts/db-status.sh
```

### Ver logs en tiempo real:

```bash
docker compose -f docker-compose.dev.yml logs -f api
```

### Conectarse a la BD:

```bash
docker compose -f docker-compose.dev.yml exec db psql -U postgres -d appIncendios2
```

---

## 📚 Guías Completas

Ahora que hiciste el tutorial, explora las guías completas:

1. **[TESTING.md](TESTING.md)** - Todos los endpoints con ejemplos
2. **[SECURITY_CHECKLIST.md](SECURITY_CHECKLIST.md)** - Checklist de seguridad
3. **[MONITORING.md](MONITORING.md)** - Monitoreo y análisis
4. **[DATABASE_SETUP.md](DATABASE_SETUP.md)** - Setup sin Docker
5. **[DOCKER_SETUP.md](DOCKER_SETUP.md)** - Setup con Docker
6. **[README.md](README.md)** - Documentación general

---

## 🎨 Explorar la Plantilla de Cierre

### Ver estructura completa:

```sql
-- Conectarse a la BD
docker compose -f docker-compose.dev.yml exec db psql -U postgres -d appIncendios2

-- Ver secciones y campos
SELECT
  s.orden as sec_orden,
  s.nombre as seccion,
  c.orden as campo_orden,
  c.nombre as campo,
  c.tipo,
  c.requerido,
  c.unidad
FROM cierre_secciones s
JOIN cierre_campos c ON s.seccion_uuid = c.seccion_uuid
WHERE s.eliminado_en IS NULL
  AND c.eliminado_en IS NULL
  AND c.campo_padre_uuid IS NULL  -- Solo campos principales
ORDER BY s.orden, c.orden;
```

### Campos con jerarquía:

```sql
-- Ver campos padre-hijo
SELECT
  cp.nombre as padre,
  ch.nombre as hijo,
  ch.tipo,
  ch.unidad
FROM cierre_campos cp
JOIN cierre_campos ch ON ch.campo_padre_uuid = cp.campo_uuid
WHERE cp.eliminado_en IS NULL
  AND ch.eliminado_en IS NULL
ORDER BY cp.nombre, ch.orden;
```

---

## 🧪 Probar Diferentes Escenarios

### 1. Crear Usuario Normal (No Admin):

```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Pedro",
    "apellido": "López",
    "email": "pedro@example.com",
    "password": "Password123!",
    "telefono": "87654321"
  }'
```

### 2. Login como Usuario Normal:

```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "pedro@example.com",
    "password": "Password123!"
  }'
```

### 3. Intentar Aprobar Incendio (debe fallar con 403):

```bash
# Usar token del usuario normal
curl -X POST http://localhost:4000/api/incendios/INCENDIO_UUID/aprobar \
  -H "Authorization: Bearer $TOKEN_USUARIO_NORMAL"

# Respuesta esperada:
# {
#   "error": {
#     "code": "FORBIDDEN",
#     "message": "Acceso denegado"
#   }
# }
```

---

## 🎯 Siguientes Pasos

✅ Completaste el tutorial básico!

**Ahora puedes:**

1. **Explorar la BD con un cliente gráfico:**
   - Descargar [pgAdmin](https://www.pgadmin.org/) o [DBeaver](https://dbeaver.io/)
   - Conectar a `localhost:5432`, DB: `appIncendios2`, User: `postgres`, Pass: `58905326`

2. **Crear tu propia plantilla de cierre:**
   - Ver ejemplos en `TESTING.md` sección "Admin - Gestión de Plantillas"

3. **Configurar Firebase para notificaciones push:**
   - Seguir guía en `README.md`

4. **Preparar para producción:**
   - Completar `SECURITY_CHECKLIST.md`

---

## 🆘 ¿Problemas?

### API no responde:
```bash
docker compose -f docker-compose.dev.yml ps
docker compose -f docker-compose.dev.yml logs api
```

### Error 401 (Unauthorized):
- Verifica que el token sea correcto
- El token expira después de 7 días (configurable en `.env`)

### Error 403 (Forbidden):
- El usuario no tiene permisos para esa acción
- Solo admin puede aprobar incendios, finalizar, etc.

### Error 404 (Not Found):
- Verifica que el UUID sea correcto
- El recurso puede haber sido eliminado (soft delete)

---

## 📊 Ver Progreso

```bash
# Ver cuántos incendios has creado
bash scripts/db-status.sh

# Ver respuestas de cierre
docker compose -f docker-compose.dev.yml exec db psql -U postgres -d appIncendios2 \
  -c "SELECT i.titulo, COUNT(r.*) as respuestas
      FROM incendios i
      LEFT JOIN cierre_respuestas r ON i.incendio_uuid = r.incendio_uuid
      WHERE i.eliminado_en IS NULL
      GROUP BY i.incendio_uuid, i.titulo;"
```

---

🎉 **¡Listo para empezar!** Cualquier duda, revisa las guías o los logs del sistema.
