import { Entity, PrimaryColumn, ManyToOne, JoinColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from 'typeorm'
import { Incendio } from '../../incendios/entities/incendio.entity'
import { MediosAereosCatalogo } from './catalogos/medios-aereos-catalogo.entity'

@Entity('cierre_medios_aereos')
export class CierreMediosAereos {
  @PrimaryColumn({ type: 'uuid', name: 'incendio_uuid' })
  incendio_uuid!: string

  @PrimaryColumn({ type: 'text', name: 'medio_aereo_id' })
  medio_aereo_id!: string

  @ManyToOne(() => Incendio, { nullable: false })
  @JoinColumn({ name: 'incendio_uuid', referencedColumnName: 'incendio_uuid', foreignKeyConstraintName: 'fk_medios_aereos_incendio_uuid' })
  incendio!: Incendio

  @ManyToOne(() => MediosAereosCatalogo, { nullable: false })
  @JoinColumn({ name: 'medio_aereo_id', referencedColumnName: 'medio_aereo_id', foreignKeyConstraintName: 'fk_medios_aereos_catalogo' })
  medio!: MediosAereosCatalogo

  @Column({ type: 'numeric', default: 0 })
  pct!: string

  @CreateDateColumn({ type: 'timestamptz', name: 'creado_en', default: () => 'now()' })
  creado_en!: Date

  @UpdateDateColumn({ type: 'timestamptz', name: 'actualizado_en', default: () => 'now()' })
  actualizado_en!: Date

  @DeleteDateColumn({ type: 'timestamptz', name: 'eliminado_en', nullable: true })
  eliminado_en!: Date | null
}
