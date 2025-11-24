// src/modules/geoespacial/firms.config.ts
// Versión simple y probada: FIRMS por área (BBOX) con API key en el path.
// Ejemplo final: /api/area/csv/<MAP_KEY>/<SOURCE>/<W,S,E,N>/<DAYS>

export function buildFirmsUrls(): string[] {
  const base = 'https://firms.modaps.eosdis.nasa.gov/api/area/csv';
  const days = Number(process.env.FIRMS_DAYS || 3);
  // ⚠️ SIN url-encode: FIRMS espera comas literales en el BBOX
  const bbox = process.env.FIRMS_BBOX_GTM || '-180,-90,180,90';
  const apiKey = process.env.FIRMS_API_KEY;

  const products = (process.env.FIRMS_PRODUCTS || 'VIIRS_SNPP_NRT')
    .split(',')
    .map(s => s.trim().toUpperCase())
    .filter(Boolean);

  if (!apiKey) {
    throw new Error('FIRMS_API_KEY faltante en variables de entorno');
  }

  // /api/area/csv/<MAP_KEY>/<SOURCE>/<AREA>/<DAYS>
  return products.map(p => `${base}/${apiKey}/${p}/${bbox}/${days}`);
}
