import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm'

@Entity('medios_aereos_catalogo')
export class MediosAereosCatalogo {
  @PrimaryColumn({ type: 'text', name: 'medio_aereo_id' , default: () => 'uuid_generate_v4()'})
  medio_aereo_id!: string

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
