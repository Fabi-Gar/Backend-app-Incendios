import { z } from 'zod'

const percentMap = z.record(z.string(), z.number().min(0))

function sumMax100(map: Record<string, number>) {
  const sum = Object.values(map || {}).reduce((a, b) => a + (Number.isFinite(b as any) ? Number(b) : 0), 0)
  return sum <= 100
}

export const cierreCreateSchema = z.object({
  incendio_uuid: z.string().uuid(),
  topografia: percentMap.refine(sumMax100, { message: 'topografia suma > 100' }),
  tecnicas: percentMap.refine(sumMax100, { message: 'tecnicas suma > 100' }),
  composicion: percentMap.refine(sumMax100, { message: 'composicion suma > 100' })
})
