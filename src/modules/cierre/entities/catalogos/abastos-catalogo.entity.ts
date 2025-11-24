import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  PrimaryColumn,
} from 'typeorm'

@Entity('abastos_catalogo')
export class AbastosCatalogo {
  @PrimaryColumn({ type: 'text', name: 'abasto_id' , default: () => 'uuid_generate_v4()'})
  abasto_id!: string

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
