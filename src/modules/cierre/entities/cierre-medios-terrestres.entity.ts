import { Entity, PrimaryColumn, ManyToOne, JoinColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from 'typeorm'
import { Incendio } from '../../incendios/entities/incendio.entity'
import { MediosTerrestresCatalogo } from './catalogos/medios-terrestres-catalogo.entity'

@Entity('cierre_medios_terrestres')
export class CierreMediosTerrestres {
  @PrimaryColumn({ type: 'uuid', name: 'incendio_uuid' })
  incendio_uuid!: string

  @PrimaryColumn({ type: 'text', name: 'medio_terrestre_id' })
  medio_terrestre_id!: string

  @ManyToOne(() => Incendio, { nullable: false })
  @JoinColumn({ name: 'incendio_uuid', referencedColumnName: 'incendio_uuid', foreignKeyConstraintName: 'fk_medios_terr_incendio_uuid' })
  incendio!: Incendio

  @ManyToOne(() => MediosTerrestresCatalogo, { nullable: false })
  @JoinColumn({ name: 'medio_terrestre_id', referencedColumnName: 'medio_terrestre_id', foreignKeyConstraintName: 'fk_medios_terr_catalogo' })
  medio!: MediosTerrestresCatalogo

  @Column({ type: 'int', default: 0 })
  cantidad!: number

  @CreateDateColumn({ type: 'timestamptz', name: 'creado_en', default: () => 'now()' })
  creado_en!: Date

  @UpdateDateColumn({ type: 'timestamptz', name: 'actualizado_en', default: () => 'now()' })
  actualizado_en!: Date

  @DeleteDateColumn({ type: 'timestamptz', name: 'eliminado_en', nullable: true })
  eliminado_en!: Date | null
}
