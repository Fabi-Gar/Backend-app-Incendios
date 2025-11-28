# Cómo Actualizar Campos de Cierre con Cantidad y Porcentaje

Este documento explica cómo actualizar los campos del formulario de cierre para que soporten cantidad y porcentaje en las opciones.

## 📋 Cambios Realizados

### 1. Frontend Actualizado
✅ El componente `FormularioCierre.tsx` ahora soporta:
- Campos de cantidad para cada opción seleccionada
- Campos de porcentaje para cada opción seleccionada
- Mezcla de opciones con y sin campos adicionales

### 2. Seed Actualizado
✅ El archivo `src/db/seeds/172000_seed_plantilla_cierre.ts` fue actualizado con:
- **Medios terrestres**: Ahora pide cantidad para cada medio
- **Medios aéreos**: Ahora pide cantidad para cada aeronave
- **Medios acuáticos**: Ahora pide cantidad para cada embarcación
- **Tipo de incendio**: Ahora pide porcentaje para cada tipo (rastrero, copas, subterráneo)

## 🚀 Proceso de Actualización

### Opción 1: Base de Datos Nueva (Recomendado en Desarrollo)

Si estás en desarrollo y no te importa perder datos:

```bash
# 1. Borrar la base de datos actual
npm run db:drop  # o manualmente desde PostgreSQL

# 2. Ejecutar migraciones desde cero
npm run migration:run

# 3. Ejecutar seed inicial
npm run seed

# 4. Ejecutar seed de plantilla de cierre
npm run seed:cierre
```

### Opción 2: Actualizar Base de Datos Existente

Si ya tienes datos y quieres mantenerlos:

#### Paso 1: Conectarse a la base de datos

```bash
psql -U postgres -d nombre_de_tu_base_de_datos
```

#### Paso 2: Ejecutar el script de actualización

```bash
# Desde el directorio del backend
psql -U postgres -d nombre_de_tu_base_de_datos -f scripts/actualizar_campos_cantidad_porcentaje.sql
```

O ejecutar manualmente los UPDATE statements del script.

#### Paso 3: Verificar los cambios

```sql
SELECT
  c.campo_uuid,
  c.nombre,
  c.tipo,
  c.opciones
FROM cierre_campos c
WHERE c.nombre IN (
  'Medios terrestres',
  'Medios aéreos',
  'Medios acuáticos',
  'Tipo de incendio'
)
AND c.eliminado_en IS NULL;
```

## 📝 Comandos Útiles

### Ver el estado actual de los campos

```bash
cd backend-final
npm run db:query -- "SELECT nombre, tipo, opciones FROM cierre_campos WHERE tipo IN ('select', 'multiselect') AND eliminado_en IS NULL"
```

### Ejecutar solo el seed de cierre

```bash
cd backend-final
npm run seed:cierre
```

### Reiniciar completamente (solo desarrollo)

```bash
cd backend-final

# 1. Borrar todo
npm run db:drop

# 2. Crear DB
npm run db:create

# 3. Correr migraciones
npm run migration:run

# 4. Seed inicial (usuarios, departamentos, municipios, etc.)
npm run seed

# 5. Seed de plantilla de cierre
npm run seed:cierre
```

## 🔍 Verificar que Funciona

### 1. Backend
Hacer una petición GET al formulario de cierre:

```bash
curl http://localhost:4000/api/cierre/{incendio_uuid} \
  -H "Authorization: Bearer {tu_token}"
```

Deberías ver las opciones con `requiresQuantity` o `requiresPercentage`:

```json
{
  "campos": [
    {
      "nombre": "Medios terrestres",
      "tipo": "multiselect",
      "opciones": [
        {
          "value": "pickup",
          "label": "Pick-up",
          "requiresQuantity": true,
          "quantityLabel": "Cantidad de pick-ups"
        }
      ]
    }
  ]
}
```

### 2. Frontend
Abrir el formulario de cierre de un incendio y verificar que:
1. Al seleccionar una opción de "Medios terrestres", aparece un campo de cantidad
2. Al seleccionar un "Tipo de incendio", aparece un campo de porcentaje
3. Los valores se guardan correctamente

## 📊 Formato de Datos Guardados

### Antes (array simple)
```json
["pickup", "camion"]
```

### Ahora (con cantidad)
```json
[
  {"value": "pickup", "quantity": 3, "percentage": null},
  {"value": "camion", "quantity": 5, "percentage": null}
]
```

### Con porcentaje
```json
[
  {"value": "rastrero", "quantity": null, "percentage": 60},
  {"value": "copas", "quantity": null, "percentage": 40}
]
```

## ⚠️ Importante

1. **Compatibilidad hacia atrás**: El frontend maneja ambos formatos (antiguo y nuevo) automáticamente
2. **No es necesario migrar datos**: Los datos antiguos seguirán funcionando
3. **Nuevas respuestas**: Se guardarán automáticamente en el nuevo formato
4. **Opciones mixtas**: Puedes tener opciones que requieren cantidad/porcentaje junto con opciones simples

## 🆘 Solución de Problemas

### "No aparecen los campos de cantidad/porcentaje"
1. Verificar que el campo tenga `requiresQuantity: true` o `requiresPercentage: true`
2. Refrescar la app del frontend
3. Verificar que el backend devuelva las opciones correctamente

### "Error al guardar"
1. Verificar que la respuesta tenga el formato correcto
2. El backend acepta tanto formato antiguo como nuevo
3. Revisar logs del backend para ver el error específico

### "Quiero cambiar las etiquetas"
Actualizar el campo `quantityLabel` o `percentageLabel` en las opciones:

```sql
UPDATE cierre_campos
SET opciones = jsonb_set(
  opciones,
  '{0,quantityLabel}',
  '"Nueva etiqueta"'
)
WHERE nombre = 'Medios terrestres';
```

## 📚 Archivos Relevantes

- **Frontend**: `frontend-expo-actualizado/components/FormularioCierre.tsx`
- **Seed**: `backend-final/src/db/seeds/172000_seed_plantilla_cierre.ts`
- **Script SQL**: `backend-final/scripts/actualizar_campos_cantidad_porcentaje.sql`
- **Documentación**: `backend-final/CIERRE_OPCIONES_EJEMPLO.md`
- **Ejemplos SQL**: `backend-final/scripts/actualizar_opciones_ejemplo.sql`

## 🎯 Próximos Pasos

1. Probar el formulario de cierre en el frontend
2. Verificar que los datos se guarden correctamente
3. Si todo funciona, puedes agregar más campos con cantidad/porcentaje
4. Considerar agregar validaciones (ej: suma de porcentajes = 100%)
