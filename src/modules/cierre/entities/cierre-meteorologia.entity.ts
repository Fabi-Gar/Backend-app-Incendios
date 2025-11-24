import { Entity, PrimaryColumn, OneToOne, JoinColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from 'typeorm'
import { Incendio } from '../../incendios/entities/incendio.entity'

@Entity('cierre_meteorologia')
export class CierreMeteorologia {
  @PrimaryColumn({ type: 'uuid', name: 'incendio_uuid' })
  incendio_uuid!: string

  @OneToOne(() => Incendio, { nullable: false })
  @JoinColumn({ name: 'incendio_uuid', referencedColumnName: 'incendio_uuid', foreignKeyConstraintName: 'fk_cierre_meteo_incendio_uuid' })
  incendio!: Incendio

  @Column({ type: 'numeric', nullable: true })
  temp_c!: string | null

  @Column({ type: 'numeric', nullable: true })
  hr_pct!: string | null

  @Column({ type: 'numeric', nullable: true })
  viento_vel!: string | null

  @Column({ type: 'text', nullable: true })
  viento_dir!: string | null

  @CreateDateColumn({ type: 'timestamptz', name: 'creado_en', default: () => 'now()' })
  creado_en!: Date

  @UpdateDateColumn({ type: 'timestamptz', name: 'actualizado_en', default: () => 'now()' })
  actualizado_en!: Date

  @DeleteDateColumn({ type: 'timestamptz', name: 'eliminado_en', nullable: true })
  eliminado_en!: Date | null
}
