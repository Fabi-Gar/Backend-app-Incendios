import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, Index } from 'typeorm'
import { Incendio } from '../../incendios/entities/incendio.entity'
import { CierreCampo } from './cierre-campo.entity'
import { Usuario } from '../../seguridad/entities/usuario.entity'

@Entity('cierre_respuestas')
@Index('idx_cierre_respuestas_incendio', ['incendio_uuid'])
@Index('idx_cierre_respuestas_campo', ['campo_uuid'])
export class CierreRespuesta {
  @PrimaryGeneratedColumn('uuid', { name: 'respuesta_uuid' })
  respuesta_uuid!: string

  @ManyToOne(() => Incendio, { nullable: false })
  @JoinColumn({ name: 'incendio_uuid', referencedColumnName: 'incendio_uuid', foreignKeyConstraintName: 'fk_cierre_respuestas_incendio' })
  incendio!: Incendio

  @Column({ type: 'uuid', name: 'incendio_uuid' })
  incendio_uuid!: string

  @ManyToOne(() => CierreCampo, { nullable: false })
  @JoinColumn({ name: 'campo_uuid', referencedColumnName: 'campo_uuid', foreignKeyConstraintName: 'fk_cierre_respuestas_campo' })
  campo!: CierreCampo

  @Column({ type: 'uuid', name: 'campo_uuid' })
  campo_uuid!: string

  // Múltiples columnas para diferentes tipos de datos
  @Column({ type: 'text', nullable: true })
  valor_texto!: string | null

  @Column({ type: 'numeric', nullable: true })
  valor_numero!: number | null

  @Column({ type: 'date', nullable: true })
  valor_fecha!: Date | null

  @Column({ type: 'timestamptz', nullable: true })
  valor_datetime!: Date | null

  @Column({ type: 'boolean', nullable: true })
  valor_boolean!: boolean | null

  // Para arrays (multiselect), objetos complejos, archivos
  @Column({ type: 'jsonb', nullable: true })
  valor_json!: any | null

  @ManyToOne(() => Usuario, { nullable: false })
  @JoinColumn({ name: 'respondido_por_uuid', referencedColumnName: 'usuario_uuid', foreignKeyConstraintName: 'fk_cierre_respuestas_respondido_por' })
  respondido_por!: Usuario

  @Column({ type: 'uuid', name: 'respondido_por_uuid' })
  respondido_por_uuid!: string

  @CreateDateColumn({ type: 'timestamptz', name: 'creado_en', default: () => 'now()' })
  creado_en!: Date

  @UpdateDateColumn({ type: 'timestamptz', name: 'actualizado_en', default: () => 'now()' })
  actualizado_en!: Date

  @DeleteDateColumn({ type: 'timestamptz', name: 'eliminado_en', nullable: true })
  eliminado_en!: Date | null
}
