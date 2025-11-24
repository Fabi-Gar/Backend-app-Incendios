import {
  Entity,
  Column,
  ManyToOne,
  PrimaryGeneratedColumn,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn
} from 'typeorm'
import { Incendio } from '../../incendios/entities/incendio.entity'
import { Institucion } from '../../seguridad/entities/institucion.entity'

@Entity('info_falsa_incendio')
export class InfoFalsaIncendio {
  @PrimaryGeneratedColumn('uuid')
  info_falsa_uuid!: string

  @ManyToOne(() => Incendio, (i) => i.info_falsa, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'incendio_uuid' })
  incendio!: Incendio

  @ManyToOne(() => Institucion, { nullable: true })
  @JoinColumn({ name: 'institucion_validadora_uuid' })
  institucion_validadora?: Institucion | null

  @Column({ type: 'text', nullable: true })
  razon!: string | null

  @Column({ type: 'text', nullable: true })
  descripcion_detallada!: string | null

  @Column({ type: 'varchar', length: 150, nullable: true })
  validador_nombre!: string | null

  @Column({ type: 'varchar', length: 50, nullable: true })
  validador_contacto!: string | null

  @Column({ type: 'timestamptz', nullable: true })
  fecha_verificacion!: Date | null

  @Column({ type: 'geometry', spatialFeatureType: 'Point', srid: 4326, nullable: true })
  ubicacion_verificada!: any | null

  @Column({ type: 'uuid', nullable: true })
  duplicado_de_incendio_uuid!: string | null

  @Column({ type: 'integer', nullable: true })
  score_confianza!: number | null

  @CreateDateColumn({ type: 'timestamptz' })
  creado_en!: Date

  @UpdateDateColumn({ type: 'timestamptz' })
  actualizado_en!: Date
}
