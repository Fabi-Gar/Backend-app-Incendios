import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm'

@Entity('tipos_incendio')
export class TipoIncendio {
  @PrimaryColumn({
    type: 'text',
    name: 'tipo_incendio_id',
    default: () => 'gen_random_uuid()', 
  })
  tipo_incendio_id!: string

  @Column({ type: 'text', unique: true })
  nombre!: string

  @CreateDateColumn({
    type: 'timestamptz',
    name: 'creado_en',
    default: () => 'now()',
  })
  creado_en!: Date

  @UpdateDateColumn({
    type: 'timestamptz',
    name: 'actualizado_en',
    default: () => 'now()',
  })
  actualizado_en!: Date

  @DeleteDateColumn({
    type: 'timestamptz',
    name: 'eliminado_en',
    nullable: true,
  })
  eliminado_en!: Date | null
}
