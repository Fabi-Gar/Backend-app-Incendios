import { Entity, PrimaryColumn, Column, OneToOne, JoinColumn } from 'typeorm'
import { Incendio } from './incendio.entity'

@Entity('incendio_controles')
export class IncendioControl {
  @PrimaryColumn('uuid')
  incendio_uuid!: string

  @OneToOne(() => Incendio, (i) => i.control, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'incendio_uuid' })
  incendio!: Incendio

  @Column({ type: 'boolean', nullable: true })
  es_forestal!: boolean | null

  @Column({ type: 'timestamptz', nullable: true })
  llegada_terrestres_at!: Date | null

  @Column({ type: 'timestamptz', nullable: true })
  llegada_aereos_at!: Date | null

  @Column({ type: 'timestamptz', nullable: true })
  controlado_at!: Date | null

  @Column({ type: 'timestamptz', nullable: true })
  extinguido_at!: Date | null

  @Column({ type: 'float', nullable: true })
  topografia_plano_pct!: number | null

  @Column({ type: 'float', nullable: true })
  topografia_ondulado_pct!: number | null

  @Column({ type: 'float', nullable: true })
  topografia_quebrado_pct!: number | null

  @Column({ type: 'text', nullable: true })
  tipo_propiedad!: string | null

  @Column({ type: 'text', nullable: true })
  iniciado_junto_a!: string | null

  @Column({ type: 'float', nullable: true })
  tipo_rastrero_pct!: number | null

  @Column({ type: 'float', nullable: true })
  tipo_copas_pct!: number | null

  @Column({ type: 'float', nullable: true })
  tipo_subterraneo_pct!: number | null

  @Column({ type: 'float', nullable: true })
  tecnica_directo_pct!: number | null

  @Column({ type: 'float', nullable: true })
  tecnica_indirecto_pct!: number | null

  @Column({ type: 'float', nullable: true })
  tecnica_natural_pct!: number | null

  @Column({ type: 'text', nullable: true })
  causa_incendio!: string | null

  @Column({ type: 'text', nullable: true })
  causa_otra!: string | null
}
