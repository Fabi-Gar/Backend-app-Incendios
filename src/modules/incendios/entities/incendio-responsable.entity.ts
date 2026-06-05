import { Entity, PrimaryColumn, Column, OneToOne, JoinColumn } from 'typeorm'
import { Incendio } from './incendio.entity'

@Entity('incendio_responsables')
export class IncendioResponsable {
  @PrimaryColumn('uuid')
  incendio_uuid!: string

  @OneToOne(() => Incendio, (i) => i.responsable, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'incendio_uuid' })
  incendio!: Incendio

  // Datos del reporte inicial
  @Column({ type: 'text', nullable: true })
  reportado_por!: string | null

  @Column({ type: 'text', nullable: true })
  institucion!: string | null

  @Column({ type: 'text', nullable: true })
  otra_institucion!: string | null

  @Column({ type: 'text', nullable: true })
  telefono!: string | null

  @Column({ type: 'timestamptz', nullable: true })
  fecha_hora_aviso!: Date | null

  @Column({ type: 'text', nullable: true })
  medio_aviso!: string | null

  // Responsable de la Información (al final del reporte)
  @Column({ type: 'text', nullable: true })
  resp_nombre!: string | null

  @Column({ type: 'text', nullable: true })
  resp_dependencia!: string | null

  @Column({ type: 'text', nullable: true })
  resp_otra_dependencia!: string | null

  @Column({ type: 'text', nullable: true })
  resp_cargo!: string | null

  @Column({ type: 'text', nullable: true })
  resp_telefono!: string | null

  @Column({ type: 'text', nullable: true })
  resp_correo!: string | null

  @Column({ type: 'text', nullable: true })
  observaciones!: string | null
}
