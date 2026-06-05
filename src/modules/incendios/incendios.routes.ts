import { Router } from 'express'
import { guardAuth, guardAdminOrInstitucion } from '../../middlewares/auth'
import multer from 'multer'
import { IncendiosController } from './incendios.controller'
import { syncInabIncidents } from './inabSync.service'

const router = Router()

// Configurar multer (en memoria) para la subida de fotos
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
})

// -------------------- MIS INCENDIOS --------------------
router.get('/mios', guardAuth, IncendiosController.getMios)
router.get('/sin-aprobar', guardAuth, guardAdminOrInstitucion, IncendiosController.getSinAprobar)

// -------------------- LISTAR Y DETALLE --------------------
router.get('/', IncendiosController.listar)
router.get('/:uuid', IncendiosController.getDetalle)

// -------------------- CREAR INCENDIO --------------------
// RUTAS DE CREACIÓN Y MODIFICACIÓN LOCAL (Comentadas por integración INAB - Modo Solo Lectura híbrido)
/*
router.post('/', guardAuth, upload.single('file'), IncendiosController.crear)
router.patch('/:uuid', guardAuth, IncendiosController.actualizar)
router.patch('/:uuid/aprobar', guardAuth, guardAdminOrInstitucion, IncendiosController.aprobar)
router.patch('/:uuid/rechazar', guardAuth, guardAdminOrInstitucion, IncendiosController.rechazar)
*/

// -------------------- HISTORIAL --------------------
router.get('/:uuid/historial', IncendiosController.historial)

// -------------------- SEGUIMIENTO --------------------
router.get('/:uuid/siguiendo', guardAuth, IncendiosController.chequeaSiguiendo)
router.post('/:uuid/seguir', guardAuth, IncendiosController.seguir)
router.delete('/:uuid/seguir', guardAuth, IncendiosController.dejarDeSeguir)

// ===== INTEGRACION INAB =====
// Endpoint manual para disparar la sincronización de incendios de INAB
router.post('/sync-inab', guardAuth, guardAdminOrInstitucion, async (req, res) => {
  try {
    await syncInabIncidents()
    res.json({ message: 'Sincronización de INAB completada' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
