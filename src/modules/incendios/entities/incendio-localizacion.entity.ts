import { Entity, PrimaryColumn, Column, OneToOne, JoinColumn } from 'typeorm'
import { Incendio } from './incendio.entity'

@Entity('incendio_localizaciones')
export class IncendioLocalizacion {
  @PrimaryColumn('uuid')
  incendio_uuid!: string

  @OneToOne(() => Incendio, (i) => i.localizacion, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'incendio_uuid' })
  incendio!: Incendio

  @Column({ type: 'float', nullable: true })
  coordenada_x!: number | null

  @Column({ type: 'float', nullable: true })
  coordenada_y!: number | null

  @Column({ type: 'text', nullable: true })
  zona!: string | null

  @Column({ type: 'float', nullable: true })
  altitud!: number | null

  @Column({ type: 'text', nullable: true })
  departamento!: string | null

  @Column({ type: 'text', nullable: true })
  municipio!: string | null

  @Column({ type: 'text', nullable: true })
  region_inab!: string | null

  @Column({ type: 'text', nullable: true })
  subregion_inab!: string | null

  @Column({ type: 'text', nullable: true })
  lugar_poblado!: string | null

  @Column({ type: 'text', nullable: true })
  finca!: string | null
}
