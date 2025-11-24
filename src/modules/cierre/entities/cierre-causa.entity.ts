import { Entity, PrimaryColumn, OneToOne, JoinColumn, ManyToOne, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from 'typeorm'
import { Incendio } from '../../incendios/entities/incendio.entity'
import { CausasCatalogo } from './catalogos/causas-catalogo.entity'

@Entity('cierre_causa')
export class CierreCausa {
  @PrimaryColumn({ type: 'uuid', name: 'incendio_uuid' })
  incendio_uuid!: string

  @OneToOne(() => Incendio, { nullable: false })
  @JoinColumn({ name: 'incendio_uuid', referencedColumnName: 'incendio_uuid', foreignKeyConstraintName: 'fk_cierre_causa_incendio_uuid' })
  incendio!: Incendio

  @ManyToOne(() => CausasCatalogo, { nullable: false })
  @JoinColumn({ name: 'causa_id', referencedColumnName: 'causa_id', foreignKeyConstraintName: 'fk_cierre_causa_catalogo' })
  causa!: CausasCatalogo

  @Column({ type: 'text', nullable: true })
  otro_texto!: string | null

  @CreateDateColumn({ type: 'timestamptz', name: 'creado_en', default: () => 'now()' })
  creado_en!: Date

  @UpdateDateColumn({ type: 'timestamptz', name: 'actualizado_en', default: () => 'now()' })
  actualizado_en!: Date

  @DeleteDateColumn({ type: 'timestamptz', name: 'eliminado_en', nullable: true })
  eliminado_en!: Date | null
}
