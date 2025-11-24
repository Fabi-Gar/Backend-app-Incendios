import { Entity, PrimaryColumn, OneToOne, JoinColumn, ManyToOne, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from 'typeorm'
import { Incendio } from '../../incendios/entities/incendio.entity'
import { IniciadoJuntoACatalogo } from './catalogos/iniciado-junto-a-catalogo.entity'

@Entity('cierre_iniciado_junto_a')
export class CierreIniciadoJuntoA {
  @PrimaryColumn({ type: 'uuid', name: 'incendio_uuid' })
  incendio_uuid!: string

  @OneToOne(() => Incendio, { nullable: false })
  @JoinColumn({ name: 'incendio_uuid', referencedColumnName: 'incendio_uuid', foreignKeyConstraintName: 'fk_cierre_iniciado_incendio_uuid' })
  incendio!: Incendio

  @ManyToOne(() => IniciadoJuntoACatalogo, { nullable: false })
  @JoinColumn({ name: 'iniciado_id', referencedColumnName: 'iniciado_id', foreignKeyConstraintName: 'fk_cierre_iniciado_catalogo' })
  iniciado!: IniciadoJuntoACatalogo

  @Column({ type: 'text', nullable: true })
  otro_texto!: string | null

  @CreateDateColumn({ type: 'timestamptz', name: 'creado_en', default: () => 'now()' })
  creado_en!: Date

  @UpdateDateColumn({ type: 'timestamptz', name: 'actualizado_en', default: () => 'now()' })
  actualizado_en!: Date

  @DeleteDateColumn({ type: 'timestamptz', name: 'eliminado_en', nullable: true })
  eliminado_en!: Date | null
}
