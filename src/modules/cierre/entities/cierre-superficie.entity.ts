import { Entity, PrimaryColumn, OneToOne, JoinColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from 'typeorm'
import { Incendio } from '../../incendios/entities/incendio.entity'

@Entity('cierre_superficie')
export class CierreSuperficie {
  @PrimaryColumn({ type: 'uuid', name: 'incendio_uuid' })
  incendio_uuid!: string

  @OneToOne(() => Incendio, { nullable: false })
  @JoinColumn({ name: 'incendio_uuid', referencedColumnName: 'incendio_uuid', foreignKeyConstraintName: 'fk_cierre_superficie_incendio_uuid' })
  incendio!: Incendio

  @Column({ type: 'numeric', default: 0 })
  area_total_ha!: string

  @Column({ type: 'numeric', default: 0 })
  dentro_ap_ha!: string

  @Column({ type: 'numeric', default: 0 })
  fuera_ap_ha!: string

  @Column({ type: 'text', nullable: true })
  nombre_ap!: string | null

  @CreateDateColumn({ type: 'timestamptz', name: 'creado_en', default: () => 'now()' })
  creado_en!: Date

  @UpdateDateColumn({ type: 'timestamptz', name: 'actualizado_en', default: () => 'now()' })
  actualizado_en!: Date

  @DeleteDateColumn({ type: 'timestamptz', name: 'eliminado_en', nullable: true })
  eliminado_en!: Date | null
}
