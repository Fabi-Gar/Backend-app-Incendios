// src/modules/notificaciones/push.service.ts
import { PushPrefsRepo } from "./pushPrefs.repo";

export const PushService = {
  register: async (body: {
    userId: string;
    expoPushToken: string;
    municipiosSuscritos?: string[];
    departamentosSuscritos?: string[];
    avisarmeAprobado?: boolean;
    avisarmeActualizaciones?: boolean;
    avisarmeCierres?: boolean;
  }) => {
    const { 
      userId, 
      expoPushToken, 
      municipiosSuscritos = [], 
      departamentosSuscritos = [],
      avisarmeAprobado = true,
      avisarmeActualizaciones = true,
      avisarmeCierres = true
    } = body;

    if (!userId || !expoPushToken) {
      throw new Error('userId y expoPushToken son requeridos');
    }

    return PushPrefsRepo.upsertTokenAndPrefs(
      userId, 
      expoPushToken, 
      municipiosSuscritos, 
      departamentosSuscritos,
      avisarmeAprobado,
      avisarmeActualizaciones,
      avisarmeCierres
    );
  },

  updatePrefs: async (body: {
    userId: string;
    municipiosSuscritos?: string[];
    departamentosSuscritos?: string[];
    avisarmeAprobado?: boolean;
    avisarmeActualizaciones?: boolean;
    avisarmeCierres?: boolean;
  }) => {
    const { 
      userId, 
      municipiosSuscritos, 
      departamentosSuscritos,
      avisarmeAprobado,
      avisarmeActualizaciones,
      avisarmeCierres
    } = body;

    if (!userId) throw new Error('userId es requerido');

    const updated = await PushPrefsRepo.updatePrefs(
      userId, 
      municipiosSuscritos, 
      departamentosSuscritos,
      avisarmeAprobado,
      avisarmeActualizaciones,
      avisarmeCierres
    );

    if (!updated) throw new Error('Usuario no encontrado');
    return updated;
  },

  unregister: async (body: { userId: string; expoPushToken: string }) => {
    const { userId, expoPushToken } = body;
    if (!userId || !expoPushToken) {
      throw new Error('userId y expoPushToken son requeridos');
    }

    const updated = await PushPrefsRepo.removeToken(userId, expoPushToken);
    if (!updated) throw new Error('Usuario no encontrado o token inexistente');
    return updated;
  },
};