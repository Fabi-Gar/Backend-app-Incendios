import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from 'typeorm'

@Entity('estado_incendio')
export class EstadoIncendio {
  @PrimaryGeneratedColumn('uuid', { name: 'estado_incendio_uuid' })
  estado_incendio_uuid!: string

  @Column({ type: 'text', unique: true })
  codigo!: string

  @Column({ type: 'text' })
  nombre!: string

  @Column({ type: 'int' })
  orden!: number

  @CreateDateColumn({ type: 'timestamptz', name: 'creado_en', default: () => 'now()' })
  creado_en!: Date

  @UpdateDateColumn({ type: 'timestamptz', name: 'actualizado_en', default: () => 'now()' })
  actualizado_en!: Date

  @DeleteDateColumn({ type: 'timestamptz', name: 'eliminado_en', nullable: true })
  eliminado_en!: Date | null
}
