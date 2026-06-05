export type PgMapped = { status: number; body: any } | null

export function mapPgError(err: any, traceId?: string): PgMapped {
  const e = err?.driverError ?? err
  const code = e?.code
  const detail: string | undefined = e?.detail
  const constraint: string | undefined = e?.constraint
  const table: string | undefined = e?.table
  const message: string | undefined = e?.message

  // FK violation
  if (code === '23503') {
    let column: string | undefined
    let value: string | undefined
    let refTable: string | undefined
    const m = /Key \((.+)\)=\((.+)\) is not present in table "(.+)"/i.exec(detail || '')
    if (m) {
      column = m[1]
      value = m[2]
      refTable = m[3]
    }
    return {
      status: 422,
      body: {
        error: {
          code: 'FK_VIOLATION',
          message: 'Referencia no válida a una clave foránea.',
          traceId,
          pg: { code, constraint, table, detail, column, value, refTable },
          hint: column ? `Revisa que el valor de "${column}" exista en "${refTable}".` : undefined,
        },
      },
    }
  }

  // Unique violation
  if (code === '23505') {
    let column: string | undefined
    let value: string | undefined
    const m = /Key \((.+)\)=\((.+)\) already exists/i.exec(detail || '')
    if (m) {
      column = m[1]
      value = m[2]
    }
    return {
      status: 409,
      body: {
        error: {
          code: 'UNIQUE_VIOLATION',
          message: 'Registro duplicado.',
          traceId,
          pg: { code, constraint, table, detail, column, value },
        },
      },
    }
  }

  // Not null violation
  if (code === '23502') {
    return {
      status: 422,
      body: {
        error: {
          code: 'NOT_NULL_VIOLATION',
          message: 'Campo requerido no puede ser NULL.',
          traceId,
          pg: { code, constraint, table, detail },
        },
      },
    }
  }

  // Invalid text representation / cast
  if (code === '22P02') {
    return {
      status: 400,
      body: {
        error: {
          code: 'INVALID_TEXT_REPRESENTATION',
          message: 'Formato inválido en algún campo (ej. UUID/fecha/número).',
          traceId,
          pg: { code, detail },
        },
      },
    }
  }

  // PostGIS / GeoJSON
  if (code === 'XX000' || code === '22023' || /GeoJSON|ST_GeomFromGeoJSON/i.test(message || '')) {
    return {
      status: 400,
      body: {
        error: {
          code: 'GEOMETRY_PARSE_ERROR',
          message: 'GeoJSON inválido o geometría no válida.',
          traceId,
          pg: { code, detail, message },
        },
      },
    }
  }

  // Por defecto
  return {
    status: 500,
    body: {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error interno del servidor.',
        traceId,
        pg: { code, constraint, table, detail, message },
      },
    },
  }
}
