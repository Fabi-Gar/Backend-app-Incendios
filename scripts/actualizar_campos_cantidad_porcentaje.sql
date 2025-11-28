-- ================================================================================
-- Script para actualizar campos de cierre con cantidad y porcentaje
-- ================================================================================
-- IMPORTANTE: Este script actualiza las opciones de campos existentes
-- para agregar soporte de cantidad y porcentaje en selects y multiselects
-- ================================================================================

-- Ver campos actuales antes de actualizar
SELECT
  campo_uuid,
  nombre,
  tipo,
  opciones
FROM cierre_campos
WHERE tipo IN ('select', 'multiselect')
  AND eliminado_en IS NULL
ORDER BY nombre;

-- ================================================================================
-- 1. Actualizar MEDIOS TERRESTRES con cantidad
-- ================================================================================

UPDATE cierre_campos
SET opciones = '[
  {"value":"pickup","label":"Pick-up","requiresQuantity":true,"quantityLabel":"Cantidad de pick-ups"},
  {"value":"camion","label":"Camión","requiresQuantity":true,"quantityLabel":"Cantidad de camiones"},
  {"value":"ambulancia","label":"Ambulancia","requiresQuantity":true,"quantityLabel":"Cantidad de ambulancias"},
  {"value":"microbus","label":"Microbús","requiresQuantity":true,"quantityLabel":"Cantidad de microbuses"},
  {"value":"motobomba","label":"Motobomba","requiresQuantity":true,"quantityLabel":"Cantidad de motobombas"},
  {"value":"cisterna","label":"Cisterna","requiresQuantity":true,"quantityLabel":"Cantidad de cisternas"},
  {"value":"motocicleta","label":"Motocicleta","requiresQuantity":true,"quantityLabel":"Cantidad de motocicletas"},
  {"value":"rescate","label":"Vehículo de rescate","requiresQuantity":true,"quantityLabel":"Cantidad de vehículos"}
]'::jsonb,
descripcion = 'Vehículos y equipos terrestres utilizados'
WHERE nombre = 'Medios terrestres'
  AND eliminado_en IS NULL;

-- Verificar
SELECT nombre, opciones
FROM cierre_campos
WHERE nombre = 'Medios terrestres' AND eliminado_en IS NULL;

-- ================================================================================
-- 2. Actualizar MEDIOS AÉREOS con cantidad
-- ================================================================================

UPDATE cierre_campos
SET opciones = '[
  {"value":"avion_sobrevuelo","label":"Avión de sobrevuelo","requiresQuantity":true,"quantityLabel":"Cantidad de aviones"},
  {"value":"avion_cisterna","label":"Avión cisterna","requiresQuantity":true,"quantityLabel":"Cantidad de aviones"},
  {"value":"helicoptero_helibalde","label":"Helicóptero con helibalde","requiresQuantity":true,"quantityLabel":"Cantidad de helicópteros"},
  {"value":"helicoptero_monitoreo","label":"Helicóptero de monitoreo","requiresQuantity":true,"quantityLabel":"Cantidad de helicópteros"}
]'::jsonb
WHERE nombre = 'Medios aéreos'
  AND eliminado_en IS NULL;

-- Verificar
SELECT nombre, opciones
FROM cierre_campos
WHERE nombre = 'Medios aéreos' AND eliminado_en IS NULL;

-- ================================================================================
-- 3. Actualizar MEDIOS ACUÁTICOS con cantidad
-- ================================================================================

UPDATE cierre_campos
SET opciones = '[
  {"value":"lancha","label":"Lancha","requiresQuantity":true,"quantityLabel":"Cantidad de lanchas"},
  {"value":"bote","label":"Bote","requiresQuantity":true,"quantityLabel":"Cantidad de botes"},
  {"value":"otro","label":"Otro","requiresQuantity":true,"quantityLabel":"Cantidad"}
]'::jsonb
WHERE nombre = 'Medios acuáticos'
  AND eliminado_en IS NULL;

-- Verificar
SELECT nombre, opciones
FROM cierre_campos
WHERE nombre = 'Medios acuáticos' AND eliminado_en IS NULL;

-- ================================================================================
-- 4. Actualizar TIPO DE INCENDIO con porcentaje
-- ================================================================================

UPDATE cierre_campos
SET opciones = '[
  {"value":"rastrero","label":"Rastrero (fuego superficial)","requiresPercentage":true,"percentageLabel":"% del área"},
  {"value":"copas","label":"De copas (fuego aéreo)","requiresPercentage":true,"percentageLabel":"% del área"},
  {"value":"subterraneo","label":"Subterráneo (fuego de suelo)","requiresPercentage":true,"percentageLabel":"% del área"}
]'::jsonb,
descripcion = 'Clasificación del tipo de incendio (puede seleccionar múltiples tipos con porcentaje)'
WHERE nombre = 'Tipo de incendio'
  AND eliminado_en IS NULL;

-- Verificar
SELECT nombre, opciones
FROM cierre_campos
WHERE nombre = 'Tipo de incendio' AND eliminado_en IS NULL;

-- ================================================================================
-- 5. Ver todos los campos actualizados
-- ================================================================================

SELECT
  c.campo_uuid,
  c.nombre,
  c.tipo,
  c.descripcion,
  c.opciones,
  s.nombre as seccion
FROM cierre_campos c
JOIN cierre_secciones s ON s.seccion_uuid = c.seccion_uuid
WHERE c.nombre IN (
  'Medios terrestres',
  'Medios aéreos',
  'Medios acuáticos',
  'Tipo de incendio'
)
AND c.eliminado_en IS NULL
ORDER BY c.nombre;

-- ================================================================================
-- 6. Ver respuestas existentes (si hay datos ya guardados)
-- ================================================================================

SELECT
  r.respuesta_uuid,
  c.nombre as campo,
  i.titulo as incendio,
  r.valor_json,
  r.actualizado_en
FROM cierre_respuestas r
JOIN cierre_campos c ON c.campo_uuid = r.campo_uuid
JOIN incendios i ON i.incendio_uuid = r.incendio_uuid
WHERE c.nombre IN (
  'Medios terrestres',
  'Medios aéreos',
  'Medios acuáticos',
  'Tipo de incendio'
)
AND r.eliminado_en IS NULL
ORDER BY r.actualizado_en DESC
LIMIT 20;

-- ================================================================================
-- IMPORTANTE: COMPATIBILIDAD HACIA ATRÁS
-- ================================================================================
/*
Las respuestas existentes seguirán funcionando:

ANTES (array simple):
["pickup", "camion"]

AHORA (con cantidad):
[
  {"value": "pickup", "quantity": 3, "percentage": null},
  {"value": "camion", "quantity": 2, "percentage": null}
]

El frontend maneja ambos formatos automáticamente.
No es necesario migrar datos existentes de inmediato.
Las nuevas respuestas se guardarán en el formato completo automáticamente.
*/

-- ================================================================================
-- OPCIONAL: Migrar datos existentes de arrays simples a objetos con quantity
-- ================================================================================
/*
⚠️ PRECAUCIÓN: Solo ejecuta esto si QUIERES migrar datos antiguos al nuevo formato
Este ejemplo convierte arrays simples en objetos con quantity=null

-- Para MULTISELECT (Medios terrestres, aéreos, acuáticos)
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
  WHERE nombre IN ('Medios terrestres', 'Medios aéreos', 'Medios acuáticos')
    AND eliminado_en IS NULL
)
AND jsonb_typeof(valor_json) = 'array'
AND r.eliminado_en IS NULL
-- Solo migrar si todos los elementos son strings (no objetos)
AND NOT EXISTS (
  SELECT 1
  FROM jsonb_array_elements(valor_json) elem
  WHERE jsonb_typeof(elem) = 'object'
);

-- Verificar la migración
SELECT
  c.nombre,
  r.valor_json as respuesta_migrada
FROM cierre_respuestas r
JOIN cierre_campos c ON c.campo_uuid = r.campo_uuid
WHERE c.nombre IN ('Medios terrestres', 'Medios aéreos', 'Medios acuáticos')
  AND r.eliminado_en IS NULL
LIMIT 10;
*/

-- ================================================================================
-- FIN DEL SCRIPT
-- ================================================================================
