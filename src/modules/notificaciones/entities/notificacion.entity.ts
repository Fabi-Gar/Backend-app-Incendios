// src/modules/notificaciones/entities/notificacion.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('notificaciones')
export class Notificacion {
  @PrimaryGeneratedColumn('uuid')
  notificacion_uuid: string;

  @Column({ type: 'uuid' })
  usuario_uuid: string;

  @Column({ type: 'varchar', length: 255 })
  titulo: string;

  @Column({ type: 'text' })
  mensaje: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  tipo?: string;

  @Column({ type: 'timestamptz', nullable: true })
  leida_en?: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  creado_en: Date;

  @Column({ type: 'jsonb', nullable: true })
  payload?: any;
}