import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, ManyToOne, JoinColumn, Index, OneToOne, OneToMany } from 'typeorm'
import { Usuario } from '../../seguridad/entities/usuario.entity'
import { EstadoIncendio } from '../../catalogos/entities/estado-incendio.entity'
import { InfoFalsaIncendio } from '../../responsable/entities/info-falsa-incendio.entity'
import { IncendioLocalizacion } from './incendio-localizacion.entity'
import { IncendioControl } from './incendio-control.entity'
import { IncendioVegetacion } from './incendio-vegetacion.entity'
import { IncendioMedios } from './incendio-medios.entity'
import { IncendioMeteorologia } from './incendio-meteorologia.entity'
import { IncendioResponsable } from './incendio-responsable.entity'
import { IncendioSeguidor } from './incendio-seguidor.entity'

@Index('idx_incendios_estado_aprobado', ['estado_incendio', 'aprobado'])
@Entity('incendios')
export class Incendio {
  @PrimaryGeneratedColumn('uuid', { name: 'incendio_uuid' })
  incendio_uuid!: string

  @OneToMany(() => IncendioSeguidor, (seguidor) => seguidor.incendio)
  seguidores!: IncendioSeguidor[]

  @ManyToOne(() => Usuario, { nullable: false })
  @JoinColumn({ name: 'creado_por_uuid', referencedColumnName: 'usuario_uuid', foreignKeyConstraintName: 'fk_incendios_creado_por_uuid' })
  creado_por!: Usuario

  @Column({ type: 'boolean', default: true })
  requiere_aprobacion!: boolean

  @Column({ type: 'boolean', default: false })
  aprobado!: boolean

  @ManyToOne(() => Usuario, { nullable: true })
  @JoinColumn({ name: 'aprobado_por', referencedColumnName: 'usuario_uuid', foreignKeyConstraintName: 'fk_incendios_aprobado_por' })
  aprobado_por!: Usuario | null

  @Column({ type: 'timestamptz', nullable: true })
  aprobado_en!: Date | null

  @ManyToOne(() => Usuario, { nullable: true })
  @JoinColumn({ name: 'rechazado_por', referencedColumnName: 'usuario_uuid', foreignKeyConstraintName: 'fk_incendios_rechazado_por' })
  rechazado_por!: Usuario | null

  @Column({ type: 'timestamptz', nullable: true })
  rechazado_en!: Date | null

  @Column({ type: 'text', nullable: true })
  motivo_rechazo!: string | null

  @Column({ type: 'text', nullable: true })
  titulo!: string | null

  @Column({ type: 'text', nullable: true })
  descripcion!: string | null

  @Column({ type: 'geometry', spatialFeatureType: 'Point', srid: 4326, nullable: true })
  centroide!: unknown | null

  @ManyToOne(() => EstadoIncendio, { nullable: false })
  @JoinColumn({ name: 'estado_incendio_uuid', referencedColumnName: 'estado_incendio_uuid', foreignKeyConstraintName: 'fk_incendios_estado' })
  estado_incendio!: EstadoIncendio

  @OneToOne(() => InfoFalsaIncendio, (f) => f.incendio)
  info_falsa?: InfoFalsaIncendio | null

  @OneToOne(() => IncendioLocalizacion, (l) => l.incendio, { cascade: true })
  localizacion?: IncendioLocalizacion | null

  @OneToOne(() => IncendioControl, (c) => c.incendio, { cascade: true })
  control?: IncendioControl | null

  @OneToOne(() => IncendioVegetacion, (v) => v.incendio, { cascade: true })
  vegetacion?: IncendioVegetacion | null

  @OneToOne(() => IncendioMedios, (m) => m.incendio, { cascade: true })
  medios?: IncendioMedios | null

  @OneToOne(() => IncendioMeteorologia, (m) => m.incendio, { cascade: true })
  meteorologia?: IncendioMeteorologia | null

  @OneToOne(() => IncendioResponsable, (r) => r.incendio, { cascade: true })
  responsable?: IncendioResponsable | null

  // ========================== DATOS INAB (Identificadores) ==========================
  @Column({ type: 'int', nullable: true, unique: true })
  inab_objectid!: number | null

  @Column({ type: 'text', nullable: true })
  inab_globalid!: string | null
  // ==============================================================================

  @CreateDateColumn({ type: 'timestamptz', name: 'creado_en', default: () => 'now()' })
  creado_en!: Date

  @UpdateDateColumn({ type: 'timestamptz', name: 'actualizado_en', default: () => 'now()' })
  actualizado_en!: Date

  @DeleteDateColumn({ type: 'timestamptz', name: 'eliminado_en', nullable: true })
  eliminado_en!: Date | null
}
