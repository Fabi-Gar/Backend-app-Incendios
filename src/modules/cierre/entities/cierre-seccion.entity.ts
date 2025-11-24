import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, Index } from 'typeorm'
import { CierrePlantilla } from './cierre-plantilla.entity'

@Entity('cierre_secciones')
@Index('idx_cierre_secciones_plantilla', ['plantilla_uuid'])
export class CierreSeccion {
  @PrimaryGeneratedColumn('uuid', { name: 'seccion_uuid' })
  seccion_uuid!: string

  @ManyToOne(() => CierrePlantilla, { nullable: false })
  @JoinColumn({ name: 'plantilla_uuid', referencedColumnName: 'plantilla_uuid', foreignKeyConstraintName: 'fk_cierre_secciones_plantilla' })
  plantilla!: CierrePlantilla

  @Column({ type: 'uuid', name: 'plantilla_uuid' })
  plantilla_uuid!: string

  @Column({ type: 'text' })
  nombre!: string

  @Column({ type: 'text', nullable: true })
  descripcion!: string | null

  @Column({ type: 'integer' })
  orden!: number

  @Column({ type: 'text', nullable: true })
  icono!: string | null

  @CreateDateColumn({ type: 'timestamptz', name: 'creado_en', default: () => 'now()' })
  creado_en!: Date

  @UpdateDateColumn({ type: 'timestamptz', name: 'actualizado_en', default: () => 'now()' })
  actualizado_en!: Date

  @DeleteDateColumn({ type: 'timestamptz', name: 'eliminado_en', nullable: true })
  eliminado_en!: Date | null
}
