# Colección de Postman - API Incendios Guatemala

Colección completa con todos los endpoints del sistema.

---

## 📥 Importar a Postman

### 1. Abrir Postman

### 2. Importar Colección

**Opción A: Arrastrar y soltar**
- Arrastra el archivo `Incendios-API.postman_collection.json` a Postman

**Opción B: Import button**
1. Click en **Import** (esquina superior izquierda)
2. Click en **files**
3. Selecciona `Incendios-API.postman_collection.json`
4. Click **Import**

### 3. Importar Environment

1. Click en **Import** nuevamente
2. Selecciona `Incendios-API.postman_environment.json`
3. Click **Import**

### 4. Activar Environment

1. En la esquina superior derecha, selecciona **"Incendios API - Local"** del dropdown de environments

---

## 🚀 Inicio Rápido

### Paso 1: Login

1. Abre la carpeta **Auth**
2. Selecciona **Login**
3. Click **Send**

✅ **El token se guarda automáticamente** en las variables de entorno y se usa en todas las peticiones siguientes.

### Paso 2: Obtener Catálogos

Antes de crear un incendio, necesitas los UUIDs de catálogos:

1. **Catálogos** → **Departamentos** → Send
2. Copia el UUID de Huehuetenango y guárdalo en `{{departamento_uuid}}`
3. **Catálogos** → **Municipios** → Send
4. Copia un UUID de municipio y guárdalo en `{{municipio_uuid}}`
5. **Catálogos** → **Medios** → Send
6. Copia un UUID de medio y guárdalo en `{{medio_uuid}}`

**Actualizar variables:**
- Click en el ícono del ojo 👁️ (esquina superior derecha)
- Click en **Incendios API - Local**
- Actualiza los valores de las variables

### Paso 3: Crear Incendio

1. **Incendios** → **Crear Incendio**
2. Verifica que el body tenga los UUIDs correctos
3. Click **Send**

✅ **El incendio_uuid se guarda automáticamente**

### Paso 4: Aprobar Incendio

1. **Incendios** → **Aprobar Incendio (Admin)**
2. Click **Send**

### Paso 5: Probar Cierre Dinámico

1. **Cierre** → **Obtener Formulario de Cierre**
2. Click **Send**
3. Verás las 10 secciones con todos los campos
4. Copia algunos `campo_uuid` para usarlos en el siguiente paso

### Paso 6: Llenar Formulario

1. **Cierre** → **Guardar Respuestas**
2. Actualiza los `campo_uuid` en el body con los que copiaste
3. Click **Send**

---

## 🔥 Login con Firebase (Opcional)

El sistema también soporta login con Firebase Authentication (Google, Facebook, Apple, etc).

### Cómo funciona:

1. **Frontend:** Usuario hace login con Firebase
   ```javascript
   // En tu app React Native / Web
   const result = await signInWithPopup(auth, googleProvider)
   const idToken = await result.user.getIdToken()
   ```

2. **Postman:** Abre **Auth → Firebase Login**
   - Reemplaza `FIREBASE_ID_TOKEN_AQUI` con el token del paso 1
   - Click **Send**

3. **Backend:**
   - Verifica el token con Firebase
   - Crea el usuario automáticamente si no existe
   - Devuelve tu JWT propio

✅ **El token se guarda automáticamente** igual que con login normal

### Proveedores soportados:
- ✅ Google
- ✅ Facebook
- ✅ Apple
- ✅ Email/Password (Firebase)
- ✅ Teléfono
- ✅ GitHub, Twitter, etc.

**Nota:** Los usuarios creados vía Firebase obtienen rol "USUARIO" por defecto.

---

## 📚 Estructura de la Colección

```
Incendios Guatemala API
├── Auth
│   ├── Login ⭐ (guarda token automáticamente)
│   ├── Register
│   ├── Me
│   └── Firebase Login 🔥 (login con Google/Facebook/etc)
├── Incendios
│   ├── Listar Incendios
│   ├── Crear Incendio ⭐ (guarda UUID automáticamente)
│   ├── Obtener Incendio
│   ├── Actualizar Incendio
│   ├── Eliminar Incendio
│   ├── Aprobar Incendio (Admin)
│   ├── Rechazar Incendio (Admin)
│   ├── Seguir Incendio
│   └── Dejar de Seguir
├── Cierre
│   ├── Obtener Formulario de Cierre ⭐
│   ├── Guardar Respuestas
│   ├── Actualizar Respuesta
│   ├── Eliminar Respuesta
│   └── Finalizar Incendio (Admin)
├── Cierre Admin
│   ├── Plantillas
│   │   ├── Listar Plantillas
│   │   ├── Crear Plantilla
│   │   ├── Obtener Plantilla
│   │   ├── Actualizar Plantilla
│   │   ├── Eliminar Plantilla
│   │   └── Activar Plantilla
│   ├── Secciones
│   │   ├── Crear Sección
│   │   ├── Actualizar Sección
│   │   └── Eliminar Sección
│   └── Campos
│       ├── Crear Campo
│       ├── Crear Campo Select
│       ├── Actualizar Campo
│       └── Eliminar Campo
├── Catálogos
│   ├── Departamentos
│   ├── Municipios
│   ├── Medios
│   ├── Estados
│   └── Instituciones
├── Usuarios
│   ├── Listar Usuarios
│   ├── Obtener Usuario
│   └── Actualizar Usuario
├── Notificaciones
│   ├── Listar Notificaciones
│   ├── Marcar como Leída
│   └── Registrar Token Push
└── Health
    ├── Liveness
    └── Readiness
```

---

## 🔑 Autenticación

La colección usa **Bearer Token** automáticamente.

### Cómo funciona:

1. Haces login en **Auth → Login**
2. El **Pre-request Script** guarda el token en `{{token}}`
3. Todas las peticiones usan automáticamente `Authorization: Bearer {{token}}`

### Token manual:

Si necesitas usar un token diferente:

1. Click en 👁️ (esquina superior derecha)
2. Click en **Incendios API - Local**
3. Edita el valor de `token`

---

## 📝 Variables de Entorno

| Variable | Descripción | Se guarda auto? |
|----------|-------------|-----------------|
| `base_url` | URL del API | No |
| `token` | JWT token | ✅ Sí (al login) |
| `usuario_uuid` | UUID del usuario | ✅ Sí (al login) |
| `incendio_uuid` | UUID del incendio | ✅ Sí (al crear) |
| `plantilla_uuid` | UUID de plantilla | ✅ Sí (al crear) |
| `seccion_uuid` | UUID de sección | ✅ Sí (al crear) |
| `campo_uuid` | UUID de campo | Manual |
| `departamento_uuid` | UUID de departamento | Manual |
| `municipio_uuid` | UUID de municipio | Manual |
| `medio_uuid` | UUID de medio | Manual |

### Actualizar variables manualmente:

1. Click en 👁️ (esquina superior derecha)
2. Click en **Incendios API - Local**
3. Edita los valores
4. Click **Save**

---

## 🎯 Flujo de Testing Completo

### Caso: Ciclo completo de incendio

1. **Auth → Login** ✅ Token guardado
2. **Catálogos → Departamentos** → Copiar UUID
3. **Catálogos → Municipios** → Copiar UUID
4. **Catálogos → Medios** → Copiar UUID
5. Actualizar variables de entorno con los UUIDs copiados
6. **Incendios → Crear Incendio** ✅ UUID guardado
7. **Incendios → Aprobar Incendio**
8. **Cierre → Obtener Formulario** → Copiar algunos campo_uuid
9. **Cierre → Guardar Respuestas** (actualizar campo_uuid en el body)
10. **Cierre → Finalizar Incendio**
11. **Incendios → Obtener Incendio** → Verificar que está extinguido

---

## 🔧 Tips y Trucos

### 1. Ver Variables en Uso

Click en el ícono 👁️ para ver todas las variables actuales.

### 2. Tests Automáticos

Algunos endpoints tienen **Tests** que guardan automáticamente los UUIDs:

- **Login** → Guarda `token` y `usuario_uuid`
- **Crear Incendio** → Guarda `incendio_uuid`
- **Crear Plantilla** → Guarda `plantilla_uuid`
- **Crear Sección** → Guarda `seccion_uuid`

Puedes ver los tests en la pestaña **Tests** de cada request.

### 3. Duplicar Environments

Para testing en diferentes ambientes:

1. Click derecho en **Incendios API - Local**
2. **Duplicate**
3. Renombra a **Incendios API - Staging**
4. Cambia `base_url` a tu servidor staging

### 4. Organizar por Folders

Los requests están organizados en carpetas. Puedes:
- Expandir/colapsar folders
- Ejecutar todos los requests de una carpeta (Collection Runner)

### 5. Console para Debugging

**View → Show Postman Console** (Ctrl+Alt+C) para ver:
- Requests completos
- Responses completos
- Console logs de los tests

---

## 🐛 Troubleshooting

### Error 401 (Unauthorized)

**Causa:** Token expirado o inválido

**Solución:**
1. Ejecuta **Auth → Login** nuevamente
2. Verifica que el environment esté seleccionado

### Error 403 (Forbidden)

**Causa:** No tienes permisos para esa acción

**Solución:**
- Verifica que estés logueado como admin para endpoints de admin
- Algunos endpoints solo están disponibles para admin

### Error 404 (Not Found)

**Causa:** UUID incorrecto o recurso eliminado

**Solución:**
1. Verifica que la variable `{{incendio_uuid}}` tenga un valor
2. Click 👁️ → **Incendios API - Local** para verificar
3. El recurso puede haber sido eliminado (soft delete)

### Variables no se guardan

**Causa:** Environment no seleccionado

**Solución:**
1. Verifica que **Incendios API - Local** esté seleccionado (esquina superior derecha)
2. Si no aparece, importa el archivo de environment nuevamente

### Base URL incorrecta

**Solución:**
1. Click 👁️ → **Incendios API - Local**
2. Edita `base_url` a `http://localhost:4000`
3. Click **Save**

---

## 🚀 Características Avanzadas

### Collection Runner

Para ejecutar múltiples requests en secuencia:

1. Click derecho en **Incendios Guatemala API**
2. **Run collection**
3. Selecciona los requests que quieres ejecutar
4. Click **Run**

### Environments para Prod

Crea un nuevo environment para producción:

```json
{
  "base_url": "https://api.garmen.cloud",
  "token": "",
  ...
}
```

### Pre-request Scripts

Algunos requests tienen scripts que se ejecutan antes del request:

```javascript
// Generar timestamp dinámico
pm.variables.set("timestamp", new Date().toISOString());
```

---

## 📖 Tipos de Campos Soportados

En **Cierre Admin → Campos**, puedes crear campos de estos tipos:

| Tipo | Descripción | Ejemplo |
|------|-------------|---------|
| `text` | Texto corto | Nombre del responsable |
| `textarea` | Texto largo | Observaciones |
| `number` | Número | 150.5 |
| `date` | Fecha | 2025-11-25 |
| `datetime` | Fecha y hora | 2025-11-25T10:00:00Z |
| `select` | Selección única | "rastrero" |
| `multiselect` | Selección múltiple | ["rastrero", "copas"] |
| `checkbox` | Checkbox | true/false |
| `radio` | Radio button | "opcion_a" |
| `file` | Archivo | URL del archivo |
| `currency` | Moneda | 1000.50 |
| `percentage` | Porcentaje | 75.5 |

---

## ✅ Checklist de Testing

- [ ] Login exitoso
- [ ] Crear incendio
- [ ] Aprobar incendio (admin)
- [ ] Obtener formulario de cierre
- [ ] Guardar respuestas en cierre
- [ ] Actualizar respuesta individual
- [ ] Finalizar incendio (admin)
- [ ] Seguir incendio
- [ ] Crear plantilla (admin)
- [ ] Crear sección (admin)
- [ ] Crear campo (admin)
- [ ] Activar plantilla (admin)
- [ ] Listar notificaciones
- [ ] Marcar notificación como leída

---

## 📞 Ayuda

Si tienes problemas:

1. Verifica que Docker esté corriendo: `docker compose ps`
2. Verifica logs del API: `docker compose logs -f api`
3. Verifica que el environment esté seleccionado en Postman
4. Revisa la consola de Postman (Ctrl+Alt+C)

---

¡Listo para testear! 🚀
