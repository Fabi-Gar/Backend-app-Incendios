import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm'
import { Incendio } from '../../incendios/entities/incendio.entity'

@Entity('zonas_afectadas')
@Index('idx_zonas_afectadas_incendio_fecha', ['incendio', 'fecha'])
export class ZonaAfectada {
  @PrimaryGeneratedColumn('uuid', { name: 'zona_afectada_uuid' })
  zona_afectada_uuid!: string

  @ManyToOne(() => Incendio, { nullable: false })
  @JoinColumn({ name: 'incendio_uuid', referencedColumnName: 'incendio_uuid', foreignKeyConstraintName: 'fk_zonas_afectadas_incendio_uuid' })
  incendio!: Incendio

  @Column({ type: 'geometry', spatialFeatureType: 'MultiPolygon', srid: 4326 })
  geom!: unknown

  @Column({ type: 'date' })
  fecha!: string

  @Column({ type: 'text', nullable: true })
  fuente!: string | null

  @Column({ type: 'text', nullable: true })
  metodo!: string | null

  @Column({ type: 'numeric', nullable: true })
  area_ha!: string | null // se calculará por trigger

  @CreateDateColumn({ type: 'timestamptz', name: 'creado_en', default: () => 'now()' })
  creado_en!: Date

  @UpdateDateColumn({ type: 'timestamptz', name: 'actualizado_en', default: () => 'now()' })
  actualizado_en!: Date

  @DeleteDateColumn({ type: 'timestamptz', name: 'eliminado_en', nullable: true })
  eliminado_en!: Date | null
}
