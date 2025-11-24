import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm'

@Entity('iniciado_junto_a_catalogo')
export class IniciadoJuntoACatalogo {
  @PrimaryColumn({ type: 'text', name: 'iniciado_id' , default: () => 'uuid_generate_v4()'})
  iniciado_id!: string

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
