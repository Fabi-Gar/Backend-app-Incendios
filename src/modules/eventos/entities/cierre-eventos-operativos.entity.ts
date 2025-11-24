import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, Index } from 'typeorm'
import { Incendio } from '../../incendios/entities/incendio.entity'
import { Usuario } from '../../seguridad/entities/usuario.entity'

@Entity('cierre_eventos_operativos')
@Index('idx_eventos_operativos_incendio_fecha', ['incendio', 'ocurrio_en'])
export class CierreEventosOperativos {
  @PrimaryGeneratedColumn('uuid', { name: 'evento_operativo_uuid' })
  evento_operativo_uuid!: string

  @ManyToOne(() => Incendio, { nullable: false })
  @JoinColumn({ name: 'incendio_uuid', referencedColumnName: 'incendio_uuid', foreignKeyConstraintName: 'fk_eventos_operativos_incendio_uuid' })
  incendio!: Incendio

  @Column({ type: 'text' })
  tipo_evento!: 'LLEGADA_MEDIO' | 'CONTROLADO' | 'EXTINGUIDO' | 'OTRO'

  @Column({ type: 'text' })
  categoria!: 'TERRESTRE' | 'AEREO' | 'ACUATICO' | 'GENERAL'

  @Column({ type: 'text', nullable: true })
  recurso_id!: string | null

  @Column({ type: 'timestamptz' })
  ocurrio_en!: Date

  @Column({ type: 'text', nullable: true })
  nota!: string | null

  @ManyToOne(() => Usuario, { nullable: true })
  @JoinColumn({ name: 'creado_por', referencedColumnName: 'usuario_uuid', foreignKeyConstraintName: 'fk_eventos_operativos_creado_por' })
  creado_por!: Usuario | null

  @CreateDateColumn({ type: 'timestamptz', name: 'creado_en', default: () => 'now()' })
  creado_en!: Date

  @UpdateDateColumn({ type: 'timestamptz', name: 'actualizado_en', default: () => 'now()' })
  actualizado_en!: Date

  @DeleteDateColumn({ type: 'timestamptz', name: 'eliminado_en', nullable: true })
  eliminado_en!: Date | null
}
