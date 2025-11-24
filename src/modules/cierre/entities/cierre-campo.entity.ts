import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, Index } from 'typeorm'
import { CierreSeccion } from './cierre-seccion.entity'

@Entity('cierre_campos')
@Index('idx_cierre_campos_seccion', ['seccion_uuid'])
@Index('idx_cierre_campos_campo_padre', ['campo_padre_uuid'])
export class CierreCampo {
  @PrimaryGeneratedColumn('uuid', { name: 'campo_uuid' })
  campo_uuid!: string

  @ManyToOne(() => CierreSeccion, { nullable: false })
  @JoinColumn({ name: 'seccion_uuid', referencedColumnName: 'seccion_uuid', foreignKeyConstraintName: 'fk_cierre_campos_seccion' })
  seccion!: CierreSeccion

  @Column({ type: 'uuid', name: 'seccion_uuid' })
  seccion_uuid!: string

  // Campo padre para jerarquía (ej: "Área Afectada" -> "Tipos de Área Afectada")
  @ManyToOne(() => CierreCampo, { nullable: true })
  @JoinColumn({ name: 'campo_padre_uuid', referencedColumnName: 'campo_uuid', foreignKeyConstraintName: 'fk_cierre_campos_campo_padre' })
  campo_padre!: CierreCampo | null

  @Column({ type: 'uuid', name: 'campo_padre_uuid', nullable: true })
  campo_padre_uuid!: string | null

  @Column({ type: 'text' })
  nombre!: string

  @Column({ type: 'text', nullable: true })
  descripcion!: string | null

  @Column({ type: 'text', nullable: true })
  placeholder!: string | null

  // Tipos: text, textarea, number, date, datetime, select, multiselect, checkbox, radio, file, currency, percentage
  @Column({ type: 'text' })
  tipo!: string

  @Column({ type: 'integer' })
  orden!: number

  @Column({ type: 'boolean', default: false })
  requerido!: boolean

  // Opciones para select, multiselect, radio (array de objetos {value, label})
  @Column({ type: 'jsonb', nullable: true })
  opciones!: any | null

  // Validaciones adicionales (ej: min, max, pattern, minLength, maxLength)
  @Column({ type: 'jsonb', nullable: true })
  validaciones!: any | null

  // Dependencias condicionales (ej: mostrar solo si otro campo tiene cierto valor)
  @Column({ type: 'jsonb', nullable: true })
  dependencias!: any | null

  @Column({ type: 'text', nullable: true })
  unidad!: string | null

  @Column({ type: 'text', nullable: true })
  ayuda!: string | null

  @CreateDateColumn({ type: 'timestamptz', name: 'creado_en', default: () => 'now()' })
  creado_en!: Date

  @UpdateDateColumn({ type: 'timestamptz', name: 'actualizado_en', default: () => 'now()' })
  actualizado_en!: Date

  @DeleteDateColumn({ type: 'timestamptz', name: 'eliminado_en', nullable: true })
  eliminado_en!: Date | null
}
