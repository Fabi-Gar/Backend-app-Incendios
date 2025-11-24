import { Entity, PrimaryColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from 'typeorm'
import { Incendio } from '../../incendios/entities/incendio.entity'
import { Institucion } from '../../seguridad/entities/institucion.entity'

@Entity('cierre_medios_instituciones')
export class CierreMediosInstituciones {
  @PrimaryColumn({ type: 'uuid', name: 'incendio_uuid' })
  incendio_uuid!: string

  @PrimaryColumn({ type: 'uuid', name: 'institucion_uuid' })
  institucion_uuid!: string

  @ManyToOne(() => Incendio, { nullable: false })
  @JoinColumn({ name: 'incendio_uuid', referencedColumnName: 'incendio_uuid', foreignKeyConstraintName: 'fk_medios_inst_incendio_uuid' })
  incendio!: Incendio

  @ManyToOne(() => Institucion, { nullable: false })
  @JoinColumn({ name: 'institucion_uuid', referencedColumnName: 'institucion_uuid', foreignKeyConstraintName: 'fk_medios_inst_institucion_uuid' })
  institucion!: Institucion

  @CreateDateColumn({ type: 'timestamptz', name: 'creado_en', default: () => 'now()' })
  creado_en!: Date

  @UpdateDateColumn({ type: 'timestamptz', name: 'actualizado_en', default: () => 'now()' })
  actualizado_en!: Date

  @DeleteDateColumn({ type: 'timestamptz', name: 'eliminado_en', nullable: true })
  eliminado_en!: Date | null
}
