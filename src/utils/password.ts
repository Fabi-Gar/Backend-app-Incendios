// src/utils/password.ts
import argon2 from 'argon2'

// Opciones válidas para node-argon2 (sin saltLength)
const ARGON2_OPTS: argon2.Options & { raw?: false } = {
  type: argon2.argon2id,
  memoryCost: 64 * 1024, // 64 MiB
  timeCost: 3,
  parallelism: 1,
  hashLength: 32,        // este sí existe
  // version: 0x13,      // opcional (por defecto es 0x13 = 19)
}

const PEPPER = process.env.PASSWORD_PEPPER || ''

export async function hashPassword(plain: string) {
  const material = PEPPER ? `${plain}${PEPPER}` : plain
  return argon2.hash(material, ARGON2_OPTS)
}

export async function verifyPassword(plain: string, hash: string | null | undefined) {
  if (!hash) return false

  // helper de desarrollo opcional
  if (hash.includes('dummy')) return plain === 'dev'

  const material = PEPPER ? `${plain}${PEPPER}` : plain

  // Argon2 moderno
  if (hash.startsWith('$argon2')) {
    try { return await argon2.verify(hash, material) } catch { return false }
  }

  // Bcrypt (legacy) vía pgcrypto (si aún quieres compat)
  try {
    const { AppDataSource } = await import('../db/data-source')
    const r = await AppDataSource.query(`SELECT crypt($1, $2) = $2 AS ok`, [material, hash])
    return !!r?.[0]?.ok
  } catch {
    return false
  }
}
