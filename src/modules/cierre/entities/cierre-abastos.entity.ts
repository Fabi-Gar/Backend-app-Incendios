import { Entity, PrimaryColumn, ManyToOne, JoinColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from 'typeorm'
import { Incendio } from '../../incendios/entities/incendio.entity'
import { AbastosCatalogo } from './catalogos/abastos-catalogo.entity'

@Entity('cierre_abastos')
export class CierreAbastos {
  @PrimaryColumn({ type: 'uuid', name: 'incendio_uuid' })
  incendio_uuid!: string

  @PrimaryColumn({ type: 'text', name: 'abasto_id' })
  abasto_id!: string

  @ManyToOne(() => Incendio, { nullable: false })
  @JoinColumn({ name: 'incendio_uuid', referencedColumnName: 'incendio_uuid', foreignKeyConstraintName: 'fk_abastos_incendio_uuid' })
  incendio!: Incendio

  @ManyToOne(() => AbastosCatalogo, { nullable: false })
  @JoinColumn({ name: 'abasto_id', referencedColumnName: 'abasto_id', foreignKeyConstraintName: 'fk_abastos_catalogo' })
  abasto!: AbastosCatalogo

  @Column({ type: 'int', default: 0 })
  cantidad!: number

  @CreateDateColumn({ type: 'timestamptz', name: 'creado_en', default: () => 'now()' })
  creado_en!: Date

  @UpdateDateColumn({ type: 'timestamptz', name: 'actualizado_en', default: () => 'now()' })
  actualizado_en!: Date

  @DeleteDateColumn({ type: 'timestamptz', name: 'eliminado_en', nullable: true })
  eliminado_en!: Date | null
}
