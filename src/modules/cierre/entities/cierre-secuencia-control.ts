import { Entity, PrimaryColumn, OneToOne, JoinColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from 'typeorm'
import { Incendio } from '../../incendios/entities/incendio.entity'

@Entity('cierre_secuencia_control')
export class CierreSecuenciaControl {
  @PrimaryColumn({ type: 'uuid', name: 'incendio_uuid' })
  incendio_uuid!: string

  @OneToOne(() => Incendio, { nullable: false })
  @JoinColumn({ name: 'incendio_uuid', referencedColumnName: 'incendio_uuid', foreignKeyConstraintName: 'fk_cierre_secuencia_incendio_uuid' })
  incendio!: Incendio

  @Column({ type: 'timestamptz', nullable: true })
  llegada_medios_terrestres_at!: Date | null

  @Column({ type: 'timestamptz', nullable: true })
  llegada_medios_aereos_at!: Date | null

  @Column({ type: 'timestamptz', nullable: true })
  controlado_at!: Date | null

  @Column({ type: 'timestamptz', nullable: true })
  extinguido_at!: Date | null

  @CreateDateColumn({ type: 'timestamptz', name: 'creado_en', default: () => 'now()' })
  creado_en!: Date

  @UpdateDateColumn({ type: 'timestamptz', name: 'actualizado_en', default: () => 'now()' })
  actualizado_en!: Date

  @DeleteDateColumn({ type: 'timestamptz', name: 'eliminado_en', nullable: true })
  eliminado_en!: Date | null
}
