import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm'

@Entity('auditoria_eventos')
export class AuditoriaEventos {
  @PrimaryGeneratedColumn('uuid', { name: 'auditoria_uuid' })
  auditoria_uuid!: string

  @Column({ type: 'text' })
  tabla!: string

  @Column({ type: 'text' })
  registro_id!: string

  @Column({ type: 'text' })
  accion!: 'INSERT' | 'UPDATE' | 'DELETE' | 'RESTORE'

  @Column({ type: 'jsonb', nullable: true })
  antes!: any | null

  @Column({ type: 'jsonb', nullable: true })
  despues!: any | null

  @Column({ type: 'uuid', nullable: true })
  usuario_uuid!: string | null

  @Column({ type: 'text', nullable: true })
  ip!: string | null

  @Column({ type: 'text', nullable: true })
  user_agent!: string | null

  @Column({ type: 'timestamptz', name: 'creado_en', default: () => 'now()' })
  creado_en!: Date
}
