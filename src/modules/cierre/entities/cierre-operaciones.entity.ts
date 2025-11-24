import {
  Entity, PrimaryColumn, OneToOne, JoinColumn, CreateDateColumn,
  UpdateDateColumn, DeleteDateColumn, ManyToOne, Column
} from 'typeorm'
import { Incendio } from '../../incendios/entities/incendio.entity'
import { TipoIncendio } from './catalogos/tipo-incendio.entity'

@Entity('cierre_operaciones')
export class CierreOperaciones {
  @PrimaryColumn({ type: 'uuid', name: 'incendio_uuid' })
  incendio_uuid!: string

  @OneToOne(() => Incendio, { nullable: false })
  @JoinColumn({
    name: 'incendio_uuid',
    referencedColumnName: 'incendio_uuid',
    foreignKeyConstraintName: 'fk_cierre_operaciones_incendio_uuid',
  })
  incendio!: Incendio

  @Column({ type: 'text', name: 'tipo_incendio_principal_id', nullable: true })
  tipo_incendio_principal_id!: string | null

  @ManyToOne(() => TipoIncendio, { nullable: true })
  @JoinColumn({
    name: 'tipo_incendio_principal_id',
    referencedColumnName: 'tipo_incendio_id',
    foreignKeyConstraintName: 'fk_cierre_operaciones_tipo_incendio',
  })
  tipo_incendio_principal!: TipoIncendio | null

  @CreateDateColumn({ type: 'timestamptz', name: 'creado_en', default: () => 'now()' })
  creado_en!: Date

  @UpdateDateColumn({ type: 'timestamptz', name: 'actualizado_en', default: () => 'now()' })
  actualizado_en!: Date

  @DeleteDateColumn({ type: 'timestamptz', name: 'eliminado_en', nullable: true })
  eliminado_en!: Date | null
}
