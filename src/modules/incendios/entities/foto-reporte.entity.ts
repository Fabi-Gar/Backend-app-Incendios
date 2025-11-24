import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm'
import { Incendio } from './incendio.entity'

@Index('idx_fotos_reporte_incendio', ['incendio'])
@Entity('fotos_reporte')
export class FotoReporte {
  @PrimaryGeneratedColumn('uuid', { name: 'foto_reporte_uuid' })
  foto_reporte_uuid!: string

  @ManyToOne(() => Incendio, { nullable: false })
  @JoinColumn({ name: 'incendio_uuid', referencedColumnName: 'incendio_uuid', foreignKeyConstraintName: 'fk_fotos_reporte_incendio_uuid' })
  incendio!: Incendio

  @Column({ type: 'text' })
  url!: string

  @Column({ type: 'text', nullable: true })
  credito!: string | null

  @CreateDateColumn({ type: 'timestamptz', name: 'creado_en', default: () => 'now()' })
  creado_en!: Date

  @UpdateDateColumn({ type: 'timestamptz', name: 'actualizado_en', default: () => 'now()' })
  actualizado_en!: Date

  @DeleteDateColumn({ type: 'timestamptz', name: 'eliminado_en', nullable: true })
  eliminado_en!: Date | null
}
