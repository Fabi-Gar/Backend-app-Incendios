-- Script de ejemplo para actualizar opciones de campos existentes
-- con soporte para cantidad y porcentaje

-- ================================================================================
-- EJEMPLO 1: Actualizar campo de "Medios terrestres" para que pida cantidades
-- ================================================================================

-- Primero, ver el campo actual
SELECT campo_uuid, nombre, tipo, opciones
FROM cierre_campos
WHERE nombre ILIKE '%medio%terrestre%';

-- Actualizar las opciones para que pidan cantidad
UPDATE cierre_campos
SET opciones = '[
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
    "value": "motocicleta",
    "label": "Motocicleta",
    "requiresQuantity": true,
    "quantityLabel": "Número de motos"
  },
  {
    "value": "brigada_pie",
    "label": "Brigada a pie",
    "requiresQuantity": true,
    "quantityLabel": "Número de brigadistas"
  },
  {
    "value": "maquinaria_pesada",
    "label": "Maquinaria pesada",
    "requiresQuantity": true,
    "quantityLabel": "Número de máquinas"
  }
]'::jsonb
WHERE nombre ILIKE '%medio%terrestre%';

-- ================================================================================
-- EJEMPLO 2: Campo de tipos de vegetación afectada con porcentajes
-- ================================================================================

UPDATE cierre_campos
SET opciones = '[
  {
    "value": "bosque_coniferas",
    "label": "Bosque de coníferas",
    "requiresPercentage": true,
    "percentageLabel": "% del área total"
  },
  {
    "value": "bosque_latifoliado",
    "label": "Bosque latifoliado",
    "requiresPercentage": true,
    "percentageLabel": "% del área total"
  },
  {
    "value": "bosque_mixto",
    "label": "Bosque mixto",
    "requiresPercentage": true,
    "percentageLabel": "% del área total"
  },
  {
    "value": "pastizal",
    "label": "Pastizal",
    "requiresPercentage": true,
    "percentageLabel": "% del área total"
  },
  {
    "value": "matorrales",
    "label": "Matorrales",
    "requiresPercentage": true,
    "percentageLabel": "% del área total"
  },
  {
    "value": "cultivos",
    "label": "Cultivos agrícolas",
    "requiresPercentage": true,
    "percentageLabel": "% del área total"
  },
  {
    "value": "area_urbana",
    "label": "Área urbana",
    "requiresPercentage": true,
    "percentageLabel": "% del área total"
  }
]'::jsonb
WHERE nombre ILIKE '%vegetación%' OR nombre ILIKE '%tipo%area%';

-- ================================================================================
-- EJEMPLO 3: Medios aéreos con cantidad
-- ================================================================================

UPDATE cierre_campos
SET opciones = '[
  {
    "value": "helicoptero_bombardero",
    "label": "Helicóptero bombardero de agua",
    "requiresQuantity": true,
    "quantityLabel": "Número de helicópteros"
  },
  {
    "value": "avion_bombardero",
    "label": "Avión bombardero de agua",
    "requiresQuantity": true,
    "quantityLabel": "Número de aviones"
  },
  {
    "value": "avioneta_reconocimiento",
    "label": "Avioneta de reconocimiento",
    "requiresQuantity": true,
    "quantityLabel": "Número de avionetas"
  },
  {
    "value": "dron",
    "label": "Dron/UAV",
    "requiresQuantity": true,
    "quantityLabel": "Número de drones"
  }
]'::jsonb
WHERE nombre ILIKE '%medio%aéreo%' OR nombre ILIKE '%medio%aereo%';

-- ================================================================================
-- EJEMPLO 4: Instituciones participantes (simple, sin cantidad ni porcentaje)
-- ================================================================================

UPDATE cierre_campos
SET opciones = '[
  {
    "value": "conred",
    "label": "CONRED"
  },
  {
    "value": "bomberos_vol",
    "label": "Bomberos Voluntarios"
  },
  {
    "value": "bomberos_mun",
    "label": "Bomberos Municipales"
  },
  {
    "value": "ejercito",
    "label": "Ejército de Guatemala"
  },
  {
    "value": "pnc",
    "label": "PNC"
  },
  {
    "value": "inab",
    "label": "INAB"
  },
  {
    "value": "marn",
    "label": "MARN"
  },
  {
    "value": "comunidad",
    "label": "Comunidad local"
  }
]'::jsonb
WHERE nombre ILIKE '%institución%particip%';

-- ================================================================================
-- VERIFICAR CAMBIOS
-- ================================================================================

SELECT
  c.campo_uuid,
  c.nombre,
  c.tipo,
  c.opciones,
  s.nombre as seccion
FROM cierre_campos c
JOIN cierre_secciones s ON s.seccion_uuid = c.seccion_uuid
WHERE c.tipo IN ('select', 'multiselect')
  AND c.eliminado_en IS NULL
ORDER BY s.orden, c.orden;

-- ================================================================================
-- CONSULTAR RESPUESTAS CON NUEVOS FORMATOS
-- ================================================================================

-- Ver respuestas que tienen el nuevo formato (con quantity/percentage)
SELECT
  r.respuesta_uuid,
  c.nombre as campo,
  r.valor_json,
  r.actualizado_en
FROM cierre_respuestas r
JOIN cierre_campos c ON c.campo_uuid = r.campo_uuid
WHERE c.tipo IN ('select', 'multiselect')
  AND r.valor_json IS NOT NULL
  AND r.eliminado_en IS NULL
ORDER BY r.actualizado_en DESC
LIMIT 20;

-- ================================================================================
-- EJEMPLO DE MIGRACIÓN DE DATOS EXISTENTES
-- ================================================================================

-- Si ya tienes respuestas guardadas como arrays simples ["camion", "helicoptero"]
-- y quieres migrarlas al nuevo formato con quantity null:

-- PRECAUCIÓN: Esto es un ejemplo. Ajusta según tus necesidades.
/*
UPDATE cierre_respuestas r
SET valor_json = (
  SELECT jsonb_agg(
    jsonb_build_object(
      'value', elem::text,
      'quantity', NULL,
      'percentage', NULL
    )
  )
  FROM jsonb_array_elements_text(r.valor_json) elem
)
WHERE campo_uuid IN (
  SELECT campo_uuid
  FROM cierre_campos
  WHERE tipo = 'multiselect'
    AND opciones::jsonb @> '[{"requiresQuantity": true}]'
)
AND jsonb_typeof(valor_json) = 'array'
AND NOT EXISTS (
  SELECT 1
  FROM jsonb_array_elements(valor_json) elem
  WHERE jsonb_typeof(elem) = 'object'
);
*/

-- ================================================================================
-- NOTAS IMPORTANTES
-- ================================================================================

/*
1. COMPATIBILIDAD HACIA ATRÁS:
   - El frontend soporta ambos formatos:
     * Simple: "valor" o ["valor1", "valor2"]
     * Complejo: {"value": "x", "quantity": 5} o [{"value": "x", "quantity": 5}]

2. NO ES NECESARIO MIGRAR datos existentes inmediatamente.
   Los datos antiguos seguirán funcionando.

3. Para nuevas respuestas, si la opción tiene requiresQuantity o requiresPercentage,
   el frontend guardará automáticamente en el formato de objeto.

4. VALIDACIONES ADICIONALES:
   Puedes agregar validaciones al campo si necesitas restricciones:

   UPDATE cierre_campos
   SET validaciones = '{
     "min": 0,
     "max": 100,
     "message": "El porcentaje debe estar entre 0 y 100"
   }'::jsonb
   WHERE nombre ILIKE '%porcentaje%';

5. PARA REPORTES:
   Al generar reportes, ten en cuenta ambos formatos al procesar los datos.
*/
