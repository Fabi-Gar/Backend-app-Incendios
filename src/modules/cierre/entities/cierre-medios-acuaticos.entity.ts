import { Entity, PrimaryColumn, ManyToOne, JoinColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from 'typeorm'
import { Incendio } from '../../incendios/entities/incendio.entity'
import { MediosAcuaticosCatalogo } from './catalogos/medios-acuaticos-catalogo.entity'

@Entity('cierre_medios_acuaticos')
export class CierreMediosAcuaticos {
  @PrimaryColumn({ type: 'uuid', name: 'incendio_uuid' })
  incendio_uuid!: string

  @PrimaryColumn({ type: 'text', name: 'medio_acuatico_id' })
  medio_acuatico_id!: string

  @ManyToOne(() => Incendio, { nullable: false })
  @JoinColumn({ name: 'incendio_uuid', referencedColumnName: 'incendio_uuid', foreignKeyConstraintName: 'fk_medios_acua_incendio_uuid' })
  incendio!: Incendio

  @ManyToOne(() => MediosAcuaticosCatalogo, { nullable: false })
  @JoinColumn({ name: 'medio_acuatico_id', referencedColumnName: 'medio_acuatico_id', foreignKeyConstraintName: 'fk_medios_acua_catalogo' })
  medio!: MediosAcuaticosCatalogo

  @Column({ type: 'int', default: 0 })
  cantidad!: number

  @CreateDateColumn({ type: 'timestamptz', name: 'creado_en', default: () => 'now()' })
  creado_en!: Date

  @UpdateDateColumn({ type: 'timestamptz', name: 'actualizado_en', default: () => 'now()' })
  actualizado_en!: Date

  @DeleteDateColumn({ type: 'timestamptz', name: 'eliminado_en', nullable: true })
  eliminado_en!: Date | null
}
