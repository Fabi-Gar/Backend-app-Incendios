// src/routes/push.routes.ts
import { Router } from 'express';
import { PushController } from './push.controller';

const router = Router();

// Registrar token y preferencias
router.post('/push/register', PushController.register);

// Actualizar solo preferencias
router.post('/push/prefs', PushController.prefs);

// Desactivar token
router.post('/push/unregister', PushController.unregister);

export default router;