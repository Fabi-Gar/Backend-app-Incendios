import { Entity, PrimaryColumn, Column, OneToOne, JoinColumn } from 'typeorm'
import { Incendio } from './incendio.entity'

@Entity('incendio_vegetaciones')
export class IncendioVegetacion {
  @PrimaryColumn('uuid')
  incendio_uuid!: string

  @OneToOne(() => Incendio, (i) => i.vegetacion, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'incendio_uuid' })
  incendio!: Incendio

  @Column({ type: 'float', nullable: true })
  area_total_ha!: number | null

  @Column({ type: 'float', nullable: true })
  dentro_ap_ha!: number | null

  @Column({ type: 'float', nullable: true })
  fuera_ap_ha!: number | null

  @Column({ type: 'text', nullable: true })
  tipo_areas_quemadas!: string | null

  // Detalle de hectáreas
  @Column({ type: 'float', nullable: true })
  bosque_conifera_dentro_ha!: number | null
  @Column({ type: 'float', nullable: true })
  bosque_conifera_fuera_ha!: number | null

  @Column({ type: 'float', nullable: true })
  bosque_latifoliado_dentro_ha!: number | null
  @Column({ type: 'float', nullable: true })
  bosque_latifoliado_fuera_ha!: number | null

  @Column({ type: 'float', nullable: true })
  bosque_mixto_dentro_ha!: number | null
  @Column({ type: 'float', nullable: true })
  bosque_mixto_fuera_ha!: number | null

  @Column({ type: 'float', nullable: true })
  bosque_manglar_dentro_ha!: number | null
  @Column({ type: 'float', nullable: true })
  bosque_manglar_fuera_ha!: number | null

  @Column({ type: 'float', nullable: true })
  plantacion_conifera_dentro_ha!: number | null
  @Column({ type: 'float', nullable: true })
  plantacion_conifera_fuera_ha!: number | null

  @Column({ type: 'float', nullable: true })
  plantacion_latifoliado_dentro_ha!: number | null
  @Column({ type: 'float', nullable: true })
  plantacion_latifoliado_fuera_ha!: number | null

  @Column({ type: 'float', nullable: true })
  plantacion_mixto_dentro_ha!: number | null
  @Column({ type: 'float', nullable: true })
  plantacion_mixto_fuera_ha!: number | null

  @Column({ type: 'float', nullable: true })
  pastizal_dentro_ha!: number | null
  @Column({ type: 'float', nullable: true })
  pastizal_fuera_ha!: number | null

  @Column({ type: 'float', nullable: true })
  humedal_dentro_ha!: number | null
  @Column({ type: 'float', nullable: true })
  humedal_fuera_ha!: number | null

  @Column({ type: 'float', nullable: true })
  pajonal_dentro_ha!: number | null
  @Column({ type: 'float', nullable: true })
  pajonal_fuera_ha!: number | null

  @Column({ type: 'float', nullable: true })
  sabana_dentro_ha!: number | null
  @Column({ type: 'float', nullable: true })
  sabana_fuera_ha!: number | null

  @Column({ type: 'float', nullable: true })
  guamil_dentro_ha!: number | null
  @Column({ type: 'float', nullable: true })
  guamil_fuera_ha!: number | null
}
