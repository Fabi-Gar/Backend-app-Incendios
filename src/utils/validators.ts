// src/utils/validators.ts
import { z } from 'zod'

export const point4326 = z.object({
  type: z.literal('Point'),
  coordinates: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)])
})

export const fechaRango = z.object({
  inicio: z.coerce.date(),
  fin: z.coerce.date()
}).refine(v => v.fin >= v.inicio, { message: 'fin < inicio', path: ['fin'] })

export function sumMax100(obj: Record<string, number>) {
  const s = Object.values(obj).reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0)
  return s <= 100
}
