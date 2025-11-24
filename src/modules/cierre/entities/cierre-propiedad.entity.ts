import { Entity, PrimaryColumn, ManyToOne, JoinColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from 'typeorm'
import { Incendio } from '../../incendios/entities/incendio.entity'
import { TipoPropiedad } from './catalogos/tipo-propiedad.entity'

@Entity('cierre_propiedad')
export class CierrePropiedad {
  @PrimaryColumn({ type: 'uuid', name: 'incendio_uuid' })
  incendio_uuid!: string

  @PrimaryColumn({ type: 'text', name: 'tipo_propiedad_id' })
  tipo_propiedad_id!: string

  @ManyToOne(() => Incendio, { nullable: false })
  @JoinColumn({ name: 'incendio_uuid', referencedColumnName: 'incendio_uuid', foreignKeyConstraintName: 'fk_cierre_propiedad_incendio_uuid' })
  incendio!: Incendio

  @ManyToOne(() => TipoPropiedad, { nullable: false })
  @JoinColumn({ name: 'tipo_propiedad_id', referencedColumnName: 'tipo_propiedad_id', foreignKeyConstraintName: 'fk_cierre_propiedad_tipo' })
  tipo_propiedad!: TipoPropiedad

  @Column({ type: 'boolean', default: false })
  usado!: boolean

  @CreateDateColumn({ type: 'timestamptz', name: 'creado_en', default: () => 'now()' })
  creado_en!: Date

  @UpdateDateColumn({ type: 'timestamptz', name: 'actualizado_en', default: () => 'now()' })
  actualizado_en!: Date

  @DeleteDateColumn({ type: 'timestamptz', name: 'eliminado_en', nullable: true })
  eliminado_en!: Date | null
}
