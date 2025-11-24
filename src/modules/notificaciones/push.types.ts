// src/types/push.types.ts

// Tipos de eventos de cierre
export type CierreUpdateType =
  | 'cierre_iniciado'
  | 'cierre_actualizado'
  | 'cierre_finalizado'
  | 'cierre_reabierto';

// Tipos de notificaciones de incendios
export type IncendioNotificationType =
  | 'incendio_aprobado'
  | 'incendio_actualizado'
  | 'incendio_cerrado'
  | 'incendio_nuevo_municipio'
  | 'incendio_nuevo_departamento';

// Tipos de notificaciones del sistema
export type SystemNotificationType =
  | 'job_failed'
  | 'job_stale'
  | 'job_no_data';

// Tipo general de notificación
export type NotificationType = 
  | CierreUpdateType 
  | IncendioNotificationType 
  | SystemNotificationType
  | 'test';

// Datos que acompañan a una notificación push
export interface PushNotificationData {
  type?: NotificationType; // ← Opcional para flexibilidad
  incendio_id?: string;
  deeplink?: string;
  timestamp?: string;
  municipio?: string;
  departamento?: string;
  region?: string;
  cambios?: string | string[];
  test?: string;
  user_id?: string;
  [key: string]: any; // Permite campos adicionales
}

// Payload completo de notificación push
export interface PushPayload {
  title: string;
  body: string;
  data?: PushNotificationData;
  sound?: 'default' | null;
  badge?: number;
  channelId?: string;
  priority?: 'default' | 'normal' | 'high';
  ttl?: number;
}

// Preferencias de notificaciones del usuario
export interface UserPushPreferences {
  userId: string;
  municipiosSuscritos: string[];
  departamentosSuscritos: string[];
  avisarmeAprobado: boolean;
  avisarmeActualizaciones: boolean;
  avisarmeCierres: boolean;
}

// Request para registrar token
export interface RegisterTokenRequest {
  userId: string;
  expoPushToken: string;
  municipiosSuscritos?: string[];
  departamentosSuscritos?: string[];
  avisarmeAprobado?: boolean;
  avisarmeActualizaciones?: boolean;
  avisarmeCierres?: boolean;
}

// Request para actualizar preferencias
export interface UpdatePreferencesRequest {
  userId: string;
  municipiosSuscritos?: string[];
  departamentosSuscritos?: string[];
  avisarmeAprobado?: boolean;
  avisarmeActualizaciones?: boolean;
  avisarmeCierres?: boolean;
}

// Request para desregistrar token
export interface UnregisterTokenRequest {
  userId: string;
  expoPushToken: string;
}

// Response genérico de éxito
export interface PushServiceResponse {
  ok: boolean;
  data?: any;
  error?: string;
  message?: string;
}