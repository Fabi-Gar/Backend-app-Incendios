import { Entity, PrimaryColumn, Column, OneToOne, JoinColumn } from 'typeorm'
import { Incendio } from './incendio.entity'

@Entity('incendio_medios')
export class IncendioMedios {
  @PrimaryColumn('uuid')
  incendio_uuid!: string

  @OneToOne(() => Incendio, (i) => i.medios, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'incendio_uuid' })
  incendio!: Incendio

  // Instituciones (numérico - cantidad de personal)
  @Column({ type: 'int', nullable: true })
  inst_inab!: number | null

  @Column({ type: 'int', nullable: true })
  inst_conred!: number | null

  @Column({ type: 'int', nullable: true })
  inst_conap!: number | null

  @Column({ type: 'int', nullable: true })
  inst_mindef!: number | null

  @Column({ type: 'int', nullable: true })
  inst_municipalidades!: number | null

  @Column({ type: 'int', nullable: true })
  inst_comunitarios!: number | null

  @Column({ type: 'int', nullable: true })
  inst_mingob!: number | null

  @Column({ type: 'int', nullable: true })
  inst_cuerpos_socorro!: number | null

  @Column({ type: 'int', nullable: true })
  inst_marn!: number | null

  @Column({ type: 'int', nullable: true })
  inst_maga!: number | null

  @Column({ type: 'int', nullable: true })
  inst_civ!: number | null

  @Column({ type: 'int', nullable: true })
  inst_asociaciones!: number | null

  @Column({ type: 'int', nullable: true })
  inst_ongs!: number | null

  @Column({ type: 'text', nullable: true })
  inst_otras!: string | null

  // Aéreos
  @Column({ type: 'int', nullable: true })
  aereo_avion_sobrevuelo!: number | null

  @Column({ type: 'int', nullable: true })
  aereo_avion_cisterna!: number | null

  @Column({ type: 'int', nullable: true })
  aereo_helibalde!: number | null

  @Column({ type: 'int', nullable: true })
  aereo_monitoreo!: number | null

  // Terrestres
  @Column({ type: 'int', nullable: true })
  terrestre_pickups!: number | null

  @Column({ type: 'int', nullable: true })
  terrestre_camiones!: number | null

  @Column({ type: 'int', nullable: true })
  terrestre_ambulancia!: number | null

  @Column({ type: 'int', nullable: true })
  terrestre_microbuses!: number | null

  @Column({ type: 'int', nullable: true })
  terrestre_motobombas!: number | null

  @Column({ type: 'int', nullable: true })
  terrestre_cisternas!: number | null

  @Column({ type: 'int', nullable: true })
  terrestre_motocicletas!: number | null

  @Column({ type: 'int', nullable: true })
  terrestre_rescate!: number | null

  // Acuáticos
  @Column({ type: 'int', nullable: true })
  acuatico_lanchas!: number | null

  @Column({ type: 'int', nullable: true })
  acuatico_otro!: number | null

  // Abastos
  @Column({ type: 'int', nullable: true })
  abasto_raciones_frias!: number | null

  @Column({ type: 'int', nullable: true })
  abasto_incaparina!: number | null

  @Column({ type: 'int', nullable: true })
  abasto_agua!: number | null

  @Column({ type: 'int', nullable: true })
  abasto_raciones_calientes!: number | null
}
