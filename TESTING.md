# Guía de Testing del API

Esta guía te ayudará a probar las funcionalidades principales del sistema.

---

## 🔑 Autenticación

Primero, necesitas obtener un token JWT:

```bash
# Login como admin
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@demo.local",
    "password": "Admin123!"
  }'
```

**Respuesta esperada:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "usuario": {
    "usuario_uuid": "...",
    "nombre": "Admin",
    "email": "admin@demo.local",
    "is_admin": true
  }
}
```

**💡 Guarda el token** para usarlo en las siguientes peticiones:
```bash
export TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## 🔥 1. Crear un Incendio

```bash
curl -X POST http://localhost:4000/api/incendios \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "titulo": "Incendio de prueba en Huehuetenango",
    "descripcion": "Incendio forestal reportado cerca de la cabecera departamental",
    "reportado_por_nombre": "Juan Pérez",
    "telefono": "12345678",
    "reportado_en": "2025-11-24T10:00:00Z",
    "medio_uuid": "(obtener de GET /api/catalogos/medios)",
    "departamento_uuid": "(obtener de GET /api/catalogos/departamentos)",
    "municipio_uuid": "(obtener de GET /api/catalogos/municipios)",
    "centroide": {
      "type": "Point",
      "coordinates": [-91.4714, 15.3197]
    }
  }'
```

**💾 Guarda el `incendio_uuid`** de la respuesta.

---

## 📋 2. Obtener Formulario de Cierre Dinámico

```bash
curl http://localhost:4000/api/cierre/{incendio_uuid} \
  -H "Authorization: Bearer $TOKEN"
```

**Respuesta esperada:**
```json
{
  "plantilla": {
    "plantilla_uuid": "a5bd2a76-6ae4-468b-9918-7bcb67016a6b",
    "nombre": "Plantilla de Cierre Estándar",
    "version": 1
  },
  "secciones": [
    {
      "seccion_uuid": "...",
      "nombre": "Datos Generales",
      "descripcion": "Información general del incendio",
      "orden": 1,
      "icono": "info-circle",
      "campos": [
        {
          "campo_uuid": "...",
          "nombre": "Fecha de inicio",
          "tipo": "datetime",
          "requerido": true,
          "orden": 1
        },
        {
          "campo_uuid": "...",
          "nombre": "Fecha de control",
          "tipo": "datetime",
          "requerido": false,
          "orden": 2
        }
      ]
    },
    {
      "seccion_uuid": "...",
      "nombre": "Superficie Afectada",
      "campos": [
        {
          "campo_uuid": "field-superficie-total",
          "nombre": "Superficie total afectada",
          "tipo": "number",
          "unidad": "hectáreas",
          "requerido": true,
          "validaciones": {"min": 0, "step": 0.01}
        },
        {
          "campo_uuid": "...",
          "nombre": "Vegetación arbórea",
          "tipo": "number",
          "campo_padre_uuid": "field-superficie-total",
          "unidad": "hectáreas"
        }
      ]
    }
  ],
  "respuestas": []
}
```

---

## ✏️ 3. Llenar Formulario de Cierre

### Guardar múltiples respuestas:

```bash
curl -X POST http://localhost:4000/api/cierre/{incendio_uuid}/respuestas \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "respuestas": [
      {
        "campo_uuid": "...",
        "valor": "2025-11-24T08:00:00Z"
      },
      {
        "campo_uuid": "...",
        "valor": 150.5
      },
      {
        "campo_uuid": "...",
        "valor": ["rastrero", "copas"]
      }
    ]
  }'
```

### Actualizar una respuesta individual:

```bash
curl -X PATCH http://localhost:4000/api/cierre/{incendio_uuid}/respuestas/{campo_uuid} \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "valor": 200.75
  }'
```

---

## 🎯 4. Aprobar Incendio (Solo Admin)

```bash
curl -X POST http://localhost:4000/api/incendios/{incendio_uuid}/aprobar \
  -H "Authorization: Bearer $TOKEN"
```

---

## 🔒 5. Finalizar/Extinguir Incendio (Solo Admin)

```bash
curl -X POST http://localhost:4000/api/cierre/{incendio_uuid}/finalizar \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "extinguido_at": "2025-11-24T18:00:00Z",
    "observaciones": "Incendio completamente controlado y extinguido"
  }'
```

---

## 👥 6. Seguir un Incendio

```bash
curl -X POST http://localhost:4000/api/incendios/{incendio_uuid}/seguir \
  -H "Authorization: Bearer $TOKEN"
```

---

## 📊 7. Listar Incendios

```bash
# Todos los incendios
curl http://localhost:4000/api/incendios \
  -H "Authorization: Bearer $TOKEN"

# Con filtros
curl "http://localhost:4000/api/incendios?aprobado=true&estado=ACTIVO&page=1&pageSize=10" \
  -H "Authorization: Bearer $TOKEN"
```

---

## 🔧 8. Admin - Gestión de Plantillas

### Crear nueva plantilla:

```bash
curl -X POST http://localhost:4000/api/cierre-admin/plantillas \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "nombre": "Plantilla Simplificada",
    "descripcion": "Para incendios menores"
  }'
```

### Agregar sección a plantilla:

```bash
curl -X POST http://localhost:4000/api/cierre-admin/plantillas/{plantilla_uuid}/secciones \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "nombre": "Datos Básicos",
    "descripcion": "Información esencial",
    "orden": 1,
    "icono": "info"
  }'
```

### Agregar campo a sección:

```bash
curl -X POST http://localhost:4000/api/cierre-admin/secciones/{seccion_uuid}/campos \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "nombre": "Superficie afectada",
    "tipo": "number",
    "orden": 1,
    "requerido": true,
    "unidad": "hectáreas",
    "validaciones": {
      "min": 0,
      "step": 0.01
    }
  }'
```

### Activar plantilla:

```bash
curl -X POST http://localhost:4000/api/cierre-admin/plantillas/{plantilla_uuid}/activar \
  -H "Authorization: Bearer $TOKEN"
```

---

## 📱 9. Notificaciones

### Registrar token de push:

```bash
curl -X POST http://localhost:4000/api/notifications/register \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
    "departamentos_suscritos": ["uuid-huehuetenango"],
    "municipios_suscritos": [],
    "avisarme_aprobado": true,
    "avisarme_actualizaciones": true,
    "avisarme_cierres": true
  }'
```

---

## 🔍 10. Catálogos

```bash
# Departamentos
curl http://localhost:4000/api/catalogos/departamentos

# Municipios de un departamento
curl http://localhost:4000/api/catalogos/municipios?departamento_uuid=...

# Medios
curl http://localhost:4000/api/catalogos/medios

# Estados
curl http://localhost:4000/api/catalogos/estados

# Roles
curl http://localhost:4000/api/seguridad/roles
```

---

## 🧪 Testing Avanzado

### Probar jerarquía de campos:

1. Obtener formulario de cierre
2. Identificar campo con `campo_padre_uuid`
3. Guardar respuesta del campo padre primero
4. Luego guardar respuesta del campo hijo

### Probar validaciones:

```bash
# Número fuera de rango (debe fallar)
curl -X POST http://localhost:4000/api/cierre/{incendio_uuid}/respuestas \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "respuestas": [
      {
        "campo_uuid": "campo-con-validacion-min-0",
        "valor": -50
      }
    ]
  }'
```

### Probar permisos:

1. Crear usuario normal (no admin)
2. Login con usuario normal
3. Intentar aprobar incendio (debe fallar con 403)
4. Intentar activar plantilla (debe fallar con 403)

---

## 📊 Casos de Prueba Completos

### Caso 1: Ciclo completo de incendio

```bash
# 1. Login
TOKEN=$(curl -s -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@demo.local", "password": "Admin123!"}' \
  | jq -r '.token')

# 2. Crear incendio
INCENDIO=$(curl -s -X POST http://localhost:4000/api/incendios \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{...}' \
  | jq -r '.incendio_uuid')

# 3. Aprobar incendio
curl -X POST http://localhost:4000/api/incendios/$INCENDIO/aprobar \
  -H "Authorization: Bearer $TOKEN"

# 4. Obtener formulario de cierre
curl http://localhost:4000/api/cierre/$INCENDIO \
  -H "Authorization: Bearer $TOKEN" | jq

# 5. Llenar formulario
curl -X POST http://localhost:4000/api/cierre/$INCENDIO/respuestas \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{...}'

# 6. Finalizar incendio
curl -X POST http://localhost:4000/api/cierre/$INCENDIO/finalizar \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"extinguido_at": "2025-11-24T18:00:00Z"}'

# 7. Verificar que está extinguido
curl http://localhost:4000/api/incendios/$INCENDIO \
  -H "Authorization: Bearer $TOKEN" | jq '.extinguido_at'
```

---

## 🐛 Debugging

### Ver logs del API:
```bash
docker compose -f docker-compose.dev.yml logs -f api
```

### Conectarse a la BD:
```bash
docker compose -f docker-compose.dev.yml exec db psql -U postgres -d appIncendios2
```

### Consultas útiles:
```sql
-- Ver incendios
SELECT incendio_uuid, titulo, aprobado, extinguido_at FROM incendios;

-- Ver respuestas de cierre de un incendio
SELECT c.nombre, r.valor_texto, r.valor_numero
FROM cierre_respuestas r
JOIN cierre_campos c ON r.campo_uuid = c.campo_uuid
WHERE r.incendio_uuid = 'xxx' AND r.eliminado_en IS NULL;

-- Ver estructura de plantilla activa
SELECT p.nombre, s.nombre as seccion, c.nombre as campo, c.tipo
FROM cierre_plantillas p
JOIN cierre_secciones s ON s.plantilla_uuid = p.plantilla_uuid
JOIN cierre_campos c ON c.seccion_uuid = s.seccion_uuid
WHERE p.activa = true AND p.eliminado_en IS NULL
ORDER BY s.orden, c.orden;
```

---

## 📝 Notas

- Todos los endpoints requieren autenticación excepto `/health/*`
- Los UUIDs se generan automáticamente
- Las fechas deben estar en formato ISO 8601
- Los campos con validaciones rechazarán valores inválidos
- Las respuestas se almacenan en columnas específicas según el tipo de dato

---

## 🎯 Endpoints Críticos a Probar

1. ✅ POST `/api/auth/login` - Autenticación
2. ✅ POST `/api/incendios` - Crear incendio
3. ✅ GET `/api/cierre/{incendio_uuid}` - Obtener formulario
4. ✅ POST `/api/cierre/{incendio_uuid}/respuestas` - Guardar respuestas
5. ✅ POST `/api/cierre/{incendio_uuid}/finalizar` - Extinguir
6. ✅ POST `/api/cierre-admin/plantillas` - Crear plantilla (admin)
7. ✅ POST `/api/incendios/{uuid}/aprobar` - Aprobar incendio (admin)

---

¿Problemas? Revisa los logs del API o consulta el OpenAPI spec en `openapi-cierre.yaml`.
