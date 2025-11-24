// src/utils/pagination.ts
import { AppDataSource } from '../db/data-source'

export interface PaginationOptions {
  table: string
  searchColumn?: string
  searchTerm?: string
  page: number
  pageSize: number
  orderBy?: string
  orderDirection?: 'ASC' | 'DESC'
  additionalWhere?: string
  params?: any[]
}

export interface PaginationResult<T> {
  total: number
  page: number
  pageSize: number
  items: T[]
}

/**
 * Helper genérico para queries paginadas con búsqueda
 */
export async function paginatedQuery<T = any>(
  options: PaginationOptions
): Promise<PaginationResult<T>> {
  const {
    table,
    searchColumn,
    searchTerm,
    page,
    pageSize,
    orderBy = 'creado_en',
    orderDirection = 'DESC',
    additionalWhere = '',
    params = []
  } = options

  const search = searchTerm?.trim() || ''
  const searchCondition = searchColumn && search
    ? `AND ${searchColumn} ILIKE '%' || $${params.length + 1} || '%'`
    : ''

  const allParams = searchColumn && search ? [...params, search] : params

  // Query de conteo
  const countQuery = `
    SELECT COUNT(*)::int AS total
    FROM ${table}
    WHERE eliminado_en IS NULL
      ${additionalWhere}
      ${searchCondition}
  `
  const countRows = await AppDataSource.query(countQuery, allParams)
  const total = countRows?.[0]?.total ?? 0

  // Query de items
  const offset = (page - 1) * pageSize
  const itemsQuery = `
    SELECT * FROM ${table}
    WHERE eliminado_en IS NULL
      ${additionalWhere}
      ${searchCondition}
    ORDER BY ${orderBy} ${orderDirection}
    LIMIT $${allParams.length + 1} OFFSET $${allParams.length + 2}
  `
  const items = await AppDataSource.query(itemsQuery, [...allParams, pageSize, offset])

  return {
    total,
    page,
    pageSize,
    items
  }
}
