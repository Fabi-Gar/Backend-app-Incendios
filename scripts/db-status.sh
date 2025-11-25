#!/bin/bash
# Script para ver el estado de la base de datos

echo "==============================================="
echo "📊 ESTADO DE LA BASE DE DATOS"
echo "==============================================="
echo ""

COMPOSE_FILE="docker-compose.dev.yml"

echo "🔥 INCENDIOS:"
docker compose -f $COMPOSE_FILE exec -T db psql -U postgres -d appIncendios2 <<EOF
SELECT
  (SELECT COUNT(*) FROM incendios WHERE eliminado_en IS NULL) as total,
  (SELECT COUNT(*) FROM incendios WHERE aprobado = true AND eliminado_en IS NULL) as aprobados,
  (SELECT COUNT(*) FROM incendios WHERE aprobado = false AND eliminado_en IS NULL) as pendientes,
  (SELECT COUNT(*) FROM incendios WHERE extinguido_at IS NOT NULL AND eliminado_en IS NULL) as extinguidos;
EOF

echo ""
echo "👥 USUARIOS:"
docker compose -f $COMPOSE_FILE exec -T db psql -U postgres -d appIncendios2 <<EOF
SELECT
  r.nombre as rol,
  COUNT(*) as total
FROM usuarios u
JOIN roles r ON u.rol_uuid = r.rol_uuid
WHERE u.eliminado_en IS NULL
GROUP BY r.nombre;
EOF

echo ""
echo "📋 PLANTILLAS DE CIERRE:"
docker compose -f $COMPOSE_FILE exec -T db psql -U postgres -d appIncendios2 <<EOF
SELECT
  p.nombre,
  p.activa,
  (SELECT COUNT(*) FROM cierre_secciones WHERE plantilla_uuid = p.plantilla_uuid AND eliminado_en IS NULL) as secciones,
  (SELECT COUNT(*) FROM cierre_campos c
   JOIN cierre_secciones s ON c.seccion_uuid = s.seccion_uuid
   WHERE s.plantilla_uuid = p.plantilla_uuid AND c.eliminado_en IS NULL) as campos
FROM cierre_plantillas p
WHERE p.eliminado_en IS NULL;
EOF

echo ""
echo "📈 RESPUESTAS DE CIERRE:"
docker compose -f $COMPOSE_FILE exec -T db psql -U postgres -d appIncendios2 <<EOF
SELECT
  COUNT(DISTINCT incendio_uuid) as incendios_con_respuestas,
  COUNT(*) as total_respuestas
FROM cierre_respuestas
WHERE eliminado_en IS NULL;
EOF

echo ""
echo "💾 TAMAÑO DE TABLAS TOP 5:"
docker compose -f $COMPOSE_FILE exec -T db psql -U postgres -d appIncendios2 <<EOF
SELECT
  tablename,
  pg_size_pretty(pg_total_relation_size('public.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size('public.'||tablename) DESC
LIMIT 5;
EOF

echo ""
echo "==============================================="
