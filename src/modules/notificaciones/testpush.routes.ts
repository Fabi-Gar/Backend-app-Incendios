// src/modules/notificaciones/testpush.routes.ts
import { Router } from 'express';
import { sendExpoPush } from './expoPush.service';
import { PushPrefsRepo } from './pushPrefs.repo';
import { guardAuth } from '../../middlewares/auth';

const router = Router();

// 🧪 Ruta 1: Test simple con token manual (ahora FCM)
router.post('/test-push', async (req, res) => {
  try {
    const { token, title, body } = req.body;
    
    if (!token) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Se requiere el campo "token"' 
      });
    }

    console.log('📤 Enviando notificación FCM de prueba a:', token.substring(0, 30) + '...');

    await sendExpoPush([token], {
      title: title || '🔥 Notificación de prueba FCM',
      body: body || 'Si ves esto, Firebase Cloud Messaging funciona correctamente',
      data: { 
        test: 'ok',
        timestamp: new Date().toISOString(),
        deeplink: '/test',
      },
    });

    res.json({ 
      ok: true, 
      message: 'Notificación FCM enviada exitosamente',
      sent_to: token.substring(0, 30) + '...',
    });
  } catch (e: any) {
    console.error('❌ Error enviando notificación de prueba:', e);
    res.status(500).json({ 
      ok: false, 
      error: e?.message || 'Error desconocido' 
    });
  }
});

// 🧪 Ruta 2: Test a usuario autenticado
router.post('/test-push-me', guardAuth, async (req, res) => {
  try {
    const userId = res.locals?.ctx?.user?.usuario_uuid;
    
    if (!userId) {
      return res.status(401).json({ 
        ok: false, 
        error: 'No autenticado' 
      });
    }

    console.log('📤 Buscando tokens FCM del usuario:', userId);

    const prefs = await PushPrefsRepo.getByUserId(userId);
    
    if (!prefs || !prefs.tokens || prefs.tokens.length === 0) {
      return res.status(404).json({ 
        ok: false, 
        error: 'No tienes tokens FCM registrados. Registra tu dispositivo primero.' 
      });
    }

    const activeTokens = prefs.tokens
      .filter(t => t.active)
      .map(t => t.token);

    if (activeTokens.length === 0) {
      return res.status(404).json({ 
        ok: false, 
        error: 'No tienes tokens activos' 
      });
    }

    console.log(`📤 Enviando notificación FCM a ${activeTokens.length} dispositivo(s)`);

    await sendExpoPush(activeTokens, {
      title: '🎉 Test de notificación personal',
      body: 'Tus notificaciones FCM están funcionando correctamente',
      data: { 
        test: 'ok',
        user_id: userId,
        timestamp: new Date().toISOString(),
      },
    });

    res.json({ 
      ok: true, 
      message: `Notificación FCM enviada a ${activeTokens.length} dispositivo(s)`,
      devices: activeTokens.length,
    });
  } catch (e: any) {
    console.error('❌ Error enviando notificación personal:', e);
    res.status(500).json({ 
      ok: false, 
      error: e?.message || 'Error desconocido' 
    });
  }
});

// 🧪 Ruta 3: Test de notificación por región
router.post('/test-push-region', async (req, res) => {
  try {
    const { municipioCode, departamentoCode } = req.body;
    
    if (!municipioCode && !departamentoCode) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Se requiere municipioCode o departamentoCode' 
      });
    }

    let tokens: string[] = [];
    let locationName = '';

    if (municipioCode) {
      tokens = await PushPrefsRepo.getTokensByMunicipio(municipioCode);
      locationName = `municipio ${municipioCode}`;
    } else if (departamentoCode) {
      tokens = await PushPrefsRepo.getTokensByDepartamento(departamentoCode);
      locationName = `departamento ${departamentoCode}`;
    }

    if (tokens.length === 0) {
      return res.status(404).json({ 
        ok: false, 
        error: `No hay usuarios suscritos a ${locationName}` 
      });
    }

    console.log(`📤 Enviando notificación FCM a ${tokens.length} usuario(s) en ${locationName}`);

    await sendExpoPush(tokens, {
      title: '🔥 Alerta de prueba regional',
      body: `Test de notificación FCM para ${locationName}`,
      data: { 
        test: 'ok',
        region: municipioCode || departamentoCode,
        timestamp: new Date().toISOString(),
      },
    });

    res.json({ 
      ok: true, 
      message: `Notificación FCM enviada a ${tokens.length} usuario(s)`,
      region: locationName,
      recipients: tokens.length,
    });
  } catch (e: any) {
    console.error('❌ Error enviando notificación regional:', e);
    res.status(500).json({ 
      ok: false, 
      error: e?.message || 'Error desconocido' 
    });
  }
});

// 🧪 Ruta 4: Verificar configuración del usuario
router.get('/my-push-config', guardAuth, async (req, res) => {
  try {
    const userId = res.locals?.ctx?.user?.usuario_uuid;
    
    if (!userId) {
      return res.status(401).json({ 
        ok: false, 
        error: 'No autenticado' 
      });
    }

    const prefs = await PushPrefsRepo.getByUserId(userId);
    
    if (!prefs) {
      return res.status(404).json({ 
        ok: false, 
        error: 'No tienes configuración de notificaciones' 
      });
    }

    const activeTokens = (prefs.tokens || [])
      .filter(t => t.active)
      .map(t => ({
        token: t.token.substring(0, 30) + '...',
        tipo: t.token.startsWith('ExponentPushToken') ? 'Expo (obsoleto)' : 'FCM',
        created: t.createdAt,
      }));

    res.json({ 
      ok: true, 
      config: {
        userId: prefs.userId,
        municipiosSuscritos: prefs.municipiosSuscritos,
        departamentosSuscritos: prefs.departamentosSuscritos,
        avisarmeAprobado: prefs.avisarmeAprobado,
        avisarmeActualizaciones: prefs.avisarmeActualizaciones,
        avisarmeCierres: prefs.avisarmeCierres,
        activeDevices: activeTokens.length,
        devices: activeTokens,
      }
    });
  } catch (e: any) {
    console.error('❌ Error obteniendo configuración:', e);
    res.status(500).json({ 
      ok: false, 
      error: e?.message || 'Error desconocido' 
    });
  }
});

// ✅ Limpiar tokens antiguos de Expo
router.delete('/clean-expo-tokens', guardAuth, async (req, res) => {
  try {
    const userId = res.locals?.ctx?.user?.usuario_uuid;
    
    if (!userId) {
      return res.status(401).json({ ok: false, error: 'No autenticado' });
    }

    const prefs = await PushPrefsRepo.getByUserId(userId);
    
    if (!prefs || !prefs.tokens || prefs.tokens.length === 0) {
      return res.json({ 
        ok: true, 
        message: 'No hay tokens para limpiar',
        removed: 0
      });
    }

    // Remover tokens de Expo uno por uno
    const expoTokens = prefs.tokens.filter(t => t.token.startsWith('ExponentPushToken'));
    
    for (const tokenObj of expoTokens) {
      await PushPrefsRepo.removeToken(userId, tokenObj.token);
    }

    res.json({ 
      ok: true, 
      message: `${expoTokens.length} token(s) de Expo eliminados`,
      removed: expoTokens.length,
      remaining: prefs.tokens.length - expoTokens.length
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message });
  }
});

// ✅ Eliminar TODOS mis tokens
router.delete('/clean-all-tokens', guardAuth, async (req, res) => {
  try {
    const userId = res.locals?.ctx?.user?.usuario_uuid;
    
    if (!userId) {
      return res.status(401).json({ ok: false, error: 'No autenticado' });
    }

    const prefs = await PushPrefsRepo.getByUserId(userId);
    
    if (!prefs || !prefs.tokens || prefs.tokens.length === 0) {
      return res.json({ 
        ok: true, 
        message: 'No hay tokens para eliminar',
        removed: 0
      });
    }

    // Remover todos los tokens uno por uno
    const tokenCount = prefs.tokens.length;
    for (const tokenObj of prefs.tokens) {
      await PushPrefsRepo.removeToken(userId, tokenObj.token);
    }

    res.json({ 
      ok: true, 
      message: `${tokenCount} token(s) eliminados. Haz logout y login para registrar un nuevo token FCM.`,
      removed: tokenCount
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message });
  }
});

// ✅ Re-registrar mi token FCM actual
router.post('/reregister-token', guardAuth, async (req, res) => {
  try {
    const userId = res.locals?.ctx?.user?.usuario_uuid;
    const { fcmToken } = req.body;
    
    if (!userId) {
      return res.status(401).json({ ok: false, error: 'No autenticado' });
    }

    if (!fcmToken) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Se requiere fcmToken en el body' 
      });
    }

    // Limpiar todos los tokens antiguos primero
    const prefs = await PushPrefsRepo.getByUserId(userId);
    if (prefs && prefs.tokens && prefs.tokens.length > 0) {
      for (const tokenObj of prefs.tokens) {
        await PushPrefsRepo.removeToken(userId, tokenObj.token);
      }
    }

    // Registrar el nuevo
    const { PushService } = await import('./push.service');
    await PushService.register({
      userId,
      expoPushToken: fcmToken, // Backend lo espera con este nombre
      avisarmeAprobado: true,
      avisarmeActualizaciones: true,
      avisarmeCierres: true,
      municipiosSuscritos: [],
      departamentosSuscritos: [],
    });

    res.json({ 
      ok: true, 
      message: 'Token FCM registrado exitosamente',
      token: fcmToken.substring(0, 30) + '...'
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message });
  }
});

// ✅ Ver mis tokens actuales
router.get('/my-tokens', guardAuth, async (req, res) => {
  try {
    const userId = res.locals?.ctx?.user?.usuario_uuid;
    
    if (!userId) {
      return res.status(401).json({ ok: false, error: 'No autenticado' });
    }

    const prefs = await PushPrefsRepo.getByUserId(userId);
    
    if (!prefs) {
      return res.json({ 
        ok: true, 
        tokens: [],
        message: 'No tienes tokens registrados'
      });
    }

    // Separar tokens por tipo
    const fcmTokens = (prefs.tokens || [])
      .filter((t: any) => !t.token.startsWith('ExponentPushToken'))
      .map((t: any) => ({
        token: t.token.substring(0, 30) + '...',
        tipo: 'FCM',
        active: t.active,
        created: t.createdAt
      }));

    const expoTokens = (prefs.tokens || [])
      .filter((t: any) => t.token.startsWith('ExponentPushToken'))
      .map((t: any) => ({
        token: t.token.substring(0, 30) + '...',
        tipo: 'Expo (obsoleto)',
        active: t.active,
        created: t.createdAt
      }));

    res.json({ 
      ok: true,
      userId,
      fcmTokens,
      expoTokens,
      total: fcmTokens.length + expoTokens.length,
      warning: expoTokens.length > 0 ? 'Tienes tokens de Expo obsoletos que deberías limpiar' : null
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message });
  }
});

export default router;