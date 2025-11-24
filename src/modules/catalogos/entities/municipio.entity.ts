import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, Index } from 'typeorm'
import { Departamento } from './departamento.entity'

@Index('uq_municipios_depto_nombre', ['departamento', 'nombre'], { unique: true })
@Index('idx_municipios_depto_nombre', ['departamento', 'nombre'])
@Entity('municipios')
export class Municipio {
  @PrimaryGeneratedColumn('uuid', { name: 'municipio_uuid' })
  municipio_uuid!: string

  @ManyToOne(() => Departamento, { nullable: false })
  @JoinColumn({ name: 'departamento_uuid', referencedColumnName: 'departamento_uuid', foreignKeyConstraintName: 'fk_municipios_departamento_uuid' })
  departamento!: Departamento

  @Column({ type: 'text' })
  nombre!: string

  @CreateDateColumn({ type: 'timestamptz', name: 'creado_en', default: () => 'now()' })
  creado_en!: Date

  @UpdateDateColumn({ type: 'timestamptz', name: 'actualizado_en', default: () => 'now()' })
  actualizado_en!: Date

  @DeleteDateColumn({ type: 'timestamptz', name: 'eliminado_en', nullable: true })
  eliminado_en!: Date | null
}
