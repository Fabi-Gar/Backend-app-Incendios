import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, Index } from 'typeorm'
import { Usuario } from '../../seguridad/entities/usuario.entity'

@Entity('cierre_plantillas')
@Index('idx_cierre_plantillas_activa', ['activa'])
export class CierrePlantilla {
  @PrimaryGeneratedColumn('uuid', { name: 'plantilla_uuid' })
  plantilla_uuid!: string

  @Column({ type: 'text' })
  nombre!: string

  @Column({ type: 'text', nullable: true })
  descripcion!: string | null

  @Column({ type: 'boolean', default: false })
  activa!: boolean

  @Column({ type: 'integer', default: 1 })
  version!: number

  @ManyToOne(() => Usuario, { nullable: false })
  @JoinColumn({ name: 'creado_por_uuid', referencedColumnName: 'usuario_uuid', foreignKeyConstraintName: 'fk_cierre_plantillas_creado_por' })
  creado_por!: Usuario

  @CreateDateColumn({ type: 'timestamptz', name: 'creado_en', default: () => 'now()' })
  creado_en!: Date

  @UpdateDateColumn({ type: 'timestamptz', name: 'actualizado_en', default: () => 'now()' })
  actualizado_en!: Date

  @DeleteDateColumn({ type: 'timestamptz', name: 'eliminado_en', nullable: true })
  eliminado_en!: Date | null
}
