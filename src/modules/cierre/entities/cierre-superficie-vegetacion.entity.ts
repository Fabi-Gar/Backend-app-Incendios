import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, Index } from 'typeorm'
import { Incendio } from '../../incendios/entities/incendio.entity'

@Entity('cierre_superficie_vegetacion')
@Index('idx_superficie_veg_incendio_categoria', ['incendio', 'categoria'])
export class CierreSuperficieVegetacion {
  @PrimaryGeneratedColumn('uuid', { name: 'superficie_vegetacion_uuid' })
  superficie_vegetacion_uuid!: string

  @ManyToOne(() => Incendio, { nullable: false })
  @JoinColumn({ name: 'incendio_uuid', referencedColumnName: 'incendio_uuid', foreignKeyConstraintName: 'fk_superficie_veg_incendio_uuid' })
  incendio!: Incendio

  @Column({ type: 'text' })
  ubicacion!: 'DENTRO_AP' | 'FUERA_AP'

  @Column({ type: 'text' })
  categoria!: 'bosque_natural' | 'plantacion_forestal' | 'otra_vegetacion'

  @Column({ type: 'text', nullable: true })
  subtipo!: string | null

  @Column({ type: 'numeric', default: 0 })
  area_ha!: string

  @CreateDateColumn({ type: 'timestamptz', name: 'creado_en', default: () => 'now()' })
  creado_en!: Date

  @UpdateDateColumn({ type: 'timestamptz', name: 'actualizado_en', default: () => 'now()' })
  actualizado_en!: Date

  @DeleteDateColumn({ type: 'timestamptz', name: 'eliminado_en', nullable: true })
  eliminado_en!: Date | null
}
