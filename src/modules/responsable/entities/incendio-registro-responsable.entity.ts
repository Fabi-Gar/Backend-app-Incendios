import { Entity, PrimaryColumn, Column, OneToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, ManyToOne } from 'typeorm'
import { Incendio } from '../../incendios/entities/incendio.entity'
import { Institucion } from '../../seguridad/entities/institucion.entity'

@Entity('incendio_registro_responsable')
export class IncendioRegistroResponsable {
  @PrimaryColumn({ type: 'uuid', name: 'incendio_uuid' })
  incendio_uuid!: string

  @OneToOne(() => Incendio, { nullable: false })
  @JoinColumn({ name: 'incendio_uuid', referencedColumnName: 'incendio_uuid', foreignKeyConstraintName: 'fk_resp_incendio_uuid' })
  incendio!: Incendio

  @Column({ type: 'text' })
  nombre!: string

  @ManyToOne(() => Institucion, { nullable: true })
  @JoinColumn({ name: 'institucion_uuid', referencedColumnName: 'institucion_uuid', foreignKeyConstraintName: 'fk_resp_institucion_uuid' })
  institucion!: Institucion | null

  @Column({ type: 'text', nullable: true })
  cargo!: string | null

  @Column({ type: 'text', nullable: true })
  telefono!: string | null

  @Column({ type: 'text', nullable: true })
  correo!: string | null

  @Column({ type: 'text', nullable: true })
  observaciones!: string | null

  @CreateDateColumn({ type: 'timestamptz', name: 'creado_en', default: () => 'now()' })
  creado_en!: Date

  @UpdateDateColumn({ type: 'timestamptz', name: 'actualizado_en', default: () => 'now()' })
  actualizado_en!: Date

  @DeleteDateColumn({ type: 'timestamptz', name: 'eliminado_en', nullable: true })
  eliminado_en!: Date | null
}
