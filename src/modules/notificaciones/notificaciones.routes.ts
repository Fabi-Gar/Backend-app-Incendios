// src/modules/notificaciones/notificaciones.routes.ts
import { Router } from 'express';
import { AppDataSource } from '../../db/data-source';
import { Notificacion } from './entities/notificacion.entity';

const router = Router();

// Obtener notificaciones del usuario autenticado
router.get('/notificaciones', async (req, res, next) => {
  try {
    // 🔒 SEGURIDAD: Usar el usuario del contexto, NO del query param
    const usuario_uuid = res.locals.ctx?.user?.usuario_uuid;
    
    if (!usuario_uuid) {
      return res.status(401).json({ 
        ok: false, 
        error: 'No autenticado' 
      });
    }

    const repo = AppDataSource.getRepository(Notificacion);
    const rows = await repo.createQueryBuilder('n')
      .where('n.usuario_uuid = :u', { u: usuario_uuid })
      .orderBy('n.creado_en', 'DESC')
      .take(50)
      .getMany();
    
    res.json({ ok: true, data: rows });
  } catch (e) { 
    next(e); 
  }
});

// Marcar notificación como leída
router.post('/notificaciones/:id/leer', async (req, res, next) => {
  try {
    const usuario_uuid = res.locals.ctx?.user?.usuario_uuid;
    const notif_id = req.params.id;

    if (!usuario_uuid) {
      return res.status(401).json({ 
        ok: false, 
        error: 'No autenticado' 
      });
    }

    const repo = AppDataSource.getRepository(Notificacion);
    
    // 🔒 SEGURIDAD: Verificar que la notificación pertenece al usuario
    const notif = await repo.findOne({ 
      where: { notificacion_uuid: notif_id } 
    });

    if (!notif) {
      return res.status(404).json({ 
        ok: false, 
        error: 'Notificación no encontrada' 
      });
    }

    if (notif.usuario_uuid !== usuario_uuid) {
      return res.status(403).json({ 
        ok: false, 
        error: 'No autorizado' 
      });
    }

    await repo.update(
      { notificacion_uuid: notif_id }, 
      { leida_en: new Date() }
    );
    
    res.json({ ok: true });
  } catch (e) { 
    next(e); 
  }
});

// Marcar todas como leídas
router.post('/notificaciones/leer-todas', async (req, res, next) => {
  try {
    const usuario_uuid = res.locals.ctx?.user?.usuario_uuid;

    if (!usuario_uuid) {
      return res.status(401).json({ 
        ok: false, 
        error: 'No autenticado' 
      });
    }

    const repo = AppDataSource.getRepository(Notificacion);
    await repo
      .createQueryBuilder()
      .update(Notificacion)
      .set({ leida_en: new Date() })
      .where('usuario_uuid = :u AND leida_en IS NULL', { u: usuario_uuid })
      .execute();

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;