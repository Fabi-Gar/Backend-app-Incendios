import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm'
import { Incendio } from './incendio.entity'
import { EstadoIncendio } from '../../catalogos/entities/estado-incendio.entity'
import { Usuario } from '../../seguridad/entities/usuario.entity'

@Index('idx_historial_incendio_fecha', ['incendio', 'creado_en'])
@Entity('incendio_estado_historial')
export class IncendioEstadoHistorial {
  @PrimaryGeneratedColumn('uuid', { name: 'historial_uuid' })
  historial_uuid!: string

  @ManyToOne(() => Incendio, { nullable: false })
  @JoinColumn({ name: 'incendio_uuid', referencedColumnName: 'incendio_uuid', foreignKeyConstraintName: 'fk_historial_incendio_uuid' })
  incendio!: Incendio

  @ManyToOne(() => EstadoIncendio, { nullable: false })
  @JoinColumn({ name: 'estado_incendio_uuid', referencedColumnName: 'estado_incendio_uuid', foreignKeyConstraintName: 'fk_historial_estado_uuid' })
  estado_incendio!: EstadoIncendio

  @ManyToOne(() => Usuario, { nullable: true })
  @JoinColumn({ name: 'cambiado_por', referencedColumnName: 'usuario_uuid', foreignKeyConstraintName: 'fk_historial_cambiado_por' })
  cambiado_por!: Usuario | null

  @Column({ type: 'text', nullable: true })
  observacion!: string | null

  @CreateDateColumn({ type: 'timestamptz', name: 'creado_en', default: () => 'now()' })
  creado_en!: Date

  @UpdateDateColumn({ type: 'timestamptz', name: 'actualizado_en', default: () => 'now()' })
  actualizado_en!: Date

  @DeleteDateColumn({ type: 'timestamptz', name: 'eliminado_en', nullable: true })
  eliminado_en!: Date | null
}
