import { Entity, PrimaryColumn, ManyToOne, JoinColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from 'typeorm'
import { Incendio } from '../../incendios/entities/incendio.entity'
import { TipoIncendio } from './catalogos/tipo-incendio.entity'

@Entity('cierre_composicion_tipo')
export class CierreComposicionTipo {
  @PrimaryColumn({ type: 'uuid', name: 'incendio_uuid' })
  incendio_uuid!: string

  @PrimaryColumn({ type: 'text', name: 'tipo_incendio_id' })
  tipo_incendio_id!: string

  @ManyToOne(() => Incendio, { nullable: false })
  @JoinColumn({ name: 'incendio_uuid', referencedColumnName: 'incendio_uuid', foreignKeyConstraintName: 'fk_comp_tipo_incendio_uuid' })
  incendio!: Incendio

  @ManyToOne(() => TipoIncendio, { nullable: false })
  @JoinColumn({ name: 'tipo_incendio_id', referencedColumnName: 'tipo_incendio_id', foreignKeyConstraintName: 'fk_comp_tipo_tipo' })
  tipo_incendio!: TipoIncendio

  @Column({ type: 'numeric', default: 0 })
  pct!: string

  @CreateDateColumn({ type: 'timestamptz', name: 'creado_en', default: () => 'now()' })
  creado_en!: Date

  @UpdateDateColumn({ type: 'timestamptz', name: 'actualizado_en', default: () => 'now()' })
  actualizado_en!: Date

  @DeleteDateColumn({ type: 'timestamptz', name: 'eliminado_en', nullable: true })
  eliminado_en!: Date | null
}
