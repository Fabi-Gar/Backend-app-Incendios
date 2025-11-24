import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, ManyToOne, JoinColumn, Index, OneToOne } from 'typeorm'
import { Usuario } from '../../seguridad/entities/usuario.entity'
import { EstadoIncendio } from '../../catalogos/entities/estado-incendio.entity'
import { InfoFalsaIncendio } from '../../responsable/entities/info-falsa-incendio.entity'
import { Institucion } from '../../seguridad/entities/institucion.entity'
import { Medio } from '../../catalogos/entities/medio.entity'
import { Departamento } from '../../catalogos/entities/departamento.entity'
import { Municipio } from '../../catalogos/entities/municipio.entity'

@Index('idx_incendios_estado_aprobado', ['estado_incendio', 'aprobado'])
@Index('idx_incendios_reportado_en', ['reportado_en'])
@Index('idx_incendios_departamento', ['departamento'])
@Index('idx_incendios_municipio', ['municipio'])
@Entity('incendios')
export class Incendio {
  @PrimaryGeneratedColumn('uuid', { name: 'incendio_uuid' })
  incendio_uuid!: string

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

  // ========== Campos del reporte inicial (migrados de tabla reportes) ==========

  @ManyToOne(() => Usuario, { nullable: true })
  @JoinColumn({ name: 'reportado_por_uuid', referencedColumnName: 'usuario_uuid', foreignKeyConstraintName: 'fk_incendios_reportado_por_uuid' })
  reportado_por!: Usuario | null

  @Column({ type: 'text', nullable: true })
  reportado_por_nombre!: string | null

  @ManyToOne(() => Institucion, { nullable: true })
  @JoinColumn({ name: 'institucion_reporte_uuid', referencedColumnName: 'institucion_uuid', foreignKeyConstraintName: 'fk_incendios_institucion_reporte_uuid' })
  institucion_reporte!: Institucion | null

  @Column({ type: 'text', nullable: true })
  telefono!: string | null

  @Column({ type: 'timestamptz', nullable: true })
  reportado_en!: Date | null

  @ManyToOne(() => Medio, { nullable: true })
  @JoinColumn({ name: 'medio_uuid', referencedColumnName: 'medio_uuid', foreignKeyConstraintName: 'fk_incendios_medio_uuid' })
  medio!: Medio | null

  @ManyToOne(() => Departamento, { nullable: true })
  @JoinColumn({ name: 'departamento_uuid', referencedColumnName: 'departamento_uuid', foreignKeyConstraintName: 'fk_incendios_departamento_uuid' })
  departamento!: Departamento | null

  @ManyToOne(() => Municipio, { nullable: true })
  @JoinColumn({ name: 'municipio_uuid', referencedColumnName: 'municipio_uuid', foreignKeyConstraintName: 'fk_incendios_municipio_uuid' })
  municipio!: Municipio | null

  @Column({ type: 'text', nullable: true })
  lugar_poblado!: string | null

  @Column({ type: 'text', nullable: true })
  finca!: string | null

  // =============================================================================

  @CreateDateColumn({ type: 'timestamptz', name: 'creado_en', default: () => 'now()' })
  creado_en!: Date

  @UpdateDateColumn({ type: 'timestamptz', name: 'actualizado_en', default: () => 'now()' })
  actualizado_en!: Date

  @DeleteDateColumn({ type: 'timestamptz', name: 'eliminado_en', nullable: true })
  eliminado_en!: Date | null
}
