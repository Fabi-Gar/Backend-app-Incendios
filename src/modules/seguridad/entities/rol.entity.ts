import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from 'typeorm'

@Entity('roles')
export class Rol {
  @PrimaryGeneratedColumn('uuid', { name: 'rol_uuid' })
  rol_uuid!: string

  @Column({ type: 'text', unique: true })
  nombre!: string

  @Column({ type: 'text', nullable: true })
  descripcion?: string | null

  @CreateDateColumn({ type: 'timestamptz', name: 'creado_en', default: () => 'now()' })
  creado_en!: Date

  @UpdateDateColumn({ type: 'timestamptz', name: 'actualizado_en', default: () => 'now()' })
  actualizado_en!: Date

  @DeleteDateColumn({ type: 'timestamptz', name: 'eliminado_en', nullable: true })
  eliminado_en!: Date | null
}
