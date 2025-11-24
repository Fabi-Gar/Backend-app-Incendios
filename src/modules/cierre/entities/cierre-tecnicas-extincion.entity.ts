import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from 'typeorm'
import { Incendio } from '../../incendios/entities/incendio.entity'

@Entity('cierre_tecnicas_extincion')
export class CierreTecnicasExtincion {
  @PrimaryColumn({ type: 'uuid', name: 'incendio_uuid' })
  incendio_uuid!: string

  @PrimaryColumn({ type: 'text', name: 'tecnica' })
  tecnica!: 'directo' | 'indirecto' | 'control_natural'

  @ManyToOne(() => Incendio, { nullable: false })
  @JoinColumn({ name: 'incendio_uuid', referencedColumnName: 'incendio_uuid', foreignKeyConstraintName: 'fk_tecnicas_incendio_uuid' })
  incendio!: Incendio

  @Column({ type: 'numeric', default: 0 })
  pct!: string

  @CreateDateColumn({ type: 'timestamptz', name: 'creado_en', default: () => 'now()' })
  creado_en!: Date

  @UpdateDateColumn({ type: 'timestamptz', name: 'actualizado_en', default: () => 'now()' })
  actualizado_en!: Date

  @DeleteDateColumn({ type: 'timestamptz', name: 'eliminado_en', nullable: true })
  eliminado_en!: Date | null
}
