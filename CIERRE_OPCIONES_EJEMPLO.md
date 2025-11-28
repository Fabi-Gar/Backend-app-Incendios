# Opciones con Cantidad y Porcentaje - Formulario de Cierre

Este documento explica cómo configurar opciones en los campos de tipo `select` y `multiselect` para que soliciten información adicional como cantidad o porcentaje.

## Formato de Opciones Básicas

Las opciones simples se configuran así:

```json
[
  {
    "value": "camion",
    "label": "Camión"
  },
  {
    "value": "helicoptero",
    "label": "Helicóptero"
  }
]
```

## Opciones con Cantidad

Para opciones que requieren especificar una cantidad:

```json
[
  {
    "value": "camion",
    "label": "Camión",
    "requiresQuantity": true,
    "quantityLabel": "Número de camiones"
  },
  {
    "value": "helicoptero",
    "label": "Helicóptero",
    "requiresQuantity": true,
    "quantityLabel": "Número de helicópteros"
  },
  {
    "value": "brigada",
    "label": "Brigada terrestre",
    "requiresQuantity": true,
    "quantityLabel": "Número de brigadistas"
  }
]
```

## Opciones con Porcentaje

Para opciones que requieren especificar un porcentaje:

```json
[
  {
    "value": "bosque",
    "label": "Bosque",
    "requiresPercentage": true,
    "percentageLabel": "Porcentaje de bosque afectado"
  },
  {
    "value": "pasto",
    "label": "Pasto",
    "requiresPercentage": true,
    "percentageLabel": "Porcentaje de pasto afectado"
  },
  {
    "value": "cultivo",
    "label": "Cultivo",
    "requiresPercentage": true,
    "percentageLabel": "Porcentaje de cultivo afectado"
  }
]
```

## Opciones con Ambos (Cantidad y Porcentaje)

Puedes combinar ambos:

```json
[
  {
    "value": "edificio",
    "label": "Edificio",
    "requiresQuantity": true,
    "requiresPercentage": true,
    "quantityLabel": "Número de edificios",
    "percentageLabel": "Porcentaje de daño"
  }
]
```

## Opciones Mixtas

Puedes mezclar opciones simples con opciones que requieren datos adicionales:

```json
[
  {
    "value": "camion",
    "label": "Camión",
    "requiresQuantity": true,
    "quantityLabel": "Cantidad de camiones"
  },
  {
    "value": "avioneta",
    "label": "Avioneta"
  },
  {
    "value": "helicoptero",
    "label": "Helicóptero",
    "requiresQuantity": true,
    "quantityLabel": "Cantidad de helicópteros"
  }
]
```

## Cómo se Guardan los Datos

### Para campos SELECT (una opción):

**Opción simple:**
```json
"camion"
```

**Opción con datos adicionales:**
```json
{
  "value": "camion",
  "quantity": 5,
  "percentage": null
}
```

### Para campos MULTISELECT (múltiples opciones):

**Opciones simples:**
```json
["camion", "helicoptero"]
```

**Opciones con datos adicionales:**
```json
[
  {
    "value": "camion",
    "quantity": 5,
    "percentage": null
  },
  {
    "value": "helicoptero",
    "quantity": 2,
    "percentage": null
  }
]
```

**Opciones mixtas:**
```json
[
  {
    "value": "camion",
    "quantity": 5,
    "percentage": null
  },
  "avioneta",
  {
    "value": "helicoptero",
    "quantity": 2,
    "percentage": null
  }
]
```

## Ejemplo Completo de Campo

```sql
-- Ejemplo para un campo de medios terrestres con cantidad
INSERT INTO cierre_campos (
  seccion_uuid,
  nombre,
  descripcion,
  tipo,
  orden,
  requerido,
  opciones
) VALUES (
  'uuid-de-seccion',
  'Medios terrestres utilizados',
  'Selecciona todos los medios terrestres que se utilizaron y especifica la cantidad',
  'multiselect',
  1,
  true,
  '[
    {
      "value": "camion_cisterna",
      "label": "Camión cisterna",
      "requiresQuantity": true,
      "quantityLabel": "Número de camiones"
    },
    {
      "value": "camion_bomberos",
      "label": "Camión de bomberos",
      "requiresQuantity": true,
      "quantityLabel": "Número de unidades"
    },
    {
      "value": "pick_up",
      "label": "Pick-up con tanque",
      "requiresQuantity": true,
      "quantityLabel": "Número de pick-ups"
    },
    {
      "value": "brigada_pie",
      "label": "Brigada a pie",
      "requiresQuantity": true,
      "quantityLabel": "Número de brigadistas"
    }
  ]'::jsonb
);
```

## Ejemplo de Áreas Afectadas con Porcentaje

```sql
INSERT INTO cierre_campos (
  seccion_uuid,
  nombre,
  descripcion,
  tipo,
  orden,
  requerido,
  opciones
) VALUES (
  'uuid-de-seccion',
  'Tipos de vegetación afectada',
  'Especifica el porcentaje de cada tipo de vegetación afectada',
  'multiselect',
  2,
  true,
  '[
    {
      "value": "bosque_coniferas",
      "label": "Bosque de coníferas",
      "requiresPercentage": true,
      "percentageLabel": "Porcentaje del área"
    },
    {
      "value": "bosque_latifoliado",
      "label": "Bosque latifoliado",
      "requiresPercentage": true,
      "percentageLabel": "Porcentaje del área"
    },
    {
      "value": "pasto",
      "label": "Pastizal",
      "requiresPercentage": true,
      "percentageLabel": "Porcentaje del área"
    },
    {
      "value": "matorrales",
      "label": "Matorrales",
      "requiresPercentage": true,
      "percentageLabel": "Porcentaje del área"
    },
    {
      "value": "cultivos",
      "label": "Cultivos agrícolas",
      "requiresPercentage": true,
      "percentageLabel": "Porcentaje del área"
    }
  ]'::jsonb
);
```

## Propiedades Disponibles

| Propiedad | Tipo | Descripción |
|-----------|------|-------------|
| `value` | string | Valor único que identifica la opción (requerido) |
| `label` | string | Texto que se muestra al usuario (requerido) |
| `requiresQuantity` | boolean | Si es `true`, muestra campo de cantidad |
| `requiresPercentage` | boolean | Si es `true`, muestra campo de porcentaje |
| `quantityLabel` | string | Etiqueta personalizada para el campo de cantidad (default: "Cantidad") |
| `percentageLabel` | string | Etiqueta personalizada para el campo de porcentaje (default: "Porcentaje") |

## Notas Importantes

1. **Compatibilidad hacia atrás**: Las opciones simples (`["opcion1", "opcion2"]` o `[{value: "x", label: "Y"}]`) siguen funcionando normalmente.

2. **Validación**: Los campos de cantidad y porcentaje son numéricos. El porcentaje no tiene validación automática de 0-100, así que agrégala en el campo `validaciones` si es necesario.

3. **Backend**: El backend guarda el JSON tal como viene del frontend. No hace conversión adicional.

4. **Reportes**: Al generar reportes, debes manejar ambos formatos (valores simples vs objetos con quantity/percentage).
