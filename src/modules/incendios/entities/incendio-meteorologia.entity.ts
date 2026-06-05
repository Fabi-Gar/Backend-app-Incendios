import { Entity, PrimaryColumn, Column, OneToOne, JoinColumn } from 'typeorm'
import { Incendio } from './incendio.entity'

@Entity('incendio_meteorologia')
export class IncendioMeteorologia {
  @PrimaryColumn('uuid')
  incendio_uuid!: string

  @OneToOne(() => Incendio, (i) => i.meteorologia, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'incendio_uuid' })
  incendio!: Incendio

  @Column({ type: 'float', nullable: true })
  temperatura!: number | null

  @Column({ type: 'float', nullable: true })
  humedad_relativa!: number | null

  @Column({ type: 'float', nullable: true })
  velocidad_viento!: number | null

  @Column({ type: 'text', nullable: true })
  direccion_viento!: string | null
}
