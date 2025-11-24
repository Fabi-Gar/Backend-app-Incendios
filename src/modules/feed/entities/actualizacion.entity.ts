import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, Index } from 'typeorm'
import { Incendio } from '../../incendios/entities/incendio.entity'
import { Usuario } from '../../seguridad/entities/usuario.entity'
import { IncendioEstadoHistorial } from '../../incendios/entities/incendio-estado-historial.entity'
import { FotoReporte } from '../../incendios/entities/foto-reporte.entity'
import { IncendioRegistroResponsable } from '../../responsable/entities/incendio-registro-responsable.entity'
import { ZonaAfectada } from '../../geoespacial/entities/zona-afectada.entity'
import { PuntoCalor } from '../../geoespacial/entities/punto-calor.entity'
import { CierreEventosOperativos } from '../../eventos/entities/cierre-eventos-operativos.entity'

@Entity('actualizaciones')
@Index('idx_actualizaciones_incendio_fecha', ['incendio', 'creado_en'])
@Index('idx_actualizaciones_creado_en', ['creado_en'])
export class Actualizacion {
  @PrimaryGeneratedColumn('uuid', { name: 'actualizacion_uuid' })
  actualizacion_uuid!: string

  @ManyToOne(() => Incendio, { nullable: false })
  @JoinColumn({ name: 'incendio_uuid', referencedColumnName: 'incendio_uuid', foreignKeyConstraintName: 'fk_actualizaciones_incendio_uuid' })
  incendio!: Incendio

  @Column({ type: 'text' })
  tipo!: 'CAMBIO_ESTADO' | 'NUEVO_REPORTE' | 'NUEVA_FOTO' | 'RESPONSABLE_REGISTRADO' | 'CIERRE_INICIADO' | 'CIERRE_ACTUALIZADO' | 'AREA_AFECTADA_AGREGADA' | 'PUNTO_CALOR_ASOCIADO' | 'LLEGADA_MEDIO' | 'CONTROLADO' | 'EXTINGUIDO' | 'NOTA'

  @Column({ type: 'text', nullable: true })
  descripcion_corta!: string | null

  @ManyToOne(() => Usuario, { nullable: true })
  @JoinColumn({ name: 'creado_por', referencedColumnName: 'usuario_uuid', foreignKeyConstraintName: 'fk_actualizaciones_creado_por' })
  creado_por!: Usuario | null

  @CreateDateColumn({ type: 'timestamptz', name: 'creado_en', default: () => 'now()' })
  creado_en!: Date

  // Referencias opcionales
  @ManyToOne(() => IncendioEstadoHistorial, { nullable: true })
  @JoinColumn({ name: 'historial_uuid', referencedColumnName: 'historial_uuid', foreignKeyConstraintName: 'fk_actualizaciones_historial_uuid' })
  historial!: IncendioEstadoHistorial | null

  @ManyToOne(() => FotoReporte, { nullable: true })
  @JoinColumn({ name: 'foto_reporte_uuid', referencedColumnName: 'foto_reporte_uuid', foreignKeyConstraintName: 'fk_actualizaciones_foto_reporte_uuid' })
  foto_reporte!: FotoReporte | null

  @ManyToOne(() => IncendioRegistroResponsable, { nullable: true })
  @JoinColumn({ name: 'responsable_incendio_uuid', referencedColumnName: 'incendio_uuid', foreignKeyConstraintName: 'fk_actualizaciones_responsable_uuid' })
  responsable!: IncendioRegistroResponsable | null

  @ManyToOne(() => ZonaAfectada, { nullable: true })
  @JoinColumn({ name: 'zona_afectada_uuid', referencedColumnName: 'zona_afectada_uuid', foreignKeyConstraintName: 'fk_actualizaciones_zona_uuid' })
  zona_afectada!: ZonaAfectada | null

  @ManyToOne(() => PuntoCalor, { nullable: true })
  @JoinColumn({ name: 'punto_calor_uuid', referencedColumnName: 'punto_calor_uuid', foreignKeyConstraintName: 'fk_actualizaciones_punto_calor_uuid' })
  punto_calor!: PuntoCalor | null

  @ManyToOne(() => CierreEventosOperativos, { nullable: true })
  @JoinColumn({ name: 'evento_operativo_uuid', referencedColumnName: 'evento_operativo_uuid', foreignKeyConstraintName: 'fk_actualizaciones_evento_operativo_uuid' })
  evento_operativo!: CierreEventosOperativos | null

  @UpdateDateColumn({ type: 'timestamptz', name: 'actualizado_en', default: () => 'now()' })
  actualizado_en!: Date

  @DeleteDateColumn({ type: 'timestamptz', name: 'eliminado_en', nullable: true })
  eliminado_en!: Date | null
}
