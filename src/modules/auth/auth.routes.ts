import { Router } from 'express'
import { z } from 'zod'
import { AppDataSource } from '../../db/data-source'
import { Usuario } from '../seguridad/entities/usuario.entity'
import { IsNull } from 'typeorm'
import { verifyPassword, hashPassword } from '../../utils/password'
import { signAccessToken } from '../../utils/jwt'
import { getFirebaseAdmin } from '../notificaciones/firebasePush.service'
import { randomUUID } from 'crypto'

const router = Router()

// ===== Schemas =====
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  expoPushToken: z.string().optional(),
})

const publicRegisterSchema = z.object({
  nombre: z.string().min(1),
  apellido: z.string().min(1),
  telefono: z.string().optional().nullable(),
  email: z.string().email(),
  password: z.string().min(6),
  institucion_uuid: z.string().uuid().optional().nullable(),
  expoPushToken: z.string().optional(), // ← También para registro
})

const firebaseLoginSchema = z.object({
  idToken: z.string().min(1), // Token de Firebase del frontend
  expoPushToken: z.string().optional(),
})

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms))

/**
 * REGISTRO público - POST /auth/register
 * - No requiere token
 * - Asigna rol "USUARIO" del seed
 * - Devuelve { token, user }
 */
router.post('/register', async (req, res, next) => {
  try {
    const body = publicRegisterSchema.parse(req.body)
    const repo = AppDataSource.getRepository(Usuario)

    const emailN = body.email.trim().toLowerCase()

    // Unicidad de email
    const exists = await repo.findOne({ where: { email: emailN, eliminado_en: IsNull() } })
    if (exists) {
      return res.status(409).json({ error: { code: 'EMAIL_IN_USE', message: 'El email ya está registrado' } })
    }

    // Rol por defecto: USUARIO
    const row = await AppDataSource.manager.query(
      `SELECT rol_uuid FROM roles WHERE UPPER(nombre)=UPPER($1) LIMIT 1`,
      ['USUARIO']
    )
    const defaultRoleUuid: string | undefined = row?.[0]?.rol_uuid
    if (!defaultRoleUuid) {
      return res.status(500).json({
        error: { code: 'PUBLIC_ROLE_NOT_FOUND', message: 'No se encontró el rol "USUARIO". Verifica el seed.' },
      })
    }

    const password_hash = await hashPassword(body.password)

    const user = repo.create({
      nombre: body.nombre,
      apellido: body.apellido,
      telefono: body.telefono || null,
      email: emailN,
      password_hash,
      rol: { rol_uuid: defaultRoleUuid } as any,
      institucion: body.institucion_uuid ? ({ institucion_uuid: body.institucion_uuid } as any) : null,
      is_admin: false,
    })

    await repo.save(user)

    const token = signAccessToken({
      sub: user.usuario_uuid,
      is_admin: false,
      rol_uuid: defaultRoleUuid,
      institucion_uuid: (user as any)?.institucion?.institucion_uuid ?? null,
      email: user.email ?? undefined,
      nombre: `${user.nombre ?? ''} ${user.apellido ?? ''}`.trim() || undefined,
    })

    // ✅ Registrar token push si viene
    if (body.expoPushToken) {
      try {
        const { PushService } = await import('../notificaciones/push.service')
        await PushService.register({
          userId: user.usuario_uuid,
          expoPushToken: body.expoPushToken,
          avisarmeAprobado: true,
          avisarmeActualizaciones: true,
          avisarmeCierres: true,
          municipiosSuscritos: [],
          departamentosSuscritos: [],
        })
        console.log(`✅ Token push registrado para nuevo usuario: ${user.email}`)
      } catch (err) {
        console.error('⚠️ Error registrando token push en registro:', err)
        // No fallar el registro si falla el token
      }
    }

    // Devuelve token + user safe
    const { password_hash: _ph, ...safe } = user as any
    res.status(201).json({ token, user: safe })
  } catch (err: any) {
    if (err?.issues) {
      return res.status(400).json({
        error: { code: 'BAD_REQUEST', message: 'Validación', issues: err.issues },
        requestId: res.locals.ctx?.requestId,
      })
    }
    next(err)
  }
})

/**
 * LOGIN - POST /auth/login
 */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password, expoPushToken } = loginSchema.parse(req.body)

    const emailN = email.trim().toLowerCase()
    const repo = AppDataSource.getRepository(Usuario)

    const user = await repo.findOne({
      where: { email: emailN, eliminado_en: IsNull() },
      relations: ['rol', 'institucion'],
    })

    const invalid = () =>
      res.status(401).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'Email o password inválidos' },
        requestId: res.locals.ctx?.requestId,
      })

    if (!user) {
      await sleep(250)
      return invalid()
    }

    const ok = await verifyPassword(password, (user as any).password_hash)
    if (!ok) {
      await sleep(250)
      return invalid()
    }

    const fullName = `${(user as any).nombre ?? ''} ${(user as any).apellido ?? ''}`.trim()

    const token = signAccessToken({
      sub: user.usuario_uuid,
      email: user.email || undefined,
      is_admin: !!(user as any).is_admin,
      rol_uuid: (user as any)?.rol?.rol_uuid || undefined,
      institucion_uuid: (user as any)?.institucion?.institucion_uuid || undefined,
      nombre: fullName || undefined,
    })

    await repo.update({ usuario_uuid: user.usuario_uuid }, { ultimo_login: new Date() })

    // ✅ Registrar/actualizar token push si viene
    if (expoPushToken) {
      console.log('🔔 Intentando registrar token push:', {
        userId: user.usuario_uuid,
        token: expoPushToken.substring(0, 30) + '...',
      });
      
      try {
        const { PushService } = await import('../notificaciones/push.service')
        
        const result = await PushService.register({
          userId: user.usuario_uuid,
          expoPushToken,
          avisarmeAprobado: true,
          avisarmeActualizaciones: true,
          avisarmeCierres: true,
          municipiosSuscritos: [],
          departamentosSuscritos: [],
        });
        
        console.log('✅ Token push registrado exitosamente:', result);
      } catch (err) {
        console.error('❌ Error registrando token push en login:', err);
        // No fallar el login si falla el token
      }
    }
    res.json({
      token,
      user: {
        usuario_uuid: user.usuario_uuid,
        email: user.email,
        nombre: (user as any).nombre,
        apellido: (user as any).apellido,
        is_admin: (user as any).is_admin,
        rol_uuid: (user as any)?.rol?.rol_uuid ?? null,
        institucion_uuid: (user as any)?.institucion?.institucion_uuid ?? null,
      },
    })
  } catch (err: any) {
    if (err?.issues) {
      return res.status(400).json({
        error: { code: 'BAD_REQUEST', message: 'Validación', issues: err.issues },
        requestId: res.locals.ctx?.requestId,
      })
    }
    next(err)
  }
})

/**
 * LOGIN con Firebase - POST /auth/firebase-login
 * - Usuario hace login en el frontend con Firebase (Google, Facebook, etc.)
 * - Frontend envía el idToken de Firebase
 * - Backend verifica el token y crea/encuentra el usuario
 * - Devuelve tu propio JWT
 */
router.post('/firebase-login', async (req, res, next) => {
  try {
    const { idToken, expoPushToken } = firebaseLoginSchema.parse(req.body)

    // 1. Verificar el token de Firebase
    let decodedToken
    try {
      const admin = getFirebaseAdmin()
      decodedToken = await admin.auth().verifyIdToken(idToken)
    } catch (err: any) {
      console.error('❌ Error verificando token de Firebase:', err.message)
      if (err?.code === 'auth/id-token-expired') {
        return res.status(401).json({
          error: { code: 'TOKEN_EXPIRED', message: 'Token de Firebase expirado' },
          requestId: res.locals.ctx?.requestId,
        })
      }
      return res.status(400).json({
        error: { code: 'INVALID_TOKEN', message: 'Token de Firebase inválido' },
        requestId: res.locals.ctx?.requestId,
      })
    }

    // 2. Extraer datos del usuario de Firebase
    const firebaseUid = decodedToken.uid
    const email = decodedToken.email?.toLowerCase().trim()
    const displayName = decodedToken.name || 'Usuario'
    const photoUrl = decodedToken.picture

    if (!email) {
      return res.status(400).json({
        error: { code: 'NO_EMAIL', message: 'El usuario de Firebase no tiene email' },
        requestId: res.locals.ctx?.requestId,
      })
    }

    const repo = AppDataSource.getRepository(Usuario)

    // 3. Buscar o crear usuario en tu BD
    let user = await repo.findOne({
      where: { email, eliminado_en: IsNull() },
      relations: ['rol', 'institucion'],
    })

    // Si no existe, crear usuario nuevo
    if (!user) {
      console.log(`🆕 Creando nuevo usuario desde Firebase: ${email}`)

      // Obtener rol por defecto
      const row = await AppDataSource.manager.query(
        `SELECT rol_uuid FROM roles WHERE UPPER(nombre)=UPPER($1) LIMIT 1`,
        ['USUARIO']
      )
      const defaultRoleUuid: string | undefined = row?.[0]?.rol_uuid

      if (!defaultRoleUuid) {
        return res.status(500).json({
          error: { code: 'PUBLIC_ROLE_NOT_FOUND', message: 'Rol USUARIO no encontrado. Verifica el seed.' },
          requestId: res.locals.ctx?.requestId,
        })
      }

      // Crear usuario sin password real (usa Firebase)
      const [nombreParte = 'Usuario', ...apellidoPartes] = displayName.split(' ')
      const apellidoParte = apellidoPartes.join(' ') || 'Firebase'

      user = repo.create({
        nombre: nombreParte,
        apellido: apellidoParte,
        email,
        telefono: null,
        password_hash: await hashPassword(randomUUID()), // Password random (no se usa)
        rol: { rol_uuid: defaultRoleUuid } as any,
        is_admin: false,
        // Opcional: guardar firebase_uid para referencia futura
        // Si agregas campo firebase_uid a la entidad Usuario, descomenta:
        // firebase_uid: firebaseUid,
      })

      await repo.save(user)
      console.log(`✅ Usuario creado desde Firebase: ${email}`)
    } else {
      console.log(`✅ Usuario existente encontrado: ${email}`)
    }

    // 4. Generar tu propio JWT
    const fullName = `${(user as any).nombre ?? ''} ${(user as any).apellido ?? ''}`.trim()

    const token = signAccessToken({
      sub: user.usuario_uuid,
      email: user.email || undefined,
      is_admin: !!(user as any).is_admin,
      rol_uuid: (user as any)?.rol?.rol_uuid || undefined,
      institucion_uuid: (user as any)?.institucion?.institucion_uuid || undefined,
      nombre: fullName || undefined,
    })

    // 5. Actualizar último login
    await repo.update({ usuario_uuid: user.usuario_uuid }, { ultimo_login: new Date() })

    // 6. Registrar push token si viene
    if (expoPushToken) {
      console.log('🔔 Intentando registrar token push:', {
        userId: user.usuario_uuid,
        token: expoPushToken.substring(0, 30) + '...',
      })

      try {
        const { PushService } = await import('../notificaciones/push.service')

        const result = await PushService.register({
          userId: user.usuario_uuid,
          expoPushToken,
          avisarmeAprobado: true,
          avisarmeActualizaciones: true,
          avisarmeCierres: true,
          municipiosSuscritos: [],
          departamentosSuscritos: [],
        })

        console.log('✅ Token push registrado exitosamente:', result)
      } catch (err) {
        console.error('❌ Error registrando token push en Firebase login:', err)
        // No fallar el login si falla el token
      }
    }

    // 7. Responder con token y usuario
    res.json({
      token,
      user: {
        usuario_uuid: user.usuario_uuid,
        email: user.email,
        nombre: (user as any).nombre,
        apellido: (user as any).apellido,
        is_admin: (user as any).is_admin,
        rol_uuid: (user as any)?.rol?.rol_uuid ?? null,
        institucion_uuid: (user as any)?.institucion?.institucion_uuid ?? null,
      },
    })
  } catch (err: any) {
    if (err?.issues) {
      return res.status(400).json({
        error: { code: 'BAD_REQUEST', message: 'Validación', issues: err.issues },
        requestId: res.locals.ctx?.requestId,
      })
    }
    next(err)
  }
})

export default router