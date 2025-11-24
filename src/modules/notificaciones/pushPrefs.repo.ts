// src/modules/notificaciones/pushPrefs.repo.ts
import { AppDataSource } from '../../db/data-source';
import { UserPushPrefs } from './entities/UserPushPrefs';
import { UserPushToken } from './entities/UserPushToken';

export const PushPrefsRepo = {
  // Obtener preferencias de un usuario
  async getByUserId(userId: string) {
    const repo = AppDataSource.getRepository(UserPushPrefs);
    return repo.findOne({ where: { userId }, relations: { tokens: true } });
  },

  // Crear o actualizar preferencias
  async ensurePrefs(
    userId: string, 
    municipios: string[] = [], 
    departamentos: string[] = [],
    avisarmeAprobado = true,
    avisarmeActualizaciones = true,
    avisarmeCierres = true
  ) {
    const repo = AppDataSource.getRepository(UserPushPrefs);
    let prefs = await repo.findOne({ where: { userId } });
    
    if (!prefs) {
      prefs = repo.create({
        userId,
        municipiosSuscritos: municipios,
        departamentosSuscritos: departamentos,
        avisarmeAprobado,
        avisarmeActualizaciones,
        avisarmeCierres,
        extra: null,
      });
      prefs = await repo.save(prefs);
    }
    return prefs;
  },

  // Registrar token y preferencias
  async upsertTokenAndPrefs(
    userId: string,
    expoToken: string,
    municipiosSuscritos: string[] = [],
    departamentosSuscritos: string[] = [],
    avisarmeAprobado = true,
    avisarmeActualizaciones = true,
    avisarmeCierres = true
  ) {
    const prefs = await this.ensurePrefs(
      userId, 
      municipiosSuscritos, 
      departamentosSuscritos,
      avisarmeAprobado,
      avisarmeActualizaciones,
      avisarmeCierres
    );
    
    const tokenRepo = AppDataSource.getRepository(UserPushToken);
    let tok = await tokenRepo.findOne({ where: { token: expoToken } });
    if (tok) {
      tok.active = true;
      tok.userId = userId;
      tok.prefsId = prefs.id;
      tok.prefs = prefs;
      await tokenRepo.save(tok);
    } else {
      tok = tokenRepo.create({
        token: expoToken,
        userId,
        prefsId: prefs.id,
        prefs,
        active: true,
      });
      await tokenRepo.save(tok);
    }
    
    // Actualizar preferencias
    const prefsRepo = AppDataSource.getRepository(UserPushPrefs);
    await prefsRepo.update({ id: prefs.id }, {
      municipiosSuscritos,
      departamentosSuscritos,
      avisarmeAprobado,
      avisarmeActualizaciones,
      avisarmeCierres,
    });
    
    return { prefsId: prefs.id, tokenId: tok.id };
  },

  // Actualizar solo preferencias
  async updatePrefs(
    userId: string, 
    municipios?: string[], 
    departamentos?: string[],
    avisarmeAprobado?: boolean,
    avisarmeActualizaciones?: boolean,
    avisarmeCierres?: boolean
  ) {
    const repo = AppDataSource.getRepository(UserPushPrefs);
    const prefs = await repo.findOne({ where: { userId } });
    if (!prefs) return null;
    
    const patch: Partial<UserPushPrefs> = {};
    if (Array.isArray(municipios)) patch.municipiosSuscritos = municipios;
    if (Array.isArray(departamentos)) patch.departamentosSuscritos = departamentos;
    if (typeof avisarmeAprobado === 'boolean') patch.avisarmeAprobado = avisarmeAprobado;
    if (typeof avisarmeActualizaciones === 'boolean') patch.avisarmeActualizaciones = avisarmeActualizaciones;
    if (typeof avisarmeCierres === 'boolean') patch.avisarmeCierres = avisarmeCierres;
    
    await repo.update({ id: prefs.id }, patch);
    return await repo.findOne({ where: { id: prefs.id } });
  },

  // Desactivar token
  async removeToken(userId: string, expoToken: string) {
    const repo = AppDataSource.getRepository(UserPushToken);
    const tok = await repo.findOne({ where: { token: expoToken, userId } });
    if (!tok) return null;
    tok.active = false;
    await repo.save(tok);
    return { tokenId: tok.id, active: tok.active };
  },

  async getTokensForUserIdsWithPref(
    userIds: string[], 
    prefField: 'avisarmeAprobado' | 'avisarmeActualizaciones' | 'avisarmeCierres'
  ): Promise<string[]> {
    if (!userIds.length) return [];
    
    const columnMap: Record<string, string> = {
      avisarmeAprobado: 'avisarme_aprobado',
      avisarmeActualizaciones: 'avisarme_actualizaciones',
      avisarmeCierres: 'avisarme_cierres'
    };
    
    const columnName = columnMap[prefField];
    
    const rows = await AppDataSource.query(
      `
      SELECT DISTINCT t.token
      FROM user_push_tokens t
      JOIN user_push_prefs p ON p.id = t.prefs_id
      WHERE t.active = TRUE
        AND p.user_id = ANY($1::text[])
        AND p.${columnName} = TRUE
      `,
      [userIds]
    );
    return rows.map((r: any) => r.token);
  },

  // Obtener tokens de usuarios específicos (sin filtro de preferencias)
  async getTokensForUserIds(userIds: string[]): Promise<string[]> {
    if (!userIds.length) return [];
    const rows = await AppDataSource.query(
      `
      SELECT DISTINCT t.token
      FROM user_push_tokens t
      JOIN user_push_prefs p ON p.id = t.prefs_id
      WHERE t.active = TRUE
        AND p.user_id = ANY($1::text[])
      `,
      [userIds]
    );
    return rows.map((r: any) => r.token);
  },

  // Obtener tokens por región (municipio o departamento)
  async getTokensByRegion(regionCode: string): Promise<string[]> {
    const rows = await AppDataSource.query(
      `
      SELECT DISTINCT t.token
      FROM user_push_tokens t
      JOIN user_push_prefs p ON p.id = t.prefs_id
      WHERE t.active = TRUE
        AND (
          p.municipios_suscritos @> ARRAY[$1]::text[]
          OR p.departamentos_suscritos @> ARRAY[$1]::text[]
        )
      `,
      [regionCode]
    );
    return rows.map((r: any) => r.token);
  },

  // Obtener tokens solo por municipio
  async getTokensByMunicipio(municipioCode: string): Promise<string[]> {
    const rows = await AppDataSource.query(
      `
      SELECT DISTINCT t.token
      FROM user_push_tokens t
      JOIN user_push_prefs p ON p.id = t.prefs_id
      WHERE t.active = TRUE
        AND p.municipios_suscritos @> ARRAY[$1]::text[]
      `,
      [municipioCode]
    );
    return rows.map((r: any) => r.token);
  },

  // Obtener tokens solo por departamento
  async getTokensByDepartamento(departamentoCode: string): Promise<string[]> {
    const rows = await AppDataSource.query(
      `
      SELECT DISTINCT t.token
      FROM user_push_tokens t
      JOIN user_push_prefs p ON p.id = t.prefs_id
      WHERE t.active = TRUE
        AND p.departamentos_suscritos @> ARRAY[$1]::text[]
      `,
      [departamentoCode]
    );
    return rows.map((r: any) => r.token);
  },
};