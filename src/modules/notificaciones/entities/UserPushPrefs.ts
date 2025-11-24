// src/modules/notificaciones/entities/UserPushPrefs.ts
import {
  Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn, OneToMany, Unique
} from 'typeorm';
import { UserPushToken } from './UserPushToken';

@Entity({ name: 'user_push_prefs' })
@Unique(['userId'])
export class UserPushPrefs {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_user_push_prefs_user_id')
  @Column({ name: 'user_id', type: 'varchar', length: 64 })
  userId!: string;

  // Municipios suscritos (códigos de municipio)
  @Column('text', { name: 'municipios_suscritos', array: true, default: '{}' })
  municipiosSuscritos!: string[];

  // Departamentos suscritos (códigos de departamento) - OPCIONAL
  @Column('text', { name: 'departamentos_suscritos', array: true, default: '{}' })
  departamentosSuscritos!: string[];

  // Avisar cuando aprueben mis reportes
  @Column({ name: 'avisarme_aprobado', type: 'boolean', default: true })
  avisarmeAprobado!: boolean;

  // Avisar cuando actualicen incendios que sigo
  @Column({ name: 'avisarme_actualizaciones', type: 'boolean', default: true })
  avisarmeActualizaciones!: boolean;

  // Avisar cuando cierren incendios que sigo
  @Column({ name: 'avisarme_cierres', type: 'boolean', default: true })
  avisarmeCierres!: boolean;

  // Extra data (para futuras features)
  @Column({ name: 'extra', type: 'jsonb', nullable: true })
  extra?: Record<string, any> | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @OneToMany(() => UserPushToken, (t) => t.prefs, { cascade: true })
  tokens!: UserPushToken[];
}